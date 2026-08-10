import mongoose from 'mongoose'
import type { IOrder, IOrderSellerShipment } from '../models/Order'
import type { IShipment } from '../models/Shipment'
import SLASettings from '../models/SLASettings'

export interface TATStatus {
  stage: 'acceptance' | 'awb' | 'pickup'
  pendingSinceHours: number
  deadline: Date
  slaStatus: 'within_tat' | 'breached'
  tatHours: number
}

export interface OrderTATInfo {
  orderId: mongoose.Types.ObjectId
  orderNumber?: string
  sellerId: mongoose.Types.ObjectId
  sellerName?: string
  createdAt: Date
  acceptedAt?: Date
  acceptanceTAT?: TATStatus
  awbTAT?: TATStatus
  pickupTAT?: TATStatus
  currentStage: 'pending_acceptance' | 'pending_awb' | 'pending_pickup' | 'completed'
}

/**
 * Get SLA settings with seller-specific override if available
 */
export async function getSLASettingsForSeller(
  sellerId?: mongoose.Types.ObjectId,
): Promise<{ awbGenerationTatHours: number; dispatchTatHours: number }> {
  const settings = await SLASettings.getSingleton()

  // Check for seller-specific override
  if (sellerId && settings.sellerOverrides && settings.sellerOverrides.length > 0) {
    const override = settings.sellerOverrides.find(
      (o) => o.sellerId.toString() === sellerId.toString(),
    )
    if (override) {
      return {
        awbGenerationTatHours: override.awbGenerationTatHours ?? settings.awbGenerationTatHours,
        dispatchTatHours: override.dispatchTatHours ?? settings.dispatchTatHours,
      }
    }
  }

  return {
    awbGenerationTatHours: settings.awbGenerationTatHours,
    dispatchTatHours: settings.dispatchTatHours,
  }
}

/**
 * Calculate TAT deadline from a start date
 */
export function calculateTATDeadline(startDate: Date, tatHours: number): Date {
  return new Date(startDate.getTime() + tatHours * 60 * 60 * 1000)
}

/**
 * Calculate hours between two dates
 */
export function calculateHoursBetween(startDate: Date, endDate: Date): number {
  return (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60)
}

/**
 * Check if a deadline has been breached
 */
export function isTATBreached(deadline: Date, currentTime: Date = new Date()): boolean {
  return currentTime > deadline
}

/**
 * Calculate TAT status for a given stage
 */
export function calculateTATStatus(
  startDate: Date,
  tatHours: number,
  completedAt?: Date,
  currentTime: Date = new Date(),
): TATStatus {
  const deadline = calculateTATDeadline(startDate, tatHours)
  const pendingSinceHours = completedAt
    ? calculateHoursBetween(startDate, completedAt)
    : calculateHoursBetween(startDate, currentTime)
  const slaStatus = completedAt
    ? isTATBreached(deadline, completedAt)
      ? 'breached'
      : 'within_tat'
    : isTATBreached(deadline, currentTime)
    ? 'breached'
    : 'within_tat'

  return {
    stage: 'awb', // This will be set by caller
    pendingSinceHours: Math.max(0, pendingSinceHours),
    deadline,
    slaStatus,
    tatHours,
  }
}

/**
 * Get AWB generation timestamp from shipment
 * Checks both courierCart.awb_number and shippingMeta.awb
 */
export function getAWBGeneratedAt(shipment: IShipment | IOrderSellerShipment): Date | null {
  // Check if AWB exists in courierCart
  if ('courierCart' in shipment && shipment.courierCart?.awb_number) {
    // If shipment has createdAt and AWB exists, use createdAt as proxy
    // In a real system, you might want to track awbGeneratedAt separately
    if ('createdAt' in shipment && shipment.createdAt) {
      return shipment.createdAt
    }
  }

  // Check shippingMeta
  if ('shippingMeta' in shipment && shipment.shippingMeta?.awb) {
    if ('createdAt' in shipment && shipment.createdAt) {
      return shipment.createdAt
    }
  }

  return null
}

/**
 * Get pickup completed timestamp
 * This is when status changes to 'pickup_requested' or 'shipped'
 */
export function getPickupCompletedAt(shipment: IShipment | IOrderSellerShipment): Date | null {
  // Check if status indicates pickup is completed
  if (shipment.status === 'pickup_requested' || shipment.status === 'shipped') {
    // Use shippedAt if available, otherwise use updatedAt or createdAt
    if ('shippedAt' in shipment && shipment.shippedAt) {
      return shipment.shippedAt
    }
    if ('updatedAt' in shipment && shipment.updatedAt) {
      return shipment.updatedAt
    }
    if ('createdAt' in shipment && shipment.createdAt) {
      return shipment.createdAt
    }
  }

  return null
}

/**
 * Calculate comprehensive TAT information for an order
 */
export async function calculateOrderTATInfo(
  order: IOrder,
  sellerShipment?: IOrderSellerShipment,
): Promise<OrderTATInfo> {
  const now = new Date()
  const sellerId = sellerShipment?.seller || order.items[0]?.seller
  const slaSettings = await getSLASettingsForSeller(sellerId)

  // Determine if order is accepted
  // Order is considered accepted when:
  // 1. Order status is NOT 'pending' (confirmed, processing, ready_to_ship, etc.)
  // 2. OR sellerShipment status is 'processing' or beyond (even if order status is still pending/confirmed)
  // This handles cases where seller has started processing but order status hasn't updated yet
  const orderStatusAccepted = order.status !== 'pending'
  const shipmentStatusAccepted =
    sellerShipment?.status &&
    [
      'processing',
      'ready_to_ship',
      'pickup_requested',
      'shipped',
      'in_transit',
      'out_for_delivery',
      'delivered',
    ].includes(sellerShipment.status)
  const isAccepted = orderStatusAccepted || shipmentStatusAccepted

  // For accepted orders, we need to find when the status changed from 'pending'
  // Since we don't have an explicit acceptedAt field, we use updatedAt when status changed
  // or check sellerShipment status change to 'processing' or beyond
  let acceptedAt: Date | undefined = undefined

  if (isAccepted) {
    // Priority 1: If seller shipment exists and is in processing or beyond, use its updatedAt or createdAt
    // This is the most accurate timestamp for when seller actually accepted/started processing
    if (shipmentStatusAccepted) {
      acceptedAt = sellerShipment.updatedAt || sellerShipment.createdAt || order.updatedAt
    }
    // Priority 2: If order status is processing/confirmed, use order updatedAt
    else if (order.status === 'processing' || order.status === 'confirmed') {
      acceptedAt = order.updatedAt
    }
    // Priority 3: If order status is ready_to_ship, use readyToShipAt or updatedAt
    else if (order.status === 'ready_to_ship') {
      acceptedAt = sellerShipment?.readyToShipAt || order.updatedAt
    }
    // Priority 4: For shipped/delivered, use shippedAt or updatedAt
    else if (order.status === 'shipped' || order.status === 'delivered') {
      acceptedAt = sellerShipment?.shippedAt || order.updatedAt
    }
    // Fallback: use order updatedAt or createdAt
    if (!acceptedAt) {
      acceptedAt = order.updatedAt || order.createdAt
    }
  }

  // Calculate acceptance TAT (from order creation until marked as processing)
  // This tracks how long the order has been waiting for seller to accept (mark as processing)
  const acceptanceTAT: TATStatus | undefined = !isAccepted
    ? {
        stage: 'acceptance',
        pendingSinceHours: calculateHoursBetween(order.createdAt, now),
        deadline: calculateTATDeadline(order.createdAt, slaSettings.awbGenerationTatHours),
        slaStatus: isTATBreached(
          calculateTATDeadline(order.createdAt, slaSettings.awbGenerationTatHours),
          now,
        )
          ? 'breached'
          : 'within_tat',
        tatHours: slaSettings.awbGenerationTatHours,
      }
    : undefined

  // Calculate AWB TAT (from order acceptance/creation)
  const awbGeneratedAt = sellerShipment ? getAWBGeneratedAt(sellerShipment) : null
  const awbTAT: TATStatus | undefined =
    !awbGeneratedAt && isAccepted
      ? {
          stage: 'awb',
          pendingSinceHours: calculateHoursBetween(acceptedAt || order.createdAt, now),
          deadline: calculateTATDeadline(
            acceptedAt || order.createdAt,
            slaSettings.awbGenerationTatHours,
          ),
          slaStatus: isTATBreached(
            calculateTATDeadline(acceptedAt || order.createdAt, slaSettings.awbGenerationTatHours),
            now,
          )
            ? 'breached'
            : 'within_tat',
          tatHours: slaSettings.awbGenerationTatHours,
        }
      : undefined

  // Calculate pickup TAT (from AWB generation)
  const pickupCompletedAt = sellerShipment ? getPickupCompletedAt(sellerShipment) : null
  const pickupTAT: TATStatus | undefined =
    awbGeneratedAt && !pickupCompletedAt
      ? {
          stage: 'pickup',
          pendingSinceHours: calculateHoursBetween(awbGeneratedAt, now),
          deadline: calculateTATDeadline(awbGeneratedAt, slaSettings.dispatchTatHours),
          slaStatus: isTATBreached(
            calculateTATDeadline(awbGeneratedAt, slaSettings.dispatchTatHours),
            now,
          )
            ? 'breached'
            : 'within_tat',
          tatHours: slaSettings.dispatchTatHours,
        }
      : undefined

  // Determine current stage based on order and shipment status
  // Priority: Check shipment status first (more accurate), then order status
  let currentStage: OrderTATInfo['currentStage'] = 'completed'

  if (!isAccepted) {
    // Order is not accepted yet - waiting for seller acceptance
    // This means both order.status is 'pending' AND sellerShipment is not in processing or beyond
    currentStage = 'pending_acceptance'
  } else {
    // Order is accepted - determine which stage it's pending at
    // Check shipment status first (more accurate indicator of actual progress)
    const shipmentStatus = sellerShipment?.status

    if (shipmentStatus === 'ready_to_ship' || order.status === 'ready_to_ship') {
      // Order is ready to ship - check if AWB is generated
      if (!awbGeneratedAt) {
        currentStage = 'pending_awb'
      } else if (!pickupCompletedAt) {
        currentStage = 'pending_pickup'
      } else {
        currentStage = 'completed'
      }
    } else if (
      shipmentStatus === 'processing' ||
      order.status === 'processing' ||
      order.status === 'confirmed'
    ) {
      // Order is in processing/confirmed - check if AWB is generated
      if (!awbGeneratedAt) {
        currentStage = 'pending_awb'
      } else if (!pickupCompletedAt) {
        currentStage = 'pending_pickup'
      } else {
        currentStage = 'completed'
      }
    } else if (awbGeneratedAt && !pickupCompletedAt) {
      // AWB generated but pickup not completed
      currentStage = 'pending_pickup'
    } else if (!awbGeneratedAt) {
      // Order is accepted but AWB not generated yet
      currentStage = 'pending_awb'
    } else {
      // Pickup completed or order shipped/delivered
      currentStage = 'completed'
    }
  }

  return {
    orderId: order._id as mongoose.Types.ObjectId,
    orderNumber: order.orderNumber,
    sellerId: sellerId || new mongoose.Types.ObjectId(),
    sellerName:
      sellerShipment?.sellerSnapshot?.businessName || sellerShipment?.sellerSnapshot?.name,
    createdAt: order.createdAt,
    acceptedAt,
    acceptanceTAT,
    awbTAT,
    pickupTAT,
    currentStage,
  }
}
