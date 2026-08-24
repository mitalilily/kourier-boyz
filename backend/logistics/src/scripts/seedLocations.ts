import { and, eq, inArray } from 'drizzle-orm'
import fs from 'fs'
import path from 'path'
import { db, pool } from '../models/client'
import { shippingRates } from '../models/schema/shippingRates'
import { zoneMappings, zones } from '../models/schema/zones'
import { remapZonePincodes } from '../models/services/zone.service'
import { locations } from '../schema/schema'
import { readXlsxRows, xlsxRowsToRecords } from '../utils/xlsx'

const DATA_DIR = path.resolve('src/scripts/data')
const CHUNK_SIZE = 750

type Row = {
  pincode: string
  city: string
  state: string
  country: string
  tags: string[]
}

const normalize = (value: unknown) => String(value ?? '').trim()

const SPECIAL_ZONE_STATES = new Set(
  [
    'Arunachal Pradesh',
    'Assam',
    'Manipur',
    'Meghalaya',
    'Mizoram',
    'Nagaland',
    'Tripura',
    'Jammu and Kashmir',
  ].map((state) => state.toLowerCase()),
)

function mapRow(raw: Record<string, unknown>): Row | null {
  const pincode = normalize(raw.Pincode)
  if (!/^\d{6}$/.test(pincode)) return null

  const state = normalize(raw.HubState)
  const city = normalize(raw.BillingCity)
  if (!state || !city) return null

  const billingZone = normalize(raw.BillingZone)
  const cityType = normalize(raw['City Type'])
  const tags = [billingZone.toLowerCase(), cityType.toLowerCase()].filter(Boolean)
  if (
    SPECIAL_ZONE_STATES.has(state.toLowerCase()) ||
    billingZone.toLowerCase() === 'special destination'
  ) {
    tags.push('special_zone')
  }

  return { pincode, city, state, country: 'India', tags: [...new Set(tags)] }
}

async function insertBatch(rows: Row[]) {
  if (!rows.length) return
  await db.insert(locations).values(
    rows.map((row) => ({
      ...row,
      created_at: new Date(),
    })),
  )
}

async function syncB2BPincodes() {
  const b2bZones = await db
    .select({ id: zones.id, code: zones.code, states: zones.states })
    .from(zones)
    .where(eq(zones.business_type, 'B2B'))

  for (const zone of b2bZones) {
    if (zone.code === 'NE') {
      const states = Array.isArray(zone.states) ? zone.states : []
      if (!states.some((state) => String(state).toLowerCase().includes('andaman'))) {
        await db
          .update(zones)
          .set({ states: [...states, 'Andaman and Nicobar Islands'], updated_at: new Date() })
          .where(eq(zones.id, zone.id))
      }
    }
    await remapZonePincodes(zone.id)
    console.log(`Mapped B2B pincodes for zone ${zone.code}`)
  }

  console.log(`B2B pincode sync finished for ${b2bZones.length} zones`)
}

const LEGACY_B2C_ZONE_CODES = [
  'METRO_TO_METRO',
  'ROI',
  'SPECIAL_ZONE',
  'WITHIN_CITY',
  'WITHIN_REGION',
  'WITHIN_STATE',
]

async function removeLegacyB2CZones() {
  const legacyZones = await db
    .select({ id: zones.id, code: zones.code })
    .from(zones)
    .where(
      and(eq(zones.business_type, 'B2C'), inArray(zones.code, LEGACY_B2C_ZONE_CODES)),
    )

  if (!legacyZones.length) return
  const legacyZoneIds = legacyZones.map((zone) => zone.id)
  const referencedRate = await db
    .select({ id: shippingRates.id })
    .from(shippingRates)
    .where(inArray(shippingRates.zone_id, legacyZoneIds))
    .limit(1)
  if (referencedRate.length) {
    console.warn('Legacy B2C zones still have rate rows; leaving them in place')
    return
  }

  await db.delete(zones).where(inArray(zones.id, legacyZoneIds))
  console.log(`Removed ${legacyZones.length} legacy B2C zones`)
}

async function syncB2CZoneMappings() {
  const currentZones = await db
    .select({ id: zones.id, code: zones.code })
    .from(zones)
    .where(and(eq(zones.business_type, 'B2C'), inArray(zones.code, ['A', 'B', 'C', 'D', 'E', 'F'])))
  const zoneIdByCode = new Map(currentZones.map((zone) => [zone.code, zone.id]))
  for (const requiredCode of ['A', 'B', 'C', 'D', 'E', 'F']) {
    if (!zoneIdByCode.has(requiredCode)) throw new Error(`B2C zone ${requiredCode} is missing`)
  }

  const locationRows = await db
    .select({ id: locations.id, tags: locations.tags })
    .from(locations)
  const existingMappings = await db.select({ locationId: zoneMappings.location_id }).from(zoneMappings)
  const mappedLocationIds = new Set(existingMappings.map((mapping) => mapping.locationId))
  const rowsToInsert = locationRows.flatMap((location) => {
    if (mappedLocationIds.has(location.id)) return []
    const tags = Array.isArray(location.tags) ? location.tags.map((tag) => String(tag).toLowerCase()) : []
    const zoneCode = tags.includes('special_zone')
      ? 'E'
      : tags.includes('metros')
        ? 'B'
        : 'D'
    return [{ zone_id: zoneIdByCode.get(zoneCode)!, location_id: location.id }]
  })

  for (let index = 0; index < rowsToInsert.length; index += CHUNK_SIZE) {
    await db.insert(zoneMappings).values(rowsToInsert.slice(index, index + CHUNK_SIZE))
  }
  console.log(`B2C zone mapping sync finished. Inserted: ${rowsToInsert.length}`)
}

async function importXlsx(filename: string) {
  const fullPath = path.join(DATA_DIR, filename)
  if (!fs.existsSync(fullPath)) throw new Error(`File not found: ${fullPath}`)

  console.log(`Reading XLSX: ${fullPath}`)
  const workbookRows = await readXlsxRows(fullPath)
  const headerIndex = workbookRows.findIndex((row) =>
    row.some((value) => normalize(value).toLowerCase() === 'pincode'),
  )
  if (headerIndex < 0) throw new Error('Pincode header row not found in workbook')
  const jsonRows = xlsxRowsToRecords(workbookRows.slice(headerIndex))
  console.log(`Total rows parsed: ${jsonRows.length}`)

  const existingRows = await db.select({ pincode: locations.pincode }).from(locations)
  const existingPincodes = new Set(existingRows.map((row) => row.pincode))
  const inputPincodes = new Set<string>()
  let batch: Row[] = []
  let inserted = 0
  let skipped = 0

  for (const raw of jsonRows) {
    const mapped = mapRow(raw)
    if (!mapped) continue
    if (existingPincodes.has(mapped.pincode) || inputPincodes.has(mapped.pincode)) {
      skipped += 1
      continue
    }

    inputPincodes.add(mapped.pincode)
    batch.push(mapped)
    if (batch.length >= CHUNK_SIZE) {
      await insertBatch(batch)
      inserted += batch.length
      batch = []
      console.log(`Inserted ${inserted} locations...`)
    }
  }

  if (batch.length) {
    await insertBatch(batch)
    inserted += batch.length
  }

  console.log(`Location import finished. Inserted: ${inserted}; skipped: ${skipped}`)
  await removeLegacyB2CZones()
  await syncB2CZoneMappings()
  await syncB2BPincodes()
}

;(async () => {
  const filename = process.argv[2]
  if (!filename) throw new Error('Usage: npm run seed:locations -- <file.xlsx>')
  await importXlsx(filename)
})()
  .catch((error) => {
    console.error('Import failed:', error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })
