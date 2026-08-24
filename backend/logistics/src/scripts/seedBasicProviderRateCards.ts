import { randomUUID } from 'crypto'
import * as dotenv from 'dotenv'
import * as path from 'path'
import { Pool, PoolClient } from 'pg'

const TARGET_PROVIDERS = ['delhivery', 'ekart', 'xpressbees', 'amazon', 'shadowfax'] as const
const BASIC_PLAN_NAME = 'Basic'
const RATE = 10
const COD_CHARGES = 10
const COD_PERCENT = 2
const EXTRA_RATE = 10
const EXTRA_WEIGHT_UNIT_KG = 1
const FIRST_SLAB_TO_KG = 0.5
const LOCAL_FALLBACK_DATABASE_URL = 'postgres://postgres@127.0.0.1:5432/kourier_boyz_logistics'

type Provider = (typeof TARGET_PROVIDERS)[number]

type CourierSeed = {
  id: number
  name: string
  serviceProvider: Provider
  mode: string
}

type ZoneRow = {
  id: string
  code: string
  name: string
}

type CourierRow = {
  id: number
  name: string
  serviceProvider: Provider
  mode: string
}

const loadEnv = () => {
  const env = process.env.NODE_ENV || 'development'
  dotenv.config({ path: path.resolve(__dirname, `../../.env.${env}`) })
}

const normalizeProvider = (value: unknown): Provider | null => {
  const raw = String(value || '').trim().toLowerCase()
  if (raw === 'delhivery') return 'delhivery'
  if (raw === 'ekart') return 'ekart'
  if (raw === 'xpressbees') return 'xpressbees'
  if (raw === 'amazon') return 'amazon'
  if (raw === 'shadowfax') return 'shadowfax'
  return null
}

const inferMode = (name: string, mode?: unknown) => {
  const raw = String(mode || '').trim().toLowerCase()
  if (raw === 'air' || raw === 'a' || raw === 'express') return 'air'
  if (raw === 'surface' || raw === 's' || raw === 'ground') return 'surface'
  return name.toLowerCase().includes('air') ? 'air' : 'surface'
}

const isXpressbeesAir = (name: string, mode?: unknown) =>
  inferMode(name, mode) === 'air' || name.toLowerCase().includes('air')

const isXpressbees2Kg = (name: string, mode?: unknown) =>
  !isXpressbeesAir(name, mode) &&
  !name.toLowerCase().includes('reverse') &&
  /\b2\s*(?:k\.?\s*g\.?|kg|kgs)\b/i.test(name)

const isXpressbeesRouteServiceability = (name: string) =>
  name.toLowerCase().includes('route serviceability')

const isSupportedProviderCourierSeed = (seed: CourierSeed) => {
  if (seed.serviceProvider === 'delhivery') {
    return seed.id === 99 || seed.id === 100
  }

  if (seed.serviceProvider === 'xpressbees') {
    return isXpressbees2Kg(seed.name, seed.mode) || isXpressbeesRouteServiceability(seed.name)
  }

  return !seed.name.toLowerCase().includes('reverse')
}

const tableExists = async (client: PoolClient, tableName: string) => {
  const { rows } = await client.query(
    `select 1 from information_schema.tables where table_schema = 'public' and table_name = $1 limit 1`,
    [tableName],
  )
  return rows.length > 0
}

const resolveZonesTable = async (client: PoolClient) => {
  for (const tableName of ['kourier_boyz_zones', 'zones']) {
    if (await tableExists(client, tableName)) return tableName
  }
  throw new Error('No zones table found. Expected kourier_boyz_zones or zones.')
}

const ensureBasicPlan = async (client: PoolClient) => {
  const existing = await client.query(
    `select id from plans where lower(name) = lower($1) order by created_at nulls last limit 1`,
    [BASIC_PLAN_NAME],
  )
  if (existing.rows[0]?.id) return existing.rows[0].id as string

  const id = randomUUID()
  await client.query(
    `insert into plans (id, name, description, is_active, created_at)
     values ($1, $2, $3, true, now())`,
    [id, BASIC_PLAN_NAME, 'Default B2C plan'],
  )
  return id
}

const ensureB2CZones = async (client: PoolClient, zonesTable: string): Promise<ZoneRow[]> => {
  const seeds = [
    {
      code: 'A',
      name: 'ZONE A',
      description: 'Within-city B2C lanes.',
      region: 'Zone A',
    },
    {
      code: 'B',
      name: 'ZONE B',
      description: 'Metro-to-metro B2C lanes.',
      region: 'Zone B',
    },
    {
      code: 'C',
      name: 'ZONE C',
      description: 'Regional or same-state B2C lanes.',
      region: 'Zone C',
    },
    {
      code: 'D',
      name: 'ZONE D',
      description: 'Rest-of-India B2C lanes.',
      region: 'Zone D',
    },
    {
      code: 'E',
      name: 'ZONE E',
      description: 'Special-region B2C lanes.',
      region: 'Zone E',
    },
    {
      code: 'F',
      name: 'ZONE F',
      description: 'ODA or remote B2C lanes.',
      region: 'Zone F',
    },
  ]

  for (const seed of seeds) {
    const existing = await client.query(
      `select id
       from ${zonesTable}
       where upper(business_type) = 'B2C'
         and lower(trim(code)) = lower($1)
       limit 1`,
      [seed.code],
    )

    if (existing.rows[0]?.id) {
      await client.query(
        `update ${zonesTable}
         set name = $1,
             description = $2,
             region = $3,
             updated_at = now()
         where id = $4`,
        [seed.name, seed.description, seed.region, existing.rows[0].id],
      )
    } else {
      await client.query(
        `insert into ${zonesTable}
          (id, code, name, description, region, business_type, metadata, states, created_at, updated_at)
         values ($1, $2, $3, $4, $5, 'B2C', '{}'::jsonb, '[]'::jsonb, now(), now())`,
        [randomUUID(), seed.code, seed.name, seed.description, seed.region],
      )
    }
  }

  const created = await client.query(
    `select id, code, name
     from ${zonesTable}
     where upper(business_type) = 'B2C'
       and code = any($1)
     order by code`,
    [seeds.map((seed) => seed.code)],
  )
  return created.rows
}

const loadTargetCouriers = async (client: PoolClient): Promise<CourierRow[]> => {
  const result = await client.query(
    `select c.id, c.name, c."serviceProvider"
     from couriers c
     inner join courier_credentials cc
       on lower(cc.provider) = lower(c."serviceProvider")
     where lower(c."serviceProvider") = any($1)
       and c."isEnabled" = true
       and c.business_type @> '["b2c"]'::jsonb
       and lower(c.name) not like '%reverse%'
       and (
         (lower(cc.provider) = 'delhivery'
           and length(trim(coalesce(cc.api_key, ''))) > 0
           and length(trim(coalesce(cc.client_name, ''))) > 0)
         or (lower(cc.provider) = 'ekart'
           and length(trim(coalesce(cc.client_id, ''))) > 0
           and length(trim(coalesce(cc.username, ''))) > 0
           and length(trim(coalesce(cc.password, ''))) > 0)
         or (lower(cc.provider) = 'xpressbees'
           and (length(trim(coalesce(cc.api_key, ''))) > 0
             or (length(trim(coalesce(cc.username, ''))) > 0
               and length(trim(coalesce(cc.password, ''))) > 0)))
         or (lower(cc.provider) = 'shadowfax'
           and length(trim(coalesce(cc.api_key, ''))) > 0)
         or (lower(cc.provider) = 'amazon'
           and (length(trim(coalesce(cc.metadata->>'accessToken', ''))) > 0
             or (length(trim(coalesce(cc.api_key, ''))) > 0
               and length(trim(coalesce(cc.client_id, ''))) > 0
               and length(trim(coalesce(cc.password, ''))) > 0)))
       )
     order by c."serviceProvider", c.id, c.name`,
    [TARGET_PROVIDERS],
  )

  return result.rows
    .map((row) => {
      const provider = normalizeProvider(row.serviceProvider)
      if (!provider) return null
      const seed = {
        id: Number(row.id),
        name: String(row.name),
        serviceProvider: provider,
        mode: inferMode(String(row.name)),
      }
      if (!isSupportedProviderCourierSeed(seed)) return null
      return {
        id: seed.id,
        name: seed.name,
        serviceProvider: seed.serviceProvider,
        mode: seed.mode,
      }
    })
    .filter(Boolean) as CourierRow[]
}

const deleteDuplicateRates = async (client: PoolClient, ids: string[]) => {
  if (!ids.length) return
  await client.query(`delete from shipping_rate_slabs where shipping_rate_id = any($1::uuid[])`, [ids])
  await client.query(`delete from shipping_rates where id = any($1::uuid[])`, [ids])
}

const upsertRate = async (
  client: PoolClient,
  params: {
    planId: string
    courier: CourierRow
    zone: ZoneRow
    type: 'forward' | 'rto'
  },
) => {
  const existing = await client.query(
    `select id
     from shipping_rates
     where courier_id = $1
       and plan_id = $2
       and business_type = 'b2c'
       and zone_id = $3
       and type = $4
       and lower(mode) = $5
       and lower(coalesce(service_provider, '')) = $6
     order by created_at nulls first, id`,
    [
      params.courier.id,
      params.planId,
      params.zone.id,
      params.type,
      params.courier.mode,
      params.courier.serviceProvider,
    ],
  )

  const rateId = existing.rows[0]?.id || randomUUID()
  const duplicateIds = existing.rows.slice(1).map((row) => row.id as string)
  await deleteDuplicateRates(client, duplicateIds)

  const codCharges = COD_CHARGES
  const codPercent = COD_PERCENT

  if (existing.rows[0]?.id) {
    await client.query(
      `update shipping_rates set
        service_provider = $1,
        cod_charges = coalesce(cod_charges, $2),
        cod_percent = coalesce(cod_percent, $3),
        other_charges = coalesce(other_charges, 0),
        rate = case when rate <= 0 then $4 else rate end,
        last_updated = now(),
        courier_name = $5,
        mode = $6,
        min_weight = case when min_weight <= 0 then $7 else min_weight end
       where id = $8`,
      [
        params.courier.serviceProvider,
        codCharges,
        codPercent,
        RATE,
        params.courier.name,
        params.courier.mode,
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
        params.courier.serviceProvider,
        codCharges,
        codPercent,
        RATE,
        params.courier.id,
        params.courier.name,
        params.courier.mode,
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
      [randomUUID(), rateId, FIRST_SLAB_TO_KG, RATE, EXTRA_RATE, EXTRA_WEIGHT_UNIT_KG],
    )
  }

  return rateId
}

async function main() {
  loadEnv()
  if (!process.env.DATABASE_URL && process.env.NODE_ENV === 'production') {
    throw new Error('DATABASE_URL is required to seed production provider rate cards')
  }
  const connectionString = process.env.DATABASE_URL || LOCAL_FALLBACK_DATABASE_URL
  const pool = new Pool({
    connectionString,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  })

  const client = await pool.connect()
  try {
    await client.query('begin')

    const zonesTable = await resolveZonesTable(client)
    const planId = await ensureBasicPlan(client)
    const zones = await ensureB2CZones(client, zonesTable)
    const couriers = await loadTargetCouriers(client)

    if (!couriers.length) {
      throw new Error('No enabled B2C couriers with configured provider credentials were found')
    }

    let savedRates = 0
    for (const courier of couriers) {
      for (const zone of zones) {
        await upsertRate(client, { planId, courier, zone, type: 'forward' })
        await upsertRate(client, { planId, courier, zone, type: 'rto' })
        savedRates += 2
      }
    }

    await client.query('commit')

    const byProvider = couriers.reduce<Record<string, number>>((acc, courier) => {
      acc[courier.serviceProvider] = (acc[courier.serviceProvider] || 0) + 1
      return acc
    }, {})

    console.log('Basic provider rate cards seeded successfully')
    console.log(
      JSON.stringify(
        {
          database: connectionString.replace(/:[^:@/]+@/, ':***@'),
          zonesTable,
          planId,
          zones: zones.length,
          couriers: byProvider,
          savedRates,
          slab: {
            weight_from: 0,
            weight_to: FIRST_SLAB_TO_KG,
            rate: RATE,
            extra_rate: EXTRA_RATE,
            extra_weight_unit: EXTRA_WEIGHT_UNIT_KG,
          },
          cod: { cod_charges: COD_CHARGES, cod_percent: COD_PERCENT },
        },
        null,
        2,
      ),
    )
  } catch (error) {
    await client.query('rollback').catch(() => undefined)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((error) => {
  console.error('Failed to seed Basic provider rate cards:', error)
  process.exit(1)
})
