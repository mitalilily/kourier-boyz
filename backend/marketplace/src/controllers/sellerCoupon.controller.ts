import { Request, Response } from 'express'
import mongoose from 'mongoose'
import CouponRedemption from '../models/CouponRedemption'
import Product from '../models/Product'
import ProductVariant from '../models/ProductVariant'
import SellerCoupon from '../models/SellerCoupon'
import User from '../models/User'

// --------------------
// GET all seller coupons (for seller)
// --------------------
export const getSellerCoupons = async (req: Request, res: Response) => {
  try {
    console.log('req.user', req.user)
    const sellerId = req.user?.userId
    const { status, page = 1, limit = 20 } = req.query

    if (!sellerId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }
    console.log('sellerId', sellerId)
    // Build query filter - same pattern as getSellerProducts
    // No seller validation needed - authorize(['seller']) middleware already verified the role
    const filter: Record<string, unknown> = { seller: sellerId }

    if (status) {
      filter.status = status
    }

    const skip = (Number(page) - 1) * Number(limit)

    const [coupons, total] = await Promise.all([
      SellerCoupon.find(filter)
        .populate('productIds', 'name slug mainImage')
        .populate('categoryIds', 'name slug')
        .populate('deactivatedBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      SellerCoupon.countDocuments(filter),
    ])

    // Auto-update expired coupons
    const now = new Date()
    const expiredCoupons = coupons.filter(
      (coupon) => coupon.endDate < now && coupon.status !== 'expired',
    )
    if (expiredCoupons.length > 0) {
      await SellerCoupon.updateMany(
        { _id: { $in: expiredCoupons.map((c) => c._id) } },
        { $set: { status: 'expired' } },
      )
    }

    // Add usage stats to each coupon (total redemptions including clipped/applied/redeemed)
    const couponsWithStats = await Promise.all(
      coupons.map(async (coupon) => {
        const redemptions = await CouponRedemption.find({ coupon: coupon._id })
        const totalRedemptions = redemptions.length
        const redeemedCount = redemptions.filter((r) => r.status === 'redeemed').length

        // Update coupon.redeemedCount to match actual redeemed count
        if (coupon.redeemedCount !== redeemedCount) {
          coupon.redeemedCount = redeemedCount
          await coupon.save()
        }

        return {
          ...coupon.toObject(),
          totalRedemptions, // Total redemptions (clipped + applied + redeemed)
          clippedCount: redemptions.filter((r) => r.status === 'clipped').length,
          appliedCount: redemptions.filter((r) => r.status === 'applied').length,
        }
      }),
    )

    res.json({
      coupons: couponsWithStats,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
    })
  } catch (err: unknown) {
    console.error('Error fetching seller coupons:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// --------------------
// GET single seller coupon
// --------------------
export const getSellerCoupon = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user?.userId
    const { id } = req.params

    if (!sellerId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const coupon = await SellerCoupon.findOne({
      _id: id,
      seller: sellerId,
    })
      .populate('productIds', 'name slug mainImage price')
      .populate('categoryIds', 'name slug')
      .populate('deactivatedBy', 'name email')

    if (!coupon) {
      return res.status(404).json({ error: 'Coupon not found' })
    }

    // Get usage stats
    const redemptions = await CouponRedemption.find({ coupon: id })
    const stats = {
      totalRedemptions: redemptions.length,
      clippedCount: redemptions.filter((r) => r.status === 'clipped').length,
      appliedCount: redemptions.filter((r) => r.status === 'applied').length,
      redeemedCount: redemptions.filter((r) => r.status === 'redeemed').length,
      uniqueUsers: new Set(redemptions.map((r) => r.user.toString())).size,
    }

    // Update coupon.redeemedCount to match actual redeemed count (from CouponRedemption records)
    // This ensures consistency between the coupon document and the actual redemptions
    const actualRedeemedCount = stats.redeemedCount
    if (coupon.redeemedCount !== actualRedeemedCount) {
      coupon.redeemedCount = actualRedeemedCount
      await coupon.save()
    }

    res.json({ coupon, stats })
  } catch (err: unknown) {
    console.error('Error fetching seller coupon:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// --------------------
// CREATE seller coupon
// --------------------
export const createSellerCoupon = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user?.userId
    if (!sellerId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    // Verify seller
    const seller = await User.findById(sellerId)
    if (!seller || seller.role !== 'seller') {
      return res.status(404).json({ error: 'Seller not found' })
    }

    const {
      couponCode,
      discountType,
      discountValue,
      productIds,
      categoryIds,
      startDate,
      endDate,
      maxRedemptions,
      maxRedemptionsPerUser,
      status,
      description,
    } = req.body

    // Validate required fields
    if (!discountType || !discountValue || !startDate || !endDate) {
      return res.status(400).json({
        error: 'discountType, discountValue, startDate, and endDate are required',
      })
    }

    // Validate discount value
    if (discountType === 'percent' && (discountValue <= 0 || discountValue > 100)) {
      return res.status(400).json({ error: 'Percentage must be between 1 and 100' })
    }
    if (discountType === 'flat' && discountValue <= 0) {
      return res.status(400).json({ error: 'Flat amount must be greater than 0' })
    }

    // Validate dates
    const fromDate = new Date(startDate)
    const toDate = new Date(endDate)
    if (toDate <= fromDate) {
      return res.status(400).json({ error: 'End date must be after start date' })
    }

    // Validate products belong to seller
    if (productIds && productIds.length > 0) {
      const products = await Product.find({
        _id: { $in: productIds },
        seller: sellerId,
      })
      if (products.length !== productIds.length) {
        return res.status(400).json({
          error: 'Some products do not belong to you or do not exist',
        })
      }
    }

    // Check if coupon code already exists (if provided)
    if (couponCode) {
      const existingCoupon = await SellerCoupon.findOne({
        couponCode: couponCode.toUpperCase().trim(),
      })
      if (existingCoupon) {
        return res.status(400).json({ error: 'Coupon code already exists' })
      }
    }

    const coupon = new SellerCoupon({
      seller: sellerId,
      couponCode: couponCode ? couponCode.toUpperCase().trim() : undefined,
      discountType,
      discountValue,
      productIds: productIds || [],
      categoryIds: categoryIds || [],
      startDate: fromDate,
      endDate: toDate,
      maxRedemptions,
      maxRedemptionsPerUser,
      status: status || 'active',
      description,
      requiresApproval: false, // Seller coupons are auto-approved
      isApproved: true, // Automatically approved when created
    })

    await coupon.save()

    const populatedCoupon = await SellerCoupon.findById(coupon._id)
      .populate('productIds', 'name slug mainImage')
      .populate('categoryIds', 'name slug')

    res.status(201).json({
      message: 'Coupon created successfully',
      coupon: populatedCoupon,
    })
  } catch (err: unknown) {
    console.error('Error creating seller coupon:', err)
    if ((err as any).code === 11000) {
      return res.status(400).json({ error: 'Coupon code already exists' })
    }
    res.status(500).json({ error: 'Server error' })
  }
}

// --------------------
// UPDATE seller coupon
// --------------------
export const updateSellerCoupon = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user?.userId
    const { id } = req.params

    if (!sellerId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const coupon = await SellerCoupon.findOne({ _id: id, seller: sellerId })
    if (!coupon) {
      return res.status(404).json({ error: 'Coupon not found' })
    }

    const {
      couponCode,
      discountType,
      discountValue,
      productIds,
      categoryIds,
      startDate,
      endDate,
      maxRedemptions,
      maxRedemptionsPerUser,
      status,
      description,
    } = req.body

    // Validate discount value if provided
    if (discountType !== undefined || discountValue !== undefined) {
      const finalType = discountType || coupon.discountType
      const finalValue = discountValue !== undefined ? discountValue : coupon.discountValue

      if (finalType === 'percent' && (finalValue <= 0 || finalValue > 100)) {
        return res.status(400).json({ error: 'Percentage must be between 1 and 100' })
      }
      if (finalType === 'flat' && finalValue <= 0) {
        return res.status(400).json({ error: 'Flat amount must be greater than 0' })
      }
    }

    // Validate dates if provided
    if (startDate || endDate) {
      const finalStartDate = startDate ? new Date(startDate) : coupon.startDate
      const finalEndDate = endDate ? new Date(endDate) : coupon.endDate
      if (finalEndDate <= finalStartDate) {
        return res.status(400).json({ error: 'End date must be after start date' })
      }
    }

    // Validate products belong to seller
    if (productIds !== undefined && productIds.length > 0) {
      const products = await Product.find({
        _id: { $in: productIds },
        seller: sellerId,
      })
      if (products.length !== productIds.length) {
        return res.status(400).json({
          error: 'Some products do not belong to you or do not exist',
        })
      }
    }

    // Check if coupon code is being changed and if it already exists
    if (couponCode && couponCode.toUpperCase() !== coupon.couponCode) {
      const existingCoupon = await SellerCoupon.findOne({
        couponCode: couponCode.toUpperCase(),
        _id: { $ne: id },
      })
      if (existingCoupon) {
        return res.status(400).json({ error: 'Coupon code already exists' })
      }
      coupon.couponCode = couponCode.toUpperCase().trim()
    }

    // Prevent sellers from reactivating coupons that were deactivated by admin
    if (status !== undefined && coupon.deactivationReason && coupon.deactivatedBy) {
      // If admin deactivated it, seller cannot change status back to active
      if (status === 'active') {
        return res.status(400).json({
          error: 'This coupon was deactivated by admin. Please contact support to reactivate it.',
        })
      }
    }

    // Update fields
    if (discountType !== undefined) coupon.discountType = discountType
    if (discountValue !== undefined) coupon.discountValue = discountValue
    if (productIds !== undefined) coupon.productIds = Array.isArray(productIds) ? productIds : []
    if (categoryIds !== undefined)
      coupon.categoryIds = Array.isArray(categoryIds) ? categoryIds : []
    if (startDate !== undefined) coupon.startDate = new Date(startDate)
    if (endDate !== undefined) coupon.endDate = new Date(endDate)
    if (maxRedemptions !== undefined) coupon.maxRedemptions = maxRedemptions
    if (maxRedemptionsPerUser !== undefined) coupon.maxRedemptionsPerUser = maxRedemptionsPerUser
    if (status !== undefined) coupon.status = status
    if (description !== undefined) coupon.description = description

    // Preserve approval status - coupons remain approved when edited by seller
    // Only ensure approval if it was never set (edge case) or if it's a new seller-created coupon
    // Don't change approval status if admin has modified it
    if (!coupon.requiresApproval) {
      // If doesn't require approval, ensure it's approved (seller coupons are auto-approved)
      if (!coupon.isApproved && !coupon.deactivatedBy) {
        coupon.isApproved = true
      }
    }

    await coupon.save()

    const populatedCoupon = await SellerCoupon.findById(coupon._id)
      .populate('productIds', 'name slug mainImage')
      .populate('categoryIds', 'name slug')

    res.json({
      message: 'Coupon updated successfully',
      coupon: populatedCoupon,
    })
  } catch (err: unknown) {
    console.error('Error updating seller coupon:', err)
    if ((err as any).code === 11000) {
      return res.status(400).json({ error: 'Coupon code already exists' })
    }
    res.status(500).json({ error: 'Server error' })
  }
}

// --------------------
// DELETE seller coupon
// --------------------
export const deleteSellerCoupon = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user?.userId
    const { id } = req.params

    if (!sellerId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const coupon = await SellerCoupon.findOne({ _id: id, seller: sellerId })
    if (!coupon) {
      return res.status(404).json({ error: 'Coupon not found' })
    }

    // Check if coupon has been redeemed
    const redeemedCount = await CouponRedemption.countDocuments({
      coupon: id,
      status: 'redeemed',
    })
    if (redeemedCount > 0) {
      return res.status(400).json({
        error: 'Cannot delete coupon that has been redeemed. Pause it instead.',
      })
    }

    // Delete redemptions
    await CouponRedemption.deleteMany({ coupon: id })

    // Delete coupon
    await SellerCoupon.findByIdAndDelete(id)

    res.json({ message: 'Coupon deleted successfully' })
  } catch (err: unknown) {
    console.error('Error deleting seller coupon:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// --------------------
// PAUSE seller coupon
// --------------------
export const pauseSellerCoupon = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user?.userId
    const { id } = req.params

    if (!sellerId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const coupon = await SellerCoupon.findOne({ _id: id, seller: sellerId })
    if (!coupon) {
      return res.status(404).json({ error: 'Coupon not found' })
    }

    if (coupon.status === 'paused') {
      return res.status(400).json({ error: 'Coupon is already paused' })
    }

    coupon.status = 'paused'
    await coupon.save()

    res.json({ message: 'Coupon paused successfully', coupon })
  } catch (err: unknown) {
    console.error('Error pausing seller coupon:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// --------------------
// RESUME seller coupon
// --------------------
export const resumeSellerCoupon = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user?.userId
    const { id } = req.params

    if (!sellerId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const coupon = await SellerCoupon.findOne({ _id: id, seller: sellerId })
    if (!coupon) {
      return res.status(404).json({ error: 'Coupon not found' })
    }

    if (coupon.status !== 'paused') {
      return res.status(400).json({ error: 'Coupon is not paused' })
    }

    // Check if expired
    const now = new Date()
    if (coupon.endDate < now) {
      coupon.status = 'expired'
    } else {
      coupon.status = 'active'
    }

    await coupon.save()

    res.json({ message: 'Coupon resumed successfully', coupon })
  } catch (err: unknown) {
    console.error('Error resuming seller coupon:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// --------------------
// CLIP coupon (buyer action)
// --------------------
export const clipCoupon = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId
    const { couponId } = req.body

    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    // Input validation
    if (!couponId) {
      return res.status(400).json({ error: 'Coupon ID is required' })
    }

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(couponId)) {
      return res.status(400).json({ error: 'Invalid coupon ID format' })
    }

    // Get coupon
    const coupon = await SellerCoupon.findById(couponId)
    if (!coupon) {
      return res.status(404).json({ error: 'Coupon not found' })
    }

    // Check if coupon is active and approved
    if (coupon.status !== 'active') {
      console.log('ERROR: Coupon is not active. Status:', coupon.status)
      return res.status(400).json({ error: 'Coupon is not active' })
    }

    if (coupon.requiresApproval && !coupon.isApproved) {
      console.log('ERROR: Coupon is pending approval')
      return res.status(400).json({ error: 'Coupon is pending approval' })
    }

    // Check dates
    const now = new Date()

    if (coupon.startDate > now) {
      console.log('ERROR: Coupon is not yet valid')
      return res.status(400).json({ error: 'Coupon is not yet valid' })
    }
    if (coupon.endDate < now) {
      console.log('ERROR: Coupon has expired')
      coupon.status = 'expired'
      await coupon.save()
      return res.status(400).json({ error: 'Coupon has expired' })
    }

    // Update redeemedCount to match actual redemptions (in case it's out of sync)
    const actualRedeemedCount = await CouponRedemption.countDocuments({
      coupon: couponId,
      status: 'redeemed',
    })
    if (coupon.redeemedCount !== actualRedeemedCount) {
      coupon.redeemedCount = actualRedeemedCount
      await coupon.save()
    }

    // Check max redemptions - auto-expire if reached
    if (coupon.maxRedemptions && coupon.redeemedCount >= coupon.maxRedemptions) {
      coupon.status = 'expired'
      await coupon.save()
      return res.status(400).json({
        error: 'Coupon redemption limit reached. This coupon is no longer available.',
      })
    }

    // Re-check coupon status after updates (might have changed)
    if (coupon.status !== 'active') {
      return res.status(400).json({ error: 'Coupon is not active' })
    }

    // Get user document to ensure we have the correct user ID format (same pattern as order controller)
    const user = await User.findById(userId)
    if (!user) {
      console.log('ERROR: User not found for ID:', userId)
      return res.status(401).json({ error: 'User not found' })
    }

    console.log('User found:', {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    })

    // Check if user already clipped this coupon
    const existingRedemption = await CouponRedemption.findOne({
      coupon: couponId,
      user: user._id,
      status: 'clipped',
    })
    if (existingRedemption) {
      console.log('ERROR: User has already clipped this coupon')
      return res.status(400).json({ error: 'You have already clipped this coupon' })
    }

    // Check max redemptions per user
    if (coupon.maxRedemptionsPerUser) {
      // Validate maxRedemptionsPerUser is a valid number
      if (
        !Number.isInteger(coupon.maxRedemptionsPerUser) ||
        coupon.maxRedemptionsPerUser <= 0
      ) {
        return res.status(500).json({
          error: 'Invalid coupon configuration',
        })
      }

      const userRedemptions = await CouponRedemption.countDocuments({
        coupon: couponId,
        user: user._id,
        status: 'redeemed',
      })

      if (userRedemptions >= coupon.maxRedemptionsPerUser) {
        return res.status(400).json({
          error: `You have reached the maximum usage limit for this coupon`,
        })
      }
    }

    // Create redemption record
    const redemption = new CouponRedemption({
      coupon: couponId,
      user: user._id,
      status: 'clipped',
    })

    console.log('=== clipCoupon DEBUG ===')
    console.log('Creating redemption with:', {
      coupon: couponId,
      user: (user._id as any).toString(),
      status: 'clipped',
    })

    await redemption.save()

    console.log('Redemption saved with _id:', (redemption._id as any).toString())
    console.log('Redemption user field:', (redemption.user as any)?.toString())

    // Verify the redemption was saved
    const savedRedemption = await CouponRedemption.findById(redemption._id)
    console.log('Verification - saved redemption user:', (savedRedemption?.user as any)?.toString())
    console.log('=== END clipCoupon DEBUG ===')

    // Populate the redemption before returning
    const populatedRedemption = await CouponRedemption.findById(redemption._id).populate({
      path: 'coupon',
      populate: [
        { path: 'seller', select: 'businessName storeSlug' },
        { path: 'productIds', select: 'name slug mainImage' },
        { path: 'categoryIds', select: 'name slug' },
      ],
    })

    res.json({
      message: 'Coupon clipped successfully',
      redemption: populatedRedemption,
    })
  } catch (err: unknown) {
    console.error('Error clipping coupon:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// --------------------
// APPLY coupon (checkout flow)
// --------------------
export const applyCoupon = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId
    const { couponId, cartItems, cartTotal } = req.body

    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    // Input validation
    if (!couponId) {
      return res.status(400).json({ error: 'Coupon ID is required' })
    }

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(couponId)) {
      return res.status(400).json({ error: 'Invalid coupon ID format' })
    }

    if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
      return res.status(400).json({ error: 'Cart items are required' })
    }

    // Validate cartTotal
    const cartTotalNum = Number(cartTotal)
    if (
      !Number.isFinite(cartTotalNum) ||
      cartTotalNum < 0 ||
      cartTotalNum > Number.MAX_SAFE_INTEGER
    ) {
      return res.status(400).json({ error: 'Invalid cart total' })
    }

    // Get user document to ensure we have the correct user ID format (same pattern as order controller)
    const user = await User.findById(userId)
    if (!user) {
      return res.status(401).json({ error: 'User not found' })
    }

    // Get coupon
    const coupon = await SellerCoupon.findById(couponId)
      .populate('productIds', 'name slug')
      .populate('categoryIds', 'name slug')

    if (!coupon) {
      return res.status(404).json({ error: 'Coupon not found' })
    }

    // Check if coupon is active and approved
    if (coupon.status !== 'active') {
      return res.status(400).json({ error: 'Coupon is not active' })
    }

    if (coupon.requiresApproval && !coupon.isApproved) {
      return res.status(400).json({ error: 'Coupon is pending approval' })
    }

    // Check dates
    const now = new Date()
    if (coupon.startDate > now) {
      return res.status(400).json({ error: 'Coupon is not yet valid' })
    }
    if (coupon.endDate < now) {
      coupon.status = 'expired'
      await coupon.save()
      return res.status(400).json({ error: 'Coupon has expired' })
    }

    // Update redeemedCount to match actual redemptions (in case it's out of sync)
    const actualRedeemedCount = await CouponRedemption.countDocuments({
      coupon: couponId,
      status: 'redeemed',
    })
    if (coupon.redeemedCount !== actualRedeemedCount) {
      coupon.redeemedCount = actualRedeemedCount
      await coupon.save()
    }

    // Check max redemptions - auto-expire if reached
    if (coupon.maxRedemptions && coupon.redeemedCount >= coupon.maxRedemptions) {
      coupon.status = 'expired'
      await coupon.save()
      return res.status(400).json({
        error: 'Coupon redemption limit reached. This coupon is no longer available.',
      })
    }

    // Re-check coupon status after updates (might have changed)
    await coupon.populate('productIds', 'name slug')
    await coupon.populate('categoryIds', 'name slug')
    if (coupon.status !== 'active') {
      return res.status(400).json({ error: 'Coupon is not active' })
    }

    // Check max redemptions per user
    if (coupon.maxRedemptionsPerUser) {
      // Validate maxRedemptionsPerUser is a valid number
      if (
        !Number.isInteger(coupon.maxRedemptionsPerUser) ||
        coupon.maxRedemptionsPerUser <= 0
      ) {
        return res.status(500).json({
          error: 'Invalid coupon configuration',
        })
      }

      const userRedemptions = await CouponRedemption.countDocuments({
        coupon: couponId,
        user: user._id,
        status: 'redeemed',
      })
      if (userRedemptions >= coupon.maxRedemptionsPerUser) {
        return res.status(400).json({
          error: `You have reached the maximum usage limit for this coupon`,
        })
      }
    }

    // Check if coupon applies to cart items
    const eligibleItems: any[] = []
    let eligibleTotal = 0

    for (const item of cartItems) {
      const productId = item.product?._id || item.product
      if (!productId) continue

      // Validate productId format
      if (!mongoose.Types.ObjectId.isValid(productId)) {
        continue
      }

      const product = await Product.findById(productId).populate('category')
      if (!product) continue

      // Validate product belongs to coupon seller
      if (product.seller.toString() !== coupon.seller.toString()) {
        continue
      }

      // Check product is available
      if (product.status !== 'active' && product.status !== 'out_of_stock') {
        continue
      }

      // Check if product matches coupon criteria (seller already verified above)
      let isEligible = false

      // If no productIds or categoryIds specified, applies to all seller products
      if (
        (!coupon.productIds || coupon.productIds.length === 0) &&
        (!coupon.categoryIds || coupon.categoryIds.length === 0)
      ) {
        // Seller already verified, so product is eligible
        isEligible = true
      } else {
        // Check product-level
        if (coupon.productIds && coupon.productIds.length > 0) {
          const productIdsStr = coupon.productIds.map((id) => id.toString())
          if (productIdsStr.includes(productId.toString())) {
            isEligible = true
          }
        }

        // Check category-level
        if (!isEligible && coupon.categoryIds && coupon.categoryIds.length > 0) {
          const categoryIdsStr = coupon.categoryIds.map((id) => id.toString())
          const productCategoryId =
            (product.category as any)?._id?.toString() || product.category?.toString()
          if (productCategoryId && categoryIdsStr.includes(productCategoryId)) {
            isEligible = true
          }
        }
      }

      if (isEligible) {
        const itemPrice =
          item.variant?.effectivePrice ??
          item.variant?.price ??
          item.effectivePrice ??
          item.price ??
          product.effectivePrice ??
          product.price ??
          0

        // Validate item price
        if (
          !Number.isFinite(itemPrice) ||
          itemPrice <= 0 ||
          itemPrice > Number.MAX_SAFE_INTEGER
        ) {
          continue
        }

        // Validate quantity
        const itemQuantity = Number(item.quantity || 1)
        if (
          !Number.isInteger(itemQuantity) ||
          itemQuantity <= 0 ||
          itemQuantity > 10000 ||
          !Number.isFinite(itemQuantity)
        ) {
          continue
        }

        eligibleItems.push(item)
        const itemTotal = itemPrice * itemQuantity
        if (Number.isFinite(itemTotal) && itemTotal > 0) {
          eligibleTotal += itemTotal
        }
      }
    }

    if (eligibleItems.length === 0) {
      return res.status(400).json({
        error: 'Coupon is not applicable to items in your cart',
      })
    }

    // Validate discount value
    if (
      !Number.isFinite(coupon.discountValue) ||
      coupon.discountValue <= 0 ||
      coupon.discountValue > Number.MAX_SAFE_INTEGER
    ) {
      return res.status(400).json({
        error: 'Invalid discount value in coupon configuration',
        valid: false,
      })
    }

    // Validate eligible total
    if (!Number.isFinite(eligibleTotal) || eligibleTotal <= 0) {
      return res.status(400).json({
        error: 'No eligible items found with valid prices',
        valid: false,
      })
    }

    // Calculate discount
    let discount = 0
    if (coupon.discountType === 'percent') {
      // Validate percent is between 0 and 100
      if (coupon.discountValue > 100 || coupon.discountValue < 0) {
        return res.status(400).json({
          error: 'Invalid discount percentage. Must be between 0 and 100.',
          valid: false,
        })
      }
      discount = (eligibleTotal * coupon.discountValue) / 100
      // Round to 2 decimal places
      discount = Math.round(discount * 100) / 100
    } else {
      discount = coupon.discountValue
      if (discount > eligibleTotal) {
        discount = eligibleTotal
      }
    }

    // Validate discount
    if (!Number.isFinite(discount) || discount < 0) {
      return res.status(500).json({
        error: 'Error calculating discount',
        valid: false,
      })
    }

    // Update or create redemption record
    let redemption = await CouponRedemption.findOne({
      coupon: couponId,
      user: user._id,
      status: { $in: ['clipped', 'applied'] },
    })

    if (redemption) {
      redemption.status = 'applied'
      redemption.discountAmount = discount
      redemption.orderTotal = cartTotal
    } else {
      redemption = new CouponRedemption({
        coupon: couponId,
        user: user._id,
        status: 'applied',
        discountAmount: discount,
        orderTotal: cartTotal,
      })
    }

    await redemption.save()

    res.json({
      valid: true,
      discount: Math.round(discount * 100) / 100,
      eligibleTotal: Math.round(eligibleTotal * 100) / 100,
      eligibleItems: eligibleItems.length,
      coupon: {
        _id: coupon._id,
        couponCode: coupon.couponCode,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        description: coupon.description,
      },
    })
  } catch (err: unknown) {
    console.error('Error applying coupon:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// --------------------
// Calculate discount for a single product with quantity
// --------------------
export const calculateProductDiscount = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId
    const { couponId, productId, quantity = 1, variantId } = req.body

    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    // Input validation
    if (!couponId || !productId) {
      return res.status(400).json({
        error: 'Coupon ID and product ID are required',
      })
    }

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(couponId)) {
      return res.status(400).json({ error: 'Invalid coupon ID format' })
    }
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ error: 'Invalid product ID format' })
    }
    if (variantId && !mongoose.Types.ObjectId.isValid(variantId)) {
      return res.status(400).json({ error: 'Invalid variant ID format' })
    }

    // Validate quantity
    const quantityNum = Number(quantity)
    if (
      !Number.isInteger(quantityNum) ||
      quantityNum <= 0 ||
      quantityNum > 10000 ||
      !Number.isFinite(quantityNum)
    ) {
      return res.status(400).json({
        error: 'Quantity must be a positive integer between 1 and 10000',
      })
    }

    // Get coupon
    const coupon = await SellerCoupon.findById(couponId)
      .populate('productIds', 'name slug')
      .populate('categoryIds', 'name slug')

    if (!coupon) {
      return res.status(404).json({ error: 'Coupon not found' })
    }

    // Check if coupon is active and approved
    if (coupon.status !== 'active') {
      return res.status(400).json({ error: 'Coupon is not active' })
    }

    if (coupon.requiresApproval && !coupon.isApproved) {
      return res.status(400).json({ error: 'Coupon is pending approval' })
    }

    // Check dates
    const now = new Date()
    if (coupon.startDate > now) {
      return res.status(400).json({ error: 'Coupon is not yet valid' })
    }
    if (coupon.endDate < now) {
      coupon.status = 'expired'
      await coupon.save()
      return res.status(400).json({ error: 'Coupon has expired' })
    }

    // Update redeemedCount to match actual redemptions (in case it's out of sync)
    const actualRedeemedCount = await CouponRedemption.countDocuments({
      coupon: couponId,
      status: 'redeemed',
    })
    if (coupon.redeemedCount !== actualRedeemedCount) {
      coupon.redeemedCount = actualRedeemedCount
      await coupon.save()
    }

    // Check global maxRedemptions limit - auto-expire if reached
    if (coupon.maxRedemptions && coupon.redeemedCount >= coupon.maxRedemptions) {
      coupon.status = 'expired'
      await coupon.save()
      return res.status(400).json({
        error: 'Coupon redemption limit reached. This coupon is no longer available.',
        valid: false,
      })
    }

    // Re-check coupon status after updating (might have changed)
    await coupon.populate('productIds', 'name slug')
    await coupon.populate('categoryIds', 'name slug')
    if (coupon.status !== 'active') {
      return res.status(400).json({ error: 'Coupon is not active' })
    }

    // Get product
    const product = await Product.findById(productId).populate('category')
    if (!product) {
      return res.status(404).json({ error: 'Product not found' })
    }

    // Get variant if provided
    let variant = null
    if (variantId) {
      variant = await ProductVariant.findById(variantId)
      if (!variant) {
        return res.status(404).json({ error: 'Variant not found' })
      }
      if (variant.product.toString() !== productId.toString()) {
        return res.status(400).json({ error: 'Variant does not belong to selected product' })
      }
    }

    // First verify product belongs to coupon seller (security check - must always match)
    if (product.seller.toString() !== coupon.seller.toString()) {
      return res.status(400).json({
        error: 'Coupon is not applicable to this product (seller mismatch)',
      })
    }

    // Check if coupon applies to this product (product must belong to seller first)
    let isEligible = false

    // If no restrictions, applies to all seller products (seller already verified above)
    if (
      (!coupon.productIds || coupon.productIds.length === 0) &&
      (!coupon.categoryIds || coupon.categoryIds.length === 0)
    ) {
      isEligible = true
    } else {
      // Check product-level
      if (coupon.productIds && coupon.productIds.length > 0) {
        const productIdsStr = coupon.productIds.map((id: any) => (id?._id || id).toString())
        if (productIdsStr.includes(productId.toString())) {
          isEligible = true
        }
      }

      // Check category-level
      if (!isEligible && coupon.categoryIds && coupon.categoryIds.length > 0) {
        const categoryIdsStr = coupon.categoryIds.map((id: any) => (id?._id || id).toString())
        const productCategoryId =
          (product.category as any)?._id?.toString() || product.category?.toString()
        if (productCategoryId && categoryIdsStr.includes(productCategoryId)) {
          isEligible = true
        }
      }
    }

    if (!isEligible) {
      return res.status(400).json({
        error: 'Coupon is not applicable to this product',
      })
    }

    // Check product is available
    if (product.status !== 'active' && product.status !== 'out_of_stock') {
      return res.status(400).json({
        error: 'Product is not available for purchase',
      })
    }

    // Get product price (prefer effectivePrice - what customer actually pays)
    const productPrice =
      variant?.effectivePrice ?? variant?.price ?? product.effectivePrice ?? product.price ?? 0

    // Validate price
    if (
      !Number.isFinite(productPrice) ||
      productPrice <= 0 ||
      productPrice > Number.MAX_SAFE_INTEGER
    ) {
      return res.status(400).json({ error: 'Product price is not available or invalid' })
    }

    // Check maxRedemptionsPerUser limit (if user is authenticated)
    let allowedDiscountUnits = quantityNum
    if (coupon.maxRedemptionsPerUser) {
      // Validate maxRedemptionsPerUser is a valid number
      if (
        !Number.isInteger(coupon.maxRedemptionsPerUser) ||
        coupon.maxRedemptionsPerUser <= 0
      ) {
        return res.status(500).json({
          error: 'Invalid coupon configuration',
        })
      }

      // Count how many times user has already redeemed this coupon
      const existingRedemptions = await CouponRedemption.countDocuments({
        coupon: couponId,
        user: userId,
        status: 'redeemed',
      })

      // Calculate how many units can still get discount
      const remainingAllowed = Math.max(0, coupon.maxRedemptionsPerUser - existingRedemptions)
      allowedDiscountUnits = Math.min(quantityNum, remainingAllowed)

      // If redemption limit is reached, coupon cannot be applied
      if (allowedDiscountUnits === 0) {
        return res.status(400).json({
          error: `Coupon redemption limit reached. You have already used this coupon ${coupon.maxRedemptionsPerUser} time(s).`,
          valid: false,
          allowedDiscountUnits: 0,
        })
      }
    }

    // Validate discount value
    if (
      !Number.isFinite(coupon.discountValue) ||
      coupon.discountValue <= 0 ||
      coupon.discountValue > Number.MAX_SAFE_INTEGER
    ) {
      return res.status(400).json({
        error: 'Invalid discount value in coupon configuration',
        valid: false,
      })
    }

    // Calculate discount per unit (not on total)
    let discountPerUnit = 0
    if (coupon.discountType === 'percent') {
      // Validate percent is between 0 and 100
      if (coupon.discountValue > 100 || coupon.discountValue < 0) {
        return res.status(400).json({
          error: 'Invalid discount percentage. Must be between 0 and 100.',
          valid: false,
        })
      }
      discountPerUnit = (productPrice * coupon.discountValue) / 100
      // Round to 2 decimal places to avoid floating point issues
      discountPerUnit = Math.round(discountPerUnit * 100) / 100
    } else {
      discountPerUnit = coupon.discountValue
      // Don't let discount exceed price per unit
      if (discountPerUnit > productPrice) {
        discountPerUnit = productPrice
      }
    }

    // Validate discount per unit is valid (should not be 0 for a valid coupon)
    if (!Number.isFinite(discountPerUnit) || discountPerUnit <= 0) {
      return res.status(400).json({
        error: 'Invalid discount value. Discount per unit must be greater than 0.',
        valid: false,
      })
    }

    // Calculate total discount (only for allowed units)
    const discountAmount = discountPerUnit * allowedDiscountUnits
    if (!Number.isFinite(discountAmount) || discountAmount < 0) {
      return res.status(500).json({
        error: 'Error calculating discount amount',
        valid: false,
      })
    }

    // Calculate discounted price per unit
    const discountedPricePerUnit = productPrice - discountPerUnit
    if (!Number.isFinite(discountedPricePerUnit) || discountedPricePerUnit < 0) {
      return res.status(500).json({
        error: 'Error calculating discounted price',
        valid: false,
      })
    }

    // Calculate totals with mixed pricing
    const discountedUnits = allowedDiscountUnits
    const fullPriceUnits = quantityNum - allowedDiscountUnits
    const discountedTotal =
      discountedPricePerUnit * discountedUnits + productPrice * fullPriceUnits
    const totalAmount = productPrice * quantityNum

    // Validate totals
    if (
      !Number.isFinite(discountedTotal) ||
      !Number.isFinite(totalAmount) ||
      discountedTotal < 0 ||
      totalAmount < 0
    ) {
      return res.status(500).json({
        error: 'Error calculating totals',
        valid: false,
      })
    }

    res.json({
      valid: true,
      coupon: {
        _id: coupon._id,
        couponCode: coupon.couponCode,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        description: coupon.description,
      },
      product: {
        _id: product._id,
        name: product.name,
        price: productPrice,
      },
      quantity: quantityNum,
      originalTotal: Math.round(totalAmount * 100) / 100,
      discountAmount: Math.round(discountAmount * 100) / 100,
      discountedTotal: Math.round(discountedTotal * 100) / 100,
      discountedPricePerUnit: Math.round(discountedPricePerUnit * 100) / 100,
      allowedDiscountUnits,
      fullPriceUnits,
    })
  } catch (err: unknown) {
    console.error('Error calculating product discount:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// --------------------
// GET available coupons for products (public/buyer)
// --------------------
export const getAvailableCoupons = async (req: Request, res: Response) => {
  try {
    const { productIds, categoryIds, sellerId } = req.query

    if (!productIds && !categoryIds && !sellerId) {
      console.log('ERROR: At least one of productIds, categoryIds, or sellerId is required')
      return res.status(400).json({
        error: 'At least one of productIds, categoryIds, or sellerId is required',
      })
    }

    const now = new Date()
    const query: any = {
      status: 'active',
      startDate: { $lte: now },
      endDate: { $gte: now },
      isApproved: true,
    }

    // Note: We'll check maxRedemptions limit when processing each coupon
    // to auto-expire coupons that have reached their limit

    if (sellerId) {
      query.seller = sellerId
    }

    // Find coupons that apply to the given products/categories
    const coupons = await SellerCoupon.find(query)
      .populate('seller', 'businessName storeSlug')
      .populate('productIds', 'name slug')
      .populate('categoryIds', 'name slug')
      .sort({ createdAt: -1 })
      .limit(50)

    // Filter coupons that actually apply
    const applicableCoupons = []
    const userId = req.user?.userId // Optional - user might not be authenticated

    for (const coupon of coupons) {
      let applies = false

      // Get seller ID from populated object or direct reference
      const couponSellerId = (coupon.seller as any)?._id
        ? (coupon.seller as any)._id.toString()
        : coupon.seller.toString()

      // If no restrictions, applies to all seller products
      if (
        (!coupon.productIds || coupon.productIds.length === 0) &&
        (!coupon.categoryIds || coupon.categoryIds.length === 0)
      ) {
        if (sellerId && couponSellerId === sellerId.toString()) {
          console.log(`  -> Applies: No restrictions, matches seller ${sellerId}`)
          applies = true
        }
      } else {
        // Check product-level
        if (productIds && coupon.productIds && coupon.productIds.length > 0) {
          const productIdsArray = Array.isArray(productIds) ? productIds : [productIds]
          const couponProductIds = coupon.productIds.map((id: any) => (id?._id || id).toString())
          const requestedProductIds = productIdsArray.map((id) => id.toString())

          if (requestedProductIds.some((id) => couponProductIds.includes(id))) {
            // console.log(`  -> Applies: Product match`)
            applies = true
          }
        }

        // Check category-level
        if (!applies && categoryIds && coupon.categoryIds && coupon.categoryIds.length > 0) {
          const categoryIdsArray = Array.isArray(categoryIds) ? categoryIds : [categoryIds]
          const couponCategoryIds = coupon.categoryIds.map((id: any) => (id?._id || id).toString())
          const requestedCategoryIds = categoryIdsArray.map((id) => id.toString())

          if (requestedCategoryIds.some((id) => couponCategoryIds.includes(id))) {
            applies = true
          }
        }
      }

      // If coupon applies, check redemption limits
      if (applies) {
        // Update redeemedCount to match actual redemptions (in case it's out of sync)
        const actualRedeemedCount = await CouponRedemption.countDocuments({
          coupon: coupon._id,
          status: 'redeemed',
        })
        if (coupon.redeemedCount !== actualRedeemedCount) {
          coupon.redeemedCount = actualRedeemedCount
          await coupon.save()
        }

        // Check global maxRedemptions limit - auto-expire if reached
        if (coupon.maxRedemptions && coupon.redeemedCount >= coupon.maxRedemptions) {
          coupon.status = 'expired'
          await coupon.save()
          console.log(
            `  -> ❌ Coupon ${coupon._id} global redemption limit reached (${coupon.redeemedCount}/${coupon.maxRedemptions}) - marked as expired`,
          )
          continue // Skip this coupon
        }

        // Check if user has reached per-user redemption limit (only for authenticated users)
        if (userId && coupon.maxRedemptionsPerUser) {
          const existingRedemptions = await CouponRedemption.countDocuments({
            coupon: coupon._id,
            user: userId,
            status: 'redeemed',
          })

          // If user has reached the limit, skip this coupon
          if (existingRedemptions >= coupon.maxRedemptionsPerUser) {
            console.log(
              `  -> ❌ Coupon ${coupon._id} user redemption limit reached (${existingRedemptions}/${coupon.maxRedemptionsPerUser})`,
            )
            continue // Skip this coupon
          }
        }

        applicableCoupons.push(coupon)
        console.log(`  -> ✅ Coupon ${coupon._id} applies`)
      } else {
        console.log(`  -> ❌ Coupon ${coupon._id} does NOT apply`)
      }
    }

    res.json({ coupons: applicableCoupons })
  } catch (err: unknown) {
    console.error('Error fetching available coupons:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// --------------------
// GET user's clipped coupons
// --------------------
export const getUserClippedCoupons = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    // Get user document to ensure we have the correct user ID format
    const user = await User.findById(userId)
    if (!user) {
      return res.status(401).json({ error: 'User not found' })
    }

    console.log('=== getUserClippedCoupons DEBUG ===')
    console.log('userId from token:', userId)
    console.log('user._id:', (user._id as any).toString())
    console.log('user._id type:', typeof user._id)

    // First, check all redemptions for this user (for debugging)
    const allRedemptions = await CouponRedemption.find({ user: user._id }).lean()
    console.log('Total redemptions for user (all statuses):', allRedemptions.length)
    if (allRedemptions.length > 0) {
      console.log('Sample redemption:', {
        _id: allRedemptions[0]._id,
        coupon: allRedemptions[0].coupon,
        user: (allRedemptions[0].user as any)?.toString(),
        status: allRedemptions[0].status,
      })
    }

    // Query for redemptions using user._id (same pattern as order controller)
    const redemptions = await CouponRedemption.find({
      user: user._id,
      status: { $in: ['clipped', 'applied', 'redeemed'] },
    })
      .populate({
        path: 'coupon',
        populate: [
          { path: 'seller', select: 'businessName storeSlug' },
          { path: 'productIds', select: 'name slug mainImage' },
          { path: 'categoryIds', select: 'name slug' },
        ],
      })
      .sort({ createdAt: -1 })

    console.log('Redemptions with status clipped/applied/redeemed:', redemptions.length)

    // Filter out redemptions where coupon is null (deleted coupons)
    const validRedemptions = redemptions.filter((r) => r.coupon != null)

    console.log('Valid redemptions (with coupon):', validRedemptions.length)
    console.log('=== END DEBUG ===')

    res.json({ coupons: validRedemptions })
  } catch (err: unknown) {
    console.error('Error fetching user clipped coupons:', err)
    res.status(500).json({ error: 'Server error' })
  }
}
