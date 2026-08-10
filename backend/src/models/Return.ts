import mongoose, { Document, Schema } from 'mongoose'

export type ReturnStatus =
  | 'REQUESTED'
  | 'APPROVED_BY_SELLER'
  | 'APPROVED_BY_ADMIN'
  | 'REJECTED'
  | 'REVERSE_PICKUP_CREATED'
  | 'REVERSE_PICKUP_IN_TRANSIT'
  | 'REVERSE_PICKUP_COMPLETED'
  | 'RETURN_RECEIVED_BY_SELLER'
  | 'REFUND_INITIATED'
  | 'REFUND_COMPLETED'

export interface IReturnTimelineEntry {
  status: ReturnStatus
  message?: string
  timestamp: Date
}

export interface IReturn extends Document {
  order: mongoose.Types.ObjectId
  orderItem?: mongoose.Types.ObjectId | null
  seller: mongoose.Types.ObjectId
  customer: mongoose.Types.ObjectId
  reason: string
  description?: string
  images: string[]
  status: ReturnStatus
  returnType?: 'return' | 'replacement' // 'return' = refund, 'replacement' = exchange
  exchangeVariantId?: mongoose.Types.ObjectId | null // For replacement - selected variant ID
  exchangeOrderId?: mongoose.Types.ObjectId | null // New order created for exchange
  originalOrderId?: mongoose.Types.ObjectId | null // Reference to original order (for exchange tracking)
   // 1 = first attempt, 2 = second (final) attempt
  attemptNumber?: number
  courierReverseAwb?: string | null
  courierReverseId?: string | null
  courierPartner?: string | null
  reverseCharges?: number | null // Reverse courier charges (freight for return)
  reverseCodFee?: number | null // COD fees for return (if original order was COD)
  refundAmount: number
  settlementAdjustment?: number | null
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
  timeline: IReturnTimelineEntry[]
  createdAt: Date
  updatedAt: Date
}

const ReturnTimelineSchema = new Schema<IReturnTimelineEntry>(
  {
    status: {
      type: String,
      enum: [
        'REQUESTED',
        'APPROVED_BY_SELLER',
        'APPROVED_BY_ADMIN',
        'REJECTED',
        'REVERSE_PICKUP_CREATED',
        'REVERSE_PICKUP_IN_TRANSIT',
        'REVERSE_PICKUP_COMPLETED',
        'RETURN_RECEIVED_BY_SELLER',
        'REFUND_INITIATED',
        'REFUND_COMPLETED',
      ],
      required: true,
    },
    message: {
      type: String,
      trim: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false },
)

const ReturnSchema = new Schema<IReturn>(
  {
    order: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true,
    },
    orderItem: {
      type: Schema.Types.ObjectId,
      ref: 'Order.items',
      index: true,
    },
    seller: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    customer: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    images: {
      type: [String],
      default: [],
    },
    returnType: {
      type: String,
      enum: ['return', 'replacement'],
      default: 'return',
    },
    exchangeVariantId: {
      type: Schema.Types.ObjectId,
      ref: 'ProductVariant',
      index: true,
    },
    exchangeOrderId: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      index: true,
    },
    originalOrderId: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      index: true,
    },
    attemptNumber: {
      type: Number,
      min: 1,
      max: 2,
      default: 1,
    },
    status: {
      type: String,
      enum: [
        'REQUESTED',
        'APPROVED_BY_SELLER',
        'APPROVED_BY_ADMIN',
        'REJECTED',
        'REVERSE_PICKUP_CREATED',
        'REVERSE_PICKUP_IN_TRANSIT',
        'REVERSE_PICKUP_COMPLETED',
        'RETURN_RECEIVED_BY_SELLER',
        'REFUND_INITIATED',
        'REFUND_COMPLETED',
      ],
      default: 'REQUESTED',
      index: true,
    },
    courierReverseAwb: {
      type: String,
      index: true,
    },
    courierReverseId: {
      type: String,
      index: true,
    },
    courierPartner: {
      type: String,
      trim: true,
    },
    reverseCharges: {
      type: Number,
      min: 0,
    },
    reverseCodFee: {
      type: Number,
      min: 0,
    },
    refundAmount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    settlementAdjustment: {
      type: Number,
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
    timeline: {
      type: [ReturnTimelineSchema],
      default: [],
    },
  },
  { timestamps: true },
)

ReturnSchema.index({ order: 1, createdAt: -1 })
ReturnSchema.index({ seller: 1, createdAt: -1 })
ReturnSchema.index({ customer: 1, createdAt: -1 })
ReturnSchema.index({ status: 1, createdAt: -1 })

export default mongoose.model<IReturn>('Return', ReturnSchema)
