import { ProductVariant, calculateDiscount } from './utils'

interface UseProductCalculationsProps {
  product:
    | {
        price?: number
        comparePrice?: number
        discountPercent?: number
        stock?: number
        totalStock?: number
        status?: string
        minOrderQuantity?: number
        maxOrderQuantity?: number
        lowStockThreshold?: number
      }
    | null
    | undefined
  activeVariant: ProductVariant | null
}

export const useProductCalculations = ({ product, activeVariant }: UseProductCalculationsProps) => {
  // Prefer effectivePrice from variant (what customer actually pays), fallback to price
  const price = activeVariant?.effectivePrice ?? activeVariant?.price ?? product?.price ?? 0
  const comparePrice =
    activeVariant?.comparePrice ??
    (product?.comparePrice && product.comparePrice > 0 ? product.comparePrice : undefined)

  const effectiveDiscount = calculateDiscount(
    price,
    comparePrice,
    activeVariant?.discountPercent ?? product?.discountPercent,
  )

  const availableStock = activeVariant?.stock ?? product?.stock ?? product?.totalStock ?? 0

  const isOutOfStock =
    product?.status === 'out_of_stock' ||
    availableStock <= 0 ||
    (activeVariant?.stock !== undefined && activeVariant.stock <= 0)

  const isLowStock =
    availableStock > 0 &&
    availableStock <= (product?.lowStockThreshold ?? activeVariant?.stock ?? 5)

  const minOrderQuantity = Math.max(product?.minOrderQuantity ?? 1, 1)
  const maxOrderQuantity = Math.min(
    availableStock || 1,
    product?.maxOrderQuantity ?? Math.min(availableStock || 1, 10),
  )

  return {
    price,
    comparePrice,
    effectiveDiscount,
    availableStock,
    isOutOfStock,
    isLowStock,
    minOrderQuantity,
    maxOrderQuantity,
  }
}
