import { Request, Response } from 'express'
import { checkUserAccess } from '../utils/checkUserAccess'
import { manuallyVerifyPaymentIntent } from '../services/paymentIntentRecovery.service'
import PaymentIntent from '../models/PaymentIntent'
import Order from '../models/Order'

/**
 * Admin endpoint to manually verify and create orders from payment intent
 * Handles cases where webhook was delayed or failed
 */
export const verifyPaymentIntentManually = async (req: Request, res: Response) => {
  try {
    const admin = await checkUserAccess(req, res, ['super-admin'])
    if (!admin) return

    const { razorpayOrderId } = req.params

    if (!razorpayOrderId) {
      return res.status(400).json({
        success: false,
        message: 'Razorpay order ID is required',
      })
    }

    const result = await manuallyVerifyPaymentIntent(razorpayOrderId)

    if (result.success) {
      return res.status(200).json({
        success: true,
        message: result.message,
        data: {
          orders: result.orders,
        },
      })
    } else {
      return res.status(400).json({
        success: false,
        message: result.message,
      })
    }
  } catch (error: any) {
    console.error('[Admin Payment] Error in manual verification:', error)
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to verify payment intent',
    })
  }
}

/**
 * Get payment intent details for admin
 */
export const getPaymentIntentDetails = async (req: Request, res: Response) => {
  try {
    const admin = await checkUserAccess(req, res, ['super-admin'])
    if (!admin) return

    const { razorpayOrderId } = req.params

    if (!razorpayOrderId) {
      return res.status(400).json({
        success: false,
        message: 'Razorpay order ID is required',
      })
    }

    const paymentIntent = await PaymentIntent.findOne({ razorpayOrderId })
      .populate('user', 'name email phone')
      .lean()

    if (!paymentIntent) {
      return res.status(404).json({
        success: false,
        message: 'Payment intent not found',
      })
    }

    // Check for existing orders
    const orders = await Order.find({
      razorpayOrderId: paymentIntent.razorpayOrderId,
      paymentGateway: 'razorpay',
    })
      .select('orderNumber status paymentStatus total createdAt')
      .lean()

    return res.status(200).json({
      success: true,
      data: {
        paymentIntent: {
          _id: paymentIntent._id,
          razorpayOrderId: paymentIntent.razorpayOrderId,
          status: paymentIntent.status,
          total: paymentIntent.total,
          createdAt: paymentIntent.createdAt,
          expiresAt: paymentIntent.expiresAt,
          user: paymentIntent.user,
          orderIds: paymentIntent.orderIds,
        },
        orders: orders.map((o) => ({
          _id: o._id,
          orderNumber: o.orderNumber,
          status: o.status,
          paymentStatus: o.paymentStatus,
          total: o.total,
          createdAt: o.createdAt,
        })),
      },
    })
  } catch (error: any) {
    console.error('[Admin Payment] Error getting payment intent details:', error)
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to get payment intent details',
    })
  }
}


