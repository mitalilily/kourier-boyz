import axios from 'axios'
import { randomUUID } from 'crypto'
import * as dotenv from 'dotenv'
import * as path from 'path'
import { Pool, PoolClient } from 'pg'

const SERVICE_PROVIDER = 'innofulfill'
const DEFAULT_API_BASE = 'https://apis.innofulfill.com'
const BASIC_PLAN_NAME = 'Basic'
const FIRST_SLAB_TO_KG = 0.5
const DEFAULT_RATE = 10
const DEFAULT_EXTRA_RATE = 10
const DEFAULT_EXTRA_WEIGHT_UNIT_KG = 1
const DEFAULT_COD_CHARGES = 10
const DEFAULT_COD_PERCENT = 2
const REMOVED_INNOFULFILL_COURIER_IDS = [6103]

const INNOFULFILL_COURIERS = [
  {
    id: 6101,
    name: 'Shreemaruti ECOMM Surface',
    mode: 'surface',
    carrierName: 'innofulfill_ecomm',
    carrierId: '30d5f835-a63a-4125-b095-93b3098e4e3d',
  },
  {
    id: 6102,
    name: 'Shreemaruti ECOMM Air',
    mode: 'air',
    carrierName: 'innofulfill_ecomm',
    carrierId: '30d5f835-a63a-4125-b095-93b3098e4e3d',
  },
] as const

type LiveCheck = {
  name: string
  endpoint: string
  status: number | null
  ok: boolean
  message?: string | null
}

const normalize = (value: unknown) => String(value || '').trim()
const normalizeBaseUrl = (value: unknown) => normalize(value).replace(/\/+$/, '') || DEFAULT_API_BASE

const argValue = (name: string) => {
  const prefix = `--${name}=`
  const found = process.argv.find((arg) => arg.startsWith(prefix))
  return found ? found.slice(prefix.length).trim() : ''
}

const loadEnv = () => {
  const env = process.env.NODE_ENV || 'development'
  dotenv.config({ path: path.resolve(__dirname, `../../.env.${env}`) })
  dotenv.config({ path: path.resolve(__dirname, '../../.env') })
}

const requiredEnv = (key: string) => {
  const value = normalize(process.env[key])
  if (!value) throw new Error(`${key} is required`)
  return value
}

const publicMessage = (data: any) =>
  normalize(data?.message || data?.error || data?.ReturnMessage || data?.description || data?.detail) || null

const resolveCredentialInput = () => ({
  apiBase: normalizeBaseUrl(argValue('api-base') || process.env.INNOFULFILL_API_BASE),
  apiKey: argValue('api-key') || normalize(process.env.INNOFULFILL_API_KEY),
  username: argValue('username') || normalize(process.env.INNOFULFILL_USERNAME),
  password: argValue('password') || normalize(process.env.INNOFULFILL_PASSWORD),
  tenantId: argValue('tenant-id') || normalize(process.env.INNOFULFILL_TENANT_ID),
  userId: argValue('user-id') || normalize(process.env.INNOFULFILL_USER_ID),
  signinType: argValue('signin-type') || normalize(process.env.INNOFULFILL_SIGNIN_TYPE) || 'EMAIL',
  clientName: argValue('client-name') || normalize(process.env.INNOFULFILL_CLIENT_NAME) || 'Shreemaruti',
})

const innofulfillHeaders = (input: ReturnType<typeof resolveCredentialInput>) => ({
  'Content-Type': 'application/json',
  ...(input.apiKey ? { 'Api-Key': input.apiKey, 'api-key': input.apiKey } : {}),
  ...(input.tenantId ? { TenantId: input.tenantId, tenantid: input.tenantId } : {}),
})

const runLiveChecks = async (input: ReturnType<typeof resolveCredentialInput>) => {
  const checks: LiveCheck[] = []

  if (input.username && input.password && input.tenantId) {
    const login = await axios.post(
      `${input.apiBase}/auth/login`,
      {
        username: input.username,
        password: input.password,
        signinType: input.signinType,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          TenantId: input.tenantId,
          tenantid: input.tenantId,
        },
        timeout: 20000,
        validateStatus: () => true,
      },
    )

    checks.push({
      name: 'auth',
      endpoint: '/auth/login',
      status: login.status,
      ok: login.status >= 200 && login.status < 300,
      message: login.status >= 200 && login.status < 300 ? 'OK' : publicMessage(login.data),
    })
  }

  if (input.apiKey && input.tenantId) {
    for (const deliveryMode of ['SURFACE', 'AIR'] as const) {
      const response = await axios.post(
        `${input.apiBase}/gateway/ure/api/external/rate-calculation/calculate/v2`,
        {
          fromPincode: 110011,
          toPincode: 302017,
          serviceType: 'ECOMM',
          productType: 'ECOMM',
          weight: 0.5,
          length: 10,
          height: 10,
          width: 10,
          includeDefaultCharges: true,
          userOptions: {},
          filters: { delivery_mode: deliveryMode },
        },
        {
          headers: innofulfillHeaders(input),
          timeout: 20000,
          validateStatus: () => true,
        },
      )

      checks.push({
        name: `rate${deliveryMode[0]}${deliveryMode.slice(1).toLowerCase()}`,
        endpoint: '/gateway/ure/api/external/rate-calculation/calculate/v2',
        status: response.status,
        ok: response.status >= 200 && response.status < 300,
        message: response.status >= 200 && response.status < 300 ? 'OK' : publicMessage(response.data),
      })
    }
  }

  const failed = checks.filter((check) => !check.ok)
  if (failed.length) {
    throw new Error(
      `Shreemaruti live checks failed: ${failed
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

const upsertCredentials = async (
  client: PoolClient,
  input: ReturnType<typeof resolveCredentialInput>,
) => {
  await client.query(
    `insert into courier_credentials
       (provider, api_base, client_name, api_key, username, password, metadata, created_at, updated_at)
     values ($1, $2, $3, $4, $5, $6, $7::jsonb, now(), now())
     on conflict (provider) do update set
       api_base = excluded.api_base,
       client_name = excluded.client_name,
       api_key = excluded.api_key,
       username = excluded.username,
       password = excluded.password,
       metadata = courier_credentials.metadata || excluded.metadata,
       updated_at = now()`,
    [
      SERVICE_PROVIDER,
      input.apiBase,
      input.clientName,
      input.apiKey,
      input.username,
      input.password,
      JSON.stringify({
        apiBase: input.apiBase,
        apiKey: input.apiKey,
        username: input.username,
        password: input.password,
        tenantId: input.tenantId,
        userId: input.userId,
        signinType: input.signinType,
      }),
    ],
  )
}

const upsertCouriers = async (client: PoolClient) => {
  await client.query(
    `delete from shipping_rate_slabs
     where shipping_rate_id in (
       select id
       from shipping_rates
       where lower(coalesce(service_provider, '')) = $1
         and courier_id = any($2::int[])
     )`,
    [SERVICE_PROVIDER, REMOVED_INNOFULFILL_COURIER_IDS],
  )
  await client.query(
    `delete from shipping_rates
     where lower(coalesce(service_provider, '')) = $1
       and courier_id = any($2::int[])`,
    [SERVICE_PROVIDER, REMOVED_INNOFULFILL_COURIER_IDS],
  )
  await client.query(
    `delete from kourier_boyz_b2c_courier_rate_configs
     where lower(coalesce(service_provider, '')) = $1
       and courier_id = any($2::int[])`,
    [SERVICE_PROVIDER, REMOVED_INNOFULFILL_COURIER_IDS],
  )
  await client.query(
    `delete from couriers
     where lower("serviceProvider") = $1
       and id = any($2::int[])`,
    [SERVICE_PROVIDER, REMOVED_INNOFULFILL_COURIER_IDS],
  )

  for (const courier of INNOFULFILL_COURIERS) {
    await client.query(
      `insert into couriers (id, name, "serviceProvider", "isEnabled", business_type, created_at, updated_at)
       values ($1, $2, $3, true, '["b2c"]'::jsonb, now(), now())
       on conflict (id, "serviceProvider") do update set
         name = excluded.name,
         "isEnabled" = true,
         business_type = '["b2c"]'::jsonb,
         updated_at = now()`,
      [courier.id, courier.name, SERVICE_PROVIDER],
    )
  }
}

const upsertShippingRate = async (
  client: PoolClient,
  params: {
    planId: string
    courier: (typeof INNOFULFILL_COURIERS)[number]
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
      SERVICE_PROVIDER,
      params.courier.mode,
      params.zone.id,
      params.type,
    ],
  )

  const rateId = existing.rows[0]?.id || randomUUID()
  const duplicateIds = existing.rows.slice(1).map((row) => row.id as string)
  if (duplicateIds.length) {
    await client.query(`delete from shipping_rate_slabs where shipping_rate_id = any($1::uuid[])`, [duplicateIds])
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
        SERVICE_PROVIDER,
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
    [randomUUID(), params.planId, params.courier.id, SERVICE_PROVIDER, params.courier.mode],
  )

  return rateId
}

async function main() {
  loadEnv()

  const databaseUrl = requiredEnv('DATABASE_URL')
  const input = resolveCredentialInput()
  if (!input.apiKey || !input.tenantId || !input.userId || !input.username || !input.password) {
    throw new Error(
      'INNOFULFILL_API_KEY, INNOFULFILL_TENANT_ID, INNOFULFILL_USER_ID, INNOFULFILL_USERNAME and INNOFULFILL_PASSWORD are required before syncing couriers.',
    )
  }

  const liveChecks = await runLiveChecks(input)
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: process.env.NODE_ENV === 'production' && !databaseUrl.includes('localhost') ? { rejectUnauthorized: false } : false,
  })

  const client = await pool.connect()
  try {
    await client.query('begin')
    await upsertCredentials(client, input)
    await upsertCouriers(client)

    const planId = await ensureBasicB2cPlan(client)
    const zones = await loadCurrentB2cZones(client)

    let savedRates = 0
    for (const courier of INNOFULFILL_COURIERS) {
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
          provider: SERVICE_PROVIDER,
          apiBase: input.apiBase,
          credentials: {
            apiKey: Boolean(input.apiKey),
            tenantId: Boolean(input.tenantId),
            userId: Boolean(input.userId),
            username: Boolean(input.username),
            password: Boolean(input.password),
          },
          liveChecks,
          couriers: INNOFULFILL_COURIERS.map(({ id, name, mode, carrierName, carrierId }) => ({
            id,
            name,
            mode,
            carrierName,
            carrierId: Boolean(carrierId),
          })),
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
