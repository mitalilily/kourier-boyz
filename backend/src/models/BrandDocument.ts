import mongoose, { Document, Schema } from 'mongoose'

export type DocumentType =
  | 'TM_CERTIFICATE'
  | 'TM_APPLICATION'
  | 'SALE_INVOICE'
  | 'AUTHORIZATION_LETTER'

export interface IBrandDocument extends Document {
  brand_id: mongoose.Types.ObjectId
  document_type: DocumentType
  file_url: string
  uploaded_at: Date
}

const BrandDocumentSchema = new Schema<IBrandDocument>(
  {
    brand_id: {
      type: Schema.Types.ObjectId,
      ref: 'Brand',
      required: true,
      index: true,
    },
    document_type: {
      type: String,
      enum: ['TM_CERTIFICATE', 'TM_APPLICATION', 'SALE_INVOICE', 'AUTHORIZATION_LETTER'],
      required: true,
    },
    file_url: {
      type: String,
      required: true,
    },
    uploaded_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
  },
)

// Index for brand document queries
BrandDocumentSchema.index({ brand_id: 1, document_type: 1 })

export default mongoose.model<IBrandDocument>('BrandDocument', BrandDocumentSchema)

