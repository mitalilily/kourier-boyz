import { inArray, sql } from 'drizzle-orm'
import { db } from '../models/client'
import { b2b_orders } from '../models/schema/b2bOrders'
import { b2c_orders } from '../models/schema/b2cOrders'
import { pollCourierTracking } from '../crons/courierTracking'

const STATUS_WINDOW = ['ndr', 'undelivered', 'rto', 'rto_in_transit', 'pickup_initiated', 'in_transit']

const parseNumberArg = (value: string | undefined, fallback: number) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback
}

const summarizeCurrentStatuses = async (table: any, label: string) => {
  const rows = await db
    .select({
      status: table.order_status,
      count: sql<number>`count(*)::int`,
    })
    .from(table)
    .where(inArray(table.order_status, STATUS_WINDOW))
    .groupBy(table.order_status)

  console.log(`${label}: ${JSON.stringify(rows)}`)
}

/**
 * One-time courier backfill for active shipment rows.
 * Replays the existing tracking poller in bounded rounds so stale
 * NDR/RTO/pickup states are normalized from live courier data.
 */
export async function backfillCourierTrackingStatus() {
  const maxRounds = parseNumberArg(process.argv[2], 10)
  const batchSize = parseNumberArg(process.argv[3], 100)

  console.log('🔄 Starting courier tracking backfill...', { maxRounds, batchSize })
  await summarizeCurrentStatuses(b2c_orders, 'b2c_before')
  await summarizeCurrentStatuses(b2b_orders, 'b2b_before')

  let totalChecked = 0
  let totalUpdated = 0
  let totalFailed = 0
  let roundsExecuted = 0

  for (let round = 1; round <= maxRounds; round += 1) {
    const result = await pollCourierTracking({ batchSize })
    roundsExecuted = round
    totalChecked += result.checked
    totalUpdated += result.updated
    totalFailed += result.failed

    console.log(`ℹ️ Round ${round}:`, result)

    if (result.checked === 0) {
      break
    }
  }

  await summarizeCurrentStatuses(b2c_orders, 'b2c_after')
  await summarizeCurrentStatuses(b2b_orders, 'b2b_after')

  console.log('✅ Courier tracking backfill complete', {
    roundsExecuted,
    totalChecked,
    totalUpdated,
    totalFailed,
  })
}

if (require.main === module) {
  backfillCourierTrackingStatus()
    .then(() => {
      process.exit(0)
    })
    .catch((err) => {
      console.error('❌ Courier tracking backfill failed:', err)
      process.exit(1)
    })
}
