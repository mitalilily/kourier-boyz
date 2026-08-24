import mongoose, { Document, Schema } from 'mongoose'

export interface ISupportArticle extends Document {
  title: string
  content: string
  category: 'orders' | 'shipping' | 'returns' | 'payments' | 'account' | 'products' | 'other'
  tags: string[]
  views: number
  helpful: number
  notHelpful: number
  published: boolean
  priority: number // For ordering in category listings
  createdBy: mongoose.Types.ObjectId // Admin who created it
  updatedBy: mongoose.Types.ObjectId // Admin who last updated it
  createdAt: Date
  updatedAt: Date
}

const SupportArticleSchema: Schema<ISupportArticle> = new Schema(
  {
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true },
    category: {
      type: String,
      enum: ['orders', 'shipping', 'returns', 'payments', 'account', 'products', 'other'],
      required: true,
    },
    tags: [{ type: String, trim: true }],
    views: { type: Number, default: 0 },
    helpful: { type: Number, default: 0 },
    notHelpful: { type: Number, default: 0 },
    published: { type: Boolean, default: true },
    priority: { type: Number, default: 0 }, // Higher number = higher priority
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
)

// Index for efficient category and search queries
SupportArticleSchema.index({ category: 1, published: 1, priority: -1 })
SupportArticleSchema.index({ title: 'text', content: 'text', tags: 'text' })

export default mongoose.model<ISupportArticle>('SupportArticle', SupportArticleSchema)

