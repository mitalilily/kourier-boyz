import mongoose from 'mongoose'
import Product from '../../models/Product'
import ProductVariant from '../../models/ProductVariant'

export const generateSlug = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')

export const normalizeFilterMetadata = (
  input: unknown,
): Array<{ key: string; values: string[] }> | undefined => {
  if (input === undefined || input === null || input === '') {
    return undefined
  }

  let raw = input
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw)
    } catch (error) {
      console.warn('Failed to parse filterMetadata payload:', error)
      return undefined
    }
  }

  if (!Array.isArray(raw)) return undefined

  const normalized = raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null

      const key =
        typeof (item as { key?: unknown }).key === 'string'
          ? ((item as { key?: string }).key ?? '').trim()
          : ''

      let values: unknown = (item as { values?: unknown }).values
      if (!values) {
        values = (item as { value?: unknown }).value
      }

      if (typeof values === 'string') {
        values = [values]
      }

      if (!Array.isArray(values)) return null

      const cleanedValues = (values as unknown[])
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter((value) => value.length > 0)

      if (!key || cleanedValues.length === 0) return null
      return { key, values: cleanedValues }
    })
    .filter((item): item is { key: string; values: string[] } => item !== null)

  return normalized
}

export const generateUniqueVariantSku = async (
  sellerId: string,
  baseSku: string,
  productId?: string,
): Promise<string> => {
  let sku = baseSku
  let suffix = 1

  // Check both Product and ProductVariant collections for uniqueness
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const [existingProduct, existingVariant] = await Promise.all([
      Product.findOne({ seller: sellerId, sku }),
      ProductVariant.findOne({
        seller: sellerId,
        sku,
        ...(productId ? { product: new mongoose.Types.ObjectId(productId) } : {}),
      }),
    ])

    if (!existingProduct && !existingVariant) {
      break
    }

    sku = `${baseSku}-${suffix++}`
  }

  return sku
}

/**
 * Calculate effective price and profit based on pricing logic
 * - If comparePrice exists:
 *   - effectivePrice = price (selling price, what customer actually pays)
 *   - profit = price - costPrice (profit based on selling price)
 * - If comparePrice doesn't exist and discount exists:
 *   - effectivePrice = price - (price * discountPercent / 100) (what customer pays)
 *   - profit = effectivePrice - costPrice (profit based on effective price)
 * - If comparePrice doesn't exist and discount doesn't exist:
 *   - effectivePrice = price
 *   - profit = price - costPrice
 */
export const calculateEffectivePriceAndProfit = (
  price: number = 0,
  comparePrice: number = 0,
  costPrice: number = 0,
  discountPercent: number = 0,
): { effectivePrice: number; profit: number } => {
  let effectivePrice: number
  let profit: number

  if (comparePrice > 0) {
    // Case 1: Compare price exists
    // Effective price is the selling price (price), not the discounted compare price
    effectivePrice = price
    // Profit is based on selling price (price)
    profit = price - costPrice
  } else if (discountPercent > 0) {
    // Case 2: No compare price, but discount exists
    // Effective price is price with discount applied
    effectivePrice = price > 0 ? Math.max(0, price - (price * discountPercent) / 100) : price
    // Profit is based on effective price (what customer actually pays)
    profit = effectivePrice - costPrice
  } else {
    // Case 3: No compare price, no discount
    effectivePrice = price
    profit = price - costPrice
  }

  return {
    effectivePrice: Math.round(effectivePrice * 100) / 100, // Round to 2 decimal places
    profit: Math.round(profit * 100) / 100, // Round to 2 decimal places
  }
}

export const updateProductTotalStock = async (productId: string) => {
  const variants = await ProductVariant.find({ product: productId })
  // Variant stocks are already calculated from warehouseInventory in ProductVariant pre-save hook
  const totalStock = variants.reduce((sum, variant) => sum + (variant.stock || 0), 0)
  const lowStockVariants = variants.filter(
    (variant) => (variant.stock || 0) <= (variant.lowStockThreshold || 5),
  ).length

  const product = await Product.findById(productId)
  if (!product) return

  product.totalStock = totalStock
  product.lowStockVariants = lowStockVariants
  // For variant products, stock should always equal totalStock (sum of variant stocks)
  // This ensures no redundant stock storage - stock is derived from variant warehouseInventory
  product.stock = totalStock

  if (product.status !== 'draft' && !(product as any).statusLockedByAdmin) {
    product.status = totalStock > 0 ? 'active' : 'out_of_stock'
  }

  await product.save()
}
