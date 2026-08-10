import type { ModulePermissions, Permission, Role } from "../api/roles";
import { MODULE_NAMES, PERMISSION_COLORS, PERMISSIONS } from "../config/roles";

/**
 * Type for role form values
 * Includes base fields and dynamic permission fields for each module
 */
export interface RoleFormValues {
  name: string;
  description?: string;
  [key: `permissions_${string}`]: Permission[] | undefined;
}

/**
 * Transform permissions object to form field format
 * Converts { dashboard: ['view', 'create'] } to { permissions_dashboard: ['view', 'create'] }
 */
export const transformPermissionsToFormFields = (
  permissions: ModulePermissions
): Record<string, Permission[]> => {
  const formFields: Record<string, Permission[]> = {};
  MODULE_NAMES.forEach((module) => {
    const modulePerms = permissions[module.key];
    if (modulePerms && modulePerms.length > 0) {
      formFields[`permissions_${module.key}`] = modulePerms;
    }
  });
  return formFields;
};

/**
 * Transform form fields back to permissions object
 * Converts { permissions_dashboard: ['view', 'create'] } to { dashboard: ['view', 'create'] }
 */
export const transformFormFieldsToPermissions = (
  formValues: RoleFormValues | Record<string, unknown>
): ModulePermissions => {
  const permissions: ModulePermissions = {};
  MODULE_NAMES.forEach((module) => {
    const fieldName = `permissions_${module.key}`;
    const modulePerms = (formValues as Record<string, unknown>)[fieldName];

    if (
      Array.isArray(modulePerms) &&
      modulePerms.length > 0 &&
      modulePerms.every(
        (p): p is Permission =>
          typeof p === "string" && PERMISSIONS.includes(p as Permission)
      )
    ) {
      permissions[module.key] = modulePerms;
    }
  });
  return permissions;
};

export const formatPermission = (perm: Permission): string => {
  return perm.charAt(0).toUpperCase() + perm.slice(1);
};

export const getPermissionColor = (perm: Permission): string => {
  return PERMISSION_COLORS[perm] || "default";
};

export const getPermissionsSummary = (role: Role): string => {
  const modules = Object.keys(role.permissions || {}).filter(
    (key) =>
      (role.permissions?.[key as keyof ModulePermissions]?.length ?? 0) > 0
  );

  if (modules.length === 0) return "No permissions";

  const totalPerms = Object.values(role.permissions || {}).reduce(
    (sum, perms) => sum + (perms?.length || 0),
    0
  );

  return `${modules.length} module${
    modules.length !== 1 ? "s" : ""
  } • ${totalPerms} permission${totalPerms !== 1 ? "s" : ""}`;
};

export const getModulesWithPermissions = (role: Role): string[] => {
  return Object.keys(role.permissions || {}).filter(
    (key) =>
      (role.permissions?.[key as keyof ModulePermissions]?.length ?? 0) > 0
  );
};
