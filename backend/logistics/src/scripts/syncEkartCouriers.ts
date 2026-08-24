import axios from 'axios'
import { randomUUID } from 'crypto'
import * as dotenv from 'dotenv'
import * as path from 'path'
import { Pool, PoolClient } from 'pg'

const EKART_PROVIDER = 'ekart'
const DEFAULT_EKART_BASE = 'https://app.elite.ekartlogistics.in'
const BASIC_PLAN_NAME = 'Basic'
const FIRST_SLAB_TO_KG = 0.5
const DEFAULT_RATE = 10
const DEFAULT_EXTRA_RATE = 10
const DEFAULT_EXTRA_WEIGHT_UNIT_KG = 1
const DEFAULT_COD_CHARGES = 10
const DEFAULT_COD_PERCENT = 2

const EKART_COURIERS = [
  { id: 3001, name: 'Ekart Surface', mode: 'surface' },
  { id: 3002, name: 'Ekart Express', mode: 'air' },
] as const

type LiveCheck = {
  name: string
  endpoint: string
  status: number | null
  ok: boolean
  message?: string | null
  count?: number | null
}

const normalize = (value: unknown) => String(value || '').trim()

const normalizeBaseUrl = (value: unknown) => normalize(value).replace(/\/+$/, '') || DEFAULT_EKART_BASE

const loadEnv = () => {
  const env = process.env.NODE_ENV || 'development'
  dotenv.config({ path: path.resolve(__dirname, `../../.env.${env}`) })
}

const requiredEnv = (key: string) => {
  const value = normalize(process.env[key])
  if (!value) throw new Error(`${key} is required`)
  return value
}

const publicAxiosMessage = (data: any) =>
  normalize(data?.message || data?.description || data?.error || data?.remark) || null

const runLiveChecks = async (config: {
  baseApi: string
  baseAuth: string
  clientId: string
  username: string
  password: string
}): Promise<LiveCheck[]> => {
  const checks: LiveCheck[] = []
  const authEndpoint = '/integrations/v2/auth/token/{clientId}'
  const authUrl = `${config.baseAuth}/integrations/v2/auth/token/${config.clientId}`
  const authResponse = await axios.post(
    authUrl,
    {
      username: config.username,
      password: config.password,
    },
    { timeout: 20000, validateStatus: () => true },
  )

  const accessToken = authResponse.data?.access_token
  checks.push({
    name: 'auth',
    endpoint: authEndpoint,
    status: authResponse.status,
    ok: authResponse.status === 200 && Boolean(accessToken),
    message: authResponse.status === 200 ? 'OK' : publicAxiosMessage(authResponse.data),
  })

  if (authResponse.status !== 200 || !accessToken) {
    throw new Error(`Ekart auth failed with status ${authResponse.status}: ${publicAxiosMessage(authResponse.data) || 'No access token'}`)
  }

  const request = async (name: string, method: 'get' | 'post', endpoint: string, data?: any) => {
    const response = await axios({
      method,
      url: `${config.baseApi}${endpoint}`,
      data,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 20000,
      validateStatus: () => true,
    })

    const responseData = response.data
    const count = Array.isArray(responseData)
      ? responseData.length
      : Array.isArray(responseData?.serviceability)
        ? responseData.serviceability.length
        : null

    checks.push({
      name,
      endpoint,
      status: response.status,
      ok: response.status === 200,
      message: response.status === 200 ? 'OK' : publicAxiosMessage(responseData),
      count,
    })
  }

  await request('pairServiceability', 'post', '/data/v3/serviceability', {
    pickupPincode: '560103',
    dropPincode: '110001',
    length: '10',
    height: '10',
    width: '10',
    weight: '0.5',
    paymentType: 'Prepaid',
    invoiceAmount: '499',
  })
  await request('bulkServiceability', 'get', '/data/serviceability/bulk/NON_LARGE?format=JSON')
  await request('addresses', 'get', '/api/v2/addresses')

  const failed = checks.filter((check) => !check.ok)
  if (failed.length) {
    throw new Error(
      `Ekart live checks failed: ${failed
        .map((check) => `${check.name}=${check.status || 'ERR'} ${check.message || ''}`.trim())
        .join(', ')}`,
    )
  }

  return checks
}

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

const upsertEkartCredentials = async (
  client: PoolClient,
  config: {
    baseApi: string
    baseAuth: string
    clientId: string
    username: string
    password: string
    clientName: string
  },
) => {
  await client.query(
    `insert into courier_credentials
       (provider, api_base, client_name, client_id, username, password, metadata, created_at, updated_at)
     values ($1, $2, $3, $4, $5, $6, $7::jsonb, now(), now())
     on conflict (provider) do update set
       api_base = excluded.api_base,
       client_name = excluded.client_name,
       client_id = excluded.client_id,
       username = excluded.username,
       password = excluded.password,
       metadata = courier_credentials.metadata || excluded.metadata,
       updated_at = now()`,
    [
      EKART_PROVIDER,
      config.baseApi,
      config.clientName,
      config.clientId,
      config.username,
      config.password,
      JSON.stringify({ baseAuth: config.baseAuth }),
    ],
  )
}

const upsertEkartCouriers = async (client: PoolClient) => {
  for (const courier of EKART_COURIERS) {
    await client.query(
      `insert into couriers (id, name, "serviceProvider", "isEnabled", business_type, created_at, updated_at)
       values ($1, $2, $3, true, '["b2c"]'::jsonb, now(), now())
       on conflict (id, "serviceProvider") do update set
         name = excluded.name,
         "isEnabled" = true,
         business_type = '["b2c"]'::jsonb,
         updated_at = now()`,
      [courier.id, courier.name, EKART_PROVIDER],
    )
  }
}

const upsertShippingRate = async (
  client: PoolClient,
  params: {
    planId: string
    courier: (typeof EKART_COURIERS)[number]
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
      params.courier.id,
      EKART_PROVIDER,
      params.courier.mode,
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
        EKART_PROVIDER,
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
       values ($1, $2, $3, $4, $5, 0, $6, now(), $7, $8, $9, 'b2c', $10, $11, $12, now())`,
      [
        rateId,
        params.planId,
        EKART_PROVIDER,
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
     values ($1, $2, $3, $4, $5, true, now(), now())
     on conflict (plan_id, courier_id, service_provider, mode) do update set
       use_shipping_charge_api = true,
       updated_at = now()`,
    [randomUUID(), params.planId, params.courier.id, EKART_PROVIDER, params.courier.mode],
  )

  return rateId
}

async function main() {
  loadEnv()

  const databaseUrl = requiredEnv('DATABASE_URL')
  const config = {
    clientId: requiredEnv('EKART_CLIENT_ID'),
    username: requiredEnv('EKART_USERNAME'),
    password: requiredEnv('EKART_PASSWORD'),
    clientName: normalize(process.env.EKART_CLIENT_NAME) || 'RAM ENTERPRISES',
    baseApi: normalizeBaseUrl(process.env.EKART_BASE_API),
    baseAuth: normalizeBaseUrl(process.env.EKART_BASE_AUTH || process.env.EKART_BASE_API),
  }

  const liveChecks = await runLiveChecks(config)
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  })

  const client = await pool.connect()
  try {
    await client.query('begin')
    await upsertEkartCredentials(client, config)
    await upsertEkartCouriers(client)

    const planId = await ensureBasicB2cPlan(client)
    const zones = await loadCurrentB2cZones(client)

    let savedRates = 0
    for (const courier of EKART_COURIERS) {
      for (const zone of zones) {
        await upsertShippingRate(client, { planId, courier, zone, type: 'forward' })
        await upsertShippingRate(client, { planId, courier, zone, type: 'rto' })
        savedRates += 2
      }
    }

    await client.query('commit')

    console.log(
      JSON.stringify(
        {
          provider: EKART_PROVIDER,
          clientName: config.clientName,
          baseApi: config.baseApi,
          credentials: {
            clientId: Boolean(config.clientId),
            username: Boolean(config.username),
            password: Boolean(config.password),
          },
          liveChecks,
          couriers: EKART_COURIERS.map(({ id, name, mode }) => ({ id, name, mode })),
          planId,
          zones: zones.map(({ code, name }) => ({ code, name })),
          savedRates,
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
