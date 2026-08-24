import axios from 'axios'

export type InnofulfillSigninType = 'EMAIL'

export interface InnofulfillLoginInput {
  username: string
  password: string
  signinType: InnofulfillSigninType
}

export interface InnofulfillRefreshTokenInput {
  userId: string
  refreshToken: string
}

export interface InnofulfillEcommServiceabilityInput {
  fromPincode: number
  toPincode: number
  paymentMode?: 'PREPAID' | 'COD'
  operationType: string
  carriers?: string[]
}

export interface InnofulfillEcommRateCalculationInput {
  fromPincode: number
  toPincode: number
  serviceType: 'ECOMM' | 'HYPERLOCAL'
  productType: 'ECOMM' | 'HYPERLOCAL'
  weight: number
  length: number
  height: number
  width: number
  distance?: number
  includeDefaultCharges?: boolean
  userOptions?: Record<string, unknown>
  filters:
    | {
    delivery_mode: 'SURFACE' | 'AIR'
  }
    | Record<string, never>
}

export type InnofulfillTenantHeaders = Record<string, string>
export type InnofulfillAuthHeaders = Record<string, string>
export type InnofulfillQueryParams = Record<string, string | string[]>
export type InnofulfillOrderPayload = Record<string, unknown>
export interface InnofulfillBulkManifestInput {
  orderIds: string[]
}
export interface InnofulfillBulkCancelInput {
  orders: Array<{
    orderId: string
    reason: string
  }>
}
export interface InnofulfillShippingLabelInput {
  orderId: string
  tenantId: string
  userId: string
}
export interface InnofulfillInvoiceQuery {
  type: string
  level: 'product' | 'shipping'
}
export type InnofulfillLabelConfigurationPayload = Record<string, unknown>
export type InnofulfillInvoiceConfigurationPayload = Record<string, unknown>

const DEFAULT_INNOFULFILL_API_BASE = 'https://apis.innofulfill.com'

const normalizeBaseUrl = (value?: string) =>
  String(value || DEFAULT_INNOFULFILL_API_BASE).trim().replace(/\/+$/, '')

export const normalizeInnofulfillOrderDate = (value: unknown) => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? new Date().toISOString() : value.toISOString()
  }

  const raw = String(value ?? '').trim()
  if (!raw) return new Date().toISOString()

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return new Date(`${raw}T00:00:00.000Z`).toISOString()
  }

  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString()
}

const normalizeInnofulfillOrderPayload = (payload: InnofulfillOrderPayload) => ({
  ...payload,
  orderDate: normalizeInnofulfillOrderDate((payload as any).orderDate),
})

export const loginToInnofulfill = async (
  input: InnofulfillLoginInput,
  tenantHeaders: InnofulfillTenantHeaders = {},
) => {
  const apiBase = normalizeBaseUrl(process.env.INNOFULFILL_API_BASE)

  const response = await axios.post(`${apiBase}/auth/login`, input, {
    headers: {
      'Content-Type': 'application/json',
      ...tenantHeaders,
    },
    timeout: Number(process.env.INNOFULFILL_REQUEST_TIMEOUT_MS || 15000),
    validateStatus: () => true,
  })

  return {
    status: response.status,
    data: response.data,
  }
}

export const refreshInnofulfillToken = async (
  input: InnofulfillRefreshTokenInput,
  tenantHeaders: InnofulfillTenantHeaders = {},
) => {
  const apiBase = normalizeBaseUrl(process.env.INNOFULFILL_API_BASE)

  const response = await axios.post(`${apiBase}/auth/refresh-token`, input, {
    headers: {
      'Content-Type': 'application/json',
      ...tenantHeaders,
    },
    timeout: Number(process.env.INNOFULFILL_REQUEST_TIMEOUT_MS || 15000),
    validateStatus: () => true,
  })

  return {
    status: response.status,
    data: response.data,
  }
}

export const checkInnofulfillEcommServiceability = async (
  input: InnofulfillEcommServiceabilityInput,
  authHeaders: InnofulfillAuthHeaders,
) => {
  const apiBase = normalizeBaseUrl(process.env.INNOFULFILL_API_BASE)

  const response = await axios.post(`${apiBase}/gateway/serviceability/ecomm`, input, {
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
    },
    timeout: Number(process.env.INNOFULFILL_REQUEST_TIMEOUT_MS || 15000),
    validateStatus: () => true,
  })

  return {
    status: response.status,
    data: response.data,
  }
}

export const calculateInnofulfillEcommRates = async (
  input: InnofulfillEcommRateCalculationInput,
  authHeaders: InnofulfillAuthHeaders,
) => {
  const apiBase = normalizeBaseUrl(process.env.INNOFULFILL_API_BASE)

  const response = await axios.post(
    `${apiBase}/gateway/ure/api/external/rate-calculation/calculate/v2`,
    input,
    {
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      timeout: Number(process.env.INNOFULFILL_REQUEST_TIMEOUT_MS || 15000),
      validateStatus: () => true,
    },
  )

  return {
    status: response.status,
    data: response.data,
  }
}

export const listInnofulfillOrders = async (
  query: InnofulfillQueryParams,
  authHeaders: InnofulfillAuthHeaders,
) => {
  const apiBase = normalizeBaseUrl(process.env.INNOFULFILL_API_BASE)

  const response = await axios.get(`${apiBase}/gateway/booking-service/orders`, {
    headers: {
      ...authHeaders,
    },
    params: query,
    timeout: Number(process.env.INNOFULFILL_REQUEST_TIMEOUT_MS || 15000),
    validateStatus: () => true,
  })

  return {
    status: response.status,
    data: response.data,
  }
}

export const createInnofulfillOrder = async (
  payload: InnofulfillOrderPayload,
  authHeaders: InnofulfillAuthHeaders,
) => {
  const apiBase = normalizeBaseUrl(process.env.INNOFULFILL_API_BASE)
  const normalizedPayload = normalizeInnofulfillOrderPayload(payload)

  const response = await axios.post(`${apiBase}/gateway/booking-service/orders`, normalizedPayload, {
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
    },
    timeout: Number(process.env.INNOFULFILL_REQUEST_TIMEOUT_MS || 15000),
    validateStatus: () => true,
  })

  return {
    status: response.status,
    data: response.data,
  }
}

export const getInnofulfillOrder = async (
  orderId: string,
  authHeaders: InnofulfillAuthHeaders,
) => {
  const apiBase = normalizeBaseUrl(process.env.INNOFULFILL_API_BASE)
  const encodedOrderId = encodeURIComponent(orderId)

  const response = await axios.get(`${apiBase}/gateway/booking-service/orders/${encodedOrderId}`, {
    headers: {
      Accept: 'application/json',
      ...authHeaders,
    },
    timeout: Number(process.env.INNOFULFILL_REQUEST_TIMEOUT_MS || 15000),
    validateStatus: () => true,
  })

  return {
    status: response.status,
    data: response.data,
  }
}

export const manifestInnofulfillOrdersBulk = async (
  input: InnofulfillBulkManifestInput,
  authHeaders: InnofulfillAuthHeaders,
) => {
  const apiBase = normalizeBaseUrl(process.env.INNOFULFILL_API_BASE)

  const response = await axios.post(
    `${apiBase}/gateway/booking-service/orders/manifest/bulk`,
    input,
    {
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      timeout: Number(process.env.INNOFULFILL_REQUEST_TIMEOUT_MS || 15000),
      validateStatus: () => true,
    },
  )

  return {
    status: response.status,
    data: response.data,
  }
}

export const cancelInnofulfillOrdersBulk = async (
  input: InnofulfillBulkCancelInput,
  authHeaders: InnofulfillAuthHeaders,
) => {
  const apiBase = normalizeBaseUrl(process.env.INNOFULFILL_API_BASE)

  const response = await axios.post(
    `${apiBase}/gateway/booking-service/orders/cancel/bulk`,
    input,
    {
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      timeout: Number(process.env.INNOFULFILL_REQUEST_TIMEOUT_MS || 15000),
      validateStatus: () => true,
    },
  )

  return {
    status: response.status,
    data: response.data,
  }
}

export const downloadInnofulfillShippingLabel = async (
  input: InnofulfillShippingLabelInput,
  authHeaders: InnofulfillAuthHeaders,
) => {
  const apiBase = normalizeBaseUrl(process.env.INNOFULFILL_API_BASE)

  const response = await axios.post(`${apiBase}/gateway/pdf-generator/shipping-label`, input, {
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/pdf, application/json',
      ...authHeaders,
    },
    responseType: 'arraybuffer',
    timeout: Number(process.env.INNOFULFILL_REQUEST_TIMEOUT_MS || 15000),
    validateStatus: () => true,
  })

  return {
    status: response.status,
    data: response.data,
    headers: response.headers,
  }
}

export const downloadInnofulfillInvoice = async (
  orderId: string,
  query: InnofulfillInvoiceQuery,
  authHeaders: InnofulfillAuthHeaders,
) => {
  const apiBase = normalizeBaseUrl(process.env.INNOFULFILL_API_BASE)
  const encodedOrderId = encodeURIComponent(orderId)

  const response = await axios.get(`${apiBase}/gateway/pdf-generator/invoice/${encodedOrderId}`, {
    headers: {
      Accept: 'application/pdf, application/json',
      ...authHeaders,
    },
    params: query,
    responseType: 'arraybuffer',
    timeout: Number(process.env.INNOFULFILL_REQUEST_TIMEOUT_MS || 15000),
    validateStatus: () => true,
  })

  return {
    status: response.status,
    data: response.data,
    headers: response.headers,
  }
}

export const trackInnofulfillShipmentByAwb = async (
  awbNumber: string,
  authHeaders: InnofulfillAuthHeaders,
) => {
  const apiBase = normalizeBaseUrl(process.env.INNOFULFILL_API_BASE)
  const encodedAwbNumber = encodeURIComponent(awbNumber)

  const response = await axios.get(
    `${apiBase}/gateway/tracking-v2/api/tracking/awb/${encodedAwbNumber}`,
    {
      headers: {
        Accept: 'application/json',
        ...authHeaders,
      },
      timeout: Number(process.env.INNOFULFILL_REQUEST_TIMEOUT_MS || 15000),
      validateStatus: () => true,
    },
  )

  return {
    status: response.status,
    data: response.data,
  }
}

export const listInnofulfillLabelConfigurations = async (
  query: InnofulfillQueryParams,
  authHeaders: InnofulfillAuthHeaders,
) => {
  const apiBase = normalizeBaseUrl(process.env.INNOFULFILL_API_BASE)

  const response = await axios.get(`${apiBase}/gateway/pdf-generator/label-configs`, {
    headers: {
      Accept: 'application/json',
      ...authHeaders,
    },
    params: query,
    timeout: Number(process.env.INNOFULFILL_REQUEST_TIMEOUT_MS || 15000),
    validateStatus: () => true,
  })

  return {
    status: response.status,
    data: response.data,
  }
}

export const createInnofulfillLabelConfiguration = async (
  payload: InnofulfillLabelConfigurationPayload,
  authHeaders: InnofulfillAuthHeaders,
) => {
  const apiBase = normalizeBaseUrl(process.env.INNOFULFILL_API_BASE)

  const response = await axios.post(`${apiBase}/gateway/pdf-generator/label-configs`, payload, {
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...authHeaders,
    },
    timeout: Number(process.env.INNOFULFILL_REQUEST_TIMEOUT_MS || 15000),
    validateStatus: () => true,
  })

  return {
    status: response.status,
    data: response.data,
  }
}

export const listInnofulfillInvoiceConfigurations = async (
  query: InnofulfillQueryParams,
  authHeaders: InnofulfillAuthHeaders,
) => {
  const apiBase = normalizeBaseUrl(process.env.INNOFULFILL_API_BASE)

  const response = await axios.get(`${apiBase}/gateway/pdf-generator/invoice-configs`, {
    headers: {
      Accept: 'application/json',
      ...authHeaders,
    },
    params: query,
    timeout: Number(process.env.INNOFULFILL_REQUEST_TIMEOUT_MS || 15000),
    validateStatus: () => true,
  })

  return {
    status: response.status,
    data: response.data,
  }
}

export const createInnofulfillInvoiceConfiguration = async (
  payload: InnofulfillInvoiceConfigurationPayload,
  authHeaders: InnofulfillAuthHeaders,
) => {
  const apiBase = normalizeBaseUrl(process.env.INNOFULFILL_API_BASE)

  const response = await axios.post(`${apiBase}/gateway/pdf-generator/invoice-configs`, payload, {
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...authHeaders,
    },
    timeout: Number(process.env.INNOFULFILL_REQUEST_TIMEOUT_MS || 15000),
    validateStatus: () => true,
  })

  return {
    status: response.status,
    data: response.data,
  }
}
