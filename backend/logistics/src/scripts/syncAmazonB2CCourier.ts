import * as dotenv from 'dotenv'
import * as path from 'path'
import { Pool } from 'pg'

const PROVIDER = 'amazon'
const AMAZON_B2C_COURIER = {
  id: 5201,
  name: 'Amazon Shipping',
}

const normalize = (value: unknown) => String(value || '').trim()

const loadEnv = () => {
  const env = process.env.NODE_ENV || 'development'
  dotenv.config({ path: path.resolve(__dirname, `../../.env.${env}`) })
  dotenv.config({ path: path.resolve(__dirname, '../../.env') })
}

async function main() {
  loadEnv()

  const databaseUrl = normalize(process.env.DATABASE_URL)
  if (!databaseUrl) throw new Error('DATABASE_URL is required')

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  })

  const client = await pool.connect()
  try {
    await client.query('begin')

    await client.query(
      `insert into couriers (id, name, "serviceProvider", "isEnabled", business_type, created_at, updated_at)
       values ($1, $2, $3, true, '["b2c"]'::jsonb, now(), now())
       on conflict (id, "serviceProvider") do update set
         name = excluded.name,
         "isEnabled" = true,
         business_type = '["b2c"]'::jsonb,
         updated_at = now()`,
      [AMAZON_B2C_COURIER.id, AMAZON_B2C_COURIER.name, PROVIDER],
    )

    await client.query('commit')

    console.log(
      JSON.stringify(
        {
          provider: PROVIDER,
          courier: AMAZON_B2C_COURIER,
          businessType: ['b2c'],
          ratesCreated: 0,
          note: 'Amazon Shipping courier synced. Configure credentials and B2C rate card slabs before booking.',
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
