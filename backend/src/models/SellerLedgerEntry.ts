import mongoose, { Document, Schema } from 'mongoose'

export type SellerLedgerEntryType = 'CREDIT' | 'DEBIT'

// Canonical reasons (new vocabulary)
export const CANONICAL_LEDGER_REASONS = [
  // ORDER
  'ORDER_ITEM_CREDIT',
  'SHIPPING_CREDIT',
  'COD_FEE_CREDIT',
  // FEES
  'COMMISSION_DEBIT',
  'PAYMENT_GATEWAY_FEE',
  'SHIPPING_COST_DEBIT',
  'COD_FEE_DEBIT',
  'COD_FEE_REVERSAL',
  // REFUNDS
  'REFUND_ITEM',
  'REFUND_SHIPPING',
  'REFUND_COD',
  'REFUND_GST',
  // RETURNS
  'RETURN_ITEM_REVERSAL',
  'RETURN_SHIPPING_REVERSAL',
  'COMMISSION_REVERSAL',
  'RETURN_REVERSE_COURIER_COST',
  // ADJUSTMENTS
  'MANUAL_ADJUSTMENT',
  'SETTLEMENT_CARRY_FORWARD', // Negative balance from previous settlement batch
  'SETTLEMENT_PAYMENT', // Payment received from seller for negative balance (credit)
  'SETTLEMENT_PAYOUT', // Payout made to seller for positive settlement (debit)
  // TDS (194O)
  'TDS_DEBIT',
  'TDS_REVERSAL',
  // TCS (GST)
  'TCS_DEBIT',
  'TCS_REVERSAL',
  // PLATFORM ONLY
  'PLATFORM_REFUND_EXPENSE',
  'PLATFORM_ADJUSTMENT',
] as const

export type CanonicalLedgerReason = (typeof CANONICAL_LEDGER_REASONS)[number]

// Legacy reasons kept only for backward compatibility with existing data
export type LegacyLedgerReason =
  | 'ORDER_EARNING'
  | 'SHIPPING_EARNING'
  | 'COMMISSION'
  | 'SHIPPING_COURIER_COST'
  | 'PG_FEE'
  | 'RETURN_ITEM_EARNING_REVERSAL'
  | 'RETURN_SHIPPING_EARNING_REVERSAL'
  | 'RETURN_COURIER_COST'
  | 'RETURN_REFUND'
  | 'REPLACEMENT_PRICE_DIFFERENCE_REFUND'

export type SellerLedgerReason = CanonicalLedgerReason | LegacyLedgerReason

export interface ISellerLedgerEntry extends Document {
  seller: mongoose.Types.ObjectId
  order?: mongoose.Types.ObjectId | null
  settlementBatch?: mongoose.Types.ObjectId | null
  entryType: SellerLedgerEntryType
  reason: SellerLedgerReason
  amount: number
  description?: string
  referenceId?: mongoose.Types.ObjectId | null
  debitNote?: {
    debit_note_id?: string
    debit_note_url?: string
    debit_note_number?: string
    generated_at?: Date
    hsnSummary?: Array<{
      hsnSacCode: string
      gstRatePercent: number
      taxableValueTotal: number
      igstAmountTotal: number
      cgstAmountTotal: number
      sgstAmountTotal: number
    }>
  }
  creditNote?: {
    credit_note_id?: string
    credit_note_url?: string
    credit_note_number?: string
    generated_at?: Date
    hsnSummary?: Array<{
      hsnSacCode: string
      gstRatePercent: number
      taxableValueTotal: number
      igstAmountTotal: number
      cgstAmountTotal: number
      sgstAmountTotal: number
    }>
  }
  createdAt: Date
  updatedAt: Date
}

const SellerLedgerEntrySchema = new Schema<ISellerLedgerEntry>(
  {
    seller: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    order: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      index: true,
    },
    settlementBatch: {
      type: Schema.Types.ObjectId,
      ref: 'SellerSettlementBatch',
      index: true,
    },
    entryType: {
      type: String,
      enum: ['CREDIT', 'DEBIT'],
      required: true,
    },
    reason: {
      type: String,
      enum: [
        // Canonical
        ...CANONICAL_LEDGER_REASONS,
        // Legacy reasons (load-only)
        'ORDER_EARNING',
        'SHIPPING_EARNING',
        'COMMISSION',
        'SHIPPING_COURIER_COST',
        'PG_FEE',
        'RETURN_ITEM_EARNING_REVERSAL',
        'RETURN_SHIPPING_EARNING_REVERSAL',
        'RETURN_COURIER_COST',
        'MANUAL_ADJUSTMENT',
        'SETTLEMENT_CARRY_FORWARD',
        'SETTLEMENT_PAYMENT',
        'SETTLEMENT_PAYOUT',
        'RETURN_REFUND',
        'REPLACEMENT_PRICE_DIFFERENCE_REFUND',
        'TDS_DEBIT',
        'TDS_REVERSAL',
        'TCS_DEBIT',
        'TCS_REVERSAL',
      ],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    description: {
      type: String,
      trim: true,
    },
    referenceId: {
      type: Schema.Types.ObjectId,
      index: true,
    },
    debitNote: {
      debit_note_id: String,
      debit_note_url: String,
      debit_note_number: String,
      generated_at: Date,
      hsnSummary: [
        {
          hsnSacCode: String,
          gstRatePercent: Number,
          taxableValueTotal: Number,
          igstAmountTotal: Number,
          cgstAmountTotal: Number,
          sgstAmountTotal: Number,
        },
      ],
    },
    creditNote: {
      credit_note_id: String,
      credit_note_url: String,
      credit_note_number: String,
      generated_at: Date,
      hsnSummary: [
        {
          hsnSacCode: String,
          gstRatePercent: Number,
          taxableValueTotal: Number,
          igstAmountTotal: Number,
          cgstAmountTotal: Number,
          sgstAmountTotal: Number,
        },
      ],
    },
  },
  { timestamps: true },
)

SellerLedgerEntrySchema.index({ seller: 1, order: 1 })

// Guardrail: disallow creation of new ledger entries with non-canonical reasons
SellerLedgerEntrySchema.pre('validate', function (next) {
  const doc = this as any
  // Allow existing legacy rows to load/update, but new inserts must use canonical reasons only
  if (doc.isNew && !CANONICAL_LEDGER_REASONS.includes(doc.reason)) {
    return next(
      new Error(
        `Invalid ledger reason "${doc.reason}". New entries must use canonical reasons only.`,
      ),
    )
  }
  return next()
})

export default mongoose.model<ISellerLedgerEntry>('SellerLedgerEntry', SellerLedgerEntrySchema)
