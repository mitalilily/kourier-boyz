export const ADMIN_WORKSPACE_STORAGE = {
  active: 'kb_admin_workspace',
  marketplacePath: 'kb_admin_marketplace_path',
  logisticsPath: 'kb_admin_logistics_path',
  marketplaceToken: 'kb_marketplace_admin_token',
  logisticsAccessToken: 'kb_logistics_admin_access_token',
  logisticsRefreshToken: 'kb_logistics_admin_refresh_token',
}

const isMarketplacePath = (path) =>
  Boolean(path && path.startsWith('/') && !path.startsWith('/logistics') && !path.startsWith('/login'))

const isLogisticsPath = (path) => Boolean(path && path.startsWith('/logistics/admin'))

export const rememberAdminWorkspacePath = (workspace, path) => {
  const key =
    workspace === 'marketplace'
      ? ADMIN_WORKSPACE_STORAGE.marketplacePath
      : ADMIN_WORKSPACE_STORAGE.logisticsPath

  if (workspace === 'marketplace' ? isMarketplacePath(path) : isLogisticsPath(path)) {
    localStorage.setItem(key, path)
  }
}

export const hasAdminWorkspaceSession = (workspace) => {
  if (workspace === 'marketplace') {
    return Boolean(localStorage.getItem(ADMIN_WORKSPACE_STORAGE.marketplaceToken))
  }

  return Boolean(
    localStorage.getItem(ADMIN_WORKSPACE_STORAGE.logisticsAccessToken) &&
      localStorage.getItem(ADMIN_WORKSPACE_STORAGE.logisticsRefreshToken),
  )
}

export const getAdminWorkspaceDestination = (workspace) => {
  const storedPath = localStorage.getItem(
    workspace === 'marketplace'
      ? ADMIN_WORKSPACE_STORAGE.marketplacePath
      : ADMIN_WORKSPACE_STORAGE.logisticsPath,
  )

  if (workspace === 'marketplace') {
    return isMarketplacePath(storedPath) ? storedPath : '/dashboard'
  }

  return isLogisticsPath(storedPath) ? storedPath : '/logistics/admin/dashboard'
}

export const openAdminWorkspace = (workspace) => {
  localStorage.setItem(ADMIN_WORKSPACE_STORAGE.active, workspace)

  if (!hasAdminWorkspaceSession(workspace)) {
    window.location.assign(`/login?workspace=${workspace}`)
    return
  }

  window.location.assign(getAdminWorkspaceDestination(workspace))
}
