import React from 'react'

import type { Product } from '@/api/products'
import SectionHeading from '@/components/product-detail/SectionHeading'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, Sparkles, Star, Zap } from 'lucide-react'

interface ProductHighlightsSectionProps {
  product: Product
}

const iconVariants = [
  { icon: CheckCircle2, color: 'text-emerald-600', bgColor: 'bg-emerald-50' },
  { icon: Sparkles, color: 'text-amber-600', bgColor: 'bg-amber-50' },
  { icon: Star, color: 'text-blue-600', bgColor: 'bg-blue-50' },
  { icon: Zap, color: 'text-purple-600', bgColor: 'bg-purple-50' },
]

const ProductHighlightsSection: React.FC<ProductHighlightsSectionProps> = ({ product }) => {
  const hasFeatures = product.features && product.features.length > 0

  // Filter out common technical keys that shouldn't be shown as features
  const excludedKeys = ['category', 'price', 'brand', 'rating', 'availability']
  const displayableFilters =
    product.filterMetadata?.filter(
      (filter) => !excludedKeys.includes(filter.key.toLowerCase()) && filter.values.length > 0,
    ) || []

  if (!hasFeatures && displayableFilters.length === 0) return null

  // Format key names for display (capitalize, replace underscores, etc.)
  const formatKeyName = (key: string): string => {
    return key
      .split(/[_\s]+/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')
  }

  return (
    <div className="rounded-2xl sm:rounded-3xl border border-gray-200 bg-white shadow-sm p-4 sm:p-6">
      <SectionHeading title="Key highlights" subtitle="What sets it apart" />
      <div className="mt-4 sm:mt-5 space-y-2.5 sm:space-y-3">
        {/* Product Features (from features array) */}
        {hasFeatures &&
          product?.features?.map((feature, index) => {
            const IconComponent = iconVariants[index % iconVariants.length].icon
            const iconColor = iconVariants[index % iconVariants.length].color
            const iconBg = iconVariants[index % iconVariants.length].bgColor

            return (
              <div
                key={`feature-${index}`}
                className="flex items-start gap-3 p-3 sm:p-3.5 rounded-lg sm:rounded-xl border border-gray-200 bg-white hover:border-gray-300 hover:shadow-md transition-all duration-300 group cursor-default"
              >
                <div
                  className={`mt-0.5 shrink-0 p-1.5 rounded-lg ${iconBg} group-hover:scale-110 transition-transform duration-300`}
                >
                  <IconComponent className={`w-4 h-4 ${iconColor}`} />
                </div>
                <p className="text-xs sm:text-sm text-gray-700 leading-relaxed flex-1 group-hover:text-gray-900 transition-colors font-medium">
                  {feature}
                </p>
              </div>
            )
          })}

        {/* Filter-based Features */}
        {displayableFilters.map((filter, index) => (
          <div
            key={`filter-${index}`}
            className="flex flex-col sm:flex-row sm:items-start gap-2.5 sm:gap-3 p-3 sm:p-3.5 rounded-lg sm:rounded-xl border border-gray-200 bg-white hover:border-gray-300 hover:shadow-md transition-all duration-300 group"
          >
            <div className="flex items-start gap-2 min-w-[120px] sm:min-w-[140px]">
              <div className="mt-0.5 shrink-0 p-1.5 rounded-lg bg-emerald-50 group-hover:scale-110 transition-transform duration-300">
                <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600" />
              </div>
              <span className="text-xs sm:text-sm font-semibold text-gray-900 pt-0.5">
                {formatKeyName(filter.key)}:
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 sm:gap-2 flex-1">
              {filter.values.map((value, valueIndex) => (
                <Badge
                  key={valueIndex}
                  variant="outline"
                  className="rounded-full px-2 sm:px-2.5 py-0.5 sm:py-1 text-[10px] sm:text-xs font-medium bg-gray-50 border-gray-300 text-gray-800 hover:bg-gray-100 hover:border-gray-400 hover:shadow-sm transition-all duration-200"
                >
                  {value}
                </Badge>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default ProductHighlightsSection
