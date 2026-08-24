import axios from 'axios'
import * as crypto from 'crypto'
import { and, eq, inArray, sql } from 'drizzle-orm'
import jwt, { JwtPayload } from 'jsonwebtoken'
import { db } from '../client'
import { b2c_orders } from '../schema/b2cOrders'
import { stores } from '../schema/stores'
import { users } from '../schema/users'
import {
  getCourierProviderDisplayName,
  getProviderMetaCourierName,
  resolveCourierProviderKeyFromFields,
} from '../../utils/courierProvider'
import {
  decryptShopifyToken,
  encryptShopifyOAuth,
  encryptShopifyToken,
} from '../../utils/shopifyTokenEncryption'
import {
  ensurePlatformRegistration,
  createUserWithWallet,
  setUserChannelIntegration,
  updateUserChannelIntegration,
  upsertStore,
} from './userService'
import { recordSalesChannelSyncOutcome } from './salesChannelSyncAudit.service'
import { logShopifyInstallEvent } from './shopifyInstallAudit.service'

export const SHOPIFY_PLATFORM_ID = 1
export const SHOPIFY_PLATFORM = {
  id: SHOPIFY_PLATFORM_ID,
  name: 'Shopify',
  slug: 'shopify',
} as const
export const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || '2026-04'

const SHOPIFY_API_TIMEOUT_MS = Number(process.env.PLATFORM_API_TIMEOUT_MS || 15000)
const SHOPIFY_WEBHOOK_TOPICS = ['ORDERS_CREATE', 'ORDERS_UPDATED', 'ORDERS_CANCELLED'] as const
const SHOPIFY_ORDER_CREATED_WEBHOOK_PATH = '/api/webhooks/shopify/order-created'
export const SHOPIFY_COMPLIANCE_WEBHOOK_PATH = '/api/webhooks/shopify/compliance'
export const SHOPIFY_UNINSTALL_WEBHOOK_PATH = '/api/webhooks/shopify/app-uninstalled'
const SHOPIFY_COMPLIANCE_TOPICS = [
  'customers/data_request',
  'customers/redact',
  'shop/redact',
] as const

type ShopifyStore = typeof stores.$inferSelect

type SyncResult = {
  created: number
  updated: number
  skipped: number
}

type ExistingShopifyOrderRow = {
  id: string
  order_id?: string | null
  order_number?: string | null
  order_status?: string | null
  awb_number?: string | null
  courier_partner?: string | null
  integration_type?: string | null
  provider_meta?: any
  provider_service?: string | null
}

const DEFAULT_SHOPIFY_SYNC_SETTINGS = {
  fulfillTrigger: 'order_booked',
  customerNotifyOnFulfill: 'do_not_notify',
  autoUpdateShipmentStatus: true,
  autoCancelOrders: true,
  markCodPaidOnDelivery: false,
}

const normalizeShopifySettings = (settings?: Record<string, any> | null) => ({
  ...DEFAULT_SHOPIFY_SYNC_SETTINGS,
  ...(settings && typeof settings === 'object' && !Array.isArray(settings) ? settings : {}),
})

type FulfillTrigger =
  | 'do_not_fulfill'
  | 'order_booked'
  | 'order_in_transit'
  | 'order_out_for_delivery'
  | 'order_delivered'

type ConnectShopifyStoreParams = {
  storeUrl: string
  adminApiAccessToken: string
  userId: string
  apiKey?: string
  apiSecretKey?: string
  webhookSecret?: string
  settings?: Record<string, any>
  authMethod?: string
  oauth?: Record<string, any>
  allowOrphanedOwnerRepair?: boolean
  allowInactiveOwnerReassignment?: boolean
  tx?: any
}

type ShopifyOAuthStatePayload = {
  nonce: string
  shop: string
  userId?: string
  returnTo?: string
  flow?: 'linked_install' | 'public_install'
  issuedAt: number
}

type ShopifyInstallBootstrapPayload = {
  nonce: string
  shop: string
  userId: string
  returnTo?: string
  issuedAt: number
  expiresAt: number
}

type ShopifyAccessTokenResponse = {
  access_token?: string
  scope?: string
  expires_in?: number
  refresh_token?: string
  refresh_token_expires_in?: number
}

class ShopifyReconnectRequiredError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ShopifyReconnectRequiredError'
  }
}

type ShopifySessionTokenPayload = JwtPayload & {
  aud: string
  dest: string
  iss: string
  sub: string
}

const toNumber = (value: unknown, fallback = 0): number => {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

export const normalizeShopifyDomain = (domain?: string): string => {
  const clean = String(domain || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '')
    .replace(/\/admin(?:\/.*)?$/, '')
  return clean
}

export const isValidShopifyDomain = (domain?: string) =>
  /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/.test(normalizeShopifyDomain(domain))

const REQUIRED_SHOPIFY_OAUTH_SCOPES = [
  'read_orders',
  'write_orders',
  'read_customers',
  'read_merchant_managed_fulfillment_orders',
  'write_merchant_managed_fulfillment_orders',
] as const

const parseShopifyScopes = () =>
  [
    ...REQUIRED_SHOPIFY_OAUTH_SCOPES,
    ...String(process.env.SHOPIFY_SCOPES || process.env.SHOPIFY_OAUTH_SCOPES || '')
      .split(',')
      .map((scope) => scope.trim())
      .filter(Boolean),
  ].filter((scope, index, scopes) => scopes.indexOf(scope) === index)

export const getShopifyOAuthConfig = () => {
  const clientId = String(process.env.SHOPIFY_CLIENT_ID || '').trim()
  const clientSecret = String(process.env.SHOPIFY_CLIENT_SECRET || '').trim()
  const apiUrl = String(process.env.API_URL || '').trim().replace(/\/+$/, '')
  const callbackPath = String(
    process.env.SHOPIFY_OAUTH_CALLBACK_PATH || '/api/integrations/shopify/oauth/callback',
  ).trim()
  const redirectUri = String(
    process.env.SHOPIFY_OAUTH_REDIRECT_URI || (apiUrl ? `${apiUrl}${callbackPath}` : ''),
  ).trim()
  const frontendUrl = String(
    process.env.SHOPIFY_OAUTH_SUCCESS_URL ||
      process.env.CLIENT_URL ||
      process.env.FRONTEND_URL ||
      process.env.APP_URL ||
      'http://localhost:5173/channels/connected',
  ).trim()

  const sendScopeValue = String(
    process.env.SHOPIFY_SEND_OAUTH_SCOPE ?? process.env.SHOPIFY_USE_LEGACY_INSTALL_FLOW ?? '',
  )
    .trim()
    .toLowerCase()

  return {
    clientId,
    clientSecret,
    redirectUri,
    scopes: parseShopifyScopes(),
    sendOAuthScope: ['true', '1', 'yes', 'on'].includes(sendScopeValue),
    accessMode: 'offline',
    frontendUrl,
    useExpiringOfflineTokens:
      String(process.env.SHOPIFY_USE_EXPIRING_OFFLINE_TOKENS || 'true').toLowerCase() !== 'false',
    configured: Boolean(clientId && clientSecret && redirectUri),
  }
}

const getShopifyOAuthStateSecret = () => {
  const config = getShopifyOAuthConfig()
  return String(process.env.SHOPIFY_OAUTH_STATE_SECRET || process.env.JWT_SECRET || config.clientSecret || '').trim()
}

const timingSafeEqualString = (left: string, right: string, encoding: BufferEncoding = 'utf8') => {
  const leftBuffer = Buffer.from(left, encoding)
  const rightBuffer = Buffer.from(right, encoding)
  if (leftBuffer.length !== rightBuffer.length) return false
  return crypto.timingSafeEqual(leftBuffer, rightBuffer)
}

export const createShopifyOAuthState = ({
  shop,
  userId,
  returnTo,
}: {
  shop: string
  userId?: string
  returnTo?: string
}) => {
  const secret = getShopifyOAuthStateSecret()
  if (!secret) throw new Error('SHOPIFY_CLIENT_SECRET or SHOPIFY_OAUTH_STATE_SECRET is not configured')

  const payload: ShopifyOAuthStatePayload = {
    nonce: crypto.randomBytes(16).toString('hex'),
    shop: normalizeShopifyDomain(shop),
    userId,
    returnTo,
    flow: userId ? 'linked_install' : 'public_install',
    issuedAt: Date.now(),
  }
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = crypto.createHmac('sha256', secret).update(body).digest('base64url')
  return `${body}.${signature}`
}

export const verifyShopifyOAuthState = (
  state: string,
  options: { allowMissingUserId?: boolean } = {},
): ShopifyOAuthStatePayload => {
  const secret = getShopifyOAuthStateSecret()
  if (!secret) throw new Error('SHOPIFY_CLIENT_SECRET or SHOPIFY_OAUTH_STATE_SECRET is not configured')

  const [body, signature] = String(state || '').split('.')
  if (!body || !signature) throw new Error('Invalid Shopify OAuth state')

  const expectedSignature = crypto.createHmac('sha256', secret).update(body).digest('base64url')
  if (!timingSafeEqualString(expectedSignature, signature)) {
    throw new Error('Invalid Shopify OAuth state signature')
  }

  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as ShopifyOAuthStatePayload
  const maxAgeMs = Number(process.env.SHOPIFY_OAUTH_STATE_TTL_MS || 10 * 60 * 1000)
  if (!payload?.shop || !payload?.issuedAt) {
    throw new Error('Invalid Shopify OAuth state payload')
  }
  if (!options.allowMissingUserId && !payload.userId) {
    throw new Error('Invalid Shopify OAuth state payload')
  }
  if (Date.now() - Number(payload.issuedAt) > maxAgeMs) {
    throw new Error('Shopify OAuth state expired')
  }
  if (!isValidShopifyDomain(payload.shop)) {
    throw new Error('Invalid Shopify shop in OAuth state')
  }

  return payload
}

const getShopifyBootstrapSecret = () => {
  const config = getShopifyOAuthConfig()
  return String(
    process.env.SHOPIFY_BOOTSTRAP_SECRET || process.env.SHOPIFY_OAUTH_STATE_SECRET || config.clientSecret || '',
  ).trim()
}

export const createShopifyInstallBootstrap = ({
  shop,
  userId,
  returnTo,
  ttlMs = 10 * 60 * 1000,
}: {
  shop: string
  userId: string
  returnTo?: string
  ttlMs?: number
}) => {
  const secret = getShopifyBootstrapSecret()
  if (!secret) throw new Error('SHOPIFY_CLIENT_SECRET or SHOPIFY_BOOTSTRAP_SECRET is not configured')

  const issuedAt = Date.now()
  const payload: ShopifyInstallBootstrapPayload = {
    nonce: crypto.randomBytes(16).toString('hex'),
    shop: normalizeShopifyDomain(shop),
    userId,
    returnTo,
    issuedAt,
    expiresAt: issuedAt + ttlMs,
  }
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = crypto.createHmac('sha256', secret).update(body).digest('base64url')
  return `${body}.${signature}`
}

export const verifyShopifyInstallBootstrap = (token: string): ShopifyInstallBootstrapPayload => {
  const secret = getShopifyBootstrapSecret()
  if (!secret) throw new Error('SHOPIFY_CLIENT_SECRET or SHOPIFY_BOOTSTRAP_SECRET is not configured')

  const [body, signature] = String(token || '').split('.')
  if (!body || !signature) throw new Error('Invalid Shopify bootstrap token')

  const expectedSignature = crypto.createHmac('sha256', secret).update(body).digest('base64url')
  if (!timingSafeEqualString(expectedSignature, signature)) {
    throw new Error('Invalid Shopify bootstrap token signature')
  }

  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as ShopifyInstallBootstrapPayload
  if (!payload?.userId || !payload?.shop || !payload?.issuedAt || !payload?.expiresAt) {
    throw new Error('Invalid Shopify bootstrap token payload')
  }
  if (Date.now() > Number(payload.expiresAt)) {
    throw new Error('Shopify bootstrap token expired')
  }
  if (!isValidShopifyDomain(payload.shop)) {
    throw new Error('Invalid Shopify shop in bootstrap token')
  }

  return payload
}

export const verifyShopifyOAuthQueryHmac = (query: Record<string, any>) => {
  const config = getShopifyOAuthConfig()
  if (!config.clientSecret) throw new Error('SHOPIFY_CLIENT_SECRET is not configured')

  const receivedHmac = String(query?.hmac || '')
  if (!receivedHmac) return false

  const message = Object.keys(query || {})
    .filter((key) => key !== 'hmac' && key !== 'signature')
    .sort()
    .flatMap((key) => {
      const value = query[key]
      if (Array.isArray(value)) return value.map((item) => `${key}=${String(item)}`)
      return [`${key}=${String(value)}`]
    })
    .join('&')
  const digest = crypto.createHmac('sha256', config.clientSecret).update(message).digest('hex')
  return timingSafeEqualString(digest, receivedHmac, 'hex')
}

export const verifyShopifySessionToken = (token: string): ShopifySessionTokenPayload => {
  const config = getShopifyOAuthConfig()
  if (!config.clientId || !config.clientSecret) {
    throw new Error('Shopify OAuth credentials are not configured')
  }

  const payload = jwt.verify(String(token || '').trim(), config.clientSecret, {
    algorithms: ['HS256'],
    audience: config.clientId,
    clockTolerance: 5,
  })

  if (typeof payload === 'string') throw new Error('Invalid Shopify session token payload')

  const session = payload as ShopifySessionTokenPayload
  const destination = new URL(String(session.dest || ''))
  const issuer = new URL(String(session.iss || ''))
  const shop = normalizeShopifyDomain(destination.hostname)

  if (!isValidShopifyDomain(shop) || normalizeShopifyDomain(issuer.hostname) !== shop) {
    throw new Error('Invalid Shopify session token shop')
  }
  if (!String(session.sub || '').trim()) {
    throw new Error('Invalid Shopify session token user')
  }

  return session
}

export const buildShopifyOAuthAuthorizeUrl = ({
  shop,
  userId,
  returnTo,
  publicInstall = false,
}: {
  shop: string
  userId?: string
  returnTo?: string
  publicInstall?: boolean
}) => {
  const normalizedShop = normalizeShopifyDomain(shop)
  if (!isValidShopifyDomain(normalizedShop)) {
    throw new Error('Enter a valid Shopify myshopify.com store domain')
  }
  if (!userId && !publicInstall) throw new Error('User ID is required')

  const config = getShopifyOAuthConfig()
  if (!config.configured) {
    throw new Error('Shopify OAuth is not configured. Set SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET, and API_URL.')
  }

  const state = createShopifyOAuthState({ shop: normalizedShop, userId, returnTo })
  const url = new URL(`https://${normalizedShop}/admin/oauth/authorize`)
  url.searchParams.set('client_id', config.clientId)
  if (config.sendOAuthScope) {
    url.searchParams.set('scope', config.scopes.join(','))
  }
  url.searchParams.set('redirect_uri', config.redirectUri)
  url.searchParams.set('state', state)
  // Shopify returns an offline access token when grant_options[] is omitted.
  // Kourier Boyz needs offline access for background order sync, webhooks, and fulfillment updates.
  return {
    authUrl: url.toString(),
    shop: normalizedShop,
    scopes: config.scopes,
    scopeSource: config.sendOAuthScope ? 'oauth_query' : 'shopify_app_config',
    redirectUri: config.redirectUri,
    accessMode: config.accessMode,
    installMode: publicInstall ? 'public' : 'linked',
  }
}

const exchangeShopifyOAuthCode = async ({
  shop,
  code,
}: {
  shop: string
  code: string
}): Promise<ShopifyAccessTokenResponse> => {
  const config = getShopifyOAuthConfig()
  const params = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
  })
  if (config.useExpiringOfflineTokens) {
    params.set('expiring', '1')
  }

  const response = await axios.post<ShopifyAccessTokenResponse>(
    `https://${normalizeShopifyDomain(shop)}/admin/oauth/access_token`,
    params.toString(),
    {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      timeout: SHOPIFY_API_TIMEOUT_MS,
    },
  )
  return response.data
}

const exchangeShopifySessionToken = async ({
  shop,
  sessionToken,
}: {
  shop: string
  sessionToken: string
}): Promise<ShopifyAccessTokenResponse> => {
  const config = getShopifyOAuthConfig()
  const params = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
    subject_token: sessionToken,
    subject_token_type: 'urn:ietf:params:oauth:token-type:id_token',
    requested_token_type: 'urn:shopify:params:oauth:token-type:offline-access-token',
    expiring: '1',
  })

  const response = await axios.post<ShopifyAccessTokenResponse>(
    `https://${normalizeShopifyDomain(shop)}/admin/oauth/access_token`,
    params.toString(),
    {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      timeout: SHOPIFY_API_TIMEOUT_MS,
    },
  )
  return response.data
}

export const completeShopifyOAuthInstall = async (query: Record<string, any>) => {
  const shop = normalizeShopifyDomain(String(query?.shop || ''))
  const code = String(query?.code || '')
  const state = String(query?.state || '')

  if (!isValidShopifyDomain(shop)) throw new Error('Invalid Shopify shop domain')
  if (!code) throw new Error('Missing Shopify OAuth code')
  if (!state) throw new Error('Missing Shopify OAuth state')
  if (!verifyShopifyOAuthQueryHmac(query)) throw new Error('Invalid Shopify OAuth HMAC')

  const statePayload = verifyShopifyOAuthState(state, { allowMissingUserId: true })
  if (statePayload.shop !== shop) {
    throw new Error('Shopify OAuth state shop does not match callback shop')
  }

  const config = getShopifyOAuthConfig()
  const tokenResponse = await exchangeShopifyOAuthCode({ shop, code })
  const accessToken = String(tokenResponse.access_token || '').trim()
  if (!accessToken) throw new Error('Shopify did not return an Admin API access token')

  let connectedUserId = String(statePayload.userId || '').trim()
  if (!connectedUserId) {
    const bootstrapUser = await createUserWithWallet({
      role: 'customer',
      email: null,
      phone: null,
      emailVerified: true,
      accountVerified: true,
      onboardingStep: 0,
      onboardingComplete: false,
    } as any)
    connectedUserId = bootstrapUser.id
  }

  const result = await connectShopifyStore({
    storeUrl: shop,
    adminApiAccessToken: accessToken,
    apiKey: config.clientId,
    apiSecretKey: config.clientSecret,
    webhookSecret: config.clientSecret,
    userId: connectedUserId,
    authMethod: 'oauth',
    oauth: {
      scope: tokenResponse.scope,
      tokenType: config.useExpiringOfflineTokens ? 'expiring_offline' : 'offline',
      expiresIn: tokenResponse.expires_in,
      expiresAt: toFutureIso(tokenResponse.expires_in),
      refreshToken: tokenResponse.refresh_token,
      refreshTokenExpiresIn: tokenResponse.refresh_token_expires_in,
      refreshTokenExpiresAt: toFutureIso(tokenResponse.refresh_token_expires_in),
      installedAt: new Date().toISOString(),
    },
    allowInactiveOwnerReassignment: Boolean(statePayload.userId),
  })

  const bootstrap = !statePayload.userId
    ? createShopifyInstallBootstrap({
        shop,
        userId: connectedUserId,
        returnTo: '/channels/connected',
      })
    : undefined

  return {
    ...result,
    shop,
    userId: connectedUserId,
    returnTo: statePayload.returnTo,
    scope: tokenResponse.scope,
    isPublicBootstrap: !statePayload.userId,
    bootstrap,
  }
}

export const completeShopifyManagedInstall = async (
  sessionToken: string,
  audit: { requestId?: string } = {},
) => {
  const startedAt = Date.now()
  let session: ShopifySessionTokenPayload
  try {
    session = verifyShopifySessionToken(sessionToken)
  } catch (error: any) {
    void logShopifyInstallEvent({
      event: 'session_token_verified',
      status: 'failed',
      requestId: audit.requestId,
      detail: error?.message,
    })
    throw error
  }
  const shop = normalizeShopifyDomain(new URL(session.dest).hostname)
  void logShopifyInstallEvent({
    event: 'session_token_verified',
    status: 'passed',
    requestId: audit.requestId,
    shop,
  })
  const config = getShopifyOAuthConfig()
  void logShopifyInstallEvent({
    event: 'offline_token_exchange',
    status: 'started',
    requestId: audit.requestId,
    shop,
  })
  let tokenResponse: ShopifyAccessTokenResponse
  try {
    tokenResponse = await exchangeShopifySessionToken({ shop, sessionToken })
  } catch (error: any) {
    void logShopifyInstallEvent({
      event: 'offline_token_exchange',
      status: 'failed',
      requestId: audit.requestId,
      shop,
      httpStatus: error?.response?.status,
      detail: error?.message,
    })
    throw error
  }
  const accessToken = String(tokenResponse.access_token || '').trim()
  if (!accessToken) throw new Error('Shopify did not return an Admin API access token')
  void logShopifyInstallEvent({
    event: 'offline_token_exchange',
    status: 'passed',
    requestId: audit.requestId,
    shop,
  })

  const existingStore = await getStoreByDomain(shop)
  const [existingOwner] = existingStore?.userId
    ? await db.select({ id: users.id }).from(users).where(eq(users.id, existingStore.userId)).limit(1)
    : []
  const repairingOrphanedOwner = Boolean(existingStore && !existingOwner)
  let connectedUserId = String(existingOwner?.id || '').trim()
  if (!connectedUserId) {
    const bootstrapUser = await createUserWithWallet({
      role: 'customer',
      email: null,
      phone: null,
      emailVerified: true,
      accountVerified: true,
      onboardingStep: 0,
      onboardingComplete: false,
    } as any)
    connectedUserId = bootstrapUser.id
  }
  void logShopifyInstallEvent({
    event: 'merchant_account_resolved',
    status: 'passed',
    requestId: audit.requestId,
    shop,
    existingConnection: Boolean(existingStore),
    detail: repairingOrphanedOwner ? 'Orphaned store owner will be repaired' : undefined,
  })

  let result: Awaited<ReturnType<typeof connectShopifyStore>>
  try {
    result = await connectShopifyStore({
      storeUrl: shop,
      adminApiAccessToken: accessToken,
      apiKey: config.clientId,
      apiSecretKey: config.clientSecret,
      webhookSecret: config.clientSecret,
      userId: connectedUserId,
      settings: existingStore?.settings as Record<string, any> | undefined,
      authMethod: 'managed_install',
      allowOrphanedOwnerRepair: repairingOrphanedOwner,
      oauth: {
        scope: tokenResponse.scope,
        tokenType: 'expiring_offline',
        expiresIn: tokenResponse.expires_in,
        expiresAt: toFutureIso(tokenResponse.expires_in),
        refreshToken: tokenResponse.refresh_token,
        refreshTokenExpiresIn: tokenResponse.refresh_token_expires_in,
        refreshTokenExpiresAt: toFutureIso(tokenResponse.refresh_token_expires_in),
        installedAt: existingStore ? getStoreOAuthMetadata(existingStore).installedAt : new Date().toISOString(),
        exchangedAt: new Date().toISOString(),
        active: true,
        shopifyUserId: session.sub,
      },
    })
  } catch (error: any) {
    void logShopifyInstallEvent({
      event: 'store_connection_saved',
      status: 'failed',
      requestId: audit.requestId,
      shop,
      detail: error?.message,
      durationMs: Date.now() - startedAt,
    })
    throw error
  }
  void logShopifyInstallEvent({
    event: 'store_connection_saved',
    status: 'passed',
    requestId: audit.requestId,
    shop,
    durationMs: Date.now() - startedAt,
  })

  return {
    ...result,
    shop,
    userId: connectedUserId,
    bootstrap: createShopifyInstallBootstrap({
      shop,
      userId: connectedUserId,
      returnTo: '/channels/connected',
    }),
  }
}

const toShopifyGid = (resource: string, id: string | number) => {
  const raw = String(id || '').trim()
  if (raw.startsWith('gid://shopify/')) return raw
  return `gid://shopify/${resource}/${raw}`
}

const extractLegacyId = (value: unknown): string => {
  const raw = String(value || '').trim()
  if (!raw) return ''
  return raw.split('/').pop() || raw
}

const moneyAmount = (value: any, fallback = 0) =>
  toNumber(value?.shopMoney?.amount ?? value?.presentmentMoney?.amount ?? value?.amount, fallback)

const buildInternalOrderId = (storeId: string, shopifyOrderId: string) => {
  const safeStoreId = String(storeId || '').trim()
  const safeOrderId = String(shopifyOrderId || '').trim()
  return `shopify_${safeStoreId}_${safeOrderId}`.slice(0, 100)
}

const parseInternalShopifyOrderId = (
  localOrderId: string,
): { storeId?: string; shopifyOrderId?: string } => {
  const value = String(localOrderId || '')
  if (!value.startsWith('shopify_')) return {}
  const withStoreMatch = value.match(/^shopify_([^_]+)_(.+)$/)
  if (withStoreMatch) {
    return { storeId: withStoreMatch[1], shopifyOrderId: withStoreMatch[2] }
  }
  return { shopifyOrderId: value.replace(/^shopify_/, '') }
}

export const getConfiguredShopifyCredentials = () => {
  const storeUrl = normalizeShopifyDomain(process.env.SHOPIFY_STORE || process.env.SHOPIFY_STORE_URL)
  const adminApiAccessToken = String(
    process.env.SHOPIFY_ACCESS_TOKEN || process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN || '',
  ).trim()
  const apiSecretKey = String(
    process.env.SHOPIFY_API_SECRET || process.env.SHOPIFY_API_SECRET_KEY || process.env.SHOPIFY_WEBHOOK_SECRET || '',
  ).trim()

  return {
    storeUrl,
    adminApiAccessToken,
    apiSecretKey,
    webhookSecret: apiSecretKey,
    configured: Boolean(storeUrl && adminApiAccessToken && apiSecretKey),
  }
}

export const getShopifyWebhookAddress = ({ requirePublic = false }: { requirePublic?: boolean } = {}) => {
  const baseUrl = String(process.env.API_URL || '').trim().replace(/\/+$/, '')
  if (!baseUrl) {
    if (requirePublic) {
      throw new Error('API_URL is not configured for Shopify webhook registration')
    }
    return `http://localhost:${process.env.PORT || 5003}${SHOPIFY_ORDER_CREATED_WEBHOOK_PATH}`
  }
  return `${baseUrl}${SHOPIFY_ORDER_CREATED_WEBHOOK_PATH}`
}

export const getShopifyComplianceWebhookAddress = () => {
  const baseUrl = String(process.env.API_URL || '').trim().replace(/\/+$/, '')
  return baseUrl ? `${baseUrl}${SHOPIFY_COMPLIANCE_WEBHOOK_PATH}` : SHOPIFY_COMPLIANCE_WEBHOOK_PATH
}

export const shopifyGraphqlRequest = async <T = any>({
  storeUrl,
  accessToken,
  query,
  variables,
  timeout = SHOPIFY_API_TIMEOUT_MS,
}: {
  storeUrl: string
  accessToken: string
  query: string
  variables?: Record<string, any>
  timeout?: number
}): Promise<T> => {
  const domain = normalizeShopifyDomain(storeUrl)
  if (!domain) throw new Error('Shopify store URL is required')
  if (!String(accessToken || '').trim()) throw new Error('Shopify Admin API access token is required')

  try {
    const response = await axios.post(
      `https://${domain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
      { query, variables },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': String(accessToken || '').trim(),
        },
        timeout,
      },
    )

    if (Array.isArray(response.data?.errors) && response.data.errors.length) {
      const message = response.data.errors
        .map((err: any) => err?.message || JSON.stringify(err))
        .join('; ')
      throw new Error(message || 'Shopify GraphQL request failed')
    }

    return response.data?.data as T
  } catch (error: any) {
    const status = error?.response?.status
    const shopifyErrors = error?.response?.data?.errors
    const shopifyMessage =
      typeof shopifyErrors === 'string'
        ? shopifyErrors
        : Array.isArray(shopifyErrors)
          ? shopifyErrors.map((err: any) => err?.message || JSON.stringify(err)).join('; ')
          : ''

    if (status === 401 || status === 403) {
      const authError: any = new Error(
        `Shopify Admin API rejected the access token for ${domain}. Check the custom app token and scopes.`,
      )
      authError.statusCode = 401
      throw authError
    }
    if (status === 404) {
      const notFoundError: any = new Error(
        `Shopify store not found: ${domain}. Use the exact myshopify.com domain from Shopify admin.`,
      )
      notFoundError.statusCode = 404
      throw notFoundError
    }
    if (status) {
      const apiError: any = new Error(
        `Shopify Admin API request failed for ${domain} with HTTP ${status}${shopifyMessage ? `: ${shopifyMessage}` : ''}`,
      )
      apiError.statusCode = status >= 400 && status < 500 ? status : 502
      throw apiError
    }
    throw new Error(error?.message || `Shopify Admin API request failed for ${domain}`)
  }
}

export const probeShopifyStore = async (storeUrl: string, adminApiAccessToken: string) => {
  const data = await shopifyGraphqlRequest<{
    shop: {
      id: string
      name?: string
      myshopifyDomain?: string
      primaryDomain?: { host?: string; url?: string }
      currencyCode?: string
      ianaTimezone?: string
      timezoneAbbreviation?: string
      billingAddress?: { countryCodeV2?: string; country?: string; phone?: string; zip?: string }
      email?: string
    }
  }>({
    storeUrl,
    accessToken: adminApiAccessToken,
    query: `
      query Kourier BoyzShopProbe {
        shop {
          id
          name
          myshopifyDomain
          primaryDomain {
            host
            url
          }
          currencyCode
          ianaTimezone
          timezoneAbbreviation
          billingAddress {
            countryCodeV2
            country
            phone
            zip
          }
          email
        }
      }
    `,
  })

  const shop = data?.shop
  if (!shop?.id) {
    throw new Error('Failed to read Shopify shop details')
  }

  const myshopifyDomain = normalizeShopifyDomain(shop.myshopifyDomain || storeUrl)
  return {
    id: extractLegacyId(shop.id),
    graphqlId: shop.id,
    name: shop.name || myshopifyDomain,
    domain: myshopifyDomain,
    primaryDomain: shop.primaryDomain,
    currency: shop.currencyCode || undefined,
    timezone: shop.ianaTimezone || shop.timezoneAbbreviation || undefined,
    country: shop.billingAddress?.countryCodeV2 || shop.billingAddress?.country || undefined,
    email: shop.email || undefined,
    phone: shop.billingAddress?.phone || undefined,
    zip: shop.billingAddress?.zip || undefined,
    raw: shop,
  }
}

export const ensureShopifyOrderWebhooks = async ({
  storeUrl,
  accessToken,
}: {
  storeUrl: string
  accessToken: string
}) => {
  const address = getShopifyWebhookAddress({ requirePublic: true })
  const existingData = await shopifyGraphqlRequest<{
    webhookSubscriptions: { edges: Array<{ node: { id: string; topic: string; uri: string } }> }
  }>({
    storeUrl,
    accessToken,
    query: `
      query Kourier BoyzWebhookSubscriptions($topics: [WebhookSubscriptionTopic!]) {
        webhookSubscriptions(first: 250, topics: $topics) {
          edges {
            node {
              id
              topic
              uri
            }
          }
        }
      }
    `,
    variables: { topics: SHOPIFY_WEBHOOK_TOPICS },
  })

  const existing = existingData?.webhookSubscriptions?.edges?.map((edge) => edge.node) || []
  const existingKeys = new Set(
    existing.map((webhook) => `${String(webhook.topic || '').toUpperCase()}::${String(webhook.uri || '')}`),
  )

  const subscribed: string[] = []
  for (const topic of SHOPIFY_WEBHOOK_TOPICS) {
    const key = `${topic}::${address}`
    if (existingKeys.has(key)) {
      subscribed.push(topic)
      continue
    }

    const created = await shopifyGraphqlRequest<{
      webhookSubscriptionCreate: {
        webhookSubscription?: { id: string; topic: string; uri: string }
        userErrors: Array<{ field?: string[]; message: string }>
      }
    }>({
      storeUrl,
      accessToken,
      query: `
        mutation Kourier BoyzWebhookSubscriptionCreate(
          $topic: WebhookSubscriptionTopic!,
          $webhookSubscription: WebhookSubscriptionInput!
        ) {
          webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
            webhookSubscription {
              id
              topic
              uri
            }
            userErrors {
              field
              message
            }
          }
        }
      `,
      variables: {
        topic,
        webhookSubscription: {
          uri: address,
        },
      },
    })

    const errors = created?.webhookSubscriptionCreate?.userErrors || []
    if (errors.length) {
      throw new Error(errors.map((err) => err.message).join('; '))
    }
    subscribed.push(topic)
  }

  return { address, subscribed }
}

export const ensureShopifyComplianceWebhooks = async ({
  storeUrl,
  accessToken,
}: {
  storeUrl: string
  accessToken: string
}) => {
  const address = getShopifyComplianceWebhookAddress()
  const existingData = await shopifyGraphqlRequest<{
    webhookSubscriptions: { edges: Array<{ node: { id: string; topic: string; uri: string } }> }
  }>({
    storeUrl,
    accessToken,
    query: `
      query Kourier BoyzComplianceWebhookSubscriptions($topics: [WebhookSubscriptionTopic!]) {
        webhookSubscriptions(first: 250, topics: $topics) {
          edges {
            node {
              id
              topic
              uri
            }
          }
        }
      }
    `,
    variables: { topics: SHOPIFY_COMPLIANCE_TOPICS },
  })

  const existing = existingData?.webhookSubscriptions?.edges?.map((edge) => edge.node) || []
  const existingKeys = new Set(
    existing.map((webhook) => `${String(webhook.topic || '').toUpperCase()}::${String(webhook.uri || '')}`),
  )

  const subscribed: string[] = []
  for (const topic of SHOPIFY_COMPLIANCE_TOPICS) {
    const key = `${topic.toUpperCase()}::${address}`
    if (existingKeys.has(key)) {
      subscribed.push(topic)
      continue
    }

    const created = await shopifyGraphqlRequest<{
      webhookSubscriptionCreate: {
        webhookSubscription?: { id: string; topic: string; uri: string }
        userErrors: Array<{ field?: string[]; message: string }>
      }
    }>({
      storeUrl,
      accessToken,
      query: `
        mutation Kourier BoyzComplianceWebhookSubscriptionCreate(
          $topic: WebhookSubscriptionTopic!,
          $webhookSubscription: WebhookSubscriptionInput!
        ) {
          webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
            webhookSubscription {
              id
              topic
              uri
            }
            userErrors {
              field
              message
            }
          }
        }
      `,
      variables: {
        topic,
        webhookSubscription: {
          uri: address,
        },
      },
    })

    const errors = created?.webhookSubscriptionCreate?.userErrors || []
    if (errors.length) {
      throw new Error(errors.map((err) => err.message).join('; '))
    }
    subscribed.push(topic)
  }

  return { address, subscribed }
}

export const upsertShopifySettingsMetafield = async ({
  storeUrl,
  accessToken,
  settings,
  tx = db,
  id,
}: {
  storeUrl: string
  accessToken: string
  settings: Record<string, any>
  id: string
  tx?: any
}) => {
  const ownerData = await shopifyGraphqlRequest<{ shop: { id: string } }>({
    storeUrl,
    accessToken,
    query: `query KourierBoyzSettingsOwner { shop { id } }`,
  })

  const metafieldData = await shopifyGraphqlRequest<{
    shop: {
      kourierBoyzSettings?: { id: string; namespace: string } | null
      legacySettings?: { id: string; namespace: string } | null
    }
  }>({
    storeUrl,
    accessToken,
    query: `
      query KourierBoyzSettingsMetafield($key: String!) {
        shop {
          kourierBoyzSettings: metafield(namespace: "kourier-boyz", key: $key) {
            id
            namespace
          }
          legacySettings: metafield(namespace: "Kourier Boyz", key: $key) {
            id
            namespace
          }
        }
      }
    `,
    variables: { key: 'settings' },
  })

  const existingMetafield = metafieldData?.shop?.kourierBoyzSettings || metafieldData?.shop?.legacySettings
  const mutation = `
      mutation KourierBoyzSettingsMetafieldSet($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields { id namespace key }
          userErrors { field message }
        }
      }
    `

  const saved = await shopifyGraphqlRequest<{
    metafieldsSet: { userErrors: Array<{ field?: string[]; message: string }> }
  }>({
    storeUrl,
    accessToken,
    query: mutation,
    variables: {
      metafields: [
        {
          ownerId: ownerData.shop.id,
          namespace: existingMetafield?.namespace || 'kourier-boyz',
          key: 'settings',
          type: 'json',
          value: JSON.stringify(settings || {}),
        },
      ],
    },
  })

  const errors = saved?.metafieldsSet?.userErrors || []
  if (errors.length) {
    throw new Error(errors.map((err) => err.message).join('; '))
  }

  await tx.update(stores).set({ settings, updatedAt: new Date() }).where(eq(stores.id, id))
}

const getStoreForUser = async (userId: string, storeId?: string, tx: any = db) => {
  const whereClause = storeId
    ? and(
        eq(stores.userId, userId),
        eq(stores.platformId, SHOPIFY_PLATFORM_ID),
        eq(stores.id, String(storeId)),
      )
    : and(eq(stores.userId, userId), eq(stores.platformId, SHOPIFY_PLATFORM_ID))

  const [store] = await tx.select().from(stores).where(whereClause).limit(1)
  return store as ShopifyStore | undefined
}

const getStoreForStatusSync = async (userId: string, storeId?: string, tx: any = db) => {
  const normalizedStoreId = String(storeId || '').trim()
  if (normalizedStoreId) {
    const [store] = await tx
      .select()
      .from(stores)
      .where(and(eq(stores.id, normalizedStoreId), eq(stores.platformId, SHOPIFY_PLATFORM_ID)))
      .limit(1)
    if (store) return store as ShopifyStore
  }

  return getStoreForUser(userId, undefined, tx)
}

const getStoresForUser = async (userId: string, tx: any = db) => {
  const rows = await tx
    .select()
    .from(stores)
    .where(and(eq(stores.userId, userId), eq(stores.platformId, SHOPIFY_PLATFORM_ID)))
  return rows as ShopifyStore[]
}

const getStoreByDomain = async (domain: string, tx: any = db) => {
  const [store] = await tx
    .select()
    .from(stores)
    .where(and(eq(stores.domain, normalizeShopifyDomain(domain)), eq(stores.platformId, SHOPIFY_PLATFORM_ID)))
    .limit(1)
  return store as ShopifyStore | undefined
}

const toFutureIso = (seconds?: number) => {
  const durationSeconds = Number(seconds)
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return undefined
  return new Date(Date.now() + durationSeconds * 1000).toISOString()
}

const getStoreOAuthMetadata = (store: ShopifyStore): Record<string, any> => {
  const metadata = ((store as any)?.metadata || {}) as Record<string, any>
  const oauth = metadata.oauth && typeof metadata.oauth === 'object' ? metadata.oauth : {}
  return {
    ...oauth,
    refreshToken: decryptShopifyToken(oauth.refreshToken),
  }
}

const shouldRefreshShopifyToken = (oauth: Record<string, any>) => {
  if (oauth.tokenType !== 'expiring_offline') return false
  if (!String(oauth.refreshToken || '').trim()) return false

  const expiresAtMs = oauth.expiresAt ? new Date(oauth.expiresAt).getTime() : 0
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= 0) return true

  const safetyBufferMs = Number(process.env.SHOPIFY_TOKEN_REFRESH_BUFFER_MS || 5 * 60 * 1000)
  return expiresAtMs - Date.now() <= safetyBufferMs
}

const refreshShopifyOfflineAccessToken = async (store: ShopifyStore, tx: any = db) => {
  const config = getShopifyOAuthConfig()
  const oauth = getStoreOAuthMetadata(store)
  const refreshToken = String(oauth.refreshToken || '').trim()
  if (!refreshToken) {
    throw new Error(`Shopify refresh token is missing for ${store.domain}. Reconnect the Shopify store.`)
  }

  const params = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  })

  let response
  try {
    response = await axios.post<ShopifyAccessTokenResponse>(
      `https://${normalizeShopifyDomain(store.domain)}/admin/oauth/access_token`,
      params.toString(),
      {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: SHOPIFY_API_TIMEOUT_MS,
      },
    )
  } catch (error: any) {
    const responseError = String(error?.response?.data?.error || '').toLowerCase()
    const description = String(error?.response?.data?.error_description || '').toLowerCase()
    const requiresReconnect =
      responseError === 'invalid_request' && description.includes('active refresh_token')

    if (!requiresReconnect) throw error

    const metadata = ((store as any)?.metadata || {}) as Record<string, any>
    const reconnectOAuth = encryptShopifyOAuth({
      ...oauth,
      active: false,
      reconnectRequired: true,
      reconnectReason: 'inactive_refresh_token',
      reconnectRequiredAt: new Date().toISOString(),
    })
    await tx
      .update(stores)
      .set({ metadata: { ...metadata, oauth: reconnectOAuth }, updatedAt: new Date() })
      .where(eq(stores.id, store.id))
    ;(store as any).metadata = { ...metadata, oauth: reconnectOAuth }

    throw new ShopifyReconnectRequiredError(
      `Shopify authorization expired for ${store.domain}. Reopen Kourier Boyz from Shopify Admin.`,
    )
  }

  const accessToken = String(response.data?.access_token || '').trim()
  if (!accessToken) {
    throw new Error(`Shopify refresh did not return an access token for ${store.domain}`)
  }

  const metadata = ((store as any)?.metadata || {}) as Record<string, any>
  const refreshedOAuth = {
    ...oauth,
    tokenType: 'expiring_offline',
    scope: response.data?.scope || oauth.scope,
    expiresIn: response.data?.expires_in,
    expiresAt: toFutureIso(response.data?.expires_in),
    refreshToken: response.data?.refresh_token || refreshToken,
    refreshTokenExpiresIn: response.data?.refresh_token_expires_in,
    refreshTokenExpiresAt:
      toFutureIso(response.data?.refresh_token_expires_in) || oauth.refreshTokenExpiresAt,
    refreshedAt: new Date().toISOString(),
    active: true,
    reconnectRequired: false,
  }
  const storedAccessToken = encryptShopifyToken(accessToken)
  const storedOAuth = encryptShopifyOAuth(refreshedOAuth)

  await tx
    .update(stores)
    .set({
      adminApiAccessToken: storedAccessToken,
      metadata: {
        ...metadata,
        oauth: storedOAuth,
      },
      updatedAt: new Date(),
    })
    .where(eq(stores.id, store.id))

  ;(store as any).adminApiAccessToken = storedAccessToken
  ;(store as any).metadata = {
    ...metadata,
    oauth: storedOAuth,
  }

  return accessToken
}

const getShopifyAccessTokenForStore = async (store: ShopifyStore, tx: any = db) => {
  const oauth = getStoreOAuthMetadata(store)
  if (oauth.reconnectRequired || oauth.active === false) {
    throw new ShopifyReconnectRequiredError(
      `Shopify authorization expired for ${store.domain}. Reopen Kourier Boyz from Shopify Admin.`,
    )
  }
  if (!shouldRefreshShopifyToken(oauth)) {
    const token = decryptShopifyToken(store.adminApiAccessToken)
    if (!token) throw new Error(`Shopify access token is missing for ${store.domain}`)
    return token
  }

  return refreshShopifyOfflineAccessToken(store, tx)
}

const shopifyStoreGraphqlRequest = async <T = any>({
  store,
  query,
  variables,
  timeout,
  tx = db,
}: {
  store: ShopifyStore
  query: string
  variables?: Record<string, any>
  timeout?: number
  tx?: any
}) =>
  {
    const request = async (accessToken: string) =>
      shopifyGraphqlRequest<T>({
        storeUrl: store.domain,
        accessToken,
        query,
        variables,
        timeout,
      })

    try {
      return await request(await getShopifyAccessTokenForStore(store, tx))
    } catch (error: any) {
      const oauth = getStoreOAuthMetadata(store)
      if (error?.statusCode === 401 && String(oauth.refreshToken || '').trim()) {
        return request(await refreshShopifyOfflineAccessToken(store, tx))
      }
      throw error
    }
  }

export const connectShopifyStore = async ({
  storeUrl,
  adminApiAccessToken,
  userId,
  apiKey,
  apiSecretKey,
  webhookSecret,
  settings,
  authMethod,
  oauth,
  allowOrphanedOwnerRepair = false,
  allowInactiveOwnerReassignment = false,
  tx = db,
}: ConnectShopifyStoreParams) => {
  const normalizedDomain = normalizeShopifyDomain(storeUrl)
  if (!normalizedDomain) throw new Error('Shopify store URL is required')
  if (!String(adminApiAccessToken || '').trim()) throw new Error('Shopify Admin API access token is required')
  if (!userId) throw new Error('User ID is required')

  const shopifyData = await probeShopifyStore(normalizedDomain, adminApiAccessToken)
  const signingSecret = String(
    webhookSecret || apiSecretKey || process.env.SHOPIFY_WEBHOOK_SECRET || process.env.SHOPIFY_API_SECRET || '',
  ).trim()
  const normalizedSettings = normalizeShopifySettings(settings)
  const storedAccessToken = encryptShopifyToken(adminApiAccessToken)
  const storedSigningSecret = signingSecret ? encryptShopifyToken(signingSecret) : undefined
  const storedOAuth = oauth ? encryptShopifyOAuth(oauth) : undefined
  if (storedAccessToken.length > 255) {
    throw new Error('Encrypted Shopify access token exceeds the database column limit')
  }
  let savedStore: ShopifyStore | undefined

  await tx.transaction(async (innerTx: any) => {
    await ensurePlatformRegistration(SHOPIFY_PLATFORM, innerTx)

    const [existingGlobalStore] = await innerTx
      .select()
      .from(stores)
      .where(and(eq(stores.id, shopifyData.id), eq(stores.platformId, SHOPIFY_PLATFORM_ID)))
      .limit(1)

    if (existingGlobalStore && existingGlobalStore.userId !== userId) {
      const existingOAuth = getStoreOAuthMetadata(existingGlobalStore)
      const canReassignInactiveOwner =
        allowInactiveOwnerReassignment && existingOAuth.active === false
      const [currentOwner] = allowOrphanedOwnerRepair
        ? await innerTx
            .select({ id: users.id })
            .from(users)
            .where(eq(users.id, existingGlobalStore.userId))
            .limit(1)
        : []

      if (!canReassignInactiveOwner && (!allowOrphanedOwnerRepair || currentOwner)) {
        throw new Error('This Shopify store is already connected to another merchant account')
      }

      const previousOwnerId = existingGlobalStore.userId
      const [reassignedStore] = await innerTx
        .update(stores)
        .set({ userId, updatedAt: new Date() })
        .where(
          and(
            eq(stores.id, existingGlobalStore.id),
            eq(stores.userId, existingGlobalStore.userId),
          ),
        )
        .returning({ id: stores.id })

      if (!reassignedStore) {
        throw new Error('Shopify store ownership changed while repairing its merchant account')
      }

      const [remainingShopifyStores] = await innerTx
        .select({ count: sql<number>`count(*)::int` })
        .from(stores)
        .where(sql`
          ${stores.userId} = ${previousOwnerId}
          AND ${stores.platformId} = ${SHOPIFY_PLATFORM_ID}
          AND ${stores.id} <> ${existingGlobalStore.id}
          AND coalesce(${stores.metadata}->'oauth'->>'active', 'true') <> 'false'
        `)
      await setUserChannelIntegration(
        previousOwnerId,
        SHOPIFY_PLATFORM_ID,
        Number(remainingShopifyStores?.count || 0) > 0,
        innerTx,
      )
    }

    await upsertStore(
      {
        id: shopifyData.id,
        name: shopifyData.name,
        domain: shopifyData.domain,
        timezone: shopifyData.timezone,
        country: shopifyData.country,
        currency: shopifyData.currency,
        email: shopifyData.email,
        phone: shopifyData.phone,
        zip: shopifyData.zip,
        apiKey: String(apiKey || '').trim() || (authMethod === 'oauth' ? 'shopify_oauth_app' : 'shopify_custom_app'),
        adminApiAccessToken: storedAccessToken,
        shopifyWebhookSecret: storedSigningSecret,
        authMethod: authMethod || 'legacy_custom_app',
        oauth: storedOAuth,
        graphqlId: shopifyData.graphqlId,
        primaryDomain: shopifyData.primaryDomain,
        storeInfo: shopifyData.raw,
      },
      SHOPIFY_PLATFORM_ID,
      userId,
      innerTx,
    )

    await innerTx
      .update(stores)
      .set({
        settings: normalizedSettings,
        metadata: {
          ...(existingGlobalStore?.metadata || {}),
          shopifyWebhookSecret: storedSigningSecret,
          apiSecretKey: apiSecretKey ? 'configured' : undefined,
          authMethod: authMethod || 'legacy_custom_app',
          oauth: storedOAuth,
          graphqlId: shopifyData.graphqlId,
          primaryDomain: shopifyData.primaryDomain,
          storeInfo: shopifyData.raw,
        },
        updatedAt: new Date(),
      })
      .where(eq(stores.id, shopifyData.id))

    await updateUserChannelIntegration(userId, SHOPIFY_PLATFORM_ID, innerTx)
    ;[savedStore] = await innerTx.select().from(stores).where(eq(stores.id, shopifyData.id)).limit(1)
  })

  if (settings && savedStore) {
    try {
      await upsertShopifySettingsMetafield({
        storeUrl: normalizedDomain,
        accessToken: adminApiAccessToken,
        settings: normalizedSettings,
        id: savedStore.id,
      })
    } catch (err: any) {
      console.warn('Shopify settings metafield sync failed:', err?.message || err)
    }
  }

  const warning = signingSecret ? null : 'Store connected, but Shopify webhook signature secret is missing'

  return { shopifyData, store: savedStore, webhooks: null, warning }
}

export const updateShopifyStoreSettingsForUser = async ({
  userId,
  storeId,
  settings,
  tx = db,
}: {
  userId: string
  storeId?: string
  settings: Record<string, any>
  tx?: any
}) => {
  if (!userId) throw new Error('User ID is required')
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    throw new Error('Shopify settings payload is required')
  }

  const store = await getStoreForUser(userId, storeId, tx)
  if (!store) throw new Error('No connected Shopify store found for this user')

  const normalizedSettings = normalizeShopifySettings(settings)

  await tx.update(stores).set({ settings: normalizedSettings, updatedAt: new Date() }).where(eq(stores.id, store.id))

  let warning: string | null = null
  try {
    const accessToken = await getShopifyAccessTokenForStore(store, tx)
    await upsertShopifySettingsMetafield({
      storeUrl: store.domain,
      accessToken,
      settings: normalizedSettings,
      id: store.id,
      tx,
    })
  } catch (err: any) {
    warning = 'Settings saved locally, but Shopify metafield sync failed'
    console.warn('Shopify settings metafield update failed:', err?.response?.data || err?.message || err)
  }

  const [updatedStore] = await tx.select().from(stores).where(eq(stores.id, store.id)).limit(1)
  return { store: updatedStore as ShopifyStore | undefined, warning }
}

const parseCsvTags = (value: unknown): string[] =>
  String(value || '')
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)

const getOrderTagSet = (order: any): Set<string> =>
  new Set(
    String(order?.tags || '')
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean),
  )

const shouldIncludeByTags = (order: any, requiredTagsCsv?: string): boolean => {
  const required = parseCsvTags(requiredTagsCsv)
  if (!required.length) return true
  const orderTags = getOrderTagSet(order)
  return required.some((tag) => orderTags.has(tag))
}

const resolveOrderType = (order: any, settings: any): 'cod' | 'prepaid' => {
  const orderTags = getOrderTagSet(order)
  const codTags = parseCsvTags(settings?.codTags)
  const prepaidTags = parseCsvTags(settings?.prepaidTags)
  if (codTags.length && codTags.some((tag) => orderTags.has(tag))) return 'cod'
  if (prepaidTags.length && prepaidTags.some((tag) => orderTags.has(tag))) return 'prepaid'

  const gateways = Array.isArray(order?.payment_gateway_names)
    ? order.payment_gateway_names.map((g: string) => String(g || '').toLowerCase())
    : []
  const codGateway = gateways.some((g: string) => g.includes('cod') || g.includes('cash'))
  if (codGateway) return 'cod'

  return String(order?.financial_status || '').toLowerCase() === 'paid' ? 'prepaid' : 'cod'
}

const mapShopifyStatus = (order: any): string => {
  if (order?.cancelled_at) return 'cancelled'
  const fulfillmentStatus = String(order?.fulfillment_status || '').toLowerCase()
  if (fulfillmentStatus === 'fulfilled' || fulfillmentStatus === 'fulfilled_status') return 'delivered'
  if (fulfillmentStatus.includes('fulfilled') && fulfillmentStatus.includes('partial')) return 'in_transit'
  if (fulfillmentStatus === 'partial' || fulfillmentStatus === 'partially_fulfilled') return 'in_transit'
  return 'pending'
}

const normalizeFulfillTrigger = (value: unknown): FulfillTrigger => {
  const trigger = String(value || 'do_not_fulfill').trim().toLowerCase()
  if (
    trigger === 'order_booked' ||
    trigger === 'order_in_transit' ||
    trigger === 'order_out_for_delivery' ||
    trigger === 'order_delivered'
  ) {
    return trigger
  }
  return 'do_not_fulfill'
}

const statusPriority: Record<string, number> = {
  booked: 1,
  pickup_initiated: 1,
  in_transit: 2,
  out_for_delivery: 3,
  delivered: 4,
}

const triggerPriority: Record<FulfillTrigger, number> = {
  do_not_fulfill: Number.MAX_SAFE_INTEGER,
  order_booked: 1,
  order_in_transit: 2,
  order_out_for_delivery: 3,
  order_delivered: 4,
}

const shouldAttemptFulfillment = (orderStatus: unknown, trigger: unknown) => {
  const normalizedTrigger = normalizeFulfillTrigger(trigger)
  if (normalizedTrigger === 'do_not_fulfill') return false
  const orderLevel = statusPriority[String(orderStatus || '').toLowerCase()] || 0
  return orderLevel >= triggerPriority[normalizedTrigger]
}

const shouldNotifyCustomerOnFulfill = (settings: any) => {
  const value = String(
    settings?.customerNotifyOnFulfill ?? settings?.notifyCustomerOnFulfill ?? settings?.notifyOnFulfill ?? '',
  )
    .trim()
    .toLowerCase()
  return ['notify', 'notify_customer', 'yes', 'true', '1'].includes(value)
}

const mapProducts = (order: any) => {
  const items = Array.isArray(order?.line_items) ? order.line_items : []
  return items.map((item: any) => {
    const qty = Math.max(1, toNumber(item?.quantity, 1))
    const price = toNumber(item?.price, 0)
    const discount = Array.isArray(item?.discount_allocations)
      ? item.discount_allocations.reduce((sum: number, d: any) => sum + toNumber(d?.amount, 0), 0)
      : 0
    const lineTaxRate = Array.isArray(item?.tax_lines)
      ? item.tax_lines.reduce((sum: number, t: any) => sum + toNumber(t?.rate, 0), 0) * 100
      : 0
    return {
      name: item?.name || item?.title || 'Item',
      sku: item?.sku || 'NA',
      qty,
      price,
      discount,
      tax_rate: lineTaxRate,
      hsn: '',
    }
  })
}

const toPhone = (order: any): string => {
  const phone =
    order?.phone ||
    order?.shipping_address?.phone ||
    order?.billing_address?.phone ||
    order?.customer?.phone ||
    ''
  const clean = String(phone).replace(/[^\d+]/g, '').trim()
  return clean || '0000000000'
}

const mapAddressFromGraphql = (address: any) =>
  address
    ? {
        name:
          address.name ||
          `${address.firstName || ''} ${address.lastName || ''}`.trim() ||
          address.company ||
          '',
        first_name: address.firstName,
        last_name: address.lastName,
        address1: address.address1,
        address2: address.address2,
        city: address.city,
        province: address.province,
        province_code: address.provinceCode,
        country: address.country,
        country_code: address.countryCodeV2,
        zip: address.zip,
        phone: address.phone,
      }
    : null

const isShopifyCustomerDataAccessError = (error: any) =>
  /not approved to access the customer object|personally identifiable information|protected customer data/i.test(
    String(error?.message || error || ''),
  )

const normalizeGraphqlOrder = (
  node: any,
  options: { piiAccessRestricted?: boolean } = {},
) => {
  const legacyId = extractLegacyId(node?.legacyResourceId || node?.id)
  const tags = Array.isArray(node?.tags) ? node.tags.join(', ') : String(node?.tags || '')
  const lineItems = Array.isArray(node?.lineItems?.nodes) ? node.lineItems.nodes : []
  const totalQuantity = lineItems.reduce((sum: number, item: any) => sum + toNumber(item?.quantity, 0), 0)

  return {
    id: legacyId,
    admin_graphql_api_id: node?.id,
    name: node?.name,
    order_number: node?.number,
    created_at: node?.createdAt,
    updated_at: node?.updatedAt,
    cancelled_at: node?.cancelledAt,
    email: node?.email || '',
    phone: node?.phone || '',
    financial_status: String(node?.displayFinancialStatus || '').toLowerCase(),
    fulfillment_status: String(node?.displayFulfillmentStatus || '').toLowerCase(),
    payment_gateway_names: node?.paymentGatewayNames || [],
    tags,
    total_price: moneyAmount(node?.currentTotalPriceSet ?? node?.totalPriceSet),
    total_discounts: moneyAmount(node?.currentTotalDiscountsSet ?? node?.totalDiscountsSet),
    shopify_pii_restricted: options.piiAccessRestricted === true,
    shipping_lines: [
      {
        price: moneyAmount(node?.currentShippingPriceSet ?? node?.totalShippingPriceSet),
      },
    ],
    shipping_address: mapAddressFromGraphql(node?.shippingAddress),
    billing_address: mapAddressFromGraphql(node?.billingAddress),
    customer: null,
    line_items: lineItems.map((item: any) => ({
      id: extractLegacyId(item?.id),
      name: item?.name || item?.title,
      title: item?.title || item?.name,
      sku: item?.sku,
      quantity: item?.quantity,
      price: moneyAmount(item?.originalUnitPriceSet),
      grams: Math.round(toNumber(node?.totalWeight, 0) / Math.max(1, totalQuantity)),
      discount_allocations: [
        {
          amount: moneyAmount(item?.totalDiscountSet),
        },
      ],
      tax_lines: Array.isArray(item?.taxLines)
        ? item.taxLines.map((tax: any) => ({
            rate: toNumber(tax?.rate, toNumber(tax?.ratePercentage, 0) / 100),
          }))
        : [],
    })),
  }
}

const appendOrderNumberSuffix = (base: string, suffix: string) => {
  const cleanBase = String(base || '').trim() || 'SHOPIFY'
  const cleanSuffix = String(suffix || '').replace(/[^a-zA-Z0-9-]/g, '').slice(-16)
  const ending = cleanSuffix ? `-${cleanSuffix}` : ''
  return `${cleanBase.slice(0, Math.max(1, 50 - ending.length))}${ending}`.slice(0, 50)
}

const resolveShopifyOrderNumber = async ({
  tx,
  userId,
  baseOrderNumber,
  storeId,
  shopifyOrderId,
  internalOrderId,
  legacyInternalOrderId,
  targetId,
}: {
  tx: any
  userId: string
  baseOrderNumber: string
  storeId: string
  shopifyOrderId: string
  internalOrderId: string
  legacyInternalOrderId: string
  targetId?: string | null
}) => {
  const base = String(baseOrderNumber || '').trim().slice(0, 50) || shopifyOrderId.slice(-12)
  const suffixBase = `${String(storeId || '').slice(-4)}${String(shopifyOrderId || '').slice(-6)}`
  const candidates = [
    base,
    appendOrderNumberSuffix(base, suffixBase),
    appendOrderNumberSuffix(base, String(shopifyOrderId || '').slice(-10)),
  ]

  for (let attempt = 2; attempt <= 20; attempt += 1) {
    candidates.push(appendOrderNumberSuffix(base, `${suffixBase}-${attempt}`))
  }

  for (const candidate of candidates) {
    const [conflict] = await tx
      .select({ id: b2c_orders.id, order_id: b2c_orders.order_id })
      .from(b2c_orders)
      .where(and(eq(b2c_orders.user_id, userId), eq(b2c_orders.order_number, candidate)))
      .limit(1)

    if (!conflict) return candidate
    if (targetId && conflict.id === targetId) return candidate
    if ([internalOrderId, legacyInternalOrderId].includes(String(conflict.order_id || ''))) {
      return candidate
    }
  }

  return appendOrderNumberSuffix(base, `${suffixBase}-${Date.now().toString(36).slice(-4)}`)
}

const isSameShopifyOrderRow = (
  row: { order_id?: string | null; provider_meta?: any } | undefined,
  {
    storeId,
    shopifyOrderId,
    internalOrderId,
    legacyInternalOrderId,
  }: {
    storeId: string
    shopifyOrderId: string
    internalOrderId: string
    legacyInternalOrderId: string
  },
) => {
  if (!row) return false

  const orderId = String(row.order_id || '')
  if ([internalOrderId, legacyInternalOrderId].includes(orderId)) return true

  const providerMeta = row.provider_meta && typeof row.provider_meta === 'object' ? row.provider_meta : {}
  return (
    String(providerMeta.source || '').toLowerCase() === 'shopify' &&
    String(providerMeta.shopify_store_id || '') === String(storeId) &&
    String(providerMeta.shopify_order_id || '') === String(shopifyOrderId)
  )
}

const SHOPIFY_ORDERS_QUERY = `
  query Kourier BoyzOrders($first: Int!) {
    orders(first: $first, sortKey: CREATED_AT, reverse: true) {
      edges {
        node {
          id
          legacyResourceId
          name
          number
          createdAt
          updatedAt
          cancelledAt
          email
          phone
          displayFinancialStatus
          displayFulfillmentStatus
          paymentGatewayNames
          tags
          totalWeight
          currentTotalPriceSet { shopMoney { amount currencyCode } }
          totalPriceSet { shopMoney { amount currencyCode } }
          currentShippingPriceSet { shopMoney { amount currencyCode } }
          totalShippingPriceSet { shopMoney { amount currencyCode } }
          currentTotalDiscountsSet { shopMoney { amount currencyCode } }
          totalDiscountsSet { shopMoney { amount currencyCode } }
          shippingAddress {
            name
            firstName
            lastName
            address1
            address2
            city
            province
            provinceCode
            country
            countryCodeV2
            zip
            phone
          }
          billingAddress {
            name
            firstName
            lastName
            address1
            address2
            city
            province
            provinceCode
            country
            countryCodeV2
            zip
            phone
          }
          lineItems(first: 100) {
            nodes {
              id
              name
              title
              sku
              quantity
              originalUnitPriceSet { shopMoney { amount currencyCode } }
              totalDiscountSet { shopMoney { amount currencyCode } }
              taxLines {
                rate
                ratePercentage
              }
            }
          }
        }
      }
    }
  }
`

const SHOPIFY_ORDERS_RESTRICTED_QUERY = `
  query Kourier BoyzOrdersRestricted($first: Int!) {
    orders(first: $first, sortKey: CREATED_AT, reverse: true) {
      edges {
        node {
          id
          legacyResourceId
          name
          number
          createdAt
          updatedAt
          cancelledAt
          displayFinancialStatus
          displayFulfillmentStatus
          paymentGatewayNames
          tags
          totalWeight
          currentTotalPriceSet { shopMoney { amount currencyCode } }
          totalPriceSet { shopMoney { amount currencyCode } }
          currentShippingPriceSet { shopMoney { amount currencyCode } }
          totalShippingPriceSet { shopMoney { amount currencyCode } }
          currentTotalDiscountsSet { shopMoney { amount currencyCode } }
          totalDiscountsSet { shopMoney { amount currencyCode } }
          lineItems(first: 100) {
            nodes {
              id
              name
              title
              sku
              quantity
              originalUnitPriceSet { shopMoney { amount currencyCode } }
              totalDiscountSet { shopMoney { amount currencyCode } }
              taxLines {
                rate
                ratePercentage
              }
            }
          }
        }
      }
    }
  }
`

const fetchShopifyOrders = async (store: ShopifyStore, limit = 50) => {
  const clampedLimit = Math.min(Math.max(limit, 1), 250)
  let piiAccessRestricted = false
  let data: { orders: { edges: Array<{ node: any }> } }

  try {
    data = await shopifyStoreGraphqlRequest<{
      orders: { edges: Array<{ node: any }> }
    }>({
      store,
      query: SHOPIFY_ORDERS_QUERY,
      variables: { first: clampedLimit },
      timeout: 30000,
    })
  } catch (error: any) {
    if (!isShopifyCustomerDataAccessError(error)) throw error

    piiAccessRestricted = true
    console.warn('[Shopify] Customer data access restricted; syncing non-PII order fields only', {
      storeId: store.id,
      domain: store.domain,
    })
    data = await shopifyStoreGraphqlRequest<{
      orders: { edges: Array<{ node: any }> }
    }>({
      store,
      query: SHOPIFY_ORDERS_RESTRICTED_QUERY,
      variables: { first: clampedLimit },
      timeout: 30000,
    })
  }

  return (data?.orders?.edges || []).map((edge) =>
    normalizeGraphqlOrder(edge.node, { piiAccessRestricted }),
  )
}

const upsertFromShopifyOrder = async (store: ShopifyStore, order: any, settings: any, tx: any = db) => {
  if (!order?.id) return 'skipped' as const
  if (!shouldIncludeByTags(order, settings?.orderTagsToFetch)) return 'skipped' as const

  const shopifyOrderId = String(order.id)
  const internalOrderId = buildInternalOrderId(String(store.id), shopifyOrderId)
  const legacyInternalOrderId = `shopify_${shopifyOrderId}`
  const orderType = resolveOrderType(order, settings)
  const mappedStatus = mapShopifyStatus(order)

  const shippingAddress = order?.shipping_address || order?.billing_address || {}
  const shippingCharges = Array.isArray(order?.shipping_lines)
    ? order.shipping_lines.reduce((sum: number, s: any) => sum + toNumber(s?.price, 0), 0)
    : 0
  const products = mapProducts(order)
  const totalWeightGrams = (Array.isArray(order?.line_items) ? order.line_items : []).reduce(
    (sum: number, item: any) => sum + toNumber(item?.grams, 0) * Math.max(1, toNumber(item?.quantity, 1)),
    0,
  )
  const declaredWeight = totalWeightGrams > 0 ? totalWeightGrams : 500
  const orderAmount = toNumber(order?.total_price, 0)
  const orderName = String(order?.name || order?.order_number || shopifyOrderId).trim()
  const piiAccessRestricted = order?.shopify_pii_restricted === true
  const existingTags = String(order?.tags || '').trim()
  const syncTags = existingTags || `shopify_store:${store.id}`
  const providerMeta = {
    source: 'shopify',
    shopify_store_id: String(store.id),
    shopify_order_id: shopifyOrderId,
    shopify_pii_restricted: piiAccessRestricted,
    customer_data_note: piiAccessRestricted
      ? 'Shopify did not grant this app access to customer PII; buyer address and phone were not available during sync.'
      : undefined,
  }

  const [existing] = await tx
    .select({
      id: b2c_orders.id,
      order_number: b2c_orders.order_number,
      order_status: b2c_orders.order_status,
      awb_number: b2c_orders.awb_number,
      courier_partner: b2c_orders.courier_partner,
      integration_type: b2c_orders.integration_type,
      provider_meta: b2c_orders.provider_meta,
      provider_service: b2c_orders.provider_service,
    })
    .from(b2c_orders)
    .where(eq(b2c_orders.order_id, internalOrderId))
    .limit(1)

  const [legacyExisting] = existing
    ? [undefined]
    : await tx
        .select({
          id: b2c_orders.id,
          order_number: b2c_orders.order_number,
          order_status: b2c_orders.order_status,
          awb_number: b2c_orders.awb_number,
          courier_partner: b2c_orders.courier_partner,
          integration_type: b2c_orders.integration_type,
          provider_meta: b2c_orders.provider_meta,
          provider_service: b2c_orders.provider_service,
        })
        .from(b2c_orders)
        .where(eq(b2c_orders.order_id, legacyInternalOrderId))
        .limit(1)

  const targetOrder = (existing || legacyExisting || null) as ExistingShopifyOrderRow | null
  const targetId = targetOrder?.id || null
  const resolvedOrderNumber = targetId
    ? String(existing?.order_number || legacyExisting?.order_number || orderName).slice(0, 50)
    : await resolveShopifyOrderNumber({
        tx,
        userId: store.userId,
        baseOrderNumber: orderName,
        storeId: String(store.id),
        shopifyOrderId,
        internalOrderId,
        legacyInternalOrderId,
      })
  const updatePayload: Partial<typeof b2c_orders.$inferInsert> = {
    user_id: store.userId,
    order_number: resolvedOrderNumber,
    order_date: String(order?.created_at || new Date().toISOString()).slice(0, 50),
    order_amount: orderAmount,
    order_id: internalOrderId,
    invoice_number: order?.name ? String(order.name).slice(0, 100) : null,
    invoice_date: order?.created_at ? String(order.created_at).slice(0, 50) : null,
    invoice_amount: orderAmount,
    buyer_name: String(
      shippingAddress?.name || order?.customer?.first_name || order?.email || 'Shopify Customer',
    ).slice(0, 255),
    buyer_phone: toPhone(order).slice(0, 20),
    buyer_email: String(order?.email || '').slice(0, 255) || null,
    address: String([shippingAddress?.address1, shippingAddress?.address2].filter(Boolean).join(', ') || 'Address not provided').slice(
      0,
      500,
    ),
    city: String(shippingAddress?.city || 'NA').slice(0, 100),
    state: String(shippingAddress?.province || shippingAddress?.province_code || 'NA').slice(0, 100),
    country: String(shippingAddress?.country || 'India').slice(0, 100),
    pincode: String(shippingAddress?.zip || '000000').slice(0, 20),
    products: products.length ? products : [{ name: 'Item', sku: 'NA', qty: 1, price: orderAmount }],
    weight: declaredWeight,
    length: 10,
    breadth: 10,
    height: 10,
    order_type: orderType,
    prepaid_amount: orderType === 'prepaid' ? orderAmount : 0,
    cod_charges: 0,
    shipping_charges: shippingCharges,
    transaction_fee: 0,
    gift_wrap: 0,
    discount: toNumber(order?.total_discounts, 0),
    order_status: mappedStatus,
    courier_partner: '',
    provider_meta: providerMeta,
    integration_type: 'shopify',
    is_external_api: false,
    tags: syncTags.slice(0, 200),
    updated_at: new Date(),
  }

  const buildBookedUpdatePayload = (
    row: ExistingShopifyOrderRow | null | undefined,
    payload: Partial<typeof b2c_orders.$inferInsert> = updatePayload,
  ) => {
    if (!row?.awb_number) return payload

    const existingProviderMeta =
      row.provider_meta && typeof row.provider_meta === 'object' && !Array.isArray(row.provider_meta)
        ? row.provider_meta
        : {}
    const providerMetaCourierName = getProviderMetaCourierName(existingProviderMeta)
    const bookedProviderKey = resolveCourierProviderKeyFromFields(
      row.integration_type,
      row.courier_partner,
      providerMetaCourierName,
      row.provider_service,
    )

    return {
      ...payload,
      order_status:
        String(payload.order_status || '').toLowerCase() === 'cancelled'
          ? payload.order_status
          : row.order_status || payload.order_status,
      courier_partner:
        providerMetaCourierName ||
        (bookedProviderKey ? getCourierProviderDisplayName(bookedProviderKey) : '') ||
        row.courier_partner ||
        payload.courier_partner,
      integration_type: bookedProviderKey || row.integration_type || payload.integration_type,
      provider_meta: {
        ...existingProviderMeta,
        ...providerMeta,
      },
    }
  }

  if (targetOrder?.id) {
    await tx
      .update(b2c_orders)
      .set({ ...buildBookedUpdatePayload(targetOrder), order_id: internalOrderId })
      .where(eq(b2c_orders.id, targetOrder.id))
    return 'updated' as const
  }

  const updateExistingOrder = async (
    row: ExistingShopifyOrderRow,
    payload: Partial<typeof b2c_orders.$inferInsert> = updatePayload,
  ) => {
    await tx
      .update(b2c_orders)
      .set({ ...buildBookedUpdatePayload(row, payload), order_id: internalOrderId })
      .where(eq(b2c_orders.id, row.id))
    return 'updated' as const
  }

  const tryInsertOrder = async (payload: Partial<typeof b2c_orders.$inferInsert>) => {
    const [inserted] = await tx
      .insert(b2c_orders)
      .values({
        ...payload,
        created_at: new Date(),
      } as any)
      .onConflictDoNothing({
        target: [b2c_orders.user_id, b2c_orders.order_number],
      })
      .returning({ id: b2c_orders.id })

    return inserted?.id ? 'created' as const : null
  }

  const inserted = await tryInsertOrder(updatePayload)
  if (inserted) return inserted

  const [orderNumberConflict] = await tx
    .select({
      id: b2c_orders.id,
      order_id: b2c_orders.order_id,
      order_status: b2c_orders.order_status,
      awb_number: b2c_orders.awb_number,
      courier_partner: b2c_orders.courier_partner,
      integration_type: b2c_orders.integration_type,
      provider_meta: b2c_orders.provider_meta,
      provider_service: b2c_orders.provider_service,
    })
    .from(b2c_orders)
    .where(and(eq(b2c_orders.user_id, store.userId), eq(b2c_orders.order_number, resolvedOrderNumber)))
    .limit(1)

  if (
    isSameShopifyOrderRow(orderNumberConflict, {
      storeId: String(store.id),
      shopifyOrderId,
      internalOrderId,
      legacyInternalOrderId,
    })
  ) {
    return updateExistingOrder(orderNumberConflict)
  }

  const fallbackOrderNumber = await resolveShopifyOrderNumber({
    tx,
    userId: store.userId,
    baseOrderNumber: appendOrderNumberSuffix(
      orderName,
      `${String(store.id || '').slice(-4)}${String(shopifyOrderId || '').slice(-6)}-${Date.now().toString(36).slice(-4)}`,
    ),
    storeId: String(store.id),
    shopifyOrderId,
    internalOrderId,
    legacyInternalOrderId,
  })
  const fallbackPayload = { ...updatePayload, order_number: fallbackOrderNumber }
  const fallbackInserted = await tryInsertOrder(fallbackPayload)
  if (fallbackInserted) return fallbackInserted

  const [fallbackConflict] = await tx
    .select({
      id: b2c_orders.id,
      order_id: b2c_orders.order_id,
      order_status: b2c_orders.order_status,
      awb_number: b2c_orders.awb_number,
      courier_partner: b2c_orders.courier_partner,
      integration_type: b2c_orders.integration_type,
      provider_meta: b2c_orders.provider_meta,
      provider_service: b2c_orders.provider_service,
    })
    .from(b2c_orders)
    .where(and(eq(b2c_orders.user_id, store.userId), eq(b2c_orders.order_number, fallbackOrderNumber)))
    .limit(1)

  if (
    isSameShopifyOrderRow(fallbackConflict, {
      storeId: String(store.id),
      shopifyOrderId,
      internalOrderId,
      legacyInternalOrderId,
    })
  ) {
    return updateExistingOrder(fallbackConflict, fallbackPayload)
  }

  const lastChancePayload = {
    ...fallbackPayload,
    order_number: appendOrderNumberSuffix(
      orderName,
      `${String(store.id || '').slice(-4)}${String(shopifyOrderId || '').slice(-6)}-${Date.now().toString(36)}`,
    ),
  }
  const lastChanceInserted = await tryInsertOrder(lastChancePayload)
  if (lastChanceInserted) return lastChanceInserted

  throw new Error(`Could not reserve a unique Shopify order number for order ${shopifyOrderId}`)
}

export const syncShopifyOrdersForUser = async (
  userId: string,
  limit = 50,
  storeId?: string,
  tx: any = db,
): Promise<SyncResult> => {
  const storesToSync = storeId
    ? [await getStoreForUser(userId, storeId, tx)].filter(Boolean)
    : await getStoresForUser(userId, tx)
  if (!storesToSync.length) {
    throw new Error('No connected Shopify store found for this user')
  }

  const result: SyncResult = { created: 0, updated: 0, skipped: 0 }

  for (const store of storesToSync) {
    const orders = await fetchShopifyOrders(store as ShopifyStore, limit)
    const settings = normalizeShopifySettings((store as any)?.settings || {})
    for (const order of orders) {
      const state = await upsertFromShopifyOrder(store as ShopifyStore, order, settings, tx)
      result[state] += 1
    }
  }

  return result
}

export const verifyShopifyWebhookSignature = (rawBody: Buffer, receivedHmac?: string) => {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET || process.env.SHOPIFY_API_SECRET
  if (!secret) {
    throw new Error('SHOPIFY_WEBHOOK_SECRET or SHOPIFY_API_SECRET is not configured')
  }
  return verifyShopifyWebhookSignatureWithSecret(rawBody, receivedHmac, secret)
}

const verifyShopifyWebhookSignatureWithSecret = (
  rawBody: Buffer,
  receivedHmac: string | undefined,
  secret: string,
) => {
  const digest = crypto.createHmac('sha256', secret).update(rawBody).digest('base64')
  const a = Buffer.from(digest)
  const b = Buffer.from(String(receivedHmac || ''))
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

const getStoreWebhookSecret = (store: ShopifyStore): string => {
  const metadata = ((store as any)?.metadata || {}) as Record<string, unknown>
  const candidates = [
    metadata.shopifyWebhookSecret,
    metadata.webhookSecret,
    metadata.apiSecret,
    metadata.apiSecretKey,
    process.env.SHOPIFY_CLIENT_SECRET,
    process.env.SHOPIFY_WEBHOOK_SECRET,
    process.env.SHOPIFY_API_SECRET,
    process.env.SHOPIFY_API_SECRET_KEY,
  ]
  for (const candidate of candidates) {
    const val = decryptShopifyToken(candidate)
    if (val) return val
  }
  return ''
}

export const verifyShopifyWebhookSignatureForDomain = async (
  rawBody: Buffer,
  receivedHmac: string | undefined,
  shopDomain: string,
  tx: any = db,
) => {
  const store = await getStoreByDomain(shopDomain, tx)
  if (!store) {
    const configured = getConfiguredShopifyCredentials()
    const fallbackSecret = String(
      process.env.SHOPIFY_CLIENT_SECRET || configured.webhookSecret || '',
    ).trim()
    if (fallbackSecret) {
      return verifyShopifyWebhookSignatureWithSecret(rawBody, receivedHmac, fallbackSecret)
    }
    return false
  }
  const secret = getStoreWebhookSecret(store)
  if (!secret) return false
  return verifyShopifyWebhookSignatureWithSecret(rawBody, receivedHmac, secret)
}

const buildShopifyOrderIdsForPayload = (store: ShopifyStore, orderIds: unknown[] = []) =>
  orderIds
    .map((orderId) => String(orderId || '').trim())
    .filter(Boolean)
    .flatMap((orderId) => [buildInternalOrderId(String(store.id), orderId), `shopify_${orderId}`])

const redactShopifyOrderCustomerData = async ({
  store,
  payload,
  scope,
  tx = db,
}: {
  store: ShopifyStore
  payload?: any
  scope: 'customer' | 'shop'
  tx?: any
}) => {
  const redactedAt = new Date()
  const ordersToRedact = Array.isArray(payload?.orders_to_redact)
    ? payload.orders_to_redact
    : Array.isArray(payload?.orders_requested)
      ? payload.orders_requested
      : []
  const orderIds = buildShopifyOrderIdsForPayload(store, ordersToRedact)
  const customerEmail = String(payload?.customer?.email || '').trim().toLowerCase()
  const customerPhone = String(payload?.customer?.phone || '').trim()

  const redactedFields = {
    buyer_name: 'Redacted Shopify customer',
    buyer_phone: '',
    buyer_email: null,
    address: 'Redacted by Shopify privacy request',
    city: 'Redacted',
    state: 'Redacted',
    pincode: '000000',
    tags: scope === 'shop' ? 'shopify,privacy_redacted,shop_redacted' : 'shopify,privacy_redacted',
    updated_at: redactedAt,
  }

  if (orderIds.length > 0) {
    await tx.update(b2c_orders).set(redactedFields).where(inArray(b2c_orders.order_id, orderIds))
  }

  if (scope === 'shop') {
    await tx
      .update(b2c_orders)
      .set(redactedFields)
      .where(sql`${b2c_orders.order_id} LIKE ${`shopify_${store.id}_%`}`)
    return
  }

  if (customerEmail || customerPhone) {
    await tx
      .update(b2c_orders)
      .set(redactedFields)
      .where(sql`
        ${b2c_orders.order_id} LIKE ${`shopify_${store.id}_%`}
        AND (
          ${customerEmail ? sql`lower(coalesce(${b2c_orders.buyer_email}, '')) = ${customerEmail}` : sql`false`}
          OR ${customerPhone ? sql`coalesce(${b2c_orders.buyer_phone}, '') = ${customerPhone}` : sql`false`}
        )
      `)
  }
}

const getShopifyDataRequestSummary = async ({
  store,
  payload,
  tx = db,
}: {
  store: ShopifyStore
  payload?: any
  tx?: any
}) => {
  const requestedOrderIds = Array.isArray(payload?.orders_requested) ? payload.orders_requested : []
  const orderIds = buildShopifyOrderIdsForPayload(store, requestedOrderIds)
  const customerEmail = String(payload?.customer?.email || '').trim().toLowerCase()
  const customerPhone = String(payload?.customer?.phone || '').trim()

  if (!orderIds.length && !customerEmail && !customerPhone) {
    return { matchingOrders: 0, requestedOrders: requestedOrderIds.length }
  }

  const rows = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(b2c_orders)
    .where(sql`
      ${b2c_orders.order_id} LIKE ${`shopify_${store.id}_%`}
      AND (
        ${orderIds.length ? sql`${b2c_orders.order_id} IN (${sql.join(orderIds.map((id) => sql`${id}`), sql`, `)})` : sql`false`}
        OR ${customerEmail ? sql`lower(coalesce(${b2c_orders.buyer_email}, '')) = ${customerEmail}` : sql`false`}
        OR ${customerPhone ? sql`coalesce(${b2c_orders.buyer_phone}, '') = ${customerPhone}` : sql`false`}
      )
    `)

  return {
    matchingOrders: Number(rows?.[0]?.count || 0),
    requestedOrders: requestedOrderIds.length,
  }
}

export const processShopifyComplianceWebhook = async (
  shopDomain: string,
  topic: string,
  payload: any,
  tx: any = db,
) => {
  const normalizedTopic = String(topic || '').toLowerCase()
  if (!SHOPIFY_COMPLIANCE_TOPICS.includes(normalizedTopic as any)) {
    return { success: true, action: 'ignored_topic' }
  }

  const store = await getStoreByDomain(shopDomain, tx)
  if (!store) {
    return { success: true, action: 'store_not_found', shopDomain: normalizeShopifyDomain(shopDomain) }
  }

  if (normalizedTopic === 'customers/data_request') {
    const summary = await getShopifyDataRequestSummary({ store, payload, tx })
    console.log('Shopify customer data request received', {
      shopDomain: normalizeShopifyDomain(shopDomain),
      storeId: store.id,
      dataRequestId: payload?.data_request?.id,
      customerId: payload?.customer?.id,
      ...summary,
    })
    return { success: true, action: 'data_request_logged', ...summary }
  }

  if (normalizedTopic === 'customers/redact') {
    await redactShopifyOrderCustomerData({ store, payload, scope: 'customer', tx })
    return { success: true, action: 'customer_data_redacted' }
  }

  if (normalizedTopic === 'shop/redact') {
    await redactShopifyOrderCustomerData({ store, payload, scope: 'shop', tx })
    await setUserChannelIntegration(store.userId, SHOPIFY_PLATFORM_ID, false, tx)
    await tx.delete(stores).where(eq(stores.id, store.id))
    return { success: true, action: 'shop_data_redacted' }
  }

  return { success: true, action: 'ignored_topic' }
}

export const processShopifyAppUninstalled = async (
  shopDomain: string,
  options: { triggeredAt?: string } = {},
  tx: any = db,
) => {
  const store = await getStoreByDomain(shopDomain, tx)
  if (!store) {
    return { success: true, action: 'store_not_found', shopDomain: normalizeShopifyDomain(shopDomain) }
  }

  const metadata = ((store as any).metadata || {}) as Record<string, any>
  const oauth = getStoreOAuthMetadata(store)
  const triggeredAtMs = options.triggeredAt ? new Date(options.triggeredAt).getTime() : 0
  const exchangedAtMs = oauth.exchangedAt ? new Date(oauth.exchangedAt).getTime() : 0
  if (
    Number.isFinite(triggeredAtMs) &&
    Number.isFinite(exchangedAtMs) &&
    triggeredAtMs > 0 &&
    exchangedAtMs > triggeredAtMs
  ) {
    return { success: true, action: 'stale_uninstall_ignored' }
  }

  await tx
    .update(stores)
    .set({
      adminApiAccessToken: '',
      metadata: {
        ...metadata,
        oauth: {
          ...oauth,
          active: false,
          refreshToken: null,
          refreshTokenExpiresAt: null,
          uninstalledAt: new Date().toISOString(),
        },
      },
      updatedAt: new Date(),
    })
    .where(eq(stores.id, store.id))
  await setUserChannelIntegration(store.userId, SHOPIFY_PLATFORM_ID, false, tx)

  return { success: true, action: 'store_marked_uninstalled' }
}

export const uninstallShopifyStoreForUser = async (
  userId: string,
  storeId: string,
  tx: any = db,
) => {
  const store = await getStoreForUser(userId, storeId, tx)
  if (!store) {
    const error: any = new Error('Connected Shopify store not found')
    error.statusCode = 404
    throw error
  }

  const data = await shopifyStoreGraphqlRequest<{
    appUninstall: {
      app?: { id?: string }
      userErrors: Array<{ field?: string[]; message: string }>
    }
  }>({
    store,
    tx,
    query: `
      mutation Kourier BoyzAppUninstall {
        appUninstall {
          app { id }
          userErrors { field message }
        }
      }
    `,
  })

  const userErrors = data?.appUninstall?.userErrors || []
  if (userErrors.length) {
    const error: any = new Error(
      `Shopify app uninstall failed: ${userErrors.map((item) => item.message).join('; ')}`,
    )
    error.statusCode = 409
    throw error
  }

  await processShopifyAppUninstalled(store.domain, {}, tx)
  return {
    success: true,
    action: 'app_uninstalled',
    shopDomain: normalizeShopifyDomain(store.domain),
    appId: data?.appUninstall?.app?.id || null,
  }
}

export const processShopifyWebhookOrder = async (
  shopDomain: string,
  topic: string,
  payload: any,
  tx: any = db,
) => {
  const store = await getStoreByDomain(shopDomain, tx)
  if (!store) {
    return { success: false, reason: 'store_not_found' }
  }
  const settings = normalizeShopifySettings((store as any)?.settings || {})
  const normalizedTopic = String(topic || '').toLowerCase()

  if (normalizedTopic.includes('orders/create') || normalizedTopic.includes('orders/updated')) {
    const action = await upsertFromShopifyOrder(store, payload, settings, tx)
    return { success: true, action }
  }

  if (normalizedTopic.includes('orders/cancelled')) {
    const internalOrderId = buildInternalOrderId(String(store.id), String(payload?.id || ''))
    const legacyOrderId = `shopify_${String(payload?.id || '')}`
    if (!payload?.id) return { success: false, reason: 'missing_order_id' }
    await tx
      .update(b2c_orders)
      .set({ order_status: 'cancelled', updated_at: new Date() })
      .where(eq(b2c_orders.order_id, internalOrderId))
    await tx
      .update(b2c_orders)
      .set({ order_status: 'cancelled', updated_at: new Date() })
      .where(eq(b2c_orders.order_id, legacyOrderId))
    return { success: true, action: 'cancelled' }
  }

  return { success: true, action: 'ignored_topic' }
}

const getShopifyOrderForStatusSync = async (store: ShopifyStore, shopifyOrderId: string) => {
  const data = await shopifyStoreGraphqlRequest<{
    order: {
      id: string
      tags: string[]
      cancelledAt?: string | null
      displayFulfillmentStatus?: string
      canMarkAsPaid?: boolean
      fulfillmentOrders: {
        nodes: Array<{ id: string; status: string; requestStatus?: string }>
      }
      fulfillments: Array<{
        id: string
        status?: string
        trackingInfo?: Array<{ company?: string | null; number?: string | null; url?: string | null }>
      }>
    } | null
  }>({
    store,
    query: `
      query Kourier BoyzOrderStatusSync($id: ID!) {
        order(id: $id) {
          id
          tags
          cancelledAt
          displayFulfillmentStatus
          canMarkAsPaid
          fulfillmentOrders(first: 50) {
            nodes {
              id
              status
              requestStatus
            }
          }
          fulfillments {
            id
            status
            trackingInfo {
              company
              number
              url
            }
          }
        }
      }
    `,
    variables: { id: toShopifyGid('Order', shopifyOrderId) },
  })

  return data?.order
}

const assertNoUserErrors = (operation: string, errors: Array<{ field?: string[]; message: string }> = []) => {
  if (!errors.length) return
  throw new Error(`${operation}: ${errors.map((err) => err.message).join('; ')}`)
}

const createShopifyFulfillment = async ({
  store,
  fulfillmentOrderIds,
  trackingNumber,
  courierPartner,
  notifyCustomer,
}: {
  store: ShopifyStore
  fulfillmentOrderIds: string[]
  trackingNumber?: string
  courierPartner?: string
  notifyCustomer: boolean
}) => {
  const fulfillment: any = {
    lineItemsByFulfillmentOrder: fulfillmentOrderIds.map((fulfillmentOrderId) => ({ fulfillmentOrderId })),
    notifyCustomer,
  }

  if (trackingNumber) {
    fulfillment.trackingInfo = {
      number: trackingNumber,
      company: String(courierPartner || 'Kourier Boyz').slice(0, 255),
      url: buildTrackingUrl(trackingNumber),
    }
  }

  const data = await shopifyStoreGraphqlRequest<{
    fulfillmentCreate: { userErrors: Array<{ field?: string[]; message: string }> }
  }>({
    store,
    query: `
      mutation Kourier BoyzFulfillmentCreate($fulfillment: FulfillmentInput!) {
        fulfillmentCreate(fulfillment: $fulfillment) {
          fulfillment { id status }
          userErrors { field message }
        }
      }
    `,
    variables: { fulfillment },
  })

  assertNoUserErrors('Shopify fulfillmentCreate failed', data?.fulfillmentCreate?.userErrors)
  return data?.fulfillmentCreate
}

const buildTrackingUrl = (trackingNumber: string) => {
  const awb = String(trackingNumber || '').trim()
  if (!awb) return undefined

  const frontendUrl = String(
      process.env.FRONTEND_URL ||
      process.env.CLIENT_URL ||
      process.env.APP_URL ||
      'https://seller.kourierboyz.com',
  )
    .trim()
    .replace(/\/+$/, '')

  return `${frontendUrl}/tracking?awb=${encodeURIComponent(awb)}`
}

const updateShopifyFulfillmentTracking = async ({
  store,
  fulfillmentId,
  trackingNumber,
  courierPartner,
  notifyCustomer,
}: {
  store: ShopifyStore
  fulfillmentId: string
  trackingNumber: string
  courierPartner?: string
  notifyCustomer: boolean
}) => {
  const data = await shopifyStoreGraphqlRequest<{
    fulfillmentTrackingInfoUpdate: { userErrors: Array<{ field?: string[]; message: string }> }
  }>({
    store,
    query: `
      mutation Kourier BoyzFulfillmentTrackingUpdate(
        $fulfillmentId: ID!,
        $trackingInfoInput: FulfillmentTrackingInput!,
        $notifyCustomer: Boolean
      ) {
        fulfillmentTrackingInfoUpdate(
          fulfillmentId: $fulfillmentId,
          trackingInfoInput: $trackingInfoInput,
          notifyCustomer: $notifyCustomer
        ) {
          fulfillment { id status }
          userErrors { field message }
        }
      }
    `,
    variables: {
      fulfillmentId,
      notifyCustomer,
      trackingInfoInput: {
        number: trackingNumber,
        company: String(courierPartner || 'Kourier Boyz').slice(0, 255),
        url: buildTrackingUrl(trackingNumber),
      },
    },
  })

  assertNoUserErrors(
    'Shopify fulfillmentTrackingInfoUpdate failed',
    data?.fulfillmentTrackingInfoUpdate?.userErrors,
  )
  return data?.fulfillmentTrackingInfoUpdate
}

const updateShopifyOrderTags = async (store: ShopifyStore, shopifyOrderId: string, tags: string[]) => {
  const data = await shopifyStoreGraphqlRequest<{
    orderUpdate: { userErrors: Array<{ field?: string[]; message: string }> }
  }>({
    store,
    query: `
      mutation Kourier BoyzOrderTagsUpdate($input: OrderInput!) {
        orderUpdate(input: $input) {
          order { id }
          userErrors { field message }
        }
      }
    `,
    variables: {
      input: {
        id: toShopifyGid('Order', shopifyOrderId),
        tags,
      },
    },
  })

  assertNoUserErrors('Shopify orderUpdate failed', data?.orderUpdate?.userErrors)
}

const cancelShopifyOrder = async (store: ShopifyStore, shopifyOrderId: string) => {
  const data = await shopifyStoreGraphqlRequest<{
    orderCancel: {
      orderCancelUserErrors?: Array<{ field?: string[]; message: string }>
      userErrors?: Array<{ field?: string[]; message: string }>
    }
  }>({
    store,
    query: `
      mutation Kourier BoyzOrderCancel(
        $orderId: ID!,
        $notifyCustomer: Boolean,
        $refundMethod: OrderCancelRefundMethodInput!,
        $restock: Boolean!,
        $reason: OrderCancelReason!,
        $staffNote: String
      ) {
        orderCancel(
          orderId: $orderId,
          notifyCustomer: $notifyCustomer,
          refundMethod: $refundMethod,
          restock: $restock,
          reason: $reason,
          staffNote: $staffNote
        ) {
          job { id done }
          orderCancelUserErrors { field message }
          userErrors { field message }
        }
      }
    `,
    variables: {
      orderId: toShopifyGid('Order', shopifyOrderId),
      notifyCustomer: false,
      refundMethod: { originalPaymentMethodsRefund: false },
      restock: false,
      reason: 'OTHER',
      staffNote: 'Cancelled from Kourier Boyz shipment status sync.',
    },
  })

  assertNoUserErrors(
    'Shopify orderCancel failed',
    data?.orderCancel?.orderCancelUserErrors || data?.orderCancel?.userErrors,
  )
}

const markShopifyOrderAsPaid = async (store: ShopifyStore, shopifyOrderId: string) => {
  const data = await shopifyStoreGraphqlRequest<{
    orderMarkAsPaid: { userErrors: Array<{ field?: string[]; message: string }> }
  }>({
    store,
    query: `
      mutation Kourier BoyzOrderMarkAsPaid($input: OrderMarkAsPaidInput!) {
        orderMarkAsPaid(input: $input) {
          order { id canMarkAsPaid displayFinancialStatus }
          userErrors { field message }
        }
      }
    `,
    variables: { input: { id: toShopifyGid('Order', shopifyOrderId) } },
  })

  assertNoUserErrors('Shopify orderMarkAsPaid failed', data?.orderMarkAsPaid?.userErrors)
}

export const syncShopifyStatusForLocalOrder = async (
  order: any,
  tx: any = db,
  options: { source?: string } = {},
) => {
  const localOrderId = String(order?.order_id || '')
  if (!localOrderId.startsWith('shopify_')) {
    return { attempted: false, success: true, channel: 'shopify', reason: 'not_a_shopify_order' }
  }

  const parsed = parseInternalShopifyOrderId(localOrderId)
  const shopifyOrderId = parsed.shopifyOrderId || ''
  if (!shopifyOrderId) {
    return { attempted: false, success: false, channel: 'shopify', reason: 'missing_shopify_order_id' }
  }

  const orderStatus = String(order?.order_status || '').toLowerCase()
  const trackingNumber = String(order?.awb_number || '').trim()

  const store = await getStoreForStatusSync(order.user_id, parsed.storeId, tx)
  if (!store) {
    await recordSalesChannelSyncOutcome(
      order,
      {
        channel: 'shopify',
        status: 'skipped',
        source: options.source,
        reason: 'store_not_found',
        syncedStatus: orderStatus,
        syncedAwb: trackingNumber,
      },
      tx,
    )
    return { attempted: false, success: true, channel: 'shopify', reason: 'store_not_found' }
  }

  const settings = normalizeShopifySettings((store as any)?.settings || {})
  const actions: string[] = []

  try {
    const remoteOrder = await getShopifyOrderForStatusSync(store, shopifyOrderId)
    if (!remoteOrder) {
      await recordSalesChannelSyncOutcome(
        order,
        {
          channel: 'shopify',
          status: 'failed',
          source: options.source,
          reason: 'remote_order_not_found',
        },
        tx,
      )
      return { attempted: true, success: false, channel: 'shopify', reason: 'remote_order_not_found' }
    }

    if (shouldAttemptFulfillment(orderStatus, settings?.fulfillTrigger)) {
      const isAlreadyFulfilled = String(remoteOrder.displayFulfillmentStatus || '').toUpperCase() === 'FULFILLED'
      const openFulfillmentOrders = (remoteOrder.fulfillmentOrders?.nodes || []).filter((fo: any) => {
        const foStatus = String(fo?.status || '').toUpperCase()
        const reqStatus = String(fo?.requestStatus || '').toUpperCase()
        return ['OPEN', 'SCHEDULED'].includes(foStatus) && (!reqStatus || reqStatus === 'UNSUBMITTED')
      })

      if (!isAlreadyFulfilled && openFulfillmentOrders.length) {
        await createShopifyFulfillment({
          store,
          fulfillmentOrderIds: openFulfillmentOrders.map((fo: any) => fo.id),
          trackingNumber,
          courierPartner: order?.courier_partner,
          notifyCustomer: shouldNotifyCustomerOnFulfill(settings),
        })
        actions.push('fulfillment_created')
      } else if (trackingNumber) {
        const fulfillments = remoteOrder.fulfillments || []
        const fulfillmentWithCurrentTracking = fulfillments.find((fulfillment: any) =>
          (fulfillment?.trackingInfo || []).some(
            (tracking: any) => String(tracking?.number || '').trim() === trackingNumber,
          ),
        )
        const targetFulfillment =
          fulfillmentWithCurrentTracking ||
          fulfillments.find((fulfillment: any) =>
            ['SUCCESS', 'OPEN', 'PENDING'].includes(String(fulfillment?.status || '').toUpperCase()),
          ) ||
          fulfillments[0]

        if (fulfillmentWithCurrentTracking) {
          actions.push('tracking_already_current')
        } else if (targetFulfillment?.id) {
          await updateShopifyFulfillmentTracking({
            store,
            fulfillmentId: targetFulfillment.id,
            trackingNumber,
            courierPartner: order?.courier_partner,
            notifyCustomer: shouldNotifyCustomerOnFulfill(settings),
          })
          actions.push('tracking_updated')
        } else {
          actions.push(isAlreadyFulfilled ? 'already_fulfilled_no_tracking_target' : 'no_open_fulfillment_orders')
        }
      } else {
        actions.push(isAlreadyFulfilled ? 'already_fulfilled' : 'no_tracking_number')
      }
    } else {
      actions.push('fulfillment_skipped_by_settings')
    }

    if (settings?.autoUpdateShipmentStatus) {
      const cleanTags = (Array.isArray(remoteOrder.tags) ? remoteOrder.tags : String(order?.tags || '').split(','))
        .map((t: string) => String(t || '').trim())
        .filter(Boolean)
        .filter((t: string) => !/^(mcw_status|dg_status):/i.test(t))
      cleanTags.push(`dg_status:${orderStatus}`)
      await updateShopifyOrderTags(store, shopifyOrderId, cleanTags)
      actions.push('status_tag_updated')
    } else {
      actions.push('status_tag_skipped_by_settings')
    }

    if (settings?.autoCancelOrders && orderStatus === 'cancelled' && !remoteOrder.cancelledAt) {
      await cancelShopifyOrder(store, shopifyOrderId)
      actions.push('order_cancelled')
    }

    if (
      settings?.markCodPaidOnDelivery &&
      String(order?.order_type || '').toLowerCase() === 'cod' &&
      orderStatus === 'delivered' &&
      remoteOrder.canMarkAsPaid
    ) {
      await markShopifyOrderAsPaid(store, shopifyOrderId)
      actions.push('cod_marked_paid')
    }

    await recordSalesChannelSyncOutcome(
      order,
      {
        channel: 'shopify',
        status: 'success',
        source: options.source,
        actions,
        syncedStatus: orderStatus,
        syncedAwb: trackingNumber,
      },
      tx,
    )

    return { attempted: true, success: true, channel: 'shopify', actions }
  } catch (err: any) {
    if (err instanceof ShopifyReconnectRequiredError) {
      await recordSalesChannelSyncOutcome(
        order,
        {
          channel: 'shopify',
          status: 'skipped',
          source: options.source,
          actions,
          reason: 'shopify_reconnect_required',
          syncedStatus: orderStatus,
          syncedAwb: trackingNumber,
        },
        tx,
      )
      return {
        attempted: false,
        success: false,
        channel: 'shopify',
        actions,
        reason: 'shopify_reconnect_required',
      }
    }

    await recordSalesChannelSyncOutcome(
      order,
      {
        channel: 'shopify',
        status: 'failed',
        source: options.source,
        actions,
        error: err,
        syncedStatus: orderStatus,
        syncedAwb: trackingNumber,
      },
      tx,
    )
    console.warn(
      `Shopify status sync failed for local order ${order?.order_number || order?.id}:`,
      err?.response?.data || err?.message || err,
    )
    return {
      attempted: true,
      success: false,
      channel: 'shopify',
      actions,
      error: err?.response?.data || err?.message || err,
    }
  }
}
