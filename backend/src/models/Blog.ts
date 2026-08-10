import mongoose, { Document, Schema } from 'mongoose'

export interface IBlog extends Document {
  title: string
  slug: string
  content: string
  excerpt?: string
  featuredImage?: string
  author: mongoose.Types.ObjectId
  status: 'draft' | 'published' | 'archived'
  publishedAt?: Date
  tags: string[]
  categories: string[]
  views: number
  // SEO fields
  metaTitle?: string
  metaDescription?: string
  seoKeywords?: string[]
  createdAt: Date
  updatedAt: Date
}

const BlogSchema: Schema<IBlog> = new Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true },
    content: { type: String, required: true },
    excerpt: { type: String, trim: true },
    featuredImage: { type: String },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'draft',
    },
    publishedAt: { type: Date },
    tags: [{ type: String, trim: true }],
    categories: [{ type: String, trim: true }],
    views: { type: Number, default: 0 },
    // SEO fields
    metaTitle: { type: String, trim: true },
    metaDescription: { type: String, trim: true },
    seoKeywords: [{ type: String, trim: true }],
  },
  { timestamps: true },
)

// Index for efficient queries
BlogSchema.index({ slug: 1 })
BlogSchema.index({ status: 1, publishedAt: -1 })
BlogSchema.index({ author: 1 })
BlogSchema.index({ tags: 1 })
BlogSchema.index({ categories: 1 })
BlogSchema.index({ title: 'text', content: 'text', excerpt: 'text', tags: 'text' })

// Auto-generate slug from title if not provided
BlogSchema.pre('save', async function (next) {
  if (!this.slug && this.title) {
    const baseSlug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
    
    let slug = baseSlug
    let counter = 1
    while (await mongoose.models.Blog?.findOne({ slug })) {
      slug = `${baseSlug}-${counter}`
      counter++
    }
    this.slug = slug
  }
  next()
})

export default mongoose.model<IBlog>('Blog', BlogSchema)


