import { useAddToWishlist, useWishlistStatus } from '@/api/wishlist'
import { CartItem } from '@/types/cart'
import { useAuthStore } from '@/store/authStore'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertCircle, Heart, Loader2, Tag, Trash2, TrendingDown, TrendingUp, X } from 'lucide-react'
import React from 'react'
import { Link } from 'react-router-dom'
import { Badge } from './badge'
import { Card } from './card'
import { Checkbox } from './checkbox'
import QuantitySelector from './QuantitySelector'

interface CartItemCardProps {
  item: CartItem
  onQuantityChange: (item: CartItem, quantity: number) => void
  onRemove: (item: CartItem) => void
  onSaveForLater?: (item: CartItem) => void
  onSelectionChange?: (item: CartItem, selected: boolean) => void
  isOutOfStock: boolean
  isLowStock: boolean
  isUpdating: boolean
  isRemoving: boolean
  isSavingForLater?: boolean
}

const CartItemCard: React.FC<CartItemCardProps> = ({
  item,
  onQuantityChange,
  onRemove,
  // onSaveForLater,
  onSelectionChange,
  isOutOfStock,
  isLowStock,
  isUpdating,
  isRemoving,
  // isSavingForLater = false,
}) => {
  const { isAuthenticated } = useAuthStore()
  const addToWishlistMutation = useAddToWishlist()
  const [isMovingToWishlist, setIsMovingToWishlist] = React.useState(false)
  const { isInWishlist } = useWishlistStatus(item.product._id)
  const isUnavailable = item.unavailable || false

  const handleMoveToWishlist = async () => {
    setIsMovingToWishlist(true)
    try {
      // Add to wishlist with variantId (now at item level)
      await addToWishlistMutation.mutateAsync({
        productId: item.product._id,
        variantId: item.variantId, // variantId is now at item level
      })
      // Then remove from cart
      onRemove(item)
    } catch (error) {
      // Error toast is handled by the mutation
      console.error('Failed to move to wishlist:', error)
    } finally {
      setIsMovingToWishlist(false)
    }
  }
  console.log(item)
  const imageUrl = item.product.mainImage || '/image-placeholder.svg'

  // Get current effectivePrice (what customer actually pays now) - this is the price to display
  // Variant data is now merged into product
  const currentEffectivePrice =
    item.product.effectivePrice ?? item.product.price ?? item.priceAtAddition

  // Calculate effective price per unit for display
  // If item has subtotal (with coupon discount), use that; otherwise use current effectivePrice
  const effectivePricePerUnit = currentEffectivePrice ?? item.priceAtAddition

  const productName = item.product.name
  const availableStock = item.product.stock

  // Use effectivePrice for live price comparison
  const livePrice = currentEffectivePrice

  // For original price display, use comparePrice if available, otherwise use current effectivePrice
  const comparePrice = item.product.comparePrice
  const originalPriceForDisplay =
    comparePrice && comparePrice > currentEffectivePrice ? comparePrice : currentEffectivePrice

  const hasDiscount = comparePrice && comparePrice > currentEffectivePrice
  const hasCoupon = !!item.appliedCoupon && !!item.couponCode
  const priceDifference = livePrice - item.priceAtAddition
  const hasPriceChange = Math.abs(priceDifference) >= 0.01
  const isPriceDrop = hasPriceChange && priceDifference < 0
  const priceChangeAmount = Math.abs(priceDifference)
  const priceNoticeKey = React.useMemo(
    () => `cart-price-change-${item.product._id}`,
    [item.product._id],
  )
  const [isPriceNoticeDismissed, setIsPriceNoticeDismissed] = React.useState(() => {
    if (typeof window === 'undefined') return false
    if (!hasPriceChange) return false
    return localStorage.getItem(priceNoticeKey) === 'dismissed'
  })

  React.useEffect(() => {
    if (!hasPriceChange) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(priceNoticeKey)
      }
      setIsPriceNoticeDismissed(false)
      return
    }
    if (typeof window !== 'undefined') {
      const dismissed = localStorage.getItem(priceNoticeKey) === 'dismissed'
      setIsPriceNoticeDismissed(dismissed)
    }
  }, [hasPriceChange, priceNoticeKey])

  const handleDismissPriceNotice = () => {
    setIsPriceNoticeDismissed(true)
    if (typeof window !== 'undefined') {
      localStorage.setItem(priceNoticeKey, 'dismissed')
    }
  }

  const showPriceChangeNotice = hasPriceChange && !isPriceNoticeDismissed

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="group relative overflow-hidden rounded-lg border border-gray-200/80 bg-white transition-all duration-300 hover:border-gray-300/50 hover:shadow-md">
        <AnimatePresence>
          {isUpdating && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-20 flex items-center justify-center bg-white/72 backdrop-blur-[1px]"
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                Updating quantity...
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="flex gap-2 sm:gap-3 p-2 sm:p-3 md:p-4 min-h-[120px] sm:min-h-[140px]">
          {/* Selection Checkbox */}
          {onSelectionChange && (
            <div className="flex items-start pt-1 sm:pt-1.5 md:pt-2 self-start">
              <Checkbox
                checked={item.selected !== false}
                onCheckedChange={(checked) => onSelectionChange(item, checked === true)}
                aria-label={item.selected ? 'Deselect item' : 'Select item'}
                className="h-4 w-4 sm:h-5 sm:w-5"
              />
            </div>
          )}

          {/* Product Image - Full height */}
          <Link
            to={`/product/${item.product.slug}`}
            className="relative shrink-0 w-24 sm:w-28 md:w-32 h-full rounded-lg overflow-hidden bg-gray-50 border border-gray-200/50 group-hover:border-primary/30 transition-all duration-300 self-stretch"
          >
            <motion.img
              src={imageUrl}
              alt={productName}
              className="w-full h-full object-cover"
              whileHover={{ scale: 1.05 }}
              transition={{ duration: 0.3 }}
            />

            {/* Out of Stock / Unavailable Overlay */}
            {(isOutOfStock || isUnavailable) && (
              <div className="absolute inset-0 bg-black/70 flex items-center justify-center backdrop-blur-[1px]">
                <div className="text-center">
                  <AlertCircle className="w-4 h-4 text-white mx-auto mb-1" />
                  <span className="text-[9px] font-semibold text-white bg-red-600/90 px-2 py-0.5 rounded block">
                    {isUnavailable ? 'Product Unavailable' : 'Out of Stock'}
                  </span>
                </div>
              </div>
            )}
          </Link>

          {/* Product Details */}
          <div className="flex-1 min-w-0 flex flex-col justify-between gap-2 sm:gap-3">
            {/* Top Section: Product Info + Actions */}
            <div className="flex items-start justify-between gap-1.5 sm:gap-2">
              <div className="flex-1 min-w-0 space-y-1 sm:space-y-1.5">
                <Link 
                  to={isUnavailable ? '#' : `/product/${item.product.slug}`} 
                  className="block group/link"
                  onClick={(e) => isUnavailable && e.preventDefault()}
                >
                  <h3 className={`font-semibold text-sm sm:text-base line-clamp-2 transition-colors leading-tight ${
                    isUnavailable 
                      ? 'text-gray-400 line-through' 
                      : 'text-gray-900 group-hover/link:text-primary'
                  }`}>
                    {item.product.name || 'Product Unavailable'}
                  </h3>
                </Link>

                <div className="flex flex-col gap-1">
                  <AnimatePresence>
                    {showPriceChangeNotice && (
                      <motion.div
                        key="price-change-banner"
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.2 }}
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium ${
                          isPriceDrop
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        {isPriceDrop ? (
                          <TrendingDown className="h-3 w-3" />
                        ) : (
                          <TrendingUp className="h-3 w-3" />
                        )}
                        <span>
                          {isPriceDrop
                            ? `Price dropped ₹${priceChangeAmount.toLocaleString()}`
                            : `Price increased ₹${priceChangeAmount.toLocaleString()}`}
                        </span>
                        <button
                          type="button"
                          onClick={handleDismissPriceNotice}
                          className="ml-1 rounded-full p-0.5 hover:bg-white/40 transition"
                          aria-label="Dismiss price change notice"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Tags moved outside image */}
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  {item.product.isFeatured ? (
                    <Badge className="px-1.5 py-0.5 text-[9px] font-medium bg-yellow-100 text-yellow-800 border-0">
                      Featured
                    </Badge>
                  ) : null}
                  {item.product.discountPercent && item.product.discountPercent > 0 ? (
                    <Badge className="px-1.5 py-0.5 text-[9px] font-medium bg-red-100 text-red-700 border-0">
                      -{item.product.discountPercent}%
                    </Badge>
                  ) : null}
                  {isUnavailable ? (
                    <Badge variant="destructive" className="text-[10px] px-1.5 py-0.5 font-medium">
                      <AlertCircle className="w-2.5 h-2.5 mr-1" />
                      Product Unavailable
                    </Badge>
                  ) : isOutOfStock ? (
                    <Badge variant="destructive" className="text-[10px] px-1.5 py-0.5 font-medium">
                      <AlertCircle className="w-2.5 h-2.5 mr-1" />
                      Out of stock
                    </Badge>
                  ) : isLowStock ? (
                    <Badge className="text-[10px] px-1.5 py-0.5 bg-amber-50 text-amber-700 border-amber-200 font-medium">
                      <AlertCircle className="w-2.5 h-2.5 mr-1" />
                      Only {availableStock} left
                    </Badge>
                  ) : null}
                  {hasCoupon ? (
                    <Badge className="text-[10px] px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border-emerald-200 font-medium">
                      <Tag className="w-2.5 h-2.5 mr-1" />
                      {item.couponCode}
                    </Badge>
                  ) : null}
                  {item.product.seller?.businessName && (
                    <span className="text-[10px] text-gray-500">
                      {isOutOfStock ||
                      isLowStock ||
                      hasCoupon ||
                      item.product.isFeatured ||
                      (item.product.discountPercent && item.product.discountPercent > 0)
                        ? '•'
                        : ''}{' '}
                      Sold by{' '}
                      <span className="text-gray-700">{item.product.seller.businessName}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
                {/* Only show Move to Wishlist button for authenticated users */}
                {isAuthenticated && (
                  <motion.button
                    onClick={handleMoveToWishlist}
                    disabled={isMovingToWishlist || addToWishlistMutation.isPending || isRemoving}
                    className={`px-1.5 sm:px-2 py-1 sm:py-1.5 rounded-md transition-colors disabled:opacity-50 border text-[10px] sm:text-xs font-medium flex items-center gap-0.5 sm:gap-1 ${
                      isInWishlist
                        ? 'bg-red-50 border-red-200 hover:bg-red-100 text-red-600 hover:border-red-300'
                        : 'hover:bg-gray-50 border-gray-200 hover:border-gray-300 text-gray-700'
                    }`}
                    aria-label={isInWishlist ? 'Already in wishlist' : 'Move to wishlist'}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {isMovingToWishlist || addToWishlistMutation.isPending ? (
                      <>
                        <Loader2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 animate-spin" />
                        <span className="hidden sm:inline">Moving...</span>
                      </>
                    ) : (
                      <>
                        <Heart
                          className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${
                            isInWishlist ? 'fill-red-600 text-red-600' : 'fill-none'
                          }`}
                        />
                        <span className="hidden sm:inline">
                          {isInWishlist ? 'In Wishlist' : 'Move to Wishlist'}
                        </span>
                      </>
                    )}
                  </motion.button>
                )}

                <motion.button
                  onClick={() => onRemove(item)}
                  disabled={isRemoving}
                  className="p-1 sm:p-1.5 rounded-md hover:bg-red-50 text-red-600 transition-colors disabled:opacity-50 border border-red-200 hover:border-red-300"
                  aria-label="Remove item"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {isRemoving ? (
                    <Loader2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 animate-spin text-red-600" />
                  ) : (
                    <Trash2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  )}
                </motion.button>
              </div>
            </div>

            {/* Bottom Section: Price, Quantity, Subtotal */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 pt-2 sm:pt-3 border-t border-gray-100">
              {/* Price Section */}
              <div className="flex flex-col gap-1 w-full sm:w-auto">
                {hasCoupon ? (
                  <>
                    {/* With Coupon */}
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-base sm:text-lg font-bold text-gray-900">
                        ₹{effectivePricePerUnit?.toLocaleString()}
                      </span>
                      <span className="text-xs sm:text-sm text-gray-400 line-through">
                        ₹{originalPriceForDisplay?.toLocaleString()}
                      </span>
                    </div>
                    {item.discountAmount && item.discountAmount > 0 && (
                      <span className="text-xs text-emerald-600 font-medium">
                        Save ₹{item.discountAmount.toLocaleString()}
                      </span>
                    )}
                  </>
                ) : hasDiscount ? (
                  <>
                    {/* Regular Discount */}
                    <div className="flex items-baseline gap-2">
                      <span className="text-base sm:text-lg font-bold text-gray-900">
                        ₹{effectivePricePerUnit?.toLocaleString()}
                      </span>
                      <span className="text-xs sm:text-sm text-gray-400 line-through">
                        ₹{originalPriceForDisplay?.toLocaleString()}
                      </span>
                    </div>
                    <span className="text-xs text-emerald-600 font-medium">
                      Save ₹
                      {(
                        (originalPriceForDisplay - effectivePricePerUnit) *
                        item.quantity
                      ).toLocaleString()}
                    </span>
                  </>
                ) : (
                  <>
                    {/* No Discount */}
                    <span className="text-base sm:text-lg font-bold text-gray-900">
                      ₹{effectivePricePerUnit?.toLocaleString()}
                    </span>
                  </>
                )}
                {/* Shipping Charge - Inline with price */}
                {item.shipping !== undefined && item.shipping > 0 && (
                  <span className="text-xs text-gray-500 mt-0.5">
                    + ₹{item.shipping.toLocaleString()} shipping
                  </span>
                )}
                {item.shipping !== undefined && item.shipping === 0 && item.product.requiresShipping !== false && (
                  <span className="text-xs text-emerald-600 mt-0.5">Free shipping</span>
                )}
              </div>

              {/* Quantity & Subtotal Section */}
              <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto justify-between sm:justify-end">
                {/* Quantity Selector with Min Order Info */}
                <div className="flex flex-col items-start gap-1.5">
                  <QuantitySelector
                    quantity={item.quantity}
                    onQuantityChange={(newQuantity) => onQuantityChange(item, newQuantity)}
                    min={item.product.minOrderQuantity ?? 1}
                    max={Math.min(availableStock, item.product.maxOrderQuantity ?? availableStock)}
                    disabled={isOutOfStock}
                    isLoading={isUpdating}
                    size="sm"
                  />
                  {item.product.minOrderQuantity && item.product.minOrderQuantity > 1 && (
                    <span className="text-[10px] text-blue-600 font-medium">
                      Min: {item.product.minOrderQuantity}
                    </span>
                  )}
                </div>

                {/* Subtotal (including shipping) */}
                <div className="text-right min-w-[80px] sm:min-w-[100px]">
                  <span className="text-xs text-gray-500 block mb-1">Subtotal</span>
                  {hasCoupon && item.discountAmount ? (
                    <>
                      <span className="text-base sm:text-lg font-bold text-gray-900">
                        ₹
                        {(
                          (item.subtotal ?? item.quantity * effectivePricePerUnit) +
                          (item.shipping || 0)
                        )?.toLocaleString()}
                      </span>
                      <div className="flex flex-col items-end gap-0.5 mt-1">
                        <span className="text-xs text-gray-400 line-through">
                          ₹{(originalPriceForDisplay * item.quantity)?.toLocaleString()}
                        </span>
                        <span className="text-xs text-emerald-600 font-medium">
                          -₹{item.discountAmount.toLocaleString()}
                        </span>
                      </div>
                    </>
                  ) : (
                    <span className="text-base sm:text-lg font-bold text-gray-900">
                      ₹{(
                        (item.subtotal ?? item.quantity * effectivePricePerUnit) +
                        (item.shipping || 0)
                      )?.toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  )
}

export default CartItemCard
