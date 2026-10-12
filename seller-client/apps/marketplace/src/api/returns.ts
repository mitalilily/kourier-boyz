import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import API from './axiosInstance'

export type ReturnStatus =
  | 'REQUESTED'
  | 'APPROVED_BY_SELLER'
  | 'APPROVED_BY_ADMIN'
  | 'REJECTED'
  | 'REVERSE_PICKUP_CREATED'
  | 'REVERSE_PICKUP_IN_TRANSIT'
  | 'REVERSE_PICKUP_COMPLETED'
  | 'RETURN_RECEIVED_BY_SELLER'
  | 'REFUND_INITIATED'
  | 'REFUND_COMPLETED'

export interface ReturnTimelineEntry {
  status: ReturnStatus
  message?: string
  timestamp: string
}

export interface SellerReturn {
  _id: string
  order: {
    _id: string
    orderNumber?: string
    status: string
    total: number
  }
  customer: {
    _id: string
    name?: string
    email?: string
  }
  reason: string
  description?: string
  images: string[]
  videos?: string[]
  status: ReturnStatus
  returnType?: 'return' | 'replacement'
  exchangeVariantId?: {
    _id: string
    name?: string
    sku?: string
    price?: number
    effectivePrice?: number
    stock?: number
    attributes?: Record<string, string>
    mainImage?: string
    images?: string[]
  }
  exchangeOrderId?: {
    _id: string
    orderNumber?: string
    status?: string
    total?: number
    items?: unknown[]
  }
  courierReverseAwb?: string
  courierReverseId?: string
  courierPartner?: string
  reverseCharges?: number
  refundAmount: number
  settlementAdjustment?: number
  creditNote?: {
    credit_note_id?: string
    credit_note_url?: string
    credit_note_number?: string
    generated_at?: string
    hsnSummary?: Array<{
      hsnSacCode: string
      gstRatePercent: number
      taxableValueTotal: number
      igstAmountTotal: number
      cgstAmountTotal: number
      sgstAmountTotal: number
    }>
  }
  timeline: ReturnTimelineEntry[]
  createdAt: string
  updatedAt: string
}

export interface SellerReturnsResponse {
  success: boolean
  data: SellerReturn[]
  pagination: {
    total: number
    page: number
    limit: number
    pages: number
  }
}

export const fetchSellerReturns = async (params?: {
  status?: string
  page?: number
  limit?: number
}): Promise<SellerReturnsResponse> => {
  // API baseURL is /api/seller, route is /returns (without /seller prefix)
  // This results in /api/seller/returns which matches the backend route
  const response = await API.get('/returns', { params })
  return response.data
}

export const useSellerReturns = (params?: { status?: string; page?: number; limit?: number }) => {
  return useQuery({
    queryKey: ['seller-returns', params],
    queryFn: () => fetchSellerReturns(params),
  })
}

export const useSellerApproveReturn = () => {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await API.put(`/returns/${id}/approve`)
      return res.data
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['seller-returns'] })
    },
  })
}

export const useSellerRejectReturn = () => {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const res = await API.put(`/returns/${id}/reject`, { reason })
      return res.data
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['seller-returns'] })
    },
  })
}

export interface CourierOption {
  courier_id: number
  courier_name: string
  rate?: number | string
  estimated_delivery_days?: string
  estimated_delivery_date?: string
  serviceable?: boolean
  cod_available?: boolean
  zone?: string
}

export interface ReturnServiceabilityResponse {
  success: boolean
  data: {
    couriers: CourierOption[] // Available couriers from serviceability
    weightGrams: number
    packageDimensions: {
      length: number
      breadth: number
      height: number
      width?: number
    }
    pickupAddress?: {
      warehouseName?: string
      addressLine1?: string
      addressLine2?: string
      city?: string
      state?: string
      postalCode?: string
      country?: string
      contactName?: string
      contactPhone?: string
    }
    rtoAddress?: {
      contactName?: string
      contactPhone?: string
      addressLine1?: string
      addressLine2?: string
      city?: string
      state?: string
      postalCode?: string
      country?: string
    }
    originPincode?: string
    destinationPincode?: string
  }
}

export const fetchSellerReturnQuote = async (id: string): Promise<ReturnServiceabilityResponse> => {
  const response = await API.get(`/returns/${id}/quote`)
  return response.data
}

export const useSellerReturnQuote = (id: string | null) => {
  return useQuery({
    queryKey: ['seller-return-quote', id],
    queryFn: () => fetchSellerReturnQuote(id!),
    enabled: !!id,
  })
}

export const useSellerConfirmReturnApproval = () => {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      weightGrams,
      packageDimensions,
      courier_id,
    }: {
      id: string
      weightGrams?: number
      packageDimensions?: { length: number; breadth: number; height: number }
      courier_id: number // Required: selected courier from serviceability
    }) => {
      const res = await API.post(`/returns/${id}/confirm-approve`, {
        weightGrams,
        packageDimensions,
        courier_id,
      })
      return res.data
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['seller-returns'] })
      void client.invalidateQueries({ queryKey: ['seller-return-quote'] })
    },
  })
}


