import mongoose, { Document, Schema } from 'mongoose'

export interface ISellerCoupon extends Document {
  seller: mongoose.Types.ObjectId // Seller who created the coupon
  couponCode?: string // Optional auto-generated code
  discountType: 'flat' | 'percent' // Discount type
  discountValue: number // Discount amount or percentage
  productIds?: mongoose.Types.ObjectId[] // Product-level coupons (JSON array)
  categoryIds?: mongoose.Types.ObjectId[] // Category-level coupons (JSON array)
  startDate: Date
  endDate: Date
  maxRedemptions?: number // Total max redemptions
  maxRedemptionsPerUser?: number // Max per user
  status: 'active' | 'paused' | 'expired' // Status
  redeemedCount: number // Track actual redemptions
  requiresApproval?: boolean // Admin approval flag
  isApproved?: boolean // Admin approval status
  approvedBy?: mongoose.Types.ObjectId // Admin who approved
  approvedAt?: Date
  description?: string // Optional description
  deactivationReason?: string // Reason for deactivation by admin
  deactivatedBy?: mongoose.Types.ObjectId // Admin who deactivated
  deactivatedAt?: Date // When coupon was deactivated
  createdAt: Date
  updatedAt: Date
}

const SellerCouponSchema = new Schema<ISellerCoupon>(
  {
    seller: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    couponCode: {
      type: String,
      trim: true,
      uppercase: true,
      sparse: true, // Allows null values but enforces uniqueness when present
      match: /^[A-Z0-9]+$/, // Only uppercase letters and numbers
    },
    discountType: {
      type: String,
      enum: ['flat', 'percent'],
      required: true,
    },
    discountValue: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: function (this: ISellerCoupon, value: number) {
          if (this.discountType === 'percent') {
            return value > 0 && value <= 100 // Percentage must be 1-100
          }
          return value > 0 // Flat amount must be positive
        },
        message: 'Invalid discount value for discount type',
      },
    },
    productIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Product',
      },
    ],
    categoryIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Category',
      },
    ],
    startDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    endDate: {
      type: Date,
      required: true,
      validate: {
        validator: function (this: ISellerCoupon, value: Date) {
          return value > this.startDate
        },
        message: 'End date must be after start date',
      },
    },
    maxRedemptions: {
      type: Number,
      min: 1,
    },
    maxRedemptionsPerUser: {
      type: Number,
      min: 1,
    },
    status: {
      type: String,
      enum: ['active', 'paused', 'expired'],
      default: 'active',
    },
    redeemedCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    requiresApproval: {
      type: Boolean,
      default: false,
    },
    isApproved: {
      type: Boolean,
      default: true, // Default to approved, can be changed by admin
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    approvedAt: {
      type: Date,
    },
    description: {
      type: String,
      trim: true,
    },
    deactivationReason: {
      type: String,
      trim: true,
    },
    deactivatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    deactivatedAt: {
      type: Date,
    },
  },
  { timestamps: true },
)

// Indexes
SellerCouponSchema.index({ seller: 1, createdAt: -1 })
SellerCouponSchema.index({ status: 1, startDate: 1, endDate: 1 })
SellerCouponSchema.index({ couponCode: 1 }, { unique: true, sparse: true })
SellerCouponSchema.index({ productIds: 1 })
SellerCouponSchema.index({ categoryIds: 1 })

// Auto-generate coupon code if not provided
SellerCouponSchema.pre('save', async function (next) {
  if (!this.couponCode) {
    // Generate a unique code
    const generateCode = () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
      let code = ''
      for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length))
      }
      return code
    }

    let code = generateCode()
    let attempts = 0
    while (attempts < 10) {
      const existing = await mongoose.model('SellerCoupon').findOne({ couponCode: code })
      if (!existing) {
        this.couponCode = code
        break
      }
      code = generateCode()
      attempts++
    }
    if (attempts >= 10) {
      return next(new Error('Failed to generate unique coupon code'))
    }
  }
  next()
})

// Auto-update status based on dates
SellerCouponSchema.pre('save', function (next) {
  const now = new Date()
  if (this.endDate < now) {
    this.status = 'expired'
  } else if (this.status === 'expired') {
    this.status = 'active' // revive if seller extends validity
  }

  next()
})

// Validate that either productIds or categoryIds is provided (or both can be empty for all products)
SellerCouponSchema.pre('save', function (next) {
  // Both can be empty (applies to all seller products)
  // Or at least one must have values
  if (
    (!this.productIds || this.productIds.length === 0) &&
    (!this.categoryIds || this.categoryIds.length === 0)
  ) {
    // This is valid - coupon applies to all seller products
  }
  next()
})

export default mongoose.model<ISellerCoupon>('SellerCoupon', SellerCouponSchema)
