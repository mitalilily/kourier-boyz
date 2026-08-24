import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { db } from '../models/client'
import { b2c_orders } from '../models/schema/b2cOrders'
import { generateLabelForOrder } from '../models/services/generateCustomLabelService'
import { resolveOrderAwbNumber, resolvePickupDetailsForOrder } from '../models/services/pickupDetails.service'

const TARGET_INTEGRATIONS = ['shopify', 'woocommerce']
const BATCH_SIZE = 100

const trimText = (value: unknown) => String(value ?? '').trim()

const isInvalidAwbMarker = (value: unknown) => {
  const lower = trimText(value).toLowerCase()
  return (
    !lower ||
    lower.startsWith('status_') ||
    ['pending', 'completed', 'cancelled', 'delivered', 'failed', 'success'].includes(lower) ||
    lower.length < 6
  )
}

async function fetchOrdersBatch(offset: number) {
  return db
    .select()
    .from(b2c_orders)
    .where(and(inArray(b2c_orders.integration_type, TARGET_INTEGRATIONS), sql`coalesce(${b2c_orders.order_number}, '') <> ''`))
    .orderBy(desc(b2c_orders.created_at))
    .limit(BATCH_SIZE)
    .offset(offset)
}

async function backfillShopifyWooCommerceLabels() {
  console.log('Starting Shopify/WooCommerce label backfill...')

  let offset = 0
  let scanned = 0
  let updated = 0
  let skipped = 0
  let pickupUpdated = 0
  let awbUpdated = 0
  let labelsCleared = 0

  while (true) {
    const rows = await fetchOrdersBatch(offset)
    if (!rows.length) break

    scanned += rows.length
    offset += rows.length

    for (const order of rows) {
      const currentAwb = trimText(order.awb_number)
      if (currentAwb && isInvalidAwbMarker(currentAwb) && trimText(order.label)) {
        await db
          .update(b2c_orders)
          .set({ label: null, updated_at: new Date() })
          .where(eq(b2c_orders.id, order.id))
        labelsCleared += 1
        skipped += 1
        continue
      }

      const resolvedAwbNumber = resolveOrderAwbNumber(order)
      const pickupContext = await resolvePickupDetailsForOrder(order.user_id, db, order)
      const updates: Record<string, unknown> = {}

      if (resolvedAwbNumber && trimText(order.awb_number) !== resolvedAwbNumber) {
        updates.awb_number = resolvedAwbNumber
        awbUpdated += 1
      }

      if (pickupContext.pickupLocationId && trimText(order.pickup_location_id) !== pickupContext.pickupLocationId) {
        updates.pickup_location_id = pickupContext.pickupLocationId
      }

      if (pickupContext.pickupDetails) {
        const currentPickupDetails = JSON.stringify(order.pickup_details || {})
        const nextPickupDetails = JSON.stringify(pickupContext.pickupDetails)
        if (currentPickupDetails !== nextPickupDetails) {
          updates.pickup_details = pickupContext.pickupDetails
          pickupUpdated += 1
        }
      }

      if (Object.keys(updates).length > 0) {
        updates.updated_at = new Date()
        await db.update(b2c_orders).set(updates).where(eq(b2c_orders.id, order.id))
      }

      const labelSourceOrder = {
        ...order,
        ...updates,
        awb_number: updates.awb_number ?? order.awb_number,
        pickup_details: updates.pickup_details ?? order.pickup_details,
        pickup_location_id: updates.pickup_location_id ?? order.pickup_location_id,
      }

      const labelAwb = resolveOrderAwbNumber(labelSourceOrder)
      if (!labelAwb) {
        skipped += 1
        continue
      }

      try {
        const labelKey = await generateLabelForOrder(labelSourceOrder, order.user_id, db)
        const normalizedLabelKey = trimText(labelKey)
        if (!normalizedLabelKey) {
          skipped += 1
          continue
        }

        await db
          .update(b2c_orders)
          .set({ label: normalizedLabelKey, updated_at: new Date() })
          .where(eq(b2c_orders.id, order.id))
        updated += 1
      } catch (error: any) {
        skipped += 1
        console.error(`Failed to regenerate label for order ${order.order_number}:`, error?.message || error)
      }
    }
  }

  console.log('Shopify/WooCommerce label backfill complete', {
    scanned,
    updated,
    skipped,
    pickupUpdated,
    awbUpdated,
    labelsCleared,
  })
}

if (require.main === module) {
  backfillShopifyWooCommerceLabels()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Shopify/WooCommerce label backfill failed:', error)
      process.exit(1)
    })
}
