import { Box, Link, Stack, Typography } from '@mui/material'
import { FiArrowUpRight } from 'react-icons/fi'
import PhoneForm from './PhoneForm'

const LANDING_PAGE_URL = import.meta.env.VITE_LANDING_URL || '/'

export default function LoginForm() {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        width: '100%',
        maxWidth: '100vw',
        overflow: 'hidden',
        display: 'grid',
        gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: '55% 45%' },
        backgroundColor: '#F8F8F6',
      }}
    >
      <Box
        component="section"
        sx={{
          minHeight: '100vh',
          display: { xs: 'none', lg: 'flex' },
          flexDirection: 'column',
          p: { lg: 6, xl: 8 },
          color: '#202321',
          backgroundColor: '#F8F8F6',
          position: 'relative',
          overflow: 'hidden',
          borderRight: '1px solid #D9DCDA',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            backgroundImage: "url('/brand/kourier-boyz-network-auth.webp')",
            backgroundPosition: 'center center',
            backgroundSize: 'cover',
            backgroundRepeat: 'no-repeat',
          }}
        />

        <Stack
          sx={{
            position: 'relative',
            zIndex: 1,
            flex: 1,
            justifyContent: 'space-between',
          }}
        >
          <Box
            component="img"
            src="/brand/kourier-boyz-logo-transparent.png"
            alt="Kourier Boyz"
            sx={{ width: { lg: 240, xl: 280 }, height: 'auto', objectFit: 'contain', p: 1, borderRadius: 2, background: 'linear-gradient(135deg, #202524, #3c4240)', border: '1px solid rgba(223,183,67,0.28)', boxShadow: '0 14px 34px rgba(17,17,19,0.18)' }}
          />

          <Box sx={{ maxWidth: 520, mb: { lg: 12, xl: 16 } }}>
            <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2.5 }}>
              <Box sx={{ width: 36, height: 2, backgroundColor: '#B78115' }} />
              <Typography
                sx={{
                  color: '#8F650F',
                  fontSize: '0.75rem',
                  fontWeight: 900,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                }}
              >
                Console Login
              </Typography>
            </Stack>
            <Typography
              component="h1"
              sx={{
                color: '#202321',
                fontSize: { lg: '3.4rem', xl: '4.6rem' },
                lineHeight: 1.04,
                fontWeight: 850,
                letterSpacing: 0,
              }}
            >
              Every shipment.
              <Box component="span" sx={{ display: 'block', color: '#B78115' }}>
                In clear view.
              </Box>
            </Typography>
          </Box>

          <Link
            href={LANDING_PAGE_URL}
            target="_blank"
            rel="noreferrer"
            underline="none"
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 1,
              color: '#202321',
              fontWeight: 850,
              width: 'fit-content',
            }}
          >
            Visit Kourier Boyz <FiArrowUpRight size={17} />
          </Link>
        </Stack>
      </Box>

      <Box
        component="main"
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: 0,
          minHeight: '100vh',
          px: { xs: 3, sm: 6, lg: 7, xl: 8 },
          py: { xs: 4, sm: 6 },
          backgroundColor: '#FFFFFF',
        }}
      >
        <Box sx={{ width: '100%', maxWidth: 430, minWidth: 0 }}>
          <Box
            component="img"
            src="/brand/kourier-boyz-logo-transparent.png"
            alt="Kourier Boyz"
            sx={{
              display: { xs: 'block', lg: 'none' },
              width: { xs: 210, sm: 230 },
              height: 'auto',
              objectFit: 'contain',
              mb: 5,
              p: 1,
              borderRadius: 2,
              background: 'linear-gradient(135deg, #202524, #3c4240)',
              border: '1px solid rgba(223,183,67,0.28)',
              boxShadow: '0 12px 28px rgba(17,17,19,0.14)',
            }}
          />
          <Typography
            sx={{
              color: '#8F650F',
              fontSize: '0.76rem',
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: '0.14em',
              mb: 1.2,
            }}
          >
            Console Login
          </Typography>
          <Typography
            component="h2"
            sx={{
              color: '#202321',
              fontSize: { xs: '2rem', sm: '2.5rem' },
              fontWeight: 850,
              letterSpacing: 0,
            }}
          >
            Welcome back
          </Typography>
          <Typography sx={{ color: '#6A706D', lineHeight: 1.7, mt: 1.2, mb: 4, fontSize: '0.95rem' }}>
            Sign in to book, track, reconcile, and manage your Kourier Boyz console.
          </Typography>

          <PhoneForm />

          <Typography sx={{ color: '#6A706D', fontSize: '0.78rem', textAlign: 'center', mt: 3 }}>
            Protected access for your Kourier Boyz console
          </Typography>
        </Box>
      </Box>
    </Box>
  )
}
