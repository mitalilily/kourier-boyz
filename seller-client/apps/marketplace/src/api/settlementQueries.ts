import { useQuery } from '@tanstack/react-query'
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
  return useQuery({
    queryKey: ['seller-settlement-batches', params],
    queryFn: () => fetchSellerSettlementBatches(params),
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


