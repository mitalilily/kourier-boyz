import { eq } from 'drizzle-orm'
import { db } from '../client'
import { courierCredentials } from '../schema/courierCredentials'

export type BusinessType = 'b2b' | 'b2c'
export type ServiceProviderId =
  | 'delhivery'
  | 'shipway'
  | 'xpressbees'
  | 'ekart'
  | 'shadowfax'
  | 'innofulfill'
  | 'dtdc'
  | 'movin'
  | 'apptmyz'

export type DelhiveryConfig = {
  apiKey?: string
  clientName?: string
  ltlApiBase?: string
  ltlToken?: string
  ltlTokenExpiresAt?: string
  ltlUsername?: string
  ltlEmail?: string
  ltlPassword?: string
}

export type XpressbeesConfig = {
  apiBase?: string
  apiToken?: string
  authBearer?: string
  email?: string
  password?: string
  secretKey?: string
  xbKey?: string
  xbAccessKey?: string
  businessUnit?: string
  businessFlow?: string
  businessService?: string
  businessServices?: string
  businessAccountName?: string
  pickupVendorCode?: string
  manifestServiceType?: string
  manifestPickupType?: string
  pincodeBusinessUnit?: string
  pincodeBusinessFlow?: string
  pickupBusinessService?: string
  deliveryBusinessService?: string
  serviceabilityVersion?: string
  trackingVersion?: string
}

export type EkartConfig = {
  clientId?: string
  username?: string
  password?: string
  baseApi?: string
  baseAuth?: string
}

export type SmartshipConfig = {
  username?: string
  password?: string
  clientId?: string
  clientSecret?: string
}

export type NimbuspostConfig = {
  email?: string
  password?: string
}

export type ShipwayConfig = {
  username?: string
  password?: string
}

export type ShadowfaxConfig = {
  apiBase?: string
  apiToken?: string
  clientName?: string
  webhookSecret?: string
}

export type InnofulfillConfig = {
  apiBase?: string
  apiKey?: string
  username?: string
  password?: string
  tenantId?: string
  userId?: string
  signinType?: string
  webhookSecret?: string
}

export type DtdcConfig = {
  apiBase?: string
  apiKey?: string
  accessToken?: string
  trackingToken?: string
  clientName?: string
  username?: string
  password?: string
  bookingApiBase?: string
  cancelApiBase?: string
  customerCode?: string
  serviceTypeId?: string
  commodityId?: string
  hubCode?: string
  pickupVendorCode?: string
}

export type MovinConfig = {
  apiBase?: string
  tenantId?: string
  serverId?: string
  clientId?: string
  clientSecret?: string
  subscriptionKey?: string
  accountNumber?: string
}

export type ApptmyzConfig = {
  apiBase?: string
  clientName?: string
  username?: string
  password?: string
  publicKey?: string
  customerCode?: string
}

export type CourierConfig =
  | DelhiveryConfig
  | SmartshipConfig
  | NimbuspostConfig
  | ShipwayConfig
  | XpressbeesConfig
  | EkartConfig
  | ShadowfaxConfig
  | InnofulfillConfig
  | DtdcConfig
  | MovinConfig
  | ApptmyzConfig

export interface CourierCredentialsUpsertPayload {
  serviceProvider: ServiceProviderId
  b2c?: {
    config?: CourierConfig | null
    sameAsB2b?: boolean
  }
  b2b?: {
    config?: CourierConfig | null
    sameAsB2c?: boolean
  }
}

export interface CourierCredentialsMeta {
  serviceProvider: ServiceProviderId
  b2c: {
    configured: boolean
    sameAsB2b: boolean
    usingEnvFallback: boolean
  }
  b2b: {
    configured: boolean
    sameAsB2c: boolean
    usingEnvFallback: boolean
  }
}

const KNOWN_PROVIDERS: ServiceProviderId[] = [
  'delhivery',
  'shipway',
  'xpressbees',
  'ekart',
  'shadowfax',
  'innofulfill',
  'dtdc',
  'movin',
  'apptmyz',
]

const normalize = (val?: string | null) => String(val || '').trim()

type CredentialRowLike = Partial<typeof courierCredentials.$inferSelect>

const metadataValue = (row: CredentialRowLike, ...keys: string[]) => {
  const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata : {}
  for (const key of keys) {
    const value = normalize((metadata as Record<string, unknown>)[key] as string)
    if (value) return value
  }
  return ''
}

export const normalizeCredentialProvider = (provider: unknown) =>
  String(provider || '')
    .trim()
    .toLowerCase()

export const isCourierCredentialRowConfigured = (
  provider: unknown,
  row?: CredentialRowLike | null,
): boolean => {
  if (!row) return false

  const normalizedProvider = normalizeCredentialProvider(provider)
  const apiKey = normalize(row.apiKey)
  const clientName = normalize(row.clientName)
  const clientId = normalize(row.clientId)
  const username = normalize(row.username)
  const password = normalize(row.password)

  if (normalizedProvider === 'delhivery') {
    const ltlUsername = metadataValue(row, 'ltlUsername', 'ltl_username')
    const ltlPassword = metadataValue(row, 'ltlPassword', 'ltl_password')
    const ltlToken = metadataValue(row, 'ltlToken', 'ltl_token')
    return Boolean((apiKey && clientName) || (ltlUsername && (ltlPassword || ltlToken)))
  }
  if (normalizedProvider === 'ekart') return Boolean(clientId && username && password)
  if (normalizedProvider === 'xpressbees') {
    const bearer = metadataValue(row, 'authBearer', 'auth_bearer', 'authorizationBearer')
    return Boolean(apiKey || bearer || (username && password))
  }
  if (normalizedProvider === 'shadowfax') return Boolean(apiKey)
  if (normalizedProvider === 'innofulfill') {
    const tenantId = metadataValue(row, 'tenantId', 'tenant_id')
    const userId = metadataValue(row, 'userId', 'user_id')
    return Boolean(apiKey || (username && password && tenantId && userId))
  }
  if (normalizedProvider === 'dtdc') return Boolean(apiKey)
  if (normalizedProvider === 'movin') {
    const tenantId = metadataValue(row, 'tenantId', 'tenant_id')
    const serverId = metadataValue(row, 'serverId', 'server_id')
    const subscriptionKey = apiKey || metadataValue(row, 'subscriptionKey', 'subscription_key')
    const accountNumber = metadataValue(row, 'accountNumber', 'account_number')
    return Boolean(row.apiBase && tenantId && serverId && clientId && password && subscriptionKey && accountNumber)
  }
  if (normalizedProvider === 'apptmyz') {
    return Boolean(row.apiBase && username && password)
  }
  if (normalizedProvider === 'amazon') {
    const accessToken = metadataValue(row, 'accessToken')
    const refreshToken = metadataValue(row, 'refreshToken') || apiKey
    const lwaClientId = metadataValue(row, 'lwaClientId') || clientId
    const lwaClientSecret = metadataValue(row, 'lwaClientSecret') || password
    return Boolean(accessToken || (refreshToken && lwaClientId && lwaClientSecret))
  }
  if (normalizedProvider === 'shipway') return Boolean(username && password)
  return false
}

const configuredProvidersFromEnvironment = () => {
  const providers = new Set<string>()
  if (
    (normalize(process.env.DELHIVERY_API_KEY) && normalize(process.env.DELHIVERY_CLIENT_NAME)) ||
    (normalize(process.env.DELHIVERY_LTL_USERNAME) &&
      (normalize(process.env.DELHIVERY_LTL_PASSWORD) || normalize(process.env.DELHIVERY_LTL_TOKEN)))
  ) providers.add('delhivery')
  if (
    normalize(process.env.XPRESSBEES_API_TOKEN) ||
    normalize(process.env.XPRESSBEES_XB_KEY) ||
    (normalize(process.env.XPRESSBEES_USERNAME) && normalize(process.env.XPRESSBEES_PASSWORD))
  ) providers.add('xpressbees')
  if (
    normalize(process.env.EKART_CLIENT_ID) &&
    normalize(process.env.EKART_USERNAME) &&
    normalize(process.env.EKART_PASSWORD)
  ) providers.add('ekart')
  if (normalize(process.env.SHADOWFAX_API_TOKEN) || normalize(process.env.SHADOWFAX_API_KEY)) {
    providers.add('shadowfax')
  }
  if (
    normalize(process.env.AMAZON_SHIPPING_ACCESS_TOKEN) ||
    (normalize(process.env.AMAZON_SHIPPING_REFRESH_TOKEN) &&
      normalize(process.env.AMAZON_SHIPPING_LWA_CLIENT_ID) &&
      normalize(process.env.AMAZON_SHIPPING_LWA_CLIENT_SECRET))
  ) providers.add('amazon')
  if (normalize(process.env.SHIPWAY_USERNAME) && normalize(process.env.SHIPWAY_PASSWORD)) {
    providers.add('shipway')
  }
  if (
    normalize(process.env.INNOFULFILL_API_KEY) ||
    (normalize(process.env.INNOFULFILL_USERNAME) &&
      normalize(process.env.INNOFULFILL_PASSWORD) &&
      normalize(process.env.INNOFULFILL_TENANT_ID) &&
      normalize(process.env.INNOFULFILL_USER_ID))
  ) providers.add('innofulfill')
  if (normalize(process.env.DTDC_ACCESS_TOKEN) || normalize(process.env.DTDC_API_KEY)) {
    providers.add('dtdc')
  }
  if (
    normalize(process.env.MOVIN_API_BASE) &&
    normalize(process.env.MOVIN_TENANT_ID) &&
    normalize(process.env.MOVIN_SERVER_ID) &&
    normalize(process.env.MOVIN_CLIENT_ID) &&
    normalize(process.env.MOVIN_CLIENT_SECRET) &&
    normalize(process.env.MOVIN_SUBSCRIPTION_KEY) &&
    normalize(process.env.MOVIN_ACCOUNT_NUMBER)
  ) {
    providers.add('movin')
  }
  if (
    normalize(process.env.APPTMYZ_API_BASE) &&
    normalize(process.env.APPTMYZ_USERNAME) &&
    normalize(process.env.APPTMYZ_PASSWORD)
  ) {
    providers.add('apptmyz')
  }
  return providers
}

const hasEnvForProviderAndType = (provider: ServiceProviderId, _type: BusinessType): boolean =>
  configuredProvidersFromEnvironment().has(provider)

export const getConfiguredCourierProviderSet = async (): Promise<Set<string>> => {
  const providers = configuredProvidersFromEnvironment()
  let rows: (typeof courierCredentials.$inferSelect)[] = []
  try {
    rows = await db.select().from(courierCredentials)
  } catch (err: any) {
    if (err?.message?.includes('does not exist') || err?.message?.includes('relation') || err?.code === '42P01') {
      return providers
    }
    throw err
  }

  for (const row of rows) {
    const provider = normalizeCredentialProvider(row.provider)
    if (isCourierCredentialRowConfigured(provider, row)) providers.add(provider)
  }
  return providers
}

const buildConfigFromRow = (provider: ServiceProviderId, row: typeof courierCredentials.$inferSelect) => {
  const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata : {}

  if (provider === 'ekart') {
    const cfg: EkartConfig = {
      clientId: normalize(row.clientId),
      username: normalize(row.username),
      password: normalize(row.password),
      baseApi: normalize(row.apiBase),
      baseAuth: normalize((metadata.baseAuth as string) || (metadata.base_auth as string) || ''),
    }
    return cfg
  }

  if (provider === 'delhivery') {
    const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata : {}
    const cfg: DelhiveryConfig = {
      apiKey: normalize(row.apiKey),
      clientName: normalize(row.clientName),
      ltlApiBase: normalize((metadata.ltlApiBase as string) || (metadata.ltl_api_base as string) || ''),
      ltlToken: normalize((metadata.ltlToken as string) || (metadata.ltl_token as string) || ''),
      ltlTokenExpiresAt: normalize(
        (metadata.ltlTokenExpiresAt as string) || (metadata.ltl_token_expires_at as string) || '',
      ),
      ltlUsername: normalize((metadata.ltlUsername as string) || (metadata.ltl_username as string) || ''),
      ltlEmail: normalize((metadata.ltlEmail as string) || (metadata.ltl_email as string) || ''),
      ltlPassword: normalize((metadata.ltlPassword as string) || (metadata.ltl_password as string) || ''),
    }
    return cfg
  }

  if (provider === 'shipway') {
    const cfg: ShipwayConfig = {
      username: normalize(row.username),
      password: normalize(row.password),
    }
    return cfg
  }

  if (provider === 'shadowfax') {
    const cfg: ShadowfaxConfig = {
      apiBase: normalize(row.apiBase),
      apiToken: normalize(row.apiKey),
      clientName: normalize(row.clientName),
      webhookSecret: normalize(row.webhookSecret),
    }
    return cfg
  }

  if (provider === 'innofulfill') {
    const cfg: InnofulfillConfig = {
      apiBase: normalize(row.apiBase),
      apiKey: normalize(row.apiKey),
      username: normalize(row.username),
      password: normalize(row.password),
      tenantId: normalize((metadata.tenantId as string) || (metadata.tenant_id as string) || ''),
      userId: normalize((metadata.userId as string) || (metadata.user_id as string) || ''),
      signinType: normalize((metadata.signinType as string) || (metadata.signin_type as string) || 'EMAIL') || 'EMAIL',
      webhookSecret: normalize(row.webhookSecret),
    }
    return cfg
  }

  if (provider === 'dtdc') {
    const cfg: DtdcConfig = {
      apiBase: normalize(row.apiBase),
      apiKey: normalize(row.apiKey),
      accessToken: normalize(row.apiKey),
      trackingToken: normalize((metadata.trackingToken as string) || (metadata.tracking_token as string) || ''),
      clientName: normalize(row.clientName),
      username: normalize(row.username),
      password: normalize(row.password),
      bookingApiBase: normalize((metadata.bookingApiBase as string) || (metadata.booking_api_base as string) || (metadata.softdataApiBase as string) || ''),
      cancelApiBase: normalize((metadata.cancelApiBase as string) || (metadata.cancel_api_base as string) || ''),
      customerCode: normalize((metadata.customerCode as string) || (metadata.customer_code as string) || ''),
      serviceTypeId: normalize((metadata.serviceTypeId as string) || (metadata.service_type_id as string) || ''),
      commodityId: normalize((metadata.commodityId as string) || (metadata.commodity_id as string) || ''),
      hubCode: normalize((metadata.hubCode as string) || (metadata.hub_code as string) || ''),
      pickupVendorCode: normalize(
        (metadata.pickupVendorCode as string) || (metadata.pickup_vendor_code as string) || '',
      ),
    }
    return cfg
  }

  if (provider === 'movin') {
    const cfg: MovinConfig = {
      apiBase: normalize(row.apiBase),
      tenantId: normalize((metadata.tenantId as string) || (metadata.tenant_id as string) || ''),
      serverId: normalize((metadata.serverId as string) || (metadata.server_id as string) || ''),
      clientId: normalize(row.clientId),
      clientSecret: normalize(row.password),
      subscriptionKey: normalize(row.apiKey),
      accountNumber: normalize(
        (metadata.accountNumber as string) || (metadata.account_number as string) || '',
      ),
    }
    return cfg
  }

  if (provider === 'apptmyz') {
    const cfg: ApptmyzConfig = {
      apiBase: normalize(row.apiBase),
      clientName: normalize(row.clientName),
      username: normalize(row.username),
      password: normalize(row.password),
      publicKey: normalize((metadata.publicKey as string) || (metadata.public_key as string) || ''),
      customerCode: normalize((metadata.customerCode as string) || (metadata.customer_code as string) || ''),
    }
    return cfg
  }

  const cfg: XpressbeesConfig = {
    apiBase: normalize(row.apiBase),
    apiToken: normalize(row.apiKey),
    authBearer: normalize(
      (metadata.authBearer as string) ||
        (metadata.auth_bearer as string) ||
        (metadata.authorizationBearer as string) ||
        '',
    ),
    email: normalize(row.username),
    password: normalize(row.password),
    secretKey: normalize(
      (metadata.secretKey as string) ||
        (metadata.secret_key as string) ||
        (metadata.xpressbeesSecretKey as string) ||
        '',
    ),
    xbKey: normalize(
      (metadata.xbKey as string) ||
        (metadata.xb_key as string) ||
        (metadata.xpressbeesXbKey as string) ||
        '',
    ),
    xbAccessKey: normalize(
      (metadata.xbAccessKey as string) ||
        (metadata.xb_access_key as string) ||
        (metadata.xpressbeesXbAccessKey as string) ||
        '',
    ),
    businessUnit: normalize((metadata.businessUnit as string) || ''),
    businessFlow: normalize((metadata.businessFlow as string) || ''),
    businessService: normalize((metadata.businessService as string) || ''),
    businessServices: normalize((metadata.businessServices as string) || ''),
    businessAccountName: normalize(
      (metadata.businessAccountName as string) ||
        (metadata.business_account_name as string) ||
        (metadata.xpressbeesBusinessAccountName as string) ||
        '',
    ),
    pickupVendorCode: normalize(
      (metadata.pickupVendorCode as string) ||
        (metadata.pickup_vendor_code as string) ||
        (metadata.xpressbeesPickupVendorCode as string) ||
        '',
    ),
    manifestServiceType: normalize((metadata.manifestServiceType as string) || ''),
    manifestPickupType: normalize((metadata.manifestPickupType as string) || ''),
    pincodeBusinessUnit: normalize((metadata.pincodeBusinessUnit as string) || ''),
    pincodeBusinessFlow: normalize((metadata.pincodeBusinessFlow as string) || ''),
    pickupBusinessService: normalize((metadata.pickupBusinessService as string) || ''),
    deliveryBusinessService: normalize((metadata.deliveryBusinessService as string) || ''),
    serviceabilityVersion: normalize((metadata.serviceabilityVersion as string) || ''),
    trackingVersion: normalize((metadata.trackingVersion as string) || ''),
  }
  return cfg
}

export const getEffectiveCourierConfig = async <T extends CourierConfig>(
  provider: ServiceProviderId,
  _type: BusinessType,
): Promise<T | null> => {
  let row
  try {
    ;[row] = await db.select().from(courierCredentials).where(eq(courierCredentials.provider, provider))
  } catch (err: any) {
    if (err?.message?.includes('does not exist') || err?.message?.includes('relation') || err?.code === '42P01') {
      console.warn('[getEffectiveCourierConfig] courier_credentials table does not exist, using env fallback', provider)
      return null
    }
    throw err
  }

  if (!row) return null
  return buildConfigFromRow(provider, row) as T
}

export const upsertCourierCredentials = async (
  payload: CourierCredentialsUpsertPayload,
): Promise<void> => {
  const { serviceProvider, b2c, b2b } = payload
  const mergedConfig = (b2c?.config ?? b2b?.config ?? null) as Record<string, any> | null

  const values: Partial<typeof courierCredentials.$inferInsert> = {
    provider: serviceProvider,
    apiBase: normalize((mergedConfig?.baseApi as string) || (mergedConfig?.apiBase as string) || ''),
    clientName: normalize((mergedConfig?.clientName as string) || ''),
    apiKey: normalize((mergedConfig?.apiKey as string) || (mergedConfig?.apiToken as string) || ''),
    clientId: normalize((mergedConfig?.clientId as string) || ''),
    username: normalize((mergedConfig?.username as string) || (mergedConfig?.email as string) || ''),
    password: normalize((mergedConfig?.password as string) || ''),
    webhookSecret: normalize((mergedConfig?.webhookSecret as string) || ''),
    updatedAt: new Date(),
  }

  await db
    .insert(courierCredentials)
    .values(values as any)
    .onConflictDoUpdate({
      target: courierCredentials.provider,
      set: {
        ...values,
        updatedAt: new Date(),
      } as any,
    })
}

export const listCourierCredentialsMeta = async (): Promise<CourierCredentialsMeta[]> => {
  let rows: (typeof courierCredentials.$inferSelect)[] = []
  try {
    rows = await db.select().from(courierCredentials)
  } catch (err: any) {
    if (err?.message?.includes('does not exist') || err?.message?.includes('relation') || err?.code === '42P01') {
      return KNOWN_PROVIDERS.map((provider) => ({
        serviceProvider: provider,
        b2c: { configured: false, sameAsB2b: false, usingEnvFallback: hasEnvForProviderAndType(provider, 'b2c') },
        b2b: { configured: false, sameAsB2c: false, usingEnvFallback: hasEnvForProviderAndType(provider, 'b2b') },
      }))
    }
    throw err
  }

  const byProvider = new Map<string, (typeof rows)[number]>()
  for (const row of rows) byProvider.set(row.provider, row)

  return KNOWN_PROVIDERS.map((provider) => {
    const row = byProvider.get(provider)
    const configured = isCourierCredentialRowConfigured(provider, row)

    return {
      serviceProvider: provider,
      b2c: {
        configured,
        sameAsB2b: false,
        usingEnvFallback: !configured && hasEnvForProviderAndType(provider, 'b2c'),
      },
      b2b: {
        configured,
        sameAsB2c: false,
        usingEnvFallback: !configured && hasEnvForProviderAndType(provider, 'b2b'),
      },
    }
  })
}
