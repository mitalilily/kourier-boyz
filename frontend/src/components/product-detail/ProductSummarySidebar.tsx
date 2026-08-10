import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import type { Product } from '@/api/products'
import type { SellerCoupon } from '@/api/sellerCoupons'
import ColorVariantSelector from '@/components/product-detail/ColorVariantSelector'
import DeliveryAndPickupSection from '@/components/product-detail/DeliveryAndPickupSection'
import GenericVariantSelector from '@/components/product-detail/GenericVariantSelector'
import SectionHeading from '@/components/product-detail/SectionHeading'
import SizeVariantSelector from '@/components/product-detail/SizeVariantSelector'
import StarRating from '@/components/product-detail/StarRating'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import QuantitySelector from '@/components/ui/QuantitySelector'
import { Separator } from '@/components/ui/separator'
import { cn, formatWarranty, formatWarrantyShort } from '@/lib/utils'
import {
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  ExternalLink,
  Info,
  Loader2,
  Package,
  RefreshCcw,
  SendHorizontal,
  ShieldCheck,
  Sparkles,
  Star,
  Tag,
  Truck,
  X,
  Zap,
} from 'lucide-react'

import { DeliveryStatus, formatCurrency, normalizeVariant, ProductVariant } from './utils'

// Compact Coupon List Component for Popover
interface CompactCouponListProps {
  coupons: SellerCoupon[]
  appliedCouponId?: string | null
  processingCouponId?: string | null
  discountedPriceData?: {
    originalTotal: number
    discountAmount: number
    discountedTotal: number
    discountedPricePerUnit: number
    allowedDiscountUnits?: number
    fullPriceUnits?: number
  } | null
  quantity: number
  isCalculatingDiscount?: boolean
  isApplyingCoupon?: boolean
  isRemovingCoupon?: boolean
  onApplyCoupon?: (couponId: string) => void | Promise<void>
  onRemoveCoupon?: () => void
}

const CompactCouponList: React.FC<CompactCouponListProps> = ({
  coupons,
  appliedCouponId,
  processingCouponId,
  discountedPriceData,
  quantity,
  isCalculatingDiscount = false,
  isApplyingCoupon = false,
  isRemovingCoupon = false,
  onApplyCoupon,
  onRemoveCoupon,
}) => {
  return (
    <div className="p-3">
      <div className="flex items-center gap-2 mb-3">
        <Tag className="w-4 h-4 text-gray-600" />
        <h3 className="text-sm font-semibold text-gray-900">Available Coupons</h3>
      </div>
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {coupons.map((coupon) => {
          const isApplied = appliedCouponId === coupon._id
          const isProcessingThisCoupon = processingCouponId === coupon._id
          const isApplyingThisCoupon = isApplyingCoupon && isProcessingThisCoupon
          const isRemovingThisCoupon = isRemovingCoupon && isProcessingThisCoupon

          return (
            <div
              key={coupon._id}
              className={`rounded-lg border p-2.5 transition-all ${
                isApplied ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-white'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-xs font-semibold ${
                        isApplied ? 'text-green-700' : 'text-gray-900'
                      }`}
                    >
                      {coupon.couponCode || 'Coupon'}
                    </span>
                    {isApplied && !isRemovingThisCoupon && (
                      <Badge className="px-1.5 py-0.5 text-[10px] bg-green-200 text-green-800 border-0">
                        APPLIED
                      </Badge>
                    )}
                    {isApplyingThisCoupon && (
                      <Badge className="px-1.5 py-0.5 text-[10px] bg-blue-100 text-blue-700 border-0 flex items-center gap-1">
                        <Loader2 className="w-2.5 h-2.5 animate-spin" />
                        Applying...
                      </Badge>
                    )}
                    {isRemovingThisCoupon && (
                      <Badge className="px-1.5 py-0.5 text-[10px] bg-amber-100 text-amber-700 border-0 flex items-center gap-1">
                        <Loader2 className="w-2.5 h-2.5 animate-spin" />
                        Removing...
                      </Badge>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-600 mb-1">
                    {coupon.discountType === 'percent'
                      ? `${coupon.discountValue}% OFF`
                      : `₹${coupon.discountValue} OFF`}
                    {coupon.description && ` • ${coupon.description}`}
                  </p>
                  {isApplied &&
                    discountedPriceData &&
                    !isCalculatingDiscount &&
                    discountedPriceData.discountAmount > 0 && (
                      <p className="text-[10px] text-green-600 font-medium">
                        Save ₹{formatCurrency(discountedPriceData.discountAmount)} on{' '}
                        {discountedPriceData.allowedDiscountUnits !== undefined &&
                        discountedPriceData.allowedDiscountUnits > 0
                          ? discountedPriceData.allowedDiscountUnits
                          : quantity}{' '}
                        {discountedPriceData.allowedDiscountUnits !== undefined &&
                        discountedPriceData.allowedDiscountUnits > 0
                          ? discountedPriceData.allowedDiscountUnits === 1
                            ? 'item'
                            : 'items'
                          : quantity === 1
                            ? 'item'
                            : 'items'}
                      </p>
                    )}
                  {isApplied &&
                    discountedPriceData &&
                    !isCalculatingDiscount &&
                    discountedPriceData.discountAmount === 0 &&
                    discountedPriceData.allowedDiscountUnits !== undefined &&
                    discountedPriceData.allowedDiscountUnits === 0 && (
                      <p className="text-[10px] text-amber-600 font-medium">
                        Coupon limit reached - no discount available
                      </p>
                    )}
                  {isCalculatingDiscount && isApplied && (
                    <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
                      <Loader2 className="w-2.5 h-2.5 animate-spin" />
                      <span>Calculating...</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {isApplied ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onRemoveCoupon}
                      disabled={isRemovingCoupon || isCalculatingDiscount}
                      className="h-6 px-2 text-[10px] text-gray-600 hover:text-gray-900 hover:bg-gray-100 disabled:opacity-50"
                    >
                      {isRemovingThisCoupon ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <X className="w-3 h-3" />
                      )}
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onApplyCoupon?.(coupon._id)}
                      disabled={isApplyingCoupon || isCalculatingDiscount || isRemovingCoupon}
                      className="h-6 px-2 text-[10px] border-green-300 text-green-700 hover:bg-green-50 disabled:opacity-50"
                    >
                      {isApplyingThisCoupon ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        'Apply'
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
      {appliedCouponId &&
        discountedPriceData &&
        !isCalculatingDiscount &&
        discountedPriceData.discountAmount > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600">Total Discount:</span>
              <span className="font-semibold text-green-600">
                -₹{formatCurrency(discountedPriceData.discountAmount)}
              </span>
            </div>
          </div>
        )}
    </div>
  )
}

interface ProductSummarySidebarProps {
  addToCartPending: boolean
  availableStock: number
  comparePrice?: number
  deliveryPin: string
  deliveryStatus: DeliveryStatus
  isCheckingServiceability?: boolean
  effectiveDiscount?: number
  isInCart: boolean
  isLowStock: boolean
  isOutOfStock: boolean
  maxOrderQuantity: number
  minOrderQuantity: number
  onAddToCart: () => void | Promise<void>
  onAttributeSelect: (attribute: string, value: string) => void
  onBuyNow: () => void | Promise<void>
  onDeliveryCheck: (event: React.FormEvent<HTMLFormElement>) => void
  onDeliveryPinChange: (value: string, options?: { autoCheck?: boolean }) => void
  onQuantityChange: (value: number) => void
  onRemoveFromCart: () => void | Promise<void>
  price: number
  product: Product
  quantity: number
  removeFromCartPending: boolean
  selectedAttributes: Record<string, string>
  variants: ProductVariant[]
  onVariantHover?: (variant: ProductVariant | null) => void
  // Coupon props
  availableCoupons?: SellerCoupon[]
  appliedCouponId?: string | null
  discountedPriceData?: {
    originalTotal: number
    discountAmount: number
    discountedTotal: number
    discountedPricePerUnit: number
    allowedDiscountUnits?: number
    fullPriceUnits?: number
    coupon?: {
      _id: string
      couponCode: string
      discountType: 'percent' | 'flat'
      discountValue: number
    }
  } | null
  onApplyCoupon?: (couponId: string) => void | Promise<void>
  onRemoveCoupon?: () => void
  finalPrice?: number
  finalTotal?: number
  isCouponsLoading?: boolean
  isCalculatingDiscount?: boolean
  isApplyingCoupon?: boolean
  isRemovingCoupon?: boolean
  processingCouponId?: string | null
}

const ProductSummarySidebar: React.FC<ProductSummarySidebarProps> = ({
  addToCartPending,
  availableStock,
  comparePrice,
  deliveryPin,
  deliveryStatus,
  isCheckingServiceability,
  effectiveDiscount,
  isInCart,
  isLowStock,
  isOutOfStock,
  maxOrderQuantity,
  minOrderQuantity,
  onAddToCart,
  onAttributeSelect,
  onBuyNow,
  onDeliveryCheck,
  onDeliveryPinChange,
  onQuantityChange,
  onRemoveFromCart,
  price,
  product,
  quantity,
  removeFromCartPending,
  selectedAttributes,
  variants,
  onVariantHover,
  // Coupon props
  availableCoupons = [],
  appliedCouponId,
  discountedPriceData,
  onApplyCoupon,
  onRemoveCoupon,
  finalPrice = price,
  finalTotal = price * quantity,
  isCouponsLoading = false,
  isCalculatingDiscount = false,
  isApplyingCoupon = false,
  isRemovingCoupon = false,
  processingCouponId = null,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const buttonContainerRef = useRef<HTMLDivElement>(null)
  const [showFloatingButtons, setShowFloatingButtons] = useState(false)

  // Ensure all variants are shown, including out-of-stock ones
  // Use product.variants directly to guarantee we get all variants
  const allVariants = useMemo<ProductVariant[]>(() => {
    if (!product?.hasVariants || !Array.isArray(product?.variants)) {
      // Fallback to variants prop if product.variants is not available
      return variants
    }
    // Normalize all variants from product to ensure we show all of them
    return (product.variants as Array<Record<string, unknown>>).map((variant) =>
      normalizeVariant(variant),
    )
  }, [product?.hasVariants, product?.variants, variants])

  const checkScrollability = useCallback(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const { scrollLeft, scrollWidth, clientWidth } = container
    setCanScrollLeft(scrollLeft > 0)
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1)
  }, [])

  // Intersection Observer for floating buttons
  useEffect(() => {
    const buttonContainer = buttonContainerRef.current
    if (!buttonContainer) return

    let buttonObserver: IntersectionObserver | null = null
    let shareObserver: IntersectionObserver | null = null
    let scrollHandler: (() => void) | null = null

    // Wait a bit for DOM to be ready
    const timeoutId = setTimeout(() => {
      const shareSection = document.getElementById('share-section')

      let buttonsVisible = true
      let shareSectionVisible = false

      const updateFloatingButtons = () => {
        // Check if we've reached or passed the share section
        if (shareSection) {
          const rect = shareSection.getBoundingClientRect()
          // Hide buttons when share section enters viewport (top reaches viewport)
          // Keep hidden once we've scrolled past it (top is above viewport)
          shareSectionVisible = rect.top <= window.innerHeight
        }

        // Show floating buttons only when:
        // 1. Original buttons are not visible AND
        // 2. We haven't reached the share section yet
        const shouldShow = !buttonsVisible && !shareSectionVisible
        setShowFloatingButtons(shouldShow)
      }

      buttonObserver = new IntersectionObserver(
        (entries) => {
          const entry = entries[0]
          buttonsVisible = entry.isIntersecting
          updateFloatingButtons()
        },
        {
          threshold: 0, // Trigger as soon as any part is visible
          rootMargin: '-10px 0px', // Add small margin to trigger slightly before fully out of view
        },
      )

      buttonObserver.observe(buttonContainer)

      if (shareSection) {
        shareObserver = new IntersectionObserver(
          (entries) => {
            const entry = entries[0]
            shareSectionVisible = entry.isIntersecting
            updateFloatingButtons()
          },
          {
            threshold: 0.1, // Trigger when 10% is visible
            rootMargin: '0px',
          },
        )
        shareObserver.observe(shareSection)

        // Also listen to scroll for more responsive updates
        scrollHandler = () => {
          updateFloatingButtons()
        }
        window.addEventListener('scroll', scrollHandler, { passive: true })
      }

      // Initial check
      updateFloatingButtons()
    }, 100)

    return () => {
      clearTimeout(timeoutId)
      if (buttonObserver) {
        buttonObserver.disconnect()
      }
      if (shareObserver) {
        shareObserver.disconnect()
      }
      if (scrollHandler) {
        window.removeEventListener('scroll', scrollHandler)
      }
    }
  }, [])

  useEffect(() => {
    // Check scrollability after a short delay to ensure DOM is ready
    const timeoutId = setTimeout(() => {
      checkScrollability()
    }, 100)

    const container = scrollContainerRef.current
    if (container) {
      container.addEventListener('scroll', checkScrollability)
      window.addEventListener('resize', checkScrollability)
      return () => {
        clearTimeout(timeoutId)
        container.removeEventListener('scroll', checkScrollability)
        window.removeEventListener('resize', checkScrollability)
      }
    }
    return () => clearTimeout(timeoutId)
  }, [checkScrollability])

  const scrollLeft = () => {
    const container = scrollContainerRef.current
    if (container) {
      container.scrollBy({ left: -200, behavior: 'smooth' })
    }
  }

  const scrollRight = () => {
    const container = scrollContainerRef.current
    if (container) {
      container.scrollBy({ left: 200, behavior: 'smooth' })
    }
  }

  // Find active variant based on selectedAttributes
  const activeVariant = product.hasVariants
    ? allVariants.find((v) => {
        if (!v.attributes) return false
        return Object.keys(selectedAttributes).every(
          (key) => v.attributes?.[key] === selectedAttributes[key],
        )
      }) ?? null
    : null

  // Detect attribute keys for color and size, and get all other attribute keys
  const { colorAttributeKey, sizeAttributeKey, otherAttributeKeys } = useMemo(() => {
    if (!allVariants.length || !allVariants[0]?.attributes) {
      return { colorAttributeKey: null, sizeAttributeKey: null, otherAttributeKeys: [] }
    }
    const attrs = Object.keys(allVariants[0].attributes)

    // Find color attribute
    const colorAttr =
      attrs.find((attr) => ['color', 'colour', 'colors', 'colours'].includes(attr.toLowerCase())) ||
      null

    // Find size attribute - only exact "size" (not custom-size, volume, etc.)
    // This ensures we only show size charts for actual clothing/apparel sizes
    const sizeAttr = attrs.find((attr) => attr.toLowerCase() === 'size') || null

    // Get all other attributes (not color or size)
    // Filter out color and size attributes (case-insensitive check for safety)
    const otherAttrs = attrs.filter((attr) => {
      const attrLower = attr.toLowerCase()
      const isColor =
        attr === colorAttr || ['color', 'colour', 'colors', 'colours'].includes(attrLower)
      const isSize = attr === sizeAttr || attrLower === 'size'
      return !isColor && !isSize
    })

    return {
      colorAttributeKey: colorAttr,
      sizeAttributeKey: sizeAttr,
      otherAttributeKeys: otherAttrs,
    }
  }, [allVariants])

  // Get selected color and size from selectedAttributes
  const selectedColor = colorAttributeKey ? selectedAttributes[colorAttributeKey] || null : null
  const selectedSize = sizeAttributeKey ? selectedAttributes[sizeAttributeKey] || null : null

  // Handle color selection - update the color attribute and auto-select first available size
  const handleColorSelect = useCallback(
    (colorValue: string) => {
      if (!colorAttributeKey) return

      // Update color attribute
      onAttributeSelect(colorAttributeKey, colorValue)

      // Find first variant with this color that has stock, and auto-select its size
      if (sizeAttributeKey) {
        const firstAvailableVariant = allVariants.find((v) => {
          const matchesColor = v.attributes?.[colorAttributeKey] === colorValue
          const hasStock = (v.stock ?? 0) > 0
          return matchesColor && hasStock
        })

        if (firstAvailableVariant?.attributes?.[sizeAttributeKey]) {
          onAttributeSelect(sizeAttributeKey, firstAvailableVariant.attributes[sizeAttributeKey])
        }
      }
    },
    [colorAttributeKey, sizeAttributeKey, allVariants, onAttributeSelect],
  )

  // Handle size selection
  const handleSizeSelect = useCallback(
    (sizeValue: string) => {
      if (!sizeAttributeKey) return
      onAttributeSelect(sizeAttributeKey, sizeValue)
    },
    [sizeAttributeKey, onAttributeSelect],
  )

  // Handle generic attribute selection
  const handleGenericAttributeSelect = useCallback(
    (attributeKey: string, value: string) => {
      onAttributeSelect(attributeKey, value)
    },
    [onAttributeSelect],
  )

  return (
    <div className="relative">
      <div className="rounded-2xl sm:rounded-3xl border border-gray-100 bg-white shadow-lg shadow-gray-200/50 p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
        <div className="space-y-2 sm:space-y-3">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {product.isFeatured ? (
              <Badge
                variant="outline"
                className="rounded-full border-amber-200 text-amber-600 text-xs sm:text-sm"
              >
                Featured
              </Badge>
            ) : null}
          </div>
          <div className="space-y-1.5 sm:space-y-2">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 leading-tight">
              {product.name}
            </h1>
            {product.shortDescription && (
              <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
                {product.shortDescription}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm">
            {typeof product.rating === 'number' && product.rating > 0 ? (
              <StarRating value={product.rating} reviews={product.reviewCount ?? 0} />
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500">
                <Star className="w-4 h-4 text-gray-300" />
                New arrival
              </span>
            )}
            {product.seller && (
              <>
                <Separator orientation="vertical" className="h-4 text-gray-500" />
                <Link
                  to={`/seller/${product.seller.storeSlug}`}
                  className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
                >
                  <span>Visit {product.seller.storeName} Store</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </>
            )}
          </div>
        </div>

        <div className="space-y-1.5 sm:space-y-2">
          {isCalculatingDiscount && appliedCouponId ? (
            <>
              {/* Loading State - Calculating Discount */}
              <div className="flex items-end gap-2 sm:gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin text-gray-400" />
                  <span className="text-sm sm:text-base text-gray-500">
                    Calculating discount...
                  </span>
                </div>
              </div>
              {discountedPriceData && (
                <div className="text-xs sm:text-sm text-gray-500 italic">
                  Previous: ₹{formatCurrency(discountedPriceData.discountedPricePerUnit)} per unit
                </div>
              )}
            </>
          ) : discountedPriceData &&
            (discountedPriceData.discountAmount > 0 ||
              (discountedPriceData.allowedDiscountUnits !== undefined &&
                discountedPriceData.allowedDiscountUnits > 0)) ? (
            <>
              {/* Discounted Price Display */}
              <div className="flex items-end gap-2 sm:gap-3 flex-wrap">
                <span className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
                  ₹{formatCurrency(finalPrice) ?? '--'}
                </span>
                <span className="text-sm sm:text-base text-gray-400 line-through">
                  ₹{formatCurrency(price)}
                </span>
                {discountedPriceData.discountAmount > 0 && (
                  <span className="text-xs sm:text-sm font-bold text-green-600 bg-green-50 px-2 py-1 rounded">
                    Save ₹{formatCurrency(discountedPriceData.discountAmount)}
                  </span>
                )}
              </div>
              {quantity > 1 && (
                <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-600">
                  <span>
                    ₹{formatCurrency(finalPrice)} × {quantity} ={' '}
                    <span className="font-bold text-gray-900">₹{formatCurrency(finalTotal)}</span>
                  </span>
                </div>
              )}
              {discountedPriceData.allowedDiscountUnits !== undefined &&
                discountedPriceData.fullPriceUnits !== undefined && (
                  <>
                    {discountedPriceData.allowedDiscountUnits > 0 ? (
                      <div className="text-[10px] sm:text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
                        {discountedPriceData.allowedDiscountUnits} unit(s) discounted
                        {discountedPriceData.fullPriceUnits > 0 && (
                          <> • {discountedPriceData.fullPriceUnits} unit(s) at full price</>
                        )}
                      </div>
                    ) : (
                      <div className="text-[10px] sm:text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
                        Coupon limit reached • All {quantity} unit(s) at full price
                      </div>
                    )}
                  </>
                )}
              {discountedPriceData.discountAmount > 0 && (
                <div className="flex items-center gap-2 text-[10px] sm:text-xs text-green-600">
                  <Tag className="w-3 h-3" />
                  <span className="font-medium">
                    Coupon applied! ₹
                    {formatCurrency(
                      discountedPriceData.allowedDiscountUnits && discountedPriceData.allowedDiscountUnits > 0
                        ? discountedPriceData.discountAmount / discountedPriceData.allowedDiscountUnits
                        : discountedPriceData.discountAmount / quantity,
                    )}{' '}
                    off per unit • Total savings: ₹
                    {formatCurrency(discountedPriceData.discountAmount)}
                  </span>
                </div>
              )}
              {discountedPriceData.discountAmount === 0 &&
                discountedPriceData.allowedDiscountUnits !== undefined &&
                discountedPriceData.allowedDiscountUnits > 0 && (
                  <div className="flex items-center gap-2 text-[10px] sm:text-xs text-amber-600">
                    <Tag className="w-3 h-3" />
                    <span className="font-medium">
                      Coupon applied but no discount available (invalid discount value)
                    </span>
                  </div>
                )}
              {discountedPriceData.discountAmount === 0 &&
                discountedPriceData.allowedDiscountUnits !== undefined &&
                discountedPriceData.allowedDiscountUnits === 0 && (
                  <div className="flex items-center gap-2 text-[10px] sm:text-xs text-amber-600">
                    <Tag className="w-3 h-3" />
                    <span className="font-medium">
                      Coupon applied but redemption limit reached
                    </span>
                  </div>
                )}
            </>
          ) : (
            <>
              {/* Original Price Display */}
              <div className="flex items-end gap-2 sm:gap-3 flex-wrap">
                {effectiveDiscount && effectiveDiscount > 0 ? (
                  <span className="text-base sm:text-lg font-bold text-rose-600 tracking-tight">
                    -{effectiveDiscount}%
                  </span>
                ) : null}
                <span className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
                  ₹{formatCurrency(price) ?? '--'}
                </span>
                {comparePrice && comparePrice > price ? (
                  <span className="text-sm sm:text-base text-gray-400 line-through">
                    ₹{formatCurrency(comparePrice)}
                  </span>
                ) : null}
              </div>
              {quantity > 1 && (
                <div className="text-xs sm:text-sm text-gray-600">
                  ₹{formatCurrency(price)} × {quantity} = ₹{formatCurrency(price * quantity)}
                </div>
              )}
            </>
          )}
          <p className="text-[10px] sm:text-xs text-gray-500">
            Inclusive of all taxes · Secure transaction
          </p>

          {/* Compact Coupon Section - Next to Price */}
          {!isCouponsLoading && availableCoupons.length > 0 && (
            <div className="flex items-center gap-2 pt-1">
              {appliedCouponId ? (
                <div className="flex items-center gap-1.5">
                  <Badge className="px-2 py-0.5 text-[10px] sm:text-xs bg-green-100 text-green-700 border-green-200">
                    <Tag className="w-3 h-3 mr-1" />
                    Coupon Applied
                  </Badge>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[10px] sm:text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                      >
                        View Coupons
                        <ChevronDown className="w-3 h-3 ml-1" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-0" align="start">
                      <CompactCouponList
                        coupons={availableCoupons}
                        appliedCouponId={appliedCouponId}
                        processingCouponId={processingCouponId}
                        discountedPriceData={discountedPriceData}
                        quantity={quantity}
                        isCalculatingDiscount={isCalculatingDiscount}
                        isApplyingCoupon={isApplyingCoupon}
                        isRemovingCoupon={isRemovingCoupon}
                        onApplyCoupon={onApplyCoupon}
                        onRemoveCoupon={onRemoveCoupon}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              ) : (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 px-2 text-[10px] sm:text-xs border-green-300 text-green-700 hover:bg-green-50"
                    >
                      <Tag className="w-3 h-3 mr-1" />
                      {availableCoupons.length} Coupon
                      {availableCoupons.length > 1 ? 's' : ''} Available
                      <ChevronDown className="w-3 h-3 ml-1" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-0" align="start">
                    <CompactCouponList
                      coupons={availableCoupons}
                      appliedCouponId={appliedCouponId}
                      processingCouponId={processingCouponId}
                      discountedPriceData={discountedPriceData}
                      quantity={quantity}
                      isCalculatingDiscount={isCalculatingDiscount}
                      isApplyingCoupon={isApplyingCoupon}
                      isRemovingCoupon={isRemovingCoupon}
                      onApplyCoupon={onApplyCoupon}
                      onRemoveCoupon={onRemoveCoupon}
                    />
                  </PopoverContent>
                </Popover>
              )}
            </div>
          )}
          {isCouponsLoading && (
            <div className="flex items-center gap-2 pt-1">
              <Loader2 className="w-3 h-3 animate-spin text-gray-400" />
              <span className="text-[10px] sm:text-xs text-gray-500">Loading coupons...</span>
            </div>
          )}
        </div>

        {/* Color Variant Selector - Shows unique colors with images */}
        {product.hasVariants && allVariants.length > 0 && colorAttributeKey && (
          <ColorVariantSelector
            variants={allVariants}
            activeVariant={activeVariant}
            productName={product.name}
            selectedColor={selectedColor}
            onColorSelect={handleColorSelect}
            onVariantHover={onVariantHover}
          />
        )}

        {/* Size Variant Selector - Shows sizes as chip buttons */}
        {product.hasVariants && allVariants.length > 0 && sizeAttributeKey && (
          <SizeVariantSelector
            variants={allVariants}
            selectedColor={selectedColor}
            selectedSize={selectedSize}
            onSizeSelect={handleSizeSelect}
            colorAttributeKey={colorAttributeKey}
            sizeAttributeKey={sizeAttributeKey}
            productId={product._id}
          />
        )}

        {/* Generic Variant Selectors - Shows all other variant attributes (not color or size) */}
        {product.hasVariants &&
          allVariants.length > 0 &&
          otherAttributeKeys.map((attributeKey) => {
            const selectedValue = selectedAttributes[attributeKey] || null
            return (
              <GenericVariantSelector
                key={attributeKey}
                variants={allVariants}
                attributeKey={attributeKey}
                selectedValue={selectedValue}
                onSelect={(value) => handleGenericAttributeSelect(attributeKey, value)}
                selectedAttributes={selectedAttributes}
              />
            )
          })}

        <div className="rounded-xl sm:rounded-2xl border border-gray-100 bg-gray-50/70 p-3 sm:p-4 space-y-2.5 sm:space-y-3">
          <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-medium">
            {isOutOfStock ? (
              <>
                <RefreshCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-500 shrink-0" />
                <span className="text-rose-600">Currently out of stock</span>
              </>
            ) : isLowStock ? (
              <>
                <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500 shrink-0" />
                <span className="text-amber-600 font-semibold">
                  Hurry! Only {availableStock} {availableStock === 1 ? 'item' : 'items'} left in
                  stock
                </span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-500 shrink-0" />
                <span className="text-emerald-600">Ready to ship · In stock</span>
              </>
            )}
          </div>

          {/* Kourier Boyz Fulfilled Delivery */}
          {/* <div className="flex items-center gap-1.5 sm:gap-2 pt-2 border-t border-gray-200">
            <img
              src="/brand/kourier-boyz-logo.png"
              alt="Kourier Boyz"
              className="w-4 h-4 sm:w-5 sm:h-5 object-contain shrink-0"
            />
            <span className="text-[10px] sm:text-xs font-medium text-gray-700">
              Kourier Boyz fulfilled delivery
            </span>
          </div> */}
        </div>

        {/* Trust Indicators & Features */}
        <div className="relative -mx-4 px-4">
          {canScrollLeft && (
            <button
              onClick={scrollLeft}
              className="absolute cursor-pointer -left-3 top-1/2 -translate-y-1/2 z-10 bg-white  rounded-full hover:shadow-lg transition-all hover:bg-gray-50"
              aria-label="Scroll left"
            >
              <ChevronLeft className="w-4 h-4 text-gray-700" />
            </button>
          )}
          {canScrollRight && (
            <button
              onClick={scrollRight}
              className="absolute cursor-pointer -right-3 top-1/2 -translate-y-1/2 z-10 bg-white  rounded-full  hover:shadow-lg transition-all hover:bg-gray-50"
              aria-label="Scroll right"
            >
              <ChevronRight className="w-4 h-4 text-gray-700" />
            </button>
          )}
          <div
            ref={scrollContainerRef}
            className="overflow-x-auto scrollbar-hide"
            onScroll={checkScrollability}
          >
            <div className="flex gap-2.5 min-w-max pb-1">
              {/* Free Delivery - Only show if freeShipping is enabled */}
              {product.freeShipping === true && (
                <FeatureBadge
                  icon={<Truck className="w-4 h-4" />}
                  text="Free Delivery"
                  variant="emerald"
                />
              )}

              {/* Pay on Delivery */}
              {product.payOnDelivery === true && (
                <FeatureBadge
                  icon={<CreditCard className="w-4 h-4" />}
                  text="Pay on Delivery"
                  variant="blue"
                />
              )}

              {/* Returnable */}
              {product.returnable === true && (
                <FeatureBadge
                  icon={<RefreshCcw className="w-4 h-4" />}
                  text={product.returnDays ? `${product.returnDays} Days Returnable` : 'Returnable'}
                  variant="purple"
                />
              )}

              {/* Warranty */}
              {product.warranty === true && (
                <FeatureBadge
                  icon={<ShieldCheck className="w-4 h-4" />}
                  text={formatWarranty(product.warrantyDays)}
                  variant="amber"
                />
              )}

              {/* Next Day Delivery */}
              {product.nextDayDelivery === true && (
                <FeatureBadge
                  icon={<Zap className="w-4 h-4" />}
                  text="Next Day Delivery"
                  variant="indigo"
                />
              )}

              {/* Secure Payment */}
              <FeatureBadge
                icon={<CheckCircle2 className="w-4 h-4" />}
                text="Secure Payment"
                variant="green"
              />
            </div>
          </div>
        </div>

        {/* Delivery & Pickup Section - Before add to cart */}
        <DeliveryAndPickupSection
          deliveryPin={deliveryPin}
          deliveryStatus={deliveryStatus}
          onDeliveryCheck={onDeliveryCheck}
          onDeliveryPinChange={onDeliveryPinChange}
          isCheckingServiceability={isCheckingServiceability}
          isFreeShipping={product.freeShipping === true}
          allowsPayOnDelivery={product.payOnDelivery === true}
        />

        {/* Minimum Order Quantity Notice - Show when not in cart */}
        {!isInCart && minOrderQuantity > 1 && (
          <div className="flex items-center gap-2 text-xs sm:text-sm text-blue-700 bg-blue-50 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg border border-blue-200">
            <Info className="w-4 h-4 text-blue-600 shrink-0" />
            <span>
              <span className="font-semibold">Minimum order:</span> {minOrderQuantity}{' '}
              {minOrderQuantity === 1 ? 'unit' : 'units'} required
            </span>
          </div>
        )}

        <div className="space-y-3">
          {/* Show quantity selector when product is in cart */}
          {isInCart ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm text-gray-600 font-medium">Quantity:</span>
                <QuantitySelector
                  quantity={Math.max(quantity || minOrderQuantity, minOrderQuantity)}
                  onQuantityChange={onQuantityChange}
                  min={minOrderQuantity}
                  max={Math.max(maxOrderQuantity, minOrderQuantity)}
                  disabled={isOutOfStock}
                  size="lg"
                />
              </div>
              {minOrderQuantity > 1 && (
                <div className="flex items-center gap-1.5 text-xs text-gray-600 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200">
                  <Info className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span>
                    Minimum order:{' '}
                    <span className="font-semibold text-blue-700">{minOrderQuantity}</span>{' '}
                    {minOrderQuantity === 1 ? 'unit' : 'units'}
                  </span>
                </div>
              )}
            </div>
          ) : null}
          <div
            ref={buttonContainerRef}
            id="product-action-buttons"
            className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3"
          >
            {isInCart ? (
              <Button
                size="lg"
                variant="destructive"
                onClick={onRemoveFromCart}
                disabled={isOutOfStock || removeFromCartPending}
                className="text-sm sm:text-base"
              >
                {removeFromCartPending ? 'Removing...' : 'Remove from Cart'}
              </Button>
            ) : (
              <Button
                size="lg"
                onClick={onAddToCart}
                disabled={isOutOfStock || addToCartPending}
                className="text-sm sm:text-base"
              >
                {addToCartPending ? 'Adding...' : 'Add to Cart'}
              </Button>
            )}
            <Button
              size="lg"
              variant="blue"
              onClick={onBuyNow}
              disabled={isOutOfStock || addToCartPending || removeFromCartPending}
              className="text-sm sm:text-base"
            >
              Buy Now
            </Button>
          </div>
        </div>

        <div className="space-y-2.5 sm:space-y-3 text-xs sm:text-sm text-gray-600">
          <div className="flex items-start gap-1.5 sm:gap-2">
            <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-500 mt-0.5 shrink-0" />
            <p>Secure payments powered by Kourier Boyz vault with buyer protection.</p>
          </div>
          {product.warranty ? (
            <div className="flex items-start gap-1.5 sm:gap-2">
              <RefreshCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500 mt-0.5 shrink-0" />
              <p>
                {formatWarrantyShort(product.warrantyDays || 7)} no-questions-asked replacement on
                eligible defects.
              </p>
            </div>
          ) : null}

          <div className="flex items-start gap-1.5 sm:gap-2">
            <Package className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-500 mt-0.5 shrink-0" />
            <p>
              {product.requiresShipping
                ? 'Ships nationwide with real-time tracking.'
                : 'Digital product delivered instantly.'}
            </p>
          </div>
        </div>

        <div className="space-y-3 sm:space-y-4 text-xs sm:text-sm text-gray-600">
          {product.brand ? <DetailRow label="Brand" value={product.brand} /> : null}
          <DetailRow label="Category" value={product.category?.name ?? 'General'} />
          {product.taxRate ? <DetailRow label="Tax rate" value={`${product.taxRate}%`} /> : null}
          {product.tags?.length ? (
            <div>
              <p className="text-[10px] sm:text-xs uppercase tracking-wide text-gray-500">Tags</p>
              <div className="mt-1.5 sm:mt-2 flex flex-wrap gap-1.5 sm:gap-2">
                {product.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs font-medium rounded-full bg-gray-100 text-gray-700"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl sm:rounded-3xl border border-gray-100 bg-white shadow-sm p-4 sm:p-6 space-y-4 sm:space-y-5">
          <SectionHeading title="Support & services" subtitle="Confidence after purchase" />
          <ul className="space-y-3">
            <DetailBullet
              icon={<ShieldCheck className="w-4 h-4 text-emerald-500" />}
              title="Marketplace protection"
              description="Your payment is fully secured until delivery is confirmed."
            />
            <DetailBullet
              icon={<SendHorizontal className="w-4 h-4 text-purple-500" />}
              title="Proactive notifications"
              description="Stay updated at every milestone from dispatch to doorstep."
            />
            <DetailBullet
              icon={<Package className="w-4 h-4 text-blue-500" />}
              title={product.freeShipping ? 'Complimentary delivery' : 'Fast logistics network'}
              description={
                product.freeShipping
                  ? 'Free doorstep delivery with optimized packaging.'
                  : 'Low-cost shipping with trusted logistics partners.'
              }
            />
            {product.returnable ? (
              <DetailBullet
                icon={<RefreshCcw className="w-4 h-4 text-amber-500" />}
                title="Easy change of mind"
                description={`Hassle-free exchanges within ${product.returnDays || 7} ${
                  product.returnDays === 1 ? 'day' : 'days'
                } on eligible orders.`}
              />
            ) : (
              <DetailBullet
                icon={<RefreshCcw className="w-4 h-4 text-gray-400" />}
                title="Non-returnable"
                description="This item cannot be returned or exchanged. Please review carefully before purchase."
              />
            )}
            {product.warranty ? (
              <DetailBullet
                icon={<ShieldCheck className="w-4 h-4 text-indigo-500" />}
                title="Warranty"
                description={`${formatWarrantyShort(
                  product.warrantyDays || 7,
                )} warranty coverage on manufacturing defects and product quality issues.`}
              />
            ) : null}
          </ul>
        </div>
      </div>

      {/* Floating Summary Bar - Show when original buttons are not visible */}
      {showFloatingButtons && (
        <div
          className="fixed bottom-16 lg:bottom-4 left-0 right-0 z-[9999] border-t border-gray-200 bg-white/95 backdrop-blur-lg shadow-[0_-6px_25px_rgba(15,23,42,0.12)]"
          style={{
            animation: 'slideUpFade 0.3s ease-out',
          }}
        >
          <div className="mx-auto max-w-7xl px-4 py-3 lg:px-6 lg:py-4">
            <div className="flex items-center justify-between gap-4 lg:gap-6">
              {/* Price Display */}
              <div className="shrink-0">
                <p className="text-xs lg:text-sm text-gray-500 mb-0.5 lg:mb-1">Starts at</p>
                <div className="flex items-baseline gap-2 lg:gap-3">
                  {discountedPriceData ? (
                    <>
                      <p className="text-base sm:text-lg lg:text-2xl font-bold text-gray-900">
                        ₹{formatCurrency(finalPrice) ?? '--'}
                      </p>
                      <p className="text-xs sm:text-sm lg:text-base text-gray-400 line-through">
                        ₹{formatCurrency(price)}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-base sm:text-lg lg:text-2xl font-bold text-gray-900">
                        ₹{formatCurrency(price) ?? '--'}
                      </p>
                      {comparePrice && comparePrice > price && (
                        <p className="text-xs sm:text-sm lg:text-base text-gray-400 line-through">
                          ₹{formatCurrency(comparePrice)}
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 lg:gap-3 flex-1 justify-end">
                {isInCart ? (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={onRemoveFromCart}
                    disabled={isOutOfStock || removeFromCartPending}
                    className="flex-1 sm:flex-initial text-xs sm:text-sm lg:text-base px-3 sm:px-4 lg:px-6 py-2 lg:py-2.5 rounded-full"
                  >
                    {removeFromCartPending ? 'Removing...' : 'Remove'}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={onAddToCart}
                    disabled={isOutOfStock || addToCartPending}
                    className="flex-1 sm:flex-initial text-xs sm:text-sm lg:text-base "
                  >
                    {addToCartPending ? 'Adding...' : 'Add to Cart'}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="blue"
                  onClick={onBuyNow}
                  disabled={isOutOfStock || addToCartPending || removeFromCartPending}
                  className="flex-1 sm:flex-initial text-xs sm:text-sm lg:text-base px-3 sm:px-4 lg:px-6 py-2 lg:py-2.5 rounded-full"
                >
                  Buy Now
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

interface DetailRowProps {
  label: string
  value: React.ReactNode
}

const DetailRow: React.FC<DetailRowProps> = ({ label, value }) => (
  <div className="flex items-center justify-between border-b border-gray-100 pb-2 sm:pb-3 last:border-none last:pb-0">
    <p className="text-[10px] sm:text-xs uppercase tracking-wide text-gray-500">{label}</p>
    <p className="text-xs sm:text-sm font-medium text-gray-800 text-right">{value}</p>
  </div>
)

interface DetailBulletProps {
  icon: React.ReactNode
  title: string
  description: string
}

const DetailBullet: React.FC<DetailBulletProps> = ({ icon, title, description }) => (
  <li className="flex items-start gap-2 sm:gap-3">
    <div className="mt-0.5 sm:mt-1 flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg sm:rounded-xl bg-gray-100 text-gray-700 shrink-0">
      {icon}
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-xs sm:text-sm font-semibold text-gray-800">{title}</p>
      <p className="text-xs sm:text-sm text-gray-500">{description}</p>
    </div>
  </li>
)

interface FeatureBadgeProps {
  icon: React.ReactNode
  text: string
  variant?: 'emerald' | 'blue' | 'purple' | 'amber' | 'indigo' | 'green'
}

const FeatureBadge: React.FC<FeatureBadgeProps> = ({ icon, text, variant = 'gray' }) => {
  const variantStyles: Record<
    'emerald' | 'blue' | 'purple' | 'amber' | 'indigo' | 'green' | 'gray',
    {
      bg: string
      border: string
      text: string
      icon: string
      hover: string
    }
  > = {
    emerald: {
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      text: 'text-emerald-700',
      icon: 'text-emerald-600',
      hover: 'hover:border-emerald-300',
    },
    blue: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      text: 'text-blue-700',
      icon: 'text-blue-600',
      hover: 'hover:border-blue-300',
    },
    purple: {
      bg: 'bg-purple-50',
      border: 'border-purple-200',
      text: 'text-purple-700',
      icon: 'text-purple-600',
      hover: 'hover:border-purple-300',
    },
    amber: {
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      text: 'text-amber-700',
      icon: 'text-amber-600',
      hover: 'hover:border-amber-300',
    },
    indigo: {
      bg: 'bg-indigo-50',
      border: 'border-indigo-200',
      text: 'text-indigo-700',
      icon: 'text-indigo-600',
      hover: 'hover:border-indigo-300',
    },
    green: {
      bg: 'bg-green-50',
      border: 'border-green-200',
      text: 'text-green-700',
      icon: 'text-green-600',
      hover: 'hover:border-green-300',
    },
    gray: {
      bg: 'bg-white',
      border: 'border-gray-200',
      text: 'text-gray-800',
      icon: 'text-gray-600',
      hover: 'hover:border-gray-300',
    },
  }

  const validVariant = variant || 'gray'
  const styles = variantStyles[validVariant as keyof typeof variantStyles] || variantStyles.gray

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-md border text-sm font-medium whitespace-nowrap shrink-0 hover:shadow-sm transition-all',
        styles.bg,
        styles.border,
        styles.text,
        styles.hover,
      )}
    >
      <div className={cn('shrink-0', styles.icon)}>{icon}</div>
      <span>{text}</span>
    </div>
  )
}

export default ProductSummarySidebar
