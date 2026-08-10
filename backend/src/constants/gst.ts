/**
 * GST Constants
 *
 * Allowed GST rates in India (as percentages)
 */
export const ALLOWED_GST_RATES = [0, 5, 12, 18, 28] as const

export type GstRate = (typeof ALLOWED_GST_RATES)[number]

/**
 * Valid HSN/SAC code lengths
 */
export const VALID_HSN_SAC_LENGTHS = [4, 6, 8] as const

export type HsnSacLength = (typeof VALID_HSN_SAC_LENGTHS)[number]

/**
 * Validate HSN/SAC code format
 * - Must be numeric-only
 * - Length must be 4, 6, or 8
 */
export function validateHsnSacCode(code: string): boolean {
  if (!code || typeof code !== 'string') {
    return false
  }

  // Must be numeric-only
  if (!/^\d+$/.test(code)) {
    return false
  }

  // Length must be 4, 6, or 8
  const length = code.length
  return VALID_HSN_SAC_LENGTHS.includes(length as HsnSacLength)
}

/**
 * Validate GST rate
 */
export function validateGstRate(rate: number): boolean {
  return ALLOWED_GST_RATES.includes(rate as GstRate)
}

