import { Box, Drawer, Stack, useMediaQuery, useTheme } from '@mui/material'
import { Suspense, useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/auth/AuthContext'
import Navbar from '../Navbar/Navbar'
import KeyboardShortcuts from './keyboard/KeyboardShortcuts'
import Sidebar from './Sidebar'

export default function Layout() {
  const theme = useTheme()
  const location = useLocation()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [mobileOpen, setMobileOpen] = useState(false)
  const [sidebarPinned, setSidebarPinned] = useState(false)
  const { user } = useAuth()
  const isAdminWorkspace =
    user.role === 'admin' || user.role === 'employee' || Boolean(user.employeeId)
  const isOrderCreatePage = location.pathname === '/orders/create'

  const handleDrawerToggle = () => {
    setMobileOpen((prev) => !prev)
  }

  // Close mobile drawer on route change
  useEffect(() => {
    if (isMobile && mobileOpen) {
      setMobileOpen(false)
    }
  }, [location.pathname, isMobile, mobileOpen])

  return (
    <Box
      sx={{
        display: 'flex',
        minHeight: '100vh',
        background: '#F1F2F0',
        scrollbarGutter: 'stable',
      }}
    >
      <KeyboardShortcuts />

      {isMobile ? (
        <Drawer
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          variant="temporary"
          ModalProps={{ keepMounted: true }}
          sx={{
            '& .MuiDrawer-paper': {
              width: 280,
              border: 0,
              background: '#FFFFFF',
              boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
            },
          }}
        >
          <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ flex: 1, overflowY: 'auto' }}>
              <Sidebar role={isAdminWorkspace ? 'admin' : 'customer'} pinned />
            </Box>
          </Box>
        </Drawer>
      ) : (
        <Sidebar
          role={isAdminWorkspace ? 'admin' : 'customer'}
          pinned={sidebarPinned}
          onPinChange={setSidebarPinned}
        />
      )}

      <Stack
        sx={{
          flex: 1,
          minWidth: 0,
          minHeight: '100vh',
          p: 0,
          gap: 0,
          scrollbarGutter: 'stable',
        }}
      >
        <Navbar
          handleDrawerToggle={handleDrawerToggle}
          pinned={sidebarPinned}
          onPinChange={setSidebarPinned}
        />

        <Box
          component="main"
          sx={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            p: 0,
            backgroundColor: '#F8F8F6',
          }}
        >
          <Box
            sx={{
              maxWidth: 1700,
              mx: 'auto',
              width: '100%',
              px: isOrderCreatePage
                ? { xs: 0, sm: 0.25, md: 0.4, lg: 0.5 }
                : { xs: 0.4, sm: 0.8, md: 1.5, lg: 2 },
              py: isOrderCreatePage
                ? 0
                : { xs: 0.6, sm: 1, md: 1.5 },
            }}
          >
            <Suspense
              fallback={
                <Box key={`layout-fallback-${location.pathname}`} sx={{ minHeight: 300 }} />
              }
            >
              <Box key={location.pathname} sx={{ width: '100%', minHeight: '300px' }}>
                <Outlet />
              </Box>
            </Suspense>
          </Box>
        </Box>

        {!isOrderCreatePage && (
          <Box
            component="footer"
            sx={{
              px: 2,
              py: 1.5,
              borderTop: '1px solid #D9DCDA',
              color: 'text.secondary',
              fontSize: '0.72rem',
              textAlign: 'center',
            }}
          >
            Kourier Boyz seller operations
          </Box>
        )}
      </Stack>
    </Box>
  )
}
