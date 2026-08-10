import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { formatCurrency, FALLBACK_IMAGE, ProductVariant } from './utils'

// Type for a color group (unique color with representative variant and aggregated stock)
interface ColorGroup {
  colorValue: string
  representativeVariant: ProductVariant
  totalStock: number
  minPrice: number
  maxPrice: number
  variantIds: string[]
}

interface ColorVariantSelectorProps {
  variants: ProductVariant[]
  activeVariant: ProductVariant | null
  productName: string
  selectedColor: string | null
  onColorSelect: (colorValue: string) => void
  onVariantHover?: (variant: ProductVariant | null) => void
}

const ITEMS_PER_PAGE = 7

const ColorVariantSelector: React.FC<ColorVariantSelectorProps> = ({
  variants,
  activeVariant,
  productName,
  selectedColor,
  onColorSelect,
  onVariantHover,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const [hoveredColor, setHoveredColor] = useState<string | null>(null)

  // Get the color attribute key
  const colorAttributeKey = useMemo(() => {
    if (!variants.length || !variants[0]?.attributes) return null
    const attrs = Object.keys(variants[0].attributes)
    const colorAttr = attrs.find((attr) =>
      ['color', 'colour', 'colors', 'colours'].includes(attr.toLowerCase()),
    )
    return colorAttr || null
  }, [variants])

  // Group variants by color - each unique color gets one entry with aggregated info
  const colorGroups = useMemo<ColorGroup[]>(() => {
    if (!colorAttributeKey) return []

    const groupMap = new Map<string, ColorGroup>()

    variants.forEach((variant) => {
      const colorValue = variant.attributes?.[colorAttributeKey]
      if (!colorValue) return

      if (!groupMap.has(colorValue)) {
        groupMap.set(colorValue, {
          colorValue,
          representativeVariant: variant,
          totalStock: variant.stock ?? 0,
          minPrice: variant.price ?? 0,
          maxPrice: variant.price ?? 0,
          variantIds: [variant._id],
        })
      } else {
        const group = groupMap.get(colorValue)!
        group.totalStock += variant.stock ?? 0
        group.variantIds.push(variant._id)
        if (variant.price !== undefined) {
          group.minPrice = Math.min(group.minPrice, variant.price)
          group.maxPrice = Math.max(group.maxPrice, variant.price)
        }
        // Update representative variant if this one has stock and current doesn't
        if ((variant.stock ?? 0) > 0 && (group.representativeVariant.stock ?? 0) === 0) {
          group.representativeVariant = variant
        }
      }
    })

    return Array.from(groupMap.values())
  }, [variants, colorAttributeKey])

  // Get the display value for the color
  const displayColorValue = useMemo(() => {
    return (
      hoveredColor ||
      selectedColor ||
      activeVariant?.attributes?.[colorAttributeKey ?? ''] ||
      null
    )
  }, [hoveredColor, selectedColor, activeVariant, colorAttributeKey])

  // Calculate total pages
  const totalPages = Math.ceil(colorGroups.length / ITEMS_PER_PAGE)

  // Get color groups for current page
  const visibleColorGroups = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
    return colorGroups.slice(startIndex, startIndex + ITEMS_PER_PAGE)
  }, [colorGroups, currentPage])

  const checkScrollability = useCallback(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const { scrollLeft, scrollWidth, clientWidth } = container
    setCanScrollLeft(scrollLeft > 0)
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1)
  }, [])

  useEffect(() => {
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
  }, [checkScrollability, visibleColorGroups])

  // Scroll to selected color's page when it changes
  useEffect(() => {
    if (!selectedColor) return
    const colorIndex = colorGroups.findIndex((g) => g.colorValue === selectedColor)
    if (colorIndex === -1) return
    const targetPage = Math.floor(colorIndex / ITEMS_PER_PAGE) + 1
    if (targetPage !== currentPage) {
      setCurrentPage(targetPage)
    }
  }, [selectedColor, colorGroups, currentPage])

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage((prev) => prev - 1)
    }
  }

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage((prev) => prev + 1)
    }
  }

  const handleColorHover = useCallback(
    (group: ColorGroup | null) => {
      if (group) {
        setHoveredColor(group.colorValue)
        onVariantHover?.(group.representativeVariant)
      } else {
        setHoveredColor(null)
        onVariantHover?.(null)
      }
    },
    [onVariantHover],
  )

  const handleColorClick = useCallback(
    (group: ColorGroup) => {
      onColorSelect(group.colorValue)
    },
    [onColorSelect],
  )

  // Don't render if no color attribute exists
  if (!colorAttributeKey || colorGroups.length === 0) return null

  return (
    <div className="space-y-3">
      {/* Header: Color label */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-gray-600 capitalize">{colorAttributeKey}:</span>
        <span className="font-semibold text-gray-900">{displayColorValue || '—'}</span>
      </div>

      {/* Color Groups Grid */}
      <div className="relative">
        {/* Scroll/Page Left Button */}
        {(canScrollLeft || currentPage > 1) && (
          <button
            onClick={totalPages > 1 ? handlePrevPage : undefined}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 z-10 bg-white rounded-full p-1.5 shadow-lg border border-gray-200 hover:bg-gray-50 transition-all"
            aria-label="Previous"
          >
            <ChevronLeft className="w-4 h-4 text-gray-700" />
          </button>
        )}

        {/* Scroll/Page Right Button */}
        {(canScrollRight || currentPage < totalPages) && (
          <button
            onClick={totalPages > 1 ? handleNextPage : undefined}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-3 z-10 bg-white rounded-full p-1.5 shadow-lg border border-gray-200 hover:bg-gray-50 transition-all"
            aria-label="Next"
          >
            <ChevronRight className="w-4 h-4 text-gray-700" />
          </button>
        )}

        {/* Color Groups Container */}
        <div
          ref={scrollContainerRef}
          className="overflow-x-auto scrollbar-hide"
          onScroll={checkScrollability}
        >
          <div className="flex gap-2 pb-1">
            {visibleColorGroups.map((group) => {
              const isActive = selectedColor === group.colorValue
              const isHovered = hoveredColor === group.colorValue
              const isOutOfStock = group.totalStock === 0;
              const variantImage =
                group.representativeVariant.mainImage ||
                group.representativeVariant.images?.[0] ||
                FALLBACK_IMAGE

              return (
                <button
                  key={group.colorValue}
                  onClick={() => handleColorClick(group)}
                  onMouseEnter={() => handleColorHover(group)}
                  onMouseLeave={() => handleColorHover(null)}
                  className={cn(
                    'relative flex flex-col items-center p-1.5 rounded-lg border-2 transition-all duration-200 min-w-[85px] max-w-[95px] cursor-pointer group',
                    isActive
                      ? 'border-blue-600 bg-blue-50/30'
                      : isHovered
                        ? 'border-gray-400 bg-gray-50'
                        : isOutOfStock
                          ? 'border-gray-200 bg-gray-50/50 opacity-60'
                          : 'border-gray-200 bg-white hover:border-gray-300',
                  )}
                  aria-label={`Select ${group.colorValue}`}
                  disabled={isOutOfStock}
                >
                  {/* Color Image */}
                  <div
                    className={cn(
                      'relative w-full aspect-square rounded-md overflow-hidden bg-gray-100 mb-1.5',
                      isOutOfStock && 'grayscale',
                    )}
                  >
                    <img
                      src={variantImage}
                      alt={group.colorValue || productName}
                      className="w-full h-full object-contain"
                      loading="lazy"
                    />
                    {/* Out of stock overlay */}
                    {isOutOfStock && (
                      <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
                        <span className="text-[8px] font-medium text-gray-500 bg-white/90 px-1 py-0.5 rounded">
                          Out of stock
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Price */}
                  <div className="w-full text-center space-y-0.5">
                    <div className="flex items-center justify-center gap-1">
                      <span
                        className={cn(
                          'text-xs font-semibold',
                          isOutOfStock ? 'text-gray-400' : 'text-gray-900',
                        )}
                      >
                        ₹{formatCurrency(group.minPrice)}
                      </span>
                    </div>
                  </div>

                  {/* Active indicator checkmark */}
                  {isActive && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center shadow-sm">
                      <svg
                        className="w-2.5 h-2.5 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </button>
              )
            })}

            {/* "See X more options" button when there are more color groups */}
            {totalPages > 1 && currentPage === 1 && colorGroups.length > ITEMS_PER_PAGE && (
              <button
                onClick={handleNextPage}
                className="flex flex-col items-center justify-center p-2 rounded-lg border-2 border-gray-200 bg-white hover:border-gray-300 transition-all duration-200 min-w-[85px] max-w-[95px] cursor-pointer"
              >
                <span className="text-xs text-blue-600 font-medium text-center leading-tight">
                  See {colorGroups.length - ITEMS_PER_PAGE}
                  <br />
                  more options
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Pagination Dots */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-1">
          <button
            onClick={handlePrevPage}
            disabled={currentPage === 1}
            className={cn(
              'px-3 py-1 text-xs font-medium rounded transition-colors',
              currentPage === 1
                ? 'text-gray-300 cursor-not-allowed'
                : 'text-gray-600 hover:text-gray-900',
            )}
          >
            ‹ Previous
          </button>

          <div className="flex items-center gap-1.5">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={cn(
                  'w-7 h-7 rounded-md text-xs font-medium transition-all',
                  currentPage === page
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                )}
              >
                {page}
              </button>
            ))}
          </div>

          <button
            onClick={handleNextPage}
            disabled={currentPage === totalPages}
            className={cn(
              'px-3 py-1 text-xs font-medium rounded transition-colors',
              currentPage === totalPages
                ? 'text-gray-300 cursor-not-allowed'
                : 'text-gray-600 hover:text-gray-900',
            )}
          >
            Next ›
          </button>
        </div>
      )}
    </div>
  )
}

export default ColorVariantSelector
