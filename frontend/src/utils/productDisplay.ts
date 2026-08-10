import { Product } from '@/api/products'
import { NormalizedVariant, normalizeVariantRecord, RawVariant } from '@/utils/productVariants'

type VariantLike = NormalizedVariant & {
  _id?: string
  id?: string
}

const getVariants = (product: Product): VariantLike[] => {
  if (!Array.isArray(product.variants)) {
    return []
  }

  return (product.variants as RawVariant[]).map((variant) => normalizeVariantRecord(variant))
}

const pickDisplayVariant = (variants: VariantLike[]): VariantLike | undefined => {
  if (!variants.length) return undefined
  const defaultInStock = variants.find((variant) => variant.isDefault && (variant.stock ?? 0) > 0)
  if (defaultInStock) return defaultInStock

  const firstInStock = variants.find((variant) => (variant.stock ?? 0) > 0)
  if (firstInStock) return firstInStock

  const defaultVariant = variants.find((variant) => variant.isDefault)
  if (defaultVariant) return defaultVariant

  return variants[0]
}

const getValidPrice = (value?: number | null) => {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value
  }
  return undefined
}

export const getProductDisplayInfo = (product: Product) => {
  const variants = getVariants(product)
  const variant = pickDisplayVariant(variants)

  // Prefer effectivePrice from variant (what customer actually pays)
  const price =
    getValidPrice(variant?.effectivePrice) ??
    getValidPrice(variant?.price) ??
    getValidPrice(product.price) ??
    getValidPrice((product as unknown as { minPrice?: number }).minPrice) ??
    getValidPrice(product.comparePrice) ??
    0

  const comparePrice =
    getValidPrice(variant?.comparePrice) ??
    getValidPrice(product.comparePrice) ??
    getValidPrice((product as unknown as { maxPrice?: number }).maxPrice)

  const image =
    variant?.mainImage ||
    product.mainImage ||
    variant?.images?.find((img) => img.length > 0) ||
    product.images?.[0] ||
    '/image-placeholder.svg'

  // Align stock calculation with product detail page logic:
  // 1. Prefer active/display variant stock when available
  // 2. Fall back to product-level stock
  // 3. Finally, use totalStock as a last resort
  const stock =
    (typeof variant?.stock === 'number' ? variant.stock : undefined) ??
    (typeof product.stock === 'number' ? product.stock : undefined) ??
    (typeof product.totalStock === 'number' ? product.totalStock : undefined)

  const variantId = variant?._id ?? variant?.id

  return {
    price,
    comparePrice,
    image,
    stock,
    variantId,
    variant,
  }
}
