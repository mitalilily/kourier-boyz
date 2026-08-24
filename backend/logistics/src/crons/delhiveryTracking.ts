import { and, asc, eq, ilike, isNotNull, isNull, notInArray, or } from 'drizzle-orm'
import { db } from '../models/client'
import { b2b_orders } from '../models/schema/b2bOrders'
import { b2c_orders } from '../models/schema/b2cOrders'
import { trackByAwbService } from '../models/services/shiprocket.service'

const terminalStatuses = ['delivered', 'cancelled', 'rto_delivered', 'lost']

type PollableOrder = {
  id: string
  order_number: string | null
  awb_number: string | null
  source_type: 'b2c' | 'b2b'
}

const normalizeBatchSize = (batchSize: number) =>
  Number.isFinite(batchSize) && batchSize > 0 ? Math.floor(batchSize) : 50

export async function pollDelhiveryTracking(batchSize = 50) {
  const limit = normalizeBatchSize(batchSize)

  const b2cPending = await db
    .select({
      id: b2c_orders.id,
      order_number: b2c_orders.order_number,
      awb_number: b2c_orders.awb_number,
    })
    .from(b2c_orders)
    .where(
      and(
        or(eq(b2c_orders.integration_type, 'delhivery'), ilike(b2c_orders.courier_partner, '%delhivery%')),
        isNotNull(b2c_orders.awb_number),
        or(notInArray(b2c_orders.order_status, terminalStatuses), isNull(b2c_orders.order_status)),
      ),
    )
    .orderBy(asc(b2c_orders.updated_at))
    .limit(limit)

  const b2bPending = await db
    .select({
      id: b2b_orders.id,
      order_number: b2b_orders.order_number,
      awb_number: b2b_orders.awb_number,
    })
    .from(b2b_orders)
    .where(
      and(
        or(eq(b2b_orders.integration_type, 'delhivery'), ilike(b2b_orders.courier_partner, '%delhivery%')),
        isNotNull(b2b_orders.awb_number),
        or(notInArray(b2b_orders.order_status, terminalStatuses), isNull(b2b_orders.order_status)),
      ),
    )
    .orderBy(asc(b2b_orders.updated_at))
    .limit(limit)

  const pending: PollableOrder[] = [
    ...b2cPending.map((order) => ({ ...order, source_type: 'b2c' as const })),
    ...b2bPending.map((order) => ({ ...order, source_type: 'b2b' as const })),
  ]

  if (!pending.length) {
    return { checked: 0, updated: 0, failed: 0 }
  }

  let updated = 0
  let failed = 0

  for (const order of pending) {
    const awb = String(order.awb_number || '').trim()
    if (!awb) continue

    try {
      await trackByAwbService(awb)
      updated += 1
    } catch (err: any) {
      failed += 1
      console.error('[Delhivery] Tracking poll failed', {
        order_id: order.id,
        order_number: order.order_number,
        order_type: order.source_type,
        awb,
        error: err?.message || err,
      })
    }
  }

  return { checked: pending.length, updated, failed }
}
