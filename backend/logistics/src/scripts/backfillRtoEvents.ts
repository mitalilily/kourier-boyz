import { and, eq, sql } from 'drizzle-orm'
import { db } from '../models/client'
import { rto_events } from '../models/schema/rto'
import { b2c_orders } from '../models/schema/b2cOrders'

const LEGACY_RTO_STATUSES = ['rto', 'rto_in_transit', 'rto_delivered'] as const

type LegacyRtoOrder = {
  id: string
  user_id: string
  order_number: string
  awb_number: string | null
  order_status: string | null
  courier_partner: string | null
  provider_last_status: string | null
  delivery_message: string | null
  delivery_location: string | null
  manifest_error: string | null
  created_at: Date | string | null
  updated_at: Date | string | null
}

const getEventTimestamp = (row: LegacyRtoOrder) => {
  const value = row.updated_at || row.created_at || new Date()
  return value instanceof Date ? value : new Date(value)
}

async function fetchLegacyRtoOrders() {
  return db
    .select({
      id: b2c_orders.id,
      user_id: b2c_orders.user_id,
      order_number: b2c_orders.order_number,
      awb_number: b2c_orders.awb_number,
      order_status: b2c_orders.order_status,
      courier_partner: b2c_orders.courier_partner,
      provider_last_status: b2c_orders.provider_last_status,
      delivery_message: b2c_orders.delivery_message,
      delivery_location: b2c_orders.delivery_location,
      manifest_error: b2c_orders.manifest_error,
      created_at: b2c_orders.created_at,
      updated_at: b2c_orders.updated_at,
    })
    .from(b2c_orders)
    .where(
      and(
        sql`${b2c_orders.order_status} IN ('rto', 'rto_in_transit', 'rto_delivered')`,
        sql`NOT EXISTS (
          SELECT 1
          FROM ${rto_events} existing_rto
          WHERE existing_rto.order_id = ${b2c_orders.id}
        )`,
      ),
    )
}

export async function backfillRtoEvents() {
  console.log('Starting RTO backfill from legacy orders...')

  const legacyOrders = (await fetchLegacyRtoOrders()) as LegacyRtoOrder[]
  console.log(`Found ${legacyOrders.length} legacy RTO orders without event rows`)

  let inserted = 0
  let skipped = 0

  for (const order of legacyOrders) {
    const createdAt = getEventTimestamp(order)
    const reason = order.provider_last_status || order.manifest_error || order.delivery_message || null
    const remarks = order.delivery_location || order.delivery_message || order.provider_last_status || null

    try {
      await db.insert(rto_events).values({
        order_id: order.id,
        user_id: order.user_id,
        awb_number: order.awb_number,
        status: order.order_status || 'rto',
        reason,
        remarks,
        rto_charges: null,
        payload: {
          source: 'backfill_legacy_order',
          order_number: order.order_number,
          courier_partner: order.courier_partner,
          order_status: order.order_status,
        },
        created_at: createdAt,
        updated_at: createdAt,
      })
      inserted += 1
    } catch (error: any) {
      skipped += 1
      console.error(`Failed to backfill RTO for order ${order.order_number}:`, error?.message || error)
    }
  }

  console.log('RTO backfill complete', {
    scanned: legacyOrders.length,
    inserted,
    skipped,
  })
}

if (require.main === module) {
  backfillRtoEvents()
    .then(() => {
      process.exit(0)
    })
    .catch((error) => {
      console.error('RTO backfill failed:', error)
      process.exit(1)
    })
}
