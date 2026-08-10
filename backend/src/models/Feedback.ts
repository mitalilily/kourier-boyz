import mongoose, { Document, Schema } from 'mongoose'

export type FeedbackType = 'general' | 'product' | 'delivery' | 'support' | 'app' | 'other'
export type FeedbackSource = 'modal' | 'page' | 'post-order' | 'post-support' | 'manual'

export interface IFeedback extends Document {
  _id: mongoose.Types.ObjectId
  user: mongoose.Types.ObjectId
  rating: number // 1-5 stars
  comment?: string
  type: FeedbackType
  source: FeedbackSource
  
  // Context information
  metadata?: {
    page?: string
    userAgent?: string
    device?: 'mobile' | 'tablet' | 'desktop'
    orderId?: string
    productId?: string
    sessionDuration?: number // in seconds
  }
  
  // Admin response
  adminResponse?: string
  respondedBy?: mongoose.Types.ObjectId
  respondedAt?: Date
  
  // Status
  isRead: boolean
  isResolved: boolean
  
  createdAt: Date
  updatedAt: Date
}

export interface IFeedbackPromptStatus extends Document {
  _id: mongoose.Types.ObjectId
  user: mongoose.Types.ObjectId
  
  // Feedback history
  lastFeedbackDate?: Date
  totalFeedbackCount: number
  
  // Prompt tracking
  lastPromptDate?: Date
  lastDismissDate?: Date
  dismissCount: number
  promptCount: number
  
  // User preference
  optedOut: boolean
  optedOutAt?: Date
  
  createdAt: Date
  updatedAt: Date
}

const FeedbackSchema = new Schema<IFeedback>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      maxlength: 2000,
      trim: true,
    },
    type: {
      type: String,
      enum: ['general', 'product', 'delivery', 'support', 'app', 'other'],
      default: 'general',
    },
    source: {
      type: String,
      enum: ['modal', 'page', 'post-order', 'post-support', 'manual'],
      default: 'modal',
    },
    metadata: {
      page: String,
      userAgent: String,
      device: {
        type: String,
        enum: ['mobile', 'tablet', 'desktop'],
      },
      orderId: String,
      productId: String,
      sessionDuration: Number,
    },
    adminResponse: {
      type: String,
      maxlength: 2000,
    },
    respondedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    respondedAt: Date,
    isRead: {
      type: Boolean,
      default: false,
    },
    isResolved: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
)

const FeedbackPromptStatusSchema = new Schema<IFeedbackPromptStatus>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    lastFeedbackDate: Date,
    totalFeedbackCount: {
      type: Number,
      default: 0,
    },
    lastPromptDate: Date,
    lastDismissDate: Date,
    dismissCount: {
      type: Number,
      default: 0,
    },
    promptCount: {
      type: Number,
      default: 0,
    },
    optedOut: {
      type: Boolean,
      default: false,
    },
    optedOutAt: Date,
  },
  {
    timestamps: true,
  }
)

// Indexes for efficient queries
FeedbackSchema.index({ createdAt: -1 })
FeedbackSchema.index({ rating: 1 })
FeedbackSchema.index({ type: 1 })
FeedbackSchema.index({ isRead: 1, isResolved: 1 })

export const Feedback = mongoose.model<IFeedback>('Feedback', FeedbackSchema)
export const FeedbackPromptStatus = mongoose.model<IFeedbackPromptStatus>(
  'FeedbackPromptStatus',
  FeedbackPromptStatusSchema
)

export default Feedback

