import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  applyCoupon,
  calculateProductDiscount,
  clipCoupon,
  getAvailableCoupons,
  getClippedCoupons,
  type ApplyCouponRequest,
  type ApplyCouponResponse,
  type CalculateProductDiscountRequest,
  type CalculateProductDiscountResponse,
} from './sellerCoupons'

// Query keys
export const sellerCouponKeys = {
  all: ['sellerCoupons'] as const,
  available: (params?: { productIds?: string | string[]; categoryIds?: string | string[]; sellerId?: string }) =>
    [...sellerCouponKeys.all, 'available', params] as const,
  clipped: () => [...sellerCouponKeys.all, 'clipped'] as const,
}

// Get available coupons
export const useGetAvailableCoupons = (params: {
  productIds?: string | string[]
  categoryIds?: string | string[]
  sellerId?: string
  enabled?: boolean
}) => {
  return useQuery({
    queryKey: sellerCouponKeys.available(params),
    queryFn: () => getAvailableCoupons(params),
    enabled: params.enabled !== false && (!!params.productIds || !!params.categoryIds || !!params.sellerId),
  })
}

// Get clipped coupons
export const useGetClippedCoupons = () => {
  return useQuery({
    queryKey: sellerCouponKeys.clipped(),
    queryFn: () => getClippedCoupons(),
  })
}

// Clip coupon
export const useClipCoupon = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (couponId: string) => clipCoupon(couponId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sellerCouponKeys.clipped() })
      queryClient.invalidateQueries({ queryKey: sellerCouponKeys.all })
    },
  })
}

// Apply coupon
export const useApplyCoupon = () => {
  return useMutation({
    mutationFn: (data: ApplyCouponRequest): Promise<ApplyCouponResponse> => applyCoupon(data),
  })
}

// Calculate product discount
export const useCalculateProductDiscount = () => {
  return useMutation({
    mutationFn: (
      data: CalculateProductDiscountRequest,
    ): Promise<CalculateProductDiscountResponse> => calculateProductDiscount(data),
  })
}

