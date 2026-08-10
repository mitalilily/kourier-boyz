import type { Rule } from "antd/es/form";

/**
 * User role configuration
 */
export const USER_ROLES = [
  { value: "user", label: "Admin User" },
  { value: "customer", label: "Customer" },
  { value: "seller", label: "Seller" },
  { value: "super-admin", label: "Super Admin" },
] as const;

/**
 * Role color mapping for tags
 */
export const ROLE_COLORS: Record<string, string> = {
  "super-admin": "red",
  user: "blue",
  customer: "green",
  seller: "orange",
} as const;

/**
 * Form validation rules
 */
export const USER_FORM_RULES: {
  name: Rule[];
  email: Rule[];
  password: Rule[];
  role: Rule[];
  roleIds: Rule[];
} = {
  name: [{ required: true, message: "Please enter user's full name" }],
  email: [
    { required: true, message: "Please enter email address" },
    { type: "email", message: "Please enter a valid email" },
  ],
  password: [
    { required: true, message: "Please enter password" },
    { min: 8, message: "Password must be at least 8 characters" },
  ],
  role: [{ required: true, message: "Please select a user role" }],
  roleIds: [
    {
      required: true,
      message: "Please assign at least one role to this user",
    },
    {
      type: "array",
      min: 1,
      message: "Please select at least one role",
    },
  ],
};

/**
 * UI Configuration
 */
export const USER_MANAGEMENT_UI_CONFIG = {
  modalWidths: {
    create: 600,
    assignRoles: 700,
    viewPermissions: 900,
  },
  table: {
    scrollX: 1200,
    pageSizeOptions: ["10", "20", "50", "100"],
  },
  statsCard: {
    gradient: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  },
} as const;

/**
 * Module names for permissions display
 */
export const MODULE_DISPLAY_NAMES: Record<string, string> = {
  dashboard: "Dashboard",
  sellerManagement: "Seller Management",
  customerManagement: "Customer Management",
  products: "Products",
  reviews: "Review Moderation",
  orders: "Orders",
  categories: "Categories",
  coupons: "Coupons",
  banners: "Banners",
  agreements: "Terms & Agreements",
  supportArticles: "Support Articles",
  supportChats: "Support Chats",
  contactForms: "Contact Forms",
  notifications: "Notifications",
  requests: "Category Requests",
  sellerCoupons: "Seller Coupons",
  certificates: "Certificates",
  systemSettings: "System Settings",
  userManagement: "User Management",
  roleManagement: "Role Management",
} as const;

