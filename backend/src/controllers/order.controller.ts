import { Request, Response } from 'express'
import mongoose from 'mongoose'
import Cart from '../models/Cart'
import Coupon from '../models/Coupon'
import CouponRedemption from '../models/CouponRedemption'
import Order, { IOrderItem, IOrderSellerShipment } from '../models/Order'
import Product from '../models/Product'
import ProductVariant from '../models/ProductVariant'
import Return from '../models/Return'
import User from '../models/User'
import { io } from '../server'
import { checkUserAccess } from '../utils/checkUserAccess'
import { emailTemplates, sendEmail } from '../utils/email'
import { generateInvoice } from '../utils/invoiceGenerator'
import { canCancelOrder } from '../utils/orderStatus'
import { getPhoneFromUser } from '../utils/phoneDecryptionHelper'
import { calculateShippingCharge } from '../utils/shippingCalculator'
import { sendSms } from '../utils/sms'
import { getSmsTemplate, SmsTemplateType } from '../utils/smsTemplates'
import {
  calculateCgstSgstAmounts,
  calculateGstAmount,
  determineTaxTypeForOrderItem,
  extractStateCodeFromGstin,
  getStateCodeFromShippingAddress,
} from '../utils/taxHelpers'

// Helper function to restore stock when order is cancelled
const restoreOrderStock = async (orderItems: IOrderItem[]) => {
  for (const orderItem of orderItems) {
    if (orderItem.variant) {
      // Restore variant stock
      await ProductVariant.findByIdAndUpdate(orderItem.variant, {
        $inc: { stock: orderItem.quantity },
      })
      // Update product totalStock (sum of all variant stocks)
      const product = await Product.findById(orderItem.product)
      if (product && product.hasVariants) {
        const variants = await ProductVariant.find({
          product: orderItem.product,
        })
        const totalStock = variants.reduce((sum, v) => sum + v.stock, 0)
        await Product.updateOne({ _id: orderItem.product }, { totalStock })
      }
    } else {
      // Restore product stock directly
      await Product.updateOne({ _id: orderItem.product }, { $inc: { stock: orderItem.quantity } })
    }
  }
}

// Create order from cart
export const createOrder = async (req: Request, res: Response) => {
  let checkoutLockId: string | null = null
  let checkoutLockAcquired = false
  let checkoutUserId: mongoose.Types.ObjectId | null = null
  try {
    const user = await checkUserAccess(req, res, ['customer'])
    if (!user) return
    checkoutUserId = user._id

    // Block new orders for deactivated buyers
    if (user.buyerLifecycleStatus === 'DEACTIVATED') {
      return res.status(403).json({
        success: false,
        message:
          'Your account has been deactivated. You cannot place new orders. Your order history and invoices remain accessible for record-keeping purposes.',
        error: 'ACCOUNT_DEACTIVATED',
      })
    }

    const {
      shippingAddress,
      paymentMethod,
      couponId,
      deliveryInstructions,
      giftWrap,
      itemInstructions,
      razorpayOrderId,
      razorpayPaymentId,
      razorpayPaymentMethod,
      razorpayPaymentDetails,
    } = req.body

    if (!shippingAddress || !paymentMethod) {
      return res.status(400).json({
        success: false,
        message: 'Shipping address and payment method are required',
      })
    }

    // Prevent duplicate order creation with a short-lived checkout lock
    const lockExpiryMs = 2 * 60 * 1000 // 2 minutes
    const lockThreshold = new Date(Date.now() - lockExpiryMs)
    checkoutLockId = new mongoose.Types.ObjectId().toString()
    const lockedCart = await Cart.findOneAndUpdate(
      {
        user: user._id,
        $or: [
          { checkoutLock: { $ne: true } },
          { checkoutLockedAt: { $exists: false } },
          { checkoutLockedAt: { $lte: lockThreshold } },
        ],
      },
      {
        $set: {
          checkoutLock: true,
          checkoutLockedAt: new Date(),
          checkoutLockId,
        },
      },
      { new: true },
    )

    if (!lockedCart) {
      const existingCart = await Cart.findOne({ user: user._id }).select('items checkoutLock')
      if (!existingCart || existingCart.items.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Cart is empty',
        })
      }

      return res.status(409).json({
        success: false,
        message: 'Checkout already in progress. Please wait a moment and try again.',
      })
    }

    checkoutLockAcquired = true

    // Get cart with selected items
    const cart = await lockedCart.populate([
      {
        path: 'items.product',
        model: 'Product',
        select: 'name slug price stock seller status hasVariants',
      },
      {
        path: 'items.variant',
        model: 'ProductVariant',
        select: 'name price stock',
      },
    ])

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cart is empty',
      })
    }

    // Filter selected items
    const selectedItems = cart.items.filter((item) => item.selected !== false)
    if (selectedItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No items selected for checkout',
      })
    }

    // Fetch GST rounding mode from admin settings (once per order, reuse for all items)
    let gstRoundingMode: 'ROUND_HALF_UP' | 'ROUND_HALF_DOWN' | 'ROUND_UP' | 'ROUND_DOWN' =
      'ROUND_HALF_UP'
    try {
      const AdminInvoiceSettings = (await import('../models/AdminInvoiceSettings')).default
      const invoiceSettings = await AdminInvoiceSettings.getSingleton()
      gstRoundingMode = (invoiceSettings.gstRoundingMode || 'ROUND_HALF_UP') as any
    } catch (settingsError) {
      console.error('Error fetching GST rounding mode, using default ROUND_HALF_UP:', settingsError)
      // Use default ROUND_HALF_UP if settings fetch fails
    }

    const buildInstructionKey = (productId: string, variantId?: string | null) => {
      return `${productId}-${variantId || 'no-variant'}`
    }

    const instructionMap = new Map<string, string>()
    const toIdString = (value: any): string | null => {
      if (!value) return null
      if (typeof value === 'string') return value
      if (value instanceof mongoose.Types.ObjectId) return value.toString()
      if (value._id) return toIdString(value._id)
      if (typeof value.toString === 'function') return value.toString()
      return null
    }
    if (Array.isArray(itemInstructions)) {
      for (const entry of itemInstructions) {
        const productId = entry?.productId
        if (!productId || typeof productId !== 'string') continue
        const note = typeof entry?.instructions === 'string' ? entry.instructions.trim() : ''
        if (!note) continue
        const variantId =
          typeof entry?.variantId === 'string' && entry.variantId.length > 0
            ? entry.variantId
            : undefined
        const key = buildInstructionKey(productId, variantId)
        instructionMap.set(key, note.slice(0, 500))
      }
    }

    // Validate products and calculate totals
    let subtotal = 0
    const orderItems: IOrderItem[] = []
    const sellerItemsBySeller = new Map<string, IOrderItem[]>()

    for (const item of selectedItems) {
      const product = item.product as any
      const variant = item.variant as any

      if (!product || product.status !== 'active') {
        return res.status(400).json({
          success: false,
          message: `Product ${product?.name || 'Unknown'} is not available`,
        })
      }

      // Try to get price from multiple sources in order of preference:
      // 1. Variant effectivePrice (what customer actually pays)
      // 2. Variant price (fallback)
      // 3. Product effectivePrice
      // 4. Product price (fallback)
      // 5. Cart item effectivePrice (current effectivePrice stored in cart)
      // 6. Cart item priceAtAddition (backward compatibility fallback)
      let currentPrice =
        variant?.effectivePrice ??
        variant?.price ??
        product.effectivePrice ??
        product.price ??
        (item as any).effectivePrice ??
        item.priceAtAddition

      // If still no price, try to fetch it directly from database
      if (!currentPrice || isNaN(Number(currentPrice)) || Number(currentPrice) <= 0) {
        try {
          const productId = product._id || product
          const variantId = variant?._id || variant

          // Fetch fresh product data to get current price (prefer effectivePrice)
          if (productId) {
            const freshProduct = await Product.findById(productId)
              .select('effectivePrice price')
              .lean()
            if (freshProduct?.effectivePrice) {
              currentPrice = freshProduct.effectivePrice
            } else if (freshProduct?.price) {
              currentPrice = freshProduct.price
            }
          }

          // If still no price and variant exists, try variant (prefer effectivePrice)
          if (
            (!currentPrice || isNaN(Number(currentPrice)) || Number(currentPrice) <= 0) &&
            variantId
          ) {
            const freshVariant = await ProductVariant.findById(variantId)
              .select('effectivePrice price')
              .lean()
            if (freshVariant?.effectivePrice) {
              currentPrice = freshVariant.effectivePrice
            } else if (freshVariant?.price) {
              currentPrice = freshVariant.price
            }
          }
        } catch (fetchError) {
          console.error('Error fetching product price:', fetchError)
        }
      }

      // Final validation - if still no valid price, return error
      if (!currentPrice || isNaN(Number(currentPrice)) || Number(currentPrice) <= 0) {
        console.error('Price validation failed:', {
          productId: product._id || product,
          productName: product.name,
          variantId: variant?._id || variant,
          variantPrice: variant?.effectivePrice ?? variant?.price,
          productPrice: product.effectivePrice ?? product.price,
          cartEffectivePrice: (item as any).effectivePrice,
          priceAtAddition: item.priceAtAddition,
        })
        return res.status(400).json({
          success: false,
          message: `Invalid or missing price for product "${
            product.name || 'Unknown'
          }". Please remove this item from cart and add it again.`,
        })
      }

      const price = Number(currentPrice)
      const availableStock = variant ? variant.stock : product.stock

      if (availableStock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${product.name}`,
        })
      }

      const sellerIdRaw = product?.seller?._id || product?.seller
      if (!sellerIdRaw) {
        return res.status(400).json({
          success: false,
          message: `Seller not found for product ${product?.name || 'Unknown'}`,
        })
      }
      const sellerId =
        typeof sellerIdRaw === 'string' ? new mongoose.Types.ObjectId(sellerIdRaw) : sellerIdRaw
      const sellerIdString = sellerId.toString()

      // Base subtotal on cart item subtotal when available so that
      // any item-level discounts (e.g. seller coupons) are preserved.
      const rawSubtotal = price * item.quantity
      const itemSubtotal =
        typeof item.subtotal === 'number' && item.subtotal > 0 ? Number(item.subtotal) : rawSubtotal

      // Validate subtotal is valid
      if (isNaN(itemSubtotal) || itemSubtotal <= 0) {
        return res.status(400).json({
          success: false,
          message: `Invalid subtotal calculation for product ${product.name}`,
        })
      }

      subtotal += itemSubtotal

      const instructionKey = buildInstructionKey(product._id.toString(), variant?._id?.toString())
      const itemInstruction = instructionMap.get(instructionKey)

      // Snapshot GST/HSN for invoice generation
      // Logic: If product.hasVariants === true → use variant fields
      //        If product.hasVariants === false → use product fields
      // Always store as universal hsnSacCode and gstRatePercent
      // Note: Convert null to undefined (null means seller is not GST registered)
      let hsnSacCode: string | undefined
      let gstRatePercent: number | undefined
      let variantSku: string | undefined
      let variantName: string | undefined
      let gstTaxType: 'IGST' | 'CGST_SGST' | undefined

      // Determine tax type (IGST vs CGST+SGST) based on seller GST state and shipping address
      try {
        const seller = await User.findById(sellerId).select('gstNumber').lean()
        const sellerGstin = seller?.gstNumber || null
        const sellerGstStateCode = extractStateCodeFromGstin(sellerGstin)
        const shippingStateCode = getStateCodeFromShippingAddress(shippingAddress)

        gstTaxType = determineTaxTypeForOrderItem({
          sellerGstStateCode,
          shippingStateCode,
        })
      } catch (taxTypeError) {
        console.error('Error determining tax type:', taxTypeError)
        // Default to IGST if determination fails
        gstTaxType = 'IGST'
      }

      // Fetch product to check hasVariants flag
      const productId = product._id || product
      const fullProduct = await Product.findById(productId)
        .select(
          'hasVariants hsnSacCode gstRatePercent igstRatePercent cgstRatePercent sgstRatePercent sku isGstApplicable',
        )
        .lean()

      if (!fullProduct) {
        return res.status(400).json({
          success: false,
          message: `Product not found: ${productId}`,
        })
      }

      // Snapshot logic based on hasVariants flag
      if (fullProduct.hasVariants === true) {
        // VARIANT PRODUCT: Use variant-level GST/HSN
        if (variant?._id || variant) {
          try {
            const variantId = variant._id || variant
            const fullVariant = await ProductVariant.findById(variantId)
              .select('hsnSacCode gstRatePercent sku name')
              .lean()

            if (fullVariant) {
              // Convert null to undefined for order item (null means seller is not GST registered)
              hsnSacCode = fullVariant.hsnSacCode ?? undefined
              gstRatePercent = fullVariant.gstRatePercent ?? undefined
              variantSku = fullVariant.sku
              variantName = fullVariant.name
            } else {
              console.error(`Variant not found for variant product: ${variantId}`)
            }
          } catch (variantError) {
            console.error('Error fetching variant GST/HSN data:', variantError)
            return res.status(400).json({
              success: false,
              message: `Failed to fetch variant GST/HSN data for product ${product.name}`,
            })
          }
        } else {
          return res.status(400).json({
            success: false,
            message: `Variant product "${product.name}" requires a variant selection`,
          })
        }
      } else {
        // SIMPLE PRODUCT: Use product-level GST/HSN
        variantSku = fullProduct.sku
        variantName = undefined // No variant for simple products

        // Get HSN code
        hsnSacCode = fullProduct.hsnSacCode ?? undefined

        // Get GST rate - check multiple fields as products may use different naming conventions
        // Priority: gstRatePercent > igstRatePercent (both represent the total GST rate)
        const rawGstRate =
          (fullProduct as any).gstRatePercent ?? (fullProduct as any).igstRatePercent
        gstRatePercent = typeof rawGstRate === 'number' ? rawGstRate : undefined

        // Check if GST is applicable for this product
        const isGstApplicable = (fullProduct as any).isGstApplicable === true

        // Validate GST fields based on isGstApplicable flag
        if (!isGstApplicable) {
          // GST is not applicable - allow order without GST/HSN
          hsnSacCode = undefined
          gstRatePercent = undefined
        } else if (hsnSacCode === undefined && gstRatePercent === undefined) {
          // GST applicable but both fields missing - seller may not be GST registered
          // Allow order creation without GST fields
        } else if (!hsnSacCode || gstRatePercent === undefined) {
          // GST is applicable and partially configured - this is an error
          return res.status(400).json({
            success: false,
            message: `Simple product "${product.name}" must have HSN/SAC code and GST rate configured`,
          })
        }
      }

      // Calculate effectivePrice (what customer pays per unit).
      // Use the actual per-unit price derived from the cart subtotal (which reflects any
      // item-level coupon discounts) so that stored igst/cgst/sgst correctly represent
      // the GST actually paid, not the GST on the undiscounted catalogue price.
      const effectivePricePerUnit = itemSubtotal / item.quantity

      // Calculate tax amounts
      let priceWithoutTax = effectivePricePerUnit
      let igst: number | undefined = undefined
      let cgst: number | undefined = undefined
      let sgst: number | undefined = undefined

      // If GST is applicable (gstRatePercent exists), calculate tax breakdown
      // NOTE: effectivePrice already includes GST (inclusive pricing from seller)
      // We extract the tax component here for invoice purposes only, NOT to add to total
      if (gstRatePercent !== undefined && gstRatePercent > 0) {
        // Calculate price without tax (effectivePrice is inclusive of GST)
        // Formula: priceWithoutTax = effectivePrice / (1 + gstRatePercent/100)
        priceWithoutTax = effectivePricePerUnit / (1 + gstRatePercent / 100)

        // Calculate GST amount from price without tax (for invoice breakdown only)
        // Use admin-configured rounding mode (fetched at the start of order creation)
        const gstAmountPerUnit = calculateGstAmount(
          priceWithoutTax,
          gstRatePercent,
          gstRoundingMode,
        )

        // Split into IGST or CGST+SGST based on tax type
        if (gstTaxType === 'IGST') {
          igst = gstAmountPerUnit
        } else if (gstTaxType === 'CGST_SGST') {
          const { cgst: cgstAmount, sgst: sgstAmount } = calculateCgstSgstAmounts(
            priceWithoutTax,
            gstRatePercent,
            gstRoundingMode,
          )
          cgst = cgstAmount
          sgst = sgstAmount
        }
      } else {
        // No GST - price without tax equals effective price
        priceWithoutTax = effectivePricePerUnit
      }

      // Round priceWithoutTax to 2 decimal places (standard rounding for prices)
      priceWithoutTax = Math.round(priceWithoutTax * 100) / 100
      // Note: GST amounts (igst, cgst, sgst) are already rounded by calculateGstAmount/calculateCgstSgstAmounts
      // using admin-configured rounding mode, so no additional rounding needed

      const orderItem: IOrderItem = {
        product: product._id,
        variant: variant?._id,
        seller: sellerId,
        sellerStatus: 'pending',
        quantity: item.quantity,
        price: price, // Price at time of order (before any global discounts)
        effectivePrice: effectivePricePerUnit, // Effective price per unit (what customer actually pays)
        priceWithoutTax: priceWithoutTax, // Price per unit exclusive of GST
        subtotal: itemSubtotal, // Subtotal including any item-level discounts from cart
        appliedCoupon: (item as any).appliedCoupon || undefined,
        couponCode: (item as any).couponCode || undefined,
        discountAmount:
          typeof (item as any).discountAmount === 'number'
            ? Number((item as any).discountAmount)
            : undefined,
        discountedPrice:
          typeof (item as any).discountedPrice === 'number'
            ? Number((item as any).discountedPrice)
            : undefined,
        instructions: itemInstruction,
        // Snapshot GST/HSN data (universal fields: from variant if exists, product if not)
        variantId: variant?._id ? String(variant._id) : undefined,
        variantSku,
        variantName,
        // Convert null to undefined (null means seller is not GST registered)
        hsnSacCode: hsnSacCode ?? undefined, // Universal field: from variant or product
        gstRatePercent: gstRatePercent ?? undefined, // Universal field: from variant or product
        gstTaxType, // Determined based on seller and shipping state
        // Tax amounts per unit
        igst,
        cgst,
        sgst,
      }

      orderItems.push(orderItem)

      const existingItems = sellerItemsBySeller.get(sellerIdString) || []
      existingItems.push(orderItem)
      sellerItemsBySeller.set(sellerIdString, existingItems)
    }

    // Track per-coupon discount usage for seller coupons applied at item level
    const sellerCouponUsage = new Map<string, number>()

    // Apply coupon if provided (admin/global or explicit seller coupon at order level)
    // NOTE: We support two coupon systems:
    // - Seller coupons (SellerCoupon model) tracked via CouponRedemption
    // - Admin/global coupons (Coupon model) tracked via usageCount
    let discount = 0
    let coupon: any = null
    let couponRedemption: any = null
    const itemEligibilityMap = new Map<string, boolean>()
    let eligibleTotal = 0

    if (couponId) {
      // First, try to find a SellerCoupon redemption (seller coupon flow)
      couponRedemption = await CouponRedemption.findOne({
        coupon: couponId,
        user: user._id,
        status: { $in: ['clipped', 'applied'] },
      }).populate('coupon')

      if (couponRedemption?.coupon) {
        // Seller coupon from redemption
        coupon = couponRedemption.coupon as any

        // Validate seller coupon is still valid
        const now = new Date()
        if (
          coupon.status !== 'active' ||
          coupon.startDate > now ||
          coupon.endDate < now ||
          (coupon.requiresApproval && !coupon.isApproved)
        ) {
          return res.status(400).json({
            success: false,
            message: 'Coupon is no longer valid',
          })
        }
      } else {
        // No redemption found – treat as admin/global coupon (Coupon model)
        const adminCoupon = await Coupon.findById(couponId)
        if (!adminCoupon) {
          return res.status(400).json({
            success: false,
            message: 'Coupon not found or not applicable',
          })
        }

        const now = new Date()

        // Validate admin coupon dates & status
        if (adminCoupon.status !== 'active') {
          return res.status(400).json({
            success: false,
            message: 'Coupon is not active',
          })
        }
        if (adminCoupon.validFrom > now) {
          return res.status(400).json({
            success: false,
            message: 'Coupon is not yet valid',
          })
        }
        if (adminCoupon.validTo < now) {
          await Coupon.findByIdAndUpdate(adminCoupon._id, {
            status: 'expired',
          })
          return res.status(400).json({
            success: false,
            message: 'Coupon has expired',
          })
        }

        // Usage limits
        if (adminCoupon.usageLimit && adminCoupon.usageCount >= adminCoupon.usageLimit) {
          return res.status(400).json({
            success: false,
            message: 'Coupon usage limit reached',
          })
        }

        // For safety, honour minPurchaseAmount using cart subtotal
        const cartSubtotal = subtotal
        if (adminCoupon.minPurchaseAmount && cartSubtotal < adminCoupon.minPurchaseAmount) {
          return res.status(400).json({
            success: false,
            message: `Minimum purchase amount of ₹${adminCoupon.minPurchaseAmount} required`,
          })
        }

        coupon = adminCoupon
      }

      // Check if coupon applies to order items and build eligibility map
      for (const orderItem of orderItems) {
        const product = await Product.findById(orderItem.product).populate('category')
        if (!product) {
          itemEligibilityMap.set(orderItem.product.toString(), false)
          continue
        }

        let isEligible = false

        // Determine whether this is a seller coupon or an admin/global coupon
        const modelName = (coupon as any)?.constructor?.modelName

        if (modelName === 'SellerCoupon') {
          // Seller coupon: uses productIds/categoryIds/seller
          const couponProductIds: string[] = (
            (coupon as any)?.productIds?.length
              ? (coupon as any).productIds
              : (coupon as any)?.applicableProducts || []
          )
            .map((id: any) => toIdString(id))
            .filter((id: string | null): id is string => Boolean(id))
          const couponCategoryIds: string[] = (
            (coupon as any)?.categoryIds?.length
              ? (coupon as any).categoryIds
              : (coupon as any)?.applicableCategories || []
          )
            .map((id: any) => toIdString(id))
            .filter((id: string | null): id is string => Boolean(id))

          const hasProductRestrictions = couponProductIds.length > 0
          const hasCategoryRestrictions = couponCategoryIds.length > 0

          if (!hasProductRestrictions && !hasCategoryRestrictions) {
            const couponSellerId = toIdString((coupon as any)?.seller)
            const productSellerId = toIdString(product.seller)
            if (!couponSellerId || (productSellerId && couponSellerId === productSellerId)) {
              isEligible = true
            }
          } else {
            if (hasProductRestrictions) {
              const orderProductId = toIdString(orderItem.product)
              if (orderProductId && couponProductIds.includes(orderProductId)) {
                isEligible = true
              }
            }

            if (!isEligible && hasCategoryRestrictions) {
              const productCategoryId = toIdString(
                (product.category as any)?._id || (product.category as any),
              )
              if (productCategoryId && couponCategoryIds.includes(productCategoryId)) {
                isEligible = true
              }
            }
          }
        } else if (modelName === 'Coupon') {
          // Admin/global coupon: uses applicableTo + applicableProducts/applicableCategories
          const applicableTo = (coupon as any).applicableTo || 'all'

          if (applicableTo === 'all') {
            isEligible = true
          } else if (applicableTo === 'products') {
            const appProducts: string[] = ((coupon as any).applicableProducts || [])
              .map((id: any) => toIdString(id))
              .filter((id: string | null): id is string => Boolean(id))
            const orderProductId = toIdString(orderItem.product)
            if (orderProductId && appProducts.includes(orderProductId)) {
              isEligible = true
            }
          } else if (applicableTo === 'categories') {
            const appCategories: string[] = ((coupon as any).applicableCategories || [])
              .map((id: any) => toIdString(id))
              .filter((id: string | null): id is string => Boolean(id))
            const productCategoryId = toIdString(
              (product.category as any)?._id || (product.category as any),
            )
            if (productCategoryId && appCategories.includes(productCategoryId)) {
              isEligible = true
            }
          }
        }

        itemEligibilityMap.set(orderItem.product.toString(), isEligible)
        if (isEligible) {
          eligibleTotal += orderItem.subtotal
        }
      }

      if (eligibleTotal === 0) {
        return res.status(400).json({
          success: false,
          message: 'Coupon is not applicable to items in your order',
        })
      }

      // Determine discount type/value for both seller and admin coupons
      const modelName = (coupon as any)?.constructor?.modelName
      let couponType: 'percent' | 'fixed' = 'fixed'
      let couponValue = 0

      if (modelName === 'SellerCoupon') {
        // SellerCoupon: discountType ('flat' | 'percent'), discountValue
        const rawType = (coupon as any).discountType
        couponType = rawType === 'percent' ? 'percent' : 'fixed'
        couponValue =
          typeof (coupon as any).discountValue === 'number' ? (coupon as any).discountValue : 0
      } else if (modelName === 'Coupon') {
        // Admin Coupon: type ('percentage' | 'fixed'), value
        const rawType = (coupon as any).type
        couponType = rawType === 'percentage' ? 'percent' : 'fixed'
        couponValue = typeof (coupon as any).value === 'number' ? (coupon as any).value : 0
      }

      // Calculate total discount for all eligible items
      // IMPORTANT: eligibleTotal is the sum of orderItem.subtotal (NOT including shipping)
      // Coupons are always applied on order subtotal, never on total with shipping
      if (couponType === 'percent') {
        discount = (eligibleTotal * couponValue) / 100 // Calculate on subtotal only
      } else {
        discount = couponValue // Fixed discount amount
        if (discount > eligibleTotal) {
          discount = eligibleTotal // Don't exceed subtotal
        }
      }

      if (!Number.isFinite(discount) || discount < 0) {
        discount = 0
      }

      // Persist usage tracking based on coupon type
      if (modelName === 'SellerCoupon') {
        // Seller coupon uses CouponRedemption + redeemedCount
        // Create a redemption record on-the-fly if the user applied the coupon without clipping it
        if (!couponRedemption) {
          couponRedemption = new CouponRedemption({
            coupon: coupon._id,
            user: user._id,
            status: 'redeemed',
          })
        }

        // Update redemption status (will be updated with final total after orders are created)
        couponRedemption.status = 'redeemed'
        couponRedemption.discountAmount = discount
        couponRedemption.orderTotal = Math.max(0, (subtotal || 0) - (discount || 0))
        await couponRedemption.save()

        // Update seller coupon redeemed count
        ;(coupon as any).redeemedCount = ((coupon as any).redeemedCount || 0) + 1
        await coupon.save()

        // TODO: Settlement Adjustment
        // The discount amount should be deducted from the seller's payout during settlement.
        // When implementing the settlement service, use the order.discountAmount field
        // to adjust the seller's payout for this order.
      } else if (modelName === 'Coupon') {
        // Admin/global coupon uses usageCount
        const adminCoupon = coupon as any
        adminCoupon.usageCount = (adminCoupon.usageCount || 0) + 1
        await adminCoupon.save()
      }
    }

    // Also mark any seller coupons that were applied at item level (cart items)
    // as redeemed so seller analytics show correct usage.
    for (const cartItem of selectedItems) {
      const applied = (cartItem as any).appliedCoupon
      const discountAmount = Number((cartItem as any).discountAmount || 0)
      if (!applied || !discountAmount || !Number.isFinite(discountAmount) || discountAmount <= 0) {
        continue
      }
      const key =
        typeof applied === 'string'
          ? applied
          : applied?._id?.toString?.() || applied.toString?.() || String(applied)
      if (!key) continue
      const prev = sellerCouponUsage.get(key) || 0
      sellerCouponUsage.set(key, prev + discountAmount)
    }

    for (const [couponIdStr, totalDiscount] of sellerCouponUsage.entries()) {
      try {
        const couponObjectId = new mongoose.Types.ObjectId(couponIdStr)
        let redemption = await CouponRedemption.findOne({
          coupon: couponObjectId,
          user: user._id,
          status: 'redeemed',
        })
        if (!redemption) {
          redemption = new CouponRedemption({
            coupon: couponObjectId,
            user: user._id,
            status: 'redeemed',
          })
        }
        redemption.discountAmount = (redemption.discountAmount || 0) + totalDiscount
        await redemption.save()
      } catch (e) {
        // Best-effort; failure to update analytics must not block order creation
        console.error('Error recording seller coupon redemption from cart item:', e)
      }
    }

    // Generate a unique batchId for all orders from this cart checkout
    const batchId = new mongoose.Types.ObjectId()
    const batchCode = `B-${batchId.toString().slice(-6).toUpperCase()}`

    // Calculate per-item discount proportionally
    const calculateItemDiscount = (
      itemSubtotal: number,
      isEligible: boolean,
      totalEligible: number,
      totalDiscount: number,
    ): number => {
      if (!coupon || !isEligible || totalEligible === 0) return 0

      const modelName = (coupon as any)?.constructor?.modelName
      let couponType: 'percent' | 'fixed' = 'fixed'
      let couponValue = 0

      if (modelName === 'SellerCoupon') {
        const rawType = (coupon as any).discountType
        couponType = rawType === 'percent' ? 'percent' : 'fixed'
        couponValue =
          typeof (coupon as any).discountValue === 'number' ? (coupon as any).discountValue : 0
      } else if (modelName === 'Coupon') {
        const rawType = (coupon as any).type
        couponType = rawType === 'percentage' ? 'percent' : 'fixed'
        couponValue = typeof (coupon as any).value === 'number' ? (coupon as any).value : 0
      }

      if (couponType === 'percent') {
        // For percentage, apply directly to eligible item
        return (itemSubtotal * couponValue) / 100
      } else {
        // For fixed, distribute proportionally
        const itemProportion = itemSubtotal / totalEligible
        const itemDiscount = totalDiscount * itemProportion
        return Math.min(itemDiscount, itemSubtotal) // Don't exceed item subtotal
      }
    }

    // Get all seller profiles with shipping settings
    const uniqueSellerIds = Array.from(sellerItemsBySeller.keys()).map(
      (id) => new mongoose.Types.ObjectId(id),
    )
    const sellerProfiles = uniqueSellerIds.length
      ? await User.find({ _id: { $in: uniqueSellerIds } }).select(
          'name businessName storeSlug supportEmail supportPhone storePhone phone defaultShippingRate',
        )
      : []
    const sellerProfileMap = new Map(
      sellerProfiles.map((sellerDoc) => [sellerDoc._id.toString(), sellerDoc]),
    )

    // Get all products with shipping info for calculation
    const productIds = orderItems.map((item) => item.product)
    const products = await Product.find({ _id: { $in: productIds } }).select(
      'freeShipping requiresShipping shippingCharge',
    )
    const productMap = new Map(products.map((prod) => [String(prod._id), prod]))

    // Create separate order for each item
    const createdOrders = []
    // Tax is 0 because effectivePrice already includes GST (inclusive pricing)
    // Tax amounts (igst, cgst, sgst) are stored in order items for invoice breakdown only
    const tax = 0

    for (const orderItem of orderItems) {
      // Ensure itemSubtotal is a valid number
      const itemSubtotal = orderItem.subtotal || 0
      if (isNaN(itemSubtotal) || itemSubtotal < 0) {
        return res.status(400).json({
          success: false,
          message: `Invalid subtotal for product ${orderItem.product}`,
        })
      }

      // Ensure price is set
      if (!orderItem.price || isNaN(orderItem.price) || orderItem.price <= 0) {
        return res.status(400).json({
          success: false,
          message: `Invalid price for product ${orderItem.product}`,
        })
      }

      const isEligible = itemEligibilityMap.get(orderItem.product.toString()) || false
      const itemDiscount =
        calculateItemDiscount(itemSubtotal, isEligible, eligibleTotal, discount) || 0

      // Get seller profile for this item
      const sellerIdString = orderItem.seller.toString()
      const sellerDoc: any = sellerProfileMap.get(sellerIdString)

      // Get product for shipping calculation
      const productDoc: any = productMap.get(orderItem.product.toString())

      // Calculate shipping charge (charged once per order/item, not per quantity)
      const shipping =
        calculateShippingCharge({
          product: productDoc,
          seller: sellerDoc,
        }) || 0

      // Validate shipping is a valid number
      if (isNaN(shipping) || shipping < 0) {
        return res.status(400).json({
          success: false,
          message: `Invalid shipping charge calculated for product ${orderItem.product}`,
        })
      }

      // Add shipping to orderItem for record keeping
      orderItem.shipping = shipping

      // Calculate order total: subtotal - discount + shipping + tax
      // IMPORTANT: Discount is applied to subtotal (NOT including shipping)
      // Shipping is added AFTER discount is applied
      const itemTotal = itemSubtotal - itemDiscount + shipping + tax || 0

      // Validate all calculated values are numbers
      if (isNaN(itemTotal) || itemTotal < 0) {
        return res.status(400).json({
          success: false,
          message: `Invalid total calculation for product ${orderItem.product}`,
        })
      }

      // Validate shipping is properly included in total
      const expectedTotal = itemSubtotal - itemDiscount + shipping + tax
      if (Math.abs(itemTotal - expectedTotal) > 0.01) {
        console.error(
          `[Order Creation] Shipping calculation mismatch for product ${orderItem.product}:`,
          {
            itemSubtotal,
            itemDiscount,
            shipping,
            tax,
            calculatedTotal: itemTotal,
            expectedTotal,
          },
        )
        return res.status(400).json({
          success: false,
          message: `Shipping calculation error for product ${orderItem.product}`,
        })
      }

      // Create seller shipment for this single item
      const sellerShipment: IOrderSellerShipment = {
        seller: orderItem.seller,
        status: 'pending',
        paymentStatus: 'pending',
        inventoryPacked: false,
        totals: {
          itemSubtotal,
          discount: itemDiscount,
        },
      }

      if (sellerDoc) {
        sellerShipment.sellerSnapshot = {
          name: sellerDoc.name,
          businessName: sellerDoc.businessName,
          storeSlug: sellerDoc.storeSlug,
          supportEmail: sellerDoc.supportEmail,
          supportPhone: sellerDoc.storePhone || sellerDoc.supportPhone,
        }
      }

      // Calculate COD fee if payment method is COD
      // COD fee is typically 2% of gross amount (subtotal + shipping + tax)
      const codFee =
        paymentMethod === 'cod'
          ? Math.round((itemSubtotal - itemDiscount + shipping + tax) * 0.02)
          : 0

      // Create order for this single item
      // Ensure shipping is properly stored as a number
      const orderShipping = Number(shipping) || 0
      const order = new Order({
        user: user._id,
        batchId, // Same batchId for all orders from this checkout
        batchCode,
        items: [orderItem], // Only one item per order
        subtotal: itemSubtotal,
        discount: itemDiscount,
        shipping: orderShipping, // Explicitly ensure shipping is stored as number
        tax,
        total: itemTotal,
        status: 'pending',
        paymentStatus: 'pending', // COD: pending until delivered, Online: pending until webhook confirms
        paymentMethod,
        shippingAddress,
        deliveryInstructions: deliveryInstructions || undefined,
        giftWrap: giftWrap || false,
        coupon: isEligible ? coupon?._id : undefined, // Only link coupon if item is eligible
        couponRedemption: isEligible ? couponRedemption?._id : undefined,
        discountAmount: itemDiscount,
        sellerShipments: [sellerShipment],
        sellerCodFee: codFee > 0 ? codFee : null, // Store COD fee per order
        razorpayOrderId: paymentMethod !== 'cod' ? razorpayOrderId || null : null,
        razorpayPaymentId: paymentMethod !== 'cod' ? razorpayPaymentId || null : null,
        paymentGateway: paymentMethod !== 'cod' && razorpayOrderId ? 'razorpay' : null,
        razorpayPaymentMethod:
          paymentMethod !== 'cod' && razorpayPaymentMethod ? razorpayPaymentMethod : null,
        razorpayPaymentDetails:
          paymentMethod !== 'cod' && razorpayPaymentDetails ? razorpayPaymentDetails : null,
      })

      await order.save()
      createdOrders.push(order)

      // Update product stock for this item
      if (orderItem.variant) {
        // Update variant stock
        await ProductVariant.findByIdAndUpdate(orderItem.variant, {
          $inc: { stock: -orderItem.quantity },
        })
        // Update product totalStock (sum of all variant stocks)
        const product = await Product.findById(orderItem.product)
        if (product && product.hasVariants) {
          const variants = await ProductVariant.find({
            product: orderItem.product,
          })
          const totalStock = variants.reduce((sum, v) => sum + v.stock, 0)
          await Product.updateOne({ _id: orderItem.product }, { totalStock })
        }
      } else {
        // Update product stock directly
        await Product.updateOne(
          { _id: orderItem.product },
          { $inc: { stock: -orderItem.quantity } },
        )
      }
    }

    // Calculate total shipping for the batch (sum of all order shipping charges)
    const batchShipping = createdOrders.reduce((sum, order) => sum + (order.shipping || 0), 0)

    // Update all orders in the batch with batchShipping
    if (batchShipping > 0) {
      await Order.updateMany({ _id: { $in: createdOrders.map((o) => o._id) } }, { batchShipping })
    }

    // Remove ordered items from cart
    const remainingItems = cart.items.filter((item) => item.selected === false)
    cart.items = remainingItems
    await cart.save()

    // Populate and return all created orders
    const orderIds = createdOrders.map((o) => o._id)
    const populatedOrders = await Order.find({ _id: { $in: orderIds } })
      .populate('items.product', 'name slug mainImage')
      .populate('items.variant', 'name sku')
      .populate('sellerShipments.seller', 'name businessName storeSlug')
      .populate('coupon', 'couponCode discountType discountValue')
      .populate('user', 'name email phone')
      .sort({ createdAt: 1 })

    // --- Notifications: Buyer (order placed) ---
    if (populatedOrders.length > 0) {
      const firstOrder = populatedOrders[0]
      const buyer = (firstOrder as any).user as
        | {
            name?: string
            email?: string
            phone?: string
          }
        | undefined
      const buyerEmail = buyer?.email
      // Always prioritize buyer's profile phone number over address phone
      // Only use the phone number from the buyer's profile, not from shipping address
      let buyerPhone: string | undefined = undefined
      if (buyer?.phone) {
        // Phone from user profile - decrypt it using centralized helper
        const buyerId = (buyer as any)?._id ? String((buyer as any)._id) : undefined
        const phoneResult = getPhoneFromUser(
          buyer,
          buyerId,
          `Order Creation ${firstOrder.orderNumber}`,
        )
        if (phoneResult.isDecryptable && phoneResult.phone) {
          buyerPhone = phoneResult.phone
        } else {
          console.warn(
            `[Order Creation] Cannot decrypt buyer phone from profile for order ${
              firstOrder.orderNumber
            }. Error: ${phoneResult.error || 'unknown'}. SMS will not be sent.`,
          )
        }
      } else {
        // Buyer doesn't have a phone in their profile - log and skip SMS
        console.warn(
          `[Order Creation] Buyer does not have a phone number in their profile for order ${
            firstOrder.orderNumber
          }. SMS will not be sent. Address phone (${
            firstOrder.shippingAddress?.phone || 'N/A'
          }) is ignored.`,
        )
      }
      const buyerName = buyer?.name || firstOrder.shippingAddress?.name || 'there'

      // Build a compact items summary across all created orders
      const itemsSummary = populatedOrders
        .map((order) => {
          const item = (order.items && order.items[0]) as any
          const product: any = item?.product || {}
          const variant: any = item?.variant || {}
          const name = variant.name || product.name || 'Item'
          const qty = item?.quantity || 1
          return `${qty} × ${name}`
        })
        .join(', ')

      const totalAmount = populatedOrders.reduce((sum, order) => sum + (order.total || 0), 0)
      const paymentMethod = firstOrder.paymentMethod || 'card'

      if (buyerEmail) {
        void sendEmail(
          buyerEmail,
          `Your order ${firstOrder.orderNumber || ''} has been placed`,
          emailTemplates.orderPlacedBuyer(buyerName, {
            orderNumber: firstOrder.orderNumber || 'N/A',
            itemsSummary,
            totalAmount,
            paymentMethod,
            shippingAddress: firstOrder.shippingAddress,
          }),
        )
      }

      // SMS: Order confirmation to customer
      if (buyerPhone) {
        // Get all items across all orders in the batch
        const allItems: any[] = []
        populatedOrders.forEach((order) => {
          if (order.items && order.items.length > 0) {
            allItems.push(...order.items)
          }
        })

        // Get first item name
        let firstItemName = 'Item'
        if (allItems.length > 0) {
          const firstItem = allItems[0] as any
          const product: any = firstItem?.product || {}
          const variant: any = firstItem?.variant || {}
          firstItemName = variant.name || product.name || 'Item'
        }

        // Calculate remaining item count (total items - 1)
        const totalItemCount = allItems.length
        const remainingItemCount = Math.max(0, totalItemCount - 1)

        const smsTemplate = getSmsTemplate(SmsTemplateType.ORDER_CONFIRMATION, {
          buyerName,
          orderNumber: firstOrder.orderNumber || 'N/A',
        })
        void sendSms(buyerPhone, smsTemplate.message, {
          templateId: smsTemplate.templateId || undefined,
        })
      }

      // --- Notifications: Sellers (new order) + socket events ---
      // Group orders by seller for batch SMS notifications
      const sellerOrderCounts = new Map<string, number>()
      const sellerPhoneMap = new Map<string, string>()
      const sellerEmailMap = new Map<string, string>()
      const sellerNameMap = new Map<string, string>()

      // First pass: collect seller information and count orders per seller
      for (const order of populatedOrders) {
        const shipments = order.sellerShipments || []
        if (shipments.length === 0) continue

        for (const shipment of shipments) {
          const sellerIdRaw = shipment.seller as any
          const sellerId =
            typeof sellerIdRaw === 'string'
              ? sellerIdRaw
              : sellerIdRaw?._id?.toString
              ? sellerIdRaw._id.toString()
              : sellerIdRaw?._id
              ? String(sellerIdRaw._id)
              : ''
          if (!sellerId) continue

          // Count orders per seller
          sellerOrderCounts.set(sellerId, (sellerOrderCounts.get(sellerId) || 0) + 1)

          // Get seller info if not already cached
          if (!sellerPhoneMap.has(sellerId) && !sellerEmailMap.has(sellerId)) {
            const sellerDoc: any = sellerProfileMap.get(sellerId) || undefined
            const sellerEmail = sellerDoc?.supportEmail || sellerDoc?.email
            const sellerName = sellerDoc?.businessName || sellerDoc?.name || 'Seller'

            if (sellerEmail) {
              sellerEmailMap.set(sellerId, sellerEmail)
            }
            sellerNameMap.set(sellerId, sellerName)

            // Get seller phone - decrypt using centralized helper
            const phoneToDecrypt =
              sellerDoc?.phone || sellerDoc?.storePhone || sellerDoc?.supportPhone
            if (phoneToDecrypt) {
              const phoneResult = getPhoneFromUser(
                sellerDoc,
                sellerId,
                `Order Creation Seller Batch Notification ${batchCode}`,
              )
              if (phoneResult.isDecryptable && phoneResult.phone) {
                sellerPhoneMap.set(sellerId, phoneResult.phone)
              } else {
                console.warn(
                  `[Order Creation] Cannot decrypt seller phone for seller ${sellerId} in batch ${batchCode}. Error: ${
                    phoneResult.error || 'unknown'
                  }. SMS will not be sent.`,
                )
              }
            }
          }
        }
      }

      // Second pass: Send batch SMS notifications and individual emails/socket events
      for (const order of populatedOrders) {
        const shipments = order.sellerShipments || []
        if (shipments.length === 0) continue

        for (const shipment of shipments) {
          const sellerIdRaw = shipment.seller as any
          const sellerId =
            typeof sellerIdRaw === 'string'
              ? sellerIdRaw
              : sellerIdRaw?._id?.toString
              ? sellerIdRaw._id.toString()
              : sellerIdRaw?._id
              ? String(sellerIdRaw._id)
              : ''
          if (!sellerId) continue

          const sellerEmail = sellerEmailMap.get(sellerId)
          const sellerName = sellerNameMap.get(sellerId) || 'Seller'

          // Get items for this specific seller from the shipment
          const shipmentItemIds = shipment.itemIds?.map((id) => id.toString()) || []
          const sellerItems =
            shipmentItemIds.length > 0
              ? (order.items || []).filter((item: any) =>
                  shipmentItemIds.includes(item._id?.toString() || String(item._id)),
                )
              : order.items || []

          const firstItem = sellerItems[0] as any
          const product: any = firstItem?.product || {}
          const variant: any = firstItem?.variant || {}
          const name = variant.name || product.name || 'Item'
          const qty = firstItem?.quantity || 1
          const itemsSummarySeller = `${qty} × ${name}`

          // Calculate total for this seller's shipment
          const shipmentTotal = sellerItems.reduce(
            (sum: number, item: any) => sum + (item.subtotal || item.price * item.quantity || 0),
            0,
          )

          // Send individual email for each order (emails can be detailed)
          if (sellerEmail) {
            void sendEmail(
              sellerEmail,
              `New order ${order.orderNumber || ''} on Kourier Boyz`,
              emailTemplates.sellerNewOrder(sellerName, {
                orderNumber: order.orderNumber || 'N/A',
                itemsSummary: itemsSummarySeller,
                totalAmount: shipmentTotal || order.total || 0,
                paymentMethod: order.paymentMethod,
                paymentStatus: order.paymentStatus,
                buyerName: order.shippingAddress?.name,
                shippingAddress: order.shippingAddress,
              }),
            )
          }

          // Send socket event for each order
          try {
            const socketPayload = {
              orderId: (order as any)._id?.toString?.() || String(order._id),
              orderNumber: order.orderNumber,
              buyerName: order.shippingAddress?.name,
              total: shipmentTotal || order.total,
              paymentMethod: order.paymentMethod,
              paymentStatus: order.paymentStatus,
              createdAt: order.createdAt,
              triggeredAt: new Date().toISOString(),
            }
            io.to(`user:${sellerId}`).emit('order:new', socketPayload)
            console.log(
              `[Socket] Sent order:new notification to seller ${sellerId} for order ${order.orderNumber}`,
            )
          } catch (error) {
            // socket failures should not block order creation
            console.error(
              `[Socket] Failed to send order:new notification to seller ${sellerId}:`,
              error,
            )
          }
        }
      }

      // Send batch SMS notifications (one per seller)
      for (const [sellerId, orderCount] of sellerOrderCounts.entries()) {
        const sellerPhone = sellerPhoneMap.get(sellerId)
        if (sellerPhone) {
          try {
            const smsTemplate = getSmsTemplate(SmsTemplateType.SELLER_NEW_ORDER, {
              batchCode,
            })
            const smsResult = await sendSms(sellerPhone, smsTemplate.message, {
              templateId: smsTemplate.templateId || undefined, // Template ID: 1707176640588789880
            })
            if (smsResult.success) {
              console.log(
                `[Order Created] Seller batch SMS sent to ${sellerPhone} for ${orderCount} order(s) in batch ${batchCode}`,
              )
            } else if (!smsResult.skipped) {
              console.error(
                `[Order Created] Failed to send seller batch SMS to ${sellerPhone} for batch ${batchCode}:`,
                smsResult.error,
              )
            }
          } catch (smsError) {
            // Don't fail order creation if SMS fails, but log the error
            console.error(
              `[Order Created] Error sending seller batch SMS to ${sellerPhone} for batch ${batchCode}:`,
              smsError,
            )
          }
        } else {
          console.warn(
            `[Order Created] Seller ${sellerId} has no phone number. Batch SMS notification skipped for batch ${batchCode}`,
          )
        }
      }
    }

    // Create database notifications for customers about order confirmation
    // Only create one notification per unique customer (in case of multiple orders)
    const notifiedCustomers = new Set<string>()
    for (const order of populatedOrders) {
      try {
        const Notification = (await import('../models/Notification')).default
        const buyerId =
          typeof order.user === 'string'
            ? order.user
            : (order.user as any)?._id?.toString?.()
            ? (order.user as any)._id.toString()
            : undefined
        if (buyerId && !notifiedCustomers.has(buyerId)) {
          notifiedCustomers.add(buyerId)
          const orderCount = populatedOrders.filter(
            (o) =>
              (typeof o.user === 'string' ? o.user : (o.user as any)?._id?.toString?.() || '') ===
              buyerId,
          ).length

          await Notification.create({
            userId: buyerId,
            title: 'Order Confirmed',
            message:
              orderCount > 1
                ? `Your ${orderCount} orders have been confirmed and are being processed.`
                : `Your order ${order.orderNumber} has been confirmed and is being processed.`,
            type: 'order',
            read: false,
            link:
              orderCount > 1
                ? '/profile/orders'
                : `/profile/orders?orderId=${
                    (order as any)._id?.toString?.() || String(order._id)
                  }`,
          })
          console.log(
            `[Notification] Created order confirmation notification for customer ${buyerId} for order ${order.orderNumber}`,
          )
        }
      } catch (error) {
        console.error('[Notification] Failed to create order confirmation notification:', error)
      }
    }

    return res.status(201).json({
      success: true,
      message: 'Orders created successfully',
      data: populatedOrders,
      batchId: batchId.toString(),
    })
  } catch (error: any) {
    console.error('Error creating order:', error)
    return res.status(500).json({
      success: false,
      message: error.message || 'Something went wrong while creating order',
    })
  } finally {
    if (checkoutLockAcquired && checkoutUserId && checkoutLockId) {
      try {
        await Cart.updateOne(
          { user: checkoutUserId, checkoutLockId },
          {
            $set: { checkoutLock: false },
            $unset: { checkoutLockedAt: '', checkoutLockId: '' },
          },
        )
      } catch (unlockError) {
        console.error('Error releasing checkout lock:', unlockError)
      }
    }
  }
}

// Get user orders
// Get user orders - allows deactivated buyers to access their order history
// Order history remains accessible even after account deactivation for record-keeping purposes
export const getUserOrders = async (req: Request, res: Response) => {
  try {
    const user = await checkUserAccess(req, res, ['customer'])
    if (!user) return

    // Note: Deactivated buyers can still access their order history (enforced by middleware)
    // This allows them to view past orders even after deactivation

    const { status, page = 1, limit = 20, search, months } = req.query

    const query: any = { user: user._id }
    if (status) {
      query.status = status
    }

    // Add date range filtering based on months parameter
    if (months) {
      const monthsNum = typeof months === 'string' ? parseInt(months, 10) : Number(months)
      if (!isNaN(monthsNum) && monthsNum > 0) {
        const now = new Date()
        // Calculate date by subtracting months properly
        // This handles month boundaries correctly (e.g., March 31 - 1 month = Feb 28/29)
        const fromDate = new Date(
          now.getFullYear(),
          now.getMonth() - monthsNum,
          now.getDate(),
          0,
          0,
          0,
          0,
        )
        query.createdAt = { $gte: fromDate }
      }
    }

    // Add search functionality
    if (search && typeof search === 'string') {
      const regex = new RegExp(search, 'i')
      const conditions: any[] = [
        { orderNumber: regex },
        { 'shippingAddress.name': regex },
        { 'shippingAddress.phone': regex },
      ]
      if (mongoose.Types.ObjectId.isValid(search)) {
        conditions.push({ _id: new mongoose.Types.ObjectId(search) })
      }
      query.$or = conditions
    }

    const skip = (Number(page) - 1) * Number(limit)

    const [orders, total] = await Promise.all([
      Order.find(query)
        .populate('items.product', 'name slug mainImage returnable returnDays')
        .populate('items.variant', 'name sku mainImage images')
        .populate('sellerShipments.seller', 'name businessName storeSlug')
        // Populate admin/global coupon (if any) with basic details
        .populate('coupon', 'code type value description')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Order.countDocuments(query),
    ])

    // Determine which products in these orders already have a review by this user
    const productIds = new Set<string>()
    orders.forEach((order) => {
      order.items.forEach((item: any) => {
        const productId = item?.product?._id
        if (productId) {
          productIds.add(String(productId))
        }
      })
    })

    let reviewedProductIds: Set<string> = new Set()
    if (productIds.size > 0) {
      const reviewedProducts = await Product.find({
        _id: { $in: Array.from(productIds) },
        'reviews.user': user._id,
      })
        .select('_id')
        .lean()

      reviewedProductIds = new Set(reviewedProducts.map((p) => String(p._id)))
    }

    // Attach a `reviewedByUser` flag on each product and compute return eligibility per order (toObject-safe)
    const now = new Date()
    const orderIds = orders.map((o) => o._id)

    // Preload return rejection counts per order for lock info
    const rejectedByOrder =
      orderIds.length > 0
        ? await Return.aggregate([
            {
              $match: {
                order: { $in: orderIds },
                status: 'REJECTED',
                customer: user._id,
              },
            },
            { $group: { _id: '$order', count: { $sum: 1 } } },
          ])
        : []
    const rejectedMap = new Map<string, number>()
    rejectedByOrder.forEach((row: any) => {
      rejectedMap.set(String(row._id), row.count || 0)
    })

    const plainOrders = orders.map((order) => {
      const obj = order.toObject()
      // Determine latest deliveredAt across all seller shipments for this order
      let latestDeliveredAt: Date | null = null
      if (Array.isArray(obj.sellerShipments)) {
        obj.sellerShipments.forEach((shipment: any) => {
          if (shipment?.deliveredAt) {
            const d = new Date(shipment.deliveredAt)
            if (!Number.isNaN(d.getTime())) {
              if (!latestDeliveredAt || d > latestDeliveredAt) {
                latestDeliveredAt = d
              }
            }
          }
        })
      }

      // Fallback: if no sellerShipment.deliveredAt but order itself is marked delivered,
      // approximate deliveredAt using order.updatedAt (or createdAt).
      if (!latestDeliveredAt && obj.status === 'delivered') {
        const candidate = obj.updatedAt || obj.createdAt
        const d = candidate ? new Date(candidate) : null
        if (d && !Number.isNaN(d.getTime())) {
          latestDeliveredAt = d
        }
      }

      let canRequestReturn = false

      // Only check return eligibility if order is delivered
      if (obj.status === 'delivered') {
        obj.items.forEach((item: any) => {
          const productId = item?.product?._id
          if (productId && item.product) {
            if (reviewedProductIds.has(String(productId))) {
              item.product.reviewedByUser = true
            }

            // Compute return eligibility using product return policy + deliveredAt
            if (!canRequestReturn) {
              const returnable = item.product.returnable === true

              if (!returnable) {
                return // Skip non-returnable items
              }

              const returnDays =
                typeof item.product.returnDays === 'number' && item.product.returnDays > 0
                  ? item.product.returnDays
                  : 7

              if (latestDeliveredAt) {
                const diffMs = now.getTime() - latestDeliveredAt.getTime()
                const diffDays = diffMs / (1000 * 60 * 60 * 24)
                if (diffDays <= returnDays) {
                  canRequestReturn = true
                }
              } else {
                // If we can't determine deliveredAt, be conservative but still allow if product is returnable
                // This handles edge cases where deliveredAt wasn't properly set in sellerShipments
                // We allow returns for delivered orders with returnable products
                canRequestReturn = true
              }
            }
          }
        })
      }
      const rejectedCount = rejectedMap.get(String(order._id)) || 0
      ;(obj as any).canRequestReturn = canRequestReturn
      ;(obj as any).isReturnLocked = rejectedCount >= 2
      return obj
    })

    return res.status(200).json({
      success: true,
      data: plainOrders,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
    })
  } catch (error: any) {
    console.error('Error fetching orders:', error)
    return res.status(500).json({
      success: false,
      message: error.message || 'Something went wrong while fetching orders',
    })
  }
}

// Get user order statistics (count for a time period)
// Get single order
export const getOrder = async (req: Request, res: Response) => {
  try {
    const user = await checkUserAccess(req, res, ['customer'])
    if (!user) return

    const { id } = req.params

    const order = await Order.findOne({ _id: id, user: user._id })
      .populate('items.product', 'name slug mainImage description')
      .populate('items.variant', 'name sku mainImage images')
      .populate(
        'sellerShipments.seller',
        'name businessName storeSlug panNumber gstNumber addressLine1 addressLine2 city state postalCode country',
      )
      .populate('coupon', 'code type value description')
      .populate('couponRedemption')
      .populate('user', 'name email gstNumber')

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      })
    }

    return res.status(200).json({
      success: true,
      data: order,
    })
  } catch (error: any) {
    console.error('Error fetching order:', error)
    return res.status(500).json({
      success: false,
      message: error.message || 'Something went wrong while fetching order',
    })
  }
}

// Download invoice - generates invoice every time download is clicked
export const downloadInvoice = async (req: Request, res: Response) => {
  try {
    const user = await checkUserAccess(req, res, ['customer'])
    if (!user) return

    const { id } = req.params

    // Populate order with all necessary data for invoice generation
    const order = await Order.findOne({ _id: id, user: user._id })
      .populate('items.product', 'name slug mainImage sku images')
      .populate('items.variant', 'name sku mainImage images attributes')
      .populate(
        'items.seller',
        'name email businessName storeLogo sellerAgreementSignature authorizedPersonName authorizedPersonDesignation storeDescription gstNumber panNumber state addressLine1 addressLine2 city postalCode country',
      )
      .populate(
        'sellerShipments.seller',
        'name businessName storeSlug panNumber gstNumber addressLine1 addressLine2 city state postalCode country',
      )
      .populate('user', 'name email gstNumber')
      .populate('coupon', 'code discountType')

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      })
    }

    // Check lockAfterIssue setting - if invoice exists and lock is enabled, serve existing invoice
    const AdminInvoiceSettings = (await import('../models/AdminInvoiceSettings')).default
    const invoiceSettings = await AdminInvoiceSettings.getSingleton()

    if (order.invoice?.invoice_url && invoiceSettings.lockAfterIssue) {
      // Invoice is locked - serve existing invoice without regeneration
      console.log(
        `🔒 Invoice locked (lockAfterIssue=true) for order ${
          order.orderNumber || order._id
        }, serving existing invoice`,
      )
      const { downloadFromR2 } = await import('../utils/r2Upload')
      const { buffer, contentType } = await downloadFromR2(order.invoice.invoice_url)

      // Set headers for download
      const invoiceFileName = `Invoice-${
        order.invoice.invoice_number || order.orderNumber || order._id || 'invoice'
      }.pdf`
      res.setHeader('Content-Type', contentType || 'application/pdf')
      res.setHeader('Content-Disposition', `attachment; filename="${invoiceFileName}"`)
      res.setHeader('Content-Length', buffer.length)

      // Send the PDF file
      return res.send(buffer)
    }

    // Get seller from items or sellerShipments
    const seller =
      (order.items[0] as any)?.seller || (order.sellerShipments?.[0] as any)?.seller || null

    // Prepare invoice data
    const invoiceData = {
      order: order.toObject() as any,
      customer: (order.user as any) || user,
      seller: seller as any,
      items: order.items.map((item: any) => ({
        product: item.product,
        variant: item.variant,
        orderItem: item.toObject ? item.toObject() : item,
      })),
      audience: 'buyer' as const,
    }

    // Generate invoice (regenerate if lockAfterIssue is false or invoice doesn't exist)
    console.log(
      `🔄 Generating invoice for order ${order.orderNumber || order._id} on download request`,
    )
    const invoice = await generateInvoice(invoiceData, 'INVOICE')

    // Update order with new invoice details
    if (invoice.invoice_url && invoice.invoice_number) {
      order.invoice = {
        invoice_id: invoice.invoice_id,
        invoice_url: invoice.invoice_url,
        invoice_number: invoice.invoice_number,
        generated_at: new Date(),
        hsnSummary: invoice.hsnSummary,
      }
      await order.save()
    }

    // Download the PDF file from R2 and serve it
    const { downloadFromR2 } = await import('../utils/r2Upload')
    const { buffer, contentType } = await downloadFromR2(invoice.invoice_url)

    // Set headers for download
    const invoiceFileName = `Invoice-${
      invoice.invoice_number || order.orderNumber || order._id || 'invoice'
    }.pdf`
    res.setHeader('Content-Type', contentType || 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${invoiceFileName}"`)
    res.setHeader('Content-Length', buffer.length)

    // Send the PDF file
    res.send(buffer)
  } catch (error: any) {
    console.error('Error generating/downloading invoice:', error)
    return res.status(500).json({
      success: false,
      message: error.message || 'Something went wrong while generating invoice',
    })
  }
}

// Download label
export const downloadLabel = async (req: Request, res: Response) => {
  try {
    const user = await checkUserAccess(req, res, ['customer'])
    if (!user) return

    const { id } = req.params

    const order = await Order.findOne({ _id: id, user: user._id })

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      })
    }

    if (!order.label?.label_url) {
      return res.status(404).json({
        success: false,
        message: 'Label not available for this order',
      })
    }

    // Redirect to label URL or return the URL
    return res.status(200).json({
      success: true,
      data: {
        label_url: order.label.label_url,
        label_id: order.label.label_id,
      },
    })
  } catch (error: any) {
    console.error('Error fetching label:', error)
    return res.status(500).json({
      success: false,
      message: error.message || 'Something went wrong while fetching label',
    })
  }
}

// Cancel order (customer)
export const cancelOrder = async (req: Request, res: Response) => {
  try {
    const user = await checkUserAccess(req, res, ['customer'])
    if (!user) return

    const { id } = req.params

    const order = await Order.findOne({ _id: id, user: user._id })
      .populate('sellerShipments.seller', 'name businessName storeSlug supportEmail storePhone')
      .populate('user', 'name email')

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      })
    }

    // Check if order can be cancelled
    const { canCancel, reason } = canCancelOrder(order)
    if (!canCancel) {
      return res.status(400).json({
        success: false,
        message: reason || 'Order cannot be cancelled',
      })
    }

    // Cancel the order
    order.status = 'cancelled'
    order.sellerShipments.forEach((shipment) => {
      if (!['shipped', 'in_transit', 'out_for_delivery', 'delivered'].includes(shipment.status)) {
        shipment.status = 'cancelled'
        shipment.cancelledAt = new Date()
      }
    })
    order.markModified('sellerShipments')
    await order.save()

    // Restore stock for all items in the order
    await restoreOrderStock(order.items)

    // Notify sellers via socket
    const sellerIds = new Set<string>()
    order.sellerShipments.forEach((shipment) => {
      const sellerId = shipment.seller?.toString()
      if (sellerId) sellerIds.add(sellerId)
    })

    sellerIds.forEach((sellerId) => {
      try {
        io.to(`user:${sellerId}`).emit('order:cancelled', {
          orderId: (order as any)._id?.toString() || String(order._id),
          orderNumber: order.orderNumber,
          cancelledAt: new Date().toISOString(),
        })
      } catch {
        // Socket failures should not block cancellation
      }
    })

    return res.status(200).json({
      success: true,
      message: 'Order cancelled successfully',
      data: order,
    })
  } catch (error: any) {
    console.error('Error cancelling order:', error)
    return res.status(500).json({
      success: false,
      message: error.message || 'Something went wrong while cancelling order',
    })
  }
}

// Get birthday recap data (user orders from past year + popular products)
export const getBirthdayRecap = async (req: Request, res: Response) => {
  try {
    const user = await checkUserAccess(req, res, ['customer'])
    if (!user) return

    // Get orders from the past year
    const oneYearAgo = new Date()
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)

    const orders = await Order.find({
      user: user._id,
      createdAt: { $gte: oneYearAgo },
      status: { $ne: 'cancelled' },
    })
      .populate({
        path: 'items.product',
        select: 'name slug mainImage images category',
        populate: {
          path: 'category',
          select: '_id name slug',
        },
      })
      .populate('items.variant', 'name sku mainImage images')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean()

    // Extract unique products, categories, and cities from orders
    const userProductIds = new Set<string>()
    const categoryIds = new Set<string>()
    const cities = new Set<string>()

    orders.forEach((order: any) => {
      // Track unique cities from shipping addresses
      if (order.shippingAddress?.city) {
        cities.add(order.shippingAddress.city.trim())
      }

      // Track unique categories from products
      order.items?.forEach((item: any) => {
        const productId = item?.product?._id?.toString()
        if (productId) {
          userProductIds.add(productId)
        }
        // Get category from product
        const categoryId = item?.product?.category?._id?.toString()
        if (categoryId) {
          categoryIds.add(categoryId)
        }
      })
    })

    // Get popular products (products with high soldCount/rating that user hasn't purchased)
    const popularProducts = await Product.find({
      status: 'active',
      _id: { $nin: Array.from(userProductIds).map((id) => new mongoose.Types.ObjectId(id)) },
    })
      .select(
        'name slug mainImage images price comparePrice discountPercent rating reviewCount soldCount',
      )
      .sort({ soldCount: -1, rating: -1 })
      .limit(12)
      .lean()

    // Calculate stats
    const totalOrders = orders.length
    const categoriesExplored = categoryIds.size
    const citiesDelivered = cities.size

    return res.status(200).json({
      success: true,
      data: {
        stats: {
          totalOrders,
          categoriesExplored,
          citiesDelivered,
        },
        popularProducts,
      },
    })
  } catch (error: any) {
    console.error('Error getting birthday recap:', error)
    return res.status(500).json({
      success: false,
      message: error.message || 'Something went wrong while fetching birthday recap',
    })
  }
}
