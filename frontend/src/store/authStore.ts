import { create } from 'zustand'
import API from '../lib/axios'
import { guestCartUtils } from '../utils/guestCart'
import { clearStoredDeliveryLocation } from '../utils/deliveryLocationStorage'

interface User {
  userId: string
  name: string
  email: string
  role: string
}

interface AuthState {
  token: string | null
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  setAuth: (token: string, user: User) => void
  setUser: (user: User) => void
  logout: () => void
  checkAuth: () => void
}

const getStoredToken = (): string | null => {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('auth_token')
}

const getStoredUser = (): User | null => {
  if (typeof window === 'undefined') return null
  try {
    const userStr = localStorage.getItem('auth_user')
    if (!userStr) return null
    return JSON.parse(userStr)
  } catch {
    localStorage.removeItem('auth_user')
    return null
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  token: getStoredToken(),
  user: getStoredUser(),
  isLoading: false,
  isAuthenticated: !!getStoredToken(),

  setAuth: (token: string, user: User) => {
    // A browser-level delivery location must never leak into a newly authenticated account.
    clearStoredDeliveryLocation()
    localStorage.setItem('auth_token', token)
    localStorage.setItem('auth_user', JSON.stringify(user))
    set({ token, user, isAuthenticated: true })
  },

  setUser: (user: User) => {
    localStorage.setItem('auth_user', JSON.stringify(user))
    set({ user })
  },

  logout: () => {
    if (typeof window !== 'undefined') {
      // Call logout API
      void API.post('/auth/logout').catch(() => undefined)

      // Clear auth data
      localStorage.removeItem('auth_token')
      localStorage.removeItem('auth_user')
      clearStoredDeliveryLocation()

      // Clear guest cart on logout
      guestCartUtils.clearCart()
      window.dispatchEvent(new CustomEvent('guest-cart-updated'))

      // Clear checkout storage
      const checkoutStorageKeys = [
        'checkout_payment_method',
        'checkout_selected_upi',
        'checkout_upi_id',
        'checkout_card_details',
        'checkout_razorpay_method',
        'checkout_selected_address',
        'checkout_delivery_instructions',
        'checkout_product_instructions',
        'checkout_applied_coupon',
        'checkout_applied_promo_code',
      ]
      checkoutStorageKeys.forEach((key) => {
        localStorage.removeItem(key)
      })

      // Clear sessionStorage items
      sessionStorage.removeItem('checkout_intent')
      sessionStorage.removeItem('checkout_redirect')
      sessionStorage.removeItem('just_logged_in')
      localStorage.removeItem('pendingWishlistProduct')

      // Remove authorization header from axios
      delete API.defaults.headers.common['Authorization']
    }
    set({ token: null, user: null, isAuthenticated: false })
  },

  checkAuth: () => {
    const token = getStoredToken()
    const user = getStoredUser()
    set({
      token,
      user,
      isAuthenticated: !!token,
    })
  },
}))
