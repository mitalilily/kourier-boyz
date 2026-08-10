import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import API from './axiosInstance'

export interface Brand {
  _id: string
  seller_id: {
    _id: string
    name: string
    email: string
    businessName?: string
  }
  brand_name: string
  brand_type: 'OWN' | 'OTHER'
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'NEED_MORE_DOCS' | 'REVOKED'
  rejection_reason?: string
  reviewed_by?: {
    _id: string
    name: string
    email: string
  }
  reviewed_at?: string
  created_at: string
  updated_at: string
  documents?: Array<{
    _id: string
    document_type: string
    file_url: string
    uploaded_at: string
  }>
}

export interface BrandsResponse {
  brands: Brand[]
  pagination: {
    total: number
    page: number
    limit: number
    pages: number
  }
}

export interface BrandFilters {
  status?: string
  seller_id?: string
  page?: number
  limit?: number
}

// Get all brands with filters
export const useBrands = (filters?: BrandFilters & { enabled?: boolean }) => {
  const { enabled, ...apiFilters } = filters || {}
  return useQuery<BrandsResponse>({
    queryKey: ['admin-brands', apiFilters],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (apiFilters?.status) params.append('status', apiFilters.status)
      if (apiFilters?.seller_id) params.append('seller_id', apiFilters.seller_id)
      if (apiFilters?.page) params.append('page', String(apiFilters.page))
      if (apiFilters?.limit) params.append('limit', String(apiFilters.limit))

      const url = params.toString() ? `/admin/brands?${params}` : '/admin/brands'
      const res = await API.get(url)
      return res.data
    },
    enabled: enabled !== false,
  })
}

// Update brand status
export const useUpdateBrandStatus = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      status,
      rejection_reason,
      approved_categories,
    }: {
      id: string
      status: 'APPROVED' | 'REJECTED' | 'NEED_MORE_DOCS' | 'REVOKED'
      rejection_reason?: string
      approved_categories?: string[]
    }) => {
      const res = await API.patch(`/admin/brands/${id}/status`, {
        status,
        rejection_reason,
        approved_categories,
      })
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-brands'] })
    },
  })
}

export interface BrandApprovedCategoriesResponse {
  brand_id: string
  brand_name: string
  category_ids: string[]
  categories: Array<{ _id: string; name: string; slug?: string }>
  /** Categories that can be added (excludes already assigned + their subcategories). From backend only. */
  available_to_add_categories: Array<{ _id: string; name: string; slug?: string; parent?: { _id: string; name?: string } | string | null }>
}

// Get approved categories for a brand (for "Add categories" modal)
export const useBrandApprovedCategories = (brandId: string | null, options?: { enabled?: boolean }) => {
  return useQuery<BrandApprovedCategoriesResponse>({
    queryKey: ['admin-brand-approved-categories', brandId],
    queryFn: async () => {
      const res = await API.get(`/admin/brands/${brandId}/approved-categories`)
      return res.data
    },
    enabled: (options?.enabled !== false) && !!brandId,
  })
}

// Add categories to an already approved brand
export const useAddCategoriesToBrand = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, category_ids }: { id: string; category_ids: string[] }) => {
      const res = await API.post(`/admin/brands/${id}/add-categories`, { category_ids })
      return res.data as {
        message: string
        added_count: number
        product_count_unblocked: number
        category_names: string[]
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-brands'] })
      queryClient.invalidateQueries({ queryKey: ['admin-brand-approved-categories', variables.id] })
    },
  })
}

