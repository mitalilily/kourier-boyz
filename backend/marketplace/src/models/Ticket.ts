import mongoose, { Document, Schema } from 'mongoose'

export interface ITicketMessage extends Document {
  ticketId: mongoose.Types.ObjectId
  senderId: mongoose.Types.ObjectId
  senderRole: 'customer' | 'seller' | 'super-admin' | 'support'
  message: string
  attachments?: string[] // URLs to files
  read: boolean
  readAt?: Date
  isSystemMessage?: boolean // For one-way admin system messages
  createdAt: Date
}

export interface ITicket extends Document {
  ticketNumber: string // Auto-generated unique ticket number
  ticketType: 'customer' | 'seller' // Type of ticket
  customerId?: mongoose.Types.ObjectId // For customer tickets
  sellerId?: mongoose.Types.ObjectId // For seller tickets
  createdBy?: mongoose.Types.ObjectId // If created by admin, this is the admin ID
  assignedTo?: mongoose.Types.ObjectId // Admin/Support agent
  status: 'open' | 'in-progress' | 'resolved' | 'closed'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  subject: string
  category:
    | 'order'
    | 'refund'
    | 'product'
    | 'account'
    | 'shipping'
    | 'payment'
    | 'technical'
    | 'settlement'
    | 'ledger'
    | 'payout'
    | 'other'
  description: string // Initial ticket description
  // Contextual links
  orderId?: mongoose.Types.ObjectId // If related to an order
  ledgerEntryId?: mongoose.Types.ObjectId // If related to a ledger entry
  settlementBatchId?: mongoose.Types.ObjectId // If related to a settlement
  refundRequestId?: mongoose.Types.ObjectId // If related to a refund
  messages: mongoose.Types.ObjectId[] // References to TicketMessage
  lastMessageAt?: Date
  lastActivityAt?: Date
  customerSatisfaction?: number // 1-5 rating
  customerFeedback?: string
  resolvedAt?: Date
  closedAt?: Date
  // SLA fields
  slaHours?: number // SLA duration in hours (derived from category + priority)
  firstResponseAt?: Date // When first response was sent
  assignedRole?: 'SELLER_SUPPORT' | 'FINANCE' | 'OPS' | 'TECH' | 'ADMIN' // Role assigned to handle ticket
  createdAt: Date
  updatedAt: Date
}

const TicketMessageSchema: Schema<ITicketMessage> = new Schema(
  {
    ticketId: { type: Schema.Types.ObjectId, ref: 'Ticket', required: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    senderRole: {
      type: String,
      enum: ['customer', 'seller', 'super-admin', 'support'],
      required: true,
    },
    message: { type: String, required: false, default: '' }, // Optional - can be empty if attachments are present
    attachments: [{ type: String }],
    read: { type: Boolean, default: false },
    readAt: { type: Date },
    isSystemMessage: { type: Boolean, default: false }, // For one-way admin messages
  },
  { timestamps: true },
)

const TicketSchema: Schema<ITicket> = new Schema(
  {
    ticketNumber: { type: String, unique: true, required: false, index: true }, // Will be auto-generated in pre-save hook
    ticketType: {
      type: String,
      enum: ['customer', 'seller'],
      required: true,
      default: 'customer',
      index: true,
    },
    customerId: { type: Schema.Types.ObjectId, ref: 'User' }, // For customer tickets
    sellerId: { type: Schema.Types.ObjectId, ref: 'User', index: true }, // For seller tickets
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' }, // Admin who created the ticket
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
    status: {
      type: String,
      enum: ['open', 'in-progress', 'resolved', 'closed'],
      default: 'open',
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
    },
    subject: { type: String, required: true },
    category: {
      type: String,
      enum: [
        'order',
        'refund',
        'product',
        'account',
        'shipping',
        'payment',
        'technical',
        'settlement',
        'ledger',
        'payout',
        'other',
      ],
      required: true,
    },
    description: { type: String, required: true },
    // Contextual links
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', index: true },
    ledgerEntryId: { type: Schema.Types.ObjectId, ref: 'SellerLedgerEntry', index: true },
    settlementBatchId: { type: Schema.Types.ObjectId, ref: 'SellerSettlementBatch', index: true },
    refundRequestId: { type: Schema.Types.ObjectId, ref: 'RefundRequest', index: true },
    messages: [{ type: Schema.Types.ObjectId, ref: 'TicketMessage' }],
    lastMessageAt: { type: Date },
    lastActivityAt: { type: Date },
    customerSatisfaction: { type: Number, min: 1, max: 5 },
    customerFeedback: { type: String },
    resolvedAt: { type: Date },
    closedAt: { type: Date },
    // SLA fields
    slaHours: { type: Number },
    firstResponseAt: { type: Date },
    assignedRole: {
      type: String,
      enum: ['SELLER_SUPPORT', 'FINANCE', 'OPS', 'TECH', 'ADMIN'],
    },
  },
  { timestamps: true },
)

// Generate unique ticket number in pre-validate hook (runs before validation)
// This ensures ticketNumber is set before schema validation runs
TicketSchema.pre('validate', async function (next) {
  // Only generate if ticketNumber is not set (for new documents or when explicitly not provided)
  if (!this.ticketNumber || this.ticketNumber.trim() === '') {
    let ticketNumber: string = ''
    let exists = true
    let attempts = 0
    const maxAttempts = 10 // Prevent infinite loops

    while (exists && attempts < maxAttempts) {
      attempts++
      // Format: TKT-YYYYMMDD-XXXX (e.g., TKT-20240115-0001)
      // For seller tickets: STKT-YYYYMMDD-XXXX
      const date = new Date()
      const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '')
      const randomNum = Math.floor(Math.random() * 10000)
        .toString()
        .padStart(4, '0')
      const prefix = this.ticketType === 'seller' ? 'STKT' : 'TKT'
      ticketNumber = `${prefix}-${dateStr}-${randomNum}`

      // Check if this ticketNumber already exists (skip check for the current document)
      const Ticket = mongoose.model<ITicket>('Ticket')
      const existing = await Ticket.findOne({ ticketNumber })
      const existingId = existing?._id?.toString()
      const currentId = this._id?.toString()
      exists = !!existing && (!currentId || existingId !== currentId)
    }

    if (attempts >= maxAttempts) {
      return next(new Error('Failed to generate unique ticket number after multiple attempts'))
    }

    this.ticketNumber = ticketNumber
  }

  // Now validate ticketNumber is set
  if (!this.ticketNumber || this.ticketNumber.trim() === '') {
    return next(new Error('ticketNumber must be generated before validation'))
  }

  if (this.ticketType === 'customer' && !this.customerId) {
    return next(new Error('customerId is required for customer tickets'))
  }
  if (this.ticketType === 'seller' && !this.sellerId) {
    return next(new Error('sellerId is required for seller tickets'))
  }
  if (this.ticketType === 'customer' && this.sellerId) {
    return next(new Error('customer tickets cannot have sellerId'))
  }
  if (this.ticketType === 'seller' && this.customerId) {
    return next(new Error('seller tickets cannot have customerId'))
  }
  next()
})

// Update lastActivityAt on save
TicketSchema.pre('save', function (next) {
  this.lastActivityAt = new Date()
  next()
})

// Indexes for efficient queries
TicketSchema.index({ customerId: 1, status: 1, createdAt: -1 })
TicketSchema.index({ sellerId: 1, status: 1, createdAt: -1 })
TicketSchema.index({ ticketType: 1, status: 1 })
TicketSchema.index({ assignedTo: 1, status: 1 })
TicketSchema.index({ status: 1, priority: 1, lastActivityAt: -1 })
TicketSchema.index({ ticketNumber: 1 })
TicketSchema.index({ orderId: 1 })
TicketSchema.index({ ledgerEntryId: 1 })
TicketSchema.index({ settlementBatchId: 1 })
TicketSchema.index({ refundRequestId: 1 })

TicketMessageSchema.index({ ticketId: 1, createdAt: 1 })

export const TicketMessage = mongoose.model<ITicketMessage>('TicketMessage', TicketMessageSchema)
export default mongoose.model<ITicket>('Ticket', TicketSchema)
