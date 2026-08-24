import axios from 'axios'
import bwipjs from 'bwip-js'
import { eq } from 'drizzle-orm'
import PdfPrinter from 'pdfmake'
import sharp from 'sharp'
import { resolveBuyerCollectableAmount } from '../../utils/codAmount'
import { detectFileType } from '../../utils/detectFileType'
import { db } from '../client'
import { labelPreferences } from '../schema/labelPreferences'
import { userProfiles } from '../schema/userProfile'
import { getAdminInvoicePreferences } from './invoicePreferences.service'
import { resolveOrderAwbNumber, resolvePickupDetailsForOrder } from './pickupDetails.service'
import { presignDownload, presignUpload } from './upload.service'

const LABEL_ASSET_TIMEOUT_MS = 10000
const LABEL_UPLOAD_TIMEOUT_MS = 30000
const LABEL_GREEN = '#25c11c'
const LABEL_BLUE = '#5d86ff'
const LABEL_ORANGE = '#ff8a1d'
const LABEL_BLACK = '#111111'
const LABEL_MUTED = '#5f5f5f'
const THERMAL_LABEL_SIZE = { width: 288, height: 432 }

const fonts = {
  Helvetica: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique',
  },
}

export const DEFAULT_LABEL_SETTINGS = {
  printer_type: 'thermal',
  char_limit: 30,
  max_items: 4,
  order_info: {
    alternatePhone: false,
    billingGstin: false,
    ewayBillNumber: false,
  },
  shipper_info: {
    brandLogo: true,
    shipperName: true,
    shipperAddress: true,
    shipperPhone: true,
    gstin: true,
    returnName: true,
    returnAddress: true,
    returnPhone: true,
  },
  product_info: {
    productCost: true,
  },
  powered_by: 'Kourier Boyz',
}

type RecordLike = Record<string, any>

type LabelContactBlock = {
  title: string
  name: string
  addressLines: string[]
  cityStatePincode: string
  primaryPhone?: string
  optionalPhone?: string
  gstin?: string
}

type LabelProduct = {
  name: string
  qty: number
  price: number
  amount: number
}

type LabelChargeRow = {
  label: string
  value: string
}

type LabelPayload = {
  courierName: string
  awbNumber: string
  orderId: string
  invoiceNumber: string
  invoiceDate: string
  ewayBillNumber: string
  weightLabel: string
  dimensionsLabel: string
  paymentLabel: string
  shipTo: LabelContactBlock
  billTo: LabelContactBlock
  shipFrom: LabelContactBlock
  returnTo: LabelContactBlock
  products: LabelProduct[]
  totalQty: number
  productAmount: number
  chargeRows: LabelChargeRow[]
  totalAmount: number
  continuationNote: string
  sellerState: string
}

function normalizeText(value: unknown): string {
  if (value === undefined || value === null) return ''
  return String(value).replace(/\s+/g, ' ').trim()
}

function pickText(...values: unknown[]): string {
  return values.map((value) => normalizeText(value)).find(Boolean) || ''
}

function toNumber(value: unknown, fallback = 0): number {
  const normalized = typeof value === 'string' ? value.replace(/[^0-9.-]+/g, '') : value
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : fallback
}

function formatCurrency(value: number | string | null | undefined): string {
  return `Rs.${toNumber(value).toFixed(2)}`
}

function formatDate(value: unknown): string {
  const raw = normalizeText(value)
  if (!raw) return ''
  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return raw
  const day = `${parsed.getDate()}`.padStart(2, '0')
  const month = `${parsed.getMonth() + 1}`.padStart(2, '0')
  const year = parsed.getFullYear()
  return `${day}/${month}/${year}`
}

function safeParseObject(value: unknown, fallback: RecordLike = {}) {
  if (!value) return fallback
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : fallback
    } catch {
      return fallback
    }
  }
  return typeof value === 'object' && !Array.isArray(value) ? (value as RecordLike) : fallback
}

function safeParseArray(value: unknown, fallback: any[] = []) {
  if (Array.isArray(value)) return value
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : fallback
    } catch {
      return fallback
    }
  }
  return fallback
}

function isEnabled(value: unknown, fallback = true) {
  return value === undefined ? fallback : value === true
}

function mergeSettings(prefs: any) {
  if (!prefs) return DEFAULT_LABEL_SETTINGS
  return {
    printer_type: 'thermal',
    char_limit: prefs.char_limit ?? DEFAULT_LABEL_SETTINGS.char_limit,
    max_items: prefs.max_items ?? DEFAULT_LABEL_SETTINGS.max_items,
    order_info: {
      ...(DEFAULT_LABEL_SETTINGS.order_info as RecordLike),
      ...(prefs.order_info || {}),
    },
    shipper_info: {
      ...(DEFAULT_LABEL_SETTINGS.shipper_info as RecordLike),
      ...(prefs.shipper_info || {}),
    },
    product_info: {
      ...(DEFAULT_LABEL_SETTINGS.product_info as RecordLike),
      ...(prefs.product_info || {}),
    },
    powered_by: prefs.powered_by ?? DEFAULT_LABEL_SETTINGS.powered_by,
  }
}

function splitFreeformAddress(text: string, lineLimit = 32) {
  const clean = normalizeText(text)
  if (!clean) return [] as string[]

  const parts = clean
    .split(',')
    .map((part) => normalizeText(part))
    .filter(Boolean)

  if (parts.length <= 1) return [clean]

  const lines: string[] = []
  let current = ''

  for (const part of parts) {
    const candidate = current ? `${current}, ${part}` : part
    if (candidate.length > lineLimit && current) {
      lines.push(current)
      current = part
    } else {
      current = candidate
    }
  }

  if (current) lines.push(current)
  return lines.slice(0, 2)
}

function buildCityStatePincode(source: RecordLike) {
  const city = pickText(source.city, source.district)
  const state = pickText(source.state)
  const pincode = pickText(source.pincode, source.zipcode, source.zip)
  const cityState = [city, state].filter(Boolean).join(', ')
  return [cityState, pincode].filter(Boolean).join(' ')
}

function buildAddressBlock(source: RecordLike, fallbackName = '', fallbackAddress = '') {
  const line1 = pickText(
    source.address_line_1,
    source.addressLine1,
    source.address1,
    source.line1,
  )
  const line2 = pickText(
    source.address_line_2,
    source.addressLine2,
    source.address2,
    source.line2,
    source.landmark,
  )

  let addressLines = [line1, line2].filter(Boolean)
  if (addressLines.length === 0) {
    addressLines = splitFreeformAddress(pickText(source.address, fallbackAddress))
  }

  return {
    name: pickText(source.name, source.full_name, source.contact_name, fallbackName),
    addressLines,
    cityStatePincode: buildCityStatePincode(source),
    primaryPhone: pickText(source.phone, source.mobile, source.mobile_number),
    alternatePhone: pickText(
      source.alternate_phone,
      source.alternatePhone,
      source.alt_phone,
      source.altPhone,
    ),
    gstin: pickText(
      source.gstin,
      source.gst_number,
      source.gstNumber,
      source.company_gst,
      source.gst,
    ),
  }
}

function formatWeightLabel(order: RecordLike) {
  const directKg = normalizeText(order.weightKg)
  if (directKg) return directKg.toLowerCase().includes('kg') ? directKg : `${directKg} kg`

  const directDeadWeight = normalizeText(order.deadWeight)
  if (directDeadWeight) return directDeadWeight

  const grams = toNumber(order.weight ?? order.actual_weight ?? order.dead_weight, 0)
  if (grams > 0) {
    return `${(grams >= 10 ? grams / 1000 : grams).toFixed(3)} kg`
  }

  return '-'
}

function formatDimensionsLabel(order: RecordLike) {
  const direct = pickText(order.dimension, order.dimensions)
  if (direct) {
    const normalized = direct.replace(/x/gi, ' x ').replace(/\s+/g, ' ').trim()
    return /cm\b/i.test(normalized) ? normalized : `${normalized} cm`
  }

  const length = pickText(order.length, order.box_length)
  const breadth = pickText(order.breadth, order.width, order.box_width)
  const height = pickText(order.height, order.box_height)

  if (length && breadth && height) {
    return `${length} x ${breadth} x ${height} cm`
  }

  return '-'
}

async function bufferToDataUrl(buffer: Buffer): Promise<string | null> {
  try {
    if (!buffer?.length) return null
    const type = await detectFileType(buffer)
    const mime = type?.mime?.startsWith('image/') ? type.mime : 'image/png'
    return `data:${mime};base64,${buffer.toString('base64')}`
  } catch {
    return buffer?.length ? `data:image/png;base64,${buffer.toString('base64')}` : null
  }
}

function isValidDataUrl(str: string | null) {
  return typeof str === 'string' && str.startsWith('data:image/')
}

async function optimizeLabelImage(
  dataUrl: string | null | undefined,
  kind: 'sellerLogo' | 'platformLogo' | 'barcode',
) {
  if (!dataUrl || !isValidDataUrl(dataUrl)) return dataUrl || null

  const match = dataUrl.match(/^data:image\/[A-Za-z0-9.+-]+;base64,(.+)$/)
  if (!match) return dataUrl

  try {
    const limits =
      kind === 'sellerLogo'
        ? { width: 220, height: 220, colors: 64 }
        : kind === 'platformLogo'
          ? { width: 180, height: 120, colors: 64 }
          : { width: 960, height: 220, colors: 2 }

    const resized = sharp(Buffer.from(match[1], 'base64')).resize({
      width: limits.width,
      height: limits.height,
      fit: 'inside',
      withoutEnlargement: true,
      kernel: kind === 'barcode' ? sharp.kernel.nearest : sharp.kernel.lanczos3,
    })

    const optimized =
      kind === 'barcode'
        ? await resized.flatten({ background: '#FFFFFF' }).png({ compressionLevel: 9 }).toBuffer()
        : await resized.png({ compressionLevel: 9, palette: true, colors: limits.colors }).toBuffer()

    return `data:image/png;base64,${optimized.toString('base64')}`
  } catch (err) {
    console.warn(`Failed to optimize label ${kind}:`, err)
    return dataUrl
  }
}

async function generateBarcodeBase64(
  text: string,
  options?: Partial<{
    height: number
    scale: number
    includeText: boolean
    paddingWidth: number
    paddingHeight: number
  }>,
) {
  if (!text) return null

  try {
    const png = await bwipjs.toBuffer({
      bcid: 'code128',
      text,
      scale: options?.scale ?? 2.4,
      height: options?.height ?? 20,
      includetext: options?.includeText ?? false,
      textxalign: 'center',
      paddingwidth: options?.paddingWidth ?? 10,
      paddingheight: options?.paddingHeight ?? 6,
    })
    return `data:image/png;base64,${png.toString('base64')}`
  } catch (err) {
    console.warn('Barcode generation failed:', err)
    return null
  }
}

async function downloadImageAsDataUrl(source: unknown) {
  const value = normalizeText(source)
  if (!value) return null
  if (isValidDataUrl(value)) return value
  if (!value.startsWith('http')) return null

  try {
    const response = await axios.get(value, {
      responseType: 'arraybuffer',
      timeout: LABEL_ASSET_TIMEOUT_MS,
    })
    return bufferToDataUrl(Buffer.from(response.data))
  } catch (err) {
    console.warn(`Failed to download label image asset from ${value}:`, err)
    return null
  }
}

function buildInfoCell(label: string, value?: string) {
  return {
    stack: [
      { text: label, fontSize: 6.2, color: LABEL_BLACK, bold: true, alignment: 'center' },
      { text: value || '-', fontSize: 6.35, color: LABEL_BLACK, bold: true, alignment: 'center' },
    ],
    alignment: 'center',
  }
}

function buildMetricCell(value: string, fontSize = 6.4) {
  return {
    text: normalizeText(value) || '-',
    color: LABEL_BLACK,
    bold: true,
    fontSize,
    alignment: 'center',
    margin: [0, 0.8, 0, 0.8],
  }
}

function buildTextLine(text: string, color = LABEL_BLACK) {
  return {
    text,
    color,
    fontSize: 6,
    bold: true,
    margin: [0, 0, 0, 0],
  }
}

function buildContactLines(
  block: LabelContactBlock,
  options?: {
    showName?: boolean
    showAddress?: boolean
    showOptionalPhone?: boolean
    optionalPhoneLabel?: string
    showGstin?: boolean
  },
) {
  const lines: string[] = []

  if (options?.showName !== false && block.name) {
    lines.push(block.name)
  }

  if (options?.showAddress !== false) {
    if (block.addressLines[0]) lines.push(block.addressLines[0])
    if (block.addressLines[1]) lines.push(block.addressLines[1])
    if (block.cityStatePincode) lines.push(block.cityStatePincode)
  }

  if (block.primaryPhone) lines.push(`Mobile: ${block.primaryPhone}`)

  if (options?.showOptionalPhone && block.optionalPhone) {
    lines.push(`${options.optionalPhoneLabel || 'Alternate'}: ${block.optionalPhone}`)
  }

  if (options?.showGstin && block.gstin) {
    lines.push(`GSTIN: ${block.gstin}`)
  }

  return lines
}

function buildContactBlock(
  block: LabelContactBlock,
  rowCount: number,
  options?: {
    showName?: boolean
    showAddress?: boolean
    showOptionalPhone?: boolean
    optionalPhoneLabel?: string
    showGstin?: boolean
  },
) {
  const lines = buildContactLines(block, options)

  return {
    table: {
      widths: ['*'],
      body: [
        [{ text: block.title, color: LABEL_BLACK, bold: true, fontSize: 6.8 }],
        ...Array.from({ length: rowCount }, (_, index) => [buildTextLine(lines[index] || ' ')]),
      ],
    },
    layout: {
      hLineColor: () => LABEL_BLACK,
      vLineColor: () => LABEL_BLACK,
      hLineWidth: () => 0.7,
      vLineWidth: () => 0.7,
      paddingTop: () => 0.9,
      paddingBottom: () => 0.9,
      paddingLeft: () => 2.5,
      paddingRight: () => 2.5,
    },
  }
}

function buildDemoLogoBadge(text: string) {
  const initials =
    normalizeText(text)
      .split(/\s+/)
      .map((part) => part[0] || '')
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'SL'

  return {
    table: {
      widths: [46],
      body: [
        [
          {
            stack: [
              {
                text: initials,
                color: LABEL_BLACK,
                bold: true,
                fontSize: 16,
                alignment: 'center',
                margin: [0, 4, 0, 0],
              },
              {
                text: 'DEMO LOGO',
                color: LABEL_BLACK,
                bold: true,
                fontSize: 5.4,
                alignment: 'center',
                margin: [0, 0, 0, 3],
              },
            ],
            alignment: 'center',
            margin: [0, 1, 0, 0],
          },
        ],
      ],
    },
    layout: {
      hLineWidth: () => 0.8,
      vLineWidth: () => 0.8,
      hLineColor: () => LABEL_BLACK,
      vLineColor: () => LABEL_BLACK,
      paddingLeft: () => 0,
      paddingRight: () => 0,
      paddingTop: () => 0,
      paddingBottom: () => 0,
    },
  }
}

export function buildLabelPdfDocument(
  payload: LabelPayload,
  settings: any,
  assets: {
    logoBase64?: string | null
    platformLogoBase64?: string | null
    awbBarcode?: string | null
    orderBarcode?: string | null
    demoLogoText?: string | null
  } = {},
) {
  const images: Record<string, string> = {}
  if (assets.logoBase64 && isValidDataUrl(assets.logoBase64)) images.logo = assets.logoBase64
  if (assets.platformLogoBase64 && isValidDataUrl(assets.platformLogoBase64)) {
    images.platformLogo = assets.platformLogoBase64
  }
  if (assets.awbBarcode && isValidDataUrl(assets.awbBarcode)) images.awbBarcode = assets.awbBarcode
  if (assets.orderBarcode && isValidDataUrl(assets.orderBarcode)) {
    images.orderBarcode = assets.orderBarcode
  }

  const showHeaderLogo = isEnabled(settings.shipper_info?.brandLogo, true) && Boolean(images.logo)
  const showBillingGstin = isEnabled(settings.order_info?.billingGstin, false)
  const showAlternatePhone = isEnabled(settings.order_info?.alternatePhone, false)
  const showShipperName = isEnabled(settings.shipper_info?.shipperName, true)
  const showShipperAddress = isEnabled(settings.shipper_info?.shipperAddress, true)
  const showShipperPhone = isEnabled(settings.shipper_info?.shipperPhone, true)
  const showShipperGstin = isEnabled(settings.shipper_info?.gstin, true)
  const showReturnName = isEnabled(settings.shipper_info?.returnName, true)
  const showReturnAddress = isEnabled(settings.shipper_info?.returnAddress, true)
  const showReturnPhone = isEnabled(settings.shipper_info?.returnPhone, true)
  const showEwayBillNumber = isEnabled(settings.order_info?.ewayBillNumber, false)
  const showPricing = isEnabled(settings.product_info?.productCost, true)
  const charLimit = Math.max(12, Number(settings.char_limit ?? DEFAULT_LABEL_SETTINGS.char_limit))
  const maxItems = Math.max(1, Number(settings.max_items ?? DEFAULT_LABEL_SETTINGS.max_items))
  const visibleProducts = payload.products.slice(0, maxItems)
  const awbBarcodeFit = [220, 46] as [number, number]
  const orderBarcodeFit = [170, 44] as [number, number]
  const demoLogoText = normalizeText(assets.demoLogoText)
  const awbHeaderContent = images.awbBarcode
    ? [
        {
          image: 'awbBarcode',
          fit: awbBarcodeFit,
          alignment: 'center',
          margin: [0, 0, 0, 1.2],
        },
        {
          text: payload.awbNumber || '-',
          color: LABEL_BLACK,
          bold: true,
          fontSize: 10.2,
          alignment: 'center',
          margin: [0, 0, 0, 1.5],
        },
      ]
    : [
        {
          text: payload.awbNumber || '-',
          color: LABEL_BLACK,
          bold: true,
          fontSize: 11,
          alignment: 'center',
          margin: [0, 6, 0, 6],
        },
      ]
  const orderHeaderContent = images.orderBarcode
    ? [
        {
          image: 'orderBarcode',
          fit: orderBarcodeFit,
          alignment: 'center',
          margin: [0, 0, 0, 1.2],
        },
        {
          text: payload.orderId || '-',
          color: LABEL_BLACK,
          bold: true,
          fontSize: 10,
          alignment: 'center',
          margin: [0, 0, 0, 2],
        },
      ]
    : [
        {
          text: payload.orderId || '-',
          color: LABEL_BLACK,
          bold: true,
          fontSize: 11,
          alignment: 'center',
          margin: [0, 6, 0, 6],
        },
      ]
  const shipToLines = buildContactLines(payload.shipTo, {
    showName: true,
    showAddress: true,
    showOptionalPhone: showAlternatePhone,
    optionalPhoneLabel: 'Alternate',
  })
  const billToLines = buildContactLines(payload.billTo, {
    showName: true,
    showAddress: true,
    showGstin: showBillingGstin,
  })
  const shipFromLines = buildContactLines(payload.shipFrom, {
    showName: showShipperName,
    showAddress: showShipperAddress,
    showOptionalPhone: showShipperPhone,
    optionalPhoneLabel: 'Mobile',
    showGstin: showShipperGstin,
  })
  const returnToLines = buildContactLines(payload.returnTo, {
    showName: showReturnName,
    showAddress: showReturnAddress,
    showOptionalPhone: showReturnPhone,
    optionalPhoneLabel: 'Mobile',
  })
  const contactRowCount = Math.max(5, shipToLines.length, billToLines.length, shipFromLines.length, returnToLines.length)

  const productTableWidths = showPricing ? ['*', 28, 46, 52] : ['*', 28]
  const productHeaderRow = showPricing
    ? [
        { text: 'Product Name', color: LABEL_BLACK, bold: true, fontSize: 6.6, alignment: 'center' },
        { text: 'QTY', color: LABEL_BLACK, bold: true, fontSize: 6.6, alignment: 'center' },
        { text: 'Price INR', color: LABEL_BLACK, bold: true, fontSize: 6.6, alignment: 'center' },
        { text: 'Amount INR', color: LABEL_BLACK, bold: true, fontSize: 6.6, alignment: 'center' },
      ]
    : [
        { text: 'Product Name', color: LABEL_BLACK, bold: true, fontSize: 6.6, alignment: 'center' },
        { text: 'QTY', color: LABEL_BLACK, bold: true, fontSize: 6.6, alignment: 'center' },
      ]

  const productRows =
    visibleProducts.length > 0
      ? visibleProducts.map((product) => {
          const baseRow: any[] = [
            {
               text:
                 normalizeText(product.name).length > charLimit
                   ? `${normalizeText(product.name).slice(0, charLimit)}...`
                   : normalizeText(product.name) || '-',
                fontSize: 6.2,
                color: LABEL_BLACK,
                alignment: 'center',
                margin: [0, 0.45, 0, 0.45],
              },
              {
                text: String(product.qty || 0),
                fontSize: 6.2,
                color: LABEL_BLACK,
                alignment: 'center',
                margin: [0, 0.45, 0, 0.45],
            },
          ]

          if (showPricing) {
            baseRow.push(
              {
                text: toNumber(product.price).toFixed(2).replace(/\.00$/, ''),
                fontSize: 6.2,
                color: LABEL_BLACK,
                alignment: 'center',
                margin: [0, 0.45, 0, 0.45],
              },
              {
                text: toNumber(product.amount).toFixed(2),
                fontSize: 6.2,
                color: LABEL_BLACK,
                alignment: 'center',
                margin: [0, 0.45, 0, 0.45],
              },
            )
          }

          return baseRow
        })
      : [
          showPricing
            ? [
                { text: 'No product data available', colSpan: 4, alignment: 'center', fontSize: 8 },
                {},
                {},
                {},
              ]
            : [
                { text: 'No product data available', colSpan: 2, alignment: 'center', fontSize: 8 },
                {},
              ],
        ]

  const summaryRows = [
    { label: 'Total Qty', value: String(payload.totalQty || 0), strong: false },
    { label: 'Product Amount', value: formatCurrency(payload.productAmount || 0), strong: false },
    ...(payload.chargeRows || []).map((row) => ({
      label: row.label,
      value: row.value,
      strong: false,
    })),
    { label: 'Total Amount', value: formatCurrency(payload.totalAmount), strong: true },
  ]

  const pageContent: any[] = [
    {
      table: {
        widths: [56, '*'],
        body: [
          [
            showHeaderLogo
              ? {
                  image: 'logo',
                  fit: [46, 46],
                  alignment: 'left',
                  margin: [0, 2, 0, 0],
                }
              : demoLogoText
                ? buildDemoLogoBadge(demoLogoText)
                : { text: '', margin: [0, 12, 0, 0] },
            {
              stack: [
                {
                  text: payload.courierName || 'Courier Name',
                  color: LABEL_BLACK,
                  bold: true,
                  fontSize: 12,
                  alignment: 'center',
                  margin: [0, 0, 0, 2],
                },
                ...awbHeaderContent,
              ],
            },
          ],
        ],
      },
      layout: 'noBorders',
      margin: [0, 0, 0, 2.5],
    },
    {
      table: {
        widths: ['*', '*', '*'],
        body: [
          [
            buildMetricCell(`Weight ${payload.weightLabel}`),
            buildMetricCell(payload.dimensionsLabel),
            buildMetricCell(payload.paymentLabel),
          ],
        ],
      },
      layout: 'noBorders',
      margin: [0, 0, 0, 3],
    },
    {
      table: {
        widths: ['*', '*'],
        body: [
          [
            buildContactBlock(payload.shipTo, contactRowCount, {
              showName: true,
              showAddress: true,
              showOptionalPhone: showAlternatePhone,
              optionalPhoneLabel: 'Alternate',
            }),
            buildContactBlock(payload.billTo, contactRowCount, {
              showName: true,
              showAddress: true,
              showGstin: showBillingGstin,
            }),
          ],
          [
            buildContactBlock(payload.shipFrom, contactRowCount, {
              showName: showShipperName,
              showAddress: showShipperAddress,
              showOptionalPhone: showShipperPhone,
              optionalPhoneLabel: 'Mobile',
              showGstin: showShipperGstin,
            }),
            buildContactBlock(payload.returnTo, contactRowCount, {
              showName: showReturnName,
              showAddress: showReturnAddress,
              showOptionalPhone: showReturnPhone,
              optionalPhoneLabel: 'Mobile',
            }),
          ],
        ],
      },
      layout: {
        hLineWidth: () => 0,
        vLineWidth: () => 0,
        paddingLeft: () => 0,
        paddingRight: () => 0,
        paddingTop: () => 0,
        paddingBottom: () => 0,
      },
      margin: [0, 0, 0, 3],
    },
    {
      stack: orderHeaderContent,
    },
    {
      table: {
        widths: ['*', '*', '*'],
        body: [
          [
            {
              text: `Invoice No. ${payload.invoiceNumber || '-'}`,
              color: LABEL_BLACK,
              bold: true,
              fontSize: 6.4,
              alignment: 'center',
            },
            {
              text: `Invoice Date ${payload.invoiceDate || '-'}`,
              color: LABEL_BLACK,
              bold: true,
              fontSize: 6.4,
              alignment: 'center',
            },
            {
              text:
                showEwayBillNumber && payload.ewayBillNumber
                  ? `Eway Bill No. ${payload.ewayBillNumber}`
                  : '',
              color: LABEL_BLACK,
              bold: true,
              fontSize: 6.4,
              alignment: 'center',
            },
          ],
        ],
      },
      layout: 'noBorders',
      margin: [0, 0, 0, 2],
    },
    {
      table: {
        headerRows: 1,
        widths: productTableWidths,
        body: [productHeaderRow, ...productRows],
      },
      layout: {
        hLineWidth: () => 0.7,
        vLineWidth: () => 0.7,
        hLineColor: () => LABEL_BLACK,
        vLineColor: () => LABEL_BLACK,
        paddingTop: () => 0.8,
        paddingBottom: () => 0.7,
        paddingLeft: () => 1.2,
        paddingRight: () => 1.2,
      },
      margin: [0, 0, 0, 2],
    },
  ]

  if (payload.continuationNote) {
    pageContent.push({
      text: payload.continuationNote,
      color: LABEL_BLACK,
      fontSize: 5.7,
      margin: [0, 0, 0, 2],
    })
  }

  pageContent.push({
    table: {
      widths: [96, '*'],
      body: summaryRows.map((row) => [
        {
          text: row.label,
          color: LABEL_BLACK,
          bold: true,
          fontSize: row.strong ? 6.6 : 6.2,
          alignment: 'left',
          margin: [0, 0.6, 0, 0.6],
        },
        {
          text: row.value,
          color: LABEL_BLACK,
          bold: true,
          fontSize: row.strong ? 6.6 : 6.2,
          alignment: 'right',
          margin: [0, 0.6, 0, 0.6],
        },
      ]),
    },
    layout: {
      hLineWidth: () => 0.7,
      vLineWidth: () => 0.7,
      hLineColor: () => LABEL_BLACK,
      vLineColor: () => LABEL_BLACK,
      paddingLeft: () => 1.4,
      paddingRight: () => 1.4,
      paddingTop: () => 0.9,
      paddingBottom: () => 0.9,
    },
    margin: [0, 0, 0, 2],
  })

  pageContent.push(
    {
      text: payload.sellerState
        ? `All disputes are subject to ${payload.sellerState} jurisdiction only.`
        : 'All disputes are subject to seller jurisdiction only.',
      color: LABEL_BLACK,
      fontSize: 4.9,
      alignment: 'center',
      margin: [0, 0, 0, 0.5],
    },
    {
      text: "Goods once sold will only be taken back or exchanged as per the store's return policy.",
      color: LABEL_BLACK,
      fontSize: 4.8,
      alignment: 'center',
      margin: [0, 0, 0, 1.2],
    },
    {
      canvas: [
        {
          type: 'line',
          x1: 0,
          y1: 0,
          x2: THERMAL_LABEL_SIZE.width - 36,
          y2: 0,
          lineWidth: 0.8,
          lineColor: LABEL_BLACK,
        },
      ],
       margin: [0, 0, 0, 1],
    },
    {
      stack: [
        {
          text: `This shipment is Powered by ${normalizeText(settings.powered_by) || 'Kourier Boyz.com'}`,
          color: LABEL_BLACK,
          bold: true,
          fontSize: 5.2,
          alignment: 'center',
          margin: [0, 0, 0, 0.6],
        },
        {
          text: 'This is a system generated document, hence no signature is required',
          color: LABEL_BLACK,
          bold: true,
          fontSize: 5.2,
          alignment: 'center',
        },
      ],
    },
  )

  return {
    defaultStyle: { font: 'Helvetica' },
    pageSize: THERMAL_LABEL_SIZE,
    pageMargins: [4, 4, 4, 4] as [number, number, number, number],
    content: [{ stack: pageContent }],
    ...(Object.keys(images).length > 0 ? { images } : {}),
  }
}

export async function buildLabelPdfBuffer(
  payload: LabelPayload,
  settings: any,
  assets: {
    logoBase64?: string | null
    platformLogoBase64?: string | null
    awbBarcode?: string | null
    orderBarcode?: string | null
  } = {},
) {
  const logoSource =
    assets.logoBase64 && isValidDataUrl(assets.logoBase64) ? assets.logoBase64 : null

  const optimizedAssets = {
    logoBase64: await optimizeLabelImage(logoSource, 'sellerLogo'),
    platformLogoBase64: await optimizeLabelImage(assets.platformLogoBase64, 'platformLogo'),
    awbBarcode: await optimizeLabelImage(assets.awbBarcode, 'barcode'),
    orderBarcode: await optimizeLabelImage(assets.orderBarcode, 'barcode'),
    demoLogoText:
      !logoSource && isEnabled(settings.shipper_info?.brandLogo, true)
        ? payload.shipFrom?.name || 'LOGO'
        : null,
  }
  const printer = new PdfPrinter(fonts)
  const pdfDoc = printer.createPdfKitDocument(
    buildLabelPdfDocument(payload, settings, optimizedAssets),
  )
  const chunks: Buffer[] = []

  return new Promise<Buffer>((resolve, reject) => {
    pdfDoc.on('data', (chunk) => chunks.push(chunk))
    pdfDoc.on('end', () => resolve(Buffer.concat(chunks)))
    pdfDoc.on('error', reject)
    pdfDoc.end()
  })
}

function buildLabelPayload(
  order: RecordLike,
  profileOfUser: RecordLike,
  pickup: RecordLike,
  rto: RecordLike,
  providerMeta: RecordLike,
  settings: any,
) {
  const rawConsignee = {
    name: pickText(order.buyer_name, order.consignee_name, order.name),
    address: pickText(order.address),
    city: pickText(order.city),
    state: pickText(order.state),
    pincode: pickText(order.pincode),
    phone: pickText(order.buyer_phone, order.phone),
    alternate_phone: pickText(
      order.alternate_phone,
      order.alt_phone,
      order.altPhone,
      order.buyer_alternate_phone,
    ),
  }

  const billingObject = safeParseObject(
    typeof order.billing_address === 'object' ? order.billing_address : order.billing_details,
  )

  const sellerBrandName = pickText(
    profileOfUser?.companyInfo?.companyName,
    profileOfUser?.companyInfo?.displayName,
    pickup.warehouse_name,
    pickup.name,
  )

  const shipToAddress = buildAddressBlock(rawConsignee, rawConsignee.name, rawConsignee.address)
  const billToAddress = buildAddressBlock(
    {
      ...billingObject,
      name: pickText(
        order.billing_name,
        billingObject.name,
        order.company_name,
        order.billing_company,
        rawConsignee.name,
      ),
      address: pickText(
        typeof order.billing_address === 'string' ? order.billing_address : '',
        billingObject.address,
        rawConsignee.address,
      ),
      city: pickText(order.billing_city, billingObject.city, rawConsignee.city),
      state: pickText(order.billing_state, billingObject.state, rawConsignee.state),
      pincode: pickText(order.billing_pincode, billingObject.pincode, rawConsignee.pincode),
      phone: pickText(order.billing_phone, billingObject.phone, rawConsignee.phone),
      gstin: pickText(
        order.company_gst,
        order.buyer_gst_number,
        order.billing_gst_number,
        billingObject.gstin,
        billingObject.gst_number,
        providerMeta.buyer_gst_number,
      ),
    },
    rawConsignee.name,
    rawConsignee.address,
  )

  const shipFromAddress = buildAddressBlock(
    {
      ...pickup,
      name: sellerBrandName,
      address: pickText(pickup.address),
      city: pickText(pickup.city),
      state: pickText(pickup.state),
      pincode: pickText(pickup.pincode),
      phone: pickText(pickup.phone),
      gst_number: pickText(pickup.gst_number, pickup.gstNumber),
    },
    sellerBrandName,
    pickText(pickup.address),
  )

  const returnSource: RecordLike =
    rto && Object.keys(rto).length > 0
      ? {
          ...rto,
          address: pickText(rto.address),
          city: pickText(rto.city, pickup.city),
          state: pickText(rto.state, pickup.state),
          pincode: pickText(rto.pincode, pickup.pincode),
          phone: pickText(rto.phone, pickup.phone),
        }
      : {
          ...pickup,
          address: pickText(pickup.address),
          city: pickText(pickup.city),
          state: pickText(pickup.state),
          pincode: pickText(pickup.pincode),
          phone: pickText(pickup.phone),
        }

  const returnAddress = buildAddressBlock(
    {
      ...returnSource,
      name: pickText(returnSource.name, returnSource.contact_name, sellerBrandName),
    },
    sellerBrandName,
    pickText(returnSource.address),
  )

  const products = safeParseArray(order.products)
    .map((product: RecordLike) => {
      const qty = Math.max(1, toNumber(product.qty ?? product.quantity, 1))
      const price = toNumber(product.price ?? product.unitPrice, 0)
      const amount =
        price > 0
          ? Number((Math.max(0, price * qty - toNumber(product.discount, 0))).toFixed(2))
          : toNumber(product.amount ?? product.total, 0)
      return {
        name: pickText(product.name, product.productName, product.title, product.box_name),
        qty,
        price,
        amount,
      }
    })
    .filter((product: LabelProduct) => product.name || product.qty || product.price || product.amount)

  const totalQty = products.reduce((sum: number, product: LabelProduct) => sum + product.qty, 0)
  const productAmount = products.reduce(
    (sum: number, product: LabelProduct) => sum + product.amount,
    0,
  )
  const shippingCharges = toNumber(order.shipping_charges ?? 0)
  const transactionFee = toNumber(order.transaction_fee ?? 0)
  const giftWrap = toNumber(order.gift_wrap ?? 0)
  const discount = toNumber(order.discount ?? 0)
  const prepaidAmount = toNumber(order.prepaid_amount ?? 0)
  const orderAmount = resolveBuyerCollectableAmount({
    orderAmount: order.order_amount,
    invoiceAmount: order.invoice_amount,
    shippingCharges: order.shipping_charges,
    transactionFee: order.transaction_fee,
    giftWrap: order.gift_wrap,
    discount: order.discount,
    prepaidAmount: order.prepaid_amount,
    trustOrderAmount: true,
  })

  const paymentType = pickText(order.payment_type, order.order_type, order.type).toLowerCase()
  const sellerState = pickText(pickup.state, returnSource.state)
  const chargeRows: LabelChargeRow[] = [
    shippingCharges > 0 ? { label: 'Shipping Charges', value: formatCurrency(shippingCharges) } : null,
    transactionFee > 0 ? { label: 'Transaction Fee', value: formatCurrency(transactionFee) } : null,
    giftWrap > 0 ? { label: 'Gift Wrap', value: formatCurrency(giftWrap) } : null,
    discount > 0 ? { label: 'Discount', value: `-${formatCurrency(discount)}`.replace('Rs.-', '-Rs.') } : null,
    prepaidAmount > 0
      ? { label: 'Prepaid Amount', value: `-${formatCurrency(prepaidAmount)}`.replace('Rs.-', '-Rs.') }
      : null,
  ].filter(Boolean) as LabelChargeRow[]

  return {
    courierName: pickText(order.courier_partner, order.integration_type, providerMeta.courier_name) || 'Courier Name',
    awbNumber: pickText(resolveOrderAwbNumber(order)),
    orderId: pickText(order.order_number, order.orderId, order.id),
    invoiceNumber: pickText(order.invoice_number, order.invoiceNumber),
    invoiceDate: formatDate(order.invoice_date || order.invoiceDate || order.order_date || order.orderDate),
    ewayBillNumber: pickText(
      order.eway_bill_number,
      order.ewaybill_number,
      order.ewaybill,
      providerMeta.ewaybill_number,
      providerMeta.eway_bill,
      providerMeta.ewaybill,
      providerMeta.ewbn,
      providerMeta.ewb,
    ),
    weightLabel: formatWeightLabel(order),
    dimensionsLabel: formatDimensionsLabel(order),
    paymentLabel: paymentType === 'cod' ? 'COD' : 'Prepaid',
    shipTo: {
      title: 'Ship To,',
      name: shipToAddress.name,
      addressLines: shipToAddress.addressLines,
      cityStatePincode: shipToAddress.cityStatePincode,
      primaryPhone: shipToAddress.primaryPhone,
      optionalPhone: shipToAddress.alternatePhone,
    },
    billTo: {
      title: 'Bill To,',
      name: billToAddress.name,
      addressLines: billToAddress.addressLines,
      cityStatePincode: billToAddress.cityStatePincode,
      primaryPhone: billToAddress.primaryPhone,
      gstin: billToAddress.gstin,
    },
    shipFrom: {
      title: 'Ship From,',
      name: shipFromAddress.name,
      addressLines: shipFromAddress.addressLines,
      cityStatePincode: shipFromAddress.cityStatePincode,
      optionalPhone: showShipFromOptionalPhone(settings) ? shipFromAddress.primaryPhone : '',
      gstin: shipFromAddress.gstin,
    },
    returnTo: {
      title: 'Return To,',
      name: returnAddress.name,
      addressLines: returnAddress.addressLines,
      cityStatePincode: returnAddress.cityStatePincode,
      optionalPhone: returnAddress.primaryPhone,
    },
    products,
    totalQty,
    productAmount,
    chargeRows,
    totalAmount: orderAmount > 0 ? orderAmount : productAmount,
    continuationNote:
      products.length > Math.max(1, Number(settings.max_items ?? DEFAULT_LABEL_SETTINGS.max_items))
        ? 'Continue to next page if products are more'
        : '',
    sellerState,
  } satisfies LabelPayload
}

function showShipFromOptionalPhone(settings: any) {
  return isEnabled(settings.shipper_info?.shipperPhone, true)
}

async function resolvePlatformLogoBase64() {
  const adminPrefs = await getAdminInvoicePreferences()
  const platformLogoKey =
    adminPrefs?.includeLogo !== false && adminPrefs?.logoFile ? adminPrefs.logoFile : null

  if (!platformLogoKey) return null

  try {
    const logoUrl = await presignDownload(platformLogoKey)
    const finalUrl = Array.isArray(logoUrl) ? logoUrl[0] : logoUrl
    return downloadImageAsDataUrl(finalUrl)
  } catch (err) {
    console.warn('Failed to fetch platform logo for label:', err)
    return null
  }
}

export async function generateLabelForOrder(order: any, userId: string, tx: any = db) {
  const [prefsRow] = await tx
    .select()
    .from(labelPreferences)
    .where(eq(labelPreferences.user_id, userId))
  const settings = mergeSettings(prefsRow ?? undefined)

  const [profileOfUser] = await tx
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))

  const pickupResolution = await resolvePickupDetailsForOrder(userId, tx, order, profileOfUser)
  const pickup = pickupResolution.pickupDetails || safeParseObject(order.pickup_details)
  const rto = safeParseObject(order.rto_details)
  const providerMeta = safeParseObject(order.provider_meta)

  const payload = buildLabelPayload(order, profileOfUser || {}, pickup || {}, rto, providerMeta, settings)

  let logoBase64: string | null = null
  if (isEnabled(settings.shipper_info?.brandLogo) && profileOfUser?.companyInfo?.companyLogoUrl) {
    try {
      const logoUrl = await presignDownload(profileOfUser.companyInfo.companyLogoUrl)
      const finalUrl = Array.isArray(logoUrl) ? logoUrl[0] : logoUrl
      logoBase64 = await downloadImageAsDataUrl(finalUrl)
    } catch (err) {
      console.warn('Failed to fetch seller logo for label:', err)
    }
  }

  const barcodeSource =
    order.barcode_img || order.barcode_url || order.barcode_image || order.barcode || null

  let awbBarcode = await downloadImageAsDataUrl(barcodeSource)
  if (!awbBarcode && payload.awbNumber) {
    awbBarcode = await generateBarcodeBase64(payload.awbNumber, {
      height: 12,
      scale: 6,
      paddingWidth: 8,
      paddingHeight: 2,
    })
  }

  const orderBarcode = payload.orderId
    ? await generateBarcodeBase64(payload.orderId, {
        height: 12,
        scale: 5,
        paddingWidth: 8,
        paddingHeight: 2,
      })
    : null

  const platformLogoBase64 = await resolvePlatformLogoBase64()

  try {
    const pdfBuffer = await buildLabelPdfBuffer(payload, settings, {
      logoBase64,
      platformLogoBase64,
      awbBarcode,
      orderBarcode,
    })

    if (!pdfBuffer?.length) {
      throw new Error('PDF buffer is empty or invalid')
    }

    const labelIdentifier = String(order?.order_number ?? order?.id ?? 'order')
      .trim()
      .replace(/[^A-Za-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 46) || 'order'

    const { uploadUrl, key } = await presignUpload({
      filename: `label-${labelIdentifier}.pdf`,
      contentType: 'application/pdf',
      userId,
      folderKey: 'labels',
    })

    if (!uploadUrl || !key) {
      throw new Error('Failed to get presigned URL for label upload')
    }

    const finalUploadUrl = Array.isArray(uploadUrl) ? uploadUrl[0] : uploadUrl
    const uploadResponse = await axios.put(finalUploadUrl, pdfBuffer, {
      headers: { 'Content-Type': 'application/pdf' },
      validateStatus: (status) => status >= 200 && status < 300,
      timeout: LABEL_UPLOAD_TIMEOUT_MS,
    })

    if (uploadResponse.status < 200 || uploadResponse.status >= 300) {
      throw new Error(`Label upload failed with status ${uploadResponse.status}`)
    }

    const finalKey = Array.isArray(key) ? key[0] : key
    if (!finalKey || typeof finalKey !== 'string' || finalKey.trim().length === 0) {
      throw new Error('Label key is invalid or empty after upload')
    }

    return finalKey.trim()
  } catch (err: any) {
    console.error(
      `Failed to generate/upload label for order ${order?.order_number}:`,
      err?.message || err,
      err?.stack,
    )
    throw new Error(`Label generation/upload failed: ${err?.message || err}`)
  }
}
