import crypto from 'crypto'
import type { Request, Response } from 'express'
import mongoose from 'mongoose'
import Razorpay from 'razorpay'
import Cart from '../models/Cart'
import Coupon from '../models/Coupon'
import CouponRedemption from '../models/CouponRedemption'
import PaymentIntent from '../models/PaymentIntent'
import Product from '../models/Product'
import ProductVariant from '../models/ProductVariant'
import User from '../models/User'
import { checkUserAccess } from '../utils/checkUserAccess'
import { calculateShippingCharge } from '../utils/shippingCalculator'
import {
  calculateCgstSgstAmounts,
  calculateGstAmount,
  determineTaxTypeForOrderItem,
  extractStateCodeFromGstin,
  getStateCodeFromShippingAddress,
} from '../utils/taxHelpers'

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || ''
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || ''

const getRazorpayInstance = () => {
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    throw new Error('Razorpay keys are not configured')
  }

  return new Razorpay({
    key_id: RAZORPAY_KEY_ID,
    key_secret: RAZORPAY_KEY_SECRET,
  })
}

export const createRazorpayOrder = async (req: Request, res: Response) => {
  try {
    const user = await checkUserAccess(req, res, ['customer'])
    if (!user) return

    const { amount } = req.body as { amount?: number }

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid amount is required',
      })
    }

    const instance = getRazorpayInstance()

    const amountInPaise = Math.round(amount * 100)

    const order = await instance.orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt: `kourier_boyz_${Date.now()}`,
      notes: {
        userId: String(user._id),
        email: user.email,
      },
    })

    return res.status(201).json({
      success: true,
      message: 'Razorpay order created',
      data: {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: RAZORPAY_KEY_ID,
      },
    })
  } catch (error: any) {
    console.error('Error creating Razorpay order:', error)
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to create Razorpay order',
    })
  }
}

export const confirmRazorpayPayment = async (req: Request, res: Response) => {
  try {
    const user = await checkUserAccess(req, res, ['customer'])
    if (!user) return

    const { token, orderId, amount } = req.body as {
      token?: string
      orderId?: string
      amount?: number
    }

    if (!token || !orderId || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Missing token, orderId or amount',
      })
    }

    const instance = getRazorpayInstance()

    // NOTE: The exact API for confirming tokenised payments depends on Razorpay's latest SDK.
    // This call may need to be adjusted to match their official Elements documentation.
    const payment = await (instance.payments as any).create({
      amount: Math.round(amount * 100),
      currency: 'INR',
      order_id: orderId,
      token,
    })

    return res.status(200).json({
      success: true,
      message: 'Payment captured successfully',
      data: payment,
    })
  } catch (error: any) {
    console.error('Error confirming Razorpay payment:', error)
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to confirm Razorpay payment',
    })
  }
}

export const verifyRazorpayPayment = async (req: Request, res: Response) => {
  try {
    const user = await checkUserAccess(req, res, ['customer'])
    if (!user) return

    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body as {
      razorpayOrderId?: string
      razorpayPaymentId?: string
      razorpaySignature?: string
    }

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({
        success: false,
        message: 'Missing Razorpay payment details',
      })
    }

    if (!RAZORPAY_KEY_SECRET) {
      return res.status(500).json({
        success: false,
        message: 'Razorpay secret key is not configured',
      })
    }

    const payload = `${razorpayOrderId}|${razorpayPaymentId}`
    const expectedSignature = crypto
      .createHmac('sha256', RAZORPAY_KEY_SECRET)
      .update(payload)
      .digest('hex')

    const isValid = crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(razorpaySignature),
    )

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment signature',
      })
    }

    // Fetch payment details from Razorpay
    let paymentDetails = null
    let paymentMethod = null
    try {
      const instance = getRazorpayInstance()
      const payment = (await instance.payments.fetch(razorpayPaymentId)) as any

      // Extract payment method
      paymentMethod = payment.method || null

      // Extract payment details based on method
      paymentDetails = {
        method: payment.method || null,
        card: payment.card
          ? {
              last4: payment.card.last4 || null,
              network: payment.card.network || null,
              issuer: payment.card.issuer || null,
              type: payment.card.type || null,
            }
          : undefined,
        upi: (payment as any).upi
          ? {
              vpa: (payment as any).upi.vpa || null,
              payer_account_type: (payment as any).upi.payer_account_type || null,
            }
          : undefined,
        wallet: (payment as any).wallet
          ? {
              wallet_name:
                typeof (payment as any).wallet === 'object' && (payment as any).wallet.name
                  ? (payment as any).wallet.name
                  : typeof (payment as any).wallet === 'string'
                  ? (payment as any).wallet
                  : null,
            }
          : undefined,
        paylater: (payment as any).provider
          ? {
              provider: (payment as any).provider || null,
            }
          : undefined,
        netbanking: payment.bank
          ? {
              bank: payment.bank || null,
            }
          : undefined,
        bank: payment.bank || null,
        contact: payment.contact || null,
        email: payment.email || null,
        international: payment.international || false,
        notes: payment.notes || {},
      }
    } catch (fetchError: any) {
      console.error('Error fetching Razorpay payment details:', fetchError)
      // Continue even if fetching details fails - signature is already verified
    }

    return res.status(200).json({
      success: true,
      message: 'Payment verified successfully',
      data: {
        razorpayPaymentId,
        razorpayOrderId,
        paymentMethod,
        paymentDetails,
      },
    })
  } catch (error: any) {
    console.error('Error verifying Razorpay payment:', error)
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to verify payment',
    })
  }
}

// Create payment intent before payment (stores order data temporarily)
// This replicates the full order calculation logic from order.controller.ts
export const createPaymentIntent = async (req: Request, res: Response) => {
  try {
    const user = await checkUserAccess(req, res, ['customer'])
    if (!user) return

    const {
      razorpayOrderId,
      shippingAddress,
      couponId,
      deliveryInstructions,
      itemInstructions,
      giftWrap,
    } = req.body as {
      razorpayOrderId?: string
      shippingAddress?: any
      couponId?: string
      deliveryInstructions?: string
      itemInstructions?: Array<{ productId: string; variantId?: string; instructions: string }>
      giftWrap?: boolean
    }

    if (!razorpayOrderId || !shippingAddress) {
      return res.status(400).json({
        success: false,
        message: 'Razorpay order ID and shipping address are required',
      })
    }

    // Check if payment intent already exists
    const existingIntent = await PaymentIntent.findOne({ razorpayOrderId })
    if (existingIntent) {
      return res.status(200).json({
        success: true,
        message: 'Payment intent already exists',
        data: {
          intentId: existingIntent._id,
          razorpayOrderId: existingIntent.razorpayOrderId,
          status: existingIntent.status,
          orderIds: existingIntent.orderIds,
        },
      })
    }

    // Fetch GST rounding mode from admin settings
    let gstRoundingMode: 'ROUND_HALF_UP' | 'ROUND_HALF_DOWN' | 'ROUND_UP' | 'ROUND_DOWN' =
      'ROUND_HALF_UP'
    try {
      const AdminInvoiceSettings = (await import('../models/AdminInvoiceSettings')).default
      const invoiceSettings = await AdminInvoiceSettings.getSingleton()
      gstRoundingMode = (invoiceSettings.gstRoundingMode || 'ROUND_HALF_UP') as any
    } catch (settingsError) {
      console.error('Error fetching GST rounding mode, using default ROUND_HALF_UP:', settingsError)
    }

    // Get cart with selected items
    const cart = await Cart.findOne({ user: user._id }).populate([
      {
        path: 'items.product',
        model: 'Product',
        select:
          'name slug price effectivePrice stock seller status hasVariants hsnSacCode gstRatePercent igstRatePercent cgstRatePercent sgstRatePercent sku isGstApplicable freeShipping requiresShipping shippingCharge',
      },
      {
        path: 'items.variant',
        model: 'ProductVariant',
        select: 'name price effectivePrice stock hsnSacCode gstRatePercent sku',
      },
    ])

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cart is empty',
      })
    }

    const selectedItems = cart.items.filter((item) => item.selected !== false)
    if (selectedItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No items selected for checkout',
      })
    }

    // Build instruction map
    const buildInstructionKey = (productId: string, variantId?: string | null) => {
      return `${productId}-${variantId || 'no-variant'}`
    }
    const instructionMap = new Map<string, string>()
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

    // Validate products, calculate totals, and snapshot prices
    let subtotal = 0
    const intentItems: any[] = []
    const sellerItemsBySeller = new Map<string, any[]>()

    for (const item of selectedItems) {
      const product = item.product as any
      const variant = item.variant as any

      // Stock validation - CRITICAL FIX #4
      if (!product || product.status !== 'active') {
        return res.status(400).json({
          success: false,
          message: `Product ${product?.name || 'Unknown'} is not available`,
        })
      }

      const availableStock = variant ? variant.stock : product.stock
      if (availableStock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${product.name}. Available: ${availableStock}, Requested: ${item.quantity}`,
        })
      }

      // Price validation and snapshot - CRITICAL FIX #3
      let currentPrice =
        variant?.effectivePrice ??
        variant?.price ??
        product.effectivePrice ??
        product.price ??
        (item as any).effectivePrice ??
        item.priceAtAddition

      // Fetch fresh price if not available
      if (!currentPrice || isNaN(Number(currentPrice)) || Number(currentPrice) <= 0) {
        try {
          const productId = product._id || product
          const variantId = variant?._id || variant

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

      if (!currentPrice || isNaN(Number(currentPrice)) || Number(currentPrice) <= 0) {
        return res.status(400).json({
          success: false,
          message: `Invalid or missing price for product "${product.name || 'Unknown'}". Please remove this item from cart and add it again.`,
        })
      }

      const price = Number(currentPrice)
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

      const rawSubtotal = price * item.quantity
      const itemSubtotal =
        typeof item.subtotal === 'number' && item.subtotal > 0 ? Number(item.subtotal) : rawSubtotal

      if (isNaN(itemSubtotal) || itemSubtotal <= 0) {
        return res.status(400).json({
          success: false,
          message: `Invalid subtotal calculation for product ${product.name}`,
        })
      }

      subtotal += itemSubtotal

      // Tax calculation - CRITICAL FIX #3
      let hsnSacCode: string | undefined
      let gstRatePercent: number | undefined
      let gstTaxType: 'IGST' | 'CGST_SGST' | undefined

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
        gstTaxType = 'IGST'
      }

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

      if (fullProduct.hasVariants === true) {
        if (variant?._id || variant) {
          try {
            const variantId = variant._id || variant
            const fullVariant = await ProductVariant.findById(variantId)
              .select('hsnSacCode gstRatePercent sku name')
              .lean()

            if (fullVariant) {
              hsnSacCode = fullVariant.hsnSacCode ?? undefined
              gstRatePercent = fullVariant.gstRatePercent ?? undefined
            }
          } catch (variantError) {
            console.error('Error fetching variant GST/HSN data:', variantError)
          }
        }
      } else {
        hsnSacCode = fullProduct.hsnSacCode ?? undefined
        const rawGstRate =
          (fullProduct as any).gstRatePercent ?? (fullProduct as any).igstRatePercent
        gstRatePercent = typeof rawGstRate === 'number' ? rawGstRate : undefined
        const isGstApplicable = (fullProduct as any).isGstApplicable === true
        if (!isGstApplicable) {
          hsnSacCode = undefined
          gstRatePercent = undefined
        }
      }

      // Calculate tax amounts (for invoice breakdown - price already includes GST).
      // Use the actual per-unit price from the cart subtotal so stored igst/cgst/sgst
      // reflect the GST on the discounted price actually paid, not the catalogue price.
      const effectivePricePerUnit = itemSubtotal / item.quantity
      let priceWithoutTax = effectivePricePerUnit
      let igst: number | undefined = undefined
      let cgst: number | undefined = undefined
      let sgst: number | undefined = undefined

      if (gstRatePercent !== undefined && gstRatePercent > 0) {
        priceWithoutTax = effectivePricePerUnit / (1 + gstRatePercent / 100)
        const gstAmountPerUnit = calculateGstAmount(
          priceWithoutTax,
          gstRatePercent,
          gstRoundingMode,
        )

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
        priceWithoutTax = effectivePricePerUnit
      }

      priceWithoutTax = Math.round(priceWithoutTax * 100) / 100

      const instructionKey = buildInstructionKey(product._id.toString(), variant?._id?.toString())
      const itemInstruction = instructionMap.get(instructionKey)

      const intentItem = {
        product: product._id || product,
        variant: variant?._id || variant,
        quantity: item.quantity,
        price, // Snapshot price
        effectivePrice: effectivePricePerUnit, // Snapshot effective price
        priceWithoutTax, // For tax calculation
        subtotal: itemSubtotal,
        discount: 0, // Will be calculated below
        tax: 0, // Tax is included in price (inclusive pricing)
        total: itemSubtotal, // Will be updated after discount
        // Tax breakdown (for invoice)
        hsnSacCode,
        gstRatePercent,
        gstTaxType,
        igst,
        cgst,
        sgst,
        // Item-level coupon info
        appliedCoupon: (item as any).appliedCoupon || undefined,
        couponCode: (item as any).couponCode || undefined,
        discountAmount: typeof (item as any).discountAmount === 'number' ? Number((item as any).discountAmount) : undefined,
        discountedPrice: typeof (item as any).discountedPrice === 'number' ? Number((item as any).discountedPrice) : undefined,
      }

      intentItems.push(intentItem)

      const existingItems = sellerItemsBySeller.get(sellerIdString) || []
      existingItems.push(intentItem)
      sellerItemsBySeller.set(sellerIdString, existingItems)
    }

    // Coupon validation and calculation - CRITICAL FIX #1
    let discount = 0
    let coupon: any = null
    let couponRedemption: any = null
    const itemEligibilityMap = new Map<string, boolean>()
    let eligibleTotal = 0

    if (couponId) {
      couponRedemption = await CouponRedemption.findOne({
        coupon: couponId,
        user: user._id,
        status: { $in: ['clipped', 'applied'] },
      }).populate('coupon')

      if (couponRedemption?.coupon) {
        coupon = couponRedemption.coupon as any
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
        const adminCoupon = await Coupon.findById(couponId)
        if (!adminCoupon) {
          return res.status(400).json({
            success: false,
            message: 'Coupon not found or not applicable',
          })
        }

        const now = new Date()
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
          await Coupon.findByIdAndUpdate(adminCoupon._id, { status: 'expired' })
          return res.status(400).json({
            success: false,
            message: 'Coupon has expired',
          })
        }
        if (adminCoupon.usageLimit && adminCoupon.usageCount >= adminCoupon.usageLimit) {
          return res.status(400).json({
            success: false,
            message: 'Coupon usage limit reached',
          })
        }
        if (adminCoupon.minPurchaseAmount && subtotal < adminCoupon.minPurchaseAmount) {
          return res.status(400).json({
            success: false,
            message: `Minimum purchase amount of ₹${adminCoupon.minPurchaseAmount} required`,
          })
        }
        coupon = adminCoupon
      }

      // Check coupon eligibility for items
      for (const intentItem of intentItems) {
        const product = await Product.findById(intentItem.product).populate('category')
        if (!product) {
          itemEligibilityMap.set(intentItem.product.toString(), false)
          continue
        }

        let isEligible = false
        const modelName = (coupon as any)?.constructor?.modelName
        const toIdString = (value: any): string | null => {
          if (!value) return null
          if (typeof value === 'string') return value
          if (value instanceof mongoose.Types.ObjectId) return value.toString()
          if (value._id) return toIdString(value._id)
          if (typeof value.toString === 'function') return value.toString()
          return null
        }

        if (modelName === 'SellerCoupon') {
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
              const orderProductId = toIdString(intentItem.product)
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
          const applicableTo = (coupon as any).applicableTo || 'all'
          if (applicableTo === 'all') {
            isEligible = true
          } else if (applicableTo === 'products') {
            const appProducts: string[] = ((coupon as any).applicableProducts || [])
              .map((id: any) => toIdString(id))
              .filter((id: string | null): id is string => Boolean(id))
            const orderProductId = toIdString(intentItem.product)
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

        itemEligibilityMap.set(intentItem.product.toString(), isEligible)
        if (isEligible) {
          eligibleTotal += intentItem.subtotal
        }
      }

      if (eligibleTotal === 0) {
        return res.status(400).json({
          success: false,
          message: 'Coupon is not applicable to items in your order',
        })
      }

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
        discount = (eligibleTotal * couponValue) / 100
      } else {
        discount = couponValue
        if (discount > eligibleTotal) {
          discount = eligibleTotal
        }
      }

      if (!Number.isFinite(discount) || discount < 0) {
        discount = 0
      }
    }

    // Calculate per-item discount
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
        return (itemSubtotal * couponValue) / 100
      } else {
        const itemProportion = itemSubtotal / totalEligible
        const itemDiscount = totalDiscount * itemProportion
        return Math.min(itemDiscount, itemSubtotal)
      }
    }

    // Get seller profiles for shipping calculation
    const uniqueSellerIds = Array.from(sellerItemsBySeller.keys()).map(
      (id) => new mongoose.Types.ObjectId(id),
    )
    const sellerProfiles = uniqueSellerIds.length
      ? await User.find({ _id: { $in: uniqueSellerIds } }).select(
          'name businessName storeSlug supportEmail supportPhone storePhone defaultShippingRate',
        )
      : []
    const sellerProfileMap = new Map(
      sellerProfiles.map((sellerDoc) => [sellerDoc._id.toString(), sellerDoc]),
    )

    // Get products for shipping calculation
    const productIds = intentItems.map((item) => item.product)
    const products = await Product.find({ _id: { $in: productIds } }).select(
      'freeShipping requiresShipping shippingCharge',
    )
    const productMap = new Map(products.map((prod) => [String(prod._id), prod]))

    // Calculate shipping and update item totals - CRITICAL FIX #1
    let totalShipping = 0
    for (const intentItem of intentItems) {
      const product = productMap.get(String(intentItem.product))
      const sellerId = (product as any)?.seller?.toString() || ''
      const seller = sellerProfileMap.get(sellerId)

      const itemShipping = calculateShippingCharge({
        product: product as any,
        seller: seller as any,
      }) || 0

      const isEligible = itemEligibilityMap.get(intentItem.product.toString()) || false
      const itemDiscount = calculateItemDiscount(
        intentItem.subtotal,
        isEligible,
        eligibleTotal,
        discount,
      )

      intentItem.discount = itemDiscount
      intentItem.shipping = itemShipping // Store shipping per item for consistency
      intentItem.total = intentItem.subtotal - itemDiscount + itemShipping
      totalShipping += itemShipping
    }

    // Tax is 0 because effectivePrice already includes GST (inclusive pricing)
    // Tax amounts are stored in items for invoice breakdown only
    const tax = 0
    const total = subtotal - discount + totalShipping + tax

    // ENHANCEMENT: Validate total matches Razorpay order amount
    try {
      const instance = getRazorpayInstance()
      const rzpOrder = await instance.orders.fetch(razorpayOrderId)
      const rzpAmountInRupees =
        typeof rzpOrder.amount === 'number' ? rzpOrder.amount / 100 : Number(rzpOrder.amount) / 100 // Convert from paise to rupees

      if (Math.abs(total - rzpAmountInRupees) > 0.01) {
        console.warn(
          `[Payment Intent] Total mismatch detected: Intent=${total}, Razorpay=${rzpAmountInRupees}, Difference=${Math.abs(total - rzpAmountInRupees)}`,
          {
            razorpayOrderId,
            intentTotal: total,
            razorpayAmount: rzpAmountInRupees,
            subtotal,
            discount,
            shipping: totalShipping,
            tax,
          },
        )
        // Log warning but continue - payment intent total is authoritative for order creation
        // This helps identify calculation discrepancies between frontend and backend
      } else {
        console.log('[Payment Intent] Total validation passed', {
          razorpayOrderId,
          total,
          razorpayAmount: rzpAmountInRupees,
        })
      }
    } catch (rzpError: any) {
      // If we can't fetch Razorpay order, log warning but continue
      // This shouldn't block payment intent creation
      console.warn(
        `[Payment Intent] Could not validate total with Razorpay order: ${rzpError.message}`,
        { razorpayOrderId },
      )
    }

    // Create payment intent
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000) // 30 minutes
    const paymentIntent = new PaymentIntent({
      user: user._id,
      razorpayOrderId,
      status: 'pending',
      shippingAddress,
      items: intentItems,
      paymentMethod: 'razorpay',
      couponId: couponId || undefined,
      deliveryInstructions: deliveryInstructions || undefined,
      itemInstructions: itemInstructions || undefined,
      giftWrap: giftWrap || false,
      subtotal,
      discount,
      shipping: totalShipping,
      tax,
      total,
      expiresAt,
    })

    await paymentIntent.save()

    return res.status(201).json({
      success: true,
      message: 'Payment intent created',
      data: {
        intentId: paymentIntent._id,
        razorpayOrderId: paymentIntent.razorpayOrderId,
        status: paymentIntent.status,
        expiresAt: paymentIntent.expiresAt,
        total, // Return total for verification
      },
    })
  } catch (error: any) {
    console.error('[Payment Intent] Error creating payment intent:', error)
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to create payment intent',
    })
  }
}

// Check order status by razorpayOrderId (for frontend polling)
export const checkOrderStatus = async (req: Request, res: Response) => {
  try {
    const user = await checkUserAccess(req, res, ['customer'])
    if (!user) return

    const { razorpayOrderId } = req.params

    if (!razorpayOrderId) {
      return res.status(400).json({
        success: false,
        message: 'Razorpay order ID is required',
      })
    }

    // Check payment intent
    const paymentIntent = await PaymentIntent.findOne({
      razorpayOrderId,
      user: user._id,
    })

    if (!paymentIntent) {
      // Also check if order already exists (in case payment intent was deleted)
      const Order = (await import('../models/Order')).default
      const existingOrders = await Order.find({
        razorpayOrderId,
        user: user._id,
        paymentGateway: 'razorpay',
      })
        .select('_id orderNumber status paymentStatus total createdAt')
        .sort({ createdAt: 1 })
        .limit(10)

      if (existingOrders.length > 0) {
        return res.status(200).json({
          success: true,
          data: {
            status: 'order_created',
            orders: existingOrders.map((o) => ({
              _id: (o._id as mongoose.Types.ObjectId).toString(),
              orderNumber: o.orderNumber,
              status: o.status,
              paymentStatus: o.paymentStatus,
              total: o.total,
              createdAt: o.createdAt,
            })),
          },
        })
      }

      return res.status(404).json({
        success: false,
        message: 'Payment intent not found',
      })
    }

    // Check if payment intent expired
    if (paymentIntent.expiresAt && paymentIntent.expiresAt < new Date()) {
      if (paymentIntent.status !== 'order_created') {
        paymentIntent.status = 'expired'
        await paymentIntent.save()
      }
    }

    // If order is created, return order details
    if (paymentIntent.status === 'order_created' && paymentIntent.orderIds?.length) {
      const Order = (await import('../models/Order')).default
      const orders = await Order.find({
        _id: { $in: paymentIntent.orderIds },
      })
        .populate('items.product', 'name slug mainImage')
        .populate('items.variant', 'name sku')
        .populate('sellerShipments.seller', 'name businessName storeSlug')
        .populate('coupon', 'couponCode discountType discountValue')
        .sort({ createdAt: 1 })

      return res.status(200).json({
        success: true,
        data: {
          status: 'order_created',
          orders: orders.map((o) => ({
            _id: (o._id as mongoose.Types.ObjectId).toString(),
            orderNumber: o.orderNumber,
            status: o.status,
            paymentStatus: o.paymentStatus,
            total: o.total,
            createdAt: o.createdAt,
          })),
        },
      })
    }

    // Return payment intent status
    return res.status(200).json({
      success: true,
      data: {
        status: paymentIntent.status,
        intentId: (paymentIntent._id as mongoose.Types.ObjectId).toString(),
        razorpayOrderId: paymentIntent.razorpayOrderId,
        razorpayPaymentId: paymentIntent.razorpayPaymentId,
        orderIds: paymentIntent.orderIds?.map((id) => id.toString()),
      },
    })
  } catch (error: any) {
    console.error('[Check Order Status] Error:', error)
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to check order status',
    })
  }
}
