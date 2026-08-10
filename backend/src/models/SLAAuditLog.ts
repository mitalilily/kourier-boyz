import mongoose, { Document, Schema } from 'mongoose'

export type SLAAuditEventType =
  | 'SLA_STARTED'
  | 'SLA_BREACHED'
  | 'SLA_REMINDER_SENT'
  | 'SLA_RESOLVED'

export interface ISLAAuditLog extends Document {
  slaTrackingId: mongoose.Types.ObjectId
  orderId: mongoose.Types.ObjectId
  sellerId: mongoose.Types.ObjectId
  slaType: 'AWB' | 'DISPATCH'
  eventType: SLAAuditEventType
  
  // Event details
  triggerReason?: string
  reminderType?: 'AUTO' | 'MANUAL'
  reminderCount?: number
  resolvedReason?: 'AWB_GENERATED' | 'DISPATCHED' | 'CANCELLED' | 'RTO'
  
  // Actor information
  actor: 'SYSTEM' | string // 'SYSTEM' or user ID (admin)
  actorName?: string
  
  // Metadata
  orderNumber?: string
  sellerName?: string
  previousStatus?: string
  newStatus?: string
  
  timestamp: Date
  createdAt: Date
}

const SLAAuditLogSchema = new Schema<ISLAAuditLog>(
  {
    slaTrackingId: {
      type: Schema.Types.ObjectId,
      ref: 'SLATracking',
      required: true,
      index: true,
    },
    orderId: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
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
    eventType: {
      type: String,
      enum: ['SLA_STARTED', 'SLA_BREACHED', 'SLA_REMINDER_SENT', 'SLA_RESOLVED'],
      required: true,
      index: true,
    },
    triggerReason: {
      type: String,
    },
    reminderType: {
      type: String,
      enum: ['AUTO', 'MANUAL'],
    },
    reminderCount: {
      type: Number,
    },
    resolvedReason: {
      type: String,
      enum: ['AWB_GENERATED', 'DISPATCHED', 'CANCELLED', 'RTO'],
    },
    actor: {
      type: String,
      required: true,
      index: true,
    },
    actorName: {
      type: String,
    },
    orderNumber: {
      type: String,
    },
    sellerName: {
      type: String,
    },
    previousStatus: {
      type: String,
    },
    newStatus: {
      type: String,
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true },
)

// Compound indexes
SLAAuditLogSchema.index({ orderId: 1, timestamp: -1 })
SLAAuditLogSchema.index({ sellerId: 1, eventType: 1, timestamp: -1 })
SLAAuditLogSchema.index({ slaTrackingId: 1, timestamp: -1 })
SLAAuditLogSchema.index({ eventType: 1, timestamp: -1 })

const SLAAuditLog =
  (mongoose.models.SLAAuditLog as mongoose.Model<ISLAAuditLog>) ||
  mongoose.model<ISLAAuditLog>('SLAAuditLog', SLAAuditLogSchema)

export default SLAAuditLog

