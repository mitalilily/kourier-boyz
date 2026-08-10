import { useQuery } from '@tanstack/react-query'
import API from '../lib/axios'

export interface AboutUsContent {
  title: string
  content: string
  heroImage?: string
  mission?: string
  vision?: string
}

interface AboutUsResponse {
  success: boolean
  data: AboutUsContent
}

// Fetch public About Us content
export const useAboutUs = () => {
  return useQuery<AboutUsContent>({
    queryKey: ['about-us'],
    queryFn: async () => {
      const response = await API.get<AboutUsResponse>('/admin/settings/public/about-us')
      return response.data.data
    },
    retry: false,
  })
}

