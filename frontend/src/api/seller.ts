import { useQuery } from '@tanstack/react-query'
import API from '../lib/axios'

export interface StoreBanner {
  imageUrl: string
  category?: string
  order: number
  gridSpan: number
}

export interface Seller {
  _id: string
  name: string
  businessName?: string
  storeLogo?: string
  storeSlug: string
  storeBanner?: string // Single banner for header
  storefrontBanners?: StoreBanner[] // Multiple banners for home page (below categories)
  storeVideo?: string // Video URL (YouTube, Vimeo, etc.) - mutually exclusive with storeVideoFile
  storeVideoFile?: string // Uploaded video file URL - mutually exclusive with storeVideo
  storeDescription?: string
  storeStatus?: 'active' | 'inactive'
  shippingPolicy?: string
  returnPolicy?: string
  refundPolicy?: string
  cancellationPolicy?: string
  warrantyPolicy?: string
  replacementPolicy?: string
  defaultShippingRate?: number
  storeEmail?: string
  storePhone?: string
  supportEmail?: string
  website?: string
  facebook?: string
  instagram?: string
  twitter?: string
  youtube?: string
  linkedin?: string
  storeMetaTitle?: string
  storeMetaDescription?: string
  brandNames?: string[]
  storeTheme?: string
  createdAt?: string
}

export interface SellerCategory {
  _id: string
  name: string
  slug: string
  mainImage?: string
  parent?: {
    _id: string
    name: string
    slug: string
  }
  productCount: number
  subcategories?: SellerCategory[] // Subcategories if present
}

export interface SellerCategoriesResponse {
  categories: SellerCategory[]
}

interface ProductVariant {
  _id: string
  sellingPrice?: number
  originalPrice?: number
  price?: number
  effectivePrice?: number // What customer actually pays (from backend)
  comparePrice?: number
}

export interface SellerProduct {
  _id: string
  slug?: string
  name: string
  description?: string
  shortDescription?: string
  mainImage?: string
  images?: string[]
  sellingPrice?: number
  originalPrice?: number
  hasVariants?: boolean
  variants?: ProductVariant[]
}

export interface SellerProductsResponse {
  products: SellerProduct[]
  pagination: {
    total: number
    page: number
    limit: number
    pages: number
  }
}

// Fetch seller by slug
export const useSellerBySlug = (slug: string) => {
  return useQuery<Seller>({
    queryKey: ['seller', slug],
    queryFn: async () => {
      const response = await API.get(`/seller/${slug}`)
      return response.data
    },
    enabled: !!slug,
  })
}

// Fetch seller products by slug
export const useSellerProductsBySlug = (
  slug: string,
  params?: {
    status?: string
    search?: string
    category?: string
    featured?: boolean
    page?: number
    limit?: number
    sortBy?: string
    order?: 'asc' | 'desc'
    minPrice?: number
    maxPrice?: number
  },
) => {
  return useQuery<SellerProductsResponse>({
    queryKey: ['seller-products', slug, params],
    queryFn: async () => {
      const queryParams = new URLSearchParams()

      if (params?.status) {
        queryParams.append('status', params.status)
      }
      if (params?.search) {
        queryParams.append('search', params.search)
      }
      if (params?.category) {
        queryParams.append('category', params.category)
      }
      if (params?.featured) {
        queryParams.append('featured', 'true')
      }
      if (params?.page) {
        queryParams.append('page', String(params.page))
      }
      if (params?.limit) {
        queryParams.append('limit', String(params.limit))
      }
      if (params?.sortBy) {
        queryParams.append('sortBy', params.sortBy)
      }
      if (params?.order) {
        queryParams.append('order', params.order)
      }
      if (params?.minPrice) {
        queryParams.append('minPrice', String(params.minPrice))
      }
      if (params?.maxPrice) {
        queryParams.append('maxPrice', String(params.maxPrice))
      }

      const url = queryParams.toString()
        ? `/seller/${slug}/products?${queryParams}`
        : `/seller/${slug}/products`
      const response = await API.get(url)
      return response.data
    },
    enabled: !!slug,
  })
}

// Fetch seller categories by slug
export const useSellerCategoriesBySlug = (slug: string) => {
  return useQuery<SellerCategoriesResponse>({
    queryKey: ['seller-categories', slug],
    queryFn: async () => {
      const response = await API.get(`/seller/${slug}/categories`)
      return response.data
    },
    enabled: !!slug,
  })
}
