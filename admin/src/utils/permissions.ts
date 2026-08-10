import type { ModulePermissions, Permission } from "../api/roles";
import { useAuthStore } from "../store/authStore";

// Map routes to module names
export const routeToModuleMap: Record<string, keyof ModulePermissions> = {
  "/dashboard": "dashboard",
  "/users": "userManagement",
  "/sellers": "sellerManagement",
  "/customers": "customerManagement",
  "/roles": "roleManagement",
  "/products": "products",
  "/reviews": "reviews",
  "/orders": "orders",
  "/returns": "returns",
  "/categories": "categories",
  "/coupons": "coupons",
  "/banners": "banners",
  "/blogs": "blogs",
  "/promotional-emails": "promotional-emails",
  "/agreements": "agreements",
  "/support/articles": "supportArticles",
  "/support/chats": "supportChats",
  "/support/tickets": "supportTickets",
  "/support/contact": "contactForms",
  "/notifications": "notifications",
  "/requests": "requests",
  "/brand-approvals": "requests",
  "/category-extensions": "requests",
  "/seller-coupons": "sellerCoupons",
  "/feedback": "feedback",
  "/guide": "dashboard", // Guide is accessible with dashboard view permission
  "/settlements": "settlements",
  "/settlements/credit-notes": "creditNotes",
  "/settlements/invoices": "settlementInvoices",
  "/settlements/audit-logs": "auditLogs",
  "/reports/sales": "reports",
  "/reports/settlement-due": "reports",
  "/reports/portal-income": "reports",
  "/reports/courier-charges": "reports",
  "/reports/tds": "reports",
  "/reports/tcs": "reports",
  "/reports/sales-pending-status": "reports",
  "/reports/new-sellers": "reports",
  "/reports/tickets": "reports",
  "/sellers/deactivation-requests": "sellerDeactivationRequests",
  "/settings": "systemSettings",
  "/settings/settlement": "systemSettings",
  "/webhooks": "auditLogs",
};

/**
 * Check if user has permission for a module
 */
export const hasModulePermission = (
  permissions: ModulePermissions | null,
  module: keyof ModulePermissions,
  requiredPermission: Permission = "view"
): boolean => {
  // Super admin has all permissions
  const role = useAuthStore.getState().role;
  if (role === "super-admin") {
    return true;
  }

  if (!permissions) {
    return false;
  }

  const modulePermissions = permissions[module];
  if (!modulePermissions || modulePermissions.length === 0) {
    return false;
  }

  return modulePermissions.includes(requiredPermission);
};

/**
 * Check if user has any of the specified permissions for a module
 */
export const hasAnyModulePermission = (
  permissions: ModulePermissions | null,
  module: keyof ModulePermissions,
  requiredPermissions: Permission[]
): boolean => {
  // Super admin has all permissions
  const role = useAuthStore.getState().role;
  if (role === "super-admin") {
    return true;
  }

  if (!permissions) {
    return false;
  }

  const modulePermissions = permissions[module];
  if (!modulePermissions || modulePermissions.length === 0) {
    return false;
  }

  return requiredPermissions.some((perm) => modulePermissions.includes(perm));
};

/**
 * Check if a route is accessible based on permissions
 */
export const isRouteAccessible = (
  permissions: ModulePermissions | null,
  route: string
): boolean => {
  // Super admin has access to all routes
  const role = useAuthStore.getState().role;
  if (role === "super-admin") {
    return true;
  }

  // Dashboard is always accessible
  if (route === "/dashboard" || route === "/") {
    return true;
  }

  // Find matching module for route (exact match first)
  let module = routeToModuleMap[route];

  // If no exact match, try to find base route (for nested routes like /sellers/:id)
  if (!module) {
    // Extract base path (e.g., /sellers/:id -> /sellers)
    const basePath = route.split("/").slice(0, 2).join("/");
    module = routeToModuleMap[basePath];
  }

  // If still no match, check if it's a nested route of a known module
  if (!module) {
    // Check if route starts with any known route
    for (const [knownRoute, knownModule] of Object.entries(routeToModuleMap)) {
      if (route.startsWith(knownRoute)) {
        module = knownModule;
        break;
      }
    }
  }

  if (!module) {
    // If route is not in map, allow access (for unknown routes)
    return true;
  }

  return hasModulePermission(permissions, module, "view");
};

/**
 * Hook to check if current user has permission for a module
 * @deprecated Use useModulePermissions hook instead for better performance
 */
export const useHasPermission = (
  module: keyof ModulePermissions,
  requiredPermission: Permission = "view"
): boolean => {
  const permissions = useAuthStore((state) => state.permissions);
  return hasModulePermission(permissions, module, requiredPermission);
};

/**
 * Hook to check if a route is accessible
 */
export const useIsRouteAccessible = (route: string): boolean => {
  const permissions = useAuthStore((state) => state.permissions);
  return isRouteAccessible(permissions, route);
};
