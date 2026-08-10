import mongoose, { Document, Schema } from 'mongoose'

export type SLAType = 'AWB' | 'DISPATCH'
export type SLAStatus = 'ACTIVE' | 'RESOLVED'
export type ReminderType = 'AUTO' | 'MANUAL'
export type ResolvedReason = 'AWB_GENERATED' | 'DISPATCHED' | 'CANCELLED' | 'RTO'

export interface IReminderRecord {
  sentAt: Date
  type: ReminderType
  sentBy: 'SYSTEM' | string // 'SYSTEM' or admin user ID
  message?: string // Custom message if manual
}

export interface ISLATracking extends Document {
  orderId: mongoose.Types.ObjectId
  sellerShipmentId?: mongoose.Types.ObjectId // Reference to order.sellerShipments[]._id
  sellerId: mongoose.Types.ObjectId
  slaType: SLAType
  status: SLAStatus
  
  // SLA timing
  startTime: Date // When SLA tracking started
  dueTime: Date // SLA deadline
  breachedAt?: Date // When SLA was first breached
  
  // Resolution tracking
  resolvedAt?: Date
  resolvedReason?: ResolvedReason
  
  // Reminder tracking
  reminderCount: number // 0-3
  reminderSentAt: Date[] // Array of timestamps
  reminders: IReminderRecord[] // Detailed reminder records
  lastReminderSentBy?: 'SYSTEM' | string
  lastReminderType?: ReminderType
  
  // Metadata
  orderNumber?: string
  sellerName?: string
  currentOrderStatus?: string
  currentShipmentStatus?: string
  
  createdAt: Date
  updatedAt: Date
}

const ReminderRecordSchema = new Schema<IReminderRecord>(
  {
    sentAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    type: {
      type: String,
      enum: ['AUTO', 'MANUAL'],
      required: true,
    },
    sentBy: {
      type: String,
      required: true,
    },
    message: {
      type: String,
    },
  },
  { _id: false },
)

const SLATrackingSchema = new Schema<ISLATracking>(
  {
    orderId: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true,
    },
    sellerShipmentId: {
      type: Schema.Types.ObjectId,
      index: true,
    },
    sellerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    slaType: {
      type: String,
      enum: ['AWB', 'DISPATCH'],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'RESOLVED'],
      default: 'ACTIVE',
      index: true,
    },
    startTime: {
      type: Date,
      required: true,
      index: true,
    },
    dueTime: {
      type: Date,
      required: true,
      index: true,
    },
    breachedAt: {
      type: Date,
      index: true,
    },
    resolvedAt: {
      type: Date,
      index: true,
    },
    resolvedReason: {
      type: String,
      enum: ['AWB_GENERATED', 'DISPATCHED', 'CANCELLED', 'RTO'],
    },
    reminderCount: {
      type: Number,
      default: 0,
      min: 0,
      max: 3,
    },
    reminderSentAt: {
      type: [Date],
      default: [],
    },
    reminders: {
      type: [ReminderRecordSchema],
      default: [],
    },
    lastReminderSentBy: {
      type: String,
    },
    lastReminderType: {
      type: String,
      enum: ['AUTO', 'MANUAL'],
    },
    orderNumber: {
      type: String,
    },
    sellerName: {
      type: String,
    },
    currentOrderStatus: {
      type: String,
    },
    currentShipmentStatus: {
      type: String,
    },
  },
  { timestamps: true },
)

// Compound indexes for efficient queries
SLATrackingSchema.index({ status: 1, slaType: 1, dueTime: 1 })
SLATrackingSchema.index({ sellerId: 1, status: 1, createdAt: -1 })
SLATrackingSchema.index({ orderId: 1, sellerId: 1, slaType: 1 })
SLATrackingSchema.index({ status: 1, reminderCount: 1, dueTime: 1 })

const SLATracking =
  (mongoose.models.SLATracking as mongoose.Model<ISLATracking>) ||
  mongoose.model<ISLATracking>('SLATracking', SLATrackingSchema)

export default SLATracking

