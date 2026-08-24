import { Request, Response } from 'express'
import mongoose from 'mongoose'
import {
  calculateSlaDeadline,
  calculateTicketAge,
  isSlaBreached,
  wasSlaBreached,
} from '../constants/slaRules'
import Category from '../models/Category'
import Order from '../models/Order'
import Product from '../models/Product'
import Return from '../models/Return'
import SellerLedgerEntry from '../models/SellerLedgerEntry'
import SellerSettlementBatch from '../models/SellerSettlementBatch'
import SellerSettlementSettings from '../models/SellerSettlementSettings'
import { Shipment } from '../models/Shipment'
import Ticket from '../models/Ticket'
import User from '../models/User'
import { calculateOrderTATInfo, type OrderTATInfo } from '../utils/tatCalculations'

// Helper functions for date formatting
const formatDate = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const formatMonth = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

const getWeekStart = (date: Date): Date => {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Adjust to Monday
  return new Date(d.setDate(diff))
}

const addDays = (date: Date, days: number): Date => {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

type GroupingType = 'seller' | 'state' | 'category' | 'product' | 'date'

interface SalesReportParams {
  fromDate?: string
  toDate?: string
  seller?: string
  sellerState?: string
  category?: string
  orderStatus?: string
  paymentMethod?: string
  grouping?: GroupingType
  dateGrouping?: 'daily' | 'weekly' | 'monthly'
}

interface SalesReportRow {
  identifier: string
  identifierId?: string
  grossSales: number
  gstAmount: number
  returnsAmount: number
  netSales: number
  shipping: number
  discount: number
  orderCount: number
  returnCount: number
  totalValue: number
}

interface SalesReportResponse {
  success: boolean
  data: {
    rows: SalesReportRow[]
    totals: {
      grossSales: number
      gstAmount: number
      returnsAmount: number
      netSales: number
      shipping: number
      discount: number
      orderCount: number
      returnCount: number
      totalValue: number
    }
    grouping: GroupingType
    dateGrouping?: 'daily' | 'weekly' | 'monthly'
    filters: SalesReportParams
  }
}

export const getSalesReport = async (req: Request, res: Response) => {
  try {
    const {
      fromDate,
      toDate,
      seller,
      sellerState,
      category,
      orderStatus,
      paymentMethod,
      grouping = 'seller',
      dateGrouping = 'daily',
    } = req.query as SalesReportParams

    // Default to last 30 days if no date range provided
    const now = new Date()
    const defaultToDate = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
      999,
    )
    const defaultFromDate = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - 30,
      0,
      0,
      0,
      0,
    )

    const from = fromDate ? new Date(fromDate) : defaultFromDate
    const to = toDate ? new Date(toDate) : defaultToDate

    // Build query for orders
    const orderQuery: any = {
      status: { $ne: 'cancelled' }, // Exclude cancelled orders
      createdAt: { $gte: from, $lte: to },
    }

    // Filter by order status (delivered/returned)
    if (orderStatus) {
      if (orderStatus === 'delivered') {
        orderQuery.status = 'delivered'
      } else if (orderStatus === 'returned') {
        // For returned, we'll check returns separately
        orderQuery.returnRequested = true
      }
    } else {
      // Default: show delivered orders
      orderQuery.status = 'delivered'
    }

    // Filter by payment method
    if (paymentMethod) {
      if (paymentMethod === 'COD') {
        orderQuery.paymentMethod = 'cod'
      } else if (paymentMethod === 'Prepaid') {
        orderQuery.paymentMethod = { $in: ['card', 'upi', 'wallet'] }
      }
    }

    // Fetch orders with populated data
    const orders = await Order.find(orderQuery)
      .populate('items.product', 'name category')
      .populate('items.seller', 'name businessName state')
      .populate('items.variant', 'name')
      .lean()

    // Filter by seller if provided
    let filteredOrders = orders
    if (seller) {
      filteredOrders = filteredOrders.filter((order) =>
        order.items.some((item: any) => item.seller?._id?.toString() === seller),
      )
    }

    // Filter by seller state if provided
    if (sellerState) {
      filteredOrders = filteredOrders.filter((order) =>
        order.items.some((item: any) => item.seller?.state === sellerState),
      )
    }

    // Filter by category if provided
    if (category) {
      filteredOrders = filteredOrders.filter((order) =>
        order.items.some((item: any) => item.product?.category?.toString() === category),
      )
    }

    // Fetch returns for the same date range
    const returnQuery: any = {
      createdAt: { $gte: from, $lte: to },
      status: { $in: ['REFUND_INITIATED', 'REFUND_COMPLETED'] },
    }

    if (seller) {
      returnQuery.seller = new mongoose.Types.ObjectId(seller)
    }

    const returns = await Return.find(returnQuery)
      .populate({
        path: 'order',
        select: 'items createdAt',
        populate: {
          path: 'items',
          select: 'product seller priceWithoutTax igst cgst sgst quantity subtotal',
        },
      })
      .populate('orderItem', 'product seller priceWithoutTax igst cgst sgst quantity subtotal')
      .populate('seller', 'name businessName state')
      .lean()

    // PERFORMANCE OPTIMIZATION: Preload categories and products into Maps to avoid N+1 queries
    // Collect all unique category IDs and product IDs from orders and returns
    const categoryIds = new Set<string>()
    const productIds = new Set<string>()

    // Collect IDs from order items
    for (const order of filteredOrders) {
      for (const item of order.items as any[]) {
        if (item.product?.category) {
          categoryIds.add(item.product.category.toString())
        }
        if (item.product?._id) {
          productIds.add(item.product._id.toString())
        }
      }
    }

    // Collect IDs from returns (for products that need to be looked up)
    for (const returnRecord of returns) {
      const returnItem = returnRecord.orderItem as any
      const returnOrder = returnRecord.order as any

      // Get product ID from return item (if populated) or from order items
      if (returnItem && returnItem._id) {
        // If orderItem is populated, use it directly
        if (returnItem.product) {
          const productId =
            typeof returnItem.product === 'object'
              ? returnItem.product._id?.toString()
              : returnItem.product.toString()
          if (productId) productIds.add(productId)
        }
      } else if (returnOrder?.items) {
        // Find the item in the order
        const orderItemId = returnRecord.orderItem?.toString()
        if (orderItemId) {
          const orderItem = returnOrder.items.find(
            (item: any) => item._id?.toString() === orderItemId,
          )
          if (orderItem?.product) {
            const productId =
              typeof orderItem.product === 'object'
                ? orderItem.product._id?.toString()
                : orderItem.product.toString()
            if (productId) productIds.add(productId)
          }
        }
      }
    }

    // Preload categories into Map
    const categoryMap = new Map<string, any>()
    if (categoryIds.size > 0) {
      const categories = await Category.find({
        _id: { $in: Array.from(categoryIds).map((id) => new mongoose.Types.ObjectId(id)) },
      }).lean()
      categories.forEach((cat) => {
        categoryMap.set(cat._id.toString(), cat)
      })
    }

    // Preload products into Map
    const productMap = new Map<string, any>()
    if (productIds.size > 0) {
      const products = await Product.find({
        _id: { $in: Array.from(productIds).map((id) => new mongoose.Types.ObjectId(id)) },
      })
        .select('name category')
        .lean()
      products.forEach((prod) => {
        productMap.set(prod._id.toString(), prod)
        // Also collect category IDs from products
        if (prod.category) {
          categoryIds.add(prod.category.toString())
        }
      })
    }

    // Reload categories if we found new ones from products
    if (categoryIds.size > categoryMap.size) {
      const missingCategoryIds = Array.from(categoryIds).filter((id) => !categoryMap.has(id))
      if (missingCategoryIds.length > 0) {
        const additionalCategories = await Category.find({
          _id: { $in: missingCategoryIds.map((id) => new mongoose.Types.ObjectId(id)) },
        }).lean()
        additionalCategories.forEach((cat) => {
          categoryMap.set(cat._id.toString(), cat)
        })
      }
    }

    // Build grouped data
    const groupedData = new Map<string, SalesReportRow>()
    const orderCountMap = new Map<string, Set<string>>() // Track unique orders per group
    const calculationDetails: any[] = [] // Store detailed calculation breakdown

    // Process order items
    for (const order of filteredOrders) {
      for (const item of order.items as any[]) {
        // Skip if item doesn't match filters
        if (seller && item.seller?._id?.toString() !== seller) continue
        if (sellerState && item.seller?.state !== sellerState) continue
        if (category && item.product?.category?.toString() !== category) continue

        // Calculate values for this item
        const quantity = item.quantity || 0

        // Gross Sales = Line total after discounts, EXCLUDING GST.
        // item.subtotal is the GST-INCLUSIVE line total (matches what customer paid for the line),
        // so we must subtract the GST portion to get gross sales (consistent with invoice taxable value).
        // When gstRatePercent is available we derive tax from subtotal (works correctly even for legacy
        // orders where stored per-unit igst/cgst/sgst were based on the undiscounted catalogue price).
        const gstRatePercent = Number(item.gstRatePercent) || 0
        const lineInclusiveTotal =
          item.subtotal !== undefined && item.subtotal !== null && item.subtotal > 0
            ? Number(item.subtotal)
            : (Number(item.priceWithoutTax) || 0) * quantity * (1 + gstRatePercent / 100)

        let grossSales = 0
        let totalGst = 0
        if (gstRatePercent > 0) {
          grossSales = lineInclusiveTotal / (1 + gstRatePercent / 100)
          totalGst = lineInclusiveTotal - grossSales
        } else {
          const gstPerUnit = (item.igst || 0) + (item.cgst || 0) + (item.sgst || 0)
          totalGst = gstPerUnit * quantity
          grossSales = Math.max(0, lineInclusiveTotal - totalGst)
        }

        // Store calculation details for debugging
        if (process.env.NODE_ENV === 'development') {
          calculationDetails.push({
            type: 'order_item',
            orderId: (order as any)._id?.toString(),
            itemId: item._id?.toString(),
            product: item.product?.name || 'Unknown',
            quantity,
            subtotal: item.subtotal,
            priceWithoutTax: item.priceWithoutTax,
            calculatedGrossSales: grossSales,
            igst: item.igst || 0,
            cgst: item.cgst || 0,
            sgst: item.sgst || 0,
            gstPerUnit: (item.igst || 0) + (item.cgst || 0) + (item.sgst || 0),
            calculatedGst: totalGst,
            formula: {
              grossSales: item.subtotal
                ? `subtotal = ${item.subtotal}`
                : `priceWithoutTax × quantity = ${item.priceWithoutTax} × ${quantity} = ${grossSales}`,
              gst: `(igst + cgst + sgst) × quantity = (${item.igst || 0} + ${item.cgst || 0} + ${
                item.sgst || 0
              }) × ${quantity} = ${totalGst}`,
            },
          })
        }

        // Determine identifier based on grouping
        let identifier: string
        let identifierId: string | undefined

        switch (grouping) {
          case 'seller':
            identifier = item.seller?.businessName || item.seller?.name || 'Unknown Seller'
            identifierId = item.seller?._id?.toString()
            break
          case 'state':
            identifier = item.seller?.state || 'Unknown State'
            break
          case 'category':
            if (item.product?.category) {
              const categoryId = item.product.category.toString()
              const cat = categoryMap.get(categoryId)
              identifier = cat?.name || 'Unknown Category'
              identifierId = cat?._id?.toString()
            } else {
              identifier = 'Unknown Category'
            }
            break
          case 'product':
            identifier = item.product?.name || 'Unknown Product'
            identifierId = item.product?._id?.toString()
            break
          case 'date':
            const orderDate = new Date(order.createdAt)
            if (dateGrouping === 'daily') {
              identifier = formatDate(orderDate)
            } else if (dateGrouping === 'weekly') {
              const weekStart = getWeekStart(orderDate)
              const weekEnd = addDays(weekStart, 6)
              identifier = `${formatDate(weekStart)} to ${formatDate(weekEnd)}`
            } else {
              identifier = formatMonth(orderDate)
            }
            break
          default:
            identifier = 'Unknown'
        }

        // Get or create group
        if (!groupedData.has(identifier)) {
          groupedData.set(identifier, {
            identifier,
            identifierId,
            grossSales: 0,
            gstAmount: 0,
            returnsAmount: 0,
            netSales: 0,
            shipping: 0,
            discount: 0,
            orderCount: 0,
            returnCount: 0,
            totalValue: 0,
          })
          orderCountMap.set(identifier, new Set())
        }

        const group = groupedData.get(identifier)!
        const orderSet = orderCountMap.get(identifier)!

        group.grossSales += grossSales
        group.gstAmount += totalGst

        // Count order only once per group + accumulate order-level charges once per order
        const orderId = (order as any)._id?.toString() || ''
        if (!orderSet.has(orderId)) {
          orderSet.add(orderId)
          group.orderCount += 1
          group.shipping += Number((order as any).shipping || 0)
          group.discount += Number((order as any).discount || 0)
        }
      }
    }

    // Process returns (as negative values)
    for (const returnRecord of returns) {
      const returnOrder = returnRecord.order as any
      const returnItem = returnRecord.orderItem as any
      const returnSeller = returnRecord.seller as any

      // Skip if doesn't match filters
      if (seller && returnSeller?._id?.toString() !== seller) continue
      if (sellerState && returnSeller?.state !== sellerState) continue

      // Get the actual order item to extract GST information
      let actualOrderItem: any = null
      if (returnItem && returnItem._id) {
        // If orderItem is populated, use it
        actualOrderItem = returnItem
      } else if (returnOrder && returnOrder.items) {
        // Find the item in the order
        const orderItemId = returnRecord.orderItem?.toString()
        if (orderItemId) {
          actualOrderItem = returnOrder.items.find(
            (item: any) => item._id?.toString() === orderItemId,
          )
        }
      }

      // Check category filter
      if (category) {
        let productCategory: string | null = null
        if (actualOrderItem?.product) {
          const productId = actualOrderItem.product.toString()
          const product = productMap.get(productId)
          productCategory = product?.category?.toString() || null
        }
        if (productCategory !== category) continue
      }

      // Determine identifier
      let identifier: string
      let identifierId: string | undefined

      switch (grouping) {
        case 'seller':
          identifier = returnSeller?.businessName || returnSeller?.name || 'Unknown Seller'
          identifierId = returnSeller?._id?.toString()
          break
        case 'state':
          identifier = returnSeller?.state || 'Unknown State'
          break
        case 'category':
          if (actualOrderItem?.product) {
            const productId = actualOrderItem.product.toString()
            const product = productMap.get(productId)
            if (product?.category) {
              const categoryId = product.category.toString()
              const cat = categoryMap.get(categoryId)
              identifier = cat?.name || 'Unknown Category'
              identifierId = cat?._id?.toString()
            } else {
              identifier = 'Unknown Category'
            }
          } else {
            identifier = 'Unknown Category'
          }
          break
        case 'product':
          if (actualOrderItem?.product) {
            const productId = actualOrderItem.product.toString()
            const product = productMap.get(productId)
            identifier = product?.name || 'Unknown Product'
            identifierId = product?._id?.toString()
          } else {
            identifier = 'Unknown Product'
          }
          break
        case 'date':
          const returnDate = new Date(returnRecord.createdAt)
          if (dateGrouping === 'daily') {
            identifier = formatDate(returnDate)
          } else if (dateGrouping === 'weekly') {
            const weekStart = getWeekStart(returnDate)
            const weekEnd = addDays(weekStart, 6)
            identifier = `${formatDate(weekStart)} to ${formatDate(weekEnd)}`
          } else {
            identifier = formatMonth(returnDate)
          }
          break
        default:
          identifier = 'Unknown'
      }

      // Get or create group
      if (!groupedData.has(identifier)) {
        groupedData.set(identifier, {
          identifier,
          identifierId,
          grossSales: 0,
          gstAmount: 0,
          returnsAmount: 0,
          netSales: 0,
          shipping: 0,
          discount: 0,
          orderCount: 0,
          returnCount: 0,
          totalValue: 0,
        })
      }

      const group = groupedData.get(identifier)!
      const refundAmount = returnRecord.refundAmount || 0

      // IMPORTANT: refundAmount is the authoritative source of truth for refund calculations
      // This applies to both full item returns and partial quantity returns.
      // For partial returns (e.g., return 1 out of 3 units), refundAmount represents
      // the actual processed refund amount, which may not be exactly proportional
      // to the quantity returned (due to discounts, promotions, adjustments, etc.)
      // GST is reversed proportionally based on this authoritative refundAmount.

      // Calculate GST breakdown from actual order item if available
      let refundGross = 0
      let refundGst = 0
      let itemGrossSales = 0
      let itemTotalGst = 0
      let itemTotalWithTax = 0
      let refundRatio = 0

      if (actualOrderItem) {
        // item.subtotal is the GST-INCLUSIVE line total. Derive gross (excl GST) and tax from it
        // using gstRatePercent for consistency with the invoice display and with the sales block above.
        const itemGstRatePercent = Number(actualOrderItem.gstRatePercent) || 0
        const itemQty = actualOrderItem.quantity || 1
        const lineInclusive =
          actualOrderItem.subtotal !== undefined &&
          actualOrderItem.subtotal !== null &&
          actualOrderItem.subtotal > 0
            ? Number(actualOrderItem.subtotal)
            : (Number(actualOrderItem.priceWithoutTax) || 0) *
              itemQty *
              (1 + itemGstRatePercent / 100)

        if (itemGstRatePercent > 0) {
          itemGrossSales = lineInclusive / (1 + itemGstRatePercent / 100)
          itemTotalGst = lineInclusive - itemGrossSales
        } else {
          const itemGstPerUnit =
            (actualOrderItem.igst || 0) +
            (actualOrderItem.cgst || 0) +
            (actualOrderItem.sgst || 0)
          itemTotalGst = itemGstPerUnit * itemQty
          itemGrossSales = Math.max(0, lineInclusive - itemTotalGst)
        }
        itemTotalWithTax = itemGrossSales + itemTotalGst

        // Calculate proportion of refund based on original item value
        // Note: refundRatio may NOT equal (returnedQuantity / totalQuantity) because
        // refundAmount is authoritative and may include adjustments, fees, or discounts
        if (itemTotalWithTax > 0) {
          refundRatio = refundAmount / itemTotalWithTax
          refundGross = itemGrossSales * refundRatio
          refundGst = itemTotalGst * refundRatio
        } else {
          // Fallback: assume refund is all gross if no tax data
          refundGross = refundAmount
          refundGst = 0
        }
      } else {
        // Fallback: if we can't find the order item, use a conservative estimate
        // Assume the refund amount includes GST, so calculate backwards
        // Using 18% as a reasonable average (but this is less accurate)
        refundGross = refundAmount / 1.18
        refundGst = refundAmount - refundGross
      }

      // Apply returns as negative values
      // Note: Gross Sales should NOT be reduced - it represents total sales before returns
      // Returns are tracked separately in returnsAmount, and Net Sales = Gross Sales + Returns Amount
      // refundAmount is authoritative - it represents the actual processed refund amount

      // IMPORTANT: Double-counting prevention
      // returnsAmount is NOT "money refunded" - it only represents the part of refund that affects sales (net sales)
      // returnsAmount = refund of product value (excluding GST)
      // GST part of the refund is handled separately in gstAmount
      //
      // Why can't returnsAmount be -refundAmount?
      // Because refundAmount includes GST. If we subtract full refundAmount from returnsAmount
      // AND also subtract refundGst from gstAmount, GST gets deducted twice ❌
      //
      // Example:
      //   Original: Product ₹1,000 + GST ₹180 = ₹1,180
      //   Return: refundAmount = ₹1,180 (includes GST)
      //   ❌ WRONG: returnsAmount -= ₹1,180, gstAmount -= ₹180 → Net impact = -₹1,360 (GST deducted twice)
      //   ✅ CORRECT: returnsAmount -= ₹1,000 (refundGross), gstAmount -= ₹180 → Net impact = -₹1,180 (GST deducted once)
      //
      // Split the refund into two logical parts:
      // 1. Gross part (affects sales): refundGross = ₹1,000 → returnsAmount -= ₹1,000
      // 2. GST part (affects tax): refundGst = ₹180 → gstAmount -= ₹180
      // This ensures: Net Sales = grossSales - refundGross, and GST = originalGst - refundGst
      // Total Value = (grossSales - refundGross) + (originalGst - refundGst) = correct calculation
      group.returnsAmount -= refundGross // Gross portion only (negative value) - reduces Net Sales by gross refund amount only
      group.gstAmount -= refundGst // Reduce GST by the GST portion of the refund (proportionally calculated) - separate adjustment
      group.returnCount += 1

      // Store calculation details for debugging
      if (process.env.NODE_ENV === 'development') {
        calculationDetails.push({
          type: 'return',
          returnId: (returnRecord as any)._id?.toString(),
          orderId: returnOrder?._id?.toString(),
          refundAmount,
          originalItemGrossSales: actualOrderItem ? itemGrossSales : null,
          originalItemGst: actualOrderItem ? itemTotalGst : null,
          originalItemTotalWithTax: actualOrderItem ? itemTotalWithTax : null,
          calculatedRefundGross: refundGross,
          calculatedRefundGst: refundGst,
          formula: actualOrderItem
            ? {
                refundRatio: `refundAmount / itemTotalWithTax = ${refundAmount} / ${itemTotalWithTax} = ${refundRatio.toFixed(
                  4,
                )}`,
                refundGst: `itemTotalGst × refundRatio = ${itemTotalGst} × ${refundRatio.toFixed(
                  4,
                )} = ${refundGst.toFixed(2)}`,
                refundGross: `itemGrossSales × refundRatio = ${itemGrossSales} × ${refundRatio.toFixed(
                  4,
                )} = ${refundGross.toFixed(2)}`,
              }
            : {
                fallback: `Using 18% GST assumption: refundGross = ${refundAmount} / 1.18 = ${refundGross.toFixed(
                  2,
                )}, refundGst = ${refundGst.toFixed(2)}`,
              },
        })
      }
    }

    // Calculate net sales and total value for each group
    // Logic verification (FIXED to prevent double-counting):
    // - returnsAmount = -refundGross (gross portion only, excludes GST)
    // - gstAmount = originalGst - refundGst (GST adjusted separately)
    // - netSales = grossSales + returnsAmount = grossSales - refundGross (correct: only gross portion)
    // - totalValue = netSales + gstAmount
    //   = (grossSales - refundGross) + (originalGst - refundGst)
    //   = grossSales + originalGst - refundGross - refundGst (correct: no double-counting)
    //
    // This ensures:
    // - Net Sales is reduced only by the gross portion of refunds
    // - GST is adjusted separately
    // - Total Value correctly represents final value without double-counting
    const rows: SalesReportRow[] = Array.from(groupedData.values()).map((row) => {
      // Net Sales = Gross Sales + Returns Amount (product-only revenue, excl. shipping)
      const netSales = row.grossSales + row.returnsAmount
      // Total Value = what customer was actually invoiced for, reconciling to the invoice:
      //   = Net Sales + GST + Shipping - Discount
      const totalValue = netSales + row.gstAmount + row.shipping - row.discount
      return {
        ...row,
        netSales,
        totalValue,
      }
    })

    // Sort rows by identifier
    rows.sort((a, b) => a.identifier.localeCompare(b.identifier))

    // Calculate totals
    const totals = rows.reduce(
      (acc, row) => ({
        grossSales: acc.grossSales + row.grossSales,
        gstAmount: acc.gstAmount + row.gstAmount,
        returnsAmount: acc.returnsAmount + row.returnsAmount,
        netSales: acc.netSales + row.netSales,
        shipping: acc.shipping + row.shipping,
        discount: acc.discount + row.discount,
        orderCount: acc.orderCount + row.orderCount,
        returnCount: acc.returnCount + row.returnCount,
        totalValue: acc.totalValue + row.totalValue,
      }),
      {
        grossSales: 0,
        gstAmount: 0,
        returnsAmount: 0,
        netSales: 0,
        shipping: 0,
        discount: 0,
        orderCount: 0,
        returnCount: 0,
        totalValue: 0,
      },
    )

    // Add calculation breakdown for debugging/verification
    const calculationBreakdown = {
      ordersProcessed: filteredOrders.length,
      returnsProcessed: returns.length,
      formula: {
        grossSales:
          'Sum of GST-exclusive line totals (subtotal / (1 + gstRatePercent/100)) for all order items, minus gross portion of returns',
        gstAmount:
          'Sum of GST portion of each line (subtotal - grossSales) for all order items, minus GST portion of returns',

        returnsAmount:
          'Sum of (-refundGross) for all returns (gross portion only, GST handled separately)',
        netSales: 'grossSales + returnsAmount',
        totalValue: 'netSales + gstAmount',
        orderCount: 'Count of unique order IDs per group',
        returnCount: 'Count of return records per group',
      },
      sampleCalculation:
        rows.length > 0
          ? {
              identifier: rows[0].identifier,
              breakdown: {
                grossSales: `${rows[0].grossSales} (sum of order item subtotals)`,
                gstAmount: `${rows[0].gstAmount} (sum of GST from order items)`,
                returnsAmount: `${rows[0].returnsAmount} (sum of negative refund amounts)`,
                netSales: `${rows[0].netSales} = ${rows[0].grossSales} + ${rows[0].returnsAmount}`,
                totalValue: `${rows[0].totalValue} = ${rows[0].netSales} + ${rows[0].gstAmount}`,
              },
            }
          : null,
    }

    const response: SalesReportResponse = {
      success: true,
      data: {
        rows,
        totals,
        grouping,
        dateGrouping: grouping === 'date' ? dateGrouping : undefined,
        filters: {
          fromDate: from.toISOString(),
          toDate: to.toISOString(),
          seller,
          sellerState,
          category,
          orderStatus,
          paymentMethod,
          grouping,
          dateGrouping: grouping === 'date' ? dateGrouping : undefined,
        },
        // Include calculation breakdown in development mode
        ...(process.env.NODE_ENV === 'development' && {
          calculationBreakdown: {
            ...calculationBreakdown,
            detailedCalculations: calculationDetails,
          },
        }),
      },
    }

    res.json(response)
  } catch (error: any) {
    console.error('Error generating sales report:', error)
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate sales report',
    })
  }
}

// Helper function to calculate due date from settlement period end date
// Calculates based on seller-specific settlement cycle settings
// Due date is determined by the settlement cycle type and configuration
const calculateDueDate = (
  toDate: Date,
  settlementCycle: string,
  customDays?: number | null,
): Date => {
  const dueDate = new Date(toDate)

  // Calculate due date based on seller's settlement cycle
  if (settlementCycle === 'DAILY') {
    // For daily cycles, due date is typically 1 day after period end
    dueDate.setDate(dueDate.getDate() + 1)
  } else if (settlementCycle === 'WEEKLY') {
    // For weekly cycles, due date is typically 2 days after period end
    dueDate.setDate(dueDate.getDate() + 2)
  } else if (settlementCycle === 'CUSTOM' && customDays) {
    // For custom cycles, due date is calculated as a percentage of cycle days
    // Using 20% of cycle days as processing time (minimum 1 day, maximum 7 days)
    const processingDays = Math.max(1, Math.min(7, Math.round(customDays * 0.2)))
    dueDate.setDate(dueDate.getDate() + processingDays)
  } else {
    // Default fallback: 2 days for unknown cycles
    dueDate.setDate(dueDate.getDate() + 2)
  }

  return dueDate
}

// Helper function to get settlement cycle label
const getSettlementCycleLabel = (cycle: string, customDays?: number | null): string => {
  if (cycle === 'DAILY') return 'Daily'
  if (cycle === 'WEEKLY') return 'Weekly'
  if (cycle === 'CUSTOM' && customDays) {
    if (customDays === 14) return 'Fortnightly'
    if (customDays === 30 || customDays === 28 || customDays === 31) return 'Monthly'
    return `${customDays} Days`
  }
  // Default fallback
  return 'Weekly'
}

interface SettlementDueReportParams {
  seller?: string
  settlementCycle?: string
  dueDateFrom?: string
  dueDateTo?: string
  amountFrom?: string
  amountTo?: string
  status?: 'PENDING' | 'ALL'
}

interface SettlementDueReportRow {
  sellerId: string
  sellerName: string
  sellerGstin?: string
  settlementPeriod: string
  fromDate: string
  toDate: string
  settlementAmount: number
  settlementCycle: string
  dueDate: string
  status: 'PENDING' | 'PAID'
  batchId: string
  sellerLedgerBalance?: number // Current ledger balance for this seller
}

interface SettlementDueReportResponse {
  success: boolean
  data: {
    rows: SettlementDueReportRow[]
    totals: {
      totalAmountDue: number
      totalAmountSettled: number
      pendingCount: number
      paidCount: number
    }
    filters: SettlementDueReportParams
    note?: string // Information about what the report shows
    sellerLedgerBalance?: number // Current ledger balance (only when seller filter is applied)
  }
}

export const getSettlementDueReport = async (req: Request, res: Response) => {
  try {
    const { seller, settlementCycle, dueDateFrom, dueDateTo, amountFrom, amountTo, status } =
      req.query as SettlementDueReportParams

    // Build query for settlement batches
    const batchQuery: any = {}

    // Filter by status: if 'PENDING' is specified, show only pending; if 'ALL' or undefined, show all
    if (status === 'PENDING') {
      batchQuery.status = 'PENDING'
    }
    // If status is 'ALL' or undefined, don't filter by status (show all batches)

    // Filter by seller
    if (seller) {
      batchQuery.seller = new mongoose.Types.ObjectId(seller)
    }

    // OPTIMIZATION: If filtering by settlement cycle, first find sellers with matching cycle
    // This reduces the number of batches we need to fetch and process
    let sellerIdsForCycleFilter: string[] | null = null
    if (settlementCycle) {
      // Map cycle label back to cycle type and customDays
      let targetCycle: string | null = null
      let targetCustomDays: number | null = null

      if (settlementCycle === 'Daily') {
        targetCycle = 'DAILY'
      } else if (settlementCycle === 'Weekly') {
        targetCycle = 'WEEKLY'
      } else if (settlementCycle === 'Fortnightly') {
        targetCycle = 'CUSTOM'
        targetCustomDays = 14
      } else if (settlementCycle === 'Monthly') {
        targetCycle = 'CUSTOM'
        targetCustomDays = 30 // Also match 28, 31
      } else {
        // Handle custom cycle labels like "15 Days", "20 Days", etc.
        const customDaysMatch = settlementCycle.match(/^(\d+)\s*Days?$/i)
        if (customDaysMatch) {
          targetCycle = 'CUSTOM'
          targetCustomDays = parseInt(customDaysMatch[1], 10)
        }
      }

      // Find sellers with matching cycle settings
      const cycleQuery: any = {}
      if (targetCycle) {
        if (targetCycle === 'CUSTOM' && targetCustomDays !== null) {
          // For Monthly, match 28, 30, or 31 days
          if (targetCustomDays === 30) {
            cycleQuery.$or = [{ settlementCycle: 'CUSTOM', customCycleDays: { $in: [28, 30, 31] } }]
          } else {
            cycleQuery.settlementCycle = 'CUSTOM'
            cycleQuery.customCycleDays = targetCustomDays
          }
        } else {
          cycleQuery.settlementCycle = targetCycle
        }
      } else {
        // If we couldn't map the cycle label, we need to check all sellers
        // and filter in-memory (fallback to original approach)
        // This handles edge cases or future cycle label formats
        sellerIdsForCycleFilter = null // Signal to filter in-memory
      }

      // Only query if we have a valid cycle query
      if (cycleQuery.settlementCycle || cycleQuery.$or) {
        const matchingSettings = await SellerSettlementSettings.find(cycleQuery)
          .select('seller')
          .lean()

        sellerIdsForCycleFilter = matchingSettings.map((s) => s.seller.toString())

        // If no sellers match the cycle, return empty result early
        if (sellerIdsForCycleFilter.length === 0) {
          return res.json({
            success: true,
            data: {
              rows: [],
              totals: {
                totalAmountDue: 0,
                totalAmountSettled: 0,
                pendingCount: 0,
                paidCount: 0,
              },
              filters: {
                seller,
                settlementCycle,
                dueDateFrom,
                dueDateTo,
                amountFrom,
                amountTo,
                status,
              },
            },
          })
        }

        // Add seller filter to batch query if not already filtered by specific seller
        // FILTERING PRIORITY: If both seller filter and settlement cycle filter are applied,
        // seller filter takes precedence. If the specified seller does not match the cycle,
        // return empty result (seller filter wins).
        if (!seller) {
          batchQuery.seller = {
            $in: sellerIdsForCycleFilter.map((id) => new mongoose.Types.ObjectId(id)),
          }
        } else {
          // If specific seller is requested, verify they match the cycle
          // Seller filter takes precedence - if seller doesn't match cycle, return empty
          if (!sellerIdsForCycleFilter.includes(seller)) {
            return res.json({
              success: true,
              data: {
                rows: [],
                totals: {
                  totalAmountDue: 0,
                  totalAmountSettled: 0,
                  pendingCount: 0,
                  paidCount: 0,
                },
                filters: {
                  seller,
                  settlementCycle,
                  dueDateFrom,
                  dueDateTo,
                  amountFrom,
                  amountTo,
                  status,
                },
              },
            })
          }
        }
      }
      // If sellerIdsForCycleFilter is null, we couldn't map the cycle label
      // In this case, we'll filter in-memory after fetching all batches
    }

    // Fetch settlement batches with populated seller data
    // Use the same approach as the working settlements page (no .lean() to match exactly)
    const batches = await SellerSettlementBatch.find(batchQuery)
      .populate('seller', 'name businessName gstNumber')
      .sort({ toDate: 1, createdAt: 1 }) // Sort by due date (earliest first)

    // Convert to plain objects for processing (similar to .lean() but after populate)
    const batchesData = batches.map((b) => (b.toObject ? b.toObject() : b))

    // Filter out batches where seller population failed (seller was deleted or not found)
    // Only filter if seller is null/undefined or is still an ObjectId (not populated)
    const validBatches = batchesData.filter((b: any) => {
      const seller = b.seller
      // If seller is null/undefined, skip this batch
      if (!seller) {
        return false
      }
      // If seller is an ObjectId (string), it wasn't populated - skip
      if (typeof seller === 'string' || seller instanceof mongoose.Types.ObjectId) {
        return false
      }
      // If seller is an object with _id, it was populated successfully
      return seller._id != null
    })

    // Debug logging (remove in production)
    if (process.env.NODE_ENV === 'development') {
      const sampleBatch = validBatches[0] as any
      const totalBatchesCount = await SellerSettlementBatch.countDocuments({})
      const pendingBatchesCount = await SellerSettlementBatch.countDocuments({ status: 'PENDING' })
      const paidBatchesCount = await SellerSettlementBatch.countDocuments({ status: 'PAID' })

      console.log('Settlement Due Report Query:', {
        query: batchQuery,
        totalBatchesInDB: totalBatchesCount,
        pendingBatchesInDB: pendingBatchesCount,
        paidBatchesInDB: paidBatchesCount,
        batchesFound: batches.length,
        validBatches: validBatches.length,
        statusFilter: status || 'ALL (default)',
        settlementCycleFilter: settlementCycle || 'None',
        sellersMatchingCycle: sellerIdsForCycleFilter?.length || 'N/A',
        sampleBatch: sampleBatch
          ? {
              id: sampleBatch._id,
              seller:
                sampleBatch.seller && typeof sampleBatch.seller === 'object'
                  ? sampleBatch.seller.name
                  : 'Not populated',
              status: sampleBatch.status,
              amount: sampleBatch.totalNetPayout,
            }
          : null,
        batchesWithUnpopulatedSeller: batches.length - validBatches.length,
      })
    }

    // Get seller settlement settings to determine cycles
    const sellerIds = [
      ...new Set(validBatches.map((b: any) => b.seller?._id?.toString()).filter(Boolean)),
    ]
    const sellerSettingsMap = new Map<string, any>()

    if (sellerIds.length > 0) {
      const settings = await SellerSettlementSettings.find({
        seller: { $in: sellerIds.map((id) => new mongoose.Types.ObjectId(id)) },
      }).lean()

      settings.forEach((setting) => {
        sellerSettingsMap.set(setting.seller.toString(), setting)
      })
    }

    // Process batches into report rows
    const rows: SettlementDueReportRow[] = []

    for (const batch of validBatches) {
      const batchSeller = batch.seller as any
      const sellerId = batchSeller?._id?.toString()
      if (!sellerId) continue

      // Get settlement cycle from settings
      const settings = sellerSettingsMap.get(sellerId)
      const cycle = settings?.settlementCycle || 'WEEKLY'
      const customDays = settings?.customCycleDays
      const cycleLabel = getSettlementCycleLabel(cycle, customDays)

      // Calculate due date based on seller-specific settlement cycle settings
      // Due date is calculated according to the seller's settlement cycle configuration
      const toDate = new Date(batch.toDate)
      const dueDate = calculateDueDate(toDate, cycle, customDays)

      // Settlement cycle filtering:
      // - If we successfully mapped the cycle label, filtering was done at DB level (optimized)
      // - If we couldn't map the cycle label (e.g., unknown format), we filter in-memory here
      // - This also serves as a safety check in case the DB-level filter missed something
      if (settlementCycle && cycleLabel !== settlementCycle) {
        continue
      }

      // Filter by due date range
      if (dueDateFrom) {
        const from = new Date(dueDateFrom)
        if (dueDate < from) continue
      }
      if (dueDateTo) {
        const to = new Date(dueDateTo)
        to.setHours(23, 59, 59, 999)
        if (dueDate > to) continue
      }

      // Filter by amount range
      // Ensure settlement amount is never negative (clamp at zero)
      // This is a display/reporting safeguard - edge cases like full refunds may produce zero or negative payouts
      const amount = Math.max(batch.totalNetPayout || 0, 0)
      if (amountFrom) {
        const min = parseFloat(amountFrom)
        if (amount < min) continue
      }
      if (amountTo) {
        const max = parseFloat(amountTo)
        if (amount > max) continue
      }

      // Format settlement period
      const fromDate = new Date(batch.fromDate)
      const periodLabel = `${formatDate(fromDate)} - ${formatDate(toDate)}`

      rows.push({
        sellerId,
        sellerName: batchSeller?.businessName || batchSeller?.name || 'Unknown Seller',
        sellerGstin: batchSeller?.gstNumber || undefined,
        settlementPeriod: periodLabel,
        fromDate: fromDate.toISOString(),
        toDate: toDate.toISOString(),
        settlementAmount: amount,
        settlementCycle: cycleLabel,
        dueDate: dueDate.toISOString(),
        status: batch.status,
        batchId: (batch as any)._id.toString(),
      })
    }

    // Sort by due date (earliest first)
    rows.sort((a, b) => {
      const dateA = new Date(a.dueDate).getTime()
      const dateB = new Date(b.dueDate).getTime()
      return dateA - dateB
    })

    // Calculate ledger balances for all unique sellers in the report
    // This allows showing current ledger balance for each seller in each row
    const uniqueSellerIds = [...new Set(rows.map((row) => row.sellerId).filter(Boolean))]
    const sellerLedgerBalanceMap = new Map<string, number>()

    if (uniqueSellerIds.length > 0) {
      try {
        const SellerLedgerEntry = (await import('../models/SellerLedgerEntry')).default

        // Fetch all ledger entries for all sellers in the report in one query
        const allEntries = await SellerLedgerEntry.find({
          seller: { $in: uniqueSellerIds.map((id) => new mongoose.Types.ObjectId(id)) },
          reason: { $nin: ['PLATFORM_REFUND_EXPENSE', 'PLATFORM_ADJUSTMENT'] },
        })
          .sort({ createdAt: 1 })
          .lean()

        // Calculate running balance for each seller
        const sellerBalances = new Map<string, number>()
        for (const entry of allEntries) {
          const sellerIdStr = String(entry.seller)
          if (!sellerBalances.has(sellerIdStr)) {
            sellerBalances.set(sellerIdStr, 0)
          }

          const amount = Number(entry.amount) || 0
          const currentBalance = sellerBalances.get(sellerIdStr) || 0

          if (entry.entryType === 'CREDIT') {
            sellerBalances.set(sellerIdStr, currentBalance + amount)
          } else if (entry.entryType === 'DEBIT') {
            sellerBalances.set(sellerIdStr, currentBalance - amount)
          }
        }

        // Store balances in map for quick lookup
        sellerBalances.forEach((balance, sellerId) => {
          sellerLedgerBalanceMap.set(sellerId, balance)
        })
      } catch (ledgerError) {
        // If ledger fetch fails, continue without balances - don't fail the whole report
        console.error(
          'Error fetching seller ledger balances for settlement due report:',
          ledgerError,
        )
      }
    }

    // Add ledger balance to each row
    const rowsWithBalance = rows.map((row) => ({
      ...row,
      sellerLedgerBalance: sellerLedgerBalanceMap.get(row.sellerId),
    }))

    // Calculate totals - separate pending and settled amounts
    // totalAmountDue includes only PENDING settlements (amounts that need to be paid)
    // totalAmountSettled includes only PAID settlements (amounts already paid)
    // These are mutually exclusive - a settlement is either PENDING or PAID, never both
    // NOTE: These totals reflect stored settlement batch amounts, not current ledger balance.
    // If manual adjustments were made after batch creation, check seller ledger for actual balance.
    const totals = rowsWithBalance.reduce(
      (acc, row) => {
        const isPending = row.status === 'PENDING'
        const isPaid = row.status === 'PAID'
        return {
          totalAmountDue: acc.totalAmountDue + (isPending ? row.settlementAmount : 0),
          totalAmountSettled: acc.totalAmountSettled + (isPaid ? row.settlementAmount : 0),
          pendingCount: acc.pendingCount + (isPending ? 1 : 0),
          paidCount: acc.paidCount + (isPaid ? 1 : 0),
        }
      },
      {
        totalAmountDue: 0,
        totalAmountSettled: 0,
        pendingCount: 0,
        paidCount: 0,
      },
    )

    // If a specific seller is filtered, also include their balance in response for summary display
    let sellerLedgerBalance: number | null = null
    if (seller && mongoose.Types.ObjectId.isValid(seller)) {
      sellerLedgerBalance = sellerLedgerBalanceMap.get(seller) ?? null
    }

    const response: SettlementDueReportResponse = {
      success: true,
      data: {
        rows: rowsWithBalance,
        totals,
        filters: {
          seller,
          settlementCycle,
          dueDateFrom,
          dueDateTo,
          amountFrom,
          amountTo,
          status,
        },
        note: 'This report shows settlement batch amounts at creation time. If manual adjustments were made after batch creation, check the seller ledger for the current actual balance.',
        sellerLedgerBalance: sellerLedgerBalance !== null ? sellerLedgerBalance : undefined,
      },
    }

    res.json(response)
  } catch (error: any) {
    console.error('Error generating settlement due report:', error)
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate settlement due report',
    })
  }
}

interface CourierChargesReportParams {
  fromDate?: string
  toDate?: string
  seller?: string
  courierPartner?: string
  shipmentType?: 'Forward' | 'RTO' | 'Return'
  awb?: string
  orderId?: string
}

interface CourierChargesReportRow {
  orderId: string
  orderNumber: string
  awbNumber: string
  shipmentId: string
  sellerName: string
  sellerId: string
  courierPartner: string
  shipmentType: 'Forward' | 'RTO' | 'Return'
  orderValue: number
  totalShipmentCourierCharge: number
  allocatedCourierCharge: number
  codCharge: number
  shipmentDate: Date | null
  status: string
}

interface CourierChargesReportResponse {
  success: boolean
  data: {
    rows: CourierChargesReportRow[]
    totals: {
      totalAllocatedCourierCharges: number
      totalCodCharges: number
      forwardBreakdown: {
        count: number
        totalCharges: number
      }
      rtoBreakdown: {
        count: number
        totalCharges: number
      }
      returnBreakdown: {
        count: number
        totalCharges: number
      }
    }
    filters: CourierChargesReportParams
  }
  note: string
}

// Helper function to validate and convert to ObjectId array
const parseOrderIds = (
  orderId: string | string[] | undefined,
): mongoose.Types.ObjectId[] | null => {
  if (!orderId) return null

  const ids = Array.isArray(orderId) ? orderId : [orderId]
  const validIds: mongoose.Types.ObjectId[] = []

  for (const id of ids) {
    if (typeof id === 'string' && mongoose.Types.ObjectId.isValid(id)) {
      try {
        validIds.push(new mongoose.Types.ObjectId(id))
      } catch (error) {
        // Skip invalid ObjectId
        console.warn(`Invalid ObjectId: ${id}`)
      }
    }
  }

  return validIds.length > 0 ? validIds : null
}

export const getCourierChargesReport = async (req: Request, res: Response) => {
  try {
    const { fromDate, toDate, seller, courierPartner, shipmentType, awb, orderId } =
      req.query as CourierChargesReportParams

    // Default to last 30 days if no date range provided
    const now = new Date()
    const defaultToDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
    const defaultFromDate = new Date(defaultToDate)
    defaultFromDate.setDate(defaultFromDate.getDate() - 30)

    const from = fromDate ? new Date(fromDate) : defaultFromDate
    const to = toDate ? new Date(toDate) : defaultToDate

    // Set time boundaries
    from.setHours(0, 0, 0, 0)
    to.setHours(23, 59, 59, 999)

    const rows: CourierChargesReportRow[] = []

    // Parse order IDs once for reuse
    const orderIds = parseOrderIds(orderId)

    // Fetch all Shipment records upfront for efficient lookup
    const shipmentQuery: any = {
      'kourierBoyzLogistics.awb_number': { $exists: true, $ne: null },
      createdAt: { $gte: from, $lte: to },
    }
    if (seller) {
      if (mongoose.Types.ObjectId.isValid(seller)) {
        shipmentQuery.seller = new mongoose.Types.ObjectId(seller)
      } else {
        return res.status(400).json({
          success: false,
          message: 'Invalid seller ID format',
        })
      }
    }
    if (awb) {
      shipmentQuery['kourierBoyzLogistics.awb_number'] = awb
    }

    const shipmentRecords = await Shipment.find(shipmentQuery).lean()
    const shipmentMap = new Map<string, any>()
    for (const shipment of shipmentRecords) {
      const awbNum = shipment.kourierBoyzLogistics?.awb_number
      if (awbNum) {
        shipmentMap.set(awbNum, shipment)
      }
    }

    // ============================================
    // FORWARD SHIPMENTS (from Order.sellerShipments)
    // ============================================
    if (!shipmentType || shipmentType === 'Forward' || shipmentType === 'RTO') {
      // Build query for orders with shipments
      const orderQuery: any = {
        $and: [
          {
            $or: [
              { 'sellerShipments.shippingMeta.awb': { $exists: true, $ne: null } },
              { 'sellerShipments.kourierBoyzLogistics.awb_number': { $exists: true, $ne: null } },
            ],
          },
          {
            $or: [
              { 'sellerShipments.shippedAt': { $gte: from, $lte: to } },
              { 'sellerShipments.createdAt': { $gte: from, $lte: to } },
              { createdAt: { $gte: from, $lte: to } },
            ],
          },
        ],
      }

      if (seller) {
        if (mongoose.Types.ObjectId.isValid(seller)) {
          orderQuery['sellerShipments.seller'] = new mongoose.Types.ObjectId(seller)
        } else {
          return res.status(400).json({
            success: false,
            message: 'Invalid seller ID format',
          })
        }
      }

      // Handle order ID filter (single or multiple) - orderIds already parsed above
      if (orderIds) {
        if (orderIds.length === 1) {
          orderQuery._id = orderIds[0]
        } else {
          orderQuery._id = { $in: orderIds }
        }
      }

      if (awb) {
        orderQuery.$and[0].$or = [
          { 'sellerShipments.shippingMeta.awb': awb },
          { 'sellerShipments.kourierBoyzLogistics.awb_number': awb },
        ]
      }

      const orders = await Order.find(orderQuery)
        .populate('sellerShipments.seller', 'name businessName')
        .lean()

      // Group shipments by AWB to handle multi-order shipments
      const awbGroups = new Map<string, Array<{ order: any; shipment: any }>>()

      for (const order of orders) {
        for (const shipment of order.sellerShipments || []) {
          const awbNumber = shipment.shippingMeta?.awb || shipment.kourierBoyzLogistics?.awb_number

          if (!awbNumber) continue

          // Filter by courier partner if specified
          const courier =
            shipment.shippingMeta?.courier || shipment.kourierBoyzLogistics?.courier_id?.toString()
          if (courierPartner && courier !== courierPartner) continue

          const key = awbNumber
          if (!awbGroups.has(key)) {
            awbGroups.set(key, [])
          }
          awbGroups.get(key)!.push({ order, shipment })
        }
      }

      // Process each AWB group
      for (const [awbNumber, group] of awbGroups.entries()) {
        const firstShipment = group[0].shipment

        // Get total shipment charge from Shipment model if available (source of truth)
        // Otherwise fall back to first shipment's rate/charges
        const shipmentRecord = shipmentMap.get(awbNumber)
        const totalShipmentCharge =
          shipmentRecord?.kourierBoyzLogistics?.rate ||
          firstShipment.kourierBoyzLogistics?.rate ||
          firstShipment.shippingMeta?.charges ||
          0

        // Determine if RTO (cancelled or not delivered)
        const isRTO =
          firstShipment.status === 'cancelled' ||
          (firstShipment.status !== 'delivered' &&
            firstShipment.deliveredAt === null &&
            firstShipment.shippedAt &&
            new Date(firstShipment.shippedAt) < new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) // 7 days old and not delivered

        if (shipmentType === 'Forward' && isRTO) continue
        if (shipmentType === 'RTO' && !isRTO) continue

        // Calculate total order value for proportional allocation
        let totalOrderValue = 0
        for (const { order } of group) {
          totalOrderValue += order.subtotal || 0
        }

        // Calculate allocated charges for all orders in this group
        const allocatedCharges = new Map<string, number>()

        // First pass: calculate proportional allocation
        if (totalOrderValue > 0) {
          let allocatedTotal = 0
          let largestOrderIndex = 0
          let largestOrderValue = 0

          for (let i = 0; i < group.length; i++) {
            const { order, shipment } = group[i]
            const orderValue = order.subtotal || 0

            // Get stored allocated charge if available
            let allocatedCharge = shipment.courierCharge || 0

            // If not stored, calculate proportionally
            if (!allocatedCharge) {
              allocatedCharge = Math.round((orderValue / totalOrderValue) * totalShipmentCharge)
            }

            allocatedCharges.set(shipment._id?.toString() || i.toString(), allocatedCharge)
            allocatedTotal += allocatedCharge

            // Track largest order for rounding adjustment
            if (orderValue > largestOrderValue) {
              largestOrderValue = orderValue
              largestOrderIndex = i
            }
          }

          // Handle rounding errors: ensure total equals totalShipmentCharge
          const roundingDiff = totalShipmentCharge - allocatedTotal
          if (roundingDiff !== 0 && group.length > 0) {
            const largestShipmentId =
              group[largestOrderIndex].shipment._id?.toString() || largestOrderIndex.toString()
            const currentAllocation = allocatedCharges.get(largestShipmentId) || 0
            allocatedCharges.set(largestShipmentId, currentAllocation + roundingDiff)
          }
        } else if (group.length > 0) {
          // Equal split if no order values available
          const equalShare = Math.round(totalShipmentCharge / group.length)
          const remainder = totalShipmentCharge - equalShare * group.length

          for (let i = 0; i < group.length; i++) {
            const shipmentId = group[i].shipment._id?.toString() || i.toString()
            allocatedCharges.set(shipmentId, equalShare + (i === 0 ? remainder : 0))
          }
        }

        // Create row for each order in this AWB
        for (const { order, shipment } of group) {
          const orderValue = order.subtotal || 0

          // Get allocated charge from map or fallback
          const shipmentId = shipment._id?.toString() || 'unknown'
          let allocatedCharge: number = allocatedCharges.get(shipmentId) ?? 0

          // If not in map, try stored courierCharge
          if (allocatedCharge === 0) {
            if (shipment.courierCharge !== null && shipment.courierCharge !== undefined) {
              allocatedCharge = shipment.courierCharge
            } else if (group.length === 1) {
              // Single order in shipment - use full charge
              allocatedCharge = totalShipmentCharge
            }
            // If still 0 and multi-order shipment, it means this order wasn't part of the allocation
          }

          // Get COD charge (order-specific, not shared)
          // COD charge is only applicable for COD orders
          let codCharge = 0
          if (order.paymentMethod === 'cod') {
            // First try shipment-level codCharge (AWB-wise)
            if (shipment.codCharge !== null && shipment.codCharge !== undefined) {
              codCharge = shipment.codCharge
            } else if (order.sellerCodFee !== null && order.sellerCodFee !== undefined) {
              // Fallback to order-level sellerCodFee
              codCharge = order.sellerCodFee
            } else {
              // Calculate COD charge if not stored (2% of order value)
              codCharge = Math.round(orderValue * 0.02)
            }
          }

          const seller = (shipment.seller as any) || {}
          const sellerName = seller.businessName || seller.name || 'Unknown'

          rows.push({
            orderId: order._id.toString(),
            orderNumber: order.orderNumber || `ORD-${order._id.toString().slice(-8)}`,
            awbNumber,
            shipmentId: shipment._id?.toString() || 'N/A',
            sellerName,
            sellerId: shipment.seller?.toString() || 'N/A',
            courierPartner:
              shipment.shippingMeta?.courier ||
              shipment.kourierBoyzLogistics?.courier_id?.toString() ||
              'Unknown',
            shipmentType: isRTO ? 'RTO' : 'Forward',
            orderValue,
            totalShipmentCourierCharge: totalShipmentCharge,
            allocatedCourierCharge: allocatedCharge,
            codCharge,
            shipmentDate: shipment.shippedAt || shipment.createdAt || null,
            status: shipment.status || 'unknown',
          })
        }
      }
    }

    // ============================================
    // RETURN SHIPMENTS (from Return model)
    // ============================================
    if (!shipmentType || shipmentType === 'Return') {
      const returnQuery: any = {
        courierReverseAwb: { $exists: true, $ne: null },
        createdAt: { $gte: from, $lte: to },
      }

      if (seller) {
        if (mongoose.Types.ObjectId.isValid(seller)) {
          returnQuery.seller = new mongoose.Types.ObjectId(seller)
        } else {
          return res.status(400).json({
            success: false,
            message: 'Invalid seller ID format',
          })
        }
      }

      if (awb) {
        returnQuery.courierReverseAwb = awb
      }

      // Handle order ID filter for returns (single or multiple)
      if (orderIds) {
        if (orderIds.length === 1) {
          returnQuery.order = orderIds[0]
        } else {
          returnQuery.order = { $in: orderIds }
        }
      }

      const returns = await Return.find(returnQuery)
        .populate('order', 'orderNumber subtotal')
        .populate('seller', 'name businessName')
        .lean()

      for (const returnRecord of returns) {
        // Order ID filtering is already handled in the query above

        const order = returnRecord.order as any
        const seller = returnRecord.seller as any
        const sellerName = seller?.businessName || seller?.name || 'Unknown'

        const reverseCharge = returnRecord.reverseCharges || 0
        const reverseCodFee = returnRecord.reverseCodFee || 0

        // Filter by courier partner if specified
        const courier = returnRecord.courierPartner
        if (courierPartner && courier !== courierPartner) continue

        rows.push({
          orderId: order?._id?.toString() || 'N/A',
          orderNumber: order?.orderNumber || 'N/A',
          awbNumber: returnRecord.courierReverseAwb || 'N/A',
          shipmentId: returnRecord._id.toString(),
          sellerName,
          sellerId: returnRecord.seller?.toString() || 'N/A',
          courierPartner: courier || 'Unknown',
          shipmentType: 'Return',
          orderValue: order?.subtotal || 0,
          totalShipmentCourierCharge: reverseCharge, // For returns, this is the actual charge
          allocatedCourierCharge: reverseCharge, // Returns are always single order per AWB
          codCharge: reverseCodFee,
          shipmentDate: returnRecord.createdAt || null,
          status: returnRecord.status || 'unknown',
        })
      }
    }

    // Sort rows by shipment date (newest first), then by order number
    rows.sort((a, b) => {
      const dateA = a.shipmentDate ? new Date(a.shipmentDate).getTime() : 0
      const dateB = b.shipmentDate ? new Date(b.shipmentDate).getTime() : 0
      if (dateB !== dateA) {
        return dateB - dateA // Newest first
      }
      return a.orderNumber.localeCompare(b.orderNumber)
    })

    // Calculate totals
    const totals = {
      totalAllocatedCourierCharges: rows.reduce((sum, row) => sum + row.allocatedCourierCharge, 0),
      totalCodCharges: rows.reduce((sum, row) => sum + row.codCharge, 0),
      forwardBreakdown: {
        count: rows.filter((r) => r.shipmentType === 'Forward').length,
        totalCharges: rows
          .filter((r) => r.shipmentType === 'Forward')
          .reduce((sum, row) => sum + row.allocatedCourierCharge, 0),
      },
      rtoBreakdown: {
        count: rows.filter((r) => r.shipmentType === 'RTO').length,
        totalCharges: rows
          .filter((r) => r.shipmentType === 'RTO')
          .reduce((sum, row) => sum + row.allocatedCourierCharge, 0),
      },
      returnBreakdown: {
        count: rows.filter((r) => r.shipmentType === 'Return').length,
        totalCharges: rows
          .filter((r) => r.shipmentType === 'Return')
          .reduce((sum, row) => sum + row.allocatedCourierCharge, 0),
      },
    }

    const response: CourierChargesReportResponse = {
      success: true,
      data: {
        rows,
        totals,
        filters: {
          fromDate: from.toISOString(),
          toDate: to.toISOString(),
          seller,
          courierPartner,
          shipmentType,
          awb,
          orderId,
        },
      },
      note: 'Courier charges are allocated proportionally when multiple orders share one shipment (AWB). This prevents double counting and matches actual carrier billing.',
    }

    res.json(response)
  } catch (error: any) {
    console.error('Error generating courier charges report:', error)
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate courier charges report',
    })
  }
}

interface PortalIncomeReportParams {
  fromDate?: string
  toDate?: string
  seller?: string
  incomeType?: string
  settlementStatus?: 'PAID' | 'PENDING' | 'ALL'
  orderId?: string
}

interface PortalIncomeSummaryRow {
  date: string
  incomeType: string
  grossIncome: number
  gstOnIncome: number
  netPortalIncome: number
  orderDetails?: PortalIncomeOrderDetail[]
}

interface PortalIncomeOrderDetail {
  orderId: string
  sellerName: string
  incomeType: string
  baseAmount: number
  gstAmount: number
  netAmount: number
  settlementBatchId?: string
}

interface PortalIncomeReportResponse {
  success: boolean
  data: {
    summary: PortalIncomeSummaryRow[]
    totals: {
      totalGrossIncome: number
      totalGstOnIncome: number
      totalNetPortalIncome: number
    }
    filters: PortalIncomeReportParams
  }
}

// Platform income reasons - these represent revenue that belongs to the platform
// All DEBIT entries with these reasons = money charged to sellers = platform income
const PLATFORM_INCOME_REASONS = [
  'COMMISSION_DEBIT', // Commission (both PERCENTAGE and FIXED types)
  'COMMISSION', // Legacy commission reason
  'PAYMENT_GATEWAY_FEE', // Payment gateway fees (prepaid orders)
  'PG_FEE', // Legacy PG fee reason
  'COD_FEE_DEBIT', // COD convenience fees (charged to sellers for COD orders)
  'PLATFORM_ADJUSTMENT', // Platform adjustments (positive = income)
  'MANUAL_ADJUSTMENT', // Manual adjustments (DEBIT = platform income)
] as const

// Map ledger reason to income type label
const getIncomeTypeLabel = (reason: string): string => {
  const reasonMap: Record<string, string> = {
    COMMISSION_DEBIT: 'Commission',
    COMMISSION: 'Commission', // Legacy
    PAYMENT_GATEWAY_FEE: 'Payment Gateway Fee',
    PG_FEE: 'Payment Gateway Fee', // Legacy
    COD_FEE_DEBIT: 'COD Fee',
    PLATFORM_ADJUSTMENT: 'Platform Adjustment',
    MANUAL_ADJUSTMENT: 'Manual Adjustment',
    // Settlement-related reasons (not platform income, but included for completeness)
    SETTLEMENT_CARRY_FORWARD: 'Settlement Carry Forward',
    SETTLEMENT_PAYMENT: 'Settlement Payment',
    SETTLEMENT_PAYOUT: 'Settlement Payout', // Payout to seller (not platform income)
    TDS_DEBIT: 'TDS Deduction',
    TDS_REVERSAL: 'TDS Reversal',
    TCS_DEBIT: 'TCS Deduction',
    TCS_REVERSAL: 'TCS Reversal',
  }
  return reasonMap[reason] || reason
}

export const getPortalIncomeReport = async (req: Request, res: Response) => {
  try {
    const { fromDate, toDate, seller, incomeType, settlementStatus, orderId } =
      req.query as PortalIncomeReportParams

    // Default to last 30 days if no date range provided
    const now = new Date()
    const defaultToDate = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
      999,
    )
    const defaultFromDate = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - 30,
      0,
      0,
      0,
      0,
    )

    const from = fromDate ? new Date(fromDate) : defaultFromDate
    const to = toDate ? new Date(toDate) : defaultToDate

    // Build query for ledger entries
    // Portal income = DEBIT entries with platform income reasons
    const ledgerQuery: any = {
      entryType: 'DEBIT',
      reason: { $in: [...PLATFORM_INCOME_REASONS] },
      createdAt: { $gte: from, $lte: to },
    }

    // Filter by seller if provided
    if (seller) {
      ledgerQuery.seller = new mongoose.Types.ObjectId(seller)
    }

    // Filter by income type (map label back to reason)
    if (incomeType) {
      const reasonMap: Record<string, string[]> = {
        Commission: ['COMMISSION_DEBIT', 'COMMISSION'], // Includes both PERCENTAGE and FIXED commission types
        'Payment Gateway Fee': ['PAYMENT_GATEWAY_FEE', 'PG_FEE'],
        'COD Fee': ['COD_FEE_DEBIT'],
        'Platform Adjustment': ['PLATFORM_ADJUSTMENT'],
        'Manual Adjustment': ['MANUAL_ADJUSTMENT'],
      }
      const reasons = reasonMap[incomeType]
      if (reasons) {
        ledgerQuery.reason = { $in: reasons }
      }
    }

    // Filter by order ID if provided
    if (orderId) {
      if (mongoose.Types.ObjectId.isValid(orderId)) {
        ledgerQuery.order = new mongoose.Types.ObjectId(orderId)
      } else {
        return res.status(400).json({
          success: false,
          message: 'Invalid order ID format',
        })
      }
    }

    // Fetch ledger entries with populated data
    const ledgerEntries = await SellerLedgerEntry.find(ledgerQuery)
      .populate('seller', 'name businessName')
      .populate('order', 'orderNumber')
      .populate('settlementBatch', 'status')
      .sort({ createdAt: 1 })
      .lean()

    // Filter by settlement status if provided
    let filteredEntries = ledgerEntries
    if (settlementStatus === 'PAID') {
      // Only show entries with PAID settlement batches
      filteredEntries = filteredEntries.filter((entry: any) => {
        const batch = entry.settlementBatch
        // Entry must have a settlement batch with status 'PAID'
        if (!batch) return false
        if (typeof batch === 'object' && batch.status === 'PAID') return true
        // Handle case where batch is just an ObjectId (shouldn't happen after populate, but safe check)
        return false
      })
    } else if (settlementStatus === 'PENDING') {
      // Only show entries with PENDING settlement batches
      filteredEntries = filteredEntries.filter((entry: any) => {
        const batch = entry.settlementBatch
        // Entry must have a settlement batch with status 'PENDING'
        if (!batch) return false
        if (typeof batch === 'object' && batch.status === 'PENDING') return true
        return false
      })
    }
    // If settlementStatus is 'ALL' or undefined, show all entries
    // This includes:
    // - Entries with PAID settlement batches
    // - Entries with PENDING settlement batches
    // - Entries without settlement batches (not yet settled)

    // Group by date and income type for summary
    const summaryMap = new Map<string, PortalIncomeSummaryRow>()
    const orderDetailsMap = new Map<string, PortalIncomeOrderDetail[]>()

    for (const entry of filteredEntries) {
      const entryDate = new Date(entry.createdAt)
      const dateKey = formatDate(entryDate)
      const incomeTypeLabel = getIncomeTypeLabel(entry.reason)
      const summaryKey = `${dateKey}_${incomeTypeLabel}`

      // Base amount (absolute value)
      const baseAmount = Math.abs(entry.amount || 0)
      // GST amount (currently not stored in ledger, set to 0)
      // TODO: Add GST tracking to ledger entries if needed
      const gstAmount = 0
      const netAmount = baseAmount + gstAmount

      // Update summary
      if (!summaryMap.has(summaryKey)) {
        summaryMap.set(summaryKey, {
          date: dateKey,
          incomeType: incomeTypeLabel,
          grossIncome: 0,
          gstOnIncome: 0,
          netPortalIncome: 0,
          orderDetails: [],
        })
      }

      const summary = summaryMap.get(summaryKey)!
      summary.grossIncome += baseAmount
      summary.gstOnIncome += gstAmount
      summary.netPortalIncome += netAmount

      // Add order detail
      const sellerObj = entry.seller as any
      const sellerName =
        sellerObj && typeof sellerObj === 'object'
          ? sellerObj.businessName || sellerObj.name || 'Unknown Seller'
          : 'Unknown Seller'

      const orderDetail: PortalIncomeOrderDetail = {
        orderId: entry.order
          ? typeof entry.order === 'object' && (entry.order as any)._id
            ? (entry.order as any)._id.toString()
            : entry.order.toString()
          : 'N/A',
        sellerName,
        incomeType: incomeTypeLabel,
        baseAmount,
        gstAmount,
        netAmount,
        settlementBatchId: entry.settlementBatch
          ? typeof entry.settlementBatch === 'object' && entry.settlementBatch._id
            ? entry.settlementBatch._id.toString()
            : entry.settlementBatch.toString()
          : undefined,
      }

      if (!orderDetailsMap.has(summaryKey)) {
        orderDetailsMap.set(summaryKey, [])
      }
      orderDetailsMap.get(summaryKey)!.push(orderDetail)
    }

    // Attach order details to summary rows
    const summaryRows: PortalIncomeSummaryRow[] = Array.from(summaryMap.values()).map((row) => {
      const key = `${row.date}_${row.incomeType}`
      return {
        ...row,
        orderDetails: orderDetailsMap.get(key) || [],
      }
    })

    // Sort by date, then by income type
    summaryRows.sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date)
      if (dateCompare !== 0) return dateCompare
      return a.incomeType.localeCompare(b.incomeType)
    })

    // Calculate totals
    const totals = summaryRows.reduce(
      (acc, row) => ({
        totalGrossIncome: acc.totalGrossIncome + row.grossIncome,
        totalGstOnIncome: acc.totalGstOnIncome + row.gstOnIncome,
        totalNetPortalIncome: acc.totalNetPortalIncome + row.netPortalIncome,
      }),
      {
        totalGrossIncome: 0,
        totalGstOnIncome: 0,
        totalNetPortalIncome: 0,
      },
    )

    const response: PortalIncomeReportResponse = {
      success: true,
      data: {
        summary: summaryRows,
        totals,
        filters: {
          fromDate: from.toISOString(),
          toDate: to.toISOString(),
          seller,
          incomeType,
          settlementStatus,
          orderId,
        },
      },
    }

    res.json(response)
  } catch (error: any) {
    console.error('Error generating portal income report:', error)
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate portal income report',
    })
  }
}

// TDS Report (Section 194-O)
interface TdsReportParams {
  financialYear?: string // Format: "2023-24"
  seller?: string
  settlementStatus?: 'ALL' | 'PAID' | 'PENDING'
}

interface TdsReportRow {
  sellerId: string
  sellerTradeName: string
  sellerGstin: string
  sellerPan: string
  sellerType: 'Individual' | 'HUF' | 'Other'
  financialYear: string
  grossSalesInclGst: number
  tdsRate: number
  tdsDeducted: number
  tdsDeductionStatus: 'Not Applicable' | 'Applicable' | 'Threshold Crossed'
  lastSettlementDate: string
}

interface TdsReportResponse {
  success: boolean
  data: {
    rows: TdsReportRow[]
    totals: {
      totalSales: number
      totalTds: number
      sellerCount: number
      settlementCount: number
    }
    filters: TdsReportParams
  }
}

export const getTdsReport = async (req: Request, res: Response) => {
  try {
    const { financialYear, seller, settlementStatus = 'PAID' } = req.query as TdsReportParams

    // Build query for PAID settlement batches only
    const batchQuery: any = {
      status: settlementStatus === 'ALL' ? { $in: ['PAID', 'PENDING'] } : 'PAID',
    }

    if (seller) {
      batchQuery.seller = new mongoose.Types.ObjectId(seller)
    }

    // Get all PAID settlement batches
    const batches = await SellerSettlementBatch.find(batchQuery)
      .populate('seller', 'businessName gstNumber panNumber businessType state')
      .lean()

    // Group by seller and financial year
    const sellerFyMap = new Map<string, TdsReportRow>()

    for (const batch of batches) {
      const sellerData = batch.seller as any
      if (!sellerData) continue

      const sellerId = String(batch.seller)
      const payoutDate = batch.payoutDate || batch.toDate

      // Determine financial year from payout date
      const fyYear =
        payoutDate.getMonth() >= 3 ? payoutDate.getFullYear() : payoutDate.getFullYear() - 1
      const fyEnd = fyYear + 1
      const fyString = `${fyYear}-${String(fyEnd).slice(-2)}`

      // Filter by financial year if specified
      if (financialYear && fyString !== financialYear) {
        continue
      }

      const key = `${sellerId}-${fyString}`
      const existing = sellerFyMap.get(key)

      // Determine seller type
      let sellerType: 'Individual' | 'HUF' | 'Other' = 'Other'
      if (sellerData.panNumber && sellerData.panNumber.length >= 4) {
        const fourthChar = sellerData.panNumber.charAt(3).toUpperCase()
        if (fourthChar === 'P') sellerType = 'Individual'
        else if (fourthChar === 'H') sellerType = 'HUF'
      }

      // Get gross sales including GST (from tdsBaseAmount or totalSaleAmount)
      const grossSales = batch.tdsBaseAmount || batch.totalSaleAmount || 0
      const tdsAmount = batch.totalTdsAmount || 0
      const tdsRate = batch.tdsRate || 0

      // Net off TDS reversals linked to this batch
      // Reversals are created when returns happen and linked to the NEXT settlement batch
      const tdsReversals = await SellerLedgerEntry.find({
        seller: batch.seller,
        settlementBatch: batch._id,
        reason: 'TDS_REVERSAL',
      }).lean()

      let netTdsAmount = tdsAmount
      let netGrossSales = grossSales
      for (const reversal of tdsReversals) {
        netTdsAmount -= reversal.amount || 0
        // Estimate reversed order total: TDS reversal = order.total * 0.1%, so order.total = reversal / 0.001
        const reversedOrderTotal = (reversal.amount || 0) / 0.001
        netGrossSales -= reversedOrderTotal
      }

      // Determine TDS deduction status
      let tdsDeductionStatus: 'Not Applicable' | 'Applicable' | 'Threshold Crossed' =
        'Not Applicable'
      if (batch.tdsExempted) {
        tdsDeductionStatus = 'Not Applicable'
      } else if (netTdsAmount > 0) {
        tdsDeductionStatus = 'Applicable'
      } else {
        tdsDeductionStatus = 'Not Applicable'
      }

      if (existing) {
        existing.grossSalesInclGst += netGrossSales
        existing.tdsDeducted += netTdsAmount
        if (payoutDate > new Date(existing.lastSettlementDate)) {
          existing.lastSettlementDate = payoutDate.toISOString()
        }
      } else {
        sellerFyMap.set(key, {
          sellerId,
          sellerTradeName: sellerData.businessName || sellerData.name || 'N/A',
          sellerGstin: sellerData.gstNumber || 'N/A',
          sellerPan: sellerData.panNumber || 'N/A',
          sellerType,
          financialYear: fyString,
          grossSalesInclGst: netGrossSales,
          tdsRate,
          tdsDeducted: netTdsAmount,
          tdsDeductionStatus,
          lastSettlementDate: payoutDate.toISOString(),
        })
      }
    }

    const rows = Array.from(sellerFyMap.values()).filter(
      (row) => row.grossSalesInclGst > 0 || row.tdsDeducted > 0,
    ) // Only show rows with data

    // Calculate totals
    const totals = rows.reduce(
      (acc, row) => {
        acc.totalSales += row.grossSalesInclGst
        acc.totalTds += row.tdsDeducted
        if (!acc.sellerIds.includes(row.sellerId)) {
          acc.sellerIds.push(row.sellerId)
        }
        acc.settlementCount += 1
        return acc
      },
      {
        totalSales: 0,
        totalTds: 0,
        sellerIds: [] as string[],
        settlementCount: 0,
      },
    )

    const response: TdsReportResponse = {
      success: true,
      data: {
        rows,
        totals: {
          totalSales: totals.totalSales,
          totalTds: totals.totalTds,
          sellerCount: totals.sellerIds.length,
          settlementCount: batches.length,
        },
        filters: {
          financialYear,
          seller,
          settlementStatus,
        },
      },
    }

    res.json(response)
  } catch (error: any) {
    console.error('Error generating TDS report:', error)
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate TDS report',
    })
  }
}

// TCS Report (GST Section 52)
interface TcsReportParams {
  financialYear?: string
  seller?: string
  sellerState?: string
  customerType?: 'Registered' | 'Unregistered' | 'ALL'
  settlementStatus?: 'ALL' | 'PAID' | 'PENDING'
}

interface TcsReportRow {
  sellerId: string
  sellerTradeName: string
  sellerGstin: string
  sellerState: string
  customerType: 'Registered' | 'Unregistered'
  supplyType: 'Inter-State' | 'Intra-State'
  taxableSalesValue: number
  tcsRate: number
  igstTcsAmount: number
  cgstTcsAmount: number
  sgstTcsAmount: number
  totalTcsAmount: number
  financialYear: string
  lastSettlementDate: string
}

interface TcsReportResponse {
  success: boolean
  data: {
    rows: TcsReportRow[]
    totals: {
      totalSales: number
      totalTcs: number
      sellerCount: number
      settlementCount: number
    }
    filters: TcsReportParams
  }
}

export const getTcsReport = async (req: Request, res: Response) => {
  try {
    const {
      financialYear,
      seller,
      sellerState,
      customerType = 'ALL',
      settlementStatus = 'PAID',
    } = req.query as TcsReportParams

    // Build query for PAID settlement batches only
    const batchQuery: any = {
      status: settlementStatus === 'ALL' ? { $in: ['PAID', 'PENDING'] } : 'PAID',
    }

    if (seller) {
      batchQuery.seller = new mongoose.Types.ObjectId(seller)
    }

    // Get all PAID settlement batches with seller info
    const batches = await SellerSettlementBatch.find(batchQuery)
      .populate('seller', 'businessName gstNumber state')
      .lean()

    // Get orders for these batches to determine customer type and supply type breakdown
    const batchIds = batches.map((b) => b._id)
    const orders = await Order.find({
      settlementBatch: { $in: batchIds },
    })
      .populate('user', 'gstNumber state')
      .select('settlementBatch items subtotal shippingAddress')
      .lean()

    // Group orders by batch
    const ordersByBatch = new Map<string, any[]>()
    for (const order of orders) {
      const batchId = String(order.settlementBatch)
      const list = ordersByBatch.get(batchId) || []
      list.push(order)
      ordersByBatch.set(batchId, list)
    }

    // Group by seller × state × customer type
    const sellerStateCustomerMap = new Map<string, TcsReportRow>()

    for (const batch of batches) {
      const sellerData = batch.seller as any
      if (!sellerData) continue

      const sellerId = String(batch.seller)
      const sellerStateValue = sellerData.state || 'N/A'

      // Filter by seller state if specified
      if (sellerState && sellerStateValue !== sellerState) {
        continue
      }

      const payoutDate = batch.payoutDate || batch.toDate
      const fyYear =
        payoutDate.getMonth() >= 3 ? payoutDate.getFullYear() : payoutDate.getFullYear() - 1
      const fyEnd = fyYear + 1
      const fyString = `${fyYear}-${String(fyEnd).slice(-2)}`

      // Filter by financial year if specified
      if (financialYear && fyString !== financialYear) {
        continue
      }

      // Get orders for this batch
      const batchOrders = ordersByBatch.get(String(batch._id)) || []

      // Process TCS breakdown from settlement batch
      const tcsBreakdown = batch.tcsBreakdown || {
        interState: { salesAmount: 0, tcsAmount: 0 },
        intraState: {
          salesAmount: 0,
          tcsCgstAmount: 0,
          tcsSgstAmount: 0,
          tcsAmount: 0,
        },
        registeredCustomers: { salesAmount: 0, tcsAmount: 0 },
        unregisteredCustomers: { salesAmount: 0, tcsAmount: 0 },
      }

      // Calculate registered vs unregistered breakdown from orders
      let registeredSales = 0
      let unregisteredSales = 0
      let registeredInterStateSales = 0
      let registeredIntraStateSales = 0
      let unregisteredInterStateSales = 0
      let unregisteredIntraStateSales = 0

      for (const order of batchOrders) {
        const customer = order.user as any
        const isCustomerRegistered = !!(customer?.gstNumber && customer.gstNumber.trim())
        const customerState = order.shippingAddress?.state || customer?.state || ''
        const isInterState =
          sellerStateValue?.toLowerCase().trim() !== customerState?.toLowerCase().trim()
        const orderTaxableValue = order.subtotal || 0

        if (isCustomerRegistered) {
          registeredSales += orderTaxableValue
          if (isInterState) {
            registeredInterStateSales += orderTaxableValue
          } else {
            registeredIntraStateSales += orderTaxableValue
          }
        } else {
          unregisteredSales += orderTaxableValue
          if (isInterState) {
            unregisteredInterStateSales += orderTaxableValue
          } else {
            unregisteredIntraStateSales += orderTaxableValue
          }
        }
      }

      // Create rows for Registered customers
      if (customerType === 'ALL' || customerType === 'Registered') {
        // Inter-state registered
        if (registeredInterStateSales > 0) {
          const key = `${sellerId}-${sellerStateValue}-Registered-Inter-State`
          const tcsAmount = (registeredInterStateSales * 1.0) / 100 // IGST 1%
          const existing = sellerStateCustomerMap.get(key)
          if (existing) {
            existing.taxableSalesValue += registeredInterStateSales
            existing.igstTcsAmount += tcsAmount
            existing.totalTcsAmount += tcsAmount
            if (payoutDate > new Date(existing.lastSettlementDate)) {
              existing.lastSettlementDate = payoutDate.toISOString()
            }
          } else {
            sellerStateCustomerMap.set(key, {
              sellerId,
              sellerTradeName: sellerData.businessName || sellerData.name || 'N/A',
              sellerGstin: sellerData.gstNumber || 'N/A',
              sellerState: sellerStateValue,
              customerType: 'Registered',
              supplyType: 'Inter-State',
              taxableSalesValue: registeredInterStateSales,
              tcsRate: 1.0, // IGST
              igstTcsAmount: tcsAmount,
              cgstTcsAmount: 0,
              sgstTcsAmount: 0,
              totalTcsAmount: tcsAmount,
              financialYear: fyString,
              lastSettlementDate: payoutDate.toISOString(),
            })
          }
        }

        // Intra-state registered
        if (registeredIntraStateSales > 0) {
          const key = `${sellerId}-${sellerStateValue}-Registered-Intra-State`
          const cgstAmount = (registeredIntraStateSales * 0.5) / 100
          const sgstAmount = (registeredIntraStateSales * 0.5) / 100
          const totalTcs = cgstAmount + sgstAmount
          const existing = sellerStateCustomerMap.get(key)
          if (existing) {
            existing.taxableSalesValue += registeredIntraStateSales
            existing.cgstTcsAmount += cgstAmount
            existing.sgstTcsAmount += sgstAmount
            existing.totalTcsAmount += totalTcs
            if (payoutDate > new Date(existing.lastSettlementDate)) {
              existing.lastSettlementDate = payoutDate.toISOString()
            }
          } else {
            sellerStateCustomerMap.set(key, {
              sellerId,
              sellerTradeName: sellerData.businessName || sellerData.name || 'N/A',
              sellerGstin: sellerData.gstNumber || 'N/A',
              sellerState: sellerStateValue,
              customerType: 'Registered',
              supplyType: 'Intra-State',
              taxableSalesValue: registeredIntraStateSales,
              tcsRate: 1.0, // CGST + SGST
              igstTcsAmount: 0,
              cgstTcsAmount: cgstAmount,
              sgstTcsAmount: sgstAmount,
              totalTcsAmount: totalTcs,
              financialYear: fyString,
              lastSettlementDate: payoutDate.toISOString(),
            })
          }
        }
      }

      // Create rows for Unregistered customers
      if (customerType === 'ALL' || customerType === 'Unregistered') {
        // Inter-state unregistered
        if (unregisteredInterStateSales > 0) {
          const key = `${sellerId}-${sellerStateValue}-Unregistered-Inter-State`
          const tcsAmount = (unregisteredInterStateSales * 1.0) / 100 // IGST 1%
          const existing = sellerStateCustomerMap.get(key)
          if (existing) {
            existing.taxableSalesValue += unregisteredInterStateSales
            existing.igstTcsAmount += tcsAmount
            existing.totalTcsAmount += tcsAmount
            if (payoutDate > new Date(existing.lastSettlementDate)) {
              existing.lastSettlementDate = payoutDate.toISOString()
            }
          } else {
            sellerStateCustomerMap.set(key, {
              sellerId,
              sellerTradeName: sellerData.businessName || sellerData.name || 'N/A',
              sellerGstin: sellerData.gstNumber || 'N/A',
              sellerState: sellerStateValue,
              customerType: 'Unregistered',
              supplyType: 'Inter-State',
              taxableSalesValue: unregisteredInterStateSales,
              tcsRate: 1.0, // IGST
              igstTcsAmount: tcsAmount,
              cgstTcsAmount: 0,
              sgstTcsAmount: 0,
              totalTcsAmount: tcsAmount,
              financialYear: fyString,
              lastSettlementDate: payoutDate.toISOString(),
            })
          }
        }

        // Intra-state unregistered
        if (unregisteredIntraStateSales > 0) {
          const key = `${sellerId}-${sellerStateValue}-Unregistered-Intra-State`
          const cgstAmount = (unregisteredIntraStateSales * 0.5) / 100
          const sgstAmount = (unregisteredIntraStateSales * 0.5) / 100
          const totalTcs = cgstAmount + sgstAmount
          const existing = sellerStateCustomerMap.get(key)
          if (existing) {
            existing.taxableSalesValue += unregisteredIntraStateSales
            existing.cgstTcsAmount += cgstAmount
            existing.sgstTcsAmount += sgstAmount
            existing.totalTcsAmount += totalTcs
            if (payoutDate > new Date(existing.lastSettlementDate)) {
              existing.lastSettlementDate = payoutDate.toISOString()
            }
          } else {
            sellerStateCustomerMap.set(key, {
              sellerId,
              sellerTradeName: sellerData.businessName || sellerData.name || 'N/A',
              sellerGstin: sellerData.gstNumber || 'N/A',
              sellerState: sellerStateValue,
              customerType: 'Unregistered',
              supplyType: 'Intra-State',
              taxableSalesValue: unregisteredIntraStateSales,
              tcsRate: 1.0, // CGST + SGST
              igstTcsAmount: 0,
              cgstTcsAmount: cgstAmount,
              sgstTcsAmount: sgstAmount,
              totalTcsAmount: totalTcs,
              financialYear: fyString,
              lastSettlementDate: payoutDate.toISOString(),
            })
          }
        }
      }
    }

    // Net off TCS reversals from ledger entries
    // Get all TCS_REVERSAL entries linked to the batches we processed
    const tcsReversalEntries = await SellerLedgerEntry.find({
      settlementBatch: { $in: batchIds },
      reason: 'TCS_REVERSAL',
    })
      .populate('order', 'subtotal shippingAddress')
      .populate({
        path: 'order',
        populate: { path: 'user', select: 'gstNumber state' },
      })
      .lean()

    // Net off reversals from appropriate rows
    for (const reversal of tcsReversalEntries) {
      const order = reversal.order as any
      if (!order) continue

      const batch = batches.find((b) => String(b._id) === String(reversal.settlementBatch))
      if (!batch) continue

      const sellerData = batch.seller as any
      if (!sellerData) continue

      const sellerId = String(batch.seller)
      const sellerStateValue = sellerData.state || 'N/A'
      const customer = order.user as any
      const isCustomerRegistered = !!(customer?.gstNumber && customer.gstNumber.trim())
      const customerState = order.shippingAddress?.state || customer?.state || ''
      const isInterState =
        sellerStateValue?.toLowerCase().trim() !== customerState?.toLowerCase().trim()
      const orderTaxableValue = order.subtotal || 0

      // Determine customer type and supply type
      const customerType = isCustomerRegistered ? 'Registered' : 'Unregistered'
      const supplyType = isInterState ? 'Inter-State' : 'Intra-State'

      // Find the matching row
      const key = `${sellerId}-${sellerStateValue}-${customerType}-${supplyType}`
      const row = sellerStateCustomerMap.get(key)

      if (row && orderTaxableValue > 0) {
        // Net off the reversal
        row.taxableSalesValue -= orderTaxableValue

        // Parse reversal amounts from description or calculate
        // Description format: "TCS reversal for return Order #XXX. IGST: ₹X.XX, CGST: ₹X.XX, SGST: ₹X.XX"
        const description = reversal.description || ''
        let igstReversal = 0
        let cgstReversal = 0
        let sgstReversal = 0

        // Try to parse from description
        const igstMatch = description.match(/IGST:\s*₹?([\d,]+\.?\d*)/i)
        const cgstMatch = description.match(/CGST:\s*₹?([\d,]+\.?\d*)/i)
        const sgstMatch = description.match(/SGST:\s*₹?([\d,]+\.?\d*)/i)

        if (igstMatch) igstReversal = parseFloat(igstMatch[1].replace(/,/g, ''))
        if (cgstMatch) cgstReversal = parseFloat(cgstMatch[1].replace(/,/g, ''))
        if (sgstMatch) sgstReversal = parseFloat(sgstMatch[1].replace(/,/g, ''))

        // If parsing failed, calculate from order taxable value
        if (igstReversal === 0 && cgstReversal === 0 && sgstReversal === 0) {
          if (isInterState) {
            igstReversal = (orderTaxableValue * 1.0) / 100
          } else {
            cgstReversal = (orderTaxableValue * 0.5) / 100
            sgstReversal = (orderTaxableValue * 0.5) / 100
          }
        }

        // Net off TCS amounts
        row.igstTcsAmount = Math.max(0, row.igstTcsAmount - igstReversal)
        row.cgstTcsAmount = Math.max(0, row.cgstTcsAmount - cgstReversal)
        row.sgstTcsAmount = Math.max(0, row.sgstTcsAmount - sgstReversal)
        row.totalTcsAmount = Math.max(
          0,
          row.totalTcsAmount - (igstReversal + cgstReversal + sgstReversal),
        )
      }
    }

    const rows = Array.from(sellerStateCustomerMap.values()).filter(
      (row) => row.taxableSalesValue > 0 || row.totalTcsAmount > 0,
    ) // Only show rows with data

    // Calculate totals
    const totals = rows.reduce(
      (acc, row) => {
        acc.totalSales += row.taxableSalesValue
        acc.totalTcs += row.totalTcsAmount
        if (!acc.sellerIds.includes(row.sellerId)) {
          acc.sellerIds.push(row.sellerId)
        }
        acc.settlementCount += 1
        return acc
      },
      {
        totalSales: 0,
        totalTcs: 0,
        sellerIds: [] as string[],
        settlementCount: 0,
      },
    )

    const response: TcsReportResponse = {
      success: true,
      data: {
        rows,
        totals: {
          totalSales: totals.totalSales,
          totalTcs: totals.totalTcs,
          sellerCount: totals.sellerIds.length,
          settlementCount: batches.length,
        },
        filters: {
          financialYear,
          seller,
          sellerState,
          customerType,
          settlementStatus,
        },
      },
    }

    res.json(response)
  } catch (error: any) {
    console.error('Error generating TCS report:', error)
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate TCS report',
    })
  }
}

// Seller TDS Report (read-only, own data)
export const getSellerTdsReport = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user?.userId
    if (!sellerId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' })
    }

    const { financialYear, settlementStatus = 'PAID' } = req.query as {
      financialYear?: string
      settlementStatus?: 'ALL' | 'PAID' | 'PENDING'
    }

    // Build query for PAID settlement batches for this seller only
    const batchQuery: any = {
      seller: new mongoose.Types.ObjectId(sellerId),
      status: settlementStatus === 'ALL' ? { $in: ['PAID', 'PENDING'] } : 'PAID',
    }

    // Get all PAID settlement batches for this seller
    const batches = await SellerSettlementBatch.find(batchQuery)
      .populate('seller', 'businessName gstNumber panNumber businessType state')
      .lean()

    // Group by financial year
    const fyMap = new Map<string, TdsReportRow>()

    for (const batch of batches) {
      const sellerData = batch.seller as any
      if (!sellerData) continue

      const payoutDate = batch.payoutDate || batch.toDate

      // Determine financial year from payout date
      const fyYear =
        payoutDate.getMonth() >= 3 ? payoutDate.getFullYear() : payoutDate.getFullYear() - 1
      const fyEnd = fyYear + 1
      const fyString = `${fyYear}-${String(fyEnd).slice(-2)}`

      // Filter by financial year if specified
      if (financialYear && fyString !== financialYear) {
        continue
      }

      const key = fyString
      const existing = fyMap.get(key)

      // Determine seller type
      let sellerType: 'Individual' | 'HUF' | 'Other' = 'Other'
      if (sellerData.panNumber && sellerData.panNumber.length >= 4) {
        const fourthChar = sellerData.panNumber.charAt(3).toUpperCase()
        if (fourthChar === 'P') sellerType = 'Individual'
        else if (fourthChar === 'H') sellerType = 'HUF'
      }

      // Get gross sales including GST
      const grossSales = batch.tdsBaseAmount || batch.totalSaleAmount || 0
      const tdsAmount = batch.totalTdsAmount || 0
      const tdsRate = batch.tdsRate || 0

      // Net off TDS reversals linked to this batch
      const tdsReversals = await SellerLedgerEntry.find({
        seller: batch.seller,
        settlementBatch: batch._id,
        reason: 'TDS_REVERSAL',
      }).lean()

      let netTdsAmount = tdsAmount
      let netGrossSales = grossSales
      for (const reversal of tdsReversals) {
        netTdsAmount -= reversal.amount || 0
        // Estimate reversed order total: TDS reversal = order.total * 0.1%, so order.total = reversal / 0.001
        const reversedOrderTotal = (reversal.amount || 0) / 0.001
        netGrossSales -= reversedOrderTotal
      }

      // Determine TDS deduction status
      let tdsDeductionStatus: 'Not Applicable' | 'Applicable' | 'Threshold Crossed' =
        'Not Applicable'
      if (batch.tdsExempted) {
        tdsDeductionStatus = 'Not Applicable'
      } else if (netTdsAmount > 0) {
        tdsDeductionStatus = 'Applicable'
      } else {
        tdsDeductionStatus = 'Not Applicable'
      }

      if (existing) {
        existing.grossSalesInclGst += netGrossSales
        existing.tdsDeducted += netTdsAmount
        if (payoutDate > new Date(existing.lastSettlementDate)) {
          existing.lastSettlementDate = payoutDate.toISOString()
        }
      } else {
        fyMap.set(key, {
          sellerId: sellerId,
          sellerTradeName: sellerData.businessName || sellerData.name || 'N/A',
          sellerGstin: sellerData.gstNumber || 'N/A',
          sellerPan: sellerData.panNumber || 'N/A',
          sellerType,
          financialYear: fyString,
          grossSalesInclGst: netGrossSales,
          tdsRate,
          tdsDeducted: netTdsAmount,
          tdsDeductionStatus,
          lastSettlementDate: payoutDate.toISOString(),
        })
      }
    }

    const rows = Array.from(fyMap.values()).filter(
      (row) => row.grossSalesInclGst > 0 || row.tdsDeducted > 0,
    ) // Only show rows with data

    // Calculate totals
    const totals = rows.reduce(
      (acc, row) => ({
        totalSales: acc.totalSales + row.grossSalesInclGst,
        totalTds: acc.totalTds + row.tdsDeducted,
        sellerCount: 1,
        settlementCount: acc.settlementCount + 1,
      }),
      {
        totalSales: 0,
        totalTds: 0,
        settlementCount: 0,
      },
    )

    const response: TdsReportResponse = {
      success: true,
      data: {
        rows,
        totals: {
          totalSales: totals.totalSales,
          totalTds: totals.totalTds,
          sellerCount: 1,
          settlementCount: batches.length,
        },
        filters: {
          financialYear,
          seller: sellerId,
          settlementStatus,
        },
      },
    }

    res.json(response)
  } catch (error: any) {
    console.error('Error generating seller TDS report:', error)
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate TDS report',
    })
  }
}

// Seller TCS Report (read-only, own data)
export const getSellerTcsReport = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user?.userId
    if (!sellerId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' })
    }

    const {
      financialYear,
      sellerState,
      customerType = 'ALL',
      settlementStatus = 'PAID',
    } = req.query as {
      financialYear?: string
      sellerState?: string
      customerType?: 'Registered' | 'Unregistered' | 'ALL'
      settlementStatus?: 'ALL' | 'PAID' | 'PENDING'
    }

    // Build query for PAID settlement batches for this seller only
    const batchQuery: any = {
      seller: new mongoose.Types.ObjectId(sellerId),
      status: settlementStatus === 'ALL' ? { $in: ['PAID', 'PENDING'] } : 'PAID',
    }

    // Get all PAID settlement batches with seller info
    const batches = await SellerSettlementBatch.find(batchQuery)
      .populate('seller', 'businessName gstNumber state')
      .lean()

    // Get seller state
    const sellerData = batches[0]?.seller as any
    const sellerStateValue = sellerData?.state || 'N/A'

    // Filter by seller state if specified
    if (sellerState && sellerStateValue !== sellerState) {
      return res.json({
        success: true,
        data: {
          rows: [],
          totals: {
            totalSales: 0,
            totalTcs: 0,
            sellerCount: 1,
            settlementCount: 0,
          },
          filters: {
            financialYear,
            seller: sellerId,
            sellerState,
            customerType,
            settlementStatus,
          },
        },
      })
    }

    // Get orders for these batches
    const sellerBatchIds = batches.map((b) => b._id)
    const orders = await Order.find({
      settlementBatch: { $in: sellerBatchIds },
    })
      .populate('user', 'gstNumber state')
      .select('settlementBatch items subtotal shippingAddress')
      .lean()

    // Group orders by batch
    const ordersByBatch = new Map<string, any[]>()
    for (const order of orders) {
      const batchId = String(order.settlementBatch)
      const list = ordersByBatch.get(batchId) || []
      list.push(order)
      ordersByBatch.set(batchId, list)
    }

    // Group by state × customer type
    const stateCustomerMap = new Map<string, TcsReportRow>()

    for (const batch of batches) {
      const payoutDate = batch.payoutDate || batch.toDate
      const fyYear =
        payoutDate.getMonth() >= 3 ? payoutDate.getFullYear() : payoutDate.getFullYear() - 1
      const fyEnd = fyYear + 1
      const fyString = `${fyYear}-${String(fyEnd).slice(-2)}`

      // Filter by financial year if specified
      if (financialYear && fyString !== financialYear) {
        continue
      }

      // Get orders for this batch
      const batchOrders = ordersByBatch.get(String(batch._id)) || []

      // Calculate registered vs unregistered breakdown from orders
      let registeredInterStateSales = 0
      let registeredIntraStateSales = 0
      let unregisteredInterStateSales = 0
      let unregisteredIntraStateSales = 0

      for (const order of batchOrders) {
        const customer = order.user as any
        const isCustomerRegistered = !!(customer?.gstNumber && customer.gstNumber.trim())
        const customerState = order.shippingAddress?.state || customer?.state || ''
        const isInterState =
          sellerStateValue?.toLowerCase().trim() !== customerState?.toLowerCase().trim()
        const orderTaxableValue = order.subtotal || 0

        if (isCustomerRegistered) {
          if (isInterState) {
            registeredInterStateSales += orderTaxableValue
          } else {
            registeredIntraStateSales += orderTaxableValue
          }
        } else {
          if (isInterState) {
            unregisteredInterStateSales += orderTaxableValue
          } else {
            unregisteredIntraStateSales += orderTaxableValue
          }
        }
      }

      // Create rows for Registered customers
      if (customerType === 'ALL' || customerType === 'Registered') {
        // Inter-state registered
        if (registeredInterStateSales > 0) {
          const key = `${sellerStateValue}-Registered-Inter-State`
          const tcsAmount = (registeredInterStateSales * 1.0) / 100
          const existing = stateCustomerMap.get(key)
          if (existing) {
            existing.taxableSalesValue += registeredInterStateSales
            existing.igstTcsAmount += tcsAmount
            existing.totalTcsAmount += tcsAmount
            if (payoutDate > new Date(existing.lastSettlementDate)) {
              existing.lastSettlementDate = payoutDate.toISOString()
            }
          } else {
            stateCustomerMap.set(key, {
              sellerId: sellerId,
              sellerTradeName: sellerData?.businessName || sellerData?.name || 'N/A',
              sellerGstin: sellerData?.gstNumber || 'N/A',
              sellerState: sellerStateValue,
              customerType: 'Registered',
              supplyType: 'Inter-State',
              taxableSalesValue: registeredInterStateSales,
              tcsRate: 1.0,
              igstTcsAmount: tcsAmount,
              cgstTcsAmount: 0,
              sgstTcsAmount: 0,
              totalTcsAmount: tcsAmount,
              financialYear: fyString,
              lastSettlementDate: payoutDate.toISOString(),
            })
          }
        }

        // Intra-state registered
        if (registeredIntraStateSales > 0) {
          const key = `${sellerStateValue}-Registered-Intra-State`
          const cgstAmount = (registeredIntraStateSales * 0.5) / 100
          const sgstAmount = (registeredIntraStateSales * 0.5) / 100
          const totalTcs = cgstAmount + sgstAmount
          const existing = stateCustomerMap.get(key)
          if (existing) {
            existing.taxableSalesValue += registeredIntraStateSales
            existing.cgstTcsAmount += cgstAmount
            existing.sgstTcsAmount += sgstAmount
            existing.totalTcsAmount += totalTcs
            if (payoutDate > new Date(existing.lastSettlementDate)) {
              existing.lastSettlementDate = payoutDate.toISOString()
            }
          } else {
            stateCustomerMap.set(key, {
              sellerId: sellerId,
              sellerTradeName: sellerData?.businessName || sellerData?.name || 'N/A',
              sellerGstin: sellerData?.gstNumber || 'N/A',
              sellerState: sellerStateValue,
              customerType: 'Registered',
              supplyType: 'Intra-State',
              taxableSalesValue: registeredIntraStateSales,
              tcsRate: 1.0,
              igstTcsAmount: 0,
              cgstTcsAmount: cgstAmount,
              sgstTcsAmount: sgstAmount,
              totalTcsAmount: totalTcs,
              financialYear: fyString,
              lastSettlementDate: payoutDate.toISOString(),
            })
          }
        }
      }

      // Create rows for Unregistered customers
      if (customerType === 'ALL' || customerType === 'Unregistered') {
        // Inter-state unregistered
        if (unregisteredInterStateSales > 0) {
          const key = `${sellerStateValue}-Unregistered-Inter-State`
          const tcsAmount = (unregisteredInterStateSales * 1.0) / 100
          const existing = stateCustomerMap.get(key)
          if (existing) {
            existing.taxableSalesValue += unregisteredInterStateSales
            existing.igstTcsAmount += tcsAmount
            existing.totalTcsAmount += tcsAmount
            if (payoutDate > new Date(existing.lastSettlementDate)) {
              existing.lastSettlementDate = payoutDate.toISOString()
            }
          } else {
            stateCustomerMap.set(key, {
              sellerId: sellerId,
              sellerTradeName: sellerData?.businessName || sellerData?.name || 'N/A',
              sellerGstin: sellerData?.gstNumber || 'N/A',
              sellerState: sellerStateValue,
              customerType: 'Unregistered',
              supplyType: 'Inter-State',
              taxableSalesValue: unregisteredInterStateSales,
              tcsRate: 1.0,
              igstTcsAmount: tcsAmount,
              cgstTcsAmount: 0,
              sgstTcsAmount: 0,
              totalTcsAmount: tcsAmount,
              financialYear: fyString,
              lastSettlementDate: payoutDate.toISOString(),
            })
          }
        }

        // Intra-state unregistered
        if (unregisteredIntraStateSales > 0) {
          const key = `${sellerStateValue}-Unregistered-Intra-State`
          const cgstAmount = (unregisteredIntraStateSales * 0.5) / 100
          const sgstAmount = (unregisteredIntraStateSales * 0.5) / 100
          const totalTcs = cgstAmount + sgstAmount
          const existing = stateCustomerMap.get(key)
          if (existing) {
            existing.taxableSalesValue += unregisteredIntraStateSales
            existing.cgstTcsAmount += cgstAmount
            existing.sgstTcsAmount += sgstAmount
            existing.totalTcsAmount += totalTcs
            if (payoutDate > new Date(existing.lastSettlementDate)) {
              existing.lastSettlementDate = payoutDate.toISOString()
            }
          } else {
            stateCustomerMap.set(key, {
              sellerId: sellerId,
              sellerTradeName: sellerData?.businessName || sellerData?.name || 'N/A',
              sellerGstin: sellerData?.gstNumber || 'N/A',
              sellerState: sellerStateValue,
              customerType: 'Unregistered',
              supplyType: 'Intra-State',
              taxableSalesValue: unregisteredIntraStateSales,
              tcsRate: 1.0,
              igstTcsAmount: 0,
              cgstTcsAmount: cgstAmount,
              sgstTcsAmount: sgstAmount,
              totalTcsAmount: totalTcs,
              financialYear: fyString,
              lastSettlementDate: payoutDate.toISOString(),
            })
          }
        }
      }
    }

    // Net off TCS reversals from ledger entries for seller TCS report
    const sellerTcsBatchIds = batches.map((b) => b._id)
    const tcsReversalEntries = await SellerLedgerEntry.find({
      seller: new mongoose.Types.ObjectId(sellerId),
      settlementBatch: { $in: sellerTcsBatchIds },
      reason: 'TCS_REVERSAL',
    })
      .populate('order', 'subtotal shippingAddress')
      .populate({
        path: 'order',
        populate: { path: 'user', select: 'gstNumber state' },
      })
      .lean()

    // Net off reversals from appropriate rows
    for (const reversal of tcsReversalEntries) {
      const order = reversal.order as any
      if (!order) continue

      const customer = order.user as any
      const isCustomerRegistered = !!(customer?.gstNumber && customer.gstNumber.trim())
      const customerState = order.shippingAddress?.state || customer?.state || ''
      const isInterState =
        sellerStateValue?.toLowerCase().trim() !== customerState?.toLowerCase().trim()
      const orderTaxableValue = order.subtotal || 0

      // Determine customer type and supply type
      const customerType = isCustomerRegistered ? 'Registered' : 'Unregistered'
      const supplyType = isInterState ? 'Inter-State' : 'Intra-State'

      // Find the matching row
      const key = `${sellerStateValue}-${customerType}-${supplyType}`
      const row = stateCustomerMap.get(key)

      if (row && orderTaxableValue > 0) {
        // Net off the reversal
        row.taxableSalesValue -= orderTaxableValue

        // Parse reversal amounts from description or calculate
        const description = reversal.description || ''
        let igstReversal = 0
        let cgstReversal = 0
        let sgstReversal = 0

        // Try to parse from description
        const igstMatch = description.match(/IGST:\s*₹?([\d,]+\.?\d*)/i)
        const cgstMatch = description.match(/CGST:\s*₹?([\d,]+\.?\d*)/i)
        const sgstMatch = description.match(/SGST:\s*₹?([\d,]+\.?\d*)/i)

        if (igstMatch) igstReversal = parseFloat(igstMatch[1].replace(/,/g, ''))
        if (cgstMatch) cgstReversal = parseFloat(cgstMatch[1].replace(/,/g, ''))
        if (sgstMatch) sgstReversal = parseFloat(sgstMatch[1].replace(/,/g, ''))

        // If parsing failed, calculate from order taxable value
        if (igstReversal === 0 && cgstReversal === 0 && sgstReversal === 0) {
          if (isInterState) {
            igstReversal = (orderTaxableValue * 1.0) / 100
          } else {
            cgstReversal = (orderTaxableValue * 0.5) / 100
            sgstReversal = (orderTaxableValue * 0.5) / 100
          }
        }

        // Net off TCS amounts
        row.igstTcsAmount = Math.max(0, row.igstTcsAmount - igstReversal)
        row.cgstTcsAmount = Math.max(0, row.cgstTcsAmount - cgstReversal)
        row.sgstTcsAmount = Math.max(0, row.sgstTcsAmount - sgstReversal)
        row.totalTcsAmount = Math.max(
          0,
          row.totalTcsAmount - (igstReversal + cgstReversal + sgstReversal),
        )
      }
    }

    const rows = Array.from(stateCustomerMap.values()).filter(
      (row) => row.taxableSalesValue > 0 || row.totalTcsAmount > 0,
    ) // Only show rows with data

    // Calculate totals
    const totals = rows.reduce(
      (acc, row) => ({
        totalSales: acc.totalSales + row.taxableSalesValue,
        totalTcs: acc.totalTcs + row.totalTcsAmount,
        sellerCount: 1,
        settlementCount: acc.settlementCount + 1,
      }),
      {
        totalSales: 0,
        totalTcs: 0,
        settlementCount: 0,
      },
    )

    const response: TcsReportResponse = {
      success: true,
      data: {
        rows,
        totals: {
          totalSales: totals.totalSales,
          totalTcs: totals.totalTcs,
          sellerCount: 1,
          settlementCount: batches.length,
        },
        filters: {
          financialYear,
          seller: sellerId,
          sellerState,
          customerType,
          settlementStatus,
        },
      },
    }

    res.json(response)
  } catch (error: any) {
    console.error('Error generating seller TCS report:', error)
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate TCS report',
    })
  }
}

// New Seller Registration Report
interface NewSellerReportParams {
  fromDate?: string
  toDate?: string
  verificationStatus?: 'PENDING' | 'VERIFIED' | 'REJECTED'
  productStatus?: 'No product added' | 'Products added but not live' | 'At least one product live'
  state?: string
  gstStatus?: 'Provided' | 'Not Provided'
  panStatus?: 'Provided' | 'Not Provided'
  sortBy?: 'registrationDate' | 'businessName' | 'verificationStatus' | 'productStatus'
  sortOrder?: 'asc' | 'desc'
}

interface NewSellerReportRow {
  sellerId: string
  businessName: string
  email: string
  phone: string
  registrationDate: string
  sellerState: string
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED'
  gstStatus: 'Provided' | 'Not Provided'
  panStatus: 'Provided' | 'Not Provided'
  productStatus: 'No product added' | 'Products added but not live' | 'At least one product live'
  firstProductLiveDate?: string
  totalProducts: number
  liveProducts: number
}

interface NewSellerReportResponse {
  success: boolean
  data: {
    rows: NewSellerReportRow[]
    summary: {
      totalNewSellers: number
      pendingVerificationCount: number
      verifiedSellersCount: number
      rejectedSellersCount: number
      noProductSellersCount: number
      productAddedNotLiveCount: number
      liveProductSellersCount: number
    }
    filters: NewSellerReportParams
  }
}

export const getNewSellerRegistrationReport = async (req: Request, res: Response) => {
  try {
    const {
      fromDate,
      toDate,
      verificationStatus,
      productStatus,
      state,
      gstStatus,
      panStatus,
      sortBy = 'registrationDate',
      sortOrder = 'desc',
    } = req.query as NewSellerReportParams

    // Default to last 7 days if no date range provided
    const now = new Date()
    const defaultFromDate = new Date(now)
    defaultFromDate.setDate(defaultFromDate.getDate() - 7)

    const from = fromDate ? new Date(fromDate) : defaultFromDate
    const to = toDate ? new Date(toDate) : now

    // Build query for sellers
    const sellerQuery: any = {
      role: 'seller',
      createdAt: { $gte: from, $lte: to },
    }

    if (state) {
      sellerQuery.state = state
    }

    // Build $or conditions for GST and PAN status
    const orConditions: any[] = []

    if (gstStatus === 'Provided') {
      sellerQuery.gstNumber = { $exists: true, $nin: [null, ''] }
    } else if (gstStatus === 'Not Provided') {
      orConditions.push({ gstNumber: { $exists: false } }, { gstNumber: null }, { gstNumber: '' })
    }

    if (panStatus === 'Provided') {
      sellerQuery.panNumber = { $exists: true, $nin: [null, ''] }
    } else if (panStatus === 'Not Provided') {
      orConditions.push({ panNumber: { $exists: false } }, { panNumber: null }, { panNumber: '' })
    }

    // Add $or to query if we have any conditions
    if (orConditions.length > 0) {
      sellerQuery.$or = orConditions
    }

    // Get all sellers matching the query
    const sellers = await User.find(sellerQuery)
      .select(
        '_id name businessName email phone createdAt state isApproved kycSubmitted bankVerificationStatus gstNumber panNumber',
      )
      .lean()

    // Get product counts for all sellers
    const sellerIds = sellers.map((s) => s._id)
    const products = await Product.find({
      seller: { $in: sellerIds },
    })
      .select('seller status createdAt')
      .lean()

    // Group products by seller
    const productsBySeller = new Map<string, any[]>()
    for (const product of products) {
      const sellerId = String(product.seller)
      const list = productsBySeller.get(sellerId) || []
      list.push(product)
      productsBySeller.set(sellerId, list)
    }

    // Build report rows
    const rows: NewSellerReportRow[] = []

    for (const seller of sellers) {
      const sellerId = String(seller._id)
      const sellerProducts = productsBySeller.get(sellerId) || []

      // Calculate product status
      const totalProducts = sellerProducts.length
      const liveProducts = sellerProducts.filter((p) => p.status === 'active').length

      let calculatedProductStatus:
        | 'No product added'
        | 'Products added but not live'
        | 'At least one product live'
      if (totalProducts === 0) {
        calculatedProductStatus = 'No product added'
      } else if (liveProducts === 0) {
        calculatedProductStatus = 'Products added but not live'
      } else {
        calculatedProductStatus = 'At least one product live'
      }

      // Filter by product status if specified
      if (productStatus && calculatedProductStatus !== productStatus) {
        continue
      }

      // Calculate verification status
      let calculatedVerificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED'
      if (seller.isApproved === true) {
        calculatedVerificationStatus = 'VERIFIED'
      } else if (seller.isApproved === false && seller.kycSubmitted === true) {
        calculatedVerificationStatus = 'REJECTED'
      } else {
        calculatedVerificationStatus = 'PENDING'
      }

      // Filter by verification status if specified
      if (verificationStatus && calculatedVerificationStatus !== verificationStatus) {
        continue
      }

      // Find first product live date
      const liveProductsSorted = sellerProducts
        .filter((p) => p.status === 'active')
        .sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0
          return dateA - dateB
        })
      const firstProductLiveDate =
        liveProductsSorted.length > 0 ? liveProductsSorted[0].createdAt : undefined

      rows.push({
        sellerId,
        businessName: seller.businessName || seller.name || 'N/A',
        email: seller.email || 'N/A',
        phone: seller.phone || 'N/A',
        registrationDate: seller.createdAt.toISOString(),
        sellerState: seller.state || 'N/A',
        verificationStatus: calculatedVerificationStatus,
        gstStatus: seller.gstNumber && seller.gstNumber.trim() ? 'Provided' : 'Not Provided',
        panStatus: seller.panNumber && seller.panNumber.trim() ? 'Provided' : 'Not Provided',
        productStatus: calculatedProductStatus,
        firstProductLiveDate: firstProductLiveDate
          ? new Date(firstProductLiveDate).toISOString()
          : undefined,
        totalProducts,
        liveProducts,
      })
    }

    // Sort rows
    rows.sort((a, b) => {
      let comparison = 0
      switch (sortBy) {
        case 'registrationDate':
          comparison =
            new Date(a.registrationDate).getTime() - new Date(b.registrationDate).getTime()
          break
        case 'businessName':
          comparison = a.businessName.localeCompare(b.businessName)
          break
        case 'verificationStatus':
          comparison = a.verificationStatus.localeCompare(b.verificationStatus)
          break
        case 'productStatus':
          comparison = a.productStatus.localeCompare(b.productStatus)
          break
        default:
          comparison =
            new Date(a.registrationDate).getTime() - new Date(b.registrationDate).getTime()
      }
      return sortOrder === 'asc' ? comparison : -comparison
    })

    // Calculate summary
    const summary = {
      totalNewSellers: rows.length,
      pendingVerificationCount: rows.filter((r) => r.verificationStatus === 'PENDING').length,
      verifiedSellersCount: rows.filter((r) => r.verificationStatus === 'VERIFIED').length,
      rejectedSellersCount: rows.filter((r) => r.verificationStatus === 'REJECTED').length,
      noProductSellersCount: rows.filter((r) => r.productStatus === 'No product added').length,
      productAddedNotLiveCount: rows.filter(
        (r) => r.productStatus === 'Products added but not live',
      ).length,
      liveProductSellersCount: rows.filter((r) => r.productStatus === 'At least one product live')
        .length,
    }

    const response: NewSellerReportResponse = {
      success: true,
      data: {
        rows,
        summary,
        filters: {
          fromDate: from.toISOString(),
          toDate: to.toISOString(),
          verificationStatus,
          productStatus,
          state,
          gstStatus,
          panStatus,
          sortBy,
          sortOrder,
        },
      },
    }

    res.json(response)
  } catch (error: any) {
    console.error('Error generating new seller registration report:', error)
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate new seller registration report',
    })
  }
}

interface TicketSystemReportParams {
  status?: string
  category?: string
  priority?: string
  assignedRole?: string
  assignedTo?: string
  slaBreached?: 'YES' | 'NO'
  fromDate?: string
  toDate?: string
  seller?: string
  orderId?: string
}

interface TicketSystemReportRow {
  ticketNumber: string
  sellerId?: string
  sellerName?: string
  orderId?: string
  orderNumber?: string
  category: string
  priority: string
  status: string
  assignedRole?: string
  assignedTo?: string
  assignedToName?: string
  createdAt: string
  slaHours?: number
  slaDeadline?: string
  currentAgeHours: number
  slaBreached: 'YES' | 'NO'
  resolutionTimeHours?: number
  tatStatus: 'WITHIN_SLA' | 'BREACHED'
  firstResponseAt?: string
  resolvedAt?: string
}

interface TicketSystemReportMetrics {
  totalTickets: number
  openTickets: number
  closedTickets: number
  slaBreachedTickets: number
  slaBreachedPercentage: number
  avgResolutionTime: number
  ticketsByRole: Record<string, number>
  ticketsByCategory: Record<string, number>
}

export const getTicketSystemReport = async (req: Request, res: Response) => {
  try {
    const {
      status,
      category,
      priority,
      assignedRole,
      assignedTo,
      slaBreached,
      fromDate,
      toDate,
      seller,
      orderId,
    } = req.query as TicketSystemReportParams

    // Build query
    const query: any = {}

    if (status) {
      query.status = status
    }

    if (category) {
      query.category = category
    }

    if (priority) {
      query.priority = priority
    }

    if (assignedRole) {
      query.assignedRole = assignedRole
    }

    if (assignedTo) {
      query.assignedTo = new mongoose.Types.ObjectId(assignedTo)
    }

    if (seller) {
      query.sellerId = new mongoose.Types.ObjectId(seller)
    }

    if (orderId) {
      query.orderId = new mongoose.Types.ObjectId(orderId)
    }

    // Date range filter
    if (fromDate || toDate) {
      query.createdAt = {}
      if (fromDate) {
        query.createdAt.$gte = new Date(fromDate)
      }
      if (toDate) {
        const to = new Date(toDate)
        to.setHours(23, 59, 59, 999)
        query.createdAt.$lte = to
      }
    }

    // Fetch tickets with populated fields
    const tickets = await Ticket.find(query)
      .populate('sellerId', 'name businessName email')
      .populate('customerId', 'name email')
      .populate('orderId', 'orderNumber')
      .populate('assignedTo', 'name email')
      .sort({ createdAt: -1 })
      .lean()

    const now = new Date()
    const rows: TicketSystemReportRow[] = []
    let totalSlaBreached = 0
    let totalClosed = 0
    let totalResolutionTime = 0
    const ticketsByRole: Record<string, number> = {}
    const ticketsByCategory: Record<string, number> = {}

    for (const ticket of tickets) {
      const ticketSlaHours = ticket.slaHours || 0
      const createdAt = new Date(ticket.createdAt)
      const slaDeadline = ticketSlaHours ? calculateSlaDeadline(createdAt, ticketSlaHours) : null
      const currentAgeHours = calculateTicketAge(createdAt, now)

      // Calculate SLA breach
      let isBreached = false
      let resolutionTimeHours: number | undefined

      if (ticket.status === 'closed' && ticket.resolvedAt) {
        const resolvedAt = new Date(ticket.resolvedAt)
        resolutionTimeHours = (resolvedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60)
        isBreached = wasSlaBreached(createdAt, resolvedAt, ticketSlaHours)
        if (isBreached) totalSlaBreached++
        totalClosed++
        if (resolutionTimeHours > 0) {
          totalResolutionTime += resolutionTimeHours
        }
      } else if (ticket.status !== 'closed') {
        isBreached = isSlaBreached(ticket.status, createdAt, ticketSlaHours, now)
        if (isBreached) totalSlaBreached++
      }

      // Filter by SLA breach if specified
      if (slaBreached === 'YES' && !isBreached) {
        continue
      }
      if (slaBreached === 'NO' && isBreached) {
        continue
      }

      // Track metrics
      const role = ticket.assignedRole || 'UNASSIGNED'
      ticketsByRole[role] = (ticketsByRole[role] || 0) + 1
      ticketsByCategory[ticket.category] = (ticketsByCategory[ticket.category] || 0) + 1

      const sellerName =
        ticket.ticketType === 'seller' && ticket.sellerId
          ? (ticket.sellerId as any).businessName || (ticket.sellerId as any).name
          : ticket.ticketType === 'customer' && ticket.customerId
          ? (ticket.customerId as any).name
          : undefined

      rows.push({
        ticketNumber: ticket.ticketNumber,
        sellerId: ticket.ticketType === 'seller' ? String(ticket.sellerId) : undefined,
        sellerName,
        orderId: ticket.orderId ? String(ticket.orderId) : undefined,
        orderNumber:
          ticket.orderId && typeof ticket.orderId === 'object' && 'orderNumber' in ticket.orderId
            ? (ticket.orderId as any).orderNumber
            : undefined,
        category: ticket.category,
        priority: ticket.priority,
        status: ticket.status,
        assignedRole: ticket.assignedRole,
        assignedTo: ticket.assignedTo ? String(ticket.assignedTo) : undefined,
        assignedToName:
          ticket.assignedTo && typeof ticket.assignedTo === 'object' && 'name' in ticket.assignedTo
            ? (ticket.assignedTo as any).name
            : undefined,
        createdAt: createdAt.toISOString(),
        slaHours: ticketSlaHours || undefined,
        slaDeadline: slaDeadline ? slaDeadline.toISOString() : undefined,
        currentAgeHours: Math.round(currentAgeHours * 100) / 100,
        slaBreached: isBreached ? 'YES' : 'NO',
        resolutionTimeHours: resolutionTimeHours
          ? Math.round(resolutionTimeHours * 100) / 100
          : undefined,
        tatStatus: isBreached ? 'BREACHED' : 'WITHIN_SLA',
        firstResponseAt: ticket.firstResponseAt
          ? new Date(ticket.firstResponseAt).toISOString()
          : undefined,
        resolvedAt: ticket.resolvedAt ? new Date(ticket.resolvedAt).toISOString() : undefined,
      })
    }

    // Calculate metrics
    const totalTickets = rows.length
    const openTickets = rows.filter((r) => r.status !== 'closed').length
    const closedTickets = totalClosed
    const avgResolutionTime = totalClosed > 0 ? totalResolutionTime / totalClosed : 0

    const metrics: TicketSystemReportMetrics = {
      totalTickets,
      openTickets,
      closedTickets,
      slaBreachedTickets: totalSlaBreached,
      slaBreachedPercentage: totalTickets > 0 ? (totalSlaBreached / totalTickets) * 100 : 0,
      avgResolutionTime: Math.round(avgResolutionTime * 100) / 100,
      ticketsByRole,
      ticketsByCategory,
    }

    const response = {
      success: true,
      data: {
        rows,
        metrics,
        filters: {
          status,
          category,
          priority,
          assignedRole,
          assignedTo,
          slaBreached,
          fromDate,
          toDate,
          seller,
          orderId,
        },
      },
    }

    res.json(response)
  } catch (error: any) {
    console.error('Error generating ticket system report:', error)
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate ticket system report',
    })
  }
}

// Sales Pending Status Report with TAT information
export const getSalesPendingStatusReport = async (req: Request, res: Response) => {
  try {
    const {
      seller,
      courier,
      pendingStage,
      slaStatus,
      fromDate,
      toDate,
      page = '1',
      limit = '50',
    } = req.query as {
      seller?: string
      courier?: string
      pendingStage?: 'acceptance' | 'awb' | 'pickup'
      slaStatus?: 'within_tat' | 'breached'
      fromDate?: string
      toDate?: string
      page?: string
      limit?: string
    }

    const pageNum = parseInt(page, 10)
    const limitNum = parseInt(limit, 10)
    const skip = (pageNum - 1) * limitNum

    // Build query for pending orders
    const orderQuery: any = {
      status: { $nin: ['cancelled', 'refunded'] },
    }

    // Filter by date range if provided
    if (fromDate || toDate) {
      orderQuery.createdAt = {}
      if (fromDate) {
        orderQuery.createdAt.$gte = new Date(fromDate)
      }
      if (toDate) {
        orderQuery.createdAt.$lte = new Date(toDate)
      }
    }

    // Filter by seller if provided
    if (seller) {
      orderQuery['items.seller'] = new mongoose.Types.ObjectId(seller)
    }

    // Fetch orders with seller shipments
    const orders = await Order.find(orderQuery)
      .populate('user', 'name email')
      .populate('items.seller', 'name businessName')
      .sort({ createdAt: -1 })
      .lean()

    const rows: Array<OrderTATInfo & { courier?: string; orderTotal?: number }> = []

    for (const order of orders) {
      // Process each seller shipment
      for (const sellerShipment of order.sellerShipments || []) {
        // Filter by courier if provided
        if (courier) {
          const awb = sellerShipment.shippingMeta?.awb || sellerShipment.kourierBoyzLogistics?.awb_number
          if (!awb || !awb.includes(courier)) {
            continue
          }
        }

        // Calculate TAT info for this order-seller combination
        const tatInfo = await calculateOrderTATInfo(order as any, sellerShipment as any)

        // Filter by pending stage if provided
        if (pendingStage) {
          if (pendingStage === 'acceptance' && tatInfo.currentStage !== 'pending_acceptance') {
            continue
          }
          if (pendingStage === 'awb' && tatInfo.currentStage !== 'pending_awb') {
            continue
          }
          if (pendingStage === 'pickup' && tatInfo.currentStage !== 'pending_pickup') {
            continue
          }
        }

        // Filter by SLA status if provided
        if (slaStatus) {
          const relevantTAT = tatInfo.acceptanceTAT || tatInfo.awbTAT || tatInfo.pickupTAT
          if (!relevantTAT || relevantTAT.slaStatus !== slaStatus) {
            continue
          }
        }

        // Only include if order is pending at some stage
        if (tatInfo.currentStage === 'completed') {
          continue
        }

        rows.push({
          ...tatInfo,
          courier: sellerShipment.shippingMeta?.courier || sellerShipment.kourierBoyzLogistics?.order_id,
          orderTotal: order.total,
        })
      }
    }

    // Calculate summary from all rows (before pagination)
    const totalRows = rows.length
    const summary = {
      totalPending: totalRows,
      pendingAcceptance: rows.filter((r) => r.currentStage === 'pending_acceptance').length,
      pendingAWB: rows.filter((r) => r.currentStage === 'pending_awb').length,
      pendingPickup: rows.filter((r) => r.currentStage === 'pending_pickup').length,
      breachedSLA: rows.filter(
        (r) =>
          r.acceptanceTAT?.slaStatus === 'breached' ||
          r.awbTAT?.slaStatus === 'breached' ||
          r.pickupTAT?.slaStatus === 'breached',
      ).length,
      withinSLA: rows.filter(
        (r) =>
          (r.acceptanceTAT?.slaStatus === 'within_tat' ||
            r.awbTAT?.slaStatus === 'within_tat' ||
            r.pickupTAT?.slaStatus === 'within_tat') &&
          !(
            r.acceptanceTAT?.slaStatus === 'breached' ||
            r.awbTAT?.slaStatus === 'breached' ||
            r.pickupTAT?.slaStatus === 'breached'
          ),
      ).length,
    }

    // Apply pagination
    const paginatedRows = rows.slice(skip, skip + limitNum)

    res.json({
      success: true,
      data: {
        rows: paginatedRows,
        summary,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalRows,
          totalPages: Math.ceil(totalRows / limitNum),
        },
        filters: {
          seller,
          courier,
          pendingStage,
          slaStatus,
          fromDate,
          toDate,
        },
      },
    })
  } catch (error: any) {
    console.error('Error generating sales pending status report:', error)
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate sales pending status report',
    })
  }
}

// SLA Dashboard Metrics
export const getSLADashboardMetrics = async (req: Request, res: Response) => {
  try {
    const { period = 'today' } = req.query as { period?: 'today' | 'mtd' | 'ytd' }

    const now = new Date()
    let startDate: Date

    switch (period) {
      case 'mtd':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
        break
      case 'ytd':
        startDate = new Date(now.getFullYear(), 0, 1)
        break
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    }

    // Build query for orders in the period
    const orderQuery: any = {
      status: { $nin: ['cancelled', 'refunded'] },
      createdAt: { $gte: startDate },
    }

    const orders = await Order.find(orderQuery).populate('items.seller', 'name businessName').lean()

    let pendingAWB = 0
    let pendingPickup = 0
    let breachedAWBSLA = 0
    let breachedPickupSLA = 0

    for (const order of orders) {
      for (const sellerShipment of order.sellerShipments || []) {
        const tatInfo = await calculateOrderTATInfo(order as any, sellerShipment as any)

        if (tatInfo.currentStage === 'pending_awb') {
          pendingAWB++
          if (tatInfo.awbTAT?.slaStatus === 'breached') {
            breachedAWBSLA++
          }
        }

        if (tatInfo.currentStage === 'pending_pickup') {
          pendingPickup++
          if (tatInfo.pickupTAT?.slaStatus === 'breached') {
            breachedPickupSLA++
          }
        }
      }
    }

    res.json({
      success: true,
      data: {
        period,
        metrics: {
          pendingAWB,
          pendingPickup,
          breachedAWBSLA,
          breachedPickupSLA,
          totalBreachedSLA: breachedAWBSLA + breachedPickupSLA,
        },
      },
    })
  } catch (error: any) {
    console.error('Error fetching SLA dashboard metrics:', error)
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch SLA dashboard metrics',
    })
  }
}
