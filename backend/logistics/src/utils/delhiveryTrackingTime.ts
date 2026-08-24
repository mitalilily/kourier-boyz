const DELHIVERY_IST_OFFSET_MINUTES = 5 * 60 + 30

const sanitizeString = (value: unknown): string => {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

export const parseDelhiveryTrackingTimestamp = (value: unknown): Date | unknown => {
  const raw = sanitizeString(value)
  if (!raw) return value

  // Delhivery scan timestamps represent India local time in practice. Some API
  // responses still append "Z"/offset text, which makes browsers shift the
  // displayed time by +5:30 if treated as true UTC.
  const normalized = raw
    .replace('T', ' ')
    .replace(/\s*(?:z|[+-]\d{2}:?\d{2})$/i, '')
    .trim()
  const isoLike = normalized.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?)?$/,
  )
  const indiaLike = normalized.match(
    /^(\d{2})[-/](\d{2})[-/](\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?)?$/,
  )

  const match = isoLike || indiaLike
  if (!match) return value

  const [, first, second, third, hour = '00', minute = '00', secondPart = '00', ms = '0'] = match
  const year = isoLike ? Number(first) : Number(third)
  const month = Number(second)
  const day = isoLike ? Number(third) : Number(first)
  const millisecond = Number(ms.padEnd(3, '0').slice(0, 3))

  const utcMs =
    Date.UTC(
      year,
      month - 1,
      day,
      Number(hour),
      Number(minute),
      Number(secondPart),
      millisecond,
    ) -
    DELHIVERY_IST_OFFSET_MINUTES * 60 * 1000

  const date = new Date(utcMs)
  return Number.isNaN(date.getTime()) ? value : date
}
