import mongoose, { Document, Schema } from 'mongoose'

export interface IWebhookEvent extends Document {
  webhookId: string // Unique webhook ID from Razorpay
  eventType: string // e.g., 'payment.captured', 'order.paid'
  razorpayOrderId: string
  razorpayPaymentId?: string
  status: 'pending' | 'processed' | 'failed' | 'retrying'
  payload: any // Full webhook payload
  processingAttempts: number
  lastError?: string
  lastErrorAt?: Date
  processedAt?: Date
  orderIds?: mongoose.Types.ObjectId[] // Orders created from this webhook
  createdAt: Date
  updatedAt: Date
}

const WebhookEventSchema = new Schema<IWebhookEvent>(
  {
    webhookId: { type: String, required: true, unique: true, index: true },
    eventType: { type: String, required: true, index: true },
    razorpayOrderId: { type: String, required: true, index: true },
    razorpayPaymentId: { type: String, index: true },
    status: {
      type: String,
      enum: ['pending', 'processed', 'failed', 'retrying'],
      default: 'pending',
      index: true,
    },
    payload: { type: Schema.Types.Mixed, required: true },
    processingAttempts: { type: Number, default: 0 },
    lastError: { type: String },
    lastErrorAt: { type: Date },
    processedAt: { type: Date },
    orderIds: [{ type: Schema.Types.ObjectId, ref: 'Order' }],
  },
  { timestamps: true },
)

// Index for finding failed webhooks that need retry
WebhookEventSchema.index({ status: 1, processingAttempts: 1, updatedAt: 1 })

const WebhookEvent = mongoose.model<IWebhookEvent>('WebhookEvent', WebhookEventSchema)
export default WebhookEvent


