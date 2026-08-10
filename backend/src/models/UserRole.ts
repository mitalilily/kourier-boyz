import mongoose, { Document, Schema } from 'mongoose'

export interface IUserRole extends Document {
  userId: mongoose.Types.ObjectId
  roleId: mongoose.Types.ObjectId
  assignedAt: Date
  assignedBy?: mongoose.Types.ObjectId
}

const UserRoleSchema = new Schema<IUserRole>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    roleId: { type: Schema.Types.ObjectId, ref: 'Role', required: true },
    assignedAt: { type: Date, default: Date.now },
    assignedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
)

// Compound index to ensure a user can only have a role assigned once
UserRoleSchema.index({ userId: 1, roleId: 1 }, { unique: true })

// Index for faster lookups
UserRoleSchema.index({ userId: 1 })
UserRoleSchema.index({ roleId: 1 })

export default mongoose.model<IUserRole>('UserRole', UserRoleSchema)



