// components/auth/RequireAuth.tsx
import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import FullScreenLoader from "../../UI/loader/FullScreenLoader";
import { useAuth } from "../../../context/auth/AuthContext";
import {
  buildShopifyInstallPath,
  isEmbeddedShopifyContext,
} from "../../../utils/shopifyEmbedded";

export default function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullScreenLoader />; // or global spinner
  if (!isAuthenticated) {
    if (isEmbeddedShopifyContext()) {
      return <Navigate to={buildShopifyInstallPath(location.pathname)} replace />;
    }
    // bounce user to login, keep the page they wanted
    return <Navigate to="/" state={{ from: location }} replace />;
  }
  return children;
}
