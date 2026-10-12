import { MARKETPLACE_ADMIN_STORAGE } from './authStorage'

export type AdminWorkspace = 'marketplace' | 'logistics'

export const ADMIN_WORKSPACE_STORAGE = {
  active: 'kb_admin_workspace',
  marketplacePath: 'kb_admin_marketplace_path',
  logisticsPath: 'kb_admin_logistics_path',
  logisticsAccessToken: 'kb_logistics_admin_access_token',
  logisticsRefreshToken: 'kb_logistics_admin_refresh_token',
  logisticsUserId: 'kb_logistics_admin_user_id',
} as const

const isMarketplacePath = (path: string | null) =>
  Boolean(path && path.startsWith('/') && !path.startsWith('/logistics') && !path.startsWith('/login'))

const isLogisticsPath = (path: string | null) => Boolean(path?.startsWith('/logistics/admin'))

export const rememberAdminWorkspacePath = (workspace: AdminWorkspace, path: string) => {
  if (typeof window === 'undefined') return

  const key =
    workspace === 'marketplace'
      ? ADMIN_WORKSPACE_STORAGE.marketplacePath
      : ADMIN_WORKSPACE_STORAGE.logisticsPath

  if (workspace === 'marketplace' ? isMarketplacePath(path) : isLogisticsPath(path)) {
    localStorage.setItem(key, path)
  }
}

export const hasAdminWorkspaceSession = (workspace: AdminWorkspace) => {
  if (typeof window === 'undefined') return false

  if (workspace === 'marketplace') {
    return Boolean(localStorage.getItem(MARKETPLACE_ADMIN_STORAGE.token))
  }

  return Boolean(
    localStorage.getItem(ADMIN_WORKSPACE_STORAGE.logisticsAccessToken) &&
      localStorage.getItem(ADMIN_WORKSPACE_STORAGE.logisticsRefreshToken),
  )
}

export const getAdminWorkspaceDestination = (workspace: AdminWorkspace) => {
  if (typeof window === 'undefined') {
    return workspace === 'marketplace' ? '/dashboard' : '/logistics/admin/dashboard'
  }

  const storedPath = localStorage.getItem(
    workspace === 'marketplace'
      ? ADMIN_WORKSPACE_STORAGE.marketplacePath
      : ADMIN_WORKSPACE_STORAGE.logisticsPath,
  )

  if (workspace === 'marketplace') {
    return isMarketplacePath(storedPath) ? storedPath! : '/dashboard'
  }

  return isLogisticsPath(storedPath) ? storedPath! : '/logistics/admin/dashboard'
}

export const openAdminWorkspace = (workspace: AdminWorkspace) => {
  if (typeof window === 'undefined') return

  localStorage.setItem(ADMIN_WORKSPACE_STORAGE.active, workspace)

  if (!hasAdminWorkspaceSession(workspace)) {
    window.location.assign(`/login?workspace=${workspace}`)
    return
  }

  window.location.assign(getAdminWorkspaceDestination(workspace))
}
