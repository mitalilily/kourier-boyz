import mongoose, { Document, Schema } from 'mongoose'

export interface ICartItem {
  product: mongoose.Types.ObjectId
  variant?: mongoose.Types.ObjectId
  quantity: number
  priceAtAddition: number // Snapshot of price when added (kept for backward compatibility)
  effectivePrice: number // Current effectivePrice (what customer actually pays) - used for all calculations
  subtotal?: number // quantity * effectivePrice (optional convenience)
  selected?: boolean // Whether this item is selected for checkout
  // Coupon information
  appliedCoupon?: mongoose.Types.ObjectId // Reference to SellerCoupon
  couponCode?: string // Coupon code for display
  discountAmount?: number // Discount amount applied (total for allowed units only)
  discountedPrice?: number // Price per unit after discount (for discounted units)
  allowedDiscountUnits?: number // How many units get discount (maxRedemptionsPerUser limit)
  fullPriceUnits?: number // How many units at full price
}

export interface ICart extends Document {
  user: mongoose.Types.ObjectId
  items: ICartItem[]
  totalQuantity: number
  totalAmount: number
  checkoutLock?: boolean
  checkoutLockedAt?: Date
  checkoutLockId?: string
  createdAt: Date
  updatedAt: Date
}

const CartItemSchema = new Schema<ICartItem>(
  {
    product: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    variant: {
      type: Schema.Types.ObjectId,
      ref: 'ProductVariant',
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    priceAtAddition: {
      type: Number,
      required: true,
    },
    effectivePrice: {
      type: Number,
      required: true,
    },
    subtotal: {
      type: Number,
      required: false,
    },
    selected: {
      type: Boolean,
      default: true, // Items are selected by default
    },
    // Coupon information
    appliedCoupon: {
      type: Schema.Types.ObjectId,
      ref: 'SellerCoupon',
    },
    couponCode: {
      type: String,
    },
    discountAmount: {
      type: Number,
      min: 0,
    },
    discountedPrice: {
      type: Number,
      min: 0,
    },
    allowedDiscountUnits: {
      type: Number,
      min: 0,
    },
    fullPriceUnits: {
      type: Number,
      min: 0,
    },
  },
  { _id: false },
)

const CartSchema = new Schema<ICart>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    items: [CartItemSchema],
    totalQuantity: {
      type: Number,
      default: 0,
    },
    totalAmount: {
      type: Number,
      default: 0,
    },
    checkoutLock: {
      type: Boolean,
      default: false,
    },
    checkoutLockedAt: {
      type: Date,
    },
    checkoutLockId: {
      type: String,
    },
  },
  { timestamps: true },
)

CartSchema.pre('save', function (next) {
  let totalQty = 0
  let totalAmt = 0

  this.items.forEach((item) => {
    // Calculate subtotal: handle per-unit redemption limits
    // Use effectivePrice for all calculations (what customer actually pays)
    let subtotal = 0
    if (
      item.appliedCoupon &&
      item.allowedDiscountUnits !== undefined &&
      item.fullPriceUnits !== undefined
    ) {
      // Mixed pricing: some units discounted, some at full price
      const discountedAmount =
        (item.discountedPrice ?? item.effectivePrice) * item.allowedDiscountUnits
      const fullPriceAmount = item.effectivePrice * item.fullPriceUnits
      subtotal = discountedAmount + fullPriceAmount
    } else if (item.discountedPrice) {
      // All units discounted (backward compatibility)
      subtotal = item.quantity * item.discountedPrice
    } else {
      // No discount - use effectivePrice
      subtotal = item.quantity * item.effectivePrice
    }
    item.subtotal = subtotal
    totalQty += item.quantity
    totalAmt += subtotal
  })

  this.totalQuantity = totalQty
  this.totalAmount = totalAmt

  next()
})

// Index for faster lookups
CartSchema.index({ user: 1 })

export default mongoose.model<ICart>('Cart', CartSchema)
