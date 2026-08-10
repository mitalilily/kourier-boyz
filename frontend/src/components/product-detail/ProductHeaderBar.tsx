import React from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ShareButton } from '@/components/ui/ShareButton'
import { cn } from '@/lib/utils'
import { ArrowLeft, Heart, Sparkles } from 'lucide-react'

interface ProductHeaderBarProps {
  effectiveDiscount?: number
  isWishlistActive: boolean
  isWishlistMutating: boolean
  onBack: () => void
  onWishlistToggle: () => void
  productName: string
  productUrl: string
  shareSummary: string
}

const ProductHeaderBar: React.FC<ProductHeaderBarProps> = ({
  effectiveDiscount,
  isWishlistActive,
  isWishlistMutating,
  onBack,
  onWishlistToggle,
  productName,
  productUrl,
  shareSummary,
}) => (
  <div className="border-b lg:hidden border-gray-100 bg-white/80 backdrop-blur-md sticky top-0 z-20">
    <div className=" mx-auto px-3 sm:px-4 lg:px-8 py-3 sm:py-4 flex items-center justify-between gap-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={onBack}
        className="lg:hidden inline-flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-semibold text-gray-700 hover:text-gray-900 transition-colors px-2 sm:px-0"
      >
        <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        <span className="hidden xs:inline">Back</span>
      </Button>

      <div className="flex items-center gap-2 sm:gap-3 lg:gap-4">
        {effectiveDiscount ? (
          <Badge
            variant="secondary"
            className="hidden sm:flex items-center gap-1 rounded-full px-2 sm:px-3 py-0.5 sm:py-1 text-xs sm:text-sm bg-emerald-50 text-emerald-700 border-emerald-200"
          >
            <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            Save {effectiveDiscount}%
          </Badge>
        ) : null}
        <ShareButton
          url={productUrl}
          title={productName}
          description={shareSummary}
          variant="outline"
          size="icon"
          className="rounded-full border-gray-200 hover:border-gray-300 hover:bg-gray-100 h-8 w-8 sm:h-9 sm:w-9"
        />
        <button
          onClick={onWishlistToggle}
          disabled={isWishlistMutating}
          className={cn(
            'rounded-full border px-2 sm:px-3 py-1.5 sm:py-2 flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-medium transition-all',
            isWishlistActive
              ? 'border-rose-200 bg-rose-50 text-rose-600'
              : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-100',
          )}
        >
          <Heart
            className={cn(
              'w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0',
              isWishlistActive ? 'fill-rose-500 text-rose-500' : 'text-gray-500',
            )}
          />
          <span className="hidden sm:inline">{isWishlistActive ? 'Saved' : 'Wishlist'}</span>
        </button>
      </div>
    </div>
  </div>
)

export default ProductHeaderBar
