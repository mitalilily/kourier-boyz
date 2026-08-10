import type { Order, OrderItem } from '@/api/orders'

type InvoiceOrderItem = OrderItem & {
  gstRatePercent?: number
  gstTaxType?: 'IGST' | 'CGST_SGST'
  hsnSacCode?: string
  priceWithoutTax?: number
  discountAmount?: number
  effectivePrice?: number
  igst?: number
  cgst?: number
  sgst?: number
}

export interface InvoiceLineBreakdown {
  item: InvoiceOrderItem
  lineNumber: number
  hsnCode: string
  gstRate: number
  taxType: 'IGST' | 'CGST_SGST'
  quantity: number
  sellingPriceExclGst: number
  itemDiscount: number
  allocatedOrderDiscount: number
  totalDiscount: number
  taxableValue: number
  igstAmount: number
  cgstAmount: number
  sgstAmount: number
  taxAmount: number
  lineTotal: number
}

export interface InvoiceBreakdown {
  lines: InvoiceLineBreakdown[]
  totalTaxableValue: number
  totalTax: number
  totalIgst: number
  totalCgst: number
  totalSgst: number
  itemsTotal: number
  shipping: number
  discount: number
  grandTotal: number
  roundedTotal: number
}

const roundToTwo = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100

const toNumber = (value: unknown, fallback = 0): number => {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

const isNear = (left: number, right: number): boolean => {
  if (left === right) return true
  if (left === 0 || right === 0) return Math.abs(left - right) < 0.01
  return Math.abs(left - right) / Math.max(Math.abs(left), Math.abs(right)) < 0.01
}

const splitTaxAmount = (
  taxAmount: number,
  taxType: 'IGST' | 'CGST_SGST',
): Pick<InvoiceLineBreakdown, 'igstAmount' | 'cgstAmount' | 'sgstAmount'> => {
  if (taxAmount <= 0) {
    return { igstAmount: 0, cgstAmount: 0, sgstAmount: 0 }
  }

  if (taxType === 'CGST_SGST') {
    const halfTax = roundToTwo(taxAmount / 2)
    return {
      igstAmount: 0,
      cgstAmount: halfTax,
      sgstAmount: roundToTwo(taxAmount - halfTax),
    }
  }

  return {
    igstAmount: roundToTwo(taxAmount),
    cgstAmount: 0,
    sgstAmount: 0,
  }
}

export const calculateInvoiceBreakdown = (order: Order): InvoiceBreakdown => {
  const linesSource = order.items.map((rawItem) => rawItem as InvoiceOrderItem)
  const orderDiscount = Math.max(0, toNumber(order.discount))
  const shipping = Math.max(0, toNumber(order.shipping))

  const inclusiveLineTotals = linesSource.map((item) => {
    const quantity = Math.max(1, toNumber(item.quantity, 1))
    const effectivePrice = toNumber(item.effectivePrice, toNumber(item.price))
    return Math.max(0, roundToTwo(toNumber(item.subtotal, effectivePrice * quantity)))
  })

  const lines = linesSource.map((item, index) => {
    const quantity = Math.max(1, toNumber(item.quantity, 1))
    const gstRate = Math.max(0, toNumber(item.gstRatePercent))
    const taxType = item.gstTaxType || 'IGST'
    const itemInclusiveTotal = inclusiveLineTotals[index]
    const itemDiscount = Math.max(0, toNumber(item.discountAmount))

    const allocatedOrderDiscount = 0

    const priceWithoutTaxUnit =
      toNumber(item.priceWithoutTax) > 0
        ? toNumber(item.priceWithoutTax)
        : gstRate > 0
          ? roundToTwo(toNumber(item.effectivePrice, toNumber(item.price)) / (1 + gstRate / 100))
          : toNumber(item.effectivePrice, toNumber(item.price))

    const storedBaseTax =
      roundToTwo(toNumber(item.igst) + toNumber(item.cgst) + toNumber(item.sgst)) * quantity

    const lineTotal = Math.max(0, roundToTwo(itemInclusiveTotal))

    let taxableValue: number
    let taxAmount: number

    if (gstRate > 0) {
      // Always derive from lineTotal so tax% is consistent with displayed taxable value.
      // Stored igst/cgst/sgst may be based on the pre-discount price when a coupon was
      // applied, which would make tax appear higher than gstRate% of the taxable base.
      taxableValue = roundToTwo(lineTotal / (1 + gstRate / 100))
      taxAmount = roundToTwo(lineTotal - taxableValue)
    } else if (storedBaseTax > 0) {
      taxAmount = roundToTwo(storedBaseTax)
      taxableValue = roundToTwo(lineTotal - taxAmount)
    } else {
      taxableValue = roundToTwo(priceWithoutTaxUnit * quantity)
      taxAmount = roundToTwo(lineTotal - taxableValue)
    }

    if (taxableValue < 0) {
      taxableValue = 0
      taxAmount = lineTotal
    }

    const splitTax = splitTaxAmount(taxAmount, taxType)

    return {
      item,
      lineNumber: index + 1,
      hsnCode: item.hsnSacCode || '-',
      gstRate,
      taxType,
      quantity,
      sellingPriceExclGst: gstRate > 0 ? roundToTwo(taxableValue / quantity) : roundToTwo(priceWithoutTaxUnit),
      itemDiscount,
      allocatedOrderDiscount,
      totalDiscount: roundToTwo(itemDiscount + allocatedOrderDiscount),
      taxableValue,
      igstAmount: splitTax.igstAmount,
      cgstAmount: splitTax.cgstAmount,
      sgstAmount: splitTax.sgstAmount,
      taxAmount,
      lineTotal,
    }
  })

  const totalTaxableValue = roundToTwo(lines.reduce((sum, line) => sum + line.taxableValue, 0))
  const totalIgst = roundToTwo(lines.reduce((sum, line) => sum + line.igstAmount, 0))
  const totalCgst = roundToTwo(lines.reduce((sum, line) => sum + line.cgstAmount, 0))
  const totalSgst = roundToTwo(lines.reduce((sum, line) => sum + line.sgstAmount, 0))
  const totalTax = roundToTwo(totalIgst + totalCgst + totalSgst)
  const itemsTotal = roundToTwo(lines.reduce((sum, line) => sum + line.lineTotal, 0))
  const calculatedGrandTotal = roundToTwo(itemsTotal + shipping - orderDiscount)
  const storedGrandTotal = toNumber(order.total)
  const grandTotal =
    storedGrandTotal > 0 && isNear(storedGrandTotal, calculatedGrandTotal)
      ? roundToTwo(storedGrandTotal)
      : calculatedGrandTotal

  return {
    lines,
    totalTaxableValue,
    totalTax,
    totalIgst,
    totalCgst,
    totalSgst,
    itemsTotal,
    shipping,
    discount: roundToTwo(orderDiscount),
    grandTotal,
    roundedTotal: Math.round(grandTotal),
  }
}
