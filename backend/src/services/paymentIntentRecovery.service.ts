import mongoose from 'mongoose'
import PaymentIntent from '../models/PaymentIntent'
import Order from '../models/Order'
import WebhookEvent from '../models/WebhookEvent'
import { createOrderFromPaymentIntent } from './orderCreation.service'
import { notifyAdminOfWebhookFailure } from '../controllers/webhook.controller'

/**
 * Recovery service for payment intents
 * Handles:
 * 1. Stuck payment intents (paid but no orders)
 * 2. Expired payment intents cleanup
 * 3. Retry failed order creation
 */

/**
 * Check for stuck payment intents (paid but no orders created)
 * This handles cases where webhook was delayed or failed
 */
export const checkStuckPaymentIntents = async () => {
  try {
    // Find payment intents that are marked as 'paid' but have no orders
    // and were created more than 5 minutes ago (give webhook time to arrive)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
    const stuckIntents = await PaymentIntent.find({
      status: 'paid',
      orderIds: { $exists: true, $size: 0 },
      updatedAt: { $lt: fiveMinutesAgo },
    }).limit(50) // Process in batches

    console.log(`[Payment Intent Recovery] Found ${stuckIntents.length} stuck payment intents`)

    for (const intent of stuckIntents) {
      try {
        console.log(`[Payment Intent Recovery] Retrying order creation for intent ${intent._id}`)

        // Check if orders were created in the meantime
        const existingOrders = await Order.find({
          razorpayOrderId: intent.razorpayOrderId,
          paymentGateway: 'razorpay',
        })

        if (existingOrders.length > 0) {
          // Orders exist, just update the intent
          intent.orderIds = existingOrders.map((o) => o._id as mongoose.Types.ObjectId)
          intent.status = 'order_created'
          await intent.save()
          console.log(
            `[Payment Intent Recovery] Found existing orders for intent ${intent._id}, updated status`,
          )
          continue
        }

        // Try to create orders
        const createdOrders = await createOrderFromPaymentIntent(intent, {
          razorpayPaymentId: intent.razorpayPaymentId,
          razorpayPaymentMethod: intent.razorpayPaymentMethod,
          razorpayPaymentDetails: intent.razorpayPaymentDetails,
        })

        // Update payment intent
        intent.status = 'order_created'
        intent.orderIds = createdOrders.map((o) => o._id as mongoose.Types.ObjectId)
        await intent.save()

        console.log(
          `[Payment Intent Recovery] Successfully created ${createdOrders.length} orders for intent ${intent._id}`,
        )
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error(
          `[Payment Intent Recovery] Failed to create orders for intent ${intent._id}:`,
          errorMessage,
        )

        // Notify admin if this is a critical failure
        if (intent.updatedAt < new Date(Date.now() - 30 * 60 * 1000)) {
          // Intent stuck for more than 30 minutes
          await notifyAdminOfWebhookFailure(
            'recovery-job',
            intent.razorpayOrderId,
            errorMessage,
            (intent._id as mongoose.Types.ObjectId).toString(),
          )
        }
      }
    }

    return { processed: stuckIntents.length }
  } catch (error) {
    console.error('[Payment Intent Recovery] Error checking stuck intents:', error)
    return { processed: 0, error: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * Notify users of expired payment intents
 * Sends notification if payment not completed within 30 minutes
 */
export const notifyExpiredPaymentIntents = async () => {
  try {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000)
    const now = new Date()

    // Find intents that expired in the last 5 minutes (to avoid duplicate notifications)
    const expiredIntents = await PaymentIntent.find({
      status: 'pending',
      expiresAt: {
        $gte: thirtyMinutesAgo,
        $lt: now,
      },
    })
      .populate('user', 'name email')
      .limit(50)

    console.log(`[Payment Intent Expiration] Found ${expiredIntents.length} expired payment intents`)

    for (const intent of expiredIntents) {
      try {
        // Mark as expired
        intent.status = 'expired'
        await intent.save()

        // Send notification to user
        const user = intent.user as any
        if (user?.email) {
          const { sendEmail } = await import('../utils/email')
          const { emailTemplates } = await import('../utils/email')

          void sendEmail(
            user.email,
            'Payment Session Expired',
            emailTemplates.paymentIntentExpired(user.name || 'there', {
              razorpayOrderId: intent.razorpayOrderId,
              total: intent.total,
            }),
          )
        }

        console.log(`[Payment Intent Expiration] Notified user for expired intent ${intent._id}`)
      } catch (error) {
        console.error(
          `[Payment Intent Expiration] Error notifying user for intent ${intent._id}:`,
          error,
        )
      }
    }

    return { notified: expiredIntents.length }
  } catch (error) {
    console.error('[Payment Intent Expiration] Error notifying expired intents:', error)
    return { notified: 0, error: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * Cleanup expired payment intents
 * Removes intents that are expired and failed/pending (older than 7 days)
 */
export const cleanupExpiredPaymentIntents = async () => {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    // Find expired intents that are not order_created and older than 7 days
    const expiredIntents = await PaymentIntent.find({
      $or: [
        { expiresAt: { $lt: new Date() } },
        { createdAt: { $lt: sevenDaysAgo } },
      ],
      status: { $in: ['pending', 'failed', 'expired'] },
      orderIds: { $exists: true, $size: 0 },
    }).limit(100) // Process in batches

    console.log(`[Payment Intent Cleanup] Found ${expiredIntents.length} expired payment intents`)

    const deletedCount = await PaymentIntent.deleteMany({
      _id: { $in: expiredIntents.map((i) => i._id) },
    })

    console.log(`[Payment Intent Cleanup] Deleted ${deletedCount.deletedCount} expired intents`)

    return { deleted: deletedCount.deletedCount || 0 }
  } catch (error) {
    console.error('[Payment Intent Cleanup] Error cleaning up expired intents:', error)
    return { deleted: 0, error: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * Manual verification endpoint helper
 * Allows admins to manually trigger order creation for a payment intent
 */
export const manuallyVerifyPaymentIntent = async (razorpayOrderId: string) => {
  try {
    const paymentIntent = await PaymentIntent.findOne({
      razorpayOrderId,
      status: { $in: ['pending', 'paid'] },
    })

    if (!paymentIntent) {
      return {
        success: false,
        message: 'Payment intent not found or already processed',
      }
    }

    // Check if orders already exist
    const existingOrders = await Order.find({
      razorpayOrderId: paymentIntent.razorpayOrderId,
      paymentGateway: 'razorpay',
    })

    if (existingOrders.length > 0) {
      // Update intent with existing orders
      paymentIntent.status = 'order_created'
      paymentIntent.orderIds = existingOrders.map((o) => o._id as mongoose.Types.ObjectId)
      await paymentIntent.save()

      return {
        success: true,
        message: 'Orders already exist for this payment intent',
        orders: existingOrders.map((o) => ({
          id: o._id,
          orderNumber: o.orderNumber,
        })),
      }
    }

    // Create orders
    const createdOrders = await createOrderFromPaymentIntent(paymentIntent, {
      razorpayPaymentId: paymentIntent.razorpayPaymentId,
      razorpayPaymentMethod: paymentIntent.razorpayPaymentMethod,
      razorpayPaymentDetails: paymentIntent.razorpayPaymentDetails,
    })

    // Update payment intent
    paymentIntent.status = 'order_created'
    paymentIntent.orderIds = createdOrders.map((o) => o._id as mongoose.Types.ObjectId)
    await paymentIntent.save()

    return {
      success: true,
      message: `Successfully created ${createdOrders.length} order(s)`,
      orders: createdOrders.map((o) => ({
        id: o._id,
        orderNumber: o.orderNumber,
      })),
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('[Manual Verification] Error:', errorMessage)
    return {
      success: false,
      message: errorMessage,
    }
  }
}

