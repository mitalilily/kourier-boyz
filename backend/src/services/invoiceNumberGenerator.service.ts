import mongoose from 'mongoose'
import AdminInvoiceSettings from '../models/AdminInvoiceSettings'
import InvoiceSequence, { InvoiceType } from '../models/InvoiceSequence'

/**
 * Get financial year from a date
 * Financial year in India: April 1 to March 31
 * e.g., 2024-04-01 to 2025-03-31 = FY 24-25
 */
export const getFinancialYear = (date: Date): string => {
  const year = date.getFullYear()
  const month = date.getMonth() + 1 // 1-12

  // Financial year starts in April (month 4)
  let fyStartYear: number
  let fyEndYear: number

  if (month >= 4) {
    // April to December: FY is current year to next year
    fyStartYear = year
    fyEndYear = year + 1
  } else {
    // January to March: FY is previous year to current year
    fyStartYear = year - 1
    fyEndYear = year
  }

  // Format as YY-YY (e.g., 24-25)
  const startYY = String(fyStartYear).slice(-2)
  const endYY = String(fyEndYear).slice(-2)

  return `${startYY}-${endYY}`
}

/**
 * Format financial year according to settings format
 * Supported: 'YY-YY' (e.g. 26-27, 5 chars) | 'YYYY' (e.g. 2627, 4 chars - compact)
 */
const formatFinancialYear = (fy: string, format: string): string => {
  if (format === 'YYYY') {
    return fy.replace('-', '')
  }
  return fy
}

/**
 * Count total characters (GST law limits invoice numbers to 16 chars total,
 * including alphanumeric characters and special symbols like '/' and '-').
 */
const countDigits = (str: string): number => {
  return str.length
}

/**
 * Get state code abbreviation from state name or GSTIN
 * GSTIN format: First 2 digits are state code (e.g., 07=Delhi, 27=Maharashtra)
 * Common state codes mapping
 */
const getStateCode = (state?: string, gstNumber?: string): string => {
  if (state) {
    // Map common state names to abbreviations
    const stateMap: Record<string, string> = {
      delhi: 'DL',
      'new delhi': 'DL',
      maharashtra: 'MH',
      karnataka: 'KA',
      tamilnadu: 'TN',
      'tamil nadu': 'TN',
      gujarat: 'GJ',
      rajasthan: 'RJ',
      westbengal: 'WB',
      'west bengal': 'WB',
      uttarpradesh: 'UP',
      'uttar pradesh': 'UP',
      andhrapradesh: 'AP',
      'andhra pradesh': 'AP',
      telangana: 'TS',
      kerala: 'KL',
      punjab: 'PB',
      haryana: 'HR',
      odisha: 'OD',
      madhyapradesh: 'MP',
      'madhya pradesh': 'MP',
      bihar: 'BR',
      assam: 'AS',
      jharkhand: 'JH',
      chhattisgarh: 'CG',
      himachalpradesh: 'HP',
      'himachal pradesh': 'HP',
      uttarakhand: 'UK',
      goa: 'GA',
      manipur: 'MN',
      meghalaya: 'ML',
      mizoram: 'MZ',
      nagaland: 'NL',
      tripura: 'TR',
      sikkim: 'SK',
      arunachalpradesh: 'AR',
      'arunachal pradesh': 'AR',
    }

    const stateLower = state.toLowerCase().trim()
    if (stateMap[stateLower]) {
      return stateMap[stateLower]
    }

    // Fallback: use first 2 letters of state name, uppercase
    return state.substring(0, 2).toUpperCase()
  }

  // If no state name, try to extract from GSTIN
  if (gstNumber) {
    const gstClean = gstNumber.replace(/[^0-9]/g, '')
    if (gstClean.length >= 2) {
      const stateNum = gstClean.substring(0, 2)
      // Map numeric state codes to abbreviations (common ones)
      const stateNumMap: Record<string, string> = {
        '07': 'DL', // Delhi
        '27': 'MH', // Maharashtra
        '29': 'KA', // Karnataka
        '33': 'TN', // Tamil Nadu
        '24': 'GJ', // Gujarat
        '08': 'RJ', // Rajasthan
        '19': 'WB', // West Bengal
        '09': 'UP', // Uttar Pradesh
        '37': 'AP', // Andhra Pradesh
        '36': 'TS', // Telangana
        '32': 'KL', // Kerala
        '03': 'PB', // Punjab
        '06': 'HR', // Haryana
        '21': 'OD', // Odisha
        '23': 'MP', // Madhya Pradesh
        '10': 'BR', // Bihar
        '18': 'AS', // Assam
        '20': 'JH', // Jharkhand
        '22': 'CG', // Chhattisgarh
        '02': 'HP', // Himachal Pradesh
        '05': 'UK', // Uttarakhand
        '30': 'GA', // Goa
      }
      return stateNumMap[stateNum] || stateNum
    }
  }

  return ''
}

/**
 * Generate a compact seller identifier from GST number and state
 * For GST compliance: Each GSTIN + State combination needs unique identifier
 * Format: Last 6 chars of GSTIN (includes state code, PAN suffix, entity, check digit) + 2-letter state code
 * Example: GSTIN: 27ABCDE1234F1Z5, State: Maharashtra -> 234F1Z + MH -> 234F1ZMH
 *
 * Note: GSTIN format is: 2-digit state + 10-char PAN + 1 entity + 1 check digit + 1 Z
 * We use last 6 chars to capture entity, check digit, and part of PAN for uniqueness
 */
const getSellerIdentifier = (gstNumber?: string, state?: string): string => {
  if (!gstNumber && !state) return ''

  let identifier = ''

  // Extract last 6 characters from GSTIN for better uniqueness
  // This captures: entity number, check digit, and part of PAN
  if (gstNumber) {
    // Remove spaces and special chars, keep alphanumeric
    const gstClean = gstNumber.replace(/[^A-Z0-9]/gi, '').toUpperCase()
    if (gstClean.length >= 6) {
      identifier = gstClean.slice(-6) // Last 6 chars
    } else {
      identifier = gstClean.padStart(6, '0')
    }
  }

  // Add state code (first 2 letters, uppercase) - this is critical for GST compliance
  // Same GSTIN in different states = different sequences
  if (state) {
    const stateCode = state.substring(0, 2).toUpperCase()
    identifier += stateCode
  }

  return identifier
}

/**
 * Generate invoice number based on admin settings
 * Format for INVOICE: {prefix}/{gstIdentifier}/{yearSegment}/{sequence}
 * Format for CREDIT_NOTE/DEBIT_NOTE: {prefix}-{stateCode}-{sequence} (e.g., CN-DL-001, CN-MH-001)
 *
 * GST Compliance Requirements:
 * - Each GSTIN (GST Number) + State combination MUST have its own continuous, gap-less sequence
 * - One seller may have multiple GST registrations, each needs separate sequence
 * - Sequence is tracked per: type + financialYear + gstNumber + state
 * - This ensures GST law compliance: continuous serial numbering per GSTIN
 * - Applies to BOTH Invoices AND Credit Notes (CN must also be serially numbered per GSTIN + State)
 *
 * Credit Note Format Examples:
 * - CN-DL-001, CN-DL-002 (Delhi state, continuous sequence)
 * - CN-MH-001 (Maharashtra state, separate sequence starting from 001)
 *
 * Constraints:
 * - Total digits (excluding separators) must not exceed 16
 * - Credit notes and debit notes use state code in format: {prefix}-{stateCode}-{sequence}
 * - Seller-specific sequences are GST-wise and state-wise (GST Number + State)
 *
 * @param type - Type of invoice (INVOICE, CREDIT_NOTE, DEBIT_NOTE)
 * @param issueDate - Date when invoice is issued (defaults to now)
 * @param options - Optional seller info (GST Number + State required for seller sequences) and credit note references
 * @returns Generated invoice number (max 16 digits total)
 */
export interface GenerateInvoiceNumberOptions {
  sellerId?: mongoose.Types.ObjectId | string
  gstNumber?: string
  state?: string
  // For credit notes
  orderId?: string | mongoose.Types.ObjectId
  orderNumber?: string
  invoiceNumber?: string
  invoiceDate?: Date
}

const buildInvoiceSequenceQuery = (
  type: InvoiceType,
  formattedScope: string,
  sellerId?: mongoose.Types.ObjectId,
  gstNumber?: string,
  state?: string,
) => {
  const query: any = {
    type,
    financialYear: formattedScope,
  }

  if (gstNumber && state) {
    query.gstNumber = gstNumber
    query.state = state
    if (sellerId) query.sellerId = sellerId
    return query
  }

  if (sellerId) {
    query.sellerId = sellerId
    if (gstNumber) query.gstNumber = gstNumber
    if (state) query.state = state
    return query
  }

  // Match both legacy docs with missing fields and newer docs where these were stored as null.
  query.sellerId = null
  query.gstNumber = null
  query.state = null

  return query
}

export const generateInvoiceNumber = async (
  type: InvoiceType,
  issueDate: Date = new Date(),
  options?: GenerateInvoiceNumberOptions,
): Promise<string> => {
  try {
    // Get admin settings
    const settings = await AdminInvoiceSettings.getSingleton()

    // Determine prefix based on type
    let prefix: string
    switch (type) {
      case 'INVOICE':
        prefix = settings.invoicePrefix
        break
      case 'CREDIT_NOTE':
        prefix = settings.creditNotePrefix
        break
      case 'DEBIT_NOTE':
        prefix = settings.debitNotePrefix
        break
      default:
        throw new Error(`Invalid invoice type: ${type}`)
    }

    // Determine the scope key based on resetFrequency setting
    let scopeKey: string

    switch (settings.resetFrequency) {
      case 'FINANCIAL_YEAR':
        scopeKey = getFinancialYear(issueDate)
        break
      case 'CALENDAR_YEAR':
        scopeKey = String(issueDate.getFullYear())
        break
      case 'NEVER':
        scopeKey = 'GLOBAL'
        break
      default:
        scopeKey = getFinancialYear(issueDate)
    }

    const formattedScope =
      settings.resetFrequency === 'FINANCIAL_YEAR'
        ? formatFinancialYear(scopeKey, settings.financialYearFormat)
        : scopeKey

    // For seller-specific sequences, use GST Number + State (GST compliance requirement)
    // Each GSTIN + State combination must have its own continuous, gap-less sequence
    const sellerId = options?.sellerId
      ? typeof options.sellerId === 'string'
        ? new mongoose.Types.ObjectId(options.sellerId)
        : options.sellerId
      : undefined
    const gstNumber = options?.gstNumber?.trim()
    const state = options?.state?.trim()

    const query = buildInvoiceSequenceQuery(type, formattedScope, sellerId, gstNumber, state)

    // Use an aggregation pipeline update so we can both:
    //   - initialize the sequence to settings.sequenceStart on insert
    //   - increment by 1 on subsequent updates
    // (Mongo rejects $setOnInsert + $inc on the same path with ConflictingUpdateOperators.)
    let sequence = null
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        sequence = await InvoiceSequence.findOneAndUpdate(
          query,
          [
            {
              $set: {
                type: { $ifNull: ['$type', type] },
                financialYear: { $ifNull: ['$financialYear', formattedScope] },
                sellerId: { $ifNull: ['$sellerId', sellerId ?? null] },
                gstNumber: { $ifNull: ['$gstNumber', gstNumber ?? null] },
                state: { $ifNull: ['$state', state ?? null] },
                sequence: {
                  $cond: [
                    { $eq: [{ $type: '$sequence' }, 'missing'] },
                    settings.sequenceStart,
                    { $add: ['$sequence', 1] },
                  ],
                },
              },
            },
          ],
          {
            new: true,
            upsert: true,
          },
        )
        break
      } catch (error: any) {
        const isDuplicateSequence = error?.code === 11000
        if (!isDuplicateSequence || attempt === 2) {
          throw error
        }
      }
    }

    if (!sequence) {
      throw new Error('Failed to allocate invoice sequence')
    }

    // For credit notes and debit notes, use GST-compliant format with state code
    // GST Compliance: Credit Notes must be serially numbered per GSTIN + State
    // Format: {prefix}-{stateCode}-{sequence} (e.g., CN-DL-001, CN-MH-001)
    if (type === 'CREDIT_NOTE' || type === 'DEBIT_NOTE') {
      // Get state code for GST-compliant numbering
      const stateCode = getStateCode(state, gstNumber)

      // If we have order/invoice references, try to include them in a compact format
      // Format: {prefix}-{stateCode}-{orderRef}-{sequence} or {prefix}-{stateCode}-{sequence}
      if ((options?.orderNumber || options?.invoiceNumber) && stateCode) {
        const orderRef = options.orderNumber
          ? options.orderNumber.replace(/\D/g, '').slice(-4) // Last 4 digits (shorter)
          : options.orderId
          ? String(options.orderId).slice(-4)
          : ''

        const invoiceRef = options.invoiceNumber
          ? options.invoiceNumber.replace(/\D/g, '').slice(-4) // Last 4 digits (shorter)
          : ''

        // Calculate available digits for sequence
        const prefixDigits = prefix.replace(/\D/g, '').length
        const stateCodeDigits = stateCode.replace(/\D/g, '').length
        const orderRefDigits = orderRef.length
        const invoiceRefDigits = invoiceRef.length
        const usedDigits = prefixDigits + stateCodeDigits + orderRefDigits + invoiceRefDigits
        const availableDigits = Math.max(1, 16 - usedDigits)

        // Format sequence with appropriate padding
        const sequenceStr = String(sequence.sequence).padStart(availableDigits, '0')

        // Build note number with references if space allows
        let noteNumber = ''
        if (orderRef && invoiceRef && usedDigits + availableDigits <= 16) {
          noteNumber = `${prefix}-${stateCode}-${orderRef}-${invoiceRef}-${sequenceStr}`
        } else if (orderRef && usedDigits + availableDigits <= 16) {
          noteNumber = `${prefix}-${stateCode}-${orderRef}-${sequenceStr}`
        } else {
          // Simple format: {prefix}-{stateCode}-{sequence}
          noteNumber = `${prefix}-${stateCode}-${sequenceStr}`
        }

        // Verify total digits don't exceed 16
        if (countDigits(noteNumber) > 16) {
          // Fallback to simple format
          const simpleAvailableDigits = Math.max(1, 16 - prefixDigits - stateCodeDigits)
          const simpleSequence = String(sequence.sequence).padStart(simpleAvailableDigits, '0')
          noteNumber = `${prefix}-${stateCode}-${simpleSequence}`
        }

        return noteNumber
      } else if (stateCode) {
        // Simple GST-compliant format: {prefix}-{stateCode}-{sequence}
        // Example: CN-DL-001, CN-MH-001, DN-DL-001
        const prefixDigits = prefix.replace(/\D/g, '').length
        const stateCodeDigits = stateCode.replace(/\D/g, '').length
        const usedDigits = prefixDigits + stateCodeDigits
        const availableDigits = Math.max(1, 16 - usedDigits)

        const sequenceStr = String(sequence.sequence).padStart(availableDigits, '0')
        return `${prefix}-${stateCode}-${sequenceStr}`
      }
      // Fallback: if no state code, use old format
    }

    // GST law: invoice numbers must be ≤16 characters (alphanumeric + '/' '-' allowed).
    // The sequence is already isolated per GSTIN+State at the DB layer, so the invoice
    // number string does NOT need to embed seller identity. Format: {prefix}/{year}/{seq}
    // (or {prefix}/{seq} when resetFrequency=NEVER).
    const yearSegment =
      settings.resetFrequency === 'FINANCIAL_YEAR'
        ? formattedScope
        : settings.resetFrequency === 'CALENDAR_YEAR'
        ? scopeKey
        : ''

    // Compute remaining budget for the sequence segment after prefix + year + separators.
    const separators = yearSegment ? 2 : 1 // slashes
    const fixedLen = prefix.length + yearSegment.length + separators
    const seqWidth = Math.max(1, 16 - fixedLen)
    const sequenceStr = String(sequence.sequence).padStart(seqWidth, '0')

    let invoiceNumber = yearSegment
      ? `${prefix}/${yearSegment}/${sequenceStr}`
      : `${prefix}/${sequenceStr}`

    // Defensive cap (in case configured prefix is unusually long).
    if (invoiceNumber.length > 16) {
      invoiceNumber = invoiceNumber.slice(0, 16)
    }

    return invoiceNumber
  } catch (error) {
    console.error('Error generating invoice number:', error)
    throw error
  }
}

/**
 * Get current sequence for a type and scope (without incrementing)
 * Useful for previewing what the next number would be
 */
export const getCurrentSequence = async (
  type: InvoiceType,
  issueDate: Date = new Date(),
  options?: GenerateInvoiceNumberOptions,
): Promise<number> => {
  try {
    const settings = await AdminInvoiceSettings.getSingleton()

    // Determine scope key based on resetFrequency (same logic as generateInvoiceNumber)
    let scopeKey: string
    switch (settings.resetFrequency) {
      case 'FINANCIAL_YEAR':
        scopeKey = getFinancialYear(issueDate)
        break
      case 'CALENDAR_YEAR':
        scopeKey = String(issueDate.getFullYear())
        break
      case 'NEVER':
        scopeKey = 'GLOBAL'
        break
      default:
        scopeKey = getFinancialYear(issueDate)
    }

    const formattedScope =
      settings.resetFrequency === 'FINANCIAL_YEAR'
        ? formatFinancialYear(scopeKey, settings.financialYearFormat)
        : scopeKey

    // For seller-specific sequences, use GST Number + State (GST compliance requirement)
    const sellerId = options?.sellerId
      ? typeof options.sellerId === 'string'
        ? new mongoose.Types.ObjectId(options.sellerId)
        : options.sellerId
      : undefined
    const gstNumber = options?.gstNumber?.trim()
    const state = options?.state?.trim()

    const query = buildInvoiceSequenceQuery(type, formattedScope, sellerId, gstNumber, state)

    const sequence = await InvoiceSequence.findOne(query)

    if (!sequence) {
      return settings.sequenceStart
    }

    return sequence.sequence
  } catch (error) {
    console.error('Error getting current sequence:', error)
    throw error
  }
}
