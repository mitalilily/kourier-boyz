import mongoose, { Document, Schema } from 'mongoose'

export interface ISizeChartMeasurement {
  name: string // e.g., "Chest", "Waist", "Length", "Shoulder Width"
  unit: 'cm' | 'inch' // Measurement unit
}

export interface ISizeChartRow {
  size: string // e.g., "S", "M", "L", "XL", "28", "30", "32"
  measurements: Array<{
    name: string // Measurement name (e.g., "Chest")
    value: number | string // Measurement value (can be range like "36-38" or single value)
  }>
}

export interface ISizeChart extends Document {
  title: string // Chart title (e.g., "Men's T-Shirt Size Chart")
  description?: string // Optional description or instructions
  chartType: 'category' | 'product' | 'brand' // Scope of the chart
  category?: mongoose.Types.ObjectId // Reference to category (if chartType is 'category')
  product?: mongoose.Types.ObjectId // Reference to product (if chartType is 'product')
  brand?: string // Brand name (if chartType is 'brand')
  seller?: mongoose.Types.ObjectId // Seller who created this chart (for product-level charts)
  measurementType: 'US' | 'UK' | 'EU' | 'IN' | 'custom' // Size standard
  measurements: ISizeChartMeasurement[] // List of measurements (columns)
  rows: ISizeChartRow[] // Size rows with measurements
  image?: string // Optional image URL for visual size chart
  isActive: boolean
  sortOrder?: number // For ordering multiple charts
  createdAt: Date
  updatedAt: Date
}

const SizeChartSchema = new Schema<ISizeChart>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    chartType: {
      type: String,
      enum: ['category', 'product', 'brand'],
      required: true,
    },
    category: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: function () {
        return (this as any).chartType === 'category'
      },
    },
    product: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: function () {
        return (this as any).chartType === 'product'
      },
    },
    brand: {
      type: String,
      trim: true,
      required: function () {
        return (this as any).chartType === 'brand'
      },
    },
    seller: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: function () {
        return (this as any).chartType === 'product'
      },
    },
    measurementType: {
      type: String,
      enum: ['US', 'UK', 'EU', 'IN', 'custom'],
      required: true,
      default: 'IN', // Default to India
    },
    measurements: [
      {
        name: { type: String, required: true, trim: true },
        unit: { type: String, enum: ['cm', 'inch'], required: true, default: 'cm' },
      },
    ],
    rows: [
      {
        size: { type: String, required: true, trim: true },
        measurements: [
          {
            name: { type: String, required: true, trim: true },
            value: { type: Schema.Types.Mixed, required: true }, // Can be number or string (for ranges)
          },
        ],
      },
    ],
    image: { type: String },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
)

// Indexes for efficient queries
SizeChartSchema.index({ chartType: 1, category: 1 })
SizeChartSchema.index({ chartType: 1, product: 1 })
SizeChartSchema.index({ chartType: 1, brand: 1 })
SizeChartSchema.index({ seller: 1 })
SizeChartSchema.index({ isActive: 1 })

// Validation: Ensure measurements in rows match the measurements array
SizeChartSchema.pre('save', function (next) {
  const measurements = this.measurements || []
  const measurementNames = new Set(measurements.map((m) => m.name))

  // Validate that all rows have measurements matching the defined measurements
  for (const row of this.rows || []) {
    const rowMeasurementNames = new Set(row.measurements.map((m) => m.name))
    
    // Check if row has all required measurements
    for (const measurement of measurements) {
      if (!rowMeasurementNames.has(measurement.name)) {
        return next(
          new Error(
            `Row with size "${row.size}" is missing measurement "${measurement.name}"`,
          ),
        )
      }
    }

    // Check if row has any extra measurements not defined
    for (const rowMeasurement of row.measurements) {
      if (!measurementNames.has(rowMeasurement.name)) {
        return next(
          new Error(
            `Row with size "${row.size}" has undefined measurement "${rowMeasurement.name}"`,
          ),
        )
      }
    }
  }

  next()
})

export default mongoose.model<ISizeChart>('SizeChart', SizeChartSchema)

