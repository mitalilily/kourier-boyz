import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { SiShopify } from 'react-icons/si'
import { useNavigate } from 'react-router-dom'
import { getUserStoreIntegrations } from '../../api/integrations'
import { useAuth } from '../../context/auth/AuthContext'
import { useStartShopifyOAuth } from '../../hooks/useIntegrations'

interface IShopifyIntegrationProps {
  fullWidth?: boolean
  forOnboarding?: boolean
  fromChannelList?: boolean
}

export interface ShopifyForm {
  storeUrl: string
  apiKey?: string
  webhookSecret?: string
  name?: string
  adminApiAccessToken?: string
  hostName?: string
  domain?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: any
  userId?: string
  status?: 'active' | 'inactive'
  settings?: {
    fulfillTrigger?: string
    customerNotifyOnFulfill?: string
    orderTagsToFetch?: string
    codTags?: string
    prepaidTags?: string
    autoUpdateShipmentStatus?: boolean
    autoCancelOrders?: boolean
    markCodPaidOnDelivery?: boolean
  }
}

const normalizeShopifyDomain = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .split('/')[0]

const getApiErrorMessage = (error: unknown) => {
  const apiError = error as {
    response?: { data?: { error?: string; message?: string } }
    message?: string
  }
  return apiError?.response?.data?.error || apiError?.response?.data?.message || apiError?.message || 'Unable to start Shopify connection'
}

export default function ShopifyIntegration({ fullWidth }: IShopifyIntegrationProps) {
  const { user, refetchUser } = useAuth()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const isConnected = Boolean(user?.salesChannels?.shopify)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [storeDomain, setStoreDomain] = useState('')
  const [error, setError] = useState('')
  const { mutate: startShopifyOAuth, isPending } = useStartShopifyOAuth()
  const connectionWindowRef = useRef<Window | null>(null)
  const connectionPollRef = useRef<number | null>(null)

  const stopConnectionPolling = () => {
    if (connectionPollRef.current !== null) {
      window.clearTimeout(connectionPollRef.current)
      connectionPollRef.current = null
    }
  }

  useEffect(
    () => () => {
      stopConnectionPolling()
      connectionWindowRef.current?.close()
    },
    [],
  )

  const handleShopifyAction = () => {
    if (isConnected) {
      navigate('/channels/connected')
      return
    }

    setError('')
    setDialogOpen(true)
  }

  const handleConnect = () => {
    const shop = normalizeShopifyDomain(storeDomain)
    if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop)) {
      setError('Enter a valid myshopify.com store domain')
      return
    }

    const connectionWindow = window.open('about:blank', 'kourier-boyz-shopify-connect')
    if (!connectionWindow) {
      setError('Allow pop-ups for Kourier Boyz, then try again')
      return
    }

    connectionWindowRef.current = connectionWindow
    setError('')
    startShopifyOAuth(
      { shop, returnTo: '/channels/connected' },
      {
        onSuccess: (result) => {
          const authUrl = String(result?.authUrl || result?.data?.authUrl || '').trim()
          if (!authUrl) {
            connectionWindow.close()
            setError('Shopify authorization URL was not returned')
            return
          }

          connectionWindow.location.replace(authUrl)
          const startedAt = Date.now()
          const pollForConnection = async () => {
            try {
              const stores = await getUserStoreIntegrations()
              const connected = stores.some(
                (store) => normalizeShopifyDomain(store.domain) === shop,
              )
              if (connected) {
                stopConnectionPolling()
                connectionWindow.close()
                setDialogOpen(false)
                queryClient.setQueryData(['stores'], stores)
                void queryClient.invalidateQueries({ queryKey: ['userInfo'] })
                refetchUser()
                navigate(
                  `/channels/connected?shopify=connected&shop=${encodeURIComponent(shop)}&message=${encodeURIComponent('Shopify connected successfully')}`,
                )
                return
              }
            } catch {
              // The existing panel session remains usable while Shopify authorization is pending.
            }

            if (Date.now() - startedAt >= 5 * 60 * 1000) {
              stopConnectionPolling()
              setError('Shopify authorization timed out. Try connecting again.')
              return
            }

            connectionPollRef.current = window.setTimeout(pollForConnection, 1500)
          }
          connectionPollRef.current = window.setTimeout(pollForConnection, 1500)
        },
        onError: (requestError) => {
          connectionWindow.close()
          setError(getApiErrorMessage(requestError))
        },
      },
    )
  }

  return (
    <Card
      variant="outlined"
      sx={{
        bgcolor: 'transparent',
        borderColor: 'rgba(255,255,255,0.1)',
        color: 'inherit',
        height: '100%',
        width: fullWidth ? '100%' : 'auto',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <CardContent sx={{ textAlign: 'center', flexGrow: 1 }}>
        <Box display="flex" justifyContent="center" mb={1}>
          <SiShopify size={28} />
        </Box>
        <Typography fontWeight={600}>Shopify</Typography>
      </CardContent>
      <CardActions sx={{ justifyContent: 'center', pb: 2 }}>
        <Button
          size="small"
          variant="contained"
          color={isConnected ? 'success' : 'inherit'}
          onClick={handleShopifyAction}
          fullWidth={isMobile}
        >
          {isConnected ? 'Manage' : 'Connect Shopify'}
        </Button>
      </CardActions>

      <Dialog
        open={dialogOpen}
        onClose={() => !isPending && setDialogOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Connect Shopify store</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Shopify store domain"
            placeholder="your-store.myshopify.com"
            value={storeDomain}
            onChange={(event) => setStoreDomain(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') handleConnect()
            }}
            disabled={isPending}
            margin="dense"
          />
          {error ? <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert> : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleConnect} variant="contained" disabled={isPending}>
            {isPending ? 'Connecting...' : 'Connect'}
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  )
}
