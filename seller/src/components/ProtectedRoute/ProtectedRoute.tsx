import { useEffect } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'

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
    return <Navigate to="/login" replace />
  }

  // For sellers, check KYC flow
  if (user?.role === 'seller') {
    // If account is deactivated, log out (this should have been handled by useEffect above)
    if (user.sellerLifecycleStatus === 'DEACTIVATED') {
      logout()
      return <Navigate to="/login" replace />
    }

    // If KYC not submitted, force seller to complete KYC first
    if (!user.kycSubmitted && location.pathname !== '/submit-kyc') {
      return <Navigate to="/submit-kyc" replace />
    }

    // If KYC submitted but account not yet approved, lock down dashboard access.
    // Allow only waiting-approval screen and KYC page (for updating after rejection).
    if (
      user.kycSubmitted &&
      !user.isApproved &&
      location.pathname !== '/waiting-approval' &&
      location.pathname !== '/submit-kyc'
    ) {
      return <Navigate to="/waiting-approval" replace />
    }
  }

  return <>{children}</>
}

export default ProtectedRoute
