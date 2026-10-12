import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

type PublicSellerRouteProps = {
  children: ReactNode
}

/** Keeps authenticated sellers inside their workspace. Courier KYC is handled separately. */
const PublicSellerRoute = ({ children }: PublicSellerRouteProps) => {
  const token = useAuthStore((state) => state.token)
  if (!token) return <>{children}</>
  return <Navigate to="/dashboard" replace />
}

export default PublicSellerRoute
