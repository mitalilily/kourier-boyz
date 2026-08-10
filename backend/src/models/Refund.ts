import mongoose, { Document, Schema } from 'mongoose'

export type RefundSource = 'PLATFORM' | 'SELLER'
export type RefundMethod = 'MANUAL_UPI' | 'MANUAL_BANK'

export interface IRefund extends Document {
  order: mongoose.Types.ObjectId
  refundAmount: number
  refundReason: string
  refundSource: RefundSource
  refundMethod: RefundMethod
  referenceNumber: string
  refundDate: Date
  initiatedByAdmin: mongoose.Types.ObjectId
  adminNote?: string | null
  status: 'COMPLETED'
  adminIp?: string | null
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

const RefundSchema = new Schema<IRefund>(
  {
    order: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true,
    },
    refundAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    refundReason: {
      type: String,
      required: true,
      trim: true,
    },
    refundSource: {
      type: String,
      enum: ['PLATFORM', 'SELLER'],
      required: true,
    },
    refundMethod: {
      type: String,
      enum: ['MANUAL_UPI', 'MANUAL_BANK'],
      required: true,
    },
    referenceNumber: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      index: true,
    },
    refundDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    initiatedByAdmin: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    adminNote: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['COMPLETED'],
      default: 'COMPLETED',
      required: true,
    },
    adminIp: {
      type: String,
      trim: true,
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
  {
    timestamps: true,
  },
)

// Refunds are immutable – prevent updates after creation
RefundSchema.pre('findOneAndUpdate', function (next) {
  const err = new Error('Refund records are immutable and cannot be updated')
  next(err)
})

RefundSchema.pre('updateOne', function (next) {
  const err = new Error('Refund records are immutable and cannot be updated')
  next(err)
})

RefundSchema.pre('updateMany', function (next) {
  const err = new Error('Refund records are immutable and cannot be updated')
  next(err)
})

export default mongoose.model<IRefund>('Refund', RefundSchema)
