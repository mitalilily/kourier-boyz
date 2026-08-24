import mongoose, { Document, Schema } from 'mongoose'

export interface ICourierWebhookReceipt extends Document {
  provider: 'kourier-boyz-logistics' | 'shipmozo'
  payloadHash: string
  signature?: string
  eventType: string
  orderNumber?: string
  courierOrderId?: string
  awb?: string
  status: 'processing' | 'processed' | 'failed'
  deliveryCount: number
  duplicateCount: number
  payload: any
  processedAt?: Date
  lastError?: string
  lastErrorAt?: Date
  createdAt: Date
  updatedAt: Date
}

const CourierWebhookReceiptSchema = new Schema<ICourierWebhookReceipt>(
  {
    provider: {
      type: String,
      enum: ['kourier-boyz-logistics', 'shipmozo'],
      default: 'shipmozo',
      required: true,
      index: true,
    },
    payloadHash: { type: String, required: true },
    signature: { type: String },
    eventType: { type: String, required: true, index: true },
    orderNumber: { type: String, index: true },
    courierOrderId: { type: String, index: true },
    awb: { type: String, index: true },
    status: {
      type: String,
      enum: ['processing', 'processed', 'failed'],
      default: 'processing',
      index: true,
    },
    deliveryCount: { type: Number, default: 1 },
    duplicateCount: { type: Number, default: 0 },
    payload: { type: Schema.Types.Mixed, required: true },
    processedAt: { type: Date },
    lastError: { type: String },
    lastErrorAt: { type: Date },
  },
  { timestamps: true },
)

CourierWebhookReceiptSchema.index({ provider: 1, payloadHash: 1 }, { unique: true })
CourierWebhookReceiptSchema.index({ status: 1, updatedAt: 1 })

const CourierWebhookReceipt = mongoose.model<ICourierWebhookReceipt>(
  'CourierWebhookReceipt',
  CourierWebhookReceiptSchema,
)

export default CourierWebhookReceipt
