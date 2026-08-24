import mongoose, { Document, Schema } from 'mongoose'

export type RefundStatus = 'pending' | 'processing' | 'completed' | 'failed'
export type RefundMode = 'UPI' | 'BANK'
export type RefundType = 'replacement' | 'return'

export interface IRefundRequest extends Document {
  order: mongoose.Types.ObjectId
  replacementOrder?: mongoose.Types.ObjectId | null // For replacement price difference refunds
  return?: mongoose.Types.ObjectId | null // For return refunds
  customer: mongoose.Types.ObjectId
  seller: mongoose.Types.ObjectId
  refundAmount: number
  refundMode: RefundMode
  refundType: RefundType
  status: RefundStatus
  
  // UPI Details
  upiId?: string
  
  // Bank Details
  bankAccountNumber?: string
  ifscCode?: string
  accountHolderName?: string
  
  // Processing Details
  utr?: string // UTR/Reference ID from payment gateway
  processedByAdmin?: mongoose.Types.ObjectId
  processedAt?: Date
  failureReason?: string
  
  // Settlement Adjustment
  settlementAdjustment?: number | null
  
  createdAt: Date
  updatedAt: Date
}

const RefundRequestSchema = new Schema<IRefundRequest>(
  {
    order: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true,
    },
    replacementOrder: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      index: true,
    },
    return: {
      type: Schema.Types.ObjectId,
      ref: 'Return',
      index: true,
    },
    customer: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    seller: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    refundAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    refundMode: {
      type: String,
      enum: ['UPI', 'BANK'],
      required: true,
    },
    refundType: {
      type: String,
      enum: ['replacement', 'return'],
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
      index: true,
    },
    upiId: {
      type: String,
      trim: true,
    },
    bankAccountNumber: {
      type: String,
      trim: true,
    },
    ifscCode: {
      type: String,
      trim: true,
    },
    accountHolderName: {
      type: String,
      trim: true,
    },
    utr: {
      type: String,
      trim: true,
      index: true,
    },
    processedByAdmin: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    processedAt: {
      type: Date,
    },
    failureReason: {
      type: String,
      trim: true,
    },
    settlementAdjustment: {
      type: Number,
    },
  },
  { timestamps: true },
)

// Indexes
RefundRequestSchema.index({ order: 1, createdAt: -1 })
RefundRequestSchema.index({ customer: 1, createdAt: -1 })
RefundRequestSchema.index({ seller: 1, createdAt: -1 })
RefundRequestSchema.index({ status: 1, createdAt: -1 })
RefundRequestSchema.index({ refundType: 1, status: 1 })

export default mongoose.model<IRefundRequest>('RefundRequest', RefundRequestSchema)






















