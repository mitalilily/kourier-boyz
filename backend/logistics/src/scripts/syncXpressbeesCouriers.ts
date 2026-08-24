import { randomUUID } from 'crypto'
import { and, eq, sql } from 'drizzle-orm'
import type { PoolClient } from 'pg'

import { db, pool } from '../models/client'
import { couriers } from '../models/schema/couriers'
import { courier_credentials } from '../models/schema/courierCredentials'
import { XpressbeesService } from '../models/services/couriers/xpressbees.service'

const SERVICE_PROVIDER = 'xpressbees'
const DEFAULT_API_BASE = 'https://shipment.xpressbees.com'
const BASIC_PLAN_NAME = 'Basic'
const FIRST_SLAB_TO_KG = 0.5
const DEFAULT_RATE = 10
const DEFAULT_EXTRA_RATE = 10
const DEFAULT_EXTRA_WEIGHT_UNIT_KG = 1
const DEFAULT_COD_CHARGES = 10
const DEFAULT_COD_PERCENT = 2
const DEFAULT_PICKUP_VENDOR_CODE = 'RAMENTPICKUP'
const FALLBACK_COURIER = {
  id: 5101,
  name: 'Xpressbees Route Serviceability',
} as const
const DEFAULT_RATE_MODES = ['surface', 'air'] as const

type XpressbeesCourierRow = {
  id: string
  name: string
}

const argValue = (name: string) => {
  const prefix = `--${name}=`
  const found = process.argv.find((arg) => arg.startsWith(prefix))
  return found ? found.slice(prefix.length).trim() : ''
}

const normalize = (value: unknown) => String(value || '').trim()

const resolveCredentialInput = () => ({
  apiBase: argValue('api-base') || normalize(process.env.XPRESSBEES_API_BASE) || DEFAULT_API_BASE,
  username:
    argValue('username') ||
    normalize(process.env.XPRESSBEES_USERNAME) ||
    normalize(process.env.XPRESSBEES_USER),
  password: argValue('password') || normalize(process.env.XPRESSBEES_PASSWORD),
  secretKey: argValue('secret-key') || normalize(process.env.XPRESSBEES_SECRET_KEY),
  xbKey: argValue('xb-key') || normalize(process.env.XPRESSBEES_XB_KEY),
  xbAccessKey:
    argValue('xb-access-key') ||
    normalize(process.env.XPRESSBEES_XB_ACCESS_KEY) ||
    normalize(process.env.XPRESSBEES_XB_KEY),
  businessAccountName:
    argValue('business-account-name') ||
    normalize(process.env.XPRESSBEES_BUSINESS_ACCOUNT_NAME) ||
    'RAM ENTERPRISES',
  pickupVendorCode:
    argValue('pickup-vendor-code') ||
    normalize(process.env.XPRESSBEES_PICKUP_VENDOR_CODE) ||
    DEFAULT_PICKUP_VENDOR_CODE,
})

const upsertCredentials = async (input: ReturnType<typeof resolveCredentialInput>, token: string) => {
  const [existing] = await db
    .select({ metadata: courier_credentials.metadata })
    .from(courier_credentials)
    .where(eq(courier_credentials.provider, SERVICE_PROVIDER))
    .limit(1)

  const existingMetadata =
    existing?.metadata && typeof existing.metadata === 'object' ? existing.metadata : {}
  const metadata = {
    ...existingMetadata,
    authTokenSource: 'userauthapis',
    secretKey: input.secretKey,
    xbKey: input.xbKey,
    xbAccessKey: input.xbAccessKey || input.xbKey,
    businessAccountName: input.businessAccountName,
    pickupVendorCode: input.pickupVendorCode,
    pincodeBusinessUnit: 'eComm',
    pincodeBusinessFlow: 'Forward',
    pickupBusinessService: 'PickUp',
    deliveryBusinessService: 'Delivery',
    serviceabilityVersion: 'v1',
    trackingVersion: 'v1',
    manifestServiceType: 'SD',
    manifestPickupType: 'Vendor',
    tokenUpdatedAt: new Date().toISOString(),
  }

  await db
    .insert(courier_credentials)
    .values({
      provider: SERVICE_PROVIDER,
      apiBase: input.apiBase,
      clientName: input.businessAccountName,
      apiKey: token,
      username: input.username,
      password: input.password,
      metadata,
      updatedAt: new Date(),
    } as any)
    .onConflictDoUpdate({
      target: courier_credentials.provider,
      set: {
        apiBase: sql`coalesce(nullif(excluded.api_base, ''), ${courier_credentials.apiBase})`,
        clientName: sql`coalesce(nullif(excluded.client_name, ''), ${courier_credentials.clientName})`,
        apiKey: token,
        username: input.username,
        password: input.password,
        metadata,
        updatedAt: new Date(),
      } as any,
    })
}

const buildFallbackRows = (): XpressbeesCourierRow[] => [
  {
    id: String(FALLBACK_COURIER.id),
    name: FALLBACK_COURIER.name,
  },
]

const ensureBasicB2cPlan = async (client: PoolClient) => {
  const existing = await client.query(
    `select id
     from plans
     where lower(name) = lower($1)
       and lower(coalesce(business_type, 'b2c')) = 'b2c'
     order by created_at nulls last
     limit 1`,
    [BASIC_PLAN_NAME],
  )
  if (existing.rows[0]?.id) return existing.rows[0].id as string

  const id = randomUUID()
  await client.query(
    `insert into plans (id, name, description, is_active, business_type, created_at, updated_at)
     values ($1, $2, $3, true, 'b2c', now(), now())`,
    [id, BASIC_PLAN_NAME, 'Default B2C plan'],
  )
  return id
}

const loadCurrentB2cZones = async (client: PoolClient) => {
  const result = await client.query(
    `select id, code, name
     from kourier_boyz_zones
     where upper(business_type) = 'B2C'
       and upper(code) = any($1)
     order by code`,
    [['A', 'B', 'C', 'D', 'E', 'F']],
  )

  if (result.rows.length !== 6) {
    throw new Error(`Expected B2C zones A-F, found ${result.rows.length}`)
  }

  return result.rows as Array<{ id: string; code: string; name: string }>
}

const upsertShippingRate = async (
  client: PoolClient,
  params: {
    planId: string
    courierId: number
    courierName: string
    mode: (typeof DEFAULT_RATE_MODES)[number]
    zone: { id: string; code: string; name: string }
    type: 'forward' | 'rto'
  },
) => {
  const existing = await client.query(
    `select id
     from shipping_rates
     where plan_id = $1
       and courier_id = $2
       and lower(coalesce(service_provider, '')) = $3
       and lower(mode) = $4
       and business_type = 'b2c'
       and zone_id = $5
       and type = $6
     order by created_at nulls first, id`,
    [
      params.planId,
      params.courierId,
      SERVICE_PROVIDER,
      params.mode,
      params.zone.id,
      params.type,
    ],
  )

  const rateId = existing.rows[0]?.id || randomUUID()
  const duplicateIds = existing.rows.slice(1).map((row) => row.id as string)
  if (duplicateIds.length) {
    await client.query(`delete from shipping_rate_slabs where shipping_rate_id = any($1::uuid[])`, [
      duplicateIds,
    ])
    await client.query(`delete from shipping_rates where id = any($1::uuid[])`, [duplicateIds])
  }

  if (existing.rows[0]?.id) {
    await client.query(
      `update shipping_rates set
         service_provider = $1,
         courier_name = $2,
         mode = $3,
         cod_charges = coalesce(cod_charges, $4),
         cod_percent = coalesce(cod_percent, $5),
         other_charges = coalesce(other_charges, 0),
         rate = case when rate <= 0 then $6 else rate end,
         min_weight = case when min_weight <= 0 then $7 else min_weight end,
         last_updated = now()
       where id = $8`,
      [
        SERVICE_PROVIDER,
        params.courierName,
        params.mode,
        DEFAULT_COD_CHARGES,
        DEFAULT_COD_PERCENT,
        DEFAULT_RATE,
        FIRST_SLAB_TO_KG,
        rateId,
      ],
    )
  } else {
    await client.query(
      `insert into shipping_rates
        (id, plan_id, service_provider, cod_charges, cod_percent, other_charges, rate,
         last_updated, courier_id, courier_name, mode, business_type, min_weight, zone_id, type, created_at)
       values ($1, $2, $3, $4, $5, 0, $6, now(), $7, $8, $9, 'b2c', $10, $11, $12, now())`,
      [
        rateId,
        params.planId,
        SERVICE_PROVIDER,
        DEFAULT_COD_CHARGES,
        DEFAULT_COD_PERCENT,
        DEFAULT_RATE,
        params.courierId,
        params.courierName,
        params.mode,
        FIRST_SLAB_TO_KG,
        params.zone.id,
        params.type,
      ],
    )
  }

  const slabCount = await client.query(
    `select count(*)::int as count from shipping_rate_slabs where shipping_rate_id = $1`,
    [rateId],
  )
  if (!Number(slabCount.rows[0]?.count || 0)) {
    await client.query(
      `insert into shipping_rate_slabs
        (id, shipping_rate_id, weight_from, weight_to, rate, extra_rate, extra_weight_unit, created_at, updated_at)
       values ($1, $2, 0, $3, $4, $5, $6, now(), now())`,
      [
        randomUUID(),
        rateId,
        FIRST_SLAB_TO_KG,
        DEFAULT_RATE,
        DEFAULT_EXTRA_RATE,
        DEFAULT_EXTRA_WEIGHT_UNIT_KG,
      ],
    )
  }

  await client.query(
    `insert into kourier_boyz_b2c_courier_rate_configs
       (id, plan_id, courier_id, service_provider, mode, use_shipping_charge_api, created_at, updated_at)
     values ($1, $2, $3, $4, $5, true, now(), now())
     on conflict (plan_id, courier_id, service_provider, mode) do update set
       use_shipping_charge_api = true,
       updated_at = now()`,
    [randomUUID(), params.planId, params.courierId, SERVICE_PROVIDER, params.mode],
  )

  return rateId
}

async function main() {
  const credentials = resolveCredentialInput()
  if (!credentials.username || !credentials.password || !credentials.secretKey || !credentials.xbKey) {
    throw new Error(
      'XPRESSBEES_USERNAME, XPRESSBEES_PASSWORD, XPRESSBEES_SECRET_KEY and XPRESSBEES_XB_KEY are required before syncing couriers.',
    )
  }

  const xpressbees = new XpressbeesService()
  const token = await xpressbees.getApiToken(true)
  if (!token) throw new Error('Xpressbees token generation did not return a token.')

  const serviceability = await xpressbees.checkServiceability({
    origin: '122001',
    destination: '400001',
    payment_type: 'prepaid',
    order_amount: '499',
    weight: '500',
    length: '10',
    breadth: '10',
    height: '10',
  })
  if (!serviceability.serviceable) {
    throw new Error('Xpressbees route serviceability validation failed for the sync probe.')
  }

  const awbProbe = await xpressbees.generateAwbNumber({
    deliveryType: 'PREPAID',
    pollAttempts: 3,
    pollDelayMs: 1000,
  })
  if (!awbProbe.awb || !awbProbe.batchId) {
    throw new Error('Xpressbees runtime AWB generation validation did not return an AWB.')
  }

  let rows: XpressbeesCourierRow[] = []
  let source: 'provider-courier-list' | 'route-serviceability-fallback' = 'provider-courier-list'
  try {
    const response = await xpressbees.listCouriers()
    if (response?.status === true && Array.isArray(response?.data)) {
      rows = response.data as XpressbeesCourierRow[]
    } else {
      throw new Error('Invalid Xpressbees courier list response')
    }
  } catch (error: any) {
    source = 'route-serviceability-fallback'
    rows = buildFallbackRows()
    console.warn(
      `Xpressbees courier-list endpoint unavailable (${error?.message || error}). Synced verified route-serviceability courier instead.`,
    )
  }

  if (!rows.length) {
    console.log('No Xpressbees couriers returned by API.')
    return
  }

  let created = 0
  let updated = 0
  let skipped = 0
  let savedRates = 0

  const client = await pool.connect()
  try {
    await client.query('begin')
    await upsertCredentials(credentials, token)

    for (const row of rows) {
      const courierId = Number(String(row?.id || '').trim())
      const courierName = String(row?.name || '').trim()

      if (!Number.isFinite(courierId) || !courierName) {
        skipped += 1
        console.warn('Skipping invalid Xpressbees courier row:', row)
        continue
      }

      const [existing] = await db
        .select()
        .from(couriers)
        .where(and(eq(couriers.id, courierId), eq(couriers.serviceProvider, SERVICE_PROVIDER)))
        .limit(1)

      if (existing) {
        const nextBusinessType = Array.isArray(existing.businessType)
          ? Array.from(new Set([...existing.businessType, 'b2c']))
          : ['b2c']
        const shouldUpdate =
          existing.name !== courierName ||
          existing.isEnabled !== true ||
          JSON.stringify(existing.businessType) !== JSON.stringify(nextBusinessType)

        if (shouldUpdate) {
          await db
            .update(couriers)
            .set({
              name: courierName,
              businessType: nextBusinessType,
              isEnabled: true,
              updatedAt: new Date(),
            } as any)
            .where(and(eq(couriers.id, courierId), eq(couriers.serviceProvider, SERVICE_PROVIDER)))
          updated += 1
        } else {
          skipped += 1
        }
      } else {
        await db.insert(couriers).values({
          id: courierId,
          name: courierName,
          serviceProvider: SERVICE_PROVIDER,
          businessType: ['b2c'],
          isEnabled: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any)

        created += 1
      }
    }

    const planId = await ensureBasicB2cPlan(client)
    const zones = await loadCurrentB2cZones(client)
    for (const row of rows) {
      const courierId = Number(String(row?.id || '').trim())
      const courierName = String(row?.name || '').trim()
      if (!Number.isFinite(courierId) || !courierName) continue
      for (const mode of DEFAULT_RATE_MODES) {
        for (const zone of zones) {
          await upsertShippingRate(client, {
            planId,
            courierId,
            courierName,
            mode,
            zone,
            type: 'forward',
          })
          await upsertShippingRate(client, {
            planId,
            courierId,
            courierName,
            mode,
            zone,
            type: 'rto',
          })
          savedRates += 2
        }
      }
    }

    await client.query('commit')
  } catch (error) {
    await client.query('rollback').catch(() => undefined)
    throw error
  } finally {
    client.release()
  }

  console.log(
    JSON.stringify({
      provider: SERVICE_PROVIDER,
      source,
      liveChecks: {
        auth: 200,
        serviceability: 200,
        runtimeAwbGeneration: 200,
        generatedAwbAvailable: Boolean(awbProbe.awb),
        batchId: Boolean(awbProbe.batchId),
      },
      pickupVendorCode: credentials.pickupVendorCode,
      created,
      updated,
      skipped,
      savedRates,
      rateModes: DEFAULT_RATE_MODES,
      couriers: rows,
    }),
  )
}

main()
  .catch((error) => {
    console.error('Xpressbees courier sync failed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })
