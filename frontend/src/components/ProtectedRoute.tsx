import { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

interface ProtectedRouteProps {
  children: ReactNode
  requiredRole?: string
}

const ProtectedRoute = ({ children, requiredRole }: ProtectedRouteProps) => {
  const { isAuthenticated, user } = useAuthStore()
  const location = useLocation()

  // Not logged in → redirect to login
  if (!isAuthenticated) {
    const redirectPath = `${location.pathname}${location.search}`
    const loginUrl = `/login?redirect=${encodeURIComponent(redirectPath)}`
    return <Navigate to={loginUrl} replace />
  }

  // Role-based protection
  if (requiredRole && user?.role !== requiredRole) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

export default ProtectedRoute

