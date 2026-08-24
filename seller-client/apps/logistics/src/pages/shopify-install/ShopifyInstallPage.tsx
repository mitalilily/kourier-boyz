import { Box, Card, CircularProgress, Stack, Typography } from '@mui/material'
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from '../../components/UI/Toast'
import { useAuth } from '../../context/auth/AuthContext'
import {
  auditShopifyInstall,
  exchangeShopifyBootstrap,
  exchangeShopifySession,
  startPublicShopifyOAuth,
  startShopifyOAuth,
} from '../../api/integrations'
import { getShopifyIdToken } from '../../utils/shopifyAppBridge'
import { isEmbeddedShopifyContext } from '../../utils/shopifyEmbedded'

const normalizeShopifyStoreUrl = (value?: string) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '')
    .replace(/\/admin(?:\/.*)?$/, '')

const sanitizeNextPath = (value?: string) =>
  String(value || '').trim().startsWith('/') ? String(value || '').trim() : '/channels/connected'

type ApiError = {
  message?: string
  response?: { status?: number; data?: { error?: string; message?: string } }
}

const getAuditFailureDetail = (error: ApiError) => {
  const status = Number(error.response?.status)
  if (Number.isFinite(status) && status > 0) return `http_${status}`
  if (String(error.message || '').toLowerCase().includes('app bridge')) return 'app_bridge_unavailable'
  return 'client_error'
}

const ShopifyInstallPage = () => {
  const { isAuthenticated, loading, setTokens } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const handledRef = useRef(false)
  const [status, setStatus] = useState<'idle' | 'starting' | 'exchanging' | 'error'>('idle')
  const [message, setMessage] = useState('Preparing Shopify connection...')

  useEffect(() => {
    if (loading || handledRef.current) return

    const params = new URLSearchParams(location.search)
    const bootstrap = params.get('bootstrap') || ''
    const shop = normalizeShopifyStoreUrl(params.get('shop') || '')
    const host = params.get('host') || ''
    const shopifyStatus = params.get('shopify') || ''
    const next = sanitizeNextPath(params.get('next') || '/channels/connected')
    const fallbackMessage =
      shopifyStatus === 'error' ? params.get('message') || 'Shopify connection failed' : params.get('message') || ''

    if (bootstrap) {
      handledRef.current = true
      setStatus('exchanging')
      setMessage('Finalizing your Shopify install...')
      void auditShopifyInstall({ event: 'bootstrap_exchange_started', shop })

      exchangeShopifyBootstrap({ bootstrap })
        .then((result) => {
          setTokens(result.accessToken, result.refreshToken)
          const landing = new URL(next, window.location.origin)
          landing.searchParams.set('shopify', 'connected')
          if (result.shop) landing.searchParams.set('shop', result.shop)
          landing.searchParams.set('message', 'Shopify connected successfully')
          void auditShopifyInstall({ event: 'install_ui_completed', shop: result.shop || shop })
          navigate(`${landing.pathname}${landing.search}`, { replace: true })
        })
        .catch((error: unknown) => {
          const apiError = error as ApiError
          const errorMessage = apiError?.response?.data?.error || apiError?.message || 'Failed to finalize Shopify install'
          void auditShopifyInstall({
            event: 'install_ui_failed',
            shop,
            detail: getAuditFailureDetail(apiError),
          })
          setStatus('error')
          setMessage(errorMessage)
          toast.open({ message: errorMessage, severity: 'error' })
        })

      return
    }

    if (shopifyStatus === 'connected') {
      handledRef.current = true
      toast.open({
        message: fallbackMessage || 'Shopify connected successfully',
        severity: 'success',
      })

      const landing = new URL(next, window.location.origin)
      landing.searchParams.set('shopify', 'connected')
      if (shop) landing.searchParams.set('shop', shop)
      landing.searchParams.set('message', fallbackMessage || 'Shopify connected successfully')
      navigate(`${landing.pathname}${landing.search}`, { replace: true })
      return
    }

    if (shopifyStatus === 'error') {
      handledRef.current = true
      const errorMessage = fallbackMessage || 'Shopify connection failed'
      setStatus('error')
      setMessage(errorMessage)
      if (shop) {
        void auditShopifyInstall({ event: 'install_ui_failed', shop, detail: 'redirected_error' })
      }
      toast.open({ message: errorMessage, severity: 'error' })
      return
    }

    if ((shop && host) || isEmbeddedShopifyContext()) {
      handledRef.current = true
      setStatus('exchanging')
      setMessage('Securing your Shopify connection...')
      void auditShopifyInstall({ event: 'install_page_opened', shop })
      void auditShopifyInstall({ event: 'app_bridge_started', shop })

      getShopifyIdToken()
        .then((sessionToken) => {
          void auditShopifyInstall({ event: 'id_token_acquired', shop })
          void auditShopifyInstall({ event: 'session_exchange_started', shop })
          return exchangeShopifySession(sessionToken)
        })
        .then((result) => {
          if (!result?.bootstrap) throw new Error('Shopify install could not be finalized')
          void auditShopifyInstall({ event: 'bootstrap_exchange_started', shop })
          return exchangeShopifyBootstrap({ bootstrap: result.bootstrap })
        })
        .then((result) => {
          setTokens(result.accessToken, result.refreshToken)
          const landing = new URL(next, window.location.origin)
          landing.searchParams.set('shopify', 'connected')
          landing.searchParams.set('shop', result.shop || shop)
          landing.searchParams.set('host', host)
          landing.searchParams.set('embedded', '1')
          landing.searchParams.set('message', 'Shopify connected successfully')
          void auditShopifyInstall({ event: 'install_ui_completed', shop: result.shop || shop })
          navigate(`${landing.pathname}${landing.search}`, { replace: true })
        })
        .catch((error: unknown) => {
          const apiError = error as ApiError
          const errorMessage =
            apiError?.response?.data?.error || apiError?.message || 'Failed to finalize Shopify install'
          void auditShopifyInstall({
            event: 'install_ui_failed',
            shop,
            detail: getAuditFailureDetail(apiError),
          })
          setStatus('error')
          setMessage(errorMessage)
          toast.open({ message: errorMessage, severity: 'error' })
        })
      return
    }

    if (!shop) {
      setStatus('error')
      setMessage('Missing Shopify store domain.')
      toast.open({
        message: 'Missing Shopify store domain.',
        severity: 'error',
      })
      return
    }

    handledRef.current = true
    setStatus('starting')
    setMessage('Opening Shopify authorization...')

    const returnTo = `/shopify/install?next=${encodeURIComponent(next)}`
    const startRequest = isAuthenticated
      ? startShopifyOAuth({ shop, returnTo })
      : startPublicShopifyOAuth({ shop, returnTo })

    startRequest
      .then((result) => {
        const authUrl = result?.authUrl || result?.data?.authUrl
        if (!authUrl) {
          throw new Error('Shopify authorization URL was not returned')
        }
        window.location.assign(authUrl)
      })
      .catch((error: unknown) => {
        const apiError = error as ApiError
        const errorMessage =
          apiError?.response?.data?.error ||
          apiError?.response?.data?.message ||
          apiError?.message ||
          'Error starting Shopify connection'
        setStatus('error')
        setMessage(errorMessage)
        toast.open({ message: errorMessage, severity: 'error' })
      })
  }, [isAuthenticated, loading, location.search, navigate, setTokens])

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        px: 2,
        background: 'radial-gradient(circle at top, rgba(232,85,0,0.16) 0%, transparent 36%), linear-gradient(180deg, #0f1115 0%, #17181d 100%)',
        color: '#fff',
      }}
    >
      <Card
        elevation={0}
        sx={{
          width: '100%',
          maxWidth: 680,
          borderRadius: 4,
          p: { xs: 3, md: 4 },
          border: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(255,255,255,0.06)',
          backdropFilter: 'blur(18px)',
          color: 'inherit',
        }}
      >
        <Stack spacing={2.5} alignItems="center" textAlign="center">
          <Box
            component="img"
            src="/brand/kourier-boyz-logo.png"
            alt="Kourier Boyz"
            sx={{ width: 140, height: 'auto' }}
          />
          <Box>
            <Typography sx={{ fontSize: '0.78rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.68)', fontWeight: 800 }}>
              Shopify install
            </Typography>
            <Typography sx={{ mt: 1, fontWeight: 800, fontSize: { xs: '1.5rem', md: '1.9rem' } }}>
              {status === 'error' ? 'Install needs attention' : 'Connecting your Shopify store'}
            </Typography>
            <Typography sx={{ mt: 1, color: 'rgba(255,255,255,0.72)', lineHeight: 1.7 }}>
              {message}
            </Typography>
          </Box>
          <Box
            sx={{
              width: '100%',
              display: 'flex',
              justifyContent: 'center',
              pt: 1,
            }}
          >
            {status === 'error' ? null : <CircularProgress sx={{ color: '#B78115' }} />}
          </Box>
        </Stack>
      </Card>
    </Box>
  )
}

export default ShopifyInstallPage
