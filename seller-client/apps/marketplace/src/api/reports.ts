import API from './axiosInstance'

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
    filters: TdsReportParams & { seller: string }
  }
}

export const fetchTdsReport = async (params?: TdsReportParams): Promise<TdsReportResponse> => {
  const response = await API.get('/settlements/reports/tds', { params })
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
    filters: TcsReportParams & { seller: string }
  }
}

export const fetchTcsReport = async (params?: TcsReportParams): Promise<TcsReportResponse> => {
  const response = await API.get('/settlements/reports/tcs', { params })
  return response.data
}

