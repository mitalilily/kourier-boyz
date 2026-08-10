'use client'

import {
  useClearViewingHistory,
  useRecentlyViewedProductsInfinite,
  type Product,
} from '@/api/products'
import { InfiniteScrollContainer } from '@/components/ui/InfiniteScrollContainer'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { AnimatePresence, motion } from 'framer-motion'
import { Clock, Loader2, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import HistoryItemCard from '../../components/profile/HistoryItemCard'

const PAGE_SIZE = 20

const ProfileHistory = () => {
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useRecentlyViewedProductsInfinite({
      limit: PAGE_SIZE,
      enabled: true,
    })

  const clearHistoryMutation = useClearViewingHistory()
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false)

  // Flatten all pages into a single array of products
  const products = useMemo(() => {
    if (!data?.pages) return []
    return data.pages.flatMap((page) =>
      page.products.map((product) => ({
        ...product,
        viewInfo: product.viewInfo,
      })),
    )
  }, [data?.pages])

  // Group products by date
  const groupedProducts = useMemo(() => {
    const groups: Record<string, typeof products> = {}
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    products.forEach((product) => {
      if (!product.viewInfo?.lastViewedAt) return

      const viewDate = new Date(product.viewInfo.lastViewedAt)
      viewDate.setHours(0, 0, 0, 0)

      const diffTime = today.getTime() - viewDate.getTime()
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

      let groupKey: string
      if (diffDays === 0) {
        groupKey = 'Today'
      } else if (diffDays === 1) {
        groupKey = 'Yesterday'
      } else if (diffDays < 7) {
        groupKey = 'This Week'
      } else if (diffDays < 30) {
        groupKey = 'This Month'
      } else {
        groupKey = viewDate.toLocaleDateString('en-US', {
          month: 'long',
          year: 'numeric',
        })
      }

      if (!groups[groupKey]) {
        groups[groupKey] = []
      }
      groups[groupKey].push(product)
    })

    // Sort groups by date (most recent first)
    const sortedGroups: Record<string, typeof products> = {}
    const groupOrder = ['Today', 'Yesterday', 'This Week', 'This Month']
    const otherGroups: string[] = []

    Object.keys(groups).forEach((key) => {
      if (groupOrder.includes(key)) {
        sortedGroups[key] = groups[key]
      } else {
        otherGroups.push(key)
      }
    })

    // Sort other groups by date (most recent first)
    otherGroups.sort((a, b) => {
      const dateA = new Date(a)
      const dateB = new Date(b)
      return dateB.getTime() - dateA.getTime()
    })

    otherGroups.forEach((key) => {
      sortedGroups[key] = groups[key]
    })

    return sortedGroups
  }, [products])

  // Get total count from first page's pagination
  const totalCount = data?.pages[0]?.pagination?.total ?? products.length

  const handleClearHistory = async () => {
    try {
      await clearHistoryMutation.mutateAsync()
      toast.success('History cleared successfully')
      setIsClearDialogOpen(false)
    } catch {
      toast.error('Failed to clear history')
    }
  }

  if (isLoading) {
    return (
      <Card className="rounded-3xl border-0 bg-white shadow-sm">
        <CardHeader>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="h-5 w-32" />
                <div className="space-y-3">
                  {[...Array(2)].map((_, j) => (
                    <div key={j} className="flex gap-4">
                      <Skeleton className="w-24 h-24 rounded-lg" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-5 w-3/4" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-2/3" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card className="rounded-3xl bg-white shadow-sm">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-linear-to-br from-slate-100 to-slate-200">
                <Clock className="h-6 w-6 text-slate-700" />
              </div>
              <div>
                <CardTitle className="text-2xl font-bold text-gray-900">Browsing History</CardTitle>
                <CardDescription className="mt-1 text-sm text-slate-500">
                  {totalCount > 0
                    ? `${totalCount} ${totalCount === 1 ? 'product' : 'products'} viewed`
                    : 'Your browsing history will appear here'}
                </CardDescription>
              </div>
            </div>
            {totalCount > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setIsClearDialogOpen(true)}
                disabled={clearHistoryMutation.isPending}
                className="rounded-full"
              >
                {clearHistoryMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                Clear History
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {products.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-8"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                className="flex justify-center mb-6"
              >
                <div className="relative">
                  <Clock className="w-16 h-16 text-gray-300" />
                </div>
              </motion.div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No Browsing History</h3>
              <p className="text-gray-600 mb-6 max-w-md mx-auto">
                Products you view will appear here, making it easy to find them again later.
              </p>
              <Link to="/shop-by-category">
                <Button size="lg" className="rounded-full">
                  Start Shopping
                </Button>
              </Link>
            </motion.div>
          ) : (
            <InfiniteScrollContainer
              hasNextPage={hasNextPage ?? false}
              isFetchingNextPage={isFetchingNextPage}
              onLoadMore={fetchNextPage}
              maxHeight="70vh"
              threshold={300}
              showEndIndicator={products.length > PAGE_SIZE}
              endIndicator={
                <div className="flex items-center justify-center py-4">
                  <span className="text-sm text-muted-foreground">
                    You've reached the end of your browsing history
                  </span>
                </div>
              }
            >
              <div className="space-y-8">
                <AnimatePresence mode="popLayout">
                  {Object.entries(groupedProducts).map(([groupKey, groupProducts]) => (
                    <motion.div
                      key={groupKey}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="space-y-4"
                    >
                      {/* Date Group Header */}
                      <div className="flex items-center gap-3">
                        <div className="h-px flex-1 bg-linear-to-r from-transparent via-gray-300 to-transparent" />
                        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">
                          {groupKey}
                        </h3>
                        <div className="h-px flex-1 bg-linear-to-r from-transparent via-gray-300 to-transparent" />
                      </div>

                      {/* Products in this group */}
                      <div className="space-y-3 pl-4 border-l-2 border-gray-200">
                        <AnimatePresence mode="popLayout">
                          {groupProducts.map(
                            (
                              product: Product & {
                                viewInfo?: {
                                  viewCount: number
                                  firstViewedAt: string
                                  lastViewedAt: string
                                }
                              },
                            ) => {
                              const productId = product._id
                              return (
                                <HistoryItemCard
                                  key={productId}
                                  product={product}
                                  viewInfo={product.viewInfo}
                                />
                              )
                            },
                          )}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </InfiniteScrollContainer>
          )}
        </CardContent>
      </Card>

      {/* Clear History Dialog */}
      <Dialog open={isClearDialogOpen} onOpenChange={setIsClearDialogOpen}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>Clear Browsing History?</DialogTitle>
            <DialogDescription>
              This will permanently remove all products from your browsing history. This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setIsClearDialogOpen(false)}
              disabled={clearHistoryMutation.isPending}
              className="rounded-full"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleClearHistory}
              disabled={clearHistoryMutation.isPending}
              className="rounded-full"
            >
              {clearHistoryMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Clearing...
                </>
              ) : (
                'Clear History'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default ProfileHistory
