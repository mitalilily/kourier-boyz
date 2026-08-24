import mongoose, { Document, Schema } from "mongoose";

export interface ISubscriber extends Document {
  email: string;
  name?: string;
  isActive: boolean;
  subscribedAt: Date;
  unsubscribedAt?: Date;
  source: "website" | "checkout" | "manual" | "import";
  // Optional link to user if they have an account
  user?: mongoose.Types.ObjectId;
  // Unsubscribe token for secure unsubscribe links
  unsubscribeToken: string;
  createdAt: Date;
  updatedAt: Date;
}

const SubscriberSchema: Schema<ISubscriber> = new Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    name: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
    subscribedAt: { type: Date, default: Date.now },
    unsubscribedAt: { type: Date },
    source: {
      type: String,
      enum: ["website", "checkout", "manual", "import"],
      default: "website",
    },
    user: { type: Schema.Types.ObjectId, ref: "User" },
    unsubscribeToken: { type: String, required: true },
  },
  { timestamps: true }
);

// Unique index on email
SubscriberSchema.index({ email: 1 }, { unique: true });
SubscriberSchema.index({ isActive: 1 });
SubscriberSchema.index({ unsubscribeToken: 1 });

export default mongoose.model<ISubscriber>("Subscriber", SubscriberSchema);
