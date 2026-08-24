import mongoose, { Document, Schema } from 'mongoose'
import { ALLOWED_GST_RATES, validateGstRate, validateHsnSacCode } from '../constants/gst'
import { calculateEffectivePriceAndProfit } from '../services/products/utils'

export interface IProductVariant extends Document {
  product: mongoose.Types.ObjectId
  seller: mongoose.Types.ObjectId
  sku: string
  name: string
  attributes: {
    color?: string
    size?: string
    material?: string
    style?: string
    [key: string]: string | undefined
  }
  price?: number
  comparePrice?: number
  costPrice?: number
  discountPercent?: number
  effectivePrice?: number // What customer actually pays (calculated)
  profit?: number // Profit per unit (calculated)
  stock: number
  lowStockThreshold?: number

  // Warehouse inventory - inventory distributed across multiple warehouses/pickup addresses
  warehouseInventory?: Array<{
    warehouseId: string // Reference to pickupAddress _id or kourierBoyzLogisticsPickupAddressId
    warehouseName: string // Name of the warehouse for display
    quantity: number // Stock quantity in this warehouse
    lowStockThreshold?: number // Low stock threshold for this warehouse
  }>

  weight?: number
  dimensions?: {
    length: number
    width: number
    height: number
  }
  images: string[]
  videos?: string[]
  mainImage: string
  status: 'active' | 'inactive' | 'out_of_stock'
  isDefault: boolean

  // GST/HSN (REQUIRED if seller is GST registered, null if not)
  hsnSacCode: string | null
  gstRatePercent: number | null // Legacy field, represents IGST
  // Separate CGST, SGST, IGST fields
  cgstRatePercent?: number
  sgstRatePercent?: number
  igstRatePercent: number | null

  createdAt: Date
  updatedAt: Date
}

const ProductVariantSchema = new Schema<IProductVariant>(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    seller: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    sku: { type: String, required: true },
    name: { type: String, required: true },
    attributes: {
      type: Map,
      of: String,
      default: {},
    },
    price: { type: Number, min: 0 },
    comparePrice: { type: Number, min: 0 },
    costPrice: { type: Number, min: 0 },
    discountPercent: { type: Number, min: 0, max: 100 },
    effectivePrice: { type: Number, min: 0 }, // What customer actually pays
    profit: { type: Number }, // Profit per unit (can be negative)
    stock: { type: Number, required: true, default: 0, min: 0 },
    lowStockThreshold: { type: Number, default: 5 },

    // Warehouse inventory - inventory distributed across multiple warehouses/pickup addresses
    warehouseInventory: [
      {
        warehouseId: { type: String, required: true }, // Reference to pickupAddress _id or kourierBoyzLogisticsPickupAddressId
        warehouseName: { type: String, required: true }, // Name of the warehouse for display
        quantity: { type: Number, required: true, min: 0 }, // Stock quantity in this warehouse
        lowStockThreshold: { type: Number, min: 0 }, // Low stock threshold for this warehouse
      },
    ],

    weight: { type: Number, min: 0 },
    dimensions: {
      length: { type: Number, min: 0 },
      width: { type: Number, min: 0 },
      height: { type: Number, min: 0 },
    },
    images: [{ type: String }],
    videos: [{ type: String }],
    mainImage: { type: String },
    status: {
      type: String,
      enum: ['active', 'inactive', 'out_of_stock'],
      default: 'active',
    },
    isDefault: { type: Boolean, default: false },

    // GST/HSN (REQUIRED if seller is GST registered, null if not)
    hsnSacCode: {
      type: String,
      required: function () {
        // Not required if value is null (seller is not GST registered)
        return (this as any).hsnSacCode !== null
      },
      trim: true,
      validate: {
        validator: function (value: string | null) {
          // Allow null (seller is not GST registered)
          if (value === null) return true
          return validateHsnSacCode(value)
        },
        message: 'HSN/SAC code must be numeric-only and have length 4, 6, or 8',
      },
    },
    gstRatePercent: {
      type: Number,
      required: function () {
        // Not required if value is null (seller is not GST registered)
        return (this as any).gstRatePercent !== null
      },
      validate: {
        validator: function (value: number | null) {
          // Allow null (seller is not GST registered)
          if (value === null) return true
          return validateGstRate(value)
        },
        message: `GST rate must be one of: ${ALLOWED_GST_RATES.join(', ')}`,
      },
    },
    // Separate CGST, SGST, IGST fields
    cgstRatePercent: {
      type: Number,
      required: false,
      validate: {
        validator: function (value: number | undefined | null) {
          if (value === null || value === undefined) return true
          return value >= 0 && value <= 100
        },
        message: 'CGST rate must be between 0 and 100',
      },
    },
    sgstRatePercent: {
      type: Number,
      required: false,
      validate: {
        validator: function (value: number | undefined | null) {
          if (value === null || value === undefined) return true
          return value >= 0 && value <= 100
        },
        message: 'SGST rate must be between 0 and 100',
      },
    },
    igstRatePercent: {
      type: Number,
      required: function () {
        // Not required if value is null (seller is not GST registered)
        return (this as any).igstRatePercent !== null
      },
      validate: {
        validator: function (value: number | null) {
          // Allow null (seller is not GST registered)
          if (value === null) return true
          return validateGstRate(value)
        },
        message: `IGST rate must be one of: ${ALLOWED_GST_RATES.join(', ')}`,
      },
    },
  },
  { timestamps: true },
)

// Ensure unique SKU per seller
ProductVariantSchema.index({ seller: 1, sku: 1 }, { unique: true })

// Ensure only one default variant per product
ProductVariantSchema.index(
  { product: 1, isDefault: 1 },
  { unique: true, partialFilterExpression: { isDefault: true } },
)

// Update status based on stock and calculate stock from warehouse inventory
// Also calculate effective price and profit
// Handle GST/HSN inheritance from product
ProductVariantSchema.pre('save', async function (next) {
  // Calculate stock from warehouse inventory if available
  if (
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

  // Calculate effective price and profit (only if not provided from frontend)
  if (this.price !== undefined) {
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

  // Validate GST/HSN fields
  // Skip GST/HSN logic if fields are null (seller is not GST registered)
  const igstValue = (this as any).igstRatePercent ?? this.gstRatePercent
  const isGstFieldsNull = this.hsnSacCode === null && igstValue === null

  if (isGstFieldsNull) {
    // Seller is not GST registered - skip all GST/HSN validation
    // Fields are already set to null, so just continue
    return next()
  }

  // Validate that required fields are present
  // Only validate if fields are not null (seller is GST registered)
  const finalHsnSacCode = this.hsnSacCode && this.hsnSacCode.trim().length > 0
  const finalIgstRate = igstValue !== undefined && igstValue !== null

  if (!finalHsnSacCode || !finalIgstRate) {
    return next(new Error('HSN/SAC code and IGST rate are required for GST registered sellers.'))
  }

  // Validate CGST and SGST if provided (they should add up to IGST)
  const cgstValue = (this as any).cgstRatePercent
  const sgstValue = (this as any).sgstRatePercent

  if (cgstValue !== undefined && sgstValue !== undefined) {
    if (cgstValue + sgstValue !== igstValue) {
      return next(
        new Error(`CGST (${cgstValue}%) + SGST (${sgstValue}%) must equal IGST (${igstValue}%)`),
      )
    }
  }

  // Update status based on stock
  if (this.stock === 0 && this.status === 'active') {
    this.status = 'out_of_stock'
  } else if (this.stock > 0 && this.status === 'out_of_stock') {
    this.status = 'active'
  }
  next()
})

export default mongoose.model<IProductVariant>('ProductVariant', ProductVariantSchema)
