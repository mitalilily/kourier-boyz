import { useMutation } from '@tanstack/react-query'
import API from '../lib/axios'

interface SubscribeNewsletterParams {
  email: string
  name?: string
  source?: 'website' | 'checkout' | 'manual' | 'import'
}

// Subscribe to newsletter
export const useSubscribeNewsletter = () => {
  return useMutation({
    mutationFn: async (params: SubscribeNewsletterParams) => {
      const response = await API.post('/subscribers/subscribe', params)
      return response.data
    },
  })
}

