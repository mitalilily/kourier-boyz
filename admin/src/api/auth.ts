import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuthStore } from '../store/authStore'
import { MARKETPLACE_ADMIN_STORAGE } from '../config/authStorage'
import API from './axiosInstance'

export const useLogin = () => {
  return useMutation({
    mutationFn: async (data: { email: string; password: string }) => {
      const res = await API.post('/admin/auth/login', { ...data, role: 'super-admin' })
      return res.data
    },
    onSuccess: (data) => {
      // Save to localStorage
      localStorage.setItem(MARKETPLACE_ADMIN_STORAGE.token, data.token)
      localStorage.setItem(MARKETPLACE_ADMIN_STORAGE.name, data.name)
      localStorage.setItem(MARKETPLACE_ADMIN_STORAGE.role, data.role)

      // Update Zustand store
      useAuthStore.setState({
        token: data.token,
        name: data.name,
        role: data.role,
      })

      toast.success(`Welcome back, ${data.name}!`)
    },
    onError: (err: unknown) => {
      const axiosError = err as { response?: { data?: { message?: string } } }
      toast.error(axiosError.response?.data?.message || 'Invalid email or password!')
    },
  })
}
