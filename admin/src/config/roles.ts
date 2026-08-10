import type { Rule } from "antd/es/form";
import type { ModulePermissions, Permission } from "../api/roles";

/**
 * Module configuration with display labels
 */
export const MODULE_NAMES: Array<{
  key: keyof ModulePermissions;
  label: string;
  /** If true, this module only supports 'view' permission */
  viewOnly?: boolean;
}> = [
  { key: "dashboard", label: "Dashboard", viewOnly: true },
  { key: "sellerManagement", label: "Seller Management" },
  { key: "customerManagement", label: "Customer Management" },
  { key: "products", label: "Products" },
  { key: "reviews", label: "Review Moderation" },
  { key: "orders", label: "Orders" },
  { key: "returns", label: "Returns" },
  { key: "settlements", label: "Settlements" },
  { key: "categories", label: "Categories" },
  { key: "coupons", label: "Coupons" },
  { key: "sellerCoupons", label: "Seller Coupons" },
  { key: "banners", label: "Banners" },
  { key: "blogs", label: "Blogs" },
  { key: "promotional-emails", label: "Promotional Emails" },
  { key: "agreements", label: "Terms & Agreements" },
  { key: "supportArticles", label: "Support Articles" },
  { key: "supportChats", label: "Support Chats" },
  { key: "supportTickets", label: "Support Tickets" },
  { key: "contactForms", label: "Contact Forms" },
  { key: "feedback", label: "User Feedback", viewOnly: true },
  { key: "notifications", label: "Notifications" },
  { key: "requests", label: "Category Requests" },
  { key: "certificates", label: "Certificates" },
  { key: "systemSettings", label: "System Settings" },
  { key: "userManagement", label: "User Management" },
  { key: "roleManagement", label: "Role Management" },
  { key: "creditNotes", label: "Credit Notes" },
  { key: "settlementInvoices", label: "Settlement Invoices" },
  { key: "auditLogs", label: "Finance Audit Logs", viewOnly: true },
  { key: "reports", label: "Reports & Compliance", viewOnly: true },
  { key: "sellerDeactivationRequests", label: "Seller Deactivation Requests" },
];

/**
 * Available permission types
 */
export const PERMISSIONS: Permission[] = [
  "view",
  "create",
  "update",
  "delete",
  "approve",
  "reject",
  "assign",
  "block",
];

/**
 * Color mapping for permission tags
 */
export const PERMISSION_COLORS: Record<Permission, string> = {
  view: "blue",
  create: "green",
  update: "orange",
  delete: "red",
  approve: "cyan",
  reject: "purple",
  assign: "geekblue",
  block: "volcano",
};

/**
 * Form validation rules
 */
export const ROLE_FORM_RULES: {
  name: Rule[];
  description: Rule[];
} = {
  name: [
    { required: true, message: "Please enter role name" },
    { min: 2, message: "Role name must be at least 2 characters" },
    { max: 50, message: "Role name must not exceed 50 characters" },
  ],
  description: [
    { max: 500, message: "Description must not exceed 500 characters" },
  ],
};

/**
 * UI Configuration
 */
export const ROLE_UI_CONFIG = {
  drawerWidth: 600,
  tableScrollX: 1000,
  permissionsMaxHeight: "calc(100vh - 300px)",
  maxDescriptionLength: 500,
} as const;
