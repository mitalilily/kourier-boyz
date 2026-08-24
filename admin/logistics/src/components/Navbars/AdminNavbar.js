import {
  Box,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  Flex,
  Link,
  useColorModeValue,
} from '@chakra-ui/react'
import PropTypes from 'prop-types'
import { useEffect, useState } from 'react'
import AdminNavbarLinks from './AdminNavbarLinks'

export default function AdminNavbar(props) {
  const [scrolled, setScrolled] = useState(false)
  const { variant, children, fixed, secondary, brandText, onOpen, sidebarWidth = 275, ...rest } = props

  let mainText = useColorModeValue('gray.800', 'gray.100')
  let secondaryText = useColorModeValue('gray.500', 'gray.400')
  let navbarPosition = 'fixed'
  let navbarShadow = 'none'
  let navbarBg = useColorModeValue('#FFFFFF', '#202321')
  let navbarBorder = useColorModeValue('#D9DCDA', 'rgba(255,255,255,0.08)')
  let secondaryMargin = '0px'
  let paddingX = '18px'

  const fixedNavbarShadow = useColorModeValue(
    '0 16px 38px rgba(17, 17, 19, 0.08)',
    '0 16px 38px rgba(5, 4, 10, 0.42)',
  )
  const fixedNavbarBg = useColorModeValue(
    'rgba(255,255,255,0.92)',
    'rgba(17,17,19,0.92)',
  )
  const fixedNavbarBorder = useColorModeValue('1px solid rgba(17, 17, 19, 0.08)', '1px solid rgba(255, 255, 255, 0.08)')

  if (fixed === true && scrolled === true) {
    navbarPosition = 'fixed'
    navbarShadow = fixedNavbarShadow
    navbarBg = fixedNavbarBg
    navbarBorder = fixedNavbarBorder
  }

  if (secondary) {
    navbarPosition = 'absolute'
    mainText = 'white'
    secondaryText = 'whiteAlpha.700'
    secondaryMargin = '22px'
    paddingX = '30px'
  }

  useEffect(() => {
    const changeNavbar = () => {
      setScrolled(window.scrollY > 4)
    }
    window.addEventListener('scroll', changeNavbar)
    return () => {
      window.removeEventListener('scroll', changeNavbar)
    }
  }, [])

  return (
    <Flex
      position={navbarPosition}
      boxShadow={navbarShadow}
      bg={navbarBg}
      borderColor={navbarBorder}
      backdropFilter="none"
      borderWidth="1px"
      borderStyle="solid"
      transition="all 0.3s ease"
      alignItems={{ xl: 'center' }}
      borderRadius="0"
      display="flex"
      minH="70px"
      justifyContent={{ xl: 'center' }}
      mx="auto"
      mt="0"
      left={document.documentElement.dir === 'rtl' ? '20px' : ''}
      right="0"
      px={{ sm: paddingX, md: '26px' }}
      pt="12px"
      pb="12px"
      top="0"
      w={{
        sm: '100vw',
        xl: `calc(100vw - ${sidebarWidth}px)`,
      }}
    >
      <Flex w="100%" flexDirection={{ sm: 'column', md: 'row' }} alignItems={{ xl: 'center' }} gap={{ sm: 2, md: 0 }}>
        <Box mb={{ sm: '4px', md: '0px' }} display="flex" alignItems="center" gap="14px">
          <Box
            as="img"
            src="/logistics/brand/kourier-boyz-mark.png"
            alt="Kourier Boyz"
            h="36px"
            w="36px"
            objectFit="contain"
            display={{ base: 'none', md: 'block' }}
            borderRadius="8px"
            p="3px"
            bg={useColorModeValue('rgba(49, 2, 118, 0.08)', 'rgba(255, 255, 255, 0.08)')}
          />

          <Box>
            <Breadcrumb separator="/" spacing="8px" mb="3px">
              <BreadcrumbItem>
                <BreadcrumbLink href="#" color={secondaryText} fontSize="xs" fontWeight="600" _hover={{ color: 'brand.500', textDecoration: 'none' }}>
                  Admin
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbItem>
                <BreadcrumbLink href="#" color={mainText} fontSize="xs" fontWeight="700" _hover={{ color: 'brand.500', textDecoration: 'none' }}>
                  {brandText}
                </BreadcrumbLink>
              </BreadcrumbItem>
            </Breadcrumb>

            <Link
              color={mainText}
              href="#"
              bg="inherit"
              borderRadius="inherit"
              fontWeight="800"
              fontSize={{ base: 'lg', md: 'xl' }}
              letterSpacing="0"
              _hover={{ color: 'brand.500', textDecoration: 'none' }}
              _active={{ bg: 'inherit', transform: 'none', borderColor: 'transparent' }}
              _focus={{ boxShadow: 'none' }}
            >
              {brandText}
            </Link>
          </Box>
        </Box>

        <Box ms="auto" w={{ sm: '100%', md: 'unset' }}>
          <AdminNavbarLinks onOpen={onOpen} logoText={props.logoText} secondary={secondary} fixed={fixed} />
        </Box>
      </Flex>
    </Flex>
  )
}

AdminNavbar.propTypes = {
  brandText: PropTypes.string,
  variant: PropTypes.string,
  secondary: PropTypes.bool,
  fixed: PropTypes.bool,
  onOpen: PropTypes.func,
  sidebarWidth: PropTypes.number,
}
