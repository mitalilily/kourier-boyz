import crypto from 'crypto'
import { Request, Response } from 'express'
import { and, eq, gte, isNull } from 'drizzle-orm'
import { db } from '../models/client'
import { courier_credentials } from '../models/schema/courierCredentials'
import { pending_webhooks } from '../schema/schema'
import {
  calculateInnofulfillEcommRates,
  cancelInnofulfillOrdersBulk,
  checkInnofulfillEcommServiceability,
  createInnofulfillInvoiceConfiguration,
  createInnofulfillLabelConfiguration,
  createInnofulfillOrder,
  downloadInnofulfillInvoice,
  downloadInnofulfillShippingLabel,
  getInnofulfillOrder,
  listInnofulfillInvoiceConfigurations,
  listInnofulfillLabelConfigurations,
  listInnofulfillOrders,
  loginToInnofulfill,
  manifestInnofulfillOrdersBulk,
  refreshInnofulfillToken,
  trackInnofulfillShipmentByAwb,
} from '../models/services/innofulfill.service'

const SUPPORTED_SIGNIN_TYPES = new Set(['EMAIL'])
const SUPPORTED_PAYMENT_MODES = new Set(['PREPAID', 'COD'])
const SUPPORTED_DELIVERY_MODES = new Set(['SURFACE', 'AIR'])
const SUPPORTED_RATE_TYPES = new Set(['ECOMM', 'HYPERLOCAL'])
const SUPPORTED_ORDER_TYPES = new Set(['FORWARD', 'REVERSE'])
const SUPPORTED_ORDER_CATEGORIES = new Set(['ECOMM', 'HYPERLOCAL'])
const SUPPORTED_INVOICE_LEVELS = new Set(['product', 'shipping'])
const SUPPORTED_INVOICE_CONFIG_LEVELS = new Set(['shipping level', 'product level'])
const INNOFULFILL_PROVIDER = 'innofulfill'
const INNOFULFILL_ECOMM_CARRIER_ID = '30d5f835-a63a-4125-b095-93b3098e4e3d'
const INNOFULFILL_ECOMM_CARRIER_NAME = 'innofulfill_ecomm'
const INNOFULFILL_HYPERLOCAL_CARRIER_NAME = 'innofulfillHyperlocal'
const INNOFULFILL_WEBHOOK_SIGNATURE_HEADERS = ['x-webhook-signature']
const INNOFULFILL_WEBHOOK_SENSITIVE_HEADERS = new Set([
  ...INNOFULFILL_WEBHOOK_SIGNATURE_HEADERS,
  'authorization',
])
const ORDER_LIST_QUERY_PARAMS = new Set([
  'page',
  'limit',
  'sortOrder',
  'orderId',
  'referenceId',
  'orderStatus',
  'orderType',
  'parcelCategory',
  'deliveryMode',
  'deliveryPromise',
  'carrierName',
  'awbNumber',
  'phone',
  'paymentType',
  'startDate',
  'endDate',
  'manifested',
  'autoManifest',
  'returnable',
  'filterByCurrentUser',
  'bulkId',
  'destinationCity',
  'destinationZip',
  'addresses.type',
  'addresses.state',
  'addresses.city',
  'addresses.zip',
  'addresses.country',
])
const LABEL_CONFIG_QUERY_PARAMS = new Set(['page', 'limit', 'search'])
const INVOICE_CONFIG_QUERY_PARAMS = new Set(['page', 'limit', 'search', 'invoiceLevel'])
const TENANT_HEADER_NAMES = [
  'x-tenant-id',
  'x-root-tenant-id',
  'x-current-tenant-id',
  'tenant-id',
]

const normalizeString = (value: unknown) => (typeof value === 'string' ? value.trim() : '')
const normalizeNumber = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value.trim()))) {
    return Number(value.trim())
  }
  return null
}
const normalizePincode = (value: unknown) => {
  if (typeof value === 'number' && Number.isInteger(value)) return value
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) return Number(value.trim())
  return null
}

const isValidPincode = (value: number | null): value is number =>
  value !== null && Number.isInteger(value) && value >= 100000 && value <= 999999
const isPositiveNumber = (value: number | null): value is number => value !== null && value > 0
const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const getForwardableTenantHeaders = (req: Request) =>
  TENANT_HEADER_NAMES.reduce<Record<string, string>>((headers, headerName) => {
    const value = req.headers[headerName]
    if (typeof value === 'string' && value.trim()) {
      headers[headerName] = value.trim()
    }
    return headers
  }, {})

const getForwardableAuthHeaders = (req: Request) => {
  const headers: Record<string, string> = {}
  const authorization = req.headers.authorization
  const tenantId = req.headers.tenantid
  const apiKey = req.headers['api-key']

  if (typeof authorization === 'string' && authorization.trim()) {
    headers.Authorization = authorization.trim()
  }
  if (typeof tenantId === 'string' && tenantId.trim()) {
    headers.TenantId = tenantId.trim()
    headers.tenantid = tenantId.trim()
  }
  if (typeof apiKey === 'string' && apiKey.trim()) {
    headers['Api-Key'] = apiKey.trim()
    headers['api-key'] = apiKey.trim()
  }

  return headers
}

const hasInnofulfillAuth = (headers: Record<string, string>) =>
  Boolean(
    headers['Api-Key'] ||
      headers['api-key'] ||
      (headers.Authorization && (headers.TenantId || headers.tenantid)),
  )

const getForwardableQueryParams = (
  query: Request['query'],
  allowedParams: Set<string>,
) =>
  Object.entries(query).reduce<Record<string, string | string[]>>((params, [key, value]) => {
    if (!allowedParams.has(key)) return params

    if (typeof value === 'string' && value.trim()) {
      params[key] = value.trim()
    } else if (Array.isArray(value)) {
      const values = value
        .filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
        .map((item) => item.trim())
      if (values.length) params[key] = values
    }

    return params
  }, {})

const hasAddressType = (addresses: unknown[], type: string) =>
  addresses.some((address) => isPlainObject(address) && normalizeString(address.type).toUpperCase() === type)

const hasRequiredAddressFields = (addresses: unknown[], type: string) =>
  addresses.some((address) => {
    if (!isPlainObject(address) || normalizeString(address.type).toUpperCase() !== type) return false

    return Boolean(
      normalizeString(address.zip) &&
        normalizeString(address.name) &&
        normalizeString(address.phone) &&
        normalizeString(address.city) &&
        normalizeString(address.state) &&
        normalizeString(address.country),
    )
  })

const hasValidShipmentItem = (item: unknown) => {
  if (!isPlainObject(item)) return false

  return Boolean(
    normalizeString(item.name) &&
      isPositiveNumber(normalizeNumber(item.quantity)) &&
      normalizeNumber(item.unitPrice) !== null,
  )
}

const hasValidEcommShipment = (shipment: unknown) => {
  if (!isPlainObject(shipment)) return false

  const dimensions = isPlainObject(shipment.dimensions) ? shipment.dimensions : null
  const items = Array.isArray(shipment.items) ? shipment.items : []

  return Boolean(
    dimensions &&
      isPositiveNumber(normalizeNumber(dimensions.length)) &&
      isPositiveNumber(normalizeNumber(dimensions.width)) &&
      isPositiveNumber(normalizeNumber(dimensions.height)) &&
      normalizeString(shipment.shipmentStatus).toUpperCase() === 'CONFIRMED' &&
      isPositiveNumber(normalizeNumber(shipment.physicalWeight)) &&
      normalizeString(shipment.physicalWeightUnit).toUpperCase() === 'KG' &&
      items.length > 0 &&
      items.every(hasValidShipmentItem),
  )
}

const hasValidEcommPayment = (payment: unknown) => {
  if (!isPlainObject(payment)) return false

  return Boolean(
    SUPPORTED_PAYMENT_MODES.has(normalizeString(payment.type).toUpperCase()) &&
      normalizeString(payment.currency).toUpperCase() === 'INR' &&
      normalizeString(payment.paymentMethod),
  )
}

const normalizeInnofulfillEcommPayload = (payload: Record<string, unknown>) => ({
  ...payload,
  orderType: normalizeString(payload.orderType).toUpperCase(),
  orderStatus: normalizeString(payload.orderStatus).toUpperCase() || 'CONFIRMED',
  parcelCategory: 'ECOMM',
  deliveryPromise: 'ECOMM',
  deliveryMode: normalizeString(payload.deliveryMode).toUpperCase(),
  carrierId: normalizeString(payload.carrierId) || INNOFULFILL_ECOMM_CARRIER_ID,
  carrierName: normalizeString(payload.carrierName) || INNOFULFILL_ECOMM_CARRIER_NAME,
})

const validateInnofulfillEcommOrderPayload = (payload: Record<string, unknown>) => {
  const deliveryMode = normalizeString(payload.deliveryMode).toUpperCase()
  const addresses = Array.isArray(payload.addresses) ? payload.addresses : []
  const shipments = Array.isArray(payload.shipments) ? payload.shipments : []

  if (
    !SUPPORTED_ORDER_TYPES.has(normalizeString(payload.orderType).toUpperCase()) ||
    normalizeString(payload.orderStatus).toUpperCase() !== 'CONFIRMED' ||
    normalizeString(payload.parcelCategory).toUpperCase() !== 'ECOMM' ||
    normalizeString(payload.deliveryPromise).toUpperCase() !== 'ECOMM' ||
    !SUPPORTED_DELIVERY_MODES.has(deliveryMode) ||
    normalizeString(payload.carrierId) !== INNOFULFILL_ECOMM_CARRIER_ID ||
    normalizeString(payload.carrierName) !== INNOFULFILL_ECOMM_CARRIER_NAME ||
    !hasRequiredAddressFields(addresses, 'PICKUP') ||
    !hasRequiredAddressFields(addresses, 'DELIVERY') ||
    shipments.length === 0 ||
    !shipments.every(hasValidEcommShipment) ||
    !hasValidEcommPayment(payload.payment)
  ) {
    return [
      'orderType=FORWARD|REVERSE',
      'orderStatus=CONFIRMED',
      'parcelCategory=ECOMM',
      'deliveryPromise=ECOMM',
      'deliveryMode=SURFACE|AIR',
      `carrierId=${INNOFULFILL_ECOMM_CARRIER_ID}`,
      `carrierName=${INNOFULFILL_ECOMM_CARRIER_NAME}`,
      'addresses[] with valid PICKUP and DELIVERY entries',
      'shipments[] with dimensions, shipmentStatus=CONFIRMED, physicalWeight, physicalWeightUnit=KG, and items[]',
      'payment.type=PREPAID|COD, payment.currency=INR, payment.paymentMethod',
    ]
  }

  return []
}

const normalizeInnofulfillHyperlocalPayload = (payload: Record<string, unknown>) => ({
  ...payload,
  orderType: normalizeString(payload.orderType).toUpperCase(),
  orderStatus: normalizeString(payload.orderStatus).toUpperCase() || 'CONFIRMED',
  parcelCategory: 'HYPERLOCAL',
  deliveryPromise: 'HYPERLOCAL',
  deliveryMode: '',
  carrierName: normalizeString(payload.carrierName) || INNOFULFILL_HYPERLOCAL_CARRIER_NAME,
})

const validateInnofulfillHyperlocalOrderPayload = (payload: Record<string, unknown>) => {
  const addresses = Array.isArray(payload.addresses) ? payload.addresses : []
  const shipments = Array.isArray(payload.shipments) ? payload.shipments : []

  if (
    !SUPPORTED_ORDER_TYPES.has(normalizeString(payload.orderType).toUpperCase()) ||
    normalizeString(payload.orderStatus).toUpperCase() !== 'CONFIRMED' ||
    normalizeString(payload.parcelCategory).toUpperCase() !== 'HYPERLOCAL' ||
    normalizeString(payload.deliveryPromise).toUpperCase() !== 'HYPERLOCAL' ||
    normalizeString(payload.deliveryMode) !== '' ||
    normalizeString(payload.carrierName) !== INNOFULFILL_HYPERLOCAL_CARRIER_NAME ||
    !hasRequiredAddressFields(addresses, 'PICKUP') ||
    !hasRequiredAddressFields(addresses, 'DELIVERY') ||
    shipments.length === 0 ||
    !shipments.every(hasValidEcommShipment) ||
    !hasValidEcommPayment(payload.payment)
  ) {
    return [
      'orderType=FORWARD|REVERSE',
      'orderStatus=CONFIRMED',
      'parcelCategory=HYPERLOCAL',
      'deliveryPromise=HYPERLOCAL',
      'deliveryMode empty string',
      `carrierName=${INNOFULFILL_HYPERLOCAL_CARRIER_NAME}`,
      'addresses[] with valid same-city PICKUP and DELIVERY entries',
      'shipments[] with dimensions, shipmentStatus=CONFIRMED, physicalWeight, physicalWeightUnit=KG, and items[]',
      'payment.type=PREPAID|COD, payment.currency=INR, payment.paymentMethod',
    ]
  }

  return []
}

const getHeaderValue = (headers: Request['headers'], headerName: string) => {
  const value = headers[headerName.toLowerCase()]
  if (Array.isArray(value)) return normalizeString(value[0])
  return normalizeString(value)
}

const timingSafeStringEqual = (left: string, right: string) => {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)

  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer)
}

const isValidInnofulfillWebhookSignature = (signature: string, secret: string, rawBody: string) => {
  const normalizedSignature = signature.startsWith('Bearer ')
    ? signature.slice('Bearer '.length).trim()
    : signature
  const hmacHex = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
  const hmacBase64 = crypto.createHmac('sha256', secret).update(rawBody).digest('base64')
  const candidates = [hmacHex, `sha256=${hmacHex}`, hmacBase64, `sha256=${hmacBase64}`]

  return candidates.some((candidate) => timingSafeStringEqual(normalizedSignature, candidate))
}

const fetchInnofulfillWebhookSignatureKey = async () => {
  const envSecret = normalizeString(process.env.INNOFULFILL_WEBHOOK_SIGNATURE_KEY)
  if (envSecret) return envSecret

  try {
    const [row] = await db
      .select({
        webhookSecret: courier_credentials.webhookSecret,
      })
      .from(courier_credentials)
      .where(eq(courier_credentials.provider, INNOFULFILL_PROVIDER))
      .limit(1)

    return normalizeString(row?.webhookSecret)
  } catch (error: any) {
    console.error('Failed to load Innofulfill webhook signature key', {
      message: error?.message || String(error),
    })
    return ''
  }
}

const sanitizeInnofulfillWebhookHeaders = (headers: Request['headers']) =>
  Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [
      key,
      INNOFULFILL_WEBHOOK_SENSITIVE_HEADERS.has(key.toLowerCase()) ? '[redacted]' : value,
    ]),
  )

const sendInnofulfillDocumentResponse = (
  res: Response,
  result: { status: number; data: unknown; headers?: Record<string, unknown> },
) => {
  const contentType = String(result.headers?.['content-type'] || 'application/octet-stream')
  const contentDisposition = result.headers?.['content-disposition']

  res.status(result.status)
  res.setHeader('Content-Type', contentType)
  if (contentDisposition) {
    res.setHeader('Content-Disposition', String(contentDisposition))
  }

  if (contentType.includes('application/json')) {
    const rawBody = Buffer.isBuffer(result.data)
      ? result.data.toString('utf8')
      : Buffer.from(result.data as ArrayBuffer).toString('utf8')

    try {
      return res.json(JSON.parse(rawBody))
    } catch {
      return res.send(rawBody)
    }
  }

  return res.send(Buffer.from(result.data as ArrayBuffer))
}

export const innofulfillLoginController = async (req: Request, res: Response) => {
  const username = normalizeString(req.body?.username)
  const password = typeof req.body?.password === 'string' ? req.body.password : ''
  const signinType = normalizeString(req.body?.signinType).toUpperCase()

  if (!username || !password || !signinType) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields',
      required: ['username', 'password', 'signinType'],
    })
  }

  if (!SUPPORTED_SIGNIN_TYPES.has(signinType)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid signinType. Currently supported: EMAIL',
    })
  }

  try {
    const result = await loginToInnofulfill(
      {
        username,
        password,
        signinType: signinType as 'EMAIL',
      },
      getForwardableTenantHeaders(req),
    )

    return res.status(result.status).json(result.data)
  } catch (error: any) {
    console.error('Innofulfill login request failed', {
      message: error?.message || String(error),
      code: error?.code,
      status: error?.response?.status,
    })

    return res.status(502).json({
      success: false,
      message: 'Unable to reach Shreemaruti authentication service',
    })
  }
}

export const innofulfillRefreshTokenController = async (req: Request, res: Response) => {
  const userId = normalizeString(req.body?.userId)
  const refreshToken = normalizeString(req.body?.refreshToken)

  if (!userId || !refreshToken) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields',
      required: ['userId', 'refreshToken'],
    })
  }

  try {
    const result = await refreshInnofulfillToken(
      {
        userId,
        refreshToken,
      },
      getForwardableTenantHeaders(req),
    )

    return res.status(result.status).json(result.data)
  } catch (error: any) {
    console.error('Innofulfill refresh token request failed', {
      message: error?.message || String(error),
      code: error?.code,
      status: error?.response?.status,
    })

    return res.status(502).json({
      success: false,
      message: 'Unable to reach Shreemaruti authentication service',
    })
  }
}

export const innofulfillEcommServiceabilityController = async (req: Request, res: Response) => {
  const fromPincode = normalizePincode(req.body?.fromPincode)
  const toPincode = normalizePincode(req.body?.toPincode)
  const paymentMode = normalizeString(req.body?.paymentMode).toUpperCase() || undefined
  const operationType = normalizeString(req.body?.operationType).toUpperCase()
  const carriers = Array.isArray(req.body?.carriers)
    ? req.body.carriers.map((carrier: unknown) => normalizeString(carrier).toUpperCase()).filter(Boolean)
    : undefined
  const authHeaders = getForwardableAuthHeaders(req)

  if (!hasInnofulfillAuth(authHeaders)) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Provide Api-Key or Authorization Bearer token with TenantId.',
    })
  }

  if (!isValidPincode(fromPincode) || !isValidPincode(toPincode) || !operationType) {
    return res.status(400).json({
      success: false,
      message: 'Missing or invalid required fields',
      required: ['fromPincode', 'toPincode', 'operationType'],
    })
  }

  if (paymentMode && !SUPPORTED_PAYMENT_MODES.has(paymentMode)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid paymentMode. Currently supported: PREPAID, COD',
    })
  }

  if (req.body?.carriers !== undefined && (!carriers || carriers.length === 0)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid carriers. Provide a non-empty array of carrier codes.',
    })
  }

  try {
    const result = await checkInnofulfillEcommServiceability(
      {
        fromPincode: fromPincode!,
        toPincode: toPincode!,
        ...(paymentMode ? { paymentMode: paymentMode as 'PREPAID' | 'COD' } : {}),
        operationType,
        ...(carriers ? { carriers } : {}),
      },
      authHeaders,
    )

    return res.status(result.status).json(result.data)
  } catch (error: any) {
    console.error('Innofulfill ECOMM serviceability request failed', {
      message: error?.message || String(error),
      code: error?.code,
      status: error?.response?.status,
    })

    return res.status(502).json({
      success: false,
      message: 'Unable to reach Shreemaruti serviceability service',
    })
  }
}

export const innofulfillEcommRateCalculationController = async (req: Request, res: Response) => {
  const fromPincode = normalizePincode(req.body?.fromPincode)
  const toPincode = normalizePincode(req.body?.toPincode)
  const serviceType = normalizeString(req.body?.serviceType).toUpperCase()
  const productType = normalizeString(req.body?.productType).toUpperCase()
  const weight = normalizeNumber(req.body?.weight)
  const length = normalizeNumber(req.body?.length)
  const height = normalizeNumber(req.body?.height)
  const width = normalizeNumber(req.body?.width)
  const distance = normalizeNumber(req.body?.distance)
  const deliveryMode = normalizeString(req.body?.filters?.delivery_mode).toUpperCase()
  const authHeaders = getForwardableAuthHeaders(req)
  const isEcommRate = serviceType === 'ECOMM' && productType === 'ECOMM'
  const isHyperlocalRate = serviceType === 'HYPERLOCAL' && productType === 'HYPERLOCAL'

  if (!hasInnofulfillAuth(authHeaders)) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Provide Api-Key or Authorization Bearer token with TenantId.',
    })
  }

  if (
    !isValidPincode(fromPincode) ||
    !isValidPincode(toPincode) ||
    !SUPPORTED_RATE_TYPES.has(serviceType) ||
    !SUPPORTED_RATE_TYPES.has(productType) ||
    serviceType !== productType ||
    !isPositiveNumber(weight) ||
    !isPositiveNumber(length) ||
    !isPositiveNumber(height) ||
    !isPositiveNumber(width)
  ) {
    return res.status(400).json({
      success: false,
      message: 'Missing or invalid required fields',
      required: [
        'fromPincode',
        'toPincode',
        'serviceType=ECOMM|HYPERLOCAL',
        'productType=ECOMM|HYPERLOCAL',
        'weight',
        'length',
        'height',
        'width',
      ],
    })
  }

  if (isEcommRate && !SUPPORTED_DELIVERY_MODES.has(deliveryMode)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid filters.delivery_mode. Currently supported: SURFACE, AIR',
    })
  }

  if (isHyperlocalRate && !isPositiveNumber(distance)) {
    return res.status(400).json({
      success: false,
      message: 'Missing or invalid distance. HYPERLOCAL rate calculation requires distance in kilometres.',
    })
  }

  if (isHyperlocalRate && req.body?.filters?.delivery_mode !== undefined) {
    return res.status(400).json({
      success: false,
      message: 'Invalid filters for HYPERLOCAL. Leave filters as an empty object.',
    })
  }

  if (
    req.body?.includeDefaultCharges !== undefined &&
    typeof req.body.includeDefaultCharges !== 'boolean'
  ) {
    return res.status(400).json({
      success: false,
      message: 'Invalid includeDefaultCharges. Provide a boolean value.',
    })
  }

  try {
    const result = await calculateInnofulfillEcommRates(
      {
        fromPincode,
        toPincode,
        serviceType: serviceType as 'ECOMM' | 'HYPERLOCAL',
        productType: productType as 'ECOMM' | 'HYPERLOCAL',
        weight,
        length,
        height,
        width,
        ...(isHyperlocalRate ? { distance: distance! } : {}),
        ...(typeof req.body?.includeDefaultCharges === 'boolean'
          ? { includeDefaultCharges: req.body.includeDefaultCharges }
          : {}),
        ...(req.body?.userOptions && typeof req.body.userOptions === 'object'
          ? { userOptions: req.body.userOptions }
          : {}),
        filters: isEcommRate
          ? {
              delivery_mode: deliveryMode as 'SURFACE' | 'AIR',
            }
          : {},
      },
      authHeaders,
    )

    return res.status(result.status).json(result.data)
  } catch (error: any) {
    console.error('Innofulfill ECOMM rate calculation request failed', {
      message: error?.message || String(error),
      code: error?.code,
      status: error?.response?.status,
    })

    return res.status(502).json({
      success: false,
      message: 'Unable to reach Shreemaruti rate calculation service',
    })
  }
}

export const innofulfillListOrdersController = async (req: Request, res: Response) => {
  const authHeaders = getForwardableAuthHeaders(req)

  if (!hasInnofulfillAuth(authHeaders)) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Provide Api-Key or Authorization Bearer token with TenantId.',
    })
  }

  try {
    const result = await listInnofulfillOrders(
      getForwardableQueryParams(req.query, ORDER_LIST_QUERY_PARAMS),
      authHeaders,
    )

    return res.status(result.status).json(result.data)
  } catch (error: any) {
    console.error('Innofulfill list orders request failed', {
      message: error?.message || String(error),
      code: error?.code,
      status: error?.response?.status,
    })

    return res.status(502).json({
      success: false,
      message: 'Unable to reach Shreemaruti orders service',
    })
  }
}

export const innofulfillCreateOrderController = async (req: Request, res: Response) => {
  const authHeaders = getForwardableAuthHeaders(req)
  const payload = isPlainObject(req.body) ? req.body : null

  if (!hasInnofulfillAuth(authHeaders)) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Provide Api-Key or Authorization Bearer token with TenantId.',
    })
  }

  if (!payload) {
    return res.status(400).json({
      success: false,
      message: 'Missing or invalid request body',
    })
  }

  const orderType = normalizeString(payload.orderType).toUpperCase()
  const orderStatus = normalizeString(payload.orderStatus).toUpperCase()
  const parcelCategory = normalizeString(payload.parcelCategory).toUpperCase()
  const deliveryPromise = normalizeString(payload.deliveryPromise).toUpperCase()
  const deliveryMode = normalizeString(payload.deliveryMode).toUpperCase()
  const isEcommOrder = parcelCategory === 'ECOMM' && deliveryPromise === 'ECOMM'
  const isHyperlocalOrder = parcelCategory === 'HYPERLOCAL' && deliveryPromise === 'HYPERLOCAL'
  const carrierId = isEcommOrder
    ? normalizeString(payload.carrierId) || INNOFULFILL_ECOMM_CARRIER_ID
    : normalizeString(payload.carrierId)
  const carrierName = isEcommOrder
    ? normalizeString(payload.carrierName) || INNOFULFILL_ECOMM_CARRIER_NAME
    : isHyperlocalOrder
      ? normalizeString(payload.carrierName) || INNOFULFILL_HYPERLOCAL_CARRIER_NAME
      : normalizeString(payload.carrierName)
  const addresses = Array.isArray(payload.addresses) ? payload.addresses : []
  const shipments = Array.isArray(payload.shipments) ? payload.shipments : []
  const nextPayload = isEcommOrder
    ? {
        ...payload,
        orderType,
        orderStatus,
        parcelCategory,
        deliveryPromise,
        carrierId,
        carrierName,
        deliveryMode,
      }
    : isHyperlocalOrder
      ? {
          ...payload,
          orderType,
          orderStatus,
          parcelCategory,
          deliveryPromise,
          carrierName,
          deliveryMode: '',
        }
      : payload

  if (
    !SUPPORTED_ORDER_TYPES.has(orderType) ||
    orderStatus !== 'CONFIRMED' ||
    !SUPPORTED_ORDER_CATEGORIES.has(parcelCategory) ||
    parcelCategory !== deliveryPromise ||
    (isEcommOrder && !SUPPORTED_DELIVERY_MODES.has(deliveryMode)) ||
    (isEcommOrder && carrierId !== INNOFULFILL_ECOMM_CARRIER_ID) ||
    (isEcommOrder && carrierName !== INNOFULFILL_ECOMM_CARRIER_NAME) ||
    (isHyperlocalOrder && carrierName !== INNOFULFILL_HYPERLOCAL_CARRIER_NAME) ||
    (isHyperlocalOrder && deliveryMode !== '') ||
    (isEcommOrder && !carrierId) ||
    !carrierName ||
    !Array.isArray(payload.addresses) ||
    !hasAddressType(addresses, 'PICKUP') ||
    !hasAddressType(addresses, 'DELIVERY') ||
    !Array.isArray(payload.shipments) ||
    shipments.length === 0 ||
    !isPlainObject(payload.payment)
  ) {
    return res.status(400).json({
      success: false,
      message: 'Missing or invalid required fields',
      required: [
        'orderType=FORWARD|REVERSE',
        'orderStatus=CONFIRMED',
        'parcelCategory=ECOMM|HYPERLOCAL',
        'deliveryPromise matching parcelCategory',
        'deliveryMode=SURFACE|AIR for ECOMM or empty for HYPERLOCAL',
        `carrierId=${INNOFULFILL_ECOMM_CARRIER_ID} for ECOMM`,
        `carrierName=${INNOFULFILL_ECOMM_CARRIER_NAME} for ECOMM`,
        `carrierName=${INNOFULFILL_HYPERLOCAL_CARRIER_NAME} for HYPERLOCAL`,
        'addresses with PICKUP and DELIVERY',
        'shipments',
        'payment',
      ],
    })
  }

  try {
    const result = await createInnofulfillOrder(nextPayload, authHeaders)

    return res.status(result.status).json(result.data)
  } catch (error: any) {
    console.error('Innofulfill create order request failed', {
      message: error?.message || String(error),
      code: error?.code,
      status: error?.response?.status,
    })

    return res.status(502).json({
      success: false,
      message: 'Unable to reach Shreemaruti orders service',
    })
  }
}

export const innofulfillCreateEcommOrderController = async (req: Request, res: Response) => {
  const authHeaders = getForwardableAuthHeaders(req)
  const payload = isPlainObject(req.body) ? normalizeInnofulfillEcommPayload(req.body) : null

  if (!hasInnofulfillAuth(authHeaders)) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Provide Api-Key or Authorization Bearer token with TenantId.',
    })
  }

  if (!payload) {
    return res.status(400).json({
      success: false,
      message: 'Missing or invalid request body',
    })
  }

  const missingFields = validateInnofulfillEcommOrderPayload(payload)
  if (missingFields.length) {
    return res.status(400).json({
      success: false,
      message: 'Missing or invalid ECOMM order fields',
      required: missingFields,
    })
  }

  try {
    const result = await createInnofulfillOrder(payload, authHeaders)

    return res.status(result.status).json(result.data)
  } catch (error: any) {
    console.error('Innofulfill create ECOMM order request failed', {
      message: error?.message || String(error),
      code: error?.code,
      status: error?.response?.status,
    })

    return res.status(502).json({
      success: false,
      message: 'Unable to reach Shreemaruti ECOMM order service',
    })
  }
}

export const innofulfillCreateHyperlocalOrderController = async (req: Request, res: Response) => {
  const authHeaders = getForwardableAuthHeaders(req)
  const payload = isPlainObject(req.body) ? normalizeInnofulfillHyperlocalPayload(req.body) : null

  if (!hasInnofulfillAuth(authHeaders)) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Provide Api-Key or Authorization Bearer token with TenantId.',
    })
  }

  if (!payload) {
    return res.status(400).json({
      success: false,
      message: 'Missing or invalid request body',
    })
  }

  const missingFields = validateInnofulfillHyperlocalOrderPayload(payload)
  if (missingFields.length) {
    return res.status(400).json({
      success: false,
      message: 'Missing or invalid HYPERLOCAL order fields',
      required: missingFields,
    })
  }

  try {
    const result = await createInnofulfillOrder(payload, authHeaders)

    return res.status(result.status).json(result.data)
  } catch (error: any) {
    console.error('Innofulfill create HYPERLOCAL order request failed', {
      message: error?.message || String(error),
      code: error?.code,
      status: error?.response?.status,
    })

    return res.status(502).json({
      success: false,
      message: 'Unable to reach Shreemaruti HYPERLOCAL order service',
    })
  }
}

export const innofulfillGetOrderController = async (req: Request, res: Response) => {
  const authHeaders = getForwardableAuthHeaders(req)
  const orderId = normalizeString(req.params.orderId)

  if (!hasInnofulfillAuth(authHeaders)) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Provide Api-Key or Authorization Bearer token with TenantId.',
    })
  }

  if (!orderId) {
    return res.status(400).json({
      success: false,
      message: 'Missing required path parameter: orderId',
    })
  }

  try {
    const result = await getInnofulfillOrder(orderId, authHeaders)

    return res.status(result.status).json(result.data)
  } catch (error: any) {
    console.error('Innofulfill get order request failed', {
      message: error?.message || String(error),
      code: error?.code,
      status: error?.response?.status,
    })

    return res.status(502).json({
      success: false,
      message: 'Unable to reach Shreemaruti orders service',
    })
  }
}

export const innofulfillBulkManifestOrdersController = async (req: Request, res: Response) => {
  const authHeaders = getForwardableAuthHeaders(req)
  const orderIds = Array.isArray(req.body?.orderIds)
    ? req.body.orderIds.map((orderId: unknown) => normalizeString(orderId)).filter(Boolean)
    : []

  if (!hasInnofulfillAuth(authHeaders)) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Provide Api-Key or Authorization Bearer token with TenantId.',
    })
  }

  if (orderIds.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Missing or invalid orderIds. Provide a non-empty array of order IDs.',
      required: ['orderIds'],
    })
  }

  try {
    const result = await manifestInnofulfillOrdersBulk({ orderIds }, authHeaders)

    return res.status(result.status).json(result.data)
  } catch (error: any) {
    console.error('Innofulfill bulk manifest request failed', {
      message: error?.message || String(error),
      code: error?.code,
      status: error?.response?.status,
    })

    return res.status(502).json({
      success: false,
      message: 'Unable to reach Shreemaruti manifest service',
    })
  }
}

export const innofulfillBulkCancelOrdersController = async (req: Request, res: Response) => {
  const authHeaders = getForwardableAuthHeaders(req)
  const orders = Array.isArray(req.body?.orders)
    ? req.body.orders
        .map((order: unknown) => {
          if (!isPlainObject(order)) return null

          return {
            orderId: normalizeString(order.orderId),
            reason: normalizeString(order.reason),
          }
        })
        .filter((order: { orderId: string; reason: string } | null): order is { orderId: string; reason: string } =>
          Boolean(order?.orderId && order.reason),
        )
    : []

  if (!hasInnofulfillAuth(authHeaders)) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Provide Api-Key or Authorization Bearer token with TenantId.',
    })
  }

  if (!Array.isArray(req.body?.orders) || orders.length !== req.body.orders.length || orders.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Missing or invalid orders. Each entry requires orderId and reason.',
      required: ['orders[].orderId', 'orders[].reason'],
    })
  }

  try {
    const result = await cancelInnofulfillOrdersBulk({ orders }, authHeaders)

    return res.status(result.status).json(result.data)
  } catch (error: any) {
    console.error('Innofulfill bulk cancel request failed', {
      message: error?.message || String(error),
      code: error?.code,
      status: error?.response?.status,
    })

    return res.status(502).json({
      success: false,
      message: 'Unable to reach Shreemaruti cancel service',
    })
  }
}

export const innofulfillDownloadShippingLabelController = async (req: Request, res: Response) => {
  const authHeaders = getForwardableAuthHeaders(req)
  const orderId = normalizeString(req.body?.orderId)
  const tenantId = normalizeString(req.body?.tenantId)
  const userId = normalizeString(req.body?.userId)

  if (!hasInnofulfillAuth(authHeaders)) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Provide Api-Key or Authorization Bearer token with TenantId.',
    })
  }

  if (!orderId || !tenantId || !userId) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields',
      required: ['orderId', 'tenantId', 'userId'],
    })
  }

  try {
    const result = await downloadInnofulfillShippingLabel(
      {
        orderId,
        tenantId,
        userId,
      },
      authHeaders,
    )

    return sendInnofulfillDocumentResponse(res, result)
  } catch (error: any) {
    console.error('Innofulfill shipping label request failed', {
      message: error?.message || String(error),
      code: error?.code,
      status: error?.response?.status,
    })

    return res.status(502).json({
      success: false,
      message: 'Unable to reach Shreemaruti shipping label service',
    })
  }
}

export const innofulfillDownloadInvoiceController = async (req: Request, res: Response) => {
  const authHeaders = getForwardableAuthHeaders(req)
  const orderId = normalizeString(req.params.orderId)
  const type = normalizeString(req.query.type)
  const level = normalizeString(req.query.level).toLowerCase()

  if (!hasInnofulfillAuth(authHeaders)) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Provide Api-Key or Authorization Bearer token with TenantId.',
    })
  }

  if (!orderId || !type || !SUPPORTED_INVOICE_LEVELS.has(level)) {
    return res.status(400).json({
      success: false,
      message: 'Missing or invalid invoice parameters',
      required: ['orderId', 'type', 'level=product|shipping'],
    })
  }

  try {
    const result = await downloadInnofulfillInvoice(
      orderId,
      {
        type,
        level: level as 'product' | 'shipping',
      },
      authHeaders,
    )

    return sendInnofulfillDocumentResponse(res, result)
  } catch (error: any) {
    console.error('Innofulfill invoice request failed', {
      message: error?.message || String(error),
      code: error?.code,
      status: error?.response?.status,
    })

    return res.status(502).json({
      success: false,
      message: 'Unable to reach Shreemaruti invoice service',
    })
  }
}

export const innofulfillTrackShipmentByAwbController = async (req: Request, res: Response) => {
  const authHeaders = getForwardableAuthHeaders(req)
  const awbNumber = normalizeString(req.params.awbNumber)

  if (!hasInnofulfillAuth(authHeaders)) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Provide Api-Key or Authorization Bearer token with TenantId.',
    })
  }

  if (!awbNumber) {
    return res.status(400).json({
      success: false,
      message: 'Missing required path parameter: awbNumber',
    })
  }

  try {
    const result = await trackInnofulfillShipmentByAwb(awbNumber, authHeaders)

    return res.status(result.status).json(result.data)
  } catch (error: any) {
    console.error('Innofulfill AWB tracking request failed', {
      message: error?.message || String(error),
      code: error?.code,
      status: error?.response?.status,
    })

    return res.status(502).json({
      success: false,
      message: 'Unable to reach Shreemaruti tracking service',
    })
  }
}

export const innofulfillListLabelConfigurationsController = async (req: Request, res: Response) => {
  const authHeaders = getForwardableAuthHeaders(req)

  if (!hasInnofulfillAuth(authHeaders)) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Provide Api-Key or Authorization Bearer token with TenantId.',
    })
  }

  try {
    const result = await listInnofulfillLabelConfigurations(
      getForwardableQueryParams(req.query, LABEL_CONFIG_QUERY_PARAMS),
      authHeaders,
    )

    return res.status(result.status).json(result.data)
  } catch (error: any) {
    console.error('Innofulfill label configurations request failed', {
      message: error?.message || String(error),
      code: error?.code,
      status: error?.response?.status,
    })

    return res.status(502).json({
      success: false,
      message: 'Unable to reach Shreemaruti label configuration service',
    })
  }
}

export const innofulfillCreateLabelConfigurationController = async (req: Request, res: Response) => {
  const authHeaders = getForwardableAuthHeaders(req)
  const payload = isPlainObject(req.body) ? req.body : null
  const name = normalizeString(payload?.name)
  const sellerSelection = normalizeString(payload?.sellerSelection).toUpperCase()
  const sellers = Array.isArray(payload?.sellers) ? payload.sellers : []
  const fields = isPlainObject(payload?.fields) ? payload.fields : null
  const hasValidSpecificSellers =
    sellerSelection === 'SPECIFIC' &&
    sellers.length > 0 &&
    sellers.every(
      (seller) =>
        isPlainObject(seller) &&
        normalizeString(seller.id) &&
        normalizeString(seller.name) &&
        normalizeString(seller.tenantId),
    )
  const hasValidAllSellers = sellerSelection === 'ALL' && sellers.length === 0

  if (!hasInnofulfillAuth(authHeaders)) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Provide Api-Key or Authorization Bearer token with TenantId.',
    })
  }

  if (
    !payload ||
    !name ||
    (!hasValidSpecificSellers && !hasValidAllSellers) ||
    !fields
  ) {
    return res.status(400).json({
      success: false,
      message: 'Missing or invalid label configuration fields',
      required: [
        'name',
        'sellerSelection=ALL with empty sellers or sellerSelection=SPECIFIC with seller details',
        'fields',
      ],
    })
  }

  try {
    const result = await createInnofulfillLabelConfiguration(
      {
        ...payload,
        name,
        sellerSelection,
        sellers,
        fields,
      },
      authHeaders,
    )

    return res.status(result.status).json(result.data)
  } catch (error: any) {
    console.error('Innofulfill create label configuration request failed', {
      message: error?.message || String(error),
      code: error?.code,
      status: error?.response?.status,
    })

    return res.status(502).json({
      success: false,
      message: 'Unable to reach Shreemaruti label configuration service',
    })
  }
}

export const innofulfillListInvoiceConfigurationsController = async (req: Request, res: Response) => {
  const authHeaders = getForwardableAuthHeaders(req)

  if (!hasInnofulfillAuth(authHeaders)) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Provide Api-Key or Authorization Bearer token with TenantId.',
    })
  }

  try {
    const result = await listInnofulfillInvoiceConfigurations(
      getForwardableQueryParams(req.query, INVOICE_CONFIG_QUERY_PARAMS),
      authHeaders,
    )

    return res.status(result.status).json(result.data)
  } catch (error: any) {
    console.error('Innofulfill invoice configurations request failed', {
      message: error?.message || String(error),
      code: error?.code,
      status: error?.response?.status,
    })

    return res.status(502).json({
      success: false,
      message: 'Unable to reach Shreemaruti invoice configuration service',
    })
  }
}

export const innofulfillCreateInvoiceConfigurationController = async (req: Request, res: Response) => {
  const authHeaders = getForwardableAuthHeaders(req)
  const payload = isPlainObject(req.body) ? req.body : null
  const name = normalizeString(payload?.name)
  const sellerSelection = normalizeString(payload?.sellerSelection).toUpperCase()
  const sellers = Array.isArray(payload?.sellers) ? payload.sellers : []
  const fields = isPlainObject(payload?.fields) ? payload.fields : null
  const invoiceLevel = normalizeString(payload?.invoiceLevel).toLowerCase()
  const hasValidSpecificSellers =
    sellerSelection === 'SPECIFIC' &&
    sellers.length > 0 &&
    sellers.every(
      (seller) =>
        isPlainObject(seller) &&
        normalizeString(seller.id) &&
        normalizeString(seller.name) &&
        normalizeString(seller.tenantId),
    )
  const hasValidAllSellers = sellerSelection === 'ALL' && sellers.length === 0

  if (!hasInnofulfillAuth(authHeaders)) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Provide Api-Key or Authorization Bearer token with TenantId.',
    })
  }

  if (
    !payload ||
    !name ||
    (!hasValidSpecificSellers && !hasValidAllSellers) ||
    !fields ||
    !SUPPORTED_INVOICE_CONFIG_LEVELS.has(invoiceLevel)
  ) {
    return res.status(400).json({
      success: false,
      message: 'Missing or invalid invoice configuration fields',
      required: [
        'name',
        'sellerSelection=ALL with empty sellers or sellerSelection=SPECIFIC with seller details',
        'fields',
        'invoiceLevel=shipping level|product level',
      ],
    })
  }

  try {
    const result = await createInnofulfillInvoiceConfiguration(
      {
        ...payload,
        name,
        sellerSelection,
        sellers,
        fields,
        invoiceLevel,
      },
      authHeaders,
    )

    return res.status(result.status).json(result.data)
  } catch (error: any) {
    console.error('Innofulfill create invoice configuration request failed', {
      message: error?.message || String(error),
      code: error?.code,
      status: error?.response?.status,
    })

    return res.status(502).json({
      success: false,
      message: 'Unable to reach Shreemaruti invoice configuration service',
    })
  }
}

export const innofulfillDeliveryWebhookController = async (req: Request, res: Response) => {
  const rawBody = normalizeString((req as any).rawBody) || JSON.stringify(req.body || {})
  const payload = isPlainObject(req.body) ? req.body : null
  const signature = getHeaderValue(req.headers, 'x-webhook-signature')
  const webhookId = getHeaderValue(req.headers, 'x-webhook-id') || normalizeString(payload?.id)
  const headerEvent = getHeaderValue(req.headers, 'x-webhook-event')
  const eventObject = isPlainObject(payload?.event) ? payload.event : {}
  const data = isPlainObject(payload?.data) ? payload.data : {}
  const eventName = headerEvent || normalizeString(eventObject.triggerEventName)
  const eventCode = normalizeString(eventObject.eventCode)
  const businessLine = normalizeString(eventObject.businessLine)
  const categoryCode = normalizeString(eventObject.categoryCode)
  const awbNumber = normalizeString(data.awbNumber) || normalizeString(data.cAwbNumber)
  const orderStatus = normalizeString(data.orderStatus) || eventCode || 'unknown'

  if (!payload) {
    return res.status(400).json({
      success: false,
      message: 'Missing or invalid webhook payload',
    })
  }

  if (!signature) {
    return res.status(401).json({
      success: false,
      message: 'Missing webhook signature',
    })
  }

  const signatureKey = await fetchInnofulfillWebhookSignatureKey()
  if (!signatureKey) {
    console.error('Innofulfill webhook rejected: signature key is not configured')
    return res.status(500).json({
      success: false,
      message: 'Webhook signature key is not configured',
    })
  }

  if (!isValidInnofulfillWebhookSignature(signature, signatureKey, rawBody)) {
    console.warn('Innofulfill webhook rejected: invalid signature', {
      webhookId: webhookId || null,
      event: eventName || null,
      awbNumber: awbNumber || null,
    })
    return res.status(401).json({
      success: false,
      message: 'Invalid webhook signature',
    })
  }

  if (!webhookId || !eventName || !awbNumber) {
    return res.status(400).json({
      success: false,
      message: 'Missing required webhook fields',
      required: ['id or X-Webhook-ID', 'X-Webhook-Event or event.triggerEventName', 'data.awbNumber'],
    })
  }

  try {
    const dedupeWindowStart = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const pendingStatus = `${INNOFULFILL_PROVIDER}:${webhookId}:${orderStatus}`
    const [existingPending] = await db
      .select({ id: pending_webhooks.id })
      .from(pending_webhooks)
      .where(
        and(
          eq(pending_webhooks.awb_number, awbNumber),
          eq(pending_webhooks.status, pendingStatus),
          isNull(pending_webhooks.processed_at),
          gte(pending_webhooks.created_at, dedupeWindowStart),
        ),
      )
      .limit(1)

    if (!existingPending) {
      await db.insert(pending_webhooks).values({
        awb_number: awbNumber,
        status: pendingStatus,
        payload: {
          __provider: INNOFULFILL_PROVIDER,
          webhookId,
          event: eventName,
          eventCode,
          businessLine,
          categoryCode,
          tenantId: getHeaderValue(req.headers, 'x-tenant-id') || normalizeString(payload.tenantId),
          userId: getHeaderValue(req.headers, 'x-user-id') || normalizeString(payload.userId),
          headers: sanitizeInnofulfillWebhookHeaders(req.headers),
          body: payload,
        },
      })
    }

    return res.status(200).json({
      success: true,
      received: true,
      duplicate: Boolean(existingPending),
    })
  } catch (error: any) {
    console.error('Innofulfill delivery webhook processing failed', {
      message: error?.message || String(error),
      webhookId,
      event: eventName,
      awbNumber,
    })

    return res.status(500).json({
      success: false,
      message: 'Internal Server Error',
    })
  }
}
