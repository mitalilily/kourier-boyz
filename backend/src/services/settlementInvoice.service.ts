import mongoose from 'mongoose'
import PDFDocument from 'pdfkit'
import AdminInvoiceSettings from '../models/AdminInvoiceSettings'
import Order from '../models/Order'
import SellerLedgerEntry, { ISellerLedgerEntry } from '../models/SellerLedgerEntry'
import SellerSettlementBatch, { ISellerSettlementBatch } from '../models/SellerSettlementBatch'
import SettlementInvoiceSequence from '../models/SettlementInvoiceSequence'
import User, { IUser } from '../models/User'
import { fetchBrandingAssetBuffer, getBrandingSettingsCached } from '../utils/brandingSettings'
import { uploadToR2 } from '../utils/r2Upload'

type LedgerMap = Map<string, ISellerLedgerEntry[]>

export interface SettlementInvoiceMarketplaceInfo {
  name: string
  gstin?: string
  addressLines: string[]
  supportEmail?: string
  supportPhone?: string
}

export interface SettlementInvoiceBatchSummary {
  period_from: Date
  period_to: Date
  total_orders: number
  totals: {
    item_earnings: number
    shipping_earned: number
    commission: number
    commission_reversal: number
    courier_cost: number
    cod_fee: number
    cod_fee_reversal: number
    pg_fee: number
    return_item_reversal: number
    return_shipping_reversal: number
    reverse_courier_cost: number
    manual_adjustments: number
    tds_amount: number
    tcs_amount: number
  }
  net_payout: number
  payout_date?: Date | null
  payout_reference?: string | null
  payout_notes?: string | null
}

export interface SettlementInvoiceOrderBreakdownRow {
  order_id: string
  order_number?: string
  item_earning: number
  shipping_earning: number
  commission: number
  courier_cost: number
  pg_fee: number
  return_item_reversal: number
  return_shipping_reversal: number
  reverse_courier_cost: number
  commission_reversal: number
  manual_adjustments_credit: number
  manual_adjustments_debit: number
  net: number
}

export interface SettlementInvoiceOrderItem {
  orderId: string
  orderNumber?: string
  productName: string
  variantName?: string
  hsnSacCode?: string
  gstRatePercent?: number
  gstTaxType?: 'IGST' | 'CGST_SGST'
  quantity: number
  price: number
  subtotal: number
}

export interface SettlementInvoiceDataModel {
  batch: ISellerSettlementBatch
  seller: IUser
  marketplaceInfo: SettlementInvoiceMarketplaceInfo
  batchSummary: SettlementInvoiceBatchSummary
  ledgerEntries: ISellerLedgerEntry[]
  ordersBreakdown: SettlementInvoiceOrderBreakdownRow[]
  orderItems: SettlementInvoiceOrderItem[]
}

const toNumber = (value: any, fallback = 0): number => {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

// Format date according to admin settings (same as invoiceGenerator.ts)
const formatDate = (date: Date, format: string): string => {
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
    return `${day}.${month}.${year}`
  }
  return date.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

// Round number according to admin settings (same as invoiceGenerator.ts)
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

// Currency symbol mapping (same as invoiceGenerator.ts)
const getCurrencySymbol = (currency: string): string => {
  const currencyMap: Record<string, string> = {
    INR: '₹',
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    AUD: 'A$',
    CAD: 'C$',
    CHF: 'CHF',
    CNY: '¥',
    SGD: 'S$',
    AED: 'د.إ',
    SAR: '﷼',
    MYR: 'RM',
    THB: '฿',
    PKR: '₨',
    BDT: '৳',
    NZD: 'NZ$',
    ZAR: 'R',
    BRL: 'R$',
    MXN: '$',
  }
  return currencyMap[currency] || currency
}

// Format currency according to admin settings (same as invoiceGenerator.ts)
const formatCurrency = (
  amount: number | string,
  currency: string,
  roundingMode: string,
): string => {
  if (typeof amount === 'string') {
    const symbol = getCurrencySymbol(currency)
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
    const parsed = parseFloat(amount)
    if (isNaN(parsed)) return amount
    amount = parsed
  }

  const rounded = roundAmount(amount, roundingMode)
  const symbol = getCurrencySymbol(currency)
  return `${symbol}${rounded.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`
}

export const generateNextSettlementInvoiceNumber = async (): Promise<string> => {
  const currentYear = new Date().getFullYear()
  const sequenceDoc = await SettlementInvoiceSequence.findOneAndUpdate(
    { year: currentYear },
    { $inc: { sequence: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean()

  const seq = sequenceDoc?.sequence ?? 1
  const padded = String(seq).padStart(5, '0')
  return `ST-${currentYear}-${padded}`
}

const groupLedgerByOrder = (entries: ISellerLedgerEntry[]): LedgerMap => {
  const map: LedgerMap = new Map()
  for (const entry of entries) {
    const key = (entry.order as any)?.toString?.() || 'NO_ORDER'
    const list = map.get(key) || []
    list.push(entry)
    map.set(key, list)
  }
  return map
}

const buildBatchSummaryFromLedger = (
  batch: ISellerSettlementBatch,
  ledgerEntries: ISellerLedgerEntry[],
): SettlementInvoiceBatchSummary => {
  let item_earnings = 0
  let shipping_earned = 0
  let commission = 0
  let commission_reversal = 0
  let courier_cost = 0
  let cod_fee = 0
  let cod_fee_reversal = 0
  let pg_fee = 0
  let return_item_reversal = 0
  let return_shipping_reversal = 0
  let reverse_courier_cost = 0
  let manual_adjustments_credit = 0
  let manual_adjustments_debit = 0
  // TDS and TCS
  let tds_amount = 0
  let tcs_amount = 0
  // Refund-related (treated as reductions in earnings / additional costs)
  let refund_item_total = 0
  let refund_shipping_total = 0
  let refund_cod_total = 0
  let refund_gst_total = 0

  for (const entry of ledgerEntries) {
    const amount = toNumber(entry.amount)
    const isCredit = entry.entryType === 'CREDIT'

    switch (entry.reason) {
      case 'ORDER_ITEM_CREDIT':
      case 'ORDER_EARNING': // legacy
        if (isCredit) item_earnings += amount
        break
      case 'SHIPPING_CREDIT':
      case 'SHIPPING_EARNING': // legacy
        if (isCredit) shipping_earned += amount
        break
      case 'COMMISSION_DEBIT':
      case 'COMMISSION': // legacy
        if (!isCredit) commission += amount
        break
      case 'COMMISSION_REVERSAL':
        if (isCredit) commission_reversal += amount
        break
      case 'SHIPPING_COST_DEBIT':
      case 'SHIPPING_COURIER_COST': // legacy
      case 'RETURN_COURIER_COST': // legacy
        if (!isCredit) courier_cost += amount
        break
      case 'COD_FEE_DEBIT':
        if (!isCredit) cod_fee += amount
        break
      case 'COD_FEE_REVERSAL':
        if (isCredit) cod_fee_reversal += amount
        break
      case 'PAYMENT_GATEWAY_FEE':
      case 'PG_FEE': // legacy
        if (!isCredit) pg_fee += amount
        break
      case 'RETURN_ITEM_EARNING_REVERSAL':
      case 'RETURN_ITEM_REVERSAL':
        if (!isCredit) return_item_reversal += amount
        break
      case 'RETURN_SHIPPING_EARNING_REVERSAL':
      case 'RETURN_SHIPPING_REVERSAL':
        if (!isCredit) return_shipping_reversal += amount
        break
      case 'RETURN_REVERSE_COURIER_COST':
        if (!isCredit) reverse_courier_cost += amount
        break
      case 'PLATFORM_ADJUSTMENT':
        if (isCredit) {
          manual_adjustments_credit += amount
        } else {
          manual_adjustments_debit += amount
        }
        break
      case 'REFUND_ITEM':
        if (!isCredit) refund_item_total += amount
        break
      case 'REFUND_SHIPPING':
        if (!isCredit) refund_shipping_total += amount
        break
      case 'REFUND_COD':
        if (!isCredit) refund_cod_total += amount
        break
      case 'REFUND_GST':
        if (!isCredit) refund_gst_total += amount
        break
      case 'TDS_DEBIT':
        if (!isCredit) tds_amount += amount
        break
      case 'TDS_REVERSAL':
        if (isCredit) tds_amount -= amount
        break
      case 'TCS_DEBIT':
        if (!isCredit) tcs_amount += amount
        break
      case 'TCS_REVERSAL':
        if (isCredit) tcs_amount -= amount
        break
      default:
        break
    }
  }

  const manual_adjustments = manual_adjustments_credit - manual_adjustments_debit

  const totalCredits =
    item_earnings + shipping_earned + commission_reversal + manual_adjustments_credit
  const totalDebits =
    commission +
    courier_cost +
    cod_fee -
    cod_fee_reversal + // Reverse COD fee is a credit, so subtract it
    pg_fee +
    return_item_reversal +
    return_shipping_reversal +
    reverse_courier_cost +
    refund_item_total +
    refund_shipping_total +
    refund_cod_total +
    refund_gst_total +
    manual_adjustments_debit +
    tds_amount +
    tcs_amount

  const netFromLedger = totalCredits - totalDebits

  const net_payout =
    typeof batch.totalNetPayout === 'number' && Number.isFinite(batch.totalNetPayout)
      ? batch.totalNetPayout
      : netFromLedger

  return {
    period_from: batch.fromDate,
    period_to: batch.toDate,
    total_orders: batch.ordersCount,
    totals: {
      item_earnings,
      shipping_earned,
      commission,
      commission_reversal,
      courier_cost,
      cod_fee,
      cod_fee_reversal,
      pg_fee,
      return_item_reversal,
      return_shipping_reversal,
      reverse_courier_cost,
      manual_adjustments,
      tds_amount,
      tcs_amount,
    },
    net_payout,
    payout_date: batch.payoutDate ?? null,
    payout_reference: batch.payoutReference ?? null,
    payout_notes: batch.payoutNotes ?? null,
  }
}

const buildOrdersBreakdownFromLedger = async (
  ledgerEntries: ISellerLedgerEntry[],
): Promise<SettlementInvoiceOrderBreakdownRow[]> => {
  const byOrder = groupLedgerByOrder(ledgerEntries)
  const orderIds = Array.from(byOrder.keys()).filter((id) => id !== 'NO_ORDER')

  const orders =
    orderIds.length > 0
      ? (await Order.find({
          _id: { $in: orderIds.map((id) => new mongoose.Types.ObjectId(id)) },
        })
          .select('_id orderNumber')
          .lean()) || []
      : []

  const orderNumberMap = new Map<string, string | undefined>()
  for (const o of orders as any[]) {
    const idStr =
      typeof o._id === 'string'
        ? o._id
        : (o._id as mongoose.Types.ObjectId | undefined)?.toString() || ''
    if (!idStr) continue
    orderNumberMap.set(idStr, (o as any).orderNumber as string | undefined)
  }

  const rows: SettlementInvoiceOrderBreakdownRow[] = []

  for (const [orderId, entries] of byOrder.entries()) {
    if (orderId === 'NO_ORDER') continue

    let item_earning = 0
    let shipping_earning = 0
    let commission = 0
    let commission_reversal = 0
    let courier_cost = 0
    let pg_fee = 0
    let return_item_reversal = 0
    let return_shipping_reversal = 0
    let reverse_courier_cost = 0
    let manual_adjustments_credit = 0
    let manual_adjustments_debit = 0
    let refund_item_total = 0
    let refund_shipping_total = 0
    let refund_cod_total = 0
    let refund_gst_total = 0

    for (const entry of entries) {
      const amount = toNumber(entry.amount)
      const isCredit = entry.entryType === 'CREDIT'

      switch (entry.reason) {
        case 'ORDER_ITEM_CREDIT':
        case 'ORDER_EARNING': // legacy
          if (isCredit) item_earning += amount
          break
        case 'SHIPPING_CREDIT':
        case 'SHIPPING_EARNING': // legacy
          if (isCredit) shipping_earning += amount
          break
        case 'COMMISSION_DEBIT':
        case 'COMMISSION': // legacy
          if (!isCredit) commission += amount
          break
        case 'COMMISSION_REVERSAL':
          if (isCredit) commission_reversal += amount
          break
        case 'SHIPPING_COST_DEBIT':
        case 'SHIPPING_COURIER_COST': // legacy
        case 'RETURN_COURIER_COST': // legacy
          if (!isCredit) courier_cost += amount
          break
        case 'PAYMENT_GATEWAY_FEE':
        case 'PG_FEE': // legacy
          if (!isCredit) pg_fee += amount
          break
        case 'RETURN_ITEM_EARNING_REVERSAL':
        case 'RETURN_ITEM_REVERSAL':
          if (!isCredit) return_item_reversal += amount
          break
        case 'RETURN_SHIPPING_EARNING_REVERSAL':
        case 'RETURN_SHIPPING_REVERSAL':
          if (!isCredit) return_shipping_reversal += amount
          break
        case 'RETURN_REVERSE_COURIER_COST':
          if (!isCredit) reverse_courier_cost += amount
          break
        case 'PLATFORM_ADJUSTMENT':
          if (isCredit) {
            manual_adjustments_credit += amount
          } else {
            manual_adjustments_debit += amount
          }
          break
        case 'REFUND_ITEM':
          if (!isCredit) refund_item_total += amount
          break
        case 'REFUND_SHIPPING':
          if (!isCredit) refund_shipping_total += amount
          break
        case 'REFUND_COD':
          if (!isCredit) refund_cod_total += amount
          break
        case 'REFUND_GST':
          if (!isCredit) refund_gst_total += amount
          break
        default:
          break
      }
    }

    const totalCredits =
      item_earning + shipping_earning + commission_reversal + manual_adjustments_credit
    const totalDebits =
      commission +
      courier_cost +
      pg_fee +
      return_item_reversal +
      return_shipping_reversal +
      reverse_courier_cost +
      refund_item_total +
      refund_shipping_total +
      refund_cod_total +
      refund_gst_total +
      manual_adjustments_debit

    const net = totalCredits - totalDebits

    rows.push({
      order_id: orderId,
      order_number: orderNumberMap.get(orderId),
      item_earning,
      shipping_earning,
      commission,
      courier_cost,
      pg_fee,
      return_item_reversal,
      return_shipping_reversal,
      reverse_courier_cost,
      commission_reversal,
      manual_adjustments_credit,
      manual_adjustments_debit,
      net,
    })
  }

  rows.sort((a, b) => a.order_number?.localeCompare(b.order_number || '') || 0)
  return rows
}

const buildOrderItemsFromLedger = async (
  ledgerEntries: ISellerLedgerEntry[],
): Promise<SettlementInvoiceOrderItem[]> => {
  const byOrder = groupLedgerByOrder(ledgerEntries)
  const orderIds = Array.from(byOrder.keys()).filter((id) => id !== 'NO_ORDER')

  if (orderIds.length === 0) return []

  // Fetch orders - use lean() for performance, then manually fetch products if needed
  const orders = await Order.find({
    _id: { $in: orderIds.map((id) => new mongoose.Types.ObjectId(id)) },
  })
    .select('_id orderNumber items')
    .lean()

  // Collect all product IDs to fetch in one query
  const productIds = new Set<string>()
  for (const order of orders as any[]) {
    if (order.items && Array.isArray(order.items)) {
      for (const item of order.items) {
        if (item.product) {
          const productId =
            typeof item.product === 'string'
              ? item.product
              : (item.product as any)?._id?.toString() || item.product.toString()
          if (productId) productIds.add(productId)
        }
      }
    }
  }

  // Fetch all products at once
  const Product = mongoose.model('Product')
  const products =
    productIds.size > 0
      ? await Product.find({ _id: { $in: Array.from(productIds) } })
          .select('name')
          .lean()
      : []
  const productMap = new Map<string, any>()
  for (const product of products as any[]) {
    productMap.set(product._id.toString(), product)
  }

  const orderItems: SettlementInvoiceOrderItem[] = []

  console.log(`🔍 Found ${orders.length} orders to process for settlement invoice items`)

  for (const order of orders as any[]) {
    if (!order.items || !Array.isArray(order.items) || order.items.length === 0) {
      console.warn(`⚠️ Order ${order._id} has no items`)
      continue
    }

    // Get the first item from the order
    const firstItem = order.items[0]

    // Get product name from productMap
    let productName = 'Product'
    if (firstItem.product) {
      const productId =
        typeof firstItem.product === 'string'
          ? firstItem.product
          : (firstItem.product as any)?._id?.toString() || firstItem.product.toString()
      const product = productMap.get(productId)
      if (product && product.name) {
        productName = product.name
      }
    }

    // Get variant name - use stored snapshot (variantName is stored in order item)
    let variantName = ''
    if (firstItem.variantName) {
      variantName = ` - ${firstItem.variantName}`
    }

    const orderIdStr =
      typeof order._id === 'string' ? order._id : (order._id as any)?.toString() || ''

    orderItems.push({
      orderId: orderIdStr,
      orderNumber: order.orderNumber || undefined,
      productName: `${productName}${variantName}`,
      hsnSacCode: firstItem.hsnSacCode || '-',
      gstRatePercent: firstItem.gstRatePercent ?? 0,
      gstTaxType: firstItem.gstTaxType,
      quantity: firstItem.quantity || 0,
      price: firstItem.effectivePrice ?? firstItem.price ?? 0,
      subtotal: firstItem.subtotal || 0,
    })
  }

  // Sort by order number
  orderItems.sort((a, b) => (a.orderNumber || a.orderId).localeCompare(b.orderNumber || b.orderId))

  return orderItems
}

export const compileSettlementInvoiceData = async (
  batchId: string,
): Promise<SettlementInvoiceDataModel> => {
  if (!mongoose.Types.ObjectId.isValid(batchId)) {
    throw new Error('Invalid batch ID')
  }

  const batch = await SellerSettlementBatch.findById(batchId).lean()
  if (!batch) {
    throw new Error('Settlement batch not found')
  }

  const seller = await User.findById(batch.seller).lean()
  if (!seller) {
    throw new Error('Seller not found for settlement batch')
  }

  const ledgerEntries = await SellerLedgerEntry.find({
    settlementBatch: new mongoose.Types.ObjectId((batch as any)._id),
  })
    .sort({ createdAt: 1 })
    .lean()

  const marketplaceBranding = await getBrandingSettingsCached()

  const marketplaceInfo: SettlementInvoiceMarketplaceInfo = {
    name: marketplaceBranding.companyName || 'Kourier Boyz Marketplace Private Limited',
    gstin: process.env.KOURIER_BOYZ_GSTIN || undefined,
    addressLines: [
      process.env.KOURIER_BOYZ_COMPANY_ADDRESS_LINE1 || 'Registered Address Line 1',
      process.env.KOURIER_BOYZ_COMPANY_ADDRESS_LINE2 || 'Address Line 2, City, State, PIN',
      'India',
    ],
    supportEmail: seller.supportEmail || seller.storeEmail || seller.email,
    supportPhone: seller.storePhone || undefined,
  }

  const summary = buildBatchSummaryFromLedger(batch as any, ledgerEntries as any)
  const ordersBreakdown = await buildOrdersBreakdownFromLedger(ledgerEntries as any)
  const orderItems = await buildOrderItemsFromLedger(ledgerEntries as any)

  return {
    batch: batch as any,
    seller: seller as any,
    marketplaceInfo,
    batchSummary: summary,
    ledgerEntries: ledgerEntries as any,
    ordersBreakdown,
    orderItems,
  }
}

export const generateSettlementInvoicePdfAndUpload = async (
  invoiceData: SettlementInvoiceDataModel & { invoiceNumber: string },
): Promise<string> => {
  const {
    batch,
    seller,
    marketplaceInfo,
    batchSummary,
    ledgerEntries,
    ordersBreakdown,
    orderItems,
    invoiceNumber,
  } = invoiceData

  // ============================================================================
  // CONFIGURATION & SETUP - ALL invoice generation respects admin settings:
  // ============================================================================
  // - currency: Used in all formatCurrency() calls
  // - roundingMode: Used in all formatCurrency() calls
  // - dateFormat: Used in all formatDate() calls
  // - allowSellerLogo: Controls whether seller logo is used instead of marketplace logo
  // - allowSellerSignature: Controls whether seller signature is used instead of marketplace signature
  // - allowSellerFooterNote: Controls whether seller footer note is displayed
  const invoiceSettings = await AdminInvoiceSettings.getSingleton()
  const branding = await getBrandingSettingsCached()

  // ============================================================================
  // BRANDING ASSETS (Logo & Signature) - Respects admin settings
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
    try {
      invoiceLogoBuffer = await fetchBrandingAssetBuffer(
        branding.invoiceLogoUrl || branding.labelLogoUrl,
      )
    } catch (error) {
      console.warn('Failed to load invoice logo:', error)
    }
  }

  // Determine which signature to use: seller signature if allowed, otherwise marketplace signature
  let signatureBuffer: Buffer | null = null
  if (invoiceSettings.allowSellerSignature && seller?.sellerAgreementSignature) {
    try {
      signatureBuffer = await fetchBrandingAssetBuffer(seller.sellerAgreementSignature)
    } catch (error) {
      console.warn('Failed to load seller signature, falling back to marketplace signature:', error)
    }
  }
  if (!signatureBuffer && branding.signatureUrl) {
    try {
      signatureBuffer = await fetchBrandingAssetBuffer(branding.signatureUrl)
    } catch (error) {
      console.warn('Failed to load signature:', error)
    }
  }

  // Professional spacing constants (same as invoiceGenerator.ts)
  const SPACING = {
    SECTION: 22,
    SUBSECTION: 16,
    LINE: 12,
    SMALL: 5,
    MARGIN: 40,
    PADDING: 10,
  }

  // Professional color constants (same as invoiceGenerator.ts)
  const COLORS = {
    PRIMARY: '#0f172a',
    SECONDARY: '#475569',
    TERTIARY: '#64748b',
    BORDER: '#cbd5e1',
    BORDER_DARK: '#94a3b8',
    BACKGROUND: '#f8fafc',
    ACCENT: '#146eb4',
    BRAND_SOFT: '#eff6ff',
    BRAND_WARM: '#fff7ed',
    DISCOUNT: '#dc2626',
  }

  // Professional font sizes (same as invoiceGenerator.ts)
  const FONTS = {
    TITLE: 24,
    HEADING: 11,
    BODY: 9,
    SMALL: 8,
    LARGE: 18,
    TABLE_HEADER: 8.5,
    TABLE_BODY: 8.5,
  }

  const doc = new PDFDocument({
    size: 'A4',
    margins: {
      top: SPACING.MARGIN,
      bottom: SPACING.MARGIN,
      left: SPACING.MARGIN,
      right: SPACING.MARGIN,
    },
    info: {
      Title: `Settlement Invoice ${invoiceNumber}`,
      Author: marketplaceInfo.name,
      Subject: `Seller Settlement Invoice`,
    },
  })

  const chunks: Buffer[] = []
  const pdfPromise = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.once('end', () => resolve(Buffer.concat(chunks)))
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
    const lineGap = 13
    const contentTop = y + 24
    const measuredHeight = contentTop + usableLines.length * lineGap - y + 8
    const height = Math.max(options?.minHeight || 88, measuredHeight)

    doc
      .roundedRect(x, y, width, height, 8)
      .fillAndStroke(options?.warm ? COLORS.BRAND_WARM : '#ffffff', COLORS.BORDER)

    doc
      .font('Helvetica-Bold')
      .fontSize(FONTS.SMALL)
      .fillColor(COLORS.ACCENT)
      .text(title.toUpperCase(), x + 12, y + 9, { width: width - 24 })

    let currentY = contentTop
    usableLines.forEach((line, index) => {
      doc
        .font(index === 0 ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(FONTS.BODY)
        .fillColor(index === 0 ? COLORS.PRIMARY : COLORS.SECONDARY)
        .text(line, x + 12, currentY, { width: width - 24 })
      currentY += lineGap
    })

    doc.fillColor(COLORS.PRIMARY).font('Helvetica')
    return y + height
  }

  const drawMetaChip = (x: number, y: number, width: number, label: string, value: string) => {
    doc.roundedRect(x, y, width, 42, 8).fillAndStroke('#ffffff', COLORS.BORDER)
    doc
      .font('Helvetica')
      .fontSize(FONTS.SMALL)
      .fillColor(COLORS.TERTIARY)
      .text(label.toUpperCase(), x + 10, y + 8, { width: width - 20 })
    doc
      .font('Helvetica-Bold')
      .fontSize(FONTS.BODY)
      .fillColor(COLORS.PRIMARY)
      .text(value, x + 10, y + 20, { width: width - 20 })
    doc.fillColor(COLORS.PRIMARY).font('Helvetica')
  }

  const isNegativePayout = (batchSummary.net_payout || 0) < 0
  const formattedDate = formatDate(new Date(), invoiceSettings.dateFormat)
  const periodFromFormatted = formatDate(batchSummary.period_from, invoiceSettings.dateFormat)
  const periodToFormatted = formatDate(batchSummary.period_to, invoiceSettings.dateFormat)

  // ============================================================================
  // HEADER SECTION (matches buyer invoice style)
  // ============================================================================
  const headerTop = SPACING.MARGIN
  const headerBoxHeight = 86
  doc
    .roundedRect(SPACING.MARGIN, headerTop, 495, headerBoxHeight, 12)
    .fillAndStroke(COLORS.BACKGROUND, COLORS.BORDER)
  let headerBottom = headerTop + headerBoxHeight

  if (invoiceLogoBuffer) {
    doc.image(invoiceLogoBuffer, SPACING.MARGIN + 14, headerTop + 14, { fit: [120, 40] })
  } else {
    const companyName = branding.companyName || marketplaceInfo.name
    const companyTagline = branding.companyTagline || 'Marketplace settlements by Kourier Boyz'
    doc
      .font('Helvetica-Bold')
      .fontSize(FONTS.HEADING + 1)
      .fillColor(COLORS.PRIMARY)
      .text(companyName, SPACING.MARGIN + 14, headerTop + 18)
    doc
      .font('Helvetica')
      .fontSize(FONTS.BODY)
      .fillColor(COLORS.SECONDARY)
      .text(companyTagline, SPACING.MARGIN + 14, headerTop + 34)
  }

  doc
    .font('Helvetica')
    .fontSize(FONTS.SMALL)
    .fillColor(COLORS.ACCENT)
    .text('KOURIER_BOYZ SETTLEMENTS', 180, headerTop + 16, { width: 170, align: 'left' })
  doc
    .font('Helvetica-Bold')
    .fontSize(FONTS.TITLE - 2)
    .fillColor(COLORS.PRIMARY)
    .text('Kourier Boyz Settlement Invoice', 180, headerTop + 36, { width: 200, align: 'left' })

  drawMetaChip(390, headerTop + 14, 130, 'Invoice No.', invoiceNumber)
  drawMetaChip(390, headerTop + 58, 130, 'Issue Date', formattedDate)

  doc.fillColor(COLORS.PRIMARY)
  headerBottom = Math.max(headerBottom, doc.y, headerTop + headerBoxHeight)
  doc.y = headerBottom + SPACING.SUBSECTION

  // Top meta row: Invoice No, Invoice Date, Settlement Period
  const metaY = doc.y
  const periodBottom = drawInfoCard(
    SPACING.MARGIN,
    metaY,
    495,
    'Settlement Snapshot',
    [
      `Settlement Period: ${periodFromFormatted} - ${periodToFormatted}`,
      `Total Orders: ${batchSummary.total_orders}`,
      `Net Settlement: ${formatCurrency(batchSummary.net_payout, invoiceSettings.currency, invoiceSettings.roundingMode)}`,
    ],
    { minHeight: 72, warm: true },
  )

  doc.y = periodBottom + SPACING.SUBSECTION

  // ============================================================================
  // ADDRESS SECTIONS (matches buyer invoice style)
  // ============================================================================
  const billShipY = doc.y
  const columnWidth = 242

  const billLines = [marketplaceInfo.name, ...marketplaceInfo.addressLines.filter(Boolean)]
  if (marketplaceInfo.gstin) {
    billLines.push(`GST Registration No: ${marketplaceInfo.gstin}`)
  }

  const sellerLines = [seller.businessName || seller.name || 'Seller']
  if (seller.addressLine1) {
    sellerLines.push(
      seller.addressLine1 + (seller.addressLine2 ? `, ${seller.addressLine2}` : ''),
    )
  }
  if (seller.city && seller.state && seller.postalCode) {
    sellerLines.push(`${seller.city}, ${seller.state} ${seller.postalCode}`)
  }
  if (seller.country) sellerLines.push(seller.country)
  if (seller.panNumber) sellerLines.push(`PAN No: ${seller.panNumber}`)
  if (seller.gstNumber) sellerLines.push(`GST Registration No: ${seller.gstNumber}`)

  const billBottomY = drawInfoCard(SPACING.MARGIN, billShipY, columnWidth, 'Billed To', billLines, {
    minHeight: 104,
  })
  const shipBottomY = drawInfoCard(
    SPACING.MARGIN + columnWidth + 11,
    billShipY,
    columnWidth,
    'Settled To',
    sellerLines,
    { minHeight: 104 },
  )

  doc.y = Math.max(billBottomY, shipBottomY) + SPACING.SUBSECTION

  // ============================================================================
  // SETTLEMENT SUMMARY SECTION (matches buyer invoice totals style)
  // ============================================================================
  const settlementY = doc.y + SPACING.SUBSECTION
  const boxWidth = 495
  const boxX = SPACING.MARGIN
  const lineHeightSettlement = 16

  const { totals } = batchSummary
  const grossAmount = totals.item_earnings + totals.shipping_earned

  // Structured summary panel
  const rows =
    15 +
    (batchSummary.payout_date || batchSummary.payout_reference || batchSummary.payout_notes
      ? 4
      : 0) +
    (isNegativePayout ? 2 : 0)
  const boxHeight = 10 + rows * lineHeightSettlement + 10
  doc.roundedRect(boxX, settlementY, boxWidth, boxHeight, 10).fillAndStroke(COLORS.BRAND_WARM, COLORS.BORDER)

  let lineY = settlementY + 10
  doc
    .font('Helvetica-Bold')
    .fontSize(FONTS.SMALL)
    .fillColor(COLORS.ACCENT)
  doc.text('SETTLEMENT SUMMARY', boxX + 10, lineY)

  doc.font('Helvetica').fontSize(FONTS.BODY).fillColor(COLORS.PRIMARY)
  lineY += lineHeightSettlement
  doc.text(`Settlement Period: ${periodFromFormatted} - ${periodToFormatted}`, boxX + 10, lineY, {
    width: boxWidth - 20,
  })
  lineY += lineHeightSettlement
  doc.text(`Total Orders: ${batchSummary.total_orders}`, boxX + 10, lineY, {
    width: boxWidth - 20,
  })
  lineY += lineHeightSettlement + 4

  // Credits section
  doc.font('Helvetica-Bold').fontSize(FONTS.HEADING).fillColor(COLORS.PRIMARY)
  doc.text('Credits:', boxX + 10, lineY)
  lineY += lineHeightSettlement
  doc.font('Helvetica').fontSize(FONTS.BODY).fillColor(COLORS.PRIMARY)

  doc.text('Item Earnings:', boxX + 20, lineY, { width: boxWidth - 140 })
  doc.text(
    formatCurrency(totals.item_earnings, invoiceSettings.currency, invoiceSettings.roundingMode),
    boxX + boxWidth - 120,
    lineY,
    { width: 110, align: 'right' },
  )
  lineY += lineHeightSettlement

  doc.text('Shipping Earned:', boxX + 20, lineY, { width: boxWidth - 140 })
  doc.text(
    formatCurrency(totals.shipping_earned, invoiceSettings.currency, invoiceSettings.roundingMode),
    boxX + boxWidth - 120,
    lineY,
    { width: 110, align: 'right' },
  )
  lineY += lineHeightSettlement

  if (totals.commission_reversal > 0) {
    doc.text('Commission Reversal:', boxX + 20, lineY, { width: boxWidth - 140 })
    doc.text(
      formatCurrency(
        totals.commission_reversal,
        invoiceSettings.currency,
        invoiceSettings.roundingMode,
      ),
      boxX + boxWidth - 120,
      lineY,
      { width: 110, align: 'right' },
    )
    lineY += lineHeightSettlement
  }

  lineY += 4
  doc
    .moveTo(boxX + 10, lineY)
    .lineTo(boxX + boxWidth - 10, lineY)
    .strokeColor(COLORS.BORDER_DARK)
    .lineWidth(1)
    .stroke()
  lineY += lineHeightSettlement

  // Debits section
  doc.font('Helvetica-Bold').fontSize(FONTS.HEADING).fillColor(COLORS.PRIMARY)
  doc.text('Debits:', boxX + 10, lineY)
  lineY += lineHeightSettlement
  doc.font('Helvetica').fontSize(FONTS.BODY).fillColor(COLORS.PRIMARY)

  if (totals.commission > 0) {
    doc.text('Commission:', boxX + 20, lineY, { width: boxWidth - 140 })
    doc.text(
      formatCurrency(totals.commission, invoiceSettings.currency, invoiceSettings.roundingMode),
      boxX + boxWidth - 120,
      lineY,
      { width: 110, align: 'right' },
    )
    lineY += lineHeightSettlement
  }

  if (totals.courier_cost > 0) {
    doc.text('Courier Charges:', boxX + 20, lineY, { width: boxWidth - 140 })
    doc.text(
      formatCurrency(totals.courier_cost, invoiceSettings.currency, invoiceSettings.roundingMode),
      boxX + boxWidth - 120,
      lineY,
      { width: 110, align: 'right' },
    )
    lineY += lineHeightSettlement
  }

  const codFeeNet = totals.cod_fee - totals.cod_fee_reversal
  if (codFeeNet > 0) {
    doc.text('COD Fee:', boxX + 20, lineY, { width: boxWidth - 140 })
    doc.text(
      formatCurrency(codFeeNet, invoiceSettings.currency, invoiceSettings.roundingMode),
      boxX + boxWidth - 120,
      lineY,
      { width: 110, align: 'right' },
    )
    lineY += lineHeightSettlement
  }

  if (totals.pg_fee > 0) {
    doc.text('Payment Gateway Fee:', boxX + 20, lineY, { width: boxWidth - 140 })
    doc.text(
      formatCurrency(totals.pg_fee, invoiceSettings.currency, invoiceSettings.roundingMode),
      boxX + boxWidth - 120,
      lineY,
      { width: 110, align: 'right' },
    )
    lineY += lineHeightSettlement
  }

  if (totals.return_item_reversal > 0 || totals.return_shipping_reversal > 0) {
    if (totals.return_item_reversal > 0) {
      doc.text('Return Item Reversal:', boxX + 20, lineY, { width: boxWidth - 140 })
      doc.text(
        formatCurrency(
          totals.return_item_reversal,
          invoiceSettings.currency,
          invoiceSettings.roundingMode,
        ),
        boxX + boxWidth - 120,
        lineY,
        { width: 110, align: 'right' },
      )
      lineY += lineHeightSettlement
    }
    if (totals.return_shipping_reversal > 0) {
      doc.text('Return Shipping Reversal:', boxX + 20, lineY, { width: boxWidth - 140 })
      doc.text(
        formatCurrency(
          totals.return_shipping_reversal,
          invoiceSettings.currency,
          invoiceSettings.roundingMode,
        ),
        boxX + boxWidth - 120,
        lineY,
        { width: 110, align: 'right' },
      )
      lineY += lineHeightSettlement
    }
  }

  if (totals.reverse_courier_cost > 0) {
    doc.text('Reverse Courier Cost:', boxX + 20, lineY, { width: boxWidth - 140 })
    doc.text(
      formatCurrency(
        totals.reverse_courier_cost,
        invoiceSettings.currency,
        invoiceSettings.roundingMode,
      ),
      boxX + boxWidth - 120,
      lineY,
      { width: 110, align: 'right' },
    )
    lineY += lineHeightSettlement
  }

  if (Math.abs(totals.manual_adjustments) > 0.01) {
    doc.text('Manual Adjustments:', boxX + 20, lineY, { width: boxWidth - 140 })
    doc.text(
      formatCurrency(
        totals.manual_adjustments,
        invoiceSettings.currency,
        invoiceSettings.roundingMode,
      ),
      boxX + boxWidth - 120,
      lineY,
      { width: 110, align: 'right' },
    )
    lineY += lineHeightSettlement
  }

  if (totals.tds_amount > 0) {
    doc.text('TDS (194O):', boxX + 20, lineY, { width: boxWidth - 140 })
    doc.text(
      formatCurrency(totals.tds_amount, invoiceSettings.currency, invoiceSettings.roundingMode),
      boxX + boxWidth - 120,
      lineY,
      { width: 110, align: 'right' },
    )
    lineY += lineHeightSettlement
  }

  if (totals.tcs_amount > 0) {
    doc.text('TCS (GST):', boxX + 20, lineY, { width: boxWidth - 140 })
    doc.text(
      formatCurrency(totals.tcs_amount, invoiceSettings.currency, invoiceSettings.roundingMode),
      boxX + boxWidth - 120,
      lineY,
      { width: 110, align: 'right' },
    )
    lineY += lineHeightSettlement
  }

  // Professional net settlement separator
  lineY += 4
  doc
    .moveTo(boxX + 10, lineY)
    .lineTo(boxX + boxWidth - 10, lineY)
    .strokeColor(COLORS.BORDER_DARK)
    .lineWidth(2)
    .stroke()
  lineY += lineHeightSettlement

  doc
    .font('Helvetica-Bold')
    .fontSize(FONTS.HEADING + 2)
    .fillColor(COLORS.PRIMARY)
  doc.text('Net Settlement Amount:', boxX + 10, lineY, { width: boxWidth - 140 })
  doc.text(
    formatCurrency(batchSummary.net_payout, invoiceSettings.currency, invoiceSettings.roundingMode),
    boxX + boxWidth - 120,
    lineY,
    { width: 110, align: 'right' },
  )
  lineY += lineHeightSettlement

  // Payout details
  if (batchSummary.payout_date || batchSummary.payout_reference || batchSummary.payout_notes) {
    lineY += lineHeightSettlement
    doc
      .font('Helvetica-Bold')
      .fontSize(FONTS.BODY)
      .fillColor(COLORS.PRIMARY)
      .text('Payout Details:', boxX + 10, lineY)
    lineY += lineHeightSettlement
    doc.font('Helvetica').fontSize(FONTS.BODY)
    if (batchSummary.payout_date) {
      doc.text(
        `Payout Date: ${formatDate(batchSummary.payout_date, invoiceSettings.dateFormat)}`,
        boxX + 20,
        lineY,
      )
      lineY += lineHeightSettlement
    }
    if (batchSummary.payout_reference) {
      doc.text(`Payout Reference: ${batchSummary.payout_reference}`, boxX + 20, lineY)
      lineY += lineHeightSettlement
    }
    if (batchSummary.payout_notes) {
      doc.text(`Notes: ${batchSummary.payout_notes}`, boxX + 20, lineY, {
        width: boxWidth - 40,
      })
      lineY += lineHeightSettlement
    }
  }

  if (isNegativePayout) {
    lineY += lineHeightSettlement
    doc.font('Helvetica-Bold').fontSize(FONTS.BODY).fillColor(COLORS.DISCOUNT)
    doc.text(
      'Negative balance carried forward. This amount will be adjusted against future settlements.',
      boxX + 10,
      lineY,
      { width: boxWidth - 20 },
    )
  }

  doc.fillColor(COLORS.PRIMARY)
  doc.y = settlementY + boxHeight + SPACING.SUBSECTION

  // ============================================================================
  // ORDER ITEMS TABLE SECTION (matches buyer invoice items table style)
  // ============================================================================
  // Always show order items table if there are orders in the settlement
  if (orderItems && orderItems.length > 0) {
    console.log(`📋 Rendering ${orderItems.length} order items in settlement invoice`)
    const pageBreakThreshold = 787
    const tableTop = doc.y + SPACING.SUBSECTION
    const rowHeight = 30
    const tableLeft = SPACING.MARGIN
    const tableRight = 545
    const tableWidth = 495

    // Calculate column widths
    const colWidths = {
      slNo: 30,
      orderId: 80,
      description: 150,
      hsn: 50,
      qty: 30,
      price: 60,
      gstRate: 40,
      gstType: 40,
      subtotal: 65,
    }

    // Helper function to draw table header
    const drawTableHeader = (yPosition: number) => {
      const headerHeight = 30
      const headerTextY = yPosition + headerHeight / 2 - 3
      const cellPadding = 3

      // Gray background for header
      doc.rect(tableLeft, yPosition, tableWidth, headerHeight).fill(COLORS.BACKGROUND)

      doc.fillColor(COLORS.ACCENT)
      doc.font('Helvetica-Bold').fontSize(FONTS.TABLE_HEADER)

      let headerX = tableLeft
      doc.text('Sl. No', headerX + cellPadding, headerTextY, {
        width: colWidths.slNo - cellPadding * 2,
        align: 'left',
      })
      headerX += colWidths.slNo

      doc.text('Order ID', headerX + cellPadding, headerTextY, {
        width: colWidths.orderId - cellPadding * 2,
        align: 'left',
      })
      headerX += colWidths.orderId

      doc.text('Description', headerX + cellPadding, headerTextY, {
        width: colWidths.description - cellPadding * 2,
        align: 'left',
      })
      headerX += colWidths.description

      doc.text('HSN', headerX, headerTextY, { width: colWidths.hsn, align: 'center' })
      headerX += colWidths.hsn

      doc.text('Qty', headerX, headerTextY, { width: colWidths.qty, align: 'center' })
      headerX += colWidths.qty

      doc.text('Price', headerX, headerTextY, { width: colWidths.price, align: 'right' })
      headerX += colWidths.price

      doc.text('GST %', headerX, headerTextY, { width: colWidths.gstRate, align: 'center' })
      headerX += colWidths.gstRate

      doc.text('Tax Type', headerX, headerTextY, { width: colWidths.gstType, align: 'center' })
      headerX += colWidths.gstType

      doc.text('Subtotal', headerX, headerTextY, { width: colWidths.subtotal, align: 'right' })

      doc.fillColor(COLORS.PRIMARY)
      return yPosition + headerHeight + 8
    }

    // Draw initial table header
    doc.y = drawTableHeader(tableTop)
    doc.font('Helvetica').fontSize(FONTS.TABLE_BODY)
    let currentY = doc.y

    orderItems.forEach((item, index) => {
      // Check if we need a new page
      if (currentY + rowHeight > pageBreakThreshold) {
        doc.addPage()
        currentY = SPACING.MARGIN
        currentY = drawTableHeader(currentY)
      }

      // Top border of row
      const rowTop = currentY - 6
      doc
        .moveTo(tableLeft, rowTop)
        .lineTo(tableRight, rowTop)
        .strokeColor('#e5e7eb')
        .lineWidth(1)
        .stroke()

      let colX = tableLeft
      doc.fillColor(COLORS.PRIMARY)

      // Helper function to draw vertical borders
      const drawRowBorder = (x: number, rowTop: number, rowBottom: number) => {
        doc.moveTo(x, rowTop).lineTo(x, rowBottom).strokeColor('#e5e7eb').lineWidth(1).stroke()
      }

      const rowBottom = rowTop + rowHeight

      // Left border
      doc
        .moveTo(tableLeft, rowTop)
        .lineTo(tableLeft, rowBottom)
        .strokeColor('#e5e7eb')
        .lineWidth(1)
        .stroke()

      // Sl. No
      doc.text((index + 1).toString(), colX + 3, currentY, {
        width: colWidths.slNo - 6,
        align: 'left',
      })
      colX += colWidths.slNo
      drawRowBorder(colX, rowTop, rowBottom)

      // Order ID
      const orderDisplay = item.orderNumber || item.orderId.slice(-8)
      doc.text(orderDisplay, colX + 3, currentY, {
        width: colWidths.orderId - 6,
        align: 'left',
      })
      colX += colWidths.orderId
      drawRowBorder(colX, rowTop, rowBottom)

      // Description
      doc.text(item.productName, colX + 3, currentY, {
        width: colWidths.description - 6,
        align: 'left',
      })
      colX += colWidths.description
      drawRowBorder(colX, rowTop, rowBottom)

      // HSN Code
      doc.text(item.hsnSacCode || '-', colX, currentY, {
        width: colWidths.hsn,
        align: 'center',
      })
      colX += colWidths.hsn
      drawRowBorder(colX, rowTop, rowBottom)

      // Qty
      doc.text(item.quantity.toString(), colX, currentY, {
        width: colWidths.qty,
        align: 'center',
      })
      colX += colWidths.qty
      drawRowBorder(colX, rowTop, rowBottom)

      // Price
      doc.text(
        formatCurrency(item.price, invoiceSettings.currency, invoiceSettings.roundingMode),
        colX,
        currentY,
        { width: colWidths.price, align: 'right' },
      )
      colX += colWidths.price
      drawRowBorder(colX, rowTop, rowBottom)

      // GST Rate
      const gstPercentDisplay =
        item.gstRatePercent && item.gstRatePercent > 0 ? `${item.gstRatePercent}%` : '-'
      doc.text(gstPercentDisplay, colX, currentY, {
        width: colWidths.gstRate,
        align: 'center',
      })
      colX += colWidths.gstRate
      drawRowBorder(colX, rowTop, rowBottom)

      // Tax Type
      const taxTypeDisplay =
        item.gstRatePercent && item.gstRatePercent > 0 ? item.gstTaxType || 'IGST' : '-'
      doc.text(taxTypeDisplay, colX, currentY, {
        width: colWidths.gstType,
        align: 'center',
      })
      colX += colWidths.gstType
      drawRowBorder(colX, rowTop, rowBottom)

      // Subtotal (bold for emphasis)
      doc.font('Helvetica-Bold')
      doc.text(
        formatCurrency(item.subtotal, invoiceSettings.currency, invoiceSettings.roundingMode),
        colX,
        currentY,
        { width: colWidths.subtotal, align: 'right' },
      )
      doc.font('Helvetica')

      // Right border
      doc
        .moveTo(tableRight, rowTop)
        .lineTo(tableRight, rowBottom)
        .strokeColor('#e5e7eb')
        .lineWidth(1)
        .stroke()

      // Bottom border
      doc
        .moveTo(tableLeft, rowBottom)
        .lineTo(tableRight, rowBottom)
        .strokeColor('#e5e7eb')
        .lineWidth(1)
        .stroke()

      currentY += rowHeight
    })

    doc.y = currentY + SPACING.SUBSECTION
  }

  // Skip order-wise breakdown and ledger log for cleaner invoice
  // All settlement details are already shown in the summary section above

  // ============================================================================
  // SIGNATURE SECTION (matches buyer invoice style) - Respects admin settings
  // ============================================================================
  // Use seller signature name/title if allowed, otherwise marketplace signature
  const signatureName = 'Authorized Signatory'
  const signatureTitle =
    invoiceSettings.allowSellerSignature && seller?.authorizedPersonDesignation
      ? seller.authorizedPersonDesignation
      : branding.signatureTitle

  // Check if we need a new page for signature
  const signatureHeight = signatureBuffer ? 55 : 30
  const signatureNameHeight = 9
  const signatureTitleHeight = signatureTitle ? 9 : 0
  const signatureSpacing = 6
  const totalSignatureHeight =
    signatureHeight + signatureNameHeight + signatureTitleHeight + signatureSpacing

  const pageBreakThreshold = 787
  const signatureStartY = doc.y
  if (signatureStartY + totalSignatureHeight > pageBreakThreshold) {
    doc.addPage()
    doc.y = SPACING.MARGIN
  }

  const finalSignatureY = doc.y
  // Align signature to right (matches buyer invoice)
  const signatureX = 355
  const signatureWidth = 170

  let signatureBottom = finalSignatureY
  if (signatureBuffer) {
    try {
      const pageRange = doc.bufferedPageRange()
      const currentPage = pageRange.start + pageRange.count - 1
      doc.switchToPage(currentPage)
      doc.image(signatureBuffer, signatureX, finalSignatureY, {
        fit: [signatureWidth, 55],
      })
      signatureBottom = finalSignatureY + 59
    } catch (error) {
      console.error('Error rendering signature image:', error)
      doc
        .moveTo(signatureX, finalSignatureY + 15)
        .lineTo(signatureX + signatureWidth, finalSignatureY + 15)
        .strokeColor('#d1d5db')
        .lineWidth(1)
        .stroke()
      signatureBottom = finalSignatureY + 30
    }
  } else {
    doc
      .moveTo(signatureX, finalSignatureY + 15)
      .lineTo(signatureX + signatureWidth, finalSignatureY + 15)
      .strokeColor('#d1d5db')
      .lineWidth(1)
      .stroke()
    signatureBottom = finalSignatureY + 30
  }

  // Signature name
  const signatureNameY = signatureBottom + 2
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
  doc.y = Math.max(doc.y, signatureBottom + 2)

  // ============================================================================
  // FOOTER SECTION (matches buyer invoice style) - Respects admin settings
  // ============================================================================
  const footerY = doc.y + 20
  doc
    .moveTo(SPACING.MARGIN, footerY - SPACING.SMALL)
    .lineTo(545, footerY - SPACING.SMALL)
    .strokeColor(COLORS.BORDER_DARK)
    .lineWidth(1)
    .stroke()

  // Seller footer note (if allowed and seller has one) - respects allowSellerFooterNote setting
  if (invoiceSettings.allowSellerFooterNote && seller?.storeDescription) {
    doc
      .font('Helvetica')
      .fontSize(FONTS.SMALL)
      .fillColor(COLORS.TERTIARY)
      .text(seller.storeDescription, SPACING.MARGIN, footerY + 8, {
        width: 495,
        align: 'center',
      })
  }

  // Add page numbers
  const pageRange = doc.bufferedPageRange()
  const totalPages = pageRange.count || 1
  const startPageIndex = pageRange.start || 0

  if (totalPages > 0) {
    for (let pageIndex = startPageIndex; pageIndex < startPageIndex + totalPages; pageIndex++) {
      try {
        doc.switchToPage(pageIndex)
        const pageFooterY = 780
        doc.rect(400, pageFooterY - 5, 145, 15).fill('#ffffff')
        const pageNumber = pageIndex - startPageIndex + 1
        doc
          .font('Helvetica')
          .fontSize(FONTS.SMALL)
          .fillColor(COLORS.TERTIARY)
          .text(`Page ${pageNumber} of ${totalPages}`, SPACING.MARGIN, pageFooterY, {
            width: 495,
            align: 'right',
          })
      } catch (error) {
        console.warn(`Could not add page number to page ${pageIndex}:`, error)
      }
    }
  }

  doc.end()
  const pdfBuffer = await pdfPromise

  const sellerIdStr =
    typeof batch.seller === 'string'
      ? batch.seller
      : (batch.seller as mongoose.Types.ObjectId | undefined)?.toString() || 'unknown-seller'
  const key = `settlements/invoices/${sellerIdStr}/${invoiceNumber}.pdf`
  const url = await uploadToR2(pdfBuffer, key as any, 'application/pdf', 'settlements')
  return url
}

export const generateAndAttachSettlementInvoiceToBatch = async (
  batchId: string,
  { forceRegenerate = false }: { forceRegenerate?: boolean } = {},
): Promise<ISellerSettlementBatch> => {
  const batch = await SellerSettlementBatch.findById(batchId)
  if (!batch) {
    throw new Error('Settlement batch not found')
  }

  if (batch.status !== 'PAID') {
    throw new Error('Invoice can only be generated for PAID settlement batches')
  }

  let invoiceNumber = batch.invoiceNumber
  if (!invoiceNumber || forceRegenerate) {
    invoiceNumber = await generateNextSettlementInvoiceNumber()
    batch.invoiceNumber = invoiceNumber
  }

  const compiled = await compileSettlementInvoiceData((batch._id as any).toString())
  const pdfUrl = await generateSettlementInvoicePdfAndUpload({
    ...compiled,
    invoiceNumber,
  })

  batch.invoiceUrl = pdfUrl
  await batch.save()

  return batch
}
