import mongoose, { Document, Schema } from 'mongoose'

export type SettlementStatus =
  | 'NOT_ELIGIBLE'
  | 'ELIGIBLE'
  | 'INCLUDED_IN_BATCH'
  | 'SETTLED'
  | 'REVERSED'

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'ready_to_ship'
  | 'shipped'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'
  | 'refunded'

export type SellerShipmentStatus =
  | 'pending'
  | 'processing'
  | 'ready_to_ship'
  | 'pickup_requested'
  | 'shipped'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'

export interface IShipmentDimensions {
  length: number
  width: number
  height: number
}

export interface IPickupAddressSnapshot {
  warehouseName?: string
  addressLine1: string
  addressLine2?: string
  city: string
  state: string
  postalCode: string
  country: string
  contactName?: string
  contactPhone?: string
}

export interface ISellerShippingMeta {
  awb?: string
  courier?: string
  label?: string
  tracking_link?: string
  weight?: number
  dimensions?: IShipmentDimensions
  pickup_address?: IPickupAddressSnapshot
  charges?: number
  estimated_delivery_date?: string
}

export interface IOrderShipmentTrackingEvent {
  status: string
  location?: string
  message?: string
  timestamp: Date
}

export interface IOrderSellerShipment {
  _id?: mongoose.Types.ObjectId
  seller: mongoose.Types.ObjectId
  status: SellerShipmentStatus
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded'
  inventoryPacked: boolean
  inventoryPackedAt?: Date
  readyToShipAt?: Date
  shippedAt?: Date
  deliveredAt?: Date
  cancelledAt?: Date
  sellerSnapshot?: {
    name?: string
    businessName?: string
    storeSlug?: string
    supportEmail?: string
    supportPhone?: string
  }
  shippingMeta?: ISellerShippingMeta
  kourierBoyzLogistics?: {
    courier_id?: number
    order_id?: string
    order_number?: string
    rate?: number
    awb_number?: string
    label_url?: string
    tracking_link?: string
    estimated_delivery_date?: string
  }
  manifest?: {
    manifest_id?: string
    manifest_url?: string
    manifest_key?: string
  }
  invoice?: {
    invoice_id?: string
    invoice_url?: string
    invoice_number?: string
    generated_at?: Date
    hsnSummary?: Array<{
      hsnSacCode: string
      gstRatePercent: number
      taxableValueTotal: number
      igstAmountTotal: number
      cgstAmountTotal: number
      sgstAmountTotal: number
    }>
  }
  /** Triplicate copy (To Supplier) - same as customer invoice with "Triplicate - To Supplier" notation, visible to seller */
  triplicateInvoice?: {
    invoice_id?: string
    invoice_url?: string
    invoice_number?: string
    generated_at?: Date
  }
  label?: {
    label_id?: string
    label_url?: string
    generated_at?: Date
  }
  package?: {
    weight?: number
    dimensions?: IShipmentDimensions
  }
  trackingEvents?: IOrderShipmentTrackingEvent[]
  totals?: {
    itemSubtotal: number
    discount?: number
  }
  itemIds?: mongoose.Types.ObjectId[]
  // AWB-wise charges
  courierCharge?: number | null // Forward courier charge for this specific AWB
  codCharge?: number | null // COD charge for this specific AWB (if payment method is COD)
  fragile?: boolean // Whether this shipment contains fragile items
  createdAt?: Date
  updatedAt?: Date
}

export interface IOrderItem {
  _id?: mongoose.Types.ObjectId
  product: mongoose.Types.ObjectId
  variant?: mongoose.Types.ObjectId
  seller: mongoose.Types.ObjectId
  sellerStatus: SellerShipmentStatus
  quantity: number
  price: number // Price per unit at time of order (before any global discounts)
  effectivePrice: number // Effective price per unit (what customer actually pays)
  priceWithoutTax: number // Price per unit exclusive of GST
  subtotal: number // Line subtotal, including any item-level discounts (e.g. seller coupons)
  shipping?: number // Shipping charge for this item (charged once per order/item, not per quantity)
  // Optional per-item coupon metadata (copied from cart item when present)
  appliedCoupon?: mongoose.Types.ObjectId
  couponCode?: string
  discountAmount?: number // Total discount applied to this line from item-level coupon
  discountedPrice?: number // Discounted price per unit (for eligible units)
  instructions?: string
  // Return metadata (item-level)
  returnRequested?: boolean
  returnStatus?: string | null

  // Snapshot of GST/HSN at time of order (for invoice generation)
  // Universal fields: use variant fields if variant exists, product fields if not
  variantId?: string // Variant ID (for reference, if variant exists)
  variantSku?: string // Variant SKU (if variant exists)
  variantName?: string // Variant name (if variant exists)
  hsnSacCode?: string // Snapshot of HSN/SAC code (from variant or product)
  gstRatePercent?: number // Snapshot of GST rate (from variant or product)
  gstTaxType?: 'IGST' | 'CGST_SGST' // Determined at order creation time
  // Tax amounts per unit
  igst?: number // IGST amount per unit (for inter-state transactions)
  cgst?: number // CGST amount per unit (for intra-state transactions)
  sgst?: number // SGST amount per unit (for intra-state transactions)
}

export interface IOrder extends Document {
  user: mongoose.Types.ObjectId
  orderNumber?: string
  batchId?: mongoose.Types.ObjectId // Unique ID to track orders from same cart checkout
  batchCode?: string // Human-friendly batch identifier for display
  batchShipping?: number // Total shipping charge for all orders in this batch
  items: IOrderItem[]
  subtotal: number
  discount: number // Total discount from coupons
  shipping: number // Shipping charge for this specific order
  tax: number
  total: number
  status: OrderStatus
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded'
  paymentMethod: 'card' | 'cod' | 'wallet' | 'upi'
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
  deliveryInstructions?: string
  giftWrap?: boolean
  // Admin/global coupon applied at order level
  coupon?: mongoose.Types.ObjectId
  couponRedemption?: mongoose.Types.ObjectId // Coupon redemption record
  discountAmount?: number // Discount amount from coupon
  invoice?: {
    invoice_id?: string
    invoice_url?: string
    invoice_number?: string
    generated_at?: Date
    hsnSummary?: Array<{
      hsnSacCode: string
      gstRatePercent: number
      taxableValueTotal: number
      igstAmountTotal: number
      cgstAmountTotal: number
      sgstAmountTotal: number
    }>
  }
  label?: {
    label_id?: string
    label_url?: string
    generated_at?: Date
  }
  sellerShipments: IOrderSellerShipment[]
  // Payment gateway metadata
  razorpayOrderId?: string | null
  razorpayPaymentId?: string | null
  paymentGateway?: 'razorpay' | 'stripe' | 'cashfree' | 'phonepe' | null
  razorpayPaymentMethod?: 'card' | 'upi' | 'wallet' | 'paylater' | 'netbanking' | null
  razorpayPaymentDetails?: {
    method?: string // card/upi/wallet/paylater/netbanking
    card?: {
      last4?: string
      network?: string // Visa, Mastercard, etc.
      issuer?: string // Bank name
      type?: string // credit/debit
    }
    upi?: {
      vpa?: string // UPI ID
      payer_account_type?: string
    }
    wallet?: {
      wallet_name?: string // paytm, phonepe, etc.
    }
    paylater?: {
      provider?: string
    }
    netbanking?: {
      bank?: string
    }
    bank?: string // Bank name for netbanking
    contact?: string // Contact number used for payment
    email?: string // Email used for payment
    international?: boolean
    notes?: Record<string, string>
  } | null
  // Settlement fields (seller payouts)
  settlementStatus?: SettlementStatus
  settlementEligibleAt?: Date | null
  settlementBatch?: mongoose.Types.ObjectId | null
  sellerSaleAmount?: number | null
  sellerCommissionAmount?: number | null
  sellerShippingEarning?: number | null
  sellerCourierCost?: number | null // Forward courier charges
  sellerCodFee?: number | null // COD fees (if payment method is COD)
  sellerPgFee?: number | null
  sellerNetAmount?: number | null
  // Return metadata (order-level)
  returnRequested?: boolean
  returnStatus?: string | null
  isReturnEligible?: boolean | null
  // Replacement order tracking
  isReplacement?: boolean
  originalOrderId?: mongoose.Types.ObjectId
  returnId?: mongoose.Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

const OrderItemSchema = new Schema<IOrderItem>(
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
    seller: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    sellerStatus: {
      type: String,
      enum: [
        'pending',
        'processing',
        'ready_to_ship',
        'pickup_requested',
        'shipped',
        'in_transit',
        'out_for_delivery',
        'delivered',
        'cancelled',
      ],
      default: 'pending',
      index: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    effectivePrice: {
      type: Number,
      required: true,
      min: 0,
    },
    priceWithoutTax: {
      type: Number,
      required: true,
      min: 0,
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    shipping: {
      type: Number,
      min: 0,
      default: 0,
    },
    appliedCoupon: {
      type: Schema.Types.ObjectId,
      ref: 'SellerCoupon',
    },
    couponCode: {
      type: String,
      trim: true,
    },
    discountAmount: {
      type: Number,
      min: 0,
    },
    discountedPrice: {
      type: Number,
      min: 0,
    },
    instructions: {
      type: String,
      maxlength: 500,
      trim: true,
    },
    returnRequested: {
      type: Boolean,
      default: false,
      index: true,
    },
    returnStatus: {
      type: String,
      default: null,
    },

    // Snapshot of GST/HSN at time of order (for invoice generation)
    // Universal fields: use variant fields if variant exists, product fields if not
    variantId: {
      type: String,
      trim: true,
    },
    variantSku: {
      type: String,
      trim: true,
    },
    variantName: {
      type: String,
      trim: true,
    },
    hsnSacCode: {
      type: String,
      trim: true,
    },
    gstRatePercent: {
      type: Number,
      min: 0,
    },
    gstTaxType: {
      type: String,
      enum: ['IGST', 'CGST_SGST'],
    },
    // Tax amounts per unit
    igst: {
      type: Number,
      min: 0,
    },
    cgst: {
      type: Number,
      min: 0,
    },
    sgst: {
      type: Number,
      min: 0,
    },
  },
  { _id: true },
)
const SellerShipmentSchema = new Schema<IOrderSellerShipment>(
  {
    seller: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: [
        'pending',
        'processing',
        'ready_to_ship',
        'pickup_requested',
        'shipped',
        'in_transit',
        'out_for_delivery',
        'delivered',
        'cancelled',
      ],
      default: 'pending',
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded'],
      default: 'pending',
    },
    inventoryPacked: {
      type: Boolean,
      default: false,
    },
    inventoryPackedAt: Date,
    readyToShipAt: Date,
    shippedAt: Date,
    deliveredAt: Date,
    cancelledAt: Date,
    sellerSnapshot: {
      name: String,
      businessName: String,
      storeSlug: String,
      supportEmail: String,
      supportPhone: String,
    },
    package: {
      weight: Number,
      dimensions: {
        length: Number,
        width: Number,
        height: Number,
      },
    },
    shippingMeta: {
      awb: String,
      courier: String,
      label: String,
      tracking_link: String,
      weight: Number,
      dimensions: {
        length: Number,
        width: Number,
        height: Number,
      },
      pickup_address: {
        warehouseName: String,
        addressLine1: String,
        addressLine2: String,
        city: String,
        state: String,
        postalCode: String,
        country: String,
        contactName: String,
        contactPhone: String,
      },
      charges: Number,
      estimated_delivery_date: String,
    },
    kourierBoyzLogistics: {
      courier_id: Number,
      order_id: String,
      // External KourierBoyzLogistics order_number for this shipment (used for
      // webhooks, tracking, and reverse pickups).
      order_number: String,
      rate: Number,
      awb_number: String,
      label_url: String,
      tracking_link: String,
      estimated_delivery_date: String,
    },
    manifest: {
      manifest_id: String,
      manifest_url: String,
      manifest_key: String,
    },
    invoice: {
      invoice_id: String,
      invoice_url: String,
      invoice_number: String,
      generated_at: Date,
      hsnSummary: [
        {
          hsnSacCode: String,
          gstRatePercent: Number,
          taxableValueTotal: Number,
          igstAmountTotal: Number,
          cgstAmountTotal: Number,
          sgstAmountTotal: Number,
        },
      ],
    },
    triplicateInvoice: {
      invoice_id: String,
      invoice_url: String,
      invoice_number: String,
      generated_at: Date,
    },
    label: {
      label_id: String,
      label_url: String,
      generated_at: Date,
    },
    trackingEvents: [
      {
        status: String,
        location: String,
        message: String,
        timestamp: { type: Date, default: Date.now },
      },
    ],
    totals: {
      itemSubtotal: { type: Number, default: 0 },
      discount: { type: Number, default: 0 },
    },
    itemIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Order.items',
      },
    ],
    // AWB-wise charges
    courierCharge: {
      type: Number,
      min: 0,
      default: null,
    },
    codCharge: {
      type: Number,
      min: 0,
      default: null,
    },
  },
  { _id: true, timestamps: true },
)

const OrderSchema = new Schema<IOrder>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    orderNumber: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    batchId: {
      type: Schema.Types.ObjectId,
      index: true,
    },
    batchCode: {
      type: String,
      index: true,
    },
    batchShipping: {
      type: Number,
      min: 0,
      default: 0,
    },
    items: {
      type: [OrderItemSchema],
      required: true,
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    discount: {
      type: Number,
      default: 0,
      min: 0,
    },
    shipping: {
      type: Number,
      default: 0,
      min: 0,
    },
    tax: {
      type: Number,
      default: 0,
      min: 0,
    },
    total: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: [
        'pending',
        'confirmed',
        'processing',
        'ready_to_ship',
        'shipped',
        'in_transit',
        'out_for_delivery',
        'delivered',
        'cancelled',
        'refunded',
      ],
      default: 'pending',
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded'],
      default: 'pending',
      index: true,
    },
    paymentMethod: {
      type: String,
      enum: ['card', 'cod', 'wallet', 'upi'],
      required: true,
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
    deliveryInstructions: {
      type: String,
      maxlength: 500,
    },
    giftWrap: {
      type: Boolean,
      default: false,
    },
    // Admin/global coupon reference (see controllers for logic)
    coupon: {
      type: Schema.Types.ObjectId,
      ref: 'Coupon',
    },
    couponRedemption: {
      type: Schema.Types.ObjectId,
      ref: 'CouponRedemption',
    },
    discountAmount: {
      type: Number,
      min: 0,
    },
    invoice: {
      invoice_id: String,
      invoice_url: String,
      invoice_number: String,
      generated_at: Date,
      hsnSummary: [
        {
          hsnSacCode: String,
          gstRatePercent: Number,
          taxableValueTotal: Number,
          igstAmountTotal: Number,
          cgstAmountTotal: Number,
          sgstAmountTotal: Number,
        },
      ],
    },
    label: {
      label_id: String,
      label_url: String,
      generated_at: Date,
    },
    // Payment gateway metadata (order-level)
    razorpayOrderId: {
      type: String,
      index: true,
    },
    razorpayPaymentId: {
      type: String,
      index: true,
    },
    paymentGateway: {
      type: String,
      enum: ['razorpay', 'stripe', 'cashfree', 'phonepe'],
      default: null,
      index: true,
    },
    razorpayPaymentMethod: {
      type: String,
      enum: ['card', 'upi', 'wallet', 'paylater', 'netbanking'],
      default: null,
    },
    razorpayPaymentDetails: {
      type: {
        method: String,
        card: {
          last4: String,
          network: String,
          issuer: String,
          type: String,
        },
        upi: {
          vpa: String,
          payer_account_type: String,
        },
        wallet: {
          wallet_name: String,
        },
        paylater: {
          provider: String,
        },
        netbanking: {
          bank: String,
        },
        bank: String,
        contact: String,
        email: String,
        international: Boolean,
        notes: Schema.Types.Mixed,
      },
      default: null,
    },
    sellerShipments: {
      type: [SellerShipmentSchema],
      default: [],
    },
    settlementStatus: {
      type: String,
      enum: ['NOT_ELIGIBLE', 'ELIGIBLE', 'INCLUDED_IN_BATCH', 'SETTLED', 'REVERSED'],
      default: 'NOT_ELIGIBLE',
      index: true,
    },
    settlementEligibleAt: {
      type: Date,
      index: true,
    },
    settlementBatch: {
      type: Schema.Types.ObjectId,
      ref: 'SellerSettlementBatch',
      index: true,
    },
    sellerSaleAmount: {
      type: Number,
      min: 0,
    },
    sellerCommissionAmount: {
      type: Number,
      min: 0,
    },
    sellerShippingEarning: {
      type: Number,
      min: 0,
    },
    sellerCourierCost: {
      type: Number,
      min: 0,
    },
    sellerCodFee: {
      type: Number,
      min: 0,
    },
    sellerPgFee: {
      type: Number,
      min: 0,
    },
    sellerNetAmount: {
      type: Number,
      min: 0,
    },
    returnRequested: {
      type: Boolean,
      default: false,
      index: true,
    },
    returnStatus: {
      type: String,
      default: null,
      index: true,
    },
    isReturnEligible: {
      type: Boolean,
      default: null,
      index: true,
    },
    // Replacement order tracking
    isReplacement: {
      type: Boolean,
      default: false,
      index: true,
    },
    originalOrderId: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
      index: true,
    },
    returnId: {
      type: Schema.Types.ObjectId,
      ref: 'Return',
      default: null,
      index: true,
    },
  },
  { timestamps: true },
)

// Indexes
OrderSchema.index({ user: 1, createdAt: -1 })
OrderSchema.index({ status: 1, createdAt: -1 })
OrderSchema.index({ paymentStatus: 1 })
OrderSchema.index({ createdAt: -1 })
OrderSchema.index({ 'items.seller': 1, createdAt: -1 })
OrderSchema.index({ 'sellerShipments.seller': 1, createdAt: -1 })
OrderSchema.index({ batchId: 1, createdAt: -1 })

OrderSchema.pre('save', function (next) {
  const doc = this as IOrder
  if (!doc.orderNumber) {
    // Format: ORD-YYYYMMDD-XXXXX
    // YYYYMMDD: Date in format 20240115
    // XXXXX: 5-character random alphanumeric
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const dateSegment = `${year}${month}${day}`
    const randomSegment = Math.random().toString(36).substring(2, 7).toUpperCase()
    doc.orderNumber = `ORD-${dateSegment}-${randomSegment}`
  }
  next()
})

export default mongoose.model<IOrder>('Order', OrderSchema)
