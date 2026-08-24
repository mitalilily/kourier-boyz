import { and, sql } from 'drizzle-orm'
import { db } from '../models/client'
import { b2c_orders } from '../models/schema/b2cOrders'
import { rto_events } from '../models/schema/rto'
import { walletTransactions } from '../models/schema/wallet'
import { recordRtoChargeAndEventOnce } from '../models/services/shiprocket.service'

const LEGACY_RTO_STATUSES = ['rto', 'rto_in_transit', 'rto_delivered'] as const

type BackfillRtoOrder = {
  source_type: 'b2c'
  id: string
  user_id: string
  order_number: string
  order_status: string | null
  awb_number: string | null
  courier_partner: string | null
  integration_type: string | null
  courier_id: number | string | null
  pickup_details: any
  pincode: string | null
  weight: number | string | null
  length: number | string | null
  breadth: number | string | null
  height: number | string | null
  shipping_mode: string | null
  selected_max_slab_weight: number | string | null
  shipping_charges: number | string | null
  freight_charges: number | string | null
  delivery_message: string | null
  delivery_location: string | null
  provider_last_status: string | null
  manifest_error: string | null
  created_at: Date | string | null
  updated_at: Date | string | null
}

const getEventTimestamp = (order: BackfillRtoOrder) => {
  const value = order.updated_at || order.created_at || new Date()
  return value instanceof Date ? value : new Date(value)
}

async function fetchOrdersNeedingRtoBackfill() {
  return db
    .select({
      source_type: sql<string>`'b2c'`,
      id: b2c_orders.id,
      user_id: b2c_orders.user_id,
      order_number: b2c_orders.order_number,
      order_status: b2c_orders.order_status,
      awb_number: b2c_orders.awb_number,
      courier_partner: b2c_orders.courier_partner,
      integration_type: b2c_orders.integration_type,
      courier_id: b2c_orders.courier_id,
      pickup_details: b2c_orders.pickup_details,
      pincode: b2c_orders.pincode,
      weight: b2c_orders.weight,
      length: b2c_orders.length,
      breadth: b2c_orders.breadth,
      height: b2c_orders.height,
      shipping_mode: b2c_orders.shipping_mode,
      selected_max_slab_weight: b2c_orders.selected_max_slab_weight,
      shipping_charges: b2c_orders.shipping_charges,
      freight_charges: b2c_orders.freight_charges,
      delivery_message: b2c_orders.delivery_message,
      delivery_location: b2c_orders.delivery_location,
      provider_last_status: b2c_orders.provider_last_status,
      manifest_error: b2c_orders.manifest_error,
      created_at: b2c_orders.created_at,
      updated_at: b2c_orders.updated_at,
    })
    .from(b2c_orders)
    .where(
      and(
        sql`${b2c_orders.order_status} IN ('rto', 'rto_in_transit', 'rto_delivered')`,
        sql`(
          NOT EXISTS (
            SELECT 1
            FROM ${walletTransactions} wt
            WHERE wt.ref = ${b2c_orders.id}
              AND wt.type = 'debit'
              AND wt.reason ILIKE 'RTO freight%'
          )
          OR NOT EXISTS (
            SELECT 1
            FROM ${rto_events} re
            WHERE re.order_id = ${b2c_orders.id}
              AND re.rto_charges IS NOT NULL
              AND re.rto_charges > 0
          )
        )`,
      ),
    )
}

export async function backfillRtoCharges() {
  console.log('Starting RTO debit backfill...')

  const orders = (await fetchOrdersNeedingRtoBackfill()) as BackfillRtoOrder[]
  console.log(`Found ${orders.length} RTO orders that may need a debit repair`)

  let processed = 0
  let applied = 0
  let skipped = 0

  for (const order of orders) {
    const eventAt = getEventTimestamp(order)
    const source = 'backfill_rto_charges'
    const reason = order.provider_last_status || order.delivery_message || order.manifest_error || null
    const remarks = order.delivery_location || order.delivery_message || order.provider_last_status || null

    try {
      const appliedCharge = await db.transaction(async (tx) =>
        recordRtoChargeAndEventOnce(tx, order as any, {
          status: order.order_status || 'rto',
          reason,
          remarks,
          payload: {
            source,
            order_number: order.order_number,
            courier_partner: order.courier_partner,
            order_status: order.order_status,
          },
          eventAt,
          courierLabel: order.courier_partner || order.integration_type || 'Courier',
          source,
        }),
      )

      processed += 1
      if (appliedCharge && appliedCharge > 0) {
        applied += 1
      } else {
        skipped += 1
      }
    } catch (error: any) {
      skipped += 1
      console.error(`Failed to backfill RTO charge for order ${order.order_number}:`, error?.message || error)
    }
  }

  console.log('RTO debit backfill complete', {
    scanned: orders.length,
    processed,
    applied,
    skipped,
    legacyStatuses: LEGACY_RTO_STATUSES,
  })
}

if (require.main === module) {
  backfillRtoCharges()
    .then(() => {
      process.exit(0)
    })
    .catch((error) => {
      console.error('RTO debit backfill failed:', error)
      process.exit(1)
    })
}
