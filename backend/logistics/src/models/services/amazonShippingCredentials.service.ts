import { eq } from 'drizzle-orm'
import { courier_credentials } from '../schema/courierCredentials'
import type { AmazonShippingCredentials } from './amazonShipping.service'

export const AMAZON_CREDENTIALS_PROVIDER = 'amazon'
export const AMAZON_DEFAULT_BUSINESS_ID = 'AmazonShipping_IN'
export const AMAZON_DEFAULT_REGION = 'eu'

type CourierCredentialsRow = typeof courier_credentials.$inferSelect

export type AmazonCredentialMetadata = {
  accessToken?: string
  refreshToken?: string
  lwaClientId?: string
  lwaClientSecret?: string
  endpoint?: string
  region?: string
  sandbox?: boolean
  shippingBusinessId?: string
  lwaTokenUrl?: string
}

type EnvSource = Record<string, string | undefined>

export const normalizeAmazonCredentialValue = (value?: unknown) => String(value ?? '').trim()

export const parseAmazonSandboxFlag = (value: unknown) => {
  if (typeof value === 'boolean') return value
  return ['1', 'true', 'yes', 'y', 'sandbox'].includes(
    normalizeAmazonCredentialValue(value).toLowerCase(),
  )
}

export const maskAmazonCredential = (value?: unknown) => {
  const normalized = normalizeAmazonCredentialValue(value)
  if (!normalized) return ''
  if (normalized.length <= 8) return '********'
  return `${normalized.slice(0, 4)}${'*'.repeat(Math.max(normalized.length - 8, 0))}${normalized.slice(-4)}`
}

const looksLikeAmazonAccessToken = (value: string) => /^Atza\|/i.test(value)
const looksLikeAmazonRefreshToken = (value: string) => /^Atzr\|/i.test(value)

export const normalizeAmazonCredentialTokens = ({
  accessToken,
  refreshToken,
}: {
  accessToken?: unknown
  refreshToken?: unknown
}) => {
  let access = normalizeAmazonCredentialValue(accessToken)
  let refresh = normalizeAmazonCredentialValue(refreshToken)

  // Amazon LWA access tokens start with Atza|, while refresh tokens start with Atzr|.
  // If an access token is pasted into the refresh-token field, Amazon returns invalid_grant.
  if (looksLikeAmazonRefreshToken(access) && looksLikeAmazonAccessToken(refresh)) {
    return { accessToken: refresh, refreshToken: access }
  }

  if (!access && looksLikeAmazonAccessToken(refresh)) {
    access = refresh
    refresh = ''
  }

  if (!refresh && looksLikeAmazonRefreshToken(access)) {
    refresh = access
    access = ''
  }

  return { accessToken: access, refreshToken: refresh }
}

const getMetadata = (row?: Pick<CourierCredentialsRow, 'metadata'> | null) => {
  const metadata = row?.metadata
  return metadata && typeof metadata === 'object' && !Array.isArray(metadata)
    ? (metadata as AmazonCredentialMetadata)
    : {}
}

export const buildAmazonShippingCredentialsFromRow = (
  row?: Partial<CourierCredentialsRow> | null,
): AmazonShippingCredentials => {
  if (!row) return {}

  const metadata = getMetadata(row as Pick<CourierCredentialsRow, 'metadata'> | null)
  const sandbox =
    metadata.sandbox !== undefined
      ? parseAmazonSandboxFlag(metadata.sandbox)
      : row?.webhookSecret
        ? parseAmazonSandboxFlag(row.webhookSecret)
        : undefined

  const tokens = normalizeAmazonCredentialTokens({
    accessToken: metadata.accessToken,
    refreshToken: metadata.refreshToken || row?.apiKey,
  })

  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    lwaClientId: normalizeAmazonCredentialValue(metadata.lwaClientId || row?.clientId),
    lwaClientSecret: normalizeAmazonCredentialValue(metadata.lwaClientSecret || row?.password),
    endpoint: normalizeAmazonCredentialValue(metadata.endpoint || row?.apiBase),
    region: normalizeAmazonCredentialValue(metadata.region || row?.username || AMAZON_DEFAULT_REGION),
    sandbox,
    shippingBusinessId: normalizeAmazonCredentialValue(
      metadata.shippingBusinessId || row?.clientName || AMAZON_DEFAULT_BUSINESS_ID,
    ),
    lwaTokenUrl: normalizeAmazonCredentialValue(metadata.lwaTokenUrl),
  }
}

export const buildAmazonShippingCredentialsFromEnv = (
  env: EnvSource = process.env,
): AmazonShippingCredentials => {
  const tokens = normalizeAmazonCredentialTokens({
    accessToken: env.AMAZON_SHIPPING_ACCESS_TOKEN,
    refreshToken: env.AMAZON_SHIPPING_REFRESH_TOKEN,
  })

  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    lwaClientId: normalizeAmazonCredentialValue(
      env.AMAZON_SHIPPING_LWA_CLIENT_ID || env.AMAZON_LWA_CLIENT_ID,
    ),
    lwaClientSecret: normalizeAmazonCredentialValue(
      env.AMAZON_SHIPPING_LWA_CLIENT_SECRET || env.AMAZON_LWA_CLIENT_SECRET,
    ),
    endpoint: normalizeAmazonCredentialValue(env.AMAZON_SHIPPING_API_BASE),
    region: normalizeAmazonCredentialValue(env.AMAZON_SHIPPING_REGION),
    sandbox:
      env.AMAZON_SHIPPING_SANDBOX === undefined
        ? undefined
        : parseAmazonSandboxFlag(env.AMAZON_SHIPPING_SANDBOX),
    shippingBusinessId: normalizeAmazonCredentialValue(env.AMAZON_SHIPPING_BUSINESS_ID),
    lwaTokenUrl: normalizeAmazonCredentialValue(
      env.AMAZON_SHIPPING_LWA_TOKEN_URL || env.AMAZON_LWA_TOKEN_URL,
    ),
  }
}

export const mergeAmazonShippingCredentials = (
  base: AmazonShippingCredentials,
  override: AmazonShippingCredentials,
): AmazonShippingCredentials => {
  const merged: AmazonShippingCredentials = { ...base }
  const stringKeys: Array<keyof AmazonShippingCredentials> = [
    'accessToken',
    'refreshToken',
    'lwaClientId',
    'lwaClientSecret',
    'endpoint',
    'region',
    'shippingBusinessId',
    'idempotencyKey',
    'lwaTokenUrl',
  ]

  stringKeys.forEach((key) => {
    const value = normalizeAmazonCredentialValue(override[key])
    if (value) {
      ;(merged as Record<string, unknown>)[key] = value
    }
  })

  if (override.sandbox !== undefined) merged.sandbox = override.sandbox
  if (override.useDirectAccessToken !== undefined) {
    merged.useDirectAccessToken = override.useDirectAccessToken
  }

  const tokens = normalizeAmazonCredentialTokens({
    accessToken: merged.accessToken,
    refreshToken: merged.refreshToken,
  })
  merged.accessToken = tokens.accessToken
  merged.refreshToken = tokens.refreshToken

  return merged
}

export const mergeAmazonShippingCredentialsWithEnv = (
  credentials: AmazonShippingCredentials,
  env: EnvSource = process.env,
) => mergeAmazonShippingCredentials(credentials, buildAmazonShippingCredentialsFromEnv(env))

export const getStoredAmazonShippingCredentials = async (): Promise<AmazonShippingCredentials> => {
  const { db } = await import('../client')
  const [row] = await db
    .select()
    .from(courier_credentials)
    .where(eq(courier_credentials.provider, AMAZON_CREDENTIALS_PROVIDER))
    .limit(1)

  return mergeAmazonShippingCredentialsWithEnv(buildAmazonShippingCredentialsFromRow(row))
}

export const applyAmazonShippingCredentialsToEnv = (
  credentials: AmazonShippingCredentials,
  options: { overwriteExisting?: boolean } = {},
) => {
  const mappings: Array<[keyof AmazonShippingCredentials, string]> = [
    ['accessToken', 'AMAZON_SHIPPING_ACCESS_TOKEN'],
    ['refreshToken', 'AMAZON_SHIPPING_REFRESH_TOKEN'],
    ['lwaClientId', 'AMAZON_SHIPPING_LWA_CLIENT_ID'],
    ['lwaClientSecret', 'AMAZON_SHIPPING_LWA_CLIENT_SECRET'],
    ['endpoint', 'AMAZON_SHIPPING_API_BASE'],
    ['region', 'AMAZON_SHIPPING_REGION'],
    ['shippingBusinessId', 'AMAZON_SHIPPING_BUSINESS_ID'],
    ['lwaTokenUrl', 'AMAZON_SHIPPING_LWA_TOKEN_URL'],
  ]

  mappings.forEach(([key, envKey]) => {
    const value = normalizeAmazonCredentialValue(credentials[key])
    if (value && (options.overwriteExisting || !normalizeAmazonCredentialValue(process.env[envKey]))) {
      process.env[envKey] = value
    }
  })

  if (
    credentials.sandbox !== undefined &&
    (options.overwriteExisting ||
      !normalizeAmazonCredentialValue(process.env.AMAZON_SHIPPING_SANDBOX))
  ) {
    process.env.AMAZON_SHIPPING_SANDBOX = String(Boolean(credentials.sandbox))
  }
}
