export const isEmbeddedShopifyContext = () => {
  const params = new URLSearchParams(window.location.search)
  const hasShopifyParams = Boolean(params.get('shop') && params.get('host'))

  try {
    return window.self !== window.top || params.get('embedded') === '1' || hasShopifyParams
  } catch {
    return true
  }
}

export const buildShopifyInstallPath = (nextPath = '/channels/connected') => {
  const current = new URLSearchParams(window.location.search)
  const install = new URLSearchParams()

  for (const key of ['shop', 'host', 'embedded', 'id_token']) {
    const value = current.get(key)
    if (value) install.set(key, value)
  }

  install.set('next', nextPath.startsWith('/') ? nextPath : '/channels/connected')
  return `/shopify/install?${install.toString()}`
}
