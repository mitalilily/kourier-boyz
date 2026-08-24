import axios, { AxiosInstance } from 'axios'
import { eq } from 'drizzle-orm'
import { HttpError } from '../../../utils/classes'
import { db } from '../../client'
import { courier_credentials } from '../../schema/courierCredentials'
import { XpressbeesConfig, getEffectiveCourierConfig } from '../courierCredentials.service'

export type XpressbeesServiceabilityRecord = {
  id: string
  name: string
  freight_charges?: number
  cod_charges?: number
  total_charges?: number
  min_weight?: number
  chargeable_weight?: number
  [key: string]: any
}

export type XpressbeesServiceabilityResponse = {
  serviceable: boolean
  records: XpressbeesServiceabilityRecord[]
  codAvailable: boolean
  prepaidAvailable: boolean
  tat: number | null
  mode?: 'legacy_courier_serviceability' | 'xbees_pincode_master'
  raw: any
}

export type XpressbeesShipmentResponse = {
  status: boolean
  data?: {
    order_id?: number | string
    shipment_id?: number | string
    awb_number?: string
    courier_id?: string
    courier_name?: string
    status?: string
    additional_info?: string
    payment_type?: string
    fwd_destination_code?: string
    label?: string
    manifest?: string
  }
  message?: string
  [key: string]: any
}

export class XpressbeesService {
  private baseApi = process.env.XPRESSBEES_API_BASE || 'https://shipment.xpressbees.com'
  private apiToken = process.env.XPRESSBEES_API_TOKEN || ''
  private authBearer =
    process.env.XPRESSBEES_AUTH_BEARER || process.env.XPRESSBEES_AUTHORIZATION_TOKEN || ''
  private username = process.env.XPRESSBEES_USERNAME || ''
  private password = process.env.XPRESSBEES_PASSWORD || ''
  private secretKey = process.env.XPRESSBEES_SECRET_KEY || ''
  private xbKey = process.env.XPRESSBEES_XB_KEY || ''
  private xbAccessKey =
    process.env.XPRESSBEES_XB_ACCESS_KEY ||
    process.env.XPRESSBEES_XBACCESSKEY ||
    process.env.XPRESSBEES_XB_KEY ||
    ''
  private businessUnit = process.env.XPRESSBEES_BUSINESS_UNIT || 'ECOM'
  private businessFlow = process.env.XPRESSBEES_BUSINESS_FLOW || 'FORWARD'
  private businessService =
    process.env.XPRESSBEES_BUSINESS_SERVICE || process.env.XPRESSBEES_SERVICE_TYPE || ''
  private businessServices =
    process.env.XPRESSBEES_BUSINESS_SERVICES ||
    process.env.XPRESSBEES_SERVICE_TYPES ||
    'SD,SDD,NDD,AIR,SFC,IntraSDD'
  private businessAccountName = process.env.XPRESSBEES_BUSINESS_ACCOUNT_NAME || ''
  private pickupVendorCode = process.env.XPRESSBEES_PICKUP_VENDOR_CODE || ''
  private manifestServiceType = process.env.XPRESSBEES_MANIFEST_SERVICE_TYPE || 'SD'
  private manifestPickupType = process.env.XPRESSBEES_MANIFEST_PICKUP_TYPE || 'Vendor'
  private pincodeBusinessUnit = process.env.XPRESSBEES_PINCODE_BUSINESS_UNIT || 'eComm'
  private pincodeBusinessFlow = process.env.XPRESSBEES_PINCODE_BUSINESS_FLOW || 'Forward'
  private pickupBusinessService = process.env.XPRESSBEES_PICKUP_BUSINESS_SERVICE || 'PickUp'
  private deliveryBusinessService = process.env.XPRESSBEES_DELIVERY_BUSINESS_SERVICE || 'Delivery'
  private serviceabilityVersion = process.env.XPRESSBEES_SERVICEABILITY_VERSION || 'v1'
  private pincodeCacheTtlMs = Number(process.env.XPRESSBEES_PINCODE_CACHE_TTL_MS || 15 * 60 * 1000)
  private trackingVersion = process.env.XPRESSBEES_TRACKING_VERSION || 'v1'
  private tokenEndpoint = process.env.XPRESSBEES_TOKEN_ENDPOINT || '/api/users/login'
  private shipmentEndpoint = process.env.XPRESSBEES_SHIPMENT_ENDPOINT || '/api/shipments2'
  private reverseShipmentEndpoint =
    process.env.XPRESSBEES_REVERSE_SHIPMENT_ENDPOINT || '/api/reverseshipments'
  private shipmentApiBase = 'https://shipment.xpressbees.com'

  private static cachedConfig: XpressbeesConfig | null | undefined
  private static pincodeMasterCache = new Map<string, { expiresAt: number; raw: any }>()

  static clearCachedConfig() {
    XpressbeesService.cachedConfig = undefined
  }

  private log(prefix: string, details: any) {
    console.log(`[Xpressbees] ${prefix}`, details)
  }

  private sanitizeForLogs(value: any, keyPath = ''): any {
    if (value == null) return value
    if (Array.isArray(value)) {
      return value.map((item, index) => this.sanitizeForLogs(item, `${keyPath}[${index}]`))
    }

    if (typeof value === 'object') {
      const result: Record<string, any> = {}
      for (const [key, nested] of Object.entries(value)) {
        const nextPath = keyPath ? `${keyPath}.${key}` : key
        const loweredKey = key.toLowerCase()

        if (
          [
            'authorization',
            'password',
            'token',
            'api_token',
            'apikey',
            'api_key',
            'xbkey',
            'xb_key',
            'xbaccesskey',
            'xb_access_key',
            'secret',
            'secretkey',
            'secret_key',
          ].includes(loweredKey)
        ) {
          result[key] = nested ? '[redacted]' : nested
          continue
        }

        if (loweredKey === 'phone' || loweredKey === 'alternate_phone') {
          const normalized = String(nested ?? '').replace(/\D/g, '')
          result[key] =
            normalized.length > 4
              ? `${normalized.slice(0, 2)}****${normalized.slice(-2)}`
              : normalized
          continue
        }

        if (loweredKey === 'email' || loweredKey === 'username' || loweredKey === 'login_id') {
          const normalized = String(nested ?? '').trim()
          if (!normalized || !normalized.includes('@')) {
            result[key] = normalized ? `${normalized.slice(0, 2)}***` : normalized
          } else {
            const [local, domain] = normalized.split('@')
            result[key] = `${local.slice(0, 2)}***@${domain}`
          }
          continue
        }

        if (loweredKey.startsWith('address')) {
          result[key] = nested ? '[address redacted]' : nested
          continue
        }

        result[key] = this.sanitizeForLogs(nested, nextPath)
      }
      return result
    }

    if (typeof value === 'string') {
      if (keyPath.toLowerCase().includes('label')) {
        return value.length > 120 ? `${value.slice(0, 120)}...` : value
      }
      return value
    }

    return value
  }

  private async ensureConfigLoaded() {
    if (XpressbeesService.cachedConfig === undefined) {
      XpressbeesService.cachedConfig = await getEffectiveCourierConfig<XpressbeesConfig>(
        'xpressbees',
        'b2c',
      )
    }

    const cfg = XpressbeesService.cachedConfig
    if (cfg) {
      this.baseApi = cfg.apiBase || this.baseApi
      this.apiToken = cfg.apiToken || this.apiToken
      this.authBearer = cfg.authBearer || this.authBearer
      this.username = cfg.email || this.username
      this.password = cfg.password || this.password
      this.secretKey = cfg.secretKey || this.secretKey
      this.xbKey = cfg.xbKey || cfg.xbAccessKey || this.xbKey
      this.xbAccessKey = cfg.xbAccessKey || cfg.xbKey || this.xbAccessKey
      this.businessUnit = cfg.businessUnit || this.businessUnit
      this.businessFlow = cfg.businessFlow || this.businessFlow
      this.businessService = cfg.businessService || this.businessService
      this.businessServices = cfg.businessServices || this.businessServices
      this.businessAccountName = cfg.businessAccountName || this.businessAccountName
      this.pickupVendorCode = cfg.pickupVendorCode || this.pickupVendorCode
      this.manifestServiceType = cfg.manifestServiceType || this.manifestServiceType
      this.manifestPickupType = cfg.manifestPickupType || this.manifestPickupType
      this.pincodeBusinessUnit = cfg.pincodeBusinessUnit || this.pincodeBusinessUnit
      this.pincodeBusinessFlow = cfg.pincodeBusinessFlow || this.pincodeBusinessFlow
      this.pickupBusinessService = cfg.pickupBusinessService || this.pickupBusinessService
      this.deliveryBusinessService = cfg.deliveryBusinessService || this.deliveryBusinessService
      this.serviceabilityVersion = cfg.serviceabilityVersion || this.serviceabilityVersion
      this.trackingVersion = cfg.trackingVersion || this.trackingVersion
    }
    this.baseApi = this.normalizeBaseApi(this.baseApi)
    this.log('Config loaded', {
      baseApi: this.baseApi,
      hasApiToken: Boolean(this.apiToken),
      hasAuthBearer: Boolean(this.authBearer),
      hasUsername: Boolean(this.username),
      hasPassword: Boolean(this.password),
      hasSecretKey: Boolean(this.secretKey),
      hasXbKey: Boolean(this.xbKey),
      hasXbAccessKey: Boolean(this.xbAccessKey),
      hasBusinessAccountName: Boolean(this.businessAccountName),
      hasPickupVendorCode: Boolean(this.pickupVendorCode),
      source: cfg ? 'courier_credentials_or_env_fallback' : 'env_only',
    })
  }

  private normalizeBaseApi(value: string): string {
    const base = String(value || '').trim() || 'https://shipment.xpressbees.com'
    return base.replace(/\/+$/, '')
  }

  private getConfiguredPathCandidates(envName: string, defaults: string[]): string[] {
    const configured = String(process.env[envName] || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)

    return Array.from(new Set([...configured, ...defaults].filter(Boolean)))
  }

  private getAwbPathCandidates(
    envName: string,
    productionEndpoint: string,
    stagingEndpoint: string,
  ): string[] {
    const configured = String(process.env[envName] || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)

    const isStagingEndpoint = (value: string) =>
      /114\.143\.206\.69|StandardForwardStagingService/i.test(value)

    const ordered =
      process.env.NODE_ENV === 'production'
        ? [
            ...configured.filter((value) => !isStagingEndpoint(value)),
            productionEndpoint,
            ...configured.filter(isStagingEndpoint),
            stagingEndpoint,
          ]
        : [...configured, productionEndpoint, stagingEndpoint]

    return Array.from(new Set(ordered.filter(Boolean)))
  }

  private buildEndpoint(path: string): string {
    return this.buildEndpointForBase(this.baseApi, path)
  }

  private buildEndpointForBase(baseApi: string, path: string): string {
    const normalizedPath = `/${String(path || '').replace(/^\/+/, '')}`
    const baseHasApiSuffix = /\/api$/i.test(baseApi)
    if (baseHasApiSuffix && normalizedPath.startsWith('/api/')) {
      return normalizedPath.replace(/^\/api/i, '')
    }
    return normalizedPath
  }

  private isAbsoluteEndpoint(value: string): boolean {
    return /^https?:\/\//i.test(String(value || '').trim())
  }

  private resolveEndpointTarget(baseApi: string, path: string) {
    const trimmedPath = String(path || '').trim()
    if (this.isAbsoluteEndpoint(trimmedPath)) {
      const parsed = new URL(trimmedPath)
      const baseURL = `${parsed.protocol}//${parsed.host}`
      const requestPath = `${parsed.pathname || '/'}${parsed.search || ''}`
      return {
        baseURL,
        requestPath,
        requestUrl: `${baseURL}${requestPath}`,
      }
    }

    const baseURL = this.normalizeBaseApi(baseApi)
    const requestPath = this.buildEndpointForBase(baseURL, trimmedPath)
    return {
      baseURL,
      requestPath,
      requestUrl: `${baseURL}${requestPath}`,
    }
  }

  private getBaseCandidates(
    options: {
      preferShipmentBase?: boolean
      exactBaseCandidates?: string[]
    } = {},
  ): string[] {
    if (options.exactBaseCandidates?.length) {
      return Array.from(
        new Set(
          options.exactBaseCandidates.map((value) => this.normalizeBaseApi(value)).filter(Boolean),
        ),
      )
    }

    const candidates = new Set<string>()
    const push = (value: string) => {
      const normalized = this.normalizeBaseApi(value)
      if (normalized) candidates.add(normalized)
    }

    if (options.preferShipmentBase) {
      push('https://shipment.xpressbees.com')
      push('https://shipment.xpressbees.com/api')
    }

    push(this.baseApi)

    const rawEnvAlternates = String(process.env.XPRESSBEES_ALT_API_BASE || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
    for (const alt of rawEnvAlternates) push(alt)

    const currentBaseWithoutApi = this.baseApi.replace(/\/api$/i, '')
    if (/shipment\.xpressbees\.com/i.test(currentBaseWithoutApi)) {
      push(
        currentBaseWithoutApi.replace(/shipment\.xpressbees\.com/i, 'xbclientapi.xpressbees.com'),
      )
      push(
        `${currentBaseWithoutApi.replace(/shipment\.xpressbees\.com/i, 'xbclientapi.xpressbees.com')}/api`,
      )
    }
    if (/xbclientapi\.xpressbees\.com/i.test(currentBaseWithoutApi)) {
      push(
        currentBaseWithoutApi.replace(/xbclientapi\.xpressbees\.com/i, 'shipment.xpressbees.com'),
      )
      push(
        `${currentBaseWithoutApi.replace(/xbclientapi\.xpressbees\.com/i, 'shipment.xpressbees.com')}/api`,
      )
    }

    return Array.from(candidates)
  }

  private getAuthBaseCandidates(): string[] {
    return Array.from(
      new Set(
        [this.baseApi, ...this.getBaseCandidates({ preferShipmentBase: true })]
          .map((value) => this.normalizeBaseApi(value))
          .filter(Boolean),
      ),
    )
  }

  private buildVersionHeaders(version: string): Record<string, string> {
    const normalized = String(version || '').trim()
    return normalized ? { VersionNumber: normalized, versionnumber: normalized } : {}
  }

  private buildBearerHeader(value: string): string {
    const normalized = String(value || '').trim()
    if (!normalized) return ''
    return /^Bearer\s+/i.test(normalized) ? normalized : `Bearer ${normalized}`
  }

  private normalizeTokenValue(value: string): string {
    return String(value || '')
      .trim()
      .replace(/^Bearer\s+/i, '')
      .trim()
  }

  private shouldUseAuthBearerAsApiToken(): boolean {
    if (!this.authBearer) return false
    if (String(process.env.XPRESSBEES_USE_AUTH_BEARER_AS_API_TOKEN || '').toLowerCase() === 'true') {
      return true
    }
    return !this.username && !this.password
  }

  private getConfiguredApiToken(forceRefresh = false): string {
    if (!forceRefresh && this.apiToken) return this.normalizeTokenValue(this.apiToken)
    if (this.shouldUseAuthBearerAsApiToken()) return this.normalizeTokenValue(this.authBearer)
    return ''
  }

  private getShipmentBaseCandidates(): string[] {
    return Array.from(
      new Set(
        [
          this.baseApi,
          ...this.getBaseCandidates({ preferShipmentBase: true }),
          this.getCanonicalShipmentApiBase(),
        ]
          .map((value) => this.normalizeBaseApi(value))
          .filter(Boolean),
      ),
    )
  }

  private getCanonicalShipmentApiBase(): string {
    return this.normalizeBaseApi(this.shipmentApiBase)
  }

  private createHttpClient(
    baseURL: string,
    token: string,
    extraHeaders: Record<string, string> = {},
  ): AxiosInstance {
    const authHeaders: Record<string, string> = token
      ? {
          Authorization: `Bearer ${token}`,
          token,
        }
      : {}
    const providerHeaders: Record<string, string> = {}
    const xbKey = String(this.xbKey || this.xbAccessKey || '').trim()
    const xbAccessKey = String(this.xbAccessKey || this.xbKey || '').trim()
    if (xbKey) {
      providerHeaders.XBKey = xbKey
      providerHeaders.xbKey = xbKey
    }
    if (xbAccessKey) {
      providerHeaders.xbAccessKey = xbAccessKey
      providerHeaders.XbAccessKey = xbAccessKey
    }

    return axios.create({
      baseURL,
      timeout: 20000,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...authHeaders,
        ...providerHeaders,
        ...extraHeaders,
      },
    })
  }

  private isRetryableEndpointError(err: any): boolean {
    const status = Number(err?.response?.status || 0)
    if (status !== 404 && status !== 405) return false
    return !this.isBusinessValidationError(err)
  }

  private isRetryableTransportError(err: any): boolean {
    if (err?.response) return false
    return ['ECONNABORTED', 'ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN'].includes(
      String(err?.code || '').trim(),
    )
  }

  private extractErrorMessage(err: any, fallback: string): string {
    const candidates = [
      err?.response?.data?.message,
      err?.response?.data?.ReturnMessage,
      err?.response?.data?.description,
      err?.response?.data?.error,
      err?.message,
    ]

    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate.trim()
      }
      if (candidate && typeof candidate === 'object') {
        try {
          return JSON.stringify(candidate)
        } catch {
          return fallback
        }
      }
    }

    return fallback
  }

  private isBusinessValidationError(err: any): boolean {
    const status = Number(err?.response?.status || 0)
    if (![400, 404, 405, 409, 422].includes(status)) return false

    const message = this.extractErrorMessage(err, '').toLowerCase()
    if (!message) return false

    if (message.includes('endpoint') && message.includes('not found')) return false
    if (message === 'request failed with status code 404') return false
    if (message === 'request failed with status code 405') return false

    return true
  }

  private shouldRetryShipmentWithoutCourierId(err: any): boolean {
    const message = this.extractErrorMessage(err, '').toLowerCase()
    if (!message) return false

    return (
      message.includes('drop pincode not serviceable') ||
      message.includes('destination pincode') ||
      message.includes('not serviceable')
    )
  }

  private isAuthTokenError(err: any): boolean {
    const status = Number(err?.response?.status || 0)
    if (status !== 401) return false

    const message = this.extractErrorMessage(err, '').toLowerCase()
    if (!message) return true

    return (
      message.includes('token') ||
      message.includes('unauthorized') ||
      message.includes('invalid') ||
      message.includes('expired')
    )
  }

  private isProviderTokenExpiredPayload(value: any): boolean {
    const code = String(value?.ReturnCode ?? value?.code ?? '').trim()
    const message = String(value?.ReturnMessage ?? value?.message ?? value?.error ?? '')
      .trim()
      .toLowerCase()
    return code === '101' && message.includes('token')
  }

  private async requestWithFallback<T>({
    method,
    pathCandidates,
    data,
    logPayload = true,
    preferShipmentBase = false,
    exactBaseCandidates,
    headers,
    skipToken = false,
    retryTransportErrors = false,
  }: {
    method: 'get' | 'post'
    pathCandidates: string[]
    data?: any
    logPayload?: boolean
    preferShipmentBase?: boolean
    exactBaseCandidates?: string[]
    headers?: Record<string, string>
    skipToken?: boolean
    retryTransportErrors?: boolean
  }): Promise<T> {
    await this.ensureConfigLoaded()
    const token = skipToken ? '' : await this.getApiToken()
    const baseCandidates = this.getBaseCandidates({ preferShipmentBase, exactBaseCandidates })
    const dedupedPaths = Array.from(new Set(pathCandidates.filter(Boolean)))
    let lastError: any = null
    const attemptedUrls: string[] = []
    const attemptedUrlSet = new Set<string>()

    for (const baseCandidate of baseCandidates) {
      for (const pathCandidate of dedupedPaths) {
        const { baseURL, requestPath, requestUrl } = this.resolveEndpointTarget(
          baseCandidate,
          pathCandidate,
        )
        if (attemptedUrlSet.has(requestUrl)) continue
        attemptedUrlSet.add(requestUrl)
        attemptedUrls.push(requestUrl)
        let authToken = token
        let didRefreshToken = false
        try {
          let response

          while (true) {
            const http = this.createHttpClient(baseURL, authToken, headers)
            try {
              this.log('API attempt', {
                method,
                url: requestUrl,
                payload: logPayload ? this.sanitizeForLogs(data) : undefined,
                tokenSource: didRefreshToken ? 'refreshed' : 'cached_or_saved',
              })
              response = await http.request<T>({
                method,
                url: requestPath,
                data,
              })
              if (
                !skipToken &&
                !didRefreshToken &&
                this.isProviderTokenExpiredPayload(response.data) &&
                this.username &&
                this.password
              ) {
                this.log('API returned token expiry payload, refreshing token and retrying', {
                  method,
                  url: requestUrl,
                })
                authToken = await this.getApiToken(true)
                didRefreshToken = true
                continue
              }
              break
            } catch (err: any) {
              if (!didRefreshToken && this.isAuthTokenError(err) && this.username && this.password) {
                this.log('API auth failed, refreshing token and retrying', {
                  method,
                  url: requestUrl,
                  status: err?.response?.status || null,
                  message: this.extractErrorMessage(err, 'Unauthorized'),
                })
                authToken = await this.getApiToken(true)
                didRefreshToken = true
                continue
              }
              throw err
            }
          }

          const shouldPersistResolvedBase =
            !this.isAbsoluteEndpoint(pathCandidate) && baseURL !== this.baseApi
          if (shouldPersistResolvedBase) {
            this.log('Resolved alternate Xpressbees base URL', {
              previousBaseApi: this.baseApi,
              resolvedBaseApi: baseURL,
            })
            this.baseApi = baseURL
          }

          this.log('API response', {
            method,
            url: requestUrl,
            payload: logPayload ? this.sanitizeForLogs(data) : undefined,
            response: this.sanitizeForLogs(response.data),
          })

          return response.data
        } catch (err: any) {
          lastError = err
          this.log('API attempt failed', {
            method,
            url: requestUrl,
            payload: logPayload ? this.sanitizeForLogs(data) : undefined,
            status: err?.response?.status || null,
            statusText: err?.response?.statusText || null,
            response:
              typeof err?.response?.data === 'string'
                ? err.response.data.slice(0, 300)
                : this.sanitizeForLogs(err?.response?.data) || null,
            message: err?.message || err,
          })

          if (this.isBusinessValidationError(err)) {
            throw new HttpError(400, this.extractErrorMessage(err, 'request rejected'))
          }

          if (
            !this.isRetryableEndpointError(err) &&
            !(retryTransportErrors && this.isRetryableTransportError(err))
          ) {
            throw err
          }
        }
      }
    }

    const allAttemptsWereEndpointMisses =
      attemptedUrls.length > 0 &&
      this.isRetryableEndpointError(lastError) &&
      attemptedUrls.length >= dedupedPaths.length

    if (allAttemptsWereEndpointMisses) {
      throw new HttpError(
        502,
        `Xpressbees API endpoint not found for the configured base URL. Tried: ${attemptedUrls.join(
          ', ',
        )}. Verify the Xpressbees API base URL in courier credentials and confirm your account's shipment endpoint.`,
      )
    }

    if (lastError) {
      throw new HttpError(
        Number(lastError?.response?.status || 502),
        this.extractErrorMessage(lastError, 'Xpressbees API request failed'),
      )
    }

    throw lastError
  }

  private async getHttp(): Promise<AxiosInstance> {
    await this.ensureConfigLoaded()
    const token = await this.getApiToken()

    return this.createHttpClient(this.baseApi, token)
  }

  private extractTokenFromResponse(raw: any): string {
    const fromDirectCandidates = [
      raw?.token,
      raw?.access_token,
      raw?.jwt,
      raw?.data?.token,
      raw?.data?.access_token,
      raw?.data?.jwt,
      raw?.data?.accessToken,
      raw?.accessToken,
      raw?.result?.token,
      raw?.result?.access_token,
      raw?.result?.accessToken,
      raw?.data?.data?.token,
      raw?.data?.data?.access_token,
      raw?.data?.data?.accessToken,
      raw?.data?.jwt_token,
      raw?.data?.auth_token,
      raw?.auth_token,
      raw?.data?.authToken,
      raw?.authToken,
    ]

    for (const candidate of fromDirectCandidates) {
      const token = String(candidate || '').trim()
      if (token) return token
    }

    const visited = new Set<any>()
    const deepSearch = (value: any): string => {
      if (!value || typeof value !== 'object') return ''
      if (visited.has(value)) return ''
      visited.add(value)

      if (Array.isArray(value)) {
        for (const item of value) {
          const token = deepSearch(item)
          if (token) return token
        }
        return ''
      }

      for (const [key, nested] of Object.entries(value)) {
        const normalizedKey = key.toLowerCase()
        if (
          [
            'token',
            'access_token',
            'accesstoken',
            'jwt',
            'jwt_token',
            'auth_token',
            'authtoken',
          ].includes(normalizedKey)
        ) {
          const token = String(nested || '').trim()
          if (token) return token
        }
      }

      for (const nested of Object.values(value)) {
        const token = deepSearch(nested)
        if (token) return token
      }

      return ''
    }

    const recursiveToken = deepSearch(raw)
    if (recursiveToken) return recursiveToken

    const candidates = [raw?.data, raw?.result]

    for (const candidate of candidates) {
      if (typeof candidate === 'string') {
        const token = candidate.trim()
        if (token && token.length > 20 && !token.startsWith('{')) return token
      }
    }
    return ''
  }

  private async persistGeneratedToken(token: string) {
    if (
      process.env.NODE_ENV === 'test' ||
      String(process.env.XPRESSBEES_SKIP_TOKEN_PERSIST || '').toLowerCase() === 'true' ||
      (this.secretKey &&
        String(process.env.XPRESSBEES_PERSIST_GENERATED_TOKEN || '').toLowerCase() !== 'true')
    ) {
      this.log('Token persist skipped for test or explicit opt-out', {
        tokenLength: token.length,
        secretKeyAuth: Boolean(this.secretKey),
      })
      return
    }

    try {
      await db
        .update(courier_credentials)
        .set({
          apiKey: token,
          updatedAt: new Date(),
        })
        .where(eq(courier_credentials.provider, 'xpressbees'))
      this.log('Persisted generated API token to courier credentials', {
        tokenLength: token.length,
        tokenPreview: `${token.slice(0, 4)}...${token.slice(-4)}`,
      })
    } catch (err: any) {
      this.log('Token persist skipped', {
        tokenLength: token.length,
        message: err?.message || String(err),
        code: err?.code || null,
        detail: err?.detail || null,
      })
    }
  }

  private async generateApiToken(): Promise<string> {
    await this.ensureConfigLoaded()

    if (!this.username || !this.password) {
      throw new Error(
        'Xpressbees API token is not configured and username/password are missing. Save bearer token or login credentials in courier credentials.',
      )
    }

    const payloadVariants = [
      ...(this.secretKey
        ? [
            { username: this.username, password: this.password, secretkey: this.secretKey },
            { username: this.username, password: this.password, secretKey: this.secretKey },
            { username: this.username, password: this.password, secret_key: this.secretKey },
            { UserName: this.username, Password: this.password, SecretKey: this.secretKey },
            { Username: this.username, Password: this.password, SecretKey: this.secretKey },
            { email: this.username, password: this.password, secretkey: this.secretKey },
            { Email: this.username, Password: this.password, SecretKey: this.secretKey },
          ]
        : []),
      { email: this.username, password: this.password },
      { Email: this.username, Password: this.password },
      { username: this.username, password: this.password },
      { Username: this.username, Password: this.password },
      { UserName: this.username, Password: this.password },
      { login_id: this.username, password: this.password },
      { loginId: this.username, password: this.password },
      { LoginId: this.username, Password: this.password },
    ]
    const endpointCandidates = this.getConfiguredPathCandidates('XPRESSBEES_TOKEN_ENDPOINTS', [
      'https://userauthapis.xbees.in/api/auth/generateToken',
      'http://stageusermanagementapi.xbees.in/api/auth/generateToken',
      this.tokenEndpoint,
      '/api/users/login',
      '/api/login',
      '/api/generate-token',
      '/api/token',
      '/api/auth/login',
    ])
    const baseCandidates = this.getAuthBaseCandidates()
    const maskedLogin = this.sanitizeForLogs({ email: this.username }).email

    let lastError: any = null
    let authCredentialError: any = null
    const attemptedUrls: string[] = []
    const attemptedUrlSet = new Set<string>()
    this.log('Generating API token', {
      baseCandidates,
      endpointCandidates,
      hasUsername: Boolean(this.username),
      hasPassword: Boolean(this.password),
      tokenEndpointOverride:
        process.env.XPRESSBEES_TOKEN_ENDPOINT || process.env.XPRESSBEES_TOKEN_ENDPOINTS || null,
    })

    for (const baseCandidate of baseCandidates) {
      for (const endpoint of endpointCandidates) {
        const { baseURL, requestPath, requestUrl } = this.resolveEndpointTarget(
          baseCandidate,
          endpoint,
        )
        if (attemptedUrlSet.has(requestUrl)) continue
        attemptedUrlSet.add(requestUrl)

        const loginHttp = axios.create({
          baseURL,
          timeout: 20000,
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...(this.authBearer ? { Authorization: this.buildBearerHeader(this.authBearer) } : {}),
            ...(this.xbKey || this.xbAccessKey
              ? {
                  XBKey: this.xbKey || this.xbAccessKey,
                  xbKey: this.xbKey || this.xbAccessKey,
                  xbAccessKey: this.xbAccessKey || this.xbKey,
                  XbAccessKey: this.xbAccessKey || this.xbKey,
                }
              : {}),
          },
        })

        for (const body of payloadVariants) {
          attemptedUrls.push(requestUrl)
          try {
            this.log('Auth attempt', {
              url: requestUrl,
              payloadKeys: Object.keys(body),
              login: maskedLogin,
            })
            const res = await loginHttp.post(requestPath, body)
            const token = this.extractTokenFromResponse(res.data)
            this.log('Auth response', {
              url: requestUrl,
              status: res.status,
              hasToken: Boolean(token),
              responseKeys: Object.keys(res.data || {}),
            })
            if (!token) {
              this.log('Auth response body (no token extracted)', {
                url: requestUrl,
                body:
                  typeof res.data === 'string'
                    ? res.data.slice(0, 500)
                    : JSON.stringify(res.data).slice(0, 1000),
              })
            }
            if (token) {
              this.apiToken = token
              this.tokenEndpoint = endpoint
              if (!this.isAbsoluteEndpoint(endpoint) || /shipment|xbclientapi/i.test(baseURL)) {
                this.baseApi = baseURL
              }
              await this.persistGeneratedToken(token)
              this.log('Generated API token via login credentials', {
                endpoint,
                baseApi: this.baseApi,
                authBaseApi: baseURL,
                login: maskedLogin,
              })
              return token
            }
          } catch (err: any) {
            lastError = err
            const status = Number(err?.response?.status || 0)
            if (!authCredentialError && (status === 401 || status === 403)) {
              authCredentialError = err
            }
            this.log('Auth attempt failed', {
              url: requestUrl,
              payloadKeys: Object.keys(body),
              status: err?.response?.status || null,
              statusText: err?.response?.statusText || null,
              response:
                typeof err?.response?.data === 'string'
                  ? err.response.data.slice(0, 300)
                  : err?.response?.data || null,
              message: err?.message || err,
            })
          }
        }
      }
    }

    const failure = authCredentialError || lastError
    const credentialFailure = Boolean(authCredentialError)
    const endpointFailure =
      !credentialFailure &&
      attemptedUrls.length > 0 &&
      this.isRetryableEndpointError(lastError)
    const providerMessage =
      failure?.response?.data?.message ||
      failure?.response?.data?.error ||
      failure?.message ||
      'unknown error'

    const reason = credentialFailure
      ? `Xpressbees rejected the configured username/password or login payload (${providerMessage}).`
      : endpointFailure
        ? `None of the attempted login endpoints were found (${providerMessage}).`
        : providerMessage
    const uniqueAttemptedUrls = Array.from(new Set(attemptedUrls))
    const secretKeyHint = this.secretKey
      ? ''
      : ' If your account uses https://userauthapis.xbees.in/api/auth/generateToken, save the Xpressbees Secret Key in courier credentials.'

    throw new Error(
      `Failed to generate Xpressbees API token. Tried ${uniqueAttemptedUrls.join(
        ', ',
      )}. ${reason}${secretKeyHint} Set XPRESSBEES_TOKEN_ENDPOINTS if your account uses a custom login path.`,
    )
  }

  async getApiToken(forceRefresh = false): Promise<string> {
    await this.ensureConfigLoaded()
    const configuredToken = this.getConfiguredApiToken(forceRefresh)
    if (configuredToken) return configuredToken
    return this.generateApiToken()
  }

  private isTruthyProviderValue(value: any): boolean {
    if (value === true || value === 1) return true
    const normalized = String(value ?? '').trim().toLowerCase()
    return ['1', 'true', 'success', 'successful', 'ok', 'yes', 'y', 'available'].includes(normalized)
  }

  private normalizeServiceabilityRecord(record: any): XpressbeesServiceabilityRecord {
    const id = String(
      record?.id ??
        record?.courier_id ??
        record?.courierId ??
        record?.carrier_id ??
        record?.carrierId ??
        '',
    ).trim()
    const name = String(
      record?.name ??
        record?.courier_name ??
        record?.courierName ??
        record?.service_name ??
        record?.serviceName ??
        'Xpressbees',
    ).trim()

    return {
      ...record,
      id,
      name,
    }
  }

  private extractServiceabilityRecords(raw: any): XpressbeesServiceabilityRecord[] {
    const candidates = [
      raw?.data,
      raw?.records,
      raw?.couriers,
      raw?.result,
      raw?.response,
      raw?.data?.records,
      raw?.data?.couriers,
      raw?.data?.data,
      raw?.result?.records,
      raw?.result?.couriers,
      raw?.result?.data,
      raw?.response?.records,
      raw?.response?.couriers,
      raw?.response?.data,
    ]

    for (const candidate of candidates) {
      if (Array.isArray(candidate)) {
        return candidate.map((record) => this.normalizeServiceabilityRecord(record))
      }
      if (
        candidate &&
        typeof candidate === 'object' &&
        (candidate.id ||
          candidate.courier_id ||
          candidate.courierId ||
          candidate.name ||
          candidate.courier_name ||
          candidate.freight_charges ||
          candidate.total_charges)
      ) {
        return [this.normalizeServiceabilityRecord(candidate)]
      }
    }

    return []
  }

  private usesXbeesPincodeServiceability(pathCandidates: string[]): boolean {
    return pathCandidates.some((path) =>
      /serviceabilitypincode\/details/i.test(String(path || '')),
    )
  }

  private getConfiguredBusinessServices(): string[] {
    const values = [
      this.businessService,
      ...String(this.businessServices || '')
        .split(',')
        .map((item) => item.trim()),
    ].filter(Boolean)

    return Array.from(new Set(values))
  }

  private getPincodeMasterCacheKey(pathCandidates: string[], businessService: string): string {
    return JSON.stringify({
      paths: pathCandidates,
      businessUnit: this.pincodeBusinessUnit,
      businessFlow: this.pincodeBusinessFlow,
      businessService,
      version: this.serviceabilityVersion,
    })
  }

  private async requestPincodeMasterServiceability(
    pathCandidates: string[],
    businessService: string,
  ) {
    const cacheKey = this.getPincodeMasterCacheKey(pathCandidates, businessService)
    const cached = XpressbeesService.pincodeMasterCache.get(cacheKey)
    if (this.pincodeCacheTtlMs > 0 && cached && cached.expiresAt > Date.now()) {
      this.log('Pincode master cache hit', {
        businessService,
        expiresInMs: cached.expiresAt - Date.now(),
      })
      return cached.raw
    }

    const raw = await this.requestWithFallback<any>({
      method: 'post',
      pathCandidates,
      data: {
        BusinessUnit: this.pincodeBusinessUnit,
        BusinessFlow: this.pincodeBusinessFlow,
        BusinessService: businessService,
      },
      headers: this.buildVersionHeaders(this.serviceabilityVersion),
    })

    if (this.pincodeCacheTtlMs > 0 && this.isProviderSuccess(raw)) {
      XpressbeesService.pincodeMasterCache.set(cacheKey, {
        expiresAt: Date.now() + this.pincodeCacheTtlMs,
        raw,
      })
    }

    return raw
  }

  private responseContainsPincode(value: any, pincode: string): boolean {
    const normalizedPincode = String(pincode || '').replace(/\D/g, '')
    if (!normalizedPincode) return false

    const visit = (current: any): boolean => {
      if (current == null) return false
      if (typeof current === 'string' || typeof current === 'number') {
        return String(current).replace(/\D/g, '') === normalizedPincode
      }
      if (Array.isArray(current)) {
        return current.some((item) => visit(item))
      }
      if (typeof current === 'object') {
        const directCandidates = [
          current.pincode,
          current.Pincode,
          current.pinCode,
          current.PinCode,
          current.pin_code,
          current.Pin_Code,
          current.code,
          current.Code,
        ]
        if (directCandidates.some((candidate) => visit(candidate))) return true
        return Object.values(current).some((nested) => visit(nested))
      }
      return false
    }

    return visit(value)
  }

  private isProviderSuccess(raw: any): boolean {
    return (
      Number(raw?.ReturnCode ?? raw?.returnCode ?? 0) === 100 ||
      this.isTruthyProviderValue(raw?.status ?? raw?.success ?? raw?.data?.status)
    )
  }

  async checkServiceability(payload: {
    origin: string
    destination: string
    payment_type: 'cod' | 'prepaid'
    order_amount: string
    weight: string
    length: string
    breadth: string
    height: string
  }): Promise<XpressbeesServiceabilityResponse> {
    await this.ensureConfigLoaded()
    const pathCandidates = this.getConfiguredPathCandidates('XPRESSBEES_SERVICEABILITY_ENDPOINTS', [
      'https://xbmasterapi.xbees.in/expose/get/serviceabilitypincode/details',
      'http://stagexbmasterapi.xbees.in:3600/expose/get/serviceabilitypincode/details',
      '/api/courier/serviceability',
      '/courier/serviceability',
    ])

    const pincodePathCandidates = pathCandidates.filter((path) =>
      /serviceabilitypincode\/details/i.test(String(path || '')),
    )
    const legacyPathCandidates = pathCandidates.filter(
      (path) => !/serviceabilitypincode\/details/i.test(String(path || '')),
    )

    if (pincodePathCandidates.length) {
      const origin = String(payload.origin || '').replace(/\D/g, '')
      const destination = String(payload.destination || '').replace(/\D/g, '')
      const pickupService = this.pickupBusinessService || 'PickUp'
      const deliveryService = this.deliveryBusinessService || 'Delivery'

      try {
        const pickupRaw = await this.requestPincodeMasterServiceability(
          pincodePathCandidates,
          pickupService,
        )
        const deliveryRaw =
          deliveryService === pickupService
            ? pickupRaw
            : await this.requestPincodeMasterServiceability(pincodePathCandidates, deliveryService)

        const pickupSuccess = this.isProviderSuccess(pickupRaw)
        const deliverySuccess = this.isProviderSuccess(deliveryRaw)
        const originAvailable = pickupSuccess && this.responseContainsPincode(pickupRaw, origin)
        const destinationAvailable =
          deliverySuccess && this.responseContainsPincode(deliveryRaw, destination)
        const serviceable = originAvailable && destinationAvailable
        const rawResponses = [
          { businessService: pickupService, raw: pickupRaw },
          ...(deliveryService === pickupService
            ? []
            : [{ businessService: deliveryService, raw: deliveryRaw }]),
        ]
        const records: XpressbeesServiceabilityRecord[] = serviceable
          ? [
              this.normalizeServiceabilityRecord({
                id: 'xpressbees-route',
                name: 'Xpressbees Route Serviceability',
                serviceability_mode: 'xbees_pincode_master',
                origin_available: originAvailable,
                destination_available: destinationAvailable,
                origin_business_service: pickupService,
                destination_business_service: deliveryService,
              }),
            ]
          : []

        this.log('Serviceability', {
          origin: payload.origin,
          destination: payload.destination,
          status: pickupSuccess && deliverySuccess,
          serviceable,
          originAvailable,
          destinationAvailable,
          records: records.length,
          mode: 'xbees_pincode_master',
        })

        return {
          serviceable,
          records,
          codAvailable: payload.payment_type === 'cod' ? serviceable : true,
          prepaidAvailable: true,
          tat: null,
          mode: 'xbees_pincode_master',
          raw: rawResponses,
        }
      } catch (err) {
        if (!legacyPathCandidates.length) throw err
        this.log('Pincode master serviceability failed, trying legacy endpoint', {
          message: this.extractErrorMessage(err, 'pincode master serviceability failed'),
        })
      }
    }

    const raw = await this.requestWithFallback<any>({
      method: 'post',
      pathCandidates: legacyPathCandidates.length ? legacyPathCandidates : pathCandidates,
      data: payload,
    })
    const records = this.extractServiceabilityRecords(raw)
    const status = this.isTruthyProviderValue(raw?.status ?? raw?.success ?? raw?.data?.status)
    const explicitlyServiceable = this.isTruthyProviderValue(
      raw?.serviceable ?? raw?.available ?? raw?.data?.serviceable ?? raw?.data?.available,
    )
    const serviceable = status && (records.length > 0 || explicitlyServiceable)

    this.log('Serviceability', {
      origin: payload.origin,
      destination: payload.destination,
      status,
      serviceable,
      records: records.length,
    })

    return {
      serviceable,
      records,
      codAvailable:
        payload.payment_type === 'prepaid'
          ? true
          : records.length > 0
            ? records.some(
                (record: XpressbeesServiceabilityRecord) =>
                  record?.cod_available === true ||
                  record?.codAvailable === true ||
                  String(record?.payment_type ?? '').toLowerCase().includes('cod') ||
                  Number(record?.cod_charges ?? 0) >= 0,
              )
            : serviceable,
      prepaidAvailable:
        payload.payment_type === 'prepaid' ||
        records.length === 0 ||
        records.some(
          (record: XpressbeesServiceabilityRecord) =>
            record?.prepaid_available === true ||
            record?.prepaidAvailable === true ||
            String(record?.payment_type ?? '').toLowerCase().includes('prepaid') ||
            String(record?.payment_type ?? '').trim() === '',
        ),
      tat: null,
      mode: 'legacy_courier_serviceability',
      raw,
    }
  }

  private normalizeAwbDeliveryType(value: any): 'COD' | 'PREPAID' {
    const normalized = String(value || '').trim().toUpperCase()
    return normalized === 'COD' ? 'COD' : 'PREPAID'
  }

  private getAwbResponseCode(response: any): string {
    return String(response?.ReturnCode ?? response?.returnCode ?? response?.code ?? '').trim()
  }

  private getAwbResponseMessage(response: any): string {
    return String(
      response?.ReturnMessage ??
        response?.returnMessage ??
        response?.message ??
        response?.Message ??
        response?.error ??
        'Xpressbees AWB generation failed',
    ).trim()
  }

  private isAwbResponseSuccess(response: any): boolean {
    const code = this.getAwbResponseCode(response)
    const message = this.getAwbResponseMessage(response).toLowerCase()
    return code === '100' || message === 'successful' || message === 'success'
  }

  private extractAwbBatchId(response: any): string {
    return this.manifestString(response?.BatchID, response?.batchId, response?.batch_id)
  }

  private extractAwbSeries(response: any): string[] {
    const rawSeries =
      response?.AWBNoSeries ??
      response?.awbNoSeries ??
      response?.awb_no_series ??
      response?.AWBSeries ??
      response?.awbSeries ??
      response?.data?.AWBNoSeries ??
      response?.data?.awbNoSeries ??
      []
    const series = Array.isArray(rawSeries) ? rawSeries : [rawSeries]
    return Array.from(
      new Set(
        series
          .flatMap((value) => String(value ?? '').split(/[\s,;|]+/))
          .map((value) => value.trim().replace(/\D/g, ''))
          .filter(Boolean),
      ),
    )
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)))
  }

  async requestAwbNumberSeries(input: { deliveryType?: string } = {}) {
    await this.ensureConfigLoaded()
    const deliveryType = this.normalizeAwbDeliveryType(input.deliveryType)
    return this.requestWithFallback<any>({
      method: 'post',
      pathCandidates: this.getAwbPathCandidates(
        'XPRESSBEES_AWB_GENERATION_ENDPOINTS',
        'https://xbclientapi.xbees.in/POSTShipmentService.svc/AWBNumberSeriesGeneration',
        'http://114.143.206.69:803/StandardForwardStagingService.svc/AWBNumberSeriesGeneration',
      ),
      data: {
        BusinessUnit: process.env.XPRESSBEES_AWB_BUSINESS_UNIT || this.businessUnit || 'ECOM',
        ServiceType: process.env.XPRESSBEES_AWB_SERVICE_TYPE || this.businessFlow || 'FORWARD',
        DeliveryType: deliveryType,
      },
      skipToken: true,
      retryTransportErrors: true,
    })
  }

  async getGeneratedAwbNumberSeries(batchId: string) {
    await this.ensureConfigLoaded()
    const normalizedBatchId = String(batchId || '').trim()
    if (!normalizedBatchId) {
      throw new HttpError(400, 'Xpressbees BatchID is required to fetch generated AWB series')
    }

    return this.requestWithFallback<any>({
      method: 'post',
      pathCandidates: this.getAwbPathCandidates(
        'XPRESSBEES_AWB_SERIES_ENDPOINTS',
        'https://xbclientapi.xbees.in/TrackingService.svc/GetAWBNumberGeneratedSeries',
        'http://114.143.206.69:803/StandardForwardStagingService.svc/GetAWBNumberGeneratedSeries',
      ),
      data: {
        BusinessUnit: process.env.XPRESSBEES_AWB_BUSINESS_UNIT || this.businessUnit || 'ECOM',
        ServiceType: process.env.XPRESSBEES_AWB_SERVICE_TYPE || this.businessFlow || 'FORWARD',
        BatchID: normalizedBatchId,
      },
      skipToken: true,
      retryTransportErrors: true,
    })
  }

  async generateAwbNumber(input: {
    deliveryType?: string
    excludeAwbs?: Iterable<string>
    pollAttempts?: number
    pollDelayMs?: number
  } = {}) {
    const excludeAwbs = new Set(
      Array.from(input.excludeAwbs || [])
        .map((value) => String(value || '').replace(/\D/g, '').trim())
        .filter(Boolean),
    )
    const pollAttempts = Math.max(
      1,
      Number(input.pollAttempts ?? process.env.XPRESSBEES_AWB_SERIES_POLL_ATTEMPTS ?? 5),
    )
    const pollDelayMs = Math.max(
      0,
      Number(input.pollDelayMs ?? process.env.XPRESSBEES_AWB_SERIES_POLL_DELAY_MS ?? 2000),
    )

    const batchResponse = await this.requestAwbNumberSeries({ deliveryType: input.deliveryType })
    if (!this.isAwbResponseSuccess(batchResponse)) {
      throw new HttpError(
        502,
        `Xpressbees AWB generation failed: ${this.getAwbResponseMessage(batchResponse)} (${this.getAwbResponseCode(batchResponse) || 'no-code'})`,
      )
    }

    const batchId = this.extractAwbBatchId(batchResponse)
    if (!batchId) {
      throw new HttpError(502, 'Xpressbees AWB generation succeeded but did not return BatchID')
    }

    let lastSeriesResponse: any = null
    for (let attempt = 1; attempt <= pollAttempts; attempt += 1) {
      lastSeriesResponse = await this.getGeneratedAwbNumberSeries(batchId)
      if (!this.isAwbResponseSuccess(lastSeriesResponse)) {
        throw new HttpError(
          502,
          `Xpressbees AWB series fetch failed for BatchID ${batchId}: ${this.getAwbResponseMessage(lastSeriesResponse)} (${this.getAwbResponseCode(lastSeriesResponse) || 'no-code'})`,
        )
      }

      const awbs = this.extractAwbSeries(lastSeriesResponse)
      const availableAwb = awbs.find((awb) => !excludeAwbs.has(awb))
      if (availableAwb) {
        return {
          awb: availableAwb,
          awbs,
          batchId,
          request: batchResponse,
          series: lastSeriesResponse,
        }
      }

      if (attempt < pollAttempts) {
        await this.sleep(pollDelayMs)
      }
    }

    throw new HttpError(
      502,
      `Xpressbees AWB series for BatchID ${batchId} did not return an unused AWB`,
    )
  }

  async listNdr() {
    return this.requestWithFallback<any>({
      method: 'get',
      pathCandidates: this.getConfiguredPathCandidates('XPRESSBEES_NDR_ENDPOINTS', [
        '/api/ndr',
        '/ndr',
      ]),
    })
  }

  async listCouriers() {
    return this.requestWithFallback<any>({
      method: 'get',
      pathCandidates: this.getConfiguredPathCandidates('XPRESSBEES_COURIER_ENDPOINTS', [
        '/api/courier',
        '/courier',
      ]),
    })
  }

  private formatXpressbeesDateTime(value: any): string {
    const normalized = String(value || '').trim()
    if (!normalized) return ''

    if (/^\d{2}-\d{2}-\d{4}\s+\d{2}:\d{2}:\d{2}$/.test(normalized)) {
      return normalized
    }

    const dateOnly = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (dateOnly) {
      const [, year, month, day] = dateOnly
      return `${day}-${month}-${year} 12:00:00`
    }

    const parsed = new Date(normalized)
    if (Number.isNaN(parsed.getTime())) return normalized

    const pad = (part: number) => String(part).padStart(2, '0')
    return `${pad(parsed.getDate())}-${pad(parsed.getMonth() + 1)}-${parsed.getFullYear()} ${pad(
      parsed.getHours(),
    )}:${pad(parsed.getMinutes())}:${pad(parsed.getSeconds())}`
  }

  private buildXpressbeesDeferredNdrPayload(item: any): Record<string, any> | null {
    const data = item?.action_data || item?.actionData || item?.data || item || {}
    const shippingId = String(
      item?.ShippingID || item?.shippingId || item?.shipping_id || item?.awb || item?.waybill || '',
    ).trim()

    if (!shippingId) return null

    const addressParts = [
      data?.PrimaryCustomerAddress,
      data?.primaryCustomerAddress,
      data?.address,
      data?.address_1,
      data?.add,
      data?.address_2,
    ]
      .map((part) => String(part || '').trim())
      .filter(Boolean)
    const address = Array.from(new Set(addressParts)).join(', ')
    const mobile = String(
      data?.PrimaryCustomerMobileNumber ||
        data?.primaryCustomerMobileNumber ||
        data?.phone ||
        data?.alternate_number ||
        data?.alternateNumber ||
        '',
    ).trim()
    const deferredDate = this.formatXpressbeesDateTime(
      data?.DeferredDeliveryDate ||
        data?.deferredDeliveryDate ||
        data?.next_attempt_date ||
        data?.re_attempt_date ||
        data?.retry_date ||
        item?.DeferredDeliveryDate ||
        item?.nextAttemptDate,
    )
    const pincode = String(
      data?.CustomerPincode ||
        data?.customerPincode ||
        data?.pincode ||
        data?.pin ||
        data?.customer_pincode ||
        '',
    ).trim()
    const comments = String(data?.Comments || data?.comments || item?.comments || '').trim()
    const lastModifiedBy = String(
      data?.LastModifiedBy || data?.lastModifiedBy || item?.lastModifiedBy || '',
    ).trim()

    const body: Record<string, any> = { ShippingID: shippingId }
    if (deferredDate) body.DeferredDeliveryDate = deferredDate
    if (mobile) body.PrimaryCustomerMobileNumber = mobile
    if (address) body.PrimaryCustomerAddress = address
    if (pincode) body.CustomerPincode = pincode
    if (comments) body.Comments = comments
    body.LastModifiedBy = lastModifiedBy

    return body
  }

  async submitNdrAction(payload: any[]) {
    const items = Array.isArray(payload) ? payload : [payload]
    const pathCandidates = this.getConfiguredPathCandidates('XPRESSBEES_NDR_ACTION_ENDPOINTS', [
      'https://clientshipupdatesapi.xbees.in/client/UpdateNDRDeferredDeliveryDate',
      'http://stageclientshipupdatesapi.xbees.in/client/UpdateNDRDeferredDeliveryDate',
      '/api/ndr/create',
      '/ndr/create',
    ])
    const deferredEndpointCandidates = pathCandidates.filter((path) =>
      /UpdateNDRDeferredDeliveryDate/i.test(String(path || '')),
    )
    const legacyEndpointCandidates = pathCandidates.filter(
      (path) => !/UpdateNDRDeferredDeliveryDate/i.test(String(path || '')),
    )

    if (deferredEndpointCandidates.length) {
      const results = []
      for (const item of items) {
        const body = this.buildXpressbeesDeferredNdrPayload(item)
        if (!body) {
          if (!legacyEndpointCandidates.length) {
            throw new HttpError(400, 'Xpressbees ShippingID/AWB is required for NDR action')
          }
          return this.requestWithFallback<any>({
            method: 'post',
            pathCandidates: legacyEndpointCandidates,
            data: items,
          })
        }

        results.push(
          await this.requestWithFallback<any>({
            method: 'post',
            pathCandidates: deferredEndpointCandidates,
            data: body,
            headers: this.buildVersionHeaders(this.trackingVersion),
          }),
        )
      }

      return results.length === 1 ? results[0] : results
    }

    return this.requestWithFallback<any>({
      method: 'post',
      pathCandidates: legacyEndpointCandidates,
      data: items,
    })
  }

  async createShipment(payload: any): Promise<XpressbeesShipmentResponse> {
    const body: Record<string, any> = {
      order_number: payload.order_number,
      unique_order_number: payload.unique_order_number || 'no',
      shipping_charges: Number(payload.shipping_charges ?? 0),
      discount: Number(payload.discount ?? 0),
      cod_charges: Number(payload.cod_charges ?? 0),
      payment_type: payload.payment_type,
      order_amount: Number(payload.order_amount ?? 0),
      package_weight: Number(payload.package_weight ?? 0),
      package_length: Number(payload.package_length ?? 0),
      package_breadth: Number(payload.package_breadth ?? 0),
      package_height: Number(payload.package_height ?? 0),
      request_auto_pickup:
        String(payload.request_auto_pickup || '').toLowerCase() === 'yes' ? 'yes' : 'no',
      consignee: {
        name: payload?.consignee?.name,
        address: payload?.consignee?.address,
        address_2: payload?.consignee?.address_2 || '',
        city: payload?.consignee?.city,
        state: payload?.consignee?.state,
        pincode: String(payload?.consignee?.pincode || ''),
        phone: String(payload?.consignee?.phone || ''),
      },
      pickup: {
        warehouse_name: payload?.pickup?.warehouse_name,
        name: payload?.pickup?.name,
        address: payload?.pickup?.address,
        address_2: payload?.pickup?.address_2 || '',
        city: payload?.pickup?.city,
        state: payload?.pickup?.state,
        pincode: String(payload?.pickup?.pincode || ''),
        phone: String(payload?.pickup?.phone || ''),
      },
      is_rto_different: payload?.is_rto_different || 'no',
      ...(payload?.rto
        ? {
            rto: {
              warehouse_name: payload.rto.warehouse_name,
              name: payload.rto.name,
              address: payload.rto.address,
              address_2: payload.rto.address_2 || '',
              city: payload.rto.city,
              state: payload.rto.state,
              pincode: String(payload.rto.pincode || ''),
              phone: String(payload.rto.phone || ''),
            },
          }
        : {}),
      order_items: Array.isArray(payload?.order_items)
        ? payload.order_items.map((item: any) => ({
            name: item?.name,
            qty: String(item?.qty ?? 1),
            price: String(item?.price ?? 0),
            sku: item?.sku || '',
          }))
        : [],
      collectable_amount:
        payload?.payment_type === 'cod'
          ? String(payload?.collectable_amount ?? payload?.order_amount ?? 0)
          : '0',
    }

    const requestedCourierId = String(payload?.courier_id ?? '').trim()
    if (requestedCourierId) {
      body.courier_id = requestedCourierId
    }

    try {
      return await this.requestWithFallback<XpressbeesShipmentResponse>({
        method: 'post',
        pathCandidates: this.getConfiguredPathCandidates('XPRESSBEES_SHIPMENT_ENDPOINTS', [
          this.shipmentEndpoint || '/api/shipments2',
        ]),
        data: body,
        exactBaseCandidates: this.getShipmentBaseCandidates(),
      })
    } catch (err: any) {
      if (!requestedCourierId || !this.shouldRetryShipmentWithoutCourierId(err)) {
        throw err
      }

      const fallbackBody = { ...body }
      delete fallbackBody.courier_id

      this.log('Retrying shipment creation without courier_id after provider rejection', {
        order_number: payload.order_number,
        courier_id: requestedCourierId,
        reason: this.extractErrorMessage(err, 'shipment rejected'),
      })

      return this.requestWithFallback<XpressbeesShipmentResponse>({
        method: 'post',
        pathCandidates: this.getConfiguredPathCandidates('XPRESSBEES_SHIPMENT_ENDPOINTS', [
          this.shipmentEndpoint || '/api/shipments2',
        ]),
        data: fallbackBody,
        exactBaseCandidates: this.getShipmentBaseCandidates(),
      })
    }
  }

  async createReverseShipment(payload: any): Promise<XpressbeesShipmentResponse> {
    const body = {
      order_id: payload.order_id,
      request_auto_pickup:
        String(payload.request_auto_pickup || '').toLowerCase() === 'yes' ? 'yes' : 'no',
      consignee: {
        name: payload?.consignee?.name,
        address: payload?.consignee?.address,
        address_2: payload?.consignee?.address_2 || '',
        city: payload?.consignee?.city,
        state: payload?.consignee?.state,
        pincode: String(payload?.consignee?.pincode || ''),
        phone: String(payload?.consignee?.phone || ''),
        alternate_phone: String(payload?.consignee?.alternate_phone || ''),
      },
      pickup: {
        warehouse_name: payload?.pickup?.warehouse_name,
        name: payload?.pickup?.name,
        address: payload?.pickup?.address,
        address_2: payload?.pickup?.address_2 || '',
        city: payload?.pickup?.city,
        state: payload?.pickup?.state,
        pincode: String(payload?.pickup?.pincode || ''),
        phone: String(payload?.pickup?.phone || ''),
      },
      categories: payload?.categories || 'General',
      product_name: payload?.product_name || 'Return Item',
      product_qty: String(payload?.product_qty ?? 1),
      product_amount: String(payload?.product_amount ?? payload?.order_amount ?? 0),
      package_weight: Number(payload?.package_weight ?? 0),
      package_length: String(payload?.package_length ?? 0),
      package_breadth: String(payload?.package_breadth ?? 0),
      package_height: String(payload?.package_height ?? 0),
      qccheck: String(payload?.qccheck ?? '0'),
      uploadedimage: payload?.uploadedimage || '',
      uploadedimage_2: payload?.uploadedimage_2 || '',
      uploadedimage_3: payload?.uploadedimage_3 || '',
      uploadedimage_4: payload?.uploadedimage_4 || '',
      product_usage: String(payload?.product_usage ?? '0'),
      product_damage: String(payload?.product_damage ?? '0'),
      brandname: String(payload?.brandname ?? '0'),
      brandnametype: payload?.brandnametype || '',
      productsize: String(payload?.productsize ?? '0'),
      productsizetype: payload?.productsizetype || '',
      productcolor: String(payload?.productcolor ?? '0'),
      productcolourtype: payload?.productcolourtype || '',
    }
    return this.requestWithFallback<XpressbeesShipmentResponse>({
      method: 'post',
      pathCandidates: this.getConfiguredPathCandidates('XPRESSBEES_REVERSE_SHIPMENT_ENDPOINTS', [
        this.reverseShipmentEndpoint || '/api/reverseshipments',
      ]),
      data: body,
      exactBaseCandidates: this.getShipmentBaseCandidates(),
    })
  }

  private normalizeManifestDetails(value: any): Record<string, any> {
    if (!value) return {}
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value)
        return parsed && typeof parsed === 'object' ? parsed : {}
      } catch {
        return {}
      }
    }
    return typeof value === 'object' ? value : {}
  }

  private manifestString(...values: any[]): string {
    for (const value of values) {
      const normalized = String(value ?? '').trim()
      if (normalized) return normalized
    }
    return ''
  }

  private manifestMoney(value: any, fallback = 0): string {
    const amount = Number(value)
    const safe = Number.isFinite(amount) ? amount : fallback
    return safe.toFixed(2)
  }

  private manifestQuantity(products: any): string {
    const items = Array.isArray(products) ? products : []
    const total = items.reduce((sum, item) => {
      const qty = Number(item?.qty ?? item?.quantity ?? item?.product_qty ?? 1)
      return sum + (Number.isFinite(qty) && qty > 0 ? qty : 1)
    }, 0)
    return String(Math.max(1, Math.round(total || 1)))
  }

  private manifestWeightKg(value: any, fallback = 0.5): string {
    const numeric = Number(value)
    const safe = Number.isFinite(numeric) && numeric > 0 ? numeric : fallback
    const kg = safe > 50 ? safe / 1000 : safe
    return Math.max(0.01, kg).toFixed(3).replace(/0+$/, '').replace(/\.$/, '')
  }

  private normalizeManifestServiceType(...values: any[]): string {
    const raw = this.manifestString(...values, this.manifestServiceType, 'SD')
    const normalized = raw.replace(/[\s_-]+/g, '').toUpperCase()
    if (normalized.includes('AIR')) return 'AIR'
    if (normalized.includes('SURFACE') || normalized === 'SFC') return 'SFC'
    if (normalized === 'SDD') return 'SDD'
    if (normalized === 'NDD') return 'NDD'
    if (normalized === 'INTRASDD') return 'IntraSDD'
    return 'SD'
  }

  private manifestDate(value: any): string | null {
    const normalized = String(value || '').trim()
    if (!normalized) return null
    if (/^\d{2}-\d{2}-\d{4}$/.test(normalized)) return normalized

    const ymd = normalized.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (ymd) {
      const [, year, month, day] = ymd
      return `${day}-${month}-${year}`
    }

    const parsed = new Date(normalized)
    if (Number.isNaN(parsed.getTime())) return null
    const pad = (part: number) => String(part).padStart(2, '0')
    return `${pad(parsed.getDate())}-${pad(parsed.getMonth() + 1)}-${parsed.getFullYear()}`
  }

  private buildManifestAddress(details: {
    address?: any
    city?: any
    email?: any
    name?: any
    pincode?: any
    state?: any
  }) {
    return {
      Address: this.manifestString(details.address).slice(0, 500),
      City: this.manifestString(details.city).slice(0, 50),
      EmailID: this.manifestString(details.email).slice(0, 50),
      Name: this.manifestString(details.name).slice(0, 100),
      PinCode: this.manifestString(details.pincode).replace(/\D/g, '').slice(0, 6),
      State: this.manifestString(details.state).slice(0, 50),
      Type: 'Primary',
    }
  }

  private buildManifestContact(phone: any, includeVirtualNumber = false) {
    const contact: Record<string, any> = {
      PhoneNo: this.manifestString(phone).replace(/\D/g, '').slice(-10),
      Type: 'Primary',
    }
    if (includeVirtualNumber) contact.VirtualNumber = null
    return contact
  }

  private buildPreShipManifestPayload(
    order: any,
    options: { serviceTypeOverride?: string } = {},
  ): Record<string, any> {
    const pickupDetails = this.normalizeManifestDetails(order?.pickup_details || order?.pickup)
    const rtoDetails = this.normalizeManifestDetails(order?.rto_details || order?.rto)
    const products = Array.isArray(order?.products)
      ? order.products
      : Array.isArray(order?.order_items)
        ? order.order_items
        : []
    const firstProduct = products[0] || {}
    const awb = this.manifestString(order?.awb_number, order?.AirWayBillNO, order?.awb)
    const orderNo = this.manifestString(order?.order_number, order?.OrderNo, order?.order_id, awb)
    const paymentType = this.manifestString(order?.order_type, order?.payment_type).toLowerCase()
    const isCod = paymentType === 'cod'
    const businessAccountName = this.manifestString(
      order?.businessAccountName,
      order?.BusinessAccountName,
      this.businessAccountName,
    )
    const pickupVendorCode = this.manifestString(
      pickupDetails.pickupVendorCode,
      pickupDetails.pickup_vendor_code,
      pickupDetails.vendorCode,
      pickupDetails.vendor_code,
      order?.pickupVendorCode,
      order?.PickupVendorCode,
      this.pickupVendorCode,
    )

    if (!awb) throw new HttpError(400, 'Xpressbees AirWayBillNO is required for pre-ship manifest')
    if (!businessAccountName) {
      throw new HttpError(400, 'Xpressbees BusinessAccountName is required for pre-ship manifest')
    }
    if (!pickupVendorCode) {
      throw new HttpError(400, 'Xpressbees PickupVendorCode is required for pre-ship manifest')
    }

    const pickupAddress = this.buildManifestAddress({
      address: pickupDetails.address,
      city: pickupDetails.city,
      email: pickupDetails.email,
      name: pickupDetails.name || pickupDetails.warehouse_name,
      pincode: pickupDetails.pincode,
      state: pickupDetails.state,
    })
    const rtoSource = Object.keys(rtoDetails).length ? rtoDetails : pickupDetails
    const rtoAddress = this.buildManifestAddress({
      address: rtoSource.address,
      city: rtoSource.city,
      email: rtoSource.email,
      name: rtoSource.name || rtoSource.warehouse_name || pickupAddress.Name,
      pincode: rtoSource.pincode || pickupAddress.PinCode,
      state: rtoSource.state || pickupAddress.State,
    })
    const dropAddress = this.buildManifestAddress({
      address: order?.address || order?.consignee?.address,
      city: order?.city || order?.consignee?.city,
      email: order?.buyer_email || order?.consignee?.email,
      name: order?.buyer_name || order?.consignee?.name,
      pincode: order?.pincode || order?.consignee?.pincode,
      state: order?.state || order?.consignee?.state,
    })

    const length = Number(order?.length ?? order?.package_length ?? 10) || 10
    const width = Number(order?.breadth ?? order?.package_breadth ?? 10) || 10
    const height = Number(order?.height ?? order?.package_height ?? 10) || 10
    const physicalWeight = this.manifestWeightKg(order?.weight ?? order?.package_weight)
    const volumetricWeight = this.manifestWeightKg(order?.volumetric_weight)
    const billableWeight = this.manifestWeightKg(
      order?.charged_weight ?? order?.chargeable_weight ?? order?.weight ?? order?.package_weight,
    )
    const invoiceDate = this.manifestDate(order?.invoice_date || order?.order_date)
    const declaredValue = this.manifestMoney(
      order?.invoice_amount ?? order?.order_amount ?? firstProduct?.price ?? 0,
    )
    const invoiceValue = Number(order?.invoice_amount ?? order?.order_amount ?? 0)
    const shouldIncludeGst =
      Boolean(this.manifestString(order?.invoice_number)) ||
      invoiceValue >= 50000 ||
      products.some((item: any) => this.manifestString(item?.hsnCode, item?.hsn_code, item?.hsn))

    const payload: Record<string, any> = {
      AirWayBillNO: awb,
      BusinessAccountName: businessAccountName,
      OrderNo: orderNo,
      SubOrderNo: this.manifestString(order?.sub_order_number, order?.subOrderNo, orderNo),
      OrderType: isCod ? 'COD' : 'PrePaid',
      CollectibleAmount: this.manifestMoney(isCod ? order?.order_amount : 0),
      DeclaredValue: declaredValue,
      PickupType: this.manifestString(order?.pickup_type, pickupDetails.pickupType, this.manifestPickupType, 'Vendor'),
      Quantity: this.manifestQuantity(products),
      ServiceType: this.normalizeManifestServiceType(
        options.serviceTypeOverride,
        order?.provider_service,
        order?.service_type,
        order?.shipping_mode,
        this.manifestServiceType,
      ),
      DropDetails: {
        Addresses: [dropAddress],
        ContactDetails: [this.buildManifestContact(order?.buyer_phone || order?.consignee?.phone, true)],
        IsGenSecurityCode: null,
        SecurityCode: null,
        IsGeoFencingEnabled: null,
        Latitude: null,
        Longitude: null,
        MaxThresholdRadius: null,
        MidPoint: null,
        MinThresholdRadius: null,
        RediusLocation: null,
      },
      PickupDetails: {
        Addresses: [pickupAddress],
        ContactDetails: [this.buildManifestContact(pickupDetails.phone)],
        PickupVendorCode: pickupVendorCode,
        IsGenSecurityCode: null,
        SecurityCode: null,
        IsGeoFencingEnabled: null,
        Latitude: null,
        Longitude: null,
        MaxThresholdRadius: null,
        MidPoint: null,
        MinThresholdRadius: null,
        RediusLocation: null,
      },
      RTODetails: {
        Addresses: [rtoAddress],
        ContactDetails: [this.buildManifestContact(rtoSource.phone || pickupDetails.phone)],
      },
      Instruction: this.manifestString(order?.instruction, firstProduct?.name).slice(0, 1000),
      CustomerPromiseDate: this.manifestDate(order?.edd || order?.customer_promise_date),
      IsCommercialProperty: null,
      IsDGShipmentType: null,
      IsOpenDelivery: null,
      IsSameDayDelivery: null,
      ManifestID: this.manifestString(order?.manifest_id, orderNo).slice(0, 50),
      MultiShipmentGroupID: this.manifestString(order?.multi_shipment_group_id) || null,
      SenderName: this.manifestString(order?.sender_name).slice(0, 20) || null,
      IsEssential: 'false',
      IsSecondaryPacking: 'false',
      PackageDetails: {
        Dimensions: {
          Height: String(height),
          Length: String(length),
          Width: String(width),
        },
        Weight: {
          BillableWeight: billableWeight,
          PhyWeight: physicalWeight,
          VolWeight: volumetricWeight,
        },
      },
    }

    if (shouldIncludeGst) {
      payload.GSTMultiSellerInfo = [
        {
          BuyerGSTRegNumber: this.manifestString(order?.buyer_gst_number) || null,
          EBNExpiryDate: null,
          EWayBillSrNumber: this.manifestString(order?.eway_bill_number) || null,
          InvoiceDate: invoiceDate,
          InvoiceNumber: this.manifestString(order?.invoice_number, orderNo),
          InvoiceValue: declaredValue,
          IsSellerRegUnderGST: this.manifestString(order?.seller_gst_number) ? 'Yes' : 'No',
          ProductUniqueID: this.manifestString(firstProduct?.sku) || null,
          SellerAddress: this.manifestString(pickupAddress.Address),
          SellerGSTRegNumber: this.manifestString(order?.seller_gst_number) || null,
          SellerName: this.manifestString(pickupAddress.Name),
          SellerPincode: this.manifestString(pickupAddress.PinCode),
          SupplySellerStatePlace: this.manifestString(pickupAddress.State),
          HSNDetails: [
            {
              ProductCategory: this.manifestString(firstProduct?.category, 'General'),
              ProductDesc: this.manifestString(firstProduct?.name, 'Product'),
              CGSTAmount: null,
              Discount: firstProduct?.discount ?? null,
              GSTTAXRateIGSTN: null,
              GSTTaxRateCGSTN: null,
              GSTTaxRateSGSTN: null,
              GSTTaxTotal: null,
              HSNCode: this.manifestString(firstProduct?.hsnCode, firstProduct?.hsn_code, firstProduct?.hsn, '0000'),
              IGSTAmount: null,
              ProductQuantity: this.manifestString(firstProduct?.qty, firstProduct?.quantity, '1'),
              SGSTAmount: null,
              TaxableValue: Number(firstProduct?.price ?? order?.order_amount ?? 0) || 0,
            },
          ],
        },
      ]
    }

    return payload
  }

  private getManifestResponseCode(response: any): string {
    return String(response?.ReturnCode ?? response?.returnCode ?? response?.code ?? '').trim()
  }

  private getManifestResponseMessage(response: any): string {
    return String(
      response?.ReturnMessage ??
        response?.returnMessage ??
        response?.message ??
        response?.Message ??
        response?.error ??
        '',
    ).trim()
  }

  private isPreShipManifestAccepted(response: any): boolean {
    const code = this.getManifestResponseCode(response)
    const message = this.getManifestResponseMessage(response).toLowerCase()
    return (
      code === '100' ||
      response?.status === true ||
      response?.success === true ||
      message === 'successful' ||
      message === 'successfull' ||
      message === 'success'
    )
  }

  private isPreShipManifestServiceabilityRejection(response: any): boolean {
    const message = this.getManifestResponseMessage(response).toLowerCase()
    if (!message) return false
    return (
      message.includes('drop pincode not serviceable') ||
      message.includes('destination pincode') ||
      message.includes('not serviceable')
    )
  }

  private getPreShipManifestFallbackServiceType(primaryServiceType: string): string {
    const configuredFallback = this.normalizeManifestServiceType(this.manifestServiceType, 'SD')
    return configuredFallback && configuredFallback !== primaryServiceType ? configuredFallback : ''
  }

  private withManifestFallbackMeta(
    response: any,
    details: {
      primaryServiceType: string
      fallbackServiceType: string
      firstResponse: any
    },
  ) {
    if (!response || typeof response !== 'object' || Array.isArray(response)) return response
    return {
      ...response,
      kourier_boyz_manifest_retry: {
        reason: 'service_type_not_serviceable',
        original_service_type: details.primaryServiceType,
        fallback_service_type: details.fallbackServiceType,
        original_return_code: this.getManifestResponseCode(details.firstResponse),
        original_return_message: this.getManifestResponseMessage(details.firstResponse),
      },
    }
  }

  async generateManifest(awbs: any[]) {
    const items = Array.isArray(awbs) ? awbs : []
    const hasOrderPayloads = items.some((item) => item && typeof item === 'object')

    if (hasOrderPayloads) {
      const pathCandidates = this.getConfiguredPathCandidates('XPRESSBEES_MANIFEST_ENDPOINTS', [
        'https://apishipmentmanifestation.xbees.in/shipmentmanifestation/forward',
        'http://api.staging.shipmentmanifestation.xbees.in/shipmentmanifestation/forward',
        `${this.shipmentEndpoint || '/api/shipments2'}/manifest`,
      ])
      const preShipCandidates = pathCandidates.filter((path) =>
        /shipmentmanifestation\/forward/i.test(String(path || '')),
      )
      const legacyCandidates = pathCandidates.filter(
        (path) => !/shipmentmanifestation\/forward/i.test(String(path || '')),
      )

      if (preShipCandidates.length) {
        const results = []
        for (const item of items) {
          const payload = this.buildPreShipManifestPayload(item)
          const primaryResponse = await this.requestWithFallback<any>({
            method: 'post',
            pathCandidates: preShipCandidates,
            data: payload,
            headers: this.buildVersionHeaders(this.trackingVersion),
          })
          const primaryServiceType = String(payload.ServiceType || '').trim()
          const fallbackServiceType =
            this.getPreShipManifestFallbackServiceType(primaryServiceType)

          if (
            fallbackServiceType &&
            !this.isPreShipManifestAccepted(primaryResponse) &&
            this.isPreShipManifestServiceabilityRejection(primaryResponse)
          ) {
            const fallbackPayload = this.buildPreShipManifestPayload(item, {
              serviceTypeOverride: fallbackServiceType,
            })

            this.log('Retrying pre-ship manifestation with configured service type', {
              awb: payload.AirWayBillNO,
              order_number: payload.OrderNo,
              primaryServiceType,
              fallbackServiceType,
              firstResponse: this.sanitizeForLogs(primaryResponse),
            })

            const fallbackResponse = await this.requestWithFallback<any>({
              method: 'post',
              pathCandidates: preShipCandidates,
              data: fallbackPayload,
              headers: this.buildVersionHeaders(this.trackingVersion),
            })
            results.push(
              this.withManifestFallbackMeta(fallbackResponse, {
                primaryServiceType,
                fallbackServiceType,
                firstResponse: primaryResponse,
              }),
            )
            continue
          }

          results.push(primaryResponse)
        }
        return results.length === 1 ? results[0] : results
      }

      const legacyAwbs = items
        .map((item) => this.manifestString(item?.awb_number, item?.AirWayBillNO, item?.awb))
        .filter(Boolean)
      return this.requestWithFallback<any>({
        method: 'post',
        pathCandidates: legacyCandidates.length
          ? legacyCandidates
          : [`${this.shipmentEndpoint || '/api/shipments2'}/manifest`],
        data: { awbs: legacyAwbs },
        exactBaseCandidates: this.getShipmentBaseCandidates(),
      })
    }

    const legacyManifestCandidates = this.getConfiguredPathCandidates('XPRESSBEES_MANIFEST_ENDPOINTS', [
      'https://apishipmentmanifestation.xbees.in/shipmentmanifestation/forward',
      'http://api.staging.shipmentmanifestation.xbees.in/shipmentmanifestation/forward',
      `${this.shipmentEndpoint || '/api/shipments2'}/manifest`,
    ]).filter((path) => !/shipmentmanifestation\/forward/i.test(String(path || '')))

    return this.requestWithFallback<any>({
      method: 'post',
      pathCandidates: legacyManifestCandidates.length
        ? legacyManifestCandidates
        : [`${this.shipmentEndpoint || '/api/shipments2'}/manifest`],
      data: { awbs: items },
      exactBaseCandidates: this.getShipmentBaseCandidates(),
    })
  }

  private buildXpressbeesForwardCancellationPayload(awb: string, remarks?: string) {
    const shippingId = String(awb || '').trim()
    const cancellationReason = String(
      remarks || process.env.XPRESSBEES_CANCEL_REMARKS || 'Cancelled By Customer',
    ).trim()
    return {
      ShippingID: shippingId,
      CancellationReason: cancellationReason,
    }
  }

  private isXpressbeesCancellationAccepted(response: any): boolean {
    const code = String(response?.ReturnCode ?? response?.returnCode ?? response?.code ?? '').trim()
    const message = String(
      response?.ReturnMessage ??
        response?.returnMessage ??
        response?.message ??
        response?.Message ??
        '',
    )
      .trim()
      .toLowerCase()

    return (
      code === '100' ||
      response?.success === true ||
      response?.Success === true ||
      response?.status === true ||
      String(response?.status || '').trim().toLowerCase() === 'success' ||
      message.includes('shipment updated successfully') ||
      message.includes('successful') ||
      message.includes('cancelled') ||
      message.includes('canceled') ||
      message.includes('cancellation accepted') ||
      message.includes('cancellation request accepted')
    )
  }

  private isXpressbeesCancellationMissingShipment(response: any): boolean {
    const message = String(
      response?.ReturnMessage ??
        response?.returnMessage ??
        response?.message ??
        response?.Message ??
        '',
    )
      .trim()
      .toLowerCase()

    return (
      message.includes('shipment not exist') ||
      message.includes('shipment does not exist') ||
      message.includes('shipment not found')
    )
  }

  async cancelShipment(awb: string) {
    const normalizedAwb = String(awb || '').trim()
    if (!normalizedAwb) {
      throw new HttpError(400, 'Xpressbees AWB number is required for cancellation')
    }

    const pathCandidates = this.getConfiguredPathCandidates('XPRESSBEES_CANCEL_ENDPOINTS', [
      'https://clientshipupdatesapi.xbees.in/forwardcancellation',
      'http://stageclientshipupdatesapi.xbees.in/forwardcancellation',
      `${this.shipmentEndpoint || '/api/shipments2'}/cancel`,
    ])
    const forwardCancellationCandidates = pathCandidates.filter((path) =>
      /forwardcancellation/i.test(String(path || '')),
    )
    const legacyCandidates = pathCandidates.filter(
      (path) => !/forwardcancellation/i.test(String(path || '')),
    )

    if (forwardCancellationCandidates.length) {
      try {
        const forwardResponse = await this.requestWithFallback<any>({
          method: 'post',
          pathCandidates: forwardCancellationCandidates,
          data: this.buildXpressbeesForwardCancellationPayload(normalizedAwb),
        })
        if (this.isXpressbeesCancellationMissingShipment(forwardResponse)) {
          return {
            success: true,
            localOnly: true,
            provider: 'xpressbees',
            awb: normalizedAwb,
            message: 'Shipment does not exist on Xpressbees; cancelled locally.',
            provider_response: forwardResponse,
          }
        }
        if (this.isXpressbeesCancellationAccepted(forwardResponse) || !legacyCandidates.length) {
          return forwardResponse
        }
        this.log('Forward cancellation response was not accepted, trying legacy cancel endpoint', {
          awb: normalizedAwb,
          response: this.sanitizeForLogs(forwardResponse),
        })
      } catch (err: any) {
        if (!legacyCandidates.length || this.isBusinessValidationError(err)) {
          throw err
        }
        this.log('Forward cancellation failed, trying legacy cancel endpoint', {
          awb: normalizedAwb,
          message: this.extractErrorMessage(err, 'forward cancellation failed'),
        })
      }
    }

    return this.requestWithFallback<any>({
      method: 'post',
      pathCandidates: legacyCandidates.length
        ? legacyCandidates
        : [`${this.shipmentEndpoint || '/api/shipments2'}/cancel`],
      data: { awb: normalizedAwb },
      exactBaseCandidates: this.getShipmentBaseCandidates(),
    })
  }

  async trackShipment(awb: string) {
    const encodedAwb = encodeURIComponent(String(awb || '').trim())
    if (!encodedAwb) {
      throw new HttpError(400, 'Xpressbees AWB number is required for tracking')
    }

    const configuredTrackPathCandidates = this.getConfiguredPathCandidates('XPRESSBEES_TRACK_ENDPOINTS', [
      'https://apishipmenttracking.xbees.in/GetShipmentAuditLog',
      'http://api.staging.shipmenttracking.xbees.in/GetShipmentAuditLog',
      'https://apishipmenttracking.xbees.in/GetCurrentShipmentStatus',
      'http://api.staging.shipmenttracking.xbees.in/GetCurrentShipmentStatus',
      `${this.shipmentEndpoint || '/api/shipments2'}/track/{awb}`,
      '/api/shipments2/track/{awb}',
      '/shipments2/track/{awb}',
    ])

    if (
      configuredTrackPathCandidates.some((path) =>
        /GetShipmentAuditLog|GetCurrentShipmentStatus/i.test(String(path || '')),
      )
    ) {
      return this.requestWithFallback<any>({
        method: 'post',
        pathCandidates: configuredTrackPathCandidates,
        data: { AWBNumber: String(awb || '').trim() },
        headers: this.buildVersionHeaders(this.trackingVersion),
      })
    }

    const trackPathCandidates = configuredTrackPathCandidates.map((path) => {
      const trimmed = String(path || '').trim()
      if (/\{awb\}/i.test(trimmed)) {
        return trimmed.replace(/\{awb\}/gi, encodedAwb)
      }
      return `${trimmed.replace(/\/+$/, '')}/${encodedAwb}`
    })

    return this.requestWithFallback<any>({
      method: 'get',
      pathCandidates: trackPathCandidates,
      exactBaseCandidates: this.getShipmentBaseCandidates(),
    })
  }

  async trackCurrentShipment(awb: string) {
    const normalizedAwb = String(awb || '').trim()
    if (!normalizedAwb) {
      throw new HttpError(400, 'Xpressbees AWB number is required for current tracking')
    }

    return this.requestWithFallback<any>({
      method: 'post',
      pathCandidates: this.getConfiguredPathCandidates('XPRESSBEES_CURRENT_TRACK_ENDPOINTS', [
        'https://apishipmenttracking.xbees.in/GetCurrentShipmentStatus',
        'http://api.staging.shipmenttracking.xbees.in/GetCurrentShipmentStatus',
      ]),
      data: { AWBNumber: normalizedAwb },
      headers: this.buildVersionHeaders(this.trackingVersion),
    })
  }
}
