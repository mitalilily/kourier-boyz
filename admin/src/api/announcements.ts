import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import API from './axiosInstance'

export interface Announcement {
  _id: string
  title: string
  message?: string
  link?: string
  linkText?: string
  backgroundColor?: string
  textColor?: string
  isActive: boolean
  startDate?: string
  endDate?: string
  dismissible: boolean
  targetAudience?: 'all' | 'authenticated' | 'guest'
  createdAt: string
  updatedAt: string
  createdBy?: {
    _id: string
    name: string
    email: string
  }
}

interface AnnouncementsResponse {
  announcements: Announcement[]
  pagination?: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

interface AnnouncementFilters {
  page?: number
  limit?: number
  isActive?: boolean
}

export const useAnnouncements = (filters: AnnouncementFilters = {}) => {
  return useQuery({
    queryKey: ['announcements', filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filters.page) params.append('page', filters.page.toString())
      if (filters.limit) params.append('limit', filters.limit.toString())
      if (filters.isActive !== undefined) params.append('isActive', filters.isActive.toString())

      const response = await API.get<AnnouncementsResponse>(`/announcements?${params.toString()}`)
      return response.data.announcements
    },
  })
}

export const useAnnouncement = (id: string) => {
  return useQuery({
    queryKey: ['announcement', id],
    queryFn: async () => {
      const response = await API.get<Announcement>(`/announcements/${id}`)
      return response.data
    },
    enabled: !!id,
  })
}

export const useCreateAnnouncement = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: Partial<Announcement>) => {
      const response = await API.post<Announcement>('/announcements', data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] })
    },
  })
}

export const useUpdateAnnouncement = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Announcement> }) => {
      const response = await API.put<Announcement>(`/announcements/${id}`, data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] })
      queryClient.invalidateQueries({ queryKey: ['announcement'] })
    },
  })
}

export const useDeleteAnnouncement = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await API.delete(`/announcements/${id}`)
      return id
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] })
    },
  })
}

