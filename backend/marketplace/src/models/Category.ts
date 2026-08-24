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

export interface ICategory extends Document {
  name: string;
  slug: string;
  description?: string;
  mainImage: string;
  hoverImage: string;
  banners: string[];
  top?: boolean;
  status: "active" | "inactive";
  suggestedAttributes?: string[];
  productCount?: number;
  parent?: mongoose.Types.ObjectId | null;
  // Certificate requirements
  requiredCertificates?: CertificateType[];
  overrideParentCertificateRule?: boolean; // If true, subcategory doesn't inherit parent's certificate rules
  createdAt: Date;
  updatedAt: Date;
}

const CategorySchema: Schema<ICategory> = new Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true },
    description: { type: String },
    mainImage: { type: String, required: true },
    hoverImage: { type: String, required: true },
    banners: [{ type: String }],
    top: { type: Boolean, default: false },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    suggestedAttributes: [{ type: String }],
    productCount: { type: Number, default: 0 },
    parent: { type: Schema.Types.ObjectId, ref: "Category", default: null },
    // Certificate requirements
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
    overrideParentCertificateRule: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Compound index for unique slug per parent (top-level categories can have unique slugs, subcategories under same parent must be unique)
CategorySchema.index({ slug: 1, parent: 1 }, { unique: true });

// Index for efficient parent queries
CategorySchema.index({ parent: 1 });
// Text index to support suggestions
CategorySchema.index(
  {
    name: 'text',
    description: 'text',
  },
  {
    name: 'CategoryTextIndex',
    weights: {
      name: 5,
      description: 1,
    },
    default_language: 'english',
  }
);

// Create slug from name automatically
CategorySchema.pre("save", async function (next) {
  if (this.isModified("name") && !this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  // Prevent circular reference: category cannot be its own parent
  if (this.parent && this.parent.toString() === this._id?.toString()) {
    return next(new Error("Category cannot be its own parent"));
  }

  // Prevent deep nesting: check if setting parent would create circular reference
  if (this.parent && this._id) {
    const parent = await mongoose.model("Category").findById(this.parent);
    if (!parent) {
      return next(new Error("Parent category not found"));
    }

    if (parent.parent && parent.parent.toString() === this._id.toString()) {
      return next(
        new Error(
          "Circular reference detected: cannot set this category as parent"
        )
      );
    }

    // Check for deeper circular references by traversing up the tree
    let currentParent = parent;
    let depth = 0;
    const maxDepth = 10; // Prevent infinite loops

    while (currentParent && currentParent.parent && depth < maxDepth) {
      if (currentParent.parent.toString() === this._id.toString()) {
        return next(
          new Error("Circular reference detected in category hierarchy")
        );
      }
      currentParent = await mongoose
        .model("Category")
        .findById(currentParent.parent);
      depth++;
    }
  }

  next();
});

export default mongoose.model<ICategory>("Category", CategorySchema);
