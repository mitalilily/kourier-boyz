export type GstBreakup = {
  baseAmount: number
  gstPercent: number
  gstAmount: number
  totalAmount: number
}

export const roundCurrency = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100

export const normalizeGstPercent = (value: unknown) => {
  const percent = Number(value ?? 0)
  if (!Number.isFinite(percent) || percent < 0) return 0
  return roundCurrency(percent)
}

export const calculateGstBreakup = (baseAmount: unknown, gstPercent: unknown): GstBreakup => {
  const normalizedBase = Number(baseAmount ?? 0)
  const safeBaseAmount = Number.isFinite(normalizedBase) && normalizedBase > 0 ? normalizedBase : 0
  const safeGstPercent = normalizeGstPercent(gstPercent)
  const gstAmount = roundCurrency((safeBaseAmount * safeGstPercent) / 100)

  return {
    baseAmount: roundCurrency(safeBaseAmount),
    gstPercent: safeGstPercent,
    gstAmount,
    totalAmount: roundCurrency(safeBaseAmount + gstAmount),
  }
}
