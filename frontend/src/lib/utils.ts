import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats warranty days into a human-readable string (months or years)
 * @param warrantyDays - Number of warranty days
 * @returns Formatted string like "6 Months Warranty" or "1 Year Warranty"
 */
export function formatWarranty(warrantyDays: number | undefined): string {
  if (!warrantyDays || warrantyDays <= 0) {
    return 'Warranty'
  }

  // If 1 year or more, display in years
  if (warrantyDays >= 365) {
    const years = Math.round(warrantyDays / 365)
    return `${years} ${years === 1 ? 'Year' : 'Years'} Warranty`
  }

  // If less than 1 year, display in months
  const months = Math.round(warrantyDays / 30)
  return `${months} ${months === 1 ? 'Month' : 'Months'} Warranty`
}

/**
 * Formats warranty days into a short description string
 * @param warrantyDays - Number of warranty days
 * @returns Formatted string like "6-month" or "1-year"
 */
export function formatWarrantyShort(warrantyDays: number | undefined): string {
  if (!warrantyDays || warrantyDays <= 0) {
    return 'warranty'
  }

  // If 1 year or more, display in years
  if (warrantyDays >= 365) {
    const years = Math.round(warrantyDays / 365)
    return `${years}-${years === 1 ? 'year' : 'years'}`
  }

  // If less than 1 year, display in months
  const months = Math.round(warrantyDays / 30)
  return `${months}-${months === 1 ? 'month' : 'months'}`
}

/**
 * Calculate effective price based on pricing logic
 * - If comparePrice exists: effectivePrice = price (selling price, what customer actually pays)
 * - If comparePrice doesn't exist and discount exists: effectivePrice = price - (price * discountPercent / 100)
 * - Otherwise: effectivePrice = price
 */
export function calculateEffectivePrice(
  price: number = 0,
  comparePrice: number = 0,
  discountPercent: number = 0,
): number {
  if (comparePrice > 0) {
    // Case 1: Compare price exists - effective price is the selling price (price)
    return price
  } else if (discountPercent > 0) {
    // Case 2: No compare price, but discount exists - discount applies to price
    return Math.max(0, price - (price * discountPercent) / 100)
  } else {
    // Case 3: No compare price, no discount
    return price
  }
}
