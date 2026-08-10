import { useQuery } from '@tanstack/react-query'
import API from '../lib/axios'
import type { Banner, BannersResponse } from '../types/banner'

// Fetch banners by position
export const useBanners = (position: Banner['position']) => {
  return useQuery<BannersResponse>({
    queryKey: ['banners', position],
    queryFn: async () => {
      const response = await API.get(`/banners?position=${position}&active=true`)
      return response.data
    },
  })
}

// Fetch all active banners
export const useAllBanners = () => {
  return useQuery<BannersResponse>({
    queryKey: ['banners', 'all'],
    queryFn: async () => {
      const response = await API.get('/banners?active=true')
      return response.data
    },
  })
}
