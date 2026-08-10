import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createSellerCoupon,
  deleteSellerCoupon,
  getSellerCoupon,
  getSellerCoupons,
  pauseSellerCoupon,
  resumeSellerCoupon,
  updateSellerCoupon,
  type CouponFormData,
} from './sellerCoupons'

// Query keys
export const sellerCouponKeys = {
  all: ['sellerCoupons'] as const,
  lists: () => [...sellerCouponKeys.all, 'list'] as const,
  list: (filters?: { status?: string; page?: number; limit?: number }) =>
    [...sellerCouponKeys.lists(), filters] as const,
  details: () => [...sellerCouponKeys.all, 'detail'] as const,
  detail: (id: string) => [...sellerCouponKeys.details(), id] as const,
}

// Get all seller coupons
export const useSellerCoupons = (params?: { status?: string; page?: number; limit?: number }) => {
  return useQuery({
    queryKey: sellerCouponKeys.list(params),
    queryFn: () => getSellerCoupons(params),
  })
}

// Get single seller coupon
export const useSellerCoupon = (id: string | undefined) => {
  return useQuery({
    queryKey: sellerCouponKeys.detail(id!),
    queryFn: () => getSellerCoupon(id!),
    enabled: !!id,
  })
}

// Create seller coupon
export const useCreateSellerCoupon = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CouponFormData) => createSellerCoupon(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sellerCouponKeys.lists() })
    },
  })
}

// Update seller coupon
export const useUpdateSellerCoupon = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CouponFormData> }) =>
      updateSellerCoupon(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: sellerCouponKeys.lists() })
      queryClient.invalidateQueries({ queryKey: sellerCouponKeys.detail(variables.id) })
    },
  })
}

// Delete seller coupon
export const useDeleteSellerCoupon = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteSellerCoupon(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sellerCouponKeys.lists() })
    },
  })
}

// Pause seller coupon
export const usePauseSellerCoupon = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => pauseSellerCoupon(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: sellerCouponKeys.lists() })
      queryClient.invalidateQueries({ queryKey: sellerCouponKeys.detail(id) })
    },
  })
}

// Resume seller coupon
export const useResumeSellerCoupon = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => resumeSellerCoupon(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: sellerCouponKeys.lists() })
      queryClient.invalidateQueries({ queryKey: sellerCouponKeys.detail(id) })
    },
  })
}

