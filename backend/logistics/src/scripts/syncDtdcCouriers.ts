import * as dotenv from 'dotenv'
import * as path from 'path'
import { Pool, PoolClient } from 'pg'

const DTDC_PROVIDER = 'dtdc'
const DEFAULT_DTDC_BASE = 'https://blktracksvc.dtdc.com'

const DTDC_COURIERS = [
  { id: 4001, name: 'DTDC Surface', mode: 'surface' },
  { id: 4002, name: 'DTDC Air', mode: 'air' },
] as const

const normalize = (value: unknown) => String(value || '').trim()

const normalizeBaseUrl = (value: unknown) => normalize(value).replace(/\/+$/, '') || DEFAULT_DTDC_BASE

const loadEnv = () => {
  const env = process.env.NODE_ENV || 'development'
  dotenv.config({ path: path.resolve(__dirname, `../../.env.${env}`) })
}

const requiredEnv = (key: string) => {
  const value = normalize(process.env[key])
  if (!value) throw new Error(`${key} is required`)
  return value
}

const upsertDtdcCredentials = async (
  client: PoolClient,
  config: {
    apiBase: string
    bookingApiBase: string
    cancelApiBase: string
    clientName: string
    username: string
    password: string
    customerCode: string
    serviceTypeId: string
    commodityId: string
    hubCode: string
    pickupVendorCode: string
    accessToken: string
    trackingToken: string
  },
) => {
  if (!config.accessToken && (!config.username || !config.password) && !config.customerCode) return false

  await client.query(
    `insert into courier_credentials
       (provider, api_base, client_name, username, password, api_key, metadata, created_at, updated_at)
     values ($1, $2, $3, $4, $5, $6, $7::jsonb, now(), now())
     on conflict (provider) do update set
       api_base = excluded.api_base,
       client_name = excluded.client_name,
       username = case when excluded.username <> '' then excluded.username else courier_credentials.username end,
       password = case when excluded.password <> '' then excluded.password else courier_credentials.password end,
       api_key = case when excluded.api_key <> '' then excluded.api_key else courier_credentials.api_key end,
       metadata = courier_credentials.metadata || excluded.metadata,
       updated_at = now()`,
    [
      DTDC_PROVIDER,
      config.apiBase,
      config.clientName,
      config.username,
      config.password,
      config.accessToken,
      JSON.stringify({
        cancelApiBase: config.cancelApiBase,
        bookingApiBase: config.bookingApiBase,
        customerCode: config.customerCode,
        serviceTypeId: config.serviceTypeId,
        commodityId: config.commodityId,
        hubCode: config.hubCode,
        pickupVendorCode: config.pickupVendorCode,
        trackingToken: config.trackingToken,
      }),
    ],
  )

  return true
}

const upsertDtdcCouriers = async (client: PoolClient) => {
  for (const courier of DTDC_COURIERS) {
    await client.query(
      `insert into couriers (id, name, "serviceProvider", "isEnabled", business_type, created_at, updated_at)
       values ($1, $2, $3, true, '["b2c"]'::jsonb, now(), now())
       on conflict (id, "serviceProvider") do update set
         name = excluded.name,
         "isEnabled" = true,
         business_type = '["b2c"]'::jsonb,
         updated_at = now()`,
      [courier.id, courier.name, DTDC_PROVIDER],
    )
  }
}

const propagateDtdcRatesToActiveB2CPlans = async (client: PoolClient) => {
  const baselinePlan = await client.query<{ plan_id: string }>(
    `select sr.plan_id
       from shipping_rates sr
       join plans p on p.id = sr.plan_id
      where lower(coalesce(sr.service_provider, '')) = $1
        and lower(coalesce(sr.business_type, '')) = 'b2c'
        and lower(coalesce(p.business_type, '')) = 'b2c'
      group by sr.plan_id
      order by count(*) desc
      limit 1`,
    [DTDC_PROVIDER],
  )

  const sourcePlanId = baselinePlan.rows[0]?.plan_id
  if (!sourcePlanId) {
    return {
      sourcePlanId: null,
      plansBackfilled: 0,
      ratesBackfilled: 0,
      slabsBackfilled: 0,
      configsBackfilled: 0,
    }
  }

  const ratesResult = await client.query<{
    target_plan_id: string
    source_rate_id: string
    new_rate_id: string
  }>(
    `with target_plans as (
       select p.id as plan_id
         from plans p
        where lower(coalesce(p.business_type, '')) = 'b2c'
          and coalesce(p.is_active, true) = true
          and not exists (
            select 1
              from shipping_rates existing
             where existing.plan_id = p.id
               and lower(coalesce(existing.business_type, '')) = 'b2c'
               and lower(coalesce(existing.service_provider, '')) = $1
          )
     ),
     source_rates as (
       select *
         from shipping_rates
        where plan_id = $2
          and lower(coalesce(business_type, '')) = 'b2c'
          and lower(coalesce(service_provider, '')) = $1
     ),
     inserted as (
       insert into shipping_rates
         (plan_id, service_provider, cod_charges, cod_percent, other_charges, rate,
          last_updated, courier_id, courier_name, mode, business_type, min_weight, zone_id, type, created_at)
       select tp.plan_id, sr.service_provider, sr.cod_charges, sr.cod_percent, sr.other_charges, sr.rate,
              now(), sr.courier_id, sr.courier_name, sr.mode, sr.business_type, sr.min_weight, sr.zone_id, sr.type, now()
         from target_plans tp
         cross join source_rates sr
       returning id, plan_id, courier_id, courier_name, mode, type, zone_id, min_weight
     )
     select inserted.plan_id as target_plan_id, sr.id as source_rate_id, inserted.id as new_rate_id
       from inserted
       join source_rates sr
         on sr.courier_id = inserted.courier_id
        and sr.courier_name = inserted.courier_name
        and sr.mode = inserted.mode
        and sr.type = inserted.type
        and sr.zone_id = inserted.zone_id
        and sr.min_weight = inserted.min_weight`,
    [DTDC_PROVIDER, sourcePlanId],
  )

  let slabsBackfilled = 0
  for (const row of ratesResult.rows) {
    const insertedSlabs = await client.query(
      `insert into shipping_rate_slabs
         (shipping_rate_id, weight_from, weight_to, rate, extra_rate, extra_weight_unit, created_at, updated_at)
       select $1, weight_from, weight_to, rate, extra_rate, extra_weight_unit, now(), now()
         from shipping_rate_slabs
        where shipping_rate_id = $2`,
      [row.new_rate_id, row.source_rate_id],
    )
    slabsBackfilled += insertedSlabs.rowCount ?? 0
  }

  const configsResult = await client.query(
    `with target_plans as (
       select p.id as plan_id
         from plans p
        where lower(coalesce(p.business_type, '')) = 'b2c'
          and coalesce(p.is_active, true) = true
          and not exists (
            select 1
              from kourier_boyz_b2c_courier_rate_configs existing
             where existing.plan_id = p.id
               and lower(coalesce(existing.service_provider, '')) = $1
          )
     )
     insert into kourier_boyz_b2c_courier_rate_configs
       (plan_id, courier_id, service_provider, mode, use_shipping_charge_api,
        fsc_percentage, minimum_cod_charge, cod_charge_percentage, to_pay_charge,
        minimum_ras_charge, ras_charge_per_kg, minimum_critical_pickup_charge,
        critical_pickup_charge_per_kg, minimum_critical_delivery_charge,
        critical_delivery_charge_per_kg, addition_rules, created_at, updated_at)
     select tp.plan_id, cfg.courier_id, cfg.service_provider, cfg.mode, cfg.use_shipping_charge_api,
            cfg.fsc_percentage, cfg.minimum_cod_charge, cfg.cod_charge_percentage, cfg.to_pay_charge,
            cfg.minimum_ras_charge, cfg.ras_charge_per_kg, cfg.minimum_critical_pickup_charge,
            cfg.critical_pickup_charge_per_kg, cfg.minimum_critical_delivery_charge,
            cfg.critical_delivery_charge_per_kg, cfg.addition_rules, now(), now()
       from target_plans tp
       join kourier_boyz_b2c_courier_rate_configs cfg
         on cfg.plan_id = $2
        and lower(coalesce(cfg.service_provider, '')) = $1
     on conflict (plan_id, courier_id, service_provider, mode) do nothing`,
    [DTDC_PROVIDER, sourcePlanId],
  )

  const plansBackfilled = new Set(ratesResult.rows.map((row) => row.target_plan_id)).size
  return {
    sourcePlanId,
    plansBackfilled,
    ratesBackfilled: ratesResult.rowCount ?? 0,
    slabsBackfilled,
    configsBackfilled: configsResult.rowCount ?? 0,
  }
}

const normalizeDtdcSlabContinuations = async (client: PoolClient) => {
  const result = await client.query(
    `with latest_finite_slab as (
       select distinct on (s.shipping_rate_id)
              s.id,
              s.rate
         from shipping_rate_slabs s
         join shipping_rates sr on sr.id = s.shipping_rate_id
        where lower(coalesce(sr.service_provider, '')) = $1
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
        set extra_rate = coalesce(s.extra_rate, latest_finite_slab.rate),
            extra_weight_unit = coalesce(s.extra_weight_unit, 0.500),
            updated_at = now()
       from latest_finite_slab
      where s.id = latest_finite_slab.id
        and (s.extra_rate is null or s.extra_weight_unit is null)`,
    [DTDC_PROVIDER],
  )

  return result.rowCount ?? 0
}

async function main() {
  loadEnv()

  const databaseUrl = requiredEnv('DATABASE_URL')
  const config = {
    apiBase: normalizeBaseUrl(process.env.DTDC_API_BASE),
    bookingApiBase: normalizeBaseUrl(process.env.DTDC_BOOKING_API_BASE || process.env.DTDC_SOFTDATA_API_BASE || 'https://dtdcapi.shipsy.io'),
    cancelApiBase: normalizeBaseUrl(process.env.DTDC_CANCEL_API_BASE || 'https://dtdcapi.shipsy.io'),
    clientName: normalize(process.env.DTDC_CLIENT_NAME),
    username: normalize(process.env.DTDC_USERNAME),
    password: normalize(process.env.DTDC_PASSWORD),
    customerCode: normalize(process.env.DTDC_CUSTOMER_CODE),
    serviceTypeId: normalize(process.env.DTDC_SERVICE_TYPE_ID) || 'B2C PRIORITY',
    commodityId: normalize(process.env.DTDC_COMMODITY_ID) || '99',
    hubCode: normalize(process.env.DTDC_HUB_CODE),
    pickupVendorCode: normalize(process.env.DTDC_PICKUP_VENDOR_CODE),
    accessToken: normalize(process.env.DTDC_ACCESS_TOKEN || process.env.DTDC_API_KEY),
    trackingToken: normalize(process.env.DTDC_TRACKING_TOKEN),
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  })

  const client = await pool.connect()
  try {
    await client.query('begin')
    const credentialsSaved = await upsertDtdcCredentials(client, config)
    await upsertDtdcCouriers(client)
    const ratePropagation = await propagateDtdcRatesToActiveB2CPlans(client)
    const slabsNormalized = await normalizeDtdcSlabContinuations(client)
    await client.query('commit')

    console.log(
      JSON.stringify(
        {
          provider: DTDC_PROVIDER,
          apiBase: config.apiBase,
          bookingApiBase: config.bookingApiBase,
          cancelApiBase: config.cancelApiBase,
          clientName: config.clientName || null,
          credentialsSaved,
          usernameConfigured: Boolean(config.username),
          passwordConfigured: Boolean(config.password),
          customerCodeConfigured: Boolean(config.customerCode),
          serviceTypeId: config.serviceTypeId,
          commodityId: config.commodityId,
          hubCodeConfigured: Boolean(config.hubCode),
          pickupVendorCodeConfigured: Boolean(config.pickupVendorCode),
          accessTokenConfigured: Boolean(config.accessToken),
          trackingTokenConfigured: Boolean(config.trackingToken),
          couriers: DTDC_COURIERS.map(({ id, name, mode }) => ({ id, name, mode })),
          ratePropagation,
          slabsNormalized,
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
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
