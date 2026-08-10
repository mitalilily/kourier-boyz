import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Banner } from '../types/banner'
import API from './axiosInstance'

// Get all banners
export const useBanners = (params?: { position?: string }) =>
  useQuery<Banner[]>({
    queryKey: ['banners', params],
    queryFn: async () => {
      const queryParams = new URLSearchParams()
      if (params?.position) queryParams.append('position', params.position)
      const url = queryParams.toString() ? `/banners?${queryParams}` : '/banners'
      return (await API.get(url)).data.banners
    },
  })

// Create banner
export const useCreateBanner = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (formData: FormData) =>
      (
        await API.post('/banners', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      ).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['banners'] }),
  })
}

// Update banner
export const useUpdateBanner = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, formData }: { id: string; formData: FormData }) =>
      (
        await API.put(`/banners/${id}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      ).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['banners'] }),
  })
}

// Delete banner
export const useDeleteBanner = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => await API.delete(`/banners/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['banners'] }),
  })
}

// Bulk update banner orders
export const useUpdateBannerOrders = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (orders: { id: string; order: number }[]) =>
      (await API.put('/banners/update-orders', { orders })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['banners'] }),
  })
}
