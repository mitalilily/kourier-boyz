/**
 * Webhook Simulation Script
 * 
 * This script helps simulate Razorpay webhook events for testing
 * Run with: ts-node src/scripts/simulateWebhook.ts <razorpayOrderId> <eventType>
 * 
 * Example:
 *   ts-node src/scripts/simulateWebhook.ts order_123 payment.captured
 */

import axios from 'axios'
import crypto from 'crypto'
import dotenv from 'dotenv'

dotenv.config()

const WEBHOOK_URL = process.env.WEBHOOK_URL || 'http://localhost:5004/api/webhooks/razorpay'
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || ''

function generateWebhookSignature(payload: string): string {
  if (!RAZORPAY_WEBHOOK_SECRET) {
    throw new Error('RAZORPAY_WEBHOOK_SECRET not configured')
  }
  return crypto.createHmac('sha256', RAZORPAY_WEBHOOK_SECRET).update(payload).digest('hex')
}

async function simulateWebhook(razorpayOrderId: string, eventType: string = 'payment.captured') {
  try {
    const webhookId = `test_webhook_${Date.now()}`
    const eventTimestamp = Math.floor(Date.now() / 1000).toString()

    // Create webhook payload based on event type
    let payload: any

    if (eventType === 'payment.captured') {
      payload = {
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: `pay_test_${Date.now()}`,
              entity: 'payment',
              amount: 10000, // ₹100.00 in paise
              currency: 'INR',
              status: 'captured',
              order_id: razorpayOrderId,
              method: 'card',
              card: {
                id: 'card_test',
                entity: 'card',
                name: 'Test Card',
                last4: '1234',
                network: 'Visa',
                type: 'credit',
                issuer: 'HDFC',
              },
              created_at: Math.floor(Date.now() / 1000),
            },
          },
        },
      }
    } else if (eventType === 'order.paid') {
      payload = {
        event: 'order.paid',
        payload: {
          order: {
            entity: {
              id: razorpayOrderId,
              entity: 'order',
              amount: 10000,
              currency: 'INR',
              status: 'paid',
              created_at: Math.floor(Date.now() / 1000),
            },
          },
          payment: {
            entity: {
              id: `pay_test_${Date.now()}`,
              entity: 'payment',
              amount: 10000,
              currency: 'INR',
              status: 'captured',
              order_id: razorpayOrderId,
              method: 'upi',
              upi: {
                vpa: 'test@upi',
                payer_account_type: 'bank_account',
              },
              created_at: Math.floor(Date.now() / 1000),
            },
          },
        },
      }
    } else if (eventType === 'payment.failed') {
      payload = {
        event: 'payment.failed',
        payload: {
          payment: {
            entity: {
              id: `pay_test_${Date.now()}`,
              entity: 'payment',
              amount: 10000,
              currency: 'INR',
              status: 'failed',
              order_id: razorpayOrderId,
              error_code: 'BAD_REQUEST_ERROR',
              error_description: 'Payment failed',
              created_at: Math.floor(Date.now() / 1000),
            },
          },
        },
      }
    } else {
      console.error(`❌ Unknown event type: ${eventType}`)
      console.log('Available event types: payment.captured, order.paid, payment.failed')
      process.exit(1)
    }

    const payloadString = JSON.stringify(payload)
    const signature = generateWebhookSignature(payloadString)

    console.log('📤 Sending webhook...')
    console.log(`   Webhook ID: ${webhookId}`)
    console.log(`   Event Type: ${eventType}`)
    console.log(`   Razorpay Order ID: ${razorpayOrderId}`)
    console.log(`   URL: ${WEBHOOK_URL}`)
    console.log('')

    const response = await axios.post(
      WEBHOOK_URL,
      payload,
      {
        headers: {
          'x-razorpay-event-id': webhookId,
          'x-razorpay-event-timestamp': eventTimestamp,
          'x-razorpay-signature': signature,
          'Content-Type': 'application/json',
        },
      },
    )

    console.log('✅ Webhook sent successfully!')
    console.log(`   Response Status: ${response.status}`)
    console.log(`   Response Data:`, response.data)
  } catch (error: any) {
    console.error('❌ Error sending webhook:', error.message)
    if (error.response) {
      console.error(`   Status: ${error.response.status}`)
      console.error(`   Data:`, error.response.data)
    }
    process.exit(1)
  }
}

// Get command line arguments
const args = process.argv.slice(2)

if (args.length < 1) {
  console.log('Usage: ts-node src/scripts/simulateWebhook.ts <razorpayOrderId> [eventType]')
  console.log('')
  console.log('Examples:')
  console.log('  ts-node src/scripts/simulateWebhook.ts order_123 payment.captured')
  console.log('  ts-node src/scripts/simulateWebhook.ts order_123 order.paid')
  console.log('  ts-node src/scripts/simulateWebhook.ts order_123 payment.failed')
  process.exit(1)
}

const razorpayOrderId = args[0]
const eventType = args[1] || 'payment.captured'

simulateWebhook(razorpayOrderId, eventType)


