import { eq, sql } from 'drizzle-orm'
import { db, pool } from '../models/client'
import { courier_credentials } from '../models/schema/courierCredentials'

const normalize = (value: unknown) => String(value || '').trim()

const main = async () => {
  const apiKey = normalize(process.env.DELHIVERY_API_KEY)
  const clientName = normalize(process.env.DELHIVERY_CLIENT_NAME) || 'RAM ENTERPRISES'
  const apiBase = normalize(process.env.DELHIVERY_API_BASE) || 'https://track.delhivery.com'

  if (!apiKey) {
    throw new Error('DELHIVERY_API_KEY is required')
  }

  const [existing] = await db
    .select({ id: courier_credentials.id })
    .from(courier_credentials)
    .where(eq(courier_credentials.provider, 'delhivery'))
    .limit(1)

  if (existing) {
    await db
      .update(courier_credentials)
      .set({
        apiBase,
        clientName,
        apiKey,
        metadata: sql`coalesce(${courier_credentials.metadata}, '{}'::jsonb) || '{"b2cConfigured": true}'::jsonb`,
        updatedAt: new Date(),
      })
      .where(eq(courier_credentials.provider, 'delhivery'))
  } else {
    await db.insert(courier_credentials).values({
      provider: 'delhivery',
      apiBase,
      clientName,
      apiKey,
      metadata: { b2cConfigured: true },
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  }

  console.log(
    JSON.stringify({
      provider: 'delhivery',
      apiBase,
      clientName,
      apiKeyLength: apiKey.length,
      configured: true,
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
