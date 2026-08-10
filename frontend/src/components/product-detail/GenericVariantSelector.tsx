import React, { useMemo } from 'react'

import { cn } from '@/lib/utils'

import { ProductVariant } from './utils'

interface VariantOption {
  value: string
  variant: ProductVariant | null
  stock: number
  price: number | undefined
}

interface GenericVariantSelectorProps {
  variants: ProductVariant[]
  attributeKey: string
  selectedValue: string | null
  onSelect: (value: string) => void
  selectedAttributes: Record<string, string> // All currently selected attributes
}

const GenericVariantSelector: React.FC<GenericVariantSelectorProps> = ({
  variants,
  attributeKey,
  selectedValue,
  onSelect,
  selectedAttributes,
}) => {
  // Get all unique values for this attribute
  const allValues = useMemo(() => {
    const values = new Set<string>()
    variants.forEach((variant) => {
      const value = variant.attributes?.[attributeKey]
      if (value) values.add(value)
    })
    return Array.from(values)
  }, [variants, attributeKey])

  // Get options with availability based on other selected attributes
  const options = useMemo<VariantOption[]>(() => {
    return allValues.map((value) => {
      // Find variant matching all selected attributes plus this value
      const matchingVariant = variants.find((v) => {
        // Must match this attribute's value
        const matchesAttribute = v.attributes?.[attributeKey] === value
        // Must match all other selected attributes
        const matchesOtherAttributes = Object.entries(selectedAttributes).every(([key, val]) => {
          if (key === attributeKey) return true // Skip current attribute
          return v.attributes?.[key] === val
        })
        return matchesAttribute && matchesOtherAttributes
      })

      return {
        value,
        variant: matchingVariant || null,
        stock: matchingVariant?.stock ?? 0,
        price: matchingVariant?.price,
      }
    })
  }, [variants, allValues, attributeKey, selectedAttributes])

  // Don't render if no values available
  if (options.length === 0) return null

  return (
    <div className="space-y-3">
      {/* Header: Attribute label */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-gray-600 capitalize">{attributeKey}:</span>
        <span className="font-semibold text-gray-900">{selectedValue || '—'}</span>
      </div>

      {/* Options */}
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const isActive = selectedValue === option.value
          const isOutOfStock = option.stock === 0

          return (
            <button
              key={option.value}
              onClick={() => !isOutOfStock && onSelect(option.value)}
              disabled={isOutOfStock}
              className={cn(
                'relative px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all duration-200',
                isActive
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : isOutOfStock
                    ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 cursor-pointer',
              )}
              aria-label={`Select ${attributeKey} ${option.value}`}
            >
              {option.value}
              {/* Out of stock indicator */}
              {isOutOfStock && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-gray-300 rounded-full flex items-center justify-center">
                  <svg
                    className="w-2 h-2 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </span>
              )}
              {/* Active checkmark */}
              {isActive && !isOutOfStock && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center shadow-sm">
                  <svg
                    className="w-2.5 h-2.5 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default GenericVariantSelector

