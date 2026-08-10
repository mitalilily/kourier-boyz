import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Blog } from '../types/blog'
import API from './axiosInstance'

interface GetBlogsParams {
  status?: string
  author?: string
  tag?: string
  category?: string
  search?: string
  page?: number
  limit?: number
}

// Get all blogs
export const useBlogs = (params?: GetBlogsParams) =>
  useQuery<{ blogs: Blog[]; pagination: any }>({
    queryKey: ['blogs', params],
    queryFn: async () => {
      const queryParams = new URLSearchParams()
      if (params?.status) queryParams.append('status', params.status)
      if (params?.author) queryParams.append('author', params.author)
      if (params?.tag) queryParams.append('tag', params.tag)
      if (params?.category) queryParams.append('category', params.category)
      if (params?.search) queryParams.append('search', params.search)
      if (params?.page) queryParams.append('page', params.page.toString())
      if (params?.limit) queryParams.append('limit', params.limit.toString())
      const url = queryParams.toString() ? `/blogs?${queryParams}` : '/blogs'
      return (await API.get(url)).data
    },
  })

// Get single blog
export const useBlog = (id: string) =>
  useQuery<Blog>({
    queryKey: ['blog', id],
    queryFn: async () => (await API.get(`/blogs/${id}`)).data,
    enabled: !!id,
  })

// Get blog stats
export const useBlogStats = () =>
  useQuery<{
    total: number
    published: number
    draft: number
    archived: number
    totalViews: number
  }>({
    queryKey: ['blogStats'],
    queryFn: async () => (await API.get('/blogs/stats')).data,
  })

// Create blog
export const useCreateBlog = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (formData: FormData) =>
      (
        await API.post('/blogs', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blogs'] })
      queryClient.invalidateQueries({ queryKey: ['blogStats'] })
    },
  })
}

// Update blog
export const useUpdateBlog = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, formData }: { id: string; formData: FormData }) =>
      (
        await API.put(`/blogs/${id}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      ).data,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['blogs'] })
      queryClient.invalidateQueries({ queryKey: ['blog', variables.id] })
      queryClient.invalidateQueries({ queryKey: ['blogStats'] })
    },
  })
}

// Delete blog
export const useDeleteBlog = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => await API.delete(`/blogs/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blogs'] })
      queryClient.invalidateQueries({ queryKey: ['blogStats'] })
    },
  })
}

// Get newsletter subscribers (users with newsletter preference enabled)
interface GetNewsletterSubscribersParams {
  search?: string
  page?: number
  limit?: number
}

export const useNewsletterSubscribers = (params?: GetNewsletterSubscribersParams) =>
  useQuery<{ subscribers: Array<{ _id: string; email: string; name?: string; subscribedAt: string; user?: { _id: string; name: string; email: string } }>; pagination: any }>({
    queryKey: ['newsletterSubscribers', params],
    queryFn: async () => {
      const queryParams = new URLSearchParams()
      if (params?.search) queryParams.append('search', params.search)
      if (params?.page) queryParams.append('page', params.page.toString())
      if (params?.limit) queryParams.append('limit', params.limit.toString())
      const url = queryParams.toString() ? `/blogs/subscribers/newsletter?${queryParams}` : '/blogs/subscribers/newsletter'
      return (await API.get(url)).data
    },
  })


