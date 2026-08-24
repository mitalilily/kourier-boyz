import { and, eq } from 'drizzle-orm'
import { db, pool } from '../models/client'
import { couriers } from '../models/schema/couriers'
import { APPTMYZ_COURIERS } from '../models/services/couriers/apptmyz.service'

const APPTMYZ_PROVIDER = 'apptmyz'

const main = async () => {
  const synced = []

  for (const courier of APPTMYZ_COURIERS) {
    await db
      .insert(couriers)
      .values({
        id: courier.id,
        name: courier.name,
        serviceProvider: APPTMYZ_PROVIDER,
        businessType: ['b2b'],
        isEnabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [couriers.id, couriers.serviceProvider],
        set: {
          name: courier.name,
          businessType: ['b2b'],
          isEnabled: true,
          updatedAt: new Date(),
        },
      })

    const [row] = await db
      .select({
        id: couriers.id,
        name: couriers.name,
        serviceProvider: couriers.serviceProvider,
        businessType: couriers.businessType,
        isEnabled: couriers.isEnabled,
      })
      .from(couriers)
      .where(and(eq(couriers.id, courier.id), eq(couriers.serviceProvider, APPTMYZ_PROVIDER)))
      .limit(1)

    synced.push(row)
  }

  console.log(
    JSON.stringify(
      {
        provider: APPTMYZ_PROVIDER,
        businessType: 'b2b',
        couriers: synced,
      },
      null,
      2,
    ),
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
