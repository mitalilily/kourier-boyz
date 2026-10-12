import { Badge, Box, Button, Flex, Grid, HStack, Text } from '@chakra-ui/react'
import { IconArrowRight, IconBuildingStore, IconTruckDelivery } from '@tabler/icons-react'
import {
  hasAdminWorkspaceSession,
  openAdminWorkspace,
  rememberAdminWorkspacePath,
} from 'config/adminWorkspace'
import { useHistory } from 'react-router-dom'

const SellerWorkspaceBar = () => {
  const history = useHistory()
  const marketplaceReady = hasAdminWorkspaceSession('marketplace')

  const openMarketplaceSellers = () => {
    rememberAdminWorkspacePath('marketplace', '/sellers')
    openAdminWorkspace('marketplace')
  }

  return (
    <Grid
      templateColumns={{ base: '1fr', xl: '0.7fr 1.5fr' }}
      gap={5}
      mb={6}
      alignItems="center"
      border="1px solid"
      borderColor="rgba(88, 96, 92, 0.20)"
      borderLeft="4px solid"
      borderLeftColor="brand.500"
      borderRadius="8px"
      p={{ base: 4, md: 5 }}
      bg="rgba(255,255,255,0.92)"
      boxShadow="0 10px 26px rgba(37, 41, 39, 0.07)"
    >
      <Box>
        <Text color="brand.600" fontSize="10px" fontWeight="800" textTransform="uppercase">
          Seller network
        </Text>
        <Text mt={1} color="#202321" fontSize="lg" fontWeight="800">
          Two seller journeys, one team
        </Text>
        <Text mt={1} color="#646B67" fontSize="sm" lineHeight="1.55">
          Move between courier clients and marketplace sellers without losing operational context.
        </Text>
      </Box>

      <Grid templateColumns={{ base: '1fr', md: 'repeat(2, minmax(0, 1fr))' }} gap={3}>
        <Button
          h="82px"
          px={4}
          justifyContent="space-between"
          border="1px solid"
          borderColor="rgba(183,129,21,0.36)"
          borderRadius="7px"
          bg="#F8F3E7"
          color="#202321"
          onClick={() => history.push('/admin/users-management')}
          _hover={{ transform: 'translateY(-3px)', boxShadow: '0 14px 28px rgba(41,45,43,.12)' }}
          transition="all 220ms cubic-bezier(.22,1,.36,1)"
        >
          <HStack spacing={3} minW={0}>
            <Flex w="40px" h="40px" align="center" justify="center" borderRadius="7px" bg="brand.500" color="white">
              <IconTruckDelivery size={20} />
            </Flex>
            <Box textAlign="left" minW={0}>
              <Badge colorScheme="green" fontSize="9px">Session ready</Badge>
              <Text mt={1} fontSize="sm" fontWeight="800">Courier clients</Text>
              <Text color="#727875" fontSize="11px">KYC, wallets, shipments and support</Text>
            </Box>
          </HStack>
          <IconArrowRight size={17} />
        </Button>

        <Button
          h="82px"
          px={4}
          justifyContent="space-between"
          border="1px solid"
          borderColor="rgba(94,102,98,.22)"
          borderRadius="7px"
          bg="white"
          color="#202321"
          onClick={openMarketplaceSellers}
          _hover={{ transform: 'translateY(-3px)', boxShadow: '0 14px 28px rgba(41,45,43,.12)' }}
          transition="all 220ms cubic-bezier(.22,1,.36,1)"
        >
          <HStack spacing={3} minW={0}>
            <Flex w="40px" h="40px" align="center" justify="center" borderRadius="7px" bg="#E7EAE8" color="#3F4743">
              <IconBuildingStore size={20} />
            </Flex>
            <Box textAlign="left" minW={0}>
              <Badge colorScheme={marketplaceReady ? 'green' : 'orange'} fontSize="9px">
                {marketplaceReady ? 'Session ready' : 'Sign-in required'}
              </Badge>
              <Text mt={1} fontSize="sm" fontWeight="800">Marketplace sellers</Text>
              <Text color="#727875" fontSize="11px">Catalogue, orders, returns and settlements</Text>
            </Box>
          </HStack>
          <IconArrowRight size={17} />
        </Button>
      </Grid>
    </Grid>
  )
}

export default SellerWorkspaceBar
