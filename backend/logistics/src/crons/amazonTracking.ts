import { and, eq, isNotNull, isNull, notInArray, or } from 'drizzle-orm'
import { db } from '../models/client'
import { b2c_orders } from '../models/schema/b2cOrders'
import { trackByAwbService } from '../models/services/shiprocket.service'

const terminalStatuses = ['delivered', 'cancelled', 'rto_delivered', 'lost']

export async function pollAmazonTracking(batchSize = 50) {
  const pending = await db
    .select({
      id: b2c_orders.id,
      order_number: b2c_orders.order_number,
      awb_number: b2c_orders.awb_number,
    })
    .from(b2c_orders)
    .where(
      and(
        eq(b2c_orders.integration_type, 'amazon'),
        isNotNull(b2c_orders.awb_number),
        or(notInArray(b2c_orders.order_status, terminalStatuses), isNull(b2c_orders.order_status)),
      ),
    )
    .limit(batchSize)

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
      console.error('[AmazonShipping] Tracking poll failed', {
        order_id: order.id,
        order_number: order.order_number,
        awb,
        error: err?.message || err,
      })
    }
  }

  return { checked: pending.length, updated, failed }
}
