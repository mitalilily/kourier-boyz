import { Request, Response } from 'express'
import {
  fetchAvailableCouriersWithRates,
  trackByAwbService,
  trackByOrderService,
} from '../models/services/shiprocket.service'
import { getOpaqueProviderCode } from '../utils/externalApiHelpers'
import { extractOrderAmountFromBody } from '../utils/orderAmount'

const mapPublicRates = (couriers: any[]) =>
  (couriers ?? []).map((courier: any) => ({
    courier_option_key: courier.courier_option_key || null,
    courier_id: courier.id,
    courier_name: courier.displayName || courier.name,
    rate: courier.rate || courier.freight_charges || courier.charge || 0,
    chargeable_weight_g: courier.chargeable_weight ?? null,
    volumetric_weight_g: courier.volumetric_weight ?? null,
    slabs: courier.slabs ?? null,
    max_slab_weight: courier.max_slab_weight ?? null,
    estimated_delivery_days: courier.estimated_delivery_days || courier.tat || '3-5',
    estimated_delivery_date: courier.estimated_delivery_date ?? null,
    serviceable: courier.serviceable !== false,
    cod_available: courier.cod_available !== false,
    zone:
      courier.zone ??
      courier.zone_name ??
      courier.approxZone?.name ??
      courier.zone_code ??
      courier.approxZone?.code ??
      null,
    provider_code: getOpaqueProviderCode(courier.integration_type),
  }))

export const getPublicTrackingController = async (req: Request, res: Response) => {
  try {
    const { awb, orderNumber, contact } = req.query

    let awbNumber: string | undefined = awb ? String(awb) : undefined

    if (!awbNumber && orderNumber && contact) {
      const contactStr = String(contact).trim()
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactStr)
      const isPhone = /^\d{7,15}$/.test(contactStr)

      if (!isEmail && !isPhone) {
        return res.status(400).json({
          success: false,
          message: 'Contact must be a valid email or phone number',
        })
      }

      const orderData = await trackByOrderService({
        orderNumber: String(orderNumber),
        email: isEmail ? contactStr : undefined,
        phone: isPhone ? contactStr : undefined,
      })

      awbNumber = orderData?.awb_number ?? ''
      if (!awbNumber) {
        return res.status(404).json({
          success: false,
          message: 'AWB number not found for this order',
        })
      }
    }

    if (!awbNumber) {
      return res.status(400).json({
        success: false,
        message: "Provide either 'awb' or ('orderNumber' with 'contact')",
      })
    }

    const trackingData = await trackByAwbService(awbNumber)
    return res.status(200).json({ success: true, data: trackingData })
  } catch (error: any) {
    console.error('Public tracking error:', error)
    return res.status(500).json({
      success: false,
      message: error?.message || 'Failed to fetch tracking information',
    })
  }
}

export const getPublicShippingRatesController = async (req: Request, res: Response) => {
  try {
    const {
      origin,
      destination,
      payment_type = 'prepaid',
      shipment_type = 'b2c',
      weight = 500,
      length = 10,
      breadth = 10,
      height = 10,
    } = req.body ?? {}

    if (shipment_type && shipment_type !== 'b2c') {
      return res.status(400).json({
        success: false,
        message: 'Public shipping rates currently support B2C only.',
      })
    }

    if (!origin || !destination) {
      return res.status(400).json({
        success: false,
        message: 'origin and destination pincodes are required',
      })
    }

    const orderAmountResult = extractOrderAmountFromBody(req.body ?? {})
    if (orderAmountResult.invalid) {
      return res.status(400).json({
        success: false,
        message: 'order_amount must be numeric and non-negative',
      })
    }

    const couriers = await fetchAvailableCouriersWithRates(
      {
        origin: Number(origin),
        destination: Number(destination),
        payment_type,
        shipment_type: 'b2c',
        order_amount: orderAmountResult.value,
        weight: Number(weight),
        length: Number(length),
        breadth: Number(breadth),
        height: Number(height),
        isCalculator: true,
      },
      { planFallbackName: 'Basic' },
    )

    return res.status(200).json({
      success: true,
      data: {
        rates: mapPublicRates(couriers),
        origin_pincode: Number(origin),
        destination_pincode: Number(destination),
        payment_type,
        shipment_type: 'b2c',
      },
    })
  } catch (error: any) {
    console.error('Public shipping rates error:', error)
    return res.status(500).json({
      success: false,
      message: error?.message || 'Failed to fetch shipping rates',
    })
  }
}
