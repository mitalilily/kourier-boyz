import mongoose from 'mongoose'
import Order, { type IOrder, type IOrderSellerShipment } from '../models/Order'
import SLATracking from '../models/SLATracking'
import { calculateOrderTATInfo } from './tatCalculations'
import {
  createOrUpdateSLATracking,
  resolveSLATracking,
  getResolvedReason,
  isSLAEligibleStatus,
} from '../services/slaReminder.service'

/**
 * Check and create/update SLA tracking for an order
 * Called after order or shipment status changes
 */
export async function updateSLATrackingForOrder(
  orderId: mongoose.Types.ObjectId,
): Promise<void> {
  try {
    const order = await Order.findById(orderId).lean()
    if (!order) {
      return
    }

    // Process each seller shipment
    for (const sellerShipment of order.sellerShipments || []) {
      const tatInfo = await calculateOrderTATInfo(order as any, sellerShipment as any)

      // Handle AWB SLA
      if (tatInfo.currentStage === 'pending_awb' && tatInfo.awbTAT) {
        const startTime = tatInfo.acceptedAt || order.createdAt
        const dueTime = tatInfo.awbTAT.deadline

        // Check if still eligible
        if (isSLAEligibleStatus(order.status, 'AWB', sellerShipment.status)) {
          await createOrUpdateSLATracking(
            order as any,
            sellerShipment as any,
            'AWB',
            startTime,
            dueTime,
          )
        }
      }

      // Handle Dispatch SLA (only if AWB is generated)
      if (tatInfo.currentStage === 'pending_pickup' && tatInfo.pickupTAT) {
        const awbGeneratedAt = tatInfo.awbTAT
          ? new Date(tatInfo.acceptedAt?.getTime() || order.createdAt.getTime())
          : null

        if (awbGeneratedAt) {
          const startTime = awbGeneratedAt
          const dueTime = tatInfo.pickupTAT.deadline

          // Check if still eligible
          if (isSLAEligibleStatus(order.status, 'DISPATCH', sellerShipment.status)) {
            await createOrUpdateSLATracking(
              order as any,
              sellerShipment as any,
              'DISPATCH',
              startTime,
              dueTime,
            )
          }
        }
      }

      // Check and resolve existing SLAs that are no longer eligible
      const activeSLAs = await SLATracking.find({
        orderId: order._id,
        sellerId: sellerShipment.seller,
        status: 'ACTIVE',
      })

      for (const sla of activeSLAs) {
        const isEligible = isSLAEligibleStatus(order.status, sla.slaType, sellerShipment.status)
        if (!isEligible) {
          const resolvedReason = getResolvedReason(
            order.status,
            sla.slaType,
            sellerShipment.status,
          )
          if (resolvedReason) {
            await resolveSLATracking(sla, resolvedReason)
          }
        }
      }
    }
  } catch (error: any) {
    console.error('Error updating SLA tracking for order:', error)
    // Don't throw - this is a background operation
  }
}

/**
 * Mark SLA as breached if deadline has passed
 */
export async function checkAndMarkBreachedSLAs(): Promise<void> {
  try {
    const now = new Date()
    const { markSLABreached } = await import('../services/slaReminder.service')

    const activeSLAs = await SLATracking.find({
      status: 'ACTIVE',
      dueTime: { $lt: now },
      breachedAt: null,
    })

    for (const sla of activeSLAs) {
      await markSLABreached(sla, now)
    }
  } catch (error: any) {
    console.error('Error checking breached SLAs:', error)
  }
}

