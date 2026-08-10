import mongoose, { Document, Schema } from 'mongoose'

export type SettlementBatchStatus = 'PENDING' | 'PAID'

export interface ISellerSettlementBatch extends Document {
  seller: mongoose.Types.ObjectId
  fromDate: Date
  toDate: Date
  ordersCount: number
  // Aggregated commercial figures (all derived from ledger entries)
  totalSaleAmount: number
  totalCommissionAmount: number
  totalOtherCharges: number
  totalNetPayout: number
  // Detailed breakdown (optional, for reporting)
  totalItemEarnings?: number
  totalShippingEarned?: number
  totalCourierCostDeducted?: number // Forward courier charges
  totalReverseCourierCost?: number // Return courier charges (freight)
  totalCodFee?: number // COD fees (forward orders)
  totalReverseCodFee?: number // COD fees (return orders)
  totalPgFee?: number
  // Return / adjustment breakdown
  totalReturnItemReversal?: number
  totalReturnShippingReversal?: number
  totalCommissionReversal?: number
  totalManualAdjustments?: number
  totalManualAdjustmentsCredit?: number
  totalManualAdjustmentsDebit?: number
  // TDS (194O) fields
  totalTdsAmount?: number
  tdsRate?: number
  tdsBaseAmount?: number // Gross sales including GST
  tdsExempted?: boolean
  tdsExemptionReason?: string
  // TCS (GST) fields
  totalTcsAmount?: number
  tcsIgstAmount?: number
  tcsCgstAmount?: number
  tcsSgstAmount?: number
  tcsBaseAmount?: number // Taxable value excluding GST
  tcsBreakdown?: {
    interState: {
      salesAmount: number
      tcsAmount: number
    }
    intraState: {
      salesAmount: number
      tcsCgstAmount: number
      tcsSgstAmount: number
      tcsAmount: number
    }
    registeredCustomers: {
      salesAmount: number
      tcsAmount: number
    }
    unregisteredCustomers: {
      salesAmount: number
      tcsAmount: number
    }
  }
  // Settlement invoice metadata
  invoiceUrl?: string | null
  invoiceNumber?: string | null
  status: SettlementBatchStatus
  payoutDate?: Date | null
  payoutReference?: string | null
  payoutNotes?: string | null
  // Payment fields (ledger-based payment tracking)
  paidAmount?: number // Total amount paid to seller (default: 0)
  paidAt?: Date | null // Timestamp of last payment
  paymentReference?: string | null // Payment reference (transaction ID, UPI reference, etc.)
  paymentMethod?: string | null // Payment method (bank_transfer, upi, neft, etc.)
  createdAt: Date
  updatedAt: Date
}

const SellerSettlementBatchSchema = new Schema<ISellerSettlementBatch>(
  {
    seller: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    fromDate: {
      type: Date,
      required: true,
    },
    toDate: {
      type: Date,
      required: true,
    },
    ordersCount: {
      type: Number,
      required: true,
      min: 0,
    },
    totalSaleAmount: {
      type: Number,
      required: true,
    },
    totalCommissionAmount: {
      type: Number,
      required: true,
    },
    totalOtherCharges: {
      type: Number,
      default: 0,
    },
    totalNetPayout: {
      type: Number,
      required: true,
    },
    totalItemEarnings: {
      type: Number,
    },
    totalShippingEarned: {
      type: Number,
    },
    totalCourierCostDeducted: {
      type: Number,
    },
    totalReverseCourierCost: {
      type: Number,
    },
    totalCodFee: {
      type: Number,
    },
    totalReverseCodFee: {
      type: Number,
    },
    totalPgFee: {
      type: Number,
    },
    totalReturnItemReversal: {
      type: Number,
    },
    totalReturnShippingReversal: {
      type: Number,
    },
    totalCommissionReversal: {
      type: Number,
    },
    totalManualAdjustments: {
      type: Number,
    },
    totalManualAdjustmentsCredit: {
      type: Number,
    },
    totalManualAdjustmentsDebit: {
      type: Number,
    },
    // TDS (194O) fields
    totalTdsAmount: {
      type: Number,
      min: 0,
    },
    tdsRate: {
      type: Number,
      min: 0,
      max: 100,
    },
    tdsBaseAmount: {
      type: Number,
      min: 0,
    },
    tdsExempted: {
      type: Boolean,
      default: false,
    },
    tdsExemptionReason: {
      type: String,
      trim: true,
    },
    // TCS (GST) fields
    totalTcsAmount: {
      type: Number,
      min: 0,
    },
    tcsIgstAmount: {
      type: Number,
      min: 0,
    },
    tcsCgstAmount: {
      type: Number,
      min: 0,
    },
    tcsSgstAmount: {
      type: Number,
      min: 0,
    },
    tcsBaseAmount: {
      type: Number,
      min: 0,
    },
    tcsBreakdown: {
      interState: {
        salesAmount: { type: Number, default: 0 },
        tcsAmount: { type: Number, default: 0 },
      },
      intraState: {
        salesAmount: { type: Number, default: 0 },
        tcsCgstAmount: { type: Number, default: 0 },
        tcsSgstAmount: { type: Number, default: 0 },
        tcsAmount: { type: Number, default: 0 },
      },
      registeredCustomers: {
        salesAmount: { type: Number, default: 0 },
        tcsAmount: { type: Number, default: 0 },
      },
      unregisteredCustomers: {
        salesAmount: { type: Number, default: 0 },
        tcsAmount: { type: Number, default: 0 },
      },
    },
    invoiceUrl: {
      type: String,
      trim: true,
    },
    invoiceNumber: {
      type: String,
      trim: true,
      unique: false,
    },
    status: {
      type: String,
      enum: ['PENDING', 'PAID'],
      default: 'PENDING',
      index: true,
    },
    payoutDate: {
      type: Date,
    },
    payoutReference: {
      type: String,
      trim: true,
    },
    payoutNotes: {
      type: String,
      trim: true,
    },
    // Payment fields (ledger-based payment tracking)
    paidAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    paidAt: {
      type: Date,
    },
    paymentReference: {
      type: String,
      trim: true,
    },
    paymentMethod: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true },
)

SellerSettlementBatchSchema.index({ seller: 1, createdAt: -1 })
SellerSettlementBatchSchema.index({ invoiceNumber: 1 }, { unique: true, sparse: true })

export default mongoose.model<ISellerSettlementBatch>(
  'SellerSettlementBatch',
  SellerSettlementBatchSchema,
)
