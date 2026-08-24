import API from './axiosInstance'

export interface DashboardOverview {
  availableBalance: number
  nextSettlement: {
    amount: number
    expectedDate: string
    status: 'SCHEDULED' | 'BLOCKED'
    batchId: string
  } | null
  lastSettlement: {
    amount: number
    paidDate: string | null
    status: 'PAID'
    batchId: string
    invoiceUrl: string | null
    invoiceNumber: string | null
  } | null
  upcomingSettlement: {
    estimatedAmount: number
    cutOffDate: string | null
    expectedPayoutDate: string
  } | null
  grossSales: number
  ordersCount: number
  isSettlementBlocked: boolean
  blockingReasons: string[]
  actionRequired: {
    pendingShipments: number
    returnsAwaitingAction: number
    slaRiskOrders: number
    lowInventorySkus: number
    kycBankIncomplete: number
  }
  ordersOverview: {
    pending: number
    shipped: number
    delivered: number
    returned: number
  }
  returnsOverview: {
    requested: number
    approved: number
    completed: number
  }
  performance: {
    cancellationRate: {
      value: number
      status: 'good' | 'needs_attention' | 'at_risk'
    }
    returnRate: {
      value: number
      status: 'good' | 'needs_attention' | 'at_risk'
    }
    slaCompliance: {
      value: number
      status: 'good' | 'needs_attention' | 'at_risk'
    }
    sellerRating: {
      value: number
      status: 'good' | 'needs_attention' | 'at_risk'
    }
  }
  topSellingProducts: {
    last7Days: Array<{
      productId: string
      sku: string
      productName: string
      productImage: string | null
      unitsSold: number
      revenue: number
    }>
    last30Days: Array<{
      productId: string
      sku: string
      productName: string
      productImage: string | null
      unitsSold: number
      revenue: number
    }>
  }
  salesTrend: {
    last7Days: Array<{
      date: string
      sales: number
      orders: number
    }>
    last30Days: Array<{
      date: string
      sales: number
      orders: number
    }>
  }
  ordersReturnsTrend: Array<{
    date: string
    orders: number
    returns: number
    returnReasons?: Record<string, number>
  }>
  returnReasonsBreakdown: {
    totalReturns: number
    breakdown: Array<{
      reason: string
      count: number
      percentage: number
    }>
  } | null
  inventoryVelocity: Array<{
    productId: string
    sku: string
    productName: string
    totalUnitsSold: number
    unitsPerDay: number
  }>
}

export interface DashboardOverviewResponse {
  success: boolean
  data: DashboardOverview
}

export const fetchDashboardOverview = async (): Promise<DashboardOverviewResponse> => {
  const response = await API.get('/dashboard/overview')
  return response.data
}
