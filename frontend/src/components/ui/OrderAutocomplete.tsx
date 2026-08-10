import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useUserOrders } from '@/api/orderQueries'
import { Check, ChevronsUpDown, Image as ImageIcon, Package, Search, X } from 'lucide-react'
import { useMemo, useState, useEffect } from 'react'
import { useDebounce } from '@/hooks/useDebounce'
import type { Order, OrderItem } from '@/api/orders'

const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
})

const mapToCustomerStatus = (status: string): string => {
  const statusMap: Record<string, string> = {
    pending: 'Pending',
    processing: 'Processing',
    ready_to_ship: 'Ready to Ship',
    pickup_requested: 'Pickup Requested',
    shipped: 'Shipped',
    in_transit: 'In Transit',
    out_for_delivery: 'Out for Delivery',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
    refunded: 'Refunded',
    confirmed: 'Confirmed',
  }
  return statusMap[status] || status.replace(/_/g, ' ')
}

interface OrderAutocompleteProps {
  value?: string
  onChange: (orderId: string | undefined) => void
  placeholder?: string
  disabled?: boolean
}

export const OrderAutocomplete = ({
  value,
  onChange,
  placeholder = 'Search for an order...',
  disabled = false,
}: OrderAutocompleteProps) => {
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const debouncedSearch = useDebounce(searchQuery, 300)

  // Fetch orders with search query - backend supported
  const { data: ordersData, isLoading } = useUserOrders({
    search: debouncedSearch.trim() || undefined,
    limit: 20, // Get more results for better UX
  })

  const orders = ordersData?.data || []
  
  // Fetch all orders (without search) to find selected order if it's not in current filtered results
  const needsSelectedOrder = value && !orders.find((o) => o._id === value)
  const { data: allOrdersData } = useUserOrders({ 
    limit: 100,
  })

  const selectedOrder = useMemo(() => {
    if (!value) return null
    // Check in current filtered orders first
    const found = orders.find((order) => order._id === value)
    if (found) return found
    // If not found and we have all orders data, check there
    if (needsSelectedOrder && allOrdersData?.data) {
      return allOrdersData.data.find((order) => order._id === value) || null
    }
    return null
  }, [value, orders, needsSelectedOrder, allOrdersData])

  const formatDate = (dateString: string | Date) => {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const handleSelect = (orderId: string) => {
    onChange(orderId === value ? undefined : orderId)
    setOpen(false)
    setSearchQuery('')
  }

  const handleClear = () => {
    onChange(undefined)
    setSearchQuery('')
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between h-auto min-h-10 py-2"
        >
          {selectedOrder ? (
            <div className="flex items-center justify-between flex-1 min-w-0">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <Package className="h-4 w-4 shrink-0 text-gray-500" />
                <div className="flex flex-col items-start min-w-0 flex-1">
                  <span className="text-sm font-medium truncate">
                    Order #{selectedOrder.orderNumber || selectedOrder._id.slice(-8)}
                  </span>
                  <span className="text-xs text-gray-500 truncate">
                    {selectedOrder.items[0]?.product.name}
                    {selectedOrder.items.length > 1 && ` +${selectedOrder.items.length - 1} more`}
                  </span>
                </div>
              </div>
              <X
                className="h-4 w-4 shrink-0 text-gray-400 hover:text-gray-600 ml-2"
                onClick={(e) => {
                  e.stopPropagation()
                  handleClear()
                }}
              />
            </div>
          ) : (
            <>
              <span className="text-gray-500">{placeholder}</span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] max-w-[500px] p-0" align="start">
        <div className="flex flex-col">
          {/* Search Input */}
          <div className="flex items-center border-b px-3 py-2">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <Input
              placeholder="Search by order number, product, or status..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
              autoFocus
            />
          </div>

          {/* Results */}
          <ScrollArea className="h-[400px]">
            {isLoading ? (
              <div className="p-2 space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="border rounded-lg p-4 space-y-3">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                ))}
              </div>
            ) : orders.length === 0 ? (
              <div className="py-6 text-center text-sm text-gray-500">
                {debouncedSearch ? 'No orders found.' : 'No orders available.'}
              </div>
            ) : (
              <div className="p-2">
                {orders.map((order) => {
                  const isSelected = value === order._id
                  const orderNumber = order.orderNumber || order._id.slice(-8)
                  const orderDate = formatDate(order.createdAt)

                  return (
                    <div
                      key={order._id}
                      onClick={() => handleSelect(order._id)}
                      className={cn(
                        'relative flex flex-col gap-3 rounded-lg border p-4 cursor-pointer transition-all mb-2',
                        isSelected
                          ? 'border-primary bg-primary/5 shadow-md'
                          : 'border-gray-200 hover:border-primary/50 hover:bg-gray-50 hover:shadow-sm',
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5">
                            <Package className="h-4 w-4 text-gray-400 shrink-0" />
                            <span className="font-semibold text-sm text-gray-900">
                              Order #{orderNumber}
                            </span>
                            {isSelected && (
                              <Badge className="bg-primary text-primary-foreground text-xs">
                                Selected
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-500 mb-2 flex-wrap">
                            <span>{orderDate}</span>
                            <span>•</span>
                            <span className={cn(
                              'px-2 py-0.5 rounded-full text-xs font-medium',
                              order.status === 'delivered' ? 'bg-green-100 text-green-700' :
                              order.status === 'cancelled' || order.status === 'refunded' ? 'bg-red-100 text-red-700' :
                              'bg-blue-100 text-blue-700'
                            )}>
                              {mapToCustomerStatus(order.status)}
                            </span>
                          </div>
                          <div className="text-sm font-bold text-gray-900 mb-2">
                            {currencyFormatter.format(order.total)}
                          </div>
                        </div>
                      </div>

                      {/* Products List */}
                      <div className="space-y-1.5 border-t pt-2">
                        <div className="text-xs font-semibold text-gray-600 mb-1">
                          Products ({order.items.length}):
                        </div>
                        {order.items.slice(0, 3).map((item: OrderItem, idx: number) => {
                          // Get product image - prioritize variant image, then product mainImage
                          const productImage =
                            item.variant?.mainImage ||
                            item.product.mainImage ||
                            '/image-placeholder.svg'

                          return (
                            <div
                              key={idx}
                              className="flex items-center gap-3 text-xs bg-gray-50 rounded-md px-2.5 py-2"
                            >
                              {/* Product Image */}
                              <div className="relative w-12 h-12 shrink-0 rounded-md overflow-hidden bg-gray-200 border border-gray-200">
                                {productImage ? (
                                  <img
                                    src={productImage}
                                    alt={item.product.name}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      const target = e.target as HTMLImageElement
                                      target.src = '/image-placeholder.svg'
                                    }}
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center bg-gray-100">
                                    <ImageIcon className="w-4 h-4 text-gray-400" />
                                  </div>
                                )}
                              </div>
                              {/* Product Info */}
                              <div className="flex items-center justify-between gap-2 min-w-0 flex-1">
                                <div className="flex flex-col min-w-0 flex-1">
                                  <span className="truncate text-gray-700 font-medium">
                                    {item.product.name}
                                  </span>
                                  {item.variant?.name && (
                                    <span className="text-gray-500 text-xs">
                                      {item.variant.name}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="text-gray-600 font-medium">
                                    {currencyFormatter.format(item.effectivePrice ?? item.price)} × {item.quantity}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                        {order.items.length > 3 && (
                          <div className="text-xs text-gray-500 text-center py-1">
                            +{order.items.length - 3} more {order.items.length - 3 === 1 ? 'product' : 'products'}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </ScrollArea>
        </div>
      </PopoverContent>
    </Popover>
  )
}

