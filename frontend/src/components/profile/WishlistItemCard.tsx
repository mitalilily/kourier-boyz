import { useAddToCart } from '@/api/cart'
import { useRemoveFromWishlist, useUpdateWishlistItemNote, WishlistItem } from '@/api/wishlist'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { ShareButton } from '@/components/ui/ShareButton'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { formatCurrency } from '@/utils'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Loader2,
  MessageSquare,
  ShoppingCart,
  Star,
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

interface PriceChange {
  productId: string
  change: number
  changePercent: string
  isPriceDrop: boolean
  isPriceIncrease: boolean
}

interface WishlistItemCardProps {
  item: WishlistItem
  priceChange?: PriceChange
  onRemove: (productId: string) => void
  isRemoving: boolean
}

const WishlistItemCard: React.FC<WishlistItemCardProps> = ({
  item,
  priceChange,
  onRemove,
  isRemoving,
}) => {
  const [isNoteOpen, setIsNoteOpen] = useState(false)
  const [note, setNote] = useState(item?.note || '')
  const [isVariantSelectorOpen, setIsVariantSelectorOpen] = useState(false)
  const [selectedVariantId, setSelectedVariantId] = useState<string | undefined>(item?.variantId)
  const [pendingAction, setPendingAction] = useState<'addToCart' | 'buyNow' | null>(null)
  const priceNoticeKey = useMemo(
    () => `wishlist-price-change-${item?.product?._id}`,
    [item?.product?._id],
  )
  const hasPriceChange = Boolean(priceChange?.isPriceDrop || priceChange?.isPriceIncrease)
  const [isPriceNoticeDismissed, setIsPriceNoticeDismissed] = useState(() => {
    if (typeof window === 'undefined') return false
    if (!hasPriceChange) return false
    return localStorage.getItem(priceNoticeKey) === 'dismissed'
  })
  useEffect(() => {
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

  // Sync selectedVariantId when item changes
  useEffect(() => {
    setSelectedVariantId(item?.variantId)
  }, [item?.variantId])

  const handleDismissPriceNotice = () => {
    setIsPriceNoticeDismissed(true)
    if (typeof window !== 'undefined') {
      localStorage.setItem(priceNoticeKey, 'dismissed')
    }
  }
  const removeMutation = useRemoveFromWishlist()
  const addToCartMutation = useAddToCart()
  const updateNoteMutation = useUpdateWishlistItemNote()

  if (!item || !item.product) {
    return null
  }

  const product = item.product
  const image = product.mainImage || product.images?.[0] || '/image-placeholder.svg'
  const rating = product.rating || 0
  const reviewCount = product.reviewCount || 0
  const isOutOfStock = product.status === 'out_of_stock' || product.stock === 0
  // Use effectivePrice (what customer actually pays)
  // Variant data is already merged into product from backend
  const getEffectivePrice = (): number => {
    return product.effectivePrice ?? product.price ?? 0
  }
  const currentPrice = getEffectivePrice()
  // Use effectivePrice from product (current price), not priceAtAddition
  const productUrl = `${window.location.origin}/product/${product.slug || product._id}`

  // SEO-friendly share message
  const shareMessage = `Check out ${product.name}${
    product.discountPercent ? ` - ${product.discountPercent}% OFF` : ''
  } for just ${formatCurrency(currentPrice)} on Kourier Boyz! ${productUrl}`

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isOutOfStock) {
      toast.error('This product is out of stock')
      return
    }
    // Prevent duplicate calls
    if (addToCartMutation.isPending) {
      return
    }
    // If product has variants, show variant selector first
    if (product.hasVariants && product.variants && product.variants.length > 0) {
      setPendingAction('addToCart')
      setSelectedVariantId(item?.variantId)
      setIsVariantSelectorOpen(true)
      return
    }
    // Product without variants - add directly
    addToCartMutation.mutate({
      productId: product._id,
    })
  }

  const handleBuyNow = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isOutOfStock) {
      toast.error('This product is out of stock')
      return
    }
    // Prevent duplicate calls
    if (addToCartMutation.isPending) {
      return
    }
    // If product has variants, show variant selector first
    if (product.hasVariants && product.variants && product.variants.length > 0) {
      setPendingAction('buyNow')
      setSelectedVariantId(item?.variantId)
      setIsVariantSelectorOpen(true)
      return
    }
    // Product without variants - proceed directly
    handleBuyNowDirect()
  }

  const handleBuyNowDirect = async (variantId?: string) => {
    try {
      // For guests, item will be added to guest cart
      // For authenticated users, item will be added to their cart
      await addToCartMutation.mutateAsync({
        productId: product._id,
        variantId: variantId ? String(variantId) : undefined,
      })
      // Navigate to checkout with buyNow flag (same pattern as useProductActions)
      const params = new URLSearchParams()
      params.set('productId', product._id)
      params.set('buyNow', 'true') // Flag to indicate this is a buy now flow
      if (variantId) {
        params.set('variantId', String(variantId))
      }
      // Use navigate instead of window.location.href for better React Router integration
      window.location.href = `/cart/checkout?${params.toString()}`
    } catch (error) {
      console.error('Error adding to cart:', error)
    }
  }

  const handleVariantSelect = () => {
    if (!selectedVariantId) {
      toast.error('Please select a variant')
      return
    }
    setIsVariantSelectorOpen(false)
    if (pendingAction === 'addToCart') {
      addToCartMutation.mutate({
        productId: product._id,
        variantId: String(selectedVariantId),
      })
    } else if (pendingAction === 'buyNow') {
      handleBuyNowDirect(selectedVariantId)
    }
    setPendingAction(null)
  }

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation()
    // Get variantId from item if available (stored at item level, not in product)
    const variantId = item?.variantId
    removeMutation.mutate({ productId: product._id, variantId })
    onRemove(product._id)
  }

  const handleSaveNote = () => {
    if (!item || !product) return
    updateNoteMutation.mutate(
      { productId: product._id, note: note.trim() || undefined },
      {
        onSuccess: () => {
          setIsNoteOpen(false)
        },
      },
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="rounded-3xl border border-gray-100 bg-linear-to-br from-white via-gray-50 to-gray-100 shadow-sm transition-all hover:shadow-lg hover:border-gray-200">
        <div className="flex flex-col gap-4 p-4 sm:flex-row">
          {/* Product Image */}
          <Link
            to={`/product/${product.slug || product._id}`}
            className="group relative aspect-square w-full overflow-hidden rounded-2xl bg-gray-50 sm:w-32 shadow-sm"
          >
            {/* Featured Badge */}
            {product.isFeatured && (
              <div className="absolute left-2 top-2 z-10">
                <Badge className="border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] text-blue-700">
                  Featured
                </Badge>
              </div>
            )}

            {/* Price Change Badge */}
            {priceChange?.isPriceDrop && (
              <div className="absolute right-2 top-2 z-10">
                <Badge className="border-0 bg-green-500 px-2 py-0.5 text-[11px] text-white">
                  <TrendingDown className="mr-1 h-3 w-3" />
                  {priceChange.changePercent}% OFF
                </Badge>
              </div>
            )}

            {priceChange?.isPriceIncrease && !priceChange.isPriceDrop && (
              <div className="absolute right-2 top-2 z-10">
                <Badge className="border-0 bg-red-500 px-2 py-0.5 text-[11px] text-white">
                  <TrendingUp className="mr-1 h-3 w-3" />+{priceChange.changePercent}%
                </Badge>
              </div>
            )}

            {/* Out of stock overlay */}
            {isOutOfStock && (
              <div className="absolute inset-0 z-10 bg-black/10 backdrop-blur-[1px]" />
            )}

            <img
              src={image}
              alt={product.name}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          </Link>

          {/* Product Details */}
          <div className="flex flex-1 flex-col gap-4 sm:justify-between">
            <div className="flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <Link to={`/product/${product.slug || product._id}`}>
                    <h3 className="mb-1 line-clamp-2 text-base font-semibold text-gray-900 transition-colors hover:text-blue">
                      {product.name}
                    </h3>
                  </Link>

                  <AnimatePresence>
                    {hasPriceChange && !isPriceNoticeDismissed && priceChange && (
                      <motion.div
                        key="wishlist-price-change"
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.2 }}
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium ${
                          priceChange.isPriceDrop
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        {priceChange.isPriceDrop ? (
                          <TrendingDown className="h-3 w-3" />
                        ) : (
                          <TrendingUp className="h-3 w-3" />
                        )}
                        <span>
                          {priceChange.isPriceDrop
                            ? `Price dropped ${priceChange.changePercent}%`
                            : `Price increased ${priceChange.changePercent}%`}
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

                  {/* Rating */}
                  {rating > 0 && (
                    <div className="mb-1 flex items-center gap-1.5">
                      <div className="flex items-center gap-0.5">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`h-3 w-3 ${
                              i < Math.round(rating)
                                ? 'fill-yellow-400 text-yellow-400'
                                : 'text-gray-300'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-xs text-gray-600">{rating.toFixed(1)}</span>
                      {reviewCount > 0 && (
                        <span className="text-xs text-gray-500">({reviewCount})</span>
                      )}
                    </div>
                  )}

                  {/* Note Indicator */}
                  {item.note && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-600">
                      <MessageSquare className="h-3 w-3 text-gray-400" />
                      <span className="line-clamp-1">{item.note}</span>
                    </div>
                  )}
                </div>
                {/* Out of Stock Badge */}
                {isOutOfStock && (
                  <Badge className="shrink-0 border-red-200 bg-red-100 text-xs text-red-800">
                    Out of Stock
                  </Badge>
                )}
              </div>

              {/* Price Section */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-lg font-bold text-gray-900">
                  {formatCurrency(currentPrice)}
                </span>
                {product.comparePrice && product.comparePrice > currentPrice && (
                  <span className="text-sm text-gray-400 line-through">
                    {formatCurrency(product.comparePrice)}
                  </span>
                )}
                {product.discountPercent && (
                  <Badge className="border-green-200 bg-green-100 text-xs text-green-700">
                    {product.discountPercent}% OFF
                  </Badge>
                )}
                {priceChange?.isPriceDrop && (
                  <Badge className="border-green-200 bg-green-100 text-xs text-green-700">
                    <TrendingDown className="mr-1 h-3 w-3" />
                    {priceChange.changePercent}% OFF
                  </Badge>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2 border-t border-gray-100 pt-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Button
                size="sm"
                onClick={handleAddToCart}
                disabled={isOutOfStock || addToCartMutation.isPending}
                className="w-full sm:w-auto h-8 text-xs rounded-full bg-yellow text-gray-900 hover:bg-gray-900 hover:text-white shadow-md hover:shadow-lg transition-all px-4"
              >
                {addToCartMutation.isPending ? (
                  <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                ) : (
                  <ShoppingCart className="mr-1.5 h-3 w-3" />
                )}
                Add to Cart
              </Button>

              <Button
                size="sm"
                onClick={handleBuyNow}
                disabled={isOutOfStock || addToCartMutation.isPending}
                className="w-full sm:w-auto h-8 text-xs rounded-full bg-gray-900 text-white hover:bg-gray-800 shadow-md hover:shadow-lg transition-all px-4"
              >
                {addToCartMutation.isPending ? (
                  <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                ) : (
                  <Zap className="mr-1.5 h-3 w-3" />
                )}
                Buy Now
              </Button>

              <div className="flex gap-2 sm:flex-1 sm:justify-end">
                <Dialog open={isNoteOpen} onOpenChange={setIsNoteOpen}>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 rounded-full border-gray-300 hover:bg-gray-50"
                    >
                      <MessageSquare className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="rounded-3xl p-6">
                    <DialogHeader>
                      <DialogTitle>Add Note</DialogTitle>
                      <DialogDescription>Add a personal note about this item</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <Textarea
                        placeholder="e.g., 'Gift for mom'"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        maxLength={500}
                        rows={4}
                        className="rounded-2xl"
                      />
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setIsNoteOpen(false)}>
                          Cancel
                        </Button>
                        <Button onClick={handleSaveNote} disabled={updateNoteMutation.isPending}>
                          {updateNoteMutation.isPending ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : null}
                          Save
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>

                {/* Variant Selector Sheet (Bottom Drawer) */}
                {product.hasVariants && product.variants && product.variants.length > 0 && (
                  <Sheet open={isVariantSelectorOpen} onOpenChange={setIsVariantSelectorOpen}>
                    <SheetContent
                      side="bottom"
                      className="h-[66vh] bg-white max-w-md mx-auto rounded-t-3xl"
                    >
                      <SheetHeader className="pb-4">
                        <SheetTitle>Select Variant</SheetTitle>
                        <SheetDescription>Choose a variant for {product.name}</SheetDescription>
                      </SheetHeader>
                      <div className="space-y-3 mt-4 max-h-[calc(50vh-100px)] overflow-y-auto pb-4">
                        {product?.variants.map((variant) => {
                          const isSelected = selectedVariantId === variant._id
                          const isOutOfStock =
                            variant.status === 'out_of_stock' || (variant.stock || 0) === 0
                          const variantPrice = variant.effectivePrice ?? variant.price ?? 0
                          const variantComparePrice = variant.comparePrice
                          const hasDiscount =
                            variantComparePrice && variantComparePrice > variantPrice

                          return (
                            <button
                              key={variant._id}
                              onClick={() => !isOutOfStock && setSelectedVariantId(variant._id)}
                              disabled={isOutOfStock}
                              className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                                isSelected
                                  ? 'border-yellow bg-yellow/10'
                                  : 'border-gray-200 hover:border-gray-300'
                              } ${
                                isOutOfStock ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                {/* Variant Image Preview */}
                                {typeof variant.mainImage === 'string' && variant.mainImage && (
                                  <div className="flex-shrink-0">
                                    <img
                                      src={variant.mainImage}
                                      alt={typeof variant.name === 'string' ? variant.name : 'Variant'}
                                      className="w-16 h-16 object-cover rounded-lg"
                                    />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <h4 className="font-medium text-sm text-gray-900 truncate">
                                      {typeof variant.name === 'string' ? variant.name : 'Variant'}
                                    </h4>

                                    {isOutOfStock && (
                                      <Badge
                                        variant="outline"
                                        className="text-xs px-1.5 py-0 text-red-600"
                                      >
                                        Out of Stock
                                      </Badge>
                                    )}
                                  </div>
                                  {variant.attributes &&
                                    Object.keys(variant.attributes).length > 0 && (
                                      <div className="flex flex-wrap gap-1 mb-2">
                                        {Object.entries(variant.attributes).map(([key, value]) => (
                                          <span
                                            key={key}
                                            className="text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded"
                                          >
                                            {String(value)}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-gray-900">
                                      {formatCurrency(variantPrice)}
                                    </span>
                                    {hasDiscount && (
                                      <span className="text-xs text-gray-400 line-through">
                                        {formatCurrency(variantComparePrice)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {isSelected && (
                                  <div className="flex-shrink-0">
                                    <div className="w-5 h-5 rounded-full bg-yellow border-2 border-yellow flex items-center justify-center">
                                      <div className="w-2 h-2 rounded-full bg-gray-900" />
                                    </div>
                                  </div>
                                )}
                              </div>
                            </button>
                          )
                        })}
                      </div>
                      <div className="flex gap-2 mt-4 pt-4 border-t">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setIsVariantSelectorOpen(false)
                            setPendingAction(null)
                          }}
                          className="flex-1"
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={handleVariantSelect}
                          disabled={!selectedVariantId || addToCartMutation.isPending}
                          className="flex-1 bg-yellow text-gray-900 hover:bg-gray-900 hover:text-white"
                        >
                          {addToCartMutation.isPending ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              {pendingAction === 'buyNow' ? (
                                <>
                                  <Zap className="mr-2 h-4 w-4" />
                                  Buy Now
                                </>
                              ) : (
                                <>
                                  <ShoppingCart className="mr-2 h-4 w-4" />
                                  Add to Cart
                                </>
                              )}
                            </>
                          )}
                        </Button>
                      </div>
                    </SheetContent>
                  </Sheet>
                )}

                <ShareButton
                  url={productUrl}
                  title={product.name}
                  description={
                    product.shortDescription ||
                    product.description ||
                    `Buy ${product.name} on Kourier Boyz`
                  }
                  shareText={shareMessage}
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 rounded-full border-gray-300 hover:bg-gray-50"
                  showLabel={false}
                />

                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleRemove}
                  disabled={isRemoving || removeMutation.isPending}
                  className="h-9 w-9 rounded-full border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                >
                  {isRemoving || removeMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  )
}

export default WishlistItemCard
