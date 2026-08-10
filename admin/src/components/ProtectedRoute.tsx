import { type ReactNode, useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { usePermissions } from "../api/permissions";
import { useAuthStore } from "../store/authStore";
import { isRouteAccessible } from "../utils/permissions";
import LoadingState from "./LoadingState";
import Unauthorized from "../pages/Unauthorized";

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: string;
  requiredModule?: keyof import("../api/roles").ModulePermissions;
  requiredPermission?: import("../api/roles").Permission;
}

const ProtectedRoute = ({
  children,
  requiredRole,
  requiredModule,
  requiredPermission = "view",
}: ProtectedRouteProps) => {
  const token = useAuthStore((state) => state.token);
  const role = useAuthStore((state) => state.role);
  const permissions = useAuthStore((state) => state.permissions);
  const setPermissions = useAuthStore((state) => state.setPermissions);
  const location = useLocation();

  // Fetch permissions if not already loaded
  const { data: fetchedPermissions, isLoading: isLoadingPermissions } =
    usePermissions();

  // Update store when permissions are fetched
  useEffect(() => {
    if (fetchedPermissions && !permissions) {
      setPermissions(fetchedPermissions);
    }
  }, [fetchedPermissions, permissions, setPermissions]);

  // Not logged in → redirect to login
  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Wait for permissions to load (unless super-admin who doesn't need them)
  const effectivePermissions = permissions || fetchedPermissions;
  if (role !== "super-admin" && !effectivePermissions && isLoadingPermissions) {
    return <LoadingState />;
  }

  // Role-based protection
  if (requiredRole && role !== requiredRole) {
    return <Unauthorized />;
  }

  // Permission-based protection
  if (requiredModule) {
    const module = requiredModule;

    // Super admin has all permissions
    if (role !== "super-admin") {
      if (!effectivePermissions) {
        // Permissions not loaded yet, wait
        return <LoadingState />;
      }

      const modulePermissions = effectivePermissions?.[module] ?? [];
      if (
        !modulePermissions ||
        !modulePermissions.includes(requiredPermission)
      ) {
        return <Unauthorized />;
      }
    }
  }

  // Route-based permission check
  const currentPath = location.pathname;
  if (
    role !== "super-admin" &&
    !isRouteAccessible(effectivePermissions ?? null, currentPath)
  ) {
    return <Unauthorized />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
