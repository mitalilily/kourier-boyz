import crypto from 'crypto'
import { Request, Response } from 'express'
import mongoose, { FilterQuery } from 'mongoose'
import CourierWebhookReceipt, {
  ICourierWebhookReceipt,
} from '../models/CourierWebhookReceipt'
import Order, { IOrder, SellerShipmentStatus } from '../models/Order'
import PaymentIntent from '../models/PaymentIntent'
import Product from '../models/Product'
import Return from '../models/Return'
import WebhookEvent, { IWebhookEvent } from '../models/WebhookEvent'
import { io } from '../server'
import { emailTemplates, sendEmail } from '../utils/email'
import { recalcOrderStatus, updateShipmentStatus } from '../utils/orderStatus'
import { getPhoneFromUser } from '../utils/phoneDecryptionHelper'
import { sendSms } from '../utils/sms'
import { getSmsTemplate, SmsTemplateType } from '../utils/smsTemplates'

type CourierProvider = 'couriercart' | 'shipmozo'

const SHIPPING_PROVIDER_WEBHOOK_SECRET =
  process.env.SHIPPING_PROVIDER_WEBHOOK_SECRET ||
  process.env.SHIPMOZO_WEBHOOK_SECRET ||
  process.env.COURIERCART_WEBHOOK_SECRET ||
  ''
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || ''

// Export for use in recovery service
export const notifyAdminOfWebhookFailure = async (
  webhookId: string,
  razorpayOrderId: string,
  error: string,
  paymentIntentId?: string,
) => {
  try {
    const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL
    if (!adminEmail) {
      console.warn(
        '[Webhook] ADMIN_NOTIFICATION_EMAIL not configured. Skipping admin notification.',
      )
      return
    }

    const errorMessage = `Webhook ${webhookId} failed to create order for Razorpay order ${razorpayOrderId}. Error: ${error}. Payment Intent ID: ${
      paymentIntentId || 'N/A'
    }. Manual intervention required.`

    void sendEmail(
      adminEmail,
      '🚨 Critical: Webhook Order Creation Failed',
      emailTemplates.adminAlert({
        title: 'Webhook Order Creation Failed',
        message: errorMessage,
        severity: 'critical',
        actionUrl: `${process.env.ADMIN_URL || 'http://localhost:3001'}/admin/payment-intents/${
          paymentIntentId || razorpayOrderId
        }`,
      }),
    )

    console.log('[Webhook] Admin notification sent', { adminEmail })
  } catch (notifError) {
    console.error('[Webhook] Error sending admin notification:', notifError)
  }
}

const mapCourierStatusToSellerStatus = (status: string): SellerShipmentStatus | null => {
  const normalized = status?.toLowerCase?.()
  switch (normalized) {
    case 'booked':
    case 'shipped':
      return 'shipped'
    case 'in_transit':
    case 'transit':
      return 'in_transit'
    case 'out_for_delivery':
      return 'out_for_delivery'
    case 'delivered':
      return 'delivered'
    case 'cancelled':
    case 'failed':
      return 'cancelled'
    default:
      return null
  }
}

const resolveCourierProvider = (requestPath = ''): CourierProvider =>
  requestPath.includes('/shipmozo') ? 'shipmozo' : 'couriercart'

const verifyShippingProviderSignature = (rawBody: Buffer | undefined, signature?: string) => {
  if (!SHIPPING_PROVIDER_WEBHOOK_SECRET) {
    console.warn('Shipping provider webhook secret missing. Skipping verification.')
    return true
  }
  if (!rawBody || !signature) return false
  const computed = crypto
    .createHmac('sha256', SHIPPING_PROVIDER_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex')
  return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(signature))
}

const buildCourierWebhookPayloadHash = (rawBody: Buffer | undefined, payload: unknown) => {
  const serializedPayload = rawBody || Buffer.from(JSON.stringify(payload || {}), 'utf8')
  return crypto.createHash('sha256').update(serializedPayload).digest('hex')
}

type CourierWebhookClaimReason =
  | 'created'
  | 'retry_failed'
  | 'already_processed'
  | 'already_processing'

const reuseCourierWebhookReceipt = async (
  receipt: ICourierWebhookReceipt,
  metadata: {
    provider: CourierProvider
    signature?: string
    eventType: string
    orderNumber?: string
    courierOrderId?: string
    awb?: string
    payload: unknown
  },
): Promise<{
  receipt: ICourierWebhookReceipt
  shouldProcess: boolean
  reason: CourierWebhookClaimReason
}> => {
  receipt.deliveryCount += 1
  receipt.provider = metadata.provider || receipt.provider
  receipt.signature = metadata.signature || receipt.signature
  receipt.eventType = metadata.eventType || receipt.eventType
  receipt.orderNumber = metadata.orderNumber || receipt.orderNumber
  receipt.courierOrderId = metadata.courierOrderId || receipt.courierOrderId
  receipt.awb = metadata.awb || receipt.awb
  receipt.payload = metadata.payload

  if (receipt.status === 'failed') {
    receipt.status = 'processing'
    receipt.processedAt = undefined
    receipt.lastError = undefined
    receipt.lastErrorAt = undefined
    await receipt.save()

    return {
      receipt,
      shouldProcess: true,
      reason: 'retry_failed',
    }
  }

  receipt.duplicateCount += 1
  await receipt.save()

  return {
    receipt,
    shouldProcess: false,
    reason: receipt.status === 'processed' ? 'already_processed' : 'already_processing',
  }
}

const claimCourierWebhookReceipt = async (params: {
  rawBody: Buffer | undefined
  provider: CourierProvider
  signature?: string
  eventType: string
  orderNumber?: string
  courierOrderId?: string
  awb?: string
  payload: unknown
}) => {
  const payloadHash = buildCourierWebhookPayloadHash(params.rawBody, params.payload)
  const metadata = {
    provider: params.provider,
    signature: params.signature,
    eventType: params.eventType,
    orderNumber: params.orderNumber,
    courierOrderId: params.courierOrderId,
    awb: params.awb,
    payload: params.payload,
  }

  const existingReceipt = await CourierWebhookReceipt.findOne({
    provider: params.provider,
    payloadHash,
  })

  if (existingReceipt) {
    return reuseCourierWebhookReceipt(existingReceipt, metadata)
  }

  try {
    const receipt = await CourierWebhookReceipt.create({
      provider: params.provider,
      payloadHash,
      signature: params.signature,
      eventType: params.eventType,
      orderNumber: params.orderNumber,
      courierOrderId: params.courierOrderId,
      awb: params.awb,
      payload: params.payload,
      status: 'processing',
      deliveryCount: 1,
      duplicateCount: 0,
    })

    return {
      receipt,
      shouldProcess: true,
      reason: 'created' as const,
    }
  } catch (error: any) {
    if (error?.code !== 11000) {
      throw error
    }

    const duplicateReceipt = await CourierWebhookReceipt.findOne({
      provider: params.provider,
      payloadHash,
    })

    if (!duplicateReceipt) {
      throw error
    }

    return reuseCourierWebhookReceipt(duplicateReceipt, metadata)
  }
}

const markCourierWebhookReceiptProcessed = async (receiptId: string) => {
  await CourierWebhookReceipt.findByIdAndUpdate(receiptId, {
    $set: {
      status: 'processed',
      processedAt: new Date(),
      lastError: null,
      lastErrorAt: null,
    },
  })
}

const markCourierWebhookReceiptFailed = async (receiptId: string, error: unknown) => {
  await CourierWebhookReceipt.findByIdAndUpdate(receiptId, {
    $set: {
      status: 'failed',
      lastError: error instanceof Error ? error.message : String(error),
      lastErrorAt: new Date(),
    },
  })
}

export const handleCourierCartWebhook = async (req: Request, res: Response) => {
  let courierReceipt: ICourierWebhookReceipt | null = null

  try {
    const provider = resolveCourierProvider(req.originalUrl || req.path || '')
    const signature =
      (req.headers['x-webhook-signature'] as string | undefined) ||
      (req.headers['x-shipmozo-signature'] as string | undefined) ||
      (req.headers['x-signature'] as string | undefined)
    const rawBody = (req as any).rawBody as Buffer | undefined

    if (!verifyShippingProviderSignature(rawBody, signature)) {
      return res.status(401).json({ success: false, message: 'Invalid signature' })
    }

    const { event, data } = req.body || {}
    if (!event || !data) {
      return res.status(400).json({ success: false, message: 'Invalid payload' })
    }

    const awb = data.awb_number
    const courierOrderId = data.order_id || data.orderId
    const orderNumber = data.order_number
    const receiptClaim = await claimCourierWebhookReceipt({
      rawBody,
      provider,
      signature,
      eventType: event,
      orderNumber,
      courierOrderId,
      awb,
      payload: req.body,
    })

    courierReceipt = receiptClaim.receipt

    const finalizeProcessedReceipt = async () => {
      if (!courierReceipt?._id) return

      try {
        await markCourierWebhookReceiptProcessed(String(courierReceipt._id))
      } catch (receiptError) {
        console.error('[Webhook] Failed to mark shipping provider receipt processed:', receiptError)
      }
    }

    if (!receiptClaim.shouldProcess) {
      console.log('[Webhook] Duplicate shipping provider payload ignored', {
        receiptId: courierReceipt._id,
        provider,
        reason: receiptClaim.reason,
        event,
        orderNumber,
        courierOrderId,
        awb,
      })
      return res.status(200).json({
        received: true,
        duplicate: true,
        message: `Duplicate shipping provider webhook ignored (${receiptClaim.reason})`,
      })
    }

    // IMPORTANT: Exclude return shipments (order_number starting with "RET-")
    // Return shipments are NOT stored in Order.sellerShipments and should be handled separately
    if (orderNumber && orderNumber.startsWith('RET-')) {
      // This is a return shipment webhook - handle it via Return model instead
      try {
        const returnRecord = await Return.findOne({
          $or: [{ courierReverseId: courierOrderId }, { courierReverseAwb: awb }],
        })

        if (returnRecord) {
          // Map status to return status
          const normalizedStatus = data.status?.toLowerCase?.()
          if (normalizedStatus === 'delivered' || normalizedStatus === 'completed') {
            // Only update to REVERSE_PICKUP_COMPLETED if currently in transit
            // Don't overwrite if already marked as received or completed
            if (
              returnRecord.status === 'REVERSE_PICKUP_IN_TRANSIT' ||
              returnRecord.status === 'REVERSE_PICKUP_CREATED'
            ) {
              returnRecord.status = 'REVERSE_PICKUP_COMPLETED'
              returnRecord.timeline.push({
                status: 'REVERSE_PICKUP_COMPLETED',
                message: 'Return package delivered to seller',
                timestamp: new Date(),
              })
              await returnRecord.save()
            }
          } else if (normalizedStatus === 'shipped' || normalizedStatus === 'in_transit') {
            // Only update to IN_TRANSIT if currently CREATED
            if (returnRecord.status === 'REVERSE_PICKUP_CREATED') {
              returnRecord.status = 'REVERSE_PICKUP_IN_TRANSIT'
              returnRecord.timeline.push({
                status: 'REVERSE_PICKUP_IN_TRANSIT',
                message: 'Return package in transit to seller',
                timestamp: new Date(),
              })
              await returnRecord.save()
            }
          }

          console.log('[Webhook] Return shipment status updated:', {
            returnId: returnRecord._id,
            orderNumber,
            status: returnRecord.status,
          })
        }
      } catch (returnError) {
        console.error('[Webhook] Error handling return shipment webhook:', returnError)
      }

      await finalizeProcessedReceipt()
      return res.status(200).json({ received: true, message: 'Return shipment webhook processed' })
    }

    const filters: FilterQuery<IOrder>[] = []
    if (courierOrderId) {
      filters.push({ 'sellerShipments.courierCart.order_id': courierOrderId })
    }
    if (awb) {
      filters.push({ 'sellerShipments.shippingMeta.awb': awb })
    }
    if (orderNumber) {
      filters.push({ orderNumber })
    }

    const query = filters.length > 0 ? { $or: filters } : {}
    const order = await Order.findOne(query)
      .populate('user', 'name email phone')
      .populate('sellerShipments.seller', 'name businessName supportEmail email storePhone')
      .exec()

    if (!order) {
      await finalizeProcessedReceipt()
      return res.status(200).json({ received: true })
    }

    const shipment =
      order.sellerShipments.find(
        (sellerShipment) =>
          (courierOrderId && sellerShipment.courierCart?.order_id === courierOrderId) ||
          (awb && sellerShipment.shippingMeta?.awb === awb),
      ) || order.sellerShipments[0]

    if (!shipment) {
      await finalizeProcessedReceipt()
      return res.status(200).json({ received: true })
    }

    if (Array.isArray(data.tracking_events)) {
      shipment.trackingEvents = data.tracking_events.map((eventItem: any) => ({
        status: eventItem.status,
        location: eventItem.location,
        message: eventItem.message,
        timestamp: new Date(eventItem.timestamp),
      }))
    }

    const previousShipmentStatus = shipment.status
    let shipmentStatusChanged = false

    const mappedStatus = mapCourierStatusToSellerStatus(data.status || event)
    if (mappedStatus && mappedStatus !== shipment.status) {
      try {
        updateShipmentStatus(order, shipment, mappedStatus)
        shipmentStatusChanged = true
      } catch {
        // Ignore invalid transitions triggered by duplicate events
      }
    }

    recalcOrderStatus(order)
    await order.save()

    // --- Notifications based on shipment status updates ---
    try {
      const buyer: any = (order as any).user
      const buyerEmail: string | undefined = buyer?.email
      const buyerName: string =
        buyer?.name || order.shippingAddress?.name || order.shippingAddress?.phone || 'there'
      const orderNumber = order.orderNumber || 'N/A'
      // Always prioritize buyer's profile phone number over address phone
      // Only use the phone number from the buyer's profile, not from shipping address
      let buyerPhone: string | undefined = undefined
      if (buyer?.phone) {
        // Phone from user profile - decrypt it using centralized helper
        const phoneResult = getPhoneFromUser(
          buyer,
          String(buyer?._id),
          `Webhook Order ${orderNumber}`,
        )
        if (phoneResult.isDecryptable && phoneResult.phone) {
          buyerPhone = phoneResult.phone
        } else {
          console.warn(
            `[Webhook] Cannot decrypt buyer phone from profile for order ${orderNumber}. Error: ${
              phoneResult.error || 'unknown'
            }. SMS will not be sent.`,
          )
        }
      } else {
        // Buyer doesn't have a phone in their profile - log and skip SMS
        console.warn(
          `[Webhook] Buyer does not have a phone number in their profile for order ${orderNumber}. SMS will not be sent. Address phone (${
            order.shippingAddress?.phone || 'N/A'
          }) is ignored.`,
        )
      }
      const trackingLink =
        shipment.shippingMeta?.tracking_link || shipment.courierCart?.tracking_link || undefined

      const sellerDoc: any = shipment.seller
      const sellerEmail: string | undefined =
        sellerDoc?.supportEmail || sellerDoc?.email || sellerDoc?.storePhone
      const sellerName: string =
        sellerDoc?.businessName ||
        sellerDoc?.name ||
        shipment.sellerSnapshot?.businessName ||
        'Seller'

      const statusLabelMap: Record<SellerShipmentStatus, string> = {
        pending: 'Pending',
        processing: 'Processing',
        ready_to_ship: 'Ready to Ship',
        pickup_requested: 'Pickup Requested',
        shipped: 'Shipped',
        in_transit: 'In Transit',
        out_for_delivery: 'Out for Delivery',
        delivered: 'Delivered',
        cancelled: 'Cancelled',
      }
      const latestStatus = shipment.status
      const statusLabel = statusLabelMap[latestStatus] || latestStatus
      const hasEnteredTransit =
        shipmentStatusChanged &&
        (latestStatus === 'shipped' || latestStatus === 'in_transit') &&
        previousShipmentStatus !== 'shipped' &&
        previousShipmentStatus !== 'in_transit'
      const hasEnteredOutForDelivery =
        shipmentStatusChanged && latestStatus === 'out_for_delivery'
      const hasBeenDelivered = shipmentStatusChanged && latestStatus === 'delivered'

      // Helper: emit to seller socket
      const emitToSeller = (eventName: string, extra: Record<string, unknown> = {}) => {
        try {
          const sellerId =
            typeof sellerDoc?._id === 'string'
              ? sellerDoc._id
              : sellerDoc?._id?.toString
              ? sellerDoc._id.toString()
              : undefined
          if (!sellerId) return
          io.to(`user:${sellerId}`).emit(eventName, {
            orderId: (order as any)._id?.toString?.() || String(order._id),
            orderNumber: order.orderNumber,
            status: latestStatus,
            trackingLink,
            shipmentId: shipment._id?.toString(),
            triggeredAt: new Date().toISOString(),
            ...extra,
          })
        } catch {
          // ignore socket errors
        }
      }

      // Helper: create database notification for customer
      const createCustomerNotification = async (
        title: string,
        message: string,
        link?: string,
        orderId?: string,
      ) => {
        try {
          const Notification = (await import('../models/Notification')).default
          const userId =
            typeof buyer?._id === 'string'
              ? buyer._id
              : buyer?._id?.toString
              ? buyer._id.toString()
              : undefined
          if (!userId) return

          const notificationLink = orderId
            ? `/profile/orders?orderId=${orderId}`
            : link || `/profile/orders`

          await Notification.create({
            userId,
            title,
            message,
            type: 'order',
            read: false,
            link: notificationLink,
          })
          console.log(
            `[Notification] Created notification for customer ${userId} for order ${order.orderNumber}`,
          )
        } catch (error) {
          console.error('[Notification] Failed to create customer notification:', error)
        }
      }

      switch (latestStatus) {
        case 'shipped':
        case 'in_transit': {
          if (!hasEnteredTransit) {
            break
          }
          // Treat first movement to shipped/in_transit as pickup confirmed for seller
          if (sellerEmail) {
            void sendEmail(
              sellerEmail,
              `Pickup confirmed for order ${orderNumber}`,
              emailTemplates.sellerShipmentStatusUpdate(sellerName, {
                orderNumber,
                statusLabel: 'Pickup Confirmed',
                message: 'Courier has picked up your package. The order is now in transit.',
                trackingLink,
              }),
            )
          }
          if (buyerEmail) {
            void sendEmail(
              buyerEmail,
              `Your order ${orderNumber} has been shipped`,
              emailTemplates.orderStatusUpdateBuyer(buyerName, {
                orderNumber,
                statusLabel: 'Shipped',
                message: 'Your package is on its way.',
                trackingLink,
              }),
            )
          }
          // SMS to buyer: shipment confirmation
          if (buyerPhone) {
            // Use AWB (Airway Bill) as tracking ID - check multiple sources
            const awb =
              (shipment as any)?.shippingMeta?.awb ||
              (shipment as any)?.courierCart?.awb ||
              (shipment as any)?.shippingMeta?.tracking_id ||
              (shipment as any)?.courierCart?.tracking_id ||
              trackingLink ||
              ''

            // Get first item's product name for SMS
            let itemName = 'Item'
            if (order.items && order.items.length > 0) {
              try {
                const firstItem = order.items[0]
                if (firstItem.product) {
                  const productId =
                    typeof firstItem.product === 'string'
                      ? firstItem.product
                      : (firstItem.product as any)?._id?.toString?.() || String(firstItem.product)
                  const product = await Product.findById(productId).select('name').lean()
                  if (product?.name) {
                    itemName = product.name
                  }
                }
              } catch (error) {
                console.error('[Webhook] Error fetching product name for SMS:', error)
                // Continue with default 'Item' if product fetch fails
              }
            }

            const smsTemplate = getSmsTemplate(SmsTemplateType.SHIPMENT_CONFIRMATION, {
              buyerName,
              orderNumber,
              itemName,
              trackingId: awb, // Use AWB as tracking ID
              awb, // Also pass as awb for message builder
            })
            void sendSms(buyerPhone, smsTemplate.message, {
              templateId: smsTemplate.templateId || undefined,
            })
          }
          emitToSeller('order:pickup_done')
          await createCustomerNotification(
            'Order Shipped',
            `Your order ${orderNumber} has been shipped and is on its way.${
              trackingLink ? ` Track your order: ${trackingLink}` : ''
            }`,
            `/profile/orders`,
            (order as any)._id?.toString?.() || String(order._id),
          )
          break
        }
        case 'out_for_delivery': {
          if (!hasEnteredOutForDelivery) {
            break
          }
          // Optional but useful notifications
          if (buyerEmail) {
            void sendEmail(
              buyerEmail,
              `Your order ${orderNumber} is out for delivery`,
              emailTemplates.orderStatusUpdateBuyer(buyerName, {
                orderNumber,
                statusLabel: 'Out for Delivery',
                message: 'Our courier partner will attempt delivery today.',
                trackingLink,
              }),
            )
          }
          // SMS to buyer: out for delivery notification
          if (buyerPhone) {
            try {
              const smsTemplate = getSmsTemplate(SmsTemplateType.OUT_FOR_DELIVERY, {
                buyerName,
                orderNumber,
              })
              const smsResult = await sendSms(buyerPhone, smsTemplate.message, {
                templateId: smsTemplate.templateId || undefined,
              })
              if (smsResult.success) {
                console.log(`[Out for Delivery] SMS sent to buyer for order ${orderNumber}`)
              } else if (smsResult.skipped) {
                console.warn(`[Out for Delivery] SMS skipped for buyer: ${smsResult.reason}`)
              } else {
                console.error(`[Out for Delivery] Failed to send SMS to buyer:`, smsResult.error)
              }
            } catch (smsError) {
              console.error(`[Out for Delivery] Error sending SMS:`, smsError)
            }
          } else {
            console.warn(
              `[Out for Delivery] No buyer phone number found for order ${orderNumber}. SMS not sent.`,
            )
          }
          emitToSeller('order:out_for_delivery')
          await createCustomerNotification(
            'Order Out for Delivery',
            `Your order ${orderNumber} is out for delivery today. Our courier partner will attempt delivery soon.`,
            `/profile/orders`,
            (order as any)._id?.toString?.() || String(order._id),
          )
          break
        }
        case 'delivered': {
          if (!hasBeenDelivered) {
            break
          }
          if (sellerEmail) {
            void sendEmail(
              sellerEmail,
              `Order ${orderNumber} delivered`,
              emailTemplates.sellerShipmentStatusUpdate(sellerName, {
                orderNumber,
                statusLabel: 'Delivered',
                message: 'The shipment has been marked as delivered to the buyer.',
                trackingLink,
              }),
            )
          }
          if (buyerEmail) {
            void sendEmail(
              buyerEmail,
              `Order ${orderNumber} delivered`,
              emailTemplates.orderStatusUpdateBuyer(buyerName, {
                orderNumber,
                statusLabel: 'Delivered',
                message:
                  'Hope you enjoy your purchase! If there are any issues, you can reach out from the Help Center.',
                trackingLink,
              }),
            )
          }
          // SMS to buyer: order delivered notification
          if (buyerPhone) {
            try {
              const smsTemplate = getSmsTemplate(SmsTemplateType.ORDER_DELIVERED, {
                buyerName,
                orderNumber,
              })
              const smsResult = await sendSms(buyerPhone, smsTemplate.message, {
                templateId: smsTemplate.templateId || undefined,
              })
              if (smsResult.success) {
                console.log(`[Order Delivered] SMS sent to buyer for order ${orderNumber}`)
              } else if (smsResult.skipped) {
                console.warn(`[Order Delivered] SMS skipped for buyer: ${smsResult.reason}`)
              } else {
                console.error(`[Order Delivered] Failed to send SMS to buyer:`, smsResult.error)
              }
            } catch (smsError) {
              console.error(`[Order Delivered] Error sending SMS:`, smsError)
            }
          } else {
            console.warn(
              `[Order Delivered] No buyer phone number found for order ${orderNumber}. SMS not sent.`,
            )
          }
          emitToSeller('order:delivered')
          await createCustomerNotification(
            'Order Delivered',
            `Your order ${orderNumber} has been delivered. Hope you enjoy your purchase!`,
            `/profile/orders`,
            (order as any)._id?.toString?.() || String(order._id),
          )
          break
        }
        case 'cancelled': {
          // Delivery exception / RTO-like scenario
          if (sellerEmail) {
            void sendEmail(
              sellerEmail,
              `Shipment exception for order ${orderNumber}`,
              emailTemplates.sellerShipmentStatusUpdate(sellerName, {
                orderNumber,
                statusLabel: 'Cancelled / RTO Started',
                message:
                  'The courier has reported a delivery failure or cancellation. Please review this shipment in your dashboard.',
                trackingLink,
              }),
            )
          }
          if (buyerEmail) {
            void sendEmail(
              buyerEmail,
              `Delivery issue for order ${orderNumber}`,
              emailTemplates.orderStatusUpdateBuyer(buyerName, {
                orderNumber,
                statusLabel: 'Delivery Exception',
                message:
                  'There was an issue delivering your package. If this was not expected, please contact support.',
                trackingLink,
              }),
            )
          }
          emitToSeller('order:exception', { reason: data.status || event })
          break
        }
        default:
          break
      }
    } catch {
      // Notification failures must not break webhook processing
    }

    await finalizeProcessedReceipt()
    return res.status(200).json({ received: true })
  } catch (error) {
    if (courierReceipt?._id) {
      try {
        await markCourierWebhookReceiptFailed(String(courierReceipt._id), error)
      } catch (receiptError) {
        console.error('[Webhook] Failed to mark shipping provider receipt failed:', receiptError)
      }
    }

    console.error('Shipping provider webhook error:', error)
    return res.status(500).json({ success: false })
  }
}

export const handleShipmozoWebhook = handleCourierCartWebhook

// Helper function to retry order creation with exponential backoff
const retryOrderCreation = async (
  paymentIntent: any,
  paymentData: {
    razorpayPaymentId?: string
    razorpayPaymentMethod?: string
    razorpayPaymentDetails?: any
  },
  webhookEvent: any,
  attempt: number = 1,
  maxAttempts: number = 3,
): Promise<{ success: boolean; orders?: any[]; error?: string }> => {
  const delay = Math.pow(2, attempt - 1) * 1000 // Exponential backoff: 1s, 2s, 4s

  if (attempt > maxAttempts) {
    return {
      success: false,
      error: `Max retry attempts (${maxAttempts}) reached`,
    }
  }

  try {
    // Wait before retry (except first attempt)
    if (attempt > 1) {
      await new Promise((resolve) => setTimeout(resolve, delay))
    }

    const { createOrderFromPaymentIntent } = await import('../services/orderCreation.service')
    const createdOrders = await createOrderFromPaymentIntent(paymentIntent, paymentData)

    // Update webhook event on success
    webhookEvent.status = 'processed'
    webhookEvent.processedAt = new Date()
    webhookEvent.orderIds = createdOrders.map((o) => o._id)
    webhookEvent.processingAttempts = attempt
    await webhookEvent.save()

    return { success: true, orders: createdOrders }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    webhookEvent.processingAttempts = attempt
    webhookEvent.lastError = errorMessage
    webhookEvent.lastErrorAt = new Date()

    if (attempt < maxAttempts) {
      webhookEvent.status = 'retrying'
      await webhookEvent.save()
      // Retry
      return retryOrderCreation(paymentIntent, paymentData, webhookEvent, attempt + 1, maxAttempts)
    } else {
      // Max attempts reached
      webhookEvent.status = 'failed'
      await webhookEvent.save()
      return { success: false, error: errorMessage }
    }
  }
}

export const handleRazorpayWebhook = async (req: Request, res: Response) => {
  const webhookId = req.headers['x-razorpay-event-id'] as string | undefined
  const eventTimestamp = req.headers['x-razorpay-event-timestamp'] as string | undefined

  try {
    if (!RAZORPAY_WEBHOOK_SECRET) {
      console.warn('[Razorpay Webhook] Webhook secret missing. Rejecting request.')
      return res.status(500).json({ success: false, message: 'Webhook not configured' })
    }

    const signature = req.headers['x-razorpay-signature'] as string | undefined
    const rawBody = (req as any).rawBody as Buffer | undefined

    if (!rawBody || !signature) {
      console.warn('[Razorpay Webhook] Missing signature or body', {
        hasSignature: !!signature,
        hasRawBody: !!rawBody,
        webhookId,
      })
      return res.status(400).json({ success: false, message: 'Missing signature or body' })
    }

    // Verify webhook signature
    const computed = crypto
      .createHmac('sha256', RAZORPAY_WEBHOOK_SECRET)
      .update(rawBody)
      .digest('hex')

    if (!crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(signature))) {
      console.warn('[Razorpay Webhook] Invalid signature', { webhookId, eventTimestamp })
      return res.status(401).json({ success: false, message: 'Invalid signature' })
    }

    const event = req.body
    const eventType = event?.event

    if (!eventType) {
      console.warn('[Razorpay Webhook] Missing event type', { webhookId, body: event })
      return res.status(200).json({ received: true })
    }

    // Check for duplicate webhook - CRITICAL FIX #3
    if (webhookId) {
      const existingEvent = await WebhookEvent.findOne({ webhookId })
      if (existingEvent && existingEvent.status === 'processed') {
        console.log('[Razorpay Webhook] Duplicate webhook already processed', {
          webhookId,
          eventType,
          processedAt: existingEvent.processedAt,
        })
        return res.status(200).json({ received: true, message: 'Already processed' })
      }
    }

    console.log('[Razorpay Webhook] Received event', {
      eventType,
      webhookId,
      eventTimestamp,
    })

    // Handle different event types with proper payload structure
    let orderIdFromPayment: string | undefined
    let paymentEntity: any

    if (eventType === 'payment.captured' || eventType === 'payment.authorized') {
      paymentEntity = event?.payload?.payment?.entity
      orderIdFromPayment = paymentEntity?.order_id
    } else if (eventType === 'order.paid') {
      const orderEntity = event?.payload?.order?.entity
      paymentEntity = event?.payload?.payment?.entity || orderEntity?.payments?.[0]
      orderIdFromPayment = orderEntity?.id || paymentEntity?.order_id
    } else if (eventType === 'payment.failed' || eventType === 'order.failed') {
      paymentEntity = event?.payload?.payment?.entity || event?.payload?.order?.entity
      orderIdFromPayment = paymentEntity?.order_id || paymentEntity?.id
    } else {
      // Unknown event type
      console.log('[Razorpay Webhook] Unhandled event type', { eventType, webhookId })
      return res.status(200).json({ received: true })
    }

    if (!orderIdFromPayment) {
      console.warn('[Razorpay Webhook] Missing order ID in payload', {
        eventType,
        webhookId,
        payload: event?.payload,
      })
      return res.status(200).json({ received: true })
    }

    // Create or update webhook event log - CRITICAL FIX #4
    let webhookEvent = webhookId ? await WebhookEvent.findOne({ webhookId }) : null

    if (!webhookEvent && webhookId) {
      webhookEvent = new WebhookEvent({
        webhookId,
        eventType,
        razorpayOrderId: orderIdFromPayment,
        status: 'pending',
        payload: event,
        processingAttempts: 0,
      })
    } else if (webhookEvent) {
      webhookEvent.processingAttempts = (webhookEvent.processingAttempts || 0) + 1
      webhookEvent.status = webhookEvent.status === 'failed' ? 'retrying' : webhookEvent.status
      webhookEvent.eventType = eventType
      webhookEvent.payload = event
    }

    // Update webhook event with order ID
    if (webhookEvent) {
      webhookEvent.razorpayOrderId = orderIdFromPayment
      webhookEvent.razorpayPaymentId = paymentEntity?.id
      await webhookEvent.save()
    }
    // Payment authorized does not create orders; just log and exit.
    if (eventType === 'payment.authorized') {
      if (webhookEvent) {
        webhookEvent.status = 'processed'
        webhookEvent.processedAt = new Date()
        await webhookEvent.save()
      }

      console.log('[Razorpay Webhook] Payment authorized event recorded', {
        webhookId,
        razorpayOrderId: orderIdFromPayment,
      })
      return res.status(200).json({ received: true })
    }

    if (eventType === 'payment.failed' || eventType === 'order.failed') {
      if (webhookEvent) {
        webhookEvent.status = 'processed'
        webhookEvent.processedAt = new Date()
        await webhookEvent.save()
      }

      console.warn('[Razorpay Webhook] Payment/Order failed', {
        eventType,
        orderId: orderIdFromPayment,
        webhookId,
        error: paymentEntity?.error_description || paymentEntity?.error,
      })

      const orders = await Order.find({
        razorpayOrderId: orderIdFromPayment,
        paymentGateway: 'razorpay',
      })

      for (const order of orders) {
        if (order.paymentStatus !== 'paid') {
          order.paymentStatus = 'failed'
          await order.save()
          console.log(
            `[Razorpay Webhook] Updated order ${(order as any).orderNumber} to failed status`,
          )
        }
      }

      return res.status(200).json({ received: true })
    }


    const paymentId = paymentEntity?.id as string | undefined
    const paymentMethod = paymentEntity?.method as string | undefined

    // Find orders matching this Razorpay order ID - CRITICAL FIX #3 (duplicate check)
    let orders = await Order.find({
      razorpayOrderId: orderIdFromPayment,
      paymentGateway: 'razorpay',
    })

    // If no orders found, check for payment intent and create order
    if (!orders || orders.length === 0) {
      console.log('[Razorpay Webhook] No orders found, checking for payment intent', {
        razorpayOrderId: orderIdFromPayment,
        eventType,
        webhookId,
      })

      // CRITICAL FIX: Use atomic findOneAndUpdate to prevent duplicate order creation
      // This ensures only one webhook can proceed with order creation
      // We atomically check if orderIds is empty/null and set a lock
      // Only the first webhook will successfully acquire the lock and proceed
      const lockValue = new mongoose.Types.ObjectId() // Use a temporary lock ID
      const paymentIntent = await PaymentIntent.findOneAndUpdate(
        {
          razorpayOrderId: orderIdFromPayment,
          status: { $in: ['pending', 'paid'] }, // Only match if not already processed
          $or: [
            { orderIds: { $exists: false } }, // No orderIds field
            { orderIds: { $size: 0 } }, // Empty orderIds array
            { orderIds: null }, // Null orderIds
          ],
        },
        {
          $set: {
            status: 'paid',
            orderIds: [lockValue], // Set temporary lock to prevent other webhooks
          },
        },
        { new: true }, // Return updated document
      )

      // Double-check: If payment intent was already processed, check for existing orders again
      if (!paymentIntent) {
        // Another webhook might have already processed this, check for orders again
        orders = await Order.find({
          razorpayOrderId: orderIdFromPayment,
          paymentGateway: 'razorpay',
        })

        if (orders && orders.length > 0) {
          console.log('[Razorpay Webhook] Orders already created by another webhook', {
            razorpayOrderId: orderIdFromPayment,
            eventType,
            webhookId,
            existingOrderCount: orders.length,
          })
          // Continue to update existing orders with payment details
        } else {
          // Payment intent not found or already processed, skip
          console.log('[Razorpay Webhook] Payment intent not found or already processed', {
            razorpayOrderId: orderIdFromPayment,
            eventType,
            webhookId,
          })
          if (webhookEvent) {
            webhookEvent.status = 'processed'
            webhookEvent.processedAt = new Date()
            await webhookEvent.save()
          }
          return res.status(200).json({ received: true })
        }
      } else if (paymentIntent) {
        // We acquired the lock (atomic update succeeded)
        // Double-check if orders were already created by another webhook (race condition protection)
        orders = await Order.find({
          razorpayOrderId: orderIdFromPayment,
          paymentGateway: 'razorpay',
        })

        if (orders && orders.length > 0) {
          // Orders already exist - another webhook must have created them
          // Clear the lock and use existing orders
          paymentIntent.orderIds = orders.map((o) => o._id as mongoose.Types.ObjectId)
          paymentIntent.status = 'order_created'
          await paymentIntent.save()

          console.log('[Razorpay Webhook] Orders already exist, using existing orders', {
            razorpayOrderId: orderIdFromPayment,
            eventType,
            webhookId,
            existingOrderCount: orders.length,
          })
          // Continue to update existing orders with payment details
        } else {
          // No orders exist, we have the lock - proceed with order creation
          // ENHANCEMENT: Verify payment amount matches payment intent total
          const paymentAmount = paymentEntity?.amount
            ? (paymentEntity.amount as number) / 100 // Convert from paise to rupees
            : null

          if (paymentAmount !== null) {
            const amountDifference = Math.abs(paymentIntent.total - paymentAmount)
            if (amountDifference > 0.01) {
              console.error(
                `[Razorpay Webhook] Amount mismatch detected: Intent=${paymentIntent.total}, Payment=${paymentAmount}, Difference=${amountDifference}`,
                {
                  intentId: paymentIntent._id,
                  razorpayOrderId: orderIdFromPayment,
                  webhookId,
                  intentTotal: paymentIntent.total,
                  paymentAmount,
                  difference: amountDifference,
                },
              )

              // Log to webhook event for audit
              if (webhookEvent) {
                webhookEvent.lastError = `Amount mismatch: Intent=${paymentIntent.total}, Payment=${paymentAmount}`
                webhookEvent.lastErrorAt = new Date()
                await webhookEvent.save()
              }

              // Continue processing but log the discrepancy
              // The payment intent total is authoritative for order creation
              // This helps identify potential issues with payment processing
            } else {
              console.log('[Razorpay Webhook] Amount verification passed', {
                intentId: paymentIntent._id,
                razorpayOrderId: orderIdFromPayment,
                intentTotal: paymentIntent.total,
                paymentAmount,
              })
            }
          } else {
            console.warn('[Razorpay Webhook] Payment amount not available for verification', {
              intentId: paymentIntent._id,
              razorpayOrderId: orderIdFromPayment,
              webhookId,
            })
          }

          console.log('[Razorpay Webhook] Found payment intent, creating order', {
            intentId: paymentIntent._id,
            razorpayOrderId: orderIdFromPayment,
            webhookId,
          })

          // Use retry mechanism - CRITICAL FIX #1
          const result = await retryOrderCreation(
            paymentIntent,
            {
              razorpayPaymentId: paymentId,
              razorpayPaymentMethod: paymentMethod,
              razorpayPaymentDetails: paymentEntity,
            },
            webhookEvent ||
              new WebhookEvent({
                webhookId: webhookId || 'unknown',
                eventType,
                razorpayOrderId: orderIdFromPayment,
                status: 'pending',
                payload: event,
              }),
          )

          if (result.success && result.orders) {
            // Update payment intent
            paymentIntent.status = 'order_created'
            paymentIntent.razorpayPaymentId = paymentId
            paymentIntent.razorpayPaymentMethod = paymentMethod as any
            paymentIntent.razorpayPaymentDetails = paymentEntity
            paymentIntent.orderIds = result.orders.map((o) => o._id)
            await paymentIntent.save()

            orders = result.orders
            console.log('[Razorpay Webhook] Order created from payment intent', {
              orderCount: result.orders.length,
              orderIds: result.orders.map((o) => o._id),
              webhookId,
            })

            // Emit socket event to user
            try {
              const userId = paymentIntent.user.toString()
              io.to(`user:${userId}`).emit('order:created', {
                razorpayOrderId: orderIdFromPayment,
                orderIds: result.orders.map((o) => o._id.toString()),
                orderNumbers: result.orders.map((o) => o.orderNumber),
                timestamp: new Date().toISOString(),
              })
              console.log('[Razorpay Webhook] Socket event emitted to user', {
                userId,
                razorpayOrderId: orderIdFromPayment,
                webhookId,
              })
            } catch (socketError) {
              console.error('[Razorpay Webhook] Error emitting socket event:', socketError)
            }
          } else {
            // Order creation failed after retries - CRITICAL FIX #2
            console.error('[Razorpay Webhook] Order creation failed after retries', {
              error: result.error,
              intentId: paymentIntent._id,
              razorpayOrderId: orderIdFromPayment,
              webhookId,
            })

            // Mark payment intent as paid but order creation failed
            paymentIntent.status = 'paid'
            paymentIntent.razorpayPaymentId = paymentId
            paymentIntent.razorpayPaymentMethod = paymentMethod as any
            paymentIntent.razorpayPaymentDetails = paymentEntity
            await paymentIntent.save()

            // Notify admin - CRITICAL FIX #2
            await notifyAdminOfWebhookFailure(
              webhookId || 'unknown',
              orderIdFromPayment,
              result.error || 'Unknown error',
              (paymentIntent._id as mongoose.Types.ObjectId).toString(),
            )

            return res.status(200).json({
              received: true,
              warning: 'Payment confirmed but order creation failed',
            })
          }
        } // End of "We acquired the lock, proceed with order creation" block
      } else {
        if (webhookEvent) {
          webhookEvent.status = 'processed'
          webhookEvent.processedAt = new Date()
          await webhookEvent.save()
        }
        console.log('[Razorpay Webhook] No payment intent found for Razorpay order ID', {
          razorpayOrderId: orderIdFromPayment,
          eventType,
          webhookId,
        })
        return res.status(200).json({ received: true })
      }
    }

    // Mark webhook event as processed if orders exist
    if (webhookEvent && orders.length > 0) {
      webhookEvent.status = 'processed'
      webhookEvent.processedAt = new Date()
      webhookEvent.orderIds = orders.map((o) => o._id as mongoose.Types.ObjectId)
      await webhookEvent.save()
    }

    // Process each order (handle split orders scenario)
    for (const order of orders) {
      // Idempotency check: Only update if payment status is not already 'paid' - CRITICAL FIX #3
      if (order.paymentStatus === 'paid') {
        console.log(
          `[Razorpay Webhook] Order ${order.orderNumber} already marked as paid. Skipping update.`,
          { webhookId, orderId: order._id },
        )
        continue
      }

      console.log(`[Razorpay Webhook] Updating order ${order.orderNumber} to paid`, {
        orderId: order._id,
        razorpayOrderId: orderIdFromPayment,
        paymentId,
        paymentMethod,
        webhookId,
      })

      order.paymentStatus = 'paid'
      order.sellerShipments.forEach((shipment) => {
        shipment.paymentStatus = 'paid'
      })
      order.markModified('sellerShipments')

      // Update payment details if missing (backfill from webhook)
      if (paymentId && !order.razorpayPaymentId) {
        order.razorpayPaymentId = paymentId
      }

      if (paymentMethod && !order.razorpayPaymentMethod) {
        order.razorpayPaymentMethod = paymentMethod as
          | 'card'
          | 'upi'
          | 'wallet'
          | 'paylater'
          | 'netbanking'
      }

      if (paymentEntity && !order.razorpayPaymentDetails) {
        const paymentDetails: any = {
          method: paymentEntity.method || null,
          card: paymentEntity.card
            ? {
                last4: paymentEntity.card.last4 || null,
                network: paymentEntity.card.network || null,
                issuer: paymentEntity.card.issuer || null,
                type: paymentEntity.card.type || null,
              }
            : undefined,
          upi: paymentEntity.upi
            ? {
                vpa: paymentEntity.upi.vpa || null,
                payer_account_type: paymentEntity.upi.payer_account_type || null,
              }
            : undefined,
          wallet: paymentEntity.wallet
            ? {
                wallet_name: paymentEntity.wallet.name || null,
              }
            : undefined,
          paylater: paymentEntity.provider
            ? {
                provider: paymentEntity.provider || null,
              }
            : undefined,
          netbanking: paymentEntity.bank
            ? {
                bank: paymentEntity.bank || null,
              }
            : undefined,
          bank: paymentEntity.bank || null,
          contact: paymentEntity.contact || null,
          email: paymentEntity.email || null,
          international: paymentEntity.international || false,
          notes: paymentEntity.notes || {},
        }
        order.razorpayPaymentDetails = paymentDetails
      }

      await order.save()
      console.log(`[Razorpay Webhook] Successfully updated order ${order.orderNumber}`, {
        orderId: order._id,
        webhookId,
      })

      // Emit socket event for order payment update
      try {
        const userId = order.user.toString()
        io.to(`user:${userId}`).emit('order:payment_confirmed', {
          orderId: (order._id as mongoose.Types.ObjectId).toString(),
          orderNumber: order.orderNumber,
          razorpayOrderId: orderIdFromPayment,
          paymentStatus: 'paid',
          timestamp: new Date().toISOString(),
        })
      } catch (socketError) {
        console.error('[Razorpay Webhook] Error emitting payment confirmed event:', socketError)
        // Don't fail webhook if socket fails
      }
    }

    return res.status(200).json({ received: true })
  } catch (error) {
    console.error('[Razorpay Webhook] Error processing webhook:', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      webhookId,
      eventTimestamp,
    })
    return res.status(500).json({ success: false })
  }
}

export const getWebhookEvents = async (req: Request, res: Response) => {
  try {
    const {
      page = '1',
      limit = '50',
      status,
      eventType,
      razorpayOrderId,
      webhookId,
      startDate,
      endDate,
    } = req.query

    const pageNum = parseInt(page as string, 10)
    const limitNum = parseInt(limit as string, 10)
    const skip = (pageNum - 1) * limitNum

    // Build filter query
    const filter: FilterQuery<IWebhookEvent> = {}

    if (status) {
      filter.status = status as string
    }

    if (eventType) {
      filter.eventType = { $regex: eventType as string, $options: 'i' }
    }

    if (razorpayOrderId) {
      filter.razorpayOrderId = razorpayOrderId as string
    }

    if (webhookId) {
      filter.webhookId = { $regex: webhookId as string, $options: 'i' }
    }

    if (startDate || endDate) {
      filter.createdAt = {} as any
      if (startDate) {
        ;(filter.createdAt as any).$gte = new Date(startDate as string)
      }
      if (endDate) {
        ;(filter.createdAt as any).$lte = new Date(endDate as string)
      }
    }

    // Fetch webhook events with pagination
    const [events, total] = await Promise.all([
      WebhookEvent.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('orderIds', 'orderNumber totalAmount paymentStatus')
        .lean(),
      WebhookEvent.countDocuments(filter),
    ])

    // Get status counts for summary
    const statusCounts = await WebhookEvent.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ])

    const statusSummary = {
      pending: 0,
      processed: 0,
      failed: 0,
      retrying: 0,
    }

    statusCounts.forEach((item) => {
      if (item._id in statusSummary) {
        statusSummary[item._id as keyof typeof statusSummary] = item.count
      }
    })

    return res.status(200).json({
      success: true,
      data: {
        events,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
        summary: statusSummary,
      },
    })
  } catch (error) {
    console.error('[Webhook Events] Error fetching webhook events:', error)
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch webhook events',
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
