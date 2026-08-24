// store/useAuthStore.js
import { jwtDecode } from 'jwt-decode'
import { create } from 'zustand'
import {
  clearLogisticsAdminStorage,
  LOGISTICS_ADMIN_STORAGE,
  migrateLegacyLogisticsAdminStorage,
} from 'config/authStorage'

function isTokenExpired(token) {
  try {
    const decoded = jwtDecode(token)
    return decoded.exp < Date.now() / 1000
  } catch (err) {
    return true // treat invalid/undecodable token as expired
  }
}

export const useAuthStore = create((set) => {
  migrateLegacyLogisticsAdminStorage()
  const accessToken = localStorage.getItem(LOGISTICS_ADMIN_STORAGE.accessToken)
  const refreshToken = localStorage.getItem(LOGISTICS_ADMIN_STORAGE.refreshToken)
  const userId = localStorage.getItem(LOGISTICS_ADMIN_STORAGE.userId)

  const isRefreshValid = refreshToken && !isTokenExpired(refreshToken)

  if (!isRefreshValid) {
    clearLogisticsAdminStorage()
  }

  return {
    token: isRefreshValid ? accessToken : null,
    refreshToken: isRefreshValid ? refreshToken : null,
    userId: isRefreshValid ? userId : null,
    isLoggedIn: isRefreshValid && !!accessToken,

    login: (token, userId, refreshToken) => {
      localStorage.setItem(LOGISTICS_ADMIN_STORAGE.accessToken, token)
      localStorage.setItem(LOGISTICS_ADMIN_STORAGE.refreshToken, refreshToken)
      localStorage.setItem(LOGISTICS_ADMIN_STORAGE.userId, userId)

      set({
        token,
        refreshToken,
        userId,
        isLoggedIn: true,
      })
    },

    logout: () => {
      clearLogisticsAdminStorage()
      set({
        token: null,
        refreshToken: null,
        userId: null,
        isLoggedIn: false,
      })
    },
  }
})
