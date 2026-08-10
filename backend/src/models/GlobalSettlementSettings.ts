import mongoose, { Document, Schema } from 'mongoose'
import { CommissionType, SettlementCycle } from './SellerSettlementSettings'

export interface IGlobalSettlementSettings extends Document {
  settlementCycle: SettlementCycle
  customCycleDays?: number | null
  returnWindowDays: number
  commissionType: CommissionType
  commissionValue: number
  allowSellerOverride: boolean
  minBatchAmount?: number | null
  createdAt: Date
  updatedAt: Date
}

const GlobalSettlementSettingsSchema = new Schema<IGlobalSettlementSettings>(
  {
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
      default: 10,
      min: 0,
    },
    allowSellerOverride: {
      type: Boolean,
      default: true,
    },
    minBatchAmount: {
      type: Number,
      min: 0,
    },
  },
  { timestamps: true },
)

export default mongoose.model<IGlobalSettlementSettings>(
  'GlobalSettlementSettings',
  GlobalSettlementSettingsSchema,
)


