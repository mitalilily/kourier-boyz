/**
 * Payment Flow Testing Script
 * 
 * This script helps test the payment and order creation flow
 * Run with: ts-node src/scripts/testPaymentFlow.ts
 */

import mongoose from 'mongoose'
import dotenv from 'dotenv'
import PaymentIntent from '../models/PaymentIntent'
import Order from '../models/Order'
import WebhookEvent from '../models/WebhookEvent'
import User from '../models/User'

dotenv.config()

const MONGO_URI = process.env.MONGO_URI || ''

async function testPaymentFlow() {
  try {
    console.log('🔌 Connecting to MongoDB...')
    await mongoose.connect(MONGO_URI)
    console.log('✅ Connected to MongoDB\n')

    // Test 1: Check for stuck payment intents
    console.log('📊 Test 1: Checking for stuck payment intents...')
    const stuckIntents = await PaymentIntent.find({
      status: 'paid',
      orderIds: { $exists: true, $size: 0 },
    }).limit(10)

    if (stuckIntents.length > 0) {
      console.log(`⚠️  Found ${stuckIntents.length} stuck payment intents:`)
      stuckIntents.forEach((intent) => {
        console.log(`   - Intent ID: ${intent._id}`)
        console.log(`     Razorpay Order ID: ${intent.razorpayOrderId}`)
        console.log(`     Status: ${intent.status}`)
        console.log(`     Created: ${intent.createdAt}`)
        console.log(`     Updated: ${intent.updatedAt}`)
        console.log('')
      })
    } else {
      console.log('✅ No stuck payment intents found\n')
    }

    // Test 2: Check for expired payment intents
    console.log('📊 Test 2: Checking for expired payment intents...')
    const expiredPaymentIntents = await PaymentIntent.find({
      status: 'pending',
      expiresAt: { $lt: new Date() },
    }).limit(10)

    if (expiredPaymentIntents.length > 0) {
      console.log(`⚠️  Found ${expiredPaymentIntents.length} expired payment intents:`)
      expiredPaymentIntents.forEach((intent) => {
        console.log(`   - Intent ID: ${intent._id}`)
        console.log(`     Razorpay Order ID: ${intent.razorpayOrderId}`)
        console.log(`     Expired: ${intent.expiresAt}`)
        console.log('')
      })
    } else {
      console.log('✅ No expired payment intents found\n')
    }

    // Test 3: Check recent webhook events
    console.log('📊 Test 3: Checking recent webhook events...')
    const recentWebhooks = await WebhookEvent.find()
      .sort({ createdAt: -1 })
      .limit(10)

    if (recentWebhooks.length > 0) {
      console.log(`📋 Found ${recentWebhooks.length} recent webhook events:`)
      recentWebhooks.forEach((event) => {
        console.log(`   - Webhook ID: ${event.webhookId}`)
        console.log(`     Event Type: ${event.eventType}`)
        console.log(`     Status: ${event.status}`)
        console.log(`     Attempts: ${event.processingAttempts}`)
        if (event.lastError) {
          console.log(`     Last Error: ${event.lastError}`)
        }
        console.log(`     Created: ${event.createdAt}`)
        console.log('')
      })
    } else {
      console.log('ℹ️  No webhook events found\n')
    }

    // Test 4: Check payment intents without orders
    console.log('📊 Test 4: Checking payment intents without orders...')
    const intentsWithoutOrders = await PaymentIntent.find({
      status: { $in: ['paid', 'order_created'] },
      $or: [
        { orderIds: { $exists: false } },
        { orderIds: { $size: 0 } },
      ],
    }).limit(10)

    if (intentsWithoutOrders.length > 0) {
      console.log(`⚠️  Found ${intentsWithoutOrders.length} payment intents without orders:`)
      for (const intent of intentsWithoutOrders) {
        // Check if orders exist in Order collection
        const orders = await Order.find({
          razorpayOrderId: intent.razorpayOrderId,
        })

        if (orders.length === 0) {
          console.log(`   - Intent ID: ${intent._id}`)
          console.log(`     Razorpay Order ID: ${intent.razorpayOrderId}`)
          console.log(`     Status: ${intent.status}`)
          console.log(`     Total: ₹${intent.total}`)
          console.log(`     Created: ${intent.createdAt}`)
          console.log('')
        }
      }
    } else {
      console.log('✅ All payment intents have associated orders\n')
    }

    // Test 5: Check for orders without payment intents
    console.log('📊 Test 5: Checking for orders without payment intents...')
    const ordersWithoutIntents = await Order.find({
      paymentGateway: 'razorpay',
      razorpayOrderId: { $exists: true },
    }).limit(10)

    let count = 0
    for (const order of ordersWithoutIntents) {
      const intent = await PaymentIntent.findOne({
        razorpayOrderId: order.razorpayOrderId,
      })

      if (!intent) {
        count++
        console.log(`   - Order ID: ${order._id}`)
        console.log(`     Order Number: ${order.orderNumber}`)
        console.log(`     Razorpay Order ID: ${order.razorpayOrderId}`)
        console.log('')
      }
    }

    if (count === 0) {
      console.log('✅ All orders have associated payment intents\n')
    } else {
      console.log(`⚠️  Found ${count} orders without payment intents\n`)
    }

    // Test 6: Statistics
    console.log('📊 Test 6: Payment Flow Statistics...')
    const totalIntents = await PaymentIntent.countDocuments()
    const pendingIntents = await PaymentIntent.countDocuments({ status: 'pending' })
    const paidIntents = await PaymentIntent.countDocuments({ status: 'paid' })
    const orderCreatedIntents = await PaymentIntent.countDocuments({ status: 'order_created' })
    const expiredIntentsCount = await PaymentIntent.countDocuments({ status: 'expired' })
    const failedIntents = await PaymentIntent.countDocuments({ status: 'failed' })

    console.log(`   Total Payment Intents: ${totalIntents}`)
    console.log(`   Pending: ${pendingIntents}`)
    console.log(`   Paid: ${paidIntents}`)
    console.log(`   Order Created: ${orderCreatedIntents}`)
    console.log(`   Expired: ${expiredIntentsCount}`)
    console.log(`   Failed: ${failedIntents}`)
    console.log('')

    const totalWebhooks = await WebhookEvent.countDocuments()
    const processedWebhooks = await WebhookEvent.countDocuments({ status: 'processed' })
    const failedWebhooks = await WebhookEvent.countDocuments({ status: 'failed' })
    const retryingWebhooks = await WebhookEvent.countDocuments({ status: 'retrying' })

    console.log(`   Total Webhook Events: ${totalWebhooks}`)
    console.log(`   Processed: ${processedWebhooks}`)
    console.log(`   Failed: ${failedWebhooks}`)
    console.log(`   Retrying: ${retryingWebhooks}`)
    console.log('')

    console.log('✅ Payment flow test completed!')
  } catch (error) {
    console.error('❌ Error testing payment flow:', error)
  } finally {
    await mongoose.disconnect()
    console.log('🔌 Disconnected from MongoDB')
  }
}

// Run the test
testPaymentFlow()

