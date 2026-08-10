import { IProduct } from '../models/Product'
import { IUser } from '../models/User'

interface ShippingCalculationInput {
  product: IProduct | any
  seller: IUser | any
}

/**
 * Calculate shipping charge for an order item
 *
 * IMPORTANT: Shipping is charged ONCE per order/item, NOT per quantity.
 * Example: Product price ₹500, Shipping ₹80
 *   - Qty 1 → Shipping = ₹80
 *   - Qty 2 → Shipping = ₹80 (NOT ₹160)
 *
 * Flow/Priority:
 * 1. If product has freeShipping = true → ₹0
 * 2. If product has shippingCharge set (and > 0) → use product shippingCharge (regardless of requiresShipping)
 * 3. If product requiresShipping = false → ₹0
 * 4. Otherwise → use seller's defaultShippingRate (if seller has set it)
 */
export const calculateShippingCharge = ({ product, seller }: ShippingCalculationInput): number => {
  // Step 1: Check if product has free shipping enabled
  if (product?.freeShipping === true) {
    return 0
  }

  // Step 2: Use product-level shipping charge if explicitly set and > 0
  // If product has a specific shippingCharge, use it (overrides requiresShipping check)
  // This allows sellers to set shipping charges even for products that don't "require shipping"
  if (
    product?.shippingCharge !== undefined &&
    product.shippingCharge !== null &&
    product.shippingCharge > 0
  ) {
    return product.shippingCharge
  }

  // Step 3: Check if product doesn't require shipping
  // Only return 0 if no shippingCharge was set above
  if (product?.requiresShipping === false) {
    return 0
  }

  // Step 4: Fall back to seller's default shipping rate
  // If product doesn't have free shipping and no product-level charge is set,
  // use the seller's default shipping rate (if they have set one)
  const defaultShippingRate = seller?.defaultShippingRate || 0
  return defaultShippingRate
}

/**
 * Calculate total shipping for multiple items from the same seller
 * Currently returns the highest shipping charge (not summing)
 * This can be modified to sum or use other logic
 */
export const calculateTotalShippingForSeller = (
  items: Array<{ product: IProduct | any; subtotal: number }>,
  seller: IUser | any,
): number => {
  if (!items || items.length === 0) {
    return 0
  }

  const orderSubtotal = items.reduce((sum, item) => sum + item.subtotal, 0)

  // If any item has free shipping, check if we should apply it
  const hasFreeShippingItem = items.some((item) => item.product?.freeShipping === true)
  if (hasFreeShippingItem) {
    // If all items have free shipping, return 0
    if (items.every((item) => item.product?.freeShipping === true)) {
      return 0
    }
    // Otherwise, calculate for non-free-shipping items
    const nonFreeShippingItems = items.filter((item) => item.product?.freeShipping !== true)
    if (nonFreeShippingItems.length > 0) {
      const nonFreeShippingSubtotal = nonFreeShippingItems.reduce(
        (sum, item) => sum + item.subtotal,
        0,
      )
      // Use the highest shipping charge among non-free-shipping items
      const shippingCharges = nonFreeShippingItems.map((item) =>
        calculateShippingCharge({
          product: item.product,
          seller,
        }),
      )
      return Math.max(...shippingCharges, 0)
    }
  }

  // Calculate shipping for each item and return the highest
  // (Alternative: could sum them or use other logic)
  const shippingCharges = items.map((item) =>
    calculateShippingCharge({
      product: item.product,
      seller,
    }),
  )

  // Return the highest shipping charge
  // This assumes items are shipped together, so we charge the highest rate
  return Math.max(...shippingCharges, 0)
}
