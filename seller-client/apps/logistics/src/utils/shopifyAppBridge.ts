import { isEmbeddedShopifyContext } from './shopifyEmbedded'

const SHOPIFY_CLIENT_ID = '1f4112e92d0bdb32baca637495ba34d6'

declare global {
  interface Window {
    shopify?: {
      idToken: () => Promise<string>
    }
  }
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

  const shopify = await waitForAppBridge()
  return shopify.idToken()
}
