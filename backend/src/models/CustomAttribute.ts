import mongoose, { Document, Schema } from 'mongoose'

export interface ICustomAttribute extends Document {
  seller: mongoose.Types.ObjectId
  key: string
  label: string
  type: 'color' | 'size' | 'material' | 'text' | 'select'
  required?: boolean
  description?: string
  sortOrder?: number
  options?: Array<{
    value: string
    label: string
    color?: string
    description?: string
    sortOrder?: number
  }>
}

const CustomAttributeSchema = new Schema<ICustomAttribute>(
  {
    seller: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    key: { type: String, required: true },
    label: { type: String, required: true },
    type: {
      type: String,
      required: true,
      enum: ['color', 'size', 'material', 'text', 'select'],
    },
    required: { type: Boolean, default: false },
    description: { type: String },
    sortOrder: { type: Number, default: 999 },
    options: [
      {
        value: { type: String, required: true },
        label: { type: String, required: true },
        color: { type: String },
        description: { type: String },
        sortOrder: { type: Number, default: 999 },
      },
    ],
  },
  { timestamps: true },
)

CustomAttributeSchema.index({ seller: 1, key: 1 }, { unique: true })

export default mongoose.model<ICustomAttribute>('CustomAttribute', CustomAttributeSchema)
