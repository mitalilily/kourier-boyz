'use client'

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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { InfiniteScrollContainer } from '@/components/ui/InfiniteScrollContainer'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthStore } from '@/store/authStore'
import { formatCurrency } from '@/utils'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowUpDown,
  Filter,
  Globe2,
  Grid3x3,
  Heart,
  List,
  Loader2,
  Lock,
  Share2,
  ShoppingCart,
  Trash2,
  TrendingDown,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import WishlistItemCard from '../components/profile/WishlistItemCard'

type SortOption = 'date' | 'price-asc' | 'price-desc' | 'name' | 'rating'
type ViewMode = 'grid' | 'list'

const PAGE_SIZE = 24

const Wishlist = () => {
  const { isAuthenticated } = useAuthStore()
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useWishlistInfinite({
    limit: PAGE_SIZE,
    enabled: isAuthenticated,
  })
  const bulkRemoveMutation = useBulkRemoveFromWishlist()
  const moveAllToCartMutation = useMoveAllToCart()
  const generateShareTokenMutation = useGenerateShareToken()
  const updateVisibilityMutation = useUpdateWishlistVisibility()
  const addToCartMutation = useAddToCart()
  const removeMutation = useRemoveFromWishlist()

  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [sortBy, setSortBy] = useState<SortOption>('date')
  const [filterInStock, setFilterInStock] = useState<boolean | null>(null)
  const [filterPriceRange, setFilterPriceRange] = useState<{ min: number; max: number } | null>(
    null,
  )
  const [searchQuery, setSearchQuery] = useState('')

  // Get wishlist from first page (for metadata like isPublic)
  const wishlist = data?.pages[0]?.wishlist

  // Flatten all pages into a single array of items
  const items = useMemo(() => {
    if (!data?.pages) return []

    const allItems: WishlistItem[] = []
    for (const page of data.pages) {
      if (page.wishlist?.items && Array.isArray(page.wishlist.items)) {
        // Filter and map items with valid products
        const validItems = page.wishlist.items.filter((item) => {
          if (!item || !item.product) return false
          if (typeof item.product === 'object' && item.product !== null) {
            const productId = item.product._id
            if (productId) return true
          }
          return false
        })
        allItems.push(...validItems)
      }
    }
    return allItems
  }, [data?.pages])

  // Get total count from first page's pagination
  const totalCount = data?.pages[0]?.pagination?.total ?? items.length

  // Filter and sort items (client-side for responsive UX)
  const filteredAndSortedItems = useMemo(() => {
    let filtered = [...items]

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter((item) =>
        item?.product?.name?.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    }

    // Stock filter
    if (filterInStock !== null) {
      filtered = filtered.filter((item) => {
        if (!item?.product) return false
        const isInStock = (item.product.stock || 0) > 0 && item.product.status !== 'out_of_stock'
        return filterInStock ? isInStock : !isInStock
      })
    }

    // Price range filter
    if (filterPriceRange) {
      filtered = filtered.filter((item) => {
        if (!item?.product) return false
        const price = item.product.effectivePrice ?? (item.product.price || 0)
        return price >= filterPriceRange.min && price <= filterPriceRange.max
      })
    }

    // Sort
    filtered.sort((a, b) => {
      if (!a?.product || !b?.product) return 0
      switch (sortBy) {
        case 'date':
          return new Date(b.addedAt || 0).getTime() - new Date(a.addedAt || 0).getTime()
        case 'price-asc':
          return (
            (a.product.effectivePrice ?? (a.product.price || 0)) -
            (b.product.effectivePrice ?? (b.product.price || 0))
          )
        case 'price-desc':
          return (
            (b.product.effectivePrice ?? (b.product.price || 0)) -
            (a.product.effectivePrice ?? (a.product.price || 0))
          )
        case 'name':
          return a.product.name.localeCompare(b.product.name)
        case 'rating':
          return (b.product.rating || 0) - (a.product.rating || 0)
        default:
          return 0
      }
    })

    return filtered
  }, [items, searchQuery, filterInStock, filterPriceRange, sortBy])

  const handleSelectAll = () => {
    const validItems = filteredAndSortedItems.filter((item) => item?.product?._id)
    if (selectedItems.size === validItems.length && validItems.length > 0) {
      setSelectedItems(new Set())
    } else {
      setSelectedItems(new Set(validItems.map((item) => item.product._id)))
    }
  }

  const handleSelectItem = (productId: string) => {
    const newSelected = new Set(selectedItems)
    if (newSelected.has(productId)) {
      newSelected.delete(productId)
    } else {
      newSelected.add(productId)
    }
    setSelectedItems(newSelected)
  }

  const handleBulkRemove = () => {
    if (selectedItems.size === 0) return
    bulkRemoveMutation.mutate(Array.from(selectedItems), {
      onSuccess: () => {
        setSelectedItems(new Set())
      },
    })
  }

  const handleMoveAllToCart = (removeFromWishlist = false) => {
    moveAllToCartMutation.mutate(
      { removeFromWishlist },
      {
        onSuccess: () => {
          setSelectedItems(new Set())
        },
      },
    )
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

  // Calculate price changes - using effectivePrice only (not priceAtAddition)
  const priceChanges = useMemo(() => {
    return filteredAndSortedItems
      .filter((item) => item?.product?._id)
      .map((item) => {
        // Use effectivePrice from product (current price)
        const currentPrice = item.product?.effectivePrice ?? (item.product?.price || 0)
        // No price change comparison - just use current effectivePrice
        return {
          productId: item.product._id,
          change: 0,
          changePercent: '0',
          isPriceDrop: false,
          isPriceIncrease: false,
        }
      })
  }, [filteredAndSortedItems])

  if (isLoading) {
    return (
      <div className=" mx-auto px-4 py-12">
        <div className="mb-8">
          <Skeleton className="h-12 w-64 mb-4" />
          <Skeleton className="h-6 w-96" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-96" />
          ))}
        </div>
      </div>
    )
  }

  const totalPriceChange = priceChanges.reduce((sum, change) => sum + change.change, 0)
  const itemsWithPriceDrop = priceChanges.filter((change) => change.isPriceDrop).length

  if (items.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16">
        <Card className="border-0 shadow-xl rounded-xl">
          <CardContent className="flex flex-col items-center justify-center py-20 px-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              className="w-24 h-24 rounded-full bg-linear-to-br from-purple-100 to-pink-100 flex items-center justify-center mb-6"
            >
              <Heart className="w-12 h-12 text-purple-600" />
            </motion.div>
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Your Wishlist is Empty</h2>
            <p className="text-gray-600 text-center mb-8 max-w-md">
              Start adding your favorite products to your wishlist! Click the heart icon on any
              product to save it for later.
            </p>
            <Link to="/">
              <Button size="lg" className="rounded-full">
                Start Shopping
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const allSelected =
    selectedItems.size === filteredAndSortedItems.length && filteredAndSortedItems.length > 0

  return (
    <div className=" mx-auto px-4 py-12">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3">
                My Wishlist
                {totalCount > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                    className="flex items-center justify-center min-w-[32px] h-8 px-2.5 rounded-full bg-linear-to-br from-red-500 via-pink-500 to-rose-500 text-white font-bold text-sm shadow-lg border-2 border-white"
                  >
                    {totalCount}
                  </motion.span>
                )}
              </h1>
              <p className="text-gray-600">
                {totalCount} {totalCount === 1 ? 'item' : 'items'} saved for later
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={wishlist?.isPublic ? 'default' : 'outline'}
              size="sm"
              onClick={handleToggleVisibility}
              disabled={updateVisibilityMutation.isPending || !wishlist}
              className="rounded-full"
            >
              {updateVisibilityMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : wishlist?.isPublic ? (
                <Globe2 className="w-4 h-4 mr-2" />
              ) : (
                <Lock className="w-4 h-4 mr-2" />
              )}
              {wishlist?.isPublic ? 'Public' : 'Private'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleShare}
              disabled={generateShareTokenMutation.isPending}
              className="rounded-full"
            >
              {generateShareTokenMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Share2 className="w-4 h-4 mr-2" />
              )}
              Share
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => handleMoveAllToCart(false)}
              disabled={moveAllToCartMutation.isPending || items.length === 0}
              className="rounded-full"
            >
              {moveAllToCartMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <ShoppingCart className="w-4 h-4 mr-2" />
              )}
              Move All to Cart
            </Button>
          </div>
        </div>

        {/* Price Change Summary */}
        {itemsWithPriceDrop > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-4 bg-green-50 border border-green-200 rounded-xl"
          >
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="w-5 h-5 text-green-600" />
              <span className="font-semibold text-green-800">
                {itemsWithPriceDrop} item{itemsWithPriceDrop > 1 ? 's' : ''} on sale!
              </span>
            </div>
            {totalPriceChange < 0 && (
              <p className="text-sm text-green-700">
                You could save {formatCurrency(Math.abs(totalPriceChange))} on these items
              </p>
            )}
          </motion.div>
        )}
      </div>

      {/* Filters and Controls */}
      <div className="mb-6 space-y-4">
        {/* Search and View Toggle */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <div className="flex-1 relative">
            <Input
              placeholder="Search wishlist..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 rounded-full"
            />
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('grid')}
              className="rounded-full"
            >
              <Grid3x3 className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="rounded-full"
            >
              <List className="w-4 h-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="rounded-full">
                  <ArrowUpDown className="w-4 h-4 mr-2" />
                  Sort
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setSortBy('date')}>Date Added</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy('price-asc')}>
                  Price: Low to High
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy('price-desc')}>
                  Price: High to Low
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy('name')}>Name</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy('rating')}>Rating</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedItems.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-4 p-4 bg-blue-50 border border-blue-200 rounded-xl"
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
            <Separator orientation="vertical" className="h-6" />
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const selectedProductIds = Array.from(selectedItems)
                selectedProductIds.forEach((productId) => {
                  const item = items.find((i) => i?.product?._id === productId)
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
              className="rounded-full"
            >
              <ShoppingCart className="w-4 h-4 mr-2" />
              Add to Cart
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkRemove}
              disabled={bulkRemoveMutation.isPending}
              className="text-red-600 hover:text-red-700 hover:bg-red-50 rounded-full"
            >
              {bulkRemoveMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Remove
            </Button>
          </motion.div>
        )}

        {/* Quick Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant={filterInStock === null ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterInStock(null)}
            className="rounded-full"
          >
            All
          </Button>
          <Button
            variant={filterInStock === true ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterInStock(true)}
            className="rounded-full"
          >
            In Stock
          </Button>
          <Button
            variant={filterInStock === false ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterInStock(false)}
            className="rounded-full"
          >
            Out of Stock
          </Button>
        </div>
      </div>

      {/* Results Count */}
      {filteredAndSortedItems.length !== items.length && (
        <div className="mb-4">
          <p className="text-sm text-gray-600">
            Showing {filteredAndSortedItems.length} of {totalCount} items
          </p>
        </div>
      )}

      {/* Items Display */}
      {filteredAndSortedItems.length === 0 ? (
        <Card className="border-0 shadow-xl rounded-xl">
          <CardContent className="flex flex-col items-center justify-center py-20 px-8">
            <p className="text-gray-600 text-center mb-4">No items match your filters</p>
            <Button
              variant="outline"
              onClick={() => {
                setSearchQuery('')
                setFilterInStock(null)
                setFilterPriceRange(null)
              }}
              className="rounded-full"
            >
              Clear Filters
            </Button>
          </CardContent>
        </Card>
      ) : (
        <InfiniteScrollContainer
          hasNextPage={hasNextPage ?? false}
          isFetchingNextPage={isFetchingNextPage}
          onLoadMore={fetchNextPage}
          maxHeight="70vh"
          threshold={300}
          showEndIndicator={items.length > PAGE_SIZE}
          endIndicator={
            <div className="flex items-center justify-center py-4">
              <span className="text-sm text-muted-foreground">
                You've seen all your wishlist items
              </span>
            </div>
          }
        >
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              <AnimatePresence mode="popLayout">
                {filteredAndSortedItems
                  .filter((item) => {
                    if (!item || !item.product) return false
                    const pid = item.product._id
                    return pid ? true : false
                  })
                  .map((item) => {
                    const productId =
                      typeof item.product._id === 'string'
                        ? item.product._id
                        : String(item.product._id)
                    const priceChange = priceChanges.find((pc) => pc.productId === productId)
                    return (
                      <motion.div
                        key={productId}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ duration: 0.2 }}
                        className="relative"
                      >
                        <div className="absolute top-2 left-2 z-10">
                          <Checkbox
                            checked={selectedItems.has(productId)}
                            onCheckedChange={() => handleSelectItem(productId)}
                            className="rounded-md bg-white/90 backdrop-blur-sm"
                          />
                        </div>
                        {priceChange?.isPriceDrop && (
                          <Badge className="absolute top-2 right-2 z-10 bg-green-500 text-white">
                            <TrendingDown className="w-3 h-3 mr-1" />
                            {priceChange.changePercent}% OFF
                          </Badge>
                        )}
                        <WishlistItemCard
                          item={item}
                          priceChange={priceChange}
                          onRemove={(productId) => {
                            // Get variantId from item if available (stored at item level)
                            const variantId = item?.variantId
                            removeMutation.mutate({ productId, variantId })
                          }}
                          isRemoving={removeMutation.isPending}
                        />
                      </motion.div>
                    )
                  })}
              </AnimatePresence>
            </div>
          ) : (
            <div className="space-y-4">
              <AnimatePresence mode="popLayout">
                {filteredAndSortedItems
                  .filter((item) => item?.product?._id)
                  .map((item) => {
                    const priceChange = priceChanges.find((pc) => pc.productId === item.product._id)
                    return (
                      <motion.div
                        key={item.product._id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.2 }}
                      >
                        <WishlistItemCard
                          item={item}
                          priceChange={priceChange}
                          onRemove={(productId) => {
                            // Get variantId from item if available (stored at item level)
                            const variantId = item?.variantId
                            removeMutation.mutate({ productId, variantId })
                          }}
                          isRemoving={removeMutation.isPending}
                        />
                      </motion.div>
                    )
                  })}
              </AnimatePresence>
            </div>
          )}
        </InfiniteScrollContainer>
      )}
    </div>
  )
}

export default Wishlist
