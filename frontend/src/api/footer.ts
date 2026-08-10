import { useQuery } from '@tanstack/react-query'
import API from '../lib/axios'

export interface SocialLink {
  platform: 'facebook' | 'twitter' | 'instagram' | 'youtube' | 'linkedin' | 'pinterest' | 'tiktok' | 'snapchat'
  url: string
  order?: number
}

export interface FooterSettings {
  description?: string
  phone?: string
  email?: string
  address?: string
  socialLinks?: SocialLink[]
}

interface FooterResponse {
  success: boolean
  data: FooterSettings
}

// Fetch public footer settings
export const useFooterSettings = () => {
  return useQuery<FooterResponse>({
    queryKey: ['footer-settings'],
    queryFn: async () => {
      const response = await API.get<FooterResponse>('/admin/settings/public/footer')
      return response.data
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  })
}

