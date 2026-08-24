import mongoose, { Document, Schema } from 'mongoose'

export interface IWishlistItem {
  product: mongoose.Types.ObjectId
  variantId?: mongoose.Types.ObjectId // Selected variant when added to wishlist
  priceAtAddition?: number // Price when added to wishlist
  note?: string // User's note about this item
  addedAt: Date // When this item was added
}

export interface IWishlist extends Document {
  user: mongoose.Types.ObjectId
  items: IWishlistItem[] // Changed from products array to items array with metadata
  isPublic?: boolean // Whether wishlist can be shared
  shareToken?: string // Token for sharing wishlist
  createdAt: Date
  updatedAt: Date
}

const WishlistItemSchema = new Schema<IWishlistItem>(
  {
    product: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    variantId: {
      type: Schema.Types.ObjectId,
      ref: 'ProductVariant',
      required: false,
    },
    priceAtAddition: {
      type: Number,
      required: false,
    },
    note: {
      type: String,
      maxlength: 500,
      required: false,
    },
    addedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false },
)

const WishlistSchema = new Schema<IWishlist>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true, // One wishlist per user
    },
    items: [WishlistItemSchema],
    isPublic: {
      type: Boolean,
      default: false,
    },
    shareToken: {
      type: String,
      unique: true,
      sparse: true,
    },
  },
  { timestamps: true },
)

// Index for faster queries
WishlistSchema.index({ user: 1 })

export default mongoose.model<IWishlist>('Wishlist', WishlistSchema)
