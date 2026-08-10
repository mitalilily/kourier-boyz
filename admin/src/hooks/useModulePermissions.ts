import { useMemo } from 'react'
import type { ModulePermissions, Permission } from '../api/roles'
import { useAuthStore } from '../store/authStore'

/**
 * Returns all permissions for a specific module
 * Memoized to prevent unnecessary re-renders
 */
export const useModulePermissions = (
  module: keyof ModulePermissions
): {
  canView: boolean
  canCreate: boolean
  canUpdate: boolean
  canDelete: boolean
  canApprove: boolean
  canReject: boolean
  canAssign: boolean
  canBlock: boolean
  hasPermission: (permission: Permission) => boolean
  hasAnyPermission: (permissions: Permission[]) => boolean
} => {
  const permissions = useAuthStore((state) => state.permissions)
  const role = useAuthStore((state) => state.role)

  return useMemo(() => {
    // Super admin has all permissions
    if (role === 'super-admin') {
      return {
        canView: true,
        canCreate: true,
        canUpdate: true,
        canDelete: true,
        canApprove: true,
        canReject: true,
        canAssign: true,
        canBlock: true,
        hasPermission: () => true,
        hasAnyPermission: () => true,
      }
    }

    if (!permissions) {
      return {
        canView: false,
        canCreate: false,
        canUpdate: false,
        canDelete: false,
        canApprove: false,
        canReject: false,
        canAssign: false,
        canBlock: false,
        hasPermission: () => false,
        hasAnyPermission: () => false,
      }
    }

    const modulePermissions = permissions[module] || []

    const hasPermission = (permission: Permission): boolean => {
      return modulePermissions.includes(permission)
    }

    const hasAnyPermission = (perms: Permission[]): boolean => {
      return perms.some((perm) => modulePermissions.includes(perm))
    }

    return {
      canView: hasPermission('view'),
      canCreate: hasPermission('create'),
      canUpdate: hasPermission('update'),
      canDelete: hasPermission('delete'),
      canApprove: hasPermission('approve'),
      canReject: hasPermission('reject'),
      canAssign: hasPermission('assign'),
      canBlock: hasPermission('block'),
      hasPermission,
      hasAnyPermission,
    }
  }, [permissions, module, role])
}


