'use client'

import {
  Badge,
  Box,
  Container,
  Flex,
  Grid,
  HStack,
  Icon,
  Spinner,
  Text,
  useColorModeValue,
  VStack,
} from '@chakra-ui/react'
import {
  FaBoxOpen,
  FaBuilding,
  FaExclamationTriangle,
  FaShippingFast,
  FaStore,
  FaTruck,
} from 'react-icons/fa'

const stages = [
  { label: 'Booked', icon: FaStore },
  { label: 'Pending Pickup', icon: FaBuilding },
  { label: 'In Transit', icon: FaTruck },
  { label: 'Out for Delivery', icon: FaShippingFast },
  { label: 'Delivered', icon: FaBoxOpen },
]

const statusLabels = {
  PP: 'Pending Pickup',
  IT: 'In Transit',
  OFD: 'Out for Delivery',
  DL: 'Delivered',
  CAN: 'Cancelled',
  RT: 'RTO',
  'RT-IT': 'RTO In Transit',
  'RT-DL': 'RTO Delivered',
  EX: 'Exception',
}

const formatTrackingEventTime = (value) =>
  new Date(value).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

export default function TrackingDetails({ data, isLoading, error }) {
  const cardBg = useColorModeValue('white', 'gray.800')
  const detailItemBg = useColorModeValue('gray.50', 'gray.700')
  const historyBorderColor = useColorModeValue('gray.200', 'gray.600')
  console.log(data)
  if (isLoading) {
    return (
      <Flex direction="column" align="center" justify="center" py={12}>
        <Spinner size="xl" thickness="4px" color="blue.500" />
        <Text mt={4} fontWeight="medium">
          Fetching your tracking details…
        </Text>
      </Flex>
    )
  }

  if (error || !data) {
    return (
      <Box bg="red.50" border="1px" borderColor="red.200" rounded="lg" p={6} textAlign="center">
        <Icon as={FaExclamationTriangle} boxSize={10} color="red.500" mb={2} />
        <Text fontWeight="bold" fontSize="lg" color="red.700">
          {error ? 'Something went wrong' : 'Tracking Not Found'}
        </Text>
        <Text fontSize="sm" mt={1} color="red.600">
          {error?.message || 'Please check your AWB / Order details and try again.'}
        </Text>
      </Box>
    )
  }

  const currentStage =
    data?.history?.findIndex(
      (h) => statusLabels[h.status_code]?.toLowerCase() === data.status?.toLowerCase(),
    ) ?? 0

  return (
    <Container maxW="6xl" py={8}>
      <Grid templateColumns={{ base: '1fr', md: '1fr 2fr' }} gap={6}>
        {/* Shipment Details */}
        <Box bg={cardBg} rounded="lg" shadow="md" p={6}>
          <Text fontSize="xl" fontWeight="bold" mb={4}>
            Shipment Details
          </Text>
          <VStack spacing={3} align="stretch">
            {[
              { label: 'Courier', value: data.courier_name },
              { label: 'AWB No', value: data.awb_number },
              { label: 'Order Number', value: data.order_number },
              { label: 'Payment Type', value: data.payment_type },
              { label: 'Expected Delivery', value: data.edd },
            ].map((item) => (
              <Box
                key={item.label}
                p={3}
                rounded="md"
                bg={detailItemBg}
              >
                <Text fontSize="xs" textTransform="uppercase" color="gray.500">
                  {item.label}
                </Text>
                <Text fontWeight="semibold">{item.value || '-'}</Text>
              </Box>
            ))}
          </VStack>
        </Box>

        {/* Tracking Progress + History */}
        <VStack spacing={6} align="stretch">
          {/* Progress */}
          <Box bg={cardBg} rounded="lg" shadow="md" p={6}>
            <HStack justify="space-between">
              {stages.map((stage, index) => {
                const active = index <= currentStage
                return (
                  <VStack key={stage.label} spacing={2}>
                    <Flex
                      w={10}
                      h={10}
                      rounded="full"
                      align="center"
                      justify="center"
                      bg={active ? 'blue.500' : 'gray.300'}
                      color="white"
                    >
                      <Icon as={stage.icon} />
                    </Flex>
                    <Text
                      fontSize="xs"
                      fontWeight={active ? 'bold' : 'normal'}
                      color={active ? 'blue.600' : 'gray.500'}
                      textAlign="center"
                    >
                      {stage.label}
                    </Text>
                  </VStack>
                )
              })}
            </HStack>
          </Box>

          {/* History */}
          <Box bg={cardBg} rounded="lg" shadow="md" p={6}>
            <Text fontSize="lg" fontWeight="bold" mb={4}>
              Tracking History
            </Text>
            <VStack spacing={4} align="stretch">
              {data.history.map((h, idx) => (
                <Box
                  key={idx}
                  p={4}
                  border="1px"
                  borderColor={historyBorderColor}
                  rounded="md"
                >
                  <Badge
                    colorScheme={
                      h.status_code === 'CAN' ? 'red' : h.status_code === 'DL' ? 'green' : 'blue'
                    }
                    mb={2}
                  >
                    {statusLabels[h.status_code] || h.status_code}
                  </Badge>
                  {h.location && (
                    <Text fontSize="sm">
                      <strong>Location:</strong> {h.location}
                    </Text>
                  )}
                  <Text fontSize="sm">
                    <strong>Time:</strong>{' '}
                    {formatTrackingEventTime(h.event_time)}
                  </Text>
                  {h.message && (
                    <Text fontSize="sm" mt={1}>
                      {h.message}
                    </Text>
                  )}
                </Box>
              ))}
            </VStack>
          </Box>
        </VStack>
      </Grid>
    </Container>
  )
}
