import axios, { type AxiosInstance } from 'axios'
import { eq } from 'drizzle-orm'
import { HttpError } from '../../utils/classes'
import { db } from '../client'
import { b2b_orders } from '../schema/b2bOrders'
import { b2c_orders } from '../schema/b2cOrders'

const DEFAULT_AFTERSHIP_TRACKING_BASE = 'https://api.aftership.com/tracking/2024-04'
const SHADOWFAX_SLUG = 'shadowfax'

type OrderSourceType = 'b2c' | 'b2b'
export type AfterShipTrackingCompletedReason = 'DELIVERED' | 'LOST' | 'RETURNED_TO_SENDER'

export type AfterShipTrackableOrder = {
  id: string
  source_type?: OrderSourceType
  order_id?: string | null
  order_number?: string | null
  awb_number?: string | null
  edd?: string | null
  provider_meta?: any
}

export type AfterShipTrackingUpdateParams = {
  smses?: string[]
  emails?: string[]
  title?: string | null
  customerName?: string | null
  orderId?: string | null
  orderIdPath?: string | null
  note?: string | null
  language?: string | null
  promisedDeliveryDate?: string | null
}

export type AfterShipEstimatedDeliveryAddress = {
  country: string
  state?: string | null
  city?: string | null
  postal_code?: string | null
  raw_location?: string | null
}

export type AfterShipEstimatedDeliveryWeight = {
  unit: string
  value: number
}

export type AfterShipEstimatedPickup = {
  order_time: string
  order_cutoff_time: string
  business_days: number[]
  order_processing_time: {
    unit: string
    value: number
  }
}

export type AfterShipEstimatedDeliveryDateRequest = {
  slug?: string | null
  service_type_name?: string | null
  origin_address: AfterShipEstimatedDeliveryAddress
  destination_address: AfterShipEstimatedDeliveryAddress
  weight?: AfterShipEstimatedDeliveryWeight | null
  package_count?: number | null
  pickup_time?: string | null
  estimated_pickup?: AfterShipEstimatedPickup | null
}

const normalize = (value: unknown) => String(value ?? '').trim()

const normalizeBase = (value?: string | null) =>
  normalize(value || DEFAULT_AFTERSHIP_TRACKING_BASE).replace(/\/+$/, '')

const getAfterShipApiKey = () =>
  normalize(
    process.env.AFTERSHIP_API_KEY ||
      process.env.AFTERSHIP_TRACKING_API_KEY ||
      process.env.AFTERSHIP_API_TOKEN,
  )

export const isAfterShipTrackingConfigured = () => Boolean(getAfterShipApiKey())

const buildClient = (): AxiosInstance => {
  const apiKey = getAfterShipApiKey()
  if (!apiKey) {
    throw new HttpError(
      400,
      'AfterShip API key is not configured. Set AFTERSHIP_API_KEY to enable Shadowfax AfterShip tracking.',
    )
  }

  return axios.create({
    baseURL: normalizeBase(process.env.AFTERSHIP_TRACKING_API_BASE),
    timeout: 30000,
    headers: {
      'as-api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  })
}

const parseAfterShipError = (error: any, fallback: string) => {
  const data = error?.response?.data
  const metaMessage = data?.meta?.message
  const errorMessage = data?.message || data?.error || data?.errors
  const message = metaMessage || errorMessage || error?.message || fallback
  return typeof message === 'object' ? JSON.stringify(message) : String(message || fallback)
}

const isDuplicateTrackingError = (error: any) => {
  const data = error?.response?.data
  const normalized = [
    data?.meta?.message,
    data?.message,
    data?.error,
    error?.message,
  ]
    .map((value) => normalize(value).toLowerCase())
    .join(' ')

  return (
    error?.response?.status === 409 ||
    (error?.response?.status === 400 &&
      (normalized.includes('duplicate') ||
        normalized.includes('already exist') ||
        normalized.includes('already exists')))
  )
}

const dateOnly = (value: unknown) => {
  const raw = normalize(value)
  if (!raw) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString().slice(0, 10)
}

const getTrackingId = (payload: any) =>
  normalize(payload?.data?.tracking?.id || payload?.tracking?.id || payload?.id) || null

const getTrackingPayload = (payload: any) => payload?.data?.tracking || payload?.tracking || payload?.data || payload || {}

const isExpiredTracking = (payload: any) => {
  const tracking = getTrackingPayload(payload)
  const statusText = [
    tracking?.tag,
    tracking?.subtag,
    tracking?.subtag_message,
  ]
    .map((value) => normalize(value).toLowerCase())
    .join(' ')

  return statusText.includes('expired')
}

const existingProviderMeta = (value: unknown) =>
  value && typeof value === 'object' && !Array.isArray(value) ? { ...(value as Record<string, any>) } : {}

const normalizeCompletedReason = (reason: string): AfterShipTrackingCompletedReason => {
  const normalizedReason = normalize(reason).toUpperCase()
  if (
    normalizedReason !== 'DELIVERED' &&
    normalizedReason !== 'LOST' &&
    normalizedReason !== 'RETURNED_TO_SENDER'
  ) {
    throw new HttpError(
      400,
      'AfterShip completion reason must be one of DELIVERED, LOST or RETURNED_TO_SENDER',
    )
  }

  return normalizedReason
}

const validateAddress = (address: AfterShipEstimatedDeliveryAddress | undefined, label: string) => {
  if (!address || typeof address !== 'object') {
    throw new HttpError(400, `AfterShip ${label} address is required`)
  }

  if (!normalize(address.country)) {
    throw new HttpError(400, `AfterShip ${label} address country is required`)
  }
}

const buildEstimatedDeliveryDateRequest = (request: AfterShipEstimatedDeliveryDateRequest) => {
  validateAddress(request.origin_address, 'origin')
  validateAddress(request.destination_address, 'destination')

  const pickupTime = normalize(request.pickup_time)
  if (!pickupTime && !request.estimated_pickup) {
    throw new HttpError(400, 'AfterShip EDD requires either pickup_time or estimated_pickup')
  }

  return {
    slug: normalize(request.slug) || SHADOWFAX_SLUG,
    service_type_name: normalize(request.service_type_name) || null,
    origin_address: request.origin_address,
    destination_address: request.destination_address,
    weight: request.weight ?? null,
    package_count: request.package_count ?? null,
    pickup_time: pickupTime || null,
    estimated_pickup: request.estimated_pickup ?? null,
  }
}

const buildTrackingUpdate = (params: AfterShipTrackingUpdateParams) => {
  const tracking: Record<string, any> = {}

  if (params.smses !== undefined) tracking.smses = params.smses
  if (params.emails !== undefined) tracking.emails = params.emails

  const title = normalize(params.title)
  if (params.title !== undefined) tracking.title = title

  const customerName = normalize(params.customerName)
  if (params.customerName !== undefined) tracking.customer_name = customerName

  const orderId = normalize(params.orderId)
  if (params.orderId !== undefined) tracking.order_id = orderId

  const orderIdPath = normalize(params.orderIdPath)
  if (params.orderIdPath !== undefined) tracking.order_id_path = orderIdPath

  const note = normalize(params.note)
  if (params.note !== undefined) tracking.note = note

  const language = normalize(params.language)
  if (params.language !== undefined) tracking.language = language

  if (params.promisedDeliveryDate !== undefined) {
    const promisedDate = dateOnly(params.promisedDeliveryDate)
    tracking.order_promised_delivery_date = promisedDate || ''
  }

  return tracking
}

export async function persistAfterShipTrackingMeta(
  order: AfterShipTrackableOrder,
  tracking: any,
) {
  const trackingId = getTrackingId(tracking)
  if (!trackingId) return

  const nextMeta = {
    ...existingProviderMeta(order.provider_meta),
    aftership_tracking_id: trackingId,
    aftership_tracking_slug: SHADOWFAX_SLUG,
    aftership_tracking_number: normalize(order.awb_number),
    aftership_tracking_updated_at: new Date().toISOString(),
  }

  if (order.source_type === 'b2b') {
    await db
      .update(b2b_orders)
      .set({ provider_meta: nextMeta, updated_at: new Date() } as any)
      .where(eq(b2b_orders.id, order.id))
    return
  }

  await db
    .update(b2c_orders)
    .set({ provider_meta: nextMeta, updated_at: new Date() } as any)
    .where(eq(b2c_orders.id, order.id))
}

export class AfterShipTrackingService {
  async createTracking(params: {
    trackingNumber: string
    title?: string | null
    orderId?: string | null
    promisedDeliveryDate?: string | null
  }) {
    const trackingNumber = normalize(params.trackingNumber)
    if (trackingNumber.length < 4 || trackingNumber.length > 100) {
      throw new HttpError(400, 'AfterShip tracking number must be 4 to 100 characters long')
    }

    const tracking: Record<string, any> = {
      slug: SHADOWFAX_SLUG,
      tracking_number: trackingNumber,
    }

    const title = normalize(params.title)
    if (title) tracking.title = title

    const orderId = normalize(params.orderId)
    if (orderId) tracking.order_id = orderId

    const promisedDate = dateOnly(params.promisedDeliveryDate)
    if (promisedDate) tracking.order_promised_delivery_date = promisedDate

    try {
      const response = await buildClient().post('/trackings', { tracking })
      return response.data
    } catch (error: any) {
      if (isDuplicateTrackingError(error)) {
        return this.getTrackingBySlugAndNumber(SHADOWFAX_SLUG, trackingNumber)
      }

      throw new HttpError(
        error?.response?.status || 502,
        parseAfterShipError(error, 'AfterShip tracking creation failed'),
      )
    }
  }

  async getTrackingById(id: string, fields?: string) {
    const trackingId = normalize(id)
    if (!trackingId) throw new HttpError(400, 'AfterShip tracking ID is required')

    try {
      const response = await buildClient().get(`/trackings/${encodeURIComponent(trackingId)}`, {
        params: fields ? { fields } : undefined,
      })
      return response.data
    } catch (error: any) {
      throw new HttpError(
        error?.response?.status || 502,
        parseAfterShipError(error, 'AfterShip tracking retrieval failed'),
      )
    }
  }

  async getLastCheckpointById(id: string, fields?: string, lang?: string) {
    const trackingId = normalize(id)
    if (!trackingId) throw new HttpError(400, 'AfterShip tracking ID is required')

    const params: Record<string, string> = {}
    const selectedFields = normalize(fields)
    if (selectedFields) params.fields = selectedFields

    const selectedLanguage = normalize(lang)
    if (selectedLanguage) params.lang = selectedLanguage

    try {
      const response = await buildClient().get(
        `/last_checkpoint/${encodeURIComponent(trackingId)}`,
        {
          params: Object.keys(params).length ? params : undefined,
        },
      )
      return response.data
    } catch (error: any) {
      throw new HttpError(
        error?.response?.status || 502,
        parseAfterShipError(error, 'AfterShip last checkpoint retrieval failed'),
      )
    }
  }

  async updateTrackingById(id: string, params: AfterShipTrackingUpdateParams) {
    const trackingId = normalize(id)
    if (!trackingId) throw new HttpError(400, 'AfterShip tracking ID is required')

    const tracking = buildTrackingUpdate(params)
    if (!Object.keys(tracking).length) {
      throw new HttpError(400, 'At least one AfterShip tracking field is required for update')
    }

    try {
      const response = await buildClient().put(`/trackings/${encodeURIComponent(trackingId)}`, {
        value: { tracking },
      })
      return response.data
    } catch (error: any) {
      throw new HttpError(
        error?.response?.status || 502,
        parseAfterShipError(error, 'AfterShip tracking update failed'),
      )
    }
  }

  async deleteTrackingById(id: string) {
    const trackingId = normalize(id)
    if (!trackingId) throw new HttpError(400, 'AfterShip tracking ID is required')

    try {
      const response = await buildClient().delete(`/trackings/${encodeURIComponent(trackingId)}`)
      return response.data
    } catch (error: any) {
      throw new HttpError(
        error?.response?.status || 502,
        parseAfterShipError(error, 'AfterShip tracking deletion failed'),
      )
    }
  }

  async retrackTrackingById(id: string) {
    const trackingId = normalize(id)
    if (!trackingId) throw new HttpError(400, 'AfterShip tracking ID is required')

    try {
      const response = await buildClient().post(`/trackings/${encodeURIComponent(trackingId)}/retrack`)
      return response.data
    } catch (error: any) {
      throw new HttpError(
        error?.response?.status || 502,
        parseAfterShipError(error, 'AfterShip tracking retrack failed'),
      )
    }
  }

  async markTrackingAsCompletedById(id: string, reason: AfterShipTrackingCompletedReason | string) {
    const trackingId = normalize(id)
    if (!trackingId) throw new HttpError(400, 'AfterShip tracking ID is required')

    try {
      const response = await buildClient().post(
        `/trackings/${encodeURIComponent(trackingId)}/mark-as-completed`,
        {
          reason: normalizeCompletedReason(reason),
        },
      )
      return response.data
    } catch (error: any) {
      if (error instanceof HttpError) throw error
      throw new HttpError(
        error?.response?.status || 502,
        parseAfterShipError(error, 'AfterShip tracking completion failed'),
      )
    }
  }

  async predictEstimatedDeliveryDates(requests: AfterShipEstimatedDeliveryDateRequest[]) {
    if (!Array.isArray(requests) || requests.length < 1 || requests.length > 5) {
      throw new HttpError(
        400,
        'AfterShip EDD batch prediction requires between 1 and 5 estimated delivery date objects',
      )
    }

    const estimatedDeliveryDates = requests.map(buildEstimatedDeliveryDateRequest)

    try {
      const response = await buildClient().post('/estimated-delivery-date/predict-batch', {
        estimated_delivery_dates: estimatedDeliveryDates,
      })
      return response.data
    } catch (error: any) {
      throw new HttpError(
        error?.response?.status || 502,
        parseAfterShipError(error, 'AfterShip estimated delivery date prediction failed'),
      )
    }
  }

  async predictShadowfaxEstimatedDeliveryDates(
    requests: Omit<AfterShipEstimatedDeliveryDateRequest, 'slug'>[],
  ) {
    return this.predictEstimatedDeliveryDates(
      requests.map((request) => ({
        ...request,
        slug: SHADOWFAX_SLUG,
      })),
    )
  }

  async getTrackingBySlugAndNumber(slug: string, trackingNumber: string, fields?: string) {
    const normalizedSlug = normalize(slug)
    const normalizedTrackingNumber = normalize(trackingNumber)
    if (!normalizedSlug || !normalizedTrackingNumber) {
      throw new HttpError(400, 'AfterShip slug and tracking number are required')
    }

    try {
      const response = await buildClient().get(
        `/trackings/${encodeURIComponent(normalizedSlug)}/${encodeURIComponent(
          normalizedTrackingNumber,
        )}`,
        {
          params: fields ? { fields } : undefined,
        },
      )
      return response.data
    } catch (error: any) {
      throw new HttpError(
        error?.response?.status || 502,
        parseAfterShipError(error, 'AfterShip tracking retrieval failed'),
      )
    }
  }

  async getOrCreateShadowfaxTracking(order: AfterShipTrackableOrder) {
    const trackingNumber = normalize(order.awb_number)
    if (!trackingNumber) throw new HttpError(400, 'Shadowfax AWB number is required for AfterShip')

    const fields = 'title,order_id,tag,checkpoints'
    const existingTrackingId = normalize(order.provider_meta?.aftership_tracking_id)
    if (existingTrackingId) {
      try {
        const existing = await this.getTrackingById(existingTrackingId, fields)
        return isExpiredTracking(existing) ? await this.retrackTrackingById(existingTrackingId) : existing
      } catch (error: any) {
        if (error?.statusCode !== 404 && error?.status !== 404) throw error
      }
    }

    const created = await this.createTracking({
      trackingNumber,
      title: order.order_number || trackingNumber,
      orderId: order.order_id || order.order_number || order.id,
      promisedDeliveryDate: order.edd || null,
    })

    await persistAfterShipTrackingMeta(order, created)
    return created
  }

  async getShadowfaxLastCheckpoint(order: AfterShipTrackableOrder, fields?: string, lang?: string) {
    const trackingId = normalize(order.provider_meta?.aftership_tracking_id)
    if (trackingId) {
      return this.getLastCheckpointById(trackingId, fields, lang)
    }

    const created = await this.getOrCreateShadowfaxTracking(order)
    const createdTrackingId = getTrackingId(created)
    if (!createdTrackingId) {
      throw new HttpError(502, 'AfterShip did not return a tracking ID for last checkpoint')
    }

    return this.getLastCheckpointById(createdTrackingId, fields, lang)
  }

  async updateShadowfaxTracking(order: AfterShipTrackableOrder, params: AfterShipTrackingUpdateParams) {
    const trackingId = normalize(order.provider_meta?.aftership_tracking_id)
    if (!trackingId) {
      const created = await this.getOrCreateShadowfaxTracking(order)
      const createdTrackingId = getTrackingId(created)
      if (!createdTrackingId) {
        throw new HttpError(502, 'AfterShip did not return a tracking ID for update')
      }
      return this.updateTrackingById(createdTrackingId, params)
    }

    return this.updateTrackingById(trackingId, params)
  }

  async deleteShadowfaxTracking(order: AfterShipTrackableOrder) {
    const trackingId = normalize(order.provider_meta?.aftership_tracking_id)
    if (!trackingId) throw new HttpError(400, 'AfterShip tracking ID is not available for this order')
    return this.deleteTrackingById(trackingId)
  }

  async retrackShadowfaxTracking(order: AfterShipTrackableOrder) {
    const trackingId = normalize(order.provider_meta?.aftership_tracking_id)
    if (!trackingId) {
      return this.getOrCreateShadowfaxTracking(order)
    }

    return this.retrackTrackingById(trackingId)
  }

  async markShadowfaxTrackingAsCompleted(
    order: AfterShipTrackableOrder,
    reason: AfterShipTrackingCompletedReason | string,
  ) {
    const trackingId = normalize(order.provider_meta?.aftership_tracking_id)
    if (trackingId) {
      return this.markTrackingAsCompletedById(trackingId, reason)
    }

    const created = await this.getOrCreateShadowfaxTracking(order)
    const createdTrackingId = getTrackingId(created)
    if (!createdTrackingId) {
      throw new HttpError(502, 'AfterShip did not return a tracking ID for completion')
    }

    return this.markTrackingAsCompletedById(createdTrackingId, reason)
  }
}
