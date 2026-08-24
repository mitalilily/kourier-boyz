import { eq } from 'drizzle-orm'
import { Response } from 'express'
import { db } from '../../models/client'
import {
  appendReversePickupTags,
  assertReversePickupAllowed,
  quoteReverseForOrder,
} from '../../models/services/reverse.service'
import { createB2CShipmentService } from '../../models/services/shiprocket.service'
import { b2c_orders } from '../../schema/schema'
import { sendWebhookEvent } from '../../services/webhookDelivery.service'
import { getOrderLabelReference } from '../../utils/orderLabels'

const getOriginalOrderId = (body: Record<string, any>) =>
  String(body?.original_order_id || body?.order_id || body?.orderId || '').trim()

/**
 * Create a return order (reverse pickup)
 * POST /api/v1/returns
 */
export const createReturnOrderController = async (req: any, res: Response) => {
  try {
    const userId = req.userId
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Valid API key is required',
      })
    }

    const body = req.body || {}
    const originalOrderId = getOriginalOrderId(body)
    if (!originalOrderId) {
      return res.status(400).json({
        success: false,
        error: 'Missing original order',
        message: 'original_order_id is required',
      })
    }

    await assertReversePickupAllowed(originalOrderId, userId)
    const quote = await quoteReverseForOrder(originalOrderId, Number(body?.package_weight), userId)
    const reverseCharge = Number(quote.rate || 0)
    if (!Number.isFinite(reverseCharge) || reverseCharge <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Rate unavailable',
        message: 'No reverse pickup rate available for this order',
      })
    }

    const payload = {
      ...body,
      original_order_id: originalOrderId,
      payment_type: 'reverse',
      package_weight: Number(quote.weightGrams || 0) / 1000,
      shipping_charges: reverseCharge,
      freight_charges: reverseCharge,
      selected_max_slab_weight: quote.max_slab_weight ?? undefined,
      courier_id: body.courier_id ?? quote.courierId,
      tags: appendReversePickupTags(body.tags, originalOrderId),
    }

    const result = await createB2CShipmentService(payload, userId)
    const { order: newOrder, shipment: shipmentData } = result

    // Fetch the full order data
    const [order] = await db
      .select()
      .from(b2c_orders)
      .where(eq(b2c_orders.id, newOrder.id))
      .limit(1)

    if (!order) {
      return res.status(500).json({
        success: false,
        error: 'Return order creation failed',
        message: 'Return order was created but could not be retrieved',
      })
    }

    // 🔔 Send webhook event for return order creation
    sendWebhookEvent(userId, 'order.return_created', {
      order_id: order.id,
      order_number: order.order_number,
      awb_number: order.awb_number,
      original_order_id: originalOrderId,
      status: order.order_status || 'booked',
      reverse_charge: reverseCharge,
      shipment_data: shipmentData,
    }).catch((err) => {
      console.error('Failed to send return order webhook:', err)
    })

    res.status(201).json({
      success: true,
      message: 'Return order created successfully',
      data: {
        order_id: order.id,
        order_number: order.order_number,
        awb_number: order.awb_number,
        status: order.order_status || 'booked',
        reverse_charge: reverseCharge,
        label: getOrderLabelReference(order),
        courier_partner: order.courier_partner,
      },
    })
  } catch (error: any) {
    console.error('Error creating return order via API:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to create return order',
      message: error.message || 'Internal server error',
    })
  }
}

/**
 * Get quote for return order
 * GET /api/v1/returns/quote
 */
export const getReturnQuoteController = async (req: any, res: Response) => {
  try {
    const userId = req.userId
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Valid API key is required',
      })
    }

    const { orderId, weightGrams } = req.query as { orderId?: string; weightGrams?: string }

    if (!orderId) {
      return res.status(400).json({
        success: false,
        error: 'Missing parameter',
        message: 'orderId is required',
      })
    }

    await assertReversePickupAllowed(orderId, userId)
    const quote = await quoteReverseForOrder(
      orderId,
      weightGrams ? Number(weightGrams) : undefined,
      userId,
    )

    res.status(200).json({
      success: true,
      data: quote,
    })
  } catch (error: any) {
    console.error('Error getting return quote via API:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get return quote',
      message: error.message || 'Internal server error',
    })
  }
}
