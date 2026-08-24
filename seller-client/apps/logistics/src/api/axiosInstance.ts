// src/api/axiosInstance.ts
import axios from 'axios'
import { clearAuthTokens, getAuthTokens, setAuthTokens } from './tokenVault'
import { buildShopifyInstallPath, isEmbeddedShopifyContext } from '../utils/shopifyEmbedded'
import { isDemoLogisticsSession } from '../demo/demoSession'

const API_BASE_URL = import.meta.env.VITE_LOGISTICS_API_URL || import.meta.env.VITE_API_URL || '/api'

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
})

let refreshPromise: Promise<{ accessToken: string; refreshToken: string }> | null = null

const redirectToAuthentication = () => {
  window.location.href = isEmbeddedShopifyContext()
    ? buildShopifyInstallPath(window.location.pathname)
    : '/login'
}

/* ----- attach access token to every request ----- */
api.interceptors.request.use((cfg) => {
  const { accessToken } = getAuthTokens()
  if (accessToken && !cfg.headers.Authorization) cfg.headers.Authorization = `Bearer ${accessToken}`
  return cfg
})

/* ----- silent‑refresh once per 401 ----- */
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config

    if (isDemoLogisticsSession()) return Promise.reject(err)

    // Skip refresh if:
    // 1. Not a 401 error
    // 2. Already retried
    // 3. This is the refresh token endpoint itself (avoid infinite loop)
    if (
      err.response?.status !== 401 ||
      original._retry ||
      original.url?.includes('/integrations/shopify/oauth/session') ||
      original.url?.includes('/auth/refresh-token')
    ) {
      return Promise.reject(err)
    }

    original._retry = true

    const { refreshToken } = getAuthTokens()
    if (!refreshToken) {
      console.warn('⚠️ No refresh token available, restarting authentication')
      clearAuthTokens()
      redirectToAuthentication()
      return Promise.reject(err)
    }

    try {
      console.log('🔄 Attempting to refresh access token...')
      if (!refreshPromise) {
        refreshPromise = axios
          .post(
            `${API_BASE_URL}/auth/refresh-token`,
            { refreshToken },
            {
              headers: {
                'x-refresh-token': refreshToken, // ✅ Send in header for better security
              },
            },
          )
          .then(({ data }) => data)
          .finally(() => {
            refreshPromise = null
          })
      }

      const data = await refreshPromise

      if (!data?.accessToken || !data?.refreshToken) {
        throw new Error('Invalid response from refresh token endpoint')
      }

      setAuthTokens(data.accessToken, data.refreshToken)
      original.headers.Authorization = `Bearer ${data.accessToken}`

      console.log('✅ Token refreshed successfully, retrying original request')
      return api(original) // retry original request with new token
    } catch (e: unknown) {
      const error = e as { response?: { data?: { error?: string } }; message?: string }
      console.error('❌ Refresh token failed:', error?.response?.data?.error || error?.message || e)

      // A Shopify bootstrap can replace the credentials while an older refresh is in flight.
      // Never let that stale request erase the newly issued session.
      if (getAuthTokens().refreshToken === refreshToken) {
        clearAuthTokens()

        if (!window.location.pathname.includes('/login')) redirectToAuthentication()
      }
      return Promise.reject(e)
    }
  },
)

export default api
