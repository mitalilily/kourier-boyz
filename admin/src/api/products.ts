import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import API from './axiosInstance'

export type AdminProduct = {
  _id: string
  name: string
  sku: string
  mainImage?: string
  images: string[]
  seller?: { _id: string; name: string; email: string }
  category?: {
    _id: string
    name: string
    slug?: string
    parent?: { _id: string; name: string; slug?: string } | string | null
  }
  status: 'draft' | 'active' | 'inactive' | 'out_of_stock' | 'pending_approval'
  isFeatured: boolean
  stock?: number
  totalStock?: number
  lowStockVariants?: number
  hasVariants?: boolean
  statusLockedByAdmin?: boolean
  createdAt?: string
  updatedAt?: string
  // Optional lifecycle flags on notices
  // These may be missing on older records, so keep optional
  // and handle defensively in UI
  // (Inline type for brevity)
  objections?: Array<{
    reason: string
    createdAt: string
    addressedBySeller?: boolean
    addressedAt?: string
    resolved?: boolean
    resolvedAt?: string
    resolutionNote?: string
  }>
  description?: string
  shortDescription?: string
  variants?: Array<{
    _id: string
    name: string
    sku: string
    attributes?: Record<string, string>
    price?: number
    stock?: number
    lowStockThreshold?: number
    status?: 'active' | 'inactive' | 'out_of_stock'
    mainImage?: string
    isDefault?: boolean
  }>
  // Pricing & Discounts
  price?: number
  comparePrice?: number
  costPrice?: number
  discountPercent?: number
  discountStart?: string
  discountEnd?: string
  // Inventory settings
  lowStockThreshold?: number
  trackInventory?: boolean
  minOrderQuantity?: number
  maxOrderQuantity?: number
  // Shipping
  requiresShipping?: boolean
  freeShipping?: boolean
  shippingWeight?: number
  shippingDimensions?: { length: number; width: number; height: number }
  // Tax
  taxClass?: string
  taxRate?: number
  // SEO & Marketing
  metaTitle?: string
  metaDescription?: string
  seoKeywords?: string[]
  // Content
  specifications?: Array<{ key: string; value: string }>
  features?: string[]
  tags?: string[]
  filterMetadata?: Array<{ key: string; values: string[] }>
  // Variants meta
  variantAttributes?: string[]
  // Manufacturer & Importer Information
  manufacturerName?: string
  manufacturerAddress?: string
  countryOfOrigin?: string
  importerName?: string
  importerAddress?: string
  // GST/HSN fields
  isGstApplicable?: boolean
  hsnSacCode?: string | null
  gstRatePercent?: number | null
  cgstRatePercent?: number | null
  sgstRatePercent?: number | null
  igstRatePercent?: number | null
  defaultHsnSacCode?: string | null
  defaultGstRatePercent?: number | null
  defaultCgstRatePercent?: number | null
  defaultSgstRatePercent?: number | null
  defaultIgstRatePercent?: number | null
  // Calculated pricing fields
  effectivePrice?: number
  exclusivePrice?: number
  exclusiveTaxAmount?: number
  profit?: number
  // Shipping & Fulfillment
  shippingCharge?: number
  fulfillmentType?: 'self-ship' | 'marketplace-fulfilled'
  // Product Policies
  payOnDelivery?: boolean
  returnable?: boolean
  returnDays?: number
  warranty?: boolean
  warrantyDays?: number
  // Physical attributes
  brand?: string
  weight?: number
  dimensions?: { length: number; width: number; height: number }
  // Warehouse inventory
  warehouseInventory?: Array<{
    warehouseId: string
    warehouseName: string
    quantity: number
    lowStockThreshold?: number
  }>
  // Media metadata
  imageMeta?: Array<{
    url: string
    alt?: string
    isCover?: boolean
    sort?: number
  }>
  // Analytics
  rating?: number
  reviewCount?: number
  soldCount?: number
  viewCount?: number
}

export type ProductCertificateSummary = {
  productId: string
  productName: string
  seller?: {
    _id?: string
    name?: string
    email?: string
    businessName?: string
  } | null
  category?: {
    _id?: string
    name?: string
    slug?: string
    parent?: { _id: string; name: string; slug?: string } | null
  } | null
  ownCertificates: string[]
  inheritedCertificates: string[]
  effectiveCertificates: string[]
  inheritsParentRule: boolean
  certificates: Array<{
    certificateType: string
    status: 'approved' | 'pending' | 'rejected' | 'expired' | 'missing'
    inherited: boolean
    certificateId?: string
    certificateNumber?: string
    documentUrl?: string
    expiryDate?: string
    uploadedAt?: string
    updatedAt?: string
    verifiedOn?: string
    certificateVerifiedBy?: string
    rejectionReason?: string
  }>
  hasAllValid: boolean
  missingCertificates: string[]
}

export type ProductFilters = {
  search?: string
  status?: string
  category?: string
  seller?: string
  page?: number
  limit?: number
  sortBy?: string
  order?: 'asc' | 'desc'
  isFeatured?: boolean | string
  hasVariants?: boolean | string
  minPrice?: number | string
  maxPrice?: number | string
  minStock?: number | string
  maxStock?: number | string
  dateFrom?: string
  dateTo?: string
  dateField?: 'createdAt' | 'updatedAt'
}

export const useAdminProducts = (filters: ProductFilters) =>
  useQuery({
    queryKey: ['admin-products', filters],
    queryFn: async () => (await API.get('/admin/products', { params: filters })).data,
  })

export const useAdminProduct = (id?: string) =>
  useQuery<AdminProduct>({
    queryKey: ['admin-product', id],
    enabled: !!id,
    queryFn: async () => (await API.get(`/admin/products/${id}`)).data,
  })

export const useProductCertificates = (id?: string, options?: { enabled?: boolean }) =>
  useQuery<ProductCertificateSummary>({
    queryKey: ['admin-product-certificates', id],
    enabled: !!id && (options?.enabled ?? true),
    queryFn: async () => (await API.get(`/admin/products/${id}/certificates`)).data,
  })

export const useUpdateProductStatus = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) =>
      (await API.patch(`/admin/products/${id}/status`, { status })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-products'] })
      qc.invalidateQueries({ queryKey: ['admin-product'] })
    },
  })
}

export const useToggleFeatured = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, isFeatured }: { id: string; isFeatured: boolean }) =>
      (await API.patch(`/admin/products/${id}/feature`, { isFeatured })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-products'] })
      qc.invalidateQueries({ queryKey: ['admin-product'] })
    },
  })
}

export const useToggleStatusLock = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      locked,
      recompute,
    }: {
      id: string
      locked: boolean
      recompute?: boolean
    }) =>
      (
        await API.patch(`/admin/products/${id}/status-lock`, {
          locked,
          recompute,
        })
      ).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-product'] })
      qc.invalidateQueries({ queryKey: ['admin-products'] })
    },
  })
}

export const useDeleteProduct = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => (await API.delete(`/admin/products/${id}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-products'] })
    },
  })
}

export const useBulkUpdateStatus = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ productIds, status }: { productIds: string[]; status: string }) =>
      (await API.post('/admin/products/bulk/status', { productIds, status })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-products'] }),
  })
}

export const useBulkDelete = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (productIds: string[]) =>
      (await API.post('/admin/products/bulk/delete', { productIds })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-products'] }),
  })
}

export const downloadProductsCSV = async (filters: ProductFilters) => {
  const { data } = await API.get('/admin/products/export/csv', {
    params: filters,
    responseType: 'blob',
  })
  return data as Blob
}

export const useLowStock = (params: { page?: number; limit?: number; enabled?: boolean }) => {
  const { enabled, ...apiParams } = params
  return useQuery({
    queryKey: ['admin-products-low-stock', apiParams],
    queryFn: async () => (await API.get('/admin/products/low-stock', { params: apiParams })).data,
    enabled: enabled !== false,
  })
}

export const useAnalytics = (params: { period?: string; enabled?: boolean }) => {
  const { enabled, ...apiParams } = params
  return useQuery({
    queryKey: ['admin-products-analytics', apiParams],
    queryFn: async () => (await API.get('/admin/products/analytics', { params: apiParams })).data,
    enabled: enabled !== false,
  })
}

export const useRaiseObjection = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) =>
      (await API.post(`/admin/products/${id}/objections`, { reason })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-product'] }),
  })
}

export const useResolveLatestNotice = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, resolutionNote }: { id: string; resolutionNote?: string }) =>
      (
        await API.patch(`/admin/products/${id}/objections/resolve`, {
          resolutionNote,
        })
      ).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-product'] }),
  })
}

// Review moderation types
export type ReviewModerationStatus = 'pending' | 'approved' | 'rejected'

export type AdminReview = {
  _id: string
  productId: string
  productName: string
  rating: number
  title?: string
  comment: string
  createdAt: string
  updatedAt?: string
  likes?: number
  dislikes?: number
  isVerifiedPurchase?: boolean
  images?: string[]
  videos?: string[]
  moderationStatus: ReviewModerationStatus
  moderationReason?: string
  moderatedAt?: string
  moderatedBy?: string
  reviewer: {
    name: string
    avatarUrl?: string
    city?: string
    state?: string
  }
  userId?: string
}

export type ReviewsResponse = {
  reviews: AdminReview[]
  pagination: {
    total: number
    page: number
    limit: number
    pages: number
  }
}

// Get pending reviews
export const usePendingReviews = (params?: { page?: number; limit?: number; search?: string }) => {
  return useQuery<ReviewsResponse>({
    queryKey: ['admin-pending-reviews', params],
    queryFn: async () => (await API.get('/admin/products/reviews/pending', { params })).data,
  })
}

// Get pending reviews count
export const usePendingReviewsCount = (options?: { enabled?: boolean }) => {
  return useQuery<{ count: number }>({
    queryKey: ['admin-pending-reviews-count'],
    queryFn: async () => (await API.get('/admin/products/reviews/pending/count')).data,
    refetchInterval: 30000, // Refetch every 30 seconds
    enabled: options?.enabled !== false,
  })
}

// Get product reviews (admin view)
export const useProductReviews = (
  productId?: string,
  params?: { status?: ReviewModerationStatus; page?: number; limit?: number },
) => {
  return useQuery<ReviewsResponse>({
    queryKey: ['admin-product-reviews', productId, params],
    queryFn: async () => (await API.get(`/admin/products/${productId}/reviews`, { params })).data,
    enabled: !!productId,
  })
}

// Approve review
export const useApproveReview = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ productId, reviewId }: { productId: string; reviewId: string }) =>
      (await API.patch(`/admin/products/${productId}/reviews/${reviewId}/approve`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-pending-reviews'] })
      qc.invalidateQueries({ queryKey: ['admin-all-reviews'] })
      qc.invalidateQueries({ queryKey: ['admin-product-reviews'] })
      qc.invalidateQueries({ queryKey: ['admin-pending-reviews-count'] })
      qc.invalidateQueries({ queryKey: ['admin-product'] })
    },
  })
}

// Reject review
export const useRejectReview = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      productId,
      reviewId,
      reason,
    }: {
      productId: string
      reviewId: string
      reason: string
    }) =>
      (await API.patch(`/admin/products/${productId}/reviews/${reviewId}/reject`, { reason })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-pending-reviews'] })
      qc.invalidateQueries({ queryKey: ['admin-all-reviews'] })
      qc.invalidateQueries({ queryKey: ['admin-product-reviews'] })
      qc.invalidateQueries({ queryKey: ['admin-pending-reviews-count'] })
      qc.invalidateQueries({ queryKey: ['admin-product'] })
    },
  })
}

// Bulk approve reviews
export const useBulkApproveReviews = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ reviewIds }: { reviewIds: string[] }) =>
      (await API.post('/admin/products/reviews/bulk-approve', { reviewIds })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-pending-reviews'] })
      qc.invalidateQueries({ queryKey: ['admin-all-reviews'] })
      qc.invalidateQueries({ queryKey: ['admin-product-reviews'] })
      qc.invalidateQueries({ queryKey: ['admin-pending-reviews-count'] })
      qc.invalidateQueries({ queryKey: ['admin-product'] })
    },
  })
}

// Bulk reject reviews
export const useBulkRejectReviews = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ reviewIds, reason }: { reviewIds: string[]; reason: string }) =>
      (
        await API.post('/admin/products/reviews/bulk-reject', {
          reviewIds,
          reason,
        })
      ).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-pending-reviews'] })
      qc.invalidateQueries({ queryKey: ['admin-product-reviews'] })
      qc.invalidateQueries({ queryKey: ['admin-pending-reviews-count'] })
      qc.invalidateQueries({ queryKey: ['admin-product'] })
      qc.invalidateQueries({ queryKey: ['admin-all-reviews'] })
    },
  })
}

// Get all reviews (with status filter)
export const useAllReviews = (params?: {
  page?: number
  limit?: number
  search?: string
  status?: 'all' | 'pending' | 'approved' | 'rejected'
}) => {
  return useQuery<ReviewsResponse>({
    queryKey: ['admin-all-reviews', params],
    queryFn: async () => (await API.get('/admin/products/reviews/all', { params })).data,
  })
}

// Delete review
export const useDeleteReview = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ productId, reviewId }: { productId: string; reviewId: string }) =>
      (await API.delete(`/admin/products/${productId}/reviews/${reviewId}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-pending-reviews'] })
      qc.invalidateQueries({ queryKey: ['admin-all-reviews'] })
      qc.invalidateQueries({ queryKey: ['admin-product-reviews'] })
      qc.invalidateQueries({ queryKey: ['admin-pending-reviews-count'] })
      qc.invalidateQueries({ queryKey: ['admin-product'] })
    },
  })
}
