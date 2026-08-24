// Chakra imports
import { Box, ChakraProvider, Portal, useColorModeValue, useDisclosure } from '@chakra-ui/react'
import Configurator from 'components/Configurator/Configurator'
import Footer from 'components/Footer/Footer.js'
// Layout components
import '@fontsource/open-sans/400.css'
import '@fontsource/open-sans/600.css'
import '@fontsource/raleway/600.css'
import '@fontsource/raleway/700.css'
import AdminNavbar from 'components/Navbars/AdminNavbar.js'
import Sidebar from 'components/Sidebar'
import { useEffect, useState } from 'react'
import { Redirect, Route, Switch } from 'react-router-dom'
import routes from 'routes.js'
// Custom Chakra theme
import theme from 'theme/theme.js'
import FixedPlugin from '../components/FixedPlugin/FixedPlugin'
// Custom components
import MainPanel from '../components/Layout/MainPanel'
import PanelContainer from '../components/Layout/PanelContainer'
import PanelContent from '../components/Layout/PanelContent'

export default function Dashboard(props) {
  const { ...rest } = props
  // states and functions
  const [sidebarVariant, setSidebarVariant] = useState('opaque')
  const [fixed, setFixed] = useState(false)

  // 🆕 Sidebar resizing state
  const [sidebarWidth, setSidebarWidth] = useState(260) // default width
  const [isResizing, setIsResizing] = useState(false)

  // Resizing logic
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isResizing) {
        const newWidth = Math.min(Math.max(e.clientX, 200), 400) // min 200, max 400
        setSidebarWidth(newWidth)
      }
    }
    const handleMouseUp = () => setIsResizing(false)

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing])

  const getRoute = () => {
    return window.location.pathname !== '/logistics/admin/full-screen-maps'
  }
  const getActiveRoute = (routes) => {
    let activeRoute = 'Default Brand Text'
    for (let i = 0; i < routes.length; i++) {
      if (routes[i].collapse) {
        let collapseActiveRoute = getActiveRoute(routes[i].views)
        if (collapseActiveRoute !== activeRoute) {
          return collapseActiveRoute
        }
      } else if (routes[i].category) {
        let categoryActiveRoute = getActiveRoute(routes[i].views)
        if (categoryActiveRoute !== activeRoute) {
          return categoryActiveRoute
        }
      } else {
        if (window.location.href.indexOf(routes[i].layout + routes[i].path) !== -1) {
          return routes[i].name
        }
      }
    }
    return activeRoute
  }
  // This changes navbar state(fixed or not)
  const getActiveNavbar = (routes) => {
    let activeNavbar = false
    for (let i = 0; i < routes.length; i++) {
      if (routes[i].category) {
        let categoryActiveNavbar = getActiveNavbar(routes[i].views)
        if (categoryActiveNavbar !== activeNavbar) {
          return categoryActiveNavbar
        }
      } else {
        if (window.location.href.indexOf(routes[i].layout + routes[i].path) !== -1) {
          if (routes[i].secondaryNavbar) {
            return routes[i].secondaryNavbar
          }
        }
      }
    }
    return activeNavbar
  }
  const getRoutes = (routes) => {
    return routes.map((prop, key) => {
      // If it's a collapsible or category, go deeper
      if (prop.collapse || prop.category) {
        return getRoutes(prop.views)
      }

      // If it's a regular admin route, render it
      if (prop.layout === '/admin') {
        return <Route exact={prop.exact} path={prop.layout + prop.path} component={prop.component} key={key} />
      }

      return null
    })
  }

  const { isOpen, onOpen, onClose } = useDisclosure()
  document.documentElement.dir = 'ltr'

  return (
    <ChakraProvider theme={theme} resetCss={false}>
      {/* Sidebar with dynamic width */}
      <Sidebar
        routes={routes}
        logoText={'Kourier Boyz'}
        sidebarVariant={sidebarVariant}
        sidebarWidth={sidebarWidth}
        {...rest}
      />

      {/* Main Panel adjusts with sidebar width */}
      <MainPanel
        w={{
          base: '100%',
          xl: `calc(100% - ${sidebarWidth}px)`,
        }}
        ml={{ xl: `${sidebarWidth}px` }}
      >
        <Portal>
          <AdminNavbar
            onOpen={onOpen}
            logoText={'Kourier Boyz'}
            brandText={getActiveRoute(routes)}
            secondary={getActiveNavbar(routes)}
            fixed={fixed}
            sidebarWidth={sidebarWidth}
            {...rest}
          />
        </Portal>
        {getRoute() ? (
          <PanelContent>
            <PanelContainer>
              <Switch>
                {getRoutes(routes)}
                <Redirect from="/admin" to="/admin/dashboard" />
              </Switch>
            </PanelContainer>
          </PanelContent>
        ) : null}
        <Footer />
        <Portal>
          <FixedPlugin secondary={getActiveNavbar(routes)} fixed={fixed} onOpen={onOpen} />
        </Portal>
        <Configurator
          secondary={getActiveNavbar(routes)}
          isOpen={isOpen}
          onClose={onClose}
          isChecked={fixed}
          onSwitch={(value) => setFixed(value)}
          onOpaque={() => setSidebarVariant('opaque')}
          onTransparent={() => setSidebarVariant('transparent')}
        />
      </MainPanel>

      {/* 🖱️ Resize Handle */}
      <Box
        position="fixed"
        left={`${sidebarWidth - 3}px`}
        top="0"
        h="100vh"
        w="6px"
        cursor="col-resize"
        zIndex="1400"
        _hover={{ bg: useColorModeValue('rgba(75, 17, 150, 0.14)', 'rgba(75, 17, 150, 0.24)') }}
        onMouseDown={() => setIsResizing(true)}
      />
    </ChakraProvider>
  )
}
