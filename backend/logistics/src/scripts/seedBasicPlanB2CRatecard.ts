import { and, asc, eq, sql } from 'drizzle-orm'
import { db, pool } from '../models/client'
import { couriers } from '../models/schema/couriers'
import { plans } from '../models/schema/plans'
import { shippingRates } from '../models/schema/shippingRates'
import { zones } from '../models/schema/zones'
import { upsertShippingRate } from '../models/services/courierIntegration.service'

const BASIC_PLAN_NAME = 'basic'
const COD_CHARGE = 10
const COD_PERCENT = 1
const BASE_RATE = 10
const EXTRA_RATE = 10
const EXTRA_WEIGHT_UNIT_KG = 1
const RATE_CARD_MODE = ''

const BASIC_B2C_SLABS = [
  {
    weight_from: 0,
    weight_to: 0.5,
    rate: BASE_RATE,
    extra_rate: EXTRA_RATE,
    extra_weight_unit: EXTRA_WEIGHT_UNIT_KG,
  },
]

const supportsB2C = (businessType: unknown) => {
  if (!Array.isArray(businessType)) return false
  return businessType.map((type) => String(type).toLowerCase()).includes('b2c')
}

async function seedBasicPlanB2CRateCard() {
  const [basicPlan] = await db
    .select()
    .from(plans)
    .where(and(sql`lower(${plans.name}) = ${BASIC_PLAN_NAME}`, eq(plans.business_type, 'b2c')))
    .limit(1)

  if (!basicPlan) {
    throw new Error('Basic plan not found')
  }

  const b2cZones = await db
    .select()
    .from(zones)
    .where(eq(zones.business_type, 'B2C'))
    .orderBy(asc(zones.code))

  if (!b2cZones.length) {
    throw new Error('No B2C zones found')
  }

  const enabledCouriers = await db
    .select()
    .from(couriers)
    .where(eq(couriers.isEnabled, true))
    .orderBy(asc(couriers.serviceProvider), asc(couriers.id))

  const b2cCouriers = enabledCouriers.filter((courier) => supportsB2C(courier.businessType))

  if (!b2cCouriers.length) {
    throw new Error('No enabled B2C couriers found')
  }

  const deletedRates = await db
    .delete(shippingRates)
    .where(and(eq(shippingRates.plan_id, basicPlan.id), eq(shippingRates.business_type, 'b2c')))
    .returning({ id: shippingRates.id })

  let savedRows = 0

  for (const courier of b2cCouriers) {
    for (const zone of b2cZones) {
      savedRows += await upsertShippingRate({
        courier_id: String(courier.id),
        courier_name: courier.name,
        service_provider: courier.serviceProvider,
        plan_id: basicPlan.id,
        mode: RATE_CARD_MODE,
        business_type: 'b2c',
        cod_charges: COD_CHARGE,
        cod_percent: COD_PERCENT,
        other_charges: null,
        rates: [{ zone_id: zone.id, type: 'forward', rate: BASE_RATE }],
        zone_slabs: { [zone.id]: { forward: BASIC_B2C_SLABS } },
      })

      savedRows += await upsertShippingRate({
        courier_id: String(courier.id),
        courier_name: courier.name,
        service_provider: courier.serviceProvider,
        plan_id: basicPlan.id,
        mode: RATE_CARD_MODE,
        business_type: 'b2c',
        cod_charges: null,
        cod_percent: null,
        other_charges: null,
        rates: [{ zone_id: zone.id, type: 'rto', rate: BASE_RATE }],
        zone_slabs: { [zone.id]: { rto: BASIC_B2C_SLABS } },
      })
    }
  }

  console.log(
    `Seeded Basic plan B2C rate cards: deleted ${deletedRates.length} old rows and saved ${savedRows} rows for ${b2cCouriers.length} couriers across ${b2cZones.length} zones.`,
  )
}

seedBasicPlanB2CRateCard()
  .catch((error) => {
    console.error('Failed to seed Basic plan B2C rate cards:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })
