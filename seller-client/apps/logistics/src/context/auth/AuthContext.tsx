import { useQueryClient } from '@tanstack/react-query'
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react'
import { logoutApi } from '../../api/auth'
import {
  clearAuthTokens,
  configureAuthTokenPersistence,
  getAuthTokens,
  setAuthTokens,
} from '../../api/tokenVault'
import { useUserProfile } from '../../hooks/User/useUserProfile'
import type { IUserProfileDB } from '../../types/user.types'
import { emptyUserProfile } from '../../utils/utility'
import {
  DEMO_LOGISTICS_SESSION_KEY,
  DEMO_LOGISTICS_USER,
  isDemoLogisticsSession,
} from '../../demo/demoSession'
import { buildShopifyInstallPath, isEmbeddedShopifyContext } from '../../utils/shopifyEmbedded'

/* ---------- context shape ---------- */
interface AuthCtx {
  setUserId: Dispatch<SetStateAction<string>>
  userId: string
  user: IUserProfileDB
  loading: boolean
  isAuthenticated: boolean
  isDemo: boolean
  setTokens: (access: string, refresh: string) => void
  startDemo: () => void
  clearTokens: () => void
  logout: () => Promise<void>
  refetchUser: () => void
  walletBalance: number | null
  setWalletBalance: Dispatch<SetStateAction<number | null>>
}

export const AuthContext = createContext<AuthCtx | undefined>(undefined)

/* ---------- provider ---------- */
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient()

  const [initiallyAuthenticated] = useState(() => {
    if (isEmbeddedShopifyContext()) {
      configureAuthTokenPersistence(false)
      return false
    }

    const { accessToken, refreshToken } = getAuthTokens()
    return isDemoLogisticsSession() || Boolean(accessToken && refreshToken)
  })

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(initiallyAuthenticated)
  const [isDemo, setIsDemo] = useState(isDemoLogisticsSession)
  const [authCheckTimedOut, setAuthCheckTimedOut] = useState(false)
  const [walletBalance, setWalletBalance] = useState<number | null>(null)
  const [userId, setUserId] = useState('')

  const {
    data: user,
    isFetching: userFetching,
    isError: userProfileError,
    refetch: refetchUser,
  } = useUserProfile(isAuthenticated, isDemo)

  useEffect(() => {
    if (!isAuthenticated || user?.id || userProfileError) {
      setAuthCheckTimedOut(false)
      return
    }

    const timeout = window.setTimeout(() => {
      setAuthCheckTimedOut(true)
    }, 3500)

    return () => window.clearTimeout(timeout)
  }, [isAuthenticated, user?.id, userProfileError])

  useEffect(() => {
    // If we successfully fetched a user, ensure auth is marked as true.
    if (user?.id) {
      setIsAuthenticated(true)
    }
    // Do NOT automatically mark user as unauthenticated on generic errors here.
    // Auth state should primarily follow presence of valid tokens; 401 handling
    // is done in axios interceptors which clear tokens and redirect as needed.
  }, [user])

  const setTokens = (access: string, refresh: string) => {
    localStorage.removeItem(DEMO_LOGISTICS_SESSION_KEY)
    setIsDemo(false)
    setAuthTokens(access, refresh)
    setIsAuthenticated(true)
    refetchUser()
  }

  const clearTokens = () => {
    clearAuthTokens()
    localStorage.removeItem(DEMO_LOGISTICS_SESSION_KEY)
    setIsDemo(false)
    setIsAuthenticated(false)
    queryClient.removeQueries({ queryKey: ['userInfo'] })
    queryClient.removeQueries({ queryKey: ['userProfile'] })
    queryClient.removeQueries({ queryKey: ['walletBalance'] })
  }

  const logout = async () => {
    try {
      if (!isDemo) await logoutApi()
    } catch (e) {
      console.error('Logout error ignored:', e)
    }
    clearTokens()
    window.location.href = isEmbeddedShopifyContext()
      ? buildShopifyInstallPath('/channels/connected')
      : '/login'
  }

  const startDemo = () => {
    clearAuthTokens()
    localStorage.setItem(DEMO_LOGISTICS_SESSION_KEY, '1')
    queryClient.setQueryData(['userProfile'], DEMO_LOGISTICS_USER)
    setWalletBalance(86420)
    setIsDemo(true)
    setIsAuthenticated(true)
  }

  const value: AuthCtx = {
    user: user ?? { ...emptyUserProfile },
    loading:
      isAuthenticated &&
      !user?.id &&
      userFetching &&
      !userProfileError &&
      !authCheckTimedOut,
    isAuthenticated,
    isDemo,
    setUserId,
    setTokens,
    startDemo,
    clearTokens,
    userId,
    logout,
    refetchUser,
    walletBalance,
    setWalletBalance,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/* ---------- hook ---------- */
export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
