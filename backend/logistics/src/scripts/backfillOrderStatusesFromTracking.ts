import { eq, sql } from 'drizzle-orm'
import { db } from '../models/client'
import { b2c_orders } from '../models/schema/b2cOrders'
import { tracking_events } from '../models/schema/trackingEvents'

const terminalStatuses = new Set(['delivered', 'rto_delivered', 'cancelled', 'lost'])

const normalizeTrackingStatus = (value: unknown) => {
  const raw = String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_')
  if (!raw) return ''

  if (raw.includes('rto_delivered') || raw === 'rt_dl' || raw === 'rtdl') return 'rto_delivered'
  if (raw.includes('rto_in_transit') || raw === 'rt_it' || raw === 'rtit') return 'rto_in_transit'
  if (raw.includes('delivered') && !raw.includes('rto')) return 'delivered'
  if (raw.includes('cancel')) return 'cancelled'
  if (raw.includes('lost')) return 'lost'
  if (raw.includes('rto')) return 'rto'
  return raw
}

type LatestTrackingRow = {
  order_id: string
  current_status: string | null
  status_code: string | null
  status_text: string | null
  tracking_at: Date | string | null
}

async function fetchLatestTrackingRows() {
  return db.execute(sql`
    SELECT
      latest.order_id,
      orders.order_status AS current_status,
      latest.status_code,
      latest.status_text,
      latest.tracking_at
    FROM (
      SELECT DISTINCT ON (${tracking_events.order_id})
        ${tracking_events.order_id} AS order_id,
        ${tracking_events.status_code} AS status_code,
        ${tracking_events.status_text} AS status_text,
        ${tracking_events.created_at} AS tracking_at
      FROM ${tracking_events}
      ORDER BY ${tracking_events.order_id}, ${tracking_events.created_at} DESC, ${tracking_events.id} DESC
    ) AS latest
    INNER JOIN ${b2c_orders} AS orders
      ON orders.id = latest.order_id
    WHERE lower(coalesce(orders.order_status, '')) NOT IN ('delivered', 'rto_delivered', 'cancelled', 'lost')
  `)
}

export async function backfillOrderStatusesFromTracking() {
  console.log('Starting order status backfill from tracking history...')

  const rows = (await fetchLatestTrackingRows()) as any
  const latestRows = (rows.rows || []) as LatestTrackingRow[]
  let updated = 0
  let skipped = 0

  for (const row of latestRows) {
    const normalizedStatus = normalizeTrackingStatus(row.status_code || row.status_text)
    if (!terminalStatuses.has(normalizedStatus)) {
      skipped += 1
      continue
    }

    const currentStatus = String(row.current_status || '').trim().toLowerCase()
    if (currentStatus === normalizedStatus) {
      skipped += 1
      continue
    }

    await db
      .update(b2c_orders)
      .set({ order_status: normalizedStatus })
      .where(eq(b2c_orders.id, row.order_id))

    updated += 1
  }

  console.log('Order status backfill complete', {
    scanned: latestRows.length,
    updated,
    skipped,
  })
}

if (require.main === module) {
  backfillOrderStatusesFromTracking()
    .then(() => {
      process.exit(0)
    })
    .catch((error) => {
      console.error('Order status backfill failed:', error)
      process.exit(1)
    })
}
