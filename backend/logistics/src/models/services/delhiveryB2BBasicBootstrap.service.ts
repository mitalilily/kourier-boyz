import { and, eq, or, SQLWrapper } from 'drizzle-orm'

import delhiveryB2BBasicRatecard from '../../config/delhiveryB2BBasicRatecard.json'
import { db } from '../client'
import { couriers } from '../schema/couriers'
import { plans } from '../schema/plans'
import { b2bAdditionalCharges, b2bVolumetricRules, b2bZoneToZoneRates, zones } from '../schema/zones'
import { ensureDefaultB2BZones } from './zone.service'

type CourierScope = {
  courierId?: number | null
  serviceProvider?: string | null
}

type RatecardConfig = {
  seedVersion: string
  serviceProvider: string
  planName: string
  zoneCodes: string[]
  matrixByCode: Record<string, Record<string, number>>
  mappedAdditionalCharges: Record<string, string | number>
  specialNotes: string[]
  workbookChargeRows: Array<{
    key: string
    remark: string | null
    calculation: string | null
    unitCharge: string | number | null
    min: string | number | null
    max: string | number | null
  }>
  odaSlabs: Array<{
    lowerLimitKg: number | null
    upperLimitKg: number | null
    perKgCharge: number | null
    minCharge: number | null
    maxCharge: number | null
  }>
}

type CourierRecord = typeof couriers.$inferSelect
type PlanRecord = typeof plans.$inferSelect

const ratecardConfig = delhiveryB2BBasicRatecard as RatecardConfig
const WORKBOOK_GROUP = 'Workbook Imported Rates'
const RATECARD_SOURCE = 'delhivery-b2b-basic-ratecard-config'
const WORKBOOK_NAME = 'new Star Logistics Jaipur Rate Card 50 150.xlsx'

const normalizeCourierScope = (scope?: CourierScope) => {
  if (!scope || typeof scope !== 'object') {
    return { courierId: null, serviceProvider: null }
  }

  return {
    courierId: scope.courierId != null ? Number(scope.courierId) : null,
    serviceProvider: scope.serviceProvider ? String(scope.serviceProvider).trim() : null,
  }
}

const normalizeText = (value: unknown) => String(value ?? '').trim()

const toFieldKey = (value: string, fallback: string) => {
  const normalized = normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

  return normalized || fallback
}

const formatChargeLabel = (value: string) => {
  const normalized = normalizeText(value)
  if (!normalized) return 'Imported Workbook Field'

  return normalized
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

const isObject = (value: unknown): value is Record<string, any> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const toDecimalString = (value: string | number | null | undefined) =>
  value == null || value === '' ? '0' : String(value)

const buildImportedWorkbookFields = () => {
  const importedCustomFields: Record<string, any> = {}
  const importedFieldDefinitions: Record<string, any> = {}

  let importedOrder = 1
  const addReferenceField = (
    fieldKey: string,
    label: string,
    row: {
      remark?: string | null
      calculation?: string | null
      unitCharge?: unknown
      min?: unknown
      max?: unknown
      lowerLimitKg?: unknown
      upperLimitKg?: unknown
    },
    description?: string,
  ) => {
    importedCustomFields[fieldKey] = {
      remark: normalizeText(row.remark),
      calculation: normalizeText(row.calculation),
      unitCharge: row.unitCharge ?? '',
      min: row.min ?? '',
      max: row.max ?? '',
      lowerLimitKg: row.lowerLimitKg ?? '',
      upperLimitKg: row.upperLimitKg ?? '',
    }

    importedFieldDefinitions[fieldKey] = {
      label,
      visible: true,
      group: WORKBOOK_GROUP,
      order: importedOrder++,
      description:
        description || normalizeText(row.remark) || 'Imported from the Delhivery B2B workbook.',
      unit: normalizeText(row.calculation),
      condition: {
        referenceOnly: true,
      },
    }
  }

  ratecardConfig.specialNotes.forEach((note, index) => {
    if (!normalizeText(note)) return
    addReferenceField(
      `workbook_special_note_${index + 1}`,
      index === 0 ? 'Workbook Special Note' : `Workbook Special Note ${index + 1}`,
      {
        remark: 'Special commercial note from workbook',
        calculation: 'note',
        unitCharge: note,
      },
      'Reference-only note imported from the rate card workbook.',
    )
  })

  const mappedKeys = new Set([
    'processing',
    'divisor',
    'Minimum chargeable freight amount ( Base Freight +AWB+FM )',
    'min_chg_wt',
    'demurrage_charge',
    'demurrage_free_store_period',
    'fsc',
    're_attempt_charge',
    'apt_handling',
    'mall_delivery',
    'rov_carrier',
  ])

  ratecardConfig.workbookChargeRows.forEach((row, index) => {
    if (mappedKeys.has(row.key)) {
      return
    }

    const fieldKey = `${toFieldKey(row.key, `imported_charge_${index + 1}`)}_${index + 1}`
    addReferenceField(fieldKey, formatChargeLabel(row.key), row)
  })

  ratecardConfig.odaSlabs.forEach((row, index) => {
    addReferenceField(
      `oda_slab_${index + 1}`,
      `ODA Slab ${index + 1}`,
      {
        remark: 'Imported ODA slab configuration',
        calculation: 'per kg',
        unitCharge: row.perKgCharge,
        min: row.minCharge,
        max: row.maxCharge,
        lowerLimitKg: row.lowerLimitKg,
        upperLimitKg: row.upperLimitKg,
      },
      'Reference-only ODA slab imported from the workbook.',
    )
  })

  return { importedCustomFields, importedFieldDefinitions }
}

const resolveBasicPlan = async (planId?: string) => {
  if (!planId) return null

  const [plan] = await db.select().from(plans).where(eq(plans.id, planId)).limit(1)
  if (!plan) return null

  if (normalizeText(plan.name).toLowerCase() !== ratecardConfig.planName.toLowerCase()) {
    return null
  }

  return plan
}

const resolveTargetCouriers = async (scope?: CourierScope) => {
  const { courierId, serviceProvider } = normalizeCourierScope(scope)
  const filters: SQLWrapper[] = [
    eq(couriers.serviceProvider, ratecardConfig.serviceProvider),
    eq(couriers.isEnabled, true),
  ]

  if (courierId != null) {
    filters.push(eq(couriers.id, courierId))
  }

  if (serviceProvider && serviceProvider !== ratecardConfig.serviceProvider) {
    return []
  }

  const candidates = await db.select().from(couriers).where(and(...filters))

  return candidates.filter((courier) =>
    Array.isArray(courier.businessType)
      ? courier.businessType.map((entry) => String(entry).toLowerCase()).includes('b2b')
      : false,
  )
}

const buildScopedConditions = (
  courier: CourierRecord,
  plan: PlanRecord,
): [SQLWrapper, SQLWrapper, SQLWrapper] => [
  eq(b2bZoneToZoneRates.courier_id, courier.id),
  eq(b2bZoneToZoneRates.service_provider, courier.serviceProvider),
  eq(b2bZoneToZoneRates.plan_id, plan.id),
]

const normalizeRateValue = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Number(parsed.toFixed(4)) : null
}

const seedRateMatrixForCourier = async (
  tx: any,
  courier: CourierRecord,
  plan: PlanRecord,
  zoneIdByCode: Map<string, string>,
) => {
  const existingRows = await tx
    .select({
      id: b2bZoneToZoneRates.id,
      originZoneId: b2bZoneToZoneRates.origin_zone_id,
      destinationZoneId: b2bZoneToZoneRates.destination_zone_id,
      ratePerKg: b2bZoneToZoneRates.rate_per_kg,
      metadata: b2bZoneToZoneRates.metadata,
    })
    .from(b2bZoneToZoneRates)
    .where(and(...buildScopedConditions(courier, plan)))

  const existingMap = new Map<
    string,
    { id: string; ratePerKg: string | null; metadata: Record<string, any> | null }
  >()

  existingRows.forEach((row: any) => {
    const key = `${row.originZoneId}:${row.destinationZoneId}`
    if (!existingMap.has(key)) {
      existingMap.set(key, {
        id: row.id,
        ratePerKg: row.ratePerKg,
        metadata: isObject(row.metadata) ? row.metadata : null,
      })
    }
  })

  for (const originCode of ratecardConfig.zoneCodes) {
    const originZoneId = zoneIdByCode.get(originCode)
    if (!originZoneId) {
      throw new Error(`Missing B2B zone mapping for origin code ${originCode}`)
    }

    for (const destinationCode of ratecardConfig.zoneCodes) {
      const destinationZoneId = zoneIdByCode.get(destinationCode)
      const ratePerKg = ratecardConfig.matrixByCode[originCode]?.[destinationCode]

      if (!destinationZoneId) {
        throw new Error(`Missing B2B zone mapping for destination code ${destinationCode}`)
      }

      if (typeof ratePerKg !== 'number') {
        throw new Error(`Missing Delhivery B2B matrix rate for ${originCode} -> ${destinationCode}`)
      }

      const key = `${originZoneId}:${destinationZoneId}`
      const existing = existingMap.get(key)
      const normalizedExistingRate = normalizeRateValue(existing?.ratePerKg)
      const normalizedConfiguredRate = normalizeRateValue(ratePerKg)
      const metadata = {
        ...(existing?.metadata || {}),
        source: RATECARD_SOURCE,
        seedVersion: ratecardConfig.seedVersion,
        importedFrom: WORKBOOK_NAME,
        seedRatePerKg: ratePerKg,
      }

      if (existing) {
        if (
          normalizedExistingRate === normalizedConfiguredRate &&
          existing.metadata?.source === RATECARD_SOURCE &&
          existing.metadata?.seedVersion === ratecardConfig.seedVersion
        ) {
          continue
        }

        await tx
          .update(b2bZoneToZoneRates)
          .set({
            rate_per_kg: String(ratePerKg),
            metadata,
            updated_at: new Date(),
          })
          .where(eq(b2bZoneToZoneRates.id, existing.id))
      } else {
        await tx.insert(b2bZoneToZoneRates).values({
          origin_zone_id: originZoneId,
          destination_zone_id: destinationZoneId,
          courier_id: courier.id,
          service_provider: courier.serviceProvider,
          plan_id: plan.id,
          rate_per_kg: String(ratePerKg),
          metadata,
        })
      }
    }
  }
}

const seedAdditionalChargesForCourier = async (
  tx: any,
  courier: CourierRecord,
  plan: PlanRecord,
) => {
  const [existing] = await tx
    .select()
    .from(b2bAdditionalCharges)
    .where(
      and(
        eq(b2bAdditionalCharges.courier_id, courier.id),
        eq(b2bAdditionalCharges.service_provider, courier.serviceProvider),
        eq(b2bAdditionalCharges.plan_id, plan.id),
      ),
    )
    .limit(1)

  const existingMetadata = isObject(existing?.metadata) ? existing.metadata : {}
  if (
    existing &&
    existingMetadata.source === RATECARD_SOURCE &&
    existingMetadata.seedVersion === ratecardConfig.seedVersion
  ) {
    return
  }

  const { importedCustomFields, importedFieldDefinitions } = buildImportedWorkbookFields()

  const preservedCustomFields = Object.fromEntries(
    Object.entries(isObject(existing?.custom_fields) ? existing.custom_fields : {}).filter(
      ([fieldKey]) => {
        const definition = isObject(existing?.field_definitions)
          ? existing?.field_definitions?.[fieldKey]
          : undefined
        return definition?.group !== WORKBOOK_GROUP
      },
    ),
  )

  const preservedFieldDefinitions = Object.fromEntries(
    Object.entries(isObject(existing?.field_definitions) ? existing.field_definitions : {}).filter(
      ([, definition]: [string, any]) => definition?.group !== WORKBOOK_GROUP,
    ),
  )

  const values = ratecardConfig.mappedAdditionalCharges
  const payload = {
    awb_charges: toDecimalString(values.awbCharges),
    cft_factor: toDecimalString(values.cftFactor),
    minimum_chargeable_amount: toDecimalString(values.minimumChargeableAmount),
    minimum_chargeable_weight: toDecimalString(values.minimumChargeableWeight),
    minimum_chargeable_method: String(values.minimumChargeableMethod || 'whichever_is_higher'),
    free_storage_days: Number(values.freeStorageDays || 0),
    demurrage_per_awb_day: toDecimalString(values.demurragePerAwbDay),
    demurrage_per_kg_day: toDecimalString(values.demurragePerKgDay),
    demurrage_method: String(values.demurrageMethod || 'whichever_is_higher'),
    public_holiday_pickup_charge: toDecimalString(values.publicHolidayPickupCharge),
    fuel_surcharge_percentage: toDecimalString(values.fuelSurchargePercentage),
    green_tax: toDecimalString(values.greenTax),
    oda_charges: toDecimalString(values.odaCharges),
    oda_per_kg_charge: toDecimalString(values.odaPerKgCharge),
    oda_method: String(values.odaMethod || 'whichever_is_higher'),
    csd_delivery_charge: toDecimalString(values.csdDeliveryCharge),
    time_specific_per_kg: toDecimalString(values.timeSpecificPerKg),
    time_specific_per_awb: toDecimalString(values.timeSpecificPerAwb),
    time_specific_method: String(values.timeSpecificMethod || 'whichever_is_higher'),
    mall_delivery_per_kg: toDecimalString(values.mallDeliveryPerKg),
    mall_delivery_per_awb: toDecimalString(values.mallDeliveryPerAwb),
    mall_delivery_method: String(values.mallDeliveryMethod || 'whichever_is_higher'),
    delivery_reattempt_per_kg: toDecimalString(values.deliveryReattemptPerKg),
    delivery_reattempt_per_awb: toDecimalString(values.deliveryReattemptPerAwb),
    delivery_reattempt_method: String(values.deliveryReattemptMethod || 'whichever_is_higher'),
    handling_single_piece: toDecimalString(values.handlingSinglePiece),
    handling_below_100_kg: toDecimalString(values.handlingBelow100Kg),
    handling_100_to_200_kg: toDecimalString(values.handling100To200Kg),
    handling_above_200_kg: toDecimalString(values.handlingAbove200Kg),
    insurance_charge: toDecimalString(values.insuranceCharge),
    cod_fixed_amount: toDecimalString(values.codFixedAmount),
    cod_percentage: toDecimalString(values.codPercentage),
    cod_method: String(values.codMethod || 'whichever_is_higher'),
    rov_fixed_amount: toDecimalString(values.rovFixedAmount),
    rov_percentage: toDecimalString(values.rovPercentage),
    rov_method: String(values.rovMethod || 'whichever_is_higher'),
    liability_limit: toDecimalString(values.liabilityLimit),
    liability_method: String(values.liabilityMethod || 'whichever_is_lower'),
    custom_fields: {
      ...preservedCustomFields,
      ...importedCustomFields,
    },
    field_definitions: {
      ...preservedFieldDefinitions,
      ...importedFieldDefinitions,
    },
    metadata: {
      ...existingMetadata,
      source: RATECARD_SOURCE,
      seedVersion: ratecardConfig.seedVersion,
      importedFrom: WORKBOOK_NAME,
    },
    updated_at: new Date(),
  }

  if (existing) {
    await tx.update(b2bAdditionalCharges).set(payload).where(eq(b2bAdditionalCharges.id, existing.id))
    return
  }

  await tx.insert(b2bAdditionalCharges).values({
    ...payload,
    courier_id: courier.id,
    service_provider: courier.serviceProvider,
    plan_id: plan.id,
  })
}

const seedVolumetricRulesForCourier = async (tx: any, courier: CourierRecord) => {
  const [existing] = await tx
    .select()
    .from(b2bVolumetricRules)
    .where(
      and(
        eq(b2bVolumetricRules.courier_id, courier.id),
        eq(b2bVolumetricRules.service_provider, courier.serviceProvider),
      ),
    )
    .limit(1)

  const existingMetadata = isObject(existing?.metadata) ? existing.metadata : {}
  if (
    existing &&
    existingMetadata.source === RATECARD_SOURCE &&
    existingMetadata.seedVersion === ratecardConfig.seedVersion
  ) {
    return
  }

  const divisor = ratecardConfig.mappedAdditionalCharges.cftFactor
  const payload = {
    volumetric_divisor: toDecimalString(divisor),
    cft_factor: toDecimalString(divisor),
    metadata: {
      ...existingMetadata,
      source: RATECARD_SOURCE,
      seedVersion: ratecardConfig.seedVersion,
      importedFrom: WORKBOOK_NAME,
    },
    updated_at: new Date(),
  }

  if (existing) {
    await tx.update(b2bVolumetricRules).set(payload).where(eq(b2bVolumetricRules.id, existing.id))
    return
  }

  await tx.insert(b2bVolumetricRules).values({
    ...payload,
    courier_id: courier.id,
    service_provider: courier.serviceProvider,
  })
}

export const ensureDelhiveryB2BBasicPricing = async (params: {
  planId?: string
  courierScope?: CourierScope
}) => {
  const plan = await resolveBasicPlan(params.planId)
  if (!plan) {
    return { seeded: false, reason: 'not-basic-plan' as const }
  }

  const targetCouriers = await resolveTargetCouriers(params.courierScope)
  if (!targetCouriers.length) {
    return { seeded: false, reason: 'no-delhivery-b2b-courier' as const }
  }

  await db.transaction(async (tx) => {
    await ensureDefaultB2BZones(tx)

    const zoneCodeConditions = ratecardConfig.zoneCodes.map(
      (code) => eq(zones.code, code) as SQLWrapper,
    )
    const zoneRows = await tx
      .select({ id: zones.id, code: zones.code })
      .from(zones)
      .where(and(eq(zones.business_type, 'B2B'), or(...zoneCodeConditions)))

    const zoneIdByCode = new Map(zoneRows.map((zone) => [zone.code, zone.id]))

    for (const code of ratecardConfig.zoneCodes) {
      if (!zoneIdByCode.has(code)) {
        throw new Error(`Required Delhivery B2B zone ${code} is missing from the database.`)
      }
    }

    for (const courier of targetCouriers) {
      await seedRateMatrixForCourier(tx, courier, plan, zoneIdByCode)
      await seedAdditionalChargesForCourier(tx, courier, plan)
      await seedVolumetricRulesForCourier(tx, courier)
    }
  })

  return { seeded: true, reason: 'seeded' as const }
}
