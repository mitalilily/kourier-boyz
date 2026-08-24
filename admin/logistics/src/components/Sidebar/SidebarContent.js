import { ChevronDownIcon } from '@chakra-ui/icons'
import { Box, Button, Collapse, Flex, Stack, Text, useColorModeValue } from '@chakra-ui/react'
import React, { useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'

const SidebarContent = ({ logoText, routes, sidebarWidth }) => {
  const location = useLocation()
  const [openGroups, setOpenGroups] = React.useState({})
  const collapsed = sidebarWidth <= 160
  const sidebarBg = useColorModeValue('#FFFFFF', '#202321')
  const borderColor = useColorModeValue('#D9DCDA', 'rgba(255,255,255,0.08)')
  const textColor = useColorModeValue('#4F5552', 'whiteAlpha.800')
  const mutedColor = useColorModeValue('#6A706D', 'whiteAlpha.600')
  const hoverBg = useColorModeValue('#F8F8F6', 'whiteAlpha.100')
  const activeBg = useColorModeValue('#F7F2E5', 'whiteAlpha.200')
  const inactiveIconBg = useColorModeValue('#F1F2F0', 'whiteAlpha.100')

  useEffect(() => {
    routes.forEach((route) => {
      if (route.category && route.views?.some((view) => location.pathname.startsWith(view.layout + view.path.split('/:')[0]))) {
        setOpenGroups((current) => ({ ...current, [route.state]: true }))
      }
    })
  }, [location.pathname, routes])

  const navButton = (item, active, category = false) => (
    <Button
      w="100%"
      h="42px"
      px={collapsed ? 2 : 3}
      justifyContent={collapsed ? 'center' : 'flex-start'}
      borderRadius="6px"
      variant="ghost"
      bg={active ? activeBg : 'transparent'}
      color={active ? 'brand.500' : textColor}
      borderLeft="3px solid"
      borderLeftColor={active ? 'accent.400' : 'transparent'}
      _hover={{ bg: hoverBg, color: 'brand.500' }}
    >
      <Flex align="center" w="100%" gap={3}>
        {item.icon && (
          <Flex
            w="28px"
            h="28px"
            flexShrink={0}
            align="center"
            justify="center"
            borderRadius="6px"
            bg={active ? 'brand.500' : inactiveIconBg}
            color={active ? 'white' : mutedColor}
          >
            {item.icon}
          </Flex>
        )}
        {!collapsed && <Text fontSize="sm" fontWeight={active ? '700' : '600'}>{item.name}</Text>}
        {!collapsed && category && (
          <ChevronDownIcon ml="auto" transform={openGroups[item.state] ? 'rotate(180deg)' : 'none'} transition="transform .2s" />
        )}
      </Flex>
    </Button>
  )

  const renderRoutes = (items) => items.filter((item) => item.show !== false && !item.redirect).map((item) => {
    if (item.category) {
      const active = item.views.some((view) => location.pathname.startsWith(view.layout + view.path.split('/:')[0]))
      return (
        <Box key={item.name}>
          <Box onClick={() => setOpenGroups((current) => ({ ...current, [item.state]: !current[item.state] }))}>
            {navButton(item, active, true)}
          </Box>
          <Collapse in={openGroups[item.state]} animateOpacity>
            <Stack spacing={1} pl={collapsed ? 0 : 3} mt={1}>{renderRoutes(item.views)}</Stack>
          </Collapse>
        </Box>
      )
    }

    const itemPath = item.layout + item.path.split('/:')[0]
    const active = item.exact ? location.pathname === itemPath : location.pathname.startsWith(itemPath)
    return <NavLink to={item.layout + item.path} key={item.name}>{navButton(item, active)}</NavLink>
  })

  return (
    <Box
      h="100vh"
      w={`${sidebarWidth}px`}
      bg={sidebarBg}
      borderRight="1px solid"
      borderColor={borderColor}
      backgroundImage="repeating-linear-gradient(118deg, rgba(92, 100, 96, 0.05) 0 1px, transparent 1px 17px), linear-gradient(180deg, rgba(255,255,255,0.98), rgba(232,235,233,0.96))"
      boxShadow="8px 0 28px rgba(41, 45, 43, 0.08)"
      position="fixed"
      left="0"
      top="0"
      overflowY="auto"
      overflowX="hidden"
      transition="width .25s ease"
      css={{ '&::-webkit-scrollbar': { width: '4px' }, '&::-webkit-scrollbar-thumb': { background: '#B6BCBA' } }}
    >
      <Flex h="104px" px={collapsed ? 3 : 5} align="center" borderBottom="1px solid" borderColor={borderColor}>
        <Box w={collapsed ? '42px' : '190px'} h={collapsed ? '42px' : '58px'} overflow="hidden">
          <Box
            as="img"
            src="/logistics/brand/kourier-boyz-logo-transparent.png"
            alt={logoText}
            w={collapsed ? '180px' : '190px'}
            maxW="none"
            h={collapsed ? '42px' : '58px'}
            objectFit="contain"
            objectPosition="left center"
          />
        </Box>
      </Flex>
      {!collapsed && <Text px={5} pt={5} pb={2} fontSize="10px" fontWeight="800" color="brand.600" textTransform="uppercase">Logistics operations</Text>}
      <Stack spacing={1} px={3} pb={6}>{renderRoutes(routes)}</Stack>
    </Box>
  )
}

export default SidebarContent
