import API from '@/lib/axios'
import { useMutation, useQuery } from '@tanstack/react-query'
import type { CartItem } from '@/types/cart'

export interface CouponValidationRequest {
  code: string
  cartTotal: number
  userId?: string
  cartItems?: Array<{
    product?: {
      _id: string
      category?: {
        _id: string
      }
    }
  }>
}

export interface CouponValidationResponse {
  valid: boolean
  coupon?: {
    _id: string
    code: string
    type: 'percentage' | 'fixed'
    value: number
    discount: number
    maxDiscountAmount?: number
    description?: string
  }
  error?: string
}

export interface ApplicableCoupon {
  _id: string
  code: string
  type: 'percentage' | 'fixed'
  value: number
  discount: number
  maxDiscountAmount?: number
  description?: string
  termsAndConditions?: string[]
  minPurchaseAmount?: number
  validFrom?: string
  validTo?: string
  isApplicable?: boolean
  isAlmostApplicable?: boolean
  amountNeeded?: number
}

export interface ApplicableCouponsResponse {
  coupons: ApplicableCoupon[]
}

export const useValidateCoupon = () => {
  return useMutation({
    mutationFn: async (payload: CouponValidationRequest) => {
      const res = await API.post('/coupons/validate', payload)
      return res.data as CouponValidationResponse
    },
    // Removed onError toast - errors will be shown below input field
  })
}

export const useApplicableCoupons = (
  cartTotal: number,
  cartItems: CartItem[],
  userId?: string,
  enabled: boolean = true,
) => {
  return useQuery<ApplicableCouponsResponse>({
    queryKey: ['applicableCoupons', cartTotal, cartItems, userId],
    queryFn: async () => {
      const cartItemsPayload = cartItems.map((item) => ({
        product: {
          _id: item.product._id,
          category: item.product.category ? { _id: item.product.category } : undefined,
        },
      }))
      
      const params = new URLSearchParams()
      params.append('cartTotal', cartTotal.toString())
      params.append('cartItems', JSON.stringify(cartItemsPayload))
      if (userId) {
        params.append('userId', userId)
      }
      
      const res = await API.get(`/coupons/applicable?${params.toString()}`)
      return res.data as ApplicableCouponsResponse
    },
    enabled: enabled && cartTotal > 0 && cartItems.length > 0,
    staleTime: 60000, // Cache for 1 minute
  })
}
