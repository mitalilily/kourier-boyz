import fs from 'fs'
import path from 'path'
import { and, asc, eq, isNull, sql } from 'drizzle-orm'
import type { Row } from 'read-excel-file/node'

import { db, pool } from '../models/client'
import { upsertZoneToZoneRate } from '../models/services/b2bAdmin.service'
import {
  getAdditionalCharges,
  upsertAdditionalCharges,
  upsertVolumetricRules,
} from '../models/services/b2bPricingConfig.service'
import { remapZonePincodes } from '../models/services/zone.service'
import { couriers } from '../models/schema/couriers'
import { plans } from '../models/schema/plans'
import { b2bZoneStates, zones } from '../models/schema/zones'
import { readXlsxRows } from '../utils/xlsx'

type ZoneSeed = {
  code: string
  name: string
  states: string[]
  rawStates: string
}

type RateSeed = {
  originCode: string
  destinationCode: string
  ratePerKg: number
}

type ChargeRow = {
  key: string
  remark: string
  calculation: string
  unitCharge: number | string | null
  min: number | string | null
  max: number | string | null
}

type OdaSlabRow = {
  lowerLimitKg: number | null
  upperLimitKg: number | null
  perKgCharge: number | string | null
  minCharge: number | string | null
  maxCharge: number | string | null
}

type CourierRecord = typeof couriers.$inferSelect
type PlanRecord = typeof plans.$inferSelect

const DEFAULT_WORKBOOK = path.resolve(
  process.env.USERPROFILE || '',
  'Downloads',
  'new Star Logistics Jaipur Rate Card 50 150.xlsx',
)

const normalizeText = (value: unknown) => String(value ?? '').trim()

const toNumericValue = (value: unknown) => {
  const normalized = normalizeText(value)
  if (!normalized) return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

const argValue = (flag: string) => {
  const arg = process.argv.find((entry) => entry.startsWith(`${flag}=`))
  return arg ? arg.slice(flag.length + 1) : ''
}

const hasFlag = (flag: string) => process.argv.includes(flag)

const titleToName = (value: string) => normalizeText(value).replace(/\s+/g, ' ')

const toFieldKey = (value: string, fallback: string) => {
  const normalized = normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

  return normalized || fallback
}

const expandStateToken = (token: string) => {
  const normalized = titleToName(token)
  const upper = normalized.toUpperCase()

  const aliases: Record<string, string[]> = {
    AP: ['Andhra Pradesh'],
    UP: ['Uttar Pradesh'],
    WB: ['West Bengal'],
    HP: ['Himachal Pradesh'],
    'J&K': ['Jammu and Kashmir', 'Jammu & Kashmir'],
    JNK: ['Jammu and Kashmir', 'Jammu & Kashmir'],
    'DADRA & NAGAR HAVELI AND DAMAN & DIU': ['Dadra and Nagar Haveli and Daman and Diu'],
    'DADRA AND NAGAR HAVELI AND DAMAN AND DIU': ['Dadra and Nagar Haveli and Daman and Diu'],
    PONDICHERRY: ['Puducherry'],
  }

  if (aliases[upper]) {
    return aliases[upper]
  }

  return [normalized]
}

const parseStates = (rawValue: string) => {
  const prepared = rawValue
    .replace(/Daman\s*&\s*Diu\s+and\s+Dadra\s*&\s*Nagar\s*Haveli/gi, 'Daman & Diu|Dadra & Nagar Haveli')
    .replace(/Tamil Nadu\s*&\s*Puducherry/gi, 'Tamil Nadu|Puducherry')
    .replace(/Nagaland\s+and\s+Sikkim/gi, 'Nagaland|Sikkim')
    .replace(/\bJ&K\b/gi, 'Jammu & Kashmir')

  const tokens = prepared
    .split(/[,|]/)
    .map((part) => part.trim())
    .filter(Boolean)

  const unique = new Set<string>()
  for (const token of tokens) {
    for (const expanded of expandStateToken(token)) {
      const value = titleToName(expanded)
      if (value) {
        unique.add(value)
      }
    }
  }

  if (unique.has('Daman and Diu') && unique.has('Dadra and Nagar Haveli')) {
    unique.add('Dadra and Nagar Haveli and Daman and Diu')
  }

  return Array.from(unique)
}

const parseWorkbook = async (filePath: string) => {
  const matrixRows = (await readXlsxRows(filePath, 'Sheet1')) as Row[]
  const zoneRows = (await readXlsxRows(filePath, 'Zone')) as Row[]

  if (!matrixRows.length || !zoneRows.length) {
    throw new Error('Workbook is missing the expected Sheet1/Zone content.')
  }

  const matrixCodes = matrixRows[0]
    .map((cell) => normalizeText(cell))
    .filter(Boolean)

  if (matrixCodes.length === 0) {
    throw new Error('Could not find any destination zone codes in Sheet1.')
  }

  const zoneDefinitions = zoneRows
    .slice(1)
    .filter((row) => normalizeText(row[0]) && normalizeText(row[1]))
    .slice(0, matrixCodes.length)

  if (zoneDefinitions.length !== matrixCodes.length) {
    throw new Error(
      `Zone definition count (${zoneDefinitions.length}) does not match matrix code count (${matrixCodes.length}).`,
    )
  }

  const zonesFromWorkbook: ZoneSeed[] = zoneDefinitions.map((row, index) => ({
    code: matrixCodes[index],
    name: titleToName(normalizeText(row[0])),
    rawStates: normalizeText(row[1]),
    states: parseStates(normalizeText(row[1])),
  }))

  const rateRows: RateSeed[] = []
  for (const row of matrixRows.slice(1, matrixCodes.length + 1)) {
    const originCode = normalizeText(row[0])
    if (!originCode) continue

    matrixCodes.forEach((destinationCode, index) => {
      const ratePerKg = toNumericValue(row[index + 1])
      if (ratePerKg == null) return
      rateRows.push({
        originCode,
        destinationCode,
        ratePerKg,
      })
    })
  }

  const additionalRows = matrixRows
    .slice(24)
    .filter(
      (row) =>
        normalizeText(row[0]) &&
        normalizeText(row[0]) !== 'ODA Charges' &&
        normalizeText(row[0]) !== 'Charge',
    )
    .map<ChargeRow>((row) => ({
      key: normalizeText(row[0]),
      remark: normalizeText(row[1]),
      calculation: normalizeText(row[2]),
      unitCharge: normalizeText(row[3]) || null,
      min: normalizeText(row[4]) || null,
      max: normalizeText(row[5]) || null,
    }))

  const odaRows = matrixRows
    .slice(75)
    .filter((row) => normalizeText(row[0]) === 'ODA')
    .map<OdaSlabRow>((row) => ({
      lowerLimitKg: toNumericValue(row[1]),
      upperLimitKg: toNumericValue(row[2]),
      perKgCharge: normalizeText(row[3]) || null,
      minCharge: normalizeText(row[4]) || null,
      maxCharge: normalizeText(row[5]) || null,
    }))

  return {
    zones: zonesFromWorkbook,
    rates: rateRows,
    charges: additionalRows,
    odaRows,
    specialNote: normalizeText(matrixRows[11]?.[0]),
  }
}

const buildChargeIndex = (rows: ChargeRow[]) => {
  const index = new Map<string, ChargeRow[]>()
  for (const row of rows) {
    const existing = index.get(row.key) || []
    existing.push(row)
    index.set(row.key, existing)
  }
  return index
}

const getFirstCharge = (index: Map<string, ChargeRow[]>, key: string) => index.get(key)?.[0]

const formatChargeLabel = (value: string) => {
  const normalized = normalizeText(value)
  if (!normalized) return 'Imported Workbook Field'

  return normalized
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

const resolveCourier = async (explicitCourierId?: string) => {
  const candidates = await db
    .select()
    .from(couriers)
    .where(
      and(
        eq(couriers.serviceProvider, 'delhivery'),
        eq(couriers.isEnabled, true),
        sql`${couriers.businessType} @> '["b2b"]'::jsonb`,
      ),
    )
    .orderBy(asc(couriers.name), asc(couriers.id))

  if (!candidates.length) {
    throw new Error('No enabled Delhivery courier with B2B business type was found.')
  }

  if (explicitCourierId) {
    const matched = candidates.find((courier) => String(courier.id) === String(explicitCourierId))
    if (!matched) {
      throw new Error(`Courier ${explicitCourierId} is not an enabled Delhivery B2B courier.`)
    }
    return matched
  }

  if (candidates.length === 1) {
    return candidates[0]
  }

  const scored = [...candidates]
    .map((courier) => {
      const name = normalizeText(courier.name).toLowerCase()
      let score = 0
      if (name.includes('ltl')) score += 5
      if (name.includes('b2b')) score += 4
      if (name.includes('freight')) score += 3
      if (name.includes('surface')) score += 1
      return { courier, score }
    })
    .sort((left, right) => right.score - left.score)

  if (scored[0]?.score > 0 && scored[0].score !== scored[1]?.score) {
    return scored[0].courier
  }

  const choices = candidates.map((courier) => `${courier.id} - ${courier.name}`).join(', ')
  throw new Error(
    `Multiple Delhivery B2B couriers were found. Re-run with --courier-id=<id>. Choices: ${choices}`,
  )
}

const resolvePlan = async (planId?: string, planName?: string) => {
  if (planId) {
    const [matched] = await db.select().from(plans).where(eq(plans.id, planId)).limit(1)
    if (!matched) {
      throw new Error(`Plan ${planId} was not found.`)
    }
    return matched
  }

  if (planName) {
    const [matched] = await db
      .select()
      .from(plans)
      .where(and(eq(plans.name, planName), eq(plans.business_type, 'b2b')))
      .limit(1)
    if (!matched) {
      throw new Error(`Plan "${planName}" was not found.`)
    }
    return matched
  }

  const [basicPlan] = await db
    .select()
    .from(plans)
    .where(and(eq(plans.name, 'Basic'), eq(plans.business_type, 'b2b')))
    .limit(1)
  if (!basicPlan) {
    throw new Error('Basic plan was not found. Create the Basic plan before seeding the Delhivery B2B rate card.')
  }

  return basicPlan
}

const upsertZones = async (zoneSeeds: ZoneSeed[]) => {
  const zoneIdByCode = new Map<string, string>()

  for (const zoneSeed of zoneSeeds) {
    const [zoneRecord] = await db
      .insert(zones)
      .values({
        code: zoneSeed.code,
        name: zoneSeed.name,
        business_type: 'B2B',
        region: zoneSeed.name,
        states: zoneSeed.states,
        metadata: {
          source: 'delhivery-b2b-workbook',
          rawStates: zoneSeed.rawStates,
        },
      })
      .onConflictDoUpdate({
        target: [zones.code, zones.business_type],
        set: {
          name: zoneSeed.name,
          region: zoneSeed.name,
          states: zoneSeed.states,
          metadata: {
            source: 'delhivery-b2b-workbook',
            rawStates: zoneSeed.rawStates,
          },
          updated_at: new Date(),
        },
      })
      .returning()

    await db
      .delete(b2bZoneStates)
      .where(
        and(
          eq(b2bZoneStates.zone_id, zoneRecord.id),
          isNull(b2bZoneStates.courier_id),
          isNull(b2bZoneStates.service_provider),
        ),
      )

    if (zoneSeed.states.length > 0) {
      await db.insert(b2bZoneStates).values(
        zoneSeed.states.map((stateName) => ({
          zone_id: zoneRecord.id,
          state_name: stateName,
          courier_id: null,
          service_provider: null,
        })),
      )
    }

    await remapZonePincodes(zoneRecord.id)
    zoneIdByCode.set(zoneSeed.code, zoneRecord.id)
  }

  return zoneIdByCode
}

const applyRateMatrix = async (
  rates: RateSeed[],
  zoneIdByCode: Map<string, string>,
  courier: CourierRecord,
  plan: PlanRecord,
) => {
  for (const rate of rates) {
    const originZoneId = zoneIdByCode.get(rate.originCode)
    const destinationZoneId = zoneIdByCode.get(rate.destinationCode)

    if (!originZoneId || !destinationZoneId) {
      throw new Error(`Missing zone mapping for ${rate.originCode} -> ${rate.destinationCode}.`)
    }

    await upsertZoneToZoneRate({
      originZoneId,
      destinationZoneId,
      ratePerKg: rate.ratePerKg,
      planId: plan.id,
      courierScope: {
        courierId: courier.id,
        serviceProvider: courier.serviceProvider,
      },
    })
  }
}

const applyAdditionalCharges = async (
  chargeRows: ChargeRow[],
  odaRows: OdaSlabRow[],
  courier: CourierRecord,
  plan: PlanRecord,
  specialNote: string,
) => {
  const index = buildChargeIndex(chargeRows)

  const processing = getFirstCharge(index, 'processing')
  const divisor = getFirstCharge(index, 'divisor')
  const minimumChargeableFreight = getFirstCharge(
    index,
    'Minimum chargeable freight amount ( Base Freight +AWB+FM )',
  )
  const minimumChargeableWeight = getFirstCharge(index, 'min_chg_wt')
  const demurrageFreeDays = getFirstCharge(index, 'demurrage_free_store_period')
  const reattempt = getFirstCharge(index, 're_attempt_charge')
  const appointmentHandling = getFirstCharge(index, 'apt_handling')
  const fsc = getFirstCharge(index, 'fsc')
  const demurrage = getFirstCharge(index, 'demurrage_charge')
  const mallDelivery = getFirstCharge(index, 'mall_delivery')
  const rovCarrier = getFirstCharge(index, 'rov_carrier')
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

  const importedCustomFields: Record<string, any> = {}
  const importedFieldDefinitions: Record<string, any> = {}

  let importedOrder = 1
  const addReferenceField = (
    fieldKey: string,
    label: string,
    row: {
      remark?: string
      calculation?: string
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
      group: 'Workbook Imported Rates',
      order: importedOrder++,
      description: description || normalizeText(row.remark) || 'Imported from the Delhivery B2B workbook.',
      unit: normalizeText(row.calculation),
      condition: {
        referenceOnly: true,
      },
    }
  }

  if (specialNote) {
    addReferenceField(
      'workbook_special_note',
      'Workbook Special Note',
      {
        remark: 'Special commercial note from workbook',
        calculation: 'note',
        unitCharge: specialNote,
      },
      'Reference-only note imported from the rate card workbook.',
    )
  }

  chargeRows.forEach((row, indexValue) => {
    if (mappedKeys.has(row.key)) {
      return
    }

    const fieldKey = `${toFieldKey(row.key, `imported_charge_${indexValue + 1}`)}_${indexValue + 1}`
    addReferenceField(fieldKey, formatChargeLabel(row.key), row)
  })

  odaRows.forEach((row, indexValue) => {
    addReferenceField(
      `oda_slab_${indexValue + 1}`,
      `ODA Slab ${indexValue + 1}`,
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

  const payload = {
    planId: plan.id,
    awbCharges: toNumericValue(processing?.unitCharge) ?? 0,
    cftFactor: toNumericValue(divisor?.unitCharge) ?? 4500,
    minimumChargeableAmount: toNumericValue(minimumChargeableFreight?.unitCharge) ?? 0,
    minimumChargeableWeight: toNumericValue(minimumChargeableWeight?.unitCharge) ?? 0,
    freeStorageDays: toNumericValue(demurrageFreeDays?.unitCharge) ?? 5,
    demurragePerKgDay: toNumericValue(demurrage?.unitCharge) ?? 0,
    demurragePerAwbDay: toNumericValue(demurrage?.min) ?? 0,
    fuelSurchargePercentage: toNumericValue(fsc?.unitCharge) ?? 0,
    odaCharges: toNumericValue(odaRows[0]?.minCharge) ?? 0,
    odaPerKgCharge: toNumericValue(odaRows[0]?.perKgCharge) ?? 0,
    odaMethod: 'whichever_is_higher' as const,
    deliveryReattemptPerKg: toNumericValue(reattempt?.unitCharge) ?? 0,
    deliveryReattemptPerAwb: toNumericValue(reattempt?.min) ?? 0,
    deliveryReattemptMethod: 'whichever_is_higher' as const,
    timeSpecificPerKg: toNumericValue(appointmentHandling?.unitCharge) ?? 0,
    timeSpecificPerAwb: toNumericValue(appointmentHandling?.min) ?? 0,
    timeSpecificMethod: 'whichever_is_higher' as const,
    mallDeliveryPerKg: toNumericValue(mallDelivery?.unitCharge) ?? 0,
    mallDeliveryPerAwb: toNumericValue(mallDelivery?.min) ?? 0,
    mallDeliveryMethod: 'whichever_is_higher' as const,
    rovFixedAmount: toNumericValue(rovCarrier?.min) ?? 0,
    rovPercentage: toNumericValue(rovCarrier?.unitCharge) ?? 0,
    rovMethod: 'whichever_is_higher' as const,
    courierScope: {
      courierId: courier.id,
      serviceProvider: courier.serviceProvider,
    },
    customFields: {} as Record<string, any>,
    fieldDefinitions: {} as Record<string, any>,
  }

  const existingCharges = await getAdditionalCharges({
    courierScope: {
      courierId: courier.id,
      serviceProvider: courier.serviceProvider,
    },
    includeGlobal: false,
    planId: plan.id,
  })

  const preservedCustomFields = Object.fromEntries(
    Object.entries(existingCharges?.custom_fields || {}).filter(([fieldKey]) => {
      const definition = existingCharges?.field_definitions?.[fieldKey]
      return definition?.group !== 'Workbook Imported Rates'
    }),
  )

  const preservedFieldDefinitions = Object.fromEntries(
    Object.entries(existingCharges?.field_definitions || {}).filter(([, definition]) => {
      return definition?.group !== 'Workbook Imported Rates'
    }),
  )

  payload.customFields = {
    ...preservedCustomFields,
    ...importedCustomFields,
  }
  payload.fieldDefinitions = {
    ...preservedFieldDefinitions,
    ...importedFieldDefinitions,
  }

  await upsertAdditionalCharges(payload)
  await upsertVolumetricRules({
    volumetricDivisor: toNumericValue(divisor?.unitCharge) ?? 4500,
    cftFactor: toNumericValue(divisor?.unitCharge) ?? 4500,
    courierScope: {
      courierId: courier.id,
      serviceProvider: courier.serviceProvider,
    },
  })
}

async function main() {
  const workbookPath = argValue('--file') || (fs.existsSync(DEFAULT_WORKBOOK) ? DEFAULT_WORKBOOK : '')
  const planId = argValue('--plan-id')
  const planName = argValue('--plan-name')
  const courierId = argValue('--courier-id')
  const dryRun = hasFlag('--dry-run')

  if (!workbookPath) {
    throw new Error(
      'Workbook file not found. Pass --file="C:\\path\\to\\rate-card.xlsx" to seed the Delhivery B2B rate card.',
    )
  }

  if (!fs.existsSync(workbookPath)) {
    throw new Error(`Workbook not found at ${workbookPath}`)
  }

  const workbook = await parseWorkbook(workbookPath)
  const courier = await resolveCourier(courierId)
  const plan = await resolvePlan(planId, planName)

  console.log(`Workbook: ${workbookPath}`)
  console.log(`Courier: ${courier.name} (${courier.id} / ${courier.serviceProvider})`)
  console.log(`Plan: ${plan.name} (${plan.id})`)
  console.log(`Zones: ${workbook.zones.length}`)
  console.log(`Rates: ${workbook.rates.length}`)
  if (workbook.specialNote) {
    console.log(`Special note: ${workbook.specialNote}`)
  }

  if (dryRun) {
    console.log('Dry run only. No database changes were applied.')
    return
  }

  const zoneIdByCode = await upsertZones(workbook.zones)
  await applyRateMatrix(workbook.rates, zoneIdByCode, courier, plan)
  await applyAdditionalCharges(workbook.charges, workbook.odaRows, courier, plan, workbook.specialNote)

  console.log('Delhivery B2B Basic-plan zones, rate matrix, and workbook additional charges seeded successfully.')
}

main()
  .catch((error) => {
    console.error('Failed to seed Delhivery B2B rate card:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })
