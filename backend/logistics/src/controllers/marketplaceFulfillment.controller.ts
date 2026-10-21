import { and, eq } from 'drizzle-orm'
import type { Request, Response } from 'express'
import { db } from '../models/client'
import { b2c_orders } from '../models/schema/b2cOrders'
import { bookExistingB2COrderWithCourierService } from '../models/services/shiprocket.service'

const text = (value: unknown, fallback = '') => String(value ?? fallback).trim()
const number = (value: unknown, fallback: number) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export const createMarketplaceDraft = async (req: Request, res: Response) => {
  const payload = req.body || {}
  const userId = text(payload.logisticsUserId)
  const marketplaceOrderId = text(payload.marketplaceOrderId)
  if (!userId || !marketplaceOrderId || !payload.buyer || !Array.isArray(payload.products)) {
    return res.status(400).json({ success: false, message: 'Seller, marketplace order, buyer, and products are required' })
  }

  try {
    const [existing] = await db
      .select()
      .from(b2c_orders)
      .where(
        and(
          eq(b2c_orders.user_id, userId),
          eq(b2c_orders.source, 'marketplace'),
          eq(b2c_orders.source_order_id, marketplaceOrderId),
        ),
      )
      .limit(1)

    if (existing) return res.json({ success: true, data: existing, reused: true })

    const buyer = payload.buyer
    const parcel = payload.package || {}
    const orderNumber = text(payload.orderNumber, `KBM-${marketplaceOrderId.slice(-16).toUpperCase()}`).slice(0, 50)
    const [draft] = await db
      .insert(b2c_orders)
      .values({
        user_id: userId,
        order_number: orderNumber,
        order_date: text(payload.orderDate, new Date().toISOString()),
        order_amount: number(payload.orderAmount, 0),
        order_id: `marketplace_${marketplaceOrderId}`.slice(0, 100),
        invoice_number: orderNumber,
        invoice_date: new Date().toISOString().slice(0, 10),
        invoice_amount: number(payload.orderAmount, 0),
        buyer_name: text(buyer.name, 'Marketplace buyer'),
        buyer_phone: text(buyer.phone),
        buyer_email: text(buyer.email) || null,
        address: text(buyer.address),
        city: text(buyer.city),
        state: text(buyer.state),
        country: text(buyer.country, 'India'),
        pincode: text(buyer.pincode),
        products: payload.products,
        weight: number(parcel.weight, 0.5),
        length: number(parcel.length, 10),
        breadth: number(parcel.breadth ?? parcel.width, 10),
        height: number(parcel.height, 10),
        order_type: text(payload.paymentType).toLowerCase() === 'cod' ? 'cod' : 'prepaid',
        prepaid_amount: text(payload.paymentType).toLowerCase() === 'cod' ? 0 : number(payload.orderAmount, 0),
        shipping_charges: Number(payload.shippingCharges || 0),
        discount: Number(payload.discount || 0),
        gift_wrap: Number(payload.giftWrap || 0),
        order_status: 'marketplace_pending_pack',
        pickup_status: 'pending',
        integration_type: 'marketplace',
        is_external_api: false,
        source: 'marketplace',
        source_order_id: marketplaceOrderId,
        source_seller_id: text(payload.marketplaceSellerId),
        source_meta: { batchCode: payload.batchCode || null, marketplaceShipmentId: payload.marketplaceShipmentId || null },
        tags: 'kourier_boyz_marketplace',
      })
      .returning()

    return res.status(201).json({ success: true, data: draft, reused: false })
  } catch (error: any) {
    console.error('Marketplace fulfillment draft failed', error)
    return res.status(500).json({ success: false, message: error?.message || 'Could not create courier draft' })
  }
}

export const bookMarketplaceDraft = async (req: Request, res: Response) => {
  const userId = text(req.body?.logisticsUserId)
  if (!userId) return res.status(400).json({ success: false, message: 'Seller courier account is required' })

  try {
    const consignee = req.body?.consignee || {}
    await db
      .update(b2c_orders)
      .set({
        ...(Array.isArray(req.body?.order_items) && req.body.order_items.length
          ? { products: req.body.order_items }
          : {}),
        ...(Number(req.body?.order_amount) > 0
          ? { order_amount: Number(req.body.order_amount), invoice_amount: Number(req.body.order_amount) }
          : {}),
        ...(Number(req.body?.package_weight) > 0 ? { weight: Number(req.body.package_weight) } : {}),
        ...(Number(req.body?.package_length) > 0 ? { length: Number(req.body.package_length) } : {}),
        ...(Number(req.body?.package_breadth) > 0 ? { breadth: Number(req.body.package_breadth) } : {}),
        ...(Number(req.body?.package_height) > 0 ? { height: Number(req.body.package_height) } : {}),
        ...(req.body?.shipping_charges !== undefined
          ? { shipping_charges: Number(req.body.shipping_charges) || 0 }
          : {}),
        ...(req.body?.discount !== undefined ? { discount: Number(req.body.discount) || 0 } : {}),
        ...(req.body?.gift_wrap !== undefined ? { gift_wrap: Number(req.body.gift_wrap) || 0 } : {}),
        ...(consignee.name ? { buyer_name: text(consignee.name) } : {}),
        ...(consignee.phone ? { buyer_phone: text(consignee.phone) } : {}),
        ...(consignee.email ? { buyer_email: text(consignee.email) } : {}),
        ...(consignee.address ? { address: text(consignee.address) } : {}),
        ...(consignee.city ? { city: text(consignee.city) } : {}),
        ...(consignee.state ? { state: text(consignee.state) } : {}),
        ...(consignee.pincode ? { pincode: text(consignee.pincode) } : {}),
        updated_at: new Date(),
      })
      .where(and(eq(b2c_orders.id, req.params.orderId), eq(b2c_orders.user_id, userId)))

    const result = await bookExistingB2COrderWithCourierService(req.params.orderId, userId, req.body)
    const order = result.order as any
    return res.json({
      success: true,
      data: {
        order_id: order?.id,
        order_number: order?.order_number,
        awb_number: order?.awb_number,
        status: order?.order_status || 'booked',
        label: order?.label,
        courier_partner: order?.courier_partner,
        createManifest: Boolean(order?.manifest),
      },
    })
  } catch (error: any) {
    const status = typeof error?.statusCode === 'number' ? error.statusCode : 500
    return res.status(status).json({ success: false, message: error?.message || 'Could not book courier draft' })
  }
}
