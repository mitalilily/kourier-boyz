import { create } from 'zustand'

import API from '../api/axiosInstance'
import type { ModulePermissions } from '../api/roles'

interface AuthState {
  token: string | null
  role: string | null
  name: string | null
  email: string | null
  userId: string | null
  permissions: ModulePermissions | null
  loading: boolean
  error: string | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  setPermissions: (permissions: ModulePermissions) => void
}

const getStoredValue = (key: string): string | null => {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(key)
}

export const useAuthStore = create<AuthState>((set) => ({
  token: getStoredValue('token'),
  role: getStoredValue('role'),
  name: getStoredValue('name'),
  email: getStoredValue('email'),
  userId: getStoredValue('userId'),
  permissions: null,
  loading: false,
  error: null,
  login: async (email: string, password: string) => {
    set({ loading: true, error: null })
    try {
      const res = await API.post('/admin/auth/login', { email, password, role: 'super-admin' })
      const { token, role, name, email: userEmail, userId } = res.data
      if (typeof window !== 'undefined') {
        localStorage.setItem('token', token)
        localStorage.setItem('role', role)
        localStorage.setItem('name', name)
        localStorage.setItem('email', userEmail)
        localStorage.setItem('userId', userId)
      }
      set({ token, role, name, email: userEmail, userId, loading: false })
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } }
      set({ error: axiosError.response?.data?.error || 'Login failed', loading: false })
    }
  },
  logout: () => {
    if (typeof window !== 'undefined') {
      void API.post('/admin/auth/logout').catch(() => undefined)
      localStorage.removeItem('token')
      localStorage.removeItem('role')
      localStorage.removeItem('name')
      localStorage.removeItem('email')
      localStorage.removeItem('userId')
    }
    set({ 
      token: null, 
      role: null, 
      name: null, 
      email: null, 
      userId: null, 
      permissions: null,
      loading: false, 
      error: null 
    })
  },
  setPermissions: (permissions: ModulePermissions) => {
    set({ permissions })
  },
}))
