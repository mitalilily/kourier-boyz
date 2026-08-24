import mongoose, { type Document, type Model, Schema } from 'mongoose'

export interface ISLASettings extends Document {
  // AWB Generation TAT (in hours)
  awbGenerationTatHours: number
  
  // Dispatch / Pickup TAT (in hours) - time from AWB generation to pickup completion
  dispatchTatHours: number
  
  // Optional seller-specific overrides (future-ready)
  sellerOverrides?: Array<{
    sellerId: mongoose.Types.ObjectId
    awbGenerationTatHours?: number
    dispatchTatHours?: number
  }>
  
  updatedBy?: mongoose.Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

interface ISLASettingsModel extends Model<ISLASettings> {
  getSingleton(): Promise<ISLASettings>
}

const SLASettingsSchema = new Schema<ISLASettings>(
  {
    awbGenerationTatHours: {
      type: Number,
      required: true,
      default: 24, // Default 24 hours
      min: 1,
    },
    dispatchTatHours: {
      type: Number,
      required: true,
      default: 48, // Default 48 hours
      min: 1,
    },
    sellerOverrides: [
      {
        sellerId: {
          type: Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        awbGenerationTatHours: {
          type: Number,
          min: 1,
        },
        dispatchTatHours: {
          type: Number,
          min: 1,
        },
      },
    ],
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true },
)

SLASettingsSchema.statics.getSingleton = async function (): Promise<ISLASettings> {
  let settings = await this.findOne()
  if (!settings) {
    settings = await this.create({
      awbGenerationTatHours: 24,
      dispatchTatHours: 48,
    })
  }
  return settings
}

const SLASettings =
  (mongoose.models.SLASettings as ISLASettingsModel) ||
  mongoose.model<ISLASettings, ISLASettingsModel>('SLASettings', SLASettingsSchema)

export default SLASettings



















