import { type ReactNode, memo } from 'react'
import type { ModulePermissions, Permission } from '../api/roles'
import { useModulePermissions } from '../hooks/useModulePermissions'

interface PermissionGateProps {
  module: keyof ModulePermissions
  permission: Permission | Permission[]
  fallback?: ReactNode
  children: ReactNode
  requireAll?: boolean // If true, requires ALL permissions; if false, requires ANY permission
}

/**
 * PermissionGate component - Conditionally renders children based on permissions
 * Memoized to prevent unnecessary re-renders
 */
const PermissionGate = memo<PermissionGateProps>(
  ({ module, permission, fallback = null, children, requireAll = false }) => {
    const { hasPermission, hasAnyPermission } = useModulePermissions(module)

    const hasAccess = Array.isArray(permission)
      ? requireAll
        ? permission.every((perm) => hasPermission(perm))
        : hasAnyPermission(permission)
      : hasPermission(permission)

    return hasAccess ? <>{children}</> : <>{fallback}</>
  },
  (prevProps, nextProps) => {
    // Custom comparison to prevent re-renders when props haven't changed
    // Compare permission arrays/values safely
    const prevPermStr = Array.isArray(prevProps.permission)
      ? prevProps.permission.join(',')
      : prevProps.permission
    const nextPermStr = Array.isArray(nextProps.permission)
      ? nextProps.permission.join(',')
      : nextProps.permission

    return (
      prevProps.module === nextProps.module &&
      prevPermStr === nextPermStr &&
      prevProps.requireAll === nextProps.requireAll &&
      prevProps.children === nextProps.children &&
      prevProps.fallback === nextProps.fallback
    )
  }
)

PermissionGate.displayName = 'PermissionGate'

export default PermissionGate

