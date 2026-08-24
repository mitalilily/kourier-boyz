import axios, { type AxiosRequestConfig, type AxiosResponse } from 'axios'
import { useAuthStore } from '../store/authStore'

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api/marketplace',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
})

// Request interceptor: add token to requests dynamically
API.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('auth_token')
    // Only set Authorization header if token exists and is not null/undefined/empty
    if (token && token !== 'null' && token !== 'undefined' && token.trim() !== '' && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    } else if (config.headers) {
      // Remove Authorization header if token is invalid
      delete config.headers.Authorization
    }
    // Remove Content-Type header for FormData to let axios set it with boundary
    if (config.data instanceof FormData && config.headers) {
      delete config.headers['Content-Type']
    }
  }
  return config
})

// Response interceptor: handle token refresh or logout
let isRefreshing = false
let pendingQueue: Array<(token?: string) => void> = []
const refreshClient = axios.create({
  baseURL: API.defaults.baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
})

type RetriableRequest = AxiosRequestConfig & { _retry?: boolean }

// List of public endpoints that should not trigger login redirect on 401
const PUBLIC_ENDPOINTS = [
  '/categories',
  '/products',
  '/sellers',
  '/search',
  '/blogs',
  '/deals',
  '/best-sellers',
  '/events',
  '/cart', // Allow cart API access for guests (GET only)
  '/auth/profile', // Allow profile check for guests (will return 401 but shouldn't redirect)
]

// Check if an endpoint is public (should be accessible without authentication)
const isPublicEndpoint = (url: string): boolean => {
  if (!url) return false
  // Remove query params and base URL for comparison
  const path = url.split('?')[0].replace(/^\/api/, '')
  return PUBLIC_ENDPOINTS.some((endpoint) => path.startsWith(endpoint))
}

// Check if current route is a public route
const isPublicRoute = (): boolean => {
  if (typeof window === 'undefined') return false
  const pathname = window.location.pathname
  // Public routes that should allow browsing without authentication
  const publicRoutes = [
    '/',
    '/shop',
    '/store',
    '/ship',
    '/track',
    '/rates',
    '/login',
    '/register',
    '/reset-password',
    '/verify-email',
    '/unsubscribe',
    '/product/',
    '/products/',
    '/search',
    '/shop-by-category',
    '/events/',
    '/best-sellers',
    '/seller/',
    '/blog',
    '/about-us',
    '/terms',
    '/privacy-policy',
    '/return-refund-policy',
    '/become-a-seller',
    '/help',
    '/contact',
    '/wishlist/shared/',
    '/cart', // Allow cart access for guests
    '/cart/checkout', // Allow checkout access for guests
  ]
  return publicRoutes.some((route) => pathname === route || pathname.startsWith(route))
}

API.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error) => {
    const originalRequest = (error.config || {}) as RetriableRequest
    const status = error?.response?.status
    const requestUrl = originalRequest.url ?? ''

    // Handle blocked account
    if (status === 403 && error.response?.data?.error === 'ACCOUNT_BLOCKED') {
      const blockedReason =
        error.response.data.blockedReason ||
        'Your account has been blocked. Please contact support for more information.'

      // Clear auth data
      localStorage.removeItem('auth_token')
      localStorage.removeItem('auth_user')
      if (originalRequest.headers) {
        delete (originalRequest.headers as Record<string, string>).Authorization
      }

      // Redirect to login with blocked message
      const message = encodeURIComponent(blockedReason)
      if (typeof window !== 'undefined') {
        window.location.href = `/login?blocked=true&message=${message}`
      }
      return Promise.reject(error)
    }

    // Handle deactivated account
    if (status === 403 && error.response?.data?.error === 'ACCOUNT_DEACTIVATED') {
      const deactivatedMessage =
        error.response.data.message ||
        'Your account has been deactivated. Please contact support if you need to reactivate your account.'

      // Clear auth data
      localStorage.removeItem('auth_token')
      localStorage.removeItem('auth_user')
      if (originalRequest.headers) {
        delete (originalRequest.headers as Record<string, string>).Authorization
      }

      // Redirect to login with deactivated message
      const message = encodeURIComponent(deactivatedMessage)
      if (typeof window !== 'undefined') {
        window.location.href = `/login?deactivated=true&message=${message}`
      }
      return Promise.reject(error)
    }

    // Handle 401 - try to refresh token
    if (status === 401) {
      // If refresh call itself fails, do not attempt another refresh
      if (requestUrl.includes('/auth/refresh')) {
        isRefreshing = false
        pendingQueue.forEach((cb) => cb(undefined))
        pendingQueue = []
        localStorage.removeItem('auth_token')
        localStorage.removeItem('auth_user')
        useAuthStore.setState({ token: null, user: null, isAuthenticated: false })
        // Only redirect if not on login page and not on a public route
        if (
          typeof window !== 'undefined' &&
          window.location.pathname !== '/login' &&
          !isPublicRoute()
        ) {
          window.location.href = '/login'
        }
        return Promise.reject(error)
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pendingQueue.push((token) => {
            if (!token) {
              reject(error)
              return
            }
            if (originalRequest.headers) {
              ;(originalRequest.headers as Record<string, string>).Authorization = `Bearer ${token}`
            }
            resolve(API(originalRequest))
          })
        })
      }

      if (!originalRequest._retry) {
        originalRequest._retry = true

        try {
          isRefreshing = true

          // Attempt refresh using a separate axios instance to avoid interceptor recursion
          const refreshRes = await refreshClient.post('/auth/refresh', {})
          const newToken: string | undefined = refreshRes?.data?.token

          if (!newToken) {
            throw new Error('Refresh response did not include a token')
          }

          localStorage.setItem('auth_token', newToken)
          useAuthStore.setState({ token: newToken, isAuthenticated: true })

          if (originalRequest.headers) {
            ;(
              originalRequest.headers as Record<string, string>
            ).Authorization = `Bearer ${newToken}`
          }

          // Fulfil queued requests with the new token
          pendingQueue.forEach((cb) => cb(newToken))
          pendingQueue = []

          return API(originalRequest)
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError)
          pendingQueue.forEach((cb) => cb(undefined))
          pendingQueue = []
        } finally {
          isRefreshing = false
        }
      }

      // Logout and redirect to login
      localStorage.removeItem('auth_token')
      localStorage.removeItem('auth_user')
      useAuthStore.setState({ token: null, user: null, isAuthenticated: false })
      if (originalRequest.headers) {
        delete (originalRequest.headers as Record<string, string>).Authorization
      }

      // Only redirect to login if:
      // 1. Not already on login page
      // 2. The endpoint is NOT a public endpoint (e.g., products, categories, etc.)
      // 3. The current route is NOT a public route (e.g., browsing products)
      if (
        typeof window !== 'undefined' &&
        window.location.pathname !== '/login' &&
        !isPublicEndpoint(requestUrl) &&
        !isPublicRoute()
      ) {
        window.location.href = '/login'
      }
    }

    return Promise.reject(error)
  },
)

export default API
