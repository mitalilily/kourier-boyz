import { Response } from 'express'
import { createB2CShipmentService } from '../models/services/shiprocket.service'
import {
  appendReversePickupTags,
  assertReversePickupAllowed,
  quoteReverseForOrder,
} from '../models/services/reverse.service'

const getOriginalOrderId = (body: Record<string, any>) =>
  String(body?.original_order_id || body?.order_id || body?.orderId || '').trim()

export const createReversePickup = async (req: any, res: Response) => {
  try {
    const userId = req.user?.sub
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' })

    const body = req.body || {}
    const originalOrderId = getOriginalOrderId(body)
    if (!originalOrderId) {
      return res.status(400).json({ success: false, message: 'Original order ID is required' })
    }

    await assertReversePickupAllowed(originalOrderId, userId)
    const quote = await quoteReverseForOrder(originalOrderId, Number(body?.package_weight), userId)
    const reverseCharge = Number(quote.rate || 0)
    if (!Number.isFinite(reverseCharge) || reverseCharge <= 0) {
      return res.status(400).json({
        success: false,
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

    const shipment = await createB2CShipmentService(payload, userId)
    res.status(200).json({ success: true, shipment })
  } catch (error: any) {
    const statusCode = typeof error?.statusCode === 'number' ? error.statusCode : 400
    res.status(statusCode).json({ success: false, message: error.message })
  }
}

export const quoteReverse = async (req: any, res: Response) => {
  try {
    const userId = req.user?.sub
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' })

    const { orderId, weightGrams } = req.body
    if (!orderId) return res.status(400).json({ success: false, message: 'orderId required' })

    await assertReversePickupAllowed(String(orderId), userId)
    const quote = await quoteReverseForOrder(
      String(orderId),
      weightGrams ? Number(weightGrams) : undefined,
      userId,
    )
    return res.json({ success: true, quote })
  } catch (e: any) {
    return res.status(400).json({ success: false, message: e.message })
  }
}
