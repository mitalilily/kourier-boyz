import { Request, Response } from 'express'
import Order from '../models/Order'
import { shippingProviderService } from '../services/shippingProvider.service'

/**
 * Public tracking endpoint - can be accessed without authentication
 * GET /api/tracking/:identifier
 * identifier can be AWB number or order number
 */
export const trackOrder = async (req: Request, res: Response) => {
  try {
    const { identifier } = req.params

    if (!identifier) {
      return res.status(400).json({
        success: false,
        message: 'Tracking identifier (AWB or Order Number) is required',
      })
    }

    // Try to find order by order number first
    let order = await Order.findOne({ orderNumber: identifier })
      .populate('user', 'name email phone')
      .lean()

    // If not found by order number, try to find by AWB in shipments
    if (!order) {
      order = await Order.findOne({
        $or: [
          { 'sellerShipments.shippingMeta.awb': identifier },
          { 'sellerShipments.courierCart.awb_number': identifier },
        ],
      })
        .populate('user', 'name email phone')
        .lean()
    }

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found with the provided identifier',
      })
    }

    // Find the shipment with matching AWB or use first shipment
    const shipment =
      (order.sellerShipments || []).find(
        (s: any) => s.shippingMeta?.awb === identifier || s.courierCart?.awb_number === identifier,
      ) || (order.sellerShipments || [])[0]

    if (!shipment) {
      return res.status(404).json({
        success: false,
        message: 'Shipment not found',
      })
    }

    const awb = shipment.shippingMeta?.awb || shipment.courierCart?.awb_number

    if (!awb) {
      console.warn(
        `[trackOrder] AWB not available for identifier: ${identifier}, order: ${order.orderNumber}`,
      )
      return res.status(400).json({
        success: false,
        message: 'AWB number not available for this order',
      })
    }

    console.log(
      `[trackOrder] Tracking order - Identifier: ${identifier}, Order: ${order.orderNumber}, AWB: ${awb}`,
    )

    // Fetch tracking from the active shipping provider
    let providerTracking = null
    try {
      providerTracking = await shippingProviderService.trackShipment({ awb })
      const eventCount = providerTracking?.data?.tracking_events?.length || 0
      console.log(
        `[trackOrder] Successfully fetched shipping provider tracking for AWB ${awb} - Events: ${eventCount}`,
      )
      console.log(
        `[trackOrder] Full shipping provider response for AWB ${awb}:`,
        JSON.stringify(providerTracking, null, 2),
      )
    } catch (error: any) {
      console.error(`[trackOrder] Failed to fetch shipping provider tracking for AWB ${awb}:`, {
        error: error.message,
        identifier,
        orderNumber: order.orderNumber,
        response: error.response?.data,
      })
      // Continue even if provider tracking fails
    }

    // Prepare response with combined data
    const response: any = {
      success: true,
      data: {
        order: {
          _id: order._id,
          orderNumber: order.orderNumber,
          status: order.status,
          createdAt: order.createdAt,
          shippingAddress: order.shippingAddress,
        },
        shipment: {
          _id: shipment._id,
          status: shipment.status,
          awb: awb,
          courier: shipment.shippingMeta?.courier || undefined,
          trackingEvents: shipment.trackingEvents || [],
        },
        courierCart: providerTracking?.data || null,
        shippingProvider: providerTracking?.data || null,
      },
    }

    res.json(response)
  } catch (error: any) {
    console.error('[trackOrder] Error:', error)
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch tracking information',
    })
  }
}
