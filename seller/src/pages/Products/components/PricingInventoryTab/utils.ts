import type { VariantType } from './types'

export const ALLOWED_GST_RATES = [0, 5, 12, 18, 28]

export interface PricingCalculationResult {
  exclusivePrice: number
  effectivePrice: number
  profit: number
  margin: number
}

/**
 * Calculate pricing metrics for a product or variant
 */
export function calculatePricing(
  price: number,
  costPrice: number,
  comparePrice: number,
  discountPercent: number,
  isGstApplicable: boolean,
  totalGstRate?: number,
): PricingCalculationResult {
  let exclusivePrice: number
  let profit: number

  if (comparePrice > 0) {
    // Case 1: Compare price exists - exclusive price is the MRP (price)
    exclusivePrice = price
    profit = price - costPrice
  } else if (discountPercent > 0) {
    // Case 2: No compare price, but discount exists
    exclusivePrice = price > 0 ? Math.max(0, price - (price * discountPercent) / 100) : price
    profit = exclusivePrice - costPrice
  } else {
    // Case 3: No compare price, no discount
    exclusivePrice = price
    profit = price - costPrice
  }

  // Calculate effective price (exclusive price + GST if applicable)
  // IMPORTANT: Only use IGST rate, NOT CGST + SGST
  // For inter-state: use IGST only
  // For intra-state: CGST + SGST = IGST, so still use IGST only
  let effectivePrice = exclusivePrice
  if (
    isGstApplicable &&
    totalGstRate !== undefined &&
    totalGstRate !== null &&
    exclusivePrice > 0
  ) {
    // totalGstRate should be IGST only (not CGST + SGST combined)
    effectivePrice = exclusivePrice * (1 + totalGstRate / 100)
  }

  const margin = effectivePrice > 0 ? (profit / effectivePrice) * 100 : 0

  return {
    exclusivePrice,
    effectivePrice,
    profit,
    margin,
  }
}

/**
 * Calculate discount percentage from price and compare price
 */
export function calculateDiscountPercent(price: number, comparePrice: number): number {
  if (comparePrice > 0 && price > 0 && comparePrice > price) {
    const calculatedDiscount = ((comparePrice - price) / comparePrice) * 100
    return Math.round(calculatedDiscount * 100) / 100
  }
  return 0
}

/**
 * Auto-calculate discount for variant when price or comparePrice changes
 */
export function calculateVariantDiscount(
  variant: VariantType,
  field: 'price' | 'comparePrice',
  value: number,
): number {
  const comparePrice = field === 'comparePrice' ? value : variant.comparePrice || 0
  const price = field === 'price' ? value : variant.price || 0

  if (comparePrice > 0 && price > 0 && comparePrice > price) {
    return calculateDiscountPercent(price, comparePrice)
  } else if (comparePrice === 0 || (comparePrice > 0 && comparePrice <= price)) {
    return 0
  }

  return variant.discountPercent || 0
}

/**
 * Get warehouse ID from pickup address
 */
export function getWarehouseId(
  addr: {
    _id?: string
    courierCartPickupAddressId?: string
    warehouseName?: string
    postalCode?: string
    addressLine1?: string
  },
  index?: number,
): string {
  if (addr._id) {
    return String(addr._id)
  }
  if (addr.courierCartPickupAddressId) {
    return String(addr.courierCartPickupAddressId)
  }
  if (index !== undefined) {
    return `warehouse-${index}-${addr.warehouseName || 'wh'}-${addr.postalCode || '000000'}`
  }
  return `${addr.warehouseName || 'wh'}-${addr.postalCode || '000000'}-${addr.addressLine1 || ''}`
}

/**
 * Find pickup address by warehouse ID
 */
export function findPickupAddressById<
  T extends {
    _id?: string
    courierCartPickupAddressId?: string
    warehouseName?: string
    postalCode?: string
    addressLine1?: string
    city?: string
    state?: string
  },
>(
  warehouseId: string,
  pickupAddresses: T[],
  getWarehouseIdFn: typeof getWarehouseId,
): T | undefined {
  // Return undefined if warehouseId is not provided or invalid
  if (!warehouseId || typeof warehouseId !== 'string') {
    return undefined
  }

  return pickupAddresses.find((addr, index) => {
    if (addr._id && String(addr._id) === warehouseId) return true
    if (addr.courierCartPickupAddressId && String(addr.courierCartPickupAddressId) === warehouseId)
      return true
    if (warehouseId.startsWith('warehouse-')) {
      const expectedId = getWarehouseIdFn(addr, index)
      return expectedId === warehouseId
    }
    return (
      `${addr.warehouseName || 'wh'}-${addr.postalCode || '000000'}-${addr.addressLine1 || ''}` ===
      warehouseId
    )
  })
}
