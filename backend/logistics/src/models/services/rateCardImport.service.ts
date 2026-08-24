import Papa from 'papaparse'
import { upsertShippingRate } from './courierIntegration.service'
import { normalizeB2CServiceProvider } from './b2cRateCard.service'
import {
  getCanonicalDelhiveryCourierIdByMode,
  getDelhiveryCourierDisplayName,
  resolveDelhiveryRateCardShippingMode,
} from '../../utils/delhiveryCourier'

export type RateCardCell = string | number | null | undefined
export type CSVRow = Record<string, RateCardCell>

export type RateCardZone = {
  id: string
  name: string
  code: string
  region?: string | null
}

type SlabRow = CSVRow & { readonly _weight: number; readonly _type: 'first' | 'additional' }
type ZoneHeaderMap = Record<string, string | undefined>
type PreparedSlabRow = {
  readonly firstRow: SlabRow
  readonly additionalRow?: SlabRow
  readonly weight_from: number
  readonly weight_to: number
}

export const isSlabValidationError = (err: unknown) =>
  /slab|overlap|extra_rate|extra_weight_unit|zone|header|column/i.test(
    String((err as any)?.message || err || ''),
  )

export const cellToString = (value: RateCardCell) =>
  value === null || value === undefined ? '' : String(value).trim()

export const cell = (row: CSVRow, key: string) => cellToString(row[key])

export const normalizeRateCardRow = (row: Record<string, unknown>): CSVRow => {
  const normalized: CSVRow = {}
  for (const [key, value] of Object.entries(row)) {
    normalized[String(key).trim()] = cellToString(value as RateCardCell)
  }
  return normalized
}

export const parseRateCardCsvText = (csvText: string) => {
  const parsed = Papa.parse<CSVRow>(csvText.replace(/^\uFEFF/, ''), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  })

  return {
    data: parsed.data.map((row) => normalizeRateCardRow(row as Record<string, unknown>)),
    errors: parsed.errors,
  }
}

export const toRateCardNumber = (v: RateCardCell, fallback = 0) => {
  const n = Number(String(v ?? '').replace(/[^\d.-]/g, ''))
  return Number.isFinite(n) ? n : fallback
}

const normalizeHeaderKey = (value: unknown) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/_+/g, ' ')
    .replace(/\s*\(b2c\)\s*$/i, '')
    .replace(/[^a-z0-9]+/g, '')

const zoneHeaderAliases: Record<string, string[]> = {
  METRO_TO_METRO: ['METRO TO METRO', 'Metro to Metro'],
  ROI: ['ROI', 'Rest of India'],
  SPECIAL_ZONE: ['SPECIAL ZONE', 'Special Zone'],
  WITHIN_CITY: ['WITHIN CITY', 'Within City'],
  WITHIN_REGION: ['WITHIN REGION', 'Within Region'],
  WITHIN_STATE: ['WITHIN STATE', 'Within State'],
}

const canonicalZoneCode = (code: unknown) =>
  String(code ?? '')
    .trim()
    .toUpperCase()
    .replace(/_B2C$/, '')

const getZoneAliases = (zone: RateCardZone) => {
  const code = canonicalZoneCode(zone.code)
  const codeAsWords = code.replace(/_/g, ' ')
  const aliases = zoneHeaderAliases[code]
    ? [zone.code, zone.region, code, codeAsWords, ...zoneHeaderAliases[code]]
    : [zone.name, zone.code, zone.region, code, codeAsWords]

  return aliases
    .filter(Boolean)
    .map(normalizeHeaderKey)
}

const buildHeaderLookup = (row: CSVRow) => {
  const lookup = new Map<string, string[]>()
  for (const header of Object.keys(row)) {
    const normalized = normalizeHeaderKey(header)
    if (!normalized) continue
    const headers = lookup.get(normalized) || []
    if (!headers.includes(header)) headers.push(header)
    lookup.set(normalized, headers)
  }
  return lookup
}

const resolveZoneHeaders = (row: CSVRow, zonesList: RateCardZone[]): ZoneHeaderMap => {
  const headerLookup = buildHeaderLookup(row)
  const resolved: ZoneHeaderMap = {}
  const usedHeaders = new Map<string, string>()

  for (const zone of zonesList) {
    const aliases = Array.from(new Set(getZoneAliases(zone)))
    const matchedHeaders: string[] = []

    for (const alias of aliases) {
      const headers = headerLookup.get(alias) || []
      if (headers.length > 1) {
        throw new Error(
          `Ambiguous rate card column "${headers.join(', ')}" for zone ${zone.name}`,
        )
      }
      const header = headers[0]
      if (header && !matchedHeaders.includes(header)) matchedHeaders.push(header)
    }

    if (matchedHeaders.length > 1) {
      throw new Error(
        `Ambiguous zone columns for ${zone.name}: ${matchedHeaders.join(', ')}`,
      )
    }

    const matchedHeader = matchedHeaders[0]
    if (!matchedHeader) continue

    const previousZone = usedHeaders.get(matchedHeader)
    if (previousZone && previousZone !== zone.id) {
      throw new Error(
        `Rate card column "${matchedHeader}" matched multiple zones. Check B2C zone headers.`,
      )
    }

    usedHeaders.set(matchedHeader, zone.id)
    resolved[zone.id] = matchedHeader
  }

  return resolved
}

const getZoneCell = (row: CSVRow, zone: RateCardZone, zoneHeaders: ZoneHeaderMap): RateCardCell => {
  const key = zoneHeaders[zone.id]
  return key ? row[key] : undefined
}

const inferServiceProvider = (value: unknown, courierName?: unknown) => {
  const normalized = normalizeB2CServiceProvider(value)
  if (normalized) return normalized

  const lowerName = String(courierName ?? '').toLowerCase()
  if (lowerName.includes('delhivery')) return 'delhivery'
  if (lowerName.includes('amazon')) return 'amazon'
  if (lowerName.includes('ekart')) return 'ekart'
  if (lowerName.includes('shadowfax')) return 'shadowfax'
  if (lowerName.includes('xpress')) return 'xpressbees'
  return ''
}

const canonicalizeImportedCourier = (input: {
  courierId: string
  courierName: string
  serviceProvider: string
  mode: string
}) => {
  if (input.serviceProvider !== 'delhivery') return input

  const shippingMode = resolveDelhiveryRateCardShippingMode({
    courierId: input.courierId,
    mode: input.mode,
    courierName: input.courierName,
  })
  const canonicalCourierId = getCanonicalDelhiveryCourierIdByMode(shippingMode)

  if (!shippingMode || !canonicalCourierId) return input

  return {
    ...input,
    courierId: String(canonicalCourierId),
    courierName: getDelhiveryCourierDisplayName(shippingMode),
    mode: shippingMode === 'Express' ? 'air' : 'surface',
  }
}

const rtoMultiplierFromCell = (value: RateCardCell) => {
  const raw = toRateCardNumber(value, 0)
  if (!raw) return 0
  return raw <= 1 ? raw : raw / 100
}

const roundMoney = (value: number) => Math.round(value * 100) / 100

const weightsMatch = (left: number, right: number) => Math.abs(left - right) < 0.001

const normalizeSlabLabel = (value: RateCardCell) => {
  const raw = cellToString(value)
  if (!raw) return ''

  if (/^-?\d+(\.\d+)?$/.test(raw)) {
    return String(Number(raw))
  }

  return raw
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

const findAdditionalRowForSlab = (rows: SlabRow[], firstRow: SlabRow) => {
  const additionalRows = rows.filter((row) => row._type === 'additional')
  const slabLabel = normalizeSlabLabel(firstRow['Slab'])
  if (slabLabel) {
    const labelMatches = additionalRows.filter(
      (row) => normalizeSlabLabel(row['Slab']) === slabLabel,
    )
    if (labelMatches.length === 1) return labelMatches[0]

    const labelAndWeightMatches = labelMatches.filter((row) =>
      weightsMatch(row._weight, firstRow._weight),
    )
    if (labelAndWeightMatches.length === 1) return labelAndWeightMatches[0]
  }

  const matchingWeightRows = additionalRows.filter((row) =>
    weightsMatch(row._weight, firstRow._weight),
  )
  return matchingWeightRows.length === 1 ? matchingWeightRows[0] : undefined
}

const prepareFirstSlabRows = (rows: SlabRow[]): PreparedSlabRow[] => {
  const firstRows = rows
    .filter((r) => r._type === 'first')
    .sort((a, b) => a._weight - b._weight)

  let previousWeightTo = 0
  let previousAdditionalRow: SlabRow | undefined

  return firstRows.map((firstRow, index) => {
    const additionalRow = findAdditionalRowForSlab(rows, firstRow)
    const startsIndependentSlab = index === 0 || Boolean(previousAdditionalRow)
    const prepared: PreparedSlabRow = {
      firstRow,
      additionalRow,
      weight_from: startsIndependentSlab ? 0 : previousWeightTo,
      weight_to: firstRow._weight,
    }

    previousWeightTo = firstRow._weight
    previousAdditionalRow = additionalRow
    return prepared
  })
}

export const importB2CSlabFormat = async (
  data: CSVRow[],
  plan_id: string,
  zonesList: RateCardZone[],
) => {
  type GroupKey = string

  const groups = new Map<GroupKey, SlabRow[]>()
  let savedRows = 0

  for (const row of data) {
    const courierId = cell(row, 'Courier ID')
    const courierName = cell(row, 'Courier') || cell(row, 'Courier Name')
    const serviceProvider = inferServiceProvider(cell(row, 'Service Provider'), courierName)
    const mode = cell(row, 'Mode')
    const slabType = cell(row, 'Slab Type').toLowerCase()
    if (!courierId || !mode) continue
    if (slabType !== 'first' && slabType !== 'additional') continue
    const weight = toRateCardNumber(row['Weight (KG)'])
    if (!weight) continue

    const canonicalCourier = canonicalizeImportedCourier({
      courierId,
      courierName,
      serviceProvider,
      mode,
    })

    const key: GroupKey = `${canonicalCourier.courierId}|${canonicalCourier.serviceProvider}|${canonicalCourier.mode.toLowerCase()}`
    if (!groups.has(key)) groups.set(key, [])
    groups
      .get(key)!
      .push(
        Object.assign({}, row, {
          'Courier ID': canonicalCourier.courierId,
          Courier: canonicalCourier.courierName,
          'Courier Name': canonicalCourier.courierName,
          'Service Provider': canonicalCourier.serviceProvider,
          Mode: canonicalCourier.mode,
          _weight: weight,
          _type: slabType as 'first' | 'additional',
        }) as SlabRow,
      )
  }

  for (const rows of groups.values()) {
    const first = rows.find((r) => r._type === 'first')
    if (!first) continue

    const courierId = cell(first, 'Courier ID')
    const courierName = cell(first, 'Courier') || cell(first, 'Courier Name')
    const serviceProvider = inferServiceProvider(cell(first, 'Service Provider'), courierName)
    const mode = cell(first, 'Mode')
    const codCharges = toRateCardNumber(first['COD Rs'] ?? first['COD Charges'], 0) || null
    const codPercent = toRateCardNumber(first['COD %'] ?? first['COD Percent'], 0) || null
    const rtoMultiplier = rtoMultiplierFromCell(first['RTO %'])

    const preparedFirstRows = prepareFirstSlabRows(rows)
    const zoneHeaders = resolveZoneHeaders(first, zonesList)

    const zoneForwardSlabs: Record<string, any[]> = {}
    const zoneRtoSlabs: Record<string, any[]> = {}

    for (const zone of zonesList) {
      const fwdSlabs: any[] = []
      const rtoSlabs: any[] = []

      for (const preparedSlab of preparedFirstRows) {
        const {
          firstRow: fr,
          additionalRow: addRow,
          weight_from: weightFrom,
          weight_to: weightTo,
        } = preparedSlab
        const fwdRate = toRateCardNumber(getZoneCell(fr, zone, zoneHeaders))
        if (!fwdRate) {
          continue
        }

        const extraRate = addRow
          ? toRateCardNumber(getZoneCell(addRow, zone, zoneHeaders)) || null
          : null
        const extraWeightUnit = addRow && extraRate ? addRow._weight || null : null

        fwdSlabs.push({
          weight_from: weightFrom,
          weight_to: weightTo,
          rate: fwdRate,
          extra_rate: extraRate,
          extra_weight_unit: extraWeightUnit,
        })

        if (rtoMultiplier > 0) {
          rtoSlabs.push({
            weight_from: weightFrom,
            weight_to: weightTo,
            rate: roundMoney(fwdRate * rtoMultiplier),
            extra_rate: extraRate ? roundMoney(extraRate * rtoMultiplier) : null,
            extra_weight_unit: extraWeightUnit,
          })
        }
      }

      if (fwdSlabs.length) {
        zoneForwardSlabs[zone.id] = fwdSlabs
        if (rtoSlabs.length) zoneRtoSlabs[zone.id] = rtoSlabs
      }
    }

    for (const zone of zonesList) {
      const fwdSlabs = zoneForwardSlabs[zone.id]
      if (!fwdSlabs?.length) continue

      savedRows += await upsertShippingRate({
        courier_id: courierId,
        courier_name: courierName,
        service_provider: serviceProvider,
        plan_id,
        mode,
        business_type: 'b2c',
        cod_charges: codCharges,
        cod_percent: codPercent,
        other_charges: null,
        rates: [{ zone_id: zone.id, type: 'forward', rate: fwdSlabs[0]?.rate ?? 0 }],
        zone_slabs: { [zone.id]: { forward: fwdSlabs } },
      })

      const rtoSlabs = zoneRtoSlabs[zone.id]
      if (rtoSlabs?.length) {
        savedRows += await upsertShippingRate({
          courier_id: courierId,
          courier_name: courierName,
          service_provider: serviceProvider,
          plan_id,
          mode,
          business_type: 'b2c',
          cod_charges: null,
          cod_percent: null,
          other_charges: null,
          rates: [{ zone_id: zone.id, type: 'rto', rate: rtoSlabs[0]?.rate ?? 0 }],
          zone_slabs: { [zone.id]: { rto: rtoSlabs } },
        })
      }
    }
  }

  return savedRows
}

export const importFlatFormat = async (
  data: CSVRow[],
  plan_id: string,
  business_type: string,
  zonesList: RateCardZone[],
) => {
  let savedRows = 0

  for (const row of data) {
    const courierId = cell(row, 'Courier ID')
    const courierName = cell(row, 'Courier Name') || cell(row, 'Courier')
    const serviceProvider = inferServiceProvider(cell(row, 'Service Provider'), courierName)
    const minWeight = cell(row, 'Min Weight')
    const mode = cell(row, 'Mode')
    if (!courierId || !courierName) continue
    const canonicalCourier = canonicalizeImportedCourier({
      courierId,
      courierName,
      serviceProvider,
      mode,
    })

    type RateItem = { zone_id: string; type: 'forward' | 'rto'; rate: number }
    const rates: RateItem[] = Object.entries(row)
      .filter(([key]) =>
        business_type === 'b2b'
          ? key.toLowerCase().includes('forward') || key.toLowerCase().includes('rto')
          : key.includes('(Forward)') || key.includes('(RTO)'),
      )
      .flatMap(([zoneKey, value]): RateItem[] => {
        if (!value) return []
        const zone = zonesList.find((z) => normalizeHeaderKey(zoneKey).includes(normalizeHeaderKey(z.name)))
        if (!zone) return []
        const rate = toRateCardNumber(value)
        if (!rate) return []
        if (zoneKey.toLowerCase().includes('forward')) return [{ zone_id: zone.id, type: 'forward', rate }]
        if (zoneKey.toLowerCase().includes('rto')) return [{ zone_id: zone.id, type: 'rto', rate }]
        return []
      })

    const codCharges = cell(row, 'COD Charges') ? toRateCardNumber(row['COD Charges']) : null
    const codPercent = cell(row, 'COD Percent') ? toRateCardNumber(row['COD Percent']) : null
    const otherCharges = cell(row, 'Other Charges') ? toRateCardNumber(row['Other Charges']) : null
    const hasData = mode || codCharges !== null || codPercent !== null || otherCharges !== null || rates.length > 0
    if (!hasData) continue

    savedRows += await upsertShippingRate({
      courier_id: canonicalCourier.courierId,
      courier_name: canonicalCourier.courierName,
      service_provider: canonicalCourier.serviceProvider,
      plan_id,
      min_weight: minWeight,
      business_type: business_type as 'b2b' | 'b2c',
      mode: canonicalCourier.mode,
      cod_charges: codCharges,
      cod_percent: codPercent,
      other_charges: otherCharges,
      rates,
    })
  }

  return savedRows
}
