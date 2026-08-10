import API from '../api/axiosInstance'

export interface SellerCoupon {
  _id: string
  seller: { _id: string; businessName?: string; email?: string; storeSlug?: string }
  couponCode?: string
  discountType: 'flat' | 'percent'
  discountValue: number
  productIds?: Array<{ _id: string; name: string; slug?: string }>
  categoryIds?: Array<{ _id: string; name: string; slug?: string }>
  startDate: string | Date
  endDate: string | Date
  maxRedemptions?: number
  maxRedemptionsPerUser?: number
  status: 'active' | 'paused' | 'expired'
  redeemedCount?: number
  requiresApproval?: boolean
  isApproved?: boolean
  approvedBy?: { _id: string; name?: string; email?: string }
  approvedAt?: string | Date
  description?: string
  deactivationReason?: string
  deactivatedBy?: { _id: string; name?: string; email?: string }
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
  totalDiscountGiven: number
  redemptions: Array<{
    _id: string
    user: { _id: string; name?: string; email?: string }
    order?: any
    status: 'clipped' | 'applied' | 'redeemed'
    discountAmount?: number
    createdAt: string | Date
  }>
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

export interface CouponAnalytics {
  totalCoupons: number
  activeCoupons: number
  pausedCoupons: number
  expiredCoupons: number
  totalRedemptions: number
  totalDiscountGiven: number
  uniqueUsers: number
  conversionRate: number
  topCoupons: Array<{
    coupon: SellerCoupon
    redemptions: number
  }>
}

// Get all seller coupons
export const getAllSellerCoupons = async (params?: {
  sellerId?: string
  status?: string
  search?: string
  page?: number
  limit?: number
}): Promise<CouponsResponse> => {
  const response = await API.get('/admin/seller-coupons', { params })
  return response.data
}

// Get single seller coupon
export const getSellerCoupon = async (id: string): Promise<CouponResponse> => {
  const response = await API.get(`/admin/seller-coupons/${id}`)
  return response.data
}

// Approve seller coupon
export const approveSellerCoupon = async (id: string): Promise<CouponResponse> => {
  const response = await API.post(`/admin/seller-coupons/${id}/approve`)
  return response.data
}

// Deny seller coupon
export const denySellerCoupon = async (id: string, reason?: string): Promise<CouponResponse> => {
  const response = await API.post(`/admin/seller-coupons/${id}/deny`, { reason })
  return response.data
}

// Pause seller coupon
export const pauseSellerCoupon = async (id: string, reason?: string): Promise<CouponResponse> => {
  const response = await API.post(`/admin/seller-coupons/${id}/pause`, { reason })
  return response.data
}

// Update seller coupon status (active/paused)
export const updateSellerCouponStatus = async (
  id: string,
  status: 'active' | 'paused',
  reason?: string,
): Promise<CouponResponse> => {
  const response = await API.put(`/admin/seller-coupons/${id}/status`, { status, reason })
  return response.data
}

// Delete seller coupon
export const deleteSellerCoupon = async (id: string): Promise<void> => {
  await API.delete(`/admin/seller-coupons/${id}`)
}

// Get coupon analytics
export const getCouponAnalytics = async (params?: {
  sellerId?: string
  startDate?: string
  endDate?: string
}): Promise<CouponAnalytics> => {
  const response = await API.get('/admin/seller-coupons/analytics', { params })
  return response.data
}

