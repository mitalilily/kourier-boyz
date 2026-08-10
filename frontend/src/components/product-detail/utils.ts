// Reuse serviceability types from API to avoid duplication and maintain type consistency
import type { ServiceabilityResponse } from '@/api/products'

export type ProductVariant = {
  _id: string
  name: string
  price?: number
  comparePrice?: number
  costPrice?: number
  discountPercent?: number
  effectivePrice?: number // What customer actually pays (from backend)
  profit?: number // Profit per unit (from backend)
  stock?: number
  attributes?: Record<string, string>
  images?: string[]
  videos?: string[]
  mainImage?: string
  isDefault?: boolean
}

export type RawProductVariant = {
  _id?: string
  name?: string
  price?: number
  sellingPrice?: number
  comparePrice?: number
  costPrice?: number
  discountPercent?: number
  effectivePrice?: number
  profit?: number
  stock?: number
  attributes?: Record<string, string> | Map<string, string>
  images?: string[]
  videos?: string[]
  mainImage?: string
  isDefault?: boolean
}

export const FALLBACK_IMAGE = '/image-placeholder.svg'

export const normalizeVariant = (variant: RawProductVariant): ProductVariant => {
  const attributes: Record<string, string> = {}

  const rawAttributes = variant?.attributes

  if (rawAttributes instanceof Map) {
    rawAttributes.forEach((value, key) => {
      if (value !== undefined && value !== null && value !== '') {
        attributes[key] = String(value)
      }
    })
  } else if (rawAttributes && typeof rawAttributes === 'object') {
    Object.entries(rawAttributes).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        attributes[key] = String(value)
      }
    })
  }

  return {
    _id: String(variant?._id),
    name: variant?.name ?? '',
    price: variant?.effectivePrice ?? variant?.price ?? variant?.sellingPrice ?? undefined,
    comparePrice: variant?.comparePrice ?? undefined,
    costPrice: variant?.costPrice ?? undefined,
    discountPercent: variant?.discountPercent ?? undefined,
    effectivePrice: variant?.effectivePrice ?? undefined, // From backend
    profit: variant?.profit ?? undefined, // From backend
    stock: typeof variant?.stock === 'number' ? variant.stock : undefined,
    attributes,
    images: Array.isArray(variant?.images) ? variant.images : [],
    videos: Array.isArray(variant?.videos) ? variant.videos : [],
    mainImage: variant?.mainImage ?? undefined,
    isDefault: Boolean(variant?.isDefault),
  }
}

export const formatCurrency = (value?: number) => {
  if (value === undefined || value === null) return undefined
  return value.toLocaleString('en-IN')
}

export const calculateDiscount = (price?: number, comparePrice?: number, provided?: number) => {
  if (typeof provided === 'number') {
    return Math.round(provided)
  }
  if (typeof price === 'number' && typeof comparePrice === 'number' && comparePrice > price) {
    return Math.round(((comparePrice - price) / comparePrice) * 100)
  }
  return undefined
}

export const formatDeliveryDate = (value?: number | string | Date): string | undefined => {
  if (value === undefined || value === null) {
    return undefined
  }

  const date =
    typeof value === 'number'
      ? (() => {
          const d = new Date()
          d.setDate(d.getDate() + value)
          return d
        })()
      : typeof value === 'string'
      ? new Date(value)
      : value

  if (Number.isNaN(date.getTime())) {
    return undefined
  }

  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(date)
}

export const getDeliveryDateLabel = (deliveryDate?: string, fallbackDays?: string) => {
  const directLabel = formatDeliveryDate(deliveryDate)
  if (directLabel) {
    return directLabel
  }

  if (fallbackDays) {
    const match = fallbackDays.match(/^(\d+)/)
    if (match) {
      const daysAhead = Number.parseInt(match[1], 10)
      if (Number.isFinite(daysAhead)) {
        return formatDeliveryDate(daysAhead)
      }
    }
  }

  return undefined
}

export const formatDateTime = (value?: string | Date) => {
  if (!value) return '—'
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export const formatRelativeTime = (value?: string | Date) => {
  if (!value) return '—'
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return '—'
  const diff = Date.now() - date.getTime()
  const minutes = Math.round(diff / 60000)
  if (Math.abs(minutes) < 60) {
    return `${minutes}m ago`
  }
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 24) {
    return `${hours}h ago`
  }
  const days = Math.round(hours / 24)
  if (Math.abs(days) < 30) {
    return `${days}d ago`
  }
  const months = Math.round(days / 30)
  if (Math.abs(months) < 12) {
    return `${months}mo ago`
  }
  const years = Math.round(months / 12)
  return `${years}y ago`
}

export const sanitizePinCode = (value: string) => value.replace(/\D/g, '')

export type PersonalViewStats = {
  count: number
  firstSeenFormatted: string
  lastSeenFormatted: string
  firstSeenRelative: string
  lastSeenRelative: string
}

/**
 * Serviceability data structure from the delivery API.
 * Reuses the type from the API layer to maintain single source of truth.
 */
export type ServiceabilityData = ServiceabilityResponse['data']

/**
 * Delivery status for product detail page.
 * Represents the current state of delivery availability check with optional serviceability data.
 */
export type DeliveryStatus = null | {
  status: 'success' | 'error'
  message: string
  etaDate?: string
  serviceabilityData?: ServiceabilityData
}
