import mongoose, { Document, Schema } from "mongoose";

export type Permission =
  | "view"
  | "create"
  | "update"
  | "delete"
  | "approve"
  | "reject"
  | "assign"
  | "block";

export interface IModulePermissions {
  dashboard?: Permission[];
  sellerManagement?: Permission[];
  customerManagement?: Permission[];
  products?: Permission[];
  reviews?: Permission[];
  orders?: Permission[];
  returns?: Permission[];
  settlements?: Permission[];
  categories?: Permission[];
  coupons?: Permission[];
  banners?: Permission[];
  announcements?: Permission[];
  blogs?: Permission[];
  "promotional-emails"?: Permission[];
  agreements?: Permission[];
  supportArticles?: Permission[];
  supportChats?: Permission[];
  supportTickets?: Permission[];
  contactForms?: Permission[];
  notifications?: Permission[];
  requests?: Permission[];
  sellerCoupons?: Permission[];
  certificates?: Permission[];
  systemSettings?: Permission[];
  userManagement?: Permission[];
  roleManagement?: Permission[];
  feedback?: Permission[];
  creditNotes?: Permission[];
  settlementInvoices?: Permission[];
  auditLogs?: Permission[];
  reports?: Permission[];
  sellerDeactivationRequests?: Permission[];
}

export interface IRole extends Document {
  name: string;
  description?: string;
  permissions: IModulePermissions;
  isSystemRole?: boolean; // System roles like Super Admin cannot be deleted
  createdAt: Date;
  updatedAt: Date;
}

const RoleSchema = new Schema<IRole>(
  {
    name: { type: String, required: true, unique: true },
    description: { type: String },
    permissions: {
      dashboard: [
        {
          type: String,
          enum: ["view"],
        },
      ],
      sellerManagement: [
        {
          type: String,
          enum: [
            "view",
            "create",
            "update",
            "delete",
            "approve",
            "reject",
            "assign",
            "block",
          ],
        },
      ],
      customerManagement: [
        {
          type: String,
          enum: [
            "view",
            "create",
            "update",
            "delete",
            "approve",
            "reject",
            "assign",
            "block",
          ],
        },
      ],
      products: [
        {
          type: String,
          enum: [
            "view",
            "create",
            "update",
            "delete",
            "approve",
            "reject",
            "assign",
            "block",
          ],
        },
      ],
      reviews: [
        {
          type: String,
          enum: [
            "view",
            "create",
            "update",
            "delete",
            "approve",
            "reject",
            "assign",
            "block",
          ],
        },
      ],
      orders: [
        {
          type: String,
          enum: [
            "view",
            "create",
            "update",
            "delete",
            "approve",
            "reject",
            "assign",
            "block",
          ],
        },
      ],
      returns: [
        {
          type: String,
          enum: ["view", "create", "update", "delete", "approve", "reject"],
        },
      ],
      settlements: [
        {
          type: String,
          enum: ["view", "create", "update", "delete", "approve", "reject"],
        },
      ],
      categories: [
        {
          type: String,
          enum: [
            "view",
            "create",
            "update",
            "delete",
            "approve",
            "reject",
            "assign",
            "block",
          ],
        },
      ],
      coupons: [
        {
          type: String,
          enum: [
            "view",
            "create",
            "update",
            "delete",
            "approve",
            "reject",
            "assign",
            "block",
          ],
        },
      ],
      banners: [
        {
          type: String,
          enum: [
            "view",
            "create",
            "update",
            "delete",
            "approve",
            "reject",
            "assign",
            "block",
          ],
        },
      ],
      announcements: [
        {
          type: String,
          enum: [
            "view",
            "create",
            "update",
            "delete",
            "approve",
            "reject",
            "assign",
            "block",
          ],
        },
      ],
      blogs: [
        {
          type: String,
          enum: ["view", "create", "update", "delete", "approve", "reject"],
        },
      ],
      "promotional-emails": [
        {
          type: String,
          enum: ["view", "create", "update", "delete", "approve", "reject"],
        },
      ],
      agreements: [
        {
          type: String,
          enum: [
            "view",
            "create",
            "update",
            "delete",
            "approve",
            "reject",
            "assign",
            "block",
          ],
        },
      ],
      supportArticles: [
        {
          type: String,
          enum: [
            "view",
            "create",
            "update",
            "delete",
            "approve",
            "reject",
            "assign",
            "block",
          ],
        },
      ],
      supportChats: [
        {
          type: String,
          enum: [
            "view",
            "create",
            "update",
            "delete",
            "approve",
            "reject",
            "assign",
            "block",
          ],
        },
      ],
      supportTickets: [
        {
          type: String,
          enum: [
            "view",
            "create",
            "update",
            "delete",
            "approve",
            "reject",
            "assign",
            "block",
          ],
        },
      ],
      contactForms: [
        {
          type: String,
          enum: [
            "view",
            "create",
            "update",
            "delete",
            "approve",
            "reject",
            "assign",
            "block",
          ],
        },
      ],
      notifications: [
        {
          type: String,
          enum: [
            "view",
            "create",
            "update",
            "delete",
            "approve",
            "reject",
            "assign",
            "block",
          ],
        },
      ],
      requests: [
        {
          type: String,
          enum: [
            "view",
            "create",
            "update",
            "delete",
            "approve",
            "reject",
            "assign",
            "block",
          ],
        },
      ],
      sellerCoupons: [
        {
          type: String,
          enum: [
            "view",
            "create",
            "update",
            "delete",
            "approve",
            "reject",
            "assign",
            "block",
          ],
        },
      ],
      certificates: [
        {
          type: String,
          enum: [
            "view",
            "create",
            "update",
            "delete",
            "approve",
            "reject",
            "assign",
            "block",
          ],
        },
      ],
      systemSettings: [
        {
          type: String,
          enum: [
            "view",
            "create",
            "update",
            "delete",
            "approve",
            "reject",
            "assign",
            "block",
          ],
        },
      ],
      userManagement: [
        {
          type: String,
          enum: [
            "view",
            "create",
            "update",
            "delete",
            "approve",
            "reject",
            "assign",
            "block",
          ],
        },
      ],
      roleManagement: [
        {
          type: String,
          enum: [
            "view",
            "create",
            "update",
            "delete",
            "approve",
            "reject",
            "assign",
            "block",
          ],
        },
      ],
      feedback: [
        {
          type: String,
          enum: ["view", "create", "update", "delete", "approve", "reject"],
        },
      ],
      creditNotes: [
        {
          type: String,
          enum: ["view", "create", "update", "delete", "approve", "reject"],
        },
      ],
      settlementInvoices: [
        {
          type: String,
          enum: ["view", "create", "update", "delete", "approve", "reject"],
        },
      ],
      auditLogs: [
        {
          type: String,
          enum: ["view"],
        },
      ],
      reports: [
        {
          type: String,
          enum: ["view"],
        },
      ],
      sellerDeactivationRequests: [
        {
          type: String,
          enum: ["view", "approve", "reject"],
        },
      ],
    },
    isSystemRole: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Index for faster lookups
RoleSchema.index({ name: 1 });

export default mongoose.model<IRole>("Role", RoleSchema);
