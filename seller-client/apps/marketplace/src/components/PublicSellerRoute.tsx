import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

type PublicSellerRouteProps = {
  children: ReactNode
}

/** Keeps authenticated sellers inside their onboarding or workspace flow. */
const PublicSellerRoute = ({ children }: PublicSellerRouteProps) => {
  const token = useAuthStore((state) => state.token)
  const user = useAuthStore((state) => state.user)

  if (!token) return <>{children}</>
  if (user?.role === 'seller' && !user.kycSubmitted) {
    return <Navigate to="/submit-kyc" replace />
  }
  if (user?.role === 'seller' && !user.isApproved) {
    return <Navigate to="/waiting-approval" replace />
  }
  return <Navigate to="/dashboard" replace />
}

export default PublicSellerRoute
