import { useUserFeedback } from '@/api/feedback'
import {
  orderKeys,
  useCancelOrder,
  useDownloadInvoice,
  useInfiniteUserOrders,
} from '@/api/orderQueries'
import type { Order, OrderItem } from '@/api/orders'
import { getOrder } from '@/api/orders'
import { useProduct } from '@/api/products'
import { useCreateReturn, useReplacementVariants, useReturnReasons } from '@/api/returns'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { InfiniteScrollContainer } from '@/components/ui/InfiniteScrollContainer'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  CheckCircle2,
  ChevronRight,
  Clock,
  CreditCard,
  Download,
  FileText,
  Image as ImageIcon,
  MapPin,
  MessageCircle,
  Package,
  RotateCcw,
  Search,
  Tag,
  X,
  XCircle,
} from 'lucide-react'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

/**
 * Extracts error message from various error types
 */
const getErrorMessage = (error: unknown, fallback = 'An unexpected error occurred'): string => {
  if (error && typeof error === 'object') {
    const err = error as {
      response?: { data?: { message?: string } }
      message?: string
    }
    return err.response?.data?.message || err.message || fallback
  }
  return fallback
}

const mapToCustomerStatus = (status: string): string => {
  const statusMap: Record<string, string> = {
    pending: 'We have received your order',
    processing: 'We are preparing your order',
    ready_to_ship: 'Your order is getting ready to ship',
    pickup_requested: 'Your order is ready for pickup',
    shipped: 'Your order has been shipped',
    in_transit: 'Your order is on its way',
    out_for_delivery: 'Your order is out for delivery',
    delivered: 'Your order has been delivered',
    cancelled: 'Your order was cancelled',
    refunded: 'Your order was refunded',
  }
  return statusMap[status] || status.replace(/_/g, ' ')
}

const mapReturnStatusForCustomer = (status?: string): string | null => {
  if (!status) return null
  const normalized = status.toUpperCase()
  switch (normalized) {
    case 'REQUESTED':
      return 'Return request submitted'
    case 'APPROVED_BY_SELLER':
      return 'Seller approved your return'
    case 'APPROVED_BY_ADMIN':
      return 'Return approved by support team'
    case 'REJECTED':
      return 'Return request rejected'
    case 'REVERSE_PICKUP_CREATED':
      return 'Item will be picked up soon'
    case 'REVERSE_PICKUP_IN_TRANSIT':
      return 'Return package in transit'
    case 'REVERSE_PICKUP_COMPLETED':
      return 'Return package delivered to seller'
    case 'RETURN_RECEIVED_BY_SELLER':
      return 'Seller received your return'
    case 'REFUND_INITIATED':
      return 'Refund initiated'
    case 'REFUND_COMPLETED':
      return 'Refund completed'
    default:
      return status.replace(/_/g, ' ')
  }
}

// Check if order can be cancelled (only before AWB/shipping is initiated and before return flow)
const canCancelOrder = (order: Order): boolean => {
  if (order.status === 'cancelled') return false
  // If a return is already in progress (any non-REJECTED status), do not allow cancellation.
  if (order.returnStatus && order.returnStatus !== 'REJECTED') return false
  // From a buyer perspective, once the order is packed / ready for courier
  // (ready_to_ship / pickup_requested) or beyond, we treat it as non‑cancellable.
  const nonCancellableStatuses = [
    'ready_to_ship',
    'pickup_requested',
    'shipped',
    'in_transit',
    'out_for_delivery',
    'delivered',
  ]
  return !nonCancellableStatuses.includes(order.status)
}

// Check if order has any returnable products
const hasReturnableProducts = (order: Order): boolean => {
  if (!order.items || order.items.length === 0) return false
  return order.items.some((item) => item.product?.returnable === true)
}

// Get the reason why return/replacement button is disabled
const getReturnButtonDisableReason = (order: Order): string | null => {
  if (order.status !== 'delivered') {
    return 'Order must be delivered to request return/replacement'
  }

  if (order.returnRequested && order.returnStatus && order.returnStatus !== 'REJECTED') {
    return 'Return request already in progress'
  }

  if (order.isReturnLocked) {
    return 'Return request locked due to repeated rejections'
  }

  if (!hasReturnableProducts(order)) {
    return 'This product is not eligible for return'
  }

  if (order.canRequestReturn === false) {
    // Check if it's a return window issue
    const hasReturnable = order.items.some((item) => item.product?.returnable === true)
    if (hasReturnable) {
      // Try to determine if it's a time window issue
      const returnableItem = order.items.find((item) => item.product?.returnable === true)
      if (returnableItem?.product?.returnDays) {
        return `Return window has expired (${returnableItem.product.returnDays} days from delivery)`
      }
      return 'Return window has expired'
    }
    return 'Return is not available for this order'
  }

  return null // Button should be enabled
}

const PAYMENT_STATUS_MAP: Record<
  string,
  {
    label: string
    className: string
    Icon: React.ComponentType<{ className?: string }>
    dotColor: string
  }
> = {
  pending: {
    label: 'Pending',
    className: 'bg-amber-50 text-amber-700 border-amber-200',
    Icon: Clock,
    dotColor: 'bg-amber-500',
  },
  paid: {
    label: 'Paid',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Icon: CheckCircle2,
    dotColor: 'bg-emerald-500',
  },
  failed: {
    label: 'Failed',
    className: 'bg-red-50 text-red-700 border-red-200',
    Icon: XCircle,
    dotColor: 'bg-red-500',
  },
  refunded: {
    label: 'Refunded',
    className: 'bg-slate-50 text-slate-700 border-slate-200',
    Icon: RotateCcw,
    dotColor: 'bg-slate-500',
  },
}

const PAYMENT_METHOD_MAP: Record<string, string> = {
  card: 'Card',
  cod: 'Cash on Delivery',
  wallet: 'Wallet',
  upi: 'UPI',
}

const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
})

const dateFormatter = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

const dateTimeFormatter = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

const StatusBadge = ({ status }: { status: string }) => {
  const lower = status.toLowerCase()
  let dotColor = 'bg-blue-500'
  let bgColor = 'bg-blue-50'
  let textColor = 'text-blue-700'
  let borderColor = 'border-blue-200'

  if (lower.includes('delivered')) {
    dotColor = 'bg-emerald-500'
    bgColor = 'bg-emerald-50'
    textColor = 'text-emerald-700'
    borderColor = 'border-emerald-200'
  } else if (lower.includes('cancelled') || lower.includes('refunded')) {
    dotColor = 'bg-red-500'
    bgColor = 'bg-red-50'
    textColor = 'text-red-700'
    borderColor = 'border-red-200'
  } else if (lower.includes('pickup')) {
    dotColor = 'bg-orange-500'
    bgColor = 'bg-orange-50'
    textColor = 'text-orange-700'
    borderColor = 'border-orange-200'
  } else if (lower.includes('shipped') || lower.includes('transit') || lower.includes('delivery')) {
    dotColor = 'bg-purple-500'
    bgColor = 'bg-purple-50'
    textColor = 'text-purple-700'
    borderColor = 'border-purple-200'
  }

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold shadow-sm',
        bgColor,
        textColor,
        borderColor,
      )}
    >
      <span className={cn('h-2 w-2 rounded-full shrink-0 animate-pulse', dotColor)} />
      <span>{status}</span>
    </div>
  )
}

// Enhanced Payment Status Badge Component
const PaymentStatusBadge = ({ status }: { status: string }) => {
  const config = PAYMENT_STATUS_MAP[status] || {
    label: status,
    className: 'bg-gray-50 text-gray-700 border-gray-200',
    Icon: Clock,
    dotColor: 'bg-gray-500',
  }

  const Icon = config.Icon

  return (
    <Badge
      variant="outline"
      className={cn(
        'flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium border shadow-sm',
        config.className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', config.dotColor)} />
      <Icon className="h-3 w-3 shrink-0" />
      <span>{config.label}</span>
    </Badge>
  )
}

interface MediaPreview {
  file: File
  preview: string // Object URL for preview
  type: 'image' | 'video' // Type of media file
}

interface ReturnFormState {
  reason: string
  description: string
  images: MediaPreview[] // Store File objects (images and videos) instead of URLs
  returnType: 'return' | 'replacement'
  exchangeVariantId?: string // For replacement/exchange - selected variant ID
  orderItemId?: string // The order item being returned/exchanged
  // Refund details for replacement price difference
  refundMode?: 'UPI' | 'BANK'
  upiId?: string
  bankAccountNumber?: string
  ifscCode?: string
  accountHolderName?: string
}

// Reasons that typically require photos/videos (for UI guidance only - backend validates)
// These are reasons where visual evidence is typically necessary for validation
const REASONS_REQUIRING_MEDIA = new Set([
  // Return reasons requiring media
  'defective',
  'damaged',
  'defective_on_arrival',
  'poor_quality',
  'quality_issue',
  'broken',
  'not_working',
  'faulty',
  'wrong_item',
  'wrong_product',
  'not_as_described',
  'expired',
  'expired_product',
  'near_expiry',
  'opened_damaged',
  'seal_broken',
  'used_item',
  'package_damaged',
  'damaged_packaging',
  'missing_items',
  'partially_missing',
  'wrong_quantity',
  'dimension_issue',
  'material_issue',
  'specification_mismatch',

  // Replacement reasons requiring media
  'damaged_product',
  'defective_product',
  'damaged_on_arrival',
  'broken_item',
  'faulty_product',
  'quality_issue',
  'poor_quality',
  'not_working',
  'wrong_item',
  'wrong_product',
  'wrong_variant',
  'color_not_as_shown',
])

/**
 * Validate description
 */
const validateDescription = (
  description: string,
  isSecondAttempt: boolean,
): { valid: boolean; error?: string } => {
  if (isSecondAttempt && (!description || description.trim().length < 20)) {
    return {
      valid: false,
      error: 'Description must be at least 20 characters for second return attempt',
    }
  }

  if (description && description.length > 2000) {
    return { valid: false, error: 'Description cannot exceed 2000 characters' }
  }

  return { valid: true }
}

// Reasons that allow same variant replacement (damaged/defective/quality issues)
const SAME_VARIANT_REPLACEMENT_REASONS = [
  'damaged_product',
  'defective_product',
  'damaged_on_arrival',
  'broken_item',
  'faulty_product',
  'quality_issue',
  'poor_quality',
  'not_working',
]

// Exchange Variant Selector Component - Simple & Clean
const ExchangeVariantSelector = ({
  returnOrder,
  returnForm,
  setReturnForm,
}: {
  returnOrder: Order
  returnForm: ReturnFormState
  setReturnForm: React.Dispatch<React.SetStateAction<ReturnFormState>>
}) => {
  // Get the first returnable item
  const orderItem = returnOrder.items.find((item) => item.product?.returnable === true)
  const productId = orderItem?.product?._id
  const orderItemId = returnForm.orderItemId || orderItem?._id

  // Check if order item has a variant (required for replacement, except for same-variant reasons)
  const orderItemHasVariant = !!orderItem?.variantId

  // Check if this is a same-variant replacement reason (damaged/defective)
  const isSameVariantReason = SAME_VARIANT_REPLACEMENT_REASONS.includes(returnForm.reason)

  // Fetch replacement variants using the API
  // For same-variant reasons, enable even if no variant is selected (allows same product replacement)
  const {
    data: replacementData,
    isLoading: isLoadingVariants,
    error: variantsError,
  } = useReplacementVariants(returnOrder._id, orderItemId, {
    enabled: !!orderItemId && (!!orderItemHasVariant || isSameVariantReason) && !!returnForm.reason,
    reason: returnForm.reason,
  })

  // Fetch product details for fallback display
  const { data: product, isLoading: isLoadingProduct } = useProduct(productId || '')

  if (!productId || !orderItemId) {
    return (
      <div className="rounded-md border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-700">
        Unable to load product details for replacement.
      </div>
    )
  }

  // Check if order item has a variant - required for replacement (except for same-variant reasons)
  if (!orderItemHasVariant && !isSameVariantReason) {
    return (
      <div className="rounded-md border border-amber-100 bg-amber-50 px-3 py-2 text-sm text-amber-800">
        <p className="font-medium mb-1">Replacement not available for this item</p>
        <p className="text-xs">
          This item does not have a variant selected. Please request a return instead.
        </p>
      </div>
    )
  }

  // Show message if reason is not selected yet
  if (!returnForm.reason) {
    return (
      <div className="rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-800">
        <p className="font-medium mb-1">Please select a reason first</p>
        <p className="text-xs">Select a replacement reason above to see available options.</p>
      </div>
    )
  }

  if (isLoadingVariants || isLoadingProduct) {
    return (
      <div className="flex gap-4">
        <Skeleton className="h-24 w-24 rounded-lg shrink-0" />
        <div className="flex-1 space-y-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      </div>
    )
  }

  // Check if replacement is not available
  if (variantsError || !replacementData?.success) {
    return (
      <div className="rounded-md border border-amber-100 bg-amber-50 px-3 py-2 text-sm text-amber-800">
        <p className="font-medium mb-1">Replacement not available for this order</p>
        <p className="text-xs">
          {replacementData?.data?.message ||
            'This product does not have eligible variants for replacement. You may request a return instead.'}
        </p>
      </div>
    )
  }

  const variants = replacementData.data.variants || []
  const originalVariant = replacementData.data.originalVariant
  const originalPrice = replacementData.data.originalPrice || 0

  // If no eligible variants, show message
  if (variants.length === 0) {
    // For damaged/defective reasons, show a more helpful message
    if (isSameVariantReason) {
      return (
        <div className="rounded-md border border-amber-100 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <p className="font-medium mb-1">Same product replacement not available</p>
          <p className="text-xs">
            The same product variant is currently out of stock and no alternative variants are
            available. You may request a return for refund instead.
          </p>
        </div>
      )
    }
    return (
      <div className="rounded-md border border-amber-100 bg-amber-50 px-3 py-2 text-sm text-amber-800">
        <p className="font-medium mb-1">Replacement not available for this order</p>
        <p className="text-xs">
          {replacementData.data.message ||
            'No eligible replacement variants found for this product. You may request a return instead.'}
        </p>
      </div>
    )
  }

  // Check if product has variants (for simple products)
  // For same-variant reasons, allow replacement even if product doesn't have variants
  if (!product?.hasVariants && !isSameVariantReason) {
    return (
      <div className="rounded-md border border-amber-100 bg-amber-50 px-3 py-2 text-sm text-amber-800">
        <p className="font-medium mb-1">Replacement not available for this product</p>
        <p className="text-xs">
          This product does not have variants available for replacement. You may request a return
          instead.
        </p>
      </div>
    )
  }

  // Helper: Find attribute key by matching patterns
  const findAttributeKey = (patterns: string[]): string | null => {
    const allKeys = Array.from(new Set(variants.map((v) => Object.keys(v.attributes || {})).flat()))
    const matchingKey = allKeys.find((key) =>
      patterns.some((pattern) => key.toLowerCase().includes(pattern.toLowerCase())),
    )
    return matchingKey || null
  }

  // Helper: Get unique attribute values for a given attribute key
  const getUniqueAttributeValues = (attributeKey: string | null): string[] => {
    if (!attributeKey) return []
    return Array.from(
      new Set(variants.map((v) => v.attributes?.[attributeKey]).filter((v): v is string => !!v)),
    )
  }

  // Extract color and size attributes
  const colorAttribute = findAttributeKey(['color', 'colour'])
  const sizeAttribute = findAttributeKey(['size'])

  // Get unique color and size values
  const colorValues = getUniqueAttributeValues(colorAttribute)
  const sizeValues = getUniqueAttributeValues(sizeAttribute)

  // Get selected variant
  const selectedVariant = variants.find((v) => v._id === returnForm.exchangeVariantId)
  const selectedColor = selectedVariant?.attributes?.[colorAttribute || '']
  const selectedSize = selectedVariant?.attributes?.[sizeAttribute || '']

  // Get current variant from original order
  const currentVariant = variants.find((v) => v._id === originalVariant._id) || originalVariant

  // Get product image - update based on selection
  const productImage = selectedVariant?.mainImage || product?.mainImage || variants[0]?.mainImage

  // Find matching variant for color and size combination
  const findMatchingVariant = (color?: string, size?: string) => {
    if (!colorAttribute && !sizeAttribute) return null
    return (
      variants.find((v) => {
        const matchesColor = !colorAttribute || !color || v.attributes?.[colorAttribute] === color
        const matchesSize = !sizeAttribute || !size || v.attributes?.[sizeAttribute] === size
        return matchesColor && matchesSize
      }) || null
    )
  }

  // Check if variant is available and can be replaced
  const isVariantAvailable = (variant: (typeof variants)[0]): boolean => {
    return (variant.stock ?? 0) > 0 && variant.canReplace === true
  }

  // Handle color selection
  const handleColorSelect = (color: string) => {
    const currentSize = selectedSize || currentVariant?.attributes?.[sizeAttribute || '']
    const matchingVariant = findMatchingVariant(color, currentSize)
    if (matchingVariant && isVariantAvailable(matchingVariant)) {
      setReturnForm((prev) => ({
        ...prev,
        exchangeVariantId: matchingVariant._id,
      }))
    }
  }

  // Handle size selection
  const handleSizeSelect = (size: string) => {
    const currentColor = selectedColor || currentVariant?.attributes?.[colorAttribute || '']
    const matchingVariant = findMatchingVariant(currentColor, size)
    if (matchingVariant && isVariantAvailable(matchingVariant)) {
      setReturnForm((prev) => ({
        ...prev,
        exchangeVariantId: matchingVariant._id,
      }))
    }
  }

  // Helper: Get available attribute values filtered by another attribute
  const getAvailableAttributeValues = (
    targetAttribute: string | null,
    filterAttribute: string | null,
    filterValue?: string,
  ): string[] => {
    if (!targetAttribute) return []
    const filteredVariants =
      filterAttribute && filterValue
        ? variants.filter((v) => v.attributes?.[filterAttribute] === filterValue)
        : variants
    return Array.from(
      new Set(
        filteredVariants
          .map((v) => v.attributes?.[targetAttribute])
          .filter((v): v is string => !!v),
      ),
    )
  }

  // Get available sizes for selected color
  const getAvailableSizes = (color?: string): string[] => {
    return getAvailableAttributeValues(sizeAttribute, colorAttribute, color)
  }

  // Get available colors for selected size
  const getAvailableColors = (size?: string): string[] => {
    return getAvailableAttributeValues(colorAttribute, sizeAttribute, size)
  }

  // Check if a color/size combination is available
  const isOptionAvailable = (color?: string, size?: string): boolean => {
    const variant = findMatchingVariant(color, size)
    return variant ? isVariantAvailable(variant) : false
  }

  const currentColor = currentVariant?.attributes?.[colorAttribute || '']
  const currentSize = currentVariant?.attributes?.[sizeAttribute || '']

  // Find the same variant (for damaged/defective replacement)
  const sameVariant = variants.find((v) => v.isSameVariant)
  const sameVariantAvailable = sameVariant && isVariantAvailable(sameVariant)

  // Handle same product replacement selection
  const handleSameProductSelect = () => {
    if (sameVariant && sameVariantAvailable) {
      setReturnForm((prev) => ({
        ...prev,
        exchangeVariantId: sameVariant._id,
      }))
    }
  }

  return (
    <div className="border border-gray-200 rounded-lg bg-white p-4">
      <div className="flex gap-4">
        {/* Product Image - Left Side */}
        <div className="shrink-0">
          <img
            src={productImage}
            alt={product?.name || 'Product'}
            className="h-24 w-24 rounded-lg object-cover border border-gray-200 bg-gray-50"
          />
        </div>

        {/* Variant Options - Right Side */}
        <div className="flex-1 min-w-0 space-y-3">
          <div>
            <p className="text-sm font-semibold text-gray-900 mb-1">{product?.name || 'Product'}</p>
            <p className="text-xs text-gray-500">
              {isSameVariantReason ? 'Confirm replacement' : 'Select replacement variant'}
            </p>
          </div>

          {/* Same Product Replacement Option - for damaged/defective */}
          {isSameVariantReason && sameVariant && (
            <div className="space-y-2">
              <div
                onClick={sameVariantAvailable ? handleSameProductSelect : undefined}
                className={cn(
                  'border rounded-lg p-3 transition-all',
                  returnForm.exchangeVariantId === sameVariant._id
                    ? 'border-green-500 bg-green-50 ring-1 ring-green-500'
                    : sameVariantAvailable
                    ? 'border-gray-300 bg-white hover:border-green-400 cursor-pointer'
                    : 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed',
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0',
                      returnForm.exchangeVariantId === sameVariant._id
                        ? 'border-green-500 bg-green-500'
                        : 'border-gray-300',
                    )}
                  >
                    {returnForm.exchangeVariantId === sameVariant._id && (
                      <CheckCircle2 className="w-3 h-3 text-white" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">Replace with same product</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {currentColor && `${currentColor}`}
                      {currentColor && currentSize && ' • '}
                      {currentSize && `${currentSize}`}
                      {!currentColor && !currentSize && sameVariant.name}
                    </p>
                  </div>
                  {sameVariantAvailable ? (
                    <span className="text-xs font-medium text-green-600 bg-green-100 px-2 py-0.5 rounded">
                      In Stock
                    </span>
                  ) : (
                    <span className="text-xs font-medium text-red-600 bg-red-100 px-2 py-0.5 rounded">
                      Out of Stock
                    </span>
                  )}
                </div>
              </div>

              {!sameVariantAvailable &&
                product?.hasVariants &&
                variants.filter((v) => !v.isSameVariant).length > 0 && (
                  <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                    Same product is currently out of stock. You can select a different variant below
                    or request a return instead.
                  </p>
                )}

              {/* Divider - show other options */}
              {variants.filter((v) => !v.isSameVariant).length > 0 && (
                <div className="relative py-2">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-white px-2 text-xs text-gray-500">
                      or select a different variant
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Color Selection */}
          {colorAttribute && colorValues.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-700">
                Color <span className="text-red-500">*</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {getAvailableColors(selectedSize || currentSize).map((color) => {
                  const isAvailable = isOptionAvailable(color, selectedSize || currentSize)
                  const isSelected = selectedColor === color
                  const isCurrent = currentColor === color

                  return (
                    <button
                      key={color}
                      type="button"
                      disabled={!isAvailable}
                      onClick={() => handleColorSelect(color)}
                      className={cn(
                        'px-3 py-1.5 rounded-md border text-xs font-medium transition-all',
                        isSelected
                          ? 'border-yellow-500 bg-yellow-50 text-yellow-700'
                          : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400',
                        !isAvailable && 'opacity-40 cursor-not-allowed',
                        isAvailable && !isSelected && 'hover:bg-gray-50',
                        isCurrent && !isSelected && 'ring-1 ring-gray-300',
                      )}
                    >
                      {color}
                      {isCurrent && (
                        <span className="ml-1.5 text-[10px] text-gray-500">(current)</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Size Selection */}
          {sizeAttribute && sizeValues.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-700">
                Size <span className="text-red-500">*</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {getAvailableSizes(selectedColor || currentColor).map((size) => {
                  const isAvailable = isOptionAvailable(selectedColor || currentColor, size)
                  const isSelected = selectedSize === size
                  const isCurrent = currentSize === size

                  return (
                    <button
                      key={size}
                      type="button"
                      disabled={!isAvailable}
                      onClick={() => handleSizeSelect(size)}
                      className={cn(
                        'px-3 py-1.5 rounded-md border text-xs font-medium transition-all',
                        isSelected
                          ? 'border-yellow-500 bg-yellow-50 text-yellow-700'
                          : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400',
                        !isAvailable && 'opacity-40 cursor-not-allowed',
                        isAvailable && !isSelected && 'hover:bg-gray-50',
                        isCurrent && !isSelected && 'ring-1 ring-gray-300',
                      )}
                    >
                      {size}
                      {isCurrent && (
                        <span className="ml-1.5 text-[10px] text-gray-500">(current)</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Validation message */}
          {!returnForm.exchangeVariantId &&
            !(
              isSameVariantReason &&
              sameVariant &&
              !sameVariantAvailable &&
              product?.hasVariants &&
              variants.filter((v) => !v.isSameVariant).length > 0
            ) && (
              <p className="text-xs text-red-600 mt-2">Please select a variant for replacement</p>
            )}

          {/* Selected variant confirmation with price difference */}
          {selectedVariant && (
            <div className="pt-2 mt-2 border-t border-gray-200 space-y-2">
              <p className="text-xs text-gray-600">
                <span className="font-medium text-gray-900">Selected:</span>{' '}
                {selectedColor && `${selectedColor}`}
                {selectedColor && selectedSize && ' • '}
                {selectedSize && `${selectedSize}`}
              </p>
              {/* Price comparison */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-gray-600">Original Price:</span>
                <span className="font-medium text-gray-900">₹{originalPrice.toFixed(2)}</span>
                <span className="text-gray-400">→</span>
                <span className="text-gray-600">Replacement Price:</span>
                <span className="font-medium text-gray-900">
                  ₹{selectedVariant.price.toFixed(2)}
                </span>
              </div>
              {/* Price difference */}
              {selectedVariant.priceDifference !== undefined &&
                selectedVariant.priceDifference < 0 && (
                  <div className="px-2 py-1 rounded text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                    <span>
                      You will receive a refund of ₹
                      {Math.abs(selectedVariant.priceDifference).toFixed(2)} per item (₹
                      {Math.abs(
                        selectedVariant.priceDifference * (orderItem?.quantity || 1),
                      ).toFixed(2)}{' '}
                      total)
                    </span>
                  </div>
                )}
              {selectedVariant.priceDifference === 0 && (
                <div className="px-2 py-1 rounded bg-gray-50 text-gray-600 text-xs font-medium border border-gray-200">
                  Same price - no refund needed
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Replacement Request Form Component (wraps variant selector and refund form)
const ReplacementRequestForm = ({
  returnOrder,
  returnForm,
  setReturnForm,
  validationErrors,
  setValidationErrors,
}: {
  returnOrder: Order
  returnForm: ReturnFormState
  setReturnForm: React.Dispatch<React.SetStateAction<ReturnFormState>>
  validationErrors: {
    refundMode?: string
    upiId?: string
    bankAccountNumber?: string
    ifscCode?: string
    accountHolderName?: string
  }
  setValidationErrors: React.Dispatch<
    React.SetStateAction<{
      refundMode?: string
      upiId?: string
      bankAccountNumber?: string
      ifscCode?: string
      accountHolderName?: string
    }>
  >
}) => {
  const orderItem = returnOrder.items.find((item) => item.product?.returnable === true)
  const orderItemId = returnForm.orderItemId || orderItem?._id
  const orderItemHasVariant = !!orderItem?.variant?._id
  const { data: replacementData } = useReplacementVariants(returnOrder._id, orderItemId, {
    enabled: !!orderItemId && !!orderItemHasVariant && !!returnForm.reason,
    reason: returnForm.reason,
  })

  const selectedVariant = replacementData?.data?.variants?.find(
    (v) => v._id === returnForm.exchangeVariantId,
  )
  const priceDifference =
    selectedVariant?.priceDifference !== undefined && selectedVariant.priceDifference < 0
      ? Math.abs(selectedVariant.priceDifference)
      : 0

  return (
    <>
      <ExchangeVariantSelector
        returnOrder={returnOrder}
        returnForm={returnForm}
        setReturnForm={setReturnForm}
      />
      {selectedVariant && priceDifference > 0 && (
        <RefundDetailsForm
          returnForm={returnForm}
          setReturnForm={setReturnForm}
          priceDifference={priceDifference}
          quantity={orderItem?.quantity || 1}
          validationErrors={validationErrors}
          setValidationErrors={setValidationErrors}
        />
      )}
    </>
  )
}

// Refund Details Form Component for replacement price difference
const RefundDetailsForm = ({
  returnForm,
  setReturnForm,
  priceDifference,
  quantity,
  validationErrors,
  setValidationErrors,
}: {
  returnForm: ReturnFormState
  setReturnForm: React.Dispatch<React.SetStateAction<ReturnFormState>>
  priceDifference: number
  quantity: number
  validationErrors: {
    refundMode?: string
    upiId?: string
    bankAccountNumber?: string
    ifscCode?: string
    accountHolderName?: string
  }
  setValidationErrors: React.Dispatch<
    React.SetStateAction<{
      refundMode?: string
      upiId?: string
      bankAccountNumber?: string
      ifscCode?: string
      accountHolderName?: string
    }>
  >
}) => {
  const refundAmount = Math.abs(priceDifference * quantity)

  const handleRefundModeChange = (mode: 'UPI' | 'BANK') => {
    setReturnForm((prev) => ({
      ...prev,
      refundMode: mode,
      // Clear opposite mode fields
      upiId: mode === 'UPI' ? prev.upiId : undefined,
      bankAccountNumber: mode === 'BANK' ? prev.bankAccountNumber : undefined,
      ifscCode: mode === 'BANK' ? prev.ifscCode : undefined,
      accountHolderName: mode === 'BANK' ? prev.accountHolderName : undefined,
    }))
    // Clear validation errors when changing mode
    setValidationErrors((prev) => ({
      ...prev,
      refundMode: undefined,
      upiId: undefined,
      bankAccountNumber: undefined,
      ifscCode: undefined,
      accountHolderName: undefined,
    }))
  }

  const handleUpiIdChange = (value: string) => {
    setReturnForm((prev) => ({ ...prev, upiId: value }))
    if (validationErrors.upiId) {
      setValidationErrors((prev) => ({ ...prev, upiId: undefined }))
    }
  }

  const handleBankDetailsChange = (
    field: 'bankAccountNumber' | 'ifscCode' | 'accountHolderName',
    value: string,
  ) => {
    setReturnForm((prev) => ({ ...prev, [field]: value }))
    if (validationErrors[field]) {
      setValidationErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  return (
    <div className="border border-blue-200 rounded-lg bg-blue-50 p-4 space-y-4">
      <div>
        <h4 className="text-sm font-semibold text-gray-900 mb-1">Refund Details</h4>
        <p className="text-xs text-gray-600">
          You will receive a refund of{' '}
          <span className="font-semibold">₹{refundAmount.toFixed(2)}</span> for the price
          difference. Please provide your refund details below.
        </p>
      </div>

      {/* Refund Method Selection */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-gray-700">
          Refund Method <span className="text-red-500">*</span>
        </label>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => handleRefundModeChange('UPI')}
            className={cn(
              'flex-1 px-4 py-2 rounded-md border text-sm font-medium transition-all',
              returnForm.refundMode === 'UPI'
                ? 'border-blue-500 bg-blue-100 text-blue-700'
                : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400',
            )}
          >
            UPI
          </button>
          <button
            type="button"
            onClick={() => handleRefundModeChange('BANK')}
            className={cn(
              'flex-1 px-4 py-2 rounded-md border text-sm font-medium transition-all',
              returnForm.refundMode === 'BANK'
                ? 'border-blue-500 bg-blue-100 text-blue-700'
                : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400',
            )}
          >
            Bank Transfer
          </button>
        </div>
        {validationErrors.refundMode && (
          <p className="text-xs text-red-600">{validationErrors.refundMode}</p>
        )}
      </div>

      {/* UPI Details */}
      {returnForm.refundMode === 'UPI' && (
        <div className="space-y-2">
          <label htmlFor="upiId" className="text-xs font-medium text-gray-700">
            UPI ID <span className="text-red-500">*</span>
          </label>
          <Input
            id="upiId"
            type="text"
            placeholder="yourname@paytm or yourname@ybl"
            value={returnForm.upiId || ''}
            onChange={(e) => handleUpiIdChange(e.target.value)}
            className={cn(
              'text-sm',
              validationErrors.upiId && 'border-red-500 focus:border-red-500 focus:ring-red-500',
            )}
          />
          {validationErrors.upiId && (
            <p className="text-xs text-red-600">{validationErrors.upiId}</p>
          )}
          <p className="text-xs text-gray-500">
            Enter your UPI ID in format: xyz@paytm, xyz@ybl, etc.
          </p>
        </div>
      )}

      {/* Bank Details */}
      {returnForm.refundMode === 'BANK' && (
        <div className="space-y-3">
          <div className="space-y-2">
            <label htmlFor="accountHolderName" className="text-xs font-medium text-gray-700">
              Account Holder Name <span className="text-red-500">*</span>
            </label>
            <Input
              id="accountHolderName"
              type="text"
              placeholder="Enter account holder name"
              value={returnForm.accountHolderName || ''}
              onChange={(e) => handleBankDetailsChange('accountHolderName', e.target.value)}
              className={cn(
                'text-sm',
                validationErrors.accountHolderName &&
                  'border-red-500 focus:border-red-500 focus:ring-red-500',
              )}
            />
            {validationErrors.accountHolderName && (
              <p className="text-xs text-red-600">{validationErrors.accountHolderName}</p>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="bankAccountNumber" className="text-xs font-medium text-gray-700">
              Bank Account Number <span className="text-red-500">*</span>
            </label>
            <Input
              id="bankAccountNumber"
              type="text"
              placeholder="Enter account number"
              value={returnForm.bankAccountNumber || ''}
              onChange={(e) => handleBankDetailsChange('bankAccountNumber', e.target.value)}
              className={cn(
                'text-sm',
                validationErrors.bankAccountNumber &&
                  'border-red-500 focus:border-red-500 focus:ring-red-500',
              )}
            />
            {validationErrors.bankAccountNumber && (
              <p className="text-xs text-red-600">{validationErrors.bankAccountNumber}</p>
            )}
            <p className="text-xs text-gray-500">Must be 9-18 digits</p>
          </div>

          <div className="space-y-2">
            <label htmlFor="ifscCode" className="text-xs font-medium text-gray-700">
              IFSC Code <span className="text-red-500">*</span>
            </label>
            <Input
              id="ifscCode"
              type="text"
              placeholder="HDFC0001234"
              value={returnForm.ifscCode || ''}
              onChange={(e) => handleBankDetailsChange('ifscCode', e.target.value.toUpperCase())}
              className={cn(
                'text-sm uppercase',
                validationErrors.ifscCode &&
                  'border-red-500 focus:border-red-500 focus:ring-red-500',
              )}
              maxLength={11}
            />
            {validationErrors.ifscCode && (
              <p className="text-xs text-red-600">{validationErrors.ifscCode}</p>
            )}
            <p className="text-xs text-gray-500">Format: ABCD0123456</p>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Orders() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [debouncedSearch, setDebouncedSearch] = useState<string>('')
  const [timePeriod, setTimePeriod] = useState<string>('3') // Default to 3 months
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [returnOrder, setReturnOrder] = useState<Order | null>(null)
  const [returnError, setReturnError] = useState<string | null>(null)
  const [validationErrors, setValidationErrors] = useState<{
    reason?: string
    description?: string
    images?: string
    refundMode?: string
    upiId?: string
    bankAccountNumber?: string
    ifscCode?: string
    accountHolderName?: string
  }>({})
  const [returnForm, setReturnForm] = useState<ReturnFormState>({
    reason: '',
    description: '',
    images: [],
    returnType: 'return',
  })

  // Fetch return reasons from API
  const { data: returnReasonsData } = useReturnReasons('return')
  const { data: replacementReasonsData } = useReturnReasons('replacement')

  const returnReasons = returnReasonsData?.data?.reasons || []
  const replacementReasons = replacementReasonsData?.data?.reasons || []

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery)
    }, 500)

    return () => clearTimeout(timer)
  }, [searchQuery])

  const queryParams = useMemo(() => {
    const params: {
      status?: string
      limit?: number
      search?: string
      months?: number
    } = {
      limit: 10,
    }
    if (statusFilter !== 'all') {
      params.status = statusFilter
    }
    if (debouncedSearch.trim()) {
      params.search = debouncedSearch.trim()
    }
    // Add time period filter (only if not "all")
    if (timePeriod !== 'all') {
      const monthsNum = parseInt(timePeriod, 10)
      if (!isNaN(monthsNum) && monthsNum > 0) {
        params.months = monthsNum
      }
    }
    // Always return params (at minimum with limit), or undefined if no filters
    return params
  }, [statusFilter, debouncedSearch, timePeriod])

  const queryClient = useQueryClient()
  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage } =
    useInfiniteUserOrders(queryParams)
  const { data: userFeedback } = useUserFeedback()

  // Handle orderId from URL params to open order detail modal
  useEffect(() => {
    const orderId = searchParams.get('orderId')
    if (orderId && data?.pages && !selectedOrder) {
      // Find the order in all pages
      let foundOrder: Order | null = null
      for (const page of data.pages) {
        if (page.data) {
          foundOrder = page.data.find((order: Order) => order._id === orderId) || null
          if (foundOrder) break
        }
      }

      if (foundOrder) {
        setSelectedOrder(foundOrder)
        // Remove orderId from URL to clean it up
        const newSearchParams = new URLSearchParams(searchParams)
        newSearchParams.delete('orderId')
        setSearchParams(newSearchParams, { replace: true })
      }
    }
  }, [searchParams, data, setSearchParams, selectedOrder])

  // Get total count from pagination (first page has the total count)
  const totalOrders = data?.pages[0]?.pagination?.total ?? 0
  const createReturnMutation = useCreateReturn()
  const cancelOrderMutation = useCancelOrder()
  const downloadInvoiceMutation = useDownloadInvoice()
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [orderToCancel, setOrderToCancel] = useState<Order | null>(null)

  /**
   * Handles order cancellation with proper error handling and state management
   */
  const handleCancelOrder = useCallback(async () => {
    if (!orderToCancel || cancellingOrderId) return

    setCancellingOrderId(orderToCancel._id)

    try {
      await cancelOrderMutation.mutateAsync(orderToCancel._id)
      toast.success('Order cancelled successfully')

      // Close dialog and reset state
      setCancelDialogOpen(false)
      setOrderToCancel(null)

      // Close order detail modal if it's the same order
      if (selectedOrder?._id === orderToCancel._id) {
        setSelectedOrder(null)
      }
    } catch (error) {
      const errorMessage = getErrorMessage(error, 'Failed to cancel order')
      toast.error(errorMessage)
    } finally {
      setCancellingOrderId(null)
    }
  }, [orderToCancel, cancellingOrderId, cancelOrderMutation, selectedOrder])

  /**
   * Opens the cancel confirmation dialog for a specific order
   */
  const openCancelDialog = useCallback((order: Order) => {
    setOrderToCancel(order)
    setCancelDialogOpen(true)
  }, [])

  /**
   * Closes the cancel dialog and resets state
   */
  const closeCancelDialog = useCallback(() => {
    if (cancellingOrderId) return // Prevent closing during cancellation
    setCancelDialogOpen(false)
    setOrderToCancel(null)
  }, [cancellingOrderId])

  const handleReturnImagesChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const filesList = event.target.files
    if (!filesList) return

    const existingCount = returnForm.images.length
    const next: MediaPreview[] = []

    for (const file of Array.from(filesList)) {
      const isImage = file.type.startsWith('image/')
      const isVideo = file.type.startsWith('video/')

      if (!isImage && !isVideo) {
        toast.error('Only image and video files are allowed.')
        continue
      }

      // Different size limits for images and videos
      const maxImageSize = 10 * 1024 * 1024 // 10MB for images
      const maxVideoSize = 50 * 1024 * 1024 // 50MB for videos
      const maxSize = isImage ? maxImageSize : maxVideoSize
      const fileTypeName = isImage ? 'Images' : 'Videos'

      if (file.size > maxSize) {
        toast.error(
          `${fileTypeName} must be smaller than ${Math.round(maxSize / (1024 * 1024))}MB.`,
        )
        continue
      }

      if (existingCount + next.length >= 5) {
        toast.error('You can add up to 5 files (images or videos).')
        break
      }
      const previewUrl = URL.createObjectURL(file)
      next.push({ file, preview: previewUrl, type: isImage ? 'image' : 'video' })
    }

    if (next.length) {
      setReturnForm((prev) => ({
        ...prev,
        images: [...prev.images, ...next].slice(0, 5),
      }))
    }

    event.target.value = ''
  }

  const handleRemoveReturnImage = (index: number) => {
    setReturnForm((prev) => {
      const next = [...prev.images]
      const removed = next.splice(index, 1)[0]
      if (removed) {
        URL.revokeObjectURL(removed.preview)
      }
      return {
        ...prev,
        images: next,
      }
    })
    // Clear validation error when image is removed
    if (validationErrors.images) {
      setValidationErrors((prev) => ({ ...prev, images: undefined }))
    }
  }

  /**
   * Handles opening the return/replacement request dialog
   * Validates eligibility and initializes the form with the appropriate order item
   */
  const handleOpenReturnDialog = useCallback((order: Order) => {
    const disableReason = getReturnButtonDisableReason(order)

    if (disableReason) {
      toast.error(disableReason)
      return
    }

    if (!hasReturnableProducts(order) || !(order.canRequestReturn ?? true)) {
      return
    }

    // Get the first returnable item for the return request
    const returnableItem = order.items.find((item) => item.product?.returnable === true)

    setReturnOrder(order)
    setReturnError(null)
    setValidationErrors({})
    setReturnForm({
      reason: '',
      description: '',
      images: [],
      returnType: 'return',
      orderItemId: returnableItem?._id,
      exchangeVariantId: undefined,
    })
  }, [])

  /**
   * Checks if the return/replacement button should be disabled
   */
  const isReturnButtonDisabled = useCallback((order: Order): boolean => {
    return !hasReturnableProducts(order) || !(order.canRequestReturn ?? true)
  }, [])

  const orders = data?.pages.flatMap((page) => page.data) ?? []

  const { feedbackByOrderId, productsWithReview } = useMemo(() => {
    const byOrderId = new Map<
      string,
      {
        hasDelivery: boolean
        hasSeller: boolean
      }
    >()
    const productsWithReview = new Set<string>()

    userFeedback?.feedback.forEach((item) => {
      const orderId = item.metadata?.orderId
      const productId = item.metadata?.productId

      if (productId && item.type === 'product') {
        productsWithReview.add(productId)
      }

      if (!orderId) return

      const entry = byOrderId.get(orderId) ?? {
        hasDelivery: false,
        hasSeller: false,
      }

      if (item.type === 'delivery') {
        entry.hasDelivery = true
      }
      if (item.type === 'support') {
        entry.hasSeller = true
      }

      byOrderId.set(orderId, entry)
    })

    return { feedbackByOrderId: byOrderId, productsWithReview }
  }, [userFeedback])

  const handleProductClick = (e: React.MouseEvent, product: { _id: string; slug?: string }) => {
    e.stopPropagation()
    navigate(`/product/${product.slug || product._id}`)
  }

  const renderSkeletonCard = () => (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
        {/* Top Section Skeleton */}
        <div className="bg-gray-50 px-5 py-3.5 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>

        {/* Main Content Skeleton */}
        <div className="p-5">
          <div className="flex items-start gap-4">
            <Skeleton className="h-28 w-28 rounded-lg shrink-0" />
            <div className="flex-1 min-w-0 space-y-3">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <div className="flex items-center gap-4">
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-4 w-px" />
                <Skeleton className="h-4 w-32" />
              </div>
              <div className="flex gap-2 pt-2 border-t border-gray-100">
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-8 w-24" />
              </div>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  )

  const renderCompactCard = (order: Order, index: number) => {
    const customerStatus = mapToCustomerStatus(order.status)
    const placedDate = dateFormatter.format(new Date(order.createdAt))
    const mainItem = order.items[0]
    const mainProduct = mainItem?.product
    const mainProductImage =
      mainItem?.variant?.mainImage || mainProduct?.mainImage || '/image-placeholder.svg'
    const orderFeedback = feedbackByOrderId.get(order._id)
    const hasDeliveryFeedback = orderFeedback?.hasDelivery
    const hasSellerFeedback = orderFeedback?.hasSeller
    const hasProductReview =
      (mainProduct && mainProduct.reviewedByUser) ||
      (mainProduct && mainProduct._id ? productsWithReview.has(String(mainProduct._id)) : false)

    const animationDelay = Math.min(index * 0.03, 0.2)
    const isDelivered = order.status === 'delivered'
    const hasActions = isDelivered || canCancelOrder(order)

    return (
      <motion.div
        key={order._id}
        layout
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: 0.3,
          delay: animationDelay,
          ease: [0.25, 0.1, 0.25, 1],
        }}
        whileHover={{ y: -2 }}
      >
        <Card
          className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-all duration-300 hover:border-gray-300 hover:shadow-lg cursor-pointer"
          onClick={() => setSelectedOrder(order)}
        >
          {/* Top Section - Order Info */}
          <div className="bg-gradient-to-r from-gray-50 to-white px-5 py-3.5 border-b border-gray-100">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <StatusBadge status={customerStatus} />
                {order.orderNumber && (
                  <span className="text-xs font-medium text-gray-500">
                    Order #{order.orderNumber}
                  </span>
                )}
                {statusFilter === 'all' && (
                  <Badge
                    variant="outline"
                    className="text-[10px] px-2 py-0.5 border-gray-300 text-gray-600 bg-gray-50 font-normal"
                  >
                    {order.status.replace(/_/g, ' ')}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-gray-500 font-medium">{placedDate}</span>
                <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="p-5">
            <div className="flex items-start gap-4">
              {/* Product Image */}
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="relative shrink-0"
              >
                <img
                  src={mainProductImage}
                  className="h-28 w-28 rounded-lg object-cover border border-gray-200 cursor-pointer shadow-sm hover:shadow-md transition-all duration-200"
                  alt={mainProduct?.name}
                  onClick={(e) => mainProduct && handleProductClick(e, mainProduct)}
                />
                {order.items.length > 1 && (
                  <div className="absolute -top-2 -right-2 bg-yellow-400 text-gray-900 text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center border-2 border-white shadow-sm">
                    +{order.items.length - 1}
                  </div>
                )}
              </motion.div>

              {/* Product Details */}
              <div className="flex-1 min-w-0 space-y-3">
                {/* Product Name */}
                <div>
                  <p
                    className="text-base font-semibold text-gray-900 line-clamp-2 cursor-pointer hover:text-yellow-500 transition-colors duration-200 mb-1"
                    onClick={(e) => mainProduct && handleProductClick(e, mainProduct)}
                  >
                    {mainProduct?.name}
                  </p>
                  {order.items.length > 1 && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      {order.items.length} items in this order
                    </p>
                  )}
                </div>

                {/* Price & Shipping Info */}
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-bold text-gray-900">
                      {currencyFormatter.format(order.total)}
                    </span>
                  </div>
                  <div className="h-4 w-px bg-gray-300" />
                  <div className="flex items-center gap-1.5 text-xs text-gray-600">
                    <MapPin className="h-3.5 w-3.5 text-gray-400" />
                    <span className="truncate max-w-[200px]">
                      {order.shippingAddress?.name ||
                        [order.shippingAddress?.addressLine1, order.shippingAddress?.city]
                          .filter(Boolean)
                          .join(', ')}
                    </span>
                  </div>
                </div>

                {/* Action Buttons - Always Visible */}
                {hasActions && (
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100">
                    {/* Cancel Order Button */}
                    {canCancelOrder(order) && (
                      <button
                        type="button"
                        className="text-xs font-medium text-gray-600 hover:text-red-600 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-gray-600"
                        onClick={(e) => {
                          e.stopPropagation()
                          openCancelDialog(order)
                        }}
                        disabled={cancellingOrderId === order._id}
                      >
                        {cancellingOrderId === order._id ? (
                          <span className="inline-flex items-center gap-1.5">
                            <span className="animate-spin inline-block h-3 w-3 border-2 border-gray-400 border-t-transparent rounded-full" />
                            Cancelling…
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 hover:underline">
                            <XCircle className="h-3.5 w-3.5" />
                            Cancel Order
                          </span>
                        )}
                      </button>
                    )}
                    {/* Post-Delivery Actions */}
                    {isDelivered && (
                      <>
                        {(!order.returnStatus || order.returnStatus === 'REJECTED') &&
                          !order.returnRequested &&
                          !order.isReturnLocked && (
                            <Tooltip
                              title={
                                isReturnButtonDisabled(order)
                                  ? getReturnButtonDisableReason(order) || undefined
                                  : undefined
                              }
                            >
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 px-3 text-xs font-medium border-blue-200 text-blue-600 bg-blue-50/50 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={isReturnButtonDisabled(order)}
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  handleOpenReturnDialog(order)
                                }}
                              >
                                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                                {order.returnStatus === 'REJECTED'
                                  ? 'Request Return'
                                  : 'Return / Replace'}
                              </Button>
                            </Tooltip>
                          )}

                        {mapReturnStatusForCustomer(order.returnStatus) && (
                          <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 border border-amber-200 shadow-sm">
                            <RotateCcw className="h-3.5 w-3.5" />
                            <span>{mapReturnStatusForCustomer(order.returnStatus)}</span>
                          </div>
                        )}

                        {!hasProductReview && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-3 text-xs font-medium border-gray-200 text-gray-700 bg-gray-50 hover:bg-gray-100 hover:border-gray-300 transition-all duration-200"
                            onClick={(e) => {
                              e.stopPropagation()
                              const mainProduct = order.items[0]?.product
                              const productSlugOrId = mainProduct?.slug || mainProduct?._id
                              if (productSlugOrId) {
                                navigate(`/product/${productSlugOrId}?openReview=1#reviews-section`)
                              } else {
                                toast.error(
                                  'Unable to open product review. Please open the product page.',
                                )
                              }
                            }}
                          >
                            <MessageCircle className="h-3.5 w-3.5 mr-1.5" />
                            Review Product
                          </Button>
                        )}

                        {(!hasDeliveryFeedback || !hasSellerFeedback) && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-3 text-xs font-medium border-gray-200 text-gray-700 bg-gray-50 hover:bg-gray-100 hover:border-gray-300 transition-all duration-200"
                            onClick={(e) => {
                              e.stopPropagation()
                              if (!hasDeliveryFeedback) {
                                navigate(`/orders/${order._id}/feedback/delivery`)
                              } else if (!hasSellerFeedback) {
                                navigate(`/orders/${order._id}/feedback/seller`)
                              }
                            }}
                          >
                            <MessageCircle className="h-3.5 w-3.5 mr-1.5" />
                            {!hasDeliveryFeedback ? 'Delivery Feedback' : 'Seller Feedback'}
                          </Button>
                        )}
                      </>
                    )}

                    {/* View Details Button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-3 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 ml-auto transition-all duration-200"
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedOrder(order)
                      }}
                    >
                      View Details
                      <ChevronRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </div>
                )}

                {/* No Actions - Just View Details */}
                {!hasActions && (
                  <div className="pt-2 border-t border-gray-100">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-3 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-all duration-200"
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedOrder(order)
                      }}
                    >
                      View Details
                      <ChevronRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Card>
      </motion.div>
    )
  }

  const renderOrderItem = (item: OrderItem) => {
    const itemImage = item.variant?.mainImage || item.product.mainImage || '/image-placeholder.svg'
    return (
      <motion.div
      key={`${item.product._id}-${item.variant?._id || 'no-variant'}`}
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2 }}
      className="flex gap-4 py-4 border-b border-gray-100 last:border-0 hover:bg-gray-50/50 transition-colors rounded-lg px-2 -mx-2"
    >
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="shrink-0">
          <img
            src={itemImage}
            alt={item.product.name}
            className="h-20 w-20 rounded-lg border border-gray-200 object-cover cursor-pointer shadow-sm hover:shadow-md transition-all duration-200"
            onClick={(e) => handleProductClick(e, item.product)}
          />
        </motion.div>
        <div className="flex-1 min-w-0">
          <p
            className="font-semibold text-base text-gray-900 cursor-pointer hover:text-yellow-500 transition-colors mb-1 line-clamp-2"
            onClick={(e) => handleProductClick(e, item.product)}
          >
            {item?.product?.name}
          </p>
          {item.variant?.name && (
            <p className="text-xs text-gray-500 mb-2 font-medium">Variant: {item.variant.name}</p>
          )}
          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2.5 py-1 rounded-md">
                Qty: {item.quantity}
              </span>
            </div>
            <p className="text-lg font-bold text-gray-900">
              {currencyFormatter.format(item.subtotal)}
            </p>
          </div>
          {item.instructions && (
            <div className="mt-2 pt-2 border-t border-gray-100">
              <p className="text-xs font-medium text-gray-700 mb-0.5">Note:</p>
              <p className="text-xs text-gray-600 italic">{item.instructions}</p>
            </div>
          )}
        </div>
      </motion.div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold text-gray-900">Your Orders</h2>
            {/* Order Statistics */}
            {!isLoading && totalOrders > 0 && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>
                  <span className="font-semibold text-gray-900">{totalOrders}</span> orders placed
                  in{' '}
                </span>
                <Select value={timePeriod} onValueChange={setTimePeriod}>
                  <SelectTrigger className="h-8 w-auto min-w-[130px] px-2.5 text-sm border-gray-300 bg-white hover:bg-gray-50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Past month</SelectItem>
                    <SelectItem value="3">Past 3 months</SelectItem>
                    <SelectItem value="6">Past 6 months</SelectItem>
                    <SelectItem value="12">Past year</SelectItem>
                    <SelectItem value="all">All time</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <p className="text-xs text-gray-500">Track and manage your purchases</p>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search by order number, customer name, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-4 h-10 w-full"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Status Filter Tabs */}
        <Tabs value={statusFilter} onValueChange={setStatusFilter} className="mt-2">
          <TabsList className="h-9">
            <TabsTrigger value="all" className="text-xs px-3">
              All
            </TabsTrigger>
            <TabsTrigger value="processing" className="text-xs px-3">
              Processing
            </TabsTrigger>
            <TabsTrigger value="shipped" className="text-xs px-3">
              Shipped
            </TabsTrigger>
            <TabsTrigger value="delivered" className="text-xs px-3">
              Delivered
            </TabsTrigger>
            <TabsTrigger value="cancelled" className="text-xs px-3">
              Cancelled
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Orders List */}
      {isLoading && !data ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i}>{renderSkeletonCard()}</div>
          ))}
        </div>
      ) : orders?.length ? (
        <InfiniteScrollContainer
          contentClassName="space-y-2"
          isFetchingNextPage={isFetchingNextPage}
          hasNextPage={!!hasNextPage}
          onLoadMore={() => fetchNextPage()}
          threshold={200}
          maxHeight="80vh"
          useIntersectionObserver={false}
        >
          {orders?.map((order, index) => renderCompactCard(order, index))}
        </InfiniteScrollContainer>
      ) : (
        <div className="text-center py-16 text-gray-500 text-sm">
          {debouncedSearch || statusFilter !== 'all'
            ? 'No orders found matching your filters'
            : 'No orders found'}
        </div>
      )}

      {/* Order Details Modal */}
      <Dialog open={!!selectedOrder} onOpenChange={(v) => !v && setSelectedOrder(null)}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-hidden flex flex-col p-0">
          {selectedOrder && (
            <>
              {/* Header with Gradient */}
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 text-white px-6 py-5 shrink-0"
              >
                <DialogHeader className="space-y-2">
                  <div className="flex items-center justify-between">
                    <DialogTitle className="text-xl font-bold">Order Details</DialogTitle>
                    {selectedOrder.orderNumber && (
                      <div className="bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-white/20">
                        <p className="text-sm font-semibold">Order #{selectedOrder.orderNumber}</p>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-4 pt-2">
                    <StatusBadge status={mapToCustomerStatus(selectedOrder.status)} />
                    <PaymentStatusBadge status={selectedOrder.paymentStatus} />
                  </div>
                </DialogHeader>
              </motion.div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                {/* Order Items Section */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.1 }}
                  className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm"
                >
                  <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-200">
                    <Package className="h-5 w-5 text-gray-700" />
                    <h3 className="text-base font-bold text-gray-900">
                      Order Items ({selectedOrder.items.length})
                    </h3>
                  </div>
                  <div className="space-y-1">{selectedOrder.items.map(renderOrderItem)}</div>
                </motion.div>

                {/* Two Column Layout for Details */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {/* Shipping Address */}
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: 0.2 }}
                    className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm"
                  >
                    <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-200">
                      <MapPin className="h-5 w-5 text-gray-700" />
                      <h3 className="text-base font-bold text-gray-900">Shipping Address</h3>
                    </div>
                    <div className="text-sm text-gray-700 space-y-2">
                      <p className="font-semibold text-base text-gray-900">
                        {selectedOrder.shippingAddress.name}
                      </p>
                      <p className="text-gray-600 flex items-center gap-2">
                        <span className="text-gray-400">📞</span>
                        {selectedOrder.shippingAddress.phone}
                      </p>
                      <div className="space-y-1 text-gray-600">
                        <p>{selectedOrder.shippingAddress.addressLine1}</p>
                        {selectedOrder.shippingAddress.addressLine2 && (
                          <p>{selectedOrder.shippingAddress.addressLine2}</p>
                        )}
                        <p>
                          {selectedOrder.shippingAddress.city},{' '}
                          {selectedOrder.shippingAddress.state}{' '}
                          {selectedOrder.shippingAddress.postalCode}
                        </p>
                        <p>{selectedOrder.shippingAddress.country}</p>
                      </div>
                      {selectedOrder.deliveryInstructions && (
                        <div className="mt-4 pt-4 border-t border-gray-200 bg-gray-50 rounded-lg p-3">
                          <p className="text-xs font-semibold text-gray-700 mb-1">
                            Delivery Instructions:
                          </p>
                          <p className="text-xs text-gray-600">
                            {selectedOrder.deliveryInstructions}
                          </p>
                        </div>
                      )}
                    </div>
                  </motion.div>

                  {/* Payment & Order Info */}
                  <motion.div
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: 0.2 }}
                    className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm"
                  >
                    <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-200">
                      <CreditCard className="h-5 w-5 text-gray-700" />
                      <h3 className="text-base font-bold text-gray-900">Payment Information</h3>
                    </div>
                    <div className="text-sm space-y-3">
                      <div className="flex justify-between items-center py-2">
                        <span className="text-gray-600 font-medium">Payment Method:</span>
                        <span className="font-semibold text-gray-900">
                          {PAYMENT_METHOD_MAP[selectedOrder.paymentMethod] ||
                            selectedOrder.paymentMethod}
                        </span>
                      </div>
                      {selectedOrder.coupon && (
                        <div className="flex justify-between items-center py-2 bg-green-50 rounded-lg px-3 border border-green-200">
                          <span className="text-gray-700 flex items-center gap-1.5 font-medium">
                            <Tag className="h-4 w-4 text-green-600" /> Coupon:
                          </span>
                          <span className="font-semibold text-green-700">
                            {selectedOrder.coupon.code}
                          </span>
                        </div>
                      )}
                      <div className="pt-3 border-t border-gray-200 space-y-2">
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Order Placed:</span>
                          <span className="text-gray-700 font-medium">
                            {dateTimeFormatter.format(new Date(selectedOrder.createdAt))}
                          </span>
                        </div>
                        {selectedOrder.updatedAt !== selectedOrder.createdAt && (
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-500">Last Updated:</span>
                            <span className="text-gray-700 font-medium">
                              {dateTimeFormatter.format(new Date(selectedOrder.updatedAt))}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                </div>

                {/* Price Breakdown */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.3 }}
                  className="bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-xl p-5 shadow-sm"
                >
                  <h3 className="text-base font-bold text-gray-900 mb-4">Price Breakdown</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between py-1">
                      <span className="text-gray-600">Subtotal:</span>
                      <span className="font-semibold text-gray-900">
                        {currencyFormatter.format(selectedOrder.subtotal)}
                      </span>
                    </div>
                    {selectedOrder.discount > 0 && (
                      <div className="flex justify-between py-1 text-green-700">
                        <span className="font-medium">Discount:</span>
                        <span className="font-semibold">
                          -{currencyFormatter.format(selectedOrder.discount)}
                        </span>
                      </div>
                    )}
                    {selectedOrder.shipping > 0 && (
                      <div className="flex justify-between py-1">
                        <span className="text-gray-600">Shipping:</span>
                        <span className="font-semibold text-gray-900">
                          {currencyFormatter.format(selectedOrder.shipping)}
                        </span>
                      </div>
                    )}
                    {selectedOrder.tax > 0 && (
                      <div className="flex justify-between py-1">
                        <span className="text-gray-600">Tax:</span>
                        <span className="font-semibold text-gray-900">
                          {currencyFormatter.format(selectedOrder.tax)}
                        </span>
                      </div>
                    )}
                    <Separator className="my-3 bg-gray-300" />
                    <div className="flex justify-between py-2 bg-gray-100 rounded-lg px-3 -mx-3">
                      <span className="text-lg font-bold text-gray-900">Total:</span>
                      <span className="text-xl font-bold text-gray-900">
                        {currencyFormatter.format(selectedOrder.total)}
                      </span>
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Actions Footer - Fixed at bottom */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.4 }}
                className="border-t border-gray-200 bg-gray-50 px-6 py-4 shrink-0"
              >
                <div className="flex flex-wrap items-center gap-3">
                  {canCancelOrder(selectedOrder) && (
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-red-600 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-gray-600"
                      onClick={() => openCancelDialog(selectedOrder)}
                      disabled={cancellingOrderId === selectedOrder._id}
                    >
                      {cancellingOrderId === selectedOrder._id ? (
                        <>
                          <span className="animate-spin inline-block h-4 w-4 border-2 border-gray-400 border-t-transparent rounded-full" />
                          <span>Cancelling…</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-4 w-4" />
                          <span className="hover:underline">Cancel Order</span>
                        </>
                      )}
                    </button>
                  )}
                  {/* Show invoice buttons when order is ready to ship or invoice exists */}
                  {(selectedOrder.status === 'pickup_requested' ||
                    selectedOrder.status === 'ready_to_ship' ||
                    selectedOrder.invoice?.invoice_url) && (
                    <>
                      {selectedOrder.invoice?.invoice_url && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-9 px-4 border-gray-300 text-gray-700 bg-white hover:bg-gray-50 transition-all duration-200 shadow-sm"
                          onClick={() => {
                            navigate(`/orders/${selectedOrder._id}/invoice`)
                          }}
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          <span className="text-xs font-semibold">View Invoice</span>
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 px-4 border-gray-300 text-gray-700 bg-white hover:bg-gray-50 transition-all duration-200 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={downloadInvoiceMutation.isPending}
                        onClick={async () => {
                          if (downloadInvoiceMutation.isPending) return

                          const loadingToast = toast.loading('Preparing invoice PDF...', {
                            description: 'This may take a few moments',
                          })

                          try {
                            // Use mutation hook to download invoice (backend will generate if it doesn't exist)
                            const blob = await downloadInvoiceMutation.mutateAsync({
                              orderId: selectedOrder._id,
                              onProgress: (progress) => {
                                if (progress.total) {
                                  const percentCompleted = Math.round(
                                    (progress.loaded * 100) / progress.total,
                                  )
                                  toast.loading(`Downloading invoice... ${percentCompleted}%`, {
                                    id: loadingToast,
                                    description: 'Please wait while we prepare your invoice',
                                  })
                                }
                              },
                            })

                            // Create a blob URL and trigger download
                            const url = window.URL.createObjectURL(blob)
                            const link = document.createElement('a')
                            link.href = url
                            link.download = `Invoice-${
                              selectedOrder.invoice?.invoice_number ||
                              selectedOrder.orderNumber ||
                              selectedOrder._id ||
                              'invoice'
                            }.pdf`
                            document.body.appendChild(link)
                            link.click()
                            document.body.removeChild(link)
                            window.URL.revokeObjectURL(url)

                            toast.success('Invoice downloaded successfully', {
                              id: loadingToast,
                              description: 'Your invoice PDF is ready',
                            })

                            // Refresh order data to show updated invoice information
                            try {
                              // Invalidate orders list to refetch
                              await queryClient.invalidateQueries({
                                queryKey: orderKeys.lists(),
                              })

                              // Refetch the specific order to update selectedOrder
                              const updatedOrderData = await getOrder(selectedOrder._id)
                              if (updatedOrderData?.data) {
                                setSelectedOrder(updatedOrderData.data as Order)
                              }
                            } catch (refreshError) {
                              console.error('Error refreshing order data:', refreshError)
                              // Don't show error to user - invoice download was successful
                            }
                          } catch (error) {
                            console.error('Error downloading invoice:', error)
                            toast.error('Failed to download invoice', {
                              id: loadingToast,
                              description: 'Please try again later',
                            })
                          }
                        }}
                      >
                        {downloadInvoiceMutation.isPending ? (
                          <>
                            <span className="animate-spin inline-block h-4 w-4 border-2 border-gray-400 border-t-transparent rounded-full mr-2" />
                            <span className="text-xs font-semibold">Generating...</span>
                          </>
                        ) : (
                          <>
                            <Download className="h-4 w-4 mr-2" />
                            <span className="text-xs font-semibold">Download Invoice</span>
                          </>
                        )}
                      </Button>
                    </>
                  )}
                  <Button
                    variant="primary"
                    size="sm"
                    className="ml-auto h-9 px-4 inline-flex items-center gap-2 shadow-md hover:shadow-lg transition-all duration-200"
                    onClick={() => {
                      const orderNumber = selectedOrder.orderNumber || selectedOrder._id
                      const subject = `Order query for ${orderNumber}`

                      const orderDetails = [
                        `Order Number: ${orderNumber}`,
                        `Order Status: ${mapToCustomerStatus(selectedOrder.status)}`,
                        `Payment Status: ${selectedOrder.paymentStatus}`,
                        `Total Amount: ${currencyFormatter.format(selectedOrder.total)}`,
                        `Order Date: ${dateTimeFormatter.format(
                          new Date(selectedOrder.createdAt),
                        )}`,
                        '',
                        'Items:',
                        ...selectedOrder.items.map(
                          (item) =>
                            `- ${item.product?.name || 'Product'} (Qty: ${
                              item.quantity
                            }, Price: ${currencyFormatter.format(item.price)})`,
                        ),
                      ].join('\n')

                      navigate('/help/tickets/new', {
                        state: {
                          category: 'order',
                          subject,
                          description: `I have a question regarding this order:\n\n${orderDetails}\n\nPlease provide clarification.`,
                          orderId: selectedOrder._id,
                        },
                      })
                    }}
                  >
                    <MessageCircle className="h-4 w-4" />
                    <span className="text-xs font-semibold">Raise Query</span>
                  </Button>
                </div>
              </motion.div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Return Request Modal */}
      <Dialog
        open={!!returnOrder}
        onOpenChange={(v) => {
          if (!v) {
            // Revoke object URLs before clearing form
            returnForm.images.forEach((imagePreview) => {
              URL.revokeObjectURL(imagePreview.preview)
            })
            setReturnOrder(null)
            setReturnError(null)
            setValidationErrors({})
            setReturnForm({
              reason: '',
              description: '',
              images: [],
              returnType: 'return',
              exchangeVariantId: undefined,
              orderItemId: undefined,
              refundMode: undefined,
              upiId: undefined,
              bankAccountNumber: undefined,
              ifscCode: undefined,
              accountHolderName: undefined,
            })
          }
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {returnOrder && (
            <>
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold">
                  Request Return / Replacement
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {returnError && (
                  <div className="rounded-md border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
                    {returnError}
                  </div>
                )}
                <div className="text-xs text-gray-600">
                  <p>
                    Order:{' '}
                    <span className="font-medium">
                      #{returnOrder.orderNumber || returnOrder._id}
                    </span>
                  </p>
                  <p className="text-[11px] text-gray-500 mt-1">
                    Please select a reason and describe the issue. For damage or quality issues, we
                    may ask you to upload photos so we can process your request faster.
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700">Request Type</label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      onClick={() => {
                        setReturnForm((prev) => ({
                          ...prev,
                          returnType: 'return',
                          reason: '', // Reset reason when type changes
                          exchangeVariantId: undefined,
                          refundMode: undefined,
                          upiId: undefined,
                          bankAccountNumber: undefined,
                          ifscCode: undefined,
                          accountHolderName: undefined,
                        }))
                        setValidationErrors({}) // Clear validation errors
                      }}
                      className={cn(
                        'flex-1 rounded border px-3 py-2 text-xs font-medium transition-all',
                        returnForm.returnType === 'return'
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
                      )}
                    >
                      Return & Refund
                    </Button>
                    <Button
                      type="button"
                      onClick={() => {
                        setReturnForm((prev) => ({
                          ...prev,
                          returnType: 'replacement',
                          reason: '', // Reset reason when type changes
                          exchangeVariantId: undefined,
                          refundMode: undefined,
                          upiId: undefined,
                          bankAccountNumber: undefined,
                          ifscCode: undefined,
                          accountHolderName: undefined,
                        }))
                        setValidationErrors({}) // Clear validation errors
                      }}
                      className={cn(
                        'flex-1 rounded border px-3 py-2 text-xs font-medium transition-all',
                        returnForm.returnType === 'replacement'
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
                      )}
                    >
                      Replacement
                    </Button>
                  </div>
                  <p className="text-[11px] text-gray-500">
                    {returnForm.returnType === 'return'
                      ? 'Return the item and get a refund'
                      : 'Get a replacement for the item'}
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700">
                    Reason <span className="text-red-500">*</span>
                  </label>
                  <select
                    className={cn(
                      'w-full rounded border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400',
                      validationErrors.reason
                        ? 'border-red-300 bg-red-50'
                        : 'border-gray-300 bg-white',
                    )}
                    value={returnForm.reason}
                    onChange={(e) => {
                      setReturnForm((prev) => ({
                        ...prev,
                        reason: e.target.value,
                      }))
                      // Clear validation error when user selects a reason
                      if (validationErrors.reason) {
                        setValidationErrors((prev) => ({ ...prev, reason: undefined }))
                      }
                    }}
                  >
                    <option value="">Select a reason</option>
                    {(returnForm.returnType === 'replacement'
                      ? replacementReasons
                      : returnReasons
                    ).map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                  {validationErrors.reason && (
                    <p className="text-[11px] text-red-600">{validationErrors.reason}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700">
                    Description{' '}
                    {returnForm.returnType === 'replacement' ? '(optional)' : '(optional)'}
                  </label>
                  <textarea
                    className={cn(
                      'w-full rounded border px-2 py-1.5 text-sm min-h-[80px] resize-vertical focus:outline-none focus:ring-2 focus:ring-yellow-400',
                      validationErrors.description
                        ? 'border-red-300 bg-red-50'
                        : 'border-gray-300 bg-white',
                    )}
                    placeholder="Briefly describe the issue with the product..."
                    value={returnForm.description}
                    maxLength={2000}
                    onChange={(e) => {
                      setReturnForm((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                      // Clear validation error when user types
                      if (validationErrors.description) {
                        setValidationErrors((prev) => ({ ...prev, description: undefined }))
                      }
                    }}
                  />
                  <div className="flex items-center justify-between">
                    {validationErrors.description && (
                      <p className="text-[11px] text-red-600">{validationErrors.description}</p>
                    )}
                    <p className="text-[11px] text-gray-500 ml-auto">
                      {returnForm.description.length}/2000 characters
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-700 flex items-center gap-1.5">
                    <ImageIcon className="h-3.5 w-3.5" />
                    Photos & Videos{' '}
                    {REASONS_REQUIRING_MEDIA.has(returnForm.reason) ? '(required)' : '(optional)'}
                  </label>
                  <p className="text-[11px] text-gray-500">
                    Upload up to 5 files (JPG, PNG, WebP images or MP4, WebM videos). Clear media
                    helps us process your return faster. For damaged / wrong / quality issues, at
                    least one file is recommended.
                  </p>
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-3">
                      {returnForm.images.map((mediaPreview, index) => (
                        <div
                          key={`${mediaPreview.preview}-${index}`}
                          className="relative h-24 w-24 rounded-xl overflow-hidden"
                        >
                          {mediaPreview.type === 'image' ? (
                            <img
                              src={mediaPreview.preview}
                              alt={`Return media ${index + 1}`}
                              className="h-full w-full rounded-xl object-cover border border-gray-200"
                            />
                          ) : (
                            <video
                              src={mediaPreview.preview}
                              className="h-full w-full rounded-xl object-cover border border-gray-200"
                              muted
                              playsInline
                              preload="metadata"
                            >
                              Your browser does not support the video tag.
                            </video>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              handleRemoveReturnImage(index)
                              // Clear validation error when media is removed
                              if (validationErrors.images) {
                                setValidationErrors((prev) => ({ ...prev, images: undefined }))
                              }
                            }}
                            className="absolute -top-1.5 -right-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-gray-900 text-white shadow-sm"
                            aria-label="Remove media"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                      {returnForm.images.length < 5 && (
                        <label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-gray-300 text-xs text-gray-500 transition-colors hover:border-gray-400 hover:text-gray-700">
                          <input
                            type="file"
                            accept="image/jpeg,image/jpg,image/png,image/webp,image/gif,image/avif,video/mp4,video/webm,video/ogg,video/quicktime,video/x-msvideo"
                            multiple
                            className="hidden"
                            onChange={handleReturnImagesChange}
                          />
                          <ImageIcon className="h-5 w-5" />
                          <span>{returnForm.images.length > 0 ? 'Add more' : 'Add files'}</span>
                        </label>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      {validationErrors.images && (
                        <p className="text-[11px] text-red-600">{validationErrors.images}</p>
                      )}
                      <p className="text-[11px] text-gray-500 ml-auto">
                        {returnForm.images.length}/5 files
                      </p>
                    </div>
                  </div>
                </div>

                {/* Variant Selection for Exchange/Replacement */}
                {returnForm.returnType === 'replacement' && (
                  <ReplacementRequestForm
                    returnOrder={returnOrder}
                    returnForm={returnForm}
                    setReturnForm={setReturnForm}
                    validationErrors={validationErrors}
                    setValidationErrors={setValidationErrors}
                  />
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      // Revoke object URLs before clearing form
                      returnForm.images.forEach((imagePreview) => {
                        URL.revokeObjectURL(imagePreview.preview)
                      })
                      setReturnOrder(null)
                      setReturnError(null)
                      setValidationErrors({})
                      setReturnForm({
                        reason: '',
                        description: '',
                        images: [],
                        returnType: 'return',
                        exchangeVariantId: undefined,
                        orderItemId: undefined,
                        refundMode: undefined,
                        upiId: undefined,
                        bankAccountNumber: undefined,
                        ifscCode: undefined,
                        accountHolderName: undefined,
                      })
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    disabled={
                      !returnForm.reason ||
                      createReturnMutation.isPending ||
                      (returnForm.returnType === 'replacement' && !returnForm.exchangeVariantId)
                    }
                    onClick={async () => {
                      if (!returnOrder) return

                      // Clear previous validation errors
                      setValidationErrors({})

                      // Validate reason
                      if (!returnForm.reason || returnForm.reason.trim().length === 0) {
                        setValidationErrors((prev) => ({
                          ...prev,
                          reason: 'Please select a reason',
                        }))
                        return
                      }

                      // Validate media files (if provided)
                      if (returnForm.images && returnForm.images.length > 0) {
                        if (returnForm.images.length > 5) {
                          setValidationErrors((prev) => ({
                            ...prev,
                            images: 'Maximum 5 files allowed',
                          }))
                          return
                        }

                        // Validate file sizes (different limits for images and videos)
                        for (let i = 0; i < returnForm.images.length; i++) {
                          const mediaPreview = returnForm.images[i]
                          const maxImageSize = 10 * 1024 * 1024 // 10MB for images
                          const maxVideoSize = 50 * 1024 * 1024 // 50MB for videos
                          const maxSize =
                            mediaPreview.type === 'image' ? maxImageSize : maxVideoSize
                          const fileTypeName = mediaPreview.type === 'image' ? 'Image' : 'Video'

                          if (mediaPreview.file.size > maxSize) {
                            setValidationErrors((prev) => ({
                              ...prev,
                              images: `${fileTypeName} ${
                                i + 1
                              } is too large. Maximum size is ${Math.round(
                                maxSize / (1024 * 1024),
                              )}MB.`,
                            }))
                            return
                          }
                        }
                      }

                      // Validate description
                      const descriptionValidation = validateDescription(
                        returnForm.description,
                        false, // TODO: Check if this is a second attempt
                      )
                      if (!descriptionValidation.valid) {
                        setValidationErrors((prev) => ({
                          ...prev,
                          description: descriptionValidation.error,
                        }))
                        return
                      }

                      // Validate refund details for replacement with price difference
                      if (returnForm.returnType === 'replacement' && returnForm.exchangeVariantId) {
                        // Note: Backend will validate if refund is needed based on price difference
                        // We validate refund fields if refundMode is selected (user might have selected it)
                        if (returnForm.refundMode) {
                          if (!['UPI', 'BANK'].includes(returnForm.refundMode)) {
                            setValidationErrors((prev) => ({
                              ...prev,
                              refundMode: 'Please select a valid refund method',
                            }))
                            return
                          }

                          if (returnForm.refundMode === 'UPI') {
                            if (!returnForm.upiId || returnForm.upiId.trim().length === 0) {
                              setValidationErrors((prev) => ({
                                ...prev,
                                upiId: 'UPI ID is required',
                              }))
                              return
                            }
                            const upiPattern = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/
                            if (!upiPattern.test(returnForm.upiId.trim())) {
                              setValidationErrors((prev) => ({
                                ...prev,
                                upiId:
                                  'Invalid UPI ID format. Expected format: xyz@paytm or xyz@ybl',
                              }))
                              return
                            }
                          } else if (returnForm.refundMode === 'BANK') {
                            if (
                              !returnForm.bankAccountNumber ||
                              returnForm.bankAccountNumber.trim().length === 0
                            ) {
                              setValidationErrors((prev) => ({
                                ...prev,
                                bankAccountNumber: 'Bank account number is required',
                              }))
                              return
                            }
                            const accountNumberPattern = /^\d{9,18}$/
                            if (!accountNumberPattern.test(returnForm.bankAccountNumber.trim())) {
                              setValidationErrors((prev) => ({
                                ...prev,
                                bankAccountNumber:
                                  'Invalid bank account number. Must be 9-18 digits',
                              }))
                              return
                            }

                            if (!returnForm.ifscCode || returnForm.ifscCode.trim().length === 0) {
                              setValidationErrors((prev) => ({
                                ...prev,
                                ifscCode: 'IFSC code is required',
                              }))
                              return
                            }
                            const ifscPattern = /^[A-Z]{4}0[A-Z0-9]{6}$/
                            if (!ifscPattern.test(returnForm.ifscCode.trim().toUpperCase())) {
                              setValidationErrors((prev) => ({
                                ...prev,
                                ifscCode: 'Invalid IFSC code format. Expected format: ABCD0123456',
                              }))
                              return
                            }

                            if (
                              !returnForm.accountHolderName ||
                              returnForm.accountHolderName.trim().length === 0
                            ) {
                              setValidationErrors((prev) => ({
                                ...prev,
                                accountHolderName: 'Account holder name is required',
                              }))
                              return
                            }
                            if (
                              returnForm.accountHolderName.trim().length < 2 ||
                              returnForm.accountHolderName.trim().length > 100
                            ) {
                              setValidationErrors((prev) => ({
                                ...prev,
                                accountHolderName:
                                  'Account holder name must be between 2 and 100 characters',
                              }))
                              return
                            }
                          }
                        }
                      }

                      try {
                        // Create FormData for file upload
                        const formData = new FormData()
                        formData.append('order_id', returnOrder._id)
                        if (returnForm.orderItemId) {
                          formData.append('order_item_id', returnForm.orderItemId)
                        }
                        formData.append('reason', returnForm.reason)
                        if (returnForm.description) {
                          formData.append('description', returnForm.description)
                        }
                        formData.append('returnType', returnForm.returnType)
                        if (
                          returnForm.returnType === 'replacement' &&
                          returnForm.exchangeVariantId
                        ) {
                          formData.append('exchangeVariantId', returnForm.exchangeVariantId)

                          // Add refund details if refund mode is selected
                          if (returnForm.refundMode) {
                            formData.append('refundMode', returnForm.refundMode)
                            if (returnForm.refundMode === 'UPI' && returnForm.upiId) {
                              formData.append('upiId', returnForm.upiId.trim())
                            } else if (returnForm.refundMode === 'BANK') {
                              if (returnForm.bankAccountNumber) {
                                formData.append(
                                  'bankAccountNumber',
                                  returnForm.bankAccountNumber.trim(),
                                )
                              }
                              if (returnForm.ifscCode) {
                                formData.append('ifscCode', returnForm.ifscCode.trim())
                              }
                              if (returnForm.accountHolderName) {
                                formData.append(
                                  'accountHolderName',
                                  returnForm.accountHolderName.trim(),
                                )
                              }
                            }
                          }
                        }

                        // Append image files
                        returnForm.images.forEach((imagePreview) => {
                          formData.append('images', imagePreview.file)
                        })

                        await createReturnMutation.mutateAsync(formData)
                        toast.success(
                          returnForm.returnType === 'replacement'
                            ? 'Replacement request submitted'
                            : 'Return request submitted',
                        )
                        // Revoke object URLs before clearing form
                        returnForm.images.forEach((imagePreview) => {
                          URL.revokeObjectURL(imagePreview.preview)
                        })
                        setReturnOrder(null)
                        setReturnError(null)
                        setValidationErrors({})
                        setReturnForm({
                          reason: '',
                          description: '',
                          images: [],
                          returnType: 'return',
                          exchangeVariantId: undefined,
                          orderItemId: undefined,
                        })
                      } catch (err) {
                        const errorMessage = getErrorMessage(
                          err,
                          'Failed to submit return request. Please try again or contact support.',
                        )
                        setReturnError(errorMessage)
                        toast.error(errorMessage)
                      }
                    }}
                  >
                    Submit Request
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Cancel Order Confirmation Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
          >
            <DialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                  <XCircle className="h-5 w-5 text-red-600" />
                </div>
                <DialogTitle className="text-lg font-semibold text-gray-900">
                  Cancel Order?
                </DialogTitle>
              </div>
              <DialogDescription className="text-sm text-gray-600 pt-2">
                Are you sure you want to cancel this order? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            {orderToCancel && (
              <div className="my-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-xs font-medium text-gray-700 mb-1">Order Details</p>
                <p className="text-sm text-gray-900">
                  Order #{orderToCancel.orderNumber || orderToCancel._id.slice(-8)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Total: {currencyFormatter.format(orderToCancel.total)}
                </p>
              </div>
            )}
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={closeCancelDialog}
                disabled={cancellingOrderId !== null}
                className="transition-all duration-200"
              >
                Keep Order
              </Button>
              <Button
                variant="destructive"
                onClick={handleCancelOrder}
                disabled={cancellingOrderId !== null}
                className="transition-all duration-200 text-white hover:bg-red-700 bg-red-600 "
              >
                {cancellingOrderId === orderToCancel?._id ? (
                  <>
                    <span className="text-white animate-spin mr-2 inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                    Cancelling...
                  </>
                ) : (
                  'Yes, Cancel Order'
                )}
              </Button>
            </DialogFooter>
          </motion.div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
