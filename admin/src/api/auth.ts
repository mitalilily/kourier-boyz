import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuthStore } from '../store/authStore'
import API from './axiosInstance'

export const useLogin = () => {
  return useMutation({
    mutationFn: async (data: { email: string; password: string }) => {
      const res = await API.post('/admin/auth/login', { ...data, role: 'super-admin' })
      return res.data
    },
    onSuccess: (data) => {
      // Save to localStorage
      localStorage.setItem('token', data.token)
      localStorage.setItem('name', data.name)
      localStorage.setItem('role', data.role)

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
