import { create } from 'zustand'

import API from '../api/axiosInstance'
import type { ModulePermissions } from '../api/roles'
import {
  clearMarketplaceAdminStorage,
  MARKETPLACE_ADMIN_STORAGE,
  migrateLegacyMarketplaceAdminStorage,
} from '../config/authStorage'

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

if (typeof window !== 'undefined') migrateLegacyMarketplaceAdminStorage()

export const useAuthStore = create<AuthState>((set) => ({
  token: getStoredValue(MARKETPLACE_ADMIN_STORAGE.token),
  role: getStoredValue(MARKETPLACE_ADMIN_STORAGE.role),
  name: getStoredValue(MARKETPLACE_ADMIN_STORAGE.name),
  email: getStoredValue(MARKETPLACE_ADMIN_STORAGE.email),
  userId: getStoredValue(MARKETPLACE_ADMIN_STORAGE.userId),
  permissions: null,
  loading: false,
  error: null,
  login: async (email: string, password: string) => {
    set({ loading: true, error: null })
    try {
      const res = await API.post('/admin/auth/login', { email, password, role: 'super-admin' })
      const { token, role, name, email: userEmail, userId } = res.data
      if (typeof window !== 'undefined') {
        localStorage.setItem(MARKETPLACE_ADMIN_STORAGE.token, token)
        localStorage.setItem(MARKETPLACE_ADMIN_STORAGE.role, role)
        localStorage.setItem(MARKETPLACE_ADMIN_STORAGE.name, name)
        localStorage.setItem(MARKETPLACE_ADMIN_STORAGE.email, userEmail)
        localStorage.setItem(MARKETPLACE_ADMIN_STORAGE.userId, userId)
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
      clearMarketplaceAdminStorage()
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
