import axios, { type AxiosRequestConfig, type AxiosResponse } from 'axios'
import { useAuthStore } from '../store/authStore'

// Authenticated seller API
const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5004/api/seller',
  withCredentials: true,
})

// Public, unauthenticated API (used for things like product serviceability)
export const PublicAPI = axios.create({
  baseURL: import.meta.env.VITE_PUBLIC_API_URL || 'http://localhost:5004/api',
  withCredentials: true,
})

// Add token to requests
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('seller_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export default API

// Response interceptor: handle 401 -> try refresh, else logout
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
    const errorCode = error?.response?.data?.code || error?.response?.data?.error

    // Check if account is deactivated - log out immediately
    // But don't redirect if we're already on the login page (let it handle the error)
    if (errorCode === 'ACCOUNT_DEACTIVATED') {
      try {
        localStorage.removeItem('seller_token')
        localStorage.removeItem('seller_data')
        useAuthStore.setState({ token: null, user: null })
      } catch {
        void 0
      }
      // Only redirect if we're not already on the login page
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        window.location.href = '/login'
      }
      // Always reject the error so the component can handle it
      return Promise.reject(error)
    }

    if (status === 401) {
      if (requestUrl.includes('/auth/refresh')) {
        isRefreshing = false
        pendingQueue.forEach((cb) => cb(undefined))
        pendingQueue = []
        try {
          localStorage.removeItem('seller_token')
          localStorage.removeItem('seller_data')
          useAuthStore.setState({ token: null, user: null })
        } catch {
          void 0
        }
        if (typeof window !== 'undefined') {
          window.location.href = '/login'
        }
        return Promise.reject(error)
      }

      if (!originalRequest._retry) {
        originalRequest._retry = true
        try {
          if (isRefreshing) {
            await new Promise((resolve, reject) => {
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
          // Attempt refresh using separate client to avoid recursion
          const refreshRes = await refreshClient.post('/auth/refresh', {})
          const newToken: string | undefined = refreshRes?.data?.token
          if (newToken) {
            localStorage.setItem('seller_token', newToken)
            // Update auth store if available
            try {
              // Update token while preserving user data
              useAuthStore.setState({ token: newToken })
            } catch {
              // Store might not be available
            }
            if (originalRequest.headers) {
              ;(
                originalRequest.headers as Record<string, string>
              ).Authorization = `Bearer ${newToken}`
            }
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

      try {
        localStorage.removeItem('seller_token')
        localStorage.removeItem('seller_data')
        useAuthStore.setState({ token: null, user: null })
      } catch {
        void 0
      }
      if (typeof window !== 'undefined') {
        window.location.href = '/login'
      }
    }

    return Promise.reject(error)
  },
)
