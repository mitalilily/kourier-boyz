const isLocalRuntime = () =>
  typeof window !== 'undefined' &&
  ['localhost', '127.0.0.1'].includes(window.location.hostname)

const DEFAULT_SELLER_PANEL_ORIGIN = isLocalRuntime()
  ? 'http://localhost:5174'
  : 'https://seller.kourierboyz.com'

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

  return `${origin}${nextPath}`
}
