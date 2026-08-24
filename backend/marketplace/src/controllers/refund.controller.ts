import { Request, Response } from 'express'
import mongoose from 'mongoose'
import Order from '../models/Order'
import RefundRequest from '../models/RefundRequest'
import Return from '../models/Return'
import SellerLedgerEntry from '../models/SellerLedgerEntry'
import User from '../models/User'
import { checkUserAccess } from '../utils/checkUserAccess'
import { emailTemplates, sendEmail } from '../utils/email'

/**
 * Admin: List all refund requests with filters
 */
export const listRefundRequests = async (req: Request, res: Response) => {
  try {
    const admin = await checkUserAccess(req, res, ['super-admin'])
    if (!admin) return

    const {
      status,
      refundType,
      paymentMethod,
      page = 1,
      limit = 20,
      search,
    } = req.query

    const query: any = {}

    if (status) {
      query.status = status
    }

    if (refundType) {
      query.refundType = refundType
    }

    // Filter by payment method (COD/Prepaid) via order
    if (paymentMethod) {
      // We'll need to join with orders to filter by paymentMethod
      const orders = await Order.find({
        paymentMethod: paymentMethod === 'COD' ? 'cod' : { $ne: 'cod' },
      }).select('_id')
      query.order = { $in: orders.map((o) => o._id) }
    }

    // Search by order number, customer name, or UTR
    if (search) {
      const searchRegex = new RegExp(search as string, 'i')
      const orders = await Order.find({
        $or: [
          { orderNumber: searchRegex },
          { 'shippingAddress.name': searchRegex },
        ],
      }).select('_id')
      const refundsByOrder = await RefundRequest.find({
        order: { $in: orders.map((o) => o._id) },
      }).select('_id')
      const refundsByUtr = await RefundRequest.find({
        utr: searchRegex,
      }).select('_id')

      query.$or = [
        { order: { $in: orders.map((o) => o._id) } },
        { _id: { $in: [...refundsByOrder.map((r) => r._id), ...refundsByUtr.map((r) => r._id)] } },
      ]
    }

    const skip = (Number(page) - 1) * Number(limit)

    const [refunds, total] = await Promise.all([
      RefundRequest.find(query)
        .populate('order', 'orderNumber paymentMethod total')
        .populate('replacementOrder', 'orderNumber')
        .populate('return', 'status reason')
        .populate('customer', 'name email phone')
        .populate('seller', 'name businessName')
        .populate('processedByAdmin', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      RefundRequest.countDocuments(query),
    ])

    return res.status(200).json({
      success: true,
      data: refunds,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
    })
  } catch (error: any) {
    console.error('Error listing refund requests:', error)
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to list refund requests',
    })
  }
}

/**
 * Admin: Get single refund request
 */
export const getRefundRequest = async (req: Request, res: Response) => {
  try {
    const admin = await checkUserAccess(req, res, ['super-admin'])
    if (!admin) return

    const { id } = req.params

    const refund = await RefundRequest.findById(id)
      .populate('order', 'orderNumber paymentMethod total shippingAddress')
      .populate('replacementOrder', 'orderNumber total')
      .populate('return', 'status reason timeline')
      .populate('customer', 'name email phone')
      .populate('seller', 'name businessName email')
      .populate('processedByAdmin', 'name email')

    if (!refund) {
      return res.status(404).json({
        success: false,
        message: 'Refund request not found',
      })
    }

    return res.status(200).json({
      success: true,
      data: refund,
    })
  } catch (error: any) {
    console.error('Error fetching refund request:', error)
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch refund request',
    })
  }
}

/**
 * Admin: Update refund request (UTR, status, etc.)
 */
export const updateRefundRequest = async (req: Request, res: Response) => {
  try {
    const admin = await checkUserAccess(req, res, ['super-admin'])
    if (!admin) return

    const { id } = req.params
    const { utr, status, failureReason } = req.body

    const refund = await RefundRequest.findById(id)
      .populate('order')
      .populate('customer', 'name email')

    if (!refund) {
      return res.status(404).json({
        success: false,
        message: 'Refund request not found',
      })
    }

    // Update UTR if provided
    if (utr !== undefined) {
      refund.utr = utr
    }

    // Update status if provided
    if (status && ['pending', 'processing', 'completed', 'failed'].includes(status)) {
      const oldStatus = refund.status
      refund.status = status as any

      if (status === 'completed' || status === 'processing') {
        refund.processedByAdmin = admin._id
        refund.processedAt = new Date()
      }

      if (status === 'failed' && failureReason) {
        refund.failureReason = failureReason
      }

      // If status changed to completed, create settlement adjustment
      if (oldStatus !== 'completed' && status === 'completed') {
        try {
          const order = refund.order as any
          const sellerId = refund.seller

          // Create settlement adjustment ledger entry using canonical refund reason
          const adjustmentEntry = new SellerLedgerEntry({
            seller: sellerId,
            order: refund.order,
            entryType: 'DEBIT',
            reason: 'REFUND_ITEM',
            amount: refund.refundAmount,
            description: `Refund processed for ${
              refund.refundType === 'replacement' ? 'replacement price difference' : 'return'
            }. Order #${order?.orderNumber || refund.order}`,
          })
          await adjustmentEntry.save()

          refund.settlementAdjustment = refund.refundAmount
        } catch (settlementError: any) {
          console.error('Error creating settlement adjustment:', settlementError)
          // Don't fail the refund update
        }
      }

      // Notify customer about status change
      try {
        const customer = refund.customer as any
        const order = refund.order as any
        if (customer?.email) {
          const statusLabels: Record<string, string> = {
            processing: 'Processing',
            completed: 'Completed',
            failed: 'Failed',
          }
          const subject = `Refund ${statusLabels[status] || status} for order ${order?.orderNumber || ''}`
          const body = emailTemplates.orderStatusUpdateBuyer(customer.name || 'Customer', {
            orderNumber: order?.orderNumber || 'N/A',
            statusLabel: statusLabels[status] || status,
            message:
              status === 'completed'
                ? `Your refund of ₹${refund.refundAmount.toFixed(2)} has been processed successfully.`
                : status === 'processing'
                ? `Your refund of ₹${refund.refundAmount.toFixed(2)} is being processed.`
                : `Your refund request failed. ${failureReason || 'Please contact support.'}`,
          })
          void sendEmail(customer.email, subject, body)
        }
      } catch (emailError) {
        console.error('Error sending refund status email:', emailError)
      }
    }

    await refund.save()

    return res.status(200).json({
      success: true,
      data: refund,
      message: 'Refund request updated successfully',
    })
  } catch (error: any) {
    console.error('Error updating refund request:', error)
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to update refund request',
    })
  }
}

/**
 * Customer: Get their refund requests
 */
export const getCustomerRefundRequests = async (req: Request, res: Response) => {
  try {
    const user = await checkUserAccess(req, res, ['customer'])
    if (!user) return

    const { status, page = 1, limit = 20 } = req.query

    const query: any = {
      customer: user._id,
    }

    if (status) {
      query.status = status
    }

    const skip = (Number(page) - 1) * Number(limit)

    const [refunds, total] = await Promise.all([
      RefundRequest.find(query)
        .populate('order', 'orderNumber')
        .populate('replacementOrder', 'orderNumber')
        .populate('return', 'status')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      RefundRequest.countDocuments(query),
    ])

    return res.status(200).json({
      success: true,
      data: refunds,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
    })
  } catch (error: any) {
    console.error('Error fetching customer refund requests:', error)
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch refund requests',
    })
  }
}


