import mongoose, { Document, Schema } from "mongoose";

export interface IPromotionalEmail extends Document {
  subject: string;
  content: string;
  excerpt?: string;
  featuredImage?: string;
  author: mongoose.Types.ObjectId;
  status: "draft" | "published";
  publishedAt?: Date;
  sentAt?: Date;
  sentCount?: number;
  scheduledAt?: Date; // When to send the email (for scheduled emails)
  // Target audience
  targetAudience: "all" | "subscribers";
  // SEO/Preview fields
  previewText?: string;
  // Tracking
  openCount?: number;
  clickCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

const PromotionalEmailSchema: Schema<IPromotionalEmail> = new Schema(
  {
    subject: { type: String, required: true, trim: true },
    content: { type: String, required: true },
    excerpt: { type: String, trim: true },
    featuredImage: { type: String },
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: {
      type: String,
      enum: ["draft", "published"],
      default: "draft",
    },
    publishedAt: { type: Date },
    sentAt: { type: Date },
    sentCount: { type: Number, default: 0 },
    scheduledAt: { type: Date }, // For scheduling emails
    targetAudience: {
      type: String,
      enum: ["all", "subscribers"],
      default: "subscribers",
    },
    previewText: { type: String, trim: true },
    openCount: { type: Number, default: 0 },
    clickCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Indexes for efficient queries
PromotionalEmailSchema.index({ status: 1, publishedAt: -1 });
PromotionalEmailSchema.index({ author: 1 });
PromotionalEmailSchema.index({ scheduledAt: 1, status: 1 }); // For finding scheduled emails to send
PromotionalEmailSchema.index({
  subject: "text",
  content: "text",
  excerpt: "text",
});

export default mongoose.model<IPromotionalEmail>(
  "PromotionalEmail",
  PromotionalEmailSchema
);
