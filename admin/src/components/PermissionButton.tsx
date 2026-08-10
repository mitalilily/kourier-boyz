import { type ButtonProps } from 'antd'
import { Button } from 'antd'
import { memo } from 'react'
import type { ModulePermissions, Permission } from '../api/roles'
import { useModulePermissions } from '../hooks/useModulePermissions'

interface PermissionButtonProps extends ButtonProps {
  module: keyof ModulePermissions
  permission: Permission | Permission[]
  requireAll?: boolean 
  hideIfNoPermission?: boolean
  children: React.ReactNode
}

/**
 * PermissionButton component - Renders button with permission check
 * Memoized to prevent unnecessary re-renders
 */
const PermissionButton = memo<PermissionButtonProps>(
  ({
    module,
    permission,
    requireAll = false,
    hideIfNoPermission = true,
    children,
    ...buttonProps
  }) => {
    const { hasPermission, hasAnyPermission } = useModulePermissions(module)

    const hasAccess = Array.isArray(permission)
      ? requireAll
        ? permission.every((perm) => hasPermission(perm))
        : hasAnyPermission(permission)
      : hasPermission(permission)

    if (!hasAccess && hideIfNoPermission) {
      return null
    }

    return (
      <Button {...buttonProps} disabled={!hasAccess || buttonProps.disabled}>
        {children}
      </Button>
    )
  },
  (prevProps, nextProps) => {
    // Custom comparison to prevent re-renders
    // Compare permission arrays/values safely
    const prevPermStr = Array.isArray(prevProps.permission)
      ? prevProps.permission.join(',')
      : prevProps.permission
    const nextPermStr = Array.isArray(nextProps.permission)
      ? nextProps.permission.join(',')
      : nextProps.permission

    // Compare key button props that affect rendering
    const buttonPropsEqual =
      prevProps.disabled === nextProps.disabled &&
      prevProps.loading === nextProps.loading &&
      prevProps.type === nextProps.type &&
      prevProps.size === nextProps.size &&
      prevProps.danger === nextProps.danger &&
      prevProps.icon === nextProps.icon

    return (
      prevProps.module === nextProps.module &&
      prevPermStr === nextPermStr &&
      prevProps.requireAll === nextProps.requireAll &&
      prevProps.hideIfNoPermission === nextProps.hideIfNoPermission &&
      prevProps.children === nextProps.children &&
      buttonPropsEqual
    )
  }
)

PermissionButton.displayName = 'PermissionButton'

export default PermissionButton

