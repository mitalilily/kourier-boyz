import mongoose, { Document, Schema } from "mongoose";

export type CertificateType =
  | "FSSAI_LICENSE"
  | "DRUG_LICENSE"
  | "AYUSH_APPROVAL"
  | "FDA_CDSCO_APPROVAL"
  | "BIS_CERTIFICATE"
  | "WPC_ETA_APPROVAL"
  | "BIS_HALLMARK"
  | "ARAI_APPROVAL"
  | "CDSCO_REGISTRATION"
  | "MSDS"
  | "FCO_SEED_LICENSE"
  | "STATE_EXCISE_LICENSE";

export interface ICertificate extends Document {
  seller: mongoose.Types.ObjectId;
  certificateType: CertificateType;
  certificateNumber?: string;
  documentUrl: string;
  expiryDate?: Date;
  status: "pending" | "approved" | "rejected" | "expired";
  certificateVerifiedBy?: mongoose.Types.ObjectId;
  verifiedOn?: Date;
  rejectionReason?: string;
  expiryReminderHistory?: Array<{
    reminderType: "30_days" | "7_days" | "1_day" | "expired";
    sentAt: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const CertificateSchema: Schema<ICertificate> = new Schema(
  {
    seller: { type: Schema.Types.ObjectId, ref: "User", required: true },
    certificateType: {
      type: String,
      enum: [
        "FSSAI_LICENSE",
        "DRUG_LICENSE",
        "AYUSH_APPROVAL",
        "FDA_CDSCO_APPROVAL",
        "BIS_CERTIFICATE",
        "WPC_ETA_APPROVAL",
        "BIS_HALLMARK",
        "ARAI_APPROVAL",
        "CDSCO_REGISTRATION",
        "MSDS",
        "FCO_SEED_LICENSE",
        "STATE_EXCISE_LICENSE",
      ],
      required: true,
    },
    certificateNumber: { type: String },
    documentUrl: { type: String, required: true },
    expiryDate: { type: Date },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "expired"],
      default: "pending",
    },
    certificateVerifiedBy: { type: Schema.Types.ObjectId, ref: "User" },
    verifiedOn: { type: Date },
    rejectionReason: { type: String },
    expiryReminderHistory: [
      new Schema(
        {
          reminderType: {
            type: String,
            enum: ["30_days", "7_days", "1_day", "expired"],
            required: true,
          },
          sentAt: { type: Date, default: Date.now },
        },
        { _id: false }
      ),
    ],
  },
  { timestamps: true }
);

// Index for efficient queries: find valid certificates by seller and type
CertificateSchema.index({ seller: 1, certificateType: 1, status: 1 });
CertificateSchema.index({ expiryDate: 1, status: 1 }); // For expiry tracking

// Auto-update status to expired if expiryDate has passed
CertificateSchema.pre("save", function (next) {
  if (this.expiryDate && this.status === "approved") {
    const now = new Date();
    if (this.expiryDate < now) {
      this.status = "expired";
    }
  }
  next();
});

export default mongoose.model<ICertificate>("Certificate", CertificateSchema);
