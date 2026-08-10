import { Product } from '@/api/products'
import ProductCard from '@/components/ui/ProductCard'
import {
  buildPreferredVariantsByColor,
  buildVariantColorImageMap,
  computeDiscountPercent,
  extractProductColors,
  getInitialProductImage,
  getVariantColorLabel,
  getVariantPrimaryImage,
  NormalizedVariant,
  normalizeLabel,
  normalizeVariantRecord,
  RawVariant,
} from '@/utils/productVariants'
import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

interface SearchProductCardProps {
  product: Product
}

const SearchProductCard: React.FC<SearchProductCardProps> = ({ product }) => {
  const navigate = useNavigate()

  const colorOptions = useMemo(() => extractProductColors(product), [product])
  const displayedColorOptions = useMemo(() => colorOptions.slice(0, 5), [colorOptions])
  const totalAdditionalOptions = useMemo(() => {
    if (!product.attributeMetadata) return 0
    return Object.entries(product.attributeMetadata)
      .filter(([key]) => !key.toLowerCase().includes('color'))
      .reduce((sum, [, values]) => sum + values.length, 0)
  }, [product.attributeMetadata])

  const variantColorImageMap = useMemo(() => buildVariantColorImageMap(product), [product])

  const normalizedVariants = useMemo<NormalizedVariant[]>(() => {
    if (!product.hasVariants || !Array.isArray(product.variants)) return []
    return (product.variants as RawVariant[]).map((variant) => normalizeVariantRecord(variant))
  }, [product.hasVariants, product.variants])

  const fallbackVariant = useMemo(() => {
    const defaultInStock = normalizedVariants.find(
      (variant) => variant.isDefault && (variant.stock ?? 0) > 0,
    )
    if (defaultInStock) return defaultInStock
    const firstInStock = normalizedVariants.find((variant) => (variant.stock ?? 0) > 0)
    if (firstInStock) return firstInStock
    const defaultVariant = normalizedVariants.find((variant) => variant.isDefault)
    if (defaultVariant) return defaultVariant
    return normalizedVariants[0] ?? null
  }, [normalizedVariants])

  const { preferred: preferredVariantByColor, variantImageByColor } = useMemo(
    () => buildPreferredVariantsByColor(normalizedVariants),
    [normalizedVariants],
  )

  const initialImage = useMemo(() => getInitialProductImage(product), [product])
  const [selectedColorIndex, setSelectedColorIndex] = useState<number | null>(null)
  const [displayImage, setDisplayImage] = useState<string | undefined>(initialImage)

  const activeVariant = useMemo(() => {
    if (selectedColorIndex !== null) {
      const selectedOption = displayedColorOptions[selectedColorIndex]
      if (selectedOption) {
        const normalized = normalizeLabel(selectedOption.label)
        if (normalized) {
          return preferredVariantByColor.get(normalized) ?? null
        }
      }
    }

    return fallbackVariant
  }, [selectedColorIndex, displayedColorOptions, preferredVariantByColor, fallbackVariant])

  const price = useMemo(() => {
    // Prefer effectivePrice (what customer actually pays)
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
        product.discountPercent,
      ),
    [price, comparePrice, activeVariant?.discountPercent, product.discountPercent],
  )

  useEffect(() => {
    setSelectedColorIndex(null)
    setDisplayImage(initialImage)
  }, [product._id, initialImage])

  useEffect(() => {
    if (selectedColorIndex !== null) return
    if (displayedColorOptions.length === 0) return

    const resolveIndex = () => {
      const preferredVariant =
        fallbackVariant ??
        normalizedVariants.find((variant) => variant.isDefault) ??
        normalizedVariants[0]
      if (preferredVariant) {
        const colorLabel = getVariantColorLabel(preferredVariant)
        if (colorLabel) {
          const normalized = normalizeLabel(colorLabel)
          const match = displayedColorOptions.findIndex(
            (option) => normalizeLabel(option.label) === normalized,
          )
          if (match >= 0) return match
        }
      }

      if (initialImage) {
        const match = displayedColorOptions.findIndex((option) => {
          const normalized = normalizeLabel(option.label)
          const preferredVariant = preferredVariantByColor.get(normalized)
          const variantImage =
            variantColorImageMap.get(normalized) ??
            variantImageByColor.get(normalized) ??
            (preferredVariant ? getVariantPrimaryImage(preferredVariant) : undefined)
          return variantImage !== undefined && variantImage === initialImage
        })

        if (match >= 0) return match
      }

      return 0
    }

    const index = resolveIndex()
    if (index < 0 || index >= displayedColorOptions.length) return

    setSelectedColorIndex(index)

    const selectedOption = displayedColorOptions[index]
    if (!selectedOption) return
    const normalized = normalizeLabel(selectedOption.label)
    if (!normalized) return

    const preferredVariant = preferredVariantByColor.get(normalized)
    const variantImage =
      variantColorImageMap.get(normalized) ??
      variantImageByColor.get(normalized) ??
      (preferredVariant ? getVariantPrimaryImage(preferredVariant) : undefined)

    if (variantImage) {
      setDisplayImage(variantImage)
    }
  }, [
    displayedColorOptions,
    selectedColorIndex,
    normalizedVariants,
    initialImage,
    variantColorImageMap,
    variantImageByColor,
    preferredVariantByColor,
    fallbackVariant,
  ])

  useEffect(() => {
    if (selectedColorIndex === null) return
    const selectedOption = displayedColorOptions[selectedColorIndex]
    if (!selectedOption) return
    const normalized = normalizeLabel(selectedOption.label)
    if (!normalized) return

    const preferredVariant = preferredVariantByColor.get(normalized)
    const variantImage =
      (preferredVariant ? getVariantPrimaryImage(preferredVariant) : undefined) ??
      variantColorImageMap.get(normalized) ??
      variantImageByColor.get(normalized) ??
      initialImage

    if (variantImage && variantImage !== displayImage) {
      setDisplayImage(variantImage)
    }
  }, [
    selectedColorIndex,
    displayedColorOptions,
    preferredVariantByColor,
    variantColorImageMap,
    variantImageByColor,
    initialImage,
    displayImage,
  ])

  const handleColorClick = (e: React.MouseEvent, index: number) => {
    e.stopPropagation()
    if (selectedColorIndex === index) return
    setSelectedColorIndex(index)
  }

  // Match product detail stock behaviour:
  // activeVariant.stock → product.stock → product.totalStock
  const stock = activeVariant?.stock ?? product.stock ?? product.totalStock

  return (
    <div className="flex flex-col gap-2">
      <ProductCard
        id={product._id}
        slug={product.slug}
        name={product.name}
        price={price}
        originalPrice={comparePrice}
        image={displayImage || '/image-placeholder.svg'}
        rating={product.rating}
        reviews={product.reviewCount}
        discount={discountPercent}
        description={product.description}
        shortDescription={product.shortDescription}
        stock={stock}
        variantId={activeVariant?._id || activeVariant?.id || undefined}
        product={product}
        disableVariantSelection={true}
        onClick={() => navigate(`/product/${product.slug || product._id}`)}
        colorOptions={displayedColorOptions}
        selectedColorIndex={selectedColorIndex}
        onSelectColor={handleColorClick}
        additionalColorOptionsCount={totalAdditionalOptions}
      />
    </div>
  )
}

export default SearchProductCard
