import { and, asc, eq, gte, ilike, lte, or } from 'drizzle-orm'
import { db } from '../client'
import {
  internationalCountryZones,
  internationalRateCards,
  internationalRates,
} from '../schema/rateCardMasters'

const normalizeCountryKey = (value: unknown) =>
  String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

export const listInternationalCountryZones = async () =>
  db
    .select()
    .from(internationalCountryZones)
    .where(eq(internationalCountryZones.isActive, true))
    .orderBy(asc(internationalCountryZones.countryName))

export const listInternationalRateCards = async () => {
  const cards = await db.select().from(internationalRateCards).where(eq(internationalRateCards.isActive, true)).orderBy(asc(internationalRateCards.name))
  const rates = await db
    .select({
      id: internationalRates.id,
      rateCardId: internationalRates.rateCardId,
      deliveryPartner: internationalRates.deliveryPartner,
      destinationCountry: internationalRates.destinationCountry,
      destinationZone: internationalRates.destinationZone,
      minWeight: internationalRates.minWeight,
      maxWeight: internationalRates.maxWeight,
      baseRate: internationalRates.baseRate,
      ratePerKg: internationalRates.ratePerKg,
      fuelSurchargeMode: internationalRates.fuelSurchargeMode,
      fuelSurchargeValue: internationalRates.fuelSurchargeValue,
      currency: internationalRates.currency,
      estimatedDays: internationalRates.estimatedDays,
    })
    .from(internationalRates)
    .where(eq(internationalRates.isActive, true))
  const countries = await listInternationalCountryZones()
  return cards.map((card) => ({
    ...card,
    deliveryPartners: [...new Set(rates.filter((rate) => rate.rateCardId === card.id).map((rate) => rate.deliveryPartner))],
    destinationZones: [
      ...new Set(
        [
          ...countries.map((country) => country.zoneCode),
          ...rates
            .filter((rate) => rate.rateCardId === card.id && rate.destinationZone)
            .map((rate) => rate.destinationZone as string),
        ],
      ),
    ].sort(),
    destinationCountries: countries,
    rates: rates.filter((rate) => rate.rateCardId === card.id),
  }))
}

const parsePositiveNumber = (value: unknown, field: string, allowZero = false) => {
  const number = Number(value)
  if (!Number.isFinite(number) || number < 0 || (!allowZero && number === 0)) {
    throw new Error(`${field} must be ${allowZero ? 'zero or greater' : 'greater than zero'}`)
  }
  return number
}

const normalizeZoneCode = (value: unknown) => String(value ?? '').trim().toUpperCase()
const normalizeFuelSurchargeMode = (value: unknown) => {
  const mode = String(value || 'percentage').trim().toLowerCase()
  return mode === 'flat' ? 'flat' : 'percentage'
}

export const updateInternationalCourierRates = async (rateCardId: string, input: any) => {
  const deliveryPartner = String(input?.deliveryPartner || '').trim()
  const slabs = Array.isArray(input?.slabs) ? input.slabs : []
  const currency = String(input?.currency || 'INR').trim().toUpperCase() || 'INR'
  const estimatedDays = String(input?.estimatedDays || 'Manual quote').trim() || 'Manual quote'
  const fuelSurchargeMode = normalizeFuelSurchargeMode(input?.fuelSurchargeMode ?? input?.fuel_surcharge_mode)
  const fuelSurchargeValue = parsePositiveNumber(
    input?.fuelSurchargeValue ?? input?.fuel_surcharge_value ?? 0,
    'Fuel surcharge',
    true,
  )

  if (!rateCardId) throw new Error('Rate card is required')
  if (!deliveryPartner) throw new Error('Courier is required')
  if (!slabs.length) throw new Error('Add at least one rate slab')

  const [card] = await db
    .select()
    .from(internationalRateCards)
    .where(and(eq(internationalRateCards.id, rateCardId), eq(internationalRateCards.isActive, true)))
    .limit(1)
  if (!card) throw new Error('International rate card not found')

  const rows = slabs.flatMap((slab: any) => {
    const minWeight = parsePositiveNumber(slab.minWeight ?? slab.min_weight ?? 0, 'Min weight', true)
    const maxWeight = parsePositiveNumber(slab.maxWeight ?? slab.max_weight, 'Max weight')
    if (maxWeight < minWeight) throw new Error('Max weight must be greater than or equal to min weight')

    const rates = slab.rates && typeof slab.rates === 'object' ? slab.rates : {}
    return Object.entries(rates).flatMap(([zoneCodeRaw, amountRaw]) => {
      const zoneCode = normalizeZoneCode(zoneCodeRaw)
      if (!zoneCode || amountRaw === '' || amountRaw === null || amountRaw === undefined) return []
      const amount = parsePositiveNumber(amountRaw, `Rate for zone ${zoneCode}`, true)
      return [{
        rateCardId,
        deliveryPartner,
        destinationCountry: '*',
        destinationZone: zoneCode,
        minWeight: minWeight.toFixed(3),
        maxWeight: maxWeight.toFixed(3),
        baseRate: amount.toFixed(2),
        ratePerKg: '0.00',
        fuelSurchargeMode,
        fuelSurchargeValue: fuelSurchargeValue.toFixed(2),
        currency,
        estimatedDays,
        isActive: true,
        updatedAt: new Date(),
      }]
    })
  })

  if (!rows.length) throw new Error('Add at least one zone rate')

  await db.transaction(async (tx) => {
    await tx
      .delete(internationalRates)
      .where(
        and(
          eq(internationalRates.rateCardId, rateCardId),
          eq(internationalRates.deliveryPartner, deliveryPartner),
        ),
      )
    for (let index = 0; index < rows.length; index += 500) {
      await tx.insert(internationalRates).values(rows.slice(index, index + 500))
    }
    await tx
      .update(internationalRateCards)
      .set({ updatedAt: new Date() })
      .where(eq(internationalRateCards.id, rateCardId))
  })

  return { rateCardId, deliveryPartner, saved: rows.length }
}

const resolveDestination = async (destinationCountry: unknown) => {
  const raw = String(destinationCountry || '').trim()
  if (!raw) throw new Error('Destination country is required')

  const key = normalizeCountryKey(raw)
  const [match] = await db
    .select()
    .from(internationalCountryZones)
    .where(
      and(
        eq(internationalCountryZones.isActive, true),
        or(
          eq(internationalCountryZones.countryKey, key),
          ilike(internationalCountryZones.countryName, raw),
        ),
      ),
    )
    .limit(1)

  if (match) return match

  if (/^[A-Z]$/i.test(raw)) {
    return {
      countryName: `Zone ${raw.toUpperCase()}`,
      countryKey: raw.toUpperCase(),
      zoneCode: raw.toUpperCase(),
    }
  }

  throw new Error('Destination country is not configured in the international zone sheet')
}

const buildDestinationCondition = (destinationZone: string, country: string) => {
  if (destinationZone) {
    return eq(internationalRates.destinationZone, destinationZone)
  }

  return or(
    eq(internationalRates.destinationCountry, country),
    eq(internationalRates.destinationCountry, '*'),
  )
}

export const calculateInternationalRate = async (input: any) => {
  const weight = Number(input.weight)
  const destination = await resolveDestination(input.destinationCountry)
  const country = destination.countryName
  const destinationZone = destination.zoneCode.toUpperCase()
  if (!input.rateCardId) throw new Error('Rate card is required')
  if (!Number.isFinite(weight) || weight <= 0) throw new Error('Weight must be greater than zero')

  const [card] = await db.select().from(internationalRateCards).where(and(eq(internationalRateCards.id, input.rateCardId), eq(internationalRateCards.isActive, true))).limit(1)
  if (!card) throw new Error('International rate card not found')
  if (input.originZone && String(input.originZone).toUpperCase() !== card.originZone.toUpperCase()) throw new Error('Origin zone does not match the selected rate card')

  const conditions: any[] = [
    eq(internationalRates.rateCardId, card.id),
    eq(internationalRates.isActive, true),
    lte(internationalRates.minWeight, weight.toString()),
    gte(internationalRates.maxWeight, weight.toString()),
    buildDestinationCondition(destinationZone, country),
  ]
  if (input.deliveryPartner) conditions.push(eq(internationalRates.deliveryPartner, input.deliveryPartner))
  const matches = await db.select().from(internationalRates).where(and(...conditions)).orderBy(asc(internationalRates.maxWeight), asc(internationalRates.ratePerKg))
  if (!matches.length) throw new Error('No international rate is configured for this shipment')

  return matches.map((rate) => {
    const baseRate = Number(rate.baseRate)
    const weightCharge = Number(rate.ratePerKg) * weight
    const subtotal = baseRate + weightCharge
    const fuelSurchargeMode = normalizeFuelSurchargeMode(rate.fuelSurchargeMode)
    const fuelSurchargeValue = Number(rate.fuelSurchargeValue) || 0
    const fuelSurcharge = fuelSurchargeMode === 'flat'
      ? fuelSurchargeValue
      : subtotal * (fuelSurchargeValue / 100)
    const total = subtotal + fuelSurcharge
    return {
      id: rate.id,
      rateCard: card.name,
      deliveryPartner: rate.deliveryPartner,
      originZone: card.originZone,
      destinationCountry: country,
      destinationZone,
      destinationCity: input.destinationCity || null,
      destinationState: input.destinationState || null,
      weight,
      slabWeight: Number(rate.maxWeight),
      baseRate,
      ratePerKg: Number(rate.ratePerKg),
      weightCharge,
      subtotal: Number(subtotal.toFixed(2)),
      fuelSurchargeMode,
      fuelSurchargeValue,
      fuelSurcharge: Number(fuelSurcharge.toFixed(2)),
      total: Number(total.toFixed(2)),
      currency: rate.currency,
      estimatedDays: rate.estimatedDays,
    }
  })
}
