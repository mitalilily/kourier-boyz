import { useMutation } from '@tanstack/react-query'
import axios from 'axios'
import { toast } from 'sonner'
import { ADMIN_WORKSPACE_STORAGE } from '../config/adminWorkspace'
import { MARKETPLACE_ADMIN_STORAGE } from '../config/authStorage'
import { useAuthStore } from '../store/authStore'
import API from './axiosInstance'

interface MarketplaceAdminSession {
  token: string
  role: string
  name: string
  email: string
  userId: string
}

interface LogisticsAdminSession {
  token: string
  refreshToken: string
  user: {
    id: string
    email: string
    role: string
  }
}

export interface UnifiedAdminSession {
  marketplace: MarketplaceAdminSession | null
  logistics: LogisticsAdminSession | null
  unavailableWorkspaces: Array<'marketplace' | 'logistics'>
}

const logisticsApiBaseUrl = (() => {
  if (import.meta.env.VITE_LOGISTICS_API_URL) {
    return String(import.meta.env.VITE_LOGISTICS_API_URL).replace(/\/+$/, '')
  }

  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
    return `${window.location.origin}/api`
  }

  return 'http://localhost:5003/api'
})()

const getLoginError = (reason: unknown) => {
  if (axios.isAxiosError(reason)) {
    return reason.response?.data?.error || reason.response?.data?.message || reason.message
  }
  return reason instanceof Error ? reason.message : 'Invalid email or password'
}

export const useLogin = () => {
  return useMutation({
    mutationFn: async (data: { email: string; password: string }) => {
      const credentials = {
        email: data.email.trim().toLowerCase(),
        password: data.password,
      }
      const [marketplaceResult, logisticsResult] = await Promise.allSettled([
        API.post<MarketplaceAdminSession>('/admin/auth/login', {
          ...credentials,
          role: 'super-admin',
        }),
        axios.post<LogisticsAdminSession>(
          `${logisticsApiBaseUrl}/auth/admin/login`,
          credentials,
          { withCredentials: true },
        ),
      ])

      const marketplace =
        marketplaceResult.status === 'fulfilled' && marketplaceResult.value.data.token
          ? marketplaceResult.value.data
          : null
      const logistics =
        logisticsResult.status === 'fulfilled' &&
        logisticsResult.value.data.token &&
        logisticsResult.value.data.refreshToken
          ? logisticsResult.value.data
          : null

      if (!marketplace && !logistics) {
        const marketplaceError =
          marketplaceResult.status === 'rejected' ? getLoginError(marketplaceResult.reason) : null
        const logisticsError =
          logisticsResult.status === 'rejected' ? getLoginError(logisticsResult.reason) : null
        throw new Error(marketplaceError || logisticsError || 'Invalid email or password')
      }

      return {
        marketplace,
        logistics,
        unavailableWorkspaces: [
          ...(marketplace ? [] : (['marketplace'] as const)),
          ...(logistics ? [] : (['logistics'] as const)),
        ],
      } satisfies UnifiedAdminSession
    },
    onSuccess: (data) => {
      if (data.marketplace) {
        localStorage.setItem(MARKETPLACE_ADMIN_STORAGE.token, data.marketplace.token)
        localStorage.setItem(MARKETPLACE_ADMIN_STORAGE.name, data.marketplace.name)
        localStorage.setItem(MARKETPLACE_ADMIN_STORAGE.role, data.marketplace.role)
        localStorage.setItem(MARKETPLACE_ADMIN_STORAGE.email, data.marketplace.email)
        localStorage.setItem(MARKETPLACE_ADMIN_STORAGE.userId, data.marketplace.userId)

        useAuthStore.setState({
          token: data.marketplace.token,
          name: data.marketplace.name,
          role: data.marketplace.role,
          email: data.marketplace.email,
          userId: data.marketplace.userId,
        })
      }

      if (data.logistics) {
        localStorage.setItem(ADMIN_WORKSPACE_STORAGE.logisticsAccessToken, data.logistics.token)
        localStorage.setItem(
          ADMIN_WORKSPACE_STORAGE.logisticsRefreshToken,
          data.logistics.refreshToken,
        )
        localStorage.setItem(ADMIN_WORKSPACE_STORAGE.logisticsUserId, data.logistics.user.id)
      }

      const adminName = data.marketplace?.name || data.logistics?.user.email || 'Admin'
      toast.success(`Welcome back, ${adminName}`)

      if (data.unavailableWorkspaces.length > 0) {
        const unavailable = data.unavailableWorkspaces[0]
        toast.warning(
          `${unavailable === 'marketplace' ? 'Marketplace' : 'Courier operations'} access is not linked to this account.`,
          { duration: 6000 },
        )
      }
    },
    onError: (err: unknown) => {
      toast.error(getLoginError(err))
    },
  })
}
