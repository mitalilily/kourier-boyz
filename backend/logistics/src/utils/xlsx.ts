import { readSheet, type Row } from 'read-excel-file/node'

export const readXlsxRows = (input: Buffer | string, sheet?: number | string) =>
  sheet === undefined ? readSheet(input) : readSheet(input, sheet)

export const xlsxRowsToRecords = (rows: Row[]): Record<string, unknown>[] => {
  if (!rows.length) return []

  const headers = rows[0].map((value) => String(value ?? '').trim())
  return rows.slice(1).flatMap((row) => {
    if (!row.some((value) => value !== null && String(value).trim() !== '')) return []

    const record: Record<string, unknown> = {}
    headers.forEach((header, index) => {
      if (header) record[header] = row[index] ?? ''
    })
    return [record]
  })
}
