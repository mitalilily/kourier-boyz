import { Card, CardContent } from '@/components/ui/card'
import { Rating, RatingButton } from '@/components/ui/shadcn-io/rating'
import VariantSelectorSheet from '@/components/ui/VariantSelectorSheet'
import type { Product } from '@/api/products'
import { motion } from 'framer-motion'
import { Heart, Loader2 } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { useToggleWishlist, useWishlistStatus } from '../../api/wishlist'
import { useAuthStore } from '../../store/authStore'
import AddToCart from './AddToCart'

interface ProductCardProps {
  id: string | number
  slug?: string
  name: string
  price: number
  originalPrice?: number
  image: string
  rating?: number
  reviews?: number
  badge?: string
  discount?: number
  description?: string
  shortDescription?: string
  stock?: number
  variantId?: string
  buttonText?: string
  product?: Product // Full product data with variants for variant selection
  disableVariantSelection?: boolean // Disable variant selection sheet (for product detail, search pages)
  onAddToCart?: (id: string | number) => void
  onAddToWishlist?: (id: string | number) => void
  onClick?: (id: string | number) => void
  theme?: {
    primary?: string
    secondary?: string
    accent?: string
    text?: string
    textSecondary?: string
    surface?: string
    border?: string
  }
  colorOptions?: Array<{ label: string; color: string }>
  selectedColorIndex?: number | null
  onSelectColor?: (event: React.MouseEvent, index: number) => void
  additionalColorOptionsCount?: number
}

const ProductCard: React.FC<ProductCardProps> = ({
  id,
  slug,
  name,
  price,
  originalPrice,
  image,
  rating,
  reviews,
  discount,
  stock,
  variantId,
  product,
  disableVariantSelection = false,
  onAddToWishlist,
  onClick,
  colorOptions,
  selectedColorIndex,
  onSelectColor,
  additionalColorOptionsCount,
}) => {
  const { isAuthenticated } = useAuthStore()
  const { isInWishlist } = useWishlistStatus(String(id))
  const { toggleProduct, isLoading: isTogglingWishlist } = useToggleWishlist()
  const [isFavorite, setIsFavorite] = useState(false)
  const [isVariantSelectorOpen, setIsVariantSelectorOpen] = useState(false)

  // Update favorite state when wishlist status changes
  useEffect(() => {
    setIsFavorite(isInWishlist)
  }, [isInWishlist])

  const handleCardClick = () => {
    onClick?.(slug ?? id)
  }

  const handleWishlistClick = async (e: React.MouseEvent) => {
    e.stopPropagation()

    if (!isAuthenticated) {
      // Store product ID to add to wishlist after login
      localStorage.setItem('pendingWishlistProduct', String(id))

      // Redirect to login page
      window.location.href = `/login?redirect=${encodeURIComponent(
        window.location.pathname + window.location.search,
      )}`
      return
    }

    // Optimistically update UI
    setIsFavorite(!isFavorite)

    try {
      await toggleProduct(String(id), variantId)
      onAddToWishlist?.(id)
    } catch {
      // Revert on error
      setIsFavorite(!isFavorite)
    }
  }

  return (
    <Card
      className="group relative border-0 overflow-hidden cursor-pointer flex flex-col h-full rounded-2xl shadow-md hover:shadow-xl transition-all duration-300"
      onClick={handleCardClick}
    >
      {/* Top Section - Product Image */}
      <div className="relative h-48 sm:h-56 md:h-60 bg-white overflow-hidden rounded-t-2xl">
        {/* Heart Icon - Top Right */}
        <motion.button
          onClick={handleWishlistClick}
          disabled={isTogglingWishlist}
          className="absolute top-2 right-2 z-20 p-1.5 bg-white/95 backdrop-blur-sm rounded-full hover:bg-white transition-all shadow-lg hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed"
          whileTap={{ scale: 0.9 }}
        >
          {isTogglingWishlist ? (
            <Loader2 className="w-4 h-4 text-gray-600 animate-spin" />
          ) : (
            <Heart
              className={`w-4 h-4 ${isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-600'}`}
            />
          )}
        </motion.button>

        {/* Product Image */}
        <div className="relative h-full w-full p-2">
          <img
            src={image}
            alt={name}
            className="w-full h-full object-cover rounded-lg group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
            decoding="async"
            fetchPriority="low"
          />
        </div>
      </div>

      {/* Bottom Section - Product Details */}
      <CardContent className="flex-1 flex flex-col p-2.5 theme-bg-surface space-y-1.5">
        {/* Product Name */}
        <h3 className="text-sm sm:text-base font-semibold theme-text-primary line-clamp-2 min-h-8">
          {name}
        </h3>

        {/* Rating - Only if available */}
        {rating !== undefined && rating > 0 ? (
          <div className="flex items-center gap-1.5">
            <Rating value={rating} readOnly className="flex items-center">
              <RatingButton className="text-yellow" size={12} />
              <RatingButton className="text-yellow" size={12} />
              <RatingButton className="text-yellow" size={12} />
              <RatingButton className="text-yellow" size={12} />
              <RatingButton className="text-yellow" size={12} />
            </Rating>
            <span className="text-xs text-gray-600">
              {rating.toFixed(1)}
              {reviews !== undefined && reviews > 0 && ` (${reviews})`}
            </span>
          </div>
        ) : null}

        {/* Discount Badge - Above Price */}
        {discount && discount > 0 ? (
          <div className="mb-1">
            <span className="inline-flex items-center text-red-600 text-sm font-semibold italic rounded whitespace-nowrap">
              - {discount}%
            </span>
          </div>
        ) : null}

        {/* Price and Add to Cart - Bottom */}
        <div className="mt-auto space-y-2">
          {/* Price */}
          <div className="flex items-baseline gap-2">
            <span className="text-lg sm:text-xl font-bold text-gray-900">
              ₹{price?.toLocaleString()}
            </span>
            {originalPrice && originalPrice > price ? (
              <span className="text-sm line-through text-gray-500">
                ₹{originalPrice?.toLocaleString()}
              </span>
            ) : null}
          </div>

          {/* Color Options - Below Price */}
          {colorOptions && colorOptions.length > 0 ? (
            <div className="flex items-center gap-1.5">
              {colorOptions.slice(0, 5).map((option, index) => (
                <button
                  key={`${option.label}-${index}`}
                  onClick={(event) => {
                    event.stopPropagation()
                    onSelectColor?.(event, index)
                  }}
                  className={`w-4 h-4 rounded-full transition-all ${
                    selectedColorIndex === index
                      ? 'ring-2 ring-gray-900 ring-offset-1'
                      : 'hover:ring-1 hover:ring-gray-400'
                  }`}
                  style={{ backgroundColor: option.color }}
                  title={option.label}
                />
              ))}
              {(colorOptions.length > 5 || (additionalColorOptionsCount ?? 0) > 0) && (
                <span className="text-xs text-gray-500">
                  +{colorOptions.length > 5 ? colorOptions.length - 5 : additionalColorOptionsCount}
                </span>
              )}
            </div>
          ) : null}

          {/* Add To Cart */}
          <AddToCart
            productId={String(id)}
            variantId={variantId}
            stock={stock}
            minOrderQuantity={product?.minOrderQuantity ?? 1}
            size="sm"
            className="w-full"
            onAddToCartClick={
              // Only provide callback if product has variants and variant selection is not disabled
              !disableVariantSelection &&
              product?.hasVariants &&
              product?.variants &&
              product.variants.length > 0
                ? (e) => {
                    e?.stopPropagation()
                    setIsVariantSelectorOpen(true)
                  }
                : undefined
            }
          />
        </div>
      </CardContent>

      {/* Variant Selector Sheet */}
      {product?.hasVariants && product?.variants && product.variants.length > 0 && (
        <VariantSelectorSheet
          open={isVariantSelectorOpen}
          onOpenChange={setIsVariantSelectorOpen}
          product={product}
        />
      )}
    </Card>
  )
}

export default ProductCard
