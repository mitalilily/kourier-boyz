import ProductVariant from '../models/ProductVariant'

const COLOR_KEYWORDS = ['color', 'colour']

const normalizeAttributeName = (raw: string): string => {
  const lower = raw.trim().toLowerCase()
  if (!lower) return 'Specifications'
  if (lower.includes('sleeve')) return 'Sleeve Length'
  if (lower.includes('length')) return 'Length'
  if (lower.includes('material')) return 'Material'
  if (lower.includes('size')) return 'Size'
  if (lower.includes('fit')) return 'Fit'
  if (lower.includes('neck')) return 'Neck Style'
  if (lower.includes('style')) return 'Style'
  if (lower.includes('color') || lower.includes('colour')) return 'Color'
  return raw.trim()
}

const extractAttributeValues = (raw: string): Array<{ label: string; hex?: string }> => {
  const segments = raw
    .split(/[;,]/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)

  const results: Array<{ label: string; hex?: string }> = []

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

const normalizeAttributeKeyValuePairs = (rawKey: string, rawValue: string) => {
  const keys = rawKey
    .split('|')
    .map((key) => normalizeAttributeName(key))
    .filter((key) => key.length > 0)

  const values = extractAttributeValues(rawValue)

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

const buildProductAttributeMetadata = (
  product: Record<string, any>,
  variantsByProduct: Record<string, any[]>,
) => {
  const attributeMap = new Map<string, Map<string, { label: string; hex?: string }>>()

  const collect = (rawKey: string, rawValue: string) => {
    const { keys, values } = normalizeAttributeKeyValuePairs(rawKey, rawValue)
    keys.forEach((key) => {
      const trimmedKey = key.trim()
      if (!trimmedKey) return
      if (!attributeMap.has(trimmedKey)) {
        attributeMap.set(trimmedKey, new Map())
      }
      const store = attributeMap.get(trimmedKey)!
      values.forEach(({ label, hex }) => {
        const normalizedLabel = label.trim().toLowerCase()
        if (!normalizedLabel) return
        const existing = store.get(normalizedLabel)
        if (!existing) {
          store.set(normalizedLabel, { label: label.trim(), hex: hex?.toLowerCase() })
        } else if (!existing.hex && hex) {
          existing.hex = hex.toLowerCase()
        }
      })
    })
  }

  const productId = product?._id ? String(product._id) : undefined
  if (productId && variantsByProduct[productId]) {
    variantsByProduct[productId].forEach((variant) => {
      const attrs =
        variant.attributes instanceof Map
          ? Object.fromEntries(variant.attributes)
          : (variant.attributes as Record<string, string>)
      if (attrs && typeof attrs === 'object') {
        Object.entries(attrs).forEach(([rawKey, value]) => {
          if (value === undefined || value === null) return
          collect(rawKey, value.toString())
        })
      }
    })
  }

  if (Array.isArray(product?.specifications)) {
    product.specifications.forEach((spec: any) => {
      if (!spec) return
      collect(spec.key ?? '', spec.value ?? '')
    })
  }

  if (Array.isArray(product?.features)) {
    product.features.forEach((feature: any) => {
      if (typeof feature !== 'string') return
      const featureText = feature.trim()
      if (!featureText) return
      const [rawKey, rawValue] = featureText.includes(':')
        ? featureText.split(':', 2)
        : ['Specifications', featureText]
      collect(rawKey, rawValue)
    })
  }

  if (Array.isArray(product?.filterMetadata)) {
    product.filterMetadata.forEach((entry: any) => {
      if (!entry || typeof entry !== 'object') return
      const key = typeof entry.key === 'string' ? entry.key : ''
      const normalizedKey = normalizeAttributeName(key || 'Specifications')

      const valuesSource = entry.values
      const values: string[] = Array.isArray(valuesSource)
        ? valuesSource
            .map((value) =>
              typeof value === 'string'
                ? value
                : value !== undefined && value !== null
                ? String(value)
                : '',
            )
            .filter((value) => value.trim().length > 0)
        : typeof valuesSource === 'string'
        ? valuesSource
            .split(',')
            .map((value) => value.trim())
            .filter((value) => value.length > 0)
        : []

      values.forEach((value) => collect(normalizedKey, value))
    })
  }

  const result: Record<string, Array<{ label: string; hex?: string }>> = {}
  attributeMap.forEach((valueMap, key) => {
    result[key] = Array.from(valueMap.values())
  })
  return result
}

const computeDiscount = (price?: number, comparePrice?: number): number | undefined => {
  if (
    price === null ||
    price === undefined ||
    comparePrice === null ||
    comparePrice === undefined ||
    comparePrice <= price
  ) {
    return undefined
  }

  const raw = Math.round(((comparePrice - price) / comparePrice) * 100)
  return Number.isFinite(raw) ? raw : undefined
}

const normalizeVariantAttributes = (variant: any): Record<string, string> => {
  const attributes: Record<string, string> = {}
  const rawAttributes = variant?.attributes
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
  return attributes
}

const normalizeVariantRecord = (variant: any) => {
  const price =
    typeof variant.effectivePrice === 'number' && Number.isFinite(variant.effectivePrice)
      ? variant.effectivePrice
      : typeof variant.price === 'number'
      ? variant.price
      : typeof variant.sellingPrice === 'number'
      ? variant.sellingPrice
      : undefined

  const comparePrice = typeof variant.comparePrice === 'number' ? variant.comparePrice : undefined
  const discountPercent =
    typeof variant.discountPercent === 'number'
      ? Math.max(0, Math.round(variant.discountPercent))
      : undefined

  const images = Array.isArray(variant.images)
    ? variant.images.filter(
        (img: unknown): img is string => typeof img === 'string' && img.length > 0,
      )
    : []

  const mainImage =
    typeof variant.mainImage === 'string' && variant.mainImage.trim().length > 0
      ? variant.mainImage.trim()
      : images[0]

  return {
    _id: String(variant._id),
    price,
    comparePrice,
    discountPercent,
    attributes: normalizeVariantAttributes(variant),
    images,
    mainImage,
    isDefault: Boolean(variant.isDefault),
    stock:
      typeof variant.stock === 'number' && Number.isFinite(variant.stock)
        ? variant.stock
        : undefined,
  }
}

const buildVariantImageSummaries = (
  variants: Array<ReturnType<typeof normalizeVariantRecord>>,
): Array<{ attributes: Record<string, string>; mainImage?: string; images?: string[] }> => {
  const summaries: Array<{
    attributes: Record<string, string>
    mainImage?: string
    images?: string[]
  }> = []
  variants.forEach((variant) => {
    const colorEntry = Object.entries(variant.attributes).find(([key]) =>
      COLOR_KEYWORDS.some((keyword) => key.toLowerCase().includes(keyword)),
    )
    if (!colorEntry) return
    const [key, value] = colorEntry
    if (!value) return
    summaries.push({
      attributes: { [key]: value },
      mainImage: variant.mainImage,
      images: variant.images,
    })
  })
  return summaries
}

export const hydrateSearchProducts = async <T extends Record<string, any>>(
  products: T[],
): Promise<T[]> => {
  if (!products.length) return products
  const productIds = products
    .map((product) => product?._id)
    .filter((id): id is string | number => Boolean(id))

  const variantDocs = await ProductVariant.find({
    product: { $in: productIds },
    status: { $in: ['active', 'out_of_stock'] },
  })
    .select(
      'product attributes status mainImage images price effectivePrice sellingPrice comparePrice discountPercent stock isDefault',
    )
    .lean()

  const variantsByProduct = variantDocs.reduce<Record<string, any[]>>((acc, variant) => {
    const key = String(variant.product)
    if (!acc[key]) {
      acc[key] = []
    }
    acc[key].push(variant)
    return acc
  }, {})

  return products.map((product) => {
    const productId = product?._id ? String(product._id) : undefined
    const productVariants = productId ? variantsByProduct[productId] || [] : []
    const normalizedVariants = productVariants.map((variant) => normalizeVariantRecord(variant))
    const priceCandidates = [
      typeof product.effectivePrice === 'number' && Number.isFinite(product.effectivePrice)
        ? product.effectivePrice
        : typeof product.price === 'number'
        ? product.price
        : undefined,
      ...normalizedVariants.map((v) =>
        typeof v.price === 'number' && Number.isFinite(v.price) ? v.price : undefined,
      ),
    ].filter((value): value is number => typeof value === 'number' && Number.isFinite(value))

    const comparePriceCandidates = [
      typeof product.comparePrice === 'number' ? product.comparePrice : undefined,
      ...normalizedVariants.map((variant) => variant.comparePrice),
    ].filter((value): value is number => typeof value === 'number' && Number.isFinite(value))

    const discountCandidates = [
      typeof product.discountPercent === 'number' ? product.discountPercent : undefined,
      computeDiscount(
        typeof product.price === 'number' ? product.price : undefined,
        typeof product.comparePrice === 'number' ? product.comparePrice : undefined,
      ),
      ...normalizedVariants.map((variant) => {
        const derived = computeDiscount(variant.price, variant.comparePrice)
        return derived !== undefined ? derived : variant.discountPercent
      }),
    ].filter((value): value is number => typeof value === 'number' && Number.isFinite(value))

    const attributeMetadata = buildProductAttributeMetadata(product, variantsByProduct)

    const variantImages = buildVariantImageSummaries(normalizedVariants)

    return {
      ...product,
      variants: normalizedVariants,
      variantImages,
      attributeMetadata: Object.keys(attributeMetadata).length
        ? attributeMetadata
        : product.attributeMetadata,
      minPrice: priceCandidates.length ? Math.min(...priceCandidates) : product.minPrice,
      maxPrice: priceCandidates.length ? Math.max(...priceCandidates) : product.maxPrice,
      calculatedDiscount: discountCandidates.length
        ? Math.max(...discountCandidates)
        : product.calculatedDiscount ?? product.discountPercent,
    }
  })
}
