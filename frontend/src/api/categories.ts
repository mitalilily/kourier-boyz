import { useQuery } from '@tanstack/react-query'
import API from '../lib/axios'
import type { CategoriesResponse, Category } from '../types/category'
import { demoCategories } from '../components/Home/demoStoreData'

const demoCategoriesResponse: CategoriesResponse = {
  categories: demoCategories,
  stats: {
    total: demoCategories.length,
    active: demoCategories.length,
    inactive: 0,
    top: demoCategories.filter((category) => category.top).length,
  },
}

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
      try {
        const response = await API.get(url)
        return response.data?.categories?.length ? response.data : demoCategoriesResponse
      } catch {
        return demoCategoriesResponse
      }
    },
    placeholderData: demoCategoriesResponse,
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
      try {
        const response = await API.get(`/categories/${slug}`)
        return response.data
      } catch {
        const category = demoCategories.find(
          (item) => item.slug === slug || item._id === slug,
        )
        if (!category) throw new Error('Category not found')
        return category
      }
    },
    placeholderData: demoCategories.find((item) => item.slug === slug || item._id === slug),
    enabled: !!slug,
  })
}
