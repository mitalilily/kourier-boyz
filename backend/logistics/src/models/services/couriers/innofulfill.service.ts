import { HttpError } from '../../../utils/classes'
import type { ShipmentParams } from '../shiprocket.service'
import {
  calculateInnofulfillEcommRates,
  createInnofulfillOrder,
  getInnofulfillOrder,
  normalizeInnofulfillOrderDate,
  trackInnofulfillShipmentByAwb,
} from '../innofulfill.service'
import {
  getEffectiveCourierConfig,
  InnofulfillConfig,
} from '../courierCredentials.service'

const INNOFULFILL_ECOMM_CARRIER_ID = '30d5f835-a63a-4125-b095-93b3098e4e3d'
const INNOFULFILL_ECOMM_CARRIER_NAME = 'innofulfill_ecomm'
const INNOFULFILL_HYPERLOCAL_CARRIER_NAME = 'innofulfillHyperlocal'

const trim = (value: unknown) => String(value ?? '').trim()
const numberValue = (value: unknown, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}
const kgFromMaybeGrams = (value: unknown) => {
  const parsed = numberValue(value)
  if (parsed > 50) return parsed / 1000
  return parsed
}
const upper = (value: unknown) => trim(value).toUpperCase()

const firstPayloadData = (response: any) => response?.data?.data ?? response?.data ?? response

export class InnofulfillCourierService {
  private configPromise: Promise<InnofulfillConfig | null> | null = null

  private async getConfig() {
    if (!this.configPromise) {
      this.configPromise = getEffectiveCourierConfig<InnofulfillConfig>('innofulfill', 'b2c')
    }

    const stored = await this.configPromise
    const metadataConfig = stored || {}
    return {
      apiBase: trim(metadataConfig.apiBase || process.env.INNOFULFILL_API_BASE || 'https://apis.innofulfill.com'),
      apiKey: trim(metadataConfig.apiKey || process.env.INNOFULFILL_API_KEY),
      username: trim(metadataConfig.username || process.env.INNOFULFILL_USERNAME),
      password: trim(metadataConfig.password || process.env.INNOFULFILL_PASSWORD),
      tenantId: trim(metadataConfig.tenantId || process.env.INNOFULFILL_TENANT_ID),
      userId: trim(metadataConfig.userId || process.env.INNOFULFILL_USER_ID),
      signinType: trim(metadataConfig.signinType || process.env.INNOFULFILL_SIGNIN_TYPE || 'EMAIL') || 'EMAIL',
      webhookSecret: trim(metadataConfig.webhookSecret || process.env.INNOFULFILL_WEBHOOK_SIGNATURE_KEY),
    }
  }

  private async getAuthHeaders() {
    const config = await this.getConfig()
    if (!config.apiKey && !(config.tenantId && config.username && config.password)) {
      throw new HttpError(400, 'Shreemaruti credentials are not configured')
    }

    const headers: Record<string, string> = {}
    if (config.apiKey) {
      headers['Api-Key'] = config.apiKey
      headers['api-key'] = config.apiKey
    }
    if (config.tenantId) {
      headers.TenantId = config.tenantId
      headers.tenantid = config.tenantId
    }
    return headers
  }

  async calculateB2CRate(params: Partial<ShipmentParams> & Record<string, any>, options: { hyperlocal?: boolean } = {}) {
    const hyperlocal = options.hyperlocal === true
    const payload = {
      fromPincode: Number(trim(params.origin ?? params.pickup?.pincode ?? params.pickup_pincode)),
      toPincode: Number(trim(params.destination ?? params.consignee?.pincode ?? params.destination_pincode)),
      serviceType: hyperlocal ? 'HYPERLOCAL' as const : 'ECOMM' as const,
      productType: hyperlocal ? 'HYPERLOCAL' as const : 'ECOMM' as const,
      weight: kgFromMaybeGrams(params.package_weight ?? params.weight),
      length: numberValue(params.package_length ?? params.length),
      height: numberValue(params.package_height ?? params.height),
      width: numberValue(params.package_breadth ?? params.breadth),
      ...(hyperlocal ? { distance: numberValue((params as any).distance, 1) } : {}),
      includeDefaultCharges: true,
      userOptions: {},
      filters: hyperlocal
        ? ({} as Record<string, never>)
        : { delivery_mode: upper(params.shipping_mode) === 'AIR' ? 'AIR' as const : 'SURFACE' as const },
    }

    const response = await calculateInnofulfillEcommRates(payload, await this.getAuthHeaders())
    if (response.status < 200 || response.status >= 300) {
      throw new HttpError(response.status, response.data?.message || 'Shreemaruti rate calculation failed')
    }

    return response.data
  }

  async createB2COrder(params: ShipmentParams, options: { hyperlocal?: boolean } = {}) {
    const hyperlocal = options.hyperlocal === true
    const paymentType = trim(params.payment_type).toLowerCase() === 'cod' ? 'COD' : 'PREPAID'
    const pickup = params.pickup || ({} as ShipmentParams['pickup'])
    const consignee = params.consignee || ({} as ShipmentParams['consignee'])
    const rto = params.rto || pickup
    const orderItems = Array.isArray(params.order_items) && params.order_items.length
      ? params.order_items
      : [{ name: 'Item', sku: '', qty: 1, price: numberValue(params.order_amount), hsn: '', discount: 0, tax_rate: 0 }]
    const amount = numberValue(params.order_amount)
    const payload = {
      referenceId: trim(params.order_number),
      orderDate: normalizeInnofulfillOrderDate(params.order_date),
      orderType: params.isReverse === true || trim(params.payment_type).toLowerCase() === 'reverse' ? 'REVERSE' : 'FORWARD',
      orderStatus: 'CONFIRMED',
      parcelCategory: hyperlocal ? 'HYPERLOCAL' : 'ECOMM',
      autoManifest: true,
      eWaybills: [params.ewbn, params.ewb, params.ewbn_number, params.ewaybill_number].map(trim).filter(Boolean),
      deliveryPromise: hyperlocal ? 'HYPERLOCAL' : 'ECOMM',
      deliveryMode: hyperlocal ? '' : (upper(params.shipping_mode) === 'AIR' ? 'AIR' : 'SURFACE'),
      documentType: '',
      taxes: [],
      discounts: [],
      metadata: {
        source: 'kourier_boyz_b2c',
        local_order_number: trim(params.order_number),
      },
      documents: [],
      addresses: [
        this.buildAddress('PICKUP', pickup),
        this.buildAddress('DELIVERY', consignee),
        this.buildAddress('BILLING', consignee),
        this.buildAddress('RETURN', rto),
      ],
      shipments: [
        {
          dimensions: {
            length: numberValue(params.package_length ?? params.length),
            width: numberValue(params.package_breadth ?? params.breadth),
            height: numberValue(params.package_height ?? params.height),
          },
          shipmentStatus: 'CONFIRMED',
          awbNumber: '',
          physicalWeight: kgFromMaybeGrams(params.package_weight ?? params.weight),
          physicalWeightUnit: 'KG',
          volumetricWeight: numberValue((params as any).volumetricWeight),
          note: trim(params.tags),
          items: orderItems.map((item) => ({
            name: trim(item.name) || 'Item',
            quantity: numberValue(item.quantity ?? item.qty, 1),
            unitPrice: numberValue(item.price),
            sku: trim(item.sku),
            hsnCode: trim(item.hsnCode || item.hsn),
            description: trim((item as any).description || item.name) || 'Item',
          })),
        },
      ],
      ...(hyperlocal
        ? { carrierName: INNOFULFILL_HYPERLOCAL_CARRIER_NAME }
        : { carrierId: INNOFULFILL_ECOMM_CARRIER_ID, carrierName: INNOFULFILL_ECOMM_CARRIER_NAME }),
      payment: {
        type: paymentType,
        currency: 'INR',
        paymentMethod: 'ONLINE',
        ...(paymentType === 'COD' ? { collectableAmount: amount } : {}),
        customerCharges: [{ chargeKey: 'end_customer', chargeValue: 0, breakup: [] }],
        breakdown: {},
      },
    }

    const response = await createInnofulfillOrder(payload, await this.getAuthHeaders())
    if (response.status < 200 || response.status >= 300) {
      throw new HttpError(response.status, response.data?.message || 'Shreemaruti order creation failed')
    }

    return response.data
  }

  async getOrder(orderId: string) {
    const response = await getInnofulfillOrder(orderId, await this.getAuthHeaders())
    if (response.status < 200 || response.status >= 300) {
      throw new HttpError(response.status, response.data?.message || 'Shreemaruti order fetch failed')
    }
    return response.data
  }

  async trackByAwb(awb: string) {
    const response = await trackInnofulfillShipmentByAwb(awb, await this.getAuthHeaders())
    if (response.status < 200 || response.status >= 300) {
      throw new HttpError(response.status, response.data?.message || 'Shreemaruti tracking failed')
    }
    return response.data
  }

  extractShipmentMeta(raw: any) {
    const order = firstPayloadData(raw)
    const shipment = Array.isArray(order?.shipments) ? order.shipments[0] : {}
    return {
      order,
      shipment,
      orderId: trim(order?.orderId),
      awb: trim(shipment?.awbNumber || order?.awbNumber),
      carrierName: trim(order?.carrierDisplayName || order?.carrierName || 'Shreemaruti'),
      carrierId: trim(order?.carrierId),
      status: trim(order?.orderStatus || shipment?.shipmentStatus || 'booked'),
    }
  }

  getRateAmounts(raw: any) {
    const data = firstPayloadData(raw)
    const calculation = data?.calculation || {}
    const pricing = data?.pricing || {}
    return {
      freight: numberValue(pricing.baseRate ?? calculation.baseAmount),
      total: numberValue(calculation.totalAmount ?? pricing.totalAmount ?? pricing.baseRate),
      otherCharges: Math.max(0, numberValue(calculation.totalAmount) - numberValue(pricing.baseRate ?? calculation.baseAmount)),
      chargeableWeightKg: numberValue(data?.weightCalculation?.finalWeight),
      raw: data,
    }
  }

  private buildAddress(type: string, source: Record<string, any>) {
    return {
      type,
      zip: trim(source.pincode || source.zip),
      name: trim(source.name || source.warehouse_name || source.company_name),
      phone: trim(source.phone),
      email: trim(source.email),
      street: trim(source.address || source.street),
      landmark: trim(source.address_2 || source.landmark),
      city: trim(source.city),
      state: trim(source.state),
      country: trim(source.country || 'India'),
      addressName: trim(source.addressName || source.address || source.warehouse_name),
      GSTNumber: trim(source.gstin || source.gst_number),
    }
  }
}
