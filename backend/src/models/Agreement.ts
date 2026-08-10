import mongoose, { Document, Schema } from 'mongoose'

export interface IAgreement extends Document {
  type:
    | 'marketplace-terms'
    | 'seller-agreement'
    | 'return-refund-policy'
    | 'customer-return-refund-policy'
    | 'prohibited-items'
    | 'privacy-policy'
    | 'seller-privacy-policy'
    | 'customer-terms'
  title: string
  content: string // Rich text content (HTML from editor)
  version: number
  isActive: boolean
  effectiveDate?: Date
  pdfUrl?: string // URL to generated PDF
  createdBy: mongoose.Types.ObjectId
  updatedBy: mongoose.Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

const AgreementSchema = new Schema<IAgreement>(
  {
    type: {
      type: String,
      enum: [
        'marketplace-terms',
        'seller-agreement',
        'return-refund-policy',
        'customer-return-refund-policy',
        'prohibited-items',
        'privacy-policy',
        'seller-privacy-policy',
        'customer-terms',
      ],
      required: true,
      // Removed unique: true to allow multiple versions
      // We'll use a partial unique index instead to ensure only one active version per type
    },
    title: {
      type: String,
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    version: {
      type: Number,
      default: 1,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    effectiveDate: {
      type: Date,
    },
    pdfUrl: {
      type: String,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true },
)

// Create a partial unique index to ensure only one active agreement per type
// This allows multiple versions (inactive) but only one active version per type
AgreementSchema.index(
  { type: 1 },
  {
    unique: true,
    partialFilterExpression: { isActive: true },
  },
)

export default mongoose.model<IAgreement>('Agreement', AgreementSchema)
