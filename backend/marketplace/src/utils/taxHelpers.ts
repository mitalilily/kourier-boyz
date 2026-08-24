/**
 * Tax Helper Functions
 *
 * Utilities for determining tax types (IGST vs CGST+SGST) and GST calculations
 */

/**
 * Indian State/UT Name to GST State Code Mapping
 * Source: GST State Codes as per GST Council
 */
export const STATE_NAME_TO_CODE_MAP: Record<string, string> = {
  // States
  'andhra pradesh': '37',
  'arunachal pradesh': '12',
  assam: '18',
  bihar: '10',
  chhattisgarh: '22',
  goa: '30',
  gujarat: '24',
  haryana: '06',
  'himachal pradesh': '02',
  jharkhand: '20',
  karnataka: '29',
  kerala: '32',
  'madhya pradesh': '23',
  maharashtra: '27',
  manipur: '14',
  meghalaya: '17',
  mizoram: '15',
  nagaland: '13',
  odisha: '21',
  orissa: '21', // alias
  punjab: '03',
  rajasthan: '08',
  sikkim: '11',
  'tamil nadu': '33',
  telangana: '36',
  tripura: '16',
  'uttar pradesh': '09',
  uttarakhand: '05',
  uttaranchal: '05', // alias
  'west bengal': '19',
  // Union Territories
  'andaman and nicobar islands': '35',
  chandigarh: '04',
  // merged UT: both old names map to same code
  'dadra and nagar haveli': '26',
  'daman and diu': '26',
  'dadra and nagar haveli and daman and diu': '26',
  delhi: '07',
  'jammu and kashmir': '01',
  ladakh: '38',
  lakshadweep: '31',
  puducherry: '34',
}

/**
 * Normalization helpers for tricky user inputs
 */
const NORMALIZATION_ALIASES: Record<string, string> = {
  // State abbreviations & alternate spellings
  up: 'uttar pradesh',
  'u.p.': 'uttar pradesh',
  'uttar-pradesh': 'uttar pradesh',
  mp: 'madhya pradesh',
  'm.p.': 'madhya pradesh',
  mh: 'maharashtra',
  maha: 'maharashtra',
  tn: 'tamil nadu',
  tamilnadu: 'tamil nadu',
  wb: 'west bengal',
  'w.b.': 'west bengal',
  dl: 'delhi',
  'new delhi': 'delhi',
  jk: 'jammu and kashmir',
  'j&k': 'jammu and kashmir',
  pondicherry: 'puducherry', // old name
  // UT old names
  'andaman nicobar': 'andaman and nicobar islands',
  'a&n islands': 'andaman and nicobar islands',
  'dadra nagar haveli': 'dadra and nagar haveli',
  'daman diu': 'daman and diu',
}

/**
 * Extract state code from GSTIN
 * GSTIN format: 22AAAAA0000A1Z5
 * First 2 digits are the state code
 */
export function extractStateCodeFromGstin(gstin: string | null | undefined): string | null {
  if (!gstin || typeof gstin !== 'string') {
    return null
  }

  // GSTIN should be 15 characters, first 2 are state code
  if (gstin.length >= 2) {
    const stateCode = gstin.substring(0, 2)
    // Validate it's numeric
    if (/^\d{2}$/.test(stateCode)) {
      return stateCode
    }
  }

  return null
}

/**
 * Determine tax type for an order item based on seller GST state and shipping destination
 *
 * Business rule:
 * - If Seller GST state == Shipping destination state → INTRA-STATE → CGST + SGST
 * - Else → INTER-STATE → IGST
 *
 * @param params - Parameters for tax type determination
 * @returns 'IGST' for inter-state, 'CGST_SGST' for intra-state
 */
export function determineTaxTypeForOrderItem(params: {
  sellerGstStateCode: string | null
  shippingStateCode: string | null
}): 'IGST' | 'CGST_SGST' {
  const { sellerGstStateCode, shippingStateCode } = params

  // If either is missing, default to IGST (safer for inter-state transactions)
  if (!sellerGstStateCode || !shippingStateCode) {
    // Log warning in production
    if (process.env.NODE_ENV === 'production') {
      console.warn('Tax type determination: Missing state codes, defaulting to IGST', {
        sellerGstStateCode,
        shippingStateCode,
      })
    }
    return 'IGST'
  }

  // Normalize state codes (ensure they're strings and match)
  const sellerState = String(sellerGstStateCode).trim()
  const shippingState = String(shippingStateCode).trim()

  // If states match, it's intra-state (CGST + SGST)
  // Otherwise, it's inter-state (IGST)
  return sellerState === shippingState ? 'CGST_SGST' : 'IGST'
}

/**
 * Calculate GST amount for a given taxable amount and rate
 * This is the main function - it accepts an optional rounding mode
 * If rounding mode is not provided, defaults to ROUND_HALF_UP for backward compatibility
 *
 * @param taxableAmount - The amount on which GST is calculated
 * @param gstRatePercent - GST rate as percentage (e.g., 18 for 18%)
 * @param roundingMode - Optional rounding mode (defaults to ROUND_HALF_UP if not provided)
 * @returns GST amount (rounded according to rounding mode)
 */
export function calculateGstAmount(
  taxableAmount: number,
  gstRatePercent: number,
  roundingMode?: 'ROUND_HALF_UP' | 'ROUND_HALF_DOWN' | 'ROUND_UP' | 'ROUND_DOWN',
): number {
  if (taxableAmount <= 0 || gstRatePercent < 0) {
    return 0
  }

  const gstAmount = (taxableAmount * gstRatePercent) / 100

  // If rounding mode is provided, use it; otherwise default to ROUND_HALF_UP
  const mode = roundingMode || 'ROUND_HALF_UP'
  const { roundGstAmountSync } = require('./roundingHelpers')
  return roundGstAmountSync(gstAmount, mode)
}

/**
 * Calculate CGST and SGST amounts (split of GST for intra-state transactions)
 *
 * @param taxableAmount - The amount on which GST is calculated
 * @param gstRatePercent - GST rate as percentage (e.g., 18 for 18%)
 * @param roundingMode - Optional rounding mode (defaults to ROUND_HALF_UP if not provided)
 * @returns Object with cgst and sgst amounts (each is half of total GST, rounded)
 */
export function calculateCgstSgstAmounts(
  taxableAmount: number,
  gstRatePercent: number,
  roundingMode?: 'ROUND_HALF_UP' | 'ROUND_HALF_DOWN' | 'ROUND_UP' | 'ROUND_DOWN',
): { cgst: number; sgst: number } {
  const mode = roundingMode || 'ROUND_HALF_UP'
  const totalGst = calculateGstAmount(taxableAmount, gstRatePercent, mode)
  // CGST and SGST are each half of the total GST
  // Round each half separately to maintain precision
  const { roundGstAmountSync } = require('./roundingHelpers')
  const halfGst = totalGst / 2
  const cgst = roundGstAmountSync(halfGst, mode)
  const sgst = roundGstAmountSync(halfGst, mode)
  return { cgst, sgst }
}

/**
 * Get GST state code from input string
 *
 * Handles various input formats:
 * - State names (e.g., "Maharashtra", "Tamil Nadu")
 * - Abbreviations (e.g., "MH", "TN")
 * - Already state codes (e.g., "27", "33")
 * - Aliases (e.g., "Orissa" -> "Odisha", "Pondicherry" -> "Puducherry")
 *
 * @param input - State name, abbreviation, or code
 * @returns State code (2-digit string) or null if not found
 */
export function getGstStateCode(input: string | null | undefined): string | null {
  if (!input) return null

  // Step 1: normalize case + trim + remove special characters
  let cleaned = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ') // remove punctuation
    .replace(/\s+/g, ' ') // collapse spaces
    .trim()

  // Step 2: check if already a 2-digit code
  if (/^\d{2}$/.test(cleaned)) {
    return cleaned
  }

  // Step 3: check alias mapping
  if (NORMALIZATION_ALIASES[cleaned]) {
    cleaned = NORMALIZATION_ALIASES[cleaned]
  }

  // Step 4: final lookup
  return STATE_NAME_TO_CODE_MAP[cleaned] || null
}

/**
 * Get state code from order shipping address
 *
 * Converts state name to GST state code using the mapping.
 * If state is already a code, returns it as-is.
 *
 * @param shippingAddress - Order shipping address
 * @returns State code (2-digit string) or null if not found
 */
export function getStateCodeFromShippingAddress(shippingAddress: {
  state?: string
  [key: string]: any
}): string | null {
  if (!shippingAddress?.state) {
    return null
  }

  const stateCode = getGstStateCode(shippingAddress.state)

  if (!stateCode) {
    console.warn(`State code not found for state: "${shippingAddress.state}". Defaulting to IGST.`)
  }

  return stateCode
}
