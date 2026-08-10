import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import API from './axiosInstance'

export interface Coupon {
  _id?: string
  code: string
  type: 'percentage' | 'fixed'
  value: number
  minPurchaseAmount?: number
  maxDiscountAmount?: number
  usageLimit?: number
  usageCount: number
  perUserLimit?: number
  validFrom: string | Date
  validTo: string | Date
  status: 'active' | 'inactive' | 'expired'
  applicableTo: 'all' | 'categories' | 'products'
  applicableCategories?: Array<{ _id: string; name: string; slug: string }>
  applicableProducts?: Array<{ _id: string; name: string; slug: string }>
  firstTimeUserOnly?: boolean
  description?: string
  linkedAnnouncement?: {
    _id: string
    title: string
    isActive: boolean
    startDate?: string | Date
    endDate?: string | Date
  }
  createdBy?: { _id: string; name: string; email: string }
  createdAt?: string | Date
  updatedAt?: string | Date
}

export interface CouponPagination {
  total: number
  page: number
  limit: number
  pages: number
}

export interface CouponsResponse {
  coupons: Coupon[]
  pagination: CouponPagination
}

// Get all coupons with filters
export const useCoupons = (params?: {
  search?: string
  status?: string
  type?: string
  page?: number
  limit?: number
}) =>
  useQuery<CouponsResponse>({
    queryKey: ['coupons', params],
    queryFn: async () => {
      const queryParams = new URLSearchParams()
      if (params?.search) queryParams.append('search', params.search)
      if (params?.status) queryParams.append('status', params.status)
      if (params?.type) queryParams.append('type', params.type)
      if (params?.page) queryParams.append('page', params.page.toString())
      if (params?.limit) queryParams.append('limit', params.limit.toString())

      const url = queryParams.toString() ? `/coupons?${queryParams}` : '/coupons'
      return (await API.get(url)).data
    },
  })

// Get single coupon
export const useCoupon = (id: string | undefined) =>
  useQuery<Coupon>({
    queryKey: ['coupon', id],
    queryFn: async () => (await API.get(`/coupons/${id}`)).data,
    enabled: !!id,
  })

// Create coupon
export const useCreateCoupon = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: Partial<Coupon>) => (await API.post('/coupons', data)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coupons'] })
    },
  })
}

// Update coupon
export const useUpdateCoupon = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Coupon> }) =>
      (await API.put(`/coupons/${id}`, data)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coupons'] })
      queryClient.invalidateQueries({ queryKey: ['coupon'] })
    },
  })
}

// Delete coupon
export const useDeleteCoupon = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => await API.delete(`/coupons/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coupons'] })
    },
  })
}

