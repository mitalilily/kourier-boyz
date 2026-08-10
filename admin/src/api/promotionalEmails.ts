import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { PromotionalEmail, Subscriber } from '../types/promotionalEmail'
import API from './axiosInstance'

interface GetPromotionalEmailsParams {
  status?: string
  search?: string
  page?: number
  limit?: number
}

// Get all promotional emails
export const usePromotionalEmails = (params?: GetPromotionalEmailsParams) =>
  useQuery<{ emails: PromotionalEmail[]; pagination: any }>({
    queryKey: ['promotionalEmails', params],
    queryFn: async () => {
      const queryParams = new URLSearchParams()
      if (params?.status) queryParams.append('status', params.status)
      if (params?.search) queryParams.append('search', params.search)
      if (params?.page) queryParams.append('page', params.page.toString())
      if (params?.limit) queryParams.append('limit', params.limit.toString())
      const url = queryParams.toString() ? `/promotional-emails?${queryParams}` : '/promotional-emails'
      return (await API.get(url)).data
    },
  })

// Get single promotional email
export const usePromotionalEmail = (id: string) =>
  useQuery<PromotionalEmail>({
    queryKey: ['promotionalEmail', id],
    queryFn: async () => (await API.get(`/promotional-emails/${id}`)).data,
    enabled: !!id,
  })

// Get promotional email stats
export const usePromotionalEmailStats = () =>
  useQuery<{
    total: number
    published: number
    draft: number
    totalSent: number
    activeSubscribers: number
  }>({
    queryKey: ['promotionalEmailStats'],
    queryFn: async () => (await API.get('/promotional-emails/stats')).data,
  })

// Create promotional email
export const useCreatePromotionalEmail = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (formData: FormData) =>
      (
        await API.post('/promotional-emails', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promotionalEmails'] })
      queryClient.invalidateQueries({ queryKey: ['promotionalEmailStats'] })
    },
  })
}

// Update promotional email
export const useUpdatePromotionalEmail = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, formData }: { id: string; formData: FormData }) =>
      (
        await API.put(`/promotional-emails/${id}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      ).data,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['promotionalEmails'] })
      queryClient.invalidateQueries({ queryKey: ['promotionalEmail', variables.id] })
      queryClient.invalidateQueries({ queryKey: ['promotionalEmailStats'] })
    },
  })
}

// Delete promotional email
export const useDeletePromotionalEmail = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => await API.delete(`/promotional-emails/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promotionalEmails'] })
      queryClient.invalidateQueries({ queryKey: ['promotionalEmailStats'] })
    },
  })
}

// Send promotional email
export const useSendPromotionalEmail = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => (await API.post(`/promotional-emails/${id}/send`)).data,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['promotionalEmails'] })
      queryClient.invalidateQueries({ queryKey: ['promotionalEmail', id] })
      queryClient.invalidateQueries({ queryKey: ['promotionalEmailStats'] })
    },
  })
}

// Subscriber hooks
interface GetSubscribersParams {
  status?: string
  search?: string
  page?: number
  limit?: number
}

export const useSubscribers = (params?: GetSubscribersParams) =>
  useQuery<{ subscribers: Subscriber[]; pagination: any }>({
    queryKey: ['subscribers', params],
    queryFn: async () => {
      const queryParams = new URLSearchParams()
      if (params?.status) queryParams.append('status', params.status)
      if (params?.search) queryParams.append('search', params.search)
      if (params?.page) queryParams.append('page', params.page.toString())
      if (params?.limit) queryParams.append('limit', params.limit.toString())
      const url = queryParams.toString() ? `/subscribers?${queryParams}` : '/subscribers'
      return (await API.get(url)).data
    },
  })

export const useSubscriberStats = () =>
  useQuery<{
    total: number
    active: number
    inactive: number
    bySource: Record<string, number>
  }>({
    queryKey: ['subscriberStats'],
    queryFn: async () => (await API.get('/subscribers/stats')).data,
  })

export const useAddSubscriber = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: { email: string; name?: string }) =>
      (await API.post('/subscribers', data)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscribers'] })
      queryClient.invalidateQueries({ queryKey: ['subscriberStats'] })
    },
  })
}

export const useDeleteSubscriber = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => await API.delete(`/subscribers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscribers'] })
      queryClient.invalidateQueries({ queryKey: ['subscriberStats'] })
    },
  })
}

export const useToggleSubscriberStatus = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => (await API.patch(`/subscribers/${id}/toggle`)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscribers'] })
      queryClient.invalidateQueries({ queryKey: ['subscriberStats'] })
    },
  })
}

