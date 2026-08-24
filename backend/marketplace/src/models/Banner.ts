import mongoose, { Document, Schema } from 'mongoose'

export interface IBanner extends Document {
  title: string
  subtitle?: string
  image: string
  link?: string
  linkText?: string
  position: 'hero' | 'deals' | 'fashion' | 'trending' | 'featured' | 'newsletter'
  active: boolean
  order: number
  startDate?: Date
  endDate?: Date
  createdAt: Date
  updatedAt: Date
}

const BannerSchema: Schema<IBanner> = new Schema(
  {
    title: { type: String, required: true },
    subtitle: { type: String },
    image: { type: String, required: true },
    link: { type: String },
    linkText: { type: String },
    position: {
      type: String,
      enum: ['hero', 'deals', 'fashion', 'trending', 'featured', 'newsletter'],
      required: true,
    },
    active: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
    startDate: { type: Date },
    endDate: { type: Date },
  },
  { timestamps: true },
)

// Index for efficient queries
BannerSchema.index({ position: 1, active: 1, order: 1 })

export default mongoose.model<IBanner>('Banner', BannerSchema)
