import mongoose, { Schema } from 'mongoose'

export type AdminActivityStatus = 'success' | 'failure'

export interface IAdminActivityLog {
  user?: mongoose.Types.ObjectId
  email?: string
  action: string
  status: AdminActivityStatus
  ipAddress?: string
  userAgent?: string
  metadata?: Record<string, any>
  createdAt: Date
  updatedAt: Date
}

const AdminActivityLogSchema = new Schema<IAdminActivityLog>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User' },
    email: { type: String },
    action: { type: String, required: true },
    status: {
      type: String,
      enum: ['success', 'failure'],
      required: true,
    },
    ipAddress: { type: String },
    userAgent: { type: String },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
)

export default mongoose.model<IAdminActivityLog>('AdminActivityLog', AdminActivityLogSchema)

