import mongoose, { Document, Schema } from 'mongoose'

export interface ISettlementInvoiceSequence extends Document {
  year: number
  sequence: number
  createdAt: Date
  updatedAt: Date
}

const SettlementInvoiceSequenceSchema = new Schema<ISettlementInvoiceSequence>(
  {
    year: {
      type: Number,
      required: true,
      unique: true,
      index: true,
    },
    sequence: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true },
)

export default mongoose.model<ISettlementInvoiceSequence>(
  'SettlementInvoiceSequence',
  SettlementInvoiceSequenceSchema,
)
