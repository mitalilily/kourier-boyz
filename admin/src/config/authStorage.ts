export const MARKETPLACE_ADMIN_STORAGE = {
  token: 'kb_marketplace_admin_token',
  role: 'kb_marketplace_admin_role',
  name: 'kb_marketplace_admin_name',
  email: 'kb_marketplace_admin_email',
  userId: 'kb_marketplace_admin_user_id',
} as const

export const migrateLegacyMarketplaceAdminStorage = () => {
  if (localStorage.getItem(MARKETPLACE_ADMIN_STORAGE.token)) return

  const legacyToken = localStorage.getItem('token')
  if (!legacyToken) return

  const legacyKeys: Record<keyof typeof MARKETPLACE_ADMIN_STORAGE, string> = {
    token: 'token',
    role: 'role',
    name: 'name',
    email: 'email',
    userId: 'userId',
  }

  Object.entries(MARKETPLACE_ADMIN_STORAGE).forEach(([name, key]) => {
    const legacyValue = localStorage.getItem(legacyKeys[name as keyof typeof legacyKeys])
    if (legacyValue) localStorage.setItem(key, legacyValue)
  })
}

export const clearMarketplaceAdminStorage = () => {
  Object.values(MARKETPLACE_ADMIN_STORAGE).forEach((key) => localStorage.removeItem(key))
}
