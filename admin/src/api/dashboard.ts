import { useQuery } from '@tanstack/react-query'
import API from './axiosInstance'

// ============================================================================
// TYPES
// ============================================================================

export interface DateRange {
  startDate?: string
  endDate?: string
}

export interface MetricWithChange {
  value: number
  change: number
  previousValue: number
}

export interface DashboardSummary {
  gmv: MetricWithChange
  profit: MetricWithChange
  orders: MetricWithChange
  aov: MetricWithChange
  sellers: {
    total: number
    active: number
    pendingApproval: number
  }
  lowStockProducts: number
  dateRange: {
    start: string
    end: string
  }
}

export interface CourierChargesSummary {
  totalCourierCharges: number
  forwardCharges: number
  rtoCharges: number
  returnCharges: number
  rtoAndReturnCharges: number
}

export interface RevenueChartData {
  date: string
  revenue: number
  orders: number
  aov: number
}

export interface TopSeller {
  sellerId: string
  sellerName: string
  businessName?: string
  revenue: number
  orderCount: number
  itemsSold: number
}

export interface HighReturnSeller {
  sellerId: string
  sellerName: string
  businessName?: string
  email?: string
  totalOrders: number
  totalItems: number
  returnCount: number
  refundAmount: number
  returnRate: number
}

export interface OrderStatusItem {
  status: string
  count: number
  value: number
}

export interface PendingActionItem {
  _id: string
  name?: string
  businessName?: string
  email?: string
  createdAt?: string
  orderNumber?: string
  reason?: string
  refundAmount?: number
  certificateType?: string
  mainImage?: string
  seller?: {
    _id?: string
    name?: string
    businessName?: string
  }
  order?: {
    _id?: string
    orderNumber?: string
  }
}

export interface PendingActionsData {
  sellerApprovals: { count: number; items: PendingActionItem[] }
  productApprovals: { count: number; items: PendingActionItem[] }
  returnRequests: { count: number; items: PendingActionItem[] }
  certificateApprovals: { count: number; items: PendingActionItem[] }
  categoryRequests: { count: number; items: PendingActionItem[] }
  reviewModeration: { count: number }
  lowStockProducts: { count: number; items: PendingActionItem[] }
}

export interface SettlementItem {
  _id: string
  seller: {
    _id: string
    name?: string
    businessName?: string
    email?: string
  }
  fromDate: string
  toDate: string
  ordersCount: number
  totalNetPayout: number
  status: 'PENDING' | 'PAID'
  invoiceNumber?: string
  createdAt: string
}

export interface SettlementsData {
  settlements: SettlementItem[]
  summary: Record<string, { count: number; totalAmount: number }>
}

export interface PaymentMethodItem {
  method: string
  count: number
  value: number
  percentage: number
}

export interface TopCategory {
  categoryId: string
  categoryName: string
  revenue: number
  itemsSold: number
}

export interface ProfitByCategoryItem {
  categoryId: string
  categoryName: string
  profit: number
}

export interface ReturnReasonItem {
  reason: string
  count: number
  refundAmount: number
  percentage: number
}

export interface SellerHealthItem {
  sellerId: string
  sellerName: string
  businessName?: string
  email?: string
  totalOrders: number
  itemsSold: number
  returns: number
  returnRate: number
  healthScore: number
}

// ============================================================================
// API HOOKS
// ============================================================================

export const useDashboardSummary = (params?: DateRange) =>
  useQuery<DashboardSummary>({
    queryKey: ['dashboard-summary', params],
    queryFn: async () => {
      const { data } = await API.get('/admin/dashboard/summary', { params })
      return data.data
    },
    refetchInterval: 60000, // Refresh every minute
  })

export const useRevenueChart = (
  params?: DateRange & { granularity?: 'daily' | 'weekly' | 'monthly' },
) =>
  useQuery<RevenueChartData[]>({
    queryKey: ['dashboard-revenue-chart', params],
    queryFn: async () => {
      const { data } = await API.get('/admin/dashboard/revenue-chart', { params })
      return data.data
    },
  })

export const useTopSellers = (params?: DateRange & { limit?: number }) =>
  useQuery<TopSeller[]>({
    queryKey: ['dashboard-top-sellers', params],
    queryFn: async () => {
      const { data } = await API.get('/admin/dashboard/top-sellers', { params })
      return data.data
    },
  })

export const useHighReturnSellers = (params?: DateRange & { minOrders?: number; limit?: number }) =>
  useQuery<HighReturnSeller[]>({
    queryKey: ['dashboard-high-return-sellers', params],
    queryFn: async () => {
      const { data } = await API.get('/admin/dashboard/high-return-sellers', { params })
      return data.data
    },
  })

export const useOrderStatusDistribution = (params?: DateRange) =>
  useQuery<OrderStatusItem[]>({
    queryKey: ['dashboard-order-status', params],
    queryFn: async () => {
      const { data } = await API.get('/admin/dashboard/order-status', { params })
      return data.data
    },
  })

export const usePendingActions = () =>
  useQuery<PendingActionsData>({
    queryKey: ['dashboard-pending-actions'],
    queryFn: async () => {
      const { data } = await API.get('/admin/dashboard/pending-actions')
      return data.data
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  })

export const useTopSettlements = (params?: { status?: 'PENDING' | 'PAID'; limit?: number }) =>
  useQuery<SettlementsData>({
    queryKey: ['dashboard-settlements', params],
    queryFn: async () => {
      const { data } = await API.get('/admin/dashboard/settlements', { params })
      return data.data
    },
  })

export const usePaymentMethodDistribution = (params?: DateRange) =>
  useQuery<PaymentMethodItem[]>({
    queryKey: ['dashboard-payment-methods', params],
    queryFn: async () => {
      const { data } = await API.get('/admin/dashboard/payment-methods', { params })
      return data.data
    },
  })

export const useTopCategories = (params?: DateRange & { limit?: number }) =>
  useQuery<TopCategory[]>({
    queryKey: ['dashboard-top-categories', params],
    queryFn: async () => {
      const { data } = await API.get('/admin/dashboard/top-categories', { params })
      return data.data
    },
  })

export const useProfitByCategory = (params?: DateRange & { limit?: number }) =>
  useQuery<ProfitByCategoryItem[]>({
    queryKey: ['dashboard-profit-by-category', params],
    queryFn: async () => {
      const { data } = await API.get('/admin/dashboard/profit-by-category', { params })
      return data.data
    },
  })

export const useReturnReasonBreakdown = (params?: DateRange) =>
  useQuery<ReturnReasonItem[]>({
    queryKey: ['dashboard-return-reasons', params],
    queryFn: async () => {
      const { data } = await API.get('/admin/dashboard/return-reasons', { params })
      return data.data
    },
  })

export const useSellerHealthScores = (
  params?: DateRange & { limit?: number; minOrders?: number },
) =>
  useQuery<SellerHealthItem[]>({
    queryKey: ['dashboard-seller-health', params],
    queryFn: async () => {
      const { data } = await API.get('/admin/dashboard/seller-health', { params })
      return data.data
    },
  })

export const useCourierChargesSummary = (params?: DateRange) =>
  useQuery<CourierChargesSummary>({
    queryKey: ['dashboard-courier-charges-summary', params],
    queryFn: async () => {
      const { data } = await API.get('/admin/dashboard/courier-charges-summary', { params })
      return data.data
    },
  })
