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

export interface ICategoryRequest extends Document {
  name: string;
  description?: string;
  requestedBy: mongoose.Types.ObjectId;
  status: "pending" | "approved" | "rejected";
  adminNote?: string;
  suggestedMainImage?: string;
  suggestedHoverImage?: string;
  suggestedBanners?: string[];
  parent?: mongoose.Types.ObjectId | null;
  // Certificate requirements (set by admin when approving)
  requiredCertificates?: CertificateType[];
  inheritedCertificates?: CertificateType[];
  effectiveCertificates?: CertificateType[];
  overrideParentCertificateRule?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CategoryRequestSchema: Schema<ICategoryRequest> = new Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String },
    requestedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    adminNote: { type: String },
    suggestedMainImage: { type: String },
    suggestedHoverImage: { type: String },
    suggestedBanners: [{ type: String }],
    parent: { type: Schema.Types.ObjectId, ref: "Category", default: null },
    // Certificate requirements (set by admin when approving)
    requiredCertificates: [
      {
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
      },
    ],
    inheritedCertificates: [
      {
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
      },
    ],
    effectiveCertificates: [
      {
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
      },
    ],
    overrideParentCertificateRule: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Prevent duplicate pending requests for same name by same requester
CategoryRequestSchema.index(
  { name: 1, requestedBy: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: "pending" } }
);

export default mongoose.model<ICategoryRequest>(
  "CategoryRequest",
  CategoryRequestSchema
);
