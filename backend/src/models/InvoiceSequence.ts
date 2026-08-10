import mongoose, { Document, Schema } from 'mongoose'

export type InvoiceType = 'INVOICE' | 'CREDIT_NOTE' | 'DEBIT_NOTE'

export interface IInvoiceSequence extends Document {
  type: InvoiceType
  financialYear: string // e.g., "25-26"
  sequence: number
  // Seller-specific fields for GST-wise and state-wise numbering
  sellerId?: mongoose.Types.ObjectId // Seller ID (optional for backward compatibility)
  gstNumber?: string // GST number (for seller-specific sequences)
  state?: string // State code (for seller-specific sequences)
  createdAt: Date
  updatedAt: Date
}

const InvoiceSequenceSchema = new Schema<IInvoiceSequence>(
  {
    type: {
      type: String,
      enum: ['INVOICE', 'CREDIT_NOTE', 'DEBIT_NOTE'],
      required: true,
      index: true,
    },
    financialYear: {
      type: String,
      required: true,
      index: true,
    },
    sequence: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    sellerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
      sparse: true, // Allows null values but indexes non-null values
    },
    gstNumber: {
      type: String,
      trim: true,
      index: true,
      sparse: true,
    },
    state: {
      type: String,
      trim: true,
      index: true,
      sparse: true,
    },
  },
  { timestamps: true },
)

// Unique constraint: GST Compliance - one sequence per type per financial year per GSTIN + State
// Primary key: type + financialYear + gstNumber + state
// This ensures each GSTIN + State combination has its own continuous, gap-less sequence
// sellerId is included for tracking but is not part of the uniqueness constraint
InvoiceSequenceSchema.index(
  { type: 1, financialYear: 1, gstNumber: 1, state: 1 },
  {
    unique: true,
    sparse: true,
    partialFilterExpression: { gstNumber: { $exists: true }, state: { $exists: true } },
  },
)

// Additional index with sellerId for backward compatibility and tracking
InvoiceSequenceSchema.index(
  { type: 1, financialYear: 1, sellerId: 1, gstNumber: 1, state: 1 },
  { sparse: true },
)

// Backward compatibility: unique constraint for non-seller sequences
InvoiceSequenceSchema.index(
  { type: 1, financialYear: 1 },
  {
    unique: true,
    partialFilterExpression: { sellerId: { $exists: false } },
  },
)

export default mongoose.model<IInvoiceSequence>('InvoiceSequence', InvoiceSequenceSchema)
