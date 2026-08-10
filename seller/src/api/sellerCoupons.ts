import API from './axiosInstance'

export interface SellerCoupon {
  _id?: string
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
  totalRedemptions?: number // Total redemptions (clipped + applied + redeemed)
  clippedCount?: number // Number of clipped coupons
  appliedCount?: number // Number of applied coupons
  requiresApproval?: boolean
  isApproved?: boolean
  approvedBy?: string | { _id: string; name?: string; email?: string }
  approvedAt?: string | Date
  description?: string
  deactivationReason?: string
  deactivatedBy?: string | { _id: string; name?: string; email?: string }
  deactivatedAt?: string | Date
  createdAt?: string | Date
  updatedAt?: string | Date
}

export interface CouponStats {
  totalRedemptions: number
  clippedCount: number
  appliedCount: number
  redeemedCount: number
  uniqueUsers: number
}

export interface CouponFormData {
  couponCode?: string
  discountType: 'flat' | 'percent'
  discountValue: number
  productIds?: string[]
  categoryIds?: string[]
  startDate: string | Date
  endDate: string | Date
  maxRedemptions?: number
  maxRedemptionsPerUser?: number
  status?: 'active' | 'paused' | 'expired'
  description?: string
}

export interface CouponsResponse {
  coupons: SellerCoupon[]
  pagination: {
    total: number
    page: number
    limit: number
    pages: number
  }
}

export interface CouponResponse {
  coupon: SellerCoupon
  stats?: CouponStats
}

// Get all seller coupons
export const getSellerCoupons = async (params?: {
  status?: string
  page?: number
  limit?: number
}): Promise<CouponsResponse> => {
  const response = await API.get('/coupons', { params })
  return response.data
}

// Get single seller coupon
export const getSellerCoupon = async (id: string): Promise<CouponResponse> => {
  const response = await API.get(`/coupons/${id}`)
  return response.data
}

// Create seller coupon
export const createSellerCoupon = async (data: CouponFormData): Promise<CouponResponse> => {
  const response = await API.post('/coupons', data)
  return response.data
}

// Update seller coupon
export const updateSellerCoupon = async (
  id: string,
  data: Partial<CouponFormData>,
): Promise<CouponResponse> => {
  const response = await API.put(`/coupons/${id}`, data)
  return response.data
}

// Delete seller coupon
export const deleteSellerCoupon = async (id: string): Promise<void> => {
  await API.delete(`/coupons/${id}`)
}

// Pause seller coupon
export const pauseSellerCoupon = async (id: string): Promise<CouponResponse> => {
  const response = await API.post(`/coupons/${id}/pause`)
  return response.data
}

// Resume seller coupon
export const resumeSellerCoupon = async (id: string): Promise<CouponResponse> => {
  const response = await API.post(`/coupons/${id}/resume`)
  return response.data
}

