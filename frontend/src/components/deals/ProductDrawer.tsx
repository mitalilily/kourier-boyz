import { useAddToCart } from '@/api/cart'
import { Product } from '@/api/products'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { getColorHex } from '@/utils/color'
import { X } from 'lucide-react'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

interface ProductDrawerProps {
  product: Product
  isOpen: boolean
  onClose: () => void
}

type RawVariant = Record<string, unknown>

interface NormalizedVariant {
  id: string
  price?: number
  effectivePrice?: number // What customer actually pays (from backend)
  comparePrice?: number
  discountPercent?: number
  calculatedDiscount?: number
  stock?: number
  attributes: Record<string, string>
  normalizedAttributes: Record<string, string>
  mainImage?: string
  images: string[]
  name?: string
  sku?: string
  isDefault: boolean
}

const ensureStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return []
  return value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
}

const normalizeAttributeKey = (key: string): string => key.trim().toLowerCase()

const normalizeVariantRecord = (variant: RawVariant): NormalizedVariant => {
  const rawId = (variant as { _id?: unknown })._id
  const id = rawId !== undefined && rawId !== null ? String(rawId) : ''

  const attributes: Record<string, string> = {}
  const normalizedAttributes: Record<string, string> = {}
  const rawAttributes = (variant as { attributes?: unknown }).attributes

  if (rawAttributes instanceof Map) {
    rawAttributes.forEach((value, key) => {
      if (value !== undefined && value !== null && value !== '') {
        const trimmedKey = String(key).trim()
        if (!trimmedKey) return
        const trimmedValue = String(value).trim()
        if (!trimmedValue) return
        attributes[trimmedKey] = trimmedValue
        normalizedAttributes[normalizeAttributeKey(trimmedKey)] = normalizeValue(trimmedValue)
      }
    })
  } else if (rawAttributes && typeof rawAttributes === 'object') {
    Object.entries(rawAttributes as Record<string, unknown>).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        const trimmedKey = String(key).trim()
        if (!trimmedKey) return
        const trimmedValue = String(value).trim()
        if (!trimmedValue) return
        attributes[trimmedKey] = trimmedValue
        normalizedAttributes[normalizeAttributeKey(trimmedKey)] = normalizeValue(trimmedValue)
      }
    })
  }

  const priceValue = (variant as { price?: unknown; sellingPrice?: unknown }).price
  const sellingPriceValue = (variant as { sellingPrice?: unknown }).sellingPrice
  const comparePriceValue = (variant as { comparePrice?: unknown }).comparePrice
  const discountPercentValue = (variant as { discountPercent?: unknown }).discountPercent
  const mainImageValue = (variant as { mainImage?: unknown }).mainImage
  const isDefaultValue = (variant as { isDefault?: unknown }).isDefault

  const price =
    typeof priceValue === 'number'
      ? priceValue
      : typeof sellingPriceValue === 'number'
      ? sellingPriceValue
      : undefined

  const comparePrice = typeof comparePriceValue === 'number' ? comparePriceValue : undefined
  const discountPercent =
    typeof discountPercentValue === 'number' ? discountPercentValue : undefined
  const calculatedDiscountValue = (variant as { calculatedDiscount?: unknown }).calculatedDiscount
  const calculatedDiscount =
    typeof calculatedDiscountValue === 'number' ? calculatedDiscountValue : undefined

  const stockValue = (variant as { stock?: unknown }).stock
  const stock =
    typeof stockValue === 'number' && Number.isFinite(stockValue) ? stockValue : undefined

  const images = ensureStringArray((variant as { images?: unknown }).images)
  const mainImage =
    typeof mainImageValue === 'string' && mainImageValue.trim().length > 0
      ? mainImageValue.trim()
      : undefined

  const nameValue = (variant as { name?: unknown }).name
  const name =
    typeof nameValue === 'string' && nameValue.trim().length > 0 ? nameValue.trim() : undefined

  const skuValue = (variant as { sku?: unknown }).sku
  const sku =
    typeof skuValue === 'string' && skuValue.trim().length > 0 ? skuValue.trim() : undefined

  return {
    id,
    price,
    comparePrice,
    discountPercent,
    calculatedDiscount,
    stock,
    attributes,
    normalizedAttributes,
    images,
    mainImage,
    name,
    sku,
    isDefault: Boolean(isDefaultValue),
  }
}

const normalizeValue = (value: string): string => value.trim().toLowerCase()

const getVariantPrimaryImage = (variant: NormalizedVariant): string | undefined => {
  if (variant.mainImage) return variant.mainImage
  return variant.images.find((img) => img.length > 0)
}

const computeDiscountPercent = (
  price: number,
  comparePrice?: number,
  variantDiscount?: number,
  variantCalculatedDiscount?: number,
  productDiscount?: number,
): number => {
  if (
    typeof variantCalculatedDiscount === 'number' &&
    Number.isFinite(variantCalculatedDiscount) &&
    variantCalculatedDiscount >= 0
  ) {
    return Math.round(variantCalculatedDiscount)
  }

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

const ProductDrawer: React.FC<ProductDrawerProps> = ({ product, isOpen, onClose }) => {
  const addToCartMutation = useAddToCart()

  const attributeMetadata = useMemo(
    () => product.attributeMetadata ?? {},
    [product.attributeMetadata],
  )

  const normalizedVariants = useMemo<NormalizedVariant[]>(() => {
    if (!product.hasVariants || !Array.isArray(product.variants)) return []
    return (product.variants as RawVariant[]).map((variant) => normalizeVariantRecord(variant))
  }, [product.hasVariants, product.variants])

  const attributeDisplayNameLookup = useMemo(() => {
    const lookup = new Map<string, string>()
    Object.keys(attributeMetadata).forEach((key) => {
      const trimmed = key.trim()
      if (!trimmed) return
      const normalizedKey = normalizeAttributeKey(trimmed)
      if (!lookup.has(normalizedKey)) {
        lookup.set(normalizedKey, trimmed)
      }
    })
    normalizedVariants.forEach((variant) => {
      Object.keys(variant.attributes).forEach((key) => {
        const trimmed = key.trim()
        if (!trimmed) return
        const normalizedKey = normalizeAttributeKey(trimmed)
        if (!lookup.has(normalizedKey)) {
          lookup.set(normalizedKey, trimmed)
        }
      })
    })
    return lookup
  }, [attributeMetadata, normalizedVariants])

  const toDisplayKey = useCallback(
    (rawKey: string): string => {
      const trimmed = rawKey.trim()
      if (!trimmed) return rawKey
      const normalized = normalizeAttributeKey(trimmed)
      return attributeDisplayNameLookup.get(normalized) ?? trimmed
    },
    [attributeDisplayNameLookup],
  )

  const attributeOptions = useMemo(() => {
    const optionBuckets = new Map<string, Map<string, { label: string; hex?: string }>>()

    normalizedVariants.forEach((variant) => {
      Object.entries(variant.attributes).forEach(([key, value]) => {
        if (!value) return
        const displayKey = toDisplayKey(key)
        const normalizedValue = normalizeValue(value)
        if (!optionBuckets.has(displayKey)) {
          optionBuckets.set(displayKey, new Map())
        }
        const bucket = optionBuckets.get(displayKey)!
        if (!bucket.has(normalizedValue)) {
          bucket.set(normalizedValue, { label: value })
        }
      })
    })

    Object.entries(attributeMetadata).forEach(([key, values]) => {
      const displayKey = toDisplayKey(key)
      const bucket = optionBuckets.get(displayKey)
      if (!bucket) return
      values.forEach((value) => {
        const normalizedValue = normalizeValue(value.label)
        const existing = bucket.get(normalizedValue)
        if (!existing) {
          bucket.set(normalizedValue, {
            label: value.label,
            hex: value.hex,
          })
        } else if (value.hex && !existing.hex) {
          existing.hex = value.hex
        }
      })
    })

    const result = new Map<string, Array<{ label: string; hex?: string }>>()
    optionBuckets.forEach((bucket, key) => {
      const ordered = Array.from(bucket.values()).sort((a, b) =>
        a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }),
      )
      result.set(key, ordered)
    })
    return result
  }, [normalizedVariants, attributeMetadata, toDisplayKey])

  const colorAttributeEntry = useMemo(() => {
    const candidateNames: string[] = []
    Object.keys(attributeMetadata).forEach((key) => {
      if (normalizeAttributeKey(key).includes('color')) {
        candidateNames.push(toDisplayKey(key))
      }
    })
    if (candidateNames.length === 0) {
      attributeOptions.forEach((_values, key) => {
        if (normalizeAttributeKey(key).includes('color')) {
          candidateNames.push(key)
        }
      })
    }
    const name = candidateNames[0]
    if (!name) return null
    const values = attributeOptions.get(name) ?? []
    if (values.length === 0) return null
    return {
      name,
      values: values.map((value) => ({
        label: value.label,
        color: value.hex || getColorHex(value.label),
      })),
    }
  }, [attributeMetadata, attributeOptions, toDisplayKey])

  const colorNormalizedKey = useMemo(
    () => (colorAttributeEntry ? normalizeAttributeKey(colorAttributeEntry.name) : null),
    [colorAttributeEntry],
  )

  const otherAttributes = useMemo(() => {
    const entries: Array<{ name: string; values: string[] }> = []
    const added = new Set<string>()

    const pushAttribute = (displayName: string | undefined) => {
      if (!displayName) return
      const normalizedName = normalizeAttributeKey(displayName)
      if (colorNormalizedKey && normalizedName === colorNormalizedKey) return
      if (added.has(normalizedName)) return
      const values = attributeOptions.get(displayName)
      if (!values || values.length === 0) return
      entries.push({
        name: displayName,
        values: values.map((value) => value.label),
      })
      added.add(normalizedName)
    }

    Object.keys(attributeMetadata).forEach((key) => pushAttribute(toDisplayKey(key)))
    attributeOptions.forEach((_values, key) => pushAttribute(key))

    return entries
  }, [attributeOptions, attributeMetadata, toDisplayKey, colorNormalizedKey])

  const convertVariantAttributesToDisplay = useCallback(
    (variant: NormalizedVariant): Record<string, string> => {
      const result: Record<string, string> = {}
      Object.entries(variant.attributes).forEach(([key, value]) => {
        if (!value) return
        const displayKey = toDisplayKey(key)
        result[displayKey] = value
      })
      return result
    },
    [toDisplayKey],
  )

  const variantColorImageMap = useMemo(() => {
    const map = new Map<string, string>()
    if (!colorNormalizedKey) return map

    if (Array.isArray(product.variantImages) && product.variantImages.length > 0) {
      product.variantImages.forEach((variant) => {
        Object.entries(variant.attributes || {}).forEach(([rawKey, rawValue]) => {
          if (!rawValue) return
          if (normalizeAttributeKey(rawKey) === colorNormalizedKey) {
            const normalizedValue = normalizeValue(rawValue)
            if (!map.has(normalizedValue)) {
              const fallbackImage = Array.isArray(variant.images)
                ? variant.images.find((img) => typeof img === 'string' && img.length > 0)
                : undefined
              map.set(normalizedValue, variant.mainImage || fallbackImage || '')
            }
          }
        })
      })
    }

    normalizedVariants.forEach((variant) => {
      const normalizedValue = variant.normalizedAttributes[colorNormalizedKey]
      if (!normalizedValue || map.has(normalizedValue)) return
      const primary = getVariantPrimaryImage(variant)
      if (primary) {
        map.set(normalizedValue, primary)
      }
    })

    if (colorAttributeEntry) {
      colorAttributeEntry.values.forEach((option) => {
        const normalizedValue = normalizeValue(option.label)
        if (!map.has(normalizedValue)) {
          map.set(normalizedValue, '')
        }
      })
    }

    return map
  }, [product.variantImages, normalizedVariants, colorAttributeEntry, colorNormalizedKey])

  const initialImage = useMemo(() => {
    if (product.mainImage) return product.mainImage
    if (Array.isArray(product.images) && product.images.length > 0) {
      return product.images[0]
    }
    const fallbackVariantImage = product.variantImages?.find(
      (variant) =>
        variant.mainImage || (Array.isArray(variant.images) && variant.images.length > 0),
    )
    if (fallbackVariantImage) {
      return (
        fallbackVariantImage.mainImage ||
        fallbackVariantImage.images?.find((img) => typeof img === 'string' && img.length > 0) ||
        '/products/default.webp'
      )
    }
    return '/products/default.webp'
  }, [product.mainImage, product.images, product.variantImages])

  const [selectedColorIndex, setSelectedColorIndex] = useState<number | null>(null)
  const [selectedAttributes, setSelectedAttributes] = useState<Record<string, string>>(() => ({}))
  const [displayImage, setDisplayImage] = useState<string>(initialImage)

  const defaultVariant = useMemo(() => {
    if (normalizedVariants.length === 0) return null
    const explicitDefault = normalizedVariants.find((variant) => variant.isDefault)
    if (explicitDefault) return explicitDefault
    if (colorNormalizedKey && normalizedVariants.length > 0) {
      const defaultColorValue = colorAttributeEntry?.values[0]?.label
      if (defaultColorValue) {
        const normalizedDefaultColor = normalizeValue(defaultColorValue)
        const matchDefaultColor = normalizedVariants.find(
          (variant) => variant.normalizedAttributes[colorNormalizedKey] === normalizedDefaultColor,
        )
        if (matchDefaultColor) return matchDefaultColor
      }
    }
    return normalizedVariants[0]
  }, [normalizedVariants, colorAttributeEntry, colorNormalizedKey])

  const findBestVariantForSelection = useCallback(
    (attributes: Record<string, string>): NormalizedVariant | null => {
      if (normalizedVariants.length === 0) return null
      const normalizedEntries = Object.entries(attributes)
        .map(([key, value]) => {
          const trimmedValue = value.trim()
          if (!trimmedValue) return null
          return [normalizeAttributeKey(key), normalizeValue(trimmedValue)] as const
        })
        .filter((entry): entry is readonly [string, string] => entry !== null)

      if (normalizedEntries.length === 0) {
        return defaultVariant
      }

      const fullMatch = normalizedVariants.find((variant) =>
        normalizedEntries.every(([normalizedKey, normalizedValue]) => {
          const variantValue = variant.normalizedAttributes[normalizedKey]
          return variantValue && variantValue === normalizedValue
        }),
      )
      if (fullMatch) return fullMatch

      if (colorNormalizedKey) {
        const desiredColorEntry = normalizedEntries.find(
          ([normalizedKey]) => normalizedKey === colorNormalizedKey,
        )
        const desiredColor = desiredColorEntry?.[1]
        if (desiredColor) {
          const colorMatch = normalizedVariants.find(
            (variant) => variant.normalizedAttributes[colorNormalizedKey] === desiredColor,
          )
          if (colorMatch) return colorMatch
        }
      }

      return defaultVariant
    },
    [normalizedVariants, defaultVariant, colorNormalizedKey],
  )

  const activeVariant = useMemo(
    () => findBestVariantForSelection(selectedAttributes),
    [findBestVariantForSelection, selectedAttributes],
  )

  const price = useMemo(() => {
    const variantEffectivePrice =
      typeof activeVariant?.effectivePrice === 'number' &&
      Number.isFinite(activeVariant.effectivePrice)
        ? activeVariant.effectivePrice
        : undefined
    const variantPrice =
      typeof activeVariant?.price === 'number' && Number.isFinite(activeVariant.price)
        ? activeVariant.price
        : undefined
    const productEffectivePrice =
      typeof product.effectivePrice === 'number' && Number.isFinite(product.effectivePrice)
        ? product.effectivePrice
        : undefined
    const productPrice =
      typeof product.price === 'number' && Number.isFinite(product.price)
        ? product.price
        : undefined
    const variantCompare =
      typeof activeVariant?.comparePrice === 'number' && Number.isFinite(activeVariant.comparePrice)
        ? activeVariant.comparePrice
        : undefined
    const productCompare =
      typeof product.comparePrice === 'number' && Number.isFinite(product.comparePrice)
        ? product.comparePrice
        : undefined

    if (variantEffectivePrice !== undefined && variantEffectivePrice > 0)
      return variantEffectivePrice
    if (variantPrice !== undefined && variantPrice > 0) return variantPrice
    if (productEffectivePrice !== undefined && productEffectivePrice > 0)
      return productEffectivePrice
    if (productPrice !== undefined && productPrice > 0) return productPrice
    if (variantEffectivePrice !== undefined) return variantEffectivePrice
    if (variantPrice !== undefined) return variantPrice
    if (productEffectivePrice !== undefined) return productEffectivePrice
    if (productPrice !== undefined) return productPrice
    if (variantCompare !== undefined) return variantCompare
    if (productCompare !== undefined) return productCompare
    return 0
  }, [activeVariant, product.effectivePrice, product.price, product.comparePrice])

  const comparePrice = useMemo(() => {
    const variantCompare =
      typeof activeVariant?.comparePrice === 'number' && Number.isFinite(activeVariant.comparePrice)
        ? activeVariant.comparePrice
        : undefined
    const productCompare =
      typeof product.comparePrice === 'number' && Number.isFinite(product.comparePrice)
        ? product.comparePrice
        : undefined

    return variantCompare ?? productCompare
  }, [activeVariant, product.comparePrice])

  const discountPercent = useMemo(
    () =>
      computeDiscountPercent(
        price,
        comparePrice,
        activeVariant?.discountPercent,
        activeVariant?.calculatedDiscount,
        product.discountPercent,
      ),
    [
      price,
      comparePrice,
      activeVariant?.discountPercent,
      activeVariant?.calculatedDiscount,
      product.discountPercent,
    ],
  )

  const savingsValue = useMemo(() => {
    if (comparePrice !== undefined && comparePrice > price) {
      return comparePrice - price
    }
    return undefined
  }, [comparePrice, price])

  const activeVariantDisplayAttributes = useMemo(
    () => (activeVariant ? convertVariantAttributesToDisplay(activeVariant) : null),
    [activeVariant, convertVariantAttributesToDisplay],
  )

  const selectedAttributeChips = useMemo(() => {
    const source = activeVariantDisplayAttributes ?? selectedAttributes
    return Object.entries(source)
      .filter(([, value]) => value && value.length > 0)
      .map(([key, value]) => ({ key, value }))
  }, [activeVariantDisplayAttributes, selectedAttributes])

  const stockStatus = useMemo(() => {
    const threshold =
      typeof product.lowStockThreshold === 'number' && Number.isFinite(product.lowStockThreshold)
        ? product.lowStockThreshold
        : 5

    if (typeof activeVariant?.stock === 'number' && Number.isFinite(activeVariant.stock)) {
      if (activeVariant.stock <= 0) {
        return { label: 'Out of stock', tone: 'text-red-600', stock: activeVariant.stock }
      }
      if (activeVariant.stock <= threshold) {
        return {
          label: `Only ${activeVariant.stock} left`,
          tone: 'text-amber-600',
          stock: activeVariant.stock,
        }
      }
      return { label: 'In stock', tone: 'text-emerald-600', stock: activeVariant.stock }
    }

    const aggregateStock =
      typeof product.stock === 'number' && Number.isFinite(product.stock)
        ? product.stock
        : typeof product.totalStock === 'number' && Number.isFinite(product.totalStock)
        ? product.totalStock
        : undefined

    if (aggregateStock === undefined) return null
    if (aggregateStock <= 0) {
      return { label: 'Currently unavailable', tone: 'text-red-600', stock: aggregateStock }
    }
    if (aggregateStock <= threshold) {
      return {
        label: `Only ${aggregateStock} left`,
        tone: 'text-amber-600',
        stock: aggregateStock,
      }
    }
    return { label: 'In stock', tone: 'text-emerald-600', stock: aggregateStock }
  }, [activeVariant?.stock, product.stock, product.totalStock, product.lowStockThreshold])

  const canAddToCart = useMemo(() => {
    const variantStock =
      typeof activeVariant?.stock === 'number' && Number.isFinite(activeVariant.stock)
        ? activeVariant.stock
        : undefined
    const productStock =
      typeof product.stock === 'number' && Number.isFinite(product.stock)
        ? product.stock
        : undefined
    const totalStock =
      typeof product.totalStock === 'number' && Number.isFinite(product.totalStock)
        ? product.totalStock
        : undefined

    if (variantStock !== undefined) return variantStock > 0
    if (productStock !== undefined) return productStock > 0
    if (totalStock !== undefined) return totalStock > 0
    return true
  }, [activeVariant?.stock, product.stock, product.totalStock])

  const addToCartPayload = useMemo(() => {
    const payload: { productId: string; variantId?: string; quantity?: number } = {
      productId: product._id,
      quantity: 1,
    }
    if (activeVariant?.id) {
      payload.variantId = activeVariant.id
    }
    return payload
  }, [product._id, activeVariant?.id])

  const galleryImages = useMemo(() => {
    const images = new Set<string>()
    if (displayImage) images.add(displayImage)
    if (activeVariant) {
      if (activeVariant.mainImage) images.add(activeVariant.mainImage)
      activeVariant.images.forEach((img) => {
        if (img) images.add(img)
      })
    }
    if (product.mainImage) images.add(product.mainImage)
    if (Array.isArray(product.images)) {
      product.images.forEach((img) => {
        if (img) images.add(img)
      })
    }
    if (Array.isArray(product.variantImages)) {
      product.variantImages.forEach((variant) => {
        if (variant.mainImage) images.add(variant.mainImage)
        if (Array.isArray(variant.images)) {
          variant.images.forEach((img) => {
            if (img) images.add(img)
          })
        }
      })
    }
    return Array.from(images).filter((img) => img.length > 0)
  }, [product.mainImage, product.images, product.variantImages, displayImage, activeVariant])

  useEffect(() => {
    if (defaultVariant) {
      const initialAttributes = convertVariantAttributesToDisplay(defaultVariant)
      setSelectedAttributes(initialAttributes)
      if (colorAttributeEntry) {
        const colorValue =
          initialAttributes[colorAttributeEntry.name] ?? colorAttributeEntry.values[0]?.label
        if (colorValue) {
          const normalized = normalizeValue(colorValue)
          const index = colorAttributeEntry.values.findIndex(
            (option) => normalizeValue(option.label) === normalized,
          )
          setSelectedColorIndex(index >= 0 ? index : null)
        } else {
          setSelectedColorIndex(null)
        }
      } else {
        setSelectedColorIndex(null)
      }
      const primary = getVariantPrimaryImage(defaultVariant) ?? initialImage
      setDisplayImage(primary)
    } else {
      setSelectedAttributes({})
      setSelectedColorIndex(null)
      setDisplayImage(initialImage)
    }
  }, [defaultVariant, colorAttributeEntry, initialImage, convertVariantAttributesToDisplay])

  useEffect(() => {
    if (!colorAttributeEntry) {
      if (selectedColorIndex !== null) {
        setSelectedColorIndex(null)
      }
      return
    }
    const selectedColor = selectedAttributes[colorAttributeEntry.name]
    if (!selectedColor) {
      if (selectedColorIndex !== null) {
        setSelectedColorIndex(null)
      }
      return
    }
    const normalized = normalizeValue(selectedColor)
    const index = colorAttributeEntry.values.findIndex(
      (option) => normalizeValue(option.label) === normalized,
    )
    if (index !== selectedColorIndex) {
      setSelectedColorIndex(index >= 0 ? index : null)
    }
  }, [selectedAttributes, colorAttributeEntry, selectedColorIndex])

  useEffect(() => {
    if (!activeVariant) return
    const primary = getVariantPrimaryImage(activeVariant)
    if (primary && primary !== displayImage) {
      setDisplayImage(primary)
    }
  }, [activeVariant, displayImage])

  useEffect(() => {
    if (!colorAttributeEntry || colorNormalizedKey === null) return
    if (selectedColorIndex === null) return
    const option = colorAttributeEntry.values[selectedColorIndex]
    if (!option) return
    const label = option.label ?? ''
    if (!label) return

    const normalizedLabel = normalizeValue(label)
    const preferredVariantForColor =
      normalizedVariants.find(
        (variant) => variant.normalizedAttributes[colorNormalizedKey] === normalizedLabel,
      ) ?? null

    if (preferredVariantForColor) {
      const displayAttributes = convertVariantAttributesToDisplay(preferredVariantForColor)
      setSelectedAttributes((prev) => {
        let changed = false
        const currentColor = prev[colorAttributeEntry.name]
        if (
          currentColor &&
          normalizeValue(currentColor) === normalizedLabel &&
          Object.entries(displayAttributes).every(([key, value]) => {
            const existing = prev[key]
            return !value || (existing && normalizeValue(existing) === normalizeValue(value))
          })
        ) {
          return prev
        }

        const next: Record<string, string> = { ...prev }

        Object.keys(next).forEach((key) => {
          if (
            !(key in displayAttributes) &&
            attributeOptions.has(key) &&
            key !== colorAttributeEntry.name
          ) {
            delete next[key]
            changed = true
          }
        })

        Object.entries(displayAttributes).forEach(([key, value]) => {
          if (!value) return
          if (next[key] !== value) {
            next[key] = value
            changed = true
          }
        })

        const finalColor = displayAttributes[colorAttributeEntry.name] ?? option.label
        if (next[colorAttributeEntry.name] !== finalColor) {
          next[colorAttributeEntry.name] = finalColor
          changed = true
        }

        return changed ? next : prev
      })
    } else {
      setSelectedAttributes((prev) => {
        if (prev[colorAttributeEntry.name] === label) return prev
        return {
          ...prev,
          [colorAttributeEntry.name]: label,
        }
      })
    }

    const mappedImage =
      preferredVariantForColor?.mainImage ??
      (preferredVariantForColor ? getVariantPrimaryImage(preferredVariantForColor) : undefined) ??
      variantColorImageMap.get(normalizedLabel)
    if (mappedImage && mappedImage !== displayImage) {
      setDisplayImage(mappedImage)
    }
  }, [
    colorAttributeEntry,
    colorNormalizedKey,
    normalizedVariants,
    selectedColorIndex,
    convertVariantAttributesToDisplay,
    attributeOptions,
    variantColorImageMap,
    displayImage,
  ])

  const handleColorClick = (index: number) => {
    setSelectedColorIndex(index)
  }

  const handleThumbnailClick = (image: string) => {
    setDisplayImage(image)
  }

  const handleAttributeSelect = (attributeName: string, value: string) => {
    setSelectedAttributes((prev) => {
      const trimmed = value.trim()
      const next = { ...prev, [attributeName]: trimmed }
      return next
    })

    if (colorAttributeEntry && attributeName === colorAttributeEntry.name) {
      const normalized = normalizeValue(value)
      const index = colorAttributeEntry.values.findIndex(
        (option) => normalizeValue(option.label) === normalized,
      )
      if (index >= 0) {
        setSelectedColorIndex(index)
      }
    }
  }

  useEffect(() => {
    if (!activeVariant) return
    const displayAttributes = convertVariantAttributesToDisplay(activeVariant)
    setSelectedAttributes((prev) => {
      let changed = false
      const next: Record<string, string> = { ...prev }

      Object.keys(next).forEach((key) => {
        if (!(key in displayAttributes) && attributeOptions.has(key)) {
          delete next[key]
          changed = true
        }
      })

      Object.entries(displayAttributes).forEach(([key, value]) => {
        if (!value) return
        if (next[key] !== value) {
          next[key] = value
          changed = true
        }
      })

      return changed ? next : prev
    })
  }, [activeVariant, convertVariantAttributesToDisplay, attributeOptions])

  const handleAddToCart = () => {
    // Allow guests to add to cart (guest cart will be used)
    // No need to redirect to login - guest cart functionality handles it

    addToCartMutation.mutate(addToCartPayload, {
      onSuccess: () => toast.success('Added to cart!'),
      onError: () => toast.error('Failed to add to cart'),
    })
  }

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full max-w-xl bg-white p-0 overflow-hidden h-full">
        <div className="relative flex flex-col h-full">
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute right-4 top-4 text-gray-600 hover:text-black transition"
          >
            <X size={22} />
          </button>

          <div className="flex-1 overflow-y-auto px-6 pb-24 pt-10">
            {/* Product Image */}
            <div className="flex flex-col items-center gap-4 mb-6">
              <div className="w-full flex justify-center">
                <img
                  src={displayImage || '/products/default.webp'}
                  alt={product.name}
                  className="max-h-64 object-contain rounded-lg bg-white shadow-sm"
                />
              </div>
              {galleryImages.length > 1 && (
                <div className="flex flex-wrap justify-center gap-2">
                  {galleryImages.map((image) => (
                    <button
                      key={image}
                      onClick={() => handleThumbnailClick(image)}
                      className={cn(
                        'h-16 w-16 overflow-hidden rounded-md border transition',
                        displayImage === image
                          ? 'border-indigo-500 ring-2 ring-indigo-200'
                          : 'border-transparent hover:border-gray-300',
                      )}
                    >
                      <img
                        src={image}
                        alt={`Thumbnail for ${product.name}`}
                        className="h-full w-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Title */}
            <SheetHeader className="text-left mb-4">
              <SheetTitle className="text-base font-medium text-gray-900 leading-snug">
                {product.name}
              </SheetTitle>
            </SheetHeader>

            {colorAttributeEntry && (
              <div className="mb-4">
                <p className="text-sm font-medium text-gray-900 mb-2">{colorAttributeEntry.name}</p>
                <div className="flex flex-wrap items-center gap-3">
                  {colorAttributeEntry.values.map((option, index) => (
                    <button
                      key={`${option.label}-${index}`}
                      onClick={() => handleColorClick(index)}
                      className={cn(
                        'relative h-10 w-10 rounded-full border-2 transition-all duration-200',
                        selectedColorIndex === index
                          ? 'border-indigo-500 ring-2 ring-indigo-200 ring-offset-1'
                          : 'border-gray-200 hover:border-gray-300',
                      )}
                      style={{ backgroundColor: option.color }}
                      title={option.label}
                    />
                  ))}
                </div>
              </div>
            )}

            {otherAttributes.length > 0 && (
              <div className="space-y-4 mb-6">
                <Separator className="my-2" />
                <div className="space-y-4">
                  {otherAttributes.map((attribute) => (
                    <div key={attribute.name}>
                      <p className="text-sm font-medium text-gray-900 mb-2">{attribute.name}</p>
                      <div className="flex flex-wrap gap-2">
                        {attribute.values.map((value) => (
                          <button
                            key={`${attribute.name}-${value}`}
                            onClick={() => handleAttributeSelect(attribute.name, value)}
                            className={cn(
                              'rounded-full border px-3 py-1 text-xs font-medium transition',
                              selectedAttributes[attribute.name] === value
                                ? 'border-indigo-500 bg-indigo-500/10 text-indigo-600'
                                : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-gray-300',
                            )}
                          >
                            {value}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Deal Badge */}
            {discountPercent > 0 && (
              <div className="mb-2">
                <Badge className="bg-red-600 border-none text-white text-xs font-semibold px-2 py-1 rounded-full">
                  Save {discountPercent}% today
                </Badge>
              </div>
            )}

            {activeVariant?.name && (
              <p className="ml-1 mt-1 text-sm text-gray-600">
                Selected variant: {activeVariant.name}
              </p>
            )}

            {(activeVariant?.sku || product.sku) && (
              <p className="ml-1 mt-1 text-xs text-gray-500">
                SKU: {activeVariant?.sku ?? product.sku}
              </p>
            )}

            {/* Price */}
            <div className="ml-1 mt-4 mb-4 space-y-2">
              <div className="flex items-baseline gap-3">
                <span className="text-xl font-semibold text-gray-900">
                  ₹
                  {price.toLocaleString('en-IN', {
                    maximumFractionDigits: 0,
                  })}
                </span>
                {comparePrice !== undefined && comparePrice > price && (
                  <span className="text-lg text-gray-500 line-through">
                    ₹
                    {comparePrice.toLocaleString('en-IN', {
                      maximumFractionDigits: 0,
                    })}
                  </span>
                )}
              </div>

              {savingsValue !== undefined && savingsValue > 0 && (
                <p className="text-sm text-green-700">
                  You save ₹{savingsValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </p>
              )}
            </div>

            {stockStatus && (
              <p className={`ml-1 mb-4 text-sm font-medium ${stockStatus.tone}`}>
                {stockStatus.label}
              </p>
            )}

            {selectedAttributeChips.length > 0 && (
              <div className="ml-1 mb-6 flex flex-wrap gap-2">
                {selectedAttributeChips.map(({ key, value }) => (
                  <span
                    key={`${key}-${value}`}
                    className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
                  >
                    {key}: {value}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Footer - Add to Cart */}
          <div className="absolute bottom-0 left-0 right-0 border-t border-gray-200 bg-white p-5">
            <Button
              className="w-full"
              onClick={handleAddToCart}
              disabled={addToCartMutation.isPending || !canAddToCart}
              size="lg"
            >
              {addToCartMutation.isPending ? (
                <>
                  <div className="w-5 h-5 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
                  <span>Adding...</span>
                </>
              ) : canAddToCart ? (
                <span>Add to Cart</span>
              ) : (
                <span>Out of Stock</span>
              )}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

export default ProductDrawer
