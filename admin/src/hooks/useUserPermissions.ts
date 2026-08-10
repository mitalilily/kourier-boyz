import { useMemo } from "react";
import type { ModulePermissions, Permission, Role } from "../api/roles";
import { MODULE_DISPLAY_NAMES } from "../config/userManagement";

/**
 * Calculate aggregated permissions from user roles
 * Memoized for performance
 */
export const useUserPermissions = (
  userRoles: Role[] | undefined,
  userRole: string
): ModulePermissions | null => {
  return useMemo(() => {
    if (!userRoles || userRoles.length === 0) {
      // Super admin has all permissions
      if (userRole === "super-admin") {
        const allPerms: ModulePermissions = {};
        const allPermissionTypes: Permission[] = [
          "view",
          "create",
          "update",
          "delete",
          "approve",
          "reject",
          "assign",
          "block",
        ];
        
        Object.keys(MODULE_DISPLAY_NAMES).forEach((module) => {
          allPerms[module as keyof ModulePermissions] = allPermissionTypes;
        });
        
        return allPerms;
      }
      return null;
    }

    const permissions: ModulePermissions = {};

    // Aggregate permissions from all roles
    userRoles.forEach((role) => {
      if (role.permissions) {
        Object.entries(role.permissions).forEach(([module, perms]) => {
          if (perms && perms.length > 0) {
            if (!permissions[module as keyof ModulePermissions]) {
              permissions[module as keyof ModulePermissions] = [];
            }
            const existing =
              permissions[module as keyof ModulePermissions] || [];
            const newPerms = perms.filter(
              (p: Permission) => !existing.includes(p)
            );
            permissions[module as keyof ModulePermissions] = [
              ...existing,
              ...newPerms,
            ] as typeof perms;
          }
        });
      }
    });

    // Super admin has all permissions
    if (userRole === "super-admin") {
      const allPerms: ModulePermissions = {};
      const allPermissionTypes: Permission[] = [
        "view",
        "create",
        "update",
        "delete",
        "approve",
        "reject",
        "assign",
        "block",
      ];
      
      Object.keys(MODULE_DISPLAY_NAMES).forEach((module) => {
        allPerms[module as keyof ModulePermissions] = allPermissionTypes;
      });
      
      return allPerms;
    }

    return permissions;
  }, [userRoles, userRole]);
};

