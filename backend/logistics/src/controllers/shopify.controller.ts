import { Request, Response } from 'express'
import { eq } from 'drizzle-orm'
import { db } from '../models/client'
import { users } from '../models/schema/users'
import {
  SHOPIFY_API_VERSION,
  buildShopifyOAuthAuthorizeUrl,
  completeShopifyManagedInstall,
  completeShopifyOAuthInstall,
  connectShopifyStore,
  createShopifyInstallBootstrap,
  getConfiguredShopifyCredentials,
  getShopifyOAuthConfig,
  getShopifyComplianceWebhookAddress,
  getShopifyWebhookAddress,
  processShopifyComplianceWebhook,
  processShopifyAppUninstalled,
  processShopifyWebhookOrder,
  probeShopifyStore,
  normalizeShopifyDomain,
  verifyShopifyInstallBootstrap,
  syncShopifyOrdersForUser,
  uninstallShopifyStoreForUser,
  updateShopifyStoreSettingsForUser,
  isValidShopifyDomain,
  verifyShopifyOAuthQueryHmac,
  verifyShopifyWebhookSignatureForDomain,
} from '../models/services/shopify.service'
import {
  findUserById,
  saveRefreshToken,
} from '../models/services/userService'
import { signAccessToken, signRefreshToken } from '../utils/jwt'
import { logShopifyInstallEvent } from '../models/services/shopifyInstallAudit.service'

const SHOPIFY_FRONTEND_AUDIT_EVENTS = new Set([
  'install_page_opened',
  'app_bridge_started',
  'id_token_acquired',
  'session_exchange_started',
  'bootstrap_exchange_started',
  'install_ui_completed',
  'install_ui_failed',
])
const shopifyAuditRateLimits = new Map<string, { count: number; resetAt: number }>()

const ensureCanConnectForUser = async (actorUserId: string, targetUserId: string) => {
  if (actorUserId === targetUserId) return true

  const [actor] = await db.select({ role: users.role }).from(users).where(eq(users.id, actorUserId)).limit(1)
  return actor?.role === 'admin'
}

const getShopifyAdminStatusPayload = () => {
  const configured = getConfiguredShopifyCredentials()
  const oauthConfig = getShopifyOAuthConfig()
  const webhookUrl = getShopifyWebhookAddress()

  return {
    configured: configured.configured,
    oauthConfigured: oauthConfig.configured,
    store: configured.storeUrl || null,
    apiVersion: SHOPIFY_API_VERSION,
    oauthRedirectUri: oauthConfig.redirectUri || null,
    webhookUrl,
    complianceWebhookUrl: getShopifyComplianceWebhookAddress(),
    webhookPublic: /^https:\/\//i.test(webhookUrl) && !/localhost|127\.0\.0\.1/i.test(webhookUrl),
    hasAccessToken: Boolean(configured.adminApiAccessToken),
    hasWebhookSecret: Boolean(configured.webhookSecret),
    requiredScopes: oauthConfig.scopes,
    protectedCustomerData: {
      required: true,
      fields: ['name', 'email', 'phone', 'shipping_address', 'billing_address'],
      note:
        'Shopify only returns buyer name, phone, email, and addresses after the app is granted protected customer data access for these fields.',
    },
  }
}

const buildShopifyOAuthFrontendRedirect = ({
  status,
  shop,
  host,
  message,
  returnTo,
}: {
  status: 'connected' | 'error'
  shop?: string
  host?: string
  message?: string
  returnTo?: string
}) => {
  const config = getShopifyOAuthConfig()
  const fallbackUrl = config.frontendUrl || 'http://localhost:5173/channels/connected'
  const target = String(returnTo || '').trim()
  let url: URL

  try {
    const fallback = new URL(fallbackUrl)
    if (target.startsWith('/')) {
      url = new URL(target, fallback.origin)
    } else if (target) {
      const requested = new URL(target)
      url = requested.origin === fallback.origin ? requested : fallback
    } else {
      url = fallback
    }
  } catch {
    url = new URL('http://localhost:5173/channels/connected')
  }

  url.searchParams.set('shopify', status)
  if (shop) url.searchParams.set('shop', shop)
  if (host) url.searchParams.set('host', host)
  if (message) url.searchParams.set('message', message)
  return url.toString()
}

const escapeHtmlAttribute = (value: string) =>
  value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }
    return entities[character]
  })

const sendTopLevelShopifyRedirect = (res: Response, redirectUrl: string) => {
  const serializedUrl = JSON.stringify(redirectUrl).replace(/</g, '\\u003c')
  const escapedUrl = escapeHtmlAttribute(redirectUrl)

  return res
    .status(200)
    .set({
      'Cache-Control': 'no-store, max-age=0',
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'",
    })
    .send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Returning to Kourier Boyz</title>
    <style>
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; font-family: Arial, sans-serif; background: #111318; color: #f7f7f7; }
      a { color: #72d63c; }
    </style>
  </head>
  <body>
    <p>Returning to <a href="${escapedUrl}" target="_top">Kourier Boyz</a>...</p>
    <script>
      (function () {
        var target = ${serializedUrl};
        try {
          if (window.top) {
            window.top.location.replace(target);
            return;
          }
        } catch (error) {
          window.open(target, '_top');
          return;
        }
        window.location.replace(target);
      })();
    </script>
  </body>
</html>`)
}

const buildShopifyInstallLandingUrl = (query: Record<string, string> = {}) => {
  const config = getShopifyOAuthConfig()
  const fallback = new URL(config.frontendUrl || 'http://localhost:5173/channels/connected')
  const url = new URL('/shopify/install', fallback.origin)

  Object.entries(query).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value)
  })

  return url.toString()
}

export const shopifyOAuthInstallController = async (req: Request, res: Response): Promise<any> => {
  const shop = normalizeShopifyDomain(String(req.query?.shop || ''))
  const requestId = String((req as any).requestId || '')
  void logShopifyInstallEvent({ event: 'install_request', status: 'started', requestId, shop })

  try {
    if (!isValidShopifyDomain(shop)) {
      throw new Error('Invalid Shopify shop domain')
    }

    if (req.query?.hmac && !verifyShopifyOAuthQueryHmac(req.query as Record<string, any>)) {
      throw new Error('Invalid Shopify install request')
    }

    void logShopifyInstallEvent({ event: 'install_request', status: 'passed', requestId, shop })

    return res.redirect(
      302,
      buildShopifyInstallLandingUrl({
        shopifyInstall: '1',
        shop,
        host: String(req.query?.host || ''),
      }),
    )
  } catch (error: any) {
    void logShopifyInstallEvent({
      event: 'install_request',
      status: 'failed',
      requestId,
      shop,
      detail: error?.message,
    })
    const redirectUrl = buildShopifyOAuthFrontendRedirect({
      status: 'error',
      shop: isValidShopifyDomain(shop) ? shop : undefined,
      host: String(req.query?.host || ''),
      message: error?.message || 'Shopify install could not be started',
      returnTo: '/shopify/install',
    })
    return res.redirect(302, redirectUrl)
  }
}

export const startShopifyOAuthController = async (req: any, res: Response): Promise<any> => {
  try {
    const userId = req.user?.sub
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' })

    const requestedUserId = String(req.body?.userId || req.body?.targetUserId || '').trim()
    const targetUserId = requestedUserId || userId
    const canConnect = await ensureCanConnectForUser(userId, targetUserId)
    if (!canConnect) {
      return res.status(403).json({ success: false, error: 'Admin access is required to bind another user' })
    }

    const shop = String(req.body?.shop || req.body?.storeUrl || req.query?.shop || '').trim()
    const returnTo = String(req.body?.returnTo || req.query?.returnTo || '/channels/connected').trim()
    const result = buildShopifyOAuthAuthorizeUrl({ shop, userId: targetUserId, returnTo })

    return res.status(200).json({
      success: true,
      message: 'Shopify OAuth authorization URL created',
      data: result,
      authUrl: result.authUrl,
    })
  } catch (error: any) {
    return res.status(error?.statusCode || 400).json({
      success: false,
      error: error?.message || 'Failed to start Shopify OAuth',
    })
  }
}

export const publicStartShopifyOAuthController = async (req: Request, res: Response): Promise<any> => {
  try {
    const shop = String(req.body?.shop || req.query?.shop || '').trim()
    const returnTo = String(req.body?.returnTo || req.query?.returnTo || '/shopify/install?next=/channels/connected').trim()
    const result = buildShopifyOAuthAuthorizeUrl({
      shop,
      returnTo,
      publicInstall: true,
    })

    return res.status(200).json({
      success: true,
      message: 'Shopify OAuth authorization URL created',
      data: result,
      authUrl: result.authUrl,
    })
  } catch (error: any) {
    return res.status(error?.statusCode || 400).json({
      success: false,
      error: error?.message || 'Failed to start Shopify OAuth',
    })
  }
}

export const exchangeShopifyBootstrapController = async (req: Request, res: Response): Promise<any> => {
  const requestId = String((req as any).requestId || '')
  try {
    void logShopifyInstallEvent({ event: 'bootstrap_exchange', status: 'started', requestId })
    const bootstrap = String(req.body?.bootstrap || req.query?.bootstrap || '').trim()
    if (!bootstrap) {
      void logShopifyInstallEvent({
        event: 'bootstrap_exchange',
        status: 'failed',
        requestId,
        httpStatus: 400,
        detail: 'missing_bootstrap_token',
      })
      return res.status(400).json({ success: false, error: 'Shopify bootstrap token is required' })
    }

    const payload = verifyShopifyInstallBootstrap(bootstrap)
    const user = await findUserById(payload.userId)
    if (!user) {
      return res.status(404).json({ success: false, error: 'Shopify bootstrap merchant account not found' })
    }

    const accessToken = signAccessToken(user.id, user.role ?? 'customer')
    const { token: refreshToken } = signRefreshToken(user.id, user.role ?? 'customer')

    await saveRefreshToken(user.id, refreshToken, 7 * 24 * 60 * 60 * 1000)
    void logShopifyInstallEvent({
      event: 'bootstrap_exchange',
      status: 'passed',
      requestId,
      shop: payload.shop,
    })

    return res.status(200).json({
      success: true,
      message: 'Shopify bootstrap exchanged successfully',
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        onboardingComplete: user.onboardingComplete,
      },
      shop: payload.shop,
      returnTo: payload.returnTo || '/channels/connected',
    })
  } catch (error: any) {
    void logShopifyInstallEvent({
      event: 'bootstrap_exchange',
      status: 'failed',
      requestId,
      detail: error?.message,
    })
    console.error('Shopify bootstrap exchange failed:', error?.message || error)
    return res.status(400).json({
      success: false,
      error: error?.message || 'Failed to exchange Shopify bootstrap token',
    })
  }
}

export const exchangeShopifySessionController = async (req: Request, res: Response): Promise<any> => {
  const requestId = String((req as any).requestId || '')
  const startedAt = Date.now()
  try {
    void logShopifyInstallEvent({ event: 'managed_install', status: 'started', requestId })
    const authorization = String(req.headers.authorization || '')
    const sessionToken = authorization.replace(/^Bearer\s+/i, '').trim()
    if (!sessionToken) {
      void logShopifyInstallEvent({
        event: 'managed_install',
        status: 'failed',
        requestId,
        durationMs: Date.now() - startedAt,
        httpStatus: 401,
        detail: 'missing_session_token',
      })
      return res.status(401).json({ success: false, error: 'Shopify session token is required' })
    }

    const result = await completeShopifyManagedInstall(sessionToken, { requestId })
    void logShopifyInstallEvent({
      event: 'managed_install',
      status: 'passed',
      requestId,
      shop: result.shop,
      durationMs: Date.now() - startedAt,
    })
    return res.status(200).json({
      success: true,
      message: 'Shopify managed install completed successfully',
      shop: result.shop,
      bootstrap: result.bootstrap,
    })
  } catch (error: any) {
    void logShopifyInstallEvent({
      event: 'managed_install',
      status: 'failed',
      requestId,
      durationMs: Date.now() - startedAt,
      httpStatus: error?.response?.status,
      detail: error?.message,
    })
    console.error('Shopify managed install failed:', error?.response?.data || error?.message || error)
    return res.status(error?.response?.status === 401 ? 401 : 400).json({
      success: false,
      error: error?.message || 'Failed to complete Shopify managed install',
    })
  }
}

export const shopifyInstallAuditController = async (req: Request, res: Response): Promise<any> => {
  const event = String(req.body?.event || '').trim()
  const shop = normalizeShopifyDomain(String(req.body?.shop || ''))
  if (!SHOPIFY_FRONTEND_AUDIT_EVENTS.has(event) || !isValidShopifyDomain(shop)) {
    return res.status(400).json({ success: false, error: 'Invalid Shopify install audit event' })
  }

  const key = String(req.ip || req.socket.remoteAddress || 'unknown')
  const now = Date.now()
  const current = shopifyAuditRateLimits.get(key)
  const rate = !current || current.resetAt <= now ? { count: 1, resetAt: now + 60_000 } : current
  if (current && current.resetAt > now) rate.count += 1
  shopifyAuditRateLimits.set(key, rate)
  if (shopifyAuditRateLimits.size > 1000) shopifyAuditRateLimits.clear()
  if (rate.count > 60) return res.status(429).json({ success: false, error: 'Too many audit events' })

  await logShopifyInstallEvent({
    event,
    status: event.endsWith('_failed') ? 'failed' : event.endsWith('_completed') ? 'passed' : 'info',
    requestId: String((req as any).requestId || ''),
    shop,
    source: 'frontend',
    detail: String(req.body?.detail || ''),
  })
  return res.status(204).send()
}

export const shopifyOAuthCallbackController = async (req: Request, res: Response): Promise<any> => {
  const requestId = String((req as any).requestId || '')
  try {
    const result = await completeShopifyOAuthInstall(req.query as Record<string, any>)
    const redirectUrl = result.isPublicBootstrap
      ? buildShopifyOAuthFrontendRedirect({
          status: 'connected',
          shop: result.shop,
          message: result.warning || 'Shopify connected successfully',
          returnTo: `/shopify/install?bootstrap=${encodeURIComponent(result.bootstrap || '')}&next=/channels/connected`,
        })
      : buildShopifyOAuthFrontendRedirect({
          status: 'connected',
          shop: result.shop,
          message: result.warning || 'Shopify connected successfully',
          returnTo: result.returnTo,
        })
    void logShopifyInstallEvent({
      event: 'oauth_callback',
      status: 'passed',
      requestId,
      shop: result.shop,
      source: 'backend',
      detail: result.isPublicBootstrap ? 'public_install_redirect' : 'linked_install_top_level_redirect',
    })

    return result.isPublicBootstrap
      ? res.redirect(302, redirectUrl)
      : sendTopLevelShopifyRedirect(res, redirectUrl)
  } catch (error: any) {
    void logShopifyInstallEvent({
      event: 'oauth_callback',
      status: 'failed',
      requestId,
      shop: normalizeShopifyDomain(String(req.query?.shop || '')) || undefined,
      source: 'backend',
      detail: error?.message,
    })
    console.error('Shopify OAuth callback failed:', error?.response?.data || error?.message || error)
    const redirectUrl = buildShopifyOAuthFrontendRedirect({
      status: 'error',
      shop: normalizeShopifyDomain(String(req.query?.shop || '')) || undefined,
      host: String(req.query?.host || ''),
      message: error?.message || 'Shopify OAuth failed',
      returnTo: '/shopify/install',
    })
    return res.redirect(302, redirectUrl)
  }
}

export const testShopifyConnectionController = async (_req: any, res: Response): Promise<any> => {
  const status = getShopifyAdminStatusPayload()

  try {
    const configured = getConfiguredShopifyCredentials()
    if (!configured.storeUrl || !configured.adminApiAccessToken) {
      return res.status(200).json({
        success: true,
        data: {
          ...status,
          connected: false,
          message: 'Shopify environment variables are not fully configured',
        },
      })
    }

    const shop = await probeShopifyStore(configured.storeUrl, configured.adminApiAccessToken)
    return res.status(200).json({
      success: true,
      data: {
        ...status,
        connected: true,
        shop: {
          id: shop.id,
          name: shop.name,
          domain: shop.domain,
          currency: shop.currency,
          timezone: shop.timezone,
          email: shop.email,
        },
      },
    })
  } catch (error: any) {
    console.error('Shopify connection test failed:', error?.response?.data || error?.message || error)
    return res.status(502).json({
      success: false,
      data: {
        ...status,
        connected: false,
      },
      error: error?.message || 'Failed to connect to Shopify Admin API',
    })
  }
}

export const connectConfiguredShopifyStoreController = async (req: any, res: Response): Promise<any> => {
  if (String(process.env.SHOPIFY_ALLOW_LEGACY_MANUAL_AUTH || '').toLowerCase() !== 'true') {
    return res.status(410).json({
      success: false,
      error: 'Configured Shopify custom app connection is no longer supported. Connect Shopify through OAuth.',
      migrationPath: '/api/integrations/shopify/oauth/start',
    })
  }

  try {
    const actorUserId = req.user?.sub
    if (!actorUserId) return res.status(401).json({ success: false, error: 'Unauthorized' })

    const requestedUserId = String(req.body?.userId || req.body?.targetUserId || '').trim()
    const targetUserId = requestedUserId || actorUserId
    const canConnect = await ensureCanConnectForUser(actorUserId, targetUserId)
    if (!canConnect) {
      return res.status(403).json({ success: false, error: 'Admin access is required to bind another user' })
    }

    const configured = getConfiguredShopifyCredentials()
    if (!configured.storeUrl || !configured.adminApiAccessToken || !configured.webhookSecret) {
      return res.status(400).json({
        success: false,
        error: 'Shopify environment variables are not fully configured',
        data: getShopifyAdminStatusPayload(),
      })
    }

    const settings =
      req.body?.settings && typeof req.body.settings === 'object' && !Array.isArray(req.body.settings)
        ? req.body.settings
        : {}

    const result = await connectShopifyStore({
      storeUrl: configured.storeUrl,
      adminApiAccessToken: configured.adminApiAccessToken,
      apiSecretKey: configured.apiSecretKey,
      webhookSecret: configured.webhookSecret,
      userId: targetUserId,
      settings,
    })

    return res.status(200).json({
      success: true,
      message: 'Shopify custom app connected successfully',
      data: {
        store: {
          id: result.store?.id,
          name: result.store?.name,
          domain: result.store?.domain,
          userId: result.store?.userId,
        },
        shop: {
          id: result.shopifyData.id,
          name: result.shopifyData.name,
          domain: result.shopifyData.domain,
          currency: result.shopifyData.currency,
          timezone: result.shopifyData.timezone,
        },
        webhooks: result.webhooks,
        warning: result.warning,
        status: getShopifyAdminStatusPayload(),
      },
    })
  } catch (error: any) {
    console.error('Shopify env store connection failed:', error?.response?.data || error?.message || error)
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to connect configured Shopify store',
    })
  }
}

export const syncShopifyOrdersController = async (req: any, res: Response): Promise<any> => {
  try {
    const userId = req.user?.sub
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })

    const rawLimit = Number(req.body?.limit ?? req.query?.limit ?? 50)
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 250) : 50
    const storeId = String(req.body?.storeId ?? req.query?.storeId ?? '').trim() || undefined

    const result = await syncShopifyOrdersForUser(userId, limit, storeId)
    return res.status(200).json({
      success: true,
      message: 'Shopify orders synced successfully',
      ...result,
    })
  } catch (error: any) {
    console.error('Shopify sync failed:', error)
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to sync Shopify orders',
    })
  }
}

export const updateShopifySettingsController = async (req: any, res: Response): Promise<any> => {
  try {
    const userId = req.user?.sub
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })

    const settings =
      req.body?.settings && typeof req.body.settings === 'object' && !Array.isArray(req.body.settings)
        ? req.body.settings
        : null
    if (!settings) {
      return res.status(400).json({ success: false, error: 'Shopify settings payload is required' })
    }

    const storeId = String(req.body?.storeId || req.body?.id || '').trim() || undefined
    const result = await updateShopifyStoreSettingsForUser({ userId, storeId, settings })
    return res.status(200).json({
      success: true,
      message: result.warning ? 'Shopify settings saved with warning' : 'Shopify settings saved successfully',
      store: result.store,
      warning: result.warning,
    })
  } catch (error: any) {
    console.error('Shopify settings update failed:', error)
    return res.status(error?.statusCode || 500).json({
      success: false,
      error: error?.message || 'Failed to update Shopify settings',
    })
  }
}

export const uninstallShopifyStoreController = async (req: any, res: Response): Promise<any> => {
  const requestId = String(req.requestId || '')
  const userId = String(req.user?.sub || '').trim()
  const storeId = String(req.params?.storeId || '').trim()

  if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' })
  if (!storeId) return res.status(400).json({ success: false, error: 'Shopify store ID is required' })

  void logShopifyInstallEvent({
    event: 'app_uninstall_requested',
    status: 'started',
    requestId,
  })

  try {
    const result = await uninstallShopifyStoreForUser(userId, storeId)
    void logShopifyInstallEvent({
      event: 'app_uninstall_requested',
      status: 'passed',
      requestId,
      shop: result.shopDomain,
    })
    return res.status(200).json({
      success: true,
      message: 'Kourier Boyz was removed from Shopify successfully',
      result,
    })
  } catch (error: any) {
    void logShopifyInstallEvent({
      event: 'app_uninstall_requested',
      status: 'failed',
      requestId,
      detail: error?.message,
      httpStatus: error?.statusCode || error?.response?.status,
    })
    console.error('Shopify app uninstall failed:', error?.response?.data || error?.message || error)
    return res.status(error?.statusCode || 502).json({
      success: false,
      error: error?.message || 'Failed to remove Kourier Boyz from Shopify',
    })
  }
}

export const shopifyOrderWebhookController = async (req: Request, res: Response): Promise<any> => {
  try {
    const rawBody: Buffer = req.body as Buffer
    const hmac = String(req.headers['x-shopify-hmac-sha256'] || '')
    const topic = String(req.headers['x-shopify-topic'] || '')
    const shopDomain = String(req.headers['x-shopify-shop-domain'] || '')

    if (!rawBody || !Buffer.isBuffer(rawBody)) {
      return res.status(400).json({ success: false, error: 'Invalid webhook payload' })
    }

    const isValid = await verifyShopifyWebhookSignatureForDomain(rawBody, hmac, shopDomain)
    if (!isValid) {
      return res.status(401).json({ success: false, error: 'Invalid Shopify webhook signature' })
    }

    const payload = JSON.parse(rawBody.toString('utf8') || '{}')
    const result = await processShopifyWebhookOrder(shopDomain, topic, payload)
    return res.status(200).json({ success: true, result })
  } catch (error: any) {
    console.error('Shopify webhook handling failed:', error)
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to process Shopify webhook',
    })
  }
}

export const shopifyComplianceWebhookController = async (req: Request, res: Response): Promise<any> => {
  try {
    const rawBody: Buffer = req.body as Buffer
    const hmac = String(req.headers['x-shopify-hmac-sha256'] || '')
    const topic = String(req.headers['x-shopify-topic'] || '')
    const shopDomain = String(req.headers['x-shopify-shop-domain'] || '')

    if (!rawBody || !Buffer.isBuffer(rawBody)) {
      return res.status(400).json({ success: false, error: 'Invalid webhook payload' })
    }

    const isValid = await verifyShopifyWebhookSignatureForDomain(rawBody, hmac, shopDomain)
    if (!isValid) {
      return res.status(401).json({ success: false, error: 'Invalid Shopify webhook signature' })
    }

    const payload = JSON.parse(rawBody.toString('utf8') || '{}')
    const result = await processShopifyComplianceWebhook(shopDomain, topic, payload)
    return res.status(200).json({ success: true, result })
  } catch (error: any) {
    console.error('Shopify compliance webhook handling failed:', error)
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to process Shopify compliance webhook',
    })
  }
}

export const shopifyAppUninstalledWebhookController = async (req: Request, res: Response): Promise<any> => {
  const requestId = String((req as any).requestId || '')
  const shopDomain = String(req.headers['x-shopify-shop-domain'] || '')
  try {
    const rawBody: Buffer = req.body as Buffer
    const hmac = String(req.headers['x-shopify-hmac-sha256'] || '')
    const topic = String(req.headers['x-shopify-topic'] || '').trim().toLowerCase()
    const triggeredAt = String(req.headers['x-shopify-triggered-at'] || '').trim()

    if (!rawBody || !Buffer.isBuffer(rawBody)) {
      void logShopifyInstallEvent({
        event: 'app_uninstalled',
        status: 'failed',
        requestId,
        shop: normalizeShopifyDomain(shopDomain),
        source: 'webhook',
        httpStatus: 400,
        detail: 'invalid_payload',
      })
      return res.status(400).json({ success: false, error: 'Invalid webhook payload' })
    }

    const isValid = await verifyShopifyWebhookSignatureForDomain(rawBody, hmac, shopDomain)
    if (!isValid) {
      void logShopifyInstallEvent({
        event: 'app_uninstalled',
        status: 'failed',
        requestId,
        shop: normalizeShopifyDomain(shopDomain),
        source: 'webhook',
        httpStatus: 401,
        detail: 'invalid_signature',
      })
      return res.status(401).json({ success: false, error: 'Invalid Shopify webhook signature' })
    }

    if (topic !== 'app/uninstalled') {
      return res.status(200).json({ success: true, result: { action: 'ignored_topic' } })
    }

    const result = await processShopifyAppUninstalled(shopDomain, { triggeredAt })
    void logShopifyInstallEvent({
      event: 'app_uninstalled',
      status: 'passed',
      requestId,
      shop: normalizeShopifyDomain(shopDomain),
      source: 'webhook',
      detail: result.action,
    })
    return res.status(200).json({ success: true, result })
  } catch (error: any) {
    void logShopifyInstallEvent({
      event: 'app_uninstalled',
      status: 'failed',
      requestId,
      shop: normalizeShopifyDomain(shopDomain),
      source: 'webhook',
      httpStatus: error?.statusCode || error?.response?.status || 500,
      detail: error?.message,
    })
    console.error('Shopify uninstall webhook handling failed:', error?.message || error)
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to process Shopify uninstall webhook',
    })
  }
}
