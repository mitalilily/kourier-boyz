import User from "../models/User";
import Role, { IModulePermissions, Permission } from "../models/Role";
import UserRole from "../models/UserRole";

// Re-export types for use in other modules
export type { Permission, IModulePermissions } from "../models/Role";

export type ModuleName =
  | "dashboard"
  | "sellerManagement"
  | "customerManagement"
  | "products"
  | "reviews"
  | "orders"
  | "returns"
  | "settlements"
  | "categories"
  | "coupons"
  | "banners"
  | "announcements"
  | "blogs"
  | "promotional-emails"
  | "agreements"
  | "supportArticles"
  | "supportChats"
  | "supportTickets"
  | "contactForms"
  | "notifications"
  | "requests"
  | "sellerCoupons"
  | "certificates"
  | "systemSettings"
  | "userManagement"
  | "roleManagement"
  | "feedback"
  | "creditNotes"
  | "settlementInvoices"
  | "auditLogs"
  | "reports"
  | "sellerDeactivationRequests";

/**
 * Get all permissions for a user by aggregating all their roles
 */
export const getUserPermissions = async (
  userId: string
): Promise<IModulePermissions> => {
  // Get all user roles
  const userRoles = await UserRole.find({ userId }).populate("roleId");
  const roles = userRoles.map((ur) => ur.roleId as any).filter(Boolean);

  // Check if user is super-admin
  const user = await User.findById(userId);
  if (user?.role === "super-admin") {
    // Super admin has all permissions
    return getAllPermissions();
  }

  // Users with 'user' role get permissions from assigned roles (handled below)

  // Aggregate permissions from all roles
  const aggregatedPermissions: IModulePermissions = {};

  for (const role of roles) {
    if (role.permissions) {
      for (const [module, permissions] of Object.entries(role.permissions)) {
        if (
          permissions &&
          Array.isArray(permissions) &&
          permissions.length > 0
        ) {
          if (!aggregatedPermissions[module as keyof IModulePermissions]) {
            aggregatedPermissions[module as keyof IModulePermissions] = [];
          }
          // Merge permissions, avoiding duplicates
          const existing =
            aggregatedPermissions[module as keyof IModulePermissions] || [];
          const newPerms = permissions.filter((p) => !existing.includes(p));
          aggregatedPermissions[module as keyof IModulePermissions] = [
            ...existing,
            ...newPerms,
          ] as Permission[];
        }
      }
    }
  }

  return aggregatedPermissions;
};

/**
 * Check if user has a specific permission for a module
 */
export const hasPermission = async (
  userId: string,
  module: ModuleName,
  permission: Permission
): Promise<boolean> => {
  try {
    // Always check super-admin first (most common case for admin routes)
    const user = await User.findById(userId).select('role');
    
    if (!user) {
      console.error('[hasPermission] User not found:', { userId });
      return false;
    }
    
    // Super admin has ALL permissions - return immediately
    if (user.role === "super-admin") {
      return true;
    }

    // For non-super-admin users, check their actual permissions
    const userPermissions = await getUserPermissions(userId);
    const modulePermissions = userPermissions[module] || [];
    return modulePermissions.includes(permission);
  } catch (error) {
    console.error('[hasPermission] Error checking permission:', {
      userId,
      module,
      permission,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
};

/**
 * Check if user has any of the specified permissions for a module
 */
export const hasAnyPermission = async (
  userId: string,
  module: ModuleName,
  permissions: Permission[]
): Promise<boolean> => {
  const user = await User.findById(userId);

  // Super admin has all permissions
  if (user?.role === "super-admin") {
    return true;
  }

  const userPermissions = await getUserPermissions(userId);
  const modulePermissions = userPermissions[module] || [];
  return permissions.some((perm) => modulePermissions.includes(perm));
};

/**
 * Get all permissions (for super admin)
 * Each module gets the maximum permissions allowed by its schema
 */
const getAllPermissions = (): IModulePermissions => {
  const allPerms: Permission[] = [
    "view",
    "create",
    "update",
    "delete",
    "approve",
    "reject",
    "assign",
    "block",
  ];
  
  const basicPerms: Permission[] = ["view", "create", "update", "delete", "approve", "reject"];
  const viewOnlyPerms: Permission[] = ["view"];
  const deactivationPerms: Permission[] = ["view", "approve", "reject"];

  return {
    dashboard: ["view"], // Dashboard is view-only
    sellerManagement: allPerms,
    customerManagement: allPerms,
    products: allPerms,
    reviews: allPerms,
    orders: allPerms,
    returns: basicPerms,
    settlements: basicPerms,
    categories: allPerms,
    coupons: allPerms,
    banners: allPerms,
    announcements: allPerms,
    blogs: basicPerms,
    "promotional-emails": basicPerms,
    agreements: allPerms,
    supportArticles: allPerms,
    supportChats: allPerms,
    supportTickets: allPerms,
    contactForms: allPerms,
    notifications: allPerms,
    requests: allPerms,
    sellerCoupons: allPerms,
    certificates: allPerms,
    systemSettings: allPerms,
    userManagement: allPerms,
    roleManagement: allPerms,
    feedback: basicPerms,
    creditNotes: basicPerms,
    settlementInvoices: basicPerms,
    auditLogs: viewOnlyPerms,
    reports: viewOnlyPerms,
    sellerDeactivationRequests: deactivationPerms,
  };
};

/**
 * Get all users who have a specific permission for a module
 */
export const getUsersWithPermission = async (
  module: ModuleName,
  permission: Permission
): Promise<any[]> => {
  // Get all users with 'user' role (non-super-admin admin users)
  const adminUsers = await User.find({ role: "user" }).select(
    "_id name email role"
  );

  // Also include super-admins (they have all permissions)
  const superAdmins = await User.find({ role: "super-admin" }).select(
    "_id name email role"
  );

  const usersWithPermission: any[] = [];

  // Add super-admins (they have all permissions)
  usersWithPermission.push(...superAdmins.map((u) => u.toObject()));

  // Check each admin user for the permission
  for (const user of adminUsers) {
    const userId = String(user._id);
    const hasPerm = await hasPermission(userId, module, permission);
    if (hasPerm) {
      usersWithPermission.push(user.toObject());
    }
  }

  return usersWithPermission;
};
