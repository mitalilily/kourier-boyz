import * as dotenv from 'dotenv'
import * as fs from 'fs'
import Papa from 'papaparse'
import * as path from 'path'

type CsvRow = Record<string, string>

type ParsedArgs = {
  csvPath: string
  dryRun: boolean
}

type ParseSummary = {
  totalRows: number
  trueRows: number
  falseRows: number
  ignoredRows: number
  invalidPincodes: string[]
  duplicateTrueRows: number
  truePincodes: string[]
}

const TRUTHY_VALUES = new Set(['1', 'true', 'yes', 'y'])
const FALSEY_VALUES = new Set(['0', 'false', 'no', 'n'])

const normalizeBoolean = (value: string | undefined): boolean | undefined => {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()

  if (!normalized) return undefined
  if (TRUTHY_VALUES.has(normalized)) return true
  if (FALSEY_VALUES.has(normalized)) return false
  return undefined
}

const normalizePincode = (value: string | undefined) =>
  String(value ?? '')
    .replace(/\D/g, '')
    .slice(0, 6)

const resolveCsvValue = (row: CsvRow, keys: string[]) => {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }

  return ''
}

const parseArgs = (args: string[]): ParsedArgs => {
  const dryRun = args.includes('--dry-run')
  const csvPathArg = args.find((value) => !value.startsWith('--'))

  if (!csvPathArg) {
    throw new Error(
      'CSV path is required. Usage: npm run import:b2b-oda -- "<path-to-csv>" [--dry-run]',
    )
  }

  return {
    csvPath: path.resolve(process.cwd(), csvPathArg),
    dryRun,
  }
}

const parseCsv = (csvPath: string): ParseSummary => {
  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV file not found: ${csvPath}`)
  }

  const csv = fs.readFileSync(csvPath, 'utf8')
  const parsed = Papa.parse<CsvRow>(csv, {
    header: true,
    skipEmptyLines: true,
  })

  if (parsed.errors?.length) {
    throw new Error(`CSV parse error: ${parsed.errors[0].message}`)
  }

  const truePincodeSet = new Set<string>()
  const invalidPincodes: string[] = []

  let trueRows = 0
  let falseRows = 0
  let ignoredRows = 0
  let duplicateTrueRows = 0

  for (const row of parsed.data) {
    const pincode = normalizePincode(resolveCsvValue(row, ['Pin', 'PIN', 'Pincode', 'pincode']))
    const odaValue = normalizeBoolean(resolveCsvValue(row, ['ODA', 'oda', 'is_oda', 'isOda']))

    if (!/^\d{6}$/.test(pincode)) {
      invalidPincodes.push(resolveCsvValue(row, ['Pin', 'PIN', 'Pincode', 'pincode']) || '<blank>')
      continue
    }

    if (odaValue === true) {
      trueRows += 1
      if (truePincodeSet.has(pincode)) {
        duplicateTrueRows += 1
      }
      truePincodeSet.add(pincode)
      continue
    }

    if (odaValue === false) {
      falseRows += 1
      continue
    }

    ignoredRows += 1
  }

  return {
    totalRows: parsed.data.length,
    trueRows,
    falseRows,
    ignoredRows,
    invalidPincodes,
    duplicateTrueRows,
    truePincodes: Array.from(truePincodeSet).sort(),
  }
}

const loadBackendEnv = () => {
  const env = process.env.NODE_ENV || 'development'
  const envFilePath = path.resolve(__dirname, `../../.env.${env}`)
  dotenv.config({ path: envFilePath })

  if (!process.env.DATABASE_URL) {
    throw new Error(`DATABASE_URL is missing. Expected it in ${envFilePath}`)
  }

  return { env, envFilePath }
}

const applyUpdates = async (truePincodes: string[]) => {
  const { envFilePath } = loadBackendEnv()
  console.log(`Using backend env: ${envFilePath}`)

  const [{ markExistingB2BPincodesAsOda }, { pool }] = await Promise.all([
    import('../models/services/b2bAdmin.service'),
    import('../models/client'),
  ])

  try {
    return await markExistingB2BPincodesAsOda(truePincodes)
  } finally {
    await pool.end()
  }
}

async function main() {
  const { csvPath, dryRun } = parseArgs(process.argv.slice(2))
  const summary = parseCsv(csvPath)

  console.log(`CSV: ${csvPath}`)
  console.log(`Total rows read: ${summary.totalRows}`)
  console.log(`TRUE ODA rows to apply: ${summary.trueRows}`)
  console.log(`Unique TRUE pincodes: ${summary.truePincodes.length}`)
  console.log(`FALSE rows ignored: ${summary.falseRows}`)
  console.log(`Blank/unknown ODA rows ignored: ${summary.ignoredRows}`)
  console.log(`Duplicate TRUE rows collapsed: ${summary.duplicateTrueRows}`)
  console.log(`Invalid pincodes skipped: ${summary.invalidPincodes.length}`)

  if (summary.invalidPincodes.length) {
    console.log(`Invalid pincode sample: ${summary.invalidPincodes.slice(0, 10).join(', ')}`)
  }

  if (!summary.truePincodes.length) {
    console.log('No TRUE ODA pincodes found, so nothing will be updated.')
    return
  }

  console.log(`TRUE pincode sample: ${summary.truePincodes.slice(0, 10).join(', ')}`)

  if (dryRun) {
    console.log('Dry run only. Database was not touched.')
    return
  }

  const result = await applyUpdates(summary.truePincodes)

  console.log(`Requested unique pincodes: ${result.requestedPincodes}`)
  console.log(`Matched pincodes in DB: ${result.matchedPincodes}`)
  console.log(`Rows updated to ODA: ${result.updatedRows}`)
  console.log(`Missing pincodes in DB: ${result.missingPincodes.length}`)

  if (result.missingPincodes.length) {
    console.log(`Missing pincode sample: ${result.missingPincodes.slice(0, 20).join(', ')}`)
  }
}

main().catch((error: Error) => {
  console.error(error.message)
  process.exitCode = 1
})
