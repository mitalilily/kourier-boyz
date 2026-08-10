import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  cancelOrder,
  createOrder,
  downloadInvoice,
  downloadLabel,
  getOrder,
  getUserOrders,
  type CreateOrderRequest,
  type OrdersResponse,
} from "./orders";

// Query keys
export const orderKeys = {
  all: ["orders"] as const,
  lists: () => [...orderKeys.all, "list"] as const,
  list: (filters?: {
    status?: string;
    page?: number;
    limit?: number;
    search?: string;
    months?: number;
  }) => [...orderKeys.lists(), filters] as const,
  details: () => [...orderKeys.all, "detail"] as const,
  detail: (id: string) => [...orderKeys.details(), id] as const,
};

// Get user orders
export const useUserOrders = (params?: {
  status?: string;
  page?: number;
  limit?: number;
  search?: string;
  months?: number;
}) => {
  return useQuery({
    queryKey: orderKeys.list(params),
    queryFn: () => getUserOrders(params),
  });
};

// Infinite user orders (for infinite scrolling)
export const useInfiniteUserOrders = (params?: {
  status?: string;
  limit?: number;
  search?: string;
  months?: number;
}) => {
  const { status, limit = 20, search, months } = params || {};

  return useInfiniteQuery<OrdersResponse>({
    queryKey: [
      ...orderKeys.lists(),
      "infinite",
      { status, limit, search, months },
    ],
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const page = typeof pageParam === "number" ? pageParam : 1;
      return getUserOrders({ status, page, limit, search, months });
    },
    getNextPageParam: (lastPage) => {
      const { page, pages } = lastPage.pagination;
      return page < pages ? page + 1 : undefined;
    },
  });
};

// Get single order
export const useOrder = (id: string | undefined) => {
  return useQuery({
    queryKey: orderKeys.detail(id!),
    queryFn: () => getOrder(id!),
    enabled: !!id,
  });
};

// Create order
export const useCreateOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateOrderRequest) => createOrder(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orderKeys.lists() });
      // Invalidate cart queries to refresh cart after order
      queryClient.invalidateQueries({ queryKey: ["cart"] });
    },
  });
};

// Download invoice
export const useDownloadInvoice = () => {
  return useMutation({
    mutationFn: ({
      orderId,
      onProgress,
    }: {
      orderId: string
      onProgress?: (progress: { loaded: number; total?: number }) => void
    }) => downloadInvoice(orderId, onProgress),
  })
}

// Download label
export const useDownloadLabel = () => {
  return useMutation({
    mutationFn: (orderId: string) => downloadLabel(orderId),
  });
};

// Cancel order
export const useCancelOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (orderId: string) => cancelOrder(orderId),
    onSuccess: (_data, orderId) => {
      queryClient.invalidateQueries({ queryKey: orderKeys.lists() });
      queryClient.invalidateQueries({ queryKey: orderKeys.detail(orderId) });
    },
  });
};
