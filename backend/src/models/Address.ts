import mongoose, { Document, Schema } from "mongoose";

export interface IAddress extends Document {
  user: mongoose.Types.ObjectId;
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
  addressType?: "home" | "work" | "other";
  landmark?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AddressSchema = new Schema<IAddress>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    fullName: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
    },
    addressLine1: {
      type: String,
      required: [true, "Address line 1 is required"],
      trim: true,
    },
    addressLine2: {
      type: String,
      trim: true,
    },
    city: {
      type: String,
      required: [true, "City is required"],
      trim: true,
    },
    state: {
      type: String,
      required: [true, "State is required"],
      trim: true,
    },
    postalCode: {
      type: String,
      required: [true, "Postal code is required"],
      trim: true,
    },
    country: {
      type: String,
      required: [true, "Country is required"],
      trim: true,
      default: "India",
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    addressType: {
      type: String,
      enum: ["home", "work", "other"],
      default: "home",
    },
    landmark: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

// Index for faster queries
AddressSchema.index({ user: 1, isDefault: 1 });

// Ensure only one default address per user
AddressSchema.pre("save", async function (next) {
  if (this.isDefault && this.isModified("isDefault")) {
    // Unset other default addresses for this user
    await mongoose
      .model<IAddress>("Address")
      .updateMany(
        { user: this.user, _id: { $ne: this._id } },
        { isDefault: false }
      );
  }
  next();
});

export default mongoose.model<IAddress>("Address", AddressSchema);
