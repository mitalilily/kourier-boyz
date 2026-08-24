import mongoose, { Document, Schema } from 'mongoose'

export type SettlementCycle = 'DAILY' | 'WEEKLY' | 'CUSTOM'

export type CommissionType = 'PERCENTAGE' | 'FIXED'

export interface ISellerSettlementSettings extends Document {
  seller: mongoose.Types.ObjectId
  settlementCycle: SettlementCycle
  customCycleDays?: number | null
  returnWindowDays: number
  commissionType: CommissionType
  commissionValue: number
  minBatchAmount?: number | null
  isActiveOverride: boolean
  createdAt: Date
  updatedAt: Date
}

const SellerSettlementSettingsSchema = new Schema<ISellerSettlementSettings>(
  {
    seller: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    settlementCycle: {
      type: String,
      enum: ['DAILY', 'WEEKLY', 'CUSTOM'],
      default: 'WEEKLY',
    },
    customCycleDays: {
      type: Number,
      min: 1,
      max: 90,
    },
    returnWindowDays: {
      type: Number,
      default: 7,
      min: 0,
      max: 60,
    },
    commissionType: {
      type: String,
      enum: ['PERCENTAGE', 'FIXED'],
      default: 'PERCENTAGE',
    },
    commissionValue: {
      type: Number,
      required: true,
      min: 0,
    },
    minBatchAmount: {
      type: Number,
      min: 0,
    },
    isActiveOverride: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
)

// Ensure a seller has only one settings document
SellerSettlementSettingsSchema.index({ seller: 1 }, { unique: true })

export default mongoose.model<ISellerSettlementSettings>(
  'SellerSettlementSettings',
  SellerSettlementSettingsSchema,
)
