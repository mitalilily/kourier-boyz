import { randomUUID } from 'crypto'
import { and, eq, notInArray, sql } from 'drizzle-orm'
import type { PoolClient } from 'pg'
import { db, pool } from '../models/client'
import { getDelhiveryCredentials } from '../models/services/delhiveryCredentials.service'
import { getConfiguredCourierProviderSet } from '../models/services/courierCredentials.service'
import { couriers } from '../models/schema/couriers'
import { DELHIVERY_COURIER_IDS } from '../utils/delhiveryCourier'

const DELHIVERY_B2C_COURIERS = [
  {
    id: DELHIVERY_COURIER_IDS.EXPRESS,
    name: 'Delhivery Air',
    mode: 'air',
  },
  {
    id: DELHIVERY_COURIER_IDS.SURFACE,
    name: 'Delhivery Surface',
    mode: 'surface',
  },
] as const

const BASIC_PLAN_NAME = 'Basic'
const FIRST_SLAB_TO_KG = 0.5
const DEFAULT_RATE = 10
const DEFAULT_EXTRA_RATE = 10
const DEFAULT_EXTRA_WEIGHT_UNIT_KG = 1
const DEFAULT_COD_CHARGES = 10
const DEFAULT_COD_PERCENT = 2

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
    courier: (typeof DELHIVERY_B2C_COURIERS)[number]
    zone: { id: string; code: string; name: string }
    type: 'forward' | 'rto'
  },
) => {
  const existing = await client.query(
    `select id
     from shipping_rates
     where plan_id = $1
       and courier_id = $2
       and lower(coalesce(service_provider, '')) = 'delhivery'
       and lower(mode) = $3
       and business_type = 'b2c'
       and zone_id = $4
       and type = $5
     order by created_at nulls first, id`,
    [params.planId, params.courier.id, params.courier.mode, params.zone.id, params.type],
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
         service_provider = 'delhivery',
         courier_name = $1,
         mode = $2,
         cod_charges = coalesce(cod_charges, $3),
         cod_percent = coalesce(cod_percent, $4),
         other_charges = coalesce(other_charges, 0),
         rate = case when rate <= 0 then $5 else rate end,
         min_weight = case when min_weight <= 0 then $6 else min_weight end,
         last_updated = now()
       where id = $7`,
      [
        params.courier.name,
        params.courier.mode,
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
       values ($1, $2, 'delhivery', $3, $4, 0, $5, now(), $6, $7, $8, 'b2c', $9, $10, $11, now())`,
      [
        rateId,
        params.planId,
        DEFAULT_COD_CHARGES,
        DEFAULT_COD_PERCENT,
        DEFAULT_RATE,
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
     values ($1, $2, $3, 'delhivery', $4, true, now(), now())
     on conflict (plan_id, courier_id, service_provider, mode) do update set
       use_shipping_charge_api = true,
       updated_at = now()`,
    [randomUUID(), params.planId, params.courier.id, params.courier.mode],
  )

  return rateId
}

const normalizeDelhiverySlabContinuations = async (client: PoolClient) => {
  const result = await client.query(
    `with latest_finite_slab as (
       select distinct on (s.shipping_rate_id)
              s.id,
              s.rate
         from shipping_rate_slabs s
         join shipping_rates sr on sr.id = s.shipping_rate_id
        where lower(coalesce(sr.service_provider, '')) = 'delhivery'
          and lower(coalesce(sr.business_type, '')) = 'b2c'
          and s.weight_to is not null
          and not exists (
            select 1
              from shipping_rate_slabs open_slab
             where open_slab.shipping_rate_id = s.shipping_rate_id
               and open_slab.weight_to is null
          )
        order by s.shipping_rate_id, s.weight_to desc
     )
     update shipping_rate_slabs s
        set extra_rate = case
              when s.extra_rate is null or s.extra_rate <= 0 then latest_finite_slab.rate
              else s.extra_rate
            end,
            extra_weight_unit = case
              when s.extra_weight_unit is null or s.extra_weight_unit <= 0 then 0.500
              else s.extra_weight_unit
            end,
            updated_at = now()
       from latest_finite_slab
      where s.id = latest_finite_slab.id
        and (
          s.extra_rate is null or s.extra_rate <= 0 or
          s.extra_weight_unit is null or s.extra_weight_unit <= 0
        )`,
  )

  return result.rowCount ?? 0
}

const main = async () => {
  const configuredProviders = await getConfiguredCourierProviderSet()
  const credentials = await getDelhiveryCredentials()
  if (!configuredProviders.has('delhivery') || !credentials.apiKey || !credentials.clientName) {
    throw new Error(
      'Valid Delhivery B2C credentials (API key and exact client/HQ name) are required before syncing couriers',
    )
  }

  let savedRates = 0
  await db.transaction(async (tx) => {
    for (const courier of DELHIVERY_B2C_COURIERS) {
      await tx
        .insert(couriers)
        .values({
          id: courier.id,
          name: courier.name,
          serviceProvider: 'delhivery',
          businessType: ['b2c'],
          isEnabled: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [couriers.id, couriers.serviceProvider],
          set: {
            name: courier.name,
            businessType: ['b2c'],
            isEnabled: true,
            updatedAt: new Date(),
          },
        })
    }

    await tx
      .update(couriers)
      .set({
        businessType: sql`coalesce(${couriers.businessType}, '[]'::jsonb) - 'b2c'`,
        isEnabled: sql`case when coalesce(${couriers.businessType}, '[]'::jsonb) @> '["b2b"]'::jsonb then ${couriers.isEnabled} else false end`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(sql`lower(${couriers.serviceProvider})`, 'delhivery'),
          notInArray(
            couriers.id,
            DELHIVERY_B2C_COURIERS.map((courier) => courier.id),
          ),
          sql`coalesce(${couriers.businessType}, '[]'::jsonb) @> '["b2c"]'::jsonb`,
        ),
      )
  })

  const client = await pool.connect()
  try {
    await client.query('begin')
    const planId = await ensureBasicB2cPlan(client)
    const zones = await loadCurrentB2cZones(client)
    for (const courier of DELHIVERY_B2C_COURIERS) {
      for (const zone of zones) {
        await upsertShippingRate(client, { planId, courier, zone, type: 'forward' })
        await upsertShippingRate(client, { planId, courier, zone, type: 'rto' })
        savedRates += 2
      }
    }
    const slabsNormalized = await normalizeDelhiverySlabContinuations(client)
    await client.query(
      `delete from kourier_boyz_b2c_courier_rate_configs
       where lower(coalesce(service_provider, '')) = 'delhivery'
         and (
           (courier_id = $1 and lower(mode) <> 'air') or
           (courier_id = $2 and lower(mode) <> 'surface')
         )`,
      [DELHIVERY_COURIER_IDS.EXPRESS, DELHIVERY_COURIER_IDS.SURFACE],
    )
    await client.query('commit')
    console.log(
      JSON.stringify({
        provider: 'delhivery',
        slabContinuationsNormalized: slabsNormalized,
      }),
    )
  } catch (error) {
    await client.query('rollback').catch(() => undefined)
    throw error
  } finally {
    client.release()
  }

  console.log(
    JSON.stringify({
      provider: 'delhivery',
      clientName: credentials.clientName,
      couriers: DELHIVERY_B2C_COURIERS,
      savedRates,
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
