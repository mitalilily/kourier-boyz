import bwipjs from 'bwip-js'
import path from 'path'
import PDFDocument from 'pdfkit'
import { IOrder, IOrderItem, IOrderSellerShipment } from '../models/Order'
import { IUser } from '../models/User'
import { fetchBrandingAssetBuffer, getBrandingSettingsCached } from './brandingSettings'

/**
 * Check if a product is fragile based on tags, specifications, name, or description
 */
export const isProductFragile = (product: any): boolean => {
  if (!product) return false

  const tags = product.tags || []
  const specifications = product.specifications || []
  const name = (product.name || '').toLowerCase()
  const description = (product.description || '').toLowerCase()

  const fragileTags = ['fragile', 'breakable', 'glass', 'ceramic', 'delicate']

  // Check tags for fragile
  const hasFragileTag = tags.some((tag: string) =>
    fragileTags.some((f) => tag.toLowerCase().includes(f)),
  )

  // Check specifications for fragile
  const hasFragileSpec = specifications.some(
    (spec: any) =>
      (spec.key && spec.key.toLowerCase().includes('fragile')) ||
      (spec.value && fragileTags.some((f) => spec.value.toLowerCase().includes(f))),
  )

  // Check name/description for fragile keywords
  const hasFragileKeyword =
    fragileTags.some((f) => name.includes(f)) || fragileTags.some((f) => description.includes(f))

  return hasFragileTag || hasFragileSpec || hasFragileKeyword
}

interface LabelData {
  order: IOrder
  shipment: IOrderSellerShipment
  customer: IUser
  seller: IUser
  items: Array<{
    product: any
    variant?: any
    quantity: number
    price?: number
  }>
  allOrderItems?: IOrderItem[]
}

const LABEL_COLORS = {
  ink: '#0f172a',
  muted: '#475569',
  border: '#94a3b8',
  soft: '#f8fafc',
  brand: '#146eb4',
  warm: '#fff7ed',
  danger: '#dc2626',
}

/**
 * Helper function to render text with proper font support
 */
const renderText = (
  doc: PDFKit.PDFDocument,
  text: string,
  x: number,
  y: number,
  options?: {
    width?: number
    align?: 'left' | 'center' | 'right'
    fontSize?: number
    font?: 'NotoSans' | 'NotoSansBold' | 'Helvetica'
  },
): void => {
  if (!text) return

  const opts = options || {}
  const fontSize = opts.fontSize || 9
  const font = opts.font || 'NotoSans'
  const width = opts.width || 200
  const align = opts.align || 'left'

  doc.font(font).fontSize(fontSize)

  if (opts.width) {
    doc.text(text, x, y, { width, align })
  } else {
    doc.text(text, x, y, { align })
  }
}

const drawSectionCard = (
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  width: number,
  height: number,
  title: string,
  options?: { warm?: boolean },
) => {
  doc
    .roundedRect(x, y, width, height, 6)
    .fillAndStroke(options?.warm ? LABEL_COLORS.warm : '#ffffff', LABEL_COLORS.border)

  doc
    .font('NotoSansBold')
    .fontSize(7)
    .fillColor(LABEL_COLORS.brand)
    .text(title.toUpperCase(), x + 8, y + 6, { width: width - 16 })

  doc.fillColor(LABEL_COLORS.ink)
}

const measureWrappedTextHeight = (
  doc: PDFKit.PDFDocument,
  text: string,
  width: number,
  font: 'NotoSans' | 'NotoSansBold' | 'Helvetica',
  fontSize: number,
) => {
  doc.font(font).fontSize(fontSize)
  return doc.heightOfString(text, { width })
}

/**
 * Generate shipping label PDF
 */
export const generateLabel = async (data: LabelData): Promise<Buffer> => {
  const { order, shipment, customer, seller, items, allOrderItems } = data

  // Fetch branding settings
  const branding = await getBrandingSettingsCached()
  const labelLogoUrl = branding?.labelLogoUrl
  const labelLogoBuffer = labelLogoUrl ? await fetchBrandingAssetBuffer(labelLogoUrl) : null

  // Create PDF document
  const doc = new PDFDocument({
    size: [288, 432], // 4x6 inches in points (72 DPI)
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
  })

  // Register NotoSans fonts for Hindi support
  const fontPath = path.join(__dirname, '../../fonts')
  doc.registerFont('NotoSans', path.join(fontPath, 'NotoSans-Regular.ttf'))
  doc.registerFont('NotoSansBold', path.join(fontPath, 'NotoSans-Bold.ttf'))

  const awbNumber = shipment.kourierBoyzLogistics?.awb_number || shipment.shippingMeta?.awb || ''
  if (!awbNumber) {
    console.error('[generateLabel] AWB number is missing! Cannot generate AWB barcode.', {
      shipmentId: shipment._id || 'no-id',
      hasKourierBoyzLogistics: !!shipment.kourierBoyzLogistics,
      hasShippingMeta: !!shipment.shippingMeta,
      kourierBoyzLogisticsAwb: shipment.kourierBoyzLogistics?.awb_number,
      shippingMetaAwb: shipment.shippingMeta?.awb,
    })
    throw new Error('AWB number is required for label generation')
  }

  const orderTotal = Math.max(0, Number(order.total) || 0)
  const displayAmount = orderTotal
  const courierName =
    shipment.shippingMeta?.courier ||
    (shipment.kourierBoyzLogistics as any)?.courier_partner ||
    'Assigned Courier'

  // Helper function to draw barcode
  const drawBarcode = async (
    doc: PDFKit.PDFDocument,
    text: string,
    x: number,
    y: number,
    width: number,
    height: number,
  ): Promise<void> => {
    const cleanText = text.replace(/\s+/g, '')

    try {
      const barcodeBuffer = await bwipjs.toBuffer({
        bcid: 'code128',
        text: cleanText,
        scale: 2,
        height: height - 8,
        includetext: false,
        textxalign: 'center',
      })

      doc.image(barcodeBuffer, x, y, { width: width, height: height - 8 })

      // Print barcode number below
      renderText(doc, cleanText, x, y + height - 6, {
        width: width,
        align: 'center',
        fontSize: 8,
        font: 'Helvetica',
      })
    } catch (error) {
      console.error('Error generating barcode:', error)
      // Fallback: just show the text
      renderText(doc, cleanText, x, y + height / 2, {
        width: width,
        align: 'center',
        fontSize: 8,
        font: 'Helvetica',
      })
    }
  }

  // Top section: branded header card
  const topY = 10
  const logoSize = 34
  doc
    .roundedRect(12, topY, 264, 58, 8)
    .fillAndStroke(LABEL_COLORS.soft, LABEL_COLORS.border)

  if (labelLogoBuffer) {
    doc.image(labelLogoBuffer, 20, topY + 10, { fit: [logoSize, logoSize] })
  } else {
    const companyName = branding.companyName || 'Kourier Boyz'
    renderText(doc, companyName.toUpperCase(), 20, topY + 18, {
      width: 64,
      fontSize: 11,
      font: 'NotoSansBold',
    })
  }

  renderText(doc, 'KOURIER_BOYZ SHIPPING LABEL', 62, topY + 12, {
    width: 92,
    fontSize: 8,
    font: 'NotoSansBold',
  })
  renderText(doc, 'Structured, courier-ready dispatch slip', 62, topY + 24, {
    width: 92,
    fontSize: 6.5,
    font: 'NotoSans',
  })

  const orderNumber = order.orderNumber || ''
  const barcodeX = 156
  const barcodeY = topY + 8
  const barcodeWidth = 108
  const barcodeHeight = 30

  if (orderNumber) {
    await drawBarcode(doc, orderNumber, barcodeX, barcodeY, barcodeWidth, barcodeHeight)
  }

  doc.y = topY + 64

  // FRAGILE WARNING AT TOP — only when shipment is explicitly marked fragile.
  // We do not auto-detect from product name (e.g. "ceramic") so sellers control the label.
  const shouldShowFragile = Boolean(shipment.fragile)

  if (shouldShowFragile) {
    const fragileY = doc.y
    const fragileBoxHeight = 22

    doc
      .roundedRect(20, fragileY, 248, fragileBoxHeight, 6)
      .fillAndStroke('#fef2f2', LABEL_COLORS.danger)

    renderText(doc, 'FRAGILE  •  HANDLE WITH EXTRA CARE', 20, fragileY + 6, {
      width: 248,
      align: 'center',
      fontSize: 9,
      font: 'NotoSansBold',
    })

    doc.y = fragileY + fragileBoxHeight + 4
  }

  // Payment / date summary band
  const codBandY = doc.y
  const codBandHeight = 28
  const codBandLeft = 20
  const codBandWidth = 248
  const codBandMid = codBandLeft + codBandWidth / 2

  doc.roundedRect(codBandLeft, codBandY, codBandWidth, codBandHeight, 6).fillAndStroke('#ffffff', LABEL_COLORS.border)
  doc
    .moveTo(codBandMid, codBandY)
    .lineTo(codBandMid, codBandY + codBandHeight)
    .strokeColor(LABEL_COLORS.border)
    .lineWidth(0.5)
    .stroke()

  const isCod = order.paymentMethod === 'cod'
  const paymentStatus = isCod ? 'COD' : order.paymentStatus === 'paid' ? 'Pre-paid' : 'Pre-paid'
  const orderDate = order.createdAt ? new Date(order.createdAt) : new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const dateStr = `${orderDate.getFullYear()}-${pad(orderDate.getMonth() + 1)}-${pad(
    orderDate.getDate(),
  )}`
  const timeStr = `${pad(orderDate.getHours())}:${pad(orderDate.getMinutes())}:${pad(
    orderDate.getSeconds(),
  )}`

  renderText(doc, 'PAYMENT', codBandLeft + 8, codBandY + 5, {
    fontSize: 6,
    font: 'NotoSansBold',
  })
  renderText(doc, paymentStatus, codBandLeft + 8, codBandY + 12, {
    fontSize: 7,
    font: 'NotoSansBold',
  })
  renderText(doc, `INR ${displayAmount.toFixed(2)}`, codBandLeft + 8, codBandY + 19, {
    fontSize: 7,
    font: 'NotoSans',
  })

  renderText(doc, 'ORDER TIME', codBandMid + 8, codBandY + 5, {
    width: codBandWidth / 2 - 16,
    fontSize: 6,
    font: 'NotoSansBold',
  })
  renderText(doc, `Date: ${dateStr}`, codBandMid + 8, codBandY + 12, {
    width: codBandWidth / 2 - 12,
    fontSize: 7,
    font: 'NotoSans',
  })
  renderText(doc, `Time: ${timeStr}`, codBandMid + 8, codBandY + 19, {
    width: codBandWidth / 2 - 12,
    fontSize: 7,
    font: 'NotoSans',
  })

  doc.y = codBandY + codBandHeight + 6

  const shipmentMetaY = doc.y
  drawSectionCard(doc, 20, shipmentMetaY, 248, 34, 'Shipment Meta')
  renderText(doc, `AWB: ${awbNumber}`, 28, shipmentMetaY + 18, {
    width: 118,
    fontSize: 7,
    font: 'NotoSansBold',
  })
  renderText(doc, `Courier: ${courierName}`, 150, shipmentMetaY + 18, {
    width: 110,
    align: 'right',
    fontSize: 7,
    font: 'NotoSans',
  })

  doc.y = shipmentMetaY + 40

  // TWO COLUMN LAYOUT: Ship To | Seller (side by side)
  const twoColStartY = doc.y
  const leftColX = 20
  const rightColX = 144 // Halfway point (288 / 2 = 144)
  const colWidth = 120 // Each column width

  const shipToStartY = twoColStartY
  const customerName = order.shippingAddress?.name || customer.name || 'Customer'
  const shipToLines: Array<{ text: string; font: 'NotoSans' | 'NotoSansBold'; size: number }> = [
    { text: customerName.toUpperCase(), font: 'NotoSansBold', size: 7.5 },
  ]
  if (order.shippingAddress) {
    const addr = order.shippingAddress

    if (addr.addressLine1) {
      shipToLines.push({ text: addr.addressLine1, font: 'NotoSans', size: 7 })
    }

    if (addr.addressLine2) {
      shipToLines.push({ text: addr.addressLine2, font: 'NotoSans', size: 7 })
    }

    const locationParts = [addr.city, addr.state, addr.country].filter(Boolean)
    if (locationParts.length > 0) {
      shipToLines.push({ text: locationParts.join(', '), font: 'NotoSans', size: 7 })
    }

    if (addr.postalCode) {
      shipToLines.push({ text: `PIN: ${addr.postalCode}`, font: 'NotoSansBold', size: 7 })
    }

    if (addr.phone) {
      shipToLines.push({ text: `Phone: ${addr.phone}`, font: 'NotoSans', size: 7 })
    }
  } else {
    shipToLines.push({ text: 'Address not available', font: 'NotoSans', size: 7 })
  }

  const sellerStartY = twoColStartY
  const sellerName = (seller.businessName || seller.name || 'Seller').toUpperCase()
  const pickup = shipment.shippingMeta?.pickup_address
  const warehouseName = pickup?.warehouseName
  const hasPickupAddress =
    pickup &&
    (pickup.addressLine1 || pickup.addressLine2 || pickup.city || pickup.postalCode)
  const sellerLines: Array<{ text: string; font: 'NotoSans' | 'NotoSansBold'; size: number }> = [
    { text: sellerName, font: 'NotoSansBold', size: 7.5 },
  ]
  if (warehouseName) {
    sellerLines.push({ text: warehouseName, font: 'NotoSans', size: 7 })
  }

  if (hasPickupAddress && pickup) {
    if (pickup.addressLine1) {
      sellerLines.push({ text: pickup.addressLine1, font: 'NotoSans', size: 7 })
    }
    if (pickup.addressLine2) {
      sellerLines.push({ text: pickup.addressLine2, font: 'NotoSans', size: 7 })
    }
    const locationParts = [pickup.city, pickup.state, pickup.country || 'India'].filter(Boolean)
    if (locationParts.length > 0) {
      sellerLines.push({ text: locationParts.join(', '), font: 'NotoSans', size: 7 })
    }
    if (pickup.postalCode) {
      sellerLines.push({ text: `PIN: ${pickup.postalCode}`, font: 'NotoSansBold', size: 7 })
    }
    if (pickup.contactPhone) {
      sellerLines.push({ text: `Phone: ${pickup.contactPhone}`, font: 'NotoSans', size: 7 })
    }
  } else {
    // Fallback: use seller profile address so label always shows accurate sender
    const s = seller as any
    if (s?.addressLine1 || s?.city || s?.state) {
      if (s.addressLine1) {
        sellerLines.push({ text: s.addressLine1, font: 'NotoSans', size: 7 })
      }
      if (s.addressLine2) {
        sellerLines.push({ text: s.addressLine2, font: 'NotoSans', size: 7 })
      }
      const locationParts = [s.city, s.state, s.country || 'India'].filter(Boolean)
      if (locationParts.length > 0) {
        sellerLines.push({ text: locationParts.join(', '), font: 'NotoSans', size: 7 })
      }
      if (s.postalCode) {
        sellerLines.push({ text: `PIN: ${s.postalCode}`, font: 'NotoSansBold', size: 7 })
      }
      if (s.phone) {
        sellerLines.push({ text: `Phone: ${s.phone}`, font: 'NotoSans', size: 7 })
      }
    } else {
      sellerLines.push({ text: 'Seller address not available', font: 'NotoSans', size: 7 })
    }
  }

  const contentWidth = colWidth - 10
  const calcCardHeight = (
    lines: Array<{ text: string; font: 'NotoSans' | 'NotoSansBold'; size: number }>,
  ) => {
    let totalHeight = 18
    for (const line of lines) {
      totalHeight += Math.max(
        line.size + 2,
        measureWrappedTextHeight(doc, line.text, contentWidth, line.font, line.size) + 1,
      )
    }
    return Math.max(92, totalHeight + 10)
  }

  const shipToBoxHeight = calcCardHeight(shipToLines)
  const sellerBoxHeight = calcCardHeight(sellerLines)
  const twoColBoxHeight = Math.max(shipToBoxHeight, sellerBoxHeight)

  drawSectionCard(doc, leftColX, twoColStartY, colWidth + 4, twoColBoxHeight, 'Ship To', {
    warm: true,
  })
  drawSectionCard(doc, rightColX, twoColStartY, colWidth + 4, twoColBoxHeight, 'From / Seller')

  let shipToContentY = shipToStartY + 18
  shipToLines.forEach((line) => {
    renderText(doc, line.text, leftColX + 8, shipToContentY, {
      width: contentWidth,
      fontSize: line.size,
      font: line.font,
    })
    shipToContentY += Math.max(
      line.size + 2,
      measureWrappedTextHeight(doc, line.text, contentWidth, line.font, line.size) + 1,
    )
  })

  let sellerContentY = sellerStartY + 18
  sellerLines.forEach((line) => {
    renderText(doc, line.text, rightColX + 8, sellerContentY, {
      width: contentWidth,
      fontSize: line.size,
      font: line.font,
    })
    sellerContentY += Math.max(
      line.size + 2,
      measureWrappedTextHeight(doc, line.text, contentWidth, line.font, line.size) + 1,
    )
  })

  doc.y = twoColStartY + twoColBoxHeight + 8

  // Product summary table
  const tableStartY = doc.y
  const tableContentStartY = doc.y
  const tableLeft = 20
  const tableRight = 268
  const tableTotalWidth = 248
  const col1Width = 116 // Product(Qty) — leave room for Price/Total
  const col2Width = 66 // Price (INR X.XX or INR X.XX x N)
  const col3Width = 66 // Total (INR X.XX)
  const cellPadding = 3
  const col1X = tableLeft + cellPadding
  const col1ContentWidth = col1Width - cellPadding * 2
  const col2Left = tableLeft + col1Width
  const col2ContentWidth = col2Width - cellPadding * 2
  const col2X = col2Left + cellPadding
  const col3Left = col2Left + col2Width
  const col3ContentWidth = col3Width - cellPadding * 2
  const col3X = col3Left + cellPadding

  // Get items to display
  let itemsToDisplay: any[] = items
  if (allOrderItems && allOrderItems.length > 0) {
    const shipmentItemIds = shipment.itemIds || []
    itemsToDisplay = allOrderItems.filter((orderItem) =>
      shipmentItemIds.some((id) => id.toString() === orderItem._id?.toString()),
    )
  } else {
    const shipmentItemIds = shipment.itemIds || []
    const orderItems = order.items.filter((orderItem) =>
      shipmentItemIds.some((id) => id.toString() === orderItem._id?.toString()),
    )
    itemsToDisplay = orderItems.length > 0 ? orderItems : items
  }

  const headerY = tableStartY + 18

  doc.font('NotoSansBold').fontSize(7)
  renderText(doc, 'Product (Qty)', col1X, headerY, {
    width: col1ContentWidth,
    fontSize: 7,
    font: 'NotoSansBold',
  })
  renderText(doc, 'Price', col2X, headerY, {
    width: col2ContentWidth,
    align: 'right',
    fontSize: 7,
    font: 'NotoSansBold',
  })
  renderText(doc, 'Total', col3X, headerY, {
    width: col3ContentWidth,
    align: 'right',
    fontSize: 7,
    font: 'NotoSansBold',
  })

  // Draw header separator line
  doc
    .moveTo(tableLeft + 1, tableStartY + 25)
    .lineTo(tableRight - 1, tableStartY + 25)
    .strokeColor(LABEL_COLORS.border)
    .lineWidth(0.5)
    .stroke()

  doc.y = tableStartY + 29
  const tableRowsStartY = doc.y

  // Table rows
  let grandTotal = 0

  itemsToDisplay.forEach((itemOrOrderItem: any) => {
    let productName = 'Product'
    let quantity = 1
    let unitPrice = 0
    let itemTotal = 0
    let productData: any = null

    // Check if it's an order item (has price, effectivePrice, subtotal)
    if (itemOrOrderItem.price !== undefined || itemOrOrderItem.effectivePrice !== undefined) {
      // It's an order item
      const orderItem = itemOrOrderItem
      // Try to get product data from populated orderItem first
      if (
        orderItem.product &&
        typeof orderItem.product === 'object' &&
        'name' in orderItem.product
      ) {
        productData = orderItem.product
        productName = productData.name || 'Product'
      } else {
        // Fallback to matching item from items array
        const matchingItem = items.find(
          (item) =>
            item.product?._id?.toString() === orderItem.product?.toString() &&
            (!orderItem.variant ||
              !item.variant ||
              item.variant._id?.toString() === orderItem.variant?.toString()),
        )
        productData = matchingItem?.product
        productName = productData?.name || 'Product'
      }
      quantity = orderItem.quantity || 1
      unitPrice = orderItem.effectivePrice || orderItem.price || 0
      itemTotal = orderItem.subtotal || unitPrice * quantity
    } else {
      // It's a passed item (fallback)
      const item = itemOrOrderItem
      productData = item.product
      // Ensure product name is extracted correctly
      if (productData && typeof productData === 'object') {
        productName = productData.name || productData.slug || 'Product'
      } else {
        productName = 'Product'
      }
      quantity = item.quantity || 1
      unitPrice =
        item.effectivePrice ||
        item.price ||
        item.variant?.effectivePrice ||
        item.variant?.price ||
        productData?.effectivePrice ||
        productData?.price ||
        0
      itemTotal = item.subtotal || unitPrice * quantity
    }

    grandTotal += itemTotal

    // Format: "Product Name Quantity" (e.g., "Product Name 1")
    const productText = `${productName} ${quantity}`
    const productStartY = doc.y

    // Product name — confined within first column
    renderText(doc, productText, col1X, doc.y, {
      width: col1ContentWidth,
      fontSize: 7,
      font: 'NotoSans',
    })

    // Calculate height for wrapping
    doc.font('NotoSans').fontSize(7)
    const productHeight = doc.heightOfString(productText, { width: col1ContentWidth })

    // Price and Total — right-aligned; omit "x 1" when quantity is 1
    const priceText =
      quantity > 1 ? `INR ${unitPrice.toFixed(2)} x ${quantity}` : `INR ${unitPrice.toFixed(2)}`
    const totalText = `INR ${itemTotal.toFixed(2)}`

    renderText(doc, priceText, col2X, productStartY, {
      width: col2ContentWidth,
      align: 'right',
      fontSize: 7,
      font: 'NotoSans',
    })
    renderText(doc, totalText, col3X, productStartY, {
      width: col3ContentWidth,
      align: 'right',
      fontSize: 7,
      font: 'NotoSans',
    })

    doc.y += Math.max(8, productHeight + 1)
  })

  // Grand Total row
  doc.y += 1
  doc
    .moveTo(20, doc.y - 1)
    .lineTo(268, doc.y - 1)
    .strokeColor(LABEL_COLORS.border)
    .lineWidth(0.5)
    .stroke()

  doc.font('NotoSansBold').fontSize(7)
  const finalTotal = displayAmount

  renderText(doc, 'Total:', col1X, doc.y, {
    width: col1ContentWidth,
    fontSize: 7,
    font: 'NotoSansBold',
  })
  const finalTotalText = `INR ${finalTotal.toFixed(2)}`
  renderText(doc, finalTotalText, col3X, doc.y, {
    width: col3ContentWidth,
    align: 'right',
    fontSize: 7,
    font: 'NotoSansBold',
  })

  const tableRowsEndY = doc.y
  const tableContentHeight = tableRowsEndY - tableContentStartY + 6
  const tableBoxHeight = tableContentHeight + 20

  doc
    .roundedRect(tableLeft, tableStartY, tableTotalWidth, tableBoxHeight + 10, 6)
    .strokeColor(LABEL_COLORS.border)
    .lineWidth(0.5)
    .stroke()
  renderText(doc, 'SHIPMENT ITEMS', 28, tableStartY + 6, {
    width: 232,
    fontSize: 7,
    font: 'NotoSansBold',
  })
  doc
    .moveTo(col2Left, tableStartY + 12)
    .lineTo(col2Left, tableStartY + tableBoxHeight + 10)
    .strokeColor(LABEL_COLORS.border)
    .lineWidth(0.5)
    .stroke()
  doc
    .moveTo(col3Left, tableStartY + 12)
    .lineTo(col3Left, tableStartY + tableBoxHeight + 10)
    .strokeColor(LABEL_COLORS.border)
    .lineWidth(0.5)
    .stroke()

  doc.y = tableStartY + tableBoxHeight + 16

  const bottomBarcodeY = doc.y + 2
  const bottomBarcodeWidth = 200
  const bottomBarcodeHeight = 25
  const bottomBarcodeX = (288 - bottomBarcodeWidth) / 2

  await drawBarcode(
    doc,
    awbNumber,
    bottomBarcodeX,
    bottomBarcodeY,
    bottomBarcodeWidth,
    bottomBarcodeHeight,
  )

  // Finalize PDF
  doc.end()

  // Return PDF buffer
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    doc.on('data', (chunk) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
  })
}
