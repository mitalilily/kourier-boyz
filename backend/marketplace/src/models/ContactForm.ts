import mongoose, { Document, Schema } from 'mongoose'

export interface IContactForm extends Document {
  name: string
  email: string
  phone?: string
  subject: string
  message: string
  category: 'general' | 'order' | 'refund' | 'product' | 'account' | 'technical' | 'feedback'
  customerId?: mongoose.Types.ObjectId // Customer who submitted (if logged in)
  orderId?: mongoose.Types.ObjectId // Deprecated - kept for backward compatibility only
  status: 'new' | 'in-progress' | 'resolved' | 'closed'
  respondedBy?: mongoose.Types.ObjectId // Admin who responded
  response?: string
  respondedAt?: Date
  attachments?: string[] // URLs to files
  createdAt: Date
  updatedAt: Date
}

const ContactFormSchema: Schema<IContactForm> = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true },
    phone: { type: String },
    subject: { type: String, required: true, trim: true },
    message: { type: String, required: true },
    category: {
      type: String,
      enum: ['general', 'order', 'refund', 'product', 'account', 'technical', 'feedback'],
      default: 'general',
    },
    customerId: { type: Schema.Types.ObjectId, ref: 'User' },
    orderId: { type: Schema.Types.ObjectId }, // Deprecated - kept for backward compatibility
    status: {
      type: String,
      enum: ['new', 'in-progress', 'resolved', 'closed'],
      default: 'new',
    },
    respondedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    response: { type: String },
    respondedAt: { type: Date },
    attachments: [{ type: String }],
  },
  { timestamps: true },
)

// Index for efficient queries
ContactFormSchema.index({ status: 1, createdAt: -1 })
ContactFormSchema.index({ email: 1, createdAt: -1 })
ContactFormSchema.index({ customerId: 1, createdAt: -1 })

export default mongoose.model<IContactForm>('ContactForm', ContactFormSchema)

