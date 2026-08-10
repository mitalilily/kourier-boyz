import { Request, Response } from 'express'
import mongoose from 'mongoose'
import CategoryRequest from '../models/CategoryRequest'
import Certificate from '../models/Certificate'
import Order from '../models/Order'
import Product from '../models/Product'
import Return from '../models/Return'
import SellerLedgerEntry from '../models/SellerLedgerEntry'
import SellerSettlementBatch from '../models/SellerSettlementBatch'
import User from '../models/User'

// ============================================================================
// DASHBOARD ANALYTICS CONTROLLER
// Provides comprehensive business metrics for admin dashboard
// ============================================================================

interface DateRange {
  start: Date
  end: Date
}

// Helper to parse date range from query params
const parseDateRange = (startDate?: string, endDate?: string, defaultDays = 30): DateRange => {
  const end = endDate ? new Date(endDate) : new Date()
  end.setHours(23, 59, 59, 999)

  const start = startDate
    ? new Date(startDate)
    : new Date(end.getTime() - defaultDays * 24 * 60 * 60 * 1000)
  start.setHours(0, 0, 0, 0)

  return { start, end }
}

// Helper to get previous period for comparison
const getPreviousPeriod = (range: DateRange): DateRange => {
  const duration = range.end.getTime() - range.start.getTime()
  return {
    start: new Date(range.start.getTime() - duration),
    end: new Date(range.start.getTime() - 1),
  }
}

// Helper to calculate percentage change
const calcPercentChange = (current: number, previous: number): number => {
  if (previous === 0) return current > 0 ? 100 : 0
  return Math.round(((current - previous) / previous) * 100 * 10) / 10
}

// ============================================================================
// GET DASHBOARD SUMMARY - Key business metrics
// ============================================================================
export const getDashboardSummary = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query
    const range = parseDateRange(startDate as string, endDate as string)
    const prevRange = getPreviousPeriod(range)

    // Current period aggregations
    const [
      currentRevenue,
      previousRevenue,
      currentOrders,
      previousOrders,
      totalSellers,
      activeSellers,
      pendingApprovals,
      lowStockProducts,
      currentProfitBatches,
      previousProfitBatches,
    ] = await Promise.all([
      // Current GMV (Gross Merchandise Value)
      Order.aggregate([
        {
          $match: {
            createdAt: { $gte: range.start, $lte: range.end },
            paymentStatus: 'paid',
            status: { $nin: ['cancelled', 'refunded'] },
          },
        },
        {
          $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } },
        },
      ]),
      // Previous GMV
      Order.aggregate([
        {
          $match: {
            createdAt: { $gte: prevRange.start, $lte: prevRange.end },
            paymentStatus: 'paid',
            status: { $nin: ['cancelled', 'refunded'] },
          },
        },
        {
          $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } },
        },
      ]),
      // Current orders count
      Order.countDocuments({
        createdAt: { $gte: range.start, $lte: range.end },
      }),
      // Previous orders count
      Order.countDocuments({
        createdAt: { $gte: prevRange.start, $lte: prevRange.end },
      }),
      // Total sellers
      User.countDocuments({ role: 'seller' }),
      // Active sellers (with at least 1 order in period)
      Order.distinct('items.seller', {
        createdAt: { $gte: range.start, $lte: range.end },
      }),
      // Pending seller approvals
      User.countDocuments({
        role: 'seller',
        kycSubmitted: true,
        isApproved: false,
      }),
      // Low stock products
      Product.countDocuments({
        status: 'active',
        $expr: { $lte: ['$stock', '$lowStockThreshold'] },
      }),
      // Current period platform income from ledger entries (for platform profit)
      // Includes: Commission (PERCENTAGE & FIXED), PG Fees, COD Fees, Manual Adjustments, Platform Adjustments
      SellerLedgerEntry.aggregate([
        {
          $match: {
            entryType: 'DEBIT',
            reason: {
              $in: [
                'COMMISSION_DEBIT', // Commission (both PERCENTAGE and FIXED types)
                'COMMISSION', // Legacy
                'PAYMENT_GATEWAY_FEE', // PG fees
                'PG_FEE', // Legacy
                'COD_FEE_DEBIT', // COD convenience fees
                'PLATFORM_ADJUSTMENT', // Platform adjustments
                'MANUAL_ADJUSTMENT', // Manual adjustments
              ],
            },
            createdAt: { $gte: range.start, $lte: range.end },
          },
        },
        {
          $group: {
            _id: null,
            totalPlatformIncome: { $sum: '$amount' },
          },
        },
      ]),
      // Previous period platform income from ledger entries (for platform profit comparison)
      SellerLedgerEntry.aggregate([
        {
          $match: {
            entryType: 'DEBIT',
            reason: {
              $in: [
                'COMMISSION_DEBIT',
                'COMMISSION',
                'PAYMENT_GATEWAY_FEE',
                'PG_FEE',
                'COD_FEE_DEBIT',
                'PLATFORM_ADJUSTMENT',
                'MANUAL_ADJUSTMENT',
              ],
            },
            createdAt: { $gte: prevRange.start, $lte: prevRange.end },
          },
        },
        {
          $group: {
            _id: null,
            totalPlatformIncome: { $sum: '$amount' },
          },
        },
      ]),
    ])

    const currGMV = currentRevenue[0]?.total || 0
    const prevGMV = previousRevenue[0]?.total || 0
    const currOrderCount = currentRevenue[0]?.count || 0
    const prevOrderCount = previousRevenue[0]?.count || 0

    // Platform profit = sum of all DEBIT ledger entries with platform income reasons
    // This includes: Commission, PG Fees, Manual Adjustments, Platform Adjustments
    const currProfit = currentProfitBatches[0]?.totalPlatformIncome || 0
    const prevProfit = previousProfitBatches[0]?.totalPlatformIncome || 0

    // Calculate AOV (Average Order Value)
    const currAOV = currOrderCount > 0 ? currGMV / currOrderCount : 0
    const prevAOV = prevOrderCount > 0 ? prevGMV / prevOrderCount : 0

    res.json({
      success: true,
      data: {
        gmv: {
          value: currGMV,
          change: calcPercentChange(currGMV, prevGMV),
          previousValue: prevGMV,
        },
        profit: {
          value: Math.round(currProfit * 100) / 100,
          change: calcPercentChange(currProfit, prevProfit),
          previousValue: Math.round(prevProfit * 100) / 100,
        },
        orders: {
          value: currentOrders,
          change: calcPercentChange(currentOrders, previousOrders),
          previousValue: previousOrders,
        },
        aov: {
          value: Math.round(currAOV * 100) / 100,
          change: calcPercentChange(currAOV, prevAOV),
          previousValue: Math.round(prevAOV * 100) / 100,
        },
        sellers: {
          total: totalSellers,
          active: activeSellers.length,
          pendingApproval: pendingApprovals,
        },
        lowStockProducts,
        dateRange: {
          start: range.start.toISOString(),
          end: range.end.toISOString(),
        },
      },
    })
  } catch (error) {
    console.error('Dashboard summary error:', error)
    res.status(500).json({ success: false, message: 'Failed to fetch dashboard summary' })
  }
}

// ============================================================================
// GET REVENUE CHART DATA - Daily/Weekly/Monthly PLATFORM REVENUE (after settlement)
// ============================================================================
export const getRevenueChart = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, granularity = 'daily' } = req.query
    const range = parseDateRange(startDate as string, endDate as string)

    // Determine grouping based on granularity (based on createdAt of ledger entries)
    let dateFormat: string
    let groupId: object

    switch (granularity) {
      case 'weekly':
        dateFormat = '%Y-W%V'
        groupId = {
          year: { $year: '$createdAt' },
          week: { $week: '$createdAt' },
        }
        break
      case 'monthly':
        dateFormat = '%Y-%m'
        groupId = {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
        }
        break
      default:
        dateFormat = '%Y-%m-%d'
        groupId = {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' },
        }
    }

    // Use ledger entries to calculate platform revenue (same as Portal Income Report)
    // Platform revenue = sum of DEBIT entries with platform income reasons
    // Includes: Commission (PERCENTAGE & FIXED), PG Fees, COD Fees, Manual Adjustments, Platform Adjustments
    const revenueData = await SellerLedgerEntry.aggregate([
      {
        $match: {
          entryType: 'DEBIT',
          reason: {
            $in: [
              'COMMISSION_DEBIT', // Commission (both PERCENTAGE and FIXED types)
              'COMMISSION', // Legacy
              'PAYMENT_GATEWAY_FEE', // PG fees
              'PG_FEE', // Legacy
              'COD_FEE_DEBIT', // COD convenience fees
              'PLATFORM_ADJUSTMENT', // Platform adjustments
              'MANUAL_ADJUSTMENT', // Manual adjustments
            ],
          },
          createdAt: { $gte: range.start, $lte: range.end },
        },
      },
      {
        $group: {
          _id: groupId,
          // Platform revenue for the bucket = sum of all platform income amounts
          revenue: { $sum: '$amount' },
          // Count unique orders in this bucket (excluding null orders)
          orderIds: {
            $addToSet: {
              $cond: [{ $ne: ['$order', null] }, '$order', '$$REMOVE'],
            },
          },
        },
      },
      {
        $project: {
          _id: 1,
          revenue: 1,
          orders: { $size: '$orderIds' },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.week': 1 } },
    ])

    // Format the data for frontend
    const formattedData = revenueData.map((item) => {
      let label: string
      if (granularity === 'weekly') {
        label = `W${item._id.week} ${item._id.year}`
      } else if (granularity === 'monthly') {
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
        label = `${monthNames[item._id.month - 1]} ${item._id.year}`
      } else {
        label = `${item._id.year}-${String(item._id.month).padStart(2, '0')}-${String(
          item._id.day,
        ).padStart(2, '0')}`
      }

      return {
        date: label,
        revenue: Math.round(item.revenue * 100) / 100,
        orders: item.orders || 0,
        aov: item.orders > 0 ? Math.round((item.revenue / item.orders) * 100) / 100 : 0,
      }
    })

    res.json({
      success: true,
      data: formattedData,
    })
  } catch (error) {
    console.error('Revenue chart error:', error)
    res.status(500).json({ success: false, message: 'Failed to fetch revenue chart data' })
  }
}

// ============================================================================
// GET TOP SELLERS - Best performing sellers by revenue
// ============================================================================
export const getTopSellers = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, limit = 10 } = req.query
    const range = parseDateRange(startDate as string, endDate as string)

    const topSellers = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: range.start, $lte: range.end },
          paymentStatus: 'paid',
          status: { $nin: ['cancelled', 'refunded'] },
        },
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.seller',
          revenue: { $sum: '$items.subtotal' },
          orders: { $addToSet: '$_id' },
          itemsSold: { $sum: '$items.quantity' },
        },
      },
      {
        $project: {
          _id: 1,
          revenue: 1,
          orderCount: { $size: '$orders' },
          itemsSold: 1,
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: Number(limit) },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'seller',
        },
      },
      { $unwind: '$seller' },
      {
        $project: {
          sellerId: '$_id',
          sellerName: '$seller.name',
          businessName: '$seller.businessName',
          revenue: { $round: ['$revenue', 2] },
          orderCount: 1,
          itemsSold: 1,
        },
      },
    ])

    res.json({
      success: true,
      data: topSellers,
    })
  } catch (error) {
    console.error('Top sellers error:', error)
    res.status(500).json({ success: false, message: 'Failed to fetch top sellers' })
  }
}

// ============================================================================
// GET HIGH RETURN RATE SELLERS - Sellers with concerning return rates
// ============================================================================
export const getHighReturnRateSellers = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, minOrders = 5, limit = 10 } = req.query
    const range = parseDateRange(startDate as string, endDate as string)

    // Get order counts by seller
    const sellerOrders = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: range.start, $lte: range.end },
          paymentStatus: 'paid',
        },
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.seller',
          totalOrders: { $addToSet: '$_id' },
          totalItems: { $sum: '$items.quantity' },
        },
      },
      {
        $project: {
          _id: 1,
          totalOrders: { $size: '$totalOrders' },
          totalItems: 1,
        },
      },
      { $match: { totalOrders: { $gte: Number(minOrders) } } },
    ])

    const sellerIds = sellerOrders.map((s) => s._id)

    // Get return counts by seller
    const sellerReturns = await Return.aggregate([
      {
        $match: {
          seller: { $in: sellerIds },
          createdAt: { $gte: range.start, $lte: range.end },
        },
      },
      {
        $group: {
          _id: '$seller',
          returnCount: { $sum: 1 },
          refundAmount: { $sum: '$refundAmount' },
        },
      },
    ])

    // Combine data
    const returnMap = new Map(sellerReturns.map((r) => [r._id.toString(), r]))

    const sellersWithReturns = sellerOrders
      .map((seller) => {
        const returns = returnMap.get(seller._id.toString()) || {
          returnCount: 0,
          refundAmount: 0,
        }
        // Calculate return rate as percentage and cap at 100%
        const rawReturnRate =
          seller.totalOrders > 0 ? (returns.returnCount / seller.totalOrders) * 100 : 0
        const cappedReturnRate = Math.min(rawReturnRate, 100)
        return {
          sellerId: seller._id,
          totalOrders: seller.totalOrders,
          totalItems: seller.totalItems,
          returnCount: returns.returnCount,
          refundAmount: returns.refundAmount,
          // Round to one decimal place after capping to ensure value never exceeds 100%
          returnRate: Math.round(cappedReturnRate * 10) / 10,
        }
      })
      .filter((s) => s.returnRate > 0)
      .sort((a, b) => b.returnRate - a.returnRate)
      .slice(0, Number(limit))

    // Fetch seller details
    const sellerDetails = await User.find(
      { _id: { $in: sellersWithReturns.map((s) => s.sellerId) } },
      { name: 1, businessName: 1, email: 1 },
    ).lean()

    const sellerMap = new Map(sellerDetails.map((s) => [s._id.toString(), s]))

    const result = sellersWithReturns.map((seller) => {
      const details = sellerMap.get(seller.sellerId.toString())
      return {
        ...seller,
        sellerName: details?.name || 'Unknown',
        businessName: details?.businessName,
        email: details?.email,
      }
    })

    res.json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error('High return rate sellers error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch high return rate sellers',
    })
  }
}

// ============================================================================
// GET ORDER STATUS DISTRIBUTION - Breakdown by status
// ============================================================================
export const getOrderStatusDistribution = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query
    const range = parseDateRange(startDate as string, endDate as string)

    const distribution = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: range.start, $lte: range.end },
        },
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          value: { $sum: '$total' },
        },
      },
      { $sort: { count: -1 } },
    ])

    res.json({
      success: true,
      data: distribution.map((d) => ({
        status: d._id,
        count: d.count,
        value: Math.round(d.value * 100) / 100,
      })),
    })
  } catch (error) {
    console.error('Order status distribution error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch order status distribution',
    })
  }
}

// ============================================================================
// GET PENDING ACTIONS - Items requiring admin attention
// ============================================================================
export const getPendingActions = async (_req: Request, res: Response) => {
  try {
    const [
      pendingSellerApprovals,
      pendingProducts,
      pendingReturns,
      pendingCertificates,
      pendingCategoryRequests,
      pendingReviews,
      lowStockProducts,
    ] = await Promise.all([
      // Pending seller KYC approvals
      User.find(
        { role: 'seller', kycSubmitted: true, isApproved: false },
        { name: 1, businessName: 1, email: 1, createdAt: 1 },
      )
        .sort({ createdAt: 1 })
        .limit(5)
        .lean(),
      // Pending product approvals
      Product.find(
        { status: 'pending_approval' },
        { name: 1, seller: 1, createdAt: 1, mainImage: 1 },
      )
        .populate('seller', 'name businessName')
        .sort({ createdAt: 1 })
        .limit(5)
        .lean(),
      // Pending return requests
      Return.find(
        { status: { $in: ['REQUESTED', 'APPROVED_BY_SELLER'] } },
        { order: 1, seller: 1, reason: 1, refundAmount: 1, createdAt: 1 },
      )
        .populate('order', 'orderNumber')
        .populate('seller', 'name businessName')
        .sort({ createdAt: 1 })
        .limit(5)
        .lean(),
      // Pending certificate approvals
      Certificate.find({ status: 'pending' }, { certificateType: 1, seller: 1, createdAt: 1 })
        .populate('seller', 'name businessName')
        .sort({ createdAt: 1 })
        .limit(5)
        .lean(),
      // Pending category requests
      CategoryRequest.find({ status: 'pending' }, { name: 1, seller: 1, createdAt: 1 })
        .populate('seller', 'name businessName')
        .sort({ createdAt: 1 })
        .limit(5)
        .lean(),
      // Pending review count
      Product.aggregate([
        { $unwind: '$reviews' },
        { $match: { 'reviews.moderationStatus': 'pending' } },
        { $count: 'count' },
      ]),
      // Low stock / out-of-stock products
      Product.find(
        {
          $or: [
            {
              status: 'active',
              $expr: { $lte: ['$stock', '$lowStockThreshold'] },
            },
            { status: 'out_of_stock' },
          ],
        },
        {
          name: 1,
          seller: 1,
          stock: 1,
          totalStock: 1,
          lowStockThreshold: 1,
          lowStockVariants: 1,
          hasVariants: 1,
          status: 1,
          mainImage: 1,
        },
      )
        .populate('seller', 'name businessName')
        .sort({ stock: 1 })
        .limit(5)
        .lean(),
    ])

    res.json({
      success: true,
      data: {
        sellerApprovals: {
          count: await User.countDocuments({
            role: 'seller',
            kycSubmitted: true,
            isApproved: false,
          }),
          items: pendingSellerApprovals,
        },
        productApprovals: {
          count: await Product.countDocuments({ status: 'pending_approval' }),
          items: pendingProducts,
        },
        returnRequests: {
          count: await Return.countDocuments({
            status: { $in: ['REQUESTED', 'APPROVED_BY_SELLER'] },
          }),
          items: pendingReturns,
        },
        certificateApprovals: {
          count: await Certificate.countDocuments({ status: 'pending' }),
          items: pendingCertificates,
        },
        categoryRequests: {
          count: await CategoryRequest.countDocuments({ status: 'pending' }),
          items: pendingCategoryRequests,
        },
        reviewModeration: {
          count: pendingReviews[0]?.count || 0,
        },
        lowStockProducts: {
          count: await Product.countDocuments({
            $or: [
              {
                status: 'active',
                $expr: { $lte: ['$stock', '$lowStockThreshold'] },
              },
              { status: 'out_of_stock' },
            ],
          }),
          items: lowStockProducts,
        },
      },
    })
  } catch (error) {
    console.error('Pending actions error:', error)
    res.status(500).json({ success: false, message: 'Failed to fetch pending actions' })
  }
}

// ============================================================================
// GET TOP SETTLEMENTS - Recent/pending settlement batches
// ============================================================================
export const getTopSettlements = async (req: Request, res: Response) => {
  try {
    const { status, limit = 10 } = req.query

    const query: any = {}
    if (status) query.status = status

    const settlements = await SellerSettlementBatch.find(query)
      .populate('seller', 'name businessName email')
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .lean()

    // Calculate totals
    const totals = await SellerSettlementBatch.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalNetPayout' },
        },
      },
    ])

    res.json({
      success: true,
      data: {
        settlements: settlements.map((s) => ({
          _id: s._id,
          seller: s.seller,
          fromDate: s.fromDate,
          toDate: s.toDate,
          ordersCount: s.ordersCount,
          totalNetPayout: s.totalNetPayout,
          status: s.status,
          invoiceNumber: s.invoiceNumber,
          createdAt: s.createdAt,
        })),
        summary: totals.reduce((acc, t) => {
          acc[t._id.toLowerCase()] = {
            count: t.count,
            totalAmount: t.totalAmount,
          }
          return acc
        }, {} as Record<string, { count: number; totalAmount: number }>),
      },
    })
  } catch (error) {
    console.error('Top settlements error:', error)
    res.status(500).json({ success: false, message: 'Failed to fetch top settlements' })
  }
}

// ============================================================================
// GET PAYMENT METHOD DISTRIBUTION
// ============================================================================
export const getPaymentMethodDistribution = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query
    const range = parseDateRange(startDate as string, endDate as string)

    const distribution = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: range.start, $lte: range.end },
          paymentStatus: 'paid',
        },
      },
      {
        $group: {
          _id: '$paymentMethod',
          count: { $sum: 1 },
          value: { $sum: '$total' },
        },
      },
      { $sort: { value: -1 } },
    ])

    const total = distribution.reduce((sum, d) => sum + d.count, 0)

    res.json({
      success: true,
      data: distribution.map((d) => ({
        method: d._id,
        count: d.count,
        value: Math.round(d.value * 100) / 100,
        percentage: Math.round((d.count / total) * 100 * 10) / 10,
      })),
    })
  } catch (error) {
    console.error('Payment method distribution error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment method distribution',
    })
  }
}

// ============================================================================
// GET TOP CATEGORIES BY REVENUE
// ============================================================================
export const getTopCategories = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, limit = 5 } = req.query
    const range = parseDateRange(startDate as string, endDate as string)

    const topCategories = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: range.start, $lte: range.end },
          paymentStatus: 'paid',
          status: { $nin: ['cancelled', 'refunded'] },
        },
      },
      { $unwind: '$items' },
      {
        $lookup: {
          from: 'products',
          localField: 'items.product',
          foreignField: '_id',
          as: 'product',
        },
      },
      { $unwind: '$product' },
      {
        $group: {
          _id: '$product.category',
          revenue: { $sum: '$items.subtotal' },
          itemsSold: { $sum: '$items.quantity' },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: Number(limit) },
      {
        $lookup: {
          from: 'categories',
          localField: '_id',
          foreignField: '_id',
          as: 'category',
        },
      },
      { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          categoryId: '$_id',
          categoryName: { $ifNull: ['$category.name', 'Uncategorized'] },
          revenue: { $round: ['$revenue', 2] },
          itemsSold: 1,
        },
      },
    ])

    res.json({
      success: true,
      data: topCategories,
    })
  } catch (error) {
    console.error('Top categories error:', error)
    res.status(500).json({ success: false, message: 'Failed to fetch top categories' })
  }
}

// ============================================================================
// GET SELLER HEALTH SCORES
// Combines return rate, order volume and delays into a single score (0–100)
// ============================================================================
export const getSellerHealthScores = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, limit = 20, minOrders = 5 } = req.query
    const range = parseDateRange(startDate as string, endDate as string)

    // Base order stats per seller (use same filters as high-return-rate widget)
    const sellerOrders = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: range.start, $lte: range.end },
          paymentStatus: 'paid',
          status: { $nin: ['cancelled', 'refunded'] },
        },
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.seller',
          orderCount: { $addToSet: '$_id' },
          itemsSold: { $sum: '$items.quantity' },
        },
      },
      {
        $project: {
          _id: 1,
          orderCount: { $size: '$orderCount' },
          itemsSold: 1,
        },
      },
      { $match: { orderCount: { $gte: Number(minOrders) } } },
    ])

    if (!sellerOrders.length) {
      return res.json({ success: true, data: [] })
    }

    const sellerIds = sellerOrders.map((s) => s._id)

    // Return stats per seller (for return rate)
    const sellerReturns = await Return.aggregate([
      {
        $match: {
          seller: { $in: sellerIds },
          createdAt: { $gte: range.start, $lte: range.end },
        },
      },
      {
        $group: {
          _id: '$seller',
          returnCount: { $sum: 1 },
        },
      },
    ])

    const returnMap = new Map(sellerReturns.map((r) => [r._id.toString(), r.returnCount as number]))

    const sellersWithHealth = sellerOrders.map((s) => {
      const totalOrders = s.orderCount as number
      const returns = returnMap.get(s._id.toString()) || 0
      const returnRate = totalOrders > 0 ? (returns / totalOrders) * 100 : 0

      // Simple health score: start from 100 and penalize high return rates.
      // You can later extend this to include delays, cancellations, etc.
      let score = 100
      if (returnRate >= 20) score -= 40
      else if (returnRate >= 15) score -= 30
      else if (returnRate >= 10) score -= 20
      else if (returnRate >= 5) score -= 10

      // More orders = more reliable sample -> small bonus
      if (totalOrders >= 50) score += 5
      else if (totalOrders >= 20) score += 2

      score = Math.max(0, Math.min(100, score))

      return {
        sellerId: s._id,
        totalOrders,
        itemsSold: s.itemsSold,
        returns,
        returnRate: Math.round(returnRate * 10) / 10,
        healthScore: score,
      }
    })

    // Fetch seller details
    const sellerDetails = await User.find(
      { _id: { $in: sellersWithHealth.map((s) => s.sellerId) } },
      { name: 1, businessName: 1, email: 1 },
    ).lean()

    const sellerMap = new Map(sellerDetails.map((s) => [s._id.toString(), s]))

    const result = sellersWithHealth
      .map((s) => {
        const details = sellerMap.get(s.sellerId.toString())
        return {
          ...s,
          sellerName: details?.name || 'Unknown',
          businessName: details?.businessName,
          email: details?.email,
        }
      })
      .sort((a, b) => b.healthScore - a.healthScore)
      .slice(0, Number(limit))

    res.json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error('Seller health scores error:', error)
    res.status(500).json({ success: false, message: 'Failed to fetch seller health scores' })
  }
}

// ============================================================================
// GET RETURN REASON BREAKDOWN
// ============================================================================
export const getReturnReasonBreakdown = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query
    const range = parseDateRange(startDate as string, endDate as string)

    const breakdown = await Return.aggregate([
      {
        $match: {
          createdAt: { $gte: range.start, $lte: range.end },
        },
      },
      {
        $group: {
          _id: '$reason',
          count: { $sum: 1 },
          refundAmount: { $sum: '$refundAmount' },
        },
      },
      { $sort: { count: -1 } },
    ])

    const totalCount = breakdown.reduce((sum, r) => sum + r.count, 0)

    res.json({
      success: true,
      data: breakdown.map((r) => ({
        reason: r._id,
        count: r.count,
        refundAmount: r.refundAmount,
        percentage: totalCount ? Math.round((r.count / totalCount) * 100 * 10) / 10 : 0,
      })),
    })
  } catch (error) {
    console.error('Return reason breakdown error:', error)
    res.status(500).json({ success: false, message: 'Failed to fetch return reason breakdown' })
  }
}

// ============================================================================
// GET PROFIT BY CATEGORY - Platform profit (after settlement) grouped by category
// ============================================================================
export const getProfitByCategory = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, limit = 5 } = req.query
    const range = parseDateRange(startDate as string, endDate as string)

    // Step 1: compute per-order, per-seller profit from ledger entries
    const profitByCategory = await SellerLedgerEntry.aggregate([
      {
        $match: {
          createdAt: { $gte: range.start, $lte: range.end },
          order: { $ne: null },
        },
      },
      {
        $group: {
          _id: { seller: '$seller', order: '$order' },
          orderProfit: {
            $sum: {
              $switch: {
                branches: [
                  // Earnings
                  {
                    case: {
                      $and: [
                        { $eq: ['$entryType', 'CREDIT'] },
                        { $eq: ['$reason', 'ORDER_EARNING'] },
                      ],
                    },
                    then: '$amount',
                  },
                  {
                    case: {
                      $and: [
                        { $eq: ['$entryType', 'CREDIT'] },
                        { $eq: ['$reason', 'SHIPPING_EARNING'] },
                      ],
                    },
                    then: '$amount',
                  },
                  // Costs / fees (negative)
                  {
                    case: {
                      $and: [{ $eq: ['$entryType', 'DEBIT'] }, { $eq: ['$reason', 'COMMISSION'] }],
                    },
                    then: { $multiply: ['$amount', -1] },
                  },
                  {
                    case: {
                      $and: [
                        { $eq: ['$entryType', 'DEBIT'] },
                        { $eq: ['$reason', 'SHIPPING_COURIER_COST'] },
                      ],
                    },
                    then: { $multiply: ['$amount', -1] },
                  },
                  {
                    case: {
                      $and: [{ $eq: ['$entryType', 'DEBIT'] }, { $eq: ['$reason', 'PG_FEE'] }],
                    },
                    then: { $multiply: ['$amount', -1] },
                  },
                  {
                    case: {
                      $and: [
                        { $eq: ['$entryType', 'DEBIT'] },
                        { $in: ['$reason', ['RETURN_ITEM_REVERSAL', 'RETURN_SHIPPING_REVERSAL']] },
                      ],
                    },
                    then: { $multiply: ['$amount', -1] },
                  },
                  {
                    case: {
                      $and: [
                        { $eq: ['$entryType', 'DEBIT'] },
                        { $eq: ['$reason', 'MANUAL_ADJUSTMENT'] },
                      ],
                    },
                    then: { $multiply: ['$amount', -1] },
                  },
                  // Commission reversal (positive)
                  {
                    case: {
                      $and: [
                        { $eq: ['$entryType', 'CREDIT'] },
                        { $eq: ['$reason', 'COMMISSION_REVERSAL'] },
                      ],
                    },
                    then: '$amount',
                  },
                ],
                default: 0,
              },
            },
          },
        },
      },
      // Step 2: join orders and keep only items for this seller
      {
        $lookup: {
          from: 'orders',
          localField: '_id.order',
          foreignField: '_id',
          as: 'order',
        },
      },
      { $unwind: '$order' },
      {
        $addFields: {
          items: {
            $filter: {
              input: '$order.items',
              as: 'item',
              cond: { $eq: ['$$item.seller', '$_id.seller'] },
            },
          },
        },
      },
      {
        $addFields: {
          itemCount: { $size: '$items' },
        },
      },
      // Ignore orders where we can't map profit to any items
      {
        $match: {
          itemCount: { $gt: 0 },
        },
      },
      // Step 3: allocate order profit equally across this seller's items
      {
        $addFields: {
          perItemProfit: {
            $cond: [{ $gt: ['$itemCount', 0] }, { $divide: ['$orderProfit', '$itemCount'] }, 0],
          },
        },
      },
      { $unwind: '$items' },
      // Step 4: join products and categories for each item
      {
        $lookup: {
          from: 'products',
          localField: 'items.product',
          foreignField: '_id',
          as: 'product',
        },
      },
      { $unwind: '$product' },
      {
        $lookup: {
          from: 'categories',
          localField: 'product.category',
          foreignField: '_id',
          as: 'category',
        },
      },
      { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
      // Step 5: aggregate profit by category
      {
        $group: {
          _id: '$category._id',
          categoryName: { $first: { $ifNull: ['$category.name', 'Uncategorized'] } },
          profit: { $sum: '$perItemProfit' },
        },
      },
      {
        $project: {
          _id: 0,
          categoryId: '$_id',
          categoryName: 1,
          profit: { $round: ['$profit', 2] },
        },
      },
      { $sort: { profit: -1 } },
      { $limit: Number(limit) },
    ])

    res.json({
      success: true,
      data: profitByCategory,
    })
  } catch (error) {
    console.error('Profit by category error:', error)
    res.status(500).json({ success: false, message: 'Failed to fetch profit by category' })
  }
}

// ============================================================================
// GET COURIER CHARGES SUMMARY - Total courier charges for the period
// ============================================================================
export const getCourierChargesSummary = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query
    const range = parseDateRange(startDate as string, endDate as string)

    // Get Forward shipments (delivered/shipped) - sum allocated courierCharge
    // Use allocated courierCharge (order-level) to avoid double counting
    const forwardCharges = await Order.aggregate([
      {
        $match: {
          $or: [
            { 'sellerShipments.shippedAt': { $gte: range.start, $lte: range.end } },
            { 'sellerShipments.createdAt': { $gte: range.start, $lte: range.end } },
          ],
        },
      },
      { $unwind: '$sellerShipments' },
      {
        $match: {
          $and: [
            {
              $or: [
                { 'sellerShipments.shippedAt': { $gte: range.start, $lte: range.end } },
                { 'sellerShipments.createdAt': { $gte: range.start, $lte: range.end } },
              ],
            },
            {
              $or: [
                { 'sellerShipments.shippingMeta.awb': { $exists: true, $ne: null } },
                { 'sellerShipments.courierCart.awb_number': { $exists: true, $ne: null } },
              ],
            },
            {
              $or: [
                { 'sellerShipments.status': 'delivered' },
                { 'sellerShipments.status': 'shipped' },
                { 'sellerShipments.status': 'in_transit' },
                { 'sellerShipments.status': 'pickup_requested' },
              ],
            },
          ],
        },
      },
      {
        $group: {
          _id: null,
          total: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ['$sellerShipments.courierCharge', null] },
                    { $ne: ['$sellerShipments.courierCharge', undefined] },
                  ],
                },
                '$sellerShipments.courierCharge',
                0,
              ],
            },
          },
        },
      },
    ])

    // Get RTO shipments (cancelled/undelivered) - sum allocated courierCharge
    // Use allocated courierCharge (order-level) to avoid double counting
    const rtoCharges = await Order.aggregate([
      {
        $match: {
          $or: [
            { 'sellerShipments.shippedAt': { $gte: range.start, $lte: range.end } },
            { 'sellerShipments.createdAt': { $gte: range.start, $lte: range.end } },
          ],
        },
      },
      { $unwind: '$sellerShipments' },
      {
        $match: {
          $and: [
            {
              $or: [
                { 'sellerShipments.shippedAt': { $gte: range.start, $lte: range.end } },
                { 'sellerShipments.createdAt': { $gte: range.start, $lte: range.end } },
              ],
            },
            {
              $or: [
                { 'sellerShipments.shippingMeta.awb': { $exists: true, $ne: null } },
                { 'sellerShipments.courierCart.awb_number': { $exists: true, $ne: null } },
              ],
            },
            {
              $or: [
                { 'sellerShipments.status': 'cancelled' },
                { 'sellerShipments.status': 'undelivered' },
              ],
            },
          ],
        },
      },
      {
        $group: {
          _id: null,
          total: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ['$sellerShipments.courierCharge', null] },
                    { $ne: ['$sellerShipments.courierCharge', undefined] },
                  ],
                },
                '$sellerShipments.courierCharge',
                0,
              ],
            },
          },
        },
      },
    ])

    // Get Return shipments - sum reverseCharges
    const returnCharges = await Return.aggregate([
      {
        $match: {
          createdAt: { $gte: range.start, $lte: range.end },
          courierReverseAwb: { $exists: true, $ne: null },
        },
      },
      {
        $group: {
          _id: null,
          total: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ['$reverseCharges', null] },
                    { $ne: ['$reverseCharges', undefined] },
                  ],
                },
                '$reverseCharges',
                0,
              ],
            },
          },
        },
      },
    ])

    const forwardTotal = forwardCharges[0]?.total || 0
    const rtoTotal = rtoCharges[0]?.total || 0
    const returnTotal = returnCharges[0]?.total || 0
    const totalCharges = forwardTotal + rtoTotal + returnTotal

    res.json({
      success: true,
      data: {
        totalCourierCharges: totalCharges,
        forwardCharges: forwardTotal,
        rtoCharges: rtoTotal,
        returnCharges: returnTotal,
        rtoAndReturnCharges: rtoTotal + returnTotal,
      },
    })
  } catch (error) {
    console.error('Courier charges summary error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch courier charges summary',
    })
  }
}
