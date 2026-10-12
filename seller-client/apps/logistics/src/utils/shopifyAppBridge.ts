import { isEmbeddedShopifyContext } from './shopifyEmbedded'

const SHOPIFY_CLIENT_ID = '1f4112e92d0bdb32baca637495ba34d6'
const SHOPIFY_APP_BRIDGE_URL = 'https://cdn.shopify.com/shopifycloud/app-bridge.js'

let appBridgeLoadPromise: Promise<void> | null = null

declare global {
  interface Window {
    shopify?: {
      idToken: () => Promise<string>
    }
  }
}

const loadAppBridge = async () => {
  if (window.shopify?.idToken) return
  if (appBridgeLoadPromise) return appBridgeLoadPromise

  appBridgeLoadPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[src="${SHOPIFY_APP_BRIDGE_URL}"]`,
    )

    const script = existingScript || document.createElement('script')
    const handleLoad = () => resolve()
    const handleError = () => {
      appBridgeLoadPromise = null
      reject(new Error('Shopify App Bridge could not be loaded'))
    }

    script.addEventListener('load', handleLoad, { once: true })
    script.addEventListener('error', handleError, { once: true })

    if (!existingScript) {
      script.src = SHOPIFY_APP_BRIDGE_URL
      script.async = true
      document.head.appendChild(script)
    }
  })

  return appBridgeLoadPromise
}

const waitForAppBridge = async () => {
  const deadline = Date.now() + 10000
  while (!window.shopify?.idToken && Date.now() < deadline) {
    await new Promise((resolve) => window.setTimeout(resolve, 50))
  }
  if (!window.shopify?.idToken) throw new Error('Shopify App Bridge did not initialize')
  return window.shopify
}

export const getShopifyIdToken = async () => {
  const params = new URLSearchParams(window.location.search)
  if ((!params.get('shop') || !params.get('host')) && !isEmbeddedShopifyContext()) {
    throw new Error('Open Kourier Boyz from Shopify Admin to finish connecting your store')
  }

  const meta = document.querySelector<HTMLMetaElement>('meta[name="shopify-api-key"]')
  if (meta?.content !== SHOPIFY_CLIENT_ID) {
    throw new Error('Shopify App Bridge is configured for the wrong app')
  }

  const initialIdToken = params.get('id_token')
  if (initialIdToken) return initialIdToken

  await loadAppBridge()
  const shopify = await waitForAppBridge()
  return shopify.idToken()
}
