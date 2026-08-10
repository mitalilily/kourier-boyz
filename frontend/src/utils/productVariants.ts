import { Product } from '@/api/products'
import { getColorHex } from '@/utils/color'

const ATTRIBUTE_NAME_MAP: Record<string, string> = {
  sleeve: 'Sleeve Length',
  sleeves: 'Sleeve Length',
  'sleeve length': 'Sleeve Length',
  length: 'Length',
  'dress length': 'Length',
  'skirt length': 'Length',
}

export type RawVariant = Record<string, unknown>

export interface NormalizedVariant {
  id: string
  _id?: string // Database ID (if available from raw variant)
  price?: number
  comparePrice?: number
  costPrice?: number
  discountPercent?: number
  effectivePrice?: number // What customer actually pays (from backend)
  profit?: number // Profit per unit (from backend)
  attributes: Record<string, string>
  mainImage?: string
  images: string[]
  isDefault: boolean
  stock?: number
}

const ensureStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return []
  return value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
}

export const normalizeAttributeName = (raw: string): string => {
  const lower = raw.trim().toLowerCase()
  if (!lower) return 'Specifications'
  if (ATTRIBUTE_NAME_MAP[lower]) return ATTRIBUTE_NAME_MAP[lower]
  if (lower.includes('sleeve')) return 'Sleeve Length'
  if (lower.includes('length')) return 'Length'
  if (lower.includes('material')) return 'Material'
  if (lower.includes('size')) return 'Size'
  if (lower.includes('color') || lower.includes('colour')) return 'Color'
  if (lower.includes('fit')) return 'Fit'
  if (lower.includes('neck')) return 'Neck Style'
  if (lower.includes('style')) return 'Style'
  return raw.trim()
}

export const normalizeVariantRecord = (variant: RawVariant): NormalizedVariant => {
  const rawId = (variant as { _id?: unknown })._id
  const id = rawId !== undefined && rawId !== null ? String(rawId) : ''

  const attributes: Record<string, string> = {}
  const rawAttributes = (variant as { attributes?: unknown }).attributes

  if (rawAttributes instanceof Map) {
    rawAttributes.forEach((value, key) => {
      if (value !== undefined && value !== null && value !== '') {
        attributes[String(key)] = String(value)
      }
    })
  } else if (rawAttributes && typeof rawAttributes === 'object') {
    Object.entries(rawAttributes as Record<string, unknown>).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        attributes[key] = String(value)
      }
    })
  }

  const priceValue = (variant as { price?: unknown; sellingPrice?: unknown }).price
  const sellingPriceValue = (variant as { sellingPrice?: unknown }).sellingPrice
  const comparePriceValue = (variant as { comparePrice?: unknown }).comparePrice
  const costPriceValue = (variant as { costPrice?: unknown }).costPrice
  const discountPercentValue = (variant as { discountPercent?: unknown }).discountPercent
  const effectivePriceValue = (variant as { effectivePrice?: unknown }).effectivePrice
  const profitValue = (variant as { profit?: unknown }).profit
  const mainImageValue = (variant as { mainImage?: unknown }).mainImage
  const isDefaultValue = (variant as { isDefault?: unknown }).isDefault
  const stockValue =
    (variant as { stock?: unknown }).stock ??
    (variant as { quantity?: unknown }).quantity ??
    (variant as { inventory?: unknown }).inventory

  const price =
    typeof effectivePriceValue === 'number'
      ? effectivePriceValue
      : typeof priceValue === 'number'
      ? priceValue
      : typeof sellingPriceValue === 'number'
      ? sellingPriceValue
      : undefined

  const comparePrice = typeof comparePriceValue === 'number' ? comparePriceValue : undefined
  const costPrice = typeof costPriceValue === 'number' ? costPriceValue : undefined
  const discountPercent =
    typeof discountPercentValue === 'number' ? discountPercentValue : undefined
  const effectivePrice = typeof effectivePriceValue === 'number' ? effectivePriceValue : undefined
  const profit = typeof profitValue === 'number' ? profitValue : undefined

  const images = ensureStringArray((variant as { images?: unknown }).images)
  const mainImage =
    typeof mainImageValue === 'string' && mainImageValue.trim().length > 0
      ? mainImageValue.trim()
      : undefined

  const stock =
    typeof stockValue === 'number' && Number.isFinite(stockValue) ? Number(stockValue) : undefined

  return {
    id,
    _id: rawId !== undefined && rawId !== null ? String(rawId) : undefined, // Store original _id if available
    price,
    comparePrice,
    costPrice,
    discountPercent,
    effectivePrice,
    profit,
    attributes,
    images,
    mainImage,
    isDefault: Boolean(isDefaultValue),
    stock,
  }
}

const isColorKey = (rawKey: string): boolean => {
  const lower = rawKey.trim().toLowerCase()
  return lower.includes('color') || lower.includes('colour')
}

export const getVariantColorLabel = (variant: NormalizedVariant): string | undefined => {
  const entry = Object.entries(variant.attributes).find(([key]) => isColorKey(key))
  if (!entry) return undefined
  const value = entry[1]
  return typeof value === 'string' ? value.trim() : undefined
}

export const getVariantPrimaryImage = (variant: NormalizedVariant): string | undefined => {
  if (variant.mainImage) {
    return variant.mainImage
  }
  return variant.images.find((image) => image.length > 0)
}

export const pickPreferredVariant = (
  current: NormalizedVariant | undefined,
  candidate: NormalizedVariant,
): NormalizedVariant => {
  if (!current) return candidate

  if (candidate.isDefault && !current.isDefault) return candidate
  if (!candidate.isDefault && current.isDefault) return current

  const currentPrice =
    typeof current.effectivePrice === 'number' && Number.isFinite(current.effectivePrice)
      ? current.effectivePrice
      : typeof current.price === 'number' && Number.isFinite(current.price)
      ? current.price
      : undefined
  const candidatePrice =
    typeof candidate.effectivePrice === 'number' && Number.isFinite(candidate.effectivePrice)
      ? candidate.effectivePrice
      : typeof candidate.price === 'number' && Number.isFinite(candidate.price)
      ? candidate.price
      : undefined

  if (candidatePrice !== undefined && currentPrice === undefined) return candidate
  if (candidatePrice === undefined && currentPrice !== undefined) return current
  if (candidatePrice !== undefined && currentPrice !== undefined && candidatePrice < currentPrice) {
    return candidate
  }

  const currentCompare =
    typeof current.comparePrice === 'number' && Number.isFinite(current.comparePrice)
      ? current.comparePrice
      : undefined
  const candidateCompare =
    typeof candidate.comparePrice === 'number' && Number.isFinite(candidate.comparePrice)
      ? candidate.comparePrice
      : undefined

  if (candidateCompare !== undefined && currentCompare === undefined) return candidate
  if (candidateCompare === undefined && currentCompare !== undefined) return current

  return current
}

export const normalizeLabel = (value: string): string => value.trim().toLowerCase()

export const computeDiscountPercent = (
  price: number,
  comparePrice?: number,
  variantDiscount?: number,
  productDiscount?: number,
): number => {
  if (typeof variantDiscount === 'number' && Number.isFinite(variantDiscount)) {
    return Math.max(0, Math.round(variantDiscount))
  }

  if (typeof comparePrice === 'number' && comparePrice > price) {
    const derived = Math.round(((comparePrice - price) / comparePrice) * 100)
    if (Number.isFinite(derived)) {
      return Math.max(0, derived)
    }
  }

  if (typeof productDiscount === 'number' && Number.isFinite(productDiscount)) {
    return Math.max(0, Math.round(productDiscount))
  }

  return 0
}

type NormalizedAttributeValue = { label: string; hex?: string }

const extractAttributeValueObjects = (raw: string): NormalizedAttributeValue[] => {
  const segments = raw
    .split(/[;,]/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)

  const results: NormalizedAttributeValue[] = []

  segments.forEach((segment) => {
    let workingSegment = segment
    const hexMatch = workingSegment.match(/#[0-9a-fA-F]{3,8}/)
    const hex = hexMatch ? hexMatch[0].toLowerCase() : undefined
    if (hex) {
      workingSegment = workingSegment.replace(/#[0-9a-fA-F]{3,8}/g, ' ')
    }

    const candidates = workingSegment
      .split('|')
      .map((entry) => entry.replace(/[()]/g, '').trim())
      .filter((entry) => entry.length > 0)

    if (candidates.length === 0 && hex) {
      candidates.push(hex)
    }

    if (candidates.length === 0) return

    candidates.forEach((label, index) => {
      results.push({ label, hex: index === 0 ? hex : undefined })
    })
  })

  return results
}

const normalizeKeyValuePairs = (rawKey: string, rawValue: string) => {
  const keys = rawKey
    .split('|')
    .map((key) => normalizeAttributeName(key))
    .filter((key) => key.length > 0)

  const values = extractAttributeValueObjects(rawValue)

  if (keys.length === 0) {
    keys.push(normalizeAttributeName('Specifications'))
  }

  if (values.length === 0) {
    const trimmed = rawValue.trim()
    if (trimmed) {
      values.push({ label: trimmed })
    }
  }

  return { keys, values }
}

export const extractProductColors = (product: Product): Array<{ label: string; color: string }> => {
  const colors = new Map<string, { label: string; color: string }>()

  const addColor = (label: string, hex?: string) => {
    const trimmedLabel = label.trim()
    if (!trimmedLabel) return
    const key = trimmedLabel.toLowerCase()
    if (colors.has(key)) {
      const existing = colors.get(key)!
      if (!existing.color.startsWith('#') && hex) {
        existing.color = hex
      }
      return
    }
    colors.set(key, {
      label: trimmedLabel,
      color: hex || getColorHex(trimmedLabel),
    })
  }

  if (product.attributeMetadata) {
    Object.entries(product.attributeMetadata).forEach(([attr, values]) => {
      if (attr.toLowerCase().includes('color')) {
        values.forEach((value) => addColor(value.label, value.hex))
      }
    })
  }

  const collect = (rawKey: string, rawValue: string) => {
    const { keys, values } = normalizeKeyValuePairs(rawKey, rawValue)
    if (!keys.some((key) => key.toLowerCase().includes('color'))) return
    values.forEach(({ label, hex }) => addColor(label, hex))
  }

  if (Array.isArray(product.specifications)) {
    product.specifications.forEach((spec) => {
      if (!spec) return
      collect(spec.key ?? '', spec.value ?? '')
    })
  }

  if (Array.isArray(product.features)) {
    product.features.forEach((feature) => {
      if (typeof feature !== 'string') return
      const featureText = feature.trim()
      if (!featureText) return
      const [rawKey, rawValue] = featureText.includes(':')
        ? featureText.split(':', 2)
        : ['Specifications', featureText]
      collect(rawKey, rawValue)
    })
  }

  return Array.from(colors.values())
}

export const getDisplayedColorOptions = (product: Product, limit = 5) =>
  extractProductColors(product).slice(0, limit)

export const buildVariantColorImageMap = (product: Product) => {
  if (!product.variantImages || product.variantImages.length === 0) return new Map<string, string>()
  const map = new Map<string, string>()
  product.variantImages.forEach((variant) => {
    Object.entries(variant.attributes || {}).forEach(([rawKey, value]) => {
      const key = rawKey.trim().toLowerCase()
      if (key.includes('color')) {
        const normalizedValue = value.trim().toLowerCase()
        if (!map.has(normalizedValue)) {
          map.set(normalizedValue, variant.mainImage || variant.images?.[0] || '')
        }
      }
    })
  })
  return map
}

export const buildPreferredVariantsByColor = (variants: NormalizedVariant[]) => {
  const preferred = new Map<string, NormalizedVariant>()
  const variantImageByColor = new Map<string, string>()

  variants.forEach((variant) => {
    const colorLabel = getVariantColorLabel(variant)
    if (!colorLabel) return
    const normalized = normalizeLabel(colorLabel)
    if (!normalized) return

    const nextPreferred = pickPreferredVariant(preferred.get(normalized), variant)
    preferred.set(normalized, nextPreferred)

    const candidateImage = getVariantPrimaryImage(variant)
    if (candidateImage && !variantImageByColor.has(normalized)) {
      variantImageByColor.set(normalized, candidateImage)
    }
  })

  return { preferred, variantImageByColor }
}

export const getInitialProductImage = (product: Product) => product.mainImage || product.images?.[0]
