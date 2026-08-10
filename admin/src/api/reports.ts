import API from './axiosInstance'

export type GroupingType = 'seller' | 'state' | 'category' | 'product' | 'date'
export type DateGroupingType = 'daily' | 'weekly' | 'monthly'

export interface SalesReportRow {
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

export interface SalesReportTotals {
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

export interface SalesReportParams {
  fromDate?: string
  toDate?: string
  seller?: string
  sellerState?: string
  category?: string
  orderStatus?: string
  paymentMethod?: string
  grouping?: GroupingType
  dateGrouping?: DateGroupingType
}

export interface SalesReportResponse {
  success: boolean
  data: {
    rows: SalesReportRow[]
    totals: SalesReportTotals
    grouping: GroupingType
    dateGrouping?: DateGroupingType
    filters: SalesReportParams
  }
}

export const fetchSalesReport = async (params?: SalesReportParams): Promise<SalesReportResponse> => {
  const response = await API.get('/admin/reports/sales', { params })
  return response.data
}

export interface SettlementDueReportRow {
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

export interface SettlementDueReportParams {
  seller?: string
  settlementCycle?: string
  dueDateFrom?: string
  dueDateTo?: string
  amountFrom?: string
  amountTo?: string
  status?: 'PENDING' | 'ALL'
}

export interface SettlementDueReportResponse {
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
    note?: string
    sellerLedgerBalance?: number // Current ledger balance (only when seller filter is applied)
  }
}

export const fetchSettlementDueReport = async (
  params?: SettlementDueReportParams,
): Promise<SettlementDueReportResponse> => {
  const response = await API.get('/admin/reports/settlement-due', { params })
  return response.data
}

export interface CourierChargesReportRow {
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
  shipmentDate: string | null
  status: string
}

export interface CourierChargesReportParams {
  fromDate?: string
  toDate?: string
  seller?: string
  courierPartner?: string
  shipmentType?: 'Forward' | 'RTO' | 'Return'
  awb?: string
  orderId?: string | string[] // Support single or multiple order IDs
}

export interface CourierChargesReportResponse {
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

export const fetchCourierChargesReport = async (
  params?: CourierChargesReportParams,
): Promise<CourierChargesReportResponse> => {
  const response = await API.get('/admin/reports/courier-charges', { params })
  return response.data
}

export interface PortalIncomeOrderDetail {
  orderId: string
  sellerName: string
  incomeType: string
  baseAmount: number
  gstAmount: number
  netAmount: number
  settlementBatchId?: string
}

export interface PortalIncomeSummaryRow {
  date: string
  incomeType: string
  grossIncome: number
  gstOnIncome: number
  netPortalIncome: number
  orderDetails?: PortalIncomeOrderDetail[]
}

export interface PortalIncomeReportParams {
  fromDate?: string
  toDate?: string
  seller?: string
  incomeType?: string
  settlementStatus?: 'PAID' | 'PENDING' | 'ALL'
  orderId?: string
}

export interface PortalIncomeReportResponse {
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

export const fetchPortalIncomeReport = async (
  params?: PortalIncomeReportParams,
): Promise<PortalIncomeReportResponse> => {
  const response = await API.get('/admin/reports/portal-income', { params })
  return response.data
}

// TDS Report
export interface TdsReportRow {
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

export interface TdsReportParams {
  financialYear?: string
  seller?: string
  settlementStatus?: 'ALL' | 'PAID' | 'PENDING'
}

export interface TdsReportResponse {
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

export const fetchTdsReport = async (params?: TdsReportParams): Promise<TdsReportResponse> => {
  const response = await API.get('/admin/reports/tds', { params })
  return response.data
}

// TCS Report
export interface TcsReportRow {
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

export interface TcsReportParams {
  financialYear?: string
  seller?: string
  sellerState?: string
  customerType?: 'Registered' | 'Unregistered' | 'ALL'
  settlementStatus?: 'ALL' | 'PAID' | 'PENDING'
}

export interface TcsReportResponse {
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

export const fetchTcsReport = async (params?: TcsReportParams): Promise<TcsReportResponse> => {
  const response = await API.get('/admin/reports/tcs', { params })
  return response.data
}

// New Seller Registration Report
export interface NewSellerReportRow {
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

export interface NewSellerReportParams {
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

export interface NewSellerReportResponse {
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

export const fetchNewSellerRegistrationReport = async (
  params?: NewSellerReportParams,
): Promise<NewSellerReportResponse> => {
  const response = await API.get('/admin/reports/new-sellers', { params })
  return response.data
}


// Ticket System Report
export interface TicketSystemReportRow {
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

export interface TicketSystemReportMetrics {
  totalTickets: number
  openTickets: number
  closedTickets: number
  slaBreachedTickets: number
  slaBreachedPercentage: number
  avgResolutionTime: number
  ticketsByRole: Record<string, number>
  ticketsByCategory: Record<string, number>
}

export interface TicketSystemReportParams {
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

export interface TicketSystemReportResponse {
  success: boolean
  data: {
    rows: TicketSystemReportRow[]
    metrics: TicketSystemReportMetrics
    filters: TicketSystemReportParams
  }
}

export const fetchTicketSystemReport = async (
  params?: TicketSystemReportParams,
): Promise<TicketSystemReportResponse> => {
  const response = await API.get('/admin/reports/tickets', { params })
  return response.data
}

// Sales Pending Status Report
export interface TATStatus {
  stage: 'acceptance' | 'awb' | 'pickup'
  pendingSinceHours: number
  deadline: string
  slaStatus: 'within_tat' | 'breached'
  tatHours: number
}

export interface SalesPendingStatusRow {
  orderId: string
  orderNumber?: string
  sellerId: string
  sellerName?: string
  createdAt: string
  acceptedAt?: string
  acceptanceTAT?: TATStatus
  awbTAT?: TATStatus
  pickupTAT?: TATStatus
  currentStage: 'pending_acceptance' | 'pending_awb' | 'pending_pickup' | 'completed'
  courier?: string
  orderTotal?: number
}

export interface SalesPendingStatusParams {
  seller?: string
  courier?: string
  pendingStage?: 'acceptance' | 'awb' | 'pickup'
  slaStatus?: 'within_tat' | 'breached'
  fromDate?: string
  toDate?: string
  page?: number
  limit?: number
}

export interface SalesPendingStatusResponse {
  success: boolean
  data: {
    rows: SalesPendingStatusRow[]
    summary: {
      totalPending: number
      pendingAcceptance: number
      pendingAWB: number
      pendingPickup: number
      breachedSLA: number
      withinSLA: number
    }
    pagination?: {
      page: number
      limit: number
      total: number
      totalPages: number
    }
    filters: SalesPendingStatusParams
  }
}

export const fetchSalesPendingStatusReport = async (
  params?: SalesPendingStatusParams,
): Promise<SalesPendingStatusResponse> => {
  const response = await API.get('/admin/reports/sales-pending-status', { params })
  return response.data
}

// SLA Dashboard Metrics
export interface SLADashboardMetrics {
  period: 'today' | 'mtd' | 'ytd'
  metrics: {
    pendingAWB: number
    pendingPickup: number
    breachedAWBSLA: number
    breachedPickupSLA: number
    totalBreachedSLA: number
  }
}

export interface SLADashboardMetricsResponse {
  success: boolean
  data: SLADashboardMetrics
}

export const fetchSLADashboardMetrics = async (
  period?: 'today' | 'mtd' | 'ytd',
): Promise<SLADashboardMetricsResponse> => {
  const response = await API.get('/admin/reports/sla-metrics', { params: { period } })
  return response.data
}

// SLA Reminder System API
export interface BreachedSLAParams {
  seller?: string
  slaType?: 'AWB' | 'DISPATCH'
  status?: 'ACTIVE' | 'RESOLVED'
  fromDate?: string
  toDate?: string
  page?: number
  limit?: number
}

export interface BreachedSLARow {
  _id: string
  orderId: string
  orderNumber?: string
  sellerId: string
  sellerName?: string
  slaType: 'AWB' | 'DISPATCH'
  status: 'ACTIVE' | 'RESOLVED'
  startTime: string
  dueTime: string
  breachedAt?: string
  breachDuration: number
  reminderCount: number
  lastReminderSentAt?: string
  lastReminderType?: 'AUTO' | 'MANUAL'
  lastReminderSentBy?: string
  currentOrderStatus?: string
  currentShipmentStatus?: string
  resolvedAt?: string
  resolvedReason?: 'AWB_GENERATED' | 'DISPATCHED' | 'CANCELLED' | 'RTO'
}

export interface BreachedSLAResponse {
  success: boolean
  data: {
    rows: BreachedSLARow[]
    pagination: {
      page: number
      limit: number
      total: number
      totalPages: number
    }
  }
}

export const fetchBreachedSLAs = async (
  params?: BreachedSLAParams,
): Promise<BreachedSLAResponse> => {
  const response = await API.get('/sla/admin/breached', { params })
  return response.data
}

export interface SendReminderRequest {
  slaTrackingId?: string
  orderId?: string
  sellerId?: string
  slaType?: 'AWB' | 'DISPATCH'
  customMessage?: string
}

export const sendManualReminder = async (
  request: SendReminderRequest,
): Promise<{ success: boolean; message?: string }> => {
  const response = await API.post('/sla/admin/reminder', request)
  return response.data
}

export interface SLABreachReportParams {
  seller?: string
  slaType?: 'AWB' | 'DISPATCH'
  status?: 'ACTIVE' | 'RESOLVED'
  fromDate?: string
  toDate?: string
}

export interface SLABreachReportRow {
  orderId: string
  orderNumber?: string
  seller: string
  sellerId: string
  slaType: 'AWB' | 'DISPATCH'
  slaDueTime: string
  breachDuration: number
  reminderCount: number
  lastReminderDate?: string
  currentOrderStatus?: string
  currentShipmentStatus?: string
  slaStatus: 'ACTIVE' | 'RESOLVED'
  resolvedAt?: string
  resolvedReason?: 'AWB_GENERATED' | 'DISPATCHED' | 'CANCELLED' | 'RTO'
}

export interface SLABreachReportResponse {
  success: boolean
  data: {
    rows: SLABreachReportRow[]
    summary: {
      total: number
      active: number
      resolved: number
      withReminders: number
    }
  }
}

export const fetchSLABreachReport = async (
  params?: SLABreachReportParams,
): Promise<SLABreachReportResponse> => {
  const response = await API.get('/sla/admin/report', { params })
  return response.data
}

// SLA Audit Log API
export interface SLAAuditLogParams {
  orderId?: string
  sellerId?: string
  slaType?: 'AWB' | 'DISPATCH'
  eventType?: 'SLA_STARTED' | 'SLA_BREACHED' | 'SLA_REMINDER_SENT' | 'SLA_RESOLVED'
  fromDate?: string
  toDate?: string
  page?: number
  limit?: number
}

export interface SLAAuditLogRow {
  _id: string
  slaTrackingId: string
  orderId: string
  sellerId: string
  slaType: 'AWB' | 'DISPATCH'
  eventType: 'SLA_STARTED' | 'SLA_BREACHED' | 'SLA_REMINDER_SENT' | 'SLA_RESOLVED'
  triggerReason?: string
  reminderType?: 'AUTO' | 'MANUAL'
  reminderCount?: number
  resolvedReason?: 'AWB_GENERATED' | 'DISPATCHED' | 'CANCELLED' | 'RTO'
  actor: string
  actorName?: string
  orderNumber?: string
  sellerName?: string
  previousStatus?: string
  newStatus?: string
  timestamp: string
  createdAt: string
}

export interface SLAAuditLogResponse {
  success: boolean
  data: {
    rows: SLAAuditLogRow[]
    pagination: {
      page: number
      limit: number
      total: number
      totalPages: number
    }
  }
}

export const fetchSLAAuditLog = async (
  params?: SLAAuditLogParams,
): Promise<SLAAuditLogResponse> => {
  const response = await API.get('/sla/admin/audit-log', { params })
  return response.data
}
