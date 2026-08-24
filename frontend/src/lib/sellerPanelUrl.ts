const DEFAULT_SELLER_PANEL_ORIGIN = 'https://kourier-boyz.onrender.com'

const cleanOrigin = (value?: string) => {
  if (!value) return DEFAULT_SELLER_PANEL_ORIGIN
  return value.replace(/\/+$/, '')
}

const cleanPath = (path: string) => (path.startsWith('/') ? path : `/${path}`)

export const getSellerPanelUrl = (path = '/') => {
  const configuredOrigin =
    import.meta.env.VITE_SELLER_APP_URL || import.meta.env.VITE_SELLER_URL
  const origin = cleanOrigin(configuredOrigin)
  const nextPath = cleanPath(path)

  const storeOrigin = origin.endsWith('/store') ? origin : `${origin}/store`

  return nextPath === '/' ? `${storeOrigin}/` : `${storeOrigin}/#${nextPath}`
}
