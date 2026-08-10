import { useQuery } from '@tanstack/react-query'
import API from '../lib/axios'
import type { CategoriesResponse, Category } from '../types/category'

// Fetch all categories
export const useCategories = (params?: {
  top?: boolean
  status?: string
  includeSubcategories?: boolean
  parent?: string
  limit?: number
}) => {
  return useQuery<CategoriesResponse>({
    queryKey: ['categories', params],
    queryFn: async () => {
      const queryParams = new URLSearchParams()

      // Only add 'top' param if it's explicitly true
      if (params?.top === true) {
        queryParams.append('top', 'true')
      }

      if (params?.status) {
        queryParams.append('status', params.status)
      }

      if (params?.includeSubcategories) {
        queryParams.append('includeSubcategories', 'true')
      }

      if (params?.parent) {
        queryParams.append('parent', params.parent)
      }

      if (params?.limit) {
        queryParams.append('limit', params.limit.toString())
      }

      const url = queryParams.toString() ? `/categories?${queryParams}` : '/categories'
      const response = await API.get(url)
      return response.data
    },
  })
}

// Fetch top categories (includes both root categories and subcategories with top flag)
export const useTopCategories = () => {
  return useCategories({ top: true, status: 'active', includeSubcategories: true })
}

// Fetch single category
export const useCategory = (slug: string) => {
  return useQuery<Category>({
    queryKey: ['category', slug],
    queryFn: async () => {
      const response = await API.get(`/categories/${slug}`)
      return response.data
    },
    enabled: !!slug,
  })
}
