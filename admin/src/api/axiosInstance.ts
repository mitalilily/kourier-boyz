import axios, { type AxiosRequestConfig, type AxiosResponse } from 'axios'
import { clearMarketplaceAdminStorage, MARKETPLACE_ADMIN_STORAGE } from '../config/authStorage'

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api/marketplace',
  withCredentials: true,
})

API.interceptors.request.use((config) => {
  const token = localStorage.getItem(MARKETPLACE_ADMIN_STORAGE.token)
  // Only set Authorization header if token exists and is not null/undefined/empty
  if (token && token !== 'null' && token !== 'undefined' && token.trim() !== '' && config.headers) {
    config.headers.Authorization = `Bearer ${token}`
  } else if (config.headers) {
    // Remove Authorization header if token is invalid
    delete config.headers.Authorization
  }
  return config
})

// Helper function to handle logout
const handleLogout = async () => {
  try {
    const { useAuthStore } = await import('../store/authStore')
    useAuthStore.getState().logout()
  } catch {
    // Fallback: manually clear storage if store is not available
    if (typeof window !== 'undefined') {
      clearMarketplaceAdminStorage()
    }
  }
  // Redirect to login page
  if (typeof window !== 'undefined') {
    window.location.href = '/login'
  }
}

// Response interceptor: handle 401/403 -> try refresh, else logout
let isRefreshing = false
let pendingQueue: Array<(token?: string) => void> = []
const refreshClient = axios.create({
  baseURL: API.defaults.baseURL,
  withCredentials: true,
})

type RetriableRequest = AxiosRequestConfig & { _retry?: boolean }

API.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error) => {
    const originalRequest = (error.config || {}) as RetriableRequest
    const status = error?.response?.status
    const requestUrl = originalRequest.url ?? ''

    // Handle 403 Forbidden - user doesn't have proper permissions
    if (status === 403) {
      await handleLogout()
      return Promise.reject(error)
    }

    // Handle 401 Unauthorized
    if (status === 401) {
      // If refresh endpoint itself returns 401, logout immediately
      if (requestUrl.includes('/admin/auth/refresh')) {
        isRefreshing = false
        pendingQueue.forEach((cb) => cb(undefined))
        pendingQueue = []
        await handleLogout()
        return Promise.reject(error)
      }

      // Skip refresh if already retried
      if (!originalRequest._retry) {
        originalRequest._retry = true

        try {
          // If already refreshing, queue this request
          if (isRefreshing) {
            return new Promise((resolve, reject) => {
              pendingQueue.push((token) => {
                if (!token) {
                  reject(error)
                  return
                }
                if (originalRequest.headers) {
                  ;(
                    originalRequest.headers as Record<string, string>
                  ).Authorization = `Bearer ${token}`
                }
                resolve(API(originalRequest))
              })
            })
          }

          isRefreshing = true
          // Attempt refresh using separate instance to avoid recursion
          const refreshRes = await refreshClient.post('/admin/auth/refresh', {})
          const newToken: string | undefined = refreshRes?.data?.token

          if (newToken) {
            localStorage.setItem(MARKETPLACE_ADMIN_STORAGE.token, newToken)
            // Update auth store if available
            try {
              const { useAuthStore } = await import('../store/authStore')
              useAuthStore.setState({ token: newToken })
            } catch {
              // Store might not be available
            }

            if (originalRequest.headers) {
              ;(
                originalRequest.headers as Record<string, string>
              ).Authorization = `Bearer ${newToken}`
            }

            // Flush queue with new token
            pendingQueue.forEach((cb) => cb(newToken))
            pendingQueue = []
            isRefreshing = false
            return API(originalRequest)
          }
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError)
          isRefreshing = false
          // Clear pending queue
          pendingQueue.forEach((cb) => cb(undefined))
          pendingQueue = []
        }
      }

      // If refresh failed or request was already retried, logout
      await handleLogout()
    }

    return Promise.reject(error)
  },
)

export default API
