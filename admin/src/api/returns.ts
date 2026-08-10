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

export interface AdminReturn {
  _id: string
  order: {
    _id: string
    orderNumber?: string
    status: string
    total: number
  }
  seller: {
    _id: string
    name?: string
    businessName?: string
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
    items?: Array<{ _id?: string; name?: string; quantity?: number; price?: number }>
  }
  courierReverseAwb?: string
  courierReverseId?: string
  courierPartner?: string
  reverseCharges?: number
  refundAmount: number
  settlementAdjustment?: number
  creditNote?: {
    credit_note_id?: string | null
    credit_note_url?: string | null
    credit_note_number?: string | null
    generated_at?: string | null
  } | null
  timeline: ReturnTimelineEntry[]
  createdAt: string
  updatedAt: string
}

export interface AdminReturnsResponse {
  success: boolean
  data: AdminReturn[]
  pagination: {
    total: number
    page: number
    limit: number
    pages: number
  }
}

export const fetchAdminReturns = async (params?: {
  status?: string
  page?: number
  limit?: number
}): Promise<AdminReturnsResponse> => {
  const response = await API.get('/admin/returns', { params })
  return response.data
}

export const fetchAdminReturn = async (
  id: string,
): Promise<{ success: boolean; data: AdminReturn }> => {
  const response = await API.get(`/admin/returns`, { params: { id } })
  return response.data
}

export const useAdminReturns = (params?: { status?: string; page?: number; limit?: number }) => {
  return useQuery({
    queryKey: ['admin-returns', params],
    queryFn: () => fetchAdminReturns(params),
  })
}

// Fetch returns for a specific order
export const fetchOrderReturns = async (
  orderId: string,
): Promise<{ success: boolean; data: AdminReturn[] }> => {
  // Use backend endpoint with orderId filter for better performance
  const response = await API.get('/admin/returns', { params: { orderId, limit: 100 } })
  return {
    success: response.data?.success || true,
    data: response.data?.data || [],
  }
}

export const useOrderReturns = (orderId?: string) => {
  return useQuery({
    queryKey: ['admin-order-returns', orderId],
    queryFn: () => fetchOrderReturns(orderId!),
    enabled: !!orderId,
  })
}

export const useAdminApproveReturn = () => {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await API.put(`/admin/returns/${id}/approve`)
      return res.data
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['admin-returns'] })
    },
  })
}

export const useAdminRejectReturn = () => {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const res = await API.put(`/admin/returns/${id}/reject`, { reason })
      return res.data
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['admin-returns'] })
    },
  })
}

export const useAdminCancelReturn = () => {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const res = await API.put(`/admin/returns/${id}/cancel`, { reason })
      return res.data
    },
    onSuccess: async (data) => {
      await client.invalidateQueries({ queryKey: ['admin-returns'] })
      // Invalidate order returns if we have order ID
      if (data?.data?.order) {
        const orderId = typeof data.data.order === 'string' ? data.data.order : data.data.order._id
        await client.invalidateQueries({ queryKey: ['admin-order-returns', orderId] })
        await client.invalidateQueries({ queryKey: ['admin-orders', orderId] })
        await client.invalidateQueries({ queryKey: ['admin-orders'] })
      }
    },
  })
}

export const useAdminCreateReversePickup = () => {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string
      payload?: {
        weightGrams?: number
        packageDimensions?: { length: number; breadth: number; height: number }
        courier_id?: number // Required: selected courier from serviceability
      }
    }) => {
      const res = await API.post(`/admin/returns/${id}/create-reverse-pickup`, payload || {})
      return res.data
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['admin-returns'] })
    },
  })
}

export const useAdminMarkReturnReceived = () => {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await API.put(`/admin/returns/${id}/mark-received`)
      return res.data
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['admin-returns'] })
    },
  })
}

export const useAdminMarkRefundInitiated = () => {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await API.put(`/admin/returns/${id}/refund-initiate`)
      return res.data
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['admin-returns'] })
    },
  })
}

export const useAdminMarkRefundCompleted = () => {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await API.put(`/admin/returns/${id}/complete-refund`)
      return res.data
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['admin-returns'] })
    },
  })
}

export interface CreateReturnRequest {
  order_id: string
  customer_id: string
  order_item_id?: string
  reason: string
  description?: string
  images?: string[]
  returnType?: 'return' | 'replacement'
  exchangeVariantId?: string
  refundMode?: 'UPI' | 'BANK'
  upiId?: string
  bankAccountNumber?: string
  ifscCode?: string
  accountHolderName?: string
}

export const useAdminCreateReturn = () => {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (
      payload: Omit<CreateReturnRequest, 'images'> & { images?: (File | string)[] },
    ) => {
      const formData = new FormData()
      formData.append('order_id', payload.order_id)
      formData.append('customer_id', payload.customer_id)
      if (payload.order_item_id) {
        formData.append('order_item_id', payload.order_item_id)
      }
      formData.append('reason', payload.reason)
      if (payload.description) {
        formData.append('description', payload.description)
      }
      if (payload.returnType) {
        formData.append('returnType', payload.returnType)
      }
      if (payload.exchangeVariantId) {
        formData.append('exchangeVariantId', payload.exchangeVariantId)
      }
      if (payload.refundMode) {
        formData.append('refundMode', payload.refundMode)
      }
      if (payload.upiId) {
        formData.append('upiId', payload.upiId)
      }
      if (payload.bankAccountNumber) {
        formData.append('bankAccountNumber', payload.bankAccountNumber)
      }
      if (payload.ifscCode) {
        formData.append('ifscCode', payload.ifscCode)
      }
      if (payload.accountHolderName) {
        formData.append('accountHolderName', payload.accountHolderName)
      }
      if (payload.images) {
        payload.images.forEach((fileOrUrl) => {
          if (typeof fileOrUrl === 'string') {
            formData.append('images', fileOrUrl)
          } else {
            // At this point, fileOrUrl must be a File
            formData.append('images', fileOrUrl as File)
          }
        })
      }

      const res = await API.post('/admin/returns/create', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })
      return res.data
    },
    onSuccess: async (_data, variables) => {
      // Invalidate and refetch returns list (all variations)
      await client.invalidateQueries({ queryKey: ['admin-returns'] })
      // Invalidate and refetch all order queries
      await client.invalidateQueries({ queryKey: ['admin-orders'] })
      // Invalidate and refetch specific order detail page
      if (variables.order_id) {
        await client.invalidateQueries({ queryKey: ['admin-orders', variables.order_id] })
        // Also refetch order refunds if needed
        await client.invalidateQueries({ queryKey: ['admin-order-refunds', variables.order_id] })
        // Invalidate order returns to refresh the returns section
        await client.invalidateQueries({ queryKey: ['admin-order-returns', variables.order_id] })
      }
    },
  })
}

export interface ReplacementVariant {
  _id: string
  name: string
  sku: string
  attributes: Record<string, string>
  price: number
  originalPrice: number
  priceDifference: number
  stock: number
  images: string[]
  mainImage?: string
  canReplace: boolean
  requiresNewOrder: boolean
  isSameVariant: boolean
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
      attributes: Record<string, string>
      price: number
    }
    parentProduct: {
      _id: string
      name: string
    }
    allowSameVariant: boolean
  }
}

export const fetchReplacementVariants = async (params: {
  orderId: string
  orderItemId: string
  reason?: string
  customerId?: string
}): Promise<ReplacementVariantsResponse> => {
  const response = await API.get('/replacement/variants', { params })
  return response.data
}

export const useReplacementVariants = (params: {
  orderId: string
  orderItemId: string
  reason?: string
  customerId?: string
}) => {
  return useQuery({
    queryKey: ['replacement-variants', params],
    queryFn: () => fetchReplacementVariants(params),
    enabled: !!params.orderId && !!params.orderItemId,
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

export const fetchReturnReasons = async (
  type?: 'return' | 'replacement',
): Promise<ReturnReasonsResponse> => {
  const response = await API.get('/returns/reasons', { params: type ? { type } : {} })
  return response.data
}

export const useReturnReasons = (type?: 'return' | 'replacement') => {
  return useQuery({
    queryKey: ['return-reasons', type],
    queryFn: () => fetchReturnReasons(type),
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
    couriers: CourierOption[]
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

// Admin can use seller's quote endpoint for serviceability
export const fetchAdminReturnServiceability = async (id: string): Promise<ReturnServiceabilityResponse> => {
  // Use admin endpoint if available, otherwise we might need to add one
  // For now, we'll need to check if admin has access or create an admin-specific endpoint
  const response = await API.get(`/admin/returns/${id}/quote`)
  return response.data
}

export const useAdminReturnServiceability = (id: string | null) => {
  return useQuery({
    queryKey: ['admin-return-serviceability', id],
    queryFn: () => fetchAdminReturnServiceability(id!),
    enabled: !!id,
  })
}
