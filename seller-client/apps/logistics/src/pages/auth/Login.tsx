// pages/auth/Login.tsx
import { Box, CircularProgress, Typography } from '@mui/material'
import { Navigate, useLocation } from "react-router-dom";
import LoginForm from "../../components/auth/LoginForm";
import { useAuth } from "../../context/auth/AuthContext";

export default function Login() {
  const { isAuthenticated, user, loading } = useAuth();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const shop = String(params.get('shop') || '').trim();
  const isShopifyInstall = params.get('shopifyInstall') === '1';
  const from = (location.state as {
    from?: { pathname?: string; search?: string; hash?: string }
  } | null)?.from;
  const returnTo =
    from?.pathname && from.pathname !== "/"
      ? `${from.pathname}${from.search || ""}${from.hash || ""}`
      : "/home";

  if (loading) {
    return (
      <Box sx={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', bgcolor: '#f5f6f4' }}>
        <Box sx={{ textAlign: 'center' }}>
          <CircularProgress size={34} sx={{ color: '#B78115' }} />
          <Typography sx={{ mt: 2, color: '#626966', fontWeight: 700, fontSize: '0.85rem' }}>
            Opening your Kourier Boyz console
          </Typography>
        </Box>
      </Box>
    )
  }

  if (shop || isShopifyInstall) {
    const nextParams = new URLSearchParams()
    nextParams.set('shopifyInstall', '1')
    if (shop) nextParams.set('shop', shop)
    if (params.get('host')) nextParams.set('host', String(params.get('host') || ''))
    return <Navigate to={`/shopify/install?${nextParams.toString()}`} replace />
  }

  if (isAuthenticated) {
    // not finished onboarding → push them to questions
    if (!user?.onboardingComplete) {
      return <Navigate to="/onboarding-questions" replace />;
    }
    // fully onboarded → straight to dashboard
    return <Navigate to={returnTo} replace />;
  }

  // unauthenticated → show the actual login form
  return <LoginForm />;
}
