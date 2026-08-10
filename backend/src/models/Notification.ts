import mongoose, { Document, Schema } from "mongoose";

export type NotificationType =
  | "order"
  | "promotional"
  | "newsletter"
  | "system"
  | "other";

export interface INotification extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  title: string;
  message: string;
  type: NotificationType;
  read: boolean;
  link?: string;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["order", "promotional", "newsletter", "system", "other"],
      default: "other",
      required: true,
    },
    read: {
      type: Boolean,
      default: false,
      index: true,
    },
    link: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
NotificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, createdAt: -1 });

const Notification = mongoose.model<INotification>(
  "Notification",
  NotificationSchema
);

export default Notification;
