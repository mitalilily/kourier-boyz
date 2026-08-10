import mongoose, { Document, Schema } from 'mongoose'

export interface ICouponRedemption extends Document {
  coupon: mongoose.Types.ObjectId // Reference to SellerCoupon
  user: mongoose.Types.ObjectId // User who clipped/applied/redeemed
  order?: mongoose.Types.ObjectId // Order ID (nullable until used)
  status: 'clipped' | 'applied' | 'redeemed' // Status
  discountAmount?: number // Actual discount applied
  orderTotal?: number // Order total when coupon was applied
  createdAt: Date
  updatedAt: Date
}

const CouponRedemptionSchema = new Schema<ICouponRedemption>(
  {
    coupon: {
      type: Schema.Types.ObjectId,
      ref: 'SellerCoupon',
      required: true,
      index: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    order: {
      type: Schema.Types.ObjectId,
      ref: 'Order', // Will reference Order model when created
      index: true,
    },
    status: {
      type: String,
      enum: ['clipped', 'applied', 'redeemed'],
      default: 'clipped',
      required: true,
    },
    discountAmount: {
      type: Number,
      min: 0,
    },
    orderTotal: {
      type: Number,
      min: 0,
    },
  },
  { timestamps: true },
)

// Indexes
CouponRedemptionSchema.index({ coupon: 1, user: 1 })
CouponRedemptionSchema.index({ user: 1, status: 1 })
CouponRedemptionSchema.index({ order: 1 })
CouponRedemptionSchema.index({ createdAt: -1 })

// Compound index to prevent duplicate clipping (one clipped coupon per user)
CouponRedemptionSchema.index({ coupon: 1, user: 1, status: 1 })

export default mongoose.model<ICouponRedemption>('CouponRedemption', CouponRedemptionSchema)
