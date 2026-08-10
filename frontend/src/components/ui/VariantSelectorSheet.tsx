import { useAddToCart } from '@/api/cart'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import type { Product } from '@/api/products'
import type { ProductVariant } from '@/components/product-detail/utils'
import { formatCurrency } from '@/utils'
import { Loader2, ShoppingCart } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

interface VariantSelectorSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: Product
  onSuccess?: () => void
}

const VariantSelectorSheet: React.FC<VariantSelectorSheetProps> = ({
  open,
  onOpenChange,
  product,
  onSuccess,
}) => {
  const [selectedVariantId, setSelectedVariantId] = useState<string | undefined>(undefined)
  const addToCartMutation = useAddToCart()

  // Normalize variants - handle both ProductVariant[] and Record<string, unknown>[]
  const variants: ProductVariant[] = product.variants
    ? (product.variants as unknown as ProductVariant[]).map((v: any) => {
        const price =
          typeof v.price === 'number'
            ? v.price
            : typeof v.sellingPrice === 'number'
            ? v.sellingPrice
            : undefined
        const effectivePrice =
          typeof v.effectivePrice === 'number'
            ? v.effectivePrice
            : typeof v.sellingPrice === 'number'
            ? v.sellingPrice
            : price
        const comparePrice =
          typeof v.comparePrice === 'number'
            ? v.comparePrice
            : typeof v.originalPrice === 'number'
            ? v.originalPrice
            : undefined
        const imageFromList =
          Array.isArray(v.images) && typeof v.images[0] === 'string' ? v.images[0] : undefined

        return {
          _id: String(v._id || v.id || ''),
          name: String(v.name || 'Variant'),
          price,
          effectivePrice,
          comparePrice,
          stock: typeof v.stock === 'number' ? v.stock : undefined,
          attributes: v.attributes && typeof v.attributes === 'object' ? v.attributes : {},
          mainImage: typeof v.mainImage === 'string' ? v.mainImage : imageFromList,
          isDefault: Boolean(v.isDefault),
        }
      })
    : []

  // Initialize with default variant or first available variant when sheet opens
  useEffect(() => {
    if (open && variants.length > 0 && !selectedVariantId) {
      const defaultVariant = variants.find((v) => v.isDefault && (v.stock || 0) > 0)
      const firstInStock = variants.find((v) => (v.stock || 0) > 0)
      const firstVariant = variants[0]
      const initialVariant = defaultVariant || firstInStock || firstVariant
      if (initialVariant) {
        setSelectedVariantId(initialVariant._id)
      }
    }
    // Reset selection when sheet closes
    if (!open) {
      setSelectedVariantId(undefined)
    }
  }, [open, variants, selectedVariantId])

  const handleVariantSelect = (e?: React.MouseEvent) => {
    e?.preventDefault()
    e?.stopPropagation()

    if (!selectedVariantId) {
      toast.error('Please select a variant')
      return
    }

    // Use minimum order quantity if specified, otherwise default to 1
    const quantityToAdd = Math.max(product.minOrderQuantity ?? 1, 1)

    addToCartMutation.mutate(
      {
        productId: product._id,
        variantId: selectedVariantId,
        quantity: quantityToAdd,
      },
      {
        onSuccess: () => {
          onOpenChange(false)
          onSuccess?.()
        },
      },
    )
  }

  const handleVariantItemClick = (e: React.MouseEvent, variantId: string, isOutOfStock: boolean) => {
    e.preventDefault()
    e.stopPropagation()

    if (!isOutOfStock) {
      setSelectedVariantId(variantId)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[66vh] bg-white max-w-md mx-auto rounded-t-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <SheetHeader className="pb-4">
          <SheetTitle>Select Variant</SheetTitle>
          <SheetDescription>Choose a variant for {product.name}</SheetDescription>
        </SheetHeader>
        <div className="space-y-3 mt-4 max-h-[calc(50vh-100px)] overflow-y-auto pb-4">
          {variants.map((variant) => {
            const isSelected = selectedVariantId === variant._id
            const isOutOfStock = (variant.stock || 0) === 0
            const variantPrice = variant.effectivePrice ?? variant.price ?? 0
            const variantComparePrice = variant.comparePrice
            const hasDiscount = variantComparePrice && variantComparePrice > variantPrice

            return (
              <button
                key={variant._id}
                onClick={(e) => handleVariantItemClick(e, variant._id, isOutOfStock)}
                disabled={isOutOfStock}
                type="button"
                className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                  isSelected ? 'border-primary bg-primary/10' : 'border-gray-200 hover:border-gray-300'
                } ${isOutOfStock ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  {/* Variant Image Preview */}
                  {variant.mainImage && (
                    <div className="shrink-0">
                      <img
                        src={variant.mainImage}
                        alt={variant.name}
                        className="w-16 h-16 object-cover rounded-lg"
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-sm text-gray-900 truncate">{variant.name}</h4>

                      {isOutOfStock && (
                        <Badge variant="outline" className="text-xs px-1.5 py-0 text-red-600">
                          Out of Stock
                        </Badge>
                      )}
                    </div>
                    {variant.attributes && Object.keys(variant.attributes).length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {Object.entries(variant.attributes).map(([key, value]) => (
                          <span
                            key={key}
                            className="text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded"
                          >
                            {String(value)}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">
                        {formatCurrency(variantPrice)}
                      </span>
                      {hasDiscount && variantComparePrice && (
                        <span className="text-xs text-gray-400 line-through">
                          {formatCurrency(variantComparePrice)}
                        </span>
                      )}
                    </div>
                  </div>
                  {isSelected && (
                    <div className="shrink-0">
                      <div className="w-5 h-5 rounded-full bg-primary border-2 border-primary flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-gray-900" />
                      </div>
                    </div>
                  )}
                </div>
              </button>
            )
          })}
        </div>
        <div className="flex gap-2 mt-4 pt-4 border-t">
          <Button
            variant="outline"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onOpenChange(false)
            }}
            className="flex-1"
            type="button"
          >
            Cancel
          </Button>
          <Button
            onClick={handleVariantSelect}
            disabled={!selectedVariantId || addToCartMutation.isPending}
            className="flex-1 bg-primary text-gray-900 hover:bg-gray-900 hover:text-white"
            type="button"
          >
            {addToCartMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <>
                <ShoppingCart className="mr-2 h-4 w-4" />
                Add to Cart
              </>
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

export default VariantSelectorSheet

