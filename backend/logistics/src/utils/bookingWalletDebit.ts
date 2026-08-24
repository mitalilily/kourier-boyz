import { calculateGstBreakup, roundCurrency } from './gst'

const toAmount = (value: unknown) => {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

const isCodPayment = (paymentType: unknown) => String(paymentType || '').toLowerCase() === 'cod'

export const getBookingWalletDebitBaseAmount = ({
  paymentType,
  freightCharges = 0,
  otherCharges = 0,
  codCharges = 0,
}: {
  paymentType?: string | null
  freightCharges?: unknown
  otherCharges?: unknown
  codCharges?: unknown
}) => {
  const base =
    toAmount(freightCharges) +
    toAmount(otherCharges) +
    (isCodPayment(paymentType) ? toAmount(codCharges) : 0)

  return roundCurrency(base)
}

export const calculateBookingWalletDebit = ({
  paymentType,
  freightCharges = 0,
  otherCharges = 0,
  codCharges = 0,
  gstPercent = 0,
}: {
  paymentType?: string | null
  freightCharges?: unknown
  otherCharges?: unknown
  codCharges?: unknown
  gstPercent?: unknown
}) =>
  calculateGstBreakup(
    getBookingWalletDebitBaseAmount({
      paymentType,
      freightCharges,
      otherCharges,
      codCharges,
    }),
    gstPercent,
  )

export const resolveGstInclusiveWalletDebit = ({
  storedDebit,
  paymentType,
  freightCharges = 0,
  otherCharges = 0,
  codCharges = 0,
  gstPercent = 0,
  gstAmount = 0,
}: {
  storedDebit?: unknown
  paymentType?: string | null
  freightCharges?: unknown
  otherCharges?: unknown
  codCharges?: unknown
  gstPercent?: unknown
  gstAmount?: unknown
}) => {
  const stored = toAmount(storedDebit)
  const gst = toAmount(gstAmount)
  const percent = toAmount(gstPercent)
  const computed = calculateBookingWalletDebit({
    paymentType,
    freightCharges,
    otherCharges,
    codCharges,
    gstPercent: percent,
  })

  if (stored <= 0) return computed.totalAmount
  if (gst <= 0 || percent <= 0) return Math.max(stored, computed.totalAmount)

  const gstOnStoredDebit = roundCurrency((stored * percent) / 100)
  const storedLooksTaxableOnly = Math.abs(gstOnStoredDebit - gst) <= 0.02
  if (storedLooksTaxableOnly) {
    return roundCurrency(stored + gst)
  }

  return Math.max(stored, computed.totalAmount)
}
