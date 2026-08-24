import { Request, Response } from 'express'
import mongoose from 'mongoose'
import SLATracking from '../models/SLATracking'
import SLAAuditLog from '../models/SLAAuditLog'
import Order from '../models/Order'
import User from '../models/User'
import {
  sendReminder,
  processAutomaticReminders,
  checkAndResolveSLAs,
  createOrUpdateSLATracking,
  markSLABreached,
} from '../services/slaReminder.service'
import { calculateOrderTATInfo } from '../utils/tatCalculations'

/**
 * Get all breached SLAs (for admin)
 */
export const getBreachedSLAs = async (req: Request, res: Response) => {
  try {
    const {
      seller,
      slaType,
      status,
      fromDate,
      toDate,
      page = '1',
      limit = '50',
    } = req.query as {
      seller?: string
      slaType?: 'AWB' | 'DISPATCH'
      status?: 'ACTIVE' | 'RESOLVED'
      fromDate?: string
      toDate?: string
      page?: string
      limit?: string
    }

    const query: any = {
      status: status || 'ACTIVE', // Default to active, but can filter by resolved
    }

    // Filter by seller
    if (seller) {
      query.sellerId = new mongoose.Types.ObjectId(seller)
    }

    // Filter by SLA type
    if (slaType) {
      query.slaType = slaType
    }

    // Filter by date range (based on dueTime)
    if (fromDate || toDate) {
      query.dueTime = {}
      if (fromDate) {
        query.dueTime.$gte = new Date(fromDate)
      }
      if (toDate) {
        query.dueTime.$lte = new Date(toDate)
      }
    }

    // For active SLAs, only show breached ones
    if (query.status === 'ACTIVE') {
      query.dueTime = query.dueTime || {}
      query.dueTime.$lt = new Date()
    }

    const pageNum = parseInt(page, 10)
    const limitNum = parseInt(limit, 10)
    const skip = (pageNum - 1) * limitNum

    const [slas, total] = await Promise.all([
      SLATracking.find(query)
        .populate('sellerId', 'name businessName email')
        .populate('orderId', 'orderNumber status')
        .sort({ dueTime: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      SLATracking.countDocuments(query),
    ])

    // Calculate breach duration for each SLA
    const now = new Date()
    const rows = slas.map((sla) => {
      const breachDuration =
        sla.status === 'ACTIVE' && sla.dueTime < now
          ? (now.getTime() - sla.dueTime.getTime()) / (1000 * 60 * 60) // hours
          : sla.resolvedAt && sla.breachedAt
          ? (sla.resolvedAt.getTime() - sla.breachedAt.getTime()) / (1000 * 60 * 60)
          : 0

      return {
        _id: sla._id,
        orderId: sla.orderId,
        orderNumber: sla.orderNumber,
        sellerId: sla.sellerId,
        sellerName: sla.sellerName || (sla.sellerId as any)?.businessName || (sla.sellerId as any)?.name,
        slaType: sla.slaType,
        status: sla.status,
        startTime: sla.startTime,
        dueTime: sla.dueTime,
        breachedAt: sla.breachedAt,
        breachDuration: Math.round(breachDuration * 100) / 100, // Round to 2 decimals
        reminderCount: sla.reminderCount,
        lastReminderSentAt: sla.reminderSentAt[sla.reminderSentAt.length - 1] || null,
        lastReminderType: sla.lastReminderType,
        lastReminderSentBy: sla.lastReminderSentBy,
        currentOrderStatus: sla.currentOrderStatus,
        currentShipmentStatus: sla.currentShipmentStatus,
        resolvedAt: sla.resolvedAt,
        resolvedReason: sla.resolvedReason,
      }
    })

    res.json({
      success: true,
      data: {
        rows,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      },
    })
  } catch (error: any) {
    console.error('Error fetching breached SLAs:', error)
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch breached SLAs',
    })
  }
}

/**
 * Get SLA tracking by order and seller
 */
export const getSLATrackingByOrder = async (req: Request, res: Response) => {
  try {
    const { orderId, sellerId, slaType } = req.query as {
      orderId: string
      sellerId: string
      slaType?: 'AWB' | 'DISPATCH'
    }

    if (!orderId || !sellerId) {
      return res.status(400).json({
        success: false,
        message: 'Order ID and Seller ID are required',
      })
    }

    const query: any = {
      orderId: new mongoose.Types.ObjectId(orderId),
      sellerId: new mongoose.Types.ObjectId(sellerId),
      status: 'ACTIVE',
    }

    if (slaType) {
      query.slaType = slaType
    }

    const slaTracking = await SLATracking.findOne(query).lean()

    if (!slaTracking) {
      return res.status(404).json({
        success: false,
        message: 'No active SLA tracking found for this order and seller',
      })
    }

    res.json({
      success: true,
      data: slaTracking,
    })
  } catch (error: any) {
    console.error('Error fetching SLA tracking:', error)
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch SLA tracking',
    })
  }
}

/**
 * Send manual reminder (admin)
 */
export const sendManualReminder = async (req: Request, res: Response) => {
  try {
    const { slaTrackingId, orderId, sellerId, slaType, customMessage } = req.body as {
      slaTrackingId?: string
      orderId?: string
      sellerId?: string
      slaType?: 'AWB' | 'DISPATCH'
      customMessage?: string
    }

    let trackingId: mongoose.Types.ObjectId

    // If slaTrackingId is provided, use it directly
    if (slaTrackingId) {
      trackingId = new mongoose.Types.ObjectId(slaTrackingId)
    } else if (orderId && sellerId) {
      // Optimized: Parallel queries and single TAT calculation
      const [order, existingTracking] = await Promise.all([
        Order.findById(orderId).lean(),
        SLATracking.findOne({
          orderId: new mongoose.Types.ObjectId(orderId),
          sellerId: new mongoose.Types.ObjectId(sellerId),
          status: 'ACTIVE',
          ...(slaType ? { slaType } : {}),
        }),
      ])

      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Order not found',
        })
      }

      // Find seller shipment
      const sellerShipment = order.sellerShipments.find(
        (s) => s.seller.toString() === sellerId,
      )

      if (!sellerShipment) {
        return res.status(404).json({
          success: false,
          message: 'Seller shipment not found for this order',
        })
      }

      let slaTracking = existingTracking

      // If not found, create it (only if needed)
      if (!slaTracking) {
        // Determine SLA type if not provided - quick check without full TAT calculation
        let determinedSlaType: 'AWB' | 'DISPATCH' = slaType || 'AWB'
        if (!slaType) {
          // Quick heuristic check
          const hasAWB =
            sellerShipment.shippingMeta?.awb ||
            sellerShipment.kourierBoyzLogistics?.awb_number
          const isShipped = ['shipped', 'in_transit', 'out_for_delivery', 'delivered'].includes(
            sellerShipment.status || '',
          )

          if (hasAWB && !isShipped) {
            determinedSlaType = 'DISPATCH'
          } else if (!hasAWB) {
            determinedSlaType = 'AWB'
          }

          // Check if tracking exists with determined type
          slaTracking = await SLATracking.findOne({
            orderId: new mongoose.Types.ObjectId(orderId),
            sellerId: new mongoose.Types.ObjectId(sellerId),
            slaType: determinedSlaType,
            status: 'ACTIVE',
          })
        }

        // If still not found, create it
        if (!slaTracking) {
          const { createOrUpdateSLATracking } = await import('../services/slaReminder.service')
          const { calculateOrderTATInfo } = await import('../utils/tatCalculations')
          const tatInfo = await calculateOrderTATInfo(order as any, sellerShipment as any)

          // Determine start time and due time based on SLA type
          let startTime: Date
          let dueTime: Date

          if (determinedSlaType === 'AWB') {
            const relevantTAT = tatInfo.awbTAT || tatInfo.acceptanceTAT
            if (!relevantTAT) {
              return res.status(400).json({
                success: false,
                message: 'Cannot determine AWB SLA deadline for this order',
              })
            }
            startTime = tatInfo.acceptedAt || order.createdAt
            dueTime = relevantTAT.deadline
          } else {
            // DISPATCH
            const relevantTAT = tatInfo.pickupTAT
            if (!relevantTAT) {
              return res.status(400).json({
                success: false,
                message: 'Cannot determine Dispatch SLA deadline for this order',
              })
            }
            const awbGeneratedAt = tatInfo.awbTAT
              ? new Date(tatInfo.acceptedAt?.getTime() || order.createdAt.getTime())
              : null
            if (!awbGeneratedAt) {
              return res.status(400).json({
                success: false,
                message: 'AWB must be generated before Dispatch SLA can be tracked',
              })
            }
            startTime = awbGeneratedAt
            dueTime = relevantTAT.deadline
          }

          const createdTracking = await createOrUpdateSLATracking(
            order as any,
            sellerShipment as any,
            determinedSlaType,
            startTime,
            dueTime,
          )
          // Fetch the created tracking to get the full document
          slaTracking = await SLATracking.findById(createdTracking._id)
          if (!slaTracking) {
            return res.status(500).json({
              success: false,
              message: 'Failed to create SLA tracking',
            })
          }
        }
      }

      trackingId = slaTracking._id as mongoose.Types.ObjectId
    } else {
      return res.status(400).json({
        success: false,
        message: 'Either SLA tracking ID or (Order ID + Seller ID) is required',
      })
    }

    // Get admin user ID from request (assuming it's set by auth middleware)
    const adminId = (req as any).user?.id || 'ADMIN'

    const result = await sendReminder(trackingId, 'MANUAL', adminId, customMessage)

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error || 'Failed to send reminder',
      })
    }

    res.json({
      success: true,
      message: 'Reminder sent successfully',
    })
  } catch (error: any) {
    console.error('Error sending manual reminder:', error)
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to send reminder',
    })
  }
}

/**
 * Get SLA breach report (admin)
 */
export const getSLABreachReport = async (req: Request, res: Response) => {
  try {
    const {
      seller,
      slaType,
      status,
      fromDate,
      toDate,
    } = req.query as {
      seller?: string
      slaType?: 'AWB' | 'DISPATCH'
      status?: 'ACTIVE' | 'RESOLVED'
      fromDate?: string
      toDate?: string
    }

    const query: any = {}

    if (seller) {
      query.sellerId = new mongoose.Types.ObjectId(seller)
    }

    if (slaType) {
      query.slaType = slaType
    }

    if (status) {
      query.status = status
    }

    if (fromDate || toDate) {
      query.dueTime = {}
      if (fromDate) {
        query.dueTime.$gte = new Date(fromDate)
      }
      if (toDate) {
        query.dueTime.$lte = new Date(toDate)
      }
    }

    const slas = await SLATracking.find(query)
      .populate('sellerId', 'name businessName email')
      .populate('orderId', 'orderNumber status')
      .sort({ dueTime: -1 })
      .lean()

    const now = new Date()
    const rows = slas.map((sla) => {
      const breachDuration =
        sla.status === 'ACTIVE' && sla.dueTime < now
          ? (now.getTime() - sla.dueTime.getTime()) / (1000 * 60 * 60)
          : sla.resolvedAt && sla.breachedAt
          ? (sla.resolvedAt.getTime() - sla.breachedAt.getTime()) / (1000 * 60 * 60)
          : 0

      return {
        orderId: sla.orderId,
        orderNumber: sla.orderNumber,
        seller: sla.sellerName || (sla.sellerId as any)?.businessName || (sla.sellerId as any)?.name,
        sellerId: sla.sellerId,
        slaType: sla.slaType,
        slaDueTime: sla.dueTime,
        breachDuration: Math.round(breachDuration * 100) / 100,
        reminderCount: sla.reminderCount,
        lastReminderDate: sla.reminderSentAt[sla.reminderSentAt.length - 1] || null,
        currentOrderStatus: sla.currentOrderStatus,
        currentShipmentStatus: sla.currentShipmentStatus,
        slaStatus: sla.status,
        resolvedAt: sla.resolvedAt,
        resolvedReason: sla.resolvedReason,
      }
    })

    res.json({
      success: true,
      data: {
        rows,
        summary: {
          total: rows.length,
          active: rows.filter((r) => r.slaStatus === 'ACTIVE').length,
          resolved: rows.filter((r) => r.slaStatus === 'RESOLVED').length,
          withReminders: rows.filter((r) => r.reminderCount > 0).length,
        },
      },
    })
  } catch (error: any) {
    console.error('Error generating SLA breach report:', error)
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate SLA breach report',
    })
  }
}

/**
 * Get seller SLA report (seller view)
 */
export const getSellerSLAReport = async (req: Request, res: Response) => {
  try {
    const sellerId = (req as any).user?.id
    if (!sellerId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      })
    }

    const {
      slaType,
      status,
      fromDate,
      toDate,
    } = req.query as {
      slaType?: 'AWB' | 'DISPATCH'
      status?: 'ACTIVE' | 'RESOLVED'
      fromDate?: string
      toDate?: string
    }

    const query: any = {
      sellerId: new mongoose.Types.ObjectId(sellerId),
    }

    if (slaType) {
      query.slaType = slaType
    }

    if (status) {
      query.status = status
    }

    if (fromDate || toDate) {
      query.dueTime = {}
      if (fromDate) {
        query.dueTime.$gte = new Date(fromDate)
      }
      if (toDate) {
        query.dueTime.$lte = new Date(toDate)
      }
    }

    const slas = await SLATracking.find(query)
      .populate('orderId', 'orderNumber status')
      .sort({ dueTime: -1 })
      .lean()

    const now = new Date()
    const rows = slas.map((sla) => {
      const breachDuration =
        sla.status === 'ACTIVE' && sla.dueTime < now
          ? (now.getTime() - sla.dueTime.getTime()) / (1000 * 60 * 60)
          : sla.resolvedAt && sla.breachedAt
          ? (sla.resolvedAt.getTime() - sla.breachedAt.getTime()) / (1000 * 60 * 60)
          : 0

      return {
        orderId: sla.orderId,
        orderNumber: sla.orderNumber,
        slaType: sla.slaType,
        slaDueTime: sla.dueTime,
        breachDuration: Math.round(breachDuration * 100) / 100,
        reminderCount: sla.reminderCount,
        lastReminderDate: sla.reminderSentAt[sla.reminderSentAt.length - 1] || null,
        currentOrderStatus: sla.currentOrderStatus,
        currentShipmentStatus: sla.currentShipmentStatus,
        slaStatus: sla.status,
        resolvedAt: sla.resolvedAt,
        resolvedReason: sla.resolvedReason,
      }
    })

    res.json({
      success: true,
      data: {
        rows,
        summary: {
          total: rows.length,
          active: rows.filter((r) => r.slaStatus === 'ACTIVE').length,
          resolved: rows.filter((r) => r.slaStatus === 'RESOLVED').length,
          withReminders: rows.filter((r) => r.reminderCount > 0).length,
        },
      },
    })
  } catch (error: any) {
    console.error('Error generating seller SLA report:', error)
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate seller SLA report',
    })
  }
}

/**
 * Get SLA audit log
 */
export const getSLAAuditLog = async (req: Request, res: Response) => {
  try {
    const {
      orderId,
      sellerId,
      slaType,
      eventType,
      fromDate,
      toDate,
      page = '1',
      limit = '50',
    } = req.query as {
      orderId?: string
      sellerId?: string
      slaType?: 'AWB' | 'DISPATCH'
      eventType?: 'SLA_STARTED' | 'SLA_BREACHED' | 'SLA_REMINDER_SENT' | 'SLA_RESOLVED'
      fromDate?: string
      toDate?: string
      page?: string
      limit?: string
    }

    const query: any = {}

    if (orderId) {
      query.orderId = new mongoose.Types.ObjectId(orderId)
    }

    if (sellerId) {
      query.sellerId = new mongoose.Types.ObjectId(sellerId)
    }

    if (slaType) {
      query.slaType = slaType
    }

    if (eventType) {
      query.eventType = eventType
    }

    if (fromDate || toDate) {
      query.timestamp = {}
      if (fromDate) {
        query.timestamp.$gte = new Date(fromDate)
      }
      if (toDate) {
        query.timestamp.$lte = new Date(toDate)
      }
    }

    const pageNum = parseInt(page, 10)
    const limitNum = parseInt(limit, 10)
    const skip = (pageNum - 1) * limitNum

    const [logs, total] = await Promise.all([
      SLAAuditLog.find(query)
        .populate('orderId', 'orderNumber')
        .populate('sellerId', 'name businessName')
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      SLAAuditLog.countDocuments(query),
    ])

    res.json({
      success: true,
      data: {
        rows: logs,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      },
    })
  } catch (error: any) {
    console.error('Error fetching SLA audit log:', error)
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch SLA audit log',
    })
  }
}

/**
 * Trigger automatic reminder processing (admin/manual trigger)
 */
export const triggerAutomaticReminders = async (req: Request, res: Response) => {
  try {
    const results = await processAutomaticReminders()

    res.json({
      success: true,
      data: results,
      message: `Processed ${results.processed} SLAs, sent ${results.sent} reminders, skipped ${results.skipped}`,
    })
  } catch (error: any) {
    console.error('Error processing automatic reminders:', error)
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to process automatic reminders',
    })
  }
}

/**
 * Trigger SLA resolution check (admin/manual trigger)
 */
export const triggerSLAResolutionCheck = async (req: Request, res: Response) => {
  try {
    const results = await checkAndResolveSLAs()

    res.json({
      success: true,
      data: results,
      message: `Checked ${results.checked} SLAs, resolved ${results.resolved}`,
    })
  } catch (error: any) {
    console.error('Error checking SLA resolution:', error)
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to check SLA resolution',
    })
  }
}

