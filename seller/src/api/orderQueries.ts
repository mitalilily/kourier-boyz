import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type CreateShipmentPayload,
  type RequestPickupPayload,
  type SellerShipmentStatus,
  type BulkStatusUpdatePayload,
  type ShipmentRatesRequest,
  type SellerBatchShipmentsResponse,
  createShipmentApi,
  downloadSellerInvoiceApi,
  downloadSellerLabelApi,
  fetchSellerOrder,
  fetchSellerOrders,
  fetchSellerOrderBatch,
  fetchSellerBatchShipments,
  getShipmentLabelApi,
  getShipmentRatesApi,
  requestPickupApi,
  trackShipmentApi,
  updateSellerOrderStatusApi,
  bulkUpdateSellerOrderStatusApi,
  cancelSellerOrderApi,
} from "./orders";

export const useSellerOrders = (params?: {
  status?: string;
  paymentStatus?: string;
  fromDate?: string;
  toDate?: string;
  search?: string;
  page?: number;
  limit?: number;
}) => {
  return useQuery({
    queryKey: ["seller-orders", params],
    queryFn: () => fetchSellerOrders(params),
  });
};

export const useSellerOrder = (orderId?: string) => {
  return useQuery({
    queryKey: ["seller-orders", orderId],
    queryFn: () => {
      if (!orderId) throw new Error("Order ID is required");
      return fetchSellerOrder(orderId);
    },
    enabled: !!orderId,
  });
};

export const useSellerOrderBatch = (batchId?: string) => {
  return useQuery({
    queryKey: ["seller-order-batch", batchId],
    queryFn: () => {
      if (!batchId) throw new Error("Batch ID is required");
      return fetchSellerOrderBatch(batchId);
    },
    enabled: !!batchId,
  });
};

export const useSellerBatchShipments = (batchId?: string) => {
  return useQuery<SellerBatchShipmentsResponse>({
    queryKey: ["seller-order-batch-shipments", batchId],
    queryFn: () => {
      if (!batchId) throw new Error("Batch ID is required");
      return fetchSellerBatchShipments(batchId);
    },
    enabled: !!batchId,
  });
};

export const useUpdateSellerOrderStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      orderId,
      status,
    }: {
      orderId: string;
      status: SellerShipmentStatus;
    }) => updateSellerOrderStatusApi(orderId, status),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["seller-orders"] });
      queryClient.invalidateQueries({
        queryKey: ["seller-orders", variables.orderId],
      });
      // Also refresh any cached order group (batch) details
      queryClient.invalidateQueries({ queryKey: ["seller-order-batch"] });
    },
  });
};

export const useBulkUpdateSellerOrderStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: BulkStatusUpdatePayload) =>
      bulkUpdateSellerOrderStatusApi(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seller-orders"] });
      queryClient.invalidateQueries({ queryKey: ["seller-order-batch"] });
    },
  });
};

export const useShipmentRates = () => {
  return useMutation({
    mutationFn: ({
      orderId,
      payload,
    }: {
      orderId: string;
      payload: ShipmentRatesRequest;
    }) => getShipmentRatesApi(orderId, payload),
  });
};

export const useCreateShipment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      orderId,
      payload,
    }: {
      orderId: string;
      payload: CreateShipmentPayload;
    }) => createShipmentApi(orderId, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["seller-orders"] });
      queryClient.invalidateQueries({
        queryKey: ["seller-orders", variables.orderId],
      });
    },
  });
};

export const useShipmentLabel = () => {
  return useMutation({
    mutationFn: ({
      orderId,
      shipmentId,
    }: {
      orderId: string;
      shipmentId: string;
    }) => getShipmentLabelApi(orderId, shipmentId),
  });
};

export const useTrackShipment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      orderId,
      shipmentId,
    }: {
      orderId: string;
      shipmentId: string;
    }) => trackShipmentApi(orderId, shipmentId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["seller-orders", variables.orderId],
      });
    },
  });
};

export const useRequestPickup = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      orderId,
      payload,
    }: {
      orderId: string;
      payload: RequestPickupPayload;
    }) => requestPickupApi(orderId, payload),
    onSuccess: (_data, variables) => {
      // Invalidate all seller order queries
      queryClient.invalidateQueries({ queryKey: ["seller-orders"] });
      queryClient.invalidateQueries({
        queryKey: ["seller-orders", variables.orderId],
      });
      // Also invalidate batch queries to refresh shipment grouping
      queryClient.invalidateQueries({ queryKey: ["seller-order-batch"] });
      queryClient.invalidateQueries({ queryKey: ["seller-order-batch-shipments"] });
      // Refetch to ensure fresh data
      queryClient.refetchQueries({ queryKey: ["seller-order-batch"] });
      queryClient.refetchQueries({ queryKey: ["seller-order-batch-shipments"] });
    },
  });
};

export const useDownloadSellerInvoice = () => {
  return useMutation({
    mutationFn: (orderId: string) => downloadSellerInvoiceApi(orderId),
  });
};

export const useDownloadSellerLabel = () => {
  return useMutation({
    mutationFn: (orderId: string) => downloadSellerLabelApi(orderId),
  });
};

export const useCancelSellerOrder = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => cancelSellerOrderApi(orderId),
    onSuccess: (_data, orderId) => {
      queryClient.invalidateQueries({ queryKey: ["seller-orders"] });
      queryClient.invalidateQueries({
        queryKey: ["seller-orders", orderId],
      });
      queryClient.invalidateQueries({ queryKey: ["seller-order-batch"] });
    },
  });
};
