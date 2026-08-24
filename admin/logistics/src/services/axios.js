import axios from 'axios'
import { clearLogisticsAdminStorage, LOGISTICS_ADMIN_STORAGE } from 'config/authStorage'

const getDefaultApiBaseUrl = () => {
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
    return `${window.location.origin}/api`
  }

  return 'http://localhost:5003/api'
}

const apiBaseURL = (process.env.REACT_APP_API_BASE_URL || getDefaultApiBaseUrl()).replace(/\/+$/, '')

const api = axios.create({
  baseURL: apiBaseURL,
  withCredentials: true, // only if using cookies
})

let refreshPromise = null

// Request interceptor: attach access token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(LOGISTICS_ADMIN_STORAGE.accessToken)
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response interceptor: auto-refresh token on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    // Prevent infinite loops
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      localStorage.getItem(LOGISTICS_ADMIN_STORAGE.refreshToken)
    ) {
      originalRequest._retry = true

      try {
        const refreshToken = localStorage.getItem(LOGISTICS_ADMIN_STORAGE.refreshToken)
        if (!refreshPromise) {
          refreshPromise = axios
            .post(
              `${apiBaseURL}/auth/refresh-token`,
              { refreshToken },
              {
                headers: {
                  'x-refresh-token': refreshToken, // ✅ Send in header for better security
                },
              },
            )
            .finally(() => {
              refreshPromise = null
            })
        }
        const res = await refreshPromise

        const newAccessToken = res.data.accessToken
        const newRefreshToken = res.data.refreshToken

        // Save tokens
        localStorage.setItem(LOGISTICS_ADMIN_STORAGE.accessToken, newAccessToken)
        localStorage.setItem(LOGISTICS_ADMIN_STORAGE.refreshToken, newRefreshToken)

        // Update Zustand store - import it dynamically to avoid circular dependencies
        import('../store/useAuthStore').then(({ useAuthStore }) => {
          const userId = localStorage.getItem(LOGISTICS_ADMIN_STORAGE.userId)
          useAuthStore.getState().login(newAccessToken, userId, newRefreshToken)
        })

        // Retry original request with new access token
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
        return api(originalRequest)
      } catch (refreshErr) {
        console.error('❌ Refresh token failed:', refreshErr)
        clearLogisticsAdminStorage()

        // Update Zustand store
        import('../store/useAuthStore').then(({ useAuthStore }) => {
          useAuthStore.getState().logout()
        })

        window.location.href = '/logistics/auth/signin'
      }
    }

    // Reject if not handled
    return Promise.reject(error)
  },
)

export default api
