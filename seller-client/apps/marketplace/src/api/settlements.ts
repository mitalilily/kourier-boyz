import API from './axiosInstance'

export type SellerSettlementBatchStatus = 'PENDING' | 'PAID'

export interface SellerSettlementBatch {
  _id: string
  fromDate: string
  toDate: string
  ordersCount: number
  totalSaleAmount: number
  totalCommissionAmount: number
  totalOtherCharges: number
  totalNetPayout: number
  status: SellerSettlementBatchStatus
  invoiceUrl?: string
  invoiceNumber?: string
  payoutDate?: string
  payoutReference?: string
  payoutNotes?: string
  createdAt: string
  updatedAt: string
}

export interface SellerSettlementBatchListResponse {
  success: boolean
  data: SellerSettlementBatch[]
  pagination: {
    total: number
    page: number
    limit: number
    pages: number
  }
}

export interface SellerSettlementBatchDetailResponse {
  success: boolean
  data: {
    batch: SellerSettlementBatch
    orders: Array<{
      _id: string
      orderNumber?: string
      createdAt: string
      sellerSaleAmount?: number
      sellerCommissionAmount?: number
      sellerNetAmount?: number
      settlementStatus?: string
    }>
  }
}

export const fetchSellerSettlementBatches = async (params?: {
  status?: SellerSettlementBatchStatus
  fromDate?: string
  toDate?: string
  page?: number
  limit?: number
}): Promise<SellerSettlementBatchListResponse> => {
  const response = await API.get('/settlements/batches', { params })
  return response.data
}

export const fetchSellerSettlementBatchDetail = async (
  id: string,
): Promise<SellerSettlementBatchDetailResponse> => {
  const response = await API.get(`/settlements/batches/${id}`)
  return response.data
}

export interface SellerLedgerEntry {
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
  reasonLabel: string
  amount: number
  description?: string | null
  createdAt: string
  runningBalance: number
  creditNote?: {
    credit_note_id?: string | null
    credit_note_url?: string | null
    credit_note_number?: string | null
    generated_at?: string | null
  } | null
  debitNote?: {
    debit_note_id?: string | null
    debit_note_url?: string | null
    debit_note_number?: string | null
    generated_at?: string | null
  } | null
}

export interface SellerLedgerResponse {
  success: boolean
  data: {
    entries: SellerLedgerEntry[]
    openingBalance: number
    closingBalance: number
    totalEntries: number
  }
}

export const fetchSellerLedger = async (): Promise<SellerLedgerResponse> => {
  const response = await API.get('/settlements/ledger')
  return response.data
}

// Reports API
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
  customerType?: string // 'Registered' | 'Unregistered' | 'All'
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
  fromDate?: string
  toDate?: string
  financialYear?: string
  status?: 'PAID' | 'PENDING' | 'ALL'
  format?: 'json' | 'excel' | 'pdf'
}): Promise<SettlementReportResponse | Blob> => {
  const response = await API.get('/settlements/reports/settlement', {
    params,
    responseType: params?.format === 'excel' || params?.format === 'pdf' ? 'blob' : 'json',
  })
  return response.data
}

export const fetchTdsReport = async (params?: {
  fromDate?: string
  toDate?: string
  financialYear?: string
  format?: 'json' | 'excel' | 'pdf'
}): Promise<TdsReportResponse | Blob> => {
  const response = await API.get('/settlements/reports/tds', {
    params,
    responseType: params?.format === 'excel' || params?.format === 'pdf' ? 'blob' : 'json',
  })
  return response.data
}

export const fetchTcsReport = async (params?: {
  fromDate?: string
  toDate?: string
  financialYear?: string
  format?: 'json' | 'excel' | 'pdf'
}): Promise<TcsReportResponse | Blob> => {
  const response = await API.get('/settlements/reports/tcs', {
    params,
    responseType: params?.format === 'excel' || params?.format === 'pdf' ? 'blob' : 'json',
  })
  return response.data
}

export interface SellerCreditNote {
  _id: string
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

export interface SellerCreditNotesResponse {
  success: boolean
  data: {
    creditNotes: SellerCreditNote[]
    total: number
  }
}

export const fetchSellerCreditNotes = async (): Promise<SellerCreditNotesResponse> => {
  const response = await API.get('/settlements/credit-notes')
  return response.data
}


