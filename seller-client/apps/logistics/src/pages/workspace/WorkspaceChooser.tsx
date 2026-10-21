import { Alert, Box, Button, CircularProgress, Stack, Typography } from '@mui/material'
import { useEffect, useMemo, useState } from 'react'
import { FiArrowRight, FiCheck, FiPackage, FiShoppingBag, FiTruck } from 'react-icons/fi'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  fetchMerchantCapabilities,
  selectMerchantWorkspace,
  type MerchantCapabilities,
  type MerchantWorkspace,
} from '../../api/merchantCapabilities'

const workspaceCards = [
  {
    id: 'shipping' as const,
    eyebrow: 'Courier operations',
    title: 'Ship products',
    copy: 'Book couriers for orders from any channel, print labels, track deliveries, and reconcile COD.',
    points: ['Rate comparison', 'Pickup and tracking', 'Wallet and COD controls'],
    icon: FiTruck,
  },
  {
    id: 'marketplace' as const,
    eyebrow: 'Marketplace and delivery',
    title: 'Sell products',
    copy: 'Open your catalogue, manage inventory, receive buyer orders, and fulfil them through the same shipping account.',
    points: ['Storefront and catalogue', 'Buyer order management', 'Connected Kourier Boyz fulfilment'],
    icon: FiShoppingBag,
  },
]

export default function WorkspaceChooser() {
  const location = useLocation()
  const navigate = useNavigate()
  const [capabilities, setCapabilities] = useState<MerchantCapabilities | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState<MerchantWorkspace | null>(null)
  const [error, setError] = useState('')
  const params = useMemo(() => new URLSearchParams(location.search), [location.search])
  const intent = params.get('intent') as MerchantWorkspace | null
  const forceChoice = params.get('choose') === '1' || intent === 'shipping' || intent === 'marketplace'

  useEffect(() => {
    void fetchMerchantCapabilities()
      .then((data) => {
        setCapabilities(data)
        if (data.firstChoiceCompleted && data.preferredWorkspace && !forceChoice) {
          if (data.preferredWorkspace === 'marketplace' && data.approved) {
            window.location.assign('/store/')
          } else {
            navigate(data.onboardingComplete ? '/home' : '/onboarding-questions', { replace: true })
          }
        }
      })
      .catch(() => setError('We could not load your workspace options. Please try again.'))
      .finally(() => setLoading(false))
  }, [forceChoice, navigate])

  const choose = async (workspace: MerchantWorkspace) => {
    setSubmitting(workspace)
    setError('')
    try {
      const next = await selectMerchantWorkspace(workspace)
      setCapabilities(next)
      if (!next.onboardingComplete) {
        navigate(`/onboarding-questions?intent=${workspace}`)
      } else if (workspace === 'marketplace' && !next.approved) {
        navigate('/profile/kyc_details?intent=marketplace')
      } else if (workspace === 'marketplace') {
        window.location.assign('/store/')
      } else {
        navigate('/home')
      }
    } catch {
      setError('That workspace could not be opened. Your account is safe; please try again.')
    } finally {
      setSubmitting(null)
    }
  }

  if (loading) {
    return <Box sx={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', bgcolor: '#f7f7f4' }}><CircularProgress size={34} sx={{ color: '#B78115' }} /></Box>
  }

  return (
    <Box sx={{ minHeight: '100dvh', px: { xs: 2, md: 4 }, py: { xs: 2, md: 3 }, color: '#202321', background: 'linear-gradient(115deg, rgba(255,255,255,.96), rgba(248,247,241,.9)), url(/brand/kourier-boyz-network-auth.webp) center/cover fixed' }}>
      <Box sx={{ maxWidth: 1280, mx: 'auto' }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
          <Box component="img" src="/brand/kourier-boyz-logo-transparent.png" alt="Kourier Boyz" sx={{ width: { xs: 190, sm: 235 }, height: 62, objectFit: 'contain', objectPosition: 'left' }} />
          <Typography sx={{ display: { xs: 'none', sm: 'block' }, fontSize: 13, fontWeight: 800, color: '#6a706d' }}>One verified account. Two connected workspaces.</Typography>
        </Stack>

        <Box sx={{ mt: { xs: 3, md: 5 }, maxWidth: 820 }}>
          <Typography sx={{ color: '#8F650F', fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.12em' }}>Choose where to begin</Typography>
          <Typography component="h1" sx={{ mt: 1.5, fontSize: { xs: 38, md: 60 }, lineHeight: 1.04, fontWeight: 900 }}>One business account, built for selling and shipping.</Typography>
          <Typography sx={{ mt: 2, maxWidth: 680, color: '#606663', fontSize: { xs: 16, md: 18 }, lineHeight: 1.65 }}>Start with courier operations or open the marketplace workspace. Marketplace orders always move through your verified Kourier Boyz shipping account.</Typography>
        </Box>

        {error && <Alert severity="error" sx={{ mt: 3, maxWidth: 760 }}>{error}</Alert>}

        <Box sx={{ mt: { xs: 3, md: 5 }, display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, gap: 2.5 }}>
          {workspaceCards.map((card) => {
            const Icon = card.icon
            const highlighted = intent === card.id
            return (
              <Box key={card.id} component="article" sx={{ minHeight: { md: 330 }, p: { xs: 3, md: 4 }, display: 'flex', flexDirection: 'column', bgcolor: 'rgba(255,255,255,.94)', border: highlighted ? '2px solid #B78115' : '1px solid rgba(32,35,33,.14)', boxShadow: highlighted ? '0 24px 60px rgba(143,101,15,.18)' : '0 18px 50px rgba(32,35,33,.09)', transition: 'transform 220ms ease, box-shadow 220ms ease, border-color 220ms ease', '&:hover': { transform: 'translateY(-6px)', borderColor: '#B78115', boxShadow: '0 28px 70px rgba(32,35,33,.15)' } }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Box sx={{ width: 50, height: 50, display: 'grid', placeItems: 'center', bgcolor: '#252926', color: '#E0B844' }}><Icon size={24} /></Box>
                  {highlighted && <Typography sx={{ color: '#8F650F', fontSize: 12, fontWeight: 900 }}>Recommended for this visit</Typography>}
                </Stack>
                <Typography sx={{ mt: 3, color: '#8F650F', fontSize: 12, fontWeight: 900, textTransform: 'uppercase' }}>{card.eyebrow}</Typography>
                <Typography component="h2" sx={{ mt: 0.5, fontSize: { xs: 29, md: 34 }, fontWeight: 900 }}>{card.title}</Typography>
                <Typography sx={{ mt: 1.25, color: '#606663', lineHeight: 1.65 }}>{card.copy}</Typography>
                <Stack spacing={0.8} sx={{ mt: 2.5 }}>
                  {card.points.map((point) => <Typography key={point} sx={{ display: 'flex', gap: 1, alignItems: 'center', fontSize: 14, fontWeight: 700 }}><FiCheck color="#B78115" />{point}</Typography>)}
                </Stack>
                <Button variant="contained" disabled={Boolean(submitting)} onClick={() => void choose(card.id)} endIcon={submitting === card.id ? <CircularProgress size={16} color="inherit" /> : <FiArrowRight />} sx={{ mt: 'auto', pt: 1.2, pb: 1.2, bgcolor: card.id === 'marketplace' ? '#B78115' : '#252926', color: '#fff', borderRadius: 0, fontWeight: 900, '&:hover': { bgcolor: card.id === 'marketplace' ? '#8F650F' : '#111' } }}>
                  {card.id === 'shipping' ? 'Open shipping console' : 'Open marketplace workspace'}
                </Button>
              </Box>
            )
          })}
        </Box>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 3, color: '#606663' }}>
          <Typography sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: 13 }}><FiPackage /> Courier KYC is completed once and reused securely.</Typography>
          {capabilities?.kycStatus === 'verified' && <Typography sx={{ color: '#167447', fontSize: 13, fontWeight: 900 }}>Courier verification active</Typography>}
        </Stack>
      </Box>
    </Box>
  )
}
