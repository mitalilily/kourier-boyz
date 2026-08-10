import mongoose, { Document, Schema } from 'mongoose'

export type AuditActionType =
  | 'REFUND_ISSUED'
  | 'REFUND_OVERRIDE_APPROVED'
  | 'PAYOUT_MARKED_PAID'
  | 'SETTLEMENT_STATUS_CHANGED'
  | 'SETTLEMENT_PAYMENT_RECORDED'
  | 'MANUAL_ADJUSTMENT_CREATED'
  | 'MANUAL_ADJUSTMENT_OVERRIDE_APPROVED'
  | 'SELLER_DEACTIVATION_REQUESTED'
  | 'SELLER_DEACTIVATION_APPROVED'
  | 'SELLER_DEACTIVATION_REJECTED'
  | 'SELLER_REACTIVATED'

export interface IAuditLog extends Document {
  action: AuditActionType
  performedBy: mongoose.Types.ObjectId // Admin user ID
  performedByEmail?: string // Denormalized for quick access
  performedByName?: string // Denormalized for quick access
  ipAddress: string
  userAgent?: string
  entityType: 'REFUND' | 'SETTLEMENT_BATCH' | 'MANUAL_ADJUSTMENT' | 'ORDER' | 'SELLER'
  entityId: mongoose.Types.ObjectId
  metadata: {
    // For refunds
    refundId?: string
    orderId?: string
    refundAmount?: number
    refundReason?: string
    refundSource?: 'PLATFORM' | 'SELLER'
    referenceNumber?: string
    // For settlements
    batchId?: string
    sellerId?: string
    previousStatus?: string
    newStatus?: string
    payoutAmount?: number
    payoutReference?: string
    // For manual adjustments
    adjustmentId?: string
    adjustmentAmount?: number
    adjustmentType?: 'CREDIT' | 'DEBIT'
    overrideReason?: string
    // General
    notes?: string
    [key: string]: unknown
  }
  createdAt: Date
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    action: {
      type: String,
      required: true,
      enum: [
        'REFUND_ISSUED',
        'REFUND_OVERRIDE_APPROVED',
        'PAYOUT_MARKED_PAID',
        'SETTLEMENT_STATUS_CHANGED',
        'SETTLEMENT_PAYMENT_RECORDED',
        'MANUAL_ADJUSTMENT_CREATED',
        'MANUAL_ADJUSTMENT_OVERRIDE_APPROVED',
        'SELLER_DEACTIVATION_REQUESTED',
        'SELLER_DEACTIVATION_APPROVED',
        'SELLER_DEACTIVATION_REJECTED',
        'SELLER_REACTIVATED',
      ],
    },
    performedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    performedByEmail: {
      type: String,
      index: true,
    },
    performedByName: {
      type: String,
    },
    ipAddress: {
      type: String,
      required: true,
    },
    userAgent: {
      type: String,
    },
    entityType: {
      type: String,
      required: true,
      enum: ['REFUND', 'SETTLEMENT_BATCH', 'MANUAL_ADJUSTMENT', 'ORDER', 'SELLER'],
    },
    entityId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false, // We use createdAt explicitly
  },
)

// Indexes for efficient querying
AuditLogSchema.index({ action: 1, createdAt: -1 })
AuditLogSchema.index({ entityType: 1, entityId: 1 })
AuditLogSchema.index({ performedBy: 1, createdAt: -1 })
AuditLogSchema.index({ createdAt: -1 })

const AuditLog = mongoose.model<IAuditLog>('AuditLog', AuditLogSchema)

export default AuditLog

