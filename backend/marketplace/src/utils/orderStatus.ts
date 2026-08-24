import mongoose, { HydratedDocument } from 'mongoose'
import {
  IOrder,
  IOrderItem,
  IOrderSellerShipment,
  OrderStatus,
  SellerShipmentStatus,
} from '../models/Order'
import User from '../models/User'
import { emailTemplates, sendEmail } from './email'
import { getPhoneFromUser } from './phoneDecryptionHelper'
import { sendSms } from './sms'
import { getSmsTemplate, SmsTemplateType } from './smsTemplates'
import { generateTrackingUrl, getTrackingIdentifier } from './trackingUrl'

type MutableOrder = IOrder | HydratedDocument<IOrder>

export const SELLER_STATUS_SEQUENCE: SellerShipmentStatus[] = [
  'pending',
  'processing',
  'pickup_requested',
  'shipped',
  'in_transit',
  'out_for_delivery',
  'delivered',
]

export const SELLER_STATUS_SET = new Set<SellerShipmentStatus>([
  ...SELLER_STATUS_SEQUENCE,
  'cancelled',
])

const deriveAggregateStatus = (statuses: SellerShipmentStatus[]): OrderStatus => {
  if (statuses.length === 0) {
    return 'pending'
  }

  if (statuses.every((status) => status === 'cancelled')) {
    return 'cancelled'
  }

  if (statuses.every((status) => status === 'delivered')) {
    return 'delivered'
  }

  if (statuses.some((status) => status === 'out_for_delivery')) {
    return 'out_for_delivery'
  }

  if (statuses.some((status) => status === 'in_transit')) {
    return 'in_transit'
  }

  if (statuses.some((status) => status === 'shipped')) {
    return 'shipped'
  }

  // Map pickup_requested to ready_to_ship for order status
  if (statuses.some((status) => status === 'pickup_requested')) {
    return 'ready_to_ship'
  }

  if (statuses.some((status) => status === 'processing')) {
    return 'processing'
  }

  return 'pending'
}

export const recalcOrderStatus = (order: MutableOrder) => {
  const itemStatuses = order.items?.map((item) => item.sellerStatus || 'pending') || []
  order.status = deriveAggregateStatus(itemStatuses)
}

export const isForwardStatusTransition = (
  current: SellerShipmentStatus,
  next: SellerShipmentStatus,
): boolean => {
  if (current === next) return true
  if (!SELLER_STATUS_SET.has(next)) return false
  if ((current as string) === 'cancelled') return false

  if ((next as string) === 'cancelled') {
    const cancellableStatuses: SellerShipmentStatus[] = ['pending', 'processing']
    return cancellableStatuses.includes(current)
  }

  // Normalize "ready_to_ship" to "pickup_requested" for validation
  // (they are equivalent, "ready_to_ship" is legacy)
  const normalizedCurrent: SellerShipmentStatus =
    (current as string) === 'cancelled'
      ? 'pending'
      : (current as string) === 'ready_to_ship'
      ? 'pickup_requested'
      : current
  const normalizedNext: SellerShipmentStatus =
    (next as string) === 'ready_to_ship' ? 'pickup_requested' : next

  const currentIndex = SELLER_STATUS_SEQUENCE.indexOf(normalizedCurrent)
  const nextIndex = SELLER_STATUS_SEQUENCE.indexOf(normalizedNext)
  
  // Enforce that "pickup_requested" must be reached before "shipped"
  // Cannot skip from "processing" directly to "shipped"
  if (normalizedNext === 'shipped' && normalizedCurrent === 'processing') {
    return false
  }
  
  // Allow sequential transitions (next step) or staying at/going forward in sequence
  // This prevents skipping "pickup_requested" when going to "shipped"
  return nextIndex >= currentIndex
}

export const updateShipmentStatus = (
  order: HydratedDocument<IOrder>,
  sellerShipment: IOrderSellerShipment,
  nextStatus: SellerShipmentStatus,
) => {
  if (!isForwardStatusTransition(sellerShipment.status, nextStatus)) {
    throw new Error('INVALID_STATUS_TRANSITION')
  }

  const now = new Date()
  const progressStatuses: SellerShipmentStatus[] = [
    'pickup_requested',
    'shipped',
    'in_transit',
    'out_for_delivery',
    'delivered',
  ]
  if (progressStatuses.includes(nextStatus)) {
    sellerShipment.inventoryPacked = true
    sellerShipment.inventoryPackedAt = sellerShipment.inventoryPackedAt || now
  }

  // Add timeline tracking event
  if (!sellerShipment.trackingEvents) {
    sellerShipment.trackingEvents = []
  }

  const statusLabels: Record<SellerShipmentStatus, string> = {
    pending: 'Order Pending',
    processing: 'Order Processing',
    ready_to_ship: 'Ready to Ship',
    pickup_requested: 'Pickup Requested',
    shipped: 'Order Shipped',
    in_transit: 'In Transit',
    out_for_delivery: 'Out for Delivery',
    delivered: 'Order Delivered',
    cancelled: 'Order Cancelled',
  }

  sellerShipment.trackingEvents.push({
    status: statusLabels[nextStatus] || nextStatus,
    message: `Status updated to ${statusLabels[nextStatus] || nextStatus}`,
    timestamp: now,
  })

  switch (nextStatus) {
    case 'pickup_requested':
      sellerShipment.readyToShipAt = sellerShipment.readyToShipAt || now
      break
    case 'shipped':
      sellerShipment.shippedAt = now
      break
    case 'in_transit':
      sellerShipment.shippedAt = sellerShipment.shippedAt || now
      break
    case 'out_for_delivery':
      sellerShipment.shippedAt = sellerShipment.shippedAt || now
      break
    case 'delivered':
      sellerShipment.deliveredAt = now
      // For COD orders, update payment status to 'paid' when delivered
      // (customer pays at the time of delivery)
      if (order.paymentMethod === 'cod') {
        order.paymentStatus = 'paid'
        sellerShipment.paymentStatus = 'paid'
      }
      // Add customer to seller's customers list (async, non-blocking)
      // Only if order is not returned
      void addCustomerToSellers(order)
      break
    case 'cancelled':
      sellerShipment.cancelledAt = now
      break
    default:
      break
  }

  sellerShipment.status = nextStatus

  const itemIds = sellerShipment.itemIds || []
  const itemIdSet =
    itemIds.length > 0
      ? new Set(
          itemIds.map((id) =>
            typeof id === 'string' ? id : (id as mongoose.Types.ObjectId).toString(),
          ),
        )
      : null

  order.items.forEach((item) => {
    const itemId = (item as any)._id?.toString()
    if (itemIdSet && itemId && itemIdSet.has(itemId)) {
      item.sellerStatus = nextStatus
      return
    }
    if (!itemIdSet && item.seller?.toString() === sellerShipment.seller.toString()) {
      item.sellerStatus = nextStatus
    }
  })
  order.markModified('items')
  order.markModified('sellerShipments')
}

/**
 * Send email and SMS notifications when order is shipped
 * This should be called after updateShipmentStatus when status changes to 'shipped'
 */
export const notifyOrderShipped = async (
  order: HydratedDocument<IOrder>,
  sellerShipment: IOrderSellerShipment,
) => {
  try {
    // Get tracking link from shipment
    const trackingLink =
      sellerShipment.shippingMeta?.tracking_link ||
      sellerShipment.kourierBoyzLogistics?.tracking_link ||
      undefined

    // Get AWB and courier info
    const awb =
      sellerShipment.shippingMeta?.awb || sellerShipment.kourierBoyzLogistics?.awb_number || undefined
    const courier = sellerShipment.shippingMeta?.courier || undefined
    const estimatedDelivery =
      sellerShipment.shippingMeta?.estimated_delivery_date ||
      sellerShipment.kourierBoyzLogistics?.estimated_delivery_date ||
      undefined

    // Populate user to get customer email and phone
    const populatedOrder = await order.populate('user', 'name email phone')
    const customer = populatedOrder.user as any

    if (!customer) {
      console.warn('[notifyOrderShipped] Order has no customer/user')
      return
    }

    const customerName = customer.name || 'Customer'
    const customerEmail = customer.email
    const orderNumber = order.orderNumber || String(order._id)

    // Always use phone from buyer's profile, decrypt if needed
    let customerPhone: string | undefined = undefined
    if (customer.phone) {
      const phoneResult = getPhoneFromUser(
        customer,
        String(customer._id),
        `Order Shipped ${orderNumber}`,
      )
      if (phoneResult.isDecryptable && phoneResult.phone) {
        customerPhone = phoneResult.phone
      } else {
        console.warn(
          `[notifyOrderShipped] Cannot decrypt customer phone from profile for order ${orderNumber}. Error: ${
            phoneResult.error || 'unknown'
          }. SMS will not be sent.`,
        )
      }
    } else {
      console.warn(
        `[notifyOrderShipped] Customer does not have a phone number in their profile for order ${orderNumber}. SMS will not be sent.`,
      )
    }

    // Generate our own tracking URL (prefer AWB, fallback to order number)
    const trackingIdentifier = getTrackingIdentifier(awb, orderNumber)
    const effectiveTrackingLink = trackingIdentifier
      ? generateTrackingUrl(trackingIdentifier)
      : trackingLink // Fallback to KourierBoyzLogistics link if no identifier available

    // Send email notification
    if (customerEmail) {
      try {
        if (effectiveTrackingLink) {
          await sendEmail(
            customerEmail,
            `Your order ${orderNumber} has been shipped! 🚚`,
            emailTemplates.orderShipped(customerName, {
              orderNumber,
              trackingLink: effectiveTrackingLink,
              awb,
              courier,
              estimatedDelivery,
            }),
          )
        } else {
          // Fallback: use generic order status update if no tracking link
          await sendEmail(
            customerEmail,
            `Your order ${orderNumber} has been shipped! 🚚`,
            emailTemplates.orderStatusUpdateBuyer(customerName, {
              orderNumber,
              statusLabel: 'Shipped',
              message:
                'Your order has been shipped and is on its way to you. Tracking details will be available soon.',
            }),
          )
        }
        console.log(`[notifyOrderShipped] Email sent to ${customerEmail} for order ${orderNumber}`)
      } catch (emailError) {
        console.error('[notifyOrderShipped] Failed to send email:', emailError)
      }
    }

    // Send SMS notification
    if (customerPhone) {
      try {
        const smsTemplate = getSmsTemplate(SmsTemplateType.ORDER_SHIPPED, {
          orderNumber,
          trackingLink: effectiveTrackingLink,
          awb,
        })
        await sendSms(customerPhone, smsTemplate.message, {
          templateId: smsTemplate.templateId || undefined,
        })
        console.log(`[notifyOrderShipped] SMS sent to ${customerPhone} for order ${orderNumber}`)
      } catch (smsError) {
        console.error('[notifyOrderShipped] Failed to send SMS:', smsError)
      }
    }
  } catch (error) {
    // Log but don't throw - notifications shouldn't break the status update
    console.error('[notifyOrderShipped] Error sending notifications:', error)
  }
}

/**
 * Send email and SMS notifications when order is delivered
 * This should be called when order status changes to 'delivered'
 */
export const notifyOrderDelivered = async (order: HydratedDocument<IOrder>) => {
  try {
    // Populate user to get customer email and phone
    const populatedOrder = await order.populate('user', 'name email phone')
    const customer = populatedOrder.user as any

    if (!customer) {
      console.warn('[notifyOrderDelivered] Order has no customer/user')
      return
    }

    const customerName = customer.name || 'Customer'
    const customerEmail = customer.email
    const orderNumber = order.orderNumber || String(order._id)

    // Always use phone from buyer's profile, decrypt if needed
    let customerPhone: string | undefined = undefined
    if (customer.phone) {
      const phoneResult = getPhoneFromUser(
        customer,
        String(customer._id),
        `Order Delivered ${orderNumber}`,
      )
      if (phoneResult.isDecryptable && phoneResult.phone) {
        customerPhone = phoneResult.phone
      } else {
        console.warn(
          `[notifyOrderDelivered] Cannot decrypt customer phone from profile for order ${orderNumber}. Error: ${
            phoneResult.error || 'unknown'
          }. SMS will not be sent.`,
        )
      }
    } else {
      console.warn(
        `[notifyOrderDelivered] Customer does not have a phone number in their profile for order ${orderNumber}. SMS will not be sent.`,
      )
    }

    // Get tracking link from first shipment (if available)
    const firstShipment = order.sellerShipments?.[0]
    const trackingLink =
      firstShipment?.shippingMeta?.tracking_link ||
      firstShipment?.kourierBoyzLogistics?.tracking_link ||
      undefined

    // Send email notification
    if (customerEmail) {
      try {
        await sendEmail(
          customerEmail,
          `Order ${orderNumber} delivered`,
          emailTemplates.orderStatusUpdateBuyer(customerName, {
            orderNumber,
            statusLabel: 'Delivered',
            message:
              'Hope you enjoy your purchase! If there are any issues, you can reach out from the Help Center.',
            trackingLink,
          }),
        )
        console.log(
          `[notifyOrderDelivered] Email sent to ${customerEmail} for order ${orderNumber}`,
        )
      } catch (emailError) {
        console.error('[notifyOrderDelivered] Failed to send email:', emailError)
      }
    }

    // Send SMS notification
    if (customerPhone) {
      try {
        const smsTemplate = getSmsTemplate(SmsTemplateType.ORDER_DELIVERED, {
          buyerName: customerName,
          orderNumber,
        })
        await sendSms(customerPhone, smsTemplate.message, {
          templateId: smsTemplate.templateId || undefined,
        })
        console.log(`[notifyOrderDelivered] SMS sent to ${customerPhone} for order ${orderNumber}`)
      } catch (smsError) {
        console.error('[notifyOrderDelivered] Failed to send SMS:', smsError)
      }
    }
  } catch (error) {
    // Log but don't throw - notifications shouldn't break the status update
    console.error('[notifyOrderDelivered] Error sending notifications:', error)
  }
}

export const filterSellerItems = (items: IOrderItem[], sellerId: string) =>
  items.filter((item) => item?.seller?.toString() === sellerId)

export const computeSellerTotals = (items: IOrderItem[]) =>
  items.reduce(
    (acc, item) => {
      const subtotal = item?.subtotal || 0
      acc.itemSubtotal += subtotal
      return acc
    },
    { itemSubtotal: 0 },
  )

export const computeSellerStatus = (items: IOrderItem[]) => {
  const statuses = items.map((item) => item.sellerStatus || 'pending')
  return deriveAggregateStatus(statuses)
}

/**
 * Check if an order can be cancelled.
 *
 * Business rule:
 * - Cancellation is only allowed **before** any AWB is generated for the order.
 * - Additionally, orders that have already moved into forward shipping statuses
 *   (shipped / in_transit / out_for_delivery / delivered) are not cancellable.
 */
export const canCancelOrder = (order: MutableOrder): { canCancel: boolean; reason?: string } => {
  // Already cancelled
  if (order.status === 'cancelled') {
    return { canCancel: false, reason: 'Order is already cancelled' }
  }

  // If a return flow has already started on this order (any non-REJECTED status),
  // do not allow cancellation. This covers cases where a customer has requested
  // a return or a reverse pickup is in progress.
  const returnStatus = (order as any).returnStatus as string | undefined
  if (returnStatus && returnStatus !== 'REJECTED') {
    return {
      canCancel: false,
      reason: 'Order cannot be cancelled once a return/refund process has started',
    }
  }

  // If any seller shipment already has an AWB (either in shippingMeta or kourierBoyzLogistics),
  // treat the order as non‑cancellable for both buyer and seller flows.
  if (Array.isArray((order as any).sellerShipments) && (order as any).sellerShipments.length > 0) {
    const hasAwb = (order as any).sellerShipments.some((shipment: any) => {
      const awbFromMeta = shipment?.shippingMeta?.awb
      const awbFromKourierBoyzLogistics = shipment?.kourierBoyzLogistics?.awb_number
      return Boolean(awbFromMeta || awbFromKourierBoyzLogistics)
    })

    if (hasAwb) {
      return {
        canCancel: false,
        reason: 'Order cannot be cancelled after AWB has been generated for shipment',
      }
    }
  }

  // Check order-level status as a safety net
  const nonCancellableOrderStatuses: OrderStatus[] = [
    'shipped',
    'in_transit',
    'out_for_delivery',
    'delivered',
  ]

  if (nonCancellableOrderStatuses.includes(order.status)) {
    return {
      canCancel: false,
      reason: 'Order cannot be cancelled after it has been shipped',
    }
  }

  // Check seller shipment statuses
  const nonCancellableShipmentStatuses: SellerShipmentStatus[] = [
    'shipped',
    'in_transit',
    'out_for_delivery',
    'delivered',
  ]

  if ((order as any).sellerShipments && (order as any).sellerShipments.length > 0) {
    const hasShippedShipment = (order as any).sellerShipments.some((shipment: any) =>
      nonCancellableShipmentStatuses.includes(shipment.status),
    )

    if (hasShippedShipment) {
      return {
        canCancel: false,
        reason: 'Order cannot be cancelled after shipment has been dispatched',
      }
    }
  }

  return { canCancel: true }
}

/**
 * Add customer to seller's customers list when order is delivered (if not returned).
 * This function checks if the order is NOT returned and adds the customer to all sellers
 * who have items in this order.
 *
 * @param order - The order that was delivered
 */
export const addCustomerToSellers = async (order: HydratedDocument<IOrder>) => {
  try {
    // Check if order is returned - if returnStatus exists and is not 'REJECTED', skip adding customer
    const returnStatus = (order as any).returnStatus as string | null | undefined
    if (returnStatus && returnStatus !== 'REJECTED') {
      // Order was returned, don't add customer to sellers
      return
    }

    const customerId = order.user
    if (!customerId) {
      return
    }

    // Get all unique sellers from the order
    const sellerIds = new Set<string>()

    // Helper function to extract seller ID from various formats
    const extractSellerId = (seller: any): string | null => {
      if (!seller) return null

      // If it's already an ObjectId
      if (seller instanceof mongoose.Types.ObjectId) {
        return seller.toString()
      }

      // If it's a populated object with _id
      if (seller._id) {
        if (seller._id instanceof mongoose.Types.ObjectId) {
          return seller._id.toString()
        }
        if (typeof seller._id === 'string' && mongoose.Types.ObjectId.isValid(seller._id)) {
          return seller._id
        }
      }

      // If it's a string ObjectId
      if (typeof seller === 'string' && mongoose.Types.ObjectId.isValid(seller)) {
        return seller
      }

      return null
    }

    // Collect sellers from sellerShipments (more reliable)
    if (order.sellerShipments && order.sellerShipments.length > 0) {
      order.sellerShipments.forEach((shipment) => {
        const sellerId = extractSellerId(shipment.seller)
        if (sellerId) {
          sellerIds.add(sellerId)
        }
      })
    }

    // Also collect from items as fallback
    if (order.items && order.items.length > 0) {
      order.items.forEach((item) => {
        const sellerId = extractSellerId(item.seller)
        if (sellerId) {
          sellerIds.add(sellerId)
        }
      })
    }

    // Add customer to each seller's customers array (using $addToSet to avoid duplicates)
    const updatePromises = Array.from(sellerIds)
      .filter((sellerId) => mongoose.Types.ObjectId.isValid(sellerId))
      .map((sellerId) =>
        User.findByIdAndUpdate(
          new mongoose.Types.ObjectId(sellerId),
          { $addToSet: { customers: customerId } },
          { new: true },
        ).catch((error) => {
          console.error(`Error adding customer ${customerId} to seller ${sellerId}:`, error)
          return null
        }),
      )

    await Promise.all(updatePromises)
  } catch (error) {
    // Log error but don't throw - this is a non-critical operation
    console.error('Error adding customer to sellers:', error)
  }
}
