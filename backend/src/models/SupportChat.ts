import mongoose, { Document, Schema } from 'mongoose'

export interface IChatMessage extends Document {
  chatId: mongoose.Types.ObjectId
  senderId: mongoose.Types.ObjectId
  senderRole: 'customer' | 'super-admin' | 'support'
  message: string
  attachments?: string[] // URLs to files
  read: boolean
  readAt?: Date
  createdAt: Date
}

export interface ISupportChat extends Document {
  customerId: mongoose.Types.ObjectId
  assignedTo?: mongoose.Types.ObjectId // Admin/Support agent
  status: 'open' | 'active' | 'waiting' | 'closed'
  subject?: string
  issueType?: 'order' | 'refund' | 'product' | 'account' | 'shipping' | 'payment' | 'other'
  orderId?: mongoose.Types.ObjectId // If related to an order
  messages: mongoose.Types.ObjectId[] // References to ChatMessage
  lastMessageAt?: Date
  customerSatisfaction?: number // 1-5 rating
  customerFeedback?: string
  resolvedAt?: Date
  createdAt: Date
  updatedAt: Date
}

const ChatMessageSchema: Schema<IChatMessage> = new Schema(
  {
    chatId: { type: Schema.Types.ObjectId, ref: 'SupportChat', required: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    senderRole: {
      type: String,
      enum: ['customer', 'super-admin', 'support'],
      required: true,
    },
    message: { type: String, required: true },
    attachments: [{ type: String }],
    read: { type: Boolean, default: false },
    readAt: { type: Date },
  },
  { timestamps: true },
)

const SupportChatSchema: Schema<ISupportChat> = new Schema(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
    status: {
      type: String,
      enum: ['open', 'active', 'waiting', 'closed'],
      default: 'open',
    },
    subject: { type: String },
    issueType: {
      type: String,
      enum: ['order', 'refund', 'product', 'account', 'shipping', 'payment', 'other'],
    },
    orderId: { type: Schema.Types.ObjectId }, // Reference to order if applicable
    messages: [{ type: Schema.Types.ObjectId, ref: 'ChatMessage' }],
    lastMessageAt: { type: Date },
    customerSatisfaction: { type: Number, min: 1, max: 5 },
    customerFeedback: { type: String },
    resolvedAt: { type: Date },
  },
  { timestamps: true },
)

// Indexes for efficient queries
SupportChatSchema.index({ customerId: 1, status: 1, createdAt: -1 })
SupportChatSchema.index({ assignedTo: 1, status: 1 })
SupportChatSchema.index({ status: 1, lastMessageAt: -1 })

ChatMessageSchema.index({ chatId: 1, createdAt: 1 })

export const ChatMessage = mongoose.model<IChatMessage>('ChatMessage', ChatMessageSchema)
export default mongoose.model<ISupportChat>('SupportChat', SupportChatSchema)

