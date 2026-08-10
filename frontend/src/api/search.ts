import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import API from '../lib/axios'

export type SearchSort = 'relevance' | 'price_asc' | 'price_desc' | 'newest'

export type SearchFilters = {
  category?: string
  brand?: string[] | string
  tag?: string[] | string
  minPrice?: number
  maxPrice?: number
  minRating?: number
  includeOutOfStock?: boolean
  attributes?: Record<string, string[]>
}

export interface SearchResultProduct {
  _id: string
  name: string
  slug: string
  mainImage?: string
  images?: string[]
  price?: number
  rating?: number
  reviewCount?: number
  brand?: string
  category?: { _id: string; name: string; slug?: string }
  status?: 'active' | 'inactive' | 'out_of_stock'
  totalStock?: number
  stock?: number
  soldCount?: number
  viewCount?: number
}

export interface SearchResponse {
  products: SearchResultProduct[]
  pagination: { total: number; page: number; limit: number; pages: number; hasMore?: boolean }
  didYouMean?: string
}

export const useSearch = (params: {
  q: string
  page?: number
  limit?: number
  sort?: SearchSort
  filters?: SearchFilters
}) => {
  return useQuery<SearchResponse>({
    queryKey: ['search', params],
    queryFn: async () => {
      const searchParams = new URLSearchParams()
      searchParams.set('q', params.q)
      if (params.page) searchParams.set('page', String(params.page))
      if (params.limit) searchParams.set('limit', String(params.limit))
      if (params.sort) searchParams.set('sort', params.sort)
      if (params.filters) searchParams.set('filters', JSON.stringify(params.filters))
      const { data } = await API.get<SearchResponse>(`/search?${searchParams.toString()}`)
      return data
    },
    enabled: !!params.q,
  })
}

export const useSearchInfinite = (params: {
  q: string
  categoryId?: string
  limit?: number
  sort?: SearchSort
  filters?: SearchFilters
}) => {
  const limit = params.limit ?? 24
  return useInfiniteQuery<SearchResponse>({
    queryKey: ['search', 'infinite', params],
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const page = typeof pageParam === 'number' ? pageParam : 1
      const searchParams = new URLSearchParams()
      if (params.q) {
        searchParams.set('q', params.q)
      }
      if (params.categoryId) {
        searchParams.set('categoryId', params.categoryId)
      }
      searchParams.set('page', String(page))
      searchParams.set('limit', String(limit))
      if (params.sort) searchParams.set('sort', params.sort)
      if (params.filters) searchParams.set('filters', JSON.stringify(params.filters))
      const { data } = await API.get<SearchResponse>(`/search?${searchParams.toString()}`)
      return data
    },
    getNextPageParam: (lastPage) => {
      const { page, pages } = lastPage.pagination
      if (lastPage.pagination.hasMore ?? page < pages) return page + 1
      return undefined
    },
    enabled: !!params.q || !!params.categoryId,
  })
}

export interface SearchSuggestionsResponse {
  products: Array<{
    id: string
    name: string
    slug?: string
    image?: string
    brand?: string
    price?: number
    category?: string
  }>
  categories: Array<{ id: string; name: string; slug?: string; image?: string }>
  trending: string[]
}

export const fetchSearchSuggestions = async (q: string, signal?: AbortSignal) => {
  const params = new URLSearchParams()
  params.set('q', q)
  const { data } = await API.get<SearchSuggestionsResponse>(
    `/search-suggestions?${params.toString()}`,
    { signal },
  )
  return data
}

export interface UserRecentSearchesResponse {
  recent: Array<{ query: string; searchedAt?: string }>
}

export const fetchUserRecentSearches = async () => {
  const { data } = await API.get<UserRecentSearchesResponse>('/recent-searches')
  return data
}

export const deleteUserRecentSearch = async (q: string) => {
  const params = new URLSearchParams()
  params.set('q', q)
  const { data } = await API.delete<{ success: boolean }>(`/recent-searches?${params.toString()}`)
  return data
}

// Custom hooks (align with app pattern)
export const useUserRecentSearches = (enabled?: boolean) => {
  return useQuery<string[]>({
    queryKey: ['recent-searches', 'user'],
    queryFn: async () => {
      const resp = await fetchUserRecentSearches()
      return (resp.recent ?? []).map((r) => r.query).slice(0, 10)
    },
    enabled: enabled !== undefined ? enabled : true,
    staleTime: 5 * 60 * 1000,
  })
}

export const useGuestRecentSearches = (enabled?: boolean) => {
  return useQuery<string[]>({
    queryKey: ['recent-searches', 'guest'],
    queryFn: async () => {
      try {
        const raw = localStorage.getItem('recent_searches')
        const arr = raw ? (JSON.parse(raw) as string[]) : []
        return Array.isArray(arr) ? arr.slice(0, 10) : []
      } catch {
        return []
      }
    },
    enabled: enabled !== undefined ? enabled : true,
    staleTime: 60 * 1000,
  })
}
