import mongoose, { Document, Schema } from 'mongoose'

export interface IInventoryLog extends Document {
  product: mongoose.Types.ObjectId
  seller: mongoose.Types.ObjectId
  type: 'adjust' | 'set'
  quantityChange: number
  previousStock: number
  newStock: number
  reason?: string
  createdAt: Date
}

const InventoryLogSchema = new Schema<IInventoryLog>(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    seller: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['adjust', 'set'], required: true },
    quantityChange: { type: Number, required: true },
    previousStock: { type: Number, required: true },
    newStock: { type: Number, required: true },
    reason: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
)

InventoryLogSchema.index({ seller: 1, product: 1, createdAt: -1 })

export default mongoose.model<IInventoryLog>('InventoryLog', InventoryLogSchema)
