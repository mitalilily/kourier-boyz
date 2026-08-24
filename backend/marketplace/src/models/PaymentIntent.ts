import mongoose, { Document, Schema } from 'mongoose'

export interface IPaymentIntentItem {
  product: mongoose.Types.ObjectId
  variant?: mongoose.Types.ObjectId
  quantity: number
  price: number
  effectivePrice: number
  priceWithoutTax?: number
  subtotal: number
  discount?: number
  shipping?: number // Shipping charge for this item
  tax?: number
  total?: number
  // Tax breakdown (for invoice)
  hsnSacCode?: string
  gstRatePercent?: number
  gstTaxType?: 'IGST' | 'CGST_SGST'
  igst?: number
  cgst?: number
  sgst?: number
  // Coupon info
  appliedCoupon?: mongoose.Types.ObjectId
  couponCode?: string
  discountAmount?: number
  discountedPrice?: number
}

export interface IPaymentIntent extends Document {
  user: mongoose.Types.ObjectId
  razorpayOrderId: string // Razorpay order ID
  razorpayPaymentId?: string // Will be set when payment is confirmed
  status: 'pending' | 'paid' | 'failed' | 'expired' | 'order_created'
  // Order data
  shippingAddress: {
    name: string
    phone: string
    addressLine1: string
    addressLine2?: string
    city: string
    state: string
    postalCode: string
    country: string
  }
  items: IPaymentIntentItem[]
  paymentMethod: 'razorpay'
  couponId?: mongoose.Types.ObjectId
  deliveryInstructions?: string
  itemInstructions?: Array<{
    productId: string
    variantId?: string
    instructions: string
  }>
  giftWrap?: boolean
  // Pricing
  subtotal: number
  discount: number
  shipping: number
  tax: number
  total: number
  // Payment details (from webhook)
  razorpayPaymentMethod?: 'card' | 'upi' | 'wallet' | 'paylater' | 'netbanking'
  razorpayPaymentDetails?: {
    method?: string
    card?: {
      last4?: string
      network?: string
      issuer?: string
      type?: string
    }
    upi?: {
      vpa?: string
      payer_account_type?: string
    }
    wallet?: {
      wallet_name?: string
    }
    paylater?: {
      provider?: string
    }
    netbanking?: {
      bank?: string
    }
    bank?: string
    contact?: string
    email?: string
    international?: boolean
    notes?: Record<string, string>
  }
  // Order reference (set when order is created)
  orderIds?: mongoose.Types.ObjectId[] // Array of created order IDs
  createdAt: Date
  updatedAt: Date
  expiresAt: Date // Auto-expire after 30 minutes
}

const PaymentIntentItemSchema = new Schema<IPaymentIntentItem>(
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
    price: {
      type: Number,
      required: true,
    },
    effectivePrice: {
      type: Number,
      required: true,
    },
    subtotal: {
      type: Number,
      required: true,
    },
    discount: {
      type: Number,
      default: 0,
    },
    shipping: {
      type: Number,
      default: 0,
    },
    tax: {
      type: Number,
      default: 0,
    },
    total: {
      type: Number,
      default: 0,
    },
    // Tax breakdown
    priceWithoutTax: { type: Number },
    hsnSacCode: { type: String },
    gstRatePercent: { type: Number },
    gstTaxType: { type: String, enum: ['IGST', 'CGST_SGST'] },
    igst: { type: Number },
    cgst: { type: Number },
    sgst: { type: Number },
    // Coupon info
    appliedCoupon: { type: Schema.Types.ObjectId, ref: 'Coupon' },
    couponCode: { type: String },
    discountAmount: { type: Number },
    discountedPrice: { type: Number },
  },
  { _id: false },
)

const PaymentIntentSchema = new Schema<IPaymentIntent>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    razorpayOrderId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    razorpayPaymentId: {
      type: String,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'expired', 'order_created'],
      default: 'pending',
      index: true,
    },
    shippingAddress: {
      name: { type: String, required: true },
      phone: { type: String, required: true },
      addressLine1: { type: String, required: true },
      addressLine2: { type: String },
      city: { type: String, required: true },
      state: { type: String, required: true },
      postalCode: { type: String, required: true },
      country: { type: String, required: true },
    },
    items: {
      type: [PaymentIntentItemSchema],
      required: true,
    },
    paymentMethod: {
      type: String,
      enum: ['razorpay'],
      default: 'razorpay',
    },
    couponId: {
      type: Schema.Types.ObjectId,
      ref: 'Coupon',
    },
    deliveryInstructions: {
      type: String,
    },
    itemInstructions: [
      {
        productId: { type: String, required: true },
        variantId: { type: String },
        instructions: { type: String, required: true },
      },
    ],
    giftWrap: {
      type: Boolean,
      default: false,
    },
    subtotal: {
      type: Number,
      required: true,
    },
    discount: {
      type: Number,
      default: 0,
    },
    shipping: {
      type: Number,
      default: 0,
    },
    tax: {
      type: Number,
      default: 0,
    },
    total: {
      type: Number,
      required: true,
    },
    razorpayPaymentMethod: {
      type: String,
      enum: ['card', 'upi', 'wallet', 'paylater', 'netbanking'],
    },
    razorpayPaymentDetails: {
      type: Schema.Types.Mixed,
    },
    orderIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Order',
      },
    ],
    expiresAt: {
      type: Date,
      required: true,
      index: { expireAfterSeconds: 0 }, // TTL index - auto-delete expired intents
    },
  },
  {
    timestamps: true,
  },
)

// Index for finding pending intents by razorpayOrderId
PaymentIntentSchema.index({ razorpayOrderId: 1, status: 1 })

const PaymentIntent = mongoose.model<IPaymentIntent>('PaymentIntent', PaymentIntentSchema)

export default PaymentIntent

