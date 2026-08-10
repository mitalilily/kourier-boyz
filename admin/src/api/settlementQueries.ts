import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createManualAdjustmentApi,
  fetchAdminCreditNotes,
  fetchAuditLogs,
  fetchGlobalSettlementSettings,
  fetchSellerLedger,
  fetchSellerSettlementSettings,
  fetchSettlementBatchDetail,
  fetchSettlementBatches,
  generateSettlementBatches,
  generateSettlementInvoiceApi,
  importSettlementOrdersApi,
  markSettlementBatchPaidApi,
  upsertGlobalSettlementSettingsApi,
  upsertSellerSettlementSettingsApi,
  type AdminCreditNotesResponse,
  type AuditLogsResponse,
  type GlobalSettlementSettings,
  type SellerLedgerResponse,
  type SellerSettlementSettings,
} from './settlements'

export const useSettlementBatches = (params?: {
  seller?: string
  status?: 'PENDING' | 'PAID'
  fromDate?: string
  toDate?: string
  page?: number
  limit?: number
}) => {
  return useQuery({
    queryKey: ['admin-settlement-batches', params],
    queryFn: () => fetchSettlementBatches(params),
  })
}

export const useSettlementBatchDetail = (id?: string) => {
  return useQuery({
    queryKey: ['admin-settlement-batch', id],
    queryFn: () => fetchSettlementBatchDetail(id!),
    enabled: !!id,
  })
}

export const useGenerateSettlementBatches = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: generateSettlementBatches,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-settlement-batches'] })
    },
  })
}

export const useMarkSettlementBatchPaid = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (params: {
      id: string
      payload: {
        amountPaid?: number
        paymentMethod?: string
        paymentReference?: string
        paymentDate?: string
        payoutDate?: string
        payoutReference?: string
        payoutNotes?: string
      }
    }) => markSettlementBatchPaidApi(params.id, params.payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-settlement-batches'] })
      queryClient.invalidateQueries({ queryKey: ['admin-settlement-batch', variables.id] })
    },
  })
}

export const useGenerateSettlementInvoice = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => generateSettlementInvoiceApi(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['admin-settlement-batches'] })
      queryClient.invalidateQueries({ queryKey: ['admin-settlement-batch', id] })
    },
  })
}

export const useImportSettlementOrders = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (params: { file: File; batchId?: string }) =>
      importSettlementOrdersApi(params.file, { batchId: params.batchId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-settlement-batches'] })
    },
  })
}

export const useSellerLedger = (sellerId?: string, enabled: boolean = true) => {
  return useQuery<SellerLedgerResponse>({
    queryKey: ['admin-seller-ledger', sellerId],
    queryFn: () => {
      if (!sellerId) throw new Error('Seller ID is required')
      return fetchSellerLedger(sellerId)
    },
    enabled: !!sellerId && enabled,
  })
}

export const useCreateManualAdjustment = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (params: {
      sellerId: string
      payload: {
        type: 'credit' | 'debit'
        amount: number
        description?: string
        order_id?: string
        batchId?: string
      }
      batchId?: string
    }) => createManualAdjustmentApi(params.sellerId, params.payload),
    onSuccess: (_data, params) => {
      queryClient.invalidateQueries({ queryKey: ['admin-settlement-batches', params.sellerId] })
      if (params.batchId) {
        queryClient.invalidateQueries({ queryKey: ['admin-settlement-batch', params.batchId] })
      }
    },
  })
}

export const useSellerSettlementSettings = (sellerId?: string) => {
  return useQuery({
    queryKey: ['admin-seller-settlement-settings', sellerId],
    queryFn: () => fetchSellerSettlementSettings(sellerId!),
    enabled: !!sellerId,
  })
}

export const useUpsertSellerSettlementSettings = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (params: { sellerId: string; payload: Partial<SellerSettlementSettings> }) =>
      upsertSellerSettlementSettingsApi(params.sellerId, params.payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['admin-seller-settlement-settings', variables.sellerId],
      })
    },
  })
}

export const useGlobalSettlementSettings = () => {
  return useQuery({
    queryKey: ['admin-global-settlement-settings'],
    queryFn: () => fetchGlobalSettlementSettings(),
  })
}

export const useUpsertGlobalSettlementSettings = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: Partial<GlobalSettlementSettings>) =>
      upsertGlobalSettlementSettingsApi(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-global-settlement-settings'] })
    },
  })
}

export const useAuditLogs = (params?: {
  action?: string
  entityType?: string
  entityId?: string
  performedBy?: string
  fromDate?: string
  toDate?: string
  page?: number
  limit?: number
}) => {
  return useQuery<AuditLogsResponse>({
    queryKey: ['admin-audit-logs', params],
    queryFn: () => fetchAuditLogs(params),
  })
}

export const useAdminCreditNotes = (params?: {
  sellerId?: string
  page?: number
  limit?: number
}) => {
  return useQuery<AdminCreditNotesResponse>({
    queryKey: ['admin-credit-notes', params],
    queryFn: () => fetchAdminCreditNotes(params),
  })
}
