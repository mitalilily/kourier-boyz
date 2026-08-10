import API from '@/lib/axios'

export interface SellerCoupon {
  _id: string
  seller: string | { _id: string; businessName?: string; storeSlug?: string }
  couponCode?: string
  discountType: 'flat' | 'percent'
  discountValue: number
  productIds?: Array<{ _id: string; name: string; slug?: string; mainImage?: string }> | string[]
  categoryIds?: Array<{ _id: string; name: string; slug?: string }> | string[]
  startDate: string | Date
  endDate: string | Date
  maxRedemptions?: number
  maxRedemptionsPerUser?: number
  status: 'active' | 'paused' | 'expired'
  redeemedCount?: number
  requiresApproval?: boolean
  isApproved?: boolean
  description?: string
  createdAt?: string | Date
  updatedAt?: string | Date
}

export interface CouponRedemption {
  _id: string
  coupon: SellerCoupon | string
  user: string
  order?: string
  status: 'clipped' | 'applied' | 'redeemed'
  discountAmount?: number
  orderTotal?: number
  createdAt: string | Date
}

export interface AvailableCouponsResponse {
  coupons: SellerCoupon[]
}

export interface ClippedCouponsResponse {
  coupons: CouponRedemption[]
}

export interface ApplyCouponRequest {
  couponId: string
  cartItems: Array<{
    product: { _id: string } | string
    variant?: { _id: string } | string
    quantity: number
    price?: number
  }>
  cartTotal: number
}

export interface ApplyCouponResponse {
  valid: boolean
  discount: number
  eligibleTotal: number
  eligibleItems: number
  coupon: {
    _id: string
    couponCode?: string
    discountType: 'flat' | 'percent'
    discountValue: number
    description?: string
  }
}

// Get available coupons for products/categories
export const getAvailableCoupons = async (params: {
  productIds?: string | string[]
  categoryIds?: string | string[]
  sellerId?: string
}): Promise<AvailableCouponsResponse> => {
  console.log('🔍 Frontend: Fetching available coupons with params:', params)
  const response = await API.get('/seller/coupons/available', { params })
  console.log('🔍 Frontend: Received coupons:', response.data)
  return response.data
}

// Clip a coupon
export const clipCoupon = async (couponId: string): Promise<{ message: string; redemption: CouponRedemption }> => {
  const response = await API.post('/seller/coupons/clip', { couponId })
  return response.data
}

// Get user's clipped coupons
export const getClippedCoupons = async (): Promise<ClippedCouponsResponse> => {
  const response = await API.get('/seller/coupons/clipped')
  return response.data
}

// Apply coupon to cart
export const applyCoupon = async (data: ApplyCouponRequest): Promise<ApplyCouponResponse> => {
  const response = await API.post('/seller/coupons/apply', data)
  return response.data
}

// Calculate discount for a product
export interface CalculateProductDiscountRequest {
  couponId: string
  productId: string
  quantity?: number
  variantId?: string
}

export interface CalculateProductDiscountResponse {
  valid: boolean
  coupon: {
    _id: string
    couponCode?: string
    discountType: 'flat' | 'percent'
    discountValue: number
    description?: string
  }
  product: {
    _id: string
    name: string
    price: number
  }
  quantity: number
  originalTotal: number
  discountAmount: number
  discountedTotal: number
  discountedPricePerUnit: number
  allowedDiscountUnits?: number // How many units get discount (maxRedemptionsPerUser limit)
  fullPriceUnits?: number // How many units at full price
}

export const calculateProductDiscount = async (
  data: CalculateProductDiscountRequest,
): Promise<CalculateProductDiscountResponse> => {
  const response = await API.post('/seller/coupons/calculate-discount', data)
  return response.data
}
