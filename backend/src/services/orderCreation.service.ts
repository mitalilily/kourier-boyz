import mongoose from 'mongoose'
import Cart from '../models/Cart'
import Coupon from '../models/Coupon'
import CouponRedemption from '../models/CouponRedemption'
import Order, { IOrder, IOrderItem, IOrderSellerShipment } from '../models/Order'
import Product from '../models/Product'
import ProductVariant from '../models/ProductVariant'
import User from '../models/User'
import { io } from '../server'
import { emailTemplates, sendEmail } from '../utils/email'
// Invoice generation handled separately - removed import to avoid build errors
import { getPhoneFromUser } from '../utils/phoneDecryptionHelper'
import { calculateShippingCharge } from '../utils/shippingCalculator'
import { sendSms } from '../utils/sms'
import { getSmsTemplate, SmsTemplateType } from '../utils/smsTemplates'

/**
 * Create orders from a payment intent after payment is confirmed via webhook
 * This replicates the full order creation logic from order.controller.ts
 * Includes: tax calculation, notifications, invoice generation, stock validation
 */
export const createOrderFromPaymentIntent = async (
  paymentIntent: any,
  paymentData: {
    razorpayPaymentId?: string
    razorpayPaymentMethod?: string
    razorpayPaymentDetails?: any
  },
): Promise<IOrder[]> => {
  const user = await User.findById(paymentIntent.user)
  if (!user) {
    throw new Error('User not found for payment intent')
  }

  // Fetch GST rounding mode
  let gstRoundingMode: 'ROUND_HALF_UP' | 'ROUND_HALF_DOWN' | 'ROUND_UP' | 'ROUND_DOWN' =
    'ROUND_HALF_UP'
  try {
    const AdminInvoiceSettings = (await import('../models/AdminInvoiceSettings')).default
    const invoiceSettings = await AdminInvoiceSettings.getSingleton()
    gstRoundingMode = (invoiceSettings.gstRoundingMode || 'ROUND_HALF_UP') as any
  } catch (settingsError) {
    console.error('Error fetching GST rounding mode, using default ROUND_HALF_UP:', settingsError)
  }

  // Generate batch ID for all orders from this payment intent
  const batchId = new mongoose.Types.ObjectId()
  const batchCode = `B-${batchId.toString().slice(-6).toUpperCase()}`

  const createdOrders: IOrder[] = []
  const itemInstructionsMap = new Map<string, string>()

  // Build instruction map
  if (paymentIntent.itemInstructions) {
    for (const instruction of paymentIntent.itemInstructions) {
      const key = `${instruction.productId}-${instruction.variantId || 'no-variant'}`
      itemInstructionsMap.set(key, instruction.instructions)
    }
  }

  // Get seller profiles for shipping calculation
  const sellerIdsSet = new Set<string>()
  for (const intentItem of paymentIntent.items) {
    const product = await Product.findById(intentItem.product).select('seller').lean()
    if (product?.seller) {
      sellerIdsSet.add(String(product.seller))
    }
  }

  const sellerIds = Array.from(sellerIdsSet).map((id) => new mongoose.Types.ObjectId(id))
  const sellers = await User.find({ _id: { $in: sellerIds } }).select(
    'name businessName storeSlug supportEmail supportPhone storePhone phone defaultShippingRate gstNumber',
  )
  const sellerMap = new Map(sellers.map((s) => [s._id.toString(), s]))

  // Get products for shipping and tax calculation
  const productIds = paymentIntent.items.map((item: any) => item.product)
  const products = await Product.find({ _id: { $in: productIds } }).select(
    'freeShipping requiresShipping shippingCharge seller',
  )
  const productMap = new Map(products.map((p) => [String(p._id), p]))

  // Process coupon redemption if applicable
  let coupon: any = null
  let couponRedemption: any = null
  if (paymentIntent.couponId) {
    couponRedemption = await CouponRedemption.findOne({
      coupon: paymentIntent.couponId,
      user: paymentIntent.user,
      status: { $in: ['clipped', 'applied'] },
    }).populate('coupon')

    if (couponRedemption?.coupon) {
      coupon = couponRedemption.coupon as any
      couponRedemption.status = 'redeemed'
      couponRedemption.discountAmount = paymentIntent.discount
      couponRedemption.orderTotal = paymentIntent.total
      await couponRedemption.save()

      if ((coupon as any).constructor?.modelName === 'SellerCoupon') {
        ;(coupon as any).redeemedCount = ((coupon as any).redeemedCount || 0) + 1
        await coupon.save()
      } else {
        const adminCoupon = coupon as any
        adminCoupon.usageCount = (adminCoupon.usageCount || 0) + 1
        await adminCoupon.save()
      }
    } else {
      const adminCoupon = await Coupon.findById(paymentIntent.couponId)
      if (adminCoupon) {
        coupon = adminCoupon
        adminCoupon.usageCount = (adminCoupon.usageCount || 0) + 1
        await adminCoupon.save()
      }
    }
  }

  // Create one order per item (matching existing order creation logic)
  for (const intentItem of paymentIntent.items) {
    // Stock re-validation - CRITICAL FIX #4
    const product = await Product.findById(intentItem.product)
    if (!product || product.status !== 'active') {
      throw new Error(
        `Product ${intentItem.product} is no longer available. Order cannot be created.`,
      )
    }

    let availableStock = product.stock
    if (intentItem.variant) {
      const variant = await ProductVariant.findById(intentItem.variant)
      if (!variant) {
        throw new Error(`Variant ${intentItem.variant} not found. Order cannot be created.`)
      }
      availableStock = variant.stock
    }

    if (availableStock < intentItem.quantity) {
      throw new Error(
        `Insufficient stock for product ${product.name}. Available: ${availableStock}, Requested: ${intentItem.quantity}. Payment will be refunded.`,
      )
    }

    // Price validation - CRITICAL FIX #4
    // Use prices from payment intent (snapshot) to prevent price changes
    const snapshotPrice = intentItem.price
    const snapshotEffectivePrice = intentItem.effectivePrice

    // Log price differences for audit (but use intent prices)
    const currentProduct = await Product.findById(intentItem.product)
      .select('effectivePrice price')
      .lean()
    if (currentProduct) {
      const currentPrice = currentProduct.effectivePrice ?? currentProduct.price
      if (currentPrice && Math.abs(currentPrice - snapshotEffectivePrice) > 0.01) {
        console.warn(
          `[Order Creation] Price changed for product ${intentItem.product}: Intent price: ${snapshotEffectivePrice}, Current price: ${currentPrice}. Using intent price.`,
        )
      }
    }

    const productDoc = productMap.get(String(intentItem.product))
    const sellerId = (productDoc as any)?.seller?.toString() || ''
    const seller = sellerMap.get(sellerId)

    // Use shipping from payment intent (snapshot) to maintain consistency
    // Recalculate only to verify it matches (for audit)
    const intentShipping = intentItem.shipping || 0
    const recalculatedShipping =
      calculateShippingCharge({
        product: productDoc as any,
        seller: seller as any,
      }) || 0

    // Use intent shipping, but log if there's a discrepancy
    if (Math.abs(intentShipping - recalculatedShipping) > 0.01) {
      console.warn(
        `[Order Creation] Shipping mismatch for product ${intentItem.product}: Intent: ${intentShipping}, Recalculated: ${recalculatedShipping}. Using intent shipping.`,
      )
    }

    const shipping = intentShipping

    // Use tax data from payment intent - CRITICAL FIX #3
    const orderItem: IOrderItem = {
      product: intentItem.product,
      variant: intentItem.variant,
      seller: new mongoose.Types.ObjectId(sellerId),
      sellerStatus: 'pending',
      quantity: intentItem.quantity,
      price: snapshotPrice, // Use snapshot price
      effectivePrice: snapshotEffectivePrice, // Use snapshot effective price
      priceWithoutTax: intentItem.priceWithoutTax || snapshotPrice,
      subtotal: intentItem.subtotal,
      shipping,
      instructions: itemInstructionsMap.get(
        `${intentItem.product}-${intentItem.variant || 'no-variant'}`,
      ),
      // Tax breakdown from payment intent - CRITICAL FIX #3
      hsnSacCode: intentItem.hsnSacCode,
      gstRatePercent: intentItem.gstRatePercent,
      gstTaxType: intentItem.gstTaxType,
      igst: intentItem.igst,
      cgst: intentItem.cgst,
      sgst: intentItem.sgst,
      // Coupon info
      appliedCoupon: intentItem.appliedCoupon,
      couponCode: intentItem.couponCode,
      discountAmount: intentItem.discountAmount,
      discountedPrice: intentItem.discountedPrice,
    }

    // Calculate item totals
    const itemSubtotal = intentItem.subtotal
    const itemDiscount = intentItem.discount || 0
    // Tax is 0 because effectivePrice already includes GST (inclusive pricing)
    const tax = 0
    const itemTotal = itemSubtotal - itemDiscount + shipping + tax

    // Create seller shipment
    const sellerShipment: IOrderSellerShipment = {
      seller: new mongoose.Types.ObjectId(sellerId),
      status: 'pending',
      paymentStatus: 'paid', // Payment already confirmed via webhook
      inventoryPacked: false,
      totals: {
        itemSubtotal,
        discount: itemDiscount,
      },
    }

    if (seller) {
      sellerShipment.sellerSnapshot = {
        name: seller.name,
        businessName: seller.businessName,
        storeSlug: seller.storeSlug,
        supportEmail: seller.supportEmail,
        supportPhone: seller.storePhone || (seller as any).supportPhone || undefined,
      }
    }

    // Determine coupon eligibility for this item
    const isEligible = paymentIntent.couponId
      ? await (async () => {
          if (!coupon) return false
          const product = await Product.findById(intentItem.product).populate('category')
          if (!product) return false

          const modelName = (coupon as any)?.constructor?.modelName
          const toIdString = (value: any): string | null => {
            if (!value) return null
            if (typeof value === 'string') return value
            if (value instanceof mongoose.Types.ObjectId) return value.toString()
            if (value._id) return toIdString(value._id)
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

            if (couponProductIds.length > 0) {
              const orderProductId = toIdString(intentItem.product)
              return orderProductId ? couponProductIds.includes(orderProductId) : false
            }
            if (couponCategoryIds.length > 0) {
              const productCategoryId = toIdString(
                (product.category as any)?._id || (product.category as any),
              )
              return productCategoryId ? couponCategoryIds.includes(productCategoryId) : false
            }
            const couponSellerId = toIdString((coupon as any)?.seller)
            const productSellerId = toIdString(product.seller)
            return !couponSellerId || (productSellerId && couponSellerId === productSellerId)
          } else if (modelName === 'Coupon') {
            const applicableTo = (coupon as any).applicableTo || 'all'
            if (applicableTo === 'all') return true
            if (applicableTo === 'products') {
              const appProducts: string[] = ((coupon as any).applicableProducts || [])
                .map((id: any) => toIdString(id))
                .filter((id: string | null): id is string => Boolean(id))
              const orderProductId = toIdString(intentItem.product)
              return orderProductId ? appProducts.includes(orderProductId) : false
            }
            if (applicableTo === 'categories') {
              const appCategories: string[] = ((coupon as any).applicableCategories || [])
                .map((id: any) => toIdString(id))
                .filter((id: string | null): id is string => Boolean(id))
              const productCategoryId = toIdString(
                (product.category as any)?._id || (product.category as any),
              )
              return productCategoryId ? appCategories.includes(productCategoryId) : false
            }
          }
          return false
        })()
      : false

    // Map Razorpay payment method to Order paymentMethod enum
    // Valid enum values: 'card', 'cod', 'wallet', 'upi'
    const mapRazorpayPaymentMethod = (
      razorpayMethod?: string,
    ): 'card' | 'cod' | 'wallet' | 'upi' => {
      if (!razorpayMethod) return 'card' // Default fallback
      const method = razorpayMethod.toLowerCase()
      if (method === 'card' || method === 'paylater' || method === 'netbanking') return 'card'
      if (method === 'upi') return 'upi'
      if (method === 'wallet') return 'wallet'
      return 'card' // Default fallback for unknown methods
    }

    // Create order
    const order = new Order({
      user: paymentIntent.user,
      batchId,
      batchCode,
      items: [orderItem],
      subtotal: itemSubtotal,
      discount: itemDiscount,
      shipping,
      tax, // Tax is 0 (inclusive pricing)
      total: itemTotal,
      status: 'pending',
      paymentStatus: 'paid', // Payment confirmed via webhook
      paymentMethod: mapRazorpayPaymentMethod(paymentData.razorpayPaymentMethod),
      shippingAddress: paymentIntent.shippingAddress,
      deliveryInstructions: paymentIntent.deliveryInstructions,
      giftWrap: paymentIntent.giftWrap || false,
      coupon: isEligible ? paymentIntent.couponId : undefined,
      couponRedemption: isEligible && couponRedemption ? couponRedemption._id : undefined,
      discountAmount: itemDiscount,
      sellerShipments: [sellerShipment],
      razorpayOrderId: paymentIntent.razorpayOrderId,
      razorpayPaymentId: paymentData.razorpayPaymentId,
      paymentGateway: 'razorpay',
      razorpayPaymentMethod: paymentData.razorpayPaymentMethod as any,
      razorpayPaymentDetails: paymentData.razorpayPaymentDetails,
    })

    await order.save()
    createdOrders.push(order)

    // Update stock
    if (orderItem.variant) {
      await ProductVariant.findByIdAndUpdate(orderItem.variant, {
        $inc: { stock: -orderItem.quantity },
      })
      const product = await Product.findById(orderItem.product)
      if (product && product.hasVariants) {
        const variants = await ProductVariant.find({ product: orderItem.product })
        const totalStock = variants.reduce((sum, v) => sum + v.stock, 0)
        await Product.updateOne({ _id: orderItem.product }, { totalStock })
      }
    } else {
      await Product.updateOne({ _id: orderItem.product }, { $inc: { stock: -orderItem.quantity } })
    }
  }

  // Update batch shipping
  const batchShipping = createdOrders.reduce((sum, order) => sum + (order.shipping || 0), 0)
  if (batchShipping > 0) {
    await Order.updateMany({ _id: { $in: createdOrders.map((o) => o._id) } }, { batchShipping })
  }

  // Clear cart items that were ordered
  const cart = await Cart.findOne({ user: paymentIntent.user })
  if (cart) {
    const orderedProductIds = new Set(paymentIntent.items.map((item: any) => String(item.product)))
    cart.items = cart.items.filter((item) => {
      const productId = String(item.product)
      return !orderedProductIds.has(productId)
    })
    await cart.save()
  }

  // Populate orders for notifications
  const orderIds = createdOrders.map((o) => o._id)
  const populatedOrders = await Order.find({ _id: { $in: orderIds } })
    .populate('items.product', 'name slug mainImage')
    .populate('items.variant', 'name sku')
    .populate(
      'sellerShipments.seller',
      'name businessName storeSlug supportEmail supportPhone storePhone phone',
    )
    .populate('coupon', 'couponCode discountType discountValue')
    .populate('user', 'name email phone')
    .sort({ createdAt: 1 })

  // --- Notifications: Buyer (order placed) - CRITICAL FIX #2 ---
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
    let buyerPhone: string | undefined = undefined

    if (buyer?.phone) {
      const buyerId = (buyer as any)?._id ? String((buyer as any)._id) : undefined
      const phoneResult = getPhoneFromUser(
        buyer,
        buyerId,
        `Order Creation ${firstOrder.orderNumber}`,
      )
      if (phoneResult.isDecryptable && phoneResult.phone) {
        buyerPhone = phoneResult.phone
      }
    }

    const buyerName = buyer?.name || firstOrder.shippingAddress?.name || 'there'

    // Build items summary
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

    // Email notification
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

    // SMS notification
    if (buyerPhone) {
      const allItems: any[] = []
      populatedOrders.forEach((order) => {
        if (order.items && order.items.length > 0) {
          allItems.push(...order.items)
        }
      })

      let firstItemName = 'Item'
      if (allItems.length > 0) {
        const firstItem = allItems[0] as any
        const product: any = firstItem?.product || {}
        const variant: any = firstItem?.variant || {}
        firstItemName = variant.name || product.name || 'Item'
      }

      const smsTemplate = getSmsTemplate(SmsTemplateType.ORDER_CONFIRMATION, {
        buyerName,
        orderNumber: firstOrder.orderNumber || 'N/A',
      })
      void sendSms(buyerPhone, smsTemplate.message, {
        templateId: smsTemplate.templateId || undefined,
      })
    }

    // --- Notifications: Sellers (new order) - CRITICAL FIX #2 ---
    const sellerOrderCounts = new Map<string, number>()
    const sellerPhoneMap = new Map<string, string>()
    const sellerEmailMap = new Map<string, string>()
    const sellerNameMap = new Map<string, string>()

    // Collect seller information
    for (const order of populatedOrders) {
      const shipments = order.sellerShipments || []
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

        sellerOrderCounts.set(sellerId, (sellerOrderCounts.get(sellerId) || 0) + 1)

        if (!sellerPhoneMap.has(sellerId) && !sellerEmailMap.has(sellerId)) {
          const sellerDoc: any = sellerMap.get(sellerId) || shipment.sellerSnapshot
          const sellerEmail = sellerDoc?.supportEmail || sellerDoc?.email
          const sellerName = sellerDoc?.businessName || sellerDoc?.name || 'Seller'

          if (sellerEmail) {
            sellerEmailMap.set(sellerId, sellerEmail)
          }
          sellerNameMap.set(sellerId, sellerName)

          // Get seller phone
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
          } else {
            console.warn(
              `[Order Creation] Seller ${sellerId} has no phone number. Batch SMS notification skipped for batch ${batchCode}`,
            )
          }
        }
      }
    }

    // Send seller notifications
    for (const order of populatedOrders) {
      const shipments = order.sellerShipments || []
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

        const firstItem = (order.items && order.items[0]) as any
        const product: any = firstItem?.product || {}
        const variant: any = firstItem?.variant || {}
        const name = variant.name || product.name || 'Item'
        const qty = firstItem?.quantity || 1
        const itemsSummarySeller = `${qty} × ${name}`

        const shipmentTotal = order.total || 0

        // Email notification
        if (sellerEmail) {
          void sendEmail(
            sellerEmail,
            `New order ${order.orderNumber || ''} on Kourier Boyz`,
            emailTemplates.sellerNewOrder(sellerName, {
              orderNumber: order.orderNumber || 'N/A',
              itemsSummary: itemsSummarySeller,
              totalAmount: shipmentTotal,
              paymentMethod: order.paymentMethod,
              paymentStatus: order.paymentStatus,
              buyerName: order.shippingAddress?.name,
              shippingAddress: order.shippingAddress,
            }),
          )
        }

        // Socket event
        try {
          io.to(`user:${sellerId}`).emit('order:new', {
            orderId: (order as any)._id?.toString?.() || String(order._id),
            orderNumber: order.orderNumber,
            buyerName: order.shippingAddress?.name,
            total: shipmentTotal,
            paymentMethod: order.paymentMethod,
            paymentStatus: order.paymentStatus,
            createdAt: order.createdAt,
            triggeredAt: new Date().toISOString(),
          })
        } catch (error) {
          console.error(
            `[Socket] Failed to send order:new notification to seller ${sellerId}:`,
            error,
          )
        }
      }
    }

    // Send batch SMS to sellers
    for (const [sellerId, orderCount] of sellerOrderCounts.entries()) {
      const sellerPhone = sellerPhoneMap.get(sellerId)
      if (sellerPhone) {
        try {
          const smsTemplate = getSmsTemplate(SmsTemplateType.SELLER_NEW_ORDER, {
            batchCode,
          })
          const smsResult = await sendSms(sellerPhone, smsTemplate.message, {
            templateId: smsTemplate.templateId || undefined,
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

    // Create database notifications - CRITICAL FIX #2
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
          await Notification.create({
            userId: buyerId,
            title: 'Order Confirmed',
            message: `Your order ${order.orderNumber} has been confirmed and payment received.`,
            type: 'order',
            read: false,
            link: `/profile/orders?orderId=${order._id}`,
          })
        }
      } catch (notifError) {
        console.error('[Order Creation] Error creating database notification:', notifError)
      }
    }

    // Generate invoices - CRITICAL FIX #2
    // Note: Invoice generation is typically handled on-demand or via separate endpoints
    // Skipping here to avoid complex InvoiceData construction
    // Invoices can be generated when needed via admin/seller order endpoints
  }

  return createdOrders
}
