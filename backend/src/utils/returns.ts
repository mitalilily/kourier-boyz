import mongoose from 'mongoose'
import Order, { IOrder, IOrderItem } from '../models/Order'
import Return, { IReturn, IReturnTimelineEntry, ReturnStatus } from '../models/Return'

export const RETURN_WINDOW_FALLBACK_DAYS = 7

export const appendReturnTimeline = (
  ret: IReturn,
  status: ReturnStatus,
  message?: string,
  at?: Date,
): void => {
  const entry: IReturnTimelineEntry = {
    status,
    message,
    timestamp: at || new Date(),
  }
  ret.timeline = Array.isArray(ret.timeline) ? [...ret.timeline, entry] : [entry]
}

export const isOrderItemReturnEligible = (order: IOrder, item: IOrderItem): boolean => {
  if (!order || !item) return false
  if (order.status !== 'delivered') return false

  const product: any = (item as any).product
  if (!product || product.returnable !== true) {
    return false
  }

  const maxProductReturnDays =
    typeof product.returnDays === 'number' && product.returnDays > 0
      ? product.returnDays
      : RETURN_WINDOW_FALLBACK_DAYS

  // Determine deliveredAt based on seller shipment for this seller, falling back to order.updatedAt
  let deliveredAt: Date | null = null
  if (Array.isArray(order.sellerShipments)) {
    order.sellerShipments.forEach((shipment: any) => {
      if (shipment?.seller?.toString() === (item.seller as any)?.toString() && shipment.deliveredAt) {
        const d = new Date(shipment.deliveredAt)
        if (!Number.isNaN(d.getTime())) {
          if (!deliveredAt || d > deliveredAt) {
            deliveredAt = d
          }
        }
      }
    })
  }

  if (!deliveredAt && (order as any).updatedAt) {
    const d = new Date((order as any).updatedAt)
    if (!Number.isNaN(d.getTime())) {
      deliveredAt = d
    }
  }

  if (!deliveredAt) return false

  const now = new Date()
  const diffMs = now.getTime() - deliveredAt.getTime()
  const diffDays = diffMs / (1000 * 60 * 60 * 24)

  return diffDays <= maxProductReturnDays
}

export const markOrderReturnFlags = async (
  orderId: mongoose.Types.ObjectId,
  status: ReturnStatus,
): Promise<void> => {
  const order = await Order.findById(orderId)
  if (!order) return

  // Ensure all order items have required fields before saving
  // This prevents validation errors when items are missing priceWithoutTax or effectivePrice
  if (order.items && Array.isArray(order.items)) {
    for (const item of order.items) {
      const itemAny = item as any
      // If priceWithoutTax is missing, calculate it from effectivePrice or use price
      if (itemAny.priceWithoutTax === undefined || itemAny.priceWithoutTax === null) {
        const effectivePrice = itemAny.effectivePrice ?? itemAny.price ?? 0
        const gstRatePercent = itemAny.gstRatePercent ?? 0
        if (gstRatePercent > 0) {
          itemAny.priceWithoutTax = effectivePrice / (1 + gstRatePercent / 100)
        } else {
          itemAny.priceWithoutTax = effectivePrice
        }
        itemAny.priceWithoutTax = Math.round(itemAny.priceWithoutTax * 100) / 100
      }
      // If effectivePrice is missing, use price or calculate from priceWithoutTax
      if (itemAny.effectivePrice === undefined || itemAny.effectivePrice === null) {
        if (itemAny.priceWithoutTax !== undefined && itemAny.priceWithoutTax !== null) {
          const gstRatePercent = itemAny.gstRatePercent ?? 0
          itemAny.effectivePrice = itemAny.priceWithoutTax * (1 + gstRatePercent / 100)
        } else {
          itemAny.effectivePrice = itemAny.price ?? 0
        }
        itemAny.effectivePrice = Math.round(itemAny.effectivePrice * 100) / 100
      }
    }
  }

  // If a return was rejected, allow the customer to raise a fresh request
  if (status === 'REJECTED') {
    ;(order as any).returnRequested = false
  } else {
    ;(order as any).returnRequested = true
  }
  ;(order as any).returnStatus = status

  // Mark original order with replacement status for UI display
  // This allows sellers/customers to see "Replacement in Progress" badge
  // Status values can be: REQUESTED, APPROVED, REVERSE_PICKUP_CREATED, RETURN_RECEIVED_BY_SELLER, etc.

  // Optionally compute and persist isReturnEligible snapshot
  try {
    const anyEligible = (order.items || []).some((item: any) => isOrderItemReturnEligible(order, item))
    ;(order as any).isReturnEligible = anyEligible
  } catch {
    // ignore eligibility errors
  }

  await order.save()
}

export const syncOrderReturnStatusFromReturn = async (ret: IReturn): Promise<void> => {
  if (!ret?.order) return
  await markOrderReturnFlags(ret.order as mongoose.Types.ObjectId, ret.status)
}

export const loadReturnWithOrder = async (returnId: string) => {
  if (!mongoose.Types.ObjectId.isValid(returnId)) return null
  const ret = await Return.findById(returnId)
  if (!ret) return null
  const order = await Order.findById(ret.order)
  return { ret, order }
}


