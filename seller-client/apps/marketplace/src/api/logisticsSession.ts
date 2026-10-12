import axios from 'axios'
import type { User } from '../store/authStore'
import { logisticsApiUrl, marketplaceSellerApiUrl } from './runtime'

export const MARKETPLACE_REGISTRATION_PROFILE_KEY = 'kb_marketplace_registration_profile'
const DEMO_LOGISTICS_SESSION_KEY = 'kourier_boyz_demo_logistics'

export type LogisticsRegistrationProfile = {
  userId: string
  email: string
  name: string
  phone?: string
  businessName?: string
}

export type LogisticsMarketplaceSession =
  | {
      status: 'linked'
      token: string
      seller: User
    }
  | {
      status: 'registration_required'
      profile: LogisticsRegistrationProfile
    }
  | { status: 'unavailable' }

const sessionClient = axios.create({
  baseURL: marketplaceSellerApiUrl,
  withCredentials: true,
  timeout: 10_000,
})

const refreshCourierSession = async () => {
  const refreshToken = localStorage.getItem('cc_refresh')
  if (!refreshToken) return null

  const { data } = await axios.post(
    `${logisticsApiUrl}/auth/refresh-token`,
    { refreshToken },
    {
      timeout: 10_000,
      headers: { 'x-refresh-token': refreshToken },
    },
  )

  if (!data?.accessToken || !data?.refreshToken) return null
  localStorage.setItem('cc_access', data.accessToken)
  localStorage.setItem('cc_refresh', data.refreshToken)
  return String(data.accessToken)
}

const requestLinkedSession = async (accessToken: string) => {
  const { data } = await sessionClient.post(
    '/auth/logistics-session',
    {},
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )
  return data as Exclude<LogisticsMarketplaceSession, { status: 'unavailable' }>
}

export const isDemoCourierSession = () =>
  localStorage.getItem(DEMO_LOGISTICS_SESSION_KEY) === '1'

export const resumeMarketplaceFromCourier = async (): Promise<LogisticsMarketplaceSession> => {
  let accessToken = localStorage.getItem('cc_access')
  if (!accessToken) return { status: 'unavailable' }

  try {
    return await requestLinkedSession(accessToken)
  } catch (error) {
    if (!axios.isAxiosError(error) || error.response?.status !== 401) throw error
    accessToken = await refreshCourierSession()
    if (!accessToken) return { status: 'unavailable' }
    return requestLinkedSession(accessToken)
  }
}

export const saveRegistrationProfile = (profile?: LogisticsRegistrationProfile) => {
  if (!profile) {
    sessionStorage.removeItem(MARKETPLACE_REGISTRATION_PROFILE_KEY)
    return
  }
  sessionStorage.setItem(MARKETPLACE_REGISTRATION_PROFILE_KEY, JSON.stringify(profile))
}

export const getRegistrationProfile = (): LogisticsRegistrationProfile | null => {
  try {
    const value = sessionStorage.getItem(MARKETPLACE_REGISTRATION_PROFILE_KEY)
    return value ? (JSON.parse(value) as LogisticsRegistrationProfile) : null
  } catch {
    sessionStorage.removeItem(MARKETPLACE_REGISTRATION_PROFILE_KEY)
    return null
  }
}
