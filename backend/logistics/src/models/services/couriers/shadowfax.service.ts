import axios, { type AxiosInstance } from 'axios'
import { HttpError } from '../../../utils/classes'
import {
  ShadowfaxConfig,
  getEffectiveCourierConfig,
} from '../courierCredentials.service'

type ShadowfaxForwardMode = 'marketplace' | 'warehouse'
type ShadowfaxServiceMode = 'regular' | 'surface'

type ShadowfaxServiceabilityResult = {
  serviceable: boolean
  services: string[]
  codAvailable: boolean
  prepaidAvailable: boolean
  tat: number | null
  mode?: ShadowfaxForwardMode
  service?: ShadowfaxServiceMode | null
  raw: any
}

type ShadowfaxForwardBookingResult = {
  shipment: any
  mode: ShadowfaxForwardMode
  service: ShadowfaxServiceMode
  attempts: ShadowfaxForwardBookingAttemptSummary[]
}

const DEFAULT_API_BASE = 'https://dale.staging.shadowfax.in/api'
const DEFAULT_QR_BASE = 'https://saruman.staging.shadowfax.in/api'

const normalizeBase = (value?: string | null, fallback = DEFAULT_API_BASE) =>
  String(value || fallback).trim().replace(/\/+$/, '')

const normalizeForwardMode = (value: unknown): ShadowfaxForwardMode => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')

  if (['warehouse', 'wh', 'warehouse_pickup', 'warehouse_forward'].includes(normalized)) {
    return 'warehouse'
  }

  return 'marketplace'
}

const normalizeForwardServiceMode = (value: unknown): ShadowfaxServiceMode | null => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')

  if (normalized === 'surface') return 'surface'
  if (normalized === 'regular') return 'regular'
  return null
}

const sanitizePhone = (value?: string | null) => {
  const digits = String(value || '').replace(/\D/g, '')
  return digits.length > 10 ? digits.slice(-10) : digits
}

const normalizePaymentMode = (value?: string | null) => {
  const normalized = String(value || '').trim().toLowerCase()
  return normalized === 'cod' ? 'COD' : 'Prepaid'
}

const normalizePincodeString = (value?: string | number | null) => String(value ?? '').trim()

const firstNonEmptyString = (...values: unknown[]) => {
  for (const value of values) {
    const normalized = String(value ?? '').trim()
    if (normalized) return normalized
  }
  return ''
}

const isTruthyProviderValue = (value: unknown) => {
  if (value === true || value === 1) return true
  const normalized = String(value ?? '').trim().toLowerCase()
  return ['1', 'true', 'success', 'successful', 'ok', 'yes', 'y', 'available'].includes(normalized)
}

const isFalseyProviderValue = (value: unknown) => {
  if (value === false || value === 0) return true
  const normalized = String(value ?? '').trim().toLowerCase()
  return ['0', 'false', 'no', 'n', 'unavailable', 'not_available'].includes(normalized)
}

const extractServiceabilityRows = (payload: unknown): any[] => {
  const raw = payload as any
  const candidates = [
    raw,
    raw?.data,
    raw?.results,
    raw?.pincodes,
    raw?.serviceability,
    raw?.response,
    raw?.data?.results,
    raw?.data?.pincodes,
    raw?.data?.serviceability,
    raw?.response?.results,
    raw?.response?.pincodes,
    raw?.response?.serviceability,
  ]

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate
  }

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object') continue
    if (
      candidate.code ||
      candidate.pincode ||
      candidate.pin ||
      candidate.postal_code ||
      candidate.postalCode ||
      candidate.services ||
      candidate.serviceable !== undefined ||
      candidate.available !== undefined
    ) {
      return [candidate]
    }

    const nestedRows = Object.values(candidate).filter(
      (value) => value && typeof value === 'object',
    )
    if (
      nestedRows.length > 0 &&
      nestedRows.every(
        (value: any) =>
          value.code ||
          value.pincode ||
          value.pin ||
          value.postal_code ||
          value.postalCode ||
          value.services ||
          value.serviceable !== undefined ||
          value.available !== undefined,
      )
    ) {
      return nestedRows
    }
  }

  return []
}

const buildShadowfaxOriginDetails = (params: any) => {
  const pickupName =
    params.pickup?.name || params.pickup?.warehouse_name || params.pickup_location_id || ''
  const pickupAddressLine1 = params.pickup?.address || ''
  const pickupAddressLine2 = params.pickup?.address_2 || ''
  const pickupCity = params.pickup?.city || ''
  const pickupState = params.pickup?.state || ''
  const pickupPincode = Number(params.pickup?.pincode || 0)
  const pickupContact = sanitizePhone(params.pickup?.phone)
  const pickupUniqueCode =
    params.pickup_location_id ||
    params.pickup_location_alias ||
    params.pickup?.addressNickname ||
    params.pickup?.warehouse_name

  return {
    name: pickupName || 'Warehouse',
    contact: pickupContact,
    address_line_1: pickupAddressLine1,
    address_line_2: pickupAddressLine2,
    city: pickupCity,
    state: pickupState,
    pincode: pickupPincode,
    latitude: '',
    longitude: '',
    unique_code: pickupUniqueCode,
  }
}

const findServiceabilityEntry = (payload: unknown, pincode: string | number) => {
  const normalizedPincode = normalizePincodeString(pincode)
  const rows = extractServiceabilityRows(payload)
  if (!Array.isArray(rows)) return null

  return (
    rows.find((entry: any) =>
      [
        entry?.code,
        entry?.pincode,
        entry?.pin,
        entry?.postal_code,
        entry?.postalCode,
      ].some((value) => normalizePincodeString(value) === normalizedPincode),
    ) ||
    (rows.length === 1 ? rows[0] : null)
  )
}

const extractServiceabilityServices = (entry: any): string[] => {
  if (Array.isArray(entry?.services)) {
    return entry.services.map((value: unknown) => String(value || '').trim()).filter(Boolean)
  }

  if (typeof entry?.services === 'string') {
    return entry.services
      .split(',')
      .map((value: string) => value.trim())
      .filter(Boolean)
  }

  for (const value of [entry?.service, entry?.service_type, entry?.serviceType]) {
    if (typeof value === 'string' && value.trim()) return [value.trim()]
  }

  return []
}

const normalizeServiceToken = (value: unknown) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

const getServiceabilityTokens = (entry: any) =>
  extractServiceabilityServices(entry).map(normalizeServiceToken).filter(Boolean)

const isServiceabilityEntryAvailable = (entry: any) => {
  if (!entry) return false
  if (extractServiceabilityServices(entry).length > 0) return true

  return [
    entry?.serviceable,
    entry?.is_serviceable,
    entry?.isServiceable,
    entry?.available,
    entry?.is_available,
    entry?.isAvailable,
    entry?.status,
    entry?.success,
  ].some(isTruthyProviderValue)
}

const isCodServiceAvailable = (entry: any) => {
  const serviceSet = new Set(
    extractServiceabilityServices(entry).map((service) => service.toLowerCase()),
  )
  if (serviceSet.has('cod') || serviceSet.has('cash_on_delivery')) return true

  const codFields = [
    entry?.cod,
    entry?.cod_available,
    entry?.codAvailable,
    entry?.cash_on_delivery,
    entry?.cashOnDelivery,
  ].filter(
    (value) => value !== undefined && value !== null && String(value).trim() !== '',
  )

  if (codFields.length > 0) {
    if (codFields.some(isTruthyProviderValue)) return true
    if (codFields.some(isFalseyProviderValue)) return false
  }

  // Some Shadowfax serviceability responses only expose delivery serviceability
  // and do not return a separate COD flag. Do not hide Shadowfax COD rates unless
  // the provider explicitly says COD is unavailable.
  return true
}

const isForwardOriginAvailableForService = (
  entry: any,
  service: ShadowfaxServiceMode | null,
) => {
  if (!isServiceabilityEntryAvailable(entry)) return false
  // Shadowfax origin serviceability is tied to pickup coverage, not the
  // forward delivery service token. If the origin pincode is serviceable,
  // keep the lane eligible and let booking-time fallback pick the exact mode.
  return true
}

const isForwardDestinationAvailableForService = (
  entry: any,
  service: ShadowfaxServiceMode | null,
) => {
  if (!isServiceabilityEntryAvailable(entry)) return false
  if (!service) return true

  const services = getServiceabilityTokens(entry)
  if (!services.length) return true

  if (service === 'surface') {
    return services.some(
      (item) =>
        item.includes('surface') ||
        item.includes('delivery') ||
        item.includes('customer') ||
        item.includes('regular'),
    )
  }

  return services.some((item) =>
    item.includes('regular') ||
    item.includes('large') ||
    item === 'customer_delivery' ||
    item.includes('delivery'),
  )
}

type ShadowfaxForwardServiceabilityAttempt = {
  mode: ShadowfaxForwardMode
  service: ShadowfaxServiceMode | null
  originService: string
  originResp: any
  destinationResp: any
  originEntry: any
  destinationEntry: any
  originAvailable: boolean
  destinationAvailable: boolean
  destinationCodAvailable: boolean
  serviceable: boolean
  destinationServices: string[]
}

type ShadowfaxForwardBookingAttempt = {
  mode: ShadowfaxForwardMode
  service: ShadowfaxServiceMode
}

type ShadowfaxForwardBookingAttemptSummary = ShadowfaxForwardBookingAttempt & {
  serviceable?: boolean
  selectedMode?: ShadowfaxForwardMode
  selectedService?: ShadowfaxServiceMode | null
  booked?: boolean
  error?: string
}

const alternateForwardMode = (mode: ShadowfaxForwardMode): ShadowfaxForwardMode =>
  mode === 'warehouse' ? 'marketplace' : 'warehouse'

const alternateForwardService = (service: ShadowfaxServiceMode): ShadowfaxServiceMode =>
  service === 'surface' ? 'regular' : 'surface'

const buildForwardBookingAttempts = (
  mode: ShadowfaxForwardMode,
  service: ShadowfaxServiceMode,
): ShadowfaxForwardBookingAttempt[] => {
  const attempts: ShadowfaxForwardBookingAttempt[] = []
  const seen = new Set<string>()
  const add = (candidateMode: ShadowfaxForwardMode, candidateService: ShadowfaxServiceMode) => {
    const key = `${candidateMode}:${candidateService}`
    if (seen.has(key)) return
    seen.add(key)
    attempts.push({ mode: candidateMode, service: candidateService })
  }

  add(mode, service)
  add(mode, alternateForwardService(service))
  add(alternateForwardMode(mode), service)
  add(alternateForwardMode(mode), alternateForwardService(service))
  return attempts
}

const getObjectCandidate = (payload: any) => {
  const data = payload?.data
  if (Array.isArray(data)) return data[0] || {}
  if (data && typeof data === 'object') return data
  return payload && typeof payload === 'object' ? payload : {}
}

const normalizeForwardShipmentResponse = (payload: any) => {
  const candidate = getObjectCandidate(payload)
  const shipment = candidate?.shipment || candidate?.order || candidate?.data || {}
  const awbNumber = firstNonEmptyString(
    candidate?.awb_number,
    candidate?.awb,
    candidate?.AWB,
    candidate?.awb_no,
    candidate?.awbNo,
    candidate?.waybill,
    candidate?.tracking_number,
    shipment?.awb_number,
    shipment?.awb,
    shipment?.AWB,
    shipment?.awb_no,
    shipment?.awbNo,
    shipment?.waybill,
    shipment?.tracking_number,
  )

  if (!awbNumber || !payload || typeof payload !== 'object') return payload
  payload.awb_number = payload.awb_number || awbNumber

  if (Array.isArray(payload.data) && payload.data[0] && typeof payload.data[0] === 'object') {
    payload.data[0].awb_number = payload.data[0].awb_number || awbNumber
  } else if (payload.data && typeof payload.data === 'object') {
    payload.data.awb_number = payload.data.awb_number || awbNumber
  }

  return payload
}

const normalizeReverseShipmentResponse = (payload: any) => {
  const candidate = getObjectCandidate(payload)
  const request = candidate?.request || candidate?.shipment || candidate?.data || {}
  const requestId = firstNonEmptyString(
    candidate?.client_request_id,
    candidate?.request_id,
    candidate?.awb_number,
    candidate?.awb,
    candidate?.AWB,
    request?.client_request_id,
    request?.request_id,
    request?.awb_number,
    request?.awb,
    request?.AWB,
  )

  if (!requestId || !payload || typeof payload !== 'object') return payload
  payload.client_request_id = payload.client_request_id || requestId
  payload.awb_number = payload.awb_number || requestId

  if (Array.isArray(payload.data) && payload.data[0] && typeof payload.data[0] === 'object') {
    payload.data[0].client_request_id = payload.data[0].client_request_id || requestId
    payload.data[0].awb_number = payload.data[0].awb_number || requestId
  } else if (payload.data && typeof payload.data === 'object') {
    payload.data.client_request_id = payload.data.client_request_id || requestId
    payload.data.awb_number = payload.data.awb_number || requestId
  }

  return payload
}

const normalizeBoolString = (value: unknown, fallback = 'False') => {
  if (typeof value === 'boolean') return value ? 'True' : 'False'
  const normalized = String(value ?? '').trim().toLowerCase()
  if (['true', '1', 'yes', 'y'].includes(normalized)) return 'True'
  if (['false', '0', 'no', 'n'].includes(normalized)) return 'False'
  return fallback
}

const parseShadowfaxError = (error: any, fallback: string) => {
  const responseData = error?.response?.data
  const responseMessage = responseData?.message
  const responseMsg = responseData?.responseMsg
  const nestedErrors = responseData?.errors
  const nestedDetail = responseData?.detail

  const providerMessage =
    (typeof responseMessage === 'string' &&
    ['failure', 'failed', 'error'].includes(responseMessage.trim().toLowerCase())
      ? responseMsg || nestedErrors || nestedDetail || responseMessage
      : responseMessage || responseMsg || nestedErrors || nestedDetail) ||
    error?.message ||
    fallback

  if (Array.isArray(providerMessage)) {
    return providerMessage.map((item) => String(item)).join(', ')
  }
  if (typeof providerMessage === 'object' && providerMessage) {
    return JSON.stringify(providerMessage)
  }
  return String(providerMessage || fallback)
}

const extractShadowfaxProviderFailure = (payload: any) => {
  if (!payload || typeof payload !== 'object') return null

  const message = String(payload?.message || '').trim()
  const errors = payload?.errors ?? payload?.error ?? payload?.detail ?? payload?.responseMsg
  const failed =
    payload?.success === false ||
    payload?.status === false ||
    ['failure', 'failed', 'error'].includes(message.toLowerCase()) ||
    (errors !== undefined && errors !== null && String(errors).trim().length > 0)

  if (!failed) return null

  if (Array.isArray(errors)) return errors.map((item) => String(item)).join(', ')
  if (errors && typeof errors === 'object') return JSON.stringify(errors)
  return String(errors || message || 'Shadowfax rejected the shipment request')
}

const getErrorStatusCode = (error: any) => {
  const raw = error?.statusCode ?? error?.status ?? error?.response?.status
  const statusCode = Number(raw)
  return Number.isFinite(statusCode) ? statusCode : null
}

const stringifyErrorValue = (value: unknown) => {
  if (value === undefined || value === null) return ''
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

const isRetryableForwardBookingError = (error: any) => {
  const statusCode = getErrorStatusCode(error)
  if (statusCode && statusCode >= 500) return false

  const responseData = error?.response?.data
  const message = [
    error?.message,
    responseData?.message,
    responseData?.errors,
    responseData?.error,
    responseData?.detail,
    responseData?.responseMsg,
  ]
    .map(stringifyErrorValue)
    .join(' ')
    .toLowerCase()

  if (!message.trim()) return statusCode === 400 || statusCode === 422

  return [
    'pincode',
    'serviceable',
    'not serviceable',
    'pickup',
    'destination',
    'warehouse',
    'seller',
    'order_service',
    'order service',
    'surface',
    'regular',
    'large',
  ].some((token) => message.includes(token))
}

export class ShadowfaxService {
  private static cachedConfig: ShadowfaxConfig | null | undefined
  private apiBase = DEFAULT_API_BASE
  private qrBase = DEFAULT_QR_BASE
  private apiToken = process.env.SHADOWFAX_API_TOKEN || process.env.SHADOWFAX_API_KEY || ''
  private clientName = process.env.SHADOWFAX_CLIENT_NAME || ''
  private webhookSecret = process.env.SHADOWFAX_WEBHOOK_SECRET || ''

  static clearCachedConfig() {
    ShadowfaxService.cachedConfig = undefined
  }

  private async ensureConfigLoaded() {
    if (ShadowfaxService.cachedConfig === undefined) {
      ShadowfaxService.cachedConfig = await getEffectiveCourierConfig<ShadowfaxConfig>(
        'shadowfax',
        'b2c',
      )
    }

    const cfg = ShadowfaxService.cachedConfig
    if (cfg) {
      this.apiBase = normalizeBase(cfg.apiBase, this.apiBase)
      this.qrBase = normalizeBase(cfg.apiBase, this.qrBase).replace(/\/dale(\.staging)?/i, (m) =>
        m.includes('staging') ? '/saruman.staging' : '/saruman',
      )
      this.apiToken = cfg.apiToken || this.apiToken
      this.clientName = cfg.clientName || this.clientName
      this.webhookSecret = cfg.webhookSecret || this.webhookSecret
    } else {
      this.apiBase = normalizeBase(process.env.SHADOWFAX_API_BASE, this.apiBase)
      this.qrBase = normalizeBase(process.env.SHADOWFAX_QR_BASE, this.qrBase)
    }
  }

  get configuredWebhookSecret() {
    return this.webhookSecret
  }

  async getConfiguredWebhookSecret() {
    await this.ensureConfigLoaded()
    return this.webhookSecret
  }

  private logRequest(stage: 'request' | 'response' | 'error', method: string, path: string, meta?: any) {
    const payload = {
      provider: 'shadowfax',
      stage,
      method,
      path,
      ...(meta && typeof meta === 'object' ? meta : {}),
    }

    if (stage === 'error') {
      console.error('[Shadowfax]', payload)
      return
    }

    console.log('[Shadowfax]', payload)
  }

  private async client(baseURL?: string): Promise<AxiosInstance> {
    await this.ensureConfigLoaded()
    if (!this.apiToken) {
      throw new HttpError(
        400,
        'Shadowfax API token is not configured. Save the Shadowfax API key in courier credentials or set SHADOWFAX_API_TOKEN.',
      )
    }

    return axios.create({
      baseURL: baseURL || this.apiBase,
      timeout: 30000,
      headers: {
        Authorization: `Token ${this.apiToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    })
  }

  private async get<T = any>(path: string, params?: Record<string, any>, baseURL?: string): Promise<T> {
    try {
      this.logRequest('request', 'GET', path, { params: params || null })
      const http = await this.client(baseURL)
      const response = await http.get(path, { params })
      this.logRequest('response', 'GET', path, { status: response.status })
      return response.data as T
    } catch (error: any) {
      const statusCode = error?.statusCode || error?.response?.status || 502
      this.logRequest('error', 'GET', path, {
        status: statusCode,
        message: parseShadowfaxError(error, 'Shadowfax GET request failed'),
      })
      throw new HttpError(statusCode, parseShadowfaxError(error, 'Shadowfax GET request failed'))
    }
  }

  private async post<T = any>(path: string, data?: Record<string, any>, baseURL?: string): Promise<T> {
    try {
      this.logRequest('request', 'POST', path, { bodyKeys: Object.keys(data || {}) })
      const http = await this.client(baseURL)
      const response = await http.post(path, data || {})
      this.logRequest('response', 'POST', path, { status: response.status })
      return response.data as T
    } catch (error: any) {
      const statusCode = error?.statusCode || error?.response?.status || 502
      const providerMessage = parseShadowfaxError(error, 'Shadowfax POST request failed')
      this.logRequest('error', 'POST', path, {
        status: statusCode,
        message: providerMessage,
        responseData: error?.response?.data || null,
      })
      const httpError: any = new HttpError(statusCode, providerMessage)
      httpError.response = {
        status: error?.response?.status || null,
        data: error?.response?.data || null,
      }
      throw httpError
    }
  }

  private async put<T = any>(path: string, data?: Record<string, any>): Promise<T> {
    try {
      this.logRequest('request', 'PUT', path, { bodyKeys: Object.keys(data || {}) })
      const http = await this.client()
      const response = await http.put(path, data || {})
      this.logRequest('response', 'PUT', path, { status: response.status })
      return response.data as T
    } catch (error: any) {
      const statusCode = error?.statusCode || error?.response?.status || 502
      this.logRequest('error', 'PUT', path, {
        status: statusCode,
        message: parseShadowfaxError(error, 'Shadowfax PUT request failed'),
      })
      throw new HttpError(statusCode, parseShadowfaxError(error, 'Shadowfax PUT request failed'))
    }
  }

  async listServiceablePincodes(service: string, pincodes: Array<string | number>) {
    const joined = pincodes.map((value) => String(value).trim()).filter(Boolean).join(',')
    return this.get<any[]>('/v1/clients/serviceability/', {
      service,
      page: 1,
      count: Math.max(1, pincodes.length || 1),
      pincodes: joined,
    })
  }

  async checkForwardServiceability(params: {
    origin: string
    destination: string
    paymentType?: string | null
    mode?: ShadowfaxForwardMode | string
    service?: ShadowfaxServiceMode | string | null
  }): Promise<ShadowfaxServiceabilityResult> {
    const requestedPayment = String(params.paymentType || 'prepaid').trim().toLowerCase()
    const requestedMode = normalizeForwardMode(params.mode)
    const requestedService = normalizeForwardServiceMode(params.service) || 'surface'
    const candidateServices: Array<ShadowfaxServiceMode | null> =
      requestedService === 'surface'
        ? ['surface', 'regular']
        : requestedService === 'regular'
          ? ['regular', 'surface']
          : ['regular', 'surface', null]
    const candidateModes: ShadowfaxForwardMode[] =
      requestedMode === 'warehouse' ? ['warehouse', 'marketplace'] : ['marketplace', 'warehouse']
    const serviceabilityCache = new Map<string, Promise<any>>()
    const fetchServiceability = (service: string, pincode: string) => {
      const key = `${service}:${pincode}`
      if (!serviceabilityCache.has(key)) {
        serviceabilityCache.set(key, this.listServiceablePincodes(service, [pincode]))
      }
      return serviceabilityCache.get(key)!
    }

    const attemptMode = async (
      forwardMode: ShadowfaxForwardMode,
      forwardService: ShadowfaxServiceMode | null,
    ): Promise<ShadowfaxForwardServiceabilityAttempt> => {
      const originService = forwardMode === 'warehouse' ? 'warehouse_pickup' : 'seller_pickup'
      const [originResp, destinationResp] = await Promise.all([
        fetchServiceability(originService, params.origin),
        fetchServiceability('customer_delivery', params.destination),
      ])

      const originEntry = findServiceabilityEntry(originResp, params.origin)
      const destinationEntry = findServiceabilityEntry(destinationResp, params.destination)
      const destinationServices = extractServiceabilityServices(destinationEntry)
      const originAvailable = isForwardOriginAvailableForService(originEntry, forwardService)
      const destinationAvailable = isForwardDestinationAvailableForService(
        destinationEntry,
        forwardService,
      )
      const destinationCodAvailable = isCodServiceAvailable(destinationEntry)
      const serviceable =
        originAvailable &&
        destinationAvailable &&
        (requestedPayment !== 'cod' || destinationCodAvailable)

      console.log('[Shadowfax] Forward serviceability resolution', {
        origin: params.origin,
        destination: params.destination,
        mode: forwardMode,
        service: forwardService,
        requestedService,
        originService,
        originAvailable,
        destinationAvailable,
        destinationCodAvailable,
        originEntry,
        destinationEntry,
        originResp,
        destinationResp,
      })

      return {
        mode: forwardMode,
        service: forwardService,
        originService,
        originResp,
        destinationResp,
        originEntry,
        destinationEntry,
        originAvailable,
        destinationAvailable,
        destinationCodAvailable,
        serviceable,
        destinationServices,
      }
    }

    const attempts: ShadowfaxForwardServiceabilityAttempt[] = []
    for (const service of candidateServices) {
      for (const mode of candidateModes) {
        const attempt = await attemptMode(mode, service)
        attempts.push(attempt)
        if (attempt.serviceable) {
          return {
            serviceable: true,
            services: attempt.destinationServices,
            codAvailable: attempt.destinationCodAvailable,
            prepaidAvailable: true,
            tat: null,
            mode: attempt.mode,
            service: attempt.service,
            raw: { attempts, selected: attempt.mode, selectedService: attempt.service },
          }
        }
      }
    }

    const fallbackAttempt = attempts[0]

    return {
      serviceable: false,
      services: fallbackAttempt?.destinationServices || [],
      codAvailable: false,
      prepaidAvailable: false,
      tat: null,
      mode: fallbackAttempt?.mode || requestedMode,
      service: fallbackAttempt?.service ?? requestedService,
      raw: { attempts, selected: null, selectedService: null },
    }
  }

  async checkReverseServiceability(params: { origin: string; destination: string }): Promise<ShadowfaxServiceabilityResult> {
    const [originResp, destinationResp] = await Promise.all([
      this.listServiceablePincodes('customer_pickup', [params.origin]),
      this.listServiceablePincodes('warehouse_return', [params.destination]),
    ])

    const originEntry = findServiceabilityEntry(originResp, params.origin)
    const destinationEntry = findServiceabilityEntry(destinationResp, params.destination)
    const originAvailable = isServiceabilityEntryAvailable(originEntry)
    const destinationAvailable = isServiceabilityEntryAvailable(destinationEntry)
    const serviceable = originAvailable && destinationAvailable

    console.log('[Shadowfax] Reverse serviceability resolution', {
      origin: params.origin,
      destination: params.destination,
      originAvailable,
      destinationAvailable,
      originEntry,
      destinationEntry,
      originResp,
      destinationResp,
    })

    return {
      serviceable,
      services: extractServiceabilityServices(originEntry),
      codAvailable: false,
      prepaidAvailable: serviceable,
      tat: null,
      raw: { origin: originResp, destination: destinationResp },
    }
  }

  async generateForwardAwb(count = 1) {
    return this.post('/v3/clients/generate_marketplace_awb/', { count })
  }

  async generateReverseAwb(count = 1) {
    return this.post('/v3/clients/orders/generate_awb/', { count })
  }

  private buildForwardPayload(params: any, mode: ShadowfaxForwardMode, service: ShadowfaxServiceMode) {
    const paymentMode = normalizePaymentMode(params.payment_type)
    const orderItems = Array.isArray(params.order_items) ? params.order_items : []
    const totalProductValue = orderItems.reduce((sum: number, item: any) => {
      const qty = Number(item?.qty ?? item?.quantity ?? 1)
      const price = Number(item?.price ?? 0)
      return sum + price * qty
    }, 0)
    const totalTax = orderItems.reduce((sum: number, item: any) => {
      const qty = Number(item?.qty ?? item?.quantity ?? 1)
      const price = Number(item?.price ?? 0)
      const discount = Number(item?.discount ?? 0)
      const taxRate = Number(item?.tax_rate ?? 0)
      return sum + Math.max(0, price * qty - discount) * (taxRate / 100)
    }, 0)

    const originDetails = buildShadowfaxOriginDetails(params)

    return {
      order_type: mode,
      order_details: {
        client_order_id: params.order_number,
        awb_number: params.awb_number || undefined,
        actual_weight: Number(params.package_weight ?? params.weight ?? 0),
        volumetric_weight: Number(params.volumetricWeight ?? 0),
        product_value: Number(totalProductValue || params.order_amount || 0),
        payment_mode: paymentMode,
        cod_amount: paymentMode === 'COD' ? Number(params.order_amount ?? 0) : 0,
        promised_delivery_date: params.preferred_dispatch_date || undefined,
        total_amount: Number(params.order_amount ?? totalProductValue + totalTax),
        eway_bill:
          params.ewbn ||
          params.ewb ||
          params.ewbn_number ||
          params.ewaybill_number ||
          undefined,
        gstin_number: params.company?.gst || params.pickup?.gst_number || undefined,
        order_service: service,
      },
      customer_details: {
        name: params.consignee?.name,
        contact: sanitizePhone(params.consignee?.phone),
        address_line_1: params.consignee?.address,
        address_line_2: params.consignee?.address_2 || '',
        city: params.consignee?.city,
        state: params.consignee?.state,
        pincode: Number(params.consignee?.pincode),
        alternate_contact: sanitizePhone(params.consignee?.phone),
        latitude: '',
        longitude: '',
        ...(mode === 'warehouse' ? { location_type: params.address_type || 'residential' } : {}),
      },
      pickup_details: {
        ...originDetails,
      },
      ...(mode === 'warehouse'
        ? {
            warehouse_name: originDetails.name,
            warehouse_address: originDetails.address_line_1,
            warehouse_address_line_2: originDetails.address_line_2,
            warehouse_city: originDetails.city,
            warehouse_state: originDetails.state,
            warehouse_pincode: originDetails.pincode,
            warehouse_contact: originDetails.contact,
            warehouse_contact_number: originDetails.contact,
            warehouse_unique_code: originDetails.unique_code,
            warehouse_details: {
              ...originDetails,
              warehouse_name: originDetails.name,
              warehouse_address: originDetails.address_line_1,
            },
            origin_details: {
              ...originDetails,
              location_type: 'warehouse',
            },
          }
        : {}),
      rto_details: {
        name: params.rto?.name || params.pickup?.name || params.pickup?.warehouse_name || 'RTO',
        contact: sanitizePhone(params.rto?.phone || params.pickup?.phone),
        address_line_1: params.rto?.address || params.pickup?.address,
        address_line_2: params.rto?.address_2 || params.pickup?.address_2 || '',
        city: params.rto?.city || params.pickup?.city,
        state: params.rto?.state || params.pickup?.state,
        pincode: Number(params.rto?.pincode || params.pickup?.pincode),
        email: params.consignee?.email || undefined,
        latitude: '',
        longitude: '',
        unique_code:
          params.return_location_alias ||
          params.rto?.addressNickname ||
          params.pickup_location_id ||
          params.pickup?.warehouse_name,
      },
      product_details: orderItems.map((item: any) => {
        const qty = Number(item?.qty ?? item?.quantity ?? 1)
        const price = Number(item?.price ?? 0)
        const taxRate = Number(item?.tax_rate ?? 0)
        const taxAmount = Number(((price * qty) * (taxRate / 100)).toFixed(2))
        return {
          hsn_code: item?.hsn || item?.hsnCode || '',
          invoice_no: params.invoice_number || '',
          sku_name: item?.name || 'Item',
          sku_id: item?.sku || '',
          category: '',
          price,
          seller_details: {
            seller_name: params.company?.name || params.pickup?.warehouse_name || '',
            seller_address: params.pickup?.address || '',
            seller_state: params.pickup?.state || '',
            gstin_number: params.company?.gst || params.pickup?.gst_number || '',
          },
          taxes: {
            cgst: taxRate > 0 ? taxAmount / 2 : 0,
            sgst: taxRate > 0 ? taxAmount / 2 : 0,
            igst: 0,
            total_tax: taxAmount,
          },
          additional_details: {
            requires_extra_care: normalizeBoolString(params.fragile_shipment, 'False'),
            type_extra_care: params.fragile_shipment ? 'Fragile' : '',
            quantity: qty,
          },
        }
      }),
    }
  }

  async createForwardShipment(params: any, options: { mode: ShadowfaxForwardMode; service?: ShadowfaxServiceMode }) {
    const service = options.service || 'surface'
    const payload = this.buildForwardPayload(params, options.mode, service)
    console.log('[Shadowfax] Forward booking payload', {
      order_number: params.order_number,
      mode: options.mode,
      service,
      pickup_details: payload.pickup_details,
      warehouse_details: (payload as any).warehouse_details || null,
      origin_details: (payload as any).origin_details || null,
      customer_details: payload.customer_details,
      rto_details: payload.rto_details,
    })
    const response = await this.post('/v3/clients/orders/', payload)
    const providerFailure = extractShadowfaxProviderFailure(response)
    if (providerFailure) {
      throw new HttpError(400, providerFailure)
    }
    return normalizeForwardShipmentResponse(response)
  }

  async createForwardShipmentWithFallback(
    params: any,
    options: {
      mode: ShadowfaxForwardMode | string
      service?: ShadowfaxServiceMode | string | null
      origin?: string | number | null
      destination?: string | number | null
      paymentType?: string | null
    },
  ): Promise<ShadowfaxForwardBookingResult> {
    const requestedMode = normalizeForwardMode(options.mode)
    const requestedService = normalizeForwardServiceMode(options.service) || 'surface'
    const origin = firstNonEmptyString(options.origin, params.pickup?.pincode)
    const destination = firstNonEmptyString(options.destination, params.consignee?.pincode)
    const paymentType = String(options.paymentType ?? params.payment_type ?? 'prepaid')
    const attempts: ShadowfaxForwardBookingAttemptSummary[] = []
    const bookedKeys = new Set<string>()
    let lastError: any = null

    for (const attempt of buildForwardBookingAttempts(requestedMode, requestedService)) {
      const summary: ShadowfaxForwardBookingAttemptSummary = { ...attempt }
      attempts.push(summary)

      const serviceability = await this.checkForwardServiceability({
        origin,
        destination,
        paymentType,
        mode: attempt.mode,
        service: attempt.service,
      })

      summary.serviceable = serviceability.serviceable
      summary.selectedMode = serviceability.mode
      summary.selectedService = serviceability.service

      if (!serviceability.serviceable) {
        summary.error = `Not serviceable for ${attempt.mode}/${attempt.service}`
        lastError = new HttpError(
          400,
          `Shadowfax ${attempt.mode}/${attempt.service} is not serviceable between ${origin} and ${destination}.`,
        )
        continue
      }

      const resolvedMode =
        serviceability.mode === 'warehouse' || serviceability.mode === 'marketplace'
          ? serviceability.mode
          : attempt.mode
      const resolvedService =
        serviceability.service === 'regular' || serviceability.service === 'surface'
          ? serviceability.service
          : attempt.service
      const bookingKey = `${resolvedMode}:${resolvedService}`

      if (bookedKeys.has(bookingKey)) {
        summary.error = `Already tried ${bookingKey}`
        continue
      }
      bookedKeys.add(bookingKey)

      try {
        const shipment = await this.createForwardShipment(params, {
          mode: resolvedMode,
          service: resolvedService,
        })
        summary.booked = true
        return {
          shipment,
          mode: resolvedMode,
          service: resolvedService,
          attempts,
        }
      } catch (error: any) {
        lastError = error
        summary.error = parseShadowfaxError(error, 'Shadowfax forward booking attempt failed')
        if (!isRetryableForwardBookingError(error)) {
          ;(error as any).shadowfaxAttempts = attempts
          throw error
        }
        console.warn('[Shadowfax] Forward booking attempt failed; trying alternate service', {
          order_number: params.order_number,
          attemptedMode: resolvedMode,
          attemptedService: resolvedService,
          requestedMode,
          requestedService,
          origin,
          destination,
          message: summary.error,
        })
      }
    }

    const fallbackMessage =
      lastError?.message ||
      `Shadowfax is not serviceable between ${origin || 'origin'} and ${destination || 'destination'}.`
    if (lastError instanceof HttpError) {
      ;(lastError as any).shadowfaxAttempts = attempts
      throw lastError
    }

    const statusCode = getErrorStatusCode(lastError)
    const error = new HttpError(
      statusCode && statusCode >= 400 && statusCode < 500 ? statusCode : 400,
      fallbackMessage,
    )
    ;(error as any).shadowfaxAttempts = attempts
    throw error
  }

  private buildReversePayload(params: any) {
    const orderItems = Array.isArray(params.order_items) ? params.order_items : []
    return {
      client_order_number: params.order_number,
      client_request_id: params.order_number,
      warehouse_name: params.pickup?.warehouse_name || this.clientName || 'Warehouse',
      warehouse_address: params.pickup?.address || '',
      destination_pincode: Number(params.rto?.pincode || params.pickup?.pincode),
      unique_code:
        params.return_location_alias ||
        params.pickup_location_id ||
        params.pickup?.addressNickname ||
        params.pickup?.warehouse_name,
      total_amount: Number(params.order_amount ?? 0),
      price: Number(params.order_amount ?? 0),
      eway_bill:
        params.ewbn ||
        params.ewb ||
        params.ewbn_number ||
        params.ewaybill_number ||
        undefined,
      pickup_type: params.transport_speed === 'surface' ? 'surface' : 'regular',
      address_attributes: {
        address_line: params.consignee?.address,
        city: params.consignee?.city,
        country: params.consignee?.country || 'India',
        pincode: Number(params.consignee?.pincode),
        name: params.consignee?.name,
        phone_number: sanitizePhone(params.consignee?.phone),
        alternate_contact: sanitizePhone(params.consignee?.phone),
        sms_contact: sanitizePhone(params.consignee?.phone),
        latitude: '',
        longitude: '',
        location_accuracy: 'L',
        location_type: params.address_type || 'residential',
      },
      weight_details: {
        actual_weight: Number(params.package_weight ?? params.weight ?? 0),
        volumetric_weight: Number(params.volumetricWeight ?? 0),
      },
      skus_attributes: orderItems.map((item: any) => {
        const qty = Number(item?.qty ?? item?.quantity ?? 1)
        const price = Number(item?.price ?? 0)
        const taxRate = Number(item?.tax_rate ?? 0)
        const totalTaxAmount = Number(((price * qty) * (taxRate / 100)).toFixed(2))
        return {
          name: item?.name || 'Item',
          client_sku_id: item?.sku || '',
          price,
          brand: '',
          category: '',
          return_reason: '',
          qc_required: normalizeBoolString(params.qc_details?.required ?? true, 'True').toLowerCase(),
          qc_rules: Array.isArray(params.qc_details?.rules) ? params.qc_details.rules : [],
          seller_details: {
            regd_name: params.company?.name || params.pickup?.warehouse_name || 'Seller',
            regd_address: params.pickup?.address || '',
            state: params.pickup?.state || '',
            gstin: params.company?.gst || params.pickup?.gst_number || '',
          },
          taxes: {
            cgst_amount: taxRate > 0 ? totalTaxAmount / 2 : 0,
            sgst_amount: taxRate > 0 ? totalTaxAmount / 2 : 0,
            igst_amount: 0,
            total_tax_amount: totalTaxAmount,
          },
          hsn_code: item?.hsn || item?.hsnCode || '',
          invoice_id: params.invoice_number || params.order_number,
          additional_details: {
            color: '',
            size: '',
            sku_images: [],
            quantity_value: qty,
            quantity: qty,
            quantity_unit: 'EA',
          },
        }
      }),
    }
  }

  async createReverseShipment(params: any) {
    const payload = this.buildReversePayload(params)
    const response = await this.post('/v3/clients/requests', payload)
    const providerFailure = extractShadowfaxProviderFailure(response)
    if (providerFailure) {
      throw new HttpError(400, providerFailure)
    }
    return normalizeReverseShipmentResponse(response)
  }

  async trackShipment(awbNumber: string) {
    return this.get(`/v4/clients/orders/${encodeURIComponent(awbNumber)}/track/`)
  }

  async bulkTrackShipments(awbNumbers: string[]) {
    return this.post('/v4/clients/bulk_track/', { awb_numbers: awbNumbers })
  }

  async trackReverseShipment(requestId: string) {
    return this.get(`/v4/clients/requests/${encodeURIComponent(requestId)}`)
  }

  async bulkTrackReverseShipments(requestIds: string[]) {
    return this.post('/v4/clients/requests/bulk_query', { request_ids: requestIds })
  }

  async updateForwardOrder(payload: Record<string, any>) {
    return this.post('/v3/clients/order_update/', payload)
  }

  async updateReverseOrder(payload: Record<string, any>) {
    return this.post('/v1/clients/order_update/', payload)
  }

  async updateReverseQcFlag(payload: { awb_number: string; qc_flag: boolean; sku_id?: string }) {
    return this.put('/v2/clients/requests/update_qc/', payload)
  }

  async cancelShipment(requestId: string, remarks = 'Cancelled By Customer') {
    console.log('[Shadowfax] Cancel shipment request', {
      requestId,
      remarks,
      reverse: String(requestId).toUpperCase().startsWith('R'),
    })
    if (String(requestId).toUpperCase().startsWith('R')) {
      return this.post('/v2/clients/requests/mark_cancel', {
        request_id: requestId,
        cancel_remarks: remarks,
      })
    }
    return this.post('/v3/clients/orders/cancel/', {
      request_id: requestId,
      awb_number: requestId,
      cancel_remarks: remarks,
    })
  }

  async createEscalation(payload: { awb_number: string; issue_category: number }) {
    return this.post('/v1/clients/support/issue/', payload)
  }

  async getPodDetails(awbNumbers: string[], reverse = false) {
    return this.post('/v1/clients/pod_details/', reverse ? { request_ids: awbNumbers } : { awb_numbers: awbNumbers })
  }

  async generateQrCode(payload: Record<string, any>) {
    return this.post('/v2/clients/qr_code/generate/', payload, this.qrBase)
  }
}
