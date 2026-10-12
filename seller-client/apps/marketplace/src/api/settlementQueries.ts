import { useQuery } from '@tanstack/react-query'
import { getDemoSettlements } from '../demo/marketplaceData'
import { isDemoSellerSession } from '../store/authStore'
import {
  fetchSellerSettlementBatchDetail,
  fetchSellerSettlementBatches,
  fetchSellerLedger,
  fetchSellerCreditNotes,
} from './settlements'

export const useSellerSettlementBatches = (params?: {
  status?: 'PENDING' | 'PAID'
  fromDate?: string
  toDate?: string
  page?: number
  limit?: number
}) => {
  const isDemo = isDemoSellerSession()
  return useQuery({
    queryKey: ['seller-settlement-batches', params],
    queryFn: () => fetchSellerSettlementBatches(params),
    enabled: !isDemo,
    initialData: isDemo ? getDemoSettlements(params) : undefined,
  })
}

export const useSellerSettlementBatchDetail = (id?: string) => {
  return useQuery({
    queryKey: ['seller-settlement-batch', id],
    queryFn: () => fetchSellerSettlementBatchDetail(id!),
    enabled: !!id,
  })
}

export const useSellerLedger = () => {
  return useQuery({
    queryKey: ['seller-ledger'],
    queryFn: () => fetchSellerLedger(),
  })
}

export const useSellerCreditNotes = () => {
  return useQuery({
    queryKey: ['seller-credit-notes'],
    queryFn: () => fetchSellerCreditNotes(),
  })
}


