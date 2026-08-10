import { useQuery } from '@tanstack/react-query'
import API from '../lib/axios'

export interface Blog {
  _id: string
  title: string
  slug: string
  content: string
  excerpt?: string
  featuredImage?: string
  author: {
    _id: string
    name: string
    email: string
  }
  status: 'draft' | 'published' | 'archived'
  publishedAt?: string
  tags: string[]
  categories: string[]
  views: number
  metaTitle?: string
  metaDescription?: string
  seoKeywords?: string[]
  createdAt?: string
  updatedAt?: string
}

export interface BlogsResponse {
  blogs: Blog[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

interface GetBlogsParams {
  status?: string
  tag?: string
  category?: string
  search?: string
  page?: number
  limit?: number
}

// Fetch all blogs
export const useBlogs = (params?: GetBlogsParams) => {
  return useQuery<BlogsResponse>({
    queryKey: ['blogs', params],
    queryFn: async () => {
      const queryParams = new URLSearchParams()
      if (params?.status) queryParams.append('status', params.status)
      if (params?.tag) queryParams.append('tag', params.tag)
      if (params?.category) queryParams.append('category', params.category)
      if (params?.search) queryParams.append('search', params.search)
      if (params?.page) queryParams.append('page', params.page.toString())
      if (params?.limit) queryParams.append('limit', params.limit.toString())
      const url = queryParams.toString() ? `/blogs?${queryParams}` : '/blogs'
      const response = await API.get(url)
      return response.data
    },
  })
}

// Fetch single blog by ID or slug
export const useBlog = (idOrSlug: string) => {
  return useQuery<Blog>({
    queryKey: ['blog', idOrSlug],
    queryFn: async () => {
      try {
        const response = await API.get(`/blogs/${idOrSlug}`)
        return response.data
      } catch (error: unknown) {
        // If it's a 404, return null instead of throwing
        const err = error as { response?: { status?: number } }
        if (err?.response?.status === 404) {
          return null as unknown as Blog
        }
        throw error
      }
    },
    enabled: !!idOrSlug,
    retry: false, // Don't retry on 404
  })
}

