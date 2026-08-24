import axios from 'axios'
import { and, eq, notInArray, sql } from 'drizzle-orm'

import { db, pool } from '../models/client'
import { couriers } from '../models/schema/couriers'
import { courier_credentials } from '../models/schema/courierCredentials'
import { ensureDelhiveryB2BBasicPricing } from '../models/services/delhiveryB2BBasicBootstrap.service'
import { DELHIVERY_COURIER_IDS } from '../utils/delhiveryCourier'

const DEFAULT_LTL_API_BASE = 'https://ltl-clients-api.delhivery.com'
const DELHIVERY_B2B_LTL_COURIER = {
  id: DELHIVERY_COURIER_IDS.LTL,
  name: 'Delhivery B2B LTL',
  serviceProvider: 'delhivery',
} as const

const argValue = (name: string) => {
  const prefix = `--${name}=`
  const found = process.argv.find((arg) => arg.startsWith(prefix))
  return found ? found.slice(prefix.length).trim() : ''
}

const normalize = (value: unknown) => String(value || '').trim()

const normalizeTokenCandidate = (value: unknown) =>
  normalize(value).replace(/^Bearer\s+/i, '').trim()

const isLikelyToken = (value: string) => value.split('.').length === 3 || value.length > 80

const extractToken = (value: unknown): string => {
  if (!value) return ''
  if (typeof value === 'string') {
    const candidate = normalizeTokenCandidate(value)
    return isLikelyToken(candidate) ? candidate : ''
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      const token = extractToken(entry)
      if (token) return token
    }
    return ''
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    for (const key of [
      'token',
      'jwt',
      'bearerToken',
      'accessToken',
      'access_token',
      'id_token',
      'authToken',
      'auth_token',
    ]) {
      const token = extractToken(record[key])
      if (token) return token
    }
    for (const nested of Object.values(record)) {
      const token = extractToken(nested)
      if (token) return token
    }
  }
  return ''
}

const decodeJwtExpiryIso = (token: string) => {
  try {
    const [, payloadSegment] = token.split('.')
    if (!payloadSegment) return ''
    const normalized = payloadSegment.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
    const payload = JSON.parse(Buffer.from(padded, 'base64').toString('utf8')) as { exp?: number }
    if (!payload.exp || !Number.isFinite(payload.exp)) return ''
    return new Date(payload.exp * 1000).toISOString()
  } catch {
    return ''
  }
}

const resolveTokenExpiryIso = (token: string, response: unknown) => {
  if (response && typeof response === 'object' && !Array.isArray(response)) {
    const record = response as Record<string, unknown>
    for (const key of ['expiresAt', 'expires_at', 'expiry', 'expiryAt', 'tokenExpiry']) {
      const raw = normalize(record[key])
      const parsed = Date.parse(raw)
      if (raw && Number.isFinite(parsed)) return new Date(parsed).toISOString()
    }
  }

  return decodeJwtExpiryIso(token) || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
}

const loginDelhiveryLtl = async ({
  apiBase,
  username,
  password,
}: {
  apiBase: string
  username: string
  password: string
}) => {
  const endpoint = `${apiBase.replace(/\/+$/, '')}/ums/login`
  const response = await axios.post(
    endpoint,
    { username, password },
    {
      timeout: 30000,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      validateStatus: () => true,
    },
  )

  const token = extractToken(response.data)
  if (response.status < 200 || response.status >= 300 || !token) {
    const message =
      response.data?.error?.message ||
      response.data?.message ||
      response.data?.detail ||
      response.statusText ||
      'Delhivery LTL login failed'
    throw new Error(`Delhivery LTL login failed with HTTP ${response.status}: ${message}`)
  }

  return {
    endpoint,
    token,
    tokenExpiresAt: resolveTokenExpiryIso(token, response.data),
    providerResponseKeys:
      response.data && typeof response.data === 'object' ? Object.keys(response.data) : [],
  }
}

const main = async () => {
  const ltlApiBase =
    argValue('ltl-api-base') ||
    normalize(process.env.DELHIVERY_LTL_API_BASE) ||
    DEFAULT_LTL_API_BASE
  const ltlUsername =
    argValue('username') ||
    normalize(process.env.DELHIVERY_LTL_USERNAME) ||
    normalize(process.env.DELHIVERY_LTL_USER)
  const ltlPassword = argValue('password') || normalize(process.env.DELHIVERY_LTL_PASSWORD)

  if (!ltlUsername) {
    throw new Error('DELHIVERY_LTL_USERNAME or --username is required.')
  }
  if (!ltlPassword) {
    throw new Error('DELHIVERY_LTL_PASSWORD or --password is required.')
  }

  const login = await loginDelhiveryLtl({
    apiBase: ltlApiBase,
    username: ltlUsername,
    password: ltlPassword,
  })

  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ metadata: courier_credentials.metadata })
      .from(courier_credentials)
      .where(eq(courier_credentials.provider, 'delhivery'))
      .limit(1)

    const existingMetadata =
      existing?.metadata && typeof existing.metadata === 'object' ? existing.metadata : {}
    const credentialValues = {
      provider: 'delhivery',
      apiBase: normalize(process.env.DELHIVERY_API_BASE) || 'https://track.delhivery.com',
      clientName: normalize(process.env.DELHIVERY_CLIENT_NAME) || 'RAM ENTERPRISES',
      apiKey: normalize(process.env.DELHIVERY_API_KEY),
      metadata: {
        ...existingMetadata,
        ltlApiBase,
        ltlUsername,
        ltlPassword,
        ltlToken: login.token,
        ltlTokenExpiresAt: login.tokenExpiresAt,
        ltlTokenUpdatedAt: new Date().toISOString(),
      },
      updatedAt: new Date(),
    }

    await tx
      .insert(courier_credentials)
      .values(credentialValues as any)
      .onConflictDoUpdate({
        target: courier_credentials.provider,
        set: {
          apiBase: sql`coalesce(nullif(excluded.api_base, ''), ${courier_credentials.apiBase})`,
          clientName: sql`coalesce(nullif(excluded.client_name, ''), ${courier_credentials.clientName})`,
          apiKey: sql`coalesce(nullif(excluded.api_key, ''), ${courier_credentials.apiKey})`,
          metadata: credentialValues.metadata,
          updatedAt: new Date(),
        } as any,
      })

    await tx
      .insert(couriers)
      .values({
        id: DELHIVERY_B2B_LTL_COURIER.id,
        name: DELHIVERY_B2B_LTL_COURIER.name,
        serviceProvider: DELHIVERY_B2B_LTL_COURIER.serviceProvider,
        businessType: ['b2b'],
        isEnabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [couriers.id, couriers.serviceProvider],
        set: {
          name: DELHIVERY_B2B_LTL_COURIER.name,
          businessType: ['b2b'],
          isEnabled: true,
          updatedAt: new Date(),
        },
      })

    await tx
      .update(couriers)
      .set({
        businessType: sql`coalesce(${couriers.businessType}, '[]'::jsonb) - 'b2b'`,
        isEnabled: sql`case when coalesce(${couriers.businessType}, '[]'::jsonb) @> '["b2c"]'::jsonb then ${couriers.isEnabled} else false end`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(sql`lower(${couriers.serviceProvider})`, 'delhivery'),
          notInArray(couriers.id, [DELHIVERY_B2B_LTL_COURIER.id]),
          sql`coalesce(${couriers.businessType}, '[]'::jsonb) @> '["b2b"]'::jsonb`,
        ),
      )
  })

  const pricing = await ensureDelhiveryB2BBasicPricing({
    courierScope: {
      courierId: DELHIVERY_B2B_LTL_COURIER.id,
      serviceProvider: DELHIVERY_B2B_LTL_COURIER.serviceProvider,
    },
  })

  console.log(
    JSON.stringify({
      provider: 'delhivery',
      businessType: 'b2b',
      courier: DELHIVERY_B2B_LTL_COURIER,
      ltlApiBase,
      username: ltlUsername,
      loginStatus: 'ok',
      tokenExpiresAt: login.tokenExpiresAt,
      providerResponseKeys: login.providerResponseKeys,
      pricing,
    }),
  )
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })
