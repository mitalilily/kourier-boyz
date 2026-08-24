import assert from 'node:assert/strict'
import { Client } from 'pg'
import {
  computeB2CRateCardCharge,
  computeEffectiveB2CCodCharge,
  ResolvedB2CRateCard,
} from '../models/services/b2cRateCard.service'
import { calculateBookingWalletDebit } from '../utils/bookingWalletDebit'

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL is required')

const client = new Client({
  connectionString,
  ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false },
})

const toNumber = (value: unknown) => Number(value || 0)

const loadRateCard = async (rateId?: string): Promise<ResolvedB2CRateCard> => {
  const rateResult = await client.query(
    `select id, courier_id, courier_name, service_provider, zone_id, type, mode,
            cod_charges, cod_percent, other_charges, min_weight, rate
       from shipping_rates
      where ($1::uuid is null or id = $1::uuid)
        and business_type = 'b2c'
        and type = 'forward'
      order by service_provider, courier_id, zone_id
      limit 1`,
    [rateId || null],
  )
  const rate = rateResult.rows[0]
  if (!rate) throw new Error('No seeded B2C forward rate card is available')

  const slabResult = await client.query(
    `select id, weight_from, weight_to, rate, extra_rate, extra_weight_unit
       from shipping_rate_slabs
      where shipping_rate_id = $1
      order by weight_from, weight_to`,
    [rate.id],
  )
  if (!slabResult.rows.length) throw new Error(`Rate card ${rate.id} has no slabs`)

  return {
    shippingRateId: rate.id,
    courier_id: Number(rate.courier_id),
    courier_name: rate.courier_name,
    service_provider: rate.service_provider,
    zone_id: rate.zone_id,
    type: rate.type,
    mode: rate.mode,
    cod_charges: toNumber(rate.cod_charges),
    cod_percent: toNumber(rate.cod_percent),
    other_charges: toNumber(rate.other_charges),
    min_weight: toNumber(rate.min_weight),
    base_rate: toNumber(rate.rate),
    slabs: slabResult.rows.map((slab) => ({
      id: slab.id,
      weight_from: toNumber(slab.weight_from),
      weight_to: slab.weight_to === null ? null : toNumber(slab.weight_to),
      rate: toNumber(slab.rate),
      extra_rate: slab.extra_rate === null ? null : toNumber(slab.extra_rate),
      extra_weight_unit:
        slab.extra_weight_unit === null ? null : toNumber(slab.extra_weight_unit),
    })),
  }
}

const calculateScenario = (rateCard: ResolvedB2CRateCard) => {
  const freight = computeB2CRateCardCharge({
    actual_weight_g: 500,
    length_cm: 10,
    width_cm: 10,
    height_cm: 10,
    rateCard,
  }).freight
  const codCharge = computeEffectiveB2CCodCharge({
    cod_charges: rateCard.cod_charges,
    cod_percent: rateCard.cod_percent,
    order_amount: 1000,
  })

  return {
    freight,
    otherCharges: rateCard.other_charges,
    codCharge,
    prepaidWallet: calculateBookingWalletDebit({
      paymentType: 'prepaid',
      freightCharges: freight,
      otherCharges: rateCard.other_charges,
      codCharges: codCharge,
      gstPercent: 18,
    }),
    codWallet: calculateBookingWalletDebit({
      paymentType: 'cod',
      freightCharges: freight,
      otherCharges: rateCard.other_charges,
      codCharges: codCharge,
      gstPercent: 18,
    }),
  }
}

const main = async () => {
  await client.connect()
  const original = await loadRateCard()
  const originalScenario = calculateScenario(original)

  await client.query('begin')
  try {
    const firstSlab = original.slabs[0]
    assert.ok(firstSlab?.id, 'The selected rate card must have a persisted slab')

    await client.query(
      `update shipping_rates
          set cod_charges = 25, cod_percent = 4, other_charges = 3, rate = 17
        where id = $1`,
      [original.shippingRateId],
    )
    await client.query(`update shipping_rate_slabs set rate = 17 where id = $1`, [firstSlab.id])

    const changed = await loadRateCard(original.shippingRateId)
    const changedScenario = calculateScenario(changed)

    assert.equal(changedScenario.freight, 17)
    assert.equal(changedScenario.otherCharges, 3)
    assert.equal(changedScenario.codCharge, 40)
    assert.deepEqual(changedScenario.prepaidWallet, {
      baseAmount: 20,
      gstPercent: 18,
      gstAmount: 3.6,
      totalAmount: 23.6,
    })
    assert.deepEqual(changedScenario.codWallet, {
      baseAmount: 60,
      gstPercent: 18,
      gstAmount: 10.8,
      totalAmount: 70.8,
    })

    await client.query('rollback')

    const restored = calculateScenario(await loadRateCard(original.shippingRateId))
    assert.deepEqual(restored, originalScenario, 'Rollback must restore every original charge')

    console.log('Database rate-card propagation check passed', {
      rateId: original.shippingRateId,
      original: originalScenario,
      changed: changedScenario,
      rollbackVerified: true,
    })
  } catch (error) {
    await client.query('rollback').catch(() => undefined)
    throw error
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error('Database rate-card propagation check failed', error)
  process.exit(1)
})
