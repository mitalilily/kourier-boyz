import axios from 'axios'
import * as crypto from 'crypto'
import { and, eq, like } from 'drizzle-orm'
import { db } from '../client'
import { b2c_orders } from '../schema/b2cOrders'
import { stores } from '../schema/stores'
import {
  getCourierProviderDisplayName,
  getProviderMetaCourierName,
  resolveCourierProviderKeyFromFields,
} from '../../utils/courierProvider'
import { recordSalesChannelSyncOutcome } from './salesChannelSyncAudit.service'
import { ensurePlatformRegistration, updateUserChannelIntegration } from './userService'

const WOOCOMMERCE_PLATFORM_ID = 2
const WOOCOMMERCE_PLATFORM = {
  id: WOOCOMMERCE_PLATFORM_ID,
  name: 'WooCommerce',
  slug: 'woocommerce',
} as const
const WOOCOMMERCE_API_TIMEOUT_MS = Number(process.env.PLATFORM_API_TIMEOUT_MS || 15000)
const WOOCOMMERCE_WEBHOOK_TOPICS = ['order.created', 'order.updated', 'order.deleted'] as const

type WooCommerceStore = typeof stores.$inferSelect

type SyncResult = {
  created: number
  updated: number
  skipped: number
}

type ExistingOrderSyncResult = SyncResult & {
  checked: number
  failed: number
}

const DEFAULT_WOOCOMMERCE_SYNC_SETTINGS = {
  autoUpdateStatus: true,
  autoUpdateShipmentStatus: true,
  markCodPaid: false,
  historicalTerminalSyncDays: 10,
}

const normalizeWooHistoricalImportDays = (value: unknown) => {
  const rawDays = Number(value)
  if (!Number.isFinite(rawDays)) return DEFAULT_WOOCOMMERCE_SYNC_SETTINGS.historicalTerminalSyncDays

  return Math.min(Math.max(Math.trunc(rawDays), 1), 3650)
}

const normalizeWooCommerceSettings = (settings?: Record<string, any> | null) => {
  const rawSettings =
    settings && typeof settings === 'object' && !Array.isArray(settings) ? settings : {}

  return {
    ...DEFAULT_WOOCOMMERCE_SYNC_SETTINGS,
    ...rawSettings,
    historicalTerminalSyncDays: normalizeWooHistoricalImportDays(
      (rawSettings as Record<string, any>).historicalTerminalSyncDays,
    ),
  }
}

const toNumber = (value: unknown, fallback = 0): number => {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const sanitizeStoreName = (name: unknown, storeUrl: string) => {
  const fallback = new URL(normalizeWooCommerceUrl(storeUrl)).hostname || 'WooCommerce Store'
  return String(name || fallback || 'WooCommerce Store').trim().slice(0, 255)
}

export const normalizeWooCommerceUrl = (value: string) => {
  const raw = String(value || '').trim()
  if (!raw) return ''
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
  return withProtocol.replace(/\/+$/, '')
}

const getWooApiBase = (storeUrl: string) => `${normalizeWooCommerceUrl(storeUrl)}/wp-json/wc/v3`

const generateWooStoreId = (userId: string, storeUrl: string) => {
  const hash = crypto
    .createHash('sha1')
    .update(`${userId}:${normalizeWooCommerceUrl(storeUrl).toLowerCase()}`)
    .digest('hex')
    .slice(0, 32)
  return `woo_${hash}`
}

const buildInternalWooOrderId = (storeId: string, wooOrderId: string | number) =>
  `woo_${String(storeId || '').trim()}_${String(wooOrderId || '').trim()}`.slice(0, 100)

const buildWooCommerceOrderNumber = (orderNumber: string | number) =>
  String(orderNumber || '').trim().slice(0, 50)

const parseInternalWooOrderId = (localOrderId: string) => {
  const match = String(localOrderId || '').match(/^woo_(woo_[a-f0-9]{32})_(.+)$/i)
  if (!match) return {}
  return { storeId: match[1], wooOrderId: match[2] }
}

const getWebhookAddress = () => {
  const baseUrl = String(process.env.API_URL || '').trim().replace(/\/+$/, '')
  if (!baseUrl) {
    throw new Error('API_URL is not configured for WooCommerce webhook registration')
  }
  return `${baseUrl}/api/webhook/woocommerce/orders`
}

const getWooAuth = (consumerKey: string, consumerSecret: string) => ({
  username: String(consumerKey || '').trim(),
  password: String(consumerSecret || '').trim(),
})

const wooRequest = async <T = any>({
  storeUrl,
  consumerKey,
  consumerSecret,
  method,
  path,
  data,
  params,
}: {
  storeUrl: string
  consumerKey: string
  consumerSecret: string
  method: 'get' | 'post' | 'put'
  path: string
  data?: any
  params?: Record<string, any>
}): Promise<T> => {
  const baseURL = getWooApiBase(storeUrl)
  try {
    const response = await axios.request<T>({
      baseURL,
      method,
      url: path,
      data,
      params,
      auth: getWooAuth(consumerKey, consumerSecret),
      timeout: WOOCOMMERCE_API_TIMEOUT_MS,
    })
    return response.data
  } catch (err: any) {
    const status = Number(err?.response?.status || 0)
    const canUseQueryStringAuth =
      normalizeWooCommerceUrl(storeUrl).toLowerCase().startsWith('https://') &&
      (status === 401 || status === 403)

    if (!canUseQueryStringAuth) throw err

    const response = await axios.request<T>({
      baseURL,
      method,
      url: path,
      data,
      params: {
        ...(params || {}),
        consumer_key: String(consumerKey || '').trim(),
        consumer_secret: String(consumerSecret || '').trim(),
      },
      timeout: WOOCOMMERCE_API_TIMEOUT_MS,
    })
    return response.data
  }
}

export const probeWooCommerceStore = async (
  storeUrl: string,
  consumerKey: string,
  consumerSecret: string,
) => {
  const normalizedUrl = normalizeWooCommerceUrl(storeUrl)
  try {
    const systemStatus = await wooRequest<any>({
      storeUrl: normalizedUrl,
      consumerKey,
      consumerSecret,
      method: 'get',
      path: '/system_status',
    })

    const environment = systemStatus?.environment || {}
    return {
      storeName:
        environment?.site_title ||
        environment?.site_url ||
        new URL(normalizedUrl).hostname,
      url: normalizedUrl,
      currency: systemStatus?.settings?.currency || systemStatus?.currency || null,
      raw: systemStatus,
    }
  } catch (err: any) {
    const message =
      err?.response?.data?.message ||
      err?.response?.data?.errors?.[0]?.message ||
      err?.message ||
      'Failed to connect to WooCommerce store'
    console.error('WooCommerce API Error:', err?.response?.data || err?.message || err)
    throw new Error(message)
  }
}

const getStoreWebhookSecret = (store: WooCommerceStore) => {
  const metadata = ((store as any)?.metadata || {}) as Record<string, unknown>
  return String(metadata.wooWebhookSecret || metadata.webhookSecret || process.env.WOOCOMMERCE_WEBHOOK_SECRET || '').trim()
}

const getWooStoresForUser = async (userId: string, tx: any = db) => {
  const rows = await tx
    .select()
    .from(stores)
    .where(and(eq(stores.userId, userId), eq(stores.platformId, WOOCOMMERCE_PLATFORM_ID)))
  return rows as WooCommerceStore[]
}

const getWooStoreForUser = async (userId: string, storeId?: string, tx: any = db) => {
  const whereClause = storeId
    ? and(
        eq(stores.userId, userId),
        eq(stores.platformId, WOOCOMMERCE_PLATFORM_ID),
        eq(stores.id, storeId),
      )
    : and(eq(stores.userId, userId), eq(stores.platformId, WOOCOMMERCE_PLATFORM_ID))
  const [store] = await tx.select().from(stores).where(whereClause).limit(1)
  return store as WooCommerceStore | undefined
}

const getWooStoreByUrl = async (storeUrl: string, tx: any = db) => {
  const normalizedUrl = normalizeWooCommerceUrl(storeUrl).toLowerCase()
  const rows = await tx
    .select()
    .from(stores)
    .where(eq(stores.platformId, WOOCOMMERCE_PLATFORM_ID))

  return rows.find((store: WooCommerceStore) => normalizeWooCommerceUrl(store.domain).toLowerCase() === normalizedUrl) as
    | WooCommerceStore
    | undefined
}

export const ensureWooCommerceOrderWebhooks = async (store: WooCommerceStore) => {
  const address = getWebhookAddress()
  const secret = getStoreWebhookSecret(store)
  if (!secret) throw new Error('WooCommerce webhook secret is missing for this store')

  const existing = await wooRequest<any[]>({
    storeUrl: store.domain,
    consumerKey: store.apiKey,
    consumerSecret: store.adminApiAccessToken,
    method: 'get',
    path: '/webhooks',
    params: { per_page: 100 },
  })

  const existingByTopicAndAddress = new Map(
    (Array.isArray(existing) ? existing : []).map((webhook: any) => [
      `${String(webhook?.topic || '').toLowerCase()}::${String(webhook?.delivery_url || '')}`,
      webhook,
    ]),
  )

  const subscribed: string[] = []
  for (const topic of WOOCOMMERCE_WEBHOOK_TOPICS) {
    const key = `${topic.toLowerCase()}::${address}`
    const existingWebhook = existingByTopicAndAddress.get(key)
    if (existingWebhook?.id) {
      await wooRequest<any>({
        storeUrl: store.domain,
        consumerKey: store.apiKey,
        consumerSecret: store.adminApiAccessToken,
        method: 'put',
        path: `/webhooks/${encodeURIComponent(existingWebhook.id)}`,
        data: {
          status: 'active',
          secret,
        },
      })
      subscribed.push(topic)
      continue
    }

    await wooRequest<any>({
      storeUrl: store.domain,
      consumerKey: store.apiKey,
      consumerSecret: store.adminApiAccessToken,
      method: 'post',
      path: '/webhooks',
      data: {
        name: `Kourier Boyz ${topic}`,
        topic,
        delivery_url: address,
        secret,
        status: 'active',
      },
    })
    subscribed.push(topic)
  }

  return { address, subscribed }
}

export const connectWooCommerceStore = async ({
  storeUrl,
  consumerKey,
  consumerSecret,
  userId,
  settings,
  webhookSecret,
  tx = db,
}: {
  storeUrl: string
  consumerKey: string
  consumerSecret: string
  userId: string
  settings?: Record<string, any>
  webhookSecret?: string
  tx?: any
}) => {
  const normalizedUrl = normalizeWooCommerceUrl(storeUrl)
  const normalizedConsumerKey = String(consumerKey || '').trim()
  const normalizedConsumerSecret = String(consumerSecret || '').trim()
  const normalizedUserId = String(userId || '').trim()

  if (!normalizedUrl) throw new Error('WooCommerce store URL is required')
  if (!uuidPattern.test(normalizedUserId)) throw new Error('A valid authenticated user is required')
  if (!normalizedConsumerKey.startsWith('ck_')) throw new Error('WooCommerce Consumer Key must start with ck_')
  if (!normalizedConsumerSecret.startsWith('cs_')) throw new Error('WooCommerce Consumer Secret must start with cs_')

  const wooData = await probeWooCommerceStore(normalizedUrl, normalizedConsumerKey, normalizedConsumerSecret)
  const secret =
    String(webhookSecret || '').trim() ||
    crypto.randomBytes(32).toString('hex')
  const normalizedSettings = normalizeWooCommerceSettings(settings)

  let savedStore: WooCommerceStore | undefined
  await tx.transaction(async (innerTx: any) => {
    await ensurePlatformRegistration(WOOCOMMERCE_PLATFORM, innerTx)

    const existingGlobalStore = await getWooStoreByUrl(normalizedUrl, innerTx)
    if (existingGlobalStore && existingGlobalStore.userId !== normalizedUserId) {
      throw new Error('This WooCommerce store is already connected to another merchant account')
    }

    const userStores = await getWooStoresForUser(normalizedUserId, innerTx)
    const existingByDomain = userStores.find(
      (store) => normalizeWooCommerceUrl(store.domain).toLowerCase() === normalizedUrl.toLowerCase(),
    )
    const storeId = existingByDomain?.id || generateWooStoreId(normalizedUserId, normalizedUrl)
    const existingMetadata =
      existingByDomain?.metadata && typeof existingByDomain.metadata === 'object'
        ? ({ ...(existingByDomain.metadata as Record<string, any>) } as Record<string, any>)
        : ({} as Record<string, any>)
    const storeMetadata = {
      ...existingMetadata,
      wooWebhookSecret: secret,
      storeInfo: wooData.raw,
      ...(existingByDomain?.id && !existingMetadata.wooInitialHistoricalImportCompletedAt
        ? { wooInitialHistoricalImportCompletedAt: existingMetadata.wooInitialHistoricalImportCompletedAt || new Date().toISOString() }
        : {}),
    }

    if (existingByDomain?.id) {
      await innerTx
        .update(stores)
        .set({
          name: sanitizeStoreName(wooData.storeName, normalizedUrl),
          domain: normalizedUrl,
          apiKey: normalizedConsumerKey,
          adminApiAccessToken: normalizedConsumerSecret,
          settings: normalizedSettings,
          currency: wooData.currency || null,
          metadata: storeMetadata,
          updatedAt: new Date(),
        })
        .where(eq(stores.id, storeId))
    } else {
      await innerTx.insert(stores).values({
        id: storeId,
        name: sanitizeStoreName(wooData.storeName, normalizedUrl),
        userId: normalizedUserId,
        domain: normalizedUrl,
        platformId: WOOCOMMERCE_PLATFORM_ID,
        apiKey: normalizedConsumerKey,
        adminApiAccessToken: normalizedConsumerSecret,
        settings: normalizedSettings,
        currency: wooData.currency || null,
        metadata: storeMetadata,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    }

    await updateUserChannelIntegration(normalizedUserId, WOOCOMMERCE_PLATFORM_ID, innerTx)
    ;[savedStore] = await innerTx.select().from(stores).where(eq(stores.id, storeId)).limit(1)
  })

  let webhooks: { address: string; subscribed: string[] } | null = null
  let warning: string | null = null
  try {
    if (savedStore) webhooks = await ensureWooCommerceOrderWebhooks(savedStore)
  } catch (err: any) {
    warning = 'Store connected, but WooCommerce webhooks could not be auto-configured'
    console.warn('WooCommerce webhook setup failed:', err?.response?.data || err?.message || err)
  }

  return { wooData, store: savedStore, webhooks, warning }
}

const mapWooCommerceStatus = (order: any): string => {
  const status = String(order?.status || '').toLowerCase()
  if (status === 'cancelled' || status === 'failed' || status === 'refunded') return 'cancelled'
  if (status === 'completed') return 'delivered'
  return 'pending'
}

const WOO_TERMINAL_STATUSES = new Set([
  'completed',
  'delivered',
  'cancelled',
  'canceled',
  'refunded',
  'failed',
  'trash',
])

const WOO_ACTIONABLE_SYNC_STATUSES = ['pending', 'processing', 'on-hold'] as const

const isWooCommerceActionableStatus = (status: unknown) =>
  WOO_ACTIONABLE_SYNC_STATUSES.includes(
    String(status || '').trim().toLowerCase() as (typeof WOO_ACTIONABLE_SYNC_STATUSES)[number],
  )

const resolveWooOrderCreatedAt = (order: any) => {
  const rawValue = String(order?.date_created_gmt || order?.date_created || '').trim()
  if (!rawValue) return null
  const parsed = new Date(rawValue)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const hasWooCompletedInitialHistoricalImport = (store: WooCommerceStore) =>
  Boolean(
    (store as any)?.metadata?.wooInitialHistoricalImportCompletedAt ||
      (store as any)?.metadata?.wooInitialHistoricalImportCompleted,
  )

const markWooInitialHistoricalImportCompleted = async (store: WooCommerceStore, tx: any = db) => {
  const currentMetadata =
    (store as any)?.metadata && typeof (store as any).metadata === 'object' ? { ...(store as any).metadata } : {}

  await tx
    .update(stores)
    .set({
      metadata: {
        ...currentMetadata,
        wooInitialHistoricalImportCompletedAt: currentMetadata.wooInitialHistoricalImportCompletedAt || new Date().toISOString(),
      },
      updatedAt: new Date(),
    })
    .where(eq(stores.id, store.id))
}

const getWooTerminalHistoryCutoff = (
  store: WooCommerceStore,
  options: { allowBeforeConnectionHistory?: boolean } = {},
) => {
  const settings = normalizeWooCommerceSettings((store as any)?.settings || {})
  const historicalDays = Number(settings.historicalTerminalSyncDays)
  const now = new Date()
  const historicalCutoff = new Date(now.getTime() - historicalDays * 24 * 60 * 60 * 1000)
  if (options.allowBeforeConnectionHistory) return historicalCutoff

  const connectionDate = new Date((store as any)?.createdAt || Date.now())

  return connectionDate > historicalCutoff ? connectionDate : historicalCutoff
}

const shouldImportWooCommerceOrder = (
  store: WooCommerceStore,
  order: any,
  options: { existingOrderId?: string | null; allowBeforeConnectionHistory?: boolean } = {},
) => {
  if (options.existingOrderId) return true

  const status = String(order?.status || '').trim().toLowerCase()
  return isWooCommerceActionableStatus(status)
}

type WooOrderPaymentDecision = {
  confirmationStatus: 'confirmed' | 'unconfirmed'
  orderType: 'cod' | 'prepaid'
  paymentMethod: string
  paymentMethodTitle: string
  resolutionSource: 'payment_method' | 'status_fallback'
  status: string
}

const resolveWooOrderPaymentDecision = (order: any): WooOrderPaymentDecision => {
  const status = String(order?.status || '').trim().toLowerCase()
  const paymentMethod = String(order?.payment_method || '').trim().toLowerCase()
  const paymentMethodTitle = String(order?.payment_method_title || '').trim()
  const combinedPaymentMethod = [paymentMethod, paymentMethodTitle.toLowerCase()].filter(Boolean).join(' ')

  if (combinedPaymentMethod.includes('cod') || combinedPaymentMethod.includes('cash')) {
    return {
      confirmationStatus: 'confirmed',
      orderType: 'cod',
      paymentMethod,
      paymentMethodTitle,
      resolutionSource: 'payment_method',
      status,
    }
  }

  if (paymentMethod || paymentMethodTitle) {
    return {
      confirmationStatus: 'confirmed',
      orderType: 'prepaid',
      paymentMethod,
      paymentMethodTitle,
      resolutionSource: 'payment_method',
      status,
    }
  }

  return {
    confirmationStatus: 'unconfirmed',
    orderType: ['processing', 'completed'].includes(status) ? 'prepaid' : 'cod',
    paymentMethod,
    paymentMethodTitle,
    resolutionSource: 'status_fallback',
    status,
  }
}

const resolveWooOrderType = (order: any): 'cod' | 'prepaid' => {
  return resolveWooOrderPaymentDecision(order).orderType
}

const normalizeProviderMetaObject = (value: unknown): Record<string, any> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, any>
}

const buildWooCommercePaymentMeta = (order: any, decision: WooOrderPaymentDecision) => ({
  sales_channel_payment: {
    provider: 'woocommerce',
    confirmationStatus: decision.confirmationStatus,
    orderType: decision.orderType,
    resolutionSource: decision.resolutionSource,
    paymentMethod: decision.paymentMethod || null,
    paymentMethodTitle: decision.paymentMethodTitle || null,
    status: decision.status || null,
    orderId: order?.id ? String(order.id) : null,
    syncedAt: new Date().toISOString(),
  },
})

const readWooCommercePaymentMeta = (order: any): WooOrderPaymentDecision | null => {
  const meta = normalizeProviderMetaObject(order?.provider_meta)
  const paymentMeta = normalizeProviderMetaObject(meta.sales_channel_payment)
  const confirmationStatus = String(paymentMeta.confirmationStatus || '').trim().toLowerCase()
  const orderType = String(paymentMeta.orderType || '').trim().toLowerCase()
  const resolutionSource = String(paymentMeta.resolutionSource || '').trim().toLowerCase()

  if (!['confirmed', 'unconfirmed'].includes(confirmationStatus)) return null
  if (!['cod', 'prepaid'].includes(orderType)) return null
  if (!['payment_method', 'status_fallback'].includes(resolutionSource)) return null

  return {
    confirmationStatus: confirmationStatus as 'confirmed' | 'unconfirmed',
    orderType: orderType as 'cod' | 'prepaid',
    paymentMethod: String(paymentMeta.paymentMethod || '').trim().toLowerCase(),
    paymentMethodTitle: String(paymentMeta.paymentMethodTitle || '').trim(),
    resolutionSource: resolutionSource as 'payment_method' | 'status_fallback',
    status: String(paymentMeta.status || '').trim().toLowerCase(),
  }
}

const mapWooProducts = (order: any) => {
  const items = Array.isArray(order?.line_items) ? order.line_items : []
  return items.map((item: any) => {
    const qty = Math.max(1, toNumber(item?.quantity, 1))
    const total = toNumber(item?.total, 0)
    const subtotal = toNumber(item?.subtotal, total)
    const tax = toNumber(item?.total_tax, 0)
    return {
      name: item?.name || 'Item',
      sku: item?.sku || String(item?.product_id || item?.id || 'NA'),
      qty,
      price: toNumber(item?.price, qty > 0 ? subtotal / qty : subtotal),
      discount: Math.max(0, subtotal - total),
      tax_rate: total > 0 && tax > 0 ? Number(((tax / total) * 100).toFixed(2)) : 0,
      hsn: '',
    }
  })
}

const hasAddressFields = (address: any) =>
  Boolean(
    address &&
      (address.address_1 ||
        address.address_2 ||
        address.city ||
        address.state ||
        address.postcode ||
        address.first_name ||
        address.last_name ||
        address.company),
  )

const getAddress = (order: any) => {
  const shipping = order?.shipping || {}
  const billing = order?.billing || {}
  return hasAddressFields(shipping) ? shipping : billing
}

const upsertFromWooCommerceOrder = async (
  store: WooCommerceStore,
  order: any,
  tx: any = db,
  options: { allowBeforeConnectionHistory?: boolean } = {},
) => {
  if (!order?.id) return 'skipped' as const

  const wooOrderId = String(order.id)
  const internalOrderId = buildInternalWooOrderId(store.id, wooOrderId)
  const paymentDecision = resolveWooOrderPaymentDecision(order)
  const orderType = paymentDecision.orderType
  const orderAmount = toNumber(order?.total, 0)
  const shippingAddress = getAddress(order)
  const products = mapWooProducts(order)
  const shippingCharges = Array.isArray(order?.shipping_lines)
    ? order.shipping_lines.reduce((sum: number, item: any) => sum + toNumber(item?.total, 0), 0)
    : toNumber(order?.shipping_total, 0)
  const salesChannelPaymentMeta = buildWooCommercePaymentMeta(order, paymentDecision)

  const updatePayload: Partial<typeof b2c_orders.$inferInsert> = {
    user_id: store.userId,
    order_number: buildWooCommerceOrderNumber(wooOrderId),
    order_date: String(order?.date_created || order?.date_created_gmt || new Date().toISOString()).slice(0, 50),
    order_amount: orderAmount,
    order_id: internalOrderId,
    invoice_number: String(wooOrderId).slice(0, 100),
    invoice_date: order?.date_created ? String(order.date_created).slice(0, 50) : null,
    invoice_amount: orderAmount,
    buyer_name: String(
      `${shippingAddress?.first_name || ''} ${shippingAddress?.last_name || ''}`.trim() ||
        shippingAddress?.company ||
        order?.billing?.email ||
        'WooCommerce Customer',
    ).slice(0, 255),
    buyer_phone: String(order?.billing?.phone || shippingAddress?.phone || '0000000000').slice(0, 20),
    buyer_email: String(order?.billing?.email || '').slice(0, 255) || null,
    address: String([shippingAddress?.address_1, shippingAddress?.address_2].filter(Boolean).join(', ') || 'Address not provided').slice(0, 500),
    city: String(shippingAddress?.city || 'NA').slice(0, 100),
    state: String(shippingAddress?.state || 'NA').slice(0, 100),
    country: String(shippingAddress?.country || 'India').slice(0, 100),
    pincode: String(shippingAddress?.postcode || '000000').slice(0, 20),
    products: products.length ? products : [{ name: 'Item', sku: 'NA', qty: 1, price: orderAmount }],
    weight: 500,
    length: 10,
    breadth: 10,
    height: 10,
    order_type: orderType,
    prepaid_amount: orderType === 'prepaid' ? orderAmount : 0,
    cod_charges: 0,
    shipping_charges: shippingCharges,
    transaction_fee: 0,
    gift_wrap: 0,
    discount: toNumber(order?.discount_total, 0),
    order_status: mapWooCommerceStatus(order),
    courier_partner: '',
    integration_type: 'woocommerce',
    is_external_api: false,
    tags: `woocommerce_store:${store.id}`,
    provider_meta: salesChannelPaymentMeta,
    updated_at: new Date(),
  }

  const [existing] = await tx
    .select({
      id: b2c_orders.id,
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

  if (
    !shouldImportWooCommerceOrder(store, order, {
      existingOrderId: existing?.id,
      allowBeforeConnectionHistory: options.allowBeforeConnectionHistory,
    })
  ) {
    return 'skipped' as const
  }

  if (existing?.id) {
    const mergedProviderMeta = {
      ...normalizeProviderMetaObject(existing.provider_meta),
      ...salesChannelPaymentMeta,
      sales_channel_payment: salesChannelPaymentMeta.sales_channel_payment,
    }
    const providerMetaCourierName = getProviderMetaCourierName(existing.provider_meta)
    const bookedProviderKey = existing.awb_number
      ? resolveCourierProviderKeyFromFields(
          existing.integration_type,
          existing.courier_partner,
          providerMetaCourierName,
          existing.provider_service,
        )
      : ''
    const updateBookedPayload = existing.awb_number
      ? {
          ...updatePayload,
          provider_meta: mergedProviderMeta,
          order_status:
            String(updatePayload.order_status || '').toLowerCase() === 'cancelled'
              ? updatePayload.order_status
              : existing.order_status || updatePayload.order_status,
          courier_partner:
            providerMetaCourierName ||
            (bookedProviderKey ? getCourierProviderDisplayName(bookedProviderKey) : '') ||
            existing.courier_partner ||
            updatePayload.courier_partner,
          integration_type: bookedProviderKey || existing.integration_type || updatePayload.integration_type,
        }
      : {
          ...updatePayload,
          provider_meta: mergedProviderMeta,
        }

    await tx.update(b2c_orders).set(updateBookedPayload).where(eq(b2c_orders.id, existing.id))
    return 'updated' as const
  }

  await tx.insert(b2c_orders).values({ ...updatePayload, created_at: new Date() } as any)
  return 'created' as const
}

export const syncWooCommerceOrdersForUser = async (
  userId: string,
  limit = 50,
  storeId?: string,
  tx: any = db,
): Promise<SyncResult> => {
  const storesToSync = storeId
    ? [await getWooStoreForUser(userId, storeId, tx)].filter(Boolean)
    : await getWooStoresForUser(userId, tx)

  if (!storesToSync.length) {
    throw new Error('No connected WooCommerce store found for this user')
  }

  const result: SyncResult = { created: 0, updated: 0, skipped: 0 }
  for (const store of storesToSync as WooCommerceStore[]) {
    const perPage = Math.min(Math.max(limit, 1), 100)
    const actionableOrders: any[] = []
    let page = 1
    const allowBeforeConnectionHistory = !hasWooCompletedInitialHistoricalImport(store)

    while (actionableOrders.length < perPage) {
      const orders = await wooRequest<any[]>({
        storeUrl: store.domain,
        consumerKey: store.apiKey,
        consumerSecret: store.adminApiAccessToken,
        method: 'get',
        path: '/orders',
        params: {
          per_page: perPage,
          page,
          status: WOO_ACTIONABLE_SYNC_STATUSES.join(','),
          orderby: 'modified',
          order: 'desc',
        },
      })

      const currentPageOrders = Array.isArray(orders) ? orders : []
      if (!currentPageOrders.length) break

      actionableOrders.push(
        ...currentPageOrders.filter((order) =>
          shouldImportWooCommerceOrder(store, order, { allowBeforeConnectionHistory }),
        ),
      )

      if (currentPageOrders.length < perPage) break
      page += 1
    }

    for (const order of actionableOrders.slice(0, perPage)) {
      const state = await upsertFromWooCommerceOrder(store, order, tx, { allowBeforeConnectionHistory })
      result[state] += 1
    }

    if (allowBeforeConnectionHistory) {
      await markWooInitialHistoricalImportCompleted(store, tx)
    }
  }

  return result
}

export const syncExistingWooCommerceOrdersForUser = async (
  userId: string,
  limit = 1000,
  storeId?: string,
  tx: any = db,
): Promise<ExistingOrderSyncResult> => {
  const storesToSync = storeId
    ? [await getWooStoreForUser(userId, storeId, tx)].filter(Boolean)
    : await getWooStoresForUser(userId, tx)

  if (!storesToSync.length) {
    throw new Error('No connected WooCommerce store found for this user')
  }

  const perStoreLimit = Math.min(Math.max(Math.trunc(Number(limit) || 1000), 1), 5000)
  const result: ExistingOrderSyncResult = { checked: 0, created: 0, updated: 0, skipped: 0, failed: 0 }

  for (const store of storesToSync as WooCommerceStore[]) {
    const internalOrderPrefix = buildInternalWooOrderId(store.id, '')
    const rows = await tx
      .select({
        id: b2c_orders.id,
        orderId: b2c_orders.order_id,
        providerMeta: b2c_orders.provider_meta,
      })
      .from(b2c_orders)
      .where(and(eq(b2c_orders.user_id, store.userId), like(b2c_orders.order_id, `${internalOrderPrefix}%`)))
      .limit(perStoreLimit)

    for (const row of rows) {
      const parsed = parseInternalWooOrderId(String(row.orderId || ''))
      if (!parsed.wooOrderId) {
        result.skipped += 1
        continue
      }

      try {
        const liveOrder = await wooRequest<any>({
          storeUrl: store.domain,
          consumerKey: store.apiKey,
          consumerSecret: store.adminApiAccessToken,
          method: 'get',
          path: `/orders/${encodeURIComponent(parsed.wooOrderId)}`,
        })
        result.checked += 1
        const paymentDecision = resolveWooOrderPaymentDecision(liveOrder)
        const salesChannelPaymentMeta = buildWooCommercePaymentMeta(liveOrder, paymentDecision)
        const orderAmount = toNumber(liveOrder?.total, 0)
        const mergedProviderMeta = {
          ...normalizeProviderMetaObject(row.providerMeta),
          ...salesChannelPaymentMeta,
          sales_channel_payment: salesChannelPaymentMeta.sales_channel_payment,
        }

        await tx
          .update(b2c_orders)
          .set({
            order_type: paymentDecision.orderType,
            prepaid_amount: paymentDecision.orderType === 'prepaid' ? orderAmount : 0,
            provider_meta: mergedProviderMeta,
            updated_at: new Date(),
          })
          .where(eq(b2c_orders.id, row.id))

        result.updated += 1
      } catch (err: any) {
        result.failed += 1
        console.warn('WooCommerce existing order payment refresh failed:', {
          storeId: store.id,
          orderId: row.orderId,
          message: err?.response?.data?.message || err?.message || String(err),
        })
      }
    }
  }

  return result
}

const verifyWebhookSignature = (rawBody: Buffer, receivedSignature: string | undefined, secret: string) => {
  const digest = crypto.createHmac('sha256', secret).update(rawBody).digest('base64')
  const expected = Buffer.from(digest)
  const received = Buffer.from(String(receivedSignature || ''))
  if (expected.length !== received.length) return false
  return crypto.timingSafeEqual(expected, received)
}

export const verifyWooCommerceWebhookSignatureForSource = async (
  rawBody: Buffer,
  receivedSignature: string | undefined,
  sourceUrl: string,
  tx: any = db,
) => {
  const store = await getWooStoreByUrl(sourceUrl, tx)
  if (!store) return false
  const secret = getStoreWebhookSecret(store)
  if (!secret) return false
  return verifyWebhookSignature(rawBody, receivedSignature, secret)
}

export const processWooCommerceWebhookOrder = async (
  sourceUrl: string,
  topic: string,
  payload: any,
  tx: any = db,
) => {
  const store = await getWooStoreByUrl(sourceUrl, tx)
  if (!store) return { success: false, reason: 'store_not_found' }

  const normalizedTopic = String(topic || '').toLowerCase()
  if (normalizedTopic.includes('order.created') || normalizedTopic.includes('order.updated')) {
    const action = await upsertFromWooCommerceOrder(store, payload, tx)
    return { success: true, action }
  }

  if (normalizedTopic.includes('order.deleted')) {
    const internalOrderId = buildInternalWooOrderId(store.id, payload?.id || '')
    if (!payload?.id) return { success: false, reason: 'missing_order_id' }
    await tx
      .update(b2c_orders)
      .set({ order_status: 'cancelled', updated_at: new Date() })
      .where(eq(b2c_orders.order_id, internalOrderId))
    return { success: true, action: 'cancelled' }
  }

  return { success: true, action: 'ignored_topic' }
}

export const resolveWooCommerceBookingPaymentForLocalOrder = async (order: any, tx: any = db) => {
  const localOrderId = String(order?.order_id || '')
  if (!localOrderId.startsWith('woo_')) {
    return null
  }

  const parsed = parseInternalWooOrderId(localOrderId)
  if (!parsed.storeId || !parsed.wooOrderId) {
    return readWooCommercePaymentMeta(order)
  }

  const [store] = await tx
    .select()
    .from(stores)
    .where(and(eq(stores.id, parsed.storeId), eq(stores.platformId, WOOCOMMERCE_PLATFORM_ID)))
    .limit(1)

  if (!store) {
    return readWooCommercePaymentMeta(order)
  }

  try {
    const liveOrder = await wooRequest<any>({
      storeUrl: store.domain,
      consumerKey: store.apiKey,
      consumerSecret: store.adminApiAccessToken,
      method: 'get',
      path: `/orders/${encodeURIComponent(parsed.wooOrderId)}`,
    })

    return resolveWooOrderPaymentDecision(liveOrder)
  } catch (err) {
    const stored = readWooCommercePaymentMeta(order)
    if (stored) return stored
    throw err
  }
}

const buildWooCommerceSyncNote = (orderStatus: string, awb: string, courierPartner: unknown) =>
  `Kourier Boyz update: ${orderStatus}. AWB: ${awb}. Courier: ${courierPartner || 'Courier'}.`

const ensureWooCommerceSyncNote = async ({
  store,
  wooOrderId,
  note,
}: {
  store: WooCommerceStore
  wooOrderId: string
  note: string
}) => {
  const existingNotes = await wooRequest<any[]>({
    storeUrl: store.domain,
    consumerKey: store.apiKey,
    consumerSecret: store.adminApiAccessToken,
    method: 'get',
    path: `/orders/${encodeURIComponent(wooOrderId)}/notes`,
    params: { per_page: 50 },
  })

  const alreadyExists = (Array.isArray(existingNotes) ? existingNotes : []).some((existingNote: any) =>
    String(existingNote?.note || '')
      .replace(/<[^>]*>/g, '')
      .includes(note),
  )

  if (alreadyExists) return false

  await wooRequest({
    storeUrl: store.domain,
    consumerKey: store.apiKey,
    consumerSecret: store.adminApiAccessToken,
    method: 'post',
    path: `/orders/${encodeURIComponent(wooOrderId)}/notes`,
    data: {
      note,
      customer_note: false,
    },
  })

  return true
}

const WOO_STATUS_SYNC_ALLOWED_SOURCES = new Set([
  'courier-booking',
  'retry-cron',
  'manual',
])

const WOO_STATUS_SYNC_RETRYABLE_STATUSES = new Set([
  'booked',
  'pickup_initiated',
])

const WOO_STATUS_TRACKING_ONLY_SOURCES = new Set([
  'live-tracking',
  'delhivery_webhook',
  'ekart_webhook',
  'xpressbees_webhook',
  'amazon_shipping_webhook',
  'shadowfax_webhook',
])

const getPreviousSalesChannelSyncSource = (order: any) =>
  String(order?.provider_meta?.sales_channel_sync?.source || '').trim().toLowerCase()

const isWooCommerceStatusSyncAllowed = (
  orderStatus: string,
  source?: string,
  previousSyncSource?: string,
) => {
  const normalizedStatus = String(orderStatus || '').trim().toLowerCase()
  if (normalizedStatus === 'cancelled') return true

  const normalizedSource = String(source || '').trim().toLowerCase()
  const normalizedPreviousSource = String(previousSyncSource || '').trim().toLowerCase()
  if (
    WOO_STATUS_TRACKING_ONLY_SOURCES.has(normalizedSource) ||
    WOO_STATUS_TRACKING_ONLY_SOURCES.has(normalizedPreviousSource)
  ) {
    return false
  }

  if (normalizedSource === 'retry-cron' || normalizedSource === 'manual') {
    return WOO_STATUS_SYNC_RETRYABLE_STATUSES.has(normalizedStatus)
  }

  return WOO_STATUS_SYNC_ALLOWED_SOURCES.has(normalizedSource)
}

const persistWooCommerceTrackingNote = async (
  order: any,
  tx: any,
  options: { source?: string } = {},
) => {
  const localOrderId = String(order?.order_id || '')
  if (!localOrderId.startsWith('woo_')) {
    return { attempted: false, success: true, channel: 'woocommerce', reason: 'not_a_woocommerce_order' }
  }

  const parsed = parseInternalWooOrderId(localOrderId)
  if (!parsed.storeId || !parsed.wooOrderId) {
    return { attempted: false, success: false, channel: 'woocommerce', reason: 'missing_woocommerce_order_id' }
  }

  const orderStatus = String(order?.order_status || '').toLowerCase()
  const awb = String(order?.awb_number || '').trim()

  const [store] = await tx
    .select()
    .from(stores)
    .where(and(eq(stores.id, parsed.storeId), eq(stores.platformId, WOOCOMMERCE_PLATFORM_ID)))
    .limit(1)
  if (!store) {
    await recordSalesChannelSyncOutcome(
      order,
      {
        channel: 'woocommerce',
        status: 'skipped',
        source: options.source,
        reason: 'store_not_found',
        syncedStatus: String(order?.order_status || '').toLowerCase(),
        syncedAwb: String(order?.awb_number || '').trim(),
      },
      tx,
    )
    return { attempted: false, success: true, channel: 'woocommerce', reason: 'store_not_found' }
  }

  const settings = normalizeWooCommerceSettings(((store as any)?.settings || {}) as Record<string, any>)

  if (!settings.autoUpdateShipmentStatus || !awb) {
    await recordSalesChannelSyncOutcome(
      order,
      {
        channel: 'woocommerce',
        status: 'skipped',
        source: options.source,
        reason: !settings.autoUpdateShipmentStatus ? 'shipment_notes_disabled' : 'awb_missing',
        syncedStatus: orderStatus,
        syncedAwb: awb,
      },
      tx,
    )
    return {
      attempted: false,
      success: true,
      channel: 'woocommerce',
      reason: !settings.autoUpdateShipmentStatus ? 'shipment_notes_disabled' : 'awb_missing',
    }
  }

  const note = buildWooCommerceSyncNote(orderStatus || 'tracking_updated', awb, order?.courier_partner)
  try {
    const created = await ensureWooCommerceSyncNote({
      store,
      wooOrderId: parsed.wooOrderId,
      note,
    })

    await recordSalesChannelSyncOutcome(
      order,
      {
        channel: 'woocommerce',
        status: 'success',
        source: options.source,
        actions: [created ? 'awb_note_created' : 'awb_note_already_current'],
        syncedStatus: orderStatus,
        syncedAwb: awb,
      },
      tx,
    )

    return {
      attempted: true,
      success: true,
      channel: 'woocommerce',
      actions: [created ? 'awb_note_created' : 'awb_note_already_current'],
    }
  } catch (err: any) {
    await recordSalesChannelSyncOutcome(
      order,
      {
        channel: 'woocommerce',
        status: 'failed',
        source: options.source,
        error: err,
        syncedStatus: orderStatus,
        syncedAwb: awb,
      },
      tx,
    )
    console.warn(
      `WooCommerce tracking note sync failed for local order ${order?.order_number || order?.id}:`,
      err?.response?.data || err?.message || err,
    )
    return {
      attempted: true,
      success: false,
      channel: 'woocommerce',
      error: err?.response?.data || err?.message || err,
    }
  }
}

export const syncWooCommerceStatusForLocalOrder = async (
  order: any,
  tx: any = db,
  options: { source?: string } = {},
) => {
  const localOrderId = String(order?.order_id || '')
  if (!localOrderId.startsWith('woo_')) {
    return { attempted: false, success: true, channel: 'woocommerce', reason: 'not_a_woocommerce_order' }
  }

  const parsed = parseInternalWooOrderId(localOrderId)
  if (!parsed.storeId || !parsed.wooOrderId) {
    return { attempted: false, success: false, channel: 'woocommerce', reason: 'missing_woocommerce_order_id' }
  }

  const orderStatus = String(order?.order_status || '').toLowerCase()
  const awb = String(order?.awb_number || '').trim()

  const [store] = await tx
    .select()
    .from(stores)
    .where(and(eq(stores.id, parsed.storeId), eq(stores.platformId, WOOCOMMERCE_PLATFORM_ID)))
    .limit(1)
  if (!store) {
    await recordSalesChannelSyncOutcome(
      order,
      {
        channel: 'woocommerce',
        status: 'skipped',
        source: options.source,
        reason: 'store_not_found',
        syncedStatus: orderStatus,
        syncedAwb: awb,
      },
      tx,
    )
    return { attempted: false, success: true, channel: 'woocommerce', reason: 'store_not_found' }
  }

  const settings = normalizeWooCommerceSettings(((store as any)?.settings || {}) as Record<string, any>)
  const actions: string[] = []
  const previousSyncSource = getPreviousSalesChannelSyncSource(order)
  const canSyncWooStatus = isWooCommerceStatusSyncAllowed(
    orderStatus,
    options.source,
    previousSyncSource,
  )

  if (!settings.autoUpdateStatus && !settings.autoUpdateShipmentStatus) {
    await recordSalesChannelSyncOutcome(
      order,
      {
        channel: 'woocommerce',
        status: 'skipped',
        source: options.source,
        reason: 'disabled_by_settings',
        syncedStatus: orderStatus,
        syncedAwb: awb,
      },
      tx,
    )
    return { attempted: false, success: true, channel: 'woocommerce', reason: 'disabled_by_settings' }
  }

  if (!canSyncWooStatus) {
    const noteResult = await persistWooCommerceTrackingNote(order, tx, options)
    return {
      attempted: noteResult.attempted,
      success: noteResult.success,
      channel: 'woocommerce',
      reason: 'status_locked_to_booking_or_cancellation',
      actions: noteResult.actions || [],
      error: noteResult.success ? undefined : noteResult.error,
    }
  }

  const wooStatus =
    orderStatus === 'cancelled'
      ? 'cancelled'
      : ['booked', 'pickup_initiated', 'in_transit', 'out_for_delivery', 'delivered'].includes(orderStatus)
        ? 'completed'
        : ''
  if (!wooStatus) {
    await recordSalesChannelSyncOutcome(
      order,
      {
        channel: 'woocommerce',
        status: 'skipped',
        source: options.source,
        reason: 'unmapped_status',
        syncedStatus: orderStatus,
        syncedAwb: awb,
      },
      tx,
    )
    return { attempted: false, success: true, channel: 'woocommerce', reason: 'unmapped_status' }
  }

  try {
    if (settings.autoUpdateStatus) {
      await wooRequest({
        storeUrl: store.domain,
        consumerKey: store.apiKey,
        consumerSecret: store.adminApiAccessToken,
        method: 'put',
        path: `/orders/${encodeURIComponent(parsed.wooOrderId)}`,
        data: { status: wooStatus },
      })
      actions.push(`status_${wooStatus}`)
    }

    if (settings.autoUpdateShipmentStatus && awb) {
      const note = buildWooCommerceSyncNote(orderStatus, awb, order?.courier_partner)
      const created = await ensureWooCommerceSyncNote({
        store,
        wooOrderId: parsed.wooOrderId,
        note,
      })
      actions.push(created ? 'awb_note_created' : 'awb_note_already_current')
    } else if (!awb) {
      actions.push('awb_note_skipped_no_awb')
    }

    await recordSalesChannelSyncOutcome(
      order,
      {
        channel: 'woocommerce',
        status: 'success',
        source: options.source,
        actions,
        syncedStatus: orderStatus,
        syncedAwb: awb,
      },
      tx,
    )

    return { attempted: true, success: true, channel: 'woocommerce', actions }
  } catch (err: any) {
    await recordSalesChannelSyncOutcome(
      order,
      {
        channel: 'woocommerce',
        status: 'failed',
        source: options.source,
        actions,
        error: err,
        syncedStatus: orderStatus,
        syncedAwb: awb,
      },
      tx,
    )
    console.warn(
      `WooCommerce status sync failed for local order ${order?.order_number || order?.id}:`,
      err?.response?.data || err?.message || err,
    )
    return {
      attempted: true,
      success: false,
      channel: 'woocommerce',
      actions,
      error: err?.response?.data || err?.message || err,
    }
  }
}

export const syncWooCommerceTrackingNoteForLocalOrder = async (
  order: any,
  tx: any = db,
  options: { source?: string } = {},
) => persistWooCommerceTrackingNote(order, tx, options)
