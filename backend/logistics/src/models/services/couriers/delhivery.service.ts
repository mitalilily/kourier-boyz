import axios, { type AxiosRequestConfig } from 'axios'
import { randomUUID } from 'crypto'
import { extname } from 'path'
import { eq } from 'drizzle-orm'
import qs from 'qs'
import { DelhiveryManifestError, HttpError } from '../../../utils/classes'
import {
  normalizeCourierId,
  resolveDelhiveryShippingMode,
} from '../../../utils/delhiveryCourier'
import { db } from '../../client'
import { getDelhiveryCredentials } from '../delhiveryCredentials.service'
import { courier_credentials } from '../../schema/courierCredentials'
import { ShipmentParams } from '../shiprocket.service'

const parseTimeout = (value: string | undefined, fallbackMs: number) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackMs
}

const extractProviderErrorMessage = (value: unknown): string | null => {
  if (!value) return null

  if (typeof value === 'string') {
    const normalized = value.trim()
    return normalized.length > 0 ? normalized : null
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const message = extractProviderErrorMessage(entry)
      if (message) return message
    }
    return null
  }

  if (typeof value === 'object') {
    for (const nestedValue of Object.values(value as Record<string, unknown>)) {
      const message = extractProviderErrorMessage(nestedValue)
      if (message) return message
    }
  }

  return null
}

const DELHIVERY_LTL_TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000
const DELHIVERY_LTL_TOKEN_FALLBACK_LIFETIME_MS = 24 * 60 * 60 * 1000

const maskDelhiveryLtlToken = (value: unknown) => {
  const token = String(value || '').trim()
  if (!token) return ''
  if (token.length <= 8) return '*'.repeat(token.length)
  return `${token.slice(0, 4)}${'*'.repeat(Math.max(token.length - 8, 0))}${token.slice(-4)}`
}

const normalizeDelhiveryLtlTokenCandidate = (value: unknown) =>
  String(value || '')
    .trim()
    .replace(/^Bearer\s+/i, '')

const isJwtLikeToken = (value: string) => value.split('.').length === 3

const extractDelhiveryLtlToken = (value: unknown): string => {
  if (!value) return ''

  if (typeof value === 'string') {
    const normalized = normalizeDelhiveryLtlTokenCandidate(value)
    return isJwtLikeToken(normalized) ? normalized : ''
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const token = extractDelhiveryLtlToken(entry)
      if (token) return token
    }
    return ''
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    for (const key of [
      'token',
      'jwt',
      'bearerToken',
      'accessToken',
      'access_token',
      'id_token',
      'authToken',
      'auth_token',
    ]) {
      const candidate = normalizeDelhiveryLtlTokenCandidate(record[key])
      if (isJwtLikeToken(candidate) || candidate.length > 20) return candidate
    }

    for (const nested of Object.values(record)) {
      const token = extractDelhiveryLtlToken(nested)
      if (token) return token
    }
  }

  return ''
}

const decodeJwtExpiryIso = (token: string): string => {
  try {
    const [, payloadSegment] = String(token || '').split('.')
    if (!payloadSegment) return ''
    const normalized = payloadSegment.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
    const payloadText = Buffer.from(padded, 'base64').toString('utf8')
    const payload = JSON.parse(payloadText) as { exp?: number }
    if (!payload?.exp || !Number.isFinite(payload.exp)) return ''
    return new Date(payload.exp * 1000).toISOString()
  } catch {
    return ''
  }
}

const resolveDelhiveryLtlExpiryIso = (token: string, value: unknown): string => {
  if (typeof value === 'object' && value && !Array.isArray(value)) {
    const record = value as Record<string, unknown>
    for (const key of ['expiresAt', 'expires_at', 'expiry', 'expiryAt', 'tokenExpiry']) {
      const rawValue = String(record[key] || '').trim()
      const parsed = Date.parse(rawValue)
      if (rawValue && Number.isFinite(parsed)) return new Date(parsed).toISOString()
    }
  }

  const tokenExpiry = decodeJwtExpiryIso(token)
  if (tokenExpiry) return tokenExpiry

  return new Date(Date.now() + DELHIVERY_LTL_TOKEN_FALLBACK_LIFETIME_MS).toISOString()
}

const extractNumericValueByKeys = (value: unknown, keys: string[]): number | null => {
  if (!value) return null

  if (Array.isArray(value)) {
    for (const entry of value) {
      const result = extractNumericValueByKeys(entry, keys)
      if (result !== null) return result
    }
    return null
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    for (const key of keys) {
      const candidate = Number(record[key])
      if (Number.isFinite(candidate)) return candidate
    }

    for (const nested of Object.values(record)) {
      const result = extractNumericValueByKeys(nested, keys)
      if (result !== null) return result
    }
  }

  return null
}

const normalizeDelhiveryLtlLrns = (value: string | string[]) => {
  const rawItems = Array.isArray(value) ? value : String(value || '').split(',')
  const uniqueItems = Array.from(
    new Set(
      rawItems
        .map((entry) => String(entry || '').trim())
        .filter(Boolean),
    ),
  )

  return uniqueItems.slice(0, 25)
}

const normalizeDelhiveryLtlWarehousePayload = (value: unknown) => {
  const payload = value && typeof value === 'object' && !Array.isArray(value) ? { ...(value as Record<string, unknown>) } : {}
  const businessHours = payload.business_hours ?? payload.buisness_hours
  const businessDays = payload.business_days ?? payload.buisness_days

  return {
    ...payload,
    ...(businessHours !== undefined ? { business_hours: businessHours } : {}),
    ...(businessDays !== undefined ? { business_days: businessDays } : {}),
  }
}

const normalizeDelhiveryLtlWarehouseUpdatePayload = (value: unknown) => {
  const payload =
    value && typeof value === 'object' && !Array.isArray(value)
      ? { ...(value as Record<string, unknown>) }
      : {}
  const rawUpdateDict = payload.update_dict
  const updateDict =
    rawUpdateDict && typeof rawUpdateDict === 'object' && !Array.isArray(rawUpdateDict)
      ? { ...(rawUpdateDict as Record<string, unknown>) }
      : {}
  const businessHours = updateDict.business_hours ?? updateDict.buisness_hours

  return {
    ...payload,
    update_dict: {
      ...updateDict,
      ...(businessHours !== undefined ? { business_hours: businessHours } : {}),
    },
  }
}

const extractStringValueByKeys = (value: unknown, keys: string[]): string | null => {
  const normalizedKeys = new Set(keys.map((key) => key.toLowerCase()))

  const collectFirstString = (input: unknown): string | null => {
    const nestedSeen = new WeakSet<object>()

    const visitMatchedValue = (candidateInput: unknown): string | null => {
      if (candidateInput === null || candidateInput === undefined) return null

      if (typeof candidateInput === 'string' || typeof candidateInput === 'number') {
        const normalized = String(candidateInput).trim()
        return normalized || null
      }

      if (Array.isArray(candidateInput)) {
        for (const entry of candidateInput) {
          const candidate = visitMatchedValue(entry)
          if (candidate) return candidate
        }
        return null
      }

      if (typeof candidateInput === 'object') {
        const objectInput = candidateInput as object
        if (nestedSeen.has(objectInput)) return null
        nestedSeen.add(objectInput)

        for (const nested of Object.values(candidateInput as Record<string, unknown>)) {
          const candidate = visitMatchedValue(nested)
          if (candidate) return candidate
        }
      }

      return null
    }

    return visitMatchedValue(input)
  }

  const seen = new WeakSet<object>()

  const visit = (input: unknown): string | null => {
    if (input === null || input === undefined) return null

    if (Array.isArray(input)) {
      for (const entry of input) {
        const result = visit(entry)
        if (result) return result
      }
      return null
    }

    if (typeof input !== 'object') return null

    const objectInput = input as object
    if (seen.has(objectInput)) return null
    seen.add(objectInput)

    const record = input as Record<string, unknown>
    for (const [key, candidateValue] of Object.entries(record)) {
      if (!normalizedKeys.has(key.toLowerCase())) continue
      const candidate = collectFirstString(candidateValue)
      if (candidate) return candidate
    }

    for (const nested of Object.values(record)) {
      if (!nested || (typeof nested !== 'object' && !Array.isArray(nested))) continue
      const result = visit(nested)
      if (result) return result
    }

    return null
  }

  return visit(value)
}

const extractStringListByKeys = (value: unknown, keys: string[]): string[] => {
  const collected = new Set<string>()
  const normalizedKeys = new Set(keys.map((key) => key.toLowerCase()))

  const collectStrings = (input: unknown) => {
    const nestedSeen = new WeakSet<object>()

    const visitMatchedValue = (candidateInput: unknown) => {
      if (candidateInput === null || candidateInput === undefined) return

      if (typeof candidateInput === 'string' || typeof candidateInput === 'number') {
        const normalized = String(candidateInput).trim()
        if (normalized) collected.add(normalized)
        return
      }

      if (Array.isArray(candidateInput)) {
        candidateInput.forEach(visitMatchedValue)
        return
      }

      if (typeof candidateInput === 'object') {
        const objectInput = candidateInput as object
        if (nestedSeen.has(objectInput)) return
        nestedSeen.add(objectInput)
        Object.values(candidateInput as Record<string, unknown>).forEach(visitMatchedValue)
      }
    }

    visitMatchedValue(input)
  }

  const seen = new WeakSet<object>()

  const visit = (input: unknown) => {
    if (input === null || input === undefined) return

    if (Array.isArray(input)) {
      input.forEach(visit)
      return
    }

    if (typeof input !== 'object') return

    const objectInput = input as object
    if (seen.has(objectInput)) return
    seen.add(objectInput)

    const record = input as Record<string, unknown>
    for (const [key, candidateValue] of Object.entries(record)) {
      if (!normalizedKeys.has(key.toLowerCase())) continue
      collectStrings(candidateValue)
    }

    Object.values(record).forEach((nested) => {
      if (!nested || (typeof nested !== 'object' && !Array.isArray(nested))) return
      visit(nested)
    })
  }

  visit(value)
  return Array.from(collected)
}

const isLikelyBase64LabelPayload = (value: string) => {
  const normalized = value.trim()
  if (!normalized) return false
  if (/^data:image\/[a-z0-9.+-]+;base64,/i.test(normalized)) return true

  const compact = normalized.replace(/\s+/g, '')
  return compact.length >= 80 && /^[A-Za-z0-9+/=]+$/.test(compact)
}

const extractDelhiveryLtlLabelPayloads = (value: unknown): string[] => {
  const candidates = extractStringListByKeys(value, [
    'url',
    'urls',
    'link',
    'links',
    'label_url',
    'label_urls',
    'label',
    'labels',
    'stream',
    'streams',
    'base64',
    'image',
    'images',
    'data',
  ])

  const payloads = Array.from(
    new Set(
      candidates
        .map((entry) => String(entry || '').trim())
        .filter(
          (entry) =>
            /^https?:\/\//i.test(entry) ||
            entry.includes('base64,') ||
            isLikelyBase64LabelPayload(entry),
        ),
    ),
  )

  const boxLabelPayloads = payloads.filter((entry) => /[?&]box_index=\d+/i.test(entry))
  return boxLabelPayloads.length ? boxLabelPayloads : payloads
}

const DELHIVERY_LTL_LR_COPY_TYPES = [
  'SHIPPER COPY',
  'ORIGIN ACCOUNTS COPY',
  'REGULATORY COPY',
  'LM POD',
  'RECIPIENT COPY',
]

const normalizeDelhiveryLtlLrCopyTypes = (value: unknown): string[] => {
  const rawItems = Array.isArray(value) ? value : String(value || '').split(',')
  const allowedValues = new Set(DELHIVERY_LTL_LR_COPY_TYPES)

  return Array.from(
    new Set(
      rawItems
        .map((entry) => String(entry || '').trim().toUpperCase())
        .filter((entry) => entry && allowedValues.has(entry)),
    ),
  )
}

const extractDelhiveryLtlDocumentLinks = (value: unknown): string[] => {
  const candidates = extractStringListByKeys(value, [
    'url',
    'urls',
    'link',
    'links',
    'pdf_url',
    'pdf_urls',
    'file_url',
    'file_urls',
    'download_url',
    'download_urls',
    'document_url',
    'document_urls',
    's3_url',
    's3_urls',
  ])

  return Array.from(
    new Set(
      candidates
        .map((entry) => String(entry || '').trim())
        .filter((entry) => /^https?:\/\//i.test(entry)),
    ),
  )
}

const normalizeBooleanLikeValue = (value: unknown): boolean | null => {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (value === 1) return true
    if (value === 0) return false
  }

  const normalized = String(value || '')
    .trim()
    .toLowerCase()
  if (!normalized) return null
  if (['true', '1', 'yes', 'y'].includes(normalized)) return true
  if (['false', '0', 'no', 'n'].includes(normalized)) return false
  return null
}

const appendMultipartField = (form: FormData, key: string, value: unknown) => {
  if (value === undefined || value === null) return

  if (typeof value === 'string') {
    const normalized = value.trim()
    if (normalized) form.append(key, normalized)
    return
  }

  if (typeof value === 'number') {
    if (Number.isFinite(value)) form.append(key, String(value))
    return
  }

  if (typeof value === 'boolean') {
    form.append(key, value ? 'true' : 'false')
    return
  }

  form.append(key, toDelhiveryLiteralString(value))
}

const escapeDelhiveryLiteralString = (value: string) =>
  value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")

const toDelhiveryLiteralString = (value: unknown): string => {
  if (value === null || value === undefined) return 'None'
  if (typeof value === 'boolean') return value ? 'True' : 'False'
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'None'
  if (typeof value === 'string') return `'${escapeDelhiveryLiteralString(value)}'`

  if (Array.isArray(value)) {
    return `[${value.map((entry) => toDelhiveryLiteralString(entry)).join(', ')}]`
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    const entries = Object.entries(record)
      .filter(([, nestedValue]) => nestedValue !== undefined)
      .map(
        ([nestedKey, nestedValue]) =>
          `'${escapeDelhiveryLiteralString(nestedKey)}': ${toDelhiveryLiteralString(nestedValue)}`,
      )
    return `{${entries.join(', ')}}`
  }

  return `'${escapeDelhiveryLiteralString(String(value))}'`
}

type NormalizedDelhiveryLtlDimension = {
  length: number
  width: number
  height: number
  box_count: number
}

const normalizeDelhiveryLtlDimensions = (
  value: unknown,
): NormalizedDelhiveryLtlDimension[] => {
  if (!Array.isArray(value)) return []

  return value
    .map((entry) => {
      const record =
        entry && typeof entry === 'object' && !Array.isArray(entry)
          ? (entry as Record<string, unknown>)
          : {}
      const length = Number(record.length ?? record.length_cm)
      const width = Number(record.width ?? record.width_cm ?? record.breadth ?? record.breadth_cm)
      const height = Number(record.height ?? record.height_cm)
      const boxCount = Math.max(
        1,
        Number(record.box_count ?? record.boxCount ?? record.quantity ?? 1),
      )

      return {
        length,
        width,
        height,
        box_count: boxCount,
      }
    })
    .filter(
      (dimension) =>
        Number.isFinite(dimension.length) &&
        dimension.length > 0 &&
        Number.isFinite(dimension.width) &&
        dimension.width > 0 &&
        Number.isFinite(dimension.height) &&
        dimension.height > 0 &&
        Number.isFinite(dimension.box_count) &&
        dimension.box_count > 0,
    )
}

const isTimeoutError = (err: any) => {
  const message = String(err?.message || '')
    .trim()
    .toLowerCase()

  return (
    err?.code === 'ECONNABORTED' ||
    err?.code === 'ETIMEDOUT' ||
    message.includes('timeout') ||
    message.includes('timed out')
  )
}

const getExistingPickupRequestId = (message: unknown): string | null => {
  const normalized = String(message || '').trim()
  if (!normalized) return null

  const lower = normalized.toLowerCase()
  if (!lower.includes('pickup request') || !lower.includes('already exist')) {
    return null
  }

  return normalized.match(/pickup request\s+(\d+)/i)?.[1] || null
}

const normalizeDelhiveryWeightGrams = (value: unknown, fallbackGrams = 500) => {
  const numericValue = Number(value ?? 0)
  if (!Number.isFinite(numericValue) || numericValue <= 0) return fallbackGrams

  // Kourier Boyz stores B2C weights in grams; older integrations may still send kg.
  return numericValue > 50 ? Math.round(numericValue) : Math.round(numericValue * 1000)
}

const delhiveryCancellationResponseText = (value: unknown) => {
  try {
    return JSON.stringify(value || {}).toLowerCase()
  } catch {
    return String(value || '').toLowerCase()
  }
}

const isDelhiveryAlreadyCancelledResponse = (value: unknown) => {
  const responseText = delhiveryCancellationResponseText(value)
  return responseText.includes('already cancelled') || responseText.includes('already canceled')
}

const getDelhiveryCancellationMessage = (value: unknown): string | null => {
  if (!value) return null

  if (typeof value === 'string') {
    const normalized = value.trim()
    return normalized ? normalized : null
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const message = getDelhiveryCancellationMessage(entry)
      if (message) return message
    }
    return null
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    for (const key of ['message', 'remark', 'remarks', 'responseMsg', 'ReturnMessage']) {
      const direct = record[key]
      if (typeof direct === 'string' && direct.trim()) return direct.trim()
    }

    for (const key of ['packages', 'package', 'response', 'data']) {
      const nested = record[key]
      if (nested) {
        const message = getDelhiveryCancellationMessage(nested)
        if (message) return message
      }
    }
  }

  return null
}

export const isDelhiveryCancellationAccepted = (value: unknown) => {
  const result = value as any
  const responseText = delhiveryCancellationResponseText(value)
  const numericStatus = Number(result?.status ?? result?.responseCode ?? result?.code)
  const alreadyCancelled = isDelhiveryAlreadyCancelledResponse(value)
  const acceptedText =
    responseText.includes('cancelled') ||
    responseText.includes('canceled') ||
    responseText.includes('cancellation initiated') ||
    responseText.includes('cancellation accepted') ||
    responseText.includes('cancellation request accepted') ||
    responseText.includes('marked for cancellation')
  const rejectedText =
    responseText.includes('not accepted') ||
    responseText.includes('not found') ||
    responseText.includes('invalid') ||
    responseText.includes('failed') ||
    responseText.includes('failure') ||
    responseText.includes('error')

  return (
    alreadyCancelled ||
    result?.success === true ||
    result?.Success === true ||
    result?.status === true ||
    String(result?.status || '').toLowerCase() === 'success' ||
    String(result?.Status || '').toLowerCase() === 'success' ||
    (Number.isFinite(numericStatus) && numericStatus >= 200 && numericStatus < 300) ||
    result?.response?.status === true ||
    (acceptedText && !rejectedText)
  )
}

export class DelhiveryService {
  private apiBase = 'https://track.delhivery.com'
  private token = ''
  private clientName = ''
  private ltlApiBase = 'https://ltl-clients-api.delhivery.com'
  private ltlUsername = ''
  private ltlPassword = ''
  private ltlToken = ''
  private ltlTokenExpiresAt = ''
  private readonly requestTimeoutMs = parseTimeout(process.env.DELHIVERY_REQUEST_TIMEOUT_MS, 30000)
  private readonly labelTimeoutMs = parseTimeout(process.env.DELHIVERY_LABEL_TIMEOUT_MS, 15000)

  private async ensureCredentials() {
    const credentials = await getDelhiveryCredentials()
    this.apiBase = credentials.apiBase
    this.token = credentials.apiKey
    this.clientName = credentials.clientName
    this.ltlApiBase = credentials.ltlApiBase
    this.ltlUsername = credentials.ltlUsername
    this.ltlPassword = credentials.ltlPassword
    this.ltlToken = credentials.ltlToken
    this.ltlTokenExpiresAt = credentials.ltlTokenExpiresAt
  }

  private get headers() {
    return {
      Authorization: `Token ${this.token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    }
  }

  private async postFormEncoded(path: string, payload: unknown) {
    await this.ensureCredentials()
    const encodedData = qs.stringify({
      format: 'json',
      data: JSON.stringify(payload),
    })

    return axios.post(`${this.apiBase}${path}`, encodedData, {
      headers: {
        Authorization: `Token ${this.token}`,
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      timeout: this.requestTimeoutMs,
    })
  }

  private async getWithTimeout(url: string, config: AxiosRequestConfig = {}, timeoutMs?: number) {
    return axios.get(url, {
      ...config,
      timeout: timeoutMs ?? this.requestTimeoutMs,
    })
  }

  private async postWithTimeout(
    url: string,
    data: unknown,
    config: AxiosRequestConfig = {},
    timeoutMs?: number,
  ) {
    return axios.post(url, data, {
      ...config,
      timeout: timeoutMs ?? this.requestTimeoutMs,
    })
  }

  private async patchWithTimeout(
    url: string,
    data: unknown,
    config: AxiosRequestConfig = {},
    timeoutMs?: number,
  ) {
    return axios.patch(url, data, {
      ...config,
      timeout: timeoutMs ?? this.requestTimeoutMs,
    })
  }

  private async putWithTimeout(
    url: string,
    data: unknown,
    config: AxiosRequestConfig = {},
    timeoutMs?: number,
  ) {
    return axios.put(url, data, {
      ...config,
      timeout: timeoutMs ?? this.requestTimeoutMs,
    })
  }

  private isStoredLtlTokenFresh() {
    const normalizedToken = String(this.ltlToken || '').trim()
    const expiresAtMs = Date.parse(String(this.ltlTokenExpiresAt || '').trim())

    return Boolean(
      normalizedToken &&
        Number.isFinite(expiresAtMs) &&
        expiresAtMs - Date.now() > DELHIVERY_LTL_TOKEN_REFRESH_BUFFER_MS,
    )
  }

  private async persistLtlMetadata(updates: Record<string, unknown>) {
    const [existing] = await db
      .select({ id: courier_credentials.id, metadata: courier_credentials.metadata })
      .from(courier_credentials)
      .where(eq(courier_credentials.provider, 'delhivery'))
      .limit(1)

    const existingMetadata =
      existing?.metadata && typeof existing.metadata === 'object' ? existing.metadata : {}
    const nextMetadata = {
      ...existingMetadata,
      ...updates,
    }

    if (existing?.id) {
      await db
        .update(courier_credentials)
        .set({
          metadata: nextMetadata,
          updatedAt: new Date(),
        })
        .where(eq(courier_credentials.provider, 'delhivery'))
      return
    }

    await db.insert(courier_credentials).values({
      provider: 'delhivery',
      apiBase: this.apiBase,
      clientName: this.clientName,
      apiKey: this.token,
      metadata: nextMetadata,
    })
  }

  private async clearLtlSessionMetadata() {
    await this.persistLtlMetadata({
      ltlToken: '',
      ltlTokenExpiresAt: '',
      ltlTokenUpdatedAt: '',
    })
    this.ltlToken = ''
    this.ltlTokenExpiresAt = ''
  }

  async requestLtlPasswordReset(username?: string) {
    await this.ensureCredentials()

    const normalizedUsername = String(username || this.ltlUsername || '').trim()
    if (!normalizedUsername) {
      throw new HttpError(
        400,
        'Delhivery LTL username is required before triggering password reset.',
      )
    }

    try {
      const endpoint = `${this.ltlApiBase.replace(/\/+$/, '')}/forgot-password`
      const response = await this.postWithTimeout(
        endpoint,
        { username: normalizedUsername },
        {
          headers: {
            Connection: 'keep-alive',
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        },
      )

      return {
        success: true,
        username: normalizedUsername,
        endpoint,
        provider_response: response.data,
      }
    } catch (err: any) {
      const providerMessage =
        extractProviderErrorMessage(err.response?.data) ||
        err.response?.data?.message ||
        err.message ||
        'Delhivery LTL password reset failed'
      throw new HttpError(err.response?.status || 500, providerMessage)
    }
  }

  async loginLtlAccount(username?: string, password?: string) {
    await this.ensureCredentials()

    const normalizedUsername = String(username || this.ltlUsername || '').trim()
    const normalizedPassword = String(password || this.ltlPassword || '').trim()

    if (!normalizedUsername) {
      throw new HttpError(400, 'Delhivery LTL username is required before login.')
    }

    if (!normalizedPassword) {
      throw new HttpError(400, 'Delhivery LTL password is required before login.')
    }

    try {
      const endpoint = `${this.ltlApiBase.replace(/\/+$/, '')}/ums/login`
      const response = await this.postWithTimeout(
        endpoint,
        { username: normalizedUsername, password: normalizedPassword },
        {
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        },
      )

      const bearerToken = extractDelhiveryLtlToken(response.data)
      if (!bearerToken) {
        throw new HttpError(502, 'Delhivery LTL login did not return a bearer token.')
      }

      const tokenExpiresAt = resolveDelhiveryLtlExpiryIso(bearerToken, response.data)
      await this.persistLtlMetadata({
        ltlApiBase: this.ltlApiBase,
        ltlUsername: normalizedUsername,
        ...(password ? { ltlPassword: normalizedPassword } : {}),
        ltlToken: bearerToken,
        ltlTokenExpiresAt: tokenExpiresAt,
        ltlTokenUpdatedAt: new Date().toISOString(),
      })

      this.ltlUsername = normalizedUsername
      this.ltlPassword = normalizedPassword
      this.ltlToken = bearerToken
      this.ltlTokenExpiresAt = tokenExpiresAt

      return {
        success: true,
        username: normalizedUsername,
        token: bearerToken,
        tokenMasked: maskDelhiveryLtlToken(bearerToken),
        tokenExpiresAt,
        endpoint,
      }
    } catch (err: any) {
      if (err instanceof HttpError) throw err

      const providerMessage =
        extractProviderErrorMessage(err.response?.data) ||
        err.response?.data?.message ||
        err.message ||
        'Delhivery LTL login failed'
      const normalizedProviderMessage = String(providerMessage || '').trim().toLowerCase()
      if (normalizedProviderMessage.includes('user not authenticated')) {
        throw new HttpError(
          err.response?.status || 400,
          'Delhivery LTL credentials were rejected. Reset the Delhivery LTL API user password and save the new password in Courier Settings before retrying.',
        )
      }
      throw new HttpError(err.response?.status || 500, providerMessage)
    }
  }

  async getLtlBearerToken(forceRefresh = false) {
    await this.ensureCredentials()

    if (!forceRefresh && this.isStoredLtlTokenFresh()) {
      return this.ltlToken
    }

    const session = await this.loginLtlAccount()
    return session.token
  }

  async logoutLtlAccount(token?: string) {
    await this.ensureCredentials()

    const bearerToken = String(token || this.ltlToken || '').trim()
    if (!bearerToken) {
      throw new HttpError(400, 'Delhivery LTL bearer token is required before logout.')
    }

    const endpoint = `${this.ltlApiBase.replace(/\/+$/, '')}/ums/logout`

    try {
      const response = await this.getWithTimeout(endpoint, {
        headers: {
          Authorization: `Bearer ${bearerToken}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      })

      await this.clearLtlSessionMetadata()

      return {
        success: true,
        endpoint,
        tokenMasked: maskDelhiveryLtlToken(bearerToken),
        provider_response: response.data,
      }
    } catch (err: any) {
      const providerMessage =
        extractProviderErrorMessage(err.response?.data) ||
        err.response?.data?.message ||
        err.message ||
        'Delhivery LTL logout failed'

      const normalizedMessage = String(providerMessage || '').toLowerCase()
      const statusCode = err.response?.status || 500
      const shouldClearCachedToken =
        statusCode === 401 ||
        statusCode === 403 ||
        normalizedMessage.includes('invalid token') ||
        normalizedMessage.includes('token expired') ||
        normalizedMessage.includes('unauthorized')

      if (shouldClearCachedToken) {
        await this.clearLtlSessionMetadata()
      }

      throw new HttpError(statusCode, providerMessage)
    }
  }

  async checkLtlServiceability(pincode: string, weight?: number | string) {
    await this.ensureCredentials()

    const normalizedPincode = String(pincode || '').trim()
    if (!/^\d{6}$/.test(normalizedPincode)) {
      throw new HttpError(400, 'A valid 6-digit Delhivery LTL destination pincode is required.')
    }

    const queryParams = new URLSearchParams()
    const numericWeight = Number(weight)
    if (Number.isFinite(numericWeight) && numericWeight > 0) {
      queryParams.set('weight', String(numericWeight))
    }

    const bearerToken = await this.getLtlBearerToken()
    const endpoint = `${this.ltlApiBase.replace(/\/+$/, '')}/pincode-service/${normalizedPincode}${
      queryParams.toString() ? `?${queryParams.toString()}` : ''
    }`

    try {
      const response = await this.getWithTimeout(endpoint, {
        headers: {
          Authorization: `Bearer ${bearerToken}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      })

      const responseText = JSON.stringify(response.data || {}).toLowerCase()
      const serviceable =
        responseText.includes('"serviceable":true') ||
        responseText.includes('"isserviceable":true') ||
        responseText.includes('"available":true') ||
        responseText.includes('"status":"serviceable"')

      return {
        success: true,
        endpoint,
        pincode: normalizedPincode,
        weight: Number.isFinite(numericWeight) && numericWeight > 0 ? numericWeight : null,
        serviceable,
        provider_response: response.data,
      }
    } catch (err: any) {
      const providerMessage =
        extractProviderErrorMessage(err.response?.data) ||
        err.response?.data?.message ||
        err.message ||
        'Delhivery LTL serviceability check failed'

      const normalizedMessage = String(providerMessage || '').toLowerCase()
      if (
        err.response?.status === 401 ||
        err.response?.status === 403 ||
        normalizedMessage.includes('invalid token') ||
        normalizedMessage.includes('token expired') ||
        normalizedMessage.includes('unauthorized')
      ) {
        await this.clearLtlSessionMetadata()
      }

      if (normalizedMessage.includes('cod is not allowed')) {
        throw new HttpError(
          400,
          'Delhivery LTL COD is not enabled for this account. Book this shipment as prepaid or use another courier for COD.',
        )
      }

      if (normalizedMessage.includes('fop orders not allowed')) {
        throw new HttpError(
          400,
          'Delhivery LTL prepaid shipments on this account must use Freight on Delivery billing, not Freight on Pickup.',
        )
      }

      throw new HttpError(err.response?.status || 500, providerMessage)
    }
  }

  async getLtlExpectedTat(originPin: string, destinationPin: string, requestId?: string) {
    await this.ensureCredentials()

    const normalizedOriginPin = String(originPin || '').trim()
    const normalizedDestinationPin = String(destinationPin || '').trim()

    if (!/^\d{6}$/.test(normalizedOriginPin)) {
      throw new HttpError(400, 'A valid 6-digit Delhivery LTL origin pincode is required.')
    }

    if (!/^\d{6}$/.test(normalizedDestinationPin)) {
      throw new HttpError(400, 'A valid 6-digit Delhivery LTL destination pincode is required.')
    }

    const queryParams = new URLSearchParams({
      origin_pin: normalizedOriginPin,
      destination_pin: normalizedDestinationPin,
    })
    const bearerToken = await this.getLtlBearerToken()
    const normalizedRequestId = String(requestId || '').trim() || randomUUID()
    const endpoint = `${this.ltlApiBase.replace(/\/+$/, '')}/tat/estimate?${queryParams.toString()}`

    try {
      const response = await this.getWithTimeout(endpoint, {
        headers: {
          Authorization: `Bearer ${bearerToken}`,
          Accept: 'application/json',
          'X-Request-Id': normalizedRequestId,
        },
      })

      const providerResponse = response.data
      const responseText = JSON.stringify(providerResponse || {})
      const numericTatCandidates = [
        providerResponse?.tat,
        providerResponse?.data?.tat,
        providerResponse?.estimated_tat,
        providerResponse?.data?.estimated_tat,
        providerResponse?.days,
        providerResponse?.data?.days,
      ]
      const tatDays =
        numericTatCandidates
          .map((value) => Number(value))
          .find((value) => Number.isFinite(value) && value >= 0) ?? null

      return {
        success: true,
        endpoint,
        requestId: normalizedRequestId,
        originPin: normalizedOriginPin,
        destinationPin: normalizedDestinationPin,
        tatDays,
        provider_response: providerResponse,
        provider_response_text: responseText,
      }
    } catch (err: any) {
      const providerMessage =
        extractProviderErrorMessage(err.response?.data) ||
        err.response?.data?.message ||
        err.message ||
        'Delhivery LTL expected TAT lookup failed'

      const normalizedMessage = String(providerMessage || '').toLowerCase()
      if (
        err.response?.status === 401 ||
        err.response?.status === 403 ||
        normalizedMessage.includes('invalid token') ||
        normalizedMessage.includes('token expired') ||
        normalizedMessage.includes('unauthorized')
      ) {
        await this.clearLtlSessionMetadata()
      }

      throw new HttpError(err.response?.status || 500, providerMessage)
    }
  }

  async estimateLtlFreight(payload: {
    dimensions: Array<{
      length_cm: number | string
      width_cm: number | string
      height_cm: number | string
      box_count?: number | string
    }>
    weight_g: number | string
    cheque_payment?: boolean
    source_pin: string
    consignee_pin: string
    payment_mode: 'cod' | 'prepaid' | string
    cod_amount?: number | string
    inv_amount: number | string
    freight_mode?: string
    rov_insurance?: boolean
  }) {
    await this.ensureCredentials()

    const sourcePin = String(payload?.source_pin || '').trim()
    const consigneePin = String(payload?.consignee_pin || '').trim()
    const paymentMode = String(payload?.payment_mode || '').trim().toLowerCase()
    const weightG = Number(payload?.weight_g)
    const invoiceAmount = Number(payload?.inv_amount)
    const codAmount =
      payload?.cod_amount === undefined || payload?.cod_amount === null
        ? undefined
        : Number(payload.cod_amount)
    const normalizedDimensions = normalizeDelhiveryLtlDimensions(payload?.dimensions).map(
      (dimension) => ({
        length_cm: dimension.length,
        width_cm: dimension.width,
        height_cm: dimension.height,
        box_count: dimension.box_count,
      }),
    )

    if (!/^\d{6}$/.test(sourcePin)) {
      throw new HttpError(400, 'A valid 6-digit Delhivery LTL source pincode is required.')
    }

    if (!/^\d{6}$/.test(consigneePin)) {
      throw new HttpError(400, 'A valid 6-digit Delhivery LTL consignee pincode is required.')
    }

    if (!normalizedDimensions.length) {
      throw new HttpError(400, 'At least one valid Delhivery LTL package dimension is required.')
    }

    if (!Number.isFinite(weightG) || weightG <= 0) {
      throw new HttpError(400, 'A valid Delhivery LTL shipment weight in grams is required.')
    }

    if (paymentMode !== 'cod' && paymentMode !== 'prepaid') {
      throw new HttpError(400, 'Delhivery LTL payment mode must be either cod or prepaid.')
    }

    if (paymentMode === 'cod' && (!Number.isFinite(codAmount) || Number(codAmount) < 0)) {
      throw new HttpError(400, 'Delhivery LTL COD amount is required when payment mode is cod.')
    }

    if (!Number.isFinite(invoiceAmount) || invoiceAmount < 0) {
      throw new HttpError(400, 'A valid Delhivery LTL invoice amount is required.')
    }

    const requestPayload = {
      dimensions: normalizedDimensions,
      weight_g: weightG,
      cheque_payment: payload?.cheque_payment === true,
      source_pin: sourcePin,
      consignee_pin: consigneePin,
      payment_mode: paymentMode,
      ...(paymentMode === 'cod' ? { cod_amount: Number(codAmount) } : {}),
      inv_amount: invoiceAmount,
      ...(String(payload?.freight_mode || '').trim()
        ? { freight_mode: String(payload.freight_mode).trim().toLowerCase() }
        : {}),
      rov_insurance: payload?.rov_insurance === true,
    }

    const bearerToken = await this.getLtlBearerToken()
    const endpoint = `${this.ltlApiBase.replace(/\/+$/, '')}/freight/estimate`

    try {
      const response = await this.postWithTimeout(endpoint, requestPayload, {
        headers: {
          Authorization: `Bearer ${bearerToken}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      })

      const providerResponse = response.data
      const estimatedFreight = extractNumericValueByKeys(providerResponse, [
        'estimated_freight',
        'estimatedFreight',
        'freight_estimate',
        'freightEstimate',
        'freight_charge',
        'freightCharge',
        'total_charge',
        'totalCharge',
        'amount',
      ])

      return {
        success: true,
        endpoint,
        request_payload: requestPayload,
        estimatedFreight,
        provider_response: providerResponse,
      }
    } catch (err: any) {
      const providerMessage =
        extractProviderErrorMessage(err.response?.data) ||
        err.response?.data?.message ||
        err.message ||
        'Delhivery LTL freight estimate failed'

      const normalizedMessage = String(providerMessage || '').toLowerCase()
      if (
        err.response?.status === 401 ||
        err.response?.status === 403 ||
        normalizedMessage.includes('invalid token') ||
        normalizedMessage.includes('token expired') ||
        normalizedMessage.includes('unauthorized')
      ) {
        await this.clearLtlSessionMetadata()
      }

      throw new HttpError(err.response?.status || 500, providerMessage)
    }
  }

  async getLtlFreightCharges(lrns: string | string[]) {
    await this.ensureCredentials()

    const normalizedLrns = normalizeDelhiveryLtlLrns(lrns)
    if (!normalizedLrns.length) {
      throw new HttpError(400, 'At least one Delhivery LTL LRN is required.')
    }

    const bearerToken = await this.getLtlBearerToken()
    const lrnString = normalizedLrns.join(',')
    const baseEndpoint = `${this.ltlApiBase.replace(/\/+$/, '')}/lrn/freight-breakup`
    const attemptedEndpoints = [
      `${baseEndpoint}?lrns=${encodeURIComponent(lrnString)}`,
      `${baseEndpoint}/lrns=${encodeURIComponent(lrnString)}`,
    ]

    let lastError: any = null

    for (const endpoint of attemptedEndpoints) {
      try {
        const response = await this.getWithTimeout(endpoint, {
          headers: {
            Authorization: `Bearer ${bearerToken}`,
            Accept: 'application/json',
          },
        })

        return {
          success: true,
          endpoint,
          lrns: normalizedLrns,
          lrnCount: normalizedLrns.length,
          provider_response: response.data,
        }
      } catch (err: any) {
        lastError = err
        if (err?.response?.status !== 404) break
      }
    }

    const providerMessage =
      extractProviderErrorMessage(lastError?.response?.data) ||
      lastError?.response?.data?.message ||
      lastError?.message ||
      'Delhivery LTL freight charges lookup failed'

    const normalizedMessage = String(providerMessage || '').toLowerCase()
    if (
      lastError?.response?.status === 401 ||
      lastError?.response?.status === 403 ||
      normalizedMessage.includes('invalid token') ||
      normalizedMessage.includes('token expired') ||
      normalizedMessage.includes('unauthorized')
    ) {
      await this.clearLtlSessionMetadata()
    }

    throw new HttpError(lastError?.response?.status || 500, providerMessage)
  }

  async createLtlClientWarehouse(payload: unknown) {
    await this.ensureCredentials()

    const normalizedPayload = normalizeDelhiveryLtlWarehousePayload(payload)
    const warehouseName = String((normalizedPayload as Record<string, unknown>)?.name || '').trim()
    const pinCode = String((normalizedPayload as Record<string, unknown>)?.pin_code || '').trim()
    const addressDetails = (normalizedPayload as Record<string, unknown>)?.address_details

    if (!warehouseName) {
      throw new HttpError(400, 'Delhivery LTL warehouse name is required.')
    }

    if (!/^\d{6}$/.test(pinCode)) {
      throw new HttpError(400, 'A valid 6-digit Delhivery LTL warehouse pincode is required.')
    }

    if (!addressDetails || typeof addressDetails !== 'object' || Array.isArray(addressDetails)) {
      throw new HttpError(400, 'Delhivery LTL warehouse address_details object is required.')
    }

    const bearerToken = await this.getLtlBearerToken()
    const endpoint = `${this.ltlApiBase.replace(/\/+$/, '')}/client-warehouse/create/`

    try {
      const response = await this.postWithTimeout(endpoint, normalizedPayload, {
        headers: {
          Authorization: `Bearer ${bearerToken}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      })

      return {
        success: true,
        endpoint,
        warehouseName,
        pinCode,
        request_payload: normalizedPayload,
        provider_response: response.data,
      }
    } catch (err: any) {
      const providerMessage =
        extractProviderErrorMessage(err.response?.data) ||
        err.response?.data?.message ||
        err.message ||
        'Delhivery LTL warehouse creation failed'

      const normalizedMessage = String(providerMessage || '').toLowerCase()
      if (
        err.response?.status === 401 ||
        err.response?.status === 403 ||
        normalizedMessage.includes('invalid token') ||
        normalizedMessage.includes('token expired') ||
        normalizedMessage.includes('unauthorized')
      ) {
        await this.clearLtlSessionMetadata()
      }

      throw new HttpError(err.response?.status || 500, providerMessage)
    }
  }

  async updateLtlClientWarehouse(payload: unknown) {
    await this.ensureCredentials()

    const normalizedPayload = normalizeDelhiveryLtlWarehouseUpdatePayload(payload)
    const warehouseName = String(
      (normalizedPayload as Record<string, unknown>)?.cl_warehouse_name || '',
    ).trim()
    const updateDict = (normalizedPayload as Record<string, unknown>)?.update_dict

    if (!warehouseName) {
      throw new HttpError(400, 'Delhivery LTL cl_warehouse_name is required.')
    }

    if (!updateDict || typeof updateDict !== 'object' || Array.isArray(updateDict)) {
      throw new HttpError(400, 'Delhivery LTL update_dict object is required.')
    }

    const addressDetails = (updateDict as Record<string, unknown>)?.address_details
    if (
      addressDetails !== undefined &&
      (!addressDetails || typeof addressDetails !== 'object' || Array.isArray(addressDetails))
    ) {
      throw new HttpError(400, 'Delhivery LTL update_dict.address_details must be an object.')
    }

    const bearerToken = await this.getLtlBearerToken()
    const baseApi = this.ltlApiBase.replace(/\/+$/, '')
    const candidateEndpoints = [
      `${baseApi}/client-warehouse/update/`,
      `${baseApi}/client-warehouses/update/`,
    ]

    let lastError: any = null

    for (const endpoint of candidateEndpoints) {
      try {
        const response = await this.patchWithTimeout(endpoint, normalizedPayload, {
          headers: {
            Authorization: `Bearer ${bearerToken}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        })

        return {
          success: true,
          endpoint,
          warehouseName,
          request_payload: normalizedPayload,
          provider_response: response.data,
        }
      } catch (err: any) {
        lastError = err
        if (err?.response?.status !== 404) break
      }
    }

    const providerMessage =
      extractProviderErrorMessage(lastError?.response?.data) ||
      lastError?.response?.data?.message ||
      lastError?.message ||
      'Delhivery LTL warehouse update failed'

    const normalizedMessage = String(providerMessage || '').toLowerCase()
    if (
      lastError?.response?.status === 401 ||
      lastError?.response?.status === 403 ||
      normalizedMessage.includes('invalid token') ||
      normalizedMessage.includes('token expired') ||
      normalizedMessage.includes('unauthorized')
    ) {
      await this.clearLtlSessionMetadata()
    }

    throw new HttpError(lastError?.response?.status || 500, providerMessage)
  }

  async createLtlManifest(
    payload: Record<string, unknown>,
    files: Express.Multer.File[] = [],
  ) {
    await this.ensureCredentials()

    const pickupLocationName = String(payload?.pickup_location_name || '').trim()
    const pickupLocationId = String(payload?.pickup_location_id || '').trim()
    const paymentMode = String(payload?.payment_mode || '')
      .trim()
      .toLowerCase()
    const weight = Number(payload?.weight)
    const codAmount =
      payload?.cod_amount === undefined || payload?.cod_amount === null
        ? null
        : Number(payload.cod_amount)
    const dropoffStoreCode = String(payload?.dropoff_store_code || '').trim()
    const shipmentDetails = payload?.shipment_details
    const invoices = payload?.invoices
    const docData = payload?.doc_data
    const dropoffLocation = payload?.dropoff_location
    const normalizedDimensions = normalizeDelhiveryLtlDimensions(payload?.dimensions)

    if (!pickupLocationName && !pickupLocationId) {
      throw new HttpError(
        400,
        'Either Delhivery LTL pickup_location_name or pickup_location_id is required.',
      )
    }

    if (paymentMode !== 'cod' && paymentMode !== 'prepaid') {
      throw new HttpError(400, 'Delhivery LTL payment_mode must be either cod or prepaid.')
    }

    if (!Number.isFinite(weight) || weight <= 0) {
      throw new HttpError(400, 'A valid Delhivery LTL weight in grams is required.')
    }

    if (paymentMode === 'cod' && (!Number.isFinite(codAmount) || Number(codAmount) < 0)) {
      throw new HttpError(400, 'Delhivery LTL cod_amount is required when payment_mode is cod.')
    }

    if (!dropoffStoreCode) {
      if (!dropoffLocation || typeof dropoffLocation !== 'object' || Array.isArray(dropoffLocation)) {
        throw new HttpError(
          400,
          'Either Delhivery LTL dropoff_store_code or dropoff_location object is required.',
        )
      }
    }

    if (!shipmentDetails) {
      throw new HttpError(400, 'Delhivery LTL shipment_details is required.')
    }

    if (!invoices) {
      throw new HttpError(400, 'Delhivery LTL invoices is required.')
    }

    if (files.length > 10) {
      throw new HttpError(400, 'Delhivery LTL doc_file supports a maximum of 10 files.')
    }

    const totalFileBytes = files.reduce((sum, file) => sum + Number(file?.size || 0), 0)
    if (totalFileBytes > 20 * 1024 * 1024) {
      throw new HttpError(400, 'Delhivery LTL doc_file total size must not exceed 20 MB.')
    }

    const allowedExtensions = new Set(['.png', '.jpg', '.jpeg', '.pdf', '.bmp'])
    for (const file of files) {
      const extension = extname(String(file?.originalname || '')).toLowerCase()
      if (!allowedExtensions.has(extension)) {
        throw new HttpError(
          400,
          `Unsupported Delhivery LTL doc_file format for ${file.originalname || 'uploaded file'}.`,
        )
      }
    }

    if (files.length > 0 && !docData) {
      throw new HttpError(
        400,
        'Delhivery LTL doc_data is required when doc_file attachments are provided.',
      )
    }

    const bearerToken = await this.getLtlBearerToken()
    const endpoint = `${this.ltlApiBase.replace(/\/+$/, '')}/manifest`
    const form = new FormData()

    appendMultipartField(form, 'lrn', payload?.lrn)
    appendMultipartField(form, 'pickup_location_name', pickupLocationName)
    appendMultipartField(form, 'pickup_location_id', pickupLocationId)
    appendMultipartField(form, 'payment_mode', paymentMode)
    appendMultipartField(form, 'cod_amount', paymentMode === 'cod' ? codAmount : undefined)
    appendMultipartField(form, 'weight', weight)
    appendMultipartField(form, 'dropoff_store_code', dropoffStoreCode)
    appendMultipartField(form, 'dropoff_location', dropoffStoreCode ? undefined : dropoffLocation)
    appendMultipartField(form, 'return_address', payload?.return_address)
    appendMultipartField(form, 'shipment_details', shipmentDetails)
    appendMultipartField(
      form,
      'dimensions',
      normalizedDimensions.length
        ? normalizedDimensions.map((dimension) => ({
            length: dimension.length,
            width: dimension.width,
            height: dimension.height,
            box_count: dimension.box_count,
          }))
        : undefined,
    )
    appendMultipartField(
      form,
      'rov_insurance',
      normalizeBooleanLikeValue(payload?.rov_insurance) ?? payload?.rov_insurance,
    )
    appendMultipartField(
      form,
      'enable_paperless_movement',
      normalizeBooleanLikeValue(payload?.enable_paperless_movement) ??
        payload?.enable_paperless_movement,
    )
    appendMultipartField(form, 'callback', payload?.callback)
    appendMultipartField(form, 'invoices', invoices)
    appendMultipartField(form, 'doc_data', docData)
    appendMultipartField(form, 'freight_mode', payload?.freight_mode)
    appendMultipartField(form, 'billing_address', payload?.billing_address)
    appendMultipartField(
      form,
      'fm_pickup',
      normalizeBooleanLikeValue(payload?.fm_pickup) ?? payload?.fm_pickup,
    )

    for (const file of files) {
      form.append(
        'doc_file',
        new Blob([file.buffer], { type: file.mimetype || 'application/octet-stream' }),
        file.originalname || 'document',
      )
    }

    try {
      const response = await this.postWithTimeout(endpoint, form, {
        headers: {
          Authorization: `Bearer ${bearerToken}`,
          Accept: 'application/json',
        },
      })

      const providerResponse = response.data
      const jobId = extractStringValueByKeys(providerResponse, ['job_id', 'jobId', 'job'])

      return {
        success: true,
        endpoint,
        jobId,
        fileCount: files.length,
        request_summary: {
          pickup_location_name: pickupLocationName || null,
          pickup_location_id: pickupLocationId || null,
          payment_mode: paymentMode,
          weight,
          dropoff_store_code: dropoffStoreCode || null,
          fm_pickup:
            normalizeBooleanLikeValue(payload?.fm_pickup) ?? payload?.fm_pickup ?? null,
        },
        provider_response: providerResponse,
      }
    } catch (err: any) {
      const providerMessage =
        extractProviderErrorMessage(err.response?.data) ||
        err.response?.data?.message ||
        err.message ||
        'Delhivery LTL shipment creation failed'

      const normalizedMessage = String(providerMessage || '').toLowerCase()
      if (
        err.response?.status === 401 ||
        err.response?.status === 403 ||
        normalizedMessage.includes('invalid token') ||
        normalizedMessage.includes('token expired') ||
        normalizedMessage.includes('unauthorized')
      ) {
        await this.clearLtlSessionMetadata()
      }

      throw new HttpError(err.response?.status || 500, providerMessage)
    }
  }

  async getLtlManifestStatus(jobId: string) {
    await this.ensureCredentials()

    const normalizedJobId = String(jobId || '').trim()
    if (!normalizedJobId) {
      throw new HttpError(400, 'Delhivery LTL job_id is required.')
    }

    const bearerToken = await this.getLtlBearerToken()
    const baseEndpoint = `${this.ltlApiBase.replace(/\/+$/, '')}/manifest`
    const attemptedEndpoints = [
      `${baseEndpoint}?job_id=${encodeURIComponent(normalizedJobId)}`,
      `${baseEndpoint}?request_id=${encodeURIComponent(normalizedJobId)}`,
    ]

    let lastError: any = null

    for (const endpoint of attemptedEndpoints) {
      try {
        const response = await this.getWithTimeout(endpoint, {
          headers: {
            Authorization: `Bearer ${bearerToken}`,
            Accept: 'application/json',
          },
        })

        const providerResponse = response.data
        const lrn = extractStringValueByKeys(providerResponse, ['lrn', 'lrnum', 'lr_number', 'lr'])
        const awbs = extractStringListByKeys(providerResponse, [
          'awb',
          'awb_number',
          'awb_numbers',
          'waybill',
          'waybills',
        ])

        return {
          success: true,
          endpoint,
          jobId: normalizedJobId,
          lrn,
          awbs,
          awbCount: awbs.length,
          provider_response: providerResponse,
        }
      } catch (err: any) {
        lastError = err
        if (err?.response?.status !== 404) break
      }
    }

    const providerMessage =
      extractProviderErrorMessage(lastError?.response?.data) ||
      lastError?.response?.data?.message ||
      lastError?.message ||
      'Delhivery LTL shipment status lookup failed'

    const normalizedMessage = String(providerMessage || '').toLowerCase()
    if (
      lastError?.response?.status === 401 ||
      lastError?.response?.status === 403 ||
      normalizedMessage.includes('invalid token') ||
      normalizedMessage.includes('token expired') ||
      normalizedMessage.includes('unauthorized')
    ) {
      await this.clearLtlSessionMetadata()
    }

    throw new HttpError(lastError?.response?.status || 500, providerMessage)
  }

  async updateLtlShipment(
    lrn: string,
    payload: Record<string, unknown>,
    files: Express.Multer.File[] = [],
  ) {
    await this.ensureCredentials()

    const normalizedLrn = String(lrn || '').trim()
    if (!normalizedLrn) {
      throw new HttpError(400, 'Delhivery LTL lrn is required.')
    }

    const paymentModeRaw = String(payload?.payment_mode || '').trim().toLowerCase()
    const codAmount =
      payload?.cod_amount === undefined || payload?.cod_amount === null
        ? null
        : Number(payload.cod_amount)
    const consigneePincode = String(payload?.consignee_pincode || '').trim()
    const weightG =
      payload?.weight_g === undefined || payload?.weight_g === null
        ? null
        : Number(payload.weight_g)
    const invoices = payload?.invoices
    const invoiceFilesMeta = payload?.invoice_files_meta
    const dimensions = payload?.dimensions
    const normalizedDimensions = normalizeDelhiveryLtlDimensions(dimensions)
    const callbackPayload = payload?.callback ?? payload?.cb

    if (paymentModeRaw === 'prepaid') {
      throw new HttpError(400, 'Delhivery LTL shipment update is not supported for prepaid orders.')
    }

    if (paymentModeRaw && paymentModeRaw !== 'cod') {
      throw new HttpError(400, 'Delhivery LTL payment_mode can only be cod when updating an LR.')
    }

    if (paymentModeRaw === 'cod' && (!Number.isFinite(codAmount) || Number(codAmount) < 0)) {
      throw new HttpError(400, 'Delhivery LTL cod_amount is required when payment_mode is cod.')
    }

    if (consigneePincode && !/^\d{6}$/.test(consigneePincode)) {
      throw new HttpError(400, 'Delhivery LTL consignee_pincode must be a valid 6-digit pincode.')
    }

    if (payload?.weight_g !== undefined && (!Number.isFinite(weightG) || Number(weightG) <= 0)) {
      throw new HttpError(400, 'Delhivery LTL weight_g must be a valid positive number.')
    }

    if (dimensions !== undefined && !Array.isArray(dimensions)) {
      throw new HttpError(400, 'Delhivery LTL dimensions must be an array when provided.')
    }

    if (invoices !== undefined && !Array.isArray(invoices)) {
      throw new HttpError(400, 'Delhivery LTL invoices must be an array when provided.')
    }

    if (files.length > 10) {
      throw new HttpError(400, 'Delhivery LTL invoice_file supports a maximum of 10 files.')
    }

    const totalFileBytes = files.reduce((sum, file) => sum + Number(file?.size || 0), 0)
    if (totalFileBytes > 20 * 1024 * 1024) {
      throw new HttpError(400, 'Delhivery LTL invoice_file total size must not exceed 20 MB.')
    }

    const allowedExtensions = new Set(['.png', '.jpg', '.jpeg', '.pdf', '.bmp'])
    for (const file of files) {
      const extension = extname(String(file?.originalname || '')).toLowerCase()
      if (!allowedExtensions.has(extension)) {
        throw new HttpError(
          400,
          `Unsupported Delhivery LTL invoice_file format for ${file.originalname || 'uploaded file'}.`,
        )
      }
    }

    if (files.length > 0 && invoices === undefined) {
      throw new HttpError(
        400,
        'Delhivery LTL invoices are required when invoice_file attachments are provided.',
      )
    }

    if (files.length > 0 && invoiceFilesMeta === undefined) {
      throw new HttpError(
        400,
        'Delhivery LTL invoice_files_meta is required when invoice_file attachments are provided.',
      )
    }

    const bearerToken = await this.getLtlBearerToken()
    const endpoint = `${this.ltlApiBase.replace(/\/+$/, '')}/lrn/update/${encodeURIComponent(normalizedLrn)}`
    const form = new FormData()

    appendMultipartField(form, 'payment_mode', paymentModeRaw || undefined)
    appendMultipartField(form, 'cod_amount', paymentModeRaw === 'cod' ? codAmount : undefined)
    appendMultipartField(form, 'consignee_name', payload?.consignee_name)
    appendMultipartField(form, 'consignee_address', payload?.consignee_address)
    appendMultipartField(form, 'consignee_pincode', consigneePincode || undefined)
    appendMultipartField(form, 'consignee_phone', payload?.consignee_phone)
    appendMultipartField(form, 'weight_g', weightG)
    appendMultipartField(
      form,
      'dimensions',
      normalizedDimensions.length
        ? normalizedDimensions.map((dimension) => ({
            length: dimension.length,
            width: dimension.width,
            height: dimension.height,
            box_count: dimension.box_count,
          }))
        : undefined,
    )
    appendMultipartField(form, 'cb', callbackPayload)
    appendMultipartField(form, 'invoices', invoices)
    appendMultipartField(form, 'invoice_files_meta', invoiceFilesMeta)

    for (const file of files) {
      form.append(
        'invoice_file',
        new Blob([file.buffer], { type: file.mimetype || 'application/octet-stream' }),
        file.originalname || 'invoice',
      )
    }

    try {
      const response = await this.putWithTimeout(endpoint, form, {
        headers: {
          Authorization: `Bearer ${bearerToken}`,
          Accept: 'application/json',
        },
      })

      return {
        success: true,
        endpoint,
        lrn: normalizedLrn,
        fileCount: files.length,
        request_summary: {
          payment_mode: paymentModeRaw || null,
          consignee_name: String(payload?.consignee_name || '').trim() || null,
          consignee_pincode: consigneePincode || null,
          weight_g: Number.isFinite(weightG) ? weightG : null,
        },
        provider_response: response.data,
      }
    } catch (err: any) {
      const providerMessage =
        extractProviderErrorMessage(err.response?.data) ||
        err.response?.data?.message ||
        err.message ||
        'Delhivery LTL shipment update failed'

      const normalizedMessage = String(providerMessage || '').toLowerCase()
      if (
        err.response?.status === 401 ||
        err.response?.status === 403 ||
        normalizedMessage.includes('invalid token') ||
        normalizedMessage.includes('token expired') ||
        normalizedMessage.includes('unauthorized')
      ) {
        await this.clearLtlSessionMetadata()
      }

      throw new HttpError(err.response?.status || 500, providerMessage)
    }
  }

  async getLtlShipmentUpdateStatus(jobId: string) {
    await this.ensureCredentials()

    const normalizedJobId = String(jobId || '').trim()
    if (!normalizedJobId) {
      throw new HttpError(400, 'Delhivery LTL shipment update job_id is required.')
    }

    const bearerToken = await this.getLtlBearerToken()
    const endpoint = `${this.ltlApiBase.replace(/\/+$/, '')}/lrn/update/status?job_id=${encodeURIComponent(normalizedJobId)}`

    try {
      const response = await this.getWithTimeout(endpoint, {
        headers: {
          Authorization: `Bearer ${bearerToken}`,
          Accept: 'application/json',
        },
      })

      const providerResponse = response.data
      const lrn = extractStringValueByKeys(providerResponse, ['lrn', 'lrnum', 'lr_number', 'lr'])
      const status = extractStringValueByKeys(providerResponse, [
        'status',
        'job_status',
        'request_status',
        'state',
      ])

      return {
        success: true,
        endpoint,
        jobId: normalizedJobId,
        lrn,
        status,
        provider_response: providerResponse,
      }
    } catch (err: any) {
      const providerMessage =
        extractProviderErrorMessage(err.response?.data) ||
        err.response?.data?.message ||
        err.message ||
        'Delhivery LTL shipment update status lookup failed'

      const normalizedMessage = String(providerMessage || '').toLowerCase()
      if (
        err.response?.status === 401 ||
        err.response?.status === 403 ||
        normalizedMessage.includes('invalid token') ||
        normalizedMessage.includes('token expired') ||
        normalizedMessage.includes('unauthorized')
      ) {
        await this.clearLtlSessionMetadata()
      }

      throw new HttpError(err.response?.status || 500, providerMessage)
    }
  }

  async cancelLtlShipment(lrn: string) {
    await this.ensureCredentials()

    const normalizedLrn = String(lrn || '').trim()
    if (!normalizedLrn) {
      throw new HttpError(400, 'Delhivery LTL lrn is required for cancellation.')
    }

    const bearerToken = await this.getLtlBearerToken()
    const endpoint = `${this.ltlApiBase.replace(/\/+$/, '')}/lrn/cancel/${encodeURIComponent(normalizedLrn)}`

    try {
      const response = await axios.delete(endpoint, {
        headers: {
          Authorization: `Bearer ${bearerToken}`,
          Accept: 'application/json',
        },
        timeout: this.requestTimeoutMs,
      })

      const providerResponse = response.data
      const providerMessage =
        extractProviderErrorMessage(providerResponse) ||
        extractStringValueByKeys(providerResponse, ['message', 'status', 'remark'])

      return {
        success: true,
        endpoint,
        lrn: normalizedLrn,
        message: providerMessage,
        provider_response: providerResponse,
      }
    } catch (err: any) {
      const providerMessage =
        extractProviderErrorMessage(err.response?.data) ||
        err.response?.data?.message ||
        err.message ||
        'Delhivery LTL shipment cancellation failed'

      const normalizedMessage = String(providerMessage || '').toLowerCase()
      if (
        err.response?.status === 401 ||
        err.response?.status === 403 ||
        normalizedMessage.includes('invalid token') ||
        normalizedMessage.includes('token expired') ||
        normalizedMessage.includes('unauthorized')
      ) {
        await this.clearLtlSessionMetadata()
      }

      throw new HttpError(err.response?.status || 500, providerMessage)
    }
  }

  async trackLtlShipment(params: {
    lrnum?: string
    track_id?: string
    all_wbns?: boolean | string | number
  }) {
    await this.ensureCredentials()

    const lrnum = String(params?.lrnum || '').trim()
    const trackId = String(params?.track_id || '').trim()
    const allWbns = normalizeBooleanLikeValue(params?.all_wbns) ?? false

    if (!lrnum && !trackId) {
      throw new HttpError(400, 'Delhivery LTL lrnum or track_id is required for tracking.')
    }

    const bearerToken = await this.getLtlBearerToken()
    const query = new URLSearchParams()
    if (lrnum) query.set('lrnum', lrnum)
    if (trackId) query.set('track_id', trackId)
    if (allWbns) query.set('all_wbns', 'true')

    const endpoint = `${this.ltlApiBase.replace(/\/+$/, '')}/lrn/track?${query.toString()}`

    try {
      const response = await this.getWithTimeout(endpoint, {
        headers: {
          Authorization: `Bearer ${bearerToken}`,
          Accept: 'application/json',
        },
      })

      const providerResponse = response.data
      const status = extractStringValueByKeys(providerResponse, [
        'status',
        'current_status',
        'shipment_status',
        'state',
      ])
      const resolvedLrn = extractStringValueByKeys(providerResponse, ['lrn', 'lrnum', 'lr_number'])
      const awbs = extractStringListByKeys(providerResponse, [
        'awb',
        'awb_number',
        'awb_numbers',
        'waybill',
        'waybills',
      ])

      return {
        success: true,
        endpoint,
        lrn: resolvedLrn || lrnum || null,
        trackId: trackId || null,
        status,
        awbs,
        awbCount: awbs.length,
        provider_response: providerResponse,
      }
    } catch (err: any) {
      const providerMessage =
        extractProviderErrorMessage(err.response?.data) ||
        err.response?.data?.message ||
        err.message ||
        'Delhivery LTL shipment tracking failed'

      const normalizedMessage = String(providerMessage || '').toLowerCase()
      if (
        err.response?.status === 401 ||
        err.response?.status === 403 ||
        normalizedMessage.includes('invalid token') ||
        normalizedMessage.includes('token expired') ||
        normalizedMessage.includes('unauthorized')
      ) {
        await this.clearLtlSessionMetadata()
      }

      throw new HttpError(err.response?.status || 500, providerMessage)
    }
  }

  async getLtlShippingLabelUrls(params: { size?: string; lrn?: string }) {
    await this.ensureCredentials()

    const normalizedSize = String(params?.size || '')
      .trim()
      .toLowerCase()
    const normalizedLrn = String(params?.lrn || '').trim()
    const allowedSizes = new Set(['sm', 'md', 'a4', 'std'])

    if (!allowedSizes.has(normalizedSize)) {
      throw new HttpError(400, 'Delhivery LTL label size must be one of sm, md, a4, or std.')
    }

    if (!normalizedLrn) {
      throw new HttpError(400, 'Delhivery LTL lrn is required for label generation.')
    }

    const bearerToken = await this.getLtlBearerToken()
    const endpoint = `${this.ltlApiBase.replace(/\/+$/, '')}/label/get_urls/${encodeURIComponent(normalizedSize)}/${encodeURIComponent(normalizedLrn)}`

    try {
      const response = await this.getWithTimeout(
        endpoint,
        {
          headers: {
            Authorization: `Bearer ${bearerToken}`,
            Accept: 'application/json',
          },
        },
        this.labelTimeoutMs,
      )

      const providerResponse = response.data
      const labelUrls = extractDelhiveryLtlLabelPayloads(providerResponse)

      return {
        success: true,
        endpoint,
        size: normalizedSize,
        lrn: normalizedLrn,
        labelUrls,
        labelCount: labelUrls.length,
        provider_response: providerResponse,
      }
    } catch (err: any) {
      const providerMessage =
        extractProviderErrorMessage(err.response?.data) ||
        err.response?.data?.message ||
        err.message ||
        'Delhivery LTL shipping label URL lookup failed'

      const normalizedMessage = String(providerMessage || '').toLowerCase()
      if (
        err.response?.status === 401 ||
        err.response?.status === 403 ||
        normalizedMessage.includes('invalid token') ||
        normalizedMessage.includes('token expired') ||
        normalizedMessage.includes('unauthorized')
      ) {
        await this.clearLtlSessionMetadata()
      }

      throw new HttpError(err.response?.status || 500, providerMessage)
    }
  }

  async getLtlLrCopy(params: { lrn?: string; lr_copy_type?: unknown; requestId?: string }) {
    await this.ensureCredentials()

    const normalizedLrn = String(params?.lrn || '').trim()
    const normalizedRequestId = String(params?.requestId || '').trim()
    const lrCopyTypes = normalizeDelhiveryLtlLrCopyTypes(params?.lr_copy_type)

    if (!normalizedLrn) {
      throw new HttpError(400, 'Delhivery LTL lrn is required for LR copy generation.')
    }

    const bearerToken = await this.getLtlBearerToken()
    const query = new URLSearchParams()
    if (lrCopyTypes.length) query.set('lr_copy_type', lrCopyTypes.join(','))
    const endpoint = `${this.ltlApiBase.replace(/\/+$/, '')}/lr_copy/print/${encodeURIComponent(normalizedLrn)}${
      query.toString() ? `?${query.toString()}` : ''
    }`

    try {
      const response = await this.getWithTimeout(
        endpoint,
        {
          headers: {
            Authorization: `Bearer ${bearerToken}`,
            Accept: 'application/pdf',
            ...(normalizedRequestId ? { 'X-Request-Id': normalizedRequestId } : {}),
          },
          responseType: 'arraybuffer',
        },
        this.labelTimeoutMs,
      )

      const pdfBuffer = Buffer.from(response.data)
      const contentType = String(response.headers?.['content-type'] || 'application/pdf').trim()
      const pdfBase64 = pdfBuffer.toString('base64')

      return {
        success: true,
        endpoint,
        lrn: normalizedLrn,
        requestId: normalizedRequestId || null,
        lrCopyTypes,
        contentType,
        byteLength: pdfBuffer.length,
        pdfBase64,
        pdfDataUrl: `data:${contentType};base64,${pdfBase64}`,
      }
    } catch (err: any) {
      const providerMessage =
        extractProviderErrorMessage(err.response?.data) ||
        err.response?.data?.message ||
        err.message ||
        'Delhivery LTL LR copy generation failed'

      const normalizedMessage = String(providerMessage || '').toLowerCase()
      if (
        err.response?.status === 401 ||
        err.response?.status === 403 ||
        normalizedMessage.includes('invalid token') ||
        normalizedMessage.includes('token expired') ||
        normalizedMessage.includes('unauthorized')
      ) {
        await this.clearLtlSessionMetadata()
      }

      throw new HttpError(err.response?.status || 500, providerMessage)
    }
  }

  async generateLtlDocuments(
    docType: string,
    payload: Record<string, unknown>,
    requestId?: string,
  ) {
    await this.ensureCredentials()

    const normalizedDocType = String(docType || '')
      .trim()
      .toLowerCase()
    const allowedDocTypes = new Set(['shipping_label', 'lr_copy'])
    const normalizedRequestId = String(requestId || '').trim()

    if (!allowedDocTypes.has(normalizedDocType)) {
      throw new HttpError(
        400,
        'Delhivery LTL doc_type must be one of shipping_label or lr_copy.',
      )
    }

    const rawLrns = Array.isArray(payload?.lrns)
      ? payload.lrns
      : String(payload?.lrns || '')
          .split(',')
          .map((entry) => entry.trim())
          .filter(Boolean)
    const lrns = Array.from(
      new Set(
        rawLrns
          .map((entry) => String(entry || '').trim())
          .filter(Boolean),
      ),
    )

    if (!lrns.length) {
      throw new HttpError(400, 'At least one Delhivery LTL lrn is required for document generation.')
    }

    if (lrns.length > 25) {
      throw new HttpError(400, 'Delhivery LTL document generation supports a maximum of 25 LRNs.')
    }

    const callback =
      payload?.callback && typeof payload.callback === 'object' && !Array.isArray(payload.callback)
        ? { ...(payload.callback as Record<string, unknown>) }
        : null

    if (!callback) {
      throw new HttpError(400, 'Delhivery LTL callback details are required for document generation.')
    }

    const requestPayload: Record<string, unknown> = {
      lrns,
      callback,
    }

    if (normalizedDocType === 'shipping_label') {
      const size = String(payload?.size || '')
        .trim()
        .toLowerCase()
      if (!['sm', 'md', 'a4', 'std'].includes(size)) {
        throw new HttpError(
          400,
          'Delhivery LTL shipping label size must be one of sm, md, a4, or std.',
        )
      }
      requestPayload.size = size
    }

    if (normalizedDocType === 'lr_copy') {
      const lrCopyTypes = normalizeDelhiveryLtlLrCopyTypes(payload?.lr_copy_type)
      if (lrCopyTypes.length) requestPayload.lr_copy_type = lrCopyTypes
    }

    const bearerToken = await this.getLtlBearerToken()
    const endpoint = `${this.ltlApiBase.replace(/\/+$/, '')}/generate/${encodeURIComponent(normalizedDocType)}`

    try {
      const response = await this.postWithTimeout(endpoint, requestPayload, {
        headers: {
          Authorization: `Bearer ${bearerToken}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(normalizedRequestId ? { 'X-Request-Id': normalizedRequestId } : {}),
        },
      })

      const providerResponse = response.data
      const jobId = extractStringValueByKeys(providerResponse, [
        'job_id',
        'jobId',
        'request_id',
        'requestId',
        'id',
      ])

      return {
        success: true,
        endpoint,
        docType: normalizedDocType,
        requestId: normalizedRequestId || null,
        jobId,
        request_payload: requestPayload,
        provider_response: providerResponse,
      }
    } catch (err: any) {
      const providerMessage =
        extractProviderErrorMessage(err.response?.data) ||
        err.response?.data?.message ||
        err.message ||
        'Delhivery LTL document generation failed'

      const normalizedMessage = String(providerMessage || '').toLowerCase()
      if (
        err.response?.status === 401 ||
        err.response?.status === 403 ||
        normalizedMessage.includes('invalid token') ||
        normalizedMessage.includes('token expired') ||
        normalizedMessage.includes('unauthorized')
      ) {
        await this.clearLtlSessionMetadata()
      }

      throw new HttpError(err.response?.status || 500, providerMessage)
    }
  }

  async getLtlGeneratedDocumentStatus(docType: string, jobId: string, requestId?: string) {
    await this.ensureCredentials()

    const normalizedDocType = String(docType || '')
      .trim()
      .toLowerCase()
    const normalizedJobId = String(jobId || '').trim()
    const normalizedRequestId = String(requestId || '').trim()
    const allowedDocTypes = new Set(['shipping_label', 'lr_copy'])

    if (!allowedDocTypes.has(normalizedDocType)) {
      throw new HttpError(
        400,
        'Delhivery LTL doc_type must be one of shipping_label or lr_copy.',
      )
    }

    if (!normalizedJobId) {
      throw new HttpError(400, 'Delhivery LTL job_id is required for document status lookup.')
    }

    const bearerToken = await this.getLtlBearerToken()
    const endpoint = `${this.ltlApiBase.replace(/\/+$/, '')}/generate/${encodeURIComponent(normalizedDocType)}/status/${encodeURIComponent(normalizedJobId)}`

    try {
      const response = await this.getWithTimeout(
        endpoint,
        {
          headers: {
            Authorization: `Bearer ${bearerToken}`,
            Accept: 'application/json',
            ...(normalizedRequestId ? { 'X-Request-Id': normalizedRequestId } : {}),
          },
        },
        this.labelTimeoutMs,
      )

      const providerResponse = response.data
      const status = extractStringValueByKeys(providerResponse, [
        'status',
        'job_status',
        'request_status',
        'state',
      ])
      const documentLinks = extractDelhiveryLtlDocumentLinks(providerResponse)

      return {
        success: true,
        endpoint,
        docType: normalizedDocType,
        jobId: normalizedJobId,
        requestId: normalizedRequestId || null,
        status,
        documentLinks,
        documentCount: documentLinks.length,
        provider_response: providerResponse,
      }
    } catch (err: any) {
      const providerMessage =
        extractProviderErrorMessage(err.response?.data) ||
        err.response?.data?.message ||
        err.message ||
        'Delhivery LTL document status lookup failed'

      const normalizedMessage = String(providerMessage || '').toLowerCase()
      if (
        err.response?.status === 401 ||
        err.response?.status === 403 ||
        normalizedMessage.includes('invalid token') ||
        normalizedMessage.includes('token expired') ||
        normalizedMessage.includes('unauthorized')
      ) {
        await this.clearLtlSessionMetadata()
      }

      throw new HttpError(err.response?.status || 500, providerMessage)
    }
  }

  async bookLtlLastMileAppointment(payload: Record<string, unknown>) {
    await this.ensureCredentials()

    const lrn = String(payload?.lrn || '').trim()
    const appointmentDate = String(payload?.date || '').trim()
    const appointmentSlot = String(payload?.appointment_slot || '').trim()
    const appointmentId = String(payload?.appointment_id || '').trim()
    const poExpiryDate = String(payload?.po_expiry_date || '').trim()
    const poNumbers = Array.isArray(payload?.po_number)
      ? payload.po_number
          .map((entry) => String(entry || '').trim())
          .filter(Boolean)
          .slice(0, 5)
      : String(payload?.po_number || '')
          .split(',')
          .map((entry) => String(entry || '').trim())
          .filter(Boolean)
          .slice(0, 5)

    const allowedSlots = new Set([
      '03:00 PM-06:00 PM',
      '06:00 PM-09:00 PM',
      '07:00 AM-10:00 AM',
      '09:00 AM-06:00 PM',
      '09:00 PM-11:59 PM',
      '09:00 AM-12:00 PM',
      '12:00 AM-07:00 AM',
      '12:00 PM-03:00 PM',
    ])

    if (!lrn) {
      throw new HttpError(400, 'Delhivery LTL appointment lrn is required.')
    }

    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(appointmentDate)) {
      throw new HttpError(400, 'Delhivery LTL appointment date must use DD/MM/YYYY format.')
    }

    if (!allowedSlots.has(appointmentSlot)) {
      throw new HttpError(400, 'Delhivery LTL appointment_slot is invalid.')
    }

    if (!poNumbers.length) {
      throw new HttpError(
        400,
        'At least one Delhivery LTL po_number is required for appointment booking.',
      )
    }

    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(poExpiryDate)) {
      throw new HttpError(
        400,
        'Delhivery LTL po_expiry_date must use DD/MM/YYYY format.',
      )
    }

    const bearerToken = await this.getLtlBearerToken()
    const endpoint = `${this.ltlApiBase.replace(/\/+$/, '')}/v2/appointments/lm`
    const requestPayload = {
      lrn,
      date: appointmentDate,
      appointment_slot: appointmentSlot,
      po_number: poNumbers,
      ...(appointmentId ? { appointment_id: appointmentId } : {}),
      po_expiry_date: poExpiryDate,
    }

    try {
      const response = await this.postWithTimeout(endpoint, requestPayload, {
        headers: {
          Authorization: `Bearer ${bearerToken}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      })

      const providerResponse = response.data
      const status = extractStringValueByKeys(providerResponse, [
        'status',
        'appointment_status',
        'message',
      ])

      return {
        success: true,
        endpoint,
        lrn,
        status,
        request_payload: requestPayload,
        provider_response: providerResponse,
      }
    } catch (err: any) {
      const providerMessage =
        extractProviderErrorMessage(err.response?.data) ||
        err.response?.data?.message ||
        err.message ||
        'Delhivery LTL appointment booking failed'

      const normalizedMessage = String(providerMessage || '').toLowerCase()
      if (
        err.response?.status === 401 ||
        err.response?.status === 403 ||
        normalizedMessage.includes('invalid token') ||
        normalizedMessage.includes('token expired') ||
        normalizedMessage.includes('unauthorized')
      ) {
        await this.clearLtlSessionMetadata()
      }

      throw new HttpError(err.response?.status || 500, providerMessage)
    }
  }

  async createLtlPickupRequest(
    payload: {
      client_warehouse?: unknown
      pickup_date?: unknown
      start_time?: unknown
      expected_package_count?: unknown
    },
    requestId?: string,
  ) {
    await this.ensureCredentials()

    const clientWarehouse = String(payload?.client_warehouse || '').trim()
    const pickupDate = String(payload?.pickup_date || '').trim()
    const startTime = String(payload?.start_time || '').trim()
    const expectedPackageCount = Number(payload?.expected_package_count)
    const normalizedRequestId = String(requestId || '').trim()

    if (!clientWarehouse) {
      throw new HttpError(400, 'Delhivery LTL client_warehouse is required.')
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(pickupDate)) {
      throw new HttpError(400, 'Delhivery LTL pickup_date must use YYYY-MM-DD format.')
    }

    if (!/^\d{2}:\d{2}:\d{2}$/.test(startTime)) {
      throw new HttpError(400, 'Delhivery LTL start_time must use HH:MM:SS format.')
    }

    if (!Number.isFinite(expectedPackageCount) || expectedPackageCount <= 0) {
      throw new HttpError(
        400,
        'Delhivery LTL expected_package_count must be a positive integer.',
      )
    }

    const bearerToken = await this.getLtlBearerToken()
    const endpoint = `${this.ltlApiBase.replace(/\/+$/, '')}/pickup_requests`
    const requestPayload = {
      client_warehouse: clientWarehouse,
      pickup_date: pickupDate,
      start_time: startTime,
      expected_package_count: Math.max(1, Math.round(expectedPackageCount)),
    }

    try {
      const response = await this.postWithTimeout(endpoint, requestPayload, {
        headers: {
          Authorization: `Bearer ${bearerToken}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(normalizedRequestId ? { 'X-Request-Id': normalizedRequestId } : {}),
        },
      })

      const providerResponse = response.data
      const pickupId = extractStringValueByKeys(providerResponse, [
        'pickup_id',
        'pickup_request_id',
        'request_id',
        'job_id',
        'id',
      ])
      const providerMessage =
        extractProviderErrorMessage(providerResponse) ||
        extractStringValueByKeys(providerResponse, ['message', 'status', 'remark'])

      return {
        success: true,
        endpoint,
        pickupId,
        requestId: normalizedRequestId || null,
        request_payload: requestPayload,
        message: providerMessage,
        provider_response: providerResponse,
      }
    } catch (err: any) {
      const providerMessage =
        extractProviderErrorMessage(err.response?.data) ||
        err.response?.data?.message ||
        err.message ||
        'Delhivery LTL pickup request creation failed'

      const normalizedMessage = String(providerMessage || '').toLowerCase()
      if (
        err.response?.status === 401 ||
        err.response?.status === 403 ||
        normalizedMessage.includes('invalid token') ||
        normalizedMessage.includes('token expired') ||
        normalizedMessage.includes('unauthorized')
      ) {
        await this.clearLtlSessionMetadata()
      }

      throw new HttpError(err.response?.status || 500, providerMessage)
    }
  }

  // Delhivery LTL pickup request cancellation
  async cancelLtlPickupRequest(pickupId: string, requestId?: string) {
    await this.ensureCredentials()

    const normalizedPickupId = String(pickupId || '').trim()
    const normalizedRequestId = String(requestId || '').trim()

    if (!normalizedPickupId) {
      throw new HttpError(400, 'Delhivery LTL pickup_id is required for pickup cancellation.')
    }

    const bearerToken = await this.getLtlBearerToken()
    const endpoint = `${this.ltlApiBase.replace(/\/+$/, '')}/pickup_requests/${encodeURIComponent(normalizedPickupId)}`

    try {
      const response = await axios.delete(endpoint, {
        headers: {
          Authorization: `Bearer ${bearerToken}`,
          Accept: 'application/json',
          ...(normalizedRequestId ? { 'X-Request-Id': normalizedRequestId } : {}),
        },
        timeout: this.requestTimeoutMs,
      })

      const providerResponse = response.data
      const providerMessage =
        extractProviderErrorMessage(providerResponse) ||
        extractStringValueByKeys(providerResponse, ['message', 'status', 'remark'])

      return {
        success: true,
        endpoint,
        pickupId: normalizedPickupId,
        requestId: normalizedRequestId || null,
        message: providerMessage,
        provider_response: providerResponse,
      }
    } catch (err: any) {
      const providerMessage =
        extractProviderErrorMessage(err.response?.data) ||
        err.response?.data?.message ||
        err.message ||
        'Delhivery LTL pickup cancellation failed'

      const normalizedMessage = String(providerMessage || '').toLowerCase()
      if (
        err.response?.status === 401 ||
        err.response?.status === 403 ||
        normalizedMessage.includes('invalid token') ||
        normalizedMessage.includes('token expired') ||
        normalizedMessage.includes('unauthorized')
      ) {
        await this.clearLtlSessionMetadata()
      }

      throw new HttpError(err.response?.status || 500, providerMessage)
    }
  }

  // 🔹 1. Check Serviceability
  async checkServiceability(pincode: string) {
    try {
      await this.ensureCredentials()
      const url = `${this.apiBase}/c/api/pin-codes/json/?filter_codes=${pincode}`
      const res = await this.getWithTimeout(url, { headers: this.headers })

      // Log the full response structure
      console.log('📦 Delhivery Serviceability API Response:', {
        url,
        status: res.status,
        data: JSON.stringify(res.data, null, 2),
        dataType: typeof res.data,
        isArray: Array.isArray(res.data),
        keys: res.data ? Object.keys(res.data) : [],
      })

      return res.data
    } catch (err: any) {
      console.error('❌ Delhivery serviceability error:', {
        pincode,
        status: err.response?.status,
        data: JSON.stringify(err.response?.data, null, 2),
        message: err.message,
      })
      throw new Error('Failed to fetch Delhivery serviceability')
    }
  }

  // 🔹 2. Expected TAT (Transit Time)
  async getExpectedTAT(
    origin: string,
    destination: string,
    mot: 'S' | 'E' = 'S',
    pdt: 'B2B' | 'B2C' = 'B2C',
  ) {
    try {
      await this.ensureCredentials()
      const url = `${this.apiBase}/api/dc/expected_tat?origin_pin=${origin}&destination_pin=${destination}&mot=${mot}&pdt=${pdt}`
      const res = await this.getWithTimeout(url, { headers: this.headers })
      const tat = res.data?.data?.tat
      return typeof tat === 'number' || typeof tat === 'string' ? Number(tat) : null
    } catch (err: any) {
      console.error('Delhivery TAT API error:', err.response?.data || err.message)
      return null
    }
  }

  // 🔹 3. Fetch Waybills
  async fetchWaybills(count: number = 10) {
    try {
      await this.ensureCredentials()
      const normalizedCount = Math.max(1, Number(count || 1))
      const isBulk = normalizedCount > 1
      const path = isBulk ? '/waybill/api/bulk/json/' : '/waybill/api/fetch/json/'
      const query = qs.stringify({
        cl: this.clientName,
        token: this.token,
        ...(isBulk ? { count: normalizedCount } : {}),
      })
      const url = `${this.apiBase}${path}?${query}`
      const res = await this.getWithTimeout(url, { headers: this.headers })
      return res.data?.waybill ?? res.data?.waybills ?? res.data
    } catch (err: any) {
      console.error('Delhivery waybill fetch error:', err.response?.data || err.message)
      throw new Error('Failed to fetch Delhivery waybill')
    }
  }

  // 🔹 4. Create Shipment (Manifestation)
  async createShipment(params: ShipmentParams, waybill?: string) {
    try {
      const normalizedCourierId = normalizeCourierId(params.courier_id)
      if (normalizedCourierId === null) {
        throw new HttpError(
          400,
          'Delhivery courier_id is required for Air/Express or Surface bookings.',
        )
      }
      const shippingMode = resolveDelhiveryShippingMode({
        courierId: normalizedCourierId,
        mode: params.shipping_mode,
        courierName: params.courier_partner,
      })
      if (!shippingMode) {
        throw new HttpError(
          400,
          `Invalid Delhivery courier selection: courier_id ${normalizedCourierId} does not map to Air/Express or Surface.`,
        )
      }

      const sanitizeString = (value?: string | null) => {
        if (!value) return ''
        return String(value).trim()
      }
      const sanitizePhone = (value?: string | null) => {
        const digits = String(value || '').replace(/\\D/g, '')
        return digits.length >= 10 ? digits.slice(-10) : digits
      }
      const sanitizePincode = (value?: string | number | null) => {
        if (value === undefined || value === null) return ''
        return String(value).trim()
      }
      const sanitizeBoolean = (value?: boolean | string | number | null) => {
        if (value === undefined || value === null) return undefined
        if (typeof value === 'boolean') return value
        const normalized = String(value).trim().toLowerCase()
        return ['true', '1', 'yes', 'y'].includes(normalized)
      }

      const pickup = params.pickup || ({} as ShipmentParams['pickup'])
      const consignee = params.consignee || ({} as ShipmentParams['consignee'])
      const boxes = Array.isArray(params.boxes) ? params.boxes : []
      const orderNumber = sanitizeString(params.order_number)
      const invoiceNumber = sanitizeString(params.invoice_number)
      const pickupDate = sanitizeString(params.pickup_date || pickup.pickup_date)
      const pickupTime = sanitizeString(params.pickup_time || pickup.pickup_time)
      const resolvedInvoiceNumber = invoiceNumber || orderNumber
      const orderAmount = Number(params.order_amount ?? 0)
      const orderItems = Array.isArray(params.order_items) ? params.order_items : []
      const defaultHsnCode = sanitizeString(process.env.DELHIVERY_DEFAULT_HSN_CODE || '999999')
      const hsnCodes = Array.from(
        new Set(
          orderItems
            .map((item) => (item?.hsn || item?.hsnCode || '').toString().trim())
            .filter((code) => code.length > 0),
        ),
      )
      const resolvedHsnCode = hsnCodes.length ? hsnCodes.join(', ') : defaultHsnCode

      if (!orderNumber) {
        throw new HttpError(400, 'order_number is required to create a Delhivery shipment.')
      }
      if (!invoiceNumber) {
        console.warn(
          `ℹ️ Delhivery invoice_number missing for order ${orderNumber}; using order_number as fallback.`,
        )
      }
      // if (!invoiceNumber) {
      //   throw new HttpError(
      //     400,
      //     'invoice_number (invoice_reference) is mandatory for Delhivery B2C manifests. Please provide the seller invoice number.',
      //   )
      // }
      // if (!hsnCodes.length) {
      //   throw new HttpError(
      //     400,
      //     'Delhivery requires HSN/SAC codes for at least one of the products you are shipping. Attach HSN codes to your order items.',
      //   )
      // }
      if (orderAmount <= 0 || Number.isNaN(orderAmount)) {
        throw new HttpError(
          400,
          'order_amount is required and must be a positive number when booking with Delhivery.',
        )
      }
      if ((params.mps || boxes.length > 1) && !waybill) {
        throw new HttpError(
          400,
          'Delhivery multi-piece shipment is not supported in the current B2C flow. Use a single-package shipment.',
        )
      }

      const pickupAddressParts = [
        sanitizeString(pickup.address),
        sanitizeString(pickup.address_2),
      ].filter((part) => part.length > 0)
      const pickupAddress =
        pickupAddressParts.length > 0
          ? pickupAddressParts.join(', ')
          : sanitizeString(pickup.warehouse_name)

      const sellerName = sanitizeString(params.company?.name || pickup.name || 'Kourier Boyz')
      const sellerGst = sanitizeString(params.company?.gst || pickup.gst_number || '')
      const productNames = orderItems
        .map((item) => {
          const rawItem = item as any
          return sanitizeString(rawItem?.name || rawItem?.productName || rawItem?.product_name)
        })
        .filter((name) => name.length > 0)
      const productsDesc = productNames.length ? productNames.join(', ') : 'General Merchandise'

      const consigneePhone = sanitizePhone(consignee.phone)
      if (!consigneePhone) {
        throw new HttpError(
          400,
          'Consignee phone must contain at least 10 digits for Delhivery shipments.',
        )
      }
      const pickupPhone = sanitizePhone(pickup.phone)
      if (!pickupPhone) {
        throw new HttpError(400, 'Valid pickup phone is required for Delhivery manifests.')
      }

      const orderDate =
        params.order_date instanceof Date
          ? params.order_date.toISOString().split('T')[0]
          : sanitizeString(params.order_date) || new Date().toISOString().split('T')[0]
      const invoiceDate =
        params.invoice_date && sanitizeString(params.invoice_date)
          ? sanitizeString(params.invoice_date)
          : orderDate
      const paymentMode =
        params.payment_type === 'cod'
          ? 'COD'
          : params.payment_type === 'reverse'
            ? 'Pickup'
            : params.payment_type === 'replacement'
              ? 'REPL'
              : 'Prepaid'
      const codAmount = paymentMode === 'COD' ? orderAmount : 0
      const packageWeightGrams = normalizeDelhiveryWeightGrams(params.package_weight)

      const manifestShipment: Record<string, any> = {
        order: orderNumber,
        order_date: orderDate,
        name: sanitizeString(consignee.name),
        phone: consigneePhone,
        add: sanitizeString(consignee.address),
        city: sanitizeString(consignee.city),
        state: sanitizeString(consignee.state),
        pin: sanitizePincode(consignee.pincode),
        country: 'India',
        payment_mode: paymentMode,
        cod_amount: codAmount,
        total_amount: orderAmount,
        products_desc: productsDesc,
        hsn_code: resolvedHsnCode,
        weight: packageWeightGrams,
        shipment_length: Number(params.package_length ?? 10),
        shipment_width: Number(params.package_breadth ?? 10),
        shipment_height: Number(params.package_height ?? 10),
        seller_name: sellerName,
        seller_add: pickupAddress,
        seller_city: sanitizeString(pickup.city),
        seller_state: sanitizeString(pickup.state),
        seller_pin: sanitizePincode(pickup.pincode),
        seller_phone: pickupPhone,
        seller_gst_tin: sellerGst,
        invoice_number: resolvedInvoiceNumber,
        invoice_amount: orderAmount,
        seller_inv: resolvedInvoiceNumber,
        invoice_reference: resolvedInvoiceNumber,
        invoice_date: invoiceDate,
        pickup_location: sanitizeString(pickup.warehouse_name) || 'Default Warehouse',
        pickup_address: pickupAddress,
        pickup_city: sanitizeString(pickup.city),
        pickup_state: sanitizeString(pickup.state),
        pickup_pin: sanitizePincode(pickup.pincode),
        pickup_phone: pickupPhone,
        pickup_country: 'India',
        pickup_date: pickupDate || undefined,
        pickup_time: pickupTime || undefined,
        shipping_mode: shippingMode,
        client_name: this.clientName || sellerName,
        client_gst_tin: sellerGst,
        waybill: waybill || undefined,
      }

      if (params.transport_speed) {
        manifestShipment.transport_speed = sanitizeString(params.transport_speed)
      }
      if (params.address_type) {
        manifestShipment.address_type = sanitizeString(params.address_type)
      }
      const ewbnValue =
        params.ewbn || params.ewb || params.ewbn_number || params.ewaybill_number || undefined
      if (ewbnValue) {
        manifestShipment.ewbn = sanitizeString(ewbnValue)
      }
      if (params.dangerous_good !== undefined) {
        manifestShipment.dangerous_good = sanitizeBoolean(params.dangerous_good)
      }
      if (params.fragile_shipment !== undefined) {
        manifestShipment.fragile_shipment = sanitizeBoolean(params.fragile_shipment)
      }
      if (params.plastic_packaging !== undefined) {
        manifestShipment.plastic_packaging = sanitizeBoolean(params.plastic_packaging)
      }
      if (params.quantity !== undefined && params.quantity !== null) {
        manifestShipment.quantity = sanitizeString(String(params.quantity))
      }
      if (params.country) {
        manifestShipment.country = sanitizeString(params.country)
      }

      const resolvedReturnAddress =
        params.rto && params.is_rto_different === 'yes'
          ? params.rto
          : paymentMode === 'REPL'
            ? (params.rto ?? params.pickup)
            : null

      if (resolvedReturnAddress) {
        Object.assign(manifestShipment, {
          return_name: resolvedReturnAddress.name,
          return_add: resolvedReturnAddress.address,
          return_address: resolvedReturnAddress.address,
          return_city: resolvedReturnAddress.city,
          return_state: resolvedReturnAddress.state,
          return_pin: resolvedReturnAddress.pincode,
          return_phone: resolvedReturnAddress.phone,
          return_country: 'India',
        })
      }

      const payload = {
        shipments: [manifestShipment],
        pickup_location: {
          name: sanitizeString(pickup.warehouse_name) || 'Default Warehouse',
        },
      }

      console.log('📤 Delhivery createShipment payload summary', {
        order: orderNumber,
        pickup_location: payload.shipments[0].pickup_location,
        pickup_date: payload.shipments[0].pickup_date ?? null,
        pickup_time: payload.shipments[0].pickup_time ?? null,
        weight_g: packageWeightGrams,
        payment_mode: paymentMode,
        hsn_present: resolvedHsnCode ? 1 : 0,
        hsn_code: resolvedHsnCode,
        invoice_number: resolvedInvoiceNumber,
        shipping_mode: shippingMode,
        cod_amount: codAmount,
      })

      const res = await this.postFormEncoded('/api/cmu/create.json', payload)
      const responseData = res.data

      const packages: any[] = Array.isArray(responseData?.packages)
        ? responseData.packages
        : responseData?.packages
          ? [responseData.packages]
          : []

      const normalizedStatus = (value?: string) => (value || '').toLowerCase()
      const normalizeRemarks = (remarks: unknown): string[] => {
        if (!remarks) return []
        if (Array.isArray(remarks)) {
          return remarks
            .flatMap((entry) => normalizeRemarks(entry))
            .filter((entry) => entry.trim().length > 0)
        }
        if (typeof remarks === 'string') {
          return [remarks.trim()].filter(Boolean)
        }
        if (typeof remarks === 'object') {
          return Object.values(remarks as Record<string, unknown>)
            .flatMap((entry) => normalizeRemarks(entry))
            .filter((entry) => entry.trim().length > 0)
        }
        return [String(remarks).trim()].filter(Boolean)
      }
      const isHistoricalDeliveryRestriction = (value: unknown) => {
        const normalized = String(value || '').toLowerCase()
        return (
          normalized.includes('shipment restricted based on historical delivery outcomes') ||
          (normalized.includes('historical delivery outcomes') &&
            normalized.includes('shipment restricted'))
        )
      }
      const overallStatus = normalizedStatus(responseData?.status)
      const packageFailures = packages.filter(
        (pkg) =>
          normalizedStatus(pkg?.status) === 'fail' || pkg?.serviceable === false || !pkg?.waybill,
      )
      const packageFailuresWithRemarks = packageFailures.map((pkg) => ({
        ...pkg,
        remarks: normalizeRemarks(pkg?.remarks),
      }))
      const successPackage = packages.find(
        (pkg) =>
          pkg?.waybill && pkg?.serviceable !== false && normalizedStatus(pkg?.status) !== 'fail',
      )

      if (
        overallStatus === 'fail' ||
        responseData?.success === false ||
        responseData?.serviceable === false ||
        !successPackage
      ) {
        console.error('❌ Delhivery manifest rejected', {
          order: orderNumber,
          response: responseData,
          packageFailures: packageFailuresWithRemarks,
          packageFailureRemarks: packageFailuresWithRemarks.flatMap((pkg) => pkg.remarks),
        })

        const packageFailureReason = packageFailuresWithRemarks
          .map((pkg) => {
            const joinedRemarks = pkg.remarks.join(' | ')
            return (
              joinedRemarks ||
              pkg?.message ||
              pkg?.reason ||
              pkg?.rmk ||
              `status=${pkg?.status ?? 'unknown'}`
            )
          })
          .filter(Boolean)
          .join(' | ')
        const failureReason =
          packageFailureReason ||
          responseData?.message ||
          responseData?.status_message ||
          normalizeRemarks(responseData?.rmk).join(' | ') ||
          'Delhivery reported a failure during shipment creation.'
        if (isHistoricalDeliveryRestriction(failureReason)) {
          throw new DelhiveryManifestError(
            422,
            'Delhivery rejected this shipment because the consignee/address is restricted based on historical delivery outcomes. Use another courier, change the consignee/address, or book it as prepaid if Delhivery allows it.',
            {
              ...responseData,
              courier_reason: failureReason,
              non_retryable: true,
              restriction_type: 'historical_delivery_outcomes',
            },
          )
        }
        throw new DelhiveryManifestError(502, failureReason, responseData)
      }

      const responseShippingMode =
        responseData?.shipping_mode ??
        successPackage?.shipping_mode ??
        successPackage?.service_mode ??
        successPackage?.service_type ??
        successPackage?.mode ??
        null

      console.log('📤 Delhivery API response service', {
        order: orderNumber,
        requested_shipping_mode: shippingMode,
        response_shipping_mode: responseShippingMode,
        response_package_keys: successPackage ? Object.keys(successPackage) : [],
      })

      let sortCode: string | null = null
      if (successPackage) {
        sortCode =
          (successPackage.sort_code ||
            successPackage.sortCode ||
            successPackage.routing_code ||
            successPackage.routingCode) ??
          null
      }

      if (sortCode && successPackage) {
        successPackage.sort_code = sortCode
      }

      return responseData
    } catch (err: any) {
      console.error('Delhivery shipment error:', err.response?.data || err.message)
      if (err instanceof HttpError) {
        throw err
      }
      throw new Error('Delhivery shipment creation failed')
    }
  }

  // 🔹 6. Cancel Shipment
  async cancelShipment(waybill: string) {
    const normalizedWaybill = String(waybill || '').trim()
    if (!normalizedWaybill) {
      throw new HttpError(400, 'Delhivery AWB number is required for cancellation')
    }

    try {
      await this.ensureCredentials()
      console.log('🚚 Delhivery Cancel Shipment Request:', {
        waybill: normalizedWaybill,
        apiBase: this.apiBase,
      })

      const res = await this.postWithTimeout(
        `${this.apiBase}/api/p/edit`,
        { waybill: normalizedWaybill, cancellation: 'true' },
        {
          headers: {
            Authorization: `Token ${this.token}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        },
      )

      console.log('📥 Delhivery Cancel Shipment Response:', {
        status: res.status,
        data: JSON.stringify(res.data, null, 2),
        success: res.data?.success,
        Success: res.data?.Success,
        statusField: res.data?.status,
        message: res.data?.message,
      })

      if (!isDelhiveryCancellationAccepted(res.data)) {
        const providerMessage =
          getDelhiveryCancellationMessage(res.data) ||
          extractProviderErrorMessage(res.data) ||
          'Delhivery cancellation not accepted'
        throw new Error(providerMessage)
      }

      return {
        success: true,
        status: 'success',
        provider: 'delhivery',
        awb_number: normalizedWaybill,
        alreadyCancelled: isDelhiveryAlreadyCancelledResponse(res.data),
        message:
          getDelhiveryCancellationMessage(res.data) ||
          (isDelhiveryAlreadyCancelledResponse(res.data)
            ? 'Delhivery shipment was already cancelled'
            : 'Delhivery cancellation accepted'),
        provider_response: res.data,
      }
    } catch (err: any) {
      console.error('❌ Delhivery cancellation error:', {
        waybill: normalizedWaybill,
        status: err.response?.status,
        data: JSON.stringify(err.response?.data, null, 2),
        message: err.message,
        stack: err.stack,
      })
      const providerMessage =
        extractProviderErrorMessage(err.response?.data) ||
        err.response?.data?.message ||
        err.message ||
        'Delhivery cancellation failed'
      throw new Error(providerMessage)
    }
  }

  // 🔹 7. Track Shipment
  async trackShipment(awb: string) {
    await this.ensureCredentials()
    const res = await this.getWithTimeout(`${this.apiBase}/api/v1/packages/json/?waybill=${awb}`, {
      headers: this.headers,
    })
    return res.data
  }

  // 🔹 8. NDR Action (RE-ATTEMPT / PICKUP_RESCHEDULE)
  async submitNdrAction(
    actions: Array<{
      waybill: string
      act: 'RE-ATTEMPT' | 'DEFER_DLV' | 'EDIT_DETAILS' | 'PICKUP_RESCHEDULE'
      action_data?: Record<string, any>
    }>,
  ) {
    try {
      await this.ensureCredentials()
      const url = `${this.apiBase}/api/p/update`
      const payload = actions.map((action) => {
        const mappedAct = action.act === 'PICKUP_RESCHEDULE' ? 'DEFER_DLV' : action.act
        const actionData = { ...(action.action_data || {}) } as Record<string, any>

        if (mappedAct === 'DEFER_DLV') {
          const normalizedDeferredDate =
            actionData.deferred_date || actionData.deferment_date || actionData.defermentDate
          if (normalizedDeferredDate) {
            actionData.deferred_date = normalizedDeferredDate
          }
          delete actionData.deferment_date
          delete actionData.defermentDate
        }

        return {
          waybill: action.waybill,
          act: mappedAct,
          ...(Object.keys(actionData).length ? { action_data: actionData } : {}),
        }
      })
      const res = await this.postWithTimeout(url, { data: payload }, { headers: this.headers })
      return res.data // contains UPL id(s)
    } catch (err: any) {
      console.error('Delhivery NDR action error:', err.response?.data || err.message)
      throw new Error('Failed to submit Delhivery NDR action')
    }
  }

  // 🔹 9. Get NDR UPL Status
  async getNdrStatus(uplId: string, verbose: boolean = true) {
    try {
      await this.ensureCredentials()
      const url = `${this.apiBase}/api/cmu/get_bulk_upl/${encodeURIComponent(uplId)}?verbose=${
        verbose ? 'true' : 'false'
      }`
      const res = await this.getWithTimeout(url, { headers: this.headers })
      return res.data
    } catch (err: any) {
      console.error('Delhivery NDR status error:', err.response?.data || err.message)
      throw new Error('Failed to fetch Delhivery NDR status')
    }
  }

  // 🔹 8. Pickup Request (manual scheduling)
  async requestPickup(pickupData: any) {
    await this.ensureCredentials()
    const res = await this.postWithTimeout(`${this.apiBase}/fm/request/new/`, pickupData, {
      headers: this.headers,
    })
    return res.data
  }

  // services/delhivery.service.ts
  async createWarehouse(warehouse: {
    name: string
    registered_name?: string
    phone: string
    email?: string
    address: string
    city: string
    pin: string
    country?: string
    return_address: string
    return_city?: string
    return_pin?: string
    return_state?: string
    return_country?: string
  }) {
    try {
      await this.ensureCredentials()
      const url = `${this.apiBase}/api/backend/clientwarehouse/create/`
      const headers = {
        Authorization: `Token ${this.token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      }

      const res = await this.postWithTimeout(url, warehouse, { headers })
      return res.data
    } catch (err: any) {
      console.error('❌ Delhivery warehouse creation error:', err.response?.data || err.message)
      // Re-throw original error so upstream callers can inspect Delhivery's response
      throw err
    }
  }

  async triggerDelhiveryPickupRequest(pickupLocationName: string, packageCount: number) {
    try {
      // 🔹 Current date in YYYY-MM-DD
      const now = new Date()
      const pickup_date = now.toISOString().split('T')[0]

      // 🔹 Pickup time → 1 hour from now (HH:mm:ss)
      const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000)
      const pickup_time = oneHourLater.toTimeString().split(' ')[0] // "HH:mm:ss"

      const payload = {
        pickup_date,
        pickup_time,
        pickup_location: pickupLocationName,
        expected_package_count: packageCount,
      }

      const res = await this.requestPickup(payload)

      if (!res?.success) {
        console.error('❌ Delhivery pickup creation failed:', res)
        throw new Error(res?.message || 'Delhivery pickup request failed')
      }

      console.log(`✅ Pickup request created for ${pickupLocationName} (${packageCount} packages)`)
      return res
    } catch (err: any) {
      console.error('❌ Pickup request creation error:', err.message)
      throw err
    }
  }
  // 🔹 10. Create Reverse Shipment
  // Delhivery reverse shipments are created via the same create.json manifestation API,
  // with `package_type: "Pickup"` and reverse-specific shipment values.
  async createReverseShipment(params: {
    originalAwb: string
    originalOrderId?: string
    consignee: ShipmentParams['consignee']
    pickup: ShipmentParams['pickup']
    rto?: ShipmentParams['rto']
    order_amount?: number
    package_weight?: number
    package_length?: number
    package_breadth?: number
    package_height?: number
    order_items?: ShipmentParams['order_items']
  }) {
    try {
      const reverseDrop = params.rto ?? params.pickup
      const reversePayload: any = {
        shipments: [
          {
            order: params.originalOrderId || `REVERSE-${params.originalAwb}`,
            name: params.consignee?.name || '',
            phone: String(params.consignee?.phone || '')
              .replace(/\D/g, '')
              .slice(-10),
            add: params.consignee?.address || '',
            city: params.consignee?.city || '',
            state: params.consignee?.state || '',
            pin: String(params.consignee?.pincode || '')
              .padStart(6, '0')
              .slice(0, 6),
            country: 'India',
            payment_mode: 'Pickup',
            package_type: 'Pickup',
            total_amount: Number(params.order_amount || 0),
            cod_amount: '0',
            products_desc:
              params.order_items?.map((i) => i.name).join(', ') || 'Reverse Pickup Shipment',
            weight: normalizeDelhiveryWeightGrams(params.package_weight),
            shipment_length: Number(params.package_length ?? 10),
            shipment_width: Number(params.package_breadth ?? 10),
            shipment_height: Number(params.package_height ?? 10),
            pickup_location: params.pickup?.warehouse_name ?? 'Default Warehouse',
            seller_name: params.pickup?.name ?? 'Kourier Boyz',
            seller_add: params.pickup?.address ?? '',
            order_date: new Date().toISOString().split('T')[0],
            return_name: reverseDrop?.name ?? params.pickup?.name ?? 'Return',
            return_add: reverseDrop?.address ?? '',
            return_city: reverseDrop?.city ?? '',
            return_state: reverseDrop?.state ?? '',
            return_pin: String(reverseDrop?.pincode ?? '')
              .padStart(6, '0')
              .slice(0, 6),
            return_phone: String(reverseDrop?.phone ?? '')
              .replace(/\D/g, '')
              .slice(-10),
            return_country: 'India',
          },
        ],
      }

      if (params.order_items && params.order_items.length > 0) {
        reversePayload.shipments[0].products_desc = params.order_items
          .map((item) => item?.name || 'Item')
          .join(', ')
      }

      const res = await this.postFormEncoded('/api/cmu/create.json', reversePayload)

      if (!res.data?.packages?.length) {
        throw new Error('Delhivery reverse shipment creation failed - no packages returned')
      }

      const pkg = res.data.packages[0]
      const delhiveryCost =
        pkg?.charge || pkg?.amount || res.data?.charge || res.data?.amount || null

      return {
        success: true,
        packages: res.data.packages,
        upload_wbn: res.data.upload_wbn,
        shipment_id: res.data.upload_wbn,
        awb_number: pkg.waybill,
        courier_name: 'Delhivery',
        courier_cost: delhiveryCost ? Number(delhiveryCost) : null,
        status: 'booked',
      }
    } catch (err: any) {
      console.error('Delhivery reverse shipment error:', err.response?.data || err.message)
      throw new Error(err?.message || 'Delhivery reverse shipment creation failed')
    }
  }

  async updateWarehouse(data: {
    name: string // warehouse name (case-sensitive, cannot be changed)
    address?: string
    pin: string
    phone?: string
  }) {
    try {
      await this.ensureCredentials()
      const url = `${this.apiBase}/api/backend/clientwarehouse/edit/`
      const headers = {
        Authorization: `Token ${this.token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      }

      const payload = {
        name: data.name,
        address: data.address,
        pin: data.pin,
        phone: data.phone,
      }

      const res = await this.postWithTimeout(url, payload, { headers })
      return res.data
    } catch (err: any) {
      console.error('❌ Delhivery warehouse update error:', err.response?.data || err.message)
      throw new Error('Failed to update Delhivery warehouse')
    }
  }

  async createPickupRequest({
    pickup_date,
    pickup_time,
    pickup_location,
    expected_package_count,
  }: {
    pickup_date: string
    pickup_time: string
    pickup_location: string
    expected_package_count: number
  }) {
    try {
      await this.ensureCredentials()
      const url = `${this.apiBase}/fm/request/new/`
      const payload = {
        pickup_date,
        pickup_time,
        pickup_location, // must exactly match warehouse name in Delhivery
        expected_package_count,
      }

      const headers = {
        Authorization: `Token ${this.token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      }

      const res = await this.postWithTimeout(url, payload, { headers })
      const responseData = res.data
      const rejected =
        responseData?.success === false ||
        responseData?.status === false ||
        Boolean(responseData?.error) ||
        Boolean(responseData?.errors)

      if (rejected) {
        throw new Error(
          extractProviderErrorMessage(responseData) || 'Delhivery pickup request was rejected',
        )
      }

      return responseData
    } catch (err: any) {
      const providerError = err.response?.data
      const timeoutError = isTimeoutError(err)

      const providerMessage =
        (!timeoutError && extractProviderErrorMessage(providerError?.pickup_date)) ||
        extractProviderErrorMessage(providerError?.message) ||
        extractProviderErrorMessage(providerError?.error) ||
        (!timeoutError && extractProviderErrorMessage(providerError)) ||
        (typeof err.message === 'string' && err.message.trim().length > 0 && !timeoutError
          ? err.message.trim()
          : 'Pickup request is taking longer than expected. Please try again.')

      const existingPickupRequestId = getExistingPickupRequestId(providerMessage)
      if (existingPickupRequestId) {
        console.warn('ℹ️ Delhivery pickup request already exists; treating as accepted', {
          pickup_request_id: existingPickupRequestId,
          pickup_location,
          pickup_date,
          pickup_time,
          expected_package_count,
        })
        return {
          success: true,
          already_exists: true,
          pickup_request_id: existingPickupRequestId,
          message: providerMessage,
          provider_response: providerError || null,
        }
      }

      console.error('❌ Delhivery pickup request error:', providerError || err.message)

      const error = new Error(providerMessage)
      ;(error as any).statusCode = typeof err.response?.status === 'number'
        ? err.response.status
        : timeoutError
          ? 504
          : 500
      ;(error as any).details = providerError || null
      ;(error as any).isPickupRequestError = true
      ;(error as any).providerStatus = err.response?.status ?? null
      ;(error as any).providerStatusText = err.response?.statusText ?? null
      ;(error as any).code = err?.code ?? null
      throw error
    }
  }
  // 🔹 9. Fetch Shipping Label from Delhivery packing_slip API
  // format=json -> metadata (barcodes, sort code, etc.)
  // format=pdf  -> raw PDF bytes (used to ensure provider-side label generation activity)
  async generateLabel(awb: string, options: { format?: 'json' | 'pdf' } = { format: 'json' }) {
    await this.ensureCredentials()
    const format = options.format || 'json'
    const url = `${this.apiBase}/api/p/packing_slip?wbns=${encodeURIComponent(awb)}${
      format === 'pdf' ? '&pdf=true' : '&pdf=false'
    }`
    const responseType = format === 'pdf' ? 'arraybuffer' : 'json'
    const res = await this.getWithTimeout(
      url,
      {
      headers: this.headers,
      responseType,
      },
      format === 'pdf' ? this.labelTimeoutMs : this.requestTimeoutMs,
    )

    return format === 'pdf' ? Buffer.from(res.data) : res.data
  }

  // COD Settlement APIs not publicly available
  // Use CSV download from Delhivery dashboard instead:
  // Dashboard → Finances → Remittance → Download Report
}
