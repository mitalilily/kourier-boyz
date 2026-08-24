import axios, { AxiosInstance } from 'axios'
import { HttpError } from '../../../utils/classes'
import { DtdcConfig, getEffectiveCourierConfig } from '../courierCredentials.service'
import type { ShipmentParams } from '../shiprocket.service'

const DTDC_TRACKING_BASE_URL = 'https://blktracksvc.dtdc.com'
const DTDC_TRACKING_ENDPOINT = '/dtdc-api/rest/JSONCnTrk/getTrackDetails'
const DTDC_BOOKING_BASE_URL = 'https://dtdcapi.shipsy.io'
const DTDC_CANCEL_BASE_URL = 'https://dtdcapi.shipsy.io'
const DTDC_CANCEL_ENDPOINT = '/api/customer/integration/consignment/cancel'
const DTDC_SHIPSY_TRACK_ENDPOINT = '/api/customer/integration/consignment/track'
const DTDC_SHIPSY_LABEL_STREAM_ENDPOINT = '/api/customer/integration/consignment/shippinglabel/stream'
const DTDC_SOFTDATA_ENDPOINT = '/api/customer/integration/consignment/softdata'
const DTDC_SURFACE_SERVICE_TYPE_ID = 'B2C SMART EXPRESS'
const DTDC_AIR_SERVICE_TYPE_ID = 'B2C PRIORITY'
const DTDC_SURFACE_COURIER_ID = 4001
const DTDC_AIR_COURIER_ID = 4002

export class DtdcService {
  private apiBase = process.env.DTDC_API_BASE || DTDC_TRACKING_BASE_URL
  private bookingApiBase = process.env.DTDC_BOOKING_API_BASE || process.env.DTDC_SOFTDATA_API_BASE || DTDC_BOOKING_BASE_URL
  private cancelApiBase = process.env.DTDC_CANCEL_API_BASE || DTDC_CANCEL_BASE_URL
  private accessToken = process.env.DTDC_ACCESS_TOKEN || process.env.DTDC_API_KEY || ''
  private trackingToken = process.env.DTDC_TRACKING_TOKEN || ''
  private username = process.env.DTDC_USERNAME || ''
  private password = process.env.DTDC_PASSWORD || ''
  private customerCode = process.env.DTDC_CUSTOMER_CODE || ''
  private serviceTypeId = process.env.DTDC_SERVICE_TYPE_ID || 'B2C PRIORITY'
  private commodityId = process.env.DTDC_COMMODITY_ID || '99'
  private hubCode = process.env.DTDC_HUB_CODE || ''
  private pickupVendorCode = process.env.DTDC_PICKUP_VENDOR_CODE || ''
  private static cachedConfig: DtdcConfig | null | undefined
  private static cachedAccessToken: string | null = null

  static clearCachedConfig() {
    DtdcService.cachedConfig = undefined
    DtdcService.cachedAccessToken = null
  }

  private normalizeBaseUrl(value: unknown) {
    return String(value || DTDC_TRACKING_BASE_URL).trim().replace(/\/+$/, '') || DTDC_TRACKING_BASE_URL
  }

  private async ensureConfigLoaded() {
    if (DtdcService.cachedConfig === undefined) {
      DtdcService.cachedConfig = await getEffectiveCourierConfig<DtdcConfig>('dtdc', 'b2c')
    }

    const cfg = DtdcService.cachedConfig
    if (cfg) {
      this.apiBase = cfg.apiBase || this.apiBase
      this.bookingApiBase = cfg.bookingApiBase || this.bookingApiBase
      this.cancelApiBase = cfg.cancelApiBase || this.cancelApiBase
      this.accessToken = cfg.accessToken || cfg.apiKey || this.accessToken
      this.trackingToken = cfg.trackingToken || this.trackingToken
      this.username = cfg.username || this.username
      this.password = cfg.password || this.password
      this.customerCode = cfg.customerCode || this.customerCode
      this.serviceTypeId = cfg.serviceTypeId || this.serviceTypeId
      this.commodityId = cfg.commodityId || this.commodityId
      this.hubCode = cfg.hubCode || this.hubCode
      this.pickupVendorCode = cfg.pickupVendorCode || this.pickupVendorCode
    }

    this.apiBase = this.normalizeBaseUrl(this.apiBase)
    this.bookingApiBase = this.normalizeBaseUrl(this.bookingApiBase || DTDC_BOOKING_BASE_URL)
    this.cancelApiBase = this.normalizeBaseUrl(this.cancelApiBase || DTDC_CANCEL_BASE_URL)
  }

  private extractAccessToken(data: any) {
    if (typeof data === 'string') return data.trim()
    return String(
      data?.token ||
        data?.accessToken ||
        data?.access_token ||
        data?.apiKey ||
        data?.apikey ||
        data?.Token ||
        data?.['Token Access key'] ||
        '',
    ).trim()
  }

  async authenticate() {
    await this.ensureConfigLoaded()

    if (DtdcService.cachedAccessToken) return DtdcService.cachedAccessToken

    const username = String(this.username || '').trim()
    const password = String(this.password || '').trim()
    if (!username || !password) {
      throw new HttpError(400, 'DTDC username/password or X-Access-Token is not configured')
    }

    try {
      const response = await axios.get(`${this.apiBase}/dtdc-api/api/dtdc/authenticate`, {
        params: { username, password },
        timeout: 20000,
        validateStatus: () => true,
      })

      if (response.status !== 200) {
        throw new HttpError(
          response.status,
          typeof response.data === 'string'
            ? response.data
            : response.data?.message || response.data?.error || 'DTDC authentication failed',
        )
      }

      const token = this.extractAccessToken(response.data)
      if (!token) throw new HttpError(502, 'DTDC authentication did not return an access token')

      DtdcService.cachedAccessToken = token
      this.accessToken = token
      return token
    } catch (err: any) {
      if (err instanceof HttpError) throw err
      throw new HttpError(
        Number(err?.response?.status || 502),
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          'DTDC authentication request failed',
      )
    }
  }

  private async getHttp(): Promise<AxiosInstance> {
    await this.ensureConfigLoaded()
    const token = String(this.trackingToken || '').trim() || (await this.authenticate())

    return axios.create({
      baseURL: this.apiBase,
      timeout: 20000,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Access-Token': token,
      },
    })
  }

  private trim(value: unknown, fallback = '') {
    const text = String(value ?? '').trim()
    return text || fallback
  }

  private normalizeMode(value: unknown) {
    const text = this.trim(value).toLowerCase()
    if (!text) return ''
    if (['air', 'a', 'priority', 'express'].includes(text) || text.includes('priority')) return 'air'
    if (['surface', 's', 'ground'].includes(text) || text.includes('surface') || text.includes('smart')) {
      return 'surface'
    }
    return text
  }

  private resolveServiceTypeId(params: ShipmentParams) {
    const explicit = this.trim((params as any).dtdc_service_type_id || (params as any).service_type_id)
    if (explicit) return explicit

    const courierId = Number((params as any).courier_id || 0)
    if (courierId === DTDC_SURFACE_COURIER_ID) return DTDC_SURFACE_SERVICE_TYPE_ID
    if (courierId === DTDC_AIR_COURIER_ID) return DTDC_AIR_SERVICE_TYPE_ID

    const courierName = this.trim((params as any).courier_partner || (params as any).courier_name).toLowerCase()
    if (courierName.includes('dtdc')) {
      if (courierName.includes('surface') || courierName.includes('smart')) return DTDC_SURFACE_SERVICE_TYPE_ID
      if (courierName.includes('air') || courierName.includes('priority')) return DTDC_AIR_SERVICE_TYPE_ID
    }

    const mode = this.normalizeMode((params as any).shipping_mode || (params as any).mode)
    if (mode === 'surface') return DTDC_SURFACE_SERVICE_TYPE_ID
    if (mode === 'air') return DTDC_AIR_SERVICE_TYPE_ID

    return this.trim(this.serviceTypeId, DTDC_SURFACE_SERVICE_TYPE_ID)
  }

  private numberString(value: unknown, fallback: number) {
    const parsed = Number(value)
    const safe = Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
    return safe.toFixed(2).replace(/\.00$/, '')
  }

  private phone(value: unknown, fallback = '0000000000') {
    const digits = String(value || '').replace(/\D/g, '')
    return (digits.length >= 10 ? digits.slice(-10) : digits.padStart(10, '0')) || fallback
  }

  private formatInvoiceDate(value: unknown) {
    const raw = this.trim(value)
    const date = raw ? new Date(raw) : new Date()
    if (Number.isNaN(date.getTime())) return raw || new Date().toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  private buildAddress(details: any, fallbackName: string) {
    return {
      name: this.trim(details?.name || details?.warehouse_name || details?.company_name, fallbackName).slice(0, 100),
      phone: this.phone(details?.phone),
      alternate_phone: this.phone(details?.alternate_phone || details?.phone),
      address_line_1: this.trim(details?.address || details?.address_line_1 || details?.addressLine1, 'Address').slice(0, 200),
      address_line_2: this.trim(details?.address_2 || details?.address_line_2 || details?.addressLine2).slice(0, 200),
      pincode: this.trim(details?.pincode).replace(/\D/g, '').slice(0, 6),
      city: this.trim(details?.city, 'City').slice(0, 80),
      state: this.trim(details?.state, 'State').slice(0, 80),
    }
  }

  private buildReturnDetails(params: ShipmentParams) {
    const rto = (params as any).rto || params.pickup || {}
    const pickup = params.pickup || {}
    return {
      address_line_1: this.trim(rto.address || pickup.address, 'Return Address').slice(0, 200),
      address_line_2: this.trim(rto.address_2 || pickup.address_2).slice(0, 200),
      city_name: this.trim(rto.city || pickup.city, 'City').slice(0, 80),
      name: this.trim(rto.name || rto.warehouse_name || pickup.name || pickup.warehouse_name, 'Return').slice(0, 100),
      phone: this.phone(rto.phone || pickup.phone),
      pincode: this.trim(rto.pincode || pickup.pincode).replace(/\D/g, '').slice(0, 6),
      state_name: this.trim(rto.state || pickup.state, 'State').slice(0, 80),
      email: this.trim((params.consignee as any)?.email || (params as any).email),
      alternate_phone: this.phone(rto.alternate_phone || rto.phone || pickup.phone),
    }
  }

  private buildSoftdataPayload(params: ShipmentParams) {
    const customerCode = this.trim(this.customerCode)
    if (!customerCode) throw new HttpError(400, 'DTDC customer code is not configured')

    const items = Array.isArray(params.order_items) ? params.order_items : []
    const firstItem = items[0] || {}
    const isCod = String(params.payment_type || '').toLowerCase() === 'cod'
    const declaredValue = Number(params.order_amount ?? firstItem.price ?? 0) || 0
    const hubCode = this.trim((params as any).dtdc_hub_code || (params as any).hub_code || this.hubCode)
    const pickupVendorCode = this.trim(
      (params as any).dtdc_pickup_vendor_code ||
        (params as any).pickup_vendor_code ||
        (params as any).pickupVendorCode ||
        this.pickupVendorCode,
    )
    const description =
      items.map((item: any) => this.trim(item?.name)).filter(Boolean).join(', ').slice(0, 250) ||
      this.trim((params as any).description, 'Shipment')
    const serviceTypeId = this.resolveServiceTypeId(params)

    const consignment: Record<string, any> = {
      customer_code: customerCode,
      service_type_id: serviceTypeId,
      consignment_type: this.trim((params as any).consignment_type, 'Forward'),
      load_type: this.trim((params as any).load_type, 'NON-DOCUMENT'),
      description,
      dimension_unit: 'cm',
      length: this.numberString(params.package_length ?? (params as any).length, 1),
      width: this.numberString(params.package_breadth ?? (params as any).breadth, 1),
      height: this.numberString(params.package_height ?? (params as any).height, 1),
      weight_unit: 'kg',
      weight: this.numberString(params.package_weight ?? (params as any).weight, 0.5),
      declared_value: this.numberString(declaredValue, 1),
      num_pieces: this.trim((params as any).num_pieces, '1'),
      origin_details: this.buildAddress(params.pickup, 'Sender'),
      destination_details: this.buildAddress(params.consignee, 'Receiver'),
      return_details: this.buildReturnDetails(params),
      customer_reference_number: this.trim(params.order_number || (params as any).order_id, `RS-${Date.now()}`),
      cod_collection_mode: isCod ? 'CASH' : '',
      cod_amount: isCod ? this.numberString(params.order_amount, 0) : '',
      commodity_id: this.trim((params as any).commodity_id || this.commodityId, '99'),
      eway_bill: this.trim((params as any).eway_bill || (params as any).ewaybill || (params as any).ewbn),
      is_risk_surcharge_applicable: Boolean((params as any).is_risk_surcharge_applicable),
      invoice_number: this.trim((params as any).invoice_number || params.order_number),
      invoice_date: this.formatInvoiceDate((params as any).invoice_date || params.order_date),
      reference_number: this.trim((params as any).reference_number || (params as any).awb_number),
    }

    if (hubCode) {
      consignment.hub_code = hubCode
      consignment.origin_hub_code = hubCode
    }

    if (pickupVendorCode) {
      consignment.pickup_vendor_code = pickupVendorCode
      consignment.vendor_code = pickupVendorCode
    }

    if (items.length > 1 || Number(consignment.num_pieces) > 1) {
      consignment.pieces_detail = items.map((item: any) => ({
        description: this.trim(item?.name, description).slice(0, 200),
        declared_value: this.numberString(item?.price ?? declaredValue, 1),
        weight: consignment.weight,
        height: consignment.height,
        length: consignment.length,
        width: consignment.width,
      }))
    }

    return { consignments: [consignment] }
  }

  private getCreateResult(data: any) {
    const rows = Array.isArray(data?.data) ? data.data : Array.isArray(data?.consignments) ? data.consignments : []
    const first = rows[0] || data
    const awb = this.trim(
      first?.reference_number ||
        first?.awb_number ||
        first?.AWBNo ||
        first?.courier_partner_reference_number ||
        first?.pieces?.[0]?.reference_number,
    )
    return { first, awb }
  }

  private extractProviderMessage(data: any, first?: any) {
    const messages = [
      first?.message,
      first?.error,
      first?.reason,
      data?.message,
      data?.error,
      data?.reason,
      Array.isArray(data?.errors) ? data.errors.map((err: any) => err?.message || err?.error || err).join(', ') : '',
    ]
      .map((message) => this.trim(message))
      .filter(Boolean)

    return messages[0] || ''
  }

  private normalizeCreateError(message: string) {
    const normalized = String(message || '').toLowerCase()
    if (normalized.includes('auto allocated hub not found')) {
      const suffix = this.customerCode ? ` for customer code ${this.customerCode}` : ''
      return (
        `DTDC rejected booking: Auto allocated hub not found${suffix}. ` +
        'Ask DTDC/Shipsy to assign the pickup hub to this account, or add the DTDC Hub Code in Admin > Couriers > Credentials.'
      )
    }
    return message
  }

  async createShipment(params: ShipmentParams) {
    await this.ensureConfigLoaded()
    const apiKey = String(this.accessToken || '').trim() || (await this.authenticate())
    if (!apiKey) throw new HttpError(400, 'DTDC API key is not configured')

    const payload = this.buildSoftdataPayload(params)
    const serviceTypeId = this.trim(payload?.consignments?.[0]?.service_type_id)

    try {
      const response = await axios.post(`${this.bookingApiBase}${DTDC_SOFTDATA_ENDPOINT}`, payload, {
        timeout: 30000,
        validateStatus: () => true,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'api-key': apiKey,
        },
      })

      if (response.status < 200 || response.status >= 300) {
        const providerMessage = this.extractProviderMessage(response.data)
        throw new HttpError(
          response.status,
          this.normalizeCreateError(providerMessage || 'DTDC shipment creation failed'),
        )
      }

      const { first, awb } = this.getCreateResult(response.data)
      if (first?.success === false || !awb) {
        const providerMessage = this.extractProviderMessage(response.data, first)
        throw new HttpError(
          502,
          this.normalizeCreateError(providerMessage || 'DTDC shipment creation did not return an AWB'),
        )
      }

      return {
        ...response.data,
        awb_number: awb,
        shipment_id: awb,
        provider_reference: first?.reference_number || awb,
        provider_request_id: first?.reference_number || awb,
        provider_service: serviceTypeId,
        dtdc_service_type_id: serviceTypeId,
        courier_name: 'DTDC',
        chargeable_weight: first?.chargeable_weight,
        dtdc: {
          request: payload,
          response: response.data,
        },
      }
    } catch (err: any) {
      if (err instanceof HttpError) throw err
      const providerMessage = this.extractProviderMessage(err?.response?.data)
      throw new HttpError(
        Number(err?.response?.status || 502),
        this.normalizeCreateError(providerMessage || err?.message || 'DTDC shipment creation failed'),
      )
    }
  }

  async trackShipment(awb: string, options: { trkType?: 'cnno' | 'reference'; addtnlDtl?: 'Y' | 'N'; preferLegacy?: boolean } = {}) {
    const normalizedAwb = String(awb || '').trim()
    if (!normalizedAwb) throw new HttpError(400, 'DTDC consignment number is required for tracking')

    const apiKey = String(this.accessToken || '').trim()
    if (apiKey && !options.preferLegacy) {
      try {
        const response = await axios.get(`${this.cancelApiBase}${DTDC_SHIPSY_TRACK_ENDPOINT}`, {
          params: { reference_number: normalizedAwb },
          timeout: 20000,
          validateStatus: () => true,
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'api-key': apiKey,
          },
        })

        if (response.status >= 200 && response.status < 300) {
          return response.data
        }

        console.warn('[DTDC] Shipsy tracking failed, falling back to legacy tracking', {
          awb: normalizedAwb,
          status: response.status,
          response: response.data,
        })
      } catch (err: any) {
        console.warn('[DTDC] Shipsy tracking errored, falling back to legacy tracking', {
          awb: normalizedAwb,
          message: err?.message || err,
        })
      }
    }

    const http = await this.getHttp()
    const payload = {
      trkType: options.trkType || 'cnno',
      strcnno: normalizedAwb,
      addtnlDtl: options.addtnlDtl || 'Y',
    }

    try {
      const response = await http.post(DTDC_TRACKING_ENDPOINT, payload)
      return response.data
    } catch (err: any) {
      throw new HttpError(
        Number(err?.response?.status || 502),
        err?.response?.data?.message ||
          err?.response?.data?.status ||
          err?.message ||
          'DTDC tracking request failed',
      )
    }
  }

  async getShippingLabelStream(referenceNumber: string) {
    await this.ensureConfigLoaded()

    const normalizedReference = String(referenceNumber || '').trim()
    if (!normalizedReference) throw new HttpError(400, 'DTDC reference number is required for label download')

    const apiKey = String(this.accessToken || '').trim() || (await this.authenticate())
    if (!apiKey) throw new HttpError(400, 'DTDC API key is not configured')

    try {
      const response = await axios.get(`${this.cancelApiBase}${DTDC_SHIPSY_LABEL_STREAM_ENDPOINT}`, {
        params: { reference_number: normalizedReference },
        responseType: 'arraybuffer',
        timeout: 30000,
        validateStatus: () => true,
        headers: {
          Accept: 'application/pdf',
          'api-key': apiKey,
        },
      })

      if (response.status < 200 || response.status >= 300) {
        throw new HttpError(
          response.status,
          response.data?.message || response.data?.error || 'DTDC shipping label download failed',
        )
      }

      return {
        buffer: Buffer.from(response.data),
        contentType: String(response.headers?.['content-type'] || 'application/pdf'),
      }
    } catch (err: any) {
      if (err instanceof HttpError) throw err
      throw new HttpError(
        Number(err?.response?.status || 502),
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          'DTDC shipping label download failed',
      )
    }
  }

  async cancelShipment(awb: string, customerCode?: string) {
    await this.ensureConfigLoaded()

    const normalizedAwb = String(awb || '').trim()
    if (!normalizedAwb) throw new HttpError(400, 'DTDC AWB number is required for cancellation')

    const resolvedCustomerCode = String(customerCode || this.customerCode || '').trim()
    if (!resolvedCustomerCode) {
      throw new HttpError(400, 'DTDC customer code is not configured')
    }

    const apiKey = String(this.accessToken || '').trim() || (await this.authenticate())
    if (!apiKey) throw new HttpError(400, 'DTDC API key is not configured')

    try {
      const response = await axios.post(
        `${this.cancelApiBase}${DTDC_CANCEL_ENDPOINT}`,
        {
          AWBNo: [normalizedAwb],
          customerCode: resolvedCustomerCode,
        },
        {
          timeout: 20000,
          validateStatus: () => true,
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'api-key': apiKey,
          },
        },
      )

      if (response.status < 200 || response.status >= 300) {
        throw new HttpError(
          response.status,
          response.data?.message || response.data?.error || 'DTDC cancellation request failed',
        )
      }

      return response.data
    } catch (err: any) {
      if (err instanceof HttpError) throw err
      throw new HttpError(
        Number(err?.response?.status || 502),
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          'DTDC cancellation request failed',
      )
    }
  }
}
