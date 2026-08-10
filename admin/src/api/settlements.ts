import API from './axiosInstance'

export type SettlementBatchStatus = 'PENDING' | 'PAID'

export interface SettlementBatch {
  _id: string
  seller: {
    _id: string
    name?: string
    businessName?: string
  }
  fromDate: string
  toDate: string
  ordersCount: number
  totalSaleAmount: number
  totalCommissionAmount: number
  totalOtherCharges: number
  totalNetPayout: number
  // Optional detailed breakdown (may be absent for older batches)
  totalItemEarnings?: number
  totalShippingEarned?: number
  totalCourierCostDeducted?: number
  totalPgFee?: number
  totalCommissionReversal?: number
  totalManualAdjustments?: number
  totalManualAdjustmentsCredit?: number
  totalManualAdjustmentsDebit?: number
  totalTdsAmount?: number
  totalTcsAmount?: number
  invoiceUrl?: string
  invoiceNumber?: string
  status: SettlementBatchStatus
  payoutDate?: string
  payoutReference?: string
  payoutNotes?: string
  // Payment fields (ledger-based payment tracking)
  paidAmount?: number // Total amount paid to seller (default: 0)
  paidAt?: string | null // Timestamp of last payment
  paymentReference?: string | null // Payment reference (transaction ID, UPI reference, etc.)
  paymentMethod?: string | null // Payment method (bank_transfer, upi, neft, etc.)
  createdAt: string
  updatedAt: string
}

export interface CreditNoteDto {
  credit_note_id?: string | null
  credit_note_url?: string | null
  credit_note_number?: string | null
  generated_at?: string | null
}

export interface AdminCreditNote {
  _id: string
  seller: {
    _id: string
    name?: string
    businessName?: string
    gstNumber?: string
  } | null
  creditNoteNumber: string
  issueDate: string
  reason: string
  referenceInvoice: string | null
  amount: number
  taxBreakup: {
    hsnSacCode?: string
    gstRatePercent?: number
    taxableValue?: number
    igst?: number
    cgst?: number
    sgst?: number
  } | null
  creditNoteUrl: string
  order: {
    _id: string
    orderNumber?: string
  } | null
  settlementBatch: {
    _id: string
    fromDate: string
    toDate: string
    status: 'PENDING' | 'PAID'
    invoiceNumber?: string
  } | null
  description?: string | null
}

export interface AdminCreditNotesResponse {
  success: boolean
  data: {
    creditNotes: AdminCreditNote[]
    pagination: {
      total: number
      page: number
      limit: number
      pages: number
    }
  }
}

export const fetchAdminCreditNotes = async (params?: {
  sellerId?: string
  page?: number
  limit?: number
}): Promise<AdminCreditNotesResponse> => {
  const response = await API.get('/admin/settlements/credit-notes', { params })
  return response.data
}

export interface DebitNoteDto {
  debit_note_id?: string | null
  debit_note_url?: string | null
  debit_note_number?: string | null
  generated_at?: string | null
}

export interface SellerLedgerEntryDto {
  _id: string
  order?: {
    _id: string
    orderNumber?: string
  } | null
  settlementBatch?: {
    _id: string
    fromDate: string
    toDate: string
    status: 'PENDING' | 'PAID'
  } | null
  entryType: 'CREDIT' | 'DEBIT'
  reason: string
  reasonLabel?: string
  amount: number
  description?: string | null
  createdAt: string
  runningBalance?: number
  creditNote?: CreditNoteDto | null
  debitNote?: DebitNoteDto | null
}

export interface SellerLedgerResponse {
  success: boolean
  data: {
    entries: SellerLedgerEntryDto[]
    openingBalance: number
    closingBalance: number
    totalEntries?: number
  }
}

export interface SettlementBatchListResponse {
  success: boolean
  data: SettlementBatch[]
  pagination: {
    total: number
    page: number
    limit: number
    pages: number
  }
}

export interface SettlementBatchDetailResponse {
  success: boolean
  data: {
    batch: SettlementBatch
    orders: Array<{
      _id: string
      orderNumber?: string
      createdAt: string
      total?: number
      discountAmount?: number
      sellerSaleAmount?: number
      sellerCommissionAmount?: number
      sellerNetAmount?: number
      settlementStatus?: string
    }>
  }
}

export interface SellerSettlementSettings {
  _id?: string
  seller: string
  settlementCycle: 'DAILY' | 'WEEKLY' | 'CUSTOM'
  customCycleDays?: number | null
  returnWindowDays: number
  commissionType: 'PERCENTAGE' | 'FIXED'
  commissionValue: number
  minBatchAmount?: number | null
  isActiveOverride?: boolean
  createdAt?: string
  updatedAt?: string
}

export interface SellerSettlementSettingsResponse {
  success: boolean
  data: SellerSettlementSettings | null
}

export interface GlobalSettlementSettings {
  _id?: string
  settlementCycle: 'DAILY' | 'WEEKLY' | 'CUSTOM'
  customCycleDays?: number | null
  returnWindowDays: number
  commissionType: 'PERCENTAGE' | 'FIXED'
  commissionValue: number
  allowSellerOverride: boolean
  minBatchAmount?: number | null
  createdAt?: string
  updatedAt?: string
}

export interface GlobalSettlementSettingsResponse {
  success: boolean
  data: GlobalSettlementSettings
}

export const fetchSettlementBatches = async (params?: {
  seller?: string
  status?: SettlementBatchStatus
  fromDate?: string
  toDate?: string
  page?: number
  limit?: number
}): Promise<SettlementBatchListResponse> => {
  const response = await API.get('/admin/settlements/batches', { params })
  return response.data
}

export const fetchSettlementBatchDetail = async (
  id: string,
): Promise<SettlementBatchDetailResponse> => {
  const response = await API.get(`/admin/settlements/batches/${id}`)
  return response.data
}

export const generateSettlementBatches = async () => {
  const response = await API.post('/admin/settlements/generate-batches')
  return response.data
}

export const markSettlementBatchPaidApi = async (
  id: string,
  payload: {
    // New payment fields (ledger-based)
    amountPaid?: number
    paymentMethod?: string
    paymentReference?: string
    paymentDate?: string
    // Legacy fields (for backward compatibility, mapped to new fields if needed)
    payoutDate?: string
    payoutReference?: string
    payoutNotes?: string
  },
) => {
  const response = await API.put(`/admin/settlements/batches/${id}/mark-paid`, payload)
  return response.data
}

export const generateSettlementInvoiceApi = async (id: string) => {
  const response = await API.post(`/admin/settlements/batches/${id}/generate-invoice`)
  return response.data
}

export const fetchSellerLedger = async (sellerId: string): Promise<SellerLedgerResponse> => {
  const response = await API.get(`/admin/settlements/sellers/${sellerId}/ledger`)
  return response.data
}

export interface AuditLogEntry {
  _id: string
  action:
    | 'REFUND_ISSUED'
    | 'REFUND_OVERRIDE_APPROVED'
    | 'PAYOUT_MARKED_PAID'
    | 'SETTLEMENT_STATUS_CHANGED'
    | 'SETTLEMENT_PAYMENT_RECORDED'
    | 'MANUAL_ADJUSTMENT_CREATED'
    | 'MANUAL_ADJUSTMENT_OVERRIDE_APPROVED'
  performedBy: {
    _id: string
    name?: string
    email?: string
  }
  performedByEmail?: string
  performedByName?: string
  ipAddress: string
  userAgent?: string
  entityType: 'REFUND' | 'SETTLEMENT_BATCH' | 'MANUAL_ADJUSTMENT' | 'ORDER'
  entityId: string
  metadata: Record<string, unknown>
  createdAt: string
}

export interface AuditLogsResponse {
  success: boolean
  data: AuditLogEntry[]
  pagination: {
    total: number
    page: number
    limit: number
    pages: number
  }
}

export const fetchAuditLogs = async (params?: {
  action?: string
  entityType?: string
  entityId?: string
  performedBy?: string
  fromDate?: string
  toDate?: string
  page?: number
  limit?: number
}): Promise<AuditLogsResponse> => {
  const response = await API.get('/admin/settlements/audit-logs', { params })
  return response.data
}

export const fetchSettlementInvoiceMetaApi = async (
  id: string,
): Promise<{
  success: boolean
  data: { batchId: string; invoiceUrl: string | null; invoiceNumber: string | null }
}> => {
  const response = await API.get(`/admin/settlements/batches/${id}/invoice`)
  return response.data
}

export interface SettlementImportResponse {
  success: boolean
  data: SettlementBatch
  meta: {
    importedOrders: number
    skippedAlreadyInBatches: string[]
    mode: 'ATTACHED_TO_EXISTING_BATCH' | 'CREATED_NEW_BATCH'
    message: string
  }
}

export const importSettlementOrdersApi = async (
  file: File,
  options?: { batchId?: string },
): Promise<SettlementImportResponse> => {
  const formData = new FormData()
  formData.append('file', file)
  if (options?.batchId) {
    formData.append('batchId', options.batchId)
  }

  const response = await API.post('/admin/settlements/import-orders', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
  return response.data
}

export const createManualAdjustmentApi = async (
  sellerId: string,
  payload: {
    type: 'credit' | 'debit'
    amount: number
    description?: string
    order_id?: string
    batchId?: string
  },
) => {
  const response = await API.post(`/admin/settlements/sellers/${sellerId}/manual-adjustment`, payload)
  return response.data
}

export const fetchSellerSettlementSettings = async (
  sellerId: string,
): Promise<SellerSettlementSettingsResponse> => {
  const response = await API.get(`/admin/settlements/sellers/${sellerId}/settlement-settings`)
  return response.data
}

export const upsertSellerSettlementSettingsApi = async (
  sellerId: string,
  payload: Partial<SellerSettlementSettings>,
) => {
  const response = await API.put(
    `/admin/settlements/sellers/${sellerId}/settlement-settings`,
    payload,
  )
  return response.data
}

export const fetchGlobalSettlementSettings = async (): Promise<GlobalSettlementSettingsResponse> => {
  const response = await API.get('/admin/settlements/global-settings')
  return response.data
}

export const upsertGlobalSettlementSettingsApi = async (
  payload: Partial<GlobalSettlementSettings>,
) => {
  const response = await API.put('/admin/settlements/global-settings', payload)
  return response.data
}

// Reports API (Admin - can view any seller's reports)
export type SettlementReportRow = {
  orderId: string
  orderNumber: string
  invoiceNumber: string | null
  invoiceDate: string | null
  salesAmount: number
  gstAmount: number
  total: number
  commission: number
  marketingFees: number
  courierChargesForward: number
  courierChargesReturn: number
  codFeesForward: number
  codFeesReverse: number
  otherCharges: number
  tdsAmount: number
  tcsAmount: number
  netSettlementPayable: number
  settlementBatchId: string
  settlementBatchFromDate: string | null
  settlementBatchToDate: string | null
  payoutDate: string | null
  isReturn?: boolean
}

export type SettlementReportResponse = {
  success: boolean
  data: {
    seller: {
      name: string
      businessName: string
      gstNumber: string
      panNumber: string
    } | null
    report: SettlementReportRow[]
    summary: {
      totalOrders: number
      totalReturns: number
      totalSalesAmount: number
      totalGstAmount: number
      totalAmount: number
      totalCommission: number
      totalTdsAmount: number
      totalTcsAmount: number
      totalNetSettlementPayable: number
    }
  }
}

export type TdsReportRow = {
  settlementBatchId: string | null
  fromDate: string | null
  toDate: string | null
  payoutDate: string | null
  sellerTradeName: string
  sellerGstin: string
  sellerPan: string
  totalSalesInclGst: number
  tdsAmount: number
  tdsRate: number
  tdsExempted: boolean
  tdsExemptionReason?: string
  orderNumber?: string
  orderId?: string
  isReversal?: boolean
}

export type TdsReportResponse = {
  success: boolean
  data: {
    seller: {
      name: string
      businessName: string
      panNumber: string
      gstNumber: string
    } | null
    report: TdsReportRow[]
    summary: {
      totalBatches: number
      totalSalesInclGst: number
      totalTdsAmount: number
      exemptedBatches: number
      pendingReversals: number
    }
  }
}

export type TcsReportRow = {
  settlementBatchId: string | null
  fromDate: string | null
  toDate: string | null
  payoutDate: string | null
  sellerGstin: string
  sellerState: string
  customerType?: string
  salesAmountExclGst: number
  tcsIgstAmount: number
  tcsCgstAmount: number
  tcsSgstAmount: number
  totalTcsAmount: number
  breakdown?: {
    interState: { salesAmount: number; tcsAmount: number }
    intraState: {
      salesAmount: number
      tcsCgstAmount: number
      tcsSgstAmount: number
      tcsAmount: number
    }
    registeredCustomers: { salesAmount: number; tcsAmount: number }
    unregisteredCustomers: { salesAmount: number; tcsAmount: number }
  }
  orderNumber?: string
  orderId?: string
  isReversal?: boolean
}

export type TcsReportResponse = {
  success: boolean
  data: {
    seller: {
      name: string
      businessName: string
      gstNumber: string
      state: string
    } | null
    report: TcsReportRow[]
    summary: {
      totalBatches: number
      totalSalesExclGst: number
      totalTcsAmount: number
      totalTcsIgst: number
      totalTcsCgst: number
      totalTcsSgst: number
      interStateSales: number
      intraStateSales: number
      registeredCustomerSales: number
      unregisteredCustomerSales: number
      pendingReversals: number
    }
  }
}

export const fetchSettlementReport = async (params?: {
  sellerId: string
  fromDate?: string
  toDate?: string
  financialYear?: string
  status?: 'PAID' | 'PENDING' | 'ALL'
  format?: 'json' | 'excel' | 'pdf'
}): Promise<SettlementReportResponse | Blob> => {
  const response = await API.get('/admin/settlements/reports/settlement', {
    params,
    responseType: params?.format === 'excel' || params?.format === 'pdf' ? 'blob' : 'json',
  })
  return response.data
}

export const fetchTdsReport = async (params?: {
  sellerId: string
  fromDate?: string
  toDate?: string
  financialYear?: string
  format?: 'json' | 'excel' | 'pdf'
}): Promise<TdsReportResponse | Blob> => {
  const response = await API.get('/admin/settlements/reports/tds', {
    params,
    responseType: params?.format === 'excel' || params?.format === 'pdf' ? 'blob' : 'json',
  })
  return response.data
}

export const fetchTcsReport = async (params?: {
  sellerId: string
  fromDate?: string
  toDate?: string
  financialYear?: string
  format?: 'json' | 'excel' | 'pdf'
}): Promise<TcsReportResponse | Blob> => {
  const response = await API.get('/admin/settlements/reports/tcs', {
    params,
    responseType: params?.format === 'excel' || params?.format === 'pdf' ? 'blob' : 'json',
  })
  return response.data
}


