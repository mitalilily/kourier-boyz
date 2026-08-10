import mongoose, { Document, Schema } from 'mongoose'
import { ALLOWED_GST_RATES, validateGstRate, validateHsnSacCode } from '../constants/gst'
import { calculateEffectivePriceAndProfit } from '../services/products/utils'

export interface IProductReview {
  _id: mongoose.Types.ObjectId
  user: mongoose.Types.ObjectId
  reviewer: {
    name: string
    avatarUrl?: string
    city?: string
    state?: string
  }
  rating: number
  title?: string
  comment: string
  isVerifiedPurchase?: boolean
  likes?: number
  dislikes?: number
  likedBy?: mongoose.Types.ObjectId[]
  dislikedBy?: mongoose.Types.ObjectId[]
  anonymousLikedBy?: string[]
  anonymousDislikedBy?: string[]
  images?: string[]
  videos?: string[]
  moderationStatus: 'pending' | 'approved' | 'rejected'
  moderationReason?: string
  moderatedAt?: Date
  moderatedBy?: mongoose.Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

export interface IProduct extends Document {
  name: string
  slug: string
  description: string
  shortDescription?: string
  price?: number
  comparePrice?: number
  costPrice?: number
  effectivePrice?: number // What customer actually pays (calculated)
  exclusivePrice?: number // Price without GST (calculated)
  exclusiveTaxAmount?: number // GST amount (tax amount) (calculated)
  profit?: number // Profit per unit (calculated)
  sku: string
  stock: number
  lowStockThreshold?: number
  category: mongoose.Types.ObjectId
  seller: mongoose.Types.ObjectId
    images: string[]
    videos?: string[]
    mainImage?: string
  specifications?: Array<{ key?: string; value: string }> // Merged: can be key-value pairs or simple features (empty key)
  brand?: string // Legacy field - kept for backward compatibility
  brand_id?: mongoose.Types.ObjectId // New field - reference to Brand model
  weight?: number
  dimensions?: { length: number; width: number; height: number }
  tags?: string[]
  filterMetadata?: Array<{
    key: string
    values: string[]
  }>
  status: 'draft' | 'active' | 'inactive' | 'out_of_stock' | 'pending_approval' | 'pending_category_approval'
  isFeatured: boolean
  statusLockedByAdmin?: boolean
  rating?: number
  reviewCount?: number
  soldCount: number
  viewCount: number
  reviews?: IProductReview[]
  // Discounts
  discountPercent?: number
  discountStart?: Date
  discountEnd?: Date
  // Media metadata
  imageMeta?: Array<{
    url: string
    alt?: string
    isCover?: boolean
    sort?: number
  }>

  // Advanced inventory features
  hasVariants: boolean
  variantAttributes?: string[] // e.g., ['color', 'size', 'material']
  totalStock: number // Sum of all variant stocks
  lowStockVariants: number // Count of variants below threshold

  // SEO and marketing
  metaTitle?: string
  metaDescription?: string
  seoKeywords?: string[]

  // Inventory management
  trackInventory: boolean
  minOrderQuantity: number
  maxOrderQuantity?: number

  // Warehouse inventory - inventory distributed across multiple warehouses/pickup addresses
  warehouseInventory?: Array<{
    warehouseId: string // Reference to pickupAddress _id or courierCartPickupAddressId
    warehouseName: string // Name of the warehouse for display
    quantity: number // Stock quantity in this warehouse
    lowStockThreshold?: number // Low stock threshold for this warehouse
  }>

  // Pricing
  taxClass?: string
  taxRate?: number

  // GST/HSN
  // - For simple products (hasVariants=false): REQUIRED if seller is GST registered, null if not
  // - For variant products (hasVariants=true): Optional defaults for variants to inherit
  isGstApplicable?: boolean // Whether GST is applicable (if true, GST is included in effective price - inclusive pricing)
  hsnSacCode?: string | null // Required if hasVariants=false and seller is GST registered, null if not GST registered
  gstRatePercent?: number | null // Required if hasVariants=false and seller is GST registered, null if not GST registered
  cgstRatePercent?: number | null // CGST rate for simple products
  sgstRatePercent?: number | null // SGST rate for simple products
  igstRatePercent?: number | null // IGST rate for simple products
  defaultHsnSacCode?: string | null // Optional defaults for variants (only used if hasVariants=true), null if seller is not GST registered
  defaultGstRatePercent?: number | null // Optional defaults for variants (only used if hasVariants=true), null if seller is not GST registered (backward compatibility, represents IGST)
  defaultCgstRatePercent?: number | null // Optional defaults for variants
  defaultSgstRatePercent?: number | null // Optional defaults for variants
  defaultIgstRatePercent?: number | null // Optional defaults for variants (must be one of: 0, 5, 12, 18, 28)

  // Shipping
  shippingWeight?: number
  shippingDimensions?: {
    length: number
    width: number
    height: number
  }
  requiresShipping: boolean
  freeShipping: boolean
  shippingCharge?: number // Product-level shipping charge (overrides seller default)

  // Fulfillment
  fulfillmentType?: 'self-ship' | 'marketplace-fulfilled' // Override store default if set
  // If not set, uses seller's default fulfillmentType
  // At order level, system can auto-decide based on inventory location, buyer region, etc.

  // Product Features & Policies
  payOnDelivery?: boolean
  returnable?: boolean
  returnDays?: number
  warranty?: boolean
  warrantyDays?: number

  // Manufacturer & Importer Information
  manufacturerName?: string
  manufacturerAddress?: string
  importerName?: string
  importerAddress?: string
  countryOfOrigin?: string

  createdAt: Date
  updatedAt: Date

  // Admin moderation
  objections?: Array<{
    reason: string
    createdAt: Date
    raisedBy: mongoose.Types.ObjectId
    resolved?: boolean
    resolvedAt?: Date
    resolutionNote?: string
    addressedBySeller?: boolean
    addressedAt?: Date
  }>

  // Certificate tracking - stores IDs of certificates used by this product
  certificateIds?: mongoose.Types.ObjectId[]
}

const ProductSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true },
    description: {
      type: String,
      required: function () {
        return (this as any).status !== 'draft'
      },
    },
    shortDescription: { type: String },
    price: {
      type: Number,
      required: function () {
        return (this as any).status !== 'draft' && !(this as any).hasVariants
      },
      min: 0,
    },
    comparePrice: { type: Number, min: 0 },
    costPrice: { type: Number, min: 0 },
    effectivePrice: { type: Number, min: 0 }, // What customer actually pays
    exclusivePrice: { type: Number, min: 0 }, // Price without GST
    exclusiveTaxAmount: { type: Number, min: 0 }, // GST amount (tax amount)
    profit: { type: Number }, // Profit per unit (can be negative)
    sku: { type: String, required: true },
    stock: { type: Number, required: true, default: 0, min: 0 },
    lowStockThreshold: { type: Number, default: 5 },
    category: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: function () {
        return (this as any).status !== 'draft'
      },
    },
    seller: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    images: [
      {
        type: String,
        required: function () {
          return (this as any).status !== 'draft'
        },
      },
    ],
    videos: [{ type: String }],
    mainImage: {
      type: String,
      required: function () {
        return (this as any).status !== 'draft' && !(this as any).hasVariants
      },
    },
    specifications: [
      {
        key: { type: String, default: '' }, // Optional key - empty for simple features
        value: { type: String, required: true },
      },
    ],
    brand: { type: String }, // Legacy field - kept for backward compatibility
    brand_id: { type: Schema.Types.ObjectId, ref: 'Brand' }, // New field - reference to Brand model
    weight: { type: Number },
    dimensions: {
      length: { type: Number },
      width: { type: Number },
      height: { type: Number },
    },
    tags: [{ type: String }],
    filterMetadata: [
      {
        key: { type: String, required: true },
        values: [{ type: String }],
      },
    ],
    status: {
      type: String,
      enum: ['draft', 'active', 'inactive', 'out_of_stock', 'pending_approval', 'pending_category_approval'],
      default: 'draft',
    },
    statusLockedByAdmin: { type: Boolean, default: false },
    isFeatured: { type: Boolean, default: false },
    rating: { type: Number, min: 0, max: 5, default: 0 },
    reviewCount: { type: Number, default: 0 },
    soldCount: { type: Number, default: 0 },
    viewCount: { type: Number, default: 0 },
    reviews: {
      type: [
        new Schema<IProductReview>(
          {
            user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
            reviewer: {
              name: { type: String, required: true },
              avatarUrl: { type: String },
              city: { type: String },
              state: { type: String },
            },
            rating: { type: Number, required: true, min: 1, max: 5 },
            title: { type: String },
            comment: { type: String, required: true },
            isVerifiedPurchase: { type: Boolean, default: false },
            likes: { type: Number, default: 0 },
            dislikes: { type: Number, default: 0 },
            likedBy: [{ type: Schema.Types.ObjectId, ref: 'User' }],
            dislikedBy: [{ type: Schema.Types.ObjectId, ref: 'User' }],
            anonymousLikedBy: [{ type: String }], // IP addresses or session IDs
            anonymousDislikedBy: [{ type: String }], // IP addresses or session IDs
            images: [{ type: String }],
            videos: [{ type: String }],
            moderationStatus: {
              type: String,
              enum: ['pending', 'approved', 'rejected'],
              default: 'pending',
            },
            moderationReason: { type: String },
            moderatedAt: { type: Date },
            moderatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
          },
          { timestamps: true },
        ),
      ],
      default: [],
    },
    // Discounts
    discountPercent: { type: Number, min: 0, max: 100 },
    discountStart: { type: Date },
    discountEnd: { type: Date },
    // Media metadata
    imageMeta: [
      {
        url: { type: String, required: true },
        alt: { type: String },
        isCover: { type: Boolean, default: false },
        sort: { type: Number, default: 0 },
      },
    ],

    // Advanced inventory features
    hasVariants: { type: Boolean, required: true, default: false },
    variantAttributes: [{ type: String }],
    totalStock: { type: Number, default: 0, min: 0 },
    lowStockVariants: { type: Number, default: 0, min: 0 },

    // SEO and marketing
    metaTitle: { type: String },
    metaDescription: { type: String },
    seoKeywords: [{ type: String }],

    // Inventory management
    trackInventory: { type: Boolean, default: true },
    minOrderQuantity: { type: Number, default: 1, min: 1 },
    maxOrderQuantity: { type: Number, min: 1 },

    // Warehouse inventory - inventory distributed across multiple warehouses/pickup addresses
    warehouseInventory: [
      {
        warehouseId: { type: String, required: true }, // Reference to pickupAddress _id or courierCartPickupAddressId
        warehouseName: { type: String, required: true }, // Name of the warehouse for display
        quantity: { type: Number, required: true, min: 0 }, // Stock quantity in this warehouse
        lowStockThreshold: { type: Number, min: 0 }, // Low stock threshold for this warehouse
      },
    ],

    // Pricing
    taxClass: { type: String },
    taxRate: { type: Number, min: 0, max: 100 },

    // GST/HSN
    // - For simple products (hasVariants=false): REQUIRED fields
    // - For variant products (hasVariants=true): Optional (variants have their own)
    isGstApplicable: { type: Boolean, default: false },
    hsnSacCode: {
      type: String,
      trim: true,
      validate: {
        validator: function (value: string | undefined | null) {
          // Allow null (seller is not GST registered)
          if (value === null) return true
          const hasVariants = (this as any).hasVariants
          const isGstApplicable = (this as any).isGstApplicable
          // If GST is not applicable for this product, HSN is not required
          if (!isGstApplicable) return true
          // Required if hasVariants=false and GST is applicable, optional if hasVariants=true
          if (!hasVariants && !value) return false
          if (!value) return true // Optional for variant products
          return validateHsnSacCode(value)
        },
        message: 'HSN/SAC code must be numeric-only and have length 4, 6, or 8',
      },
    },
    gstRatePercent: {
      type: Number,
      validate: {
        validator: function (value: number | undefined | null) {
          // Allow null (seller is not GST registered)
          if (value === null) return true
          const hasVariants = (this as any).hasVariants
          const isGstApplicable = (this as any).isGstApplicable
          // If GST is not applicable for this product, GST rate is not required
          if (!isGstApplicable) return true
          // Required if hasVariants=false and GST is applicable, optional if hasVariants=true
          if (!hasVariants && (value === undefined || value === null)) return false
          if (value === undefined || value === null) return true // Optional for variant products
          return validateGstRate(value)
        },
        message: `GST rate must be one of: ${ALLOWED_GST_RATES.join(', ')}`,
      },
    },
    // Separate CGST, SGST, IGST fields for simple products
    cgstRatePercent: {
      type: Number,
      required: false,
      validate: {
        validator: function (value: number | undefined | null) {
          if (value === null || value === undefined) return true
          return value >= 0
        },
        message: 'CGST rate must be a positive number or zero',
      },
    },
    sgstRatePercent: {
      type: Number,
      required: false,
      validate: {
        validator: function (value: number | undefined | null) {
          if (value === null || value === undefined) return true
          return value >= 0
        },
        message: 'SGST rate must be a positive number or zero',
      },
    },
    igstRatePercent: {
      type: Number,
      required: false,
      validate: {
        validator: function (value: number | undefined | null) {
          if (value === null || value === undefined) return true
          return validateGstRate(value)
        },
        message: `IGST rate must be one of: ${ALLOWED_GST_RATES.join(', ')}`,
      },
    },
    // GST/HSN Defaults (for variants to inherit - only used if hasVariants=true)
    defaultHsnSacCode: {
      type: String,
      trim: true,
      validate: {
        validator: function (value: string | undefined | null) {
          // Allow null (seller is not GST registered)
          if (value === null) return true
          if (!value) return true // Optional field
          return validateHsnSacCode(value)
        },
        message: 'HSN/SAC code must be numeric-only and have length 4, 6, or 8',
      },
    },
    defaultGstRatePercent: {
      type: Number,
      validate: {
        validator: function (value: number | undefined | null) {
          // Allow null (seller is not GST registered)
          if (value === null) return true
          if (value === undefined || value === null) return true // Optional field
          return validateGstRate(value)
        },
        message: `GST rate must be one of: ${ALLOWED_GST_RATES.join(', ')}`,
      },
    },
    // Separate default CGST, SGST, IGST fields
    defaultCgstRatePercent: {
      type: Number,
      required: false,
      validate: {
        validator: function (value: number | undefined | null) {
          if (value === null || value === undefined) return true
          return value >= 0
        },
        message: 'Default CGST rate must be a positive number or zero',
      },
    },
    defaultSgstRatePercent: {
      type: Number,
      required: false,
      validate: {
        validator: function (value: number | undefined | null) {
          if (value === null || value === undefined) return true
          return value >= 0
        },
        message: 'Default SGST rate must be a positive number or zero',
      },
    },
    defaultIgstRatePercent: {
      type: Number,
      required: false,
      validate: {
        validator: function (value: number | undefined | null) {
          if (value === null || value === undefined) return true
          return validateGstRate(value)
        },
        message: `Default IGST rate must be one of: ${ALLOWED_GST_RATES.join(', ')}`,
      },
    },

    // Shipping
    shippingWeight: { type: Number, min: 0 },
    shippingDimensions: {
      length: { type: Number, min: 0 },
      width: { type: Number, min: 0 },
      height: { type: Number, min: 0 },
    },
    requiresShipping: { type: Boolean, default: true },
    freeShipping: { type: Boolean, default: false },
    shippingCharge: { type: Number, min: 0 }, // Product-level shipping charge

    // Fulfillment
    fulfillmentType: {
      type: String,
      enum: ['self-ship', 'marketplace-fulfilled'],
      // Optional - if not set, uses seller's default fulfillmentType
    },

    // Product Features & Policies
    payOnDelivery: { type: Boolean, default: true },
    returnable: { type: Boolean, default: true },
    returnDays: { type: Number, default: 10, min: 1, max: 365 },
    warranty: { type: Boolean, default: true },
    warrantyDays: { type: Number, default: 10, min: 1, max: 3650 },

    // Manufacturer & Importer Information
    manufacturerName: { type: String, trim: true },
    manufacturerAddress: { type: String, trim: true },
    importerName: { type: String, trim: true },
    importerAddress: { type: String, trim: true },
    countryOfOrigin: { type: String, trim: true },

    // Admin moderation
    objections: [
      new Schema(
        {
          reason: { type: String, required: true },
          createdAt: { type: Date, default: Date.now },
          raisedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
          },
          resolved: { type: Boolean, default: false },
          resolvedAt: { type: Date },
          resolutionNote: { type: String },
          addressedBySeller: { type: Boolean, default: false },
          addressedAt: { type: Date },
        },
        { _id: false },
      ),
    ],

    // Certificate tracking - stores IDs of certificates used by this product
    certificateIds: [{ type: Schema.Types.ObjectId, ref: 'Certificate' }],
  },
  { timestamps: true },
)

// Ensure uniqueness per seller for slug and sku
ProductSchema.index({ seller: 1, slug: 1 }, { unique: true })
ProductSchema.index({ seller: 1, sku: 1 }, { unique: true })
// Helpful admin queries
ProductSchema.index({ status: 1, category: 1, createdAt: -1 })
ProductSchema.index({ isFeatured: 1 })
// Search-related indexes
ProductSchema.index(
  {
    name: 'text',
    description: 'text',
    brand: 'text',
    tags: 'text',
  },
  {
    name: 'ProductTextIndex',
    weights: {
      name: 10,
      brand: 6,
      tags: 4,
      description: 2,
    },
    default_language: 'english',
  },
)
ProductSchema.index({ category: 1 })
ProductSchema.index({ brand: 1 })
ProductSchema.index({ tags: 1 })

// Auto-generate slug from name if not provided
ProductSchema.pre('save', function (next) {
  if (!this.slug && this.name) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
  }
  next()
})

// Calculate stock from warehouse inventory if available (for simple products)
// This ensures stock is always derived from warehouseInventory, not stored redundantly
// Also calculate effective price and profit
ProductSchema.pre('save', function (next) {
  const hasVariants = (this as any).hasVariants

  // For simple products (non-variants), calculate stock from warehouseInventory if it exists
  if (
    !hasVariants &&
    this.warehouseInventory &&
    Array.isArray(this.warehouseInventory) &&
    this.warehouseInventory.length > 0
  ) {
    const totalWarehouseStock = this.warehouseInventory.reduce(
      (sum: number, wi: { quantity?: number }) => sum + (Number(wi.quantity) || 0),
      0,
    )
    this.stock = totalWarehouseStock
  }

  // For variant products, stock should come from totalStock (sum of variant stocks)
  // totalStock is calculated separately when variants are saved
  if (hasVariants && (this as any).totalStock !== undefined) {
    this.stock = (this as any).totalStock || 0
  }

  // Calculate effective price and profit for simple products (only if not provided from frontend)
  if (!hasVariants && this.price !== undefined) {
    if ((this as any).effectivePrice === undefined || (this as any).profit === undefined) {
      const { effectivePrice, profit } = calculateEffectivePriceAndProfit(
        this.price || 0,
        this.comparePrice || 0,
        this.costPrice || 0,
        this.discountPercent || 0,
      )
      ;(this as any).effectivePrice = effectivePrice
      ;(this as any).profit = profit
    }
  }

  // Update status based on stock for simple products only
  if (!hasVariants && this.stock === 0 && this.status === 'active') {
    this.status = 'out_of_stock'
  }

  next()
})

export default mongoose.model<IProduct>('Product', ProductSchema)
