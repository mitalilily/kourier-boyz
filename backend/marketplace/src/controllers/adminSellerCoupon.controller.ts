import { Request, Response } from 'express'
import CouponRedemption from '../models/CouponRedemption'
import Notification from '../models/Notification'
import SellerCoupon, { type ISellerCoupon } from '../models/SellerCoupon'
import User from '../models/User'
import { emailTemplates, sendEmail } from '../utils/email'

// --------------------
// GET all seller coupons (admin view)
// --------------------
export const getAllSellerCoupons = async (req: Request, res: Response) => {
  try {
    const { sellerId, status, search, page = 1, limit = 20 } = req.query

    const query: any = {}

    if (sellerId) {
      query.seller = sellerId
    }

    if (status) {
      query.status = status
    }

    if (search) {
      query.$or = [
        { couponCode: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ]
    }

    const skip = (Number(page) - 1) * Number(limit)

    const [coupons, total] = await Promise.all([
      SellerCoupon.find(query)
        .populate('seller', 'businessName email storeSlug')
        .populate('productIds', 'name slug')
        .populate('categoryIds', 'name slug')
        .populate('approvedBy', 'name email')
        .populate('deactivatedBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      SellerCoupon.countDocuments(query),
    ])

    res.json({
      coupons,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
    })
  } catch (err: unknown) {
    console.error('Error fetching all seller coupons:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// --------------------
// GET single seller coupon (admin view)
// --------------------
export const getSellerCouponAdmin = async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const coupon = await SellerCoupon.findById(id)
      .populate('seller', 'businessName email storeSlug')
      .populate('productIds', 'name slug mainImage price')
      .populate('categoryIds', 'name slug')
      .populate('approvedBy', 'name email')
      .populate('deactivatedBy', 'name email')

    if (!coupon) {
      return res.status(404).json({ error: 'Coupon not found' })
    }

    // Get detailed stats
    const redemptions = await CouponRedemption.find({ coupon: id })
      .populate('user', 'name email')
      .populate('order')

    const stats = {
      totalRedemptions: redemptions.length,
      clippedCount: redemptions.filter((r) => r.status === 'clipped').length,
      appliedCount: redemptions.filter((r) => r.status === 'applied').length,
      redeemedCount: redemptions.filter((r) => r.status === 'redeemed').length,
      uniqueUsers: new Set(redemptions.map((r) => r.user.toString())).size,
      totalDiscountGiven: redemptions
        .filter((r) => r.discountAmount)
        .reduce((sum, r) => sum + (r.discountAmount || 0), 0),
      redemptions: redemptions.slice(0, 50), // Last 50 redemptions
    }

    res.json({ coupon, stats })
  } catch (err: unknown) {
    console.error('Error fetching seller coupon (admin):', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// --------------------
// APPROVE seller coupon
// --------------------
export const approveSellerCoupon = async (req: Request, res: Response) => {
  try {
    const adminId = req.user?.userId
    const { id } = req.params

    if (!adminId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const coupon = await SellerCoupon.findById(id)
    if (!coupon) {
      return res.status(404).json({ error: 'Coupon not found' })
    }

    coupon.isApproved = true
    coupon.approvedBy = adminId as any
    coupon.approvedAt = new Date()

    await coupon.save()

    const populatedCoupon = await SellerCoupon.findById(coupon._id)
      .populate('seller', 'businessName email')
      .populate('approvedBy', 'name email')

    res.json({
      message: 'Coupon approved successfully',
      coupon: populatedCoupon,
    })
  } catch (err: unknown) {
    console.error('Error approving seller coupon:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// --------------------
// DENY seller coupon
// --------------------
export const denySellerCoupon = async (req: Request, res: Response) => {
  try {
    const adminId = req.user?.userId
    const { id } = req.params
    const { reason } = req.body

    if (!adminId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const coupon = await SellerCoupon.findById(id)
    if (!coupon) {
      return res.status(404).json({ error: 'Coupon not found' })
    }

    coupon.isApproved = false
    coupon.status = 'paused' // Pause denied coupons
    // Store denial reason in description or a separate field
    if (reason) {
      coupon.description = `${coupon.description || ''}\n[Denied: ${reason}]`.trim()
    }

    await coupon.save()

    res.json({
      message: 'Coupon denied successfully',
      coupon,
    })
  } catch (err: unknown) {
    console.error('Error denying seller coupon:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// --------------------
// PAUSE seller coupon (admin)
// --------------------
export const pauseSellerCouponAdmin = async (req: Request, res: Response) => {
  try {
    const adminId = req.user?.userId
    const { id } = req.params
    const { reason } = req.body

    if (!adminId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const coupon = await SellerCoupon.findById(id)
    if (!coupon) {
      return res.status(404).json({ error: 'Coupon not found' })
    }

    const oldStatus = coupon.status
    // Extract seller ID - handle both ObjectId and populated object
    let sellerId: any = coupon.seller
    if (sellerId && typeof sellerId === 'object' && '_id' in sellerId) {
      sellerId = sellerId._id
    }
    if (!sellerId) {
      console.error(`No seller ID found for coupon ${coupon._id}`)
      return res.status(400).json({ error: 'Coupon has no associated seller' })
    }

    coupon.status = 'paused'
    if (reason) {
      coupon.deactivationReason = reason
    }
    coupon.deactivatedBy = adminId as any
    coupon.deactivatedAt = new Date()
    await coupon.save()

    // Notify seller if status changed
    if (oldStatus !== 'paused' && sellerId) {
      try {
        console.log(`[Admin] Attempting to notify seller about coupon pause. SellerId: ${sellerId}, CouponId: ${coupon._id}`)
        // Fetch seller details to get email - ensure sellerId is converted to ObjectId if needed
        const seller = await User.findById(sellerId).select('name email businessName')
        if (!seller) {
          console.error(`[Admin] Seller not found for ID: ${sellerId}`)
        } else if (!seller.email) {
          console.error(`[Admin] Seller ${sellerId} has no email address`)
        } else {
          const sellerPanelUrl = process.env.SELLER_PANEL_URL
          const dashboardUrl = sellerPanelUrl ? `${sellerPanelUrl}/coupons` : null
          
          // Create in-app notification
          await Notification.create({
            userId: seller._id,
            title: 'Coupon Paused by Admin',
            message: `Your coupon "${coupon.couponCode || 'N/A'}" has been paused by an admin.${reason ? ` Reason: ${reason}` : ''}`,
            type: 'system',
            read: false,
            link: dashboardUrl,
          })
          console.log(`[Admin] Created in-app notification for seller ${seller.email}`)

          // Send email notification
          const emailSubject = `Coupon Paused: ${coupon.couponCode || 'N/A'}`
          const emailHtml = emailTemplates.sellerCouponStatusChanged(
            seller.name || seller.businessName || 'Seller',
            coupon.couponCode || 'N/A',
            'paused',
            reason || 'No reason provided',
            dashboardUrl,
          )
          await sendEmail(seller.email, emailSubject, emailHtml)
          console.log(`[Admin] Sent email notification to ${seller.email} about coupon pause: ${coupon.couponCode}`)
        }
      } catch (notifError) {
        console.error('[Admin] Error notifying seller about coupon pause:', notifError)
        // Don't fail the request if notification fails
      }
    } else {
      console.log(`[Admin] Skipping notification - oldStatus: ${oldStatus}, sellerId: ${sellerId}`)
    }

    const populatedCoupon = await SellerCoupon.findById(coupon._id)
      .populate('seller', 'businessName email')
      .populate('deactivatedBy', 'name email')

    res.json({ message: 'Coupon paused successfully', coupon: populatedCoupon })
  } catch (err: unknown) {
    console.error('Error pausing seller coupon (admin):', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// --------------------
// UPDATE seller coupon status (admin) - can change from paused to active or vice versa
// --------------------
export const updateSellerCouponStatus = async (req: Request, res: Response) => {
  try {
    const adminId = req.user?.userId
    const { id } = req.params
    const { status, reason } = req.body

    if (!adminId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    if (!status || !['active', 'paused', 'expired'].includes(status)) {
      return res.status(400).json({ error: 'Valid status (active, paused, expired) is required' })
    }

    const coupon = await SellerCoupon.findById(id)
    if (!coupon) {
      return res.status(404).json({ error: 'Coupon not found' })
    }

    // Don't allow changing to expired (it's auto-set based on dates)
    if (status === 'expired') {
      return res.status(400).json({ error: 'Cannot manually set coupon status to expired. It is automatically set based on end date.' })
    }

    const oldStatus = coupon.status
    // Extract seller ID - handle both ObjectId and populated object
    let sellerId: any = coupon.seller
    if (sellerId && typeof sellerId === 'object' && '_id' in sellerId) {
      sellerId = sellerId._id
    }
    if (!sellerId) {
      console.error(`No seller ID found for coupon ${coupon._id}`)
      return res.status(400).json({ error: 'Coupon has no associated seller' })
    }

    coupon.status = status as 'active' | 'paused'

    if (status === 'paused') {
      if (reason) {
        coupon.deactivationReason = reason
      }
      coupon.deactivatedBy = adminId as any
      coupon.deactivatedAt = new Date()
    } else if (status === 'active') {
      // Clear deactivation info when activating
      coupon.deactivationReason = undefined
      coupon.deactivatedBy = undefined
      coupon.deactivatedAt = undefined
    }

    await coupon.save()

    // Notify seller if status changed
    if (oldStatus !== status && sellerId) {
      try {
        console.log(`[Admin] Attempting to notify seller about status change. SellerId: ${sellerId}, CouponId: ${coupon._id}, OldStatus: ${oldStatus}, NewStatus: ${status}`)
        // Fetch seller details to get email
        const seller = await User.findById(sellerId).select('name email businessName')
        if (!seller) {
          console.error(`[Admin] Seller not found for ID: ${sellerId}`)
        } else if (!seller.email) {
          console.error(`[Admin] Seller ${sellerId} has no email address`)
        } else {
          const sellerPanelUrl = process.env.SELLER_PANEL_URL
          const dashboardUrl = sellerPanelUrl ? `${sellerPanelUrl}/coupons` : null
          
          // Create in-app notification
          const statusLabel = status === 'active' ? 'activated' : 'paused'
          await Notification.create({
            userId: seller._id,
            title: `Coupon ${statusLabel.charAt(0).toUpperCase() + statusLabel.slice(1)} by Admin`,
            message: `Your coupon "${coupon.couponCode || 'N/A'}" has been ${statusLabel} by an admin.${reason ? ` Reason: ${reason}` : ''}`,
            type: 'system',
            read: false,
            link: dashboardUrl,
          })
          console.log(`[Admin] Created in-app notification for seller ${seller.email}`)

          // Send email notification
          const emailSubject = `Coupon ${statusLabel.charAt(0).toUpperCase() + statusLabel.slice(1)}: ${coupon.couponCode || 'N/A'}`
          const emailHtml = emailTemplates.sellerCouponStatusChanged(
            seller.name || seller.businessName || 'Seller',
            coupon.couponCode || 'N/A',
            status,
            reason || (status === 'active' ? 'Coupon has been activated' : 'No reason provided'),
            dashboardUrl,
          )
          await sendEmail(seller.email, emailSubject, emailHtml)
          console.log(`[Admin] Sent email notification to ${seller.email} about coupon status change to ${status}: ${coupon.couponCode}`)
        }
      } catch (notifError) {
        console.error('[Admin] Error notifying seller about coupon status change:', notifError)
        // Don't fail the request if notification fails
      }
    } else {
      console.log(`[Admin] Skipping notification - oldStatus: ${oldStatus}, newStatus: ${status}, sellerId: ${sellerId}`)
    }

    const populatedCoupon = await SellerCoupon.findById(coupon._id)
      .populate('seller', 'businessName email')
      .populate('deactivatedBy', 'name email')
      .populate('approvedBy', 'name email')

    res.json({
      message: `Coupon status updated to ${status} successfully`,
      coupon: populatedCoupon,
    })
  } catch (err: unknown) {
    console.error('Error updating seller coupon status (admin):', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// --------------------
// DELETE seller coupon (admin)
// --------------------
export const deleteSellerCouponAdmin = async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const coupon = await SellerCoupon.findById(id)
    if (!coupon) {
      return res.status(404).json({ error: 'Coupon not found' })
    }

    // Delete redemptions
    await CouponRedemption.deleteMany({ coupon: id })

    // Delete coupon
    await SellerCoupon.findByIdAndDelete(id)

    res.json({ message: 'Coupon deleted successfully' })
  } catch (err: unknown) {
    console.error('Error deleting seller coupon (admin):', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// --------------------
// GET coupon analytics
// --------------------
export const getCouponAnalytics = async (req: Request, res: Response) => {
  try {
    const { sellerId, startDate, endDate } = req.query

    const query: any = {}
    if (sellerId) {
      query.seller = sellerId
    }

    const coupons = await SellerCoupon.find(query)
      .populate('seller', 'businessName')

    const dateFilter: any = {}
    if (startDate) {
      dateFilter.createdAt = { $gte: new Date(startDate as string) }
    }
    if (endDate) {
      dateFilter.createdAt = {
        ...dateFilter.createdAt,
        $lte: new Date(endDate as string),
      }
    }

    const redemptions = await CouponRedemption.find({
      ...dateFilter,
      coupon: { $in: coupons.map((c) => c._id) },
    })
      .populate('coupon')
      .populate('user', 'name email')

    // Calculate analytics
    const analytics = {
      totalCoupons: coupons.length,
      activeCoupons: coupons.filter((c) => c.status === 'active').length,
      pausedCoupons: coupons.filter((c) => c.status === 'paused').length,
      expiredCoupons: coupons.filter((c) => c.status === 'expired').length,
      totalRedemptions: redemptions.length,
      totalDiscountGiven: redemptions
        .filter((r) => r.discountAmount)
        .reduce((sum, r) => sum + (r.discountAmount || 0), 0),
      uniqueUsers: new Set(redemptions.map((r) => r.user.toString())).size,
      conversionRate:
        redemptions.filter((r) => r.status === 'redeemed').length /
        Math.max(redemptions.filter((r) => r.status === 'clipped').length, 1),
      topCoupons: coupons
        .map((c: ISellerCoupon) => ({
          coupon: c,
          redemptions: redemptions.filter(
            (r) =>
              (r.coupon as any)?._id?.toString() === c._id?.toString() ||
              r.coupon.toString() === c._id?.toString(),
          ).length,
        }))
        .sort((a, b) => b.redemptions - a.redemptions)
        .slice(0, 10),
    }

    res.json(analytics)
  } catch (err: unknown) {
    console.error('Error fetching coupon analytics:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

