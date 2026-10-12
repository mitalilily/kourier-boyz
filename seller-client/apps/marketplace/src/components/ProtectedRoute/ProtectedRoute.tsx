import { useEffect } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import StoreEntry from '../../pages/StoreEntry'

interface ProtectedRouteProps {
  children: React.ReactNode
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const token = useAuthStore((state) => state.token)
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)
  const location = useLocation()

  // Check if account is deactivated and log out immediately
  useEffect(() => {
    if (user?.role === 'seller' && user?.sellerLifecycleStatus === 'DEACTIVATED') {
      logout()
      // Redirect will happen automatically after logout clears the token
    }
  }, [user?.sellerLifecycleStatus, user?.role, logout])

  if (!token) {
    if (location.pathname === '/') {
      return <StoreEntry />
    }
    return <Navigate to="/login" replace />
  }

  // Marketplace access uses the verification state owned by the courier console.
  if (user?.role === 'seller') {
    // If account is deactivated, log out (this should have been handled by useEffect above)
    if (user.sellerLifecycleStatus === 'DEACTIVATED') {
      logout()
      return <Navigate to="/login" replace />
    }

  }

  return <>{children}</>
}

export default ProtectedRoute
