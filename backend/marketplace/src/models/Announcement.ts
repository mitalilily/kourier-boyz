import mongoose, { Document, Schema } from 'mongoose'

export interface IAnnouncement extends Document {
  title: string
  message?: string
  link?: string
  linkText?: string
  backgroundColor?: string
  textColor?: string
  isActive: boolean
  startDate?: Date
  endDate?: Date
  dismissible: boolean
  targetAudience?: 'all' | 'authenticated' | 'guest'
  linkedCoupon?: mongoose.Types.ObjectId // Linked coupon (if announcement was created from coupon)
  createdAt: Date
  updatedAt: Date
  createdBy?: mongoose.Types.ObjectId
}

const AnnouncementSchema: Schema<IAnnouncement> = new Schema(
  {
    title: { type: String, required: true },
    message: { type: String },
    link: { type: String },
    linkText: { type: String, default: 'Learn More' },
    backgroundColor: { type: String, default: '#FFE14B' }, // Default yellow
    textColor: { type: String, default: '#000000' }, // Default black
    isActive: { type: Boolean, default: false }, // Default to inactive - admin must explicitly activate
    startDate: { type: Date },
    endDate: { type: Date },
    dismissible: { type: Boolean, default: true },
      targetAudience: {
        type: String,
        enum: ['all', 'authenticated', 'guest'],
        default: 'all',
      },
      linkedCoupon: {
        type: Schema.Types.ObjectId,
        ref: 'Coupon',
      },
      createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    },
    { timestamps: true },
  )

// Index for efficient queries
AnnouncementSchema.index({ isActive: 1, startDate: 1, endDate: 1 })
AnnouncementSchema.index({ targetAudience: 1 })

// Validation: endDate must be after startDate if both exist
AnnouncementSchema.pre('save', function (next) {
  if (this.startDate && this.endDate && this.endDate < this.startDate) {
    return next(new Error('End date must be after start date'))
  }
  next()
})

export default mongoose.model<IAnnouncement>('Announcement', AnnouncementSchema)

