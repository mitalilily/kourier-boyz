import mongoose, { Document, Schema } from 'mongoose'

export interface ICoupon extends Document {
  code: string // Unique coupon code (e.g., "SAVE20", "WELCOME10")
  type: 'percentage' | 'fixed' // Discount type
  value: number // Discount value (percentage or fixed amount)
  minPurchaseAmount?: number // Minimum order amount to use coupon
  maxDiscountAmount?: number // Maximum discount amount (for percentage coupons)
  usageLimit?: number // Total number of times coupon can be used (null = unlimited)
  usageCount: number // Current number of times coupon has been used
  perUserLimit?: number // How many times a single user can use this coupon (null = unlimited)
  validFrom: Date // Coupon start date
  validTo: Date // Coupon expiry date
  status: 'active' | 'inactive' | 'expired' // Coupon status
  applicableTo: 'all' | 'categories' | 'products' // What the coupon applies to
  applicableCategories?: mongoose.Types.ObjectId[] // Specific categories (if applicableTo is 'categories')
  applicableProducts?: mongoose.Types.ObjectId[] // Specific products (if applicableTo is 'products')
  firstTimeUserOnly?: boolean // Only for first-time customers
  description?: string // Coupon description
  termsAndConditions?: string[] // Optional terms and conditions for the coupon (list)
  linkedAnnouncement?: mongoose.Types.ObjectId // Linked announcement for this coupon
  createdBy: mongoose.Types.ObjectId // Admin who created the coupon
  createdAt: Date
  updatedAt: Date
}

const CouponSchema = new Schema<ICoupon>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      match: /^[A-Z0-9]+$/, // Only uppercase letters and numbers
    },
    type: {
      type: String,
      enum: ['percentage', 'fixed'],
      required: true,
    },
    value: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: function (this: ICoupon, value: number) {
          if (this.type === 'percentage') {
            return value > 0 && value <= 100 // Percentage must be 1-100
          }
          return value > 0 // Fixed amount must be positive
        },
        message: 'Invalid discount value for coupon type',
      },
    },
    minPurchaseAmount: {
      type: Number,
      min: 0,
    },
    maxDiscountAmount: {
      type: Number,
      min: 0,
    },
    usageLimit: {
      type: Number,
      min: 1,
    },
    usageCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    perUserLimit: {
      type: Number,
      min: 1,
    },
    validFrom: {
      type: Date,
      required: true,
      default: Date.now,
    },
    validTo: {
      type: Date,
      required: true,
      validate: {
        validator: function (this: ICoupon, value: Date) {
          return value > this.validFrom
        },
        message: 'ValidTo date must be after ValidFrom date',
      },
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'expired'],
      default: 'active',
    },
    applicableTo: {
      type: String,
      enum: ['all', 'categories', 'products'],
      default: 'all',
    },
    applicableCategories: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Category',
      },
    ],
    applicableProducts: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Product',
      },
    ],
    firstTimeUserOnly: {
      type: Boolean,
      default: false,
    },
    description: {
      type: String,
      trim: true,
    },
    termsAndConditions: [
      {
        type: String,
        trim: true,
      },
    ],
    linkedAnnouncement: {
      type: Schema.Types.ObjectId,
      ref: 'Announcement',
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true },
)

// Indexes
CouponSchema.index({ code: 1 }, { unique: true })
CouponSchema.index({ status: 1, validFrom: 1, validTo: 1 })
CouponSchema.index({ createdAt: -1 })

// Auto-update status based on dates
CouponSchema.pre('save', function (next) {
  const now = new Date()
  if (this.validTo < now && this.status !== 'expired') {
    this.status = 'expired'
  } else if (this.validFrom > now && this.status === 'active') {
    this.status = 'inactive'
  }
  next()
})

// Post-save hook to handle announcement deactivation when coupon expires
CouponSchema.post('save', async function (doc) {
  // Only run if status is expired and has linked announcement
  if (doc.status === 'expired' && doc.linkedAnnouncement) {
    try {
      const Announcement = (await import('./Announcement')).default
      const { cancelAnnouncementSchedule } = await import('../services/announcementScheduler')
      const { io } = await import('../server')

      const linkedAnn = await Announcement.findById(doc.linkedAnnouncement)
      if (linkedAnn && linkedAnn.isActive) {
        linkedAnn.isActive = false
        await linkedAnn.save()
        cancelAnnouncementSchedule(String(doc.linkedAnnouncement))

        io.emit('announcement:deactivated', {
          announcementId: String(doc.linkedAnnouncement),
        })

        console.log(
          `[Coupon] Auto-deactivated announcement for expired coupon ${doc.code}`,
        )
      }
    } catch (error) {
      console.error('Error deactivating announcement in post-save hook:', error)
      // Don't throw - post hooks shouldn't block save
    }
  }
})

// Validate maxDiscountAmount for percentage coupons
CouponSchema.pre('save', function (next) {
  if (this.type === 'percentage' && !this.maxDiscountAmount) {
    // Optional: Set a default max discount if not provided
    // For now, we'll allow it to be optional
  }
  next()
})

export default mongoose.model<ICoupon>('Coupon', CouponSchema)
