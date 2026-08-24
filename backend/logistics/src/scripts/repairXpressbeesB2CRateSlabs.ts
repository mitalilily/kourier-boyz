import { and, isNull, sql } from 'drizzle-orm'
import { db, pool } from '../models/client'
import { shippingRates, shippingRateSlabs } from '../models/schema/shippingRates'

const DEFAULT_EXTRA_RATE = '10.00'
const DEFAULT_EXTRA_WEIGHT_UNIT = '1.000'

const main = async () => {
  const updated = await db
    .update(shippingRateSlabs)
    .set({
      extra_rate: DEFAULT_EXTRA_RATE,
      extra_weight_unit: DEFAULT_EXTRA_WEIGHT_UNIT,
      updated_at: new Date(),
    })
    .where(
      and(
        isNull(shippingRateSlabs.extra_rate),
        isNull(shippingRateSlabs.extra_weight_unit),
        sql`exists (
          select 1
          from ${shippingRates}
          where ${shippingRates.id} = ${shippingRateSlabs.shipping_rate_id}
            and ${shippingRates.business_type} = 'b2c'
            and ${shippingRates.type} = 'forward'
            and (
              lower(coalesce(${shippingRates.service_provider}, '')) = 'xpressbees'
              or lower(coalesce(${shippingRates.courier_name}, '')) like '%xpress%'
            )
        )`,
      ),
    )
    .returning({
      shipping_rate_id: shippingRateSlabs.shipping_rate_id,
      weight_to: shippingRateSlabs.weight_to,
      extra_rate: shippingRateSlabs.extra_rate,
      extra_weight_unit: shippingRateSlabs.extra_weight_unit,
    })

  console.log(
    JSON.stringify(
      {
        updated_slabs: updated.length,
        extra_rate: DEFAULT_EXTRA_RATE,
        extra_weight_unit: DEFAULT_EXTRA_WEIGHT_UNIT,
        slabs: updated,
      },
      null,
      2,
    ),
  )
}

main()
  .catch((error) => {
    console.error('Failed to repair XpressBees B2C rate slabs', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })
