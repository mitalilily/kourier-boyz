export class CsvParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CsvParseError'
  }
}

/**
 * Parse RFC 4180-style CSV, including commas, quotes and line breaks in quoted
 * values. Keeping this dependency-free makes the product import usable in the
 * API process without a separate parser package.
 */
export const parseCsv = (content: string): string[][] => {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false

  const finishCell = () => {
    row.push(cell)
    cell = ''
  }
  const finishRow = () => {
    finishCell()
    if (row.some((value) => value.trim() !== '')) rows.push(row)
    row = []
  }

  // Excel commonly writes a UTF-8 BOM. Remove it before interpreting headers.
  const input = content.replace(/^\uFEFF/, '')
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index]

    if (character === '"') {
      if (inQuotes && input[index + 1] === '"') {
        cell += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (character === ',' && !inQuotes) {
      finishCell()
      continue
    }

    if ((character === '\n' || character === '\r') && !inQuotes) {
      if (character === '\r' && input[index + 1] === '\n') index += 1
      finishRow()
      continue
    }

    cell += character
  }

  if (inQuotes) throw new CsvParseError('CSV contains an unclosed quoted value')
  if (cell !== '' || row.length > 0) finishRow()

  return rows
}

export const normalizeCsvHeader = (header: string): string =>
  header.trim().replace(/^\uFEFF/, '').toLowerCase().replace(/[ _-]/g, '')

export const csvRowToRecord = (headers: string[], values: string[]): Record<string, string> => {
  return headers.reduce<Record<string, string>>((record, header, index) => {
    record[normalizeCsvHeader(header)] = (values[index] || '').trim()
    return record
  }, {})
}

export const csvList = (value: string | undefined): string[] =>
  (value || '')
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean)

export const csvBoolean = (value: string | undefined): boolean | undefined => {
  if (!value) return undefined
  const normalized = value.trim().toLowerCase()
  if (['true', '1', 'yes'].includes(normalized)) return true
  if (['false', '0', 'no'].includes(normalized)) return false
  return undefined
}
