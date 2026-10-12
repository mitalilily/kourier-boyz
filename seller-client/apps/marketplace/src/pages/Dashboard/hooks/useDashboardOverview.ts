import { useQuery } from '@tanstack/react-query'
import { fetchDashboardOverview, type DashboardOverviewResponse } from '../../../api/dashboard'
import { useAuthStore } from '../../../store/authStore'

const EMPTY_DEMO_DASHBOARD: DashboardOverviewResponse = {
  success: true,
  data: {
    availableBalance: 0,
    nextSettlement: null,
    lastSettlement: null,
    upcomingSettlement: null,
    grossSales: 0,
    ordersCount: 0,
    isSettlementBlocked: false,
    blockingReasons: [],
    actionRequired: {
      pendingShipments: 0,
      returnsAwaitingAction: 0,
      slaRiskOrders: 0,
      lowInventorySkus: 0,
      kycBankIncomplete: 0,
    },
    ordersOverview: { pending: 0, shipped: 0, delivered: 0, returned: 0 },
    returnsOverview: { requested: 0, approved: 0, completed: 0 },
    performance: {
      cancellationRate: { value: 0, status: 'good' },
      returnRate: { value: 0, status: 'good' },
      slaCompliance: { value: 0, status: 'good' },
      sellerRating: { value: 0, status: 'good' },
    },
    topSellingProducts: { last7Days: [], last30Days: [] },
    salesTrend: { last7Days: [], last30Days: [] },
    ordersReturnsTrend: [],
    returnReasonsBreakdown: { totalReturns: 0, breakdown: [] },
    inventoryVelocity: [],
  },
}

export const useDashboardOverview = () => {
  const isDemo = useAuthStore((state) => Boolean(state.user?.isDemo))

  return useQuery({
    queryKey: ['dashboardOverview'],
    queryFn: fetchDashboardOverview,
    enabled: !isDemo,
    initialData: isDemo ? EMPTY_DEMO_DASHBOARD : undefined,
    staleTime: 30000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  })
}
