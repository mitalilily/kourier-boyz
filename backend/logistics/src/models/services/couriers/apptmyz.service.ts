import axios, { AxiosInstance } from 'axios'
import { constants, publicEncrypt } from 'crypto'
import { HttpError } from '../../../utils/classes'
import { ApptmyzConfig, getEffectiveCourierConfig } from '../courierCredentials.service'

const APPTMYZ_SANDBOX_BASE_URL = 'http://103.73.191.220:8080/flipkart'
const APPTMYZ_PRODUCTION_BASE_URL = 'https://ekart.apptmyz.com/flipkart'
const DEFAULT_PUBLIC_KEY =
  'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAwh4OSBw4KDBWXL6/ryijo8FJG51yEIBYZGOVTn2zJs/EPGrh80l0QITyVOmV5667gKJwkcFezUMYS5JsMsPAs7CYZaigmd7rsVbfcjHBK4QP3xzfhVP2CHraS8CQptjSIEl2z0yiqHyq1jfNcXR1oyE6HXLS56sq6d3nVPI+NJrejQOq+TzlJcX9MbvMv0Z8bHA4cBCjOBlOA2+sVHtn2XkN6xe+TVZNFXNiWiKXCL57a8yGqipswt58EiYDON9l6w1I+xzL+2C9GH7Iq3iFOXMQ4TyEH6utlFoP4T703HDs41eh3G0/66601tNowxU0X4hWbGMwZRu0ZHkj+3z3TQIDAQAB'

export const APPTMYZ_COURIERS = [
  { id: 73001, name: 'Ekart B2B/LTL', service: 'B2B LTL' },
] as const

type TokenCache = {
  token: string
  expiresAt: number
}

export class ApptmyzService {
  private apiBase = process.env.APPTMYZ_API_BASE || APPTMYZ_SANDBOX_BASE_URL
  private username = process.env.APPTMYZ_USERNAME || ''
  private password = process.env.APPTMYZ_PASSWORD || ''
  private publicKey = process.env.APPTMYZ_PUBLIC_KEY || DEFAULT_PUBLIC_KEY
  private customerCode = process.env.APPTMYZ_CUSTOMER_CODE || ''
  private static cachedConfig: ApptmyzConfig | null | undefined
  private static tokenCache: TokenCache | null = null

  static clearCachedConfig() {
    ApptmyzService.cachedConfig = undefined
    ApptmyzService.tokenCache = null
  }

  private normalizeBaseUrl(value: unknown) {
    return String(value || APPTMYZ_SANDBOX_BASE_URL).trim().replace(/\/+$/, '') || APPTMYZ_SANDBOX_BASE_URL
  }

  private trim(value: unknown, fallback = '') {
    const text = String(value ?? '').trim()
    return text || fallback
  }

  private async ensureConfigLoaded() {
    if (ApptmyzService.cachedConfig === undefined) {
      ApptmyzService.cachedConfig = await getEffectiveCourierConfig<ApptmyzConfig>('apptmyz', 'b2b')
    }

    const cfg = ApptmyzService.cachedConfig
    if (cfg) {
      this.apiBase = cfg.apiBase || this.apiBase
      this.username = cfg.username || this.username
      this.password = cfg.password || this.password
      this.publicKey = cfg.publicKey || this.publicKey
      this.customerCode = cfg.customerCode || this.customerCode
    }

    this.apiBase = this.normalizeBaseUrl(this.apiBase)
  }

  private formatPublicKey(publicKey: string) {
    const normalizedInput = this.trim(publicKey, DEFAULT_PUBLIC_KEY)
    let normalized = normalizedInput
      .replace(/-----BEGIN PUBLIC KEY-----/g, '')
      .replace(/-----END PUBLIC KEY-----/g, '')
      .replace(/\s+/g, '')
      .trim()

    if (!/^[A-Za-z0-9+/=]+$/.test(normalized) || normalized.length < 200) {
      normalized = DEFAULT_PUBLIC_KEY
    }

    return [
      '-----BEGIN PUBLIC KEY-----',
      normalized.match(/.{1,64}/g)?.join('\n') || normalized,
      '-----END PUBLIC KEY-----',
    ].join('\n')
  }

  encryptPassword(password: string) {
    const key = this.formatPublicKey(this.publicKey)
    try {
      return publicEncrypt(
        {
          key,
          padding: constants.RSA_PKCS1_PADDING,
        },
        Buffer.from(password),
      ).toString('base64')
    } catch (error: any) {
      throw new HttpError(
        400,
        `Ekart B2B/LTL public key is invalid. Please save the RSA public key from the Ekart API document. (${error?.code || error?.message || 'key decode failed'})`,
      )
    }
  }

  private extractMessage(data: any, fallback: string) {
    if (typeof data === 'string' && data.trim()) return data.trim()
    return this.trim(data?.message || data?.error || data?.reason, fallback)
  }

  private async rawHttp(): Promise<AxiosInstance> {
    await this.ensureConfigLoaded()
    return axios.create({
      baseURL: this.apiBase,
      timeout: 30000,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      validateStatus: () => true,
    })
  }

  async generateToken(credentials?: { username?: string; password?: string }) {
    await this.ensureConfigLoaded()
    const username = this.trim(credentials?.username || this.username)
    const password = this.trim(credentials?.password || this.password)

    if (!username || !password) {
      throw new HttpError(400, 'Apptmyz username and password are required')
    }

    const http = await this.rawHttp()
    const response = await http.post('/api/customer/login', {
      userName: username,
      password: this.encryptPassword(password),
    })

    if (response.status < 200 || response.status >= 300 || response.data?.status === false) {
      throw new HttpError(response.status || 502, this.extractMessage(response.data, 'Apptmyz login failed'))
    }

    const token = this.trim(response.data?.data || response.data?.token)
    if (!token) throw new HttpError(502, 'Apptmyz login did not return a token')

    ApptmyzService.tokenCache = {
      token,
      expiresAt: Date.now() + 50 * 60 * 1000,
    }

    return response.data
  }

  private async getToken() {
    if (ApptmyzService.tokenCache && ApptmyzService.tokenCache.expiresAt > Date.now()) {
      return ApptmyzService.tokenCache.token
    }

    const response = await this.generateToken()
    return this.trim(response?.data)
  }

  private async getHttp(): Promise<AxiosInstance> {
    const token = await this.getToken()
    const http = await this.rawHttp()
    http.defaults.headers.common.Authorization = `Bearer ${token}`
    return http
  }

  private async request<T = any>(method: 'get' | 'post', endpoint: string, payload?: any) {
    const http = await this.getHttp()
    const response =
      method === 'get' ? await http.get(endpoint) : await http.post(endpoint, payload ?? {})

    if (response.status < 200 || response.status >= 300 || response.data?.status === false) {
      throw new HttpError(
        response.status || 502,
        this.extractMessage(response.data, `Apptmyz ${endpoint} request failed`),
      )
    }

    return response.data as T
  }

  async createOrder(payload: any) {
    return this.request('post', '/api/customer/order/create', payload)
  }

  async generateDockets(travelMode: string, count: string | number) {
    const mode = encodeURIComponent(this.trim(travelMode).toUpperCase())
    const docketCount = encodeURIComponent(this.trim(count, '1'))
    if (!mode) throw new HttpError(400, 'travelMode is required')
    return this.request('get', `/api/customer/dkts/${mode}/${docketCount}`)
  }

  async trackOrders(docketNo: Array<string | number>) {
    if (!Array.isArray(docketNo) || docketNo.length === 0) {
      throw new HttpError(400, 'At least one docket number is required')
    }
    return this.request('post', '/api/customer/order/track', { docketNo })
  }

  async listOrders(startDate: string, endDate: string) {
    const start = encodeURIComponent(this.trim(startDate))
    const end = encodeURIComponent(this.trim(endDate))
    if (!start || !end) throw new HttpError(400, 'startDate and endDate are required')
    return this.request('get', `/api/customer/order/list/${start}/${end}`)
  }

  async cancelOrders(payload: { remarks?: string; reason: string; docketList: Array<string | number> }) {
    if (!payload?.reason) throw new HttpError(400, 'Cancellation reason code is required')
    if (!Array.isArray(payload?.docketList) || payload.docketList.length === 0) {
      throw new HttpError(400, 'At least one docket number is required')
    }
    return this.request('post', '/api/customer/order/cancel', payload)
  }

  async getCancelReasons() {
    return this.request('get', '/api/customer/cancelreasons')
  }

  async getDeliverySlots() {
    return this.request('get', '/api/customer/deliverySlots')
  }

  async getTruckTypes() {
    return this.request('get', '/api/masters/trucktype')
  }

  async checkPincodeServiceability(pincode: string | number) {
    const normalized = encodeURIComponent(this.trim(pincode))
    if (!normalized) throw new HttpError(400, 'pincode is required')
    return this.request('get', `/api/customer/check/serviceability/${normalized}`)
  }

  async updateDeliveryAppointment(payload: Array<{ appointmentDate: string; timeSlot: string; docketNo: string | number }>) {
    if (!Array.isArray(payload) || payload.length === 0) {
      throw new HttpError(400, 'At least one delivery appointment row is required')
    }
    return this.request('post', '/api/customer/appointment/delivery', payload)
  }

  async updateOrderDetails(payload: any) {
    if (!payload?.docketNo) throw new HttpError(400, 'docketNo is required')
    return this.request('post', '/api/customer/order/edit', payload)
  }

  async createPickupRequests(payload: any[]) {
    if (!Array.isArray(payload) || payload.length === 0) {
      throw new HttpError(400, 'Pickup request payload must be a non-empty array')
    }
    return this.request('post', '/api/customer/create/prqs', payload)
  }

  getCredentialSummary() {
    return {
      apiBase: this.apiBase,
      username: this.username,
      customerCode: this.customerCode,
      hasPassword: Boolean(this.password),
      hasPublicKey: Boolean(this.publicKey),
      defaultSandboxBaseUrl: APPTMYZ_SANDBOX_BASE_URL,
      defaultProductionBaseUrl: APPTMYZ_PRODUCTION_BASE_URL,
    }
  }
}
