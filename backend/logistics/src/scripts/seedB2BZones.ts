import { db, pool } from '../models/client'
import { b2bPincodes, zones } from '../models/schema/zones'
import { ensureDefaultB2BZones, getAllZones, remapZonePincodes } from '../models/services/zone.service'
import { count, eq } from 'drizzle-orm'

const main = async () => {
  await ensureDefaultB2BZones()

  const b2bZones = await getAllZones('B2B')

  for (const zone of b2bZones) {
    await remapZonePincodes(zone.id)
  }

  const [{ totalZones }] = await db
    .select({ totalZones: count(zones.id) })
    .from(zones)
    .where(eq(zones.business_type, 'B2B'))

  const [{ totalPincodes }] = await db.select({ totalPincodes: count(b2bPincodes.id) }).from(b2bPincodes)

  console.log(
    `B2B zones ready: ${Number(totalZones || 0)} zones, ${Number(totalPincodes || 0)} mapped pincodes.`,
  )
}

main()
  .catch((error) => {
    console.error('Failed to seed B2B zones:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })
