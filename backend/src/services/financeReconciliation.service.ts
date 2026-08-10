import mongoose from 'mongoose'
import SellerLedgerEntry from '../models/SellerLedgerEntry'
import SellerSettlementBatch from '../models/SellerSettlementBatch'

export interface FinanceReconciliationResult {
  asOf: Date
  totalCredits: number
  totalDebits: number
  totalLedgerNet: number
  totalPayouts: number
  difference: number
}

const toNumber = (value: any, fallback = 0): number => {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

/**
 * Computes high-level reconciliation between:
 * - Net of all seller ledger entries (credits - debits)
 * - Sum of all PAID settlement batch payouts (totalNetPayout)
 *
 * This is intended to run as a daily job and to back the admin
 * "Finance → Reconciliation Report" screen.
 */
export const runFinanceReconciliation = async (): Promise<FinanceReconciliationResult> => {
  const asOf = new Date()

  const [ledgerAgg, paidBatches] = await Promise.all([
    SellerLedgerEntry.aggregate([
      {
        $group: {
          _id: '$entryType',
          total: { $sum: '$amount' },
        },
      },
    ]),
    SellerSettlementBatch.find({ status: 'PAID' })
      .select('totalNetPayout')
      .lean(),
  ])

  let totalCredits = 0
  let totalDebits = 0
  for (const row of ledgerAgg) {
    const amount = toNumber(row.total, 0)
    if (row._id === 'CREDIT') totalCredits += amount
    if (row._id === 'DEBIT') totalDebits += amount
  }

  const totalLedgerNet = totalCredits - totalDebits
  const totalPayouts = paidBatches.reduce(
    (sum, b) => sum + toNumber((b as any).totalNetPayout, 0),
    0,
  )
  const difference = totalLedgerNet - totalPayouts

  return {
    asOf,
    totalCredits,
    totalDebits,
    totalLedgerNet,
    totalPayouts,
    difference,
  }
}


