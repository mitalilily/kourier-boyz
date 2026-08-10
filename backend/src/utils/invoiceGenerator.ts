import * as fs from 'fs'
import mongoose from 'mongoose'
import * as path from 'path'
import PDFDocument from 'pdfkit'
import AdminInvoiceSettings from '../models/AdminInvoiceSettings'
import { IOrder, IOrderItem } from '../models/Order'
import { IUser } from '../models/User'
import { generateInvoiceNumber } from '../services/invoiceNumberGenerator.service'
import { fetchBrandingAssetBuffer, getBrandingSettingsCached } from './brandingSettings'
import { uploadToR2 } from './r2Upload'

// Helper function to check if text contains non-ASCII characters (Hindi, etc.)
const containsNonASCII = (text: string): boolean => {
  return /[^\x00-\x7F]/.test(text)
}

// Helper function to check if text contains currency symbols that need Unicode font
const containsCurrencySymbol = (text: string): boolean => {
  // Check for common currency symbols that aren't in Helvetica
  const currencySymbols = [
    '₹', // Indian Rupee (U+20B9)
    '€', // Euro (U+20AC)
    '£', // British Pound (U+00A3)
    '¥', // Yen/Yuan (U+00A5)
    'د.إ', // UAE Dirham
    '﷼', // Saudi Riyal (U+FDFC)
    '฿', // Thai Baht (U+0E3F)
    '₨', // Pakistani Rupee (U+20A8)
    '৳', // Bangladeshi Taka (U+09F3)
  ]
  return currencySymbols.some((symbol) => text.includes(symbol))
}

// Helper function to get appropriate font for text
// Returns 'Unicode' if text contains non-ASCII or currency symbols, otherwise 'Helvetica'
const getFontForText = (text: string, bold: boolean = false): string => {
  if (containsNonASCII(text) || containsCurrencySymbol(text)) {
    return bold ? 'Unicode-Bold' : 'Unicode'
  }
  return bold ? 'Helvetica-Bold' : 'Helvetica'
}

// Helper to safely convert _id to string
const getIdString = (id: any): string => {
  if (!id) return ''
  if (typeof id === 'string') return id
  if (id instanceof mongoose.Types.ObjectId) return id.toString()
  if (typeof id.toString === 'function') return id.toString()
  return String(id)
}

// Format date according to admin settings
const formatDate = (date: Date, format: string): string => {
  // Support DD MMM YYYY format (e.g., "15 Jan 2025") or DD.MMM.YYYY (e.g., "15.Jan.2025")
  if (format === 'DD MMM YYYY' || format === 'DD.MMM.YYYY') {
    const day = String(date.getDate()).padStart(2, '0')
    const monthNames = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ]
    const month = monthNames[date.getMonth()]
    const year = date.getFullYear()
    // Use dots to match frontend format
    return `${day}.${month}.${year}`
  }
  // Default fallback
  return date.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

// Round number according to admin settings
const roundAmount = (amount: number, mode: string): number => {
  switch (mode) {
    case 'ROUND_HALF_UP':
      return Math.round(amount)
    case 'ROUND_HALF_DOWN':
      return Math.floor(amount + 0.5)
    case 'ROUND_UP':
      return Math.ceil(amount)
    case 'ROUND_DOWN':
      return Math.floor(amount)
    default:
      return Math.round(amount)
  }
}

// Currency symbol mapping - using proper Unicode characters
const getCurrencySymbol = (currency: string): string => {
  const currencyMap: Record<string, string> = {
    INR: '₹', // Indian Rupee (U+20B9)
    USD: '$',
    EUR: '€', // Euro (U+20AC)
    GBP: '£', // British Pound (U+00A3)
    JPY: '¥', // Yen (U+00A5)
    AUD: 'A$',
    CAD: 'C$',
    CHF: 'CHF',
    CNY: '¥', // Chinese Yuan (U+00A5)
    SGD: 'S$',
    AED: 'د.إ', // UAE Dirham
    SAR: '﷼', // Saudi Riyal (U+FDFC)
    MYR: 'RM',
    THB: '฿', // Thai Baht (U+0E3F)
    PKR: '₨', // Pakistani Rupee (U+20A8)
    BDT: '৳', // Bangladeshi Taka (U+09F3)
    NZD: 'NZ$',
    ZAR: 'R',
    BRL: 'R$',
    MXN: '$',
  }
  return currencyMap[currency] || currency
}

// Format currency according to admin settings
const formatCurrency = (
  amount: number | string,
  currency: string,
  roundingMode: string,
): string => {
  // If amount is already a formatted string (contains currency symbol), return as is
  if (typeof amount === 'string') {
    // Check if it already contains a currency symbol
    const symbol = getCurrencySymbol(currency)
    // Check for common currency symbols
    if (
      amount.includes(symbol) ||
      amount.includes('₹') ||
      amount.includes('$') ||
      amount.includes('€') ||
      amount.includes('£') ||
      amount.includes('¥')
    ) {
      return amount
    }
    // If it's a string but no symbol, try to parse it
    const parsed = parseFloat(amount)
    if (isNaN(parsed)) return amount
    amount = parsed
  }

  const rounded = roundAmount(amount, roundingMode)
  const symbol = getCurrencySymbol(currency)
  // Format with commas for thousands separator
  return `${symbol}${rounded.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`
}

// Convert number to words (Indian numbering system)
const numberToWords = (num: number): string => {
  const ones = [
    '',
    'One',
    'Two',
    'Three',
    'Four',
    'Five',
    'Six',
    'Seven',
    'Eight',
    'Nine',
    'Ten',
    'Eleven',
    'Twelve',
    'Thirteen',
    'Fourteen',
    'Fifteen',
    'Sixteen',
    'Seventeen',
    'Eighteen',
    'Nineteen',
  ]
  const tens = [
    '',
    '',
    'Twenty',
    'Thirty',
    'Forty',
    'Fifty',
    'Sixty',
    'Seventy',
    'Eighty',
    'Ninety',
  ]

  if (num === 0) return 'Zero'
  if (num < 20) return ones[num]
  if (num < 100) {
    return tens[Math.floor(num / 10)] + (num % 10 !== 0 ? ' ' + ones[num % 10] : '')
  }
  if (num < 1000) {
    return (
      ones[Math.floor(num / 100)] +
      ' Hundred' +
      (num % 100 !== 0 ? ' ' + numberToWords(num % 100) : '')
    )
  }
  if (num < 100000) {
    return (
      numberToWords(Math.floor(num / 1000)) +
      ' Thousand' +
      (num % 1000 !== 0 ? ' ' + numberToWords(num % 1000) : '')
    )
  }
  if (num < 10000000) {
    return (
      numberToWords(Math.floor(num / 100000)) +
      ' Lakh' +
      (num % 100000 !== 0 ? ' ' + numberToWords(num % 100000) : '')
    )
  }
  return (
    numberToWords(Math.floor(num / 10000000)) +
    ' Crore' +
    (num % 10000000 !== 0 ? ' ' + numberToWords(num % 10000000) : '')
  )
}

// Helper function to get state code
const getStateCode = (state: string): string => {
  const stateCodeMap: Record<string, string> = {
    'Andhra Pradesh': '37',
    'Arunachal Pradesh': '12',
    Assam: '18',
    Bihar: '10',
    Chhattisgarh: '22',
    Goa: '30',
    Gujarat: '24',
    Haryana: '06',
    'Himachal Pradesh': '02',
    Jharkhand: '20',
    Karnataka: '29',
    Kerala: '32',
    'Madhya Pradesh': '23',
    Maharashtra: '27',
    Manipur: '14',
    Meghalaya: '17',
    Mizoram: '15',
    Nagaland: '13',
    Odisha: '21',
    Punjab: '03',
    Rajasthan: '08',
    Sikkim: '11',
    'Tamil Nadu': '33',
    Telangana: '36',
    Tripura: '16',
    'Uttar Pradesh': '09',
    Uttarakhand: '05',
    'West Bengal': '19',
    Delhi: '07',
    'Jammu and Kashmir': '01',
    Ladakh: '38',
    Puducherry: '34',
    'Andaman and Nicobar Islands': '35',
    Chandigarh: '04',
    'Dadra and Nagar Haveli and Daman and Diu': '26',
    Lakshadweep: '31',
  }
  return stateCodeMap[state] || '00'
}

const roundToTwo = (amount: number): number =>
  Math.round((Number(amount) + Number.EPSILON) * 100) / 100

const toNumber = (value: any, fallback = 0): number => {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

const calculateInvoiceLineAmounts = (orderItem: any) => {
  const quantity = Math.max(1, toNumber(orderItem?.quantity, 1))
  const gstRatePercent = Math.max(0, toNumber(orderItem?.gstRatePercent))
  const gstTaxType = orderItem?.gstTaxType === 'CGST_SGST' ? 'CGST_SGST' : 'IGST'
  const effectivePrice = toNumber(orderItem?.effectivePrice, toNumber(orderItem?.price))
  const sellingPriceExclGst =
    toNumber(orderItem?.priceWithoutTax) > 0
      ? toNumber(orderItem?.priceWithoutTax)
      : gstRatePercent > 0
        ? roundToTwo(effectivePrice / (1 + gstRatePercent / 100))
        : effectivePrice
  const itemDiscount = Math.max(0, toNumber(orderItem?.discountAmount))
  const storedTaxPerUnit =
    toNumber(orderItem?.igst) + toNumber(orderItem?.cgst) + toNumber(orderItem?.sgst)
  const lineTotal = Math.max(
    0,
    roundToTwo(toNumber(orderItem?.subtotal, effectivePrice * quantity)),
  )

  let taxAmount: number
  let taxableValue: number

  if (gstRatePercent > 0) {
    // Always derive from lineTotal so tax% matches the displayed taxable value.
    // Stored per-unit tax amounts may be based on the pre-discount price when a coupon
    // was applied, which would make the tax appear higher than gstRatePercent% of the base.
    taxableValue = roundToTwo(lineTotal / (1 + gstRatePercent / 100))
    taxAmount = roundToTwo(lineTotal - taxableValue)
  } else if (storedTaxPerUnit > 0) {
    taxAmount = roundToTwo(storedTaxPerUnit * quantity)
    taxableValue = roundToTwo(lineTotal - taxAmount)
  } else {
    taxAmount = 0
    taxableValue = lineTotal
  }

  if (taxableValue < 0) {
    taxableValue = 0
    taxAmount = lineTotal
  }

  let igstAmount = 0
  let cgstAmount = 0
  let sgstAmount = 0

  if (taxAmount > 0) {
    if (gstTaxType === 'CGST_SGST') {
      cgstAmount = roundToTwo(taxAmount / 2)
      sgstAmount = roundToTwo(taxAmount - cgstAmount)
    } else {
      igstAmount = roundToTwo(taxAmount)
    }
  }

  const effectiveSellingPriceExclGst =
    gstRatePercent > 0 ? roundToTwo(taxableValue / quantity) : roundToTwo(sellingPriceExclGst)

  return {
    quantity,
    gstRatePercent,
    gstTaxType,
    sellingPriceExclGst: effectiveSellingPriceExclGst,
    itemDiscount,
    taxableValue,
    igstAmount,
    cgstAmount,
    sgstAmount,
    lineTaxTotal: roundToTwo(igstAmount + cgstAmount + sgstAmount),
    lineGrandTotal: lineTotal,
  }
}

type InvoiceAudience = 'buyer' | 'seller'

interface SettlementSummary {
  grossAmount: number
  marketplaceFees?: number
  courierCharges?: number
  codFees?: number
  netSettlement?: number
  // For seller credit/debit notes: Reference to seller settlement invoice
  invoiceNumber?: string
}

interface ExistingInvoiceRecord {
  invoice_id?: string
  invoice_url?: string
  invoice_number?: string
  generated_at?: Date
  hsnSummary?: HsnSummaryItem[]
}

interface InvoiceData {
  order: IOrder
  customer: IUser
  seller?: IUser
  items: Array<{
    product: any
    variant?: any
    orderItem: IOrderItem
  }>
  /**
   * Who will view this invoice.
   * - 'buyer'  => customer-facing invoice
   * - 'seller' => seller-facing invoice with settlement summary
   *
   * Default: 'buyer'
   */
  audience?: InvoiceAudience
  /**
   * Optional settlement summary used for seller invoices.
   * If provided and audience === 'seller', we render a dedicated section.
   */
  settlement?: SettlementSummary
  /**
   * When 'triplicate_to_supplier': same content as buyer invoice but with "Triplicate - To Supplier"
   * notation; uses order.invoice.invoice_number (no new number); creates a new PDF file for seller.
   */
  copyLabel?: 'triplicate_to_supplier'
  /**
   * Existing invoice record for the exact document being regenerated.
   * Seller invoices live on sellerShipments[].invoice, not order.invoice.
   */
  existingInvoice?: ExistingInvoiceRecord
}

/**
 * Generate invoice PDF for an order
 *
 * Both customer (buyer) and seller invoices use the same layout and branding,
 * with the only difference being:
 * - Seller invoices include an additional "SETTLEMENT SUMMARY" section
 * - All invoices use branding settings (logo, company name, signature)
 *
 * @param invoiceData - Invoice data including order, customer, items, and optional seller info
 * @returns Invoice details including invoice_id, invoice_url, and invoice_number
 */
export interface HsnSummaryItem {
  hsnSacCode: string
  gstRatePercent: number
  taxableValueTotal: number
  igstAmountTotal: number
  cgstAmountTotal: number
  sgstAmountTotal: number
}

export const generateInvoice = async (
  invoiceData: InvoiceData,
  invoiceType: 'INVOICE' | 'CREDIT_NOTE' | 'DEBIT_NOTE' = 'INVOICE',
  issueDate?: Date,
): Promise<{
  invoice_id: string
  invoice_url: string
  invoice_number: string
  hsnSummary?: HsnSummaryItem[]
}> => {
  try {
    const {
      order,
      customer,
      seller,
      items,
      audience = 'buyer',
      settlement,
      copyLabel,
      existingInvoice,
    } = invoiceData
    const isTriplicateToSupplier = copyLabel === 'triplicate_to_supplier'
    // Triplicate uses buyer layout; only header line differs
    const effectiveAudience = isTriplicateToSupplier ? ('buyer' as const) : audience

    // ============================================================================
    // CONFIGURATION & SETUP
    // ============================================================================
    // Get admin invoice settings - ALL invoice generation respects these settings:
    // - invoicePrefix, creditNotePrefix, debitNotePrefix: Used in generateInvoiceNumber()
    // - financialYearFormat, sequenceStart, resetFrequency: Used in generateInvoiceNumber()
    // - currency: Used in all formatCurrency() calls
    // - roundingMode: Used in all formatCurrency() calls
    // - dateFormat: Used in all formatDate() calls
    // - showGstBreakup: Controls GST column visibility in table
    // - allowSellerLogo: Controls whether seller logo is used instead of marketplace logo
    // - allowSellerSignature: Controls whether seller signature is used instead of marketplace signature
    // - allowSellerFooterNote: Controls whether seller footer note is displayed
    // - lockAfterIssue: Checked in downloadInvoice() to prevent regeneration if invoice exists
    const invoiceSettings = await AdminInvoiceSettings.getSingleton()
    const targetInvoiceRecord =
      audience === 'seller' && !isTriplicateToSupplier ? existingInvoice : order.invoice

    // Delete old invoice file from R2 if it exists (before generating new one).
    // Skip for triplicate copy - we are creating a new file, not replacing customer invoice.
    const { deleteFromR2 } = await import('./r2Upload')
    const existingInvoiceUrl =
      !isTriplicateToSupplier &&
      (invoiceType === 'INVOICE'
        ? targetInvoiceRecord?.invoice_url
        : invoiceType === 'CREDIT_NOTE'
        ? (order as any).creditNote?.credit_note_url
        : (order as any).debitNote?.debit_note_url)

    if (existingInvoiceUrl) {
      try {
        await deleteFromR2(existingInvoiceUrl)
        console.log(`âœ… Deleted old ${invoiceType} file from R2: ${existingInvoiceUrl}`)
      } catch (error) {
        // Log but don't fail - old file might not exist or already deleted
        console.warn(`âš ï¸ Could not delete old ${invoiceType} file from R2:`, error)
      }
    }

    // CRITICAL: Regeneration must use the same invoice number (never generate new).
    // For triplicate to supplier, always use the customer invoice number (same document, triplicate copy).
    let invoiceNumber: string
    const invoiceIssueDate = issueDate || new Date(order.createdAt)
    const existingInvoiceNumber =
      isTriplicateToSupplier
        ? order.invoice?.invoice_number
        : invoiceType === 'INVOICE'
        ? targetInvoiceRecord?.invoice_number
        : invoiceType === 'CREDIT_NOTE'
        ? (order as any).creditNote?.credit_note_number
        : (order as any).debitNote?.debit_note_number

    if (existingInvoiceNumber) {
      // Use existing invoice number - regeneration must preserve the same number
      invoiceNumber = existingInvoiceNumber
      console.log(
        `âœ… Reusing existing ${invoiceType} number: ${invoiceNumber} (regeneration preserves same number)`,
      )
    } else {
      // Generate new invoice number only if one doesn't exist

      // Prepare options for invoice number generation
      const invoiceNumberOptions: any = {}

      // Use seller-scoped sequences only for seller-facing compliance documents.
      // Buyer invoices in Kourier Boyz should follow one marketplace-wide sequence.
      if (audience === 'seller' && seller) {
        if (seller._id) {
          invoiceNumberOptions.sellerId = seller._id
        }
        if (seller.gstNumber) {
          invoiceNumberOptions.gstNumber = seller.gstNumber
        }
        if (seller.state) {
          invoiceNumberOptions.state = seller.state
        }

        if (
          (invoiceType === 'INVOICE' ||
            invoiceType === 'CREDIT_NOTE' ||
            invoiceType === 'DEBIT_NOTE') &&
          (!seller.gstNumber || !seller.state)
        ) {
          console.warn(
            `âš ï¸ GST Compliance Warning: ${invoiceType} generated for seller ${seller._id} without GST Number or State. ` +
              `GST-compliant documents require both GST Number and State for proper serial numbering per GSTIN + State.`,
          )
        }
      }

      // For credit notes and debit notes, include order and invoice references
      // CRITICAL GST COMPLIANCE: Seller credit/debit notes MUST reference seller invoices, NOT buyer invoices
      if (invoiceType === 'CREDIT_NOTE' || invoiceType === 'DEBIT_NOTE') {
        if (order._id) {
          invoiceNumberOptions.orderId = order._id
        }
        if (order.orderNumber) {
          invoiceNumberOptions.orderNumber = order.orderNumber
        }

        // For seller credit/debit notes: Reference SELLER invoice (settlement invoice or seller tax invoice)
        // NEVER reference buyer invoice (order.invoice) - this causes GST filing mismatches
        if (audience === 'seller') {
          // Reference seller settlement invoice if available (from settlement batch)
          if (settlement?.invoiceNumber) {
            invoiceNumberOptions.invoiceNumber = settlement.invoiceNumber
            // Note: Settlement invoice date would need to be retrieved from settlement batch
          }
          // If no seller invoice exists, credit note will be standalone (acceptable for GST)
          // Do NOT reference order.invoice (buyer invoice) for seller credit notes
        } else {
          // For buyer credit notes: Reference buyer invoice (current behavior is correct)
          if (order.invoice?.invoice_number) {
            invoiceNumberOptions.invoiceNumber = order.invoice.invoice_number
          }
          if (order.invoice?.generated_at) {
            invoiceNumberOptions.invoiceDate = new Date(order.invoice.generated_at)
          }
        }
      }

      invoiceNumber = await generateInvoiceNumber(
        invoiceType === 'INVOICE'
          ? 'INVOICE'
          : invoiceType === 'CREDIT_NOTE'
          ? 'CREDIT_NOTE'
          : 'DEBIT_NOTE',
        invoiceIssueDate,
        invoiceNumberOptions,
      )
    }

    // ============================================================================
    // INVOICE NUMBER GENERATION
    // ============================================================================
    const invoiceId = `INV-${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 9)
      .toUpperCase()}`
    const branding = await getBrandingSettingsCached()

    // ============================================================================
    // BRANDING ASSETS (Logo & Signature)
    // ============================================================================
    // Determine which logo to use: seller logo if allowed, otherwise marketplace logo
    let invoiceLogoBuffer: Buffer | null = null
    if (invoiceSettings.allowSellerLogo && seller?.storeLogo) {
      try {
        invoiceLogoBuffer = await fetchBrandingAssetBuffer(seller.storeLogo)
      } catch (error) {
        console.warn('Failed to load seller logo, falling back to marketplace logo:', error)
      }
    }
    if (!invoiceLogoBuffer) {
      invoiceLogoBuffer = await fetchBrandingAssetBuffer(
        branding.invoiceLogoUrl || branding.labelLogoUrl,
      )
    }

    // Determine which signature to use: seller signature if allowed, otherwise marketplace signature
    let signatureBuffer: Buffer | null = null
    if (invoiceSettings.allowSellerSignature && seller?.sellerAgreementSignature) {
      try {
        signatureBuffer = await fetchBrandingAssetBuffer(seller.sellerAgreementSignature)
      } catch (error) {
        console.warn(
          'Failed to load seller signature, falling back to marketplace signature:',
          error,
        )
      }
    }
    if (!signatureBuffer && branding.signatureUrl) {
      signatureBuffer = await fetchBrandingAssetBuffer(branding.signatureUrl)
    }

    // ============================================================================
    // PDF DOCUMENT CREATION
    // ============================================================================
    // Professional spacing constants - balanced for single page with better readability
    const SPACING = {
      SECTION: 16,
      SUBSECTION: 10,
      LINE: 10,
      SMALL: 4,
      MARGIN: 28,
      PADDING: 8,
    }

    // Professional color constants
    const COLORS = {
      PRIMARY: '#0f172a',
      SECONDARY: '#475569',
      TERTIARY: '#64748b',
      BORDER: '#cbd5e1',
      BORDER_DARK: '#94a3b8',
      BACKGROUND: '#f8fafc',
      ACCENT: '#146eb4',
      BRAND_SOFT: '#eff6ff',
      BRAND_WARM: '#f8fafc',
      DISCOUNT: '#dc2626',
    }

    // Professional font sizes
    const FONTS = {
      TITLE: 20,
      HEADING: 10,
      BODY: 8.5,
      SMALL: 7.5,
      LARGE: 16,
      TABLE_HEADER: 7.6,
      TABLE_BODY: 7.9,
    }

    const doc = new PDFDocument({
      size: 'A4',
      bufferPages: true,
      margins: {
        top: SPACING.MARGIN,
        bottom: SPACING.MARGIN,
        left: SPACING.MARGIN,
        right: SPACING.MARGIN,
      },
      info: {
        Title:
          invoiceType === 'CREDIT_NOTE'
            ? `Credit Note ${invoiceNumber}`
            : invoiceType === 'DEBIT_NOTE'
            ? `Debit Note ${invoiceNumber}`
            : `Invoice ${invoiceNumber}`,
        Author: branding.companyName || 'Kourier Boyz Marketplace',
        Subject:
          invoiceType === 'CREDIT_NOTE'
            ? `Credit Note for Order ${order.orderNumber}`
            : invoiceType === 'DEBIT_NOTE'
            ? `Debit Note for Order ${order.orderNumber}`
            : `Invoice for Order ${order.orderNumber}`,
      },
    })

    const pageWidth = doc.page.width || 595
    const pageHeight = doc.page.height || 842
    const contentRight = pageWidth - SPACING.MARGIN
    const contentWidth = pageWidth - SPACING.MARGIN * 2

    // Register Unicode fonts if available (for Hindi, currency symbols, etc.)
    let unicodeFontAvailable = false
    let unicodeFontPath: string | null = null
    let unicodeBoldFontPath: string | null = null

    try {
      // Common paths for Unicode fonts (prioritize backend/fonts/ directory)
      const fontPaths = [
        path.join(process.cwd(), 'fonts', 'NotoSans-Regular.ttf'),
        path.join(process.cwd(), 'fonts', 'NotoSans-Bold.ttf'),
        path.join(process.cwd(), 'fonts', 'ArialUnicodeMS.ttf'),
        path.join(process.cwd(), 'backend', 'fonts', 'NotoSans-Regular.ttf'),
        path.join(process.cwd(), 'backend', 'fonts', 'NotoSans-Bold.ttf'),
        '/System/Library/Fonts/Supplemental/Arial Unicode.ttf', // macOS
        'C:/Windows/Fonts/arialuni.ttf', // Windows
        '/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf', // Linux
        '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', // Linux DejaVu
      ]

      // Register regular Unicode font
      const regularFontPath = fontPaths.find((p) => {
        try {
          return fs.existsSync(p)
        } catch {
          return false
        }
      })

      if (regularFontPath) {
        try {
          doc.registerFont('Unicode', regularFontPath)
          unicodeFontAvailable = true
          unicodeFontPath = regularFontPath
          console.log(`✓ Registered Unicode font: ${regularFontPath}`)
        } catch (fontError) {
          console.warn(`⚠️ Failed to register Unicode font from ${regularFontPath}:`, fontError)
        }
      }

      // Register bold Unicode font
      const boldFontPaths = [
        path.join(process.cwd(), 'fonts', 'NotoSans-Bold.ttf'),
        path.join(process.cwd(), 'backend', 'fonts', 'NotoSans-Bold.ttf'),
        path.join(process.cwd(), 'fonts', 'NotoSans-Regular.ttf'), // Fallback to regular
        path.join(process.cwd(), 'backend', 'fonts', 'NotoSans-Regular.ttf'),
        regularFontPath, // Use regular as fallback
      ]

      const boldFontPath = boldFontPaths.find((p) => {
        try {
          return p && fs.existsSync(p)
        } catch {
          return false
        }
      })

      if (boldFontPath) {
        try {
          if (boldFontPath !== regularFontPath) {
            doc.registerFont('Unicode-Bold', boldFontPath)
            unicodeBoldFontPath = boldFontPath
            console.log(`✓ Registered Unicode-Bold font: ${boldFontPath}`)
          } else if (regularFontPath) {
            // Use regular font as bold fallback
            doc.registerFont('Unicode-Bold', regularFontPath)
            unicodeBoldFontPath = regularFontPath
            console.log(
              `✓ Registered Unicode-Bold font (using regular as fallback): ${regularFontPath}`,
            )
          }
        } catch (fontError) {
          console.warn(`⚠️ Failed to register Unicode-Bold font from ${boldFontPath}:`, fontError)
        }
      }

      if (!unicodeFontAvailable) {
        console.warn(
          '⚠️ No Unicode fonts found. Currency symbols (₹, €, etc.) may display as boxes (□).',
        )
        console.warn(
          '💡 To fix: Download Noto Sans fonts and place them in backend/fonts/ directory:',
        )
        console.warn('   - NotoSans-Regular.ttf')
        console.warn('   - NotoSans-Bold.ttf')
        console.warn('   Download from: https://fonts.google.com/noto/specimen/Noto+Sans')
      }
    } catch (error) {
      console.error(
        '❌ Error registering Unicode fonts. Currency symbols may not display correctly:',
        error,
      )
    }

    // Monkey-patch doc.text to automatically use Unicode font for non-ASCII text and currency symbols
    if (unicodeFontAvailable) {
      const originalText = doc.text.bind(doc)
      ;(doc as any).text = function (text: any, x?: any, y?: any, options?: any): any {
        // Use getFontForText helper to determine the correct font
        if (typeof text === 'string') {
          // Check if current font is bold
          const currentFont = (this as any)._font
          const isBold = currentFont && currentFont.name && currentFont.name.includes('Bold')

          // Get appropriate font using helper function
          const appropriateFont = getFontForText(text, isBold)
          const previousFont = currentFont ? currentFont.name : 'Helvetica'

          // Only switch font if Unicode is needed
          if (appropriateFont.startsWith('Unicode')) {
            try {
              this.font(appropriateFont)

              // Call original text method
              const result = originalText(text, x, y, options)

              // Restore previous font
              this.font(previousFont)

              return result
            } catch (fontError) {
              // If Unicode font fails, try to restore and use original font
              console.warn(
                `⚠️ Failed to use Unicode font for text, falling back to default:`,
                fontError,
              )
              try {
                this.font(previousFont)
              } catch {
                // Ignore restore errors
              }
              // Fall back to original method
              return originalText(text, x, y, options)
            }
          }
        }
        // For ASCII text without currency symbols, use original method
        return originalText(text, x, y, options)
      }
    } else {
      // Even if Unicode fonts aren't available, warn about currency symbols
      const originalText = doc.text.bind(doc)
      ;(doc as any).text = function (text: any, x?: any, y?: any, options?: any): any {
        if (typeof text === 'string' && containsCurrencySymbol(text)) {
          console.warn(
            `⚠️ Currency symbol detected but Unicode font not available. Symbol may display as box (□). Text: ${text.substring(
              0,
              50,
            )}`,
          )
        }
        return originalText(text, x, y, options)
      }
    }

    const chunks: Buffer[] = []
    const pdfPromise = new Promise<Buffer>((resolve, reject) => {
      doc.on('data', (chunk: Buffer) => chunks.push(chunk))
      doc.once('end', () => {
        resolve(Buffer.concat(chunks))
      })
      doc.once('error', reject)
    })

    const drawInfoCard = (
      x: number,
      y: number,
      width: number,
      title: string,
      lines: string[],
      options?: { minHeight?: number; warm?: boolean },
    ) => {
      const usableLines = lines.filter(Boolean)
      const lineGap = 10
      const contentTop = y + 16
      const measuredHeight = contentTop + usableLines.length * lineGap - y + 4
      const height = Math.max(options?.minHeight || 58, measuredHeight)

      doc
        .font('Helvetica-Bold')
        .fontSize(FONTS.SMALL)
        .fillColor(COLORS.TERTIARY)
        .text(title.toUpperCase(), x, y, { width })

      doc
        .moveTo(x, y + 11)
        .lineTo(x + width, y + 11)
        .strokeColor(options?.warm ? COLORS.BORDER_DARK : COLORS.BORDER)
        .lineWidth(0.7)
        .stroke()

      let currentY = contentTop
      usableLines.forEach((line, index) => {
        doc
          .font(index === 0 ? 'Helvetica-Bold' : 'Helvetica')
          .fontSize(FONTS.BODY)
          .fillColor(index === 0 ? COLORS.PRIMARY : COLORS.SECONDARY)
          .text(line, x, currentY, { width })
        currentY += lineGap
      })

      doc.fillColor(COLORS.PRIMARY).font('Helvetica')
      return y + height
    }

    const drawMetaChip = (x: number, y: number, width: number, label: string, value: string) => {
      doc
        .font('Helvetica')
        .fontSize(FONTS.SMALL)
        .fillColor(COLORS.TERTIARY)
        .text(label.toUpperCase(), x, y, { width })
      doc
        .font('Helvetica-Bold')
        .fontSize(FONTS.BODY)
        .fillColor(COLORS.PRIMARY)
        .text(value, x, y + 10, { width, align: 'right' })
      doc.fillColor(COLORS.PRIMARY).font('Helvetica')
    }

    // Format date for use throughout the invoice
    const formattedDate = formatDate(invoiceIssueDate, invoiceSettings.dateFormat)

    // ============================================================================
    // HEADER SECTION
    // ============================================================================
    const headerTop = SPACING.MARGIN
    let headerBottom = headerTop + 54

    if (invoiceLogoBuffer) {
      doc.image(invoiceLogoBuffer, SPACING.MARGIN, headerTop, { fit: [110, 30] })
    } else {
      const companyName = branding.companyName || 'Kourier Boyz Marketplace'
      doc
        .font('Helvetica-Bold')
        .fontSize(FONTS.HEADING + 1)
        .fillColor(COLORS.PRIMARY)
        .text(companyName, SPACING.MARGIN, headerTop + 2)
    }

    // Header title - always show "Tax Invoice/Bill of Supply/Cash Memo" for buyer invoices
    if (effectiveAudience === 'buyer') {
      if (isTriplicateToSupplier) {
        doc
          .font('Helvetica-Bold')
          .fontSize(FONTS.SMALL + 1)
          .fillColor(COLORS.ACCENT)
          .text('Triplicate - To Supplier', 182, headerTop + 6, {
            width: 170,
            align: 'left',
          })
        doc
          .font('Helvetica-Bold')
          .fontSize(FONTS.TITLE)
          .fillColor(COLORS.PRIMARY)
          .text('TAX INVOICE', 182, headerTop + 20, {
            width: 200,
            align: 'left',
          })
      } else {
        doc
          .font('Helvetica-Bold')
          .fontSize(FONTS.TITLE)
          .fillColor(COLORS.PRIMARY)
          .text('TAX INVOICE', 182, headerTop + 10, {
            width: 200,
            align: 'left',
          })
      }
    } else {
      const headerTitle =
        invoiceType === 'CREDIT_NOTE'
          ? 'CREDIT NOTE'
          : invoiceType === 'DEBIT_NOTE'
          ? 'DEBIT NOTE'
          : 'TAX INVOICE'
      doc
        .font('Helvetica-Bold')
        .fontSize(FONTS.TITLE)
        .fillColor(COLORS.PRIMARY)
        .text(headerTitle, 182, headerTop + 10, { width: 200, align: 'left' })
    }

    drawMetaChip(392, headerTop + 2, 128, 'Invoice No.', invoiceNumber)
    drawMetaChip(392, headerTop + 24, 128, 'Issue Date', formattedDate)

    doc
      .moveTo(SPACING.MARGIN, headerBottom)
      .lineTo(contentRight, headerBottom)
      .strokeColor(COLORS.BORDER_DARK)
      .lineWidth(0.8)
      .stroke()

    doc.fillColor(COLORS.PRIMARY)
    doc.y = headerBottom + SPACING.SUBSECTION

    // For buyer invoices, skip meta row and go directly to "Sold By:" section
    // For seller invoices, show top meta row: Invoice No, Invoice Date, Due Date
    let soldByY: number
    let metaY: number | undefined
    if (effectiveAudience === 'buyer') {
      soldByY = doc.y
    } else {
      // Top meta row: Invoice No, Invoice Date, Due Date (for seller invoices)
      metaY = doc.y
      const createdDate = new Date(order.createdAt)
      const dueDate = formatDate(
        new Date(invoiceIssueDate.getTime() + 7 * 24 * 60 * 60 * 1000),
        invoiceSettings.dateFormat,
      )

      const documentLabel =
        invoiceType === 'CREDIT_NOTE'
          ? 'Credit Note No'
          : invoiceType === 'DEBIT_NOTE'
          ? 'Debit Note No'
          : 'Invoice No'
      doc
        .font('Helvetica')
        .fontSize(FONTS.BODY)
        .fillColor(COLORS.PRIMARY)
      
      // Calculate width of invoice number text to prevent overlap with date
      const invoiceNumberText = `${documentLabel}: ${invoiceNumber}`
      const invoiceNumberWidth = doc.widthOfString(invoiceNumberText)
      const invoiceNumberX = SPACING.MARGIN
      doc.text(invoiceNumberText, invoiceNumberX, metaY)
      
      // Position date label after invoice number with proper spacing (at least 20pt gap)
      const dateLabel =
        invoiceType === 'CREDIT_NOTE'
          ? 'Credit Note Date'
          : invoiceType === 'DEBIT_NOTE'
          ? 'Debit Note Date'
          : 'Invoice Date'
      const dateLabelText = `${dateLabel}: ${formattedDate}`
      const dateLabelWidth = doc.widthOfString(dateLabelText)
      const minSpacing = 20 // Minimum spacing between invoice number and date
      const dateX = Math.max(invoiceNumberX + invoiceNumberWidth + minSpacing, 230) // Use 230 as minimum position
      doc.text(dateLabelText, dateX, metaY)
      
      // Position due date after invoice date with proper spacing
      if (invoiceType === 'INVOICE') {
        const dueDateText = `Due Date: ${dueDate}`
        const dueDateWidth = doc.widthOfString(dueDateText)
        const dueDateMinX = dateX + dateLabelWidth + minSpacing
        const dueDateX = Math.max(dueDateMinX, 410) // Use 410 as minimum position
        doc.text(dueDateText, dueDateX, metaY)
      }

      // Professional horizontal rule
      doc
        .moveTo(SPACING.MARGIN, metaY + 20)
        .lineTo(contentRight, metaY + 20)
        .strokeColor(COLORS.BORDER_DARK)
        .lineWidth(1)
        .stroke()

      soldByY = metaY + 28
    }

    // ============================================================================
    // ADDRESS SECTIONS
    // ============================================================================
    // For buyer invoices, show "Sold By:" section with warehouse address
    if (effectiveAudience === 'buyer') {
      const orderWithShipments = order as any
      const warehouseAddress =
        orderWithShipments.sellerShipments?.[0]?.shippingMeta?.pickup_address ||
        orderWithShipments.sellerShipments?.[0]?.courierCart?.pickup_address ||
        null

      const sellerName = seller?.businessName || seller?.name || branding.companyName || 'Seller'
      const soldByLines: string[] = [sellerName]

      if (warehouseAddress) {
        if (warehouseAddress.warehouseName && warehouseAddress.warehouseName !== sellerName) {
          soldByLines.push(warehouseAddress.warehouseName)
        }
        soldByLines.push(
          warehouseAddress.addressLine1 +
            (warehouseAddress.addressLine2 ? `, ${warehouseAddress.addressLine2}` : ''),
        )
        soldByLines.push(
          `${warehouseAddress.city}, ${warehouseAddress.state} ${warehouseAddress.postalCode}`,
        )
        soldByLines.push(`${warehouseAddress.country || 'India'}, IN`)
      } else if (seller) {
        if (seller.addressLine1) {
          soldByLines.push(
            seller.addressLine1 + (seller.addressLine2 ? `, ${seller.addressLine2}` : ''),
          )
        }
        if (seller.city && seller.state && seller.postalCode) {
          soldByLines.push(`${seller.city}, ${seller.state} ${seller.postalCode}`)
        }
        if (seller.country) {
          soldByLines.push(`${seller.country}, IN`)
        }
      }

      if (seller?.panNumber) {
        soldByLines.push(`PAN No: ${seller.panNumber}`)
      }
      if (seller?.gstNumber) {
        soldByLines.push(`GST Registration No: ${seller.gstNumber}`)
      }

      doc.y = drawInfoCard(SPACING.MARGIN, soldByY, 495, 'Sold by', soldByLines, {
        minHeight: 90,
        warm: true,
      }) + SPACING.SUBSECTION
    }

    // Billing & Shipping Address blocks (for buyer invoices)
    if (effectiveAudience === 'buyer') {
      const customerName = customer.name || order.shippingAddress?.name || 'Customer'
      const billShipY = doc.y + 2
      const columnWidth = 242
      const billingLines = [customerName]
      const shippingLines = [customerName]

      if (order.shippingAddress) {
        billingLines.push(order.shippingAddress.addressLine1)
        if (order.shippingAddress.addressLine2) {
          billingLines.push(order.shippingAddress.addressLine2)
        }
        billingLines.push(
          `${order.shippingAddress.city}, ${order.shippingAddress.state} ${order.shippingAddress.postalCode}`,
        )
        billingLines.push(`${order.shippingAddress.country}, IN`)
        billingLines.push(`State/UT Code: ${getStateCode(order.shippingAddress.state)}`)
        // GST Compliance: Unregistered buyers must be shown as "URP" (Unregistered Person)
        billingLines.push(
          `GST Registration No: ${customer.gstNumber ? customer.gstNumber : 'URP'}`,
        )

        shippingLines.push(order.shippingAddress.addressLine1)
        if (order.shippingAddress.addressLine2) {
          shippingLines.push(order.shippingAddress.addressLine2)
        }
        shippingLines.push(
          `${order.shippingAddress.city}, ${order.shippingAddress.state} ${order.shippingAddress.postalCode}`,
        )
        shippingLines.push(`${order.shippingAddress.country}, IN`)
        shippingLines.push(`State/UT Code: ${getStateCode(order.shippingAddress.state)}`)
        shippingLines.push(`Place of supply: ${order.shippingAddress.state.toUpperCase()}`)
        shippingLines.push(`Place of delivery: ${order.shippingAddress.state.toUpperCase()}`)
        shippingLines.push(
          `GST Registration No: ${customer.gstNumber ? customer.gstNumber : 'URP'}`,
        )
      }

      const billBottom = drawInfoCard(SPACING.MARGIN, billShipY, columnWidth, 'Billing Address', billingLines, {
        minHeight: 120,
      })
      const shipBottom = drawInfoCard(
        SPACING.MARGIN + columnWidth + 11,
        billShipY,
        columnWidth,
        'Shipping Address',
        shippingLines,
        { minHeight: 120 },
      )

      doc.y = Math.max(billBottom, shipBottom) + SPACING.SUBSECTION
    } else {
      // For seller invoices, keep original BILL TO / SHIP TO format
      const billShipY = (metaY ?? doc.y) + 26
      const columnWidth = 247

      // BILL TO (for seller invoices, show seller info)
      doc
        .font('Helvetica-Bold')
        .fontSize(FONTS.HEADING)
        .fillColor(COLORS.PRIMARY)
        .text('BILL TO', SPACING.MARGIN, billShipY)
      doc
        .moveTo(SPACING.MARGIN, billShipY + 14)
        .lineTo(SPACING.MARGIN + columnWidth, billShipY + 14)
        .strokeColor(COLORS.PRIMARY)
        .lineWidth(1)
        .stroke()
      doc.font('Helvetica').fontSize(FONTS.BODY).fillColor(COLORS.PRIMARY)

      // Track bottom positions of both sections to allow flexible vertical space
      let billBottomY = billShipY + 20 // Start after header
      let shipBottomY = billShipY + 20 // Start after header

      // For seller invoices, show seller business info
      if (audience === 'seller' && seller) {
        const sellerName = seller.businessName || seller.name || 'Seller'
        doc.font('Helvetica-Bold').text(sellerName, 50, billShipY + 20)
        let currentLineY = billShipY + 36 // Increased spacing after name
        if (seller.addressLine1) {
          doc
            .font('Helvetica')
            .text(
              seller.addressLine1 + (seller.addressLine2 ? `, ${seller.addressLine2}` : ''),
              50,
              currentLineY,
            )
          currentLineY += 14 // Increased spacing
        }
        if (seller.city && seller.state && seller.postalCode) {
          doc.text(`${seller.city}, ${seller.state} ${seller.postalCode}`, 50, currentLineY)
          currentLineY += 14 // Increased spacing
        }
        if (seller.country) {
          doc.text(seller.country, 50, currentLineY)
          currentLineY += 14 // Increased spacing
        }
        if (seller.panNumber) {
          doc.text(`PAN No: ${seller.panNumber}`, 50, currentLineY)
          currentLineY += 14 // Increased spacing
        }
        if (seller.gstNumber) {
          doc.text(`GST Registration No: ${seller.gstNumber}`, 50, currentLineY)
          currentLineY += 14 // Increased spacing
        }
        // Track the actual bottom of BILL TO section
        billBottomY = currentLineY
      } else {
        // For other invoice types, show customer info
        doc.text(customer.name || order.shippingAddress?.name || 'Customer', 50, billShipY + 20)
        let currentLineY = billShipY + 42 // Little margin below buyer name
        if (order.shippingAddress) {
          doc.text(order.shippingAddress.addressLine1, 50, currentLineY)
          currentLineY += 14 // Increased spacing
          if (order.shippingAddress.addressLine2) {
            doc.text(order.shippingAddress.addressLine2, 50, currentLineY)
            currentLineY += 14 // Increased spacing
          }
          doc.text(
            `${order.shippingAddress.city}, ${order.shippingAddress.state} ${order.shippingAddress.postalCode}`,
            50,
            currentLineY,
          )
          currentLineY += 14 // Increased spacing
          doc.text(order.shippingAddress.country, 50, currentLineY)
          if (order.shippingAddress.phone) {
            currentLineY += 14 // Increased spacing
            doc.text(`Phone: ${order.shippingAddress.phone}`, 50, currentLineY)
          }
          // Track the actual bottom of BILL TO section
          billBottomY = currentLineY
        } else {
          billBottomY = billShipY + 42
        }
      }

      // SHIP TO
      doc
        .font('Helvetica-Bold')
        .fontSize(FONTS.HEADING)
        .fillColor(COLORS.PRIMARY)
        .text('SHIP TO', SPACING.MARGIN + columnWidth + 10, billShipY)
      doc
        .moveTo(SPACING.MARGIN + columnWidth + 10, billShipY + 14)
        .lineTo(545, billShipY + 14)
        .strokeColor(COLORS.PRIMARY)
        .lineWidth(1)
        .stroke()
      doc.font('Helvetica').fontSize(FONTS.BODY).fillColor(COLORS.PRIMARY)
      if (order.shippingAddress) {
        const shipX = 50 + columnWidth + 10
        doc.text(order.shippingAddress.name, shipX, billShipY + 20)
        let currentLineY = billShipY + 42 // Little margin below buyer name
        doc.text(order.shippingAddress.addressLine1, shipX, currentLineY)
        currentLineY += 14 // Increased spacing
        if (order.shippingAddress.addressLine2) {
          doc.text(order.shippingAddress.addressLine2, shipX, currentLineY)
          currentLineY += 14 // Increased spacing
        }
        doc.text(
          `${order.shippingAddress.city}, ${order.shippingAddress.state} ${order.shippingAddress.postalCode}`,
          shipX,
          currentLineY,
        )
        currentLineY += 14 // Increased spacing
        doc.text(order.shippingAddress.country, shipX, currentLineY)
        if (order.shippingAddress.phone) {
          currentLineY += 14 // Increased spacing
          doc.text(`Phone: ${order.shippingAddress.phone}`, shipX, currentLineY)
        }
        // Track the actual bottom of SHIP TO section
        shipBottomY = currentLineY
      } else {
        shipBottomY = billShipY + 42
      }

      // Use the maximum bottom position of both sections, plus spacing for next section
      doc.y = Math.max(billBottomY, shipBottomY) + SPACING.SUBSECTION
    }

    doc.fillColor('#000000')

    // Order Details & Invoice Details (for buyer invoices)
    if (effectiveAudience === 'buyer') {
      const detailsY = doc.y
      const leftBottom = drawInfoCard(
        SPACING.MARGIN,
        detailsY,
        242,
        'Order Details',
        [
          `Order Number: ${order.orderNumber || getIdString(order._id)}`,
          `Order Date: ${formatDate(new Date(order.createdAt), invoiceSettings.dateFormat)}`,
        ],
        { minHeight: 72 },
      )
      const rightBottom = drawInfoCard(
        SPACING.MARGIN + 253,
        detailsY,
        242,
        'Invoice Details',
        [`Invoice Number: ${invoiceNumber}`, `Invoice Date: ${formattedDate}`],
        { minHeight: 72 },
      )

      doc.y = Math.max(leftBottom, rightBottom) + SPACING.SUBSECTION
    }

    // ============================================================================
    // ITEMS TABLE SECTION
    // ============================================================================
    // Leave a compact but safe bottom reserve for signature/footer/page number.
    const pageBreakThreshold = pageHeight - SPACING.MARGIN - 24

    const showGstBreakup = invoiceSettings.showGstBreakup
    const tableTop = doc.y + SPACING.SUBSECTION // Use SUBSECTION spacing
    const rowHeight = 30 // Slightly increased from 25
    const tableLeft = SPACING.MARGIN
    const tableRight = contentRight
    const tableWidth = contentWidth

    // Calculate column widths based on GST breakup visibility and audience
    // Must fit within tableWidth (495pt) - A4 width (595) - margins (50+50)
    const calculateColumnWidths = () => {
      // Base widths that will be adjusted to fit
      const baseWidths = {
        slNo: 30, // Sl. No - small column
        description: showGstBreakup
          ? effectiveAudience === 'buyer'
            ? 100 // Description with GST breakup and buyer columns
            : 120 // Description with GST breakup for seller
          : effectiveAudience === 'buyer'
          ? 150 // Description without GST breakup for buyer
          : 170, // Description without GST breakup for seller
        hsn: 35, // HSN - medium column
        qty: 25, // Qty - small column
        sellingPrice: effectiveAudience === 'buyer' ? 55 : 0, // Selling Price (Excl. GST)
        discount: effectiveAudience === 'buyer' ? 45 : 0, // Discount
        netAmount: 50, // Taxable Value
        taxRate: showGstBreakup ? 35 : 0, // Tax Rate
        taxType: showGstBreakup ? 40 : 0, // Tax Type
        taxAmount: showGstBreakup ? 45 : 0, // Tax Amount
        totalAmount: 50, // Total Amount
      }

      // Calculate total width
      let totalWidth =
        baseWidths.slNo +
        baseWidths.description +
        baseWidths.hsn +
        baseWidths.qty +
        baseWidths.sellingPrice +
        baseWidths.discount +
        baseWidths.netAmount +
        baseWidths.taxRate +
        baseWidths.taxType +
        baseWidths.taxAmount +
        baseWidths.totalAmount

      // If exceeds table width, scale down proportionally
      if (totalWidth > tableWidth) {
        const scaleFactor = tableWidth / totalWidth
        baseWidths.slNo = Math.round(baseWidths.slNo * scaleFactor)
        baseWidths.description = Math.round(baseWidths.description * scaleFactor)
        baseWidths.hsn = Math.round(baseWidths.hsn * scaleFactor)
        baseWidths.qty = Math.round(baseWidths.qty * scaleFactor)
        if (baseWidths.sellingPrice > 0) {
          baseWidths.sellingPrice = Math.round(baseWidths.sellingPrice * scaleFactor)
        }
        if (baseWidths.discount > 0) {
          baseWidths.discount = Math.round(baseWidths.discount * scaleFactor)
        }
        baseWidths.netAmount = Math.round(baseWidths.netAmount * scaleFactor)
        if (baseWidths.taxRate > 0) {
          baseWidths.taxRate = Math.round(baseWidths.taxRate * scaleFactor)
        }
        if (baseWidths.taxType > 0) {
          baseWidths.taxType = Math.round(baseWidths.taxType * scaleFactor)
        }
        if (baseWidths.taxAmount > 0) {
          baseWidths.taxAmount = Math.round(baseWidths.taxAmount * scaleFactor)
        }
        baseWidths.totalAmount = Math.round(baseWidths.totalAmount * scaleFactor)

        // Recalculate to ensure we're within bounds
        totalWidth =
          baseWidths.slNo +
          baseWidths.description +
          baseWidths.hsn +
          baseWidths.qty +
          baseWidths.sellingPrice +
          baseWidths.discount +
          baseWidths.netAmount +
          baseWidths.taxRate +
          baseWidths.taxType +
          baseWidths.taxAmount +
          baseWidths.totalAmount

        // Final adjustment: if still over, reduce description column
        if (totalWidth > tableWidth) {
          const excess = totalWidth - tableWidth
          baseWidths.description = Math.max(60, baseWidths.description - excess)
        }
      }

      return baseWidths
    }

    const colWidths = calculateColumnWidths()

    // Helper function to draw table header - matches frontend exactly
    const drawTableHeader = (yPosition: number) => {
      const headerHeight = 30 // Slightly increased from 28
      const headerTextY = yPosition + headerHeight / 2 - 3
      const cellPadding = 3 // Match frontend p-3 padding

      // Gray background for header (matches frontend bg-gray-100)
      doc.rect(tableLeft, yPosition, tableWidth, headerHeight).fill(COLORS.BACKGROUND)

      doc.fillColor(COLORS.ACCENT)
      doc.font('Helvetica-Bold').fontSize(FONTS.TABLE_HEADER)

      let headerX = tableLeft
      const drawHeaderBorder = (x: number) => {
        // Vertical borders between columns removed (no dark gray borders)
      }

      // Column headers with proper padding (matches frontend p-3 = 12px = 3pt padding)
      doc.text('Sl. No', headerX + cellPadding, headerTextY, {
        width: colWidths.slNo - cellPadding * 2,
        align: 'left',
      })
      headerX += colWidths.slNo
      drawHeaderBorder(headerX)

      doc.text('Description', headerX + cellPadding, headerTextY, {
        width: colWidths.description - cellPadding * 2,
        align: 'left',
      })
      headerX += colWidths.description
      drawHeaderBorder(headerX)

      doc.text('HSN', headerX, headerTextY, { width: colWidths.hsn, align: 'center' })
      headerX += colWidths.hsn
      drawHeaderBorder(headerX)

      doc.text('Qty', headerX, headerTextY, { width: colWidths.qty, align: 'center' })
      headerX += colWidths.qty
      drawHeaderBorder(headerX)

      if (effectiveAudience === 'buyer') {
        doc.text('Selling Price\n(Excl GST)', headerX, yPosition + 4, {
          width: colWidths.sellingPrice,
          align: 'right',
          lineGap: 2,
        })
        headerX += colWidths.sellingPrice
        drawHeaderBorder(headerX)

        doc.text('Discount', headerX, headerTextY, {
          width: colWidths.discount,
          align: 'right',
        })
        headerX += colWidths.discount
        drawHeaderBorder(headerX)
      }

      doc.text('Taxable Value', headerX, headerTextY, {
        width: colWidths.netAmount,
        align: 'right',
      })
      headerX += colWidths.netAmount
      drawHeaderBorder(headerX)

      if (showGstBreakup) {
        doc.text('Tax Rate', headerX, headerTextY, {
          width: colWidths.taxRate,
          align: 'center',
        })
        headerX += colWidths.taxRate
        drawHeaderBorder(headerX)

        doc.text('Tax Type', headerX, headerTextY, {
          width: colWidths.taxType,
          align: 'right',
        })
        headerX += colWidths.taxType
        drawHeaderBorder(headerX)

        doc.text('Tax Amount', headerX, headerTextY, {
          width: colWidths.taxAmount,
          align: 'right',
        })
        headerX += colWidths.taxAmount
        drawHeaderBorder(headerX)
      }

      doc.text('Total Amount', headerX, headerTextY, {
        width: colWidths.totalAmount,
        align: 'right',
      })

      // Dark gray borders removed

      doc.fillColor(COLORS.PRIMARY)
      return yPosition + headerHeight + 8
    }

    // Draw initial table header
    doc.y = drawTableHeader(tableTop)

    doc.font('Helvetica').fontSize(FONTS.TABLE_BODY)
    let currentY = doc.y

    // Track GST totals computed from line items (used for totals box)
    let computedTotalTax = 0
    let totalTaxableValue = 0 // Track total taxable value (sum of all item subtotals)

    // Aggregate per HSN/SAC for the HSN summary table required by GST rules
    type HsnBucket = {
      hsn: string
      taxable: number
      gstRate: number
      igst: number
      cgst: number
      sgst: number
    }
    const hsnBuckets = new Map<string, HsnBucket>()

    const minRowHeight = 30

    items.forEach((item, index) => {
      const productName = item.product?.name || 'Product'
      const variantName = item.variant?.name ? ` - ${item.variant.name}` : ''
      const itemName = `${productName}${variantName}`

      const orderItem = item.orderItem
      const lineAmounts = calculateInvoiceLineAmounts(orderItem)
      const quantity = lineAmounts.quantity
      const taxableValue = lineAmounts.taxableValue
      const gstRatePercent = lineAmounts.gstRatePercent
      const gstTaxType = lineAmounts.gstTaxType
      const hsnCode = orderItem.hsnSacCode || '-'
      const sellingPriceExclGst = lineAmounts.sellingPriceExclGst
      const itemDiscount = lineAmounts.itemDiscount
      const igstAmount = lineAmounts.igstAmount
      const cgstAmount = lineAmounts.cgstAmount
      const sgstAmount = lineAmounts.sgstAmount
      const lineTaxTotal = lineAmounts.lineTaxTotal
      const lineGrandTotal = lineAmounts.lineGrandTotal
      computedTotalTax += lineTaxTotal
      totalTaxableValue += taxableValue // Accumulate total taxable value

      // Aggregate by HSN/SAC + GST rate for the GST-mandated HSN summary table
      const hsnKey = `${hsnCode}|${gstRatePercent}`
      const bucket = hsnBuckets.get(hsnKey) || {
        hsn: hsnCode,
        taxable: 0,
        gstRate: gstRatePercent,
        igst: 0,
        cgst: 0,
        sgst: 0,
      }
      bucket.taxable += taxableValue
      bucket.igst += igstAmount
      bucket.cgst += cgstAmount
      bucket.sgst += sgstAmount
      hsnBuckets.set(hsnKey, bucket)

      // Wrap long item names within description column
      // Use description width minus padding to ensure text doesn't overflow
      const cellPadding = 3 // Match frontend p-3 padding (12px = 3pt)
      const descMaxWidth = colWidths.description - cellPadding * 2
      const nameHeight = doc.heightOfString(itemName, { width: descMaxWidth })
      const itemTextHeight = Math.max(rowHeight, nameHeight + cellPadding * 2)

      // Check if we need a new page before drawing the row
      // Use actual row height to prevent row from being cut off
      if (currentY + itemTextHeight > pageBreakThreshold) {
        doc.addPage()
        currentY = SPACING.MARGIN // Start from top margin of new page
        currentY = drawTableHeader(currentY) // Redraw table header on new page
      }

      // Top border of row (matches frontend border-b)
      const rowTop = currentY - 6
      doc
        .moveTo(tableLeft, rowTop)
        .lineTo(tableRight, rowTop)
        .strokeColor('#e5e7eb') // border-gray-200
        .lineWidth(1)
        .stroke()

      let colX = tableLeft
      doc.fillColor(COLORS.PRIMARY)

      // Helper function to draw vertical borders (matches frontend border-r border-gray-200)
      const drawRowBorder = (x: number, rowTop: number, rowBottom: number) => {
        doc
          .moveTo(x, rowTop)
          .lineTo(x, rowBottom)
          .strokeColor('#e5e7eb') // border-gray-200
          .lineWidth(1)
          .stroke()
      }

      const rowBottom = rowTop + itemTextHeight

      // Left border of row (matches frontend border-l)
      doc
        .moveTo(tableLeft, rowTop)
        .lineTo(tableLeft, rowBottom)
        .strokeColor('#e5e7eb') // border-gray-200
        .lineWidth(1)
        .stroke()

      // Sl. No
      doc.text((index + 1).toString(), colX + cellPadding, currentY, {
        width: colWidths.slNo - cellPadding * 2,
        align: 'left',
      })
      colX += colWidths.slNo
      drawRowBorder(colX, rowTop, rowBottom)

      // DESCRIPTION - ensure text wraps and doesn't overflow (left-aligned like frontend)
      doc.text(itemName, colX + cellPadding, currentY, {
        width: descMaxWidth,
        align: 'left',
      })
      colX += colWidths.description
      drawRowBorder(colX, rowTop, rowBottom)

      // HSN Code
      doc.text(hsnCode, colX, currentY, {
        width: colWidths.hsn,
        align: 'center',
      })
      colX += colWidths.hsn
      drawRowBorder(colX, rowTop, rowBottom)

      // QTY
      doc.text(quantity.toString(), colX, currentY, {
        width: colWidths.qty,
        align: 'center',
      })
      colX += colWidths.qty
      drawRowBorder(colX, rowTop, rowBottom)

      // For buyer invoices: Show Selling Price and Discount
      if (effectiveAudience === 'buyer') {
        // Selling Price (Excl. GST)
        doc.text(
          formatCurrency(
            sellingPriceExclGst,
            invoiceSettings.currency,
            invoiceSettings.roundingMode,
          ),
          colX,
          currentY,
          {
            width: colWidths.sellingPrice,
            align: 'right',
          },
        )
        colX += colWidths.sellingPrice
        drawRowBorder(colX, rowTop, rowBottom)

        // Discount (in red color)
        if (itemDiscount > 0) {
          doc.fillColor(COLORS.DISCOUNT)
          doc.text(
            `-${formatCurrency(
              itemDiscount,
              invoiceSettings.currency,
              invoiceSettings.roundingMode,
            )}`,
            colX,
            currentY,
            {
              width: colWidths.discount,
              align: 'right',
            },
          )
          doc.fillColor(COLORS.PRIMARY) // Reset to primary color
        } else {
          doc.text('-', colX, currentY, {
            width: colWidths.discount,
            align: 'right',
          })
        }
        colX += colWidths.discount
        drawRowBorder(colX, rowTop, rowBottom)
      }

      // Taxable Value
      doc.text(
        formatCurrency(taxableValue, invoiceSettings.currency, invoiceSettings.roundingMode),
        colX,
        currentY,
        {
          width: colWidths.netAmount,
          align: 'right',
        },
      )
      colX += colWidths.netAmount
      drawRowBorder(colX, rowTop, rowBottom)

      if (showGstBreakup) {
        // Tax Rate (matches frontend format - just number with %)
        const gstPercentDisplay = gstRatePercent > 0 ? `${gstRatePercent}%` : '-'
        doc.text(gstPercentDisplay, colX, currentY, {
          width: colWidths.taxRate,
          align: 'center',
        })
        colX += colWidths.taxRate
        drawRowBorder(colX, rowTop, rowBottom)

        // Tax Type
        const rawTaxType = gstTaxType || 'IGST'
        const taxTypeDisplay =
          gstRatePercent > 0 ? (rawTaxType === 'CGST_SGST' ? 'CGST+SGST' : rawTaxType) : '-'
        doc.text(taxTypeDisplay, colX, currentY, {
          width: colWidths.taxType,
          align: 'right',
        })
        colX += colWidths.taxType
        drawRowBorder(colX, rowTop, rowBottom)

        // Tax Amount (total of IGST + CGST + SGST)
        const totalTaxAmount = igstAmount + cgstAmount + sgstAmount
        doc.text(
          totalTaxAmount > 0
            ? formatCurrency(totalTaxAmount, invoiceSettings.currency, invoiceSettings.roundingMode)
            : '-',
          colX,
          currentY,
          { width: colWidths.taxAmount, align: 'right' },
        )
        colX += colWidths.taxAmount
        drawRowBorder(colX, rowTop, rowBottom)
      }

      // Line Total (Taxable + GST) - bold for emphasis (matches frontend font-semibold)
      doc.font('Helvetica-Bold')
      doc.text(
        formatCurrency(lineGrandTotal, invoiceSettings.currency, invoiceSettings.roundingMode),
        colX,
        currentY,
        { width: colWidths.totalAmount, align: 'right' },
      )
      doc.font('Helvetica')

      // Right border of row (matches frontend border-r)
      doc
        .moveTo(tableRight, rowTop)
        .lineTo(tableRight, rowBottom)
        .strokeColor('#e5e7eb') // border-gray-200
        .lineWidth(1)
        .stroke()

      // Bottom border of row (matches frontend border-b)
      doc
        .moveTo(tableLeft, rowBottom)
        .lineTo(tableRight, rowBottom)
        .strokeColor('#e5e7eb') // border-gray-200
        .lineWidth(1)
        .stroke()

      currentY += itemTextHeight
    })

    // Dark gray borders removed from table
    doc.y = currentY + SPACING.SUBSECTION // Use SUBSECTION spacing

    // Add shipping as a separate HSN bucket (SAC 9968 - Goods transport agency)
    // so it appears in the HSN summary alongside items.
    const orderShippingForHsn = typeof order.shipping === 'number' ? order.shipping : 0
    if (orderShippingForHsn > 0) {
      const shippingGstRate = 18
      const shippingBase = orderShippingForHsn / (1 + shippingGstRate / 100)
      const shippingGst = orderShippingForHsn - shippingBase
      const shippingTaxType = (order as any)?.items?.[0]?.gstTaxType || 'IGST'
      hsnBuckets.set('9968|18', {
        hsn: '9968',
        taxable: shippingBase,
        gstRate: shippingGstRate,
        igst: shippingTaxType === 'IGST' ? shippingGst : 0,
        cgst: shippingTaxType === 'CGST_SGST' ? shippingGst / 2 : 0,
        sgst: shippingTaxType === 'CGST_SGST' ? shippingGst / 2 : 0,
      })
    }

    // ============================================================================
    // HSN/SAC SUMMARY TABLE (mandatory under GST for B2B and high-value invoices)
    // ============================================================================
    if (hsnBuckets.size > 0) {
      const hsnStartY = doc.y
      const hsnHeaderH = 14
      const hsnRowH = 14
      const estimatedHsnHeight = hsnHeaderH + hsnRowH * (hsnBuckets.size + 1) + 6
      if (hsnStartY + estimatedHsnHeight > pageBreakThreshold) {
        doc.addPage()
        doc.y = SPACING.MARGIN
      }

      const hsnLeft = SPACING.MARGIN
      const hsnWidth = 545 - SPACING.MARGIN
      const hsnCols = [
        { key: 'hsn', label: 'HSN/SAC', width: 80, align: 'left' as const },
        { key: 'taxable', label: 'Taxable Value', width: 90, align: 'right' as const },
        { key: 'rate', label: 'GST %', width: 50, align: 'right' as const },
        { key: 'igst', label: 'IGST', width: 75, align: 'right' as const },
        { key: 'cgst', label: 'CGST', width: 75, align: 'right' as const },
        { key: 'sgst', label: 'SGST', width: 75, align: 'right' as const },
        { key: 'total', label: 'Total Tax', width: 100, align: 'right' as const },
      ]

      doc
        .font('Helvetica-Bold')
        .fontSize(FONTS.SMALL)
        .fillColor(COLORS.PRIMARY)
        .text('HSN/SAC Summary', hsnLeft, doc.y, { width: hsnWidth, align: 'left' })
      doc.y += 4

      const drawHsnRow = (
        y: number,
        cells: string[],
        opts: { header?: boolean; bg?: boolean } = {},
      ) => {
        let x = hsnLeft
        if (opts.bg) {
          doc
            .rect(hsnLeft, y, hsnWidth, hsnRowH)
            .fillColor('#f3f4f6')
            .fill()
            .fillColor(COLORS.PRIMARY)
        }
        doc.font(opts.header ? 'Helvetica-Bold' : 'Helvetica').fontSize(FONTS.TABLE_BODY)
        hsnCols.forEach((col, i) => {
          doc.text(cells[i], x + 3, y + 3, {
            width: col.width - 6,
            align: col.align,
          })
          x += col.width
        })
        doc
          .moveTo(hsnLeft, y + hsnRowH)
          .lineTo(hsnLeft + hsnWidth, y + hsnRowH)
          .strokeColor('#e5e7eb')
          .lineWidth(0.6)
          .stroke()
      }

      drawHsnRow(doc.y, hsnCols.map((c) => c.label), { header: true, bg: true })
      doc.y += hsnRowH

      let totalTaxable = 0,
        totalIgst = 0,
        totalCgst = 0,
        totalSgst = 0
      Array.from(hsnBuckets.values())
        .sort((a, b) => a.hsn.localeCompare(b.hsn))
        .forEach((b) => {
          totalTaxable += b.taxable
          totalIgst += b.igst
          totalCgst += b.cgst
          totalSgst += b.sgst
          const totalTax = b.igst + b.cgst + b.sgst
          drawHsnRow(doc.y, [
            b.hsn,
            formatCurrency(b.taxable, invoiceSettings.currency, invoiceSettings.roundingMode),
            b.gstRate > 0 ? `${b.gstRate}%` : '-',
            b.igst > 0 ? formatCurrency(b.igst, invoiceSettings.currency, invoiceSettings.roundingMode) : '-',
            b.cgst > 0 ? formatCurrency(b.cgst, invoiceSettings.currency, invoiceSettings.roundingMode) : '-',
            b.sgst > 0 ? formatCurrency(b.sgst, invoiceSettings.currency, invoiceSettings.roundingMode) : '-',
            formatCurrency(totalTax, invoiceSettings.currency, invoiceSettings.roundingMode),
          ])
          doc.y += hsnRowH
        })

      drawHsnRow(
        doc.y,
        [
          'Total',
          formatCurrency(totalTaxable, invoiceSettings.currency, invoiceSettings.roundingMode),
          '',
          totalIgst > 0 ? formatCurrency(totalIgst, invoiceSettings.currency, invoiceSettings.roundingMode) : '-',
          totalCgst > 0 ? formatCurrency(totalCgst, invoiceSettings.currency, invoiceSettings.roundingMode) : '-',
          totalSgst > 0 ? formatCurrency(totalSgst, invoiceSettings.currency, invoiceSettings.roundingMode) : '-',
          formatCurrency(totalIgst + totalCgst + totalSgst, invoiceSettings.currency, invoiceSettings.roundingMode),
        ],
        { header: true, bg: true },
      )
      doc.y += hsnRowH + SPACING.SUBSECTION
    }

    // ============================================================================
    // TOTALS SECTION - structured summary card
    // ============================================================================
    const renderTotalsSection = () => {
      const estimatedTotalsHeight = 170
      if (doc.y + estimatedTotalsHeight > pageBreakThreshold) {
        doc.addPage()
        doc.y = SPACING.MARGIN
      }

      const totalsStartY = doc.y
      const totalsSectionLeft = 300
      const totalsSectionWidth = 245
      const labelWidth = 110
      const valueWidth = 100
      const lineSpacing = 11

      // Calculate all values first
      const baseDiscount = typeof order.discount === 'number' ? order.discount : 0
      const baseShipping = typeof order.shipping === 'number' ? order.shipping : 0
      const orderLevelTax = typeof order.tax === 'number' ? order.tax : 0
      const taxToDisplay = computedTotalTax > 0 ? computedTotalTax : orderLevelTax
      const computedGrandTotal = totalTaxableValue + taxToDisplay + baseShipping - baseDiscount
      const totalToDisplay =
        typeof order.total === 'number' &&
        order.total > 0 &&
        Math.abs(order.total - computedGrandTotal) / computedGrandTotal < 0.01
          ? order.total
          : computedGrandTotal

      doc
        .font('Helvetica-Bold')
        .fontSize(FONTS.SMALL)
        .fillColor(COLORS.TERTIARY)
        .text('INVOICE SUMMARY', totalsSectionLeft, totalsStartY, {
          width: totalsSectionWidth,
          align: 'left',
        })

      doc
        .moveTo(totalsSectionLeft, totalsStartY + 10)
        .lineTo(totalsSectionLeft + totalsSectionWidth, totalsStartY + 10)
        .strokeColor(COLORS.BORDER_DARK)
        .lineWidth(0.7)
        .stroke()

      let currentY = totalsStartY + 16

      // Helper to render a totals line item (matches frontend flex justify-between text-sm)
      const renderTotalsLine = (
        label: string,
        value: number,
        options?: { color?: string; bold?: boolean; fontSize?: number; valueColor?: string },
      ) => {
        const textColor = options?.color || COLORS.SECONDARY // text-gray-700
        const valueColor = options?.valueColor || COLORS.PRIMARY // text-gray-900
        const fontSize = options?.fontSize || FONTS.BODY // text-sm

        doc.fontSize(fontSize)
        doc.fillColor(textColor)
        if (options?.bold) {
          doc.font('Helvetica-Bold')
        } else {
          doc.font('Helvetica')
        }
        doc.text(label, totalsSectionLeft, currentY, {
          width: labelWidth,
          align: 'right',
        })

        doc.fillColor(valueColor)
        doc.text(
          formatCurrency(value, invoiceSettings.currency, invoiceSettings.roundingMode),
          totalsSectionLeft + labelWidth + 8,
          currentY,
          {
            width: valueWidth,
            align: 'right',
          },
        )

        doc.font('Helvetica')
        doc.fillColor(COLORS.SECONDARY)
        currentY += lineSpacing
      }

      renderTotalsLine('Subtotal:', totalTaxableValue)

      // Discount (if applicable) - red color for negative value
      if (order.discount > 0) {
        const coupon = order.coupon as any
        const couponCode = coupon && typeof coupon === 'object' && coupon.code ? coupon.code : null
        const discountLabel = couponCode ? `Discount (${couponCode}):` : 'Discount:'
        renderTotalsLine(discountLabel, -order.discount, {
          color: COLORS.DISCOUNT, // text-red-600
          valueColor: COLORS.DISCOUNT,
        })
      }

      // Shipping is GST-inclusive (SAC 9968, typically 18% for delivery). Decompose
      // for the customer so the totals reconcile: base shipping + shipping GST.
      let shippingGstAdded = 0
      if (order.shipping > 0) {
        const shippingGstRate = 18 // SAC 9968 - Goods transport agency services
        const shippingBase = order.shipping / (1 + shippingGstRate / 100)
        const shippingGst = order.shipping - shippingBase
        renderTotalsLine('Shipping (Excl. GST):', shippingBase)
        renderTotalsLine(`Shipping GST (${shippingGstRate}%):`, shippingGst)
        shippingGstAdded = shippingGst
      }

      const taxLabel = effectiveAudience === 'buyer' ? 'GST on Items:' : 'Tax (GST):'
      renderTotalsLine(taxLabel, taxToDisplay)
      if (shippingGstAdded > 0) {
        renderTotalsLine('Total GST:', taxToDisplay + shippingGstAdded, {
          bold: true,
          color: COLORS.PRIMARY,
        })
      }

      currentY += SPACING.SMALL + 2
      const separatorY = currentY
      doc
        .moveTo(totalsSectionLeft, separatorY)
        .lineTo(totalsSectionLeft + totalsSectionWidth, separatorY)
        .strokeColor(COLORS.BORDER_DARK) // border-gray-300
        .lineWidth(2) // border-t-2
        .stroke()
      currentY += SPACING.SMALL + 2

      const grandTotalLabel = 'Total:'
      doc
        .font('Helvetica-Bold')
        .fontSize(FONTS.BODY + 1)
        .fillColor(COLORS.PRIMARY)
      doc.text(grandTotalLabel, totalsSectionLeft, currentY, {
        width: labelWidth,
        align: 'right',
      })
      doc.font('Helvetica-Bold').fontSize(FONTS.BODY)
      doc.text(
        formatCurrency(totalToDisplay, invoiceSettings.currency, invoiceSettings.roundingMode),
        totalsSectionLeft + labelWidth + 8,
        currentY,
        {
          width: valueWidth,
          align: 'right',
        },
      )
      doc.font('Helvetica').fontSize(FONTS.BODY)
      currentY += lineSpacing + SPACING.SMALL

      renderTotalsLine('Rounded Total:', Math.round(totalToDisplay))

      if (effectiveAudience === 'buyer') {
        currentY += SPACING.SMALL + 1
        const amountInWords = `${numberToWords(Math.floor(totalToDisplay))} only`
        doc.fontSize(FONTS.BODY).fillColor(COLORS.TERTIARY)
        const labelText = 'Amount in Words: '
        const labelWidthPx = doc.widthOfString(labelText)
        doc.text(labelText, totalsSectionLeft, currentY, {
          width: totalsSectionWidth,
          align: 'left',
        })
        // Words in gray-900
        doc.fillColor(COLORS.PRIMARY) // text-gray-900
        doc.text(amountInWords, totalsSectionLeft + labelWidthPx, currentY, {
          width: totalsSectionWidth - labelWidthPx,
          align: 'left',
        })
        currentY += lineSpacing - 2
        doc
          .moveTo(totalsSectionLeft, currentY)
          .lineTo(totalsSectionLeft + totalsSectionWidth, currentY)
          .strokeColor(COLORS.BORDER)
          .lineWidth(0.5)
          .stroke()
      }

      doc.fillColor(COLORS.PRIMARY)
      doc.y = currentY + SPACING.SUBSECTION // Use SUBSECTION spacing

      return totalToDisplay
    }

    const totalToDisplay = renderTotalsSection()

    // ============================================================================
    // PAYMENT DETAILS SECTION
    // ============================================================================
    if (effectiveAudience === 'buyer') {
      // Estimate payment details height: ~4 lines * 12pt + spacing = ~60pt
      const estimatedPaymentHeight = 60
      if (doc.y + estimatedPaymentHeight > pageBreakThreshold) {
        doc.addPage()
        doc.y = SPACING.MARGIN
      }

      const paymentY = doc.y
      doc
        .font('Helvetica-Bold')
        .fontSize(FONTS.HEADING)
        .fillColor(COLORS.ACCENT)
        .text('Payment Details:', SPACING.MARGIN, paymentY)
      doc.font('Helvetica').fontSize(FONTS.BODY).fillColor(COLORS.PRIMARY)

      const orderWithPayment = order as any
      const paymentTransactionId =
        orderWithPayment.razorpayPaymentId || orderWithPayment.paymentGateway || 'N/A'
      const paymentMethod = order.paymentMethod || 'N/A'
      const paymentDate = formatDate(new Date(order.createdAt), invoiceSettings.dateFormat)
      const paymentTime = new Date(order.createdAt).toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })

      // Payment Transaction ID
      let paymentLineY = paymentY + SPACING.PADDING
      doc.font('Helvetica-Bold').fillColor(COLORS.PRIMARY)
      doc.text('Payment Transaction ID: ', SPACING.MARGIN, paymentLineY)
      const labelWidth1 = doc.widthOfString('Payment Transaction ID: ')
      doc.font('Helvetica').fillColor(COLORS.PRIMARY)
      doc.text(paymentTransactionId, SPACING.MARGIN + labelWidth1, paymentLineY)

      // Date & Time
      paymentLineY += SPACING.LINE // Use LINE spacing
      doc.font('Helvetica-Bold').fillColor(COLORS.PRIMARY)
      doc.text('Date & Time: ', SPACING.MARGIN, paymentLineY)
      const labelWidth2 = doc.widthOfString('Date & Time: ')
      doc.font('Helvetica').fillColor(COLORS.PRIMARY)
      doc.text(`${paymentDate}, ${paymentTime} hrs`, SPACING.MARGIN + labelWidth2, paymentLineY)

      // Invoice Value
      paymentLineY += SPACING.LINE // Use LINE spacing
      doc.font('Helvetica-Bold').fillColor(COLORS.PRIMARY)
      doc.text('Invoice Value: ', SPACING.MARGIN, paymentLineY)
      const labelWidth3 = doc.widthOfString('Invoice Value: ')
      doc.font('Helvetica').fillColor(COLORS.PRIMARY)
      doc.text(
        formatCurrency(totalToDisplay, invoiceSettings.currency, invoiceSettings.roundingMode),
        SPACING.MARGIN + labelWidth3,
        paymentLineY,
      )

      // Mode of Payment
      paymentLineY += SPACING.LINE // Use LINE spacing
      doc.font('Helvetica-Bold').fillColor(COLORS.PRIMARY)
      doc.text('Mode of Payment: ', SPACING.MARGIN, paymentLineY)
      const labelWidth4 = doc.widthOfString('Mode of Payment: ')
      doc.font('Helvetica').fillColor(COLORS.PRIMARY)
      doc.text(paymentMethod.toUpperCase(), SPACING.MARGIN + labelWidth4, paymentLineY)

      // Spacing after payment details - signature will be placed here (reduced to fit on page)
      doc.y = paymentLineY + SPACING.SMALL + 2 // Reduced spacing before signature
    } else {
      // For seller invoices, keep original payment method box
      const paymentY = doc.y
      doc
        .rect(SPACING.MARGIN, paymentY, contentWidth, 50)
        .fillAndStroke('#ffffff', COLORS.BORDER_DARK)
      doc
        .font('Helvetica-Bold')
        .fontSize(FONTS.HEADING + 1)
        .fillColor(COLORS.PRIMARY)
      doc.text('PAYMENT INFORMATION', SPACING.MARGIN + 10, paymentY + 8)
      doc.fillColor(COLORS.SECONDARY)
      doc.font('Helvetica').fontSize(FONTS.BODY)
      const paymentMethod = order.paymentMethod || 'N/A'
      const paymentStatus = order.paymentStatus || 'N/A'
      doc.text(`Payment Method: ${paymentMethod.toUpperCase()}`, SPACING.MARGIN + 10, paymentY + 22)
      doc.text(
        `Payment Status: ${paymentStatus.charAt(0).toUpperCase() + paymentStatus.slice(1)}`,
        SPACING.MARGIN + 10,
        paymentY + 36,
      )

      doc.y = paymentY + 60
    }

    // ============================================================================
    // SETTLEMENT SUMMARY SECTION (Seller invoices only)
    // ============================================================================
    if (audience === 'seller') {
      const settlementY = doc.y + SPACING.SUBSECTION
      const boxWidth = 495
      const boxX = SPACING.MARGIN
      const lineHeight = 16

      // Derive reasonable fallbacks if settlement is partially missing
      const grossAmount =
        typeof settlement?.grossAmount === 'number'
          ? settlement.grossAmount
          : typeof order.total === 'number'
          ? order.total
          : order.subtotal - (order.discount || 0) + (order.shipping || 0) + (order.tax || 0)

      const marketplaceFees = settlement?.marketplaceFees ?? 0
      const courierCharges =
        settlement?.courierCharges ?? (typeof order.shipping === 'number' ? order.shipping : 0)
      const codFees =
        settlement?.codFees ??
        (order.paymentMethod?.toLowerCase() === 'cod'
          ? Math.round(grossAmount * 0.02) // simple default COD fee if not provided
          : 0)

      const netSettlement =
        settlement?.netSettlement ?? grossAmount - marketplaceFees - courierCharges - codFees

      // Professional background box
      const rows = 6
      const boxHeight = 10 + rows * lineHeight + 10
      doc.rect(boxX, settlementY, boxWidth, boxHeight).fillAndStroke('#ffffff', COLORS.BORDER_DARK)

      let lineY = settlementY + 10
      doc
        .font('Helvetica-Bold')
        .fontSize(FONTS.HEADING + 1)
        .fillColor(COLORS.PRIMARY)
      doc.text('SETTLEMENT SUMMARY (SELLER)', boxX + 10, lineY)

      doc.font('Helvetica').fontSize(FONTS.BODY).fillColor(COLORS.PRIMARY)
      lineY += lineHeight
      doc.text('Buyer Amount (incl. tax & shipping):', boxX + 10, lineY, {
        width: boxWidth - 140,
      })
      doc.text(
        formatCurrency(grossAmount, invoiceSettings.currency, invoiceSettings.roundingMode),
        boxX + boxWidth - 120,
        lineY,
        {
          width: 110,
          align: 'right',
        },
      )

      lineY += lineHeight
      doc.text('Marketplace Fees:', boxX + 10, lineY, { width: boxWidth - 140 })
      doc.text(
        formatCurrency(marketplaceFees, invoiceSettings.currency, invoiceSettings.roundingMode),
        boxX + boxWidth - 120,
        lineY,
        {
          width: 110,
          align: 'right',
        },
      )

      lineY += lineHeight
      doc.text('Courier Charges:', boxX + 10, lineY, { width: boxWidth - 140 })
      doc.text(
        formatCurrency(courierCharges, invoiceSettings.currency, invoiceSettings.roundingMode),
        boxX + boxWidth - 120,
        lineY,
        {
          width: 110,
          align: 'right',
        },
      )

      lineY += lineHeight
      doc.text('COD Fees:', boxX + 10, lineY, { width: boxWidth - 140 })
      doc.text(
        formatCurrency(codFees, invoiceSettings.currency, invoiceSettings.roundingMode),
        boxX + boxWidth - 120,
        lineY,
        {
          width: 110,
          align: 'right',
        },
      )

      // Professional net settlement separator
      lineY += lineHeight
      doc
        .moveTo(boxX + 10, lineY + 4)
        .lineTo(boxX + boxWidth - 10, lineY + 4)
        .strokeColor(COLORS.BORDER_DARK)
        .lineWidth(1)
        .stroke()

      lineY += lineHeight - 2
      doc
        .font('Helvetica-Bold')
        .fontSize(FONTS.HEADING + 2)
        .fillColor(COLORS.PRIMARY)
      doc.text('Net Settlement Amount:', boxX + 10, lineY, { width: boxWidth - 140 })
      doc.text(
        formatCurrency(netSettlement, invoiceSettings.currency, invoiceSettings.roundingMode),
        boxX + boxWidth - 120,
        lineY,
        {
          width: 110,
          align: 'right',
        },
      )

      doc.fillColor(COLORS.PRIMARY)
      doc.y = settlementY + boxHeight + SPACING.SUBSECTION
    }

    // ============================================================================
    // SIGNATURE SECTION
    // ============================================================================
    // Use seller signature if allowed, otherwise marketplace signature
    // Always show "Authorized Signatory" (not "Super Admin")
    const signatureName = 'Authorized Signatory'
    const signatureTitle =
      invoiceSettings.allowSellerSignature && seller?.authorizedPersonDesignation
        ? seller.authorizedPersonDesignation
        : branding.signatureTitle

    // Always show signature section for buyer invoices (matches frontend behavior)
    if (effectiveAudience === 'buyer') {
      // Spacing before signature - reduced to fit on single page
      // Check if we need a new page for signature
      const signatureHeight = signatureBuffer ? 55 : 30 // Reduced to fit on page
      const signatureNameHeight = 9
      const signatureTitleHeight = signatureTitle ? 9 : 0
      const signatureSpacing = 6 // Reduced spacing
      const totalSignatureHeight =
        signatureHeight + signatureNameHeight + signatureTitleHeight + signatureSpacing

      const signatureStartY = doc.y
      // Check if signature won't fit on current page (with proper threshold)
      if (signatureStartY + totalSignatureHeight > pageBreakThreshold) {
        doc.addPage()
        doc.y = SPACING.MARGIN
      }

      const finalSignatureY = doc.y
      // For buyer invoices, align signature to right (matches frontend)
      const signatureX = contentRight - 170
      const signatureWidth = 170 // Reduced width to fit on page

      let signatureBottom = finalSignatureY
      if (signatureBuffer) {
        // Make signature more visible - reduced size to fit on one page
        try {
          // Use reduced size to fit on one page
          // Position image at signatureX (left edge), it will be 170px wide
          // Ensure we're on the current page
          const pageRange = doc.bufferedPageRange()
          const currentPage = pageRange.start + pageRange.count - 1
          doc.switchToPage(currentPage)

          console.log(
            `Rendering signature: x=${signatureX}, y=${finalSignatureY}, width=${signatureWidth}, height=55, page=${currentPage}`,
          )
          doc.image(signatureBuffer, signatureX, finalSignatureY, {
            fit: [signatureWidth, 55], // Reduced height to fit on page
          })
          signatureBottom = finalSignatureY + 59
        } catch (error) {
          console.error('Error rendering signature image:', error)
          // Fallback to line if image fails
          doc
            .moveTo(signatureX, finalSignatureY + 15)
            .lineTo(signatureX + signatureWidth, finalSignatureY + 15)
            .strokeColor('#d1d5db')
            .lineWidth(1)
            .stroke()
          signatureBottom = finalSignatureY + 30
        }
      } else {
        // Draw a line for signature placeholder (matches frontend)
        doc
          .moveTo(signatureX, finalSignatureY + 15)
          .lineTo(signatureX + signatureWidth, finalSignatureY + 15)
          .strokeColor('#d1d5db')
          .lineWidth(1)
          .stroke()
        signatureBottom = finalSignatureY + 30
      }

      // Always show signature name (matches frontend - shows "Authorized Signatory")
      // Position "Authorized Signatory" just below the signature
      const signatureNameY = signatureBottom + 2 // Minimal spacing - just below signature
      doc
        .font('Helvetica-Bold')
        .fontSize(FONTS.BODY)
        .fillColor(COLORS.PRIMARY)
        .text(signatureName, signatureX, signatureNameY, { width: signatureWidth, align: 'right' })
      if (signatureTitle) {
        doc
          .font('Helvetica')
          .fontSize(FONTS.SMALL)
          .fillColor(COLORS.TERTIARY)
          .text(signatureTitle, signatureX, signatureNameY + 8, {
            width: signatureWidth,
            align: 'right',
          })
        signatureBottom = signatureNameY + 17
      } else {
        signatureBottom = signatureNameY + 9
      }

      doc.fillColor(COLORS.PRIMARY)
      doc.y = Math.max(doc.y, signatureBottom + 2) // Minimal spacing at bottom
    } else if (signatureBuffer || signatureName || signatureTitle) {
      // For seller invoices, only show if signature data exists
      const signatureHeight = signatureBuffer ? 84 : 46
      const signatureNameHeight = 12
      const signatureTitleHeight = signatureTitle ? 12 : 0
      const signatureSpacing = 20
      const totalSignatureHeight =
        signatureHeight + signatureNameHeight + signatureTitleHeight + signatureSpacing

      const signatureStartY = doc.y + 10
      if (signatureStartY + totalSignatureHeight > pageBreakThreshold) {
        doc.addPage()
        doc.y = SPACING.MARGIN
      }

      const finalSignatureY = doc.y + 10
      const signatureX = 345
      const signatureWidth = 200

      let signatureBottom = finalSignatureY
      if (signatureBuffer) {
        try {
          const pageRange = doc.bufferedPageRange()
          const currentPage = pageRange.start + pageRange.count - 1
          doc.switchToPage(currentPage)
          doc.image(signatureBuffer, signatureX, finalSignatureY, {
            fit: [signatureWidth, 80],
          })
          signatureBottom = finalSignatureY + 84
        } catch (error) {
          console.error('Error rendering signature image:', error)
          doc
            .moveTo(signatureX, finalSignatureY + 30)
            .lineTo(signatureX + signatureWidth, finalSignatureY + 30)
            .strokeColor('#d1d5db')
            .lineWidth(1)
            .stroke()
          signatureBottom = finalSignatureY + 46
        }
      }

      if (signatureName) {
        const signatureNameY = signatureBottom + 6
        doc
          .font('Helvetica-Bold')
          .fontSize(FONTS.BODY)
          .fillColor(COLORS.PRIMARY)
          .text(signatureName, signatureX, signatureNameY, {
            width: signatureWidth,
            align: 'right',
          })
        if (signatureTitle) {
          doc
            .font('Helvetica')
            .fontSize(FONTS.SMALL)
            .fillColor(COLORS.TERTIARY)
            .text(signatureTitle, signatureX, signatureNameY + 12, {
              width: signatureWidth,
              align: 'right',
            })
          signatureBottom = signatureNameY + 24
        } else {
          signatureBottom = signatureNameY + 12
        }
      }

      doc.fillColor(COLORS.PRIMARY)
      doc.y = Math.max(doc.y, signatureBottom + 10)
    }

    // ============================================================================
    // FOOTER SECTION
    // ============================================================================
    let footerY: number
    if (effectiveAudience === 'buyer') {
      // Keep the buyer footer anchored near the bottom of the current page so it
      // never forces an extra page when content is already close to the limit.
      footerY = pageHeight - SPACING.MARGIN - 18

      doc
        .moveTo(SPACING.MARGIN, footerY - SPACING.SMALL)
        .lineTo(contentRight, footerY - SPACING.SMALL)
        .strokeColor(COLORS.BORDER_DARK)
        .lineWidth(1)
        .stroke()
      // Don't write placeholder - page numbers will be added dynamically after all content is rendered
    } else {
      // For seller invoices, keep original footer
      doc.fontSize(FONTS.SMALL).fillColor(COLORS.TERTIARY)
      footerY = 750
      doc.rect(0, footerY - 20, pageWidth, 50).fill(COLORS.BACKGROUND)
      doc.fillColor(COLORS.TERTIARY)
      doc
        .font('Helvetica-Bold')
        .fontSize(FONTS.BODY)
        .text('Thank you for your business!', SPACING.MARGIN, footerY, {
          align: 'center',
          width: contentWidth,
        })
      doc
        .font('Helvetica')
        .fontSize(FONTS.SMALL)
        .text(
          'This is a computer-generated invoice. No signature required.',
          SPACING.MARGIN,
          footerY + 12,
          {
            align: 'center',
            width: contentWidth,
          },
        )

      // Seller footer note (if allowed and seller has one) - only for seller invoices
      if (invoiceSettings.allowSellerFooterNote && seller?.storeDescription) {
        doc
          .font('Helvetica')
          .fontSize(7)
          .fillColor(COLORS.TERTIARY)
          .text(seller.storeDescription, SPACING.MARGIN, footerY + 24, {
            align: 'center',
            width: contentWidth,
          })
      }
    }

    doc.fillColor(COLORS.PRIMARY)

    // Add correct page numbers to all pages before finalizing (for buyer invoices)
    if (effectiveAudience === 'buyer') {
      // Get page range AFTER all content is added (including any page breaks)
      // CRITICAL: Get page range before ending the document
      const pageRange = doc.bufferedPageRange()
      // pageRange.start is 0-based index of first page
      // pageRange.count is total number of pages
      const totalPages = pageRange.count || 1
      const startPageIndex = pageRange.start || 0

      // Only add page numbers if we have at least one page with content
      if (totalPages > 0) {
        // Add page numbers to each page
        for (let pageIndex = startPageIndex; pageIndex < startPageIndex + totalPages; pageIndex++) {
          try {
            doc.switchToPage(pageIndex)
            const pageFooterY = pageHeight - SPACING.MARGIN - 18
            // Clear a small area where page number will be (right side) to remove any placeholder text
            doc.rect(contentRight - 145, pageFooterY - 5, 145, 15).fill('#ffffff')
            // Calculate page number: pageIndex is 0-based, so add 1 for display (Page 1, Page 2, etc.)
            // totalPages is the actual count
            const pageNumber = pageIndex - startPageIndex + 1
            doc
              .font('Helvetica')
              .fontSize(FONTS.SMALL)
              .fillColor(COLORS.TERTIARY)
              .text(`Page ${pageNumber} of ${totalPages}`, SPACING.MARGIN, pageFooterY, {
                width: contentWidth,
                align: 'right',
                lineBreak: false,
              })
          } catch (error) {
            // If page doesn't exist, skip it (shouldn't happen, but be safe)
            console.warn(`Could not add page number to page ${pageIndex}:`, error)
          }
        }
      }
    }

    // ============================================================================
    // FINALIZATION & UPLOAD
    // ============================================================================
    doc.end()
    const pdfBuffer = await pdfPromise

    // Upload to R2 (uploadToR2 throws if R2_PUBLIC_URL is not set)
    const fileName = `invoices/${invoiceId}.pdf`
    const invoiceUrl = await uploadToR2(pdfBuffer, fileName, 'application/pdf', 'invoices')

    if (!invoiceUrl || !invoiceUrl.startsWith('http')) {
      throw new Error(
        `Invoice upload failed: invalid URL returned (R2_PUBLIC_URL may be missing). Got: ${invoiceUrl}`,
      )
    }

    // HSN Summary data generation removed - HSN summary table is no longer displayed
    const hsnSummaryData: HsnSummaryItem[] = []

    return {
      invoice_id: invoiceId,
      invoice_url: invoiceUrl,
      invoice_number: invoiceNumber,
      hsnSummary: hsnSummaryData.length > 0 ? hsnSummaryData : undefined,
    }
  } catch (error) {
    console.error('Error generating invoice:', error)
    throw error
  }
}
