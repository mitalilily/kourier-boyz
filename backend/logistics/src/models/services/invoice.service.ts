import axios from 'axios'
import fs from 'fs'
import path from 'path'
import { and, desc, eq, gte, ilike, lte, sql } from 'drizzle-orm'
import PdfPrinter from 'pdfmake'
import type { TableCell } from 'pdfmake/interfaces'
import { detectFileType } from '../../utils/detectFileType'
import { db } from '../client'
import { invoices } from '../schema/invoices'
import { presignDownload } from './upload.service'
import { getAdminInvoicePreferences } from './invoicePreferences.service'
// Product + Invoice types
// ----------------------
export interface Product {
  name: string
  sku: string
  qty: number
  price: number
  hsn: string
  discount: number
  box_name?: string
  tax_rate: number
}

interface InvoiceData {
  invoiceNumber: string
  invoicePrefix?: string
  invoiceSuffix?: string
  invoiceDate: string
  buyerName: string
  orderAmt?: number
  buyerPhone: string
  buyerEmail: string
  supportEmail?: string
  buyerAddress: string
  buyerCity: string
  buyerState: string
  buyerPincode: string
  products: Product[]
  invoiceAmount?: number
  shippingCharges: number
  giftWrap?: number
  transactionFee?: number
  discount?: number
  orderType: 'prepaid' | 'cod'
  courierCod?: number
  prepaidAmount?: number
  courierName: string
  courierId: string
  logoBuffer?: Buffer
  signatureBuffer?: Buffer
  companyName?: string
  companyGST?: string
  layout?: 'classic' | 'thermal'
  orderId?: string
  awbNumber?: string
  courierPartner?: string
  serviceType?: string
  pickupPincode?: string
  deliveryPincode?: string
  orderDate?: string
  sellerName?: string
  brandName?: string
  sellerAddress?: string
  sellerStateCode?: string
  gstNumber?: string
  panNumber?: string
  supportPhone?: string
  invoiceNotes?: string
  termsAndConditions?: string
  rtoCharges?: number
}

// ----------------------
// Generate Invoice PDF
// ----------------------
export const generateInvoicePDF = async (invoice: InvoiceData): Promise<Buffer> => {
  const merchantFontPath = path.join(process.cwd(), 'src', 'assets', 'fonts', 'Merchant.ttf')
  const hasMerchantFont = fs.existsSync(merchantFontPath)
  const fonts = {
    Helvetica: {
      normal: 'Helvetica',
      bold: 'Helvetica-Bold',
      italics: 'Helvetica-Oblique',
      bolditalics: 'Helvetica-BoldOblique',
    },
    Courier: {
      normal: 'Courier',
      bold: 'Courier-Bold',
      italics: 'Courier-Oblique',
      bolditalics: 'Courier-BoldOblique',
    },
    ...(hasMerchantFont
      ? {
          Merchant: {
            normal: merchantFontPath,
            bold: merchantFontPath,
            italics: merchantFontPath,
            bolditalics: merchantFontPath,
          },
        }
      : {}),
  }
  const printer = new PdfPrinter(fonts)

  const invoiceNumber = `${invoice.invoicePrefix ?? ''}${invoice.invoiceNumber}${
    invoice.invoiceSuffix ?? ''
  }`
  const isThermal = invoice.layout === 'thermal'
  const fontSize = isThermal ? 7 : 10
  const headerFontSize = isThermal ? 10 : 18
  const classicBaseFont = hasMerchantFont ? 'Merchant' : 'Courier'
  // Black & white / grayscale styling for invoice
  const accentColor = '#000000'
  const dangerColor = '#000000'
  const toAmount = (value: unknown) => {
    const n = Number(value ?? 0)
    return Number.isFinite(n) ? n : 0
  }
  const formatCurrency = (value: number | string | null | undefined) => {
    const num = toAmount(value)
    const abs = Math.abs(num).toFixed(2)
    return `${num < 0 ? '-' : ''}Rs. ${abs}`
  }

  const headerBgColor = '#ffffff'
  const cardBgColor = '#ffffff'
  const cardBorderColor = '#c9ced6'
  const mutedTextColor = '#4b5563'
  const sectionTitleColor = '#000000'
  const grandTotalBg = '#eef1f4'

  // Helper function to validate if buffer is a valid PNG/JPEG/GIF
  const isValidImageBuffer = (buffer: Buffer): boolean => {
    if (!buffer || buffer.length < 4) return false

    // Check for PNG signature: 89 50 4E 47
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
      return true
    }
    // Check for JPEG signature: FF D8 FF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return true
    }
    // Check for GIF signature: 47 49 46 38 (GIF8)
    if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) {
      return true
    }
    // Check for WebP signature: RIFF...WEBP
    if (
      buffer.length >= 12 &&
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46 &&
      buffer[8] === 0x57 &&
      buffer[9] === 0x45 &&
      buffer[10] === 0x42 &&
      buffer[11] === 0x50
    ) {
      return true
    }
    return false
  }

  // Helper function to convert buffer to data URL with proper MIME type detection
  const bufferToDataUrl = async (buffer: Buffer): Promise<string | null> => {
    try {
      if (!buffer || buffer.length === 0) {
        console.warn('⚠️ Empty buffer provided to bufferToDataUrl')
        return null
      }

      // First, try to detect file type using file-type library
      const type = await detectFileType(buffer)

      if (type) {
        // Only allow image types
        if (!type.mime.startsWith('image/')) {
          console.warn(`⚠️ Invalid image type detected: ${type.mime}, skipping image`)
          return null
        }
        const dataUrl = `data:${type.mime};base64,${buffer.toString('base64')}`
        // Validate the data URL format
        if (!dataUrl.startsWith('data:image/')) {
          console.warn('⚠️ Invalid data URL format generated')
          return null
        }
        return dataUrl
      }

      // If file-type couldn't detect, validate buffer manually
      if (!isValidImageBuffer(buffer)) {
        // Check if buffer might be corrupted or incomplete
        if (buffer.length < 100) {
          console.warn(
            `⚠️ Buffer too small (${buffer.length} bytes) - likely corrupted or incomplete download, skipping image`,
          )
        } else {
          console.warn(
            `⚠️ Could not detect image type and buffer does not appear to be a valid image format (PNG/JPEG/GIF/WebP), skipping image (buffer size: ${buffer.length} bytes)`,
          )
        }
        return null
      }

      // Buffer appears to be a valid image but type detection failed
      // Try to determine type from buffer signature
      let mimeType = 'image/png' // default
      if (buffer[0] === 0xff && buffer[1] === 0xd8) {
        mimeType = 'image/jpeg'
      } else if (buffer[0] === 0x47 && buffer[1] === 0x49) {
        mimeType = 'image/gif'
      } else if (buffer.length >= 12 && buffer[8] === 0x57 && buffer[9] === 0x45) {
        mimeType = 'image/webp'
      }

      console.warn(
        `⚠️ Could not detect image type via file-type, but buffer appears valid. Using ${mimeType}`,
      )
      const dataUrl = `data:${mimeType};base64,${buffer.toString('base64')}`

      if (!dataUrl.startsWith('data:image/')) {
        console.warn('⚠️ Invalid data URL format generated')
        return null
      }
      return dataUrl
    } catch (err) {
      console.error('⚠️ Error converting buffer to data URL:', err)
      return null
    }
  }

  // Logo & Signature - handle errors gracefully, don't fail PDF generation
  let logoDataUrl: string | undefined
  if (invoice.logoBuffer) {
    try {
      const dataUrl = await bufferToDataUrl(invoice.logoBuffer)
      if (dataUrl) {
        logoDataUrl = dataUrl
      }
    } catch (err) {
      console.warn('⚠️ Failed to process logo buffer, continuing without logo:', err)
    }
  }

  const adminPrefs = await getAdminInvoicePreferences()
  const platformLogoKey =
    adminPrefs?.includeLogo !== false && adminPrefs?.logoFile ? adminPrefs.logoFile : null

  // Platform (Kourier Boyz) logo comes from admin billing preferences only.
  let platformLogoDataUrl: string | undefined
  if (platformLogoKey) {
    try {
      const logoUrl = await presignDownload(platformLogoKey)
      if (logoUrl && typeof logoUrl === 'string') {
        try {
          const resp = await axios.get(logoUrl, { responseType: 'arraybuffer', timeout: 5000 })
          const buffer = Buffer.from(resp.data)
          const dataUrl = await bufferToDataUrl(buffer)
          if (dataUrl) {
            platformLogoDataUrl = dataUrl
          }
        } catch (err) {
          console.warn(
            '⚠️ Failed to download platform logo from admin billing preferences, continuing without it:',
            err,
          )
        }
      }
    } catch (err) {
      console.warn(
        '⚠️ Failed to get platform logo URL from admin billing preferences, continuing without it:',
        err,
      )
    }
  } else {
    console.log('ℹ️ No admin billing-preferences logo configured, skipping platform logo')
  }

  let signatureDataUrl: string | undefined
  if (invoice.signatureBuffer) {
    try {
      console.log('📝 Processing signature buffer for invoice...')
      const dataUrl = await bufferToDataUrl(invoice.signatureBuffer)
      if (dataUrl) {
        signatureDataUrl = dataUrl
        console.log('✅ Signature buffer successfully converted to data URL')
      } else {
        console.warn('⚠️ Signature buffer conversion returned null/undefined')
      }
    } catch (err) {
      console.warn('⚠️ Failed to process signature buffer, continuing without signature:', err)
    }
  } else {
    console.log('ℹ️ No signature buffer provided for invoice')
  }


  // -------------------
  // Prepare images object for pdfmake (must be before content arrays)
  // -------------------
  const images: Record<string, string> = {}

  // Validate and add logo
  if (logoDataUrl && typeof logoDataUrl === 'string' && logoDataUrl.startsWith('data:image/')) {
    try {
      const base64Match = logoDataUrl.match(/^data:image\/[^;]+;base64,(.+)$/)
      if (base64Match && base64Match[1] && base64Match[1].length > 0) {
        images.logo = logoDataUrl
        console.log('✅ Logo successfully added to invoice PDF')
      } else {
        console.warn('⚠️ Logo data URL missing base64 data, skipping')
      }
    } catch (err) {
      console.warn('⚠️ Error validating logo data URL, skipping:', err)
    }
  }

  // Validate and add signature
  if (
    signatureDataUrl &&
    typeof signatureDataUrl === 'string' &&
    signatureDataUrl.startsWith('data:image/')
  ) {
    try {
      const base64Match = signatureDataUrl.match(/^data:image\/[^;]+;base64,(.+)$/)
      if (base64Match && base64Match[1] && base64Match[1].length > 0) {
        images.signature = signatureDataUrl
        console.log('✅ Signature successfully added to invoice PDF')
      } else {
        console.warn('⚠️ Signature data URL missing base64 data, skipping')
      }
    } catch (err) {
      console.warn('⚠️ Error validating signature data URL, skipping:', err)
    }
  } else if (invoice.signatureBuffer) {
    console.warn('⚠️ Signature buffer provided but could not be converted to data URL')
  }

  // Validate and add platform logo
  if (
    platformLogoDataUrl &&
    typeof platformLogoDataUrl === 'string' &&
    platformLogoDataUrl.startsWith('data:image/')
  ) {
    try {
      const base64Match = platformLogoDataUrl.match(/^data:image\/[^;]+;base64,(.+)$/)
      if (base64Match && base64Match[1] && base64Match[1].length > 0) {
        images.platformLogo = platformLogoDataUrl
      } else {
        console.warn('⚠️ Platform logo data URL missing base64 data, skipping')
      }
    } catch (err) {
      console.warn('⚠️ Error validating platform logo data URL, skipping:', err)
    }
  }

  // -------------------
  // Charges
  // -------------------
  const subtotal = invoice.products.reduce((acc, p) => {
    const lineAmount = toAmount(p.price) * toAmount(p.qty ?? 1) - toAmount(p.discount ?? 0)
    return acc + Math.max(0, lineAmount)
  }, 0)
  const shipping = toAmount(invoice.shippingCharges)
  const giftWrap = toAmount(invoice.giftWrap)
  const txnFee = toAmount(invoice.transactionFee)
  const discount = Math.abs(toAmount(invoice.discount))
  const prepaid = Math.abs(toAmount(invoice.prepaidAmount))
  const suppliedInvoiceAmount = toAmount(invoice.invoiceAmount)
  const grandTotal = Math.max(
    0,
    suppliedInvoiceAmount > 0
      ? suppliedInvoiceAmount
      : subtotal + shipping + giftWrap + txnFee - (discount + prepaid),
  )

  // Optional support line (avoid showing "null")
  const supportLine =
    invoice.supportEmail && invoice.supportEmail.trim().length > 0
      ? `• For support contact: ${invoice.supportEmail}`
      : null

  // -------------------
  // Product Rows + HSN Summary (for GST-style layout)
  // -------------------
  const hsnSummary: Record<
    string,
    { taxable: number; taxRate: number; cgst: number; sgst: number }
  > = {}

  const productRowsClassic = [
    [
      { text: 'SNo', bold: true, alignment: 'center', color: accentColor },
      { text: 'Item Description', bold: true, color: accentColor },
      { text: 'Qty', bold: true, alignment: 'center', color: accentColor },
      { text: 'Rate', bold: true, alignment: 'right', color: accentColor },
      { text: 'Tax', bold: true, alignment: 'right', color: accentColor },
      { text: 'Amount (Rs.)', bold: true, alignment: 'right', color: accentColor },
    ],
    ...invoice.products.map((p, index) => {
      const qty = toAmount(p.qty ?? 1)
      const price = toAmount(p.price)
      const discount = toAmount(p.discount)
      const taxRate = toAmount(p.tax_rate)
      const lineTaxable = Math.max(0, price * qty - discount)
      const lineTax = (lineTaxable * taxRate) / 100
      const cgst = lineTax / 2
      const sgst = lineTax / 2
      const hsnCode = p.hsn || 'NA'

      if (!hsnSummary[hsnCode]) {
        hsnSummary[hsnCode] = {
          taxable: 0,
          taxRate,
          cgst: 0,
          sgst: 0,
        }
      }
      hsnSummary[hsnCode].taxable += lineTaxable
      hsnSummary[hsnCode].cgst += cgst
      hsnSummary[hsnCode].sgst += sgst

      return [
        { text: (index + 1).toString(), alignment: 'center' },
        p.name ?? p.box_name ?? 'N/A',
        { text: qty.toString(), alignment: 'center' },
        { text: formatCurrency(price), alignment: 'right' },
        { text: `${taxRate}%`, alignment: 'right' },
        { text: formatCurrency(lineTaxable), alignment: 'right' },
      ]
    }),
  ]

  const hsnTotalRow = Object.values(hsnSummary).reduce(
    (acc, v) => {
      acc.taxable += v.taxable
      acc.cgst += v.cgst
      acc.sgst += v.sgst
      return acc
    },
    { taxable: 0, cgst: 0, sgst: 0 },
  )

  const productRowsThermal = [
    ['Item', 'Qty', 'Price', 'Total'],
    ...invoice.products.map((p) => {
      const qty = toAmount(p.qty ?? 1)
      const price = toAmount(p.price)
      const discount = toAmount(p.discount)
      const total = Math.max(0, price * qty - discount)
      return [
        p.name ?? p.box_name ?? 'N/A',
        qty.toString(),
        formatCurrency(price),
        formatCurrency(total),
      ]
    }),
  ]

  const borderLayout = {
    hLineColor: () => '#d1d5db',
    vLineColor: () => '#d1d5db',
    hLineWidth: () => 0.8,
    vLineWidth: () => 0.8,
  }

  const toSafeString = (value?: string | null) => (value ? value.trim() : '')
  const sellerDisplayName =
    toSafeString(invoice.brandName) || toSafeString(invoice.sellerName) || toSafeString(invoice.companyName)
  const sellerAddressLines = (invoice.sellerAddress || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  const buyerAddressLines = [
    invoice.buyerAddress,
    [invoice.buyerCity, invoice.buyerState].filter(Boolean).join(', '),
    invoice.buyerPincode,
  ].filter(Boolean)
  const sellerStateCode = toSafeString(invoice.sellerStateCode)
  const buyerStateName = toSafeString(invoice.buyerState)
  const isInterState =
    sellerStateCode &&
    buyerStateName &&
    sellerStateCode.toLowerCase() !== buyerStateName.toLowerCase()
  const rtoCharges = toAmount(invoice.rtoCharges ?? 0)
  const badgeIsCOD = invoice.orderType === 'cod'
  let cgstTotal = 0
  let sgstTotal = 0
  let igstTotal = 0
  const productRows: TableCell[][] = invoice.products.map((p, index) => {
    const qty = toAmount(p.qty ?? 1)
    const price = toAmount(p.price)
    const discount = toAmount(p.discount ?? 0)
    const taxRate = Math.max(0, toAmount(p.tax_rate))
    const lineTaxable = Math.max(0, price * qty - discount)
    const taxAmount = (lineTaxable * taxRate) / 100
    const lineIgst = isInterState ? taxAmount : 0
    const lineCgst = isInterState ? 0 : taxAmount / 2
    const lineSgst = isInterState ? 0 : taxAmount / 2
    cgstTotal += lineCgst
    sgstTotal += lineSgst
    igstTotal += lineIgst
    const lineTotal = lineTaxable + taxAmount

    const hsnCode = p.hsn || 'NA'

    if (!hsnSummary[hsnCode]) {
      hsnSummary[hsnCode] = {
        taxable: 0,
        taxRate,
        cgst: 0,
        sgst: 0,
      }
    }
    hsnSummary[hsnCode].taxable += lineTaxable
    hsnSummary[hsnCode].cgst += lineCgst
    hsnSummary[hsnCode].sgst += lineSgst

    return ([
      { text: String(index + 1), alignment: 'center', color: '#475467' },
      {
        text: p.name ?? p.box_name ?? 'N/A',
        color: '#0f172a',
        margin: [0, 2, 0, 2],
      },
      { text: hsnCode, alignment: 'center', color: '#475467' },
      { text: qty.toString(), alignment: 'right', color: '#0f172a' },
      { text: formatCurrency(price), alignment: 'right', color: '#0f172a' },
      {
        text: taxRate > 0 ? `${taxRate.toFixed(2)}%` : '0%',
        alignment: 'right',
        color: '#475467',
      },
      { text: formatCurrency(lineTotal), alignment: 'right', color: '#0f172a', bold: true },
    ] as TableCell[])
  })
  const taxTotal = cgstTotal + sgstTotal + igstTotal
  const chargesBreakdown = [
    { label: 'Subtotal', value: subtotal },
    { label: 'Shipping Charges', value: shipping },
    { label: 'Gift Wrap', value: giftWrap },
    { label: 'Transaction Fee', value: txnFee },
    { label: 'RTO Charges', value: rtoCharges },
    { label: 'Discount', value: -discount },
    { label: 'Prepaid Amount', value: -prepaid },
  ]
  const breakdownSum = chargesBreakdown.reduce((sum, item) => sum + Number(item.value || 0), 0)
  const grandTotalModern = Math.max(
    0,
    suppliedInvoiceAmount > 0 ? suppliedInvoiceAmount : breakdownSum + taxTotal,
  )
  const notesText = toSafeString(invoice.invoiceNotes)
  const termsText = toSafeString(invoice.termsAndConditions)
  const supportContact = [invoice.supportEmail, invoice.supportPhone].filter(Boolean).join(' | ')


  const buildHeaderBand = () => ({
    table: {
      widths: ['58%', '42%'],
      body: [[
        {
          stack: [
            images.logo
              ? { image: 'logo', width: 120, margin: [0, 0, 0, 6] }
              : {
                  text: sellerDisplayName || invoice.companyName || 'Seller',
                  fontSize: headerFontSize,
                  bold: true,
                  font: classicBaseFont,
                  color: '#000',
                },
            sellerDisplayName
              ? { text: sellerDisplayName, fontSize: 13, color: '#000', font: classicBaseFont }
              : null,
            invoice.gstNumber
              ? { text: `GSTIN: ${invoice.gstNumber}`, fontSize: 11, color: mutedTextColor, font: classicBaseFont }
              : null,
          ].filter(Boolean),
          margin: [10, 10, 10, 10],
        },
        {
          stack: [
            { text: 'TAX INVOICE', fontSize: 15, bold: true, alignment: 'right', font: classicBaseFont },
            { text: invoiceNumber, fontSize: 22, bold: true, alignment: 'right', font: classicBaseFont, margin: [0, 3, 0, 3] },
            { text: `Date: ${invoice.invoiceDate ?? '-'}`, fontSize: 12, alignment: 'right', font: classicBaseFont },
            images.platformLogo
              ? { image: 'platformLogo', width: 70, alignment: 'right', margin: [0, 10, 0, 0] }
              : null,
          ].filter(Boolean),
          margin: [10, 10, 10, 10],
        },
      ]],
    },
    layout: borderLayout,
    margin: [0, 0, 0, 14],
  })

  const buildClassicLayout = () => {
    const fromDetails = [
      { text: 'FROM', bold: true, fontSize: 11, font: classicBaseFont },
      { text: sellerDisplayName || 'Seller', bold: true, fontSize: 14, font: classicBaseFont, margin: [0, 2, 0, 4] },
      ...(sellerAddressLines.length
        ? sellerAddressLines.map((line) => ({ text: line, fontSize: 11, color: mutedTextColor, font: classicBaseFont }))
        : [{ text: 'Warehouse address not provided', fontSize: 11, color: mutedTextColor, font: classicBaseFont }]),
      sellerStateCode ? { text: `State Code: ${sellerStateCode}`, fontSize: 11, color: mutedTextColor, font: classicBaseFont } : null,
      invoice.gstNumber ? { text: `GSTIN: ${invoice.gstNumber}`, fontSize: 11, color: mutedTextColor, font: classicBaseFont } : null,
      invoice.panNumber ? { text: `PAN: ${invoice.panNumber}`, fontSize: 11, color: mutedTextColor, font: classicBaseFont } : null,
      supportContact ? { text: `Support: ${supportContact}`, fontSize: 11, color: mutedTextColor, font: classicBaseFont } : null,
    ].filter(Boolean)

    const buyerDetails = [
      { text: 'BILL TO', bold: true, fontSize: 11, font: classicBaseFont },
      { text: invoice.buyerName, bold: true, fontSize: 14, font: classicBaseFont, margin: [0, 2, 0, 4] },
      ...buyerAddressLines.map((line) => ({ text: line, fontSize: 11, color: mutedTextColor, font: classicBaseFont })),
      invoice.buyerPhone ? { text: `Phone: ${invoice.buyerPhone}`, fontSize: 11, color: mutedTextColor, font: classicBaseFont } : null,
      invoice.buyerEmail ? { text: `Email: ${invoice.buyerEmail}`, fontSize: 11, color: mutedTextColor, font: classicBaseFont } : null,
    ].filter(Boolean)

    const partySection = {
      table: {
        widths: ['50%', '50%'],
        body: [[
          { stack: fromDetails, margin: [10, 10, 10, 10] },
          { stack: buyerDetails, margin: [10, 10, 10, 10] },
        ]],
      },
      layout: borderLayout,
      margin: [0, 0, 0, 14],
    }

    const summaryTable = {
      table: {
        widths: ['20%', '30%', '20%', '30%'],
        body: [
          [
            { text: 'Order ID', bold: true, fontSize: 11, font: classicBaseFont },
            { text: invoice.orderId || invoiceNumber, fontSize: 11, font: classicBaseFont },
            { text: 'Invoice Date', bold: true, fontSize: 11, font: classicBaseFont },
            { text: invoice.invoiceDate || '-', fontSize: 11, font: classicBaseFont },
          ],
          [
            { text: 'AWB Number', bold: true, fontSize: 11, font: classicBaseFont },
            { text: invoice.awbNumber || '-', fontSize: 11, font: classicBaseFont },
            { text: 'Order Date', bold: true, fontSize: 11, font: classicBaseFont },
            { text: invoice.orderDate || '-', fontSize: 11, font: classicBaseFont },
          ],
          [
            { text: 'Pickup Pincode', bold: true, fontSize: 11, font: classicBaseFont },
            { text: invoice.pickupPincode || '-', fontSize: 11, font: classicBaseFont },
            { text: 'Delivery Pincode', bold: true, fontSize: 11, font: classicBaseFont },
            { text: invoice.deliveryPincode || invoice.buyerPincode || '-', fontSize: 11, font: classicBaseFont },
          ],
          [
            { text: 'Payment Type', bold: true, fontSize: 11, font: classicBaseFont },
            { text: badgeIsCOD ? 'COD' : 'PREPAID', bold: true, fontSize: 11, font: classicBaseFont },
            { text: 'Collection Note', bold: true, fontSize: 11, font: classicBaseFont },
            { text: badgeIsCOD ? 'Amount to be collected on delivery' : 'Paid before dispatch', fontSize: 11, font: classicBaseFont },
          ],
        ],
      },
      layout: borderLayout,
      margin: [0, 0, 0, 14],
    }

    const itemsTable = {
      table: {
        headerRows: 1,
        widths: [32, '*', 70, 48, 82, 58, 90],
        body: [
          [
            { text: 'S.No', bold: true, fontSize: 11, alignment: 'center', font: classicBaseFont },
            { text: 'Item Description', bold: true, fontSize: 11, font: classicBaseFont },
            { text: 'HSN/SAC', bold: true, fontSize: 11, alignment: 'center', font: classicBaseFont },
            { text: 'Qty', bold: true, fontSize: 11, alignment: 'right', font: classicBaseFont },
            { text: 'Unit Price', bold: true, fontSize: 11, alignment: 'right', font: classicBaseFont },
            { text: 'Tax', bold: true, fontSize: 11, alignment: 'right', font: classicBaseFont },
            { text: 'Line Total', bold: true, fontSize: 11, alignment: 'right', font: classicBaseFont },
          ],
          ...productRows.map((row) =>
            row.map((cell) => ({
              ...(cell as any),
              font: classicBaseFont,
              fontSize: 11,
              color: '#000',
            })),
          ),
        ],
      },
      layout: {
        ...borderLayout,
        fillColor: (rowIndex: number) => (rowIndex === 0 ? '#f3f4f6' : null),
        paddingTop: () => 8,
        paddingBottom: () => 8,
      },
      margin: [0, 0, 0, 14],
    }

    const filteredCharges = chargesBreakdown.filter((item) => {
      if (item.label === 'RTO Charges' && rtoCharges === 0) return false
      return true
    })

    const chargesTableBody: TableCell[][] = filteredCharges
      .map((row) => [
        { text: row.label, fontSize: 11, color: '#000', font: classicBaseFont },
        { text: formatCurrency(row.value), fontSize: 11, alignment: 'right', color: '#000', font: classicBaseFont },
      ] as TableCell[])

    if (taxTotal > 0) {
      chargesTableBody.push([
        { text: 'Tax', fontSize: 11, color: '#000', font: classicBaseFont },
        { text: formatCurrency(taxTotal), fontSize: 11, alignment: 'right', color: '#000', font: classicBaseFont },
      ] as TableCell[])
    }

    chargesTableBody.push([
      { text: 'Grand Total', fontSize: 13, bold: true, color: '#000', fillColor: grandTotalBg, font: classicBaseFont },
      { text: formatCurrency(grandTotalModern), fontSize: 13, bold: true, alignment: 'right', color: '#000', fillColor: grandTotalBg, font: classicBaseFont },
    ] as TableCell[])

    const chargesCard = {
      table: { widths: ['*', 'auto'], body: chargesTableBody },
      layout: {
        ...borderLayout,
        paddingTop: () => 6,
        paddingBottom: () => 6,
        paddingLeft: () => 8,
        paddingRight: () => 8,
      },
    }

    const gstRows = [
      { label: 'Taxable Amount', value: subtotal },
      ...(cgstTotal > 0 ? [{ label: 'CGST', value: cgstTotal }] : []),
      ...(sgstTotal > 0 ? [{ label: 'SGST', value: sgstTotal }] : []),
      ...(igstTotal > 0 ? [{ label: 'IGST', value: igstTotal }] : []),
    ]

    const gstSummary =
      gstRows.length > 1 || (gstRows.length === 1 && gstRows[0].value > 0)
        ? {
            table: {
              widths: ['*', 'auto'],
              body: gstRows.map((row) => [
                { text: row.label, fontSize: 11, color: '#000', font: classicBaseFont },
                { text: formatCurrency(row.value), fontSize: 11, alignment: 'right', color: '#000', font: classicBaseFont },
              ]),
            },
            layout: borderLayout,
            margin: [0, 0, 0, 8],
          }
        : null

    const notesBlock = notesText
      ? {
          table: {
            widths: ['*'],
            body: [[{
              stack: [
                { text: 'Notes', style: 'sectionTitle' },
                { text: notesText, fontSize: 11, color: '#000', font: classicBaseFont },
              ],
              margin: [8, 8, 8, 8],
            }]],
          },
          layout: borderLayout,
          margin: [0, 0, 0, 8],
        }
      : null

    const signatureSection = {
      table: {
        widths: ['*'],
        body: [[{
          stack: [
            { text: 'Authorized Signatory', fontSize: 12, bold: true, color: '#000', font: classicBaseFont },
            { text: `Signed by ${sellerDisplayName || invoice.companyName || 'Seller'}`, fontSize: 11, color: mutedTextColor, font: classicBaseFont, margin: [0, 2, 0, 8] },
            images.signature
              ? { image: 'signature', width: 170, alignment: 'left', margin: [0, 4, 0, 8] }
              : { text: 'Signature provided via invoice settings', fontSize: 11, color: mutedTextColor, italics: true, font: classicBaseFont },
          ],
          margin: [10, 10, 10, 10],
        }]],
      },
      layout: borderLayout,
      margin: [0, 18, 0, 0],
    }

    const totalsLayout = {
      columns: [
        {
          width: '*',
          stack: [
            gstSummary ? { stack: [{ text: 'Tax Summary', style: 'sectionTitle', margin: [0, 0, 0, 6] }, gstSummary] } : null,
            notesBlock,
          ].filter(Boolean),
        },
        {
          width: 270,
          stack: [
            { text: 'Charges Breakdown', style: 'sectionTitle', margin: [0, 0, 0, 6] },
            chargesCard,
          ],
        },
      ],
      columnGap: 16,
      margin: [0, 0, 0, 14],
    }

    return [partySection, summaryTable, itemsTable, totalsLayout, signatureSection].filter(Boolean)
  }

  const contentClassic: any[] = [buildHeaderBand(), ...buildClassicLayout()]

  // -------------------
  // Thermal Layout
  // -------------------
  const contentThermal: any[] = [
    { text: invoice.companyName ?? 'Kourier Boyz', alignment: 'center', bold: true },
    { text: 'TAX INVOICE', alignment: 'center', bold: true, margin: [0, 2, 0, 2] },
    {
      text: 'ORIGINAL FOR RECIPIENT',
      alignment: 'center',
      fontSize: fontSize - 1,
      color: '#4b5563',
      margin: [0, 0, 0, 2],
    },
    {
      table: {
        widths: ['*', '*'],
        body: [
          [
            { text: `Invoice: ${invoiceNumber}`, margin: [4, 4, 4, 4] },
            { text: `Date: ${invoice.invoiceDate}`, alignment: 'right', margin: [4, 4, 4, 4] },
          ],
        ],
      },
      layout: borderLayout,
      margin: [0, 0, 0, 4],
    },
    {
      table: {
        widths: ['*'],
        body: [
          [
            {
              stack: [
                { text: invoice.buyerName, bold: true },
                { text: invoice.buyerAddress },
                { text: `${invoice.buyerCity}, ${invoice.buyerState} - ${invoice.buyerPincode}` },
                { text: `Ph: ${invoice.buyerPhone}` },
              ],
              margin: [4, 4, 4, 4],
            },
          ],
        ],
      },
      layout: borderLayout,
      margin: [0, 0, 0, 4],
    },
    {
      table: { widths: ['*', 'auto', 'auto', 'auto'], body: productRowsThermal },
      layout: borderLayout,
      margin: [0, 0, 0, 4],
      fontSize,
    },
    {
      table: {
        widths: ['*', 'auto'],
        body: [
          ['Subtotal', formatCurrency(subtotal)],
          ['Shipping', formatCurrency(shipping)],
          ['Gift Wrap', formatCurrency(giftWrap)],
          ['Txn Fee', formatCurrency(txnFee)],
          ['Discount', formatCurrency(-discount)],
          ['Prepaid', formatCurrency(-prepaid)],
          [
            { text: 'Grand Total', bold: true },
            { text: formatCurrency(grandTotal), bold: true },
          ],
        ],
      },
      layout: borderLayout,
      margin: [0, 0, 0, 4],
      fontSize,
    },
    {
      table: {
        widths: ['*'],
        body: [
          [
            {
              stack: [
                { text: 'Notes', bold: true, margin: [0, 0, 0, 2] },
                ...(supportLine ? [{ text: supportLine }] : []),
                { text: 'Transit delays are beyond our control.' },
              ],
              margin: [4, 4, 4, 4],
              color: '#4b5563',
            },
          ],
        ],
      },
      layout: borderLayout,
      margin: [0, 0, 0, 4],
    },
    images.signature
      ? { image: 'signature', width: 56, alignment: 'right', margin: [0, 4, 0, 0] }
      : { text: 'Authorized Signatory', alignment: 'right', italics: true, fontSize, color: '#6b7280' },
    platformLogoDataUrl
      ? { image: 'platformLogo', width: 40, alignment: 'center', margin: [0, 4, 0, 0] }
      : null,
    {
      text: 'Powered by Kourier Boyz',
      alignment: 'center',
      italics: true,
      margin: [0, 4, 0, 0],
      fontSize,
      color: '#6b7280',
    },
  ].filter(Boolean)

  // -------------------
  // Final Definition
  // -------------------
  // Images object is already created above, before content arrays

  const docDefinition: any = {
    content: isThermal ? contentThermal : contentClassic,
    ...(Object.keys(images).length > 0 && { images }),
    styles: {
      sectionHeader: { bold: true, fontSize: fontSize + 2, color: accentColor, font: classicBaseFont },
      sectionTitle: { bold: true, fontSize: fontSize + 1, color: sectionTitleColor, font: classicBaseFont },
      sectionTag: { bold: true, fontSize: 8, color: sectionTitleColor, characterSpacing: 1 },
    },
    defaultStyle: { font: isThermal ? 'Helvetica' : classicBaseFont, fontSize, color: '#000' },
    pageMargins: isThermal ? [5, 5, 5, 5] : [40, 40, 40, 60],
    pageSize: isThermal ? { width: 220, height: 'auto' } : 'A4',
    footer: (currentPage: number, pageCount: number) => {
      const footerStack: any[] = [
        {
          text: 'This is a system generated invoice and does not require a physical signature.',
          fontSize: 8,
          color: mutedTextColor,
        },
        supportContact
          ? { text: `Support: ${supportContact}`, fontSize: 8, color: mutedTextColor }
          : null,
        termsText
          ? {
              text: `Terms & Conditions: ${termsText}`,
              fontSize: 7,
              color: mutedTextColor,
              margin: [0, 3, 0, 0],
            }
          : null,
        {
          text: 'Logistics services are subject to courier partner terms and applicable laws.',
          fontSize: 7,
          color: mutedTextColor,
          margin: [0, 3, 0, 0],
        },
        images.platformLogo
          ? { image: 'platformLogo', width: 60, alignment: 'center', margin: [0, 6, 0, 0] }
          : null,
        {
          text: `Page ${currentPage} of ${pageCount}`,
          fontSize: 7,
          color: mutedTextColor,
          alignment: 'right',
          margin: [0, 5, 0, 0],
        },
      ].filter(Boolean)
      return { stack: footerStack, margin: isThermal ? [5, 0, 5, 0] : [40, 0, 40, 0] }
    },
  }

  // Final safety: Helvetica can render ₹ incorrectly in some environments.
  // Normalize any remaining rupee glyphs in all PDF text nodes.
  const normalizeRupeeGlyphs = (node: any): any => {
    if (typeof node === 'string') return node.replace(/₹/g, 'Rs.')
    if (Array.isArray(node)) return node.map(normalizeRupeeGlyphs)
    if (node && typeof node === 'object') {
      for (const key of Object.keys(node)) {
        node[key] = normalizeRupeeGlyphs(node[key])
      }
      return node
    }
    return node
  }
  normalizeRupeeGlyphs(docDefinition)

  return new Promise<Buffer>((resolve, reject) => {
    try {
      const pdfDoc = printer.createPdfKitDocument(docDefinition)
      const chunks: Buffer[] = []
      pdfDoc.on('data', (chunk) => chunks.push(chunk))
      pdfDoc.on('end', () => resolve(Buffer.concat(chunks)))
      pdfDoc.on('error', (err) => {
        console.error('❌ PDF generation error:', err)
        // Provide more helpful error message
        if (err && typeof err === 'object' && 'message' in err) {
          const errorMsg = (err as any).message || String(err)
          if (errorMsg.includes('Unknown image format') || errorMsg.includes('Invalid image')) {
            reject(
              new Error(
                `Invoice PDF generation failed: Invalid image format. Please check logo/signature files are valid images (PNG, JPEG, GIF, or WebP). Original error: ${errorMsg}`,
              ),
            )
          } else {
            reject(new Error(`Invoice PDF generation failed: ${errorMsg}`))
          }
        } else {
          reject(err)
        }
      })
      pdfDoc.end()
    } catch (err: any) {
      console.error('❌ Error creating PDF document:', err)
      reject(new Error(`Failed to create invoice PDF: ${err?.message || String(err)}`))
    }
  })
}

type Filters = {
  status?: string
  userId?: string
  invoiceNumber?: string
  dateFrom?: string
  dateTo?: string
  awb?: string
}

export const getInvoicesService = async ({
  page,
  limit,
  filters,
}: {
  page: number
  limit: number
  filters: Filters
}) => {
  const offset = (page - 1) * limit

  const whereClauses = []

  if (filters.status) {
    whereClauses.push(eq(invoices.status, filters.status as any))
  }
  if (filters.userId) {
    whereClauses.push(eq(invoices.userId, filters.userId))
  }
  if (filters.invoiceNumber) {
    whereClauses.push(ilike(invoices.invoiceNumber, `%${filters.invoiceNumber}%`))
  }
  if (filters.dateFrom) {
    whereClauses.push(gte(invoices.invoiceDate, filters.dateFrom))
  }
  if (filters.dateTo) {
    whereClauses.push(lte(invoices.invoiceDate, filters.dateTo))
  }
  console.log('filters', filters)
  if (filters.awb) {
    // Look into items JSONB for orderId matching AWB
    whereClauses.push(
      sql`EXISTS (
        SELECT 1
        FROM jsonb_array_elements(${invoices.items}) AS item
        WHERE item->>'awb' ILIKE ${'%' + filters.awb + '%'}
      )`,
    )
  }

  const whereCondition = whereClauses.length > 0 ? and(...whereClauses) : undefined

  // Fetch paginated invoices
  const data = await db
    .select()
    .from(invoices)
    .where(whereCondition!)
    .orderBy(desc(invoices.invoiceDate))
    .limit(limit)
    .offset(offset)

  // Count total
  const total = (
    await db
      .select({ count: sql<number>`count(*)` })
      .from(invoices)
      .where(whereCondition!)
  )[0].count as number

  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
    data,
  }
}
