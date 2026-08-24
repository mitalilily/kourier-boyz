import { decryptSecret, encryptSecret } from './secretEncryption'

const ENCRYPTED_PREFIX = 'enc:v1:'

export const isEncryptedShopifyToken = (value: unknown) =>
  String(value || '').startsWith(ENCRYPTED_PREFIX)

export const encryptShopifyToken = (value: unknown) => {
  const token = String(value || '').trim()
  if (!token || isEncryptedShopifyToken(token)) return token
  return `${ENCRYPTED_PREFIX}${encryptSecret(token)}`
}

export const decryptShopifyToken = (value: unknown) => {
  const token = String(value || '').trim()
  if (!token || !isEncryptedShopifyToken(token)) return token
  return decryptSecret(token.slice(ENCRYPTED_PREFIX.length))
}

export const encryptShopifyOAuth = (oauth: Record<string, any> = {}) => ({
  ...oauth,
  refreshToken: oauth.refreshToken ? encryptShopifyToken(oauth.refreshToken) : oauth.refreshToken,
})

export const encryptShopifyStoreMetadata = (metadata: Record<string, any> = {}) => ({
  ...metadata,
  shopifyWebhookSecret: metadata.shopifyWebhookSecret
    ? encryptShopifyToken(metadata.shopifyWebhookSecret)
    : metadata.shopifyWebhookSecret,
  webhookSecret: metadata.webhookSecret
    ? encryptShopifyToken(metadata.webhookSecret)
    : metadata.webhookSecret,
  apiSecret: metadata.apiSecret ? encryptShopifyToken(metadata.apiSecret) : metadata.apiSecret,
  apiSecretKey:
    metadata.apiSecretKey && metadata.apiSecretKey !== 'configured'
      ? encryptShopifyToken(metadata.apiSecretKey)
      : metadata.apiSecretKey,
  oauth:
    metadata.oauth && typeof metadata.oauth === 'object'
      ? encryptShopifyOAuth(metadata.oauth)
      : metadata.oauth,
})
