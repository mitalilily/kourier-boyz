import { useAddToCart } from '@/api/cart'
import {
  useBulkRemoveFromWishlist,
  useGenerateShareToken,
  useMoveAllToCart,
  useRemoveFromWishlist,
  useUpdateWishlistVisibility,
  useWishlistInfinite,
  type WishlistItem,
} from '@/api/wishlist'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { InfiniteScrollContainer } from '@/components/ui/InfiniteScrollContainer'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { AnimatePresence, motion } from 'framer-motion'
import { Globe2, Heart, Loader2, Lock, Share2, ShoppingCart, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import WishlistItemCard from '../../components/profile/WishlistItemCard'

const PAGE_SIZE = 20

const ProfileWishlist = () => {
  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage } = useWishlistInfinite({
    limit: PAGE_SIZE,
  })
  const removeMutation = useRemoveFromWishlist()
  const bulkRemoveMutation = useBulkRemoveFromWishlist()
  const moveAllToCartMutation = useMoveAllToCart()
  const generateShareTokenMutation = useGenerateShareToken()
  const updateVisibilityMutation = useUpdateWishlistVisibility()
  const addToCartMutation = useAddToCart()
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set())
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())

  // Get the first page's wishlist for metadata (isPublic, shareToken, etc.)
  const wishlist = data?.pages[0]?.wishlist

  // Flatten all items from all pages
  const items = useMemo(() => {
    if (!data?.pages) return []

    const allItems: WishlistItem[] = []

    data.pages.forEach((page) => {
      const pageWishlist = page.wishlist
      if (!pageWishlist) return

      // New structure - items array with populated products
      if (
        pageWishlist.items &&
        Array.isArray(pageWishlist.items) &&
        pageWishlist.items.length > 0
      ) {
        const validItems = pageWishlist.items.filter(
          (item) => item?.product && typeof item.product === 'object' && item.product._id,
        )
        allItems.push(...validItems)
      }
      // Fallback: Old structure - products array (for backward compatibility)
      else if (pageWishlist.products && Array.isArray(pageWishlist.products)) {
        const populatedProducts = pageWishlist.products.filter(
          (product) => product && typeof product === 'object' && product._id,
        )

        if (populatedProducts.length > 0) {
          const mappedItems = populatedProducts.map((product) => ({
            product,
            priceAtAddition:
              (product as { effectivePrice?: number; price?: number }).effectivePrice ??
              ((product as { price?: number }).price || 0),
            addedAt: pageWishlist.createdAt || new Date().toISOString(),
          }))
          allItems.push(...(mappedItems as WishlistItem[]))
        }
      }
    })

    return allItems
  }, [data?.pages])

  // Get total count from pagination
  const totalCount = data?.pages[0]?.pagination?.total ?? items.length
  const itemCount = totalCount

  const handleRemove = async (productId: string, variantId?: string) => {
    setRemovingIds((prev) => new Set(prev).add(productId))
    try {
      await removeMutation.mutateAsync({ productId, variantId })
    } catch {
      console.error('Error removing from wishlist')
    } finally {
      setRemovingIds((prev) => {
        const next = new Set(prev)
        next.delete(productId)
        return next
      })
    }
  }

  const handleMoveAllToCart = () => {
    moveAllToCartMutation.mutate({ removeFromWishlist: false })
  }

  const handleShare = () => {
    if (!wishlist?.isPublic) {
      toast.info('Make your wishlist public before sharing it.')
      return
    }
    generateShareTokenMutation.mutate()
  }

  const handleToggleVisibility = () => {
    if (!wishlist) return
    updateVisibilityMutation.mutate({ isPublic: !wishlist.isPublic })
  }

  const handleSelectAll = () => {
    if (selectedItems.size === items.length && items.length > 0) {
      setSelectedItems(new Set())
    } else {
      setSelectedItems(
        new Set(
          items
            .filter((item) => item?.product?._id)
            .map((item) => {
              const productId = item.product._id
              return typeof productId === 'string' ? productId : String(productId)
            }),
        ),
      )
    }
  }

  // const handleSelectItem = (productId: string) => {
  //   const newSelected = new Set(selectedItems)
  //   if (newSelected.has(productId)) {
  //     newSelected.delete(productId)
  //   } else {
  //     newSelected.add(productId)
  //   }
  //   setSelectedItems(newSelected)
  // }

  const handleBulkRemove = () => {
    if (selectedItems.size === 0) return
    bulkRemoveMutation.mutate(Array.from(selectedItems), {
      onSuccess: () => {
        setSelectedItems(new Set())
      },
    })
  }

  const allSelected = selectedItems.size === items.length && items.length > 0

  if (isLoading) {
    return (
      <Card className="rounded-3xl border-0 bg-white shadow-sm">
        <CardHeader>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex gap-4">
                <Skeleton className="w-32 h-32 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-10 w-48" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="rounded-3xl  bg-white shadow-sm">
      <CardHeader className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div>
              <CardTitle className="flex items-center gap-3 text-2xl font-bold text-gray-900">
                My Wishlist
                {itemCount > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                    className="flex h-7 min-w-[28px] items-center justify-center rounded-full border-2 border-white bg-linear-to-br from-red-500 via-pink-500 to-rose-500 px-2 text-sm font-bold text-white shadow-md"
                  >
                    {itemCount}
                  </motion.span>
                )}
              </CardTitle>
              <CardDescription className="mt-1 text-sm text-slate-500">
                {itemCount > 0
                  ? `${itemCount} ${itemCount === 1 ? 'item' : 'items'} saved for later`
                  : 'Your saved favorite products'}
              </CardDescription>
            </div>
          </div>
          {itemCount > 0 && (
            <div className="grid w-full gap-2 xs:grid-cols-2 sm:w-auto sm:grid-cols-none sm:auto-rows-auto sm:flex sm:flex-wrap sm:justify-end">
              <Button
                variant={wishlist?.isPublic ? 'outline' : 'outline'}
                size="sm"
                onClick={handleToggleVisibility}
                disabled={updateVisibilityMutation.isPending || !wishlist}
                className="rounded-full sm:w-auto"
              >
                {updateVisibilityMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : wishlist?.isPublic ? (
                  <Globe2 className="mr-2 h-4 w-4" />
                ) : (
                  <Lock className="mr-2 h-4 w-4" />
                )}
                {wishlist?.isPublic ? 'Public' : 'Private'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleShare}
                disabled={generateShareTokenMutation.isPending}
                className="rounded-full sm:w-auto"
              >
                {generateShareTokenMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Share2 className="mr-2 h-4 w-4" />
                )}
                Share
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleMoveAllToCart}
                disabled={moveAllToCartMutation.isPending || itemCount === 0}
                className="rounded-full sm:w-auto"
              >
                {moveAllToCartMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ShoppingCart className="mr-2 h-4 w-4" />
                )}
                Move All to Cart
              </Button>
            </div>
          )}
        </div>
        {itemCount > 0 && (
          <div className="grid gap-2 rounded-2xl bg-slate-50 p-3 text-xs text-slate-600 sm:hidden">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-800">Quick Tip</span>
              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                NEW
              </span>
            </div>
            <p>
              Toggle public status, share your list, or move everything to the cart right from here.
            </p>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {itemCount === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-12"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            >
              <Heart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            </motion.div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Wishlist is Empty</h3>
            <p className="text-gray-600 mb-6">Click the heart icon on products to save them</p>
            <Link to="/">
              <Button>Start Shopping</Button>
            </Link>
          </motion.div>
        ) : (
          <div className="space-y-4">
            {/* Bulk Actions */}
            {selectedItems.size > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={handleSelectAll}
                    className="rounded-md"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    {selectedItems.size} selected
                  </span>
                </div>
                <Separator orientation="horizontal" className="sm:hidden" />
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const selectedProductIds = Array.from(selectedItems)
                      selectedProductIds.forEach((productId) => {
                        const item = items.find((i) => {
                          const pid = i?.product?._id
                          const itemId = typeof pid === 'string' ? pid : String(pid)
                          return itemId === productId
                        })
                        if (item && item.product) {
                          // If product has variants, use default or first available variant
                          if (
                            item.product.hasVariants &&
                            item.product.variants &&
                            Array.isArray(item.product.variants) &&
                            item.product.variants.length > 0
                          ) {
                            const variants = item.product.variants as Array<{
                              _id: string
                              isDefault?: boolean
                              status?: string
                              stock?: number
                            }>
                            const defaultVariant =
                              variants.find((v) => v.isDefault && v.status === 'active') ||
                              variants.find((v) => v.status === 'active' && (v.stock || 0) > 0) ||
                              variants.find((v) => v.status === 'active') ||
                              variants[0]

                            if (defaultVariant && defaultVariant._id) {
                              addToCartMutation.mutate({
                                productId,
                                variantId: String(defaultVariant._id),
                              })
                            }
                          } else if ((item.product.stock || 0) > 0) {
                            // Product without variants
                            addToCartMutation.mutate({ productId })
                          }
                        }
                      })
                      setSelectedItems(new Set())
                    }}
                  >
                    <ShoppingCart className="mr-2 h-4 w-4" />
                    Add to Cart
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBulkRemove}
                    disabled={bulkRemoveMutation.isPending}
                    className="rounded-full text-red-600 hover:bg-red-50 hover:text-red-700"
                  >
                    {bulkRemoveMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="mr-2 h-4 w-4" />
                    )}
                    Remove
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Select All Checkbox */}
            {items.length > 0 && (
              <div className="flex flex-wrap items-center gap-3 border-b pb-3">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={handleSelectAll}
                  className="rounded-md"
                />
                <span className="text-sm text-gray-600">Select all ({items.length} items)</span>
              </div>
            )}

            <InfiniteScrollContainer
              hasNextPage={hasNextPage}
              isFetchingNextPage={isFetchingNextPage}
              onLoadMore={fetchNextPage}
              threshold={300}
              maxHeight="calc(100vh - 400px)"
              showEndIndicator={items.length > PAGE_SIZE}
              endIndicator={
                <div className="py-4 text-center text-sm text-muted-foreground">
                  You've seen all {totalCount} items
                </div>
              }
            >
              <AnimatePresence mode="popLayout">
                {items.map((item) => {
                  const productId =
                    typeof item.product._id === 'string'
                      ? item.product._id
                      : String(item.product._id)
                  return (
                    <WishlistItemCard
                      key={productId}
                      item={item}
                      onRemove={(productId) => {
                        // Find item to get variantId (stored at item level)
                        const item = items.find((i) => i.product._id === productId)
                        const variantId = item?.variantId
                        handleRemove(productId, variantId)
                      }}
                      isRemoving={removingIds.has(productId)}
                    />
                  )
                })}
              </AnimatePresence>
            </InfiniteScrollContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default ProfileWishlist
