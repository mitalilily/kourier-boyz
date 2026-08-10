/**
 * Rounding Helper Functions
 *
 * Utilities for rounding amounts according to admin-configured rounding modes
 */

export type RoundingMode = 'ROUND_HALF_UP' | 'ROUND_HALF_DOWN' | 'ROUND_UP' | 'ROUND_DOWN'

/**
 * Round a number according to the specified rounding mode
 *
 * @param amount - The amount to round
 * @param mode - The rounding mode to use
 * @returns Rounded amount
 */
export function roundAmount(amount: number, mode: RoundingMode): number {
  if (!Number.isFinite(amount)) {
    return 0
  }

  switch (mode) {
    case 'ROUND_HALF_UP':
      // Standard mathematical rounding (round half up)
      // 1.5 → 2, 1.4 → 1, 1.6 → 2
      return Math.round(amount)

    case 'ROUND_HALF_DOWN':
      // Round half down (towards zero, banker's rounding)
      // 1.5 → 1, 1.4 → 1, 1.6 → 2
      // -1.5 → -1, -1.4 → -1, -1.6 → -2
      // For positive: Math.ceil(amount - 0.5)
      // For negative: Math.floor(amount + 0.5)
      if (amount >= 0) {
        return Math.ceil(amount - 0.5)
      } else {
        return Math.floor(amount + 0.5)
      }

    case 'ROUND_UP':
      // Always round up (ceiling)
      // 1.1 → 2, 1.9 → 2, 1.0 → 1
      return Math.ceil(amount)

    case 'ROUND_DOWN':
      // Always round down (floor)
      // 1.9 → 1, 1.1 → 1, 1.0 → 1
      return Math.floor(amount)

    default:
      // Default to round half up
      return Math.round(amount)
  }
}

/**
 * Round a GST amount according to admin settings
 * This function fetches the admin invoice settings and applies the configured GST rounding mode
 *
 * @param amount - The GST amount to round
 * @returns Promise that resolves to the rounded amount
 */
export async function roundGstAmount(amount: number): Promise<number> {
  try {
    const AdminInvoiceSettings = (await import('../models/AdminInvoiceSettings')).default
    const settings = await AdminInvoiceSettings.getSingleton()
    const roundingMode = settings.gstRoundingMode || 'ROUND_HALF_UP'
    return roundAmount(amount, roundingMode as RoundingMode)
  } catch (error) {
    console.error('Error fetching GST rounding mode, using default ROUND_HALF_UP:', error)
    return roundAmount(amount, 'ROUND_HALF_UP')
  }
}

/**
 * Round a GST amount synchronously using a provided rounding mode
 * Use this when you already have the rounding mode (e.g., from cached settings)
 *
 * @param amount - The GST amount to round
 * @param roundingMode - The rounding mode to use
 * @returns Rounded amount
 */
export function roundGstAmountSync(amount: number, roundingMode: RoundingMode = 'ROUND_HALF_UP'): number {
  return roundAmount(amount, roundingMode)
}

