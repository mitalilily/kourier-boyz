import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  type OrderStatus,
  type RequestPickupPayload,
  type SellerShipmentStatus,
  cancelOrderApi,
  createManualRefundApi,
  downloadInvoiceApi,
  downloadLabelApi,
  fetchAdminOrder,
  fetchAdminOrders,
  fetchOrderRefunds,
  getSellerPickupAddressesApi,
  getShipmentRatesApi,
  regenerateLabelApi,
  requestPickupApi,
  trackShipmentApi,
  updateAdminOrderStatusApi,
  updateAdminPaymentStatusApi,
  updateAdminSellerShipmentStatusApi,
} from './orders'

export const useAdminOrders = (params?: {
  status?: string
  paymentStatus?: string
  seller?: string
  fromDate?: string
  toDate?: string
  search?: string
  page?: number
  limit?: number
}) => {
  return useQuery({
    queryKey: ['admin-orders', params],
    queryFn: () => fetchAdminOrders(params),
  })
}

export const useAdminOrder = (orderId?: string) => {
  return useQuery({
    queryKey: ['admin-orders', orderId],
    queryFn: () => {
      if (!orderId) throw new Error('Order ID is required')
      return fetchAdminOrder(orderId)
    },
    enabled: !!orderId,
  })
}

export const useOrderRefunds = (orderId?: string) => {
  return useQuery({
    queryKey: ['admin-order-refunds', orderId],
    queryFn: () => {
      if (!orderId) throw new Error('Order ID is required')
      return fetchOrderRefunds(orderId)
    },
    enabled: !!orderId,
  })
}

export const useUpdateAdminOrderStatus = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: OrderStatus }) =>
      updateAdminOrderStatusApi(orderId, status),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] })
      queryClient.invalidateQueries({ queryKey: ['admin-orders', variables.orderId] })
    },
  })
}

export const useUpdateAdminPaymentStatus = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      orderId,
      paymentStatus,
    }: {
      orderId: string
      paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded'
    }) => updateAdminPaymentStatusApi(orderId, paymentStatus),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] })
      queryClient.invalidateQueries({ queryKey: ['admin-orders', variables.orderId] })
    },
  })
}

export const useUpdateAdminSellerShipmentStatus = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      orderId,
      shipmentId,
      status,
    }: {
      orderId: string
      shipmentId: string
      status: SellerShipmentStatus
    }) => updateAdminSellerShipmentStatusApi(orderId, shipmentId, status),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders', variables.orderId] })
    },
  })
}

export const useRegenerateLabel = () => {
  return useMutation({
    mutationFn: ({ orderId, shipmentId }: { orderId: string; shipmentId: string }) =>
      regenerateLabelApi(orderId, shipmentId),
  })
}

export const useCreateManualRefund = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (params: { orderId: string; payload: any }) =>
      createManualRefundApi(params.orderId, params.payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] })
      queryClient.invalidateQueries({ queryKey: ['admin-orders', variables.orderId] })
    },
  })
}

export const useCancelOrder = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (orderId: string) => cancelOrderApi(orderId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] })
      queryClient.invalidateQueries({ queryKey: ['admin-orders', variables] })
    },
  })
}

// Order processing hooks
export const useSellerPickupAddresses = (orderId?: string, shipmentId?: string) => {
  return useQuery({
    queryKey: ['admin-pickup-addresses', orderId, shipmentId],
    queryFn: () => {
      if (!orderId || !shipmentId) throw new Error('Order ID and Shipment ID are required')
      return getSellerPickupAddressesApi(orderId, shipmentId)
    },
    enabled: !!orderId && !!shipmentId,
  })
}

export const useShipmentRates = () => {
  return useMutation({
    mutationFn: ({
      orderId,
      shipmentId,
      payload,
    }: {
      orderId: string
      shipmentId: string
      payload: { weight: number; dimensions?: { length: number; width: number; height: number } }
    }) => getShipmentRatesApi(orderId, shipmentId, payload),
  })
}

export const useRequestPickup = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      orderId,
      shipmentId,
      payload,
    }: {
      orderId: string
      shipmentId: string
      payload: RequestPickupPayload
    }) => requestPickupApi(orderId, shipmentId, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] })
      queryClient.invalidateQueries({ queryKey: ['admin-orders', variables.orderId] })
    },
  })
}

export const useTrackShipment = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ orderId, shipmentId }: { orderId: string; shipmentId: string }) =>
      trackShipmentApi(orderId, shipmentId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders', variables.orderId] })
    },
  })
}

export const useDownloadInvoice = () => {
  return useMutation({
    mutationFn: ({ orderId, shipmentId }: { orderId: string; shipmentId: string }) =>
      downloadInvoiceApi(orderId, shipmentId),
  })
}

export const useDownloadLabel = () => {
  return useMutation({
    mutationFn: ({ orderId, shipmentId }: { orderId: string; shipmentId: string }) =>
      downloadLabelApi(orderId, shipmentId),
  })
}
