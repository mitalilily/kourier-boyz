import axios, { AxiosInstance } from 'axios'
import { HttpError } from '../../../utils/classes'
import { MovinConfig, getEffectiveCourierConfig } from '../courierCredentials.service'
import type { ShipmentParams } from '../shiprocket.service'

const MOVIN_DEFAULT_BASE_URL = 'https://apim.iristransport.co.in'
const MOVIN_TOKEN_URL = (tenantId: string) =>
  `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`

export const MOVIN_COURIERS = [
  { id: 72001, name: 'Movin Express End of Day', service: 'Express End of Day' },
  { id: 72002, name: 'Movin Express Ez', service: 'Express Ez' },
  { id: 72003, name: 'Movin Standard Premium', service: 'Standard Premium' },
] as const

type MovinResolvedConfig = Required<Pick<
  MovinConfig,
  'apiBase' | 'tenantId' | 'serverId' | 'clientId' | 'clientSecret' | 'subscriptionKey' | 'accountNumber'
>>

type MovinTokenCache = {
  token: string
  expiresAt: number
  cacheKey: string
}

const trimText = (value: unknown, fallback = '') => {
  const text = String(value ?? '').trim()
  return text || fallback
}

const safePhone = (value: unknown, fallback = '9999999999') => {
  const digits = trimText(value).replace(/\D/g, '')
  if (digits.length >= 10) return digits.slice(-10)
  return fallback
}

const normalizePincode = (value: unknown) => trimText(value).replace(/\D/g, '').slice(0, 6)

const dateOnly = (value: unknown) => {
  const raw = trimText(value)
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  const parsed = raw ? new Date(raw) : new Date()
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString().slice(0, 10)
  return parsed.toISOString().slice(0, 10)
}

const timeOnly = (value: unknown) => {
  const raw = trimText(value)
  const match = raw.match(/^(\d{1,2}):(\d{2})/)
  if (match) return `${match[1].padStart(2, '0')}:${match[2]}`
  return '16:00'
}

const numberOr = (value: unknown, fallback: number) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const splitName = (value: unknown, fallback = 'Kourier Boyz') => {
  const parts = trimText(value, fallback).split(/\s+/).filter(Boolean)
  const first = parts.shift() || fallback
  const last = parts.join(' ') || first
  return { first: first.slice(0, 80), last: last.slice(0, 80) }
}

const splitAddressLines = (value: unknown, fallbackCity?: unknown, fallbackState?: unknown) => {
  const normalized = trimText(value, 'Address').replace(/\s+/g, ' ')
  const chunks = normalized.match(/.{1,45}(?:\s|$)/g)?.map((line) => line.trim()).filter(Boolean) || []
  return {
    line1: trimText(chunks[0], 'Address').slice(0, 60),
    line2: trimText(chunks[1], fallbackCity ? String(fallbackCity) : 'Locality').slice(0, 60),
    line3: trimText(chunks.slice(2).join(' '), fallbackState ? String(fallbackState) : 'Area').slice(0, 60),
  }
}

const stringifyMovinValue = (value: unknown) => {
  if (value === undefined || value === null) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

const collectMovinErrors = (value: unknown, errors: string[] = []): string[] => {
  if (value === undefined || value === null) return errors
  if (typeof value === 'string') {
    const text = value.trim()
    if (text) errors.push(text)
    return errors
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    errors.push(String(value))
    return errors
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectMovinErrors(item, errors))
    return errors
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    for (const key of ['message', 'error', 'detail', 'description']) {
      const text = stringifyMovinValue(record[key])
      if (text) errors.push(text)
    }
    for (const nested of Object.values(record)) {
      if (nested && typeof nested === 'object') collectMovinErrors(nested, errors)
    }
  }
  return errors
}

const extractMovinErrorMessage = (data: unknown, fallback: string) => {
  const messages = Array.from(new Set(collectMovinErrors(data).filter(Boolean)))
  if (messages.length) return messages.slice(0, 6).join('; ')
  const serialized = stringifyMovinValue(data)
  return serialized || fallback
}

export const normalizeMovinServiceType = (...values: unknown[]) => {
  const raw = values.map((value) => trimText(value)).find(Boolean) || ''
  const normalized = raw.toLowerCase().replace(/[^a-z0-9]+/g, ' ')
  if (normalized.includes('end') || normalized.includes('eod')) return 'Express End of Day'
  if (normalized.includes('ez') || normalized.includes('easy')) return 'Express Ez'
  if (normalized.includes('premium') || normalized.includes('standard')) return 'Standard Premium'
  return 'Standard Premium'
}

export class MovinService {
  private static cachedConfig: MovinResolvedConfig | null | undefined
  private static tokenCache: MovinTokenCache | null = null

  static clearCachedConfig() {
    MovinService.cachedConfig = undefined
    MovinService.tokenCache = null
  }

  private normalizeBaseUrl(value: unknown) {
    return trimText(value, MOVIN_DEFAULT_BASE_URL).replace(/\/+$/, '') || MOVIN_DEFAULT_BASE_URL
  }

  private async ensureConfig(): Promise<MovinResolvedConfig> {
    if (MovinService.cachedConfig !== undefined) return MovinService.cachedConfig as MovinResolvedConfig

    const stored = await getEffectiveCourierConfig<MovinConfig>('movin', 'b2b')
    const config: MovinResolvedConfig = {
      apiBase: this.normalizeBaseUrl(stored?.apiBase || process.env.MOVIN_API_BASE),
      tenantId: trimText(stored?.tenantId || process.env.MOVIN_TENANT_ID),
      serverId: trimText(stored?.serverId || process.env.MOVIN_SERVER_ID),
      clientId: trimText(stored?.clientId || process.env.MOVIN_CLIENT_ID),
      clientSecret: trimText(stored?.clientSecret || process.env.MOVIN_CLIENT_SECRET),
      subscriptionKey: trimText(stored?.subscriptionKey || process.env.MOVIN_SUBSCRIPTION_KEY),
      accountNumber: trimText(stored?.accountNumber || process.env.MOVIN_ACCOUNT_NUMBER),
    }

    const missing = Object.entries(config)
      .filter(([, value]) => !trimText(value))
      .map(([key]) => key)
    if (missing.length) {
      throw new HttpError(400, `Movin B2B credentials are not configured: ${missing.join(', ')}`)
    }

    MovinService.cachedConfig = config
    return config
  }

  async authenticate() {
    const config = await this.ensureConfig()
    const cacheKey = `${config.tenantId}:${config.clientId}:${config.serverId}`
    if (
      MovinService.tokenCache?.cacheKey === cacheKey &&
      MovinService.tokenCache.expiresAt > Date.now() + 60_000
    ) {
      return MovinService.tokenCache.token
    }

    const body = new URLSearchParams()
    body.set('grant_type', 'client_credentials')
    body.set('client_id', config.clientId)
    body.set('client_secret', config.clientSecret)
    body.set('scope', `${config.serverId}/.default`)

    const response = await axios.post(MOVIN_TOKEN_URL(config.tenantId), body.toString(), {
      timeout: 30000,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      validateStatus: () => true,
    })

    const token = trimText(response.data?.access_token || response.data?.token)
    if (response.status < 200 || response.status >= 300 || !token) {
      throw new HttpError(
        response.status || 502,
        response.data?.error_description ||
          response.data?.error ||
          response.data?.message ||
          'Movin token generation failed',
      )
    }

    const expiresIn = Number(response.data?.expires_in || 3600)
    MovinService.tokenCache = {
      token,
      expiresAt: Date.now() + Math.max(300, expiresIn - 120) * 1000,
      cacheKey,
    }
    return token
  }

  private async http(): Promise<{ client: AxiosInstance; config: MovinResolvedConfig }> {
    const config = await this.ensureConfig()
    const token = await this.authenticate()
    return {
      config,
      client: axios.create({
        baseURL: config.apiBase,
        timeout: 45000,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'Ocp-Apim-Subscription-Key': config.subscriptionKey,
          Authorization: `Bearer ${token}`,
        },
        validateStatus: () => true,
      }),
    }
  }

  private async post<T = any>(path: string, payload: Record<string, any>) {
    const { client } = await this.http()
    const response = await client.post<T>(path, payload)
    if (response.status < 200 || response.status >= 300) {
      const message = extractMovinErrorMessage(
        response.data,
        `Movin request failed for ${path}`,
      )
      console.error('[Movin] API request failed', {
        path,
        status: response.status,
        response: response.data,
      })
      const error = new HttpError(
        response.status || 502,
        message,
      )
      ;(error as any).providerResponse = response.data
      ;(error as any).providerStatus = response.status
      throw error
    }
    return response.data
  }

  async createShipment(payload: Record<string, any>) {
    return this.post('/rest/v2/shipment/sync/create', payload)
  }

  async createPickup(payload: Record<string, any>) {
    return this.post('/rest/v2/pickup/create', payload)
  }

  async updatePickup(payload: Record<string, any>) {
    return this.post('/rest/v2/pickup/update', payload)
  }

  async cancelPickup(payload: { pickup_request_number: string; account?: string }) {
    const config = await this.ensureConfig()
    return this.post('/rest/v2/pickup/cancel', {
      account: payload.account || config.accountNumber,
      pickup_request_number: payload.pickup_request_number,
    })
  }

  async trackShipments(trackingNumbers: string[]) {
    return this.post('/rest/v2/order/track', { tracking_numbers: trackingNumbers })
  }

  async getLabel(payload: { shipment_number: string; account_number?: string; label_type?: string }) {
    const config = await this.ensureConfig()
    return this.post('/rest/v2/shipment/label', {
      shipment_number: payload.shipment_number,
      account_number: payload.account_number || config.accountNumber,
      label_type: payload.label_type || 'A4',
    })
  }

  async getProof(payload: {
    shipment_number: string
    account_number?: string
    type?: 'epod' | 'epop'
    format?: string
  }) {
    const config = await this.ensureConfig()
    return this.post('/rest/v2/shipments/epod_esign', {
      shipment_number: payload.shipment_number,
      account_number: payload.account_number || config.accountNumber,
      type: payload.type || 'epod',
      format: payload.format || 'raw',
    })
  }

  async buildB2BShipmentPayload(params: ShipmentParams, options: {
    boxes: any[]
    shipmentValue: number
    codAmount: number
    serviceType?: string
    communicationEmail?: string
  }) {
    if (Number(options.codAmount || 0) > 0) {
      throw new HttpError(
        400,
        'Movin B2B currently supports prepaid shipments only. Please book this shipment as prepaid.',
      )
    }

    const config = await this.ensureConfig()
    const pickup = params.pickup || {}
    const pickupRecord = pickup as Record<string, any>
    const consignee = params.consignee || ({} as any)
    const pickupName = splitName(pickup.name || pickup.warehouse_name || 'Kourier Boyz Pickup')
    const consigneeName = splitName(consignee.name || consignee.company_name || 'Consignee')
    const pickupAddress = splitAddressLines(pickup.address, pickup.city, pickup.state)
    const dropAddress = splitAddressLines(consignee.address, consignee.city, consignee.state)
    const boxes = options.boxes.length
      ? options.boxes
      : [
          {
            length: params.package_length || params.length || 1,
            breadth: params.package_breadth || params.breadth || 1,
            height: params.package_height || params.height || 1,
            weight: params.package_weight || 0.5,
            quantity: 1,
          },
        ]
    const shipmentUniqueId = trimText(params.order_number, `SHIP-${Date.now()}`).slice(0, 50)
    const shipmentPriority = normalizeMovinServiceType(
      options.serviceType,
      (params as any).provider_service,
      params.shipping_mode,
      params.transport_speed,
    )
    const packageRows = boxes.flatMap((box: any, index: number) => {
      const quantity = Math.max(1, Math.round(Number(box.quantity ?? 1) || 1))
      return Array.from({ length: quantity }, (_, copyIndex) => ({
        package_unique_id: `PACK_${index + 1}_${copyIndex + 1}`.slice(0, 50),
        length: numberOr(box.length ?? params.package_length, 1),
        width: numberOr(box.breadth ?? box.width ?? params.package_breadth, 1),
        height: numberOr(box.height ?? params.package_height, 1),
        weight_actual: numberOr(box.weight ?? params.package_weight, 0.5),
        reference_number_1: trimText(params.invoice_number || params.order_number).slice(0, 50),
        reference_number_2: trimText(box.box_name || box.name || `Package ${index + 1}`).slice(0, 50),
        invoice_number: trimText(params.invoice_number || params.order_number).slice(0, 50),
        identical_package_count: 1,
      }))
    })

    return {
      communication_email:
        trimText(options.communicationEmail || consignee.email || pickupRecord.email) ||
        'support@kourierboyz.com',
      payload: [
        {
          shipment: {
            shipment_unique_id: shipmentUniqueId,
            shipment_type: 'forward',
            ship_from_account: config.accountNumber,
            __flag: 'NONE',
            ship_from_company: trimText(pickup.warehouse_name || params.company?.name, 'Kourier Boyz').slice(0, 80),
            ship_from_first_name: pickupName.first,
            ship_from_last_name: pickupName.last,
            ship_from_address_line1: pickupAddress.line1,
            ship_from_address_line2: pickupAddress.line2,
            ship_from_address_line3: pickupAddress.line3,
            ship_from_zipcode: normalizePincode(pickup.pincode),
            ship_from_email: trimText(pickupRecord.email || options.communicationEmail, 'support@kourierboyz.com'),
            ship_from_phone: safePhone(pickup.phone),
            shipment_date: dateOnly(params.order_date || (pickup as any).pickup_date),
            shipment_priority: shipmentPriority,
            ship_to_first_name: consigneeName.first,
            ship_to_last_name: consigneeName.last,
            ship_to_company: trimText(consignee.company_name || consignee.name, consigneeName.first).slice(0, 80),
            ship_to_address_line1: dropAddress.line1,
            ship_to_address_line2: dropAddress.line2,
            ship_to_address_line3: dropAddress.line3,
            ship_to_zipcode: normalizePincode(consignee.pincode),
            ship_to_email: trimText(consignee.email),
            ship_to_phone: safePhone(consignee.phone),
            invoice_number: trimText(params.invoice_number || params.order_number).slice(0, 50),
            reference_number_1: trimText(params.order_number).slice(0, 50),
            reference_number_2: trimText(params.invoice_number).slice(0, 50),
            package_type: 'package',
            goods_general_description:
              (params.order_items || [])
                .map((item: any) => trimText(item?.name))
                .filter(Boolean)
                .slice(0, 3)
                .join(', ')
                .slice(0, 200) || 'B2B shipment',
            special_instructions: trimText((params as any).special_instructions).slice(0, 200),
            additional_email_ids: '',
            goods_value: String(options.shipmentValue || 1),
            declared_value: String(options.shipmentValue || 1),
            bill_to: 'Shipper',
            billing_account_number: config.accountNumber,
            billing_account_zipcode: normalizePincode(pickup.pincode),
            gst_id: trimText(params.company?.gst || pickup.gst_number || consignee.gstin),
            include_insurance: params.is_insurance ? 'Yes' : 'No',
            email_notification: 'Yes',
            mobile_notification: 'Yes',
            add_adult_signature: 'No',
            cash_on_delivery: 'No',
          },
          package: packageRows.slice(0, 300),
        },
      ],
    }
  }

  extractShipmentResult(response: any, shipmentUniqueId: string) {
    const success = response?.response?.success || response?.success || {}
    const shipmentNode = success?.[shipmentUniqueId] || Object.values(success || {}).find(Boolean) || {}
    const parentShipmentNumber = Array.isArray((shipmentNode as any)?.parent_shipment_number)
      ? (shipmentNode as any).parent_shipment_number[0]
      : (shipmentNode as any)?.parent_shipment_number || response?.parent_shipment_number
    const packageNumbers = Object.entries(shipmentNode as Record<string, any>)
      .filter(([key]) => key !== 'parent_shipment_number')
      .flatMap(([, value]) => (Array.isArray(value) ? value : [value]))
      .map((value) => trimText(value))
      .filter(Boolean)

    return {
      parentShipmentNumber: trimText(parentShipmentNumber),
      packageNumbers,
      destinationBranchCode: trimText(response?.response?.success?.destination_branch_code || success?.destination_branch_code),
      raw: response,
    }
  }

  async buildPickupPayload(params: ShipmentParams, serviceType?: string) {
    const config = await this.ensureConfig()
    const pickup = params.pickup || {}
    const pickupRecord = pickup as Record<string, any>
    const name = splitName(pickup.name || pickup.warehouse_name || 'Kourier Boyz Pickup')
    const pickupDate = dateOnly((pickup as any).pickup_date || params.pickup_date || params.order_date)
    const pickupTime = timeOnly((pickup as any).pickup_time || params.pickup_time)
    const address = splitAddressLines(pickup.address, pickup.city, pickup.state)

    return {
      account: config.accountNumber,
      pickup_date: pickupDate,
      pickup_time_start: pickupTime,
      service_type: normalizeMovinServiceType(serviceType, (params as any).provider_service),
      address_first_name: name.first,
      address_last_name: name.last,
      address_email: trimText(pickupRecord.email || (params.consignee as any)?.email, 'support@kourierboyz.com'),
      address_phone: safePhone(pickup.phone),
      address_address_line1: address.line1,
      address_address_line2: address.line2,
      address_address_line3: address.line3,
      address_zipcode: normalizePincode(pickup.pincode),
      address_city: trimText(pickup.city, 'City'),
      address_state: trimText(pickup.state, 'State'),
      pickup_reason: `Pickup for ${trimText(params.order_number, 'B2B shipment')}`.slice(0, 120),
    }
  }
}
