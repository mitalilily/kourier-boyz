import mongoose, { Document, Schema } from 'mongoose'

export type BrandType = 'OWN' | 'OTHER'
export type BrandStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'NEED_MORE_DOCS' | 'REVOKED'

export interface IBrand extends Document {
  seller_id: mongoose.Types.ObjectId
  brand_name: string
  brand_type: BrandType
  status: BrandStatus
  rejection_reason?: string
  reviewed_by?: mongoose.Types.ObjectId
  reviewed_at?: Date
  created_at: Date
  updated_at: Date
}

const BrandSchema = new Schema<IBrand>(
  {
    seller_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    brand_name: {
      type: String,
      required: true,
      trim: true,
    },
    brand_type: {
      type: String,
      enum: ['OWN', 'OTHER'],
      required: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED', 'NEED_MORE_DOCS', 'REVOKED'],
      default: 'PENDING',
      index: true,
    },
    rejection_reason: {
      type: String,
    },
    reviewed_by: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    reviewed_at: {
      type: Date,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  },
)

// Ensure unique brand_name per seller
BrandSchema.index({ seller_id: 1, brand_name: 1 }, { unique: true })

// Index for admin queries
BrandSchema.index({ status: 1, created_at: -1 })

export default mongoose.model<IBrand>('Brand', BrandSchema)

