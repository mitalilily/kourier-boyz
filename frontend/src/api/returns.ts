import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import API from '../lib/axios'
import type { Order } from './orders'

export interface CreateReturnPayload {
  order_id: string
  order_item_id?: string
  reason: string
  description?: string
  images?: string[]
  returnType?: 'return' | 'replacement'
  exchangeVariantId?: string // For replacement/exchange - selected variant ID
}

// FormData type for file uploads
export type CreateReturnFormData = FormData

export interface ReturnTimelineEntry {
  status: string
  message?: string
  timestamp: string
}

export interface ReturnRecord {
  _id: string
  order: Order | string
  orderItem?: string
  seller: string
  customer: string
  reason: string
  description?: string
  images: string[]
  status: string
  returnType?: 'return' | 'replacement'
  courierReverseAwb?: string
  courierReverseId?: string
  courierPartner?: string
  reverseCharges?: number
  refundAmount: number
  settlementAdjustment?: number
  timeline: ReturnTimelineEntry[]
  createdAt: string
  updatedAt: string
}

export const useCreateReturn = () => {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateReturnPayload | CreateReturnFormData) => {
      const isFormData = payload instanceof FormData
      const res = await API.post<{
        success: boolean
        data: { return_id: string; status: string }
      }>(
        '/returns/create',
        payload,
        isFormData
          ? {
              headers: {
                'Content-Type': 'multipart/form-data',
              },
            }
          : undefined,
      )
      return res.data
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['orders'] })
      void client.invalidateQueries({ queryKey: ['returns'] })
    },
  })
}

export const useCustomerReturns = () => {
  return useQuery({
    queryKey: ['returns', 'customer'],
    queryFn: async () => {
      // Try customer endpoint first, fallback to admin endpoint
      try {
        const res = await API.get<{ success: boolean; data: ReturnRecord[] }>('/returns', {})
        return res.data
      } catch {
        // Fallback to admin endpoint if customer endpoint doesn't exist
        const res = await API.get<{ success: boolean; data: ReturnRecord[] }>('/admin/returns', {})
        return res.data
      }
    },
    enabled: true,
  })
}

export interface ReturnsPaginatedResponse {
  success: boolean
  data: ReturnRecord[]
  pagination?: {
    total: number
    page: number
    limit: number
    pages: number
    hasMore?: boolean
  }
}

export const useCustomerReturnsInfinite = (params?: { limit?: number; enabled?: boolean }) => {
  const { limit = 20, enabled = true } = params || {}

  return useInfiniteQuery<ReturnsPaginatedResponse>({
    queryKey: ['returns', 'customer', 'infinite', limit],
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const page = typeof pageParam === 'number' ? pageParam : 1
      const queryParams = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      })

      // Try customer endpoint first, fallback to admin endpoint
      try {
        const res = await API.get<ReturnsPaginatedResponse>(`/returns?${queryParams.toString()}`)
        return res.data
      } catch {
        // Fallback to admin endpoint if customer endpoint doesn't exist
        return { success: false, data: [] } as ReturnsPaginatedResponse
      }
    },
    getNextPageParam: (lastPage) => {
      if (!lastPage.pagination?.hasMore) {
        const { page, pages } = lastPage.pagination || { page: 1, pages: 1 }
        return page < pages ? page + 1 : undefined
      }
      return lastPage.pagination.page + 1
    },
    enabled,
  })
}

export interface ReplacementVariant {
  _id: string
  name: string
  sku: string
  attributes?: Record<string, string>
  price: number
  originalPrice: number
  priceDifference: number
  stock: number
  images: string[]
  mainImage?: string
  canReplace: boolean
  requiresNewOrder: boolean
  isSameVariant?: boolean // True when this is the same variant as the original (for damaged/defective replacement)
}

export interface ReplacementVariantsResponse {
  success: boolean
  data: {
    variants: ReplacementVariant[]
    originalPrice: number
    originalVariant: {
      _id: string
      name: string
      sku: string
      attributes?: Record<string, string>
      price: number
    }
    parentProduct: {
      _id: string
      name: string
    }
    message?: string
    allowSameVariant?: boolean // True when same variant replacement is allowed (damaged/defective reasons)
  }
}

export const useReplacementVariants = (
  orderId?: string,
  orderItemId?: string,
  options?: { enabled?: boolean; reason?: string },
) => {
  return useQuery<ReplacementVariantsResponse>({
    queryKey: ['replacement-variants', orderId, orderItemId, options?.reason],
    queryFn: async () => {
      if (!orderId || !orderItemId) {
        throw new Error('Order ID and Order Item ID are required')
      }
      let url = `/replacement/variants?orderId=${orderId}&orderItemId=${orderItemId}`
      if (options?.reason) {
        url += `&reason=${encodeURIComponent(options.reason)}`
      }
      const res = await API.get<ReplacementVariantsResponse>(url)
      return res.data
    },
    enabled: options?.enabled !== undefined ? options.enabled : !!orderId && !!orderItemId,
  })
}

export interface ReturnReason {
  value: string
  label: string
}

export interface ReturnReasonsResponse {
  success: boolean
  data: {
    reasons: ReturnReason[]
  }
}

export const useReturnReasons = (type: 'return' | 'replacement' = 'return') => {
  return useQuery<ReturnReasonsResponse>({
    queryKey: ['return-reasons', type],
    queryFn: async () => {
      const res = await API.get<ReturnReasonsResponse>(`/returns/reasons?type=${type}`)
      return res.data
    },
    staleTime: 1000 * 60 * 60, // Cache for 1 hour
  })
}
