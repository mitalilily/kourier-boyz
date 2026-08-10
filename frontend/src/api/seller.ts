import { useQuery } from '@tanstack/react-query'
import API from '../lib/axios'
import { demoProducts } from '../components/Home/demoStoreData'
import { demoSeller, demoSellerCategories, queryDemoProducts } from '../lib/demoCatalog'

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

const asSellerProducts = (products: typeof demoProducts): SellerProduct[] =>
  products.map((product) => ({
    _id: product._id,
    slug: product.slug,
    name: product.name,
    description: product.description,
    shortDescription: product.shortDescription,
    mainImage: product.mainImage,
    images: product.images,
    sellingPrice: product.effectivePrice ?? product.price,
    originalPrice: product.comparePrice ?? product.price,
    hasVariants: false,
  }))

// Fetch seller by slug
export const useSellerBySlug = (slug: string) => {
  return useQuery<Seller>({
    queryKey: ['seller', slug],
    queryFn: async () => {
      try {
        const response = await API.get(`/seller/${slug}`)
        return response.data
      } catch {
        if (slug === demoSeller.storeSlug) return demoSeller
        throw new Error('Seller not found')
      }
    },
    enabled: !!slug,
    placeholderData: slug === demoSeller.storeSlug ? demoSeller : undefined,
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
      try {
        const response = await API.get(url)
        if (response.data?.products?.length || slug !== demoSeller.storeSlug) {
          return response.data
        }
      } catch {
        if (slug !== demoSeller.storeSlug) throw new Error('Seller products not found')
      }
      let products = queryDemoProducts({
        q: params?.search,
        categoryId: params?.category,
        minPrice: params?.minPrice,
        maxPrice: params?.maxPrice,
      })
      if (params?.featured) products = products.filter((product) => product.isFeatured)
      return {
        products: asSellerProducts(products),
        pagination: { total: products.length, page: 1, limit: params?.limit || products.length, pages: 1 },
      }
    },
    enabled: !!slug,
    placeholderData: slug === demoSeller.storeSlug
      ? {
          products: asSellerProducts(
            params?.featured ? demoProducts.filter((product) => product.isFeatured) : demoProducts,
          ),
          pagination: { total: demoProducts.length, page: 1, limit: params?.limit || demoProducts.length, pages: 1 },
        }
      : undefined,
  })
}

// Fetch seller categories by slug
export const useSellerCategoriesBySlug = (slug: string) => {
  return useQuery<SellerCategoriesResponse>({
    queryKey: ['seller-categories', slug],
    queryFn: async () => {
      try {
        const response = await API.get(`/seller/${slug}/categories`)
        if (response.data?.categories?.length || slug !== demoSeller.storeSlug) {
          return response.data
        }
      } catch {
        if (slug === demoSeller.storeSlug) return { categories: demoSellerCategories }
        throw new Error('Seller categories not found')
      }
      return { categories: demoSellerCategories }
    },
    enabled: !!slug,
    placeholderData: slug === demoSeller.storeSlug ? { categories: demoSellerCategories } : undefined,
  })
}
