import mongoose, { Document, Schema } from 'mongoose'

export type BrandCategoryScopeStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'REVOKED'

export interface IBrandCategoryScope extends Document {
  seller_id: mongoose.Types.ObjectId
  brand_id: mongoose.Types.ObjectId
  category_id: mongoose.Types.ObjectId
  status: BrandCategoryScopeStatus
  approved_by_admin_id?: mongoose.Types.ObjectId
  rejection_reason?: string
  created_at: Date
  updated_at: Date
}

const BrandCategoryScopeSchema = new Schema<IBrandCategoryScope>(
  {
    seller_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    brand_id: {
      type: Schema.Types.ObjectId,
      ref: 'Brand',
      required: true,
      index: true,
    },
    category_id: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED', 'REVOKED'],
      default: 'PENDING',
      index: true,
    },
    approved_by_admin_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    rejection_reason: {
      type: String,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  },
)

// Ensure unique seller_id + brand_id + category_id combination (seller-scoped)
BrandCategoryScopeSchema.index({ seller_id: 1, brand_id: 1, category_id: 1 }, { unique: true })

// Index for efficient queries
BrandCategoryScopeSchema.index({ brand_id: 1, status: 1 })
BrandCategoryScopeSchema.index({ category_id: 1, status: 1 })

export default mongoose.model<IBrandCategoryScope>('BrandCategoryScope', BrandCategoryScopeSchema)

