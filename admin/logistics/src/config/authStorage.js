export const LOGISTICS_ADMIN_STORAGE = {
  accessToken: 'kb_logistics_admin_access_token',
  refreshToken: 'kb_logistics_admin_refresh_token',
  userId: 'kb_logistics_admin_user_id',
}

export const migrateLegacyLogisticsAdminStorage = () => {
  const legacyKeys = {
    accessToken: 'accessToken',
    refreshToken: 'refreshToken',
    userId: 'userId',
  }

  Object.entries(LOGISTICS_ADMIN_STORAGE).forEach(([name, key]) => {
    const legacyValue = localStorage.getItem(legacyKeys[name])
    if (!localStorage.getItem(key) && legacyValue) localStorage.setItem(key, legacyValue)
  })
}

export const clearLogisticsAdminStorage = () => {
  Object.values(LOGISTICS_ADMIN_STORAGE).forEach((key) => localStorage.removeItem(key))
}
