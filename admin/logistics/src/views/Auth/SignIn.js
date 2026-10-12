import { Box, Flex, Spinner, Text, VStack } from '@chakra-ui/react'
import { jwtDecode } from 'jwt-decode'
import { useEffect } from 'react'
import { useHistory } from 'react-router-dom'
import { LOGISTICS_ADMIN_STORAGE } from 'config/authStorage'

const isTokenValid = (token) => {
  try {
    return jwtDecode(token).exp > Date.now() / 1000
  } catch {
    return false
  }
}

function SignIn() {
  const history = useHistory()

  useEffect(() => {
    const accessToken = localStorage.getItem(LOGISTICS_ADMIN_STORAGE.accessToken)
    const refreshToken = localStorage.getItem(LOGISTICS_ADMIN_STORAGE.refreshToken)

    if (accessToken && refreshToken && isTokenValid(refreshToken)) {
      history.replace('/admin/dashboard')
      return
    }

    window.location.replace('/login?workspace=logistics')
  }, [history])

  return (
    <Flex minH="100vh" align="center" justify="center" bg="#F1F2F0" px={6}>
      <VStack spacing={5} textAlign="center">
        <Box
          as="img"
          src="/logistics/brand/kourier-boyz-logo-transparent.png"
          alt="Kourier Boyz"
          w="230px"
          h="64px"
          objectFit="contain"
          bg="#fffefb"
          border="1px solid"
          borderColor="gray.200"
          borderRadius="6px"
          px="14px"
          py="9px"
          boxShadow="sm"
        />
        <Spinner size="lg" color="brand.500" thickness="3px" />
        <Text color="#626965" fontSize="sm">
          Opening the unified admin sign-in...
        </Text>
      </VStack>
    </Flex>
  )
}

export default SignIn
