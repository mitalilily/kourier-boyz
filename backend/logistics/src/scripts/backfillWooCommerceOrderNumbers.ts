import { and, eq, ilike, ne } from 'drizzle-orm'
import { db } from '../models/client'
import { b2c_orders } from '../models/schema/b2cOrders'

const TARGET_INTEGRATION = 'woocommerce'
const BATCH_SIZE = 250

const trimText = (value: unknown) => String(value ?? '').trim()

const extractWooOrderNumber = (order: any) => {
  const internalOrderId = trimText(order?.order_id)
  const internalMatch = internalOrderId.match(/^woo_(woo_[a-f0-9]{32})_(.+)$/i)
  if (internalMatch?.[2]) return trimText(internalMatch[2])

  const legacyOrderNumber = trimText(order?.order_number)
  const legacyMatch = legacyOrderNumber.match(/^WC-[^-]+-(.+)$/i)
  if (legacyMatch?.[1]) return trimText(legacyMatch[1])

  return ''
}

async function backfillWooCommerceOrderNumbers() {
  console.log('Starting WooCommerce order number backfill...')

  let scanned = 0
  let updated = 0
  let skipped = 0
  let collisions = 0

  while (true) {
    const rows = await db
      .select()
      .from(b2c_orders)
      .where(
        and(
          eq(b2c_orders.integration_type, TARGET_INTEGRATION),
          ilike(b2c_orders.order_number, 'WC-%'),
        ),
      )
      .orderBy(b2c_orders.created_at)
      .limit(BATCH_SIZE)

    if (!rows.length) break

    scanned += rows.length

    for (const order of rows) {
      const targetOrderNumber = extractWooOrderNumber(order)
      const currentOrderNumber = trimText(order.order_number)

      if (!targetOrderNumber || currentOrderNumber === targetOrderNumber) {
        skipped += 1
        continue
      }

      const [duplicate] = await db
        .select({ id: b2c_orders.id })
        .from(b2c_orders)
        .where(
          and(
            eq(b2c_orders.user_id, order.user_id),
            eq(b2c_orders.order_number, targetOrderNumber),
            ne(b2c_orders.id, order.id),
          ),
        )
        .limit(1)

      if (duplicate?.id) {
        collisions += 1
        console.warn(
          `Skipping WooCommerce order ${order.id} because order number ${targetOrderNumber} already exists for the merchant.`,
        )
        continue
      }

      await db
        .update(b2c_orders)
        .set({ order_number: targetOrderNumber, updated_at: new Date() })
        .where(eq(b2c_orders.id, order.id))
      updated += 1
    }
  }

  console.log('WooCommerce order number backfill complete', {
    scanned,
    updated,
    skipped,
    collisions,
  })
}

if (require.main === module) {
  backfillWooCommerceOrderNumbers()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('WooCommerce order number backfill failed:', error)
      process.exit(1)
    })
}
