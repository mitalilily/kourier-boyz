import { Product } from '@/api/products'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
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
import { motion } from 'framer-motion'
import { ChevronsRight } from 'lucide-react'
import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

interface DealProductCardProps {
  product: Product
  onClick: () => void
}

const DealProductCard: React.FC<DealProductCardProps> = ({ product, onClick }) => {
  const navigate = useNavigate()
  const colorOptions = useMemo(() => extractProductColors(product), [product])
  const otherAttributeOptionCount = useMemo(() => {
    if (!product.attributeMetadata) return 0
    return Object.entries(product.attributeMetadata)
      .filter(([key]) => !key.toLowerCase().includes('color'))
      .reduce((sum, [, values]) => sum + values.length, 0)
  }, [product.attributeMetadata])

  const displayedColorOptions = useMemo(() => colorOptions.slice(0, 5), [colorOptions])
  const totalAdditionalOptions = otherAttributeOptionCount

  const variantColorImageMap = useMemo(() => buildVariantColorImageMap(product), [product])

  const normalizedVariants = useMemo<NormalizedVariant[]>(() => {
    if (!product.hasVariants || !Array.isArray(product.variants)) return []
    return (product.variants as RawVariant[]).map((variant) => normalizeVariantRecord(variant))
  }, [product.hasVariants, product.variants])

  const { preferred: preferredVariantByColor, variantImageByColor } = useMemo(
    () => buildPreferredVariantsByColor(normalizedVariants),
    [normalizedVariants],
  )

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

  const initialImage = useMemo(() => {
    if (fallbackVariant) {
      const variantImage = getVariantPrimaryImage(fallbackVariant)
      if (variantImage) return variantImage
    }
    return getInitialProductImage(product)
  }, [product, fallbackVariant])
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

    const defaultInStock = normalizedVariants.find(
      (variant) => variant.isDefault && (variant.stock ?? 0) > 0,
    )
    if (defaultInStock) return defaultInStock

    const firstInStock = normalizedVariants.find((variant) => (variant.stock ?? 0) > 0)
    if (firstInStock) return firstInStock

    const defaultVariant = normalizedVariants.find((variant) => variant.isDefault)
    if (defaultVariant) return defaultVariant

    return normalizedVariants[0] ?? null
  }, [selectedColorIndex, displayedColorOptions, preferredVariantByColor, normalizedVariants])

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
      if (fallbackVariant) {
        const colorLabel = getVariantColorLabel(fallbackVariant)
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

  return (
    <Card
      onClick={() => navigate(`/product/${product?.slug}`)}
      className=" bg-white/50 group relative w-full max-w-[240px] rounded-2xl py-2 px-1 overflow-hidden hover:shadow-sm transition-all duration-300 cursor-pointer"
    >
      <CardContent className="p-0 mb-2">
        {/* Product Image Section */}
        <div className="relative bg-white">
          <img
            src={displayImage || '/image-placeholder.svg'}
            alt={product.name}
            className="w-full max-h-[200px] object-contain bg-white transition-transform duration-300 group-hover:scale-[1.03]"
          />

          {/* View Details Button */}
          <motion.button
            onClick={(e) => {
              e.stopPropagation()
              onClick()
            }}
            className="absolute bottom-1 cursor-pointer right-2 w-7 h-7 rounded-full bg-yellow-400 hover:bg-yellow-500 flex items-center justify-center shadow-md"
            whileTap={{ scale: 0.95 }}
          >
            <ChevronsRight size={16} />
          </motion.button>
        </div>

        {/* Deal Badge */}
        <div className="flex px-2 mt-3 items-center gap-1 justify-between whitespace-nowrap">
          <Badge className=" bg-[#b91c1c] hover:bg-[#b91c1c]/80 border-none rounded-2xl text-white font-medium text-xs px-2 py-0.5">
            {discountPercent > 0 ? `${discountPercent}% off` : 'Limited time deal'}
          </Badge>
          {discountPercent > 0 && (
            <span className="text-[11px] mr-1 wrap-normal text-[#b91c1c] font-bold">
              Limited time deal
            </span>
          )}
        </div>

        {/* Price Section */}
        <div className="px-3 mt-1">
          <span className="text-[22px] font-semibold text-gray-900">
            ₹{price.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </span>
          {comparePrice !== undefined && comparePrice > price && (
            <span className="ml-2 text-sm text-gray-500 line-through">
              ₹
              {comparePrice.toLocaleString('en-IN', {
                maximumFractionDigits: 0,
              })}
            </span>
          )}
        </div>

        {/* Product Name */}
        <p className="px-3 mt-1 text-sm text-gray-800 leading-snug line-clamp-2">
          {product.name}
          {product.shortDescription && ` | ${product.shortDescription}`}
        </p>

        {/* Color Variants */}
        <div className="px-3 mt-2 flex items-center gap-2 min-h-[18px]">
          {displayedColorOptions.length > 1
            ? displayedColorOptions.map((option, index) => (
                <button
                  key={`${option.label}-${index}`}
                  onClick={(e) => handleColorClick(e, index)}
                  className={`relative w-4 h-4 rounded-full transition-all duration-200 ${
                    selectedColorIndex === index ? 'ring-1 ring-black ring-offset-2' : ''
                  }`}
                  style={{ backgroundColor: option.color }}
                  title={option.label}
                />
              ))
            : null}
          {displayedColorOptions.length === 0 && totalAdditionalOptions > 0 ? (
            <span className="text-xs font-medium text-slate-500">
              +{totalAdditionalOptions} other options
            </span>
          ) : null}
          {displayedColorOptions.length > 0 && totalAdditionalOptions > 0 ? (
            <span className="text-xs font-medium text-slate-500">
              +{totalAdditionalOptions} more options
            </span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

export default DealProductCard
