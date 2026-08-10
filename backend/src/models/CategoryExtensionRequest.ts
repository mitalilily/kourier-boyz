import mongoose, { Document, Schema } from 'mongoose'

export type CategoryExtensionRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'NEED_MORE_DOCS'

export interface ICategoryExtensionRequest extends Document {
  seller_id: mongoose.Types.ObjectId
  brand_id: mongoose.Types.ObjectId
  category_id: mongoose.Types.ObjectId
  reference_product_id?: mongoose.Types.ObjectId // Context only - the product that triggered this request
  status: CategoryExtensionRequestStatus
  reviewed_by?: mongoose.Types.ObjectId
  reviewed_at?: Date
  rejection_reason?: string
  created_at: Date
  updated_at: Date
}

const CategoryExtensionRequestSchema = new Schema<ICategoryExtensionRequest>(
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
    reference_product_id: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
    },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED', 'NEED_MORE_DOCS'],
      default: 'PENDING',
      index: true,
    },
    reviewed_by: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    reviewed_at: {
      type: Date,
    },
    rejection_reason: {
      type: String,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  },
)

// Prevent duplicate requests for same brand + category
CategoryExtensionRequestSchema.index({ brand_id: 1, category_id: 1, status: 1 })

// Index for admin queries
CategoryExtensionRequestSchema.index({ status: 1, created_at: -1 })
CategoryExtensionRequestSchema.index({ seller_id: 1, status: 1 })

export default mongoose.model<ICategoryExtensionRequest>('CategoryExtensionRequest', CategoryExtensionRequestSchema)


