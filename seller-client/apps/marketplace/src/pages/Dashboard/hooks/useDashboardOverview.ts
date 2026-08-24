import { useQuery } from '@tanstack/react-query'
import { fetchDashboardOverview, type DashboardOverviewResponse } from '../../../api/dashboard'
import { useAuthStore } from '../../../store/authStore'

const trend = [18, 22, 19, 31, 28, 38, 46].map((orders, index) => {
  const date = new Date()
  date.setDate(date.getDate() - (6 - index))
  return { date: date.toISOString().slice(0, 10), orders, sales: orders * 1380 }
})

const DEMO_DASHBOARD: DashboardOverviewResponse = {
  success: true,
  data: {
    availableBalance: 86420,
    nextSettlement: {
      amount: 42780,
      expectedDate: new Date(Date.now() + 3 * 86400000).toISOString(),
      status: 'SCHEDULED',
      batchId: 'KB-DEMO-2408',
    },
    lastSettlement: {
      amount: 38950,
      paidDate: new Date(Date.now() - 4 * 86400000).toISOString(),
      status: 'PAID',
      batchId: 'KB-DEMO-2308',
      invoiceUrl: null,
      invoiceNumber: 'KB-INV-DEMO-023',
    },
    upcomingSettlement: {
      estimatedAmount: 51640,
      cutOffDate: new Date(Date.now() + 86400000).toISOString(),
      expectedPayoutDate: new Date(Date.now() + 6 * 86400000).toISOString(),
    },
    grossSales: 486320,
    ordersCount: 352,
    isSettlementBlocked: false,
    blockingReasons: [],
    actionRequired: {
      pendingShipments: 7,
      returnsAwaitingAction: 2,
      slaRiskOrders: 1,
      lowInventorySkus: 4,
      kycBankIncomplete: 0,
    },
    ordersOverview: { pending: 12, shipped: 48, delivered: 276, returned: 16 },
    returnsOverview: { requested: 5, approved: 3, completed: 11 },
    performance: {
      cancellationRate: { value: 1.2, status: 'good' },
      returnRate: { value: 4.5, status: 'good' },
      slaCompliance: { value: 97.8, status: 'good' },
      sellerRating: { value: 4.8, status: 'good' },
    },
    topSellingProducts: {
      last7Days: [
        { productId: 'demo-1', sku: 'NS-TOTE-01', productName: 'Everyday Canvas Tote', productImage: null, unitsSold: 84, revenue: 67116 },
        { productId: 'demo-2', sku: 'NS-BTL-02', productName: 'Insulated Travel Bottle', productImage: null, unitsSold: 61, revenue: 54839 },
        { productId: 'demo-3', sku: 'NS-ORG-03', productName: 'Desk Organiser Set', productImage: null, unitsSold: 43, revenue: 38657 },
      ],
      last30Days: [
        { productId: 'demo-1', sku: 'NS-TOTE-01', productName: 'Everyday Canvas Tote', productImage: null, unitsSold: 286, revenue: 228514 },
        { productId: 'demo-2', sku: 'NS-BTL-02', productName: 'Insulated Travel Bottle', productImage: null, unitsSold: 219, revenue: 196881 },
        { productId: 'demo-3', sku: 'NS-ORG-03', productName: 'Desk Organiser Set', productImage: null, unitsSold: 172, revenue: 154628 },
      ],
    },
    salesTrend: { last7Days: trend, last30Days: trend },
    ordersReturnsTrend: trend.map(({ date, orders }) => ({
      date,
      orders,
      returns: Math.max(1, Math.round(orders * 0.045)),
    })),
    returnReasonsBreakdown: {
      totalReturns: 16,
      breakdown: [
        { reason: 'Size or fit', count: 7, percentage: 43.75 },
        { reason: 'Changed mind', count: 5, percentage: 31.25 },
        { reason: 'Transit damage', count: 4, percentage: 25 },
      ],
    },
    inventoryVelocity: [
      { productId: 'demo-1', sku: 'NS-TOTE-01', productName: 'Everyday Canvas Tote', totalUnitsSold: 286, unitsPerDay: 9.5 },
      { productId: 'demo-2', sku: 'NS-BTL-02', productName: 'Insulated Travel Bottle', totalUnitsSold: 219, unitsPerDay: 7.3 },
      { productId: 'demo-3', sku: 'NS-ORG-03', productName: 'Desk Organiser Set', totalUnitsSold: 172, unitsPerDay: 5.7 },
    ],
  },
}

export const useDashboardOverview = () => {
  const isDemo = useAuthStore((state) => Boolean(state.user?.isDemo))

  return useQuery({
    queryKey: ['dashboardOverview'],
    queryFn: fetchDashboardOverview,
    enabled: !isDemo,
    initialData: isDemo ? DEMO_DASHBOARD : undefined,
    staleTime: 30000, // Consider data fresh for 30 seconds
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    refetchOnWindowFocus: true, // Refetch when seller returns to tab so new orders show up
  })
}

