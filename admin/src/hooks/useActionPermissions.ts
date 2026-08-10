import { useModulePermissions } from './useModulePermissions'

interface ActionPermissions {
  canApprove: boolean
  canUpdate: boolean
  canDelete: boolean
  canBlock: boolean
  hasAnyAction: boolean
}

/**
 * Hook to check action permissions for a module
 * Returns permission flags and a boolean indicating if any action is available
 */
export const useActionPermissions = (
  module: 'sellerManagement' | 'customerManagement'
): ActionPermissions => {
  const permissions = useModulePermissions(module)

  const canApprove = permissions.canApprove
  const canUpdate = permissions.canUpdate
  const canDelete = permissions.canDelete
  const canBlock = module === 'customerManagement' ? permissions.canUpdate : false

  const hasAnyAction = canApprove || canUpdate || canDelete || canBlock

  return {
    canApprove,
    canUpdate,
    canDelete,
    canBlock,
    hasAnyAction,
  }
}

