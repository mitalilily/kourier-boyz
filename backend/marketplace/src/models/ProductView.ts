import { Document, InferSchemaType, Schema, model } from 'mongoose'

const ProductViewEntrySchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    viewCount: { type: Number, required: true, default: 1, min: 1 },
    firstViewedAt: { type: Date, required: true, default: Date.now },
    lastViewedAt: { type: Date, required: true, default: Date.now },
    metadata: {
      userAgent: { type: String },
      ipAddress: { type: String },
      referer: { type: String },
    },
  },
  { _id: false },
)

type ProductViewEntry = InferSchemaType<typeof ProductViewEntrySchema>

const UserProductViewsSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    views: {
      type: [ProductViewEntrySchema],
      default: [],
    },
  },
  { timestamps: false },
)

UserProductViewsSchema.index({ user: 1 })
UserProductViewsSchema.index({ 'views.product': 1 })

type UserProductViews = InferSchemaType<typeof UserProductViewsSchema>

export type IUserProductViewEntry = ProductViewEntry
export type IUserProductViewsDocument = Document<unknown, any, UserProductViews> & UserProductViews

export default model<IUserProductViewsDocument>('UserProductViews', UserProductViewsSchema)
