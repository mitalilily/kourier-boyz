import { useAddToCart, useCart } from '@/api/cart'
import { useAddToWishlist, useWishlistStatus } from '@/api/wishlist'
import { useAuthStore } from '@/store/authStore'
import { guestCartUtils } from '@/utils/guestCart'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import VariantSelectorSheet from '@/components/ui/VariantSelectorSheet'
import { formatCurrency } from '@/utils'
import { motion } from 'framer-motion'
import { Check, Clock, Heart, Loader2, ShoppingCart, Star } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import type { Product } from '../../api/products'

interface HistoryItemCardProps {
  product: Product
  viewInfo?: {
    viewCount: number
    firstViewedAt: string
    lastViewedAt: string
  }
}

const HistoryItemCard: React.FC<HistoryItemCardProps> = ({ product, viewInfo }) => {
  const addToCartMutation = useAddToCart()
  const addToWishlistMutation = useAddToWishlist()
  const [isVariantSelectorOpen, setIsVariantSelectorOpen] = useState(false)
  const { isInWishlist } = useWishlistStatus(product._id)
  const { isAuthenticated } = useAuthStore()
  const { data: cartData } = useCart()
  const cart = cartData?.data || cartData?.cart
  const [guestCartUpdate, setGuestCartUpdate] = useState(0) // Force re-render on guest cart updates

  // Listen to guest cart updates for non-authenticated users
  useEffect(() => {
    if (!isAuthenticated) {
      const handleGuestCartUpdate = () => {
        setGuestCartUpdate((prev) => prev + 1)
      }
      window.addEventListener('guest-cart-updated', handleGuestCartUpdate)
      return () => {
        window.removeEventListener('guest-cart-updated', handleGuestCartUpdate)
      }
    }
  }, [isAuthenticated])

  // Check if product/variant is in cart
  const isInCart = useMemo(() => {
    if (isAuthenticated) {
      // Check authenticated cart
      if (!cart?.items) return false
      
      // For products with variants, check if default variant is in cart
      if (
        product.hasVariants &&
        product.variants &&
        Array.isArray(product.variants) &&
        product.variants.length > 0
      ) {
        const defaultVariant = product.variants.find((v) => v.isDefault) || product.variants[0]
        const variantId = defaultVariant?._id ? String(defaultVariant._id) : undefined
        return cart.items.some(
          (item) =>
            item.product._id === product._id &&
            (variantId ? item.variantId === variantId : !item.variantId)
        )
      }
      
      // For products without variants, check if product is in cart (without variant)
      return cart.items.some(
        (item) => item.product._id === product._id && !item.variantId
      )
    } else {
      // Check guest cart
      const guestCart = guestCartUtils.getCart()
      
      // For products with variants, check if default variant is in cart
      if (
        product.hasVariants &&
        product.variants &&
        Array.isArray(product.variants) &&
        product.variants.length > 0
      ) {
        const defaultVariant = product.variants.find((v) => v.isDefault) || product.variants[0]
        const variantId = defaultVariant?._id ? String(defaultVariant._id) : undefined
        return guestCart.some(
          (item) =>
            item.productId === product._id &&
            (variantId ? item.variantId === variantId : !item.variantId)
        )
      }
      
      // For products without variants, check if product is in cart (without variant)
      return guestCart.some(
        (item) => item.productId === product._id && !item.variantId
      )
    }
  }, [isAuthenticated, cart?.items, product._id, product.hasVariants, product.variants, guestCartUpdate])

  if (!product) {
    return null
  }

  const image = product.mainImage || product.images?.[0] || '/image-placeholder.svg'
  const rating = product.rating || 0
  const reviewCount = product.reviewCount || 0
  const isOutOfStock = product.status === 'out_of_stock' || product.stock === 0
  const isProductUnavailable = product.status !== 'active'
  // Use effectivePrice (what customer actually pays)
  const getEffectivePrice = (): number => {
    if (
      product.hasVariants &&
      product.variants &&
      Array.isArray(product.variants) &&
      product.variants.length > 0
    ) {
      const defaultVariant = product.variants.find((v) => v.isDefault) || product.variants[0]
      return (
        (defaultVariant?.effectivePrice as number | undefined) ??
        (defaultVariant?.price as number | undefined) ??
        product.effectivePrice ??
        product.price ??
        0
      )
    }
    return product.effectivePrice ?? product.price ?? 0
  }
  const currentPrice = getEffectivePrice()
  const originalPrice =
    product.comparePrice && product.comparePrice > currentPrice ? product.comparePrice : undefined

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInMs = now.getTime() - date.getTime()
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60))
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60))

    if (diffInMinutes < 1) {
      return 'Just now'
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes} ${diffInMinutes === 1 ? 'minute' : 'minutes'} ago`
    } else if (diffInHours < 24) {
      return `${diffInHours} ${diffInHours === 1 ? 'hour' : 'hours'} ago`
    } else {
      const diffInDays = Math.floor(diffInHours / 24)
      if (diffInDays === 1) {
        return 'Yesterday'
      } else if (diffInDays < 7) {
        return `${diffInDays} days ago`
      } else {
        return date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        })
      }
    }
  }

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isProductUnavailable) {
      toast.error('This product is currently unavailable')
      return
    }
    if (isOutOfStock) {
      toast.error('This product is out of stock')
      return
    }
    
    // If product has variants, open variant selector sheet
    if (
      product.hasVariants &&
      product.variants &&
      Array.isArray(product.variants) &&
      product.variants.length > 0
    ) {
      setIsVariantSelectorOpen(true)
      return
    }
    
    // Otherwise, add directly to cart
    addToCartMutation.mutate({ productId: product._id })
  }

  const handleAddToWishlist = (e: React.MouseEvent) => {
    e.stopPropagation()
    // Get variantId if product has variants
    let variantId: string | undefined
    if (
      product.hasVariants &&
      product.variants &&
      Array.isArray(product.variants) &&
      product.variants.length > 0
    ) {
      const defaultVariant = product.variants.find((v) => v.isDefault) || product.variants[0]
      variantId = defaultVariant?._id ? String(defaultVariant._id) : undefined
    }
    addToWishlistMutation.mutate({ productId: product._id, variantId })
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.2 }}
      className="group relative"
    >
      <div className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4 transition-all hover:border-gray-200 hover:shadow-sm">
        {/* Timeline indicator */}
        <div className="absolute -left-[18px] top-6 h-3 w-3 rounded-full border-2 border-white bg-gray-300 shadow-sm group-hover:bg-blue-500 transition-colors" />

        {/* Product Image */}
        <Link
          to={`/product/${product.slug || product._id}`}
          className="relative aspect-square h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-gray-50"
        >
          {isProductUnavailable && (
            <div className="absolute left-1 top-1 z-10">
              <Badge className="border-gray-300 bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-700">
                Product Unavailable
              </Badge>
            </div>
          )}
          {product.isFeatured && !isProductUnavailable && (
            <div className="absolute left-1 top-1 z-10">
              <Badge className="border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-700">
                Featured
              </Badge>
            </div>
          )}
          <img src={image} alt={product.name} className="h-full w-full object-cover" />
        </Link>

        {/* Product Info */}
        <div className="flex flex-1 flex-col gap-2 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <Link to={`/product/${product.slug || product._id}`}>
                <h4 className="line-clamp-1 text-sm font-semibold text-gray-900 transition-colors hover:text-blue">
                  {product.name}
                </h4>
              </Link>

              {/* Rating and View Info */}
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                {rating > 0 && (
                  <div className="flex items-center gap-1">
                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                    <span className="font-medium text-gray-700">{rating.toFixed(1)}</span>
                    {reviewCount > 0 && <span className="text-gray-500">({reviewCount})</span>}
                  </div>
                )}
                {viewInfo && (
                  <>
                    {rating > 0 && <span className="text-gray-300">•</span>}
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-gray-400" />
                      <span>{formatTime(viewInfo.lastViewedAt)}</span>
                      {viewInfo.viewCount > 1 && (
                        <span className="text-gray-400">• {viewInfo.viewCount}x</span>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Price */}
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className="text-base font-bold text-gray-900">
                {formatCurrency(currentPrice)}
              </span>
              {originalPrice && (
                <span className="text-xs text-gray-400 line-through">
                  {formatCurrency(originalPrice)}
                </span>
              )}
              {product.discountPercent && (
                <Badge className="border-green-200 bg-green-50 text-[10px] text-green-700">
                  {product.discountPercent}% OFF
                </Badge>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={isInCart ? 'outline' : 'primary'}
              onClick={handleAddToCart}
              disabled={isInCart || isProductUnavailable || isOutOfStock || addToCartMutation.isPending}
              className={`h-8 rounded-full text-xs ${
                isInCart
                  ? 'border-green-300 bg-green-50 text-green-700 hover:bg-green-50 cursor-default'
                  : ''
              }`}
            >
              {addToCartMutation.isPending ? (
                <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
              ) : isInCart ? (
                <>
                  <Check className="mr-1.5 h-3 w-3" />
                  Added
                </>
              ) : (
                <>
                  <ShoppingCart className="mr-1.5 h-3 w-3" />
                  Add to Cart
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleAddToWishlist}
              disabled={addToWishlistMutation.isPending}
              className="h-8 w-8 rounded-full p-0"
            >
              {addToWishlistMutation.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Heart
                  className={`h-3 w-3 ${isInWishlist ? 'fill-red-500 text-red-500' : 'fill-none'}`}
                />
              )}
            </Button>
            {isProductUnavailable && (
              <Badge className="ml-auto border-gray-300 bg-gray-100 text-[10px] text-gray-700">
                Product Unavailable
              </Badge>
            )}
            {isOutOfStock && !isProductUnavailable && (
              <Badge className="ml-auto border-red-200 bg-red-50 text-[10px] text-red-800">
                Out of Stock
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Variant Selector Sheet */}
      {product.hasVariants && product.variants && product.variants.length > 0 && (
        <VariantSelectorSheet
          open={isVariantSelectorOpen}
          onOpenChange={setIsVariantSelectorOpen}
          product={product}
        />
      )}
    </motion.div>
  )
}

export default HistoryItemCard
