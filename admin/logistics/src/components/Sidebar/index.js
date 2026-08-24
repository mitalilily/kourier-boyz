/*eslint-disable*/
// chakra imports
import { Box, useColorModeValue } from '@chakra-ui/react'
import React from 'react'
import SidebarContent from './SidebarContent'

function Sidebar(props) {
  const mainPanel = React.useRef()
  let variantChange = '0.2s linear'

  const { logoText, routes, sidebarVariant, sidebarWidth } = props

  //  BRAND
  let sidebarBg = 'none'
  let sidebarRadius = '0px'
  let sidebarMargins = '0px'
  if (sidebarVariant === 'opaque') {
    sidebarBg = useColorModeValue('#FFFFFF', '#202321')
    sidebarRadius = '0px'
    sidebarMargins = '0px'
  }

  // SIDEBAR
  return (
    <Box ref={mainPanel}>
      <Box display={{ sm: 'none', xl: 'block' }} position="fixed">
        <Box
          bg={sidebarBg}
          transition={variantChange}
          w={`${sidebarWidth}px`} // ✅ dynamic width from Dashboard
          maxW="400px"
          minW="200px"
          ms={{ sm: '16px' }}
          my={{ sm: '16px' }}
          h="100vh"
          ps="0"
          pe="0"
          m={sidebarMargins}
          borderRadius={sidebarRadius}
        >
          <SidebarContent
            sidebarWidth={sidebarWidth}
            routes={routes}
            logoText={logoText || 'Kourier Boyz'}
            sidebarVariant={sidebarVariant}
          />
        </Box>
      </Box>
    </Box>
  )
}

export default Sidebar
