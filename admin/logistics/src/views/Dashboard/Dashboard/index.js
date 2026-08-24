import {
  Badge,
  Box,
  Button,
  Container,
  Flex,
  Grid,
  Heading,
  HStack,
  Progress,
  SimpleGrid,
  Spinner,
  Stack,
  Text,
  VStack,
  useColorModeValue,
} from '@chakra-ui/react'
import {
  IconAlertTriangle,
  IconCheck,
  IconCoinRupee,
  IconMapPin,
  IconPackageExport,
  IconRefresh,
  IconTruck,
  IconUsers,
} from '@tabler/icons-react'
import MetricTile from 'components/Admin/MetricTile'
import PageHeader from 'components/Admin/PageHeader'
import Card from 'components/Card/Card'
import CardBody from 'components/Card/CardBody'
import CardHeader from 'components/Card/CardHeader'
import OrdersLineChart from 'components/Charts/OrdersLineChart'
import RevenueBarChart from 'components/Charts/RevenueBarChart'
import { useDashboardStats } from 'hooks/useDashboardStats'
import { useHistory } from 'react-router-dom'

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(amount) || 0)

const toNum = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export default function Dashboard() {
  const history = useHistory()
  const { data: statsData, isLoading, error, refetch, isRefetching } = useDashboardStats()

  const pageBg = useColorModeValue(
    'repeating-radial-gradient(circle at 90% 14%, transparent 0 32px, rgba(183,129,21,0.12) 33px 34px, transparent 35px 66px), linear-gradient(135deg, #F9FAF7 0%, #E8EBE9 48%, #F7F7F3 100%)',
    'linear-gradient(135deg, #202321 0%, #303532 52%, #171a19 100%)',
  )
  const panelBg = useColorModeValue('white', '#252927')
  const borderColor = useColorModeValue('rgba(148,163,184,0.28)', 'rgba(148,163,184,0.2)')
  const textPrimary = useColorModeValue('gray.800', 'gray.100')
  const textSecondary = useColorModeValue('gray.600', 'gray.400')
  const tileBg = useColorModeValue('gray.50', 'rgba(148,163,184,0.1)')

  const stats = statsData?.data || {}
  const todayOps = stats.todayOperations || {}
  const financial = stats.financial || {}
  const operational = stats.operational || {}
  const alerts = stats.alerts || {}
  const couriers = stats.couriers || {}
  const geographic = stats.geographic || {}
  const users = stats.users || {}
  const charts = stats.charts || {}
  const merchantAccountAlerts = alerts.merchantAccounts || {}
  const shipmentPickupAlerts = alerts.shipmentPickups || {}

  const topCouriers = Object.entries(couriers.performance || {})
    .map(([name, value]) => ({
      name,
      count: toNum(value?.count),
      deliveryRate: toNum(value?.deliveryRate),
      revenue: toNum(value?.revenue),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 4)
  const actionSections = [
    {
      title: 'Merchant Account Alerts',
      items: [
        {
          title: 'Account pending for approval',
          value: toNum(merchantAccountAlerts.accountPendingApproval),
          note: 'Merchant accounts waiting for admin approval',
          route: '/admin/users-management?approved=false',
          colorScheme: 'orange',
          icon: <IconUsers size={16} />,
        },
        {
          title: 'New signup, docs not uploaded',
          value: toNum(merchantAccountAlerts.documentsNotUploaded),
          note: 'KYC has not been submitted yet',
          route: '/admin/users-management?kycStatus=pending',
          colorScheme: 'red',
          icon: <IconAlertTriangle size={16} />,
        },
        {
          title: 'Partial documents uploaded',
          value: toNum(merchantAccountAlerts.partialDocumentsUploaded),
          note: 'Some required KYC files are still pending',
          route: '/admin/users-management?kycStatus=verification_in_progress',
          colorScheme: 'yellow',
          icon: <IconUsers size={16} />,
        },
        {
          title: 'Documents missing',
          value: toNum(merchantAccountAlerts.documentsMissing),
          note: 'Required merchant documents are incomplete',
          route: '/admin/users-management?kycStatus=pending',
          colorScheme: 'purple',
          icon: <IconAlertTriangle size={16} />,
        },
      ],
    },
    {
      title: 'Shipment Pickup Alerts',
      items: [
        {
          title: 'Pending for pickup',
          value: toNum(shipmentPickupAlerts.pendingForPickup),
          note: 'Booked shipments still awaiting pickup scan',
          route: '/admin/orders?pickupAlert=pending_for_pickup',
          colorScheme: 'blue',
          icon: <IconTruck size={16} />,
        },
        {
          title: 'Pickup not scheduled',
          value: toNum(shipmentPickupAlerts.pickupNotScheduled),
          note: 'Pickup slot missing or scheduling failed',
          route: '/admin/orders?pickupAlert=not_scheduled',
          colorScheme: 'red',
          icon: <IconPackageExport size={16} />,
        },
      ],
    },
    {
      title: 'Support & Reconciliation',
      items: [
        {
          title: 'Open Tickets',
          value: toNum(alerts.openTickets),
          note: toNum(alerts.overdueTickets) ? `${toNum(alerts.overdueTickets)} overdue` : 'Support triage',
          route: '/admin/support',
          colorScheme: 'red',
          icon: <IconAlertTriangle size={16} />,
        },
        {
          title: 'Pending KYC',
          value: toNum(alerts.pendingKyc),
          note: 'Verification queue',
          route: '/admin/users-management?kycStatus=verification_in_progress',
          colorScheme: 'orange',
          icon: <IconUsers size={16} />,
        },
        {
          title: 'Weight Disputes',
          value: toNum(alerts.weightDiscrepancies),
          note: 'Review reconciliation',
          route: '/admin/weight-reconciliation',
          colorScheme: 'blue',
          icon: <IconAlertTriangle size={16} />,
        },
      ],
    },
  ]

  if (isLoading) {
    return (
      <Flex justify="center" align="center" minH="65vh">
        <VStack spacing={4}>
          <Spinner size="xl" color="brand.500" thickness="4px" />
          <Text color={textSecondary}>Loading dashboard...</Text>
        </VStack>
      </Flex>
    )
  }

  if (error) {
    return (
      <Flex justify="center" align="center" minH="65vh">
        <VStack spacing={3}>
          <Text color="red.500" fontWeight="700" fontSize="lg">
            Failed to load dashboard data
          </Text>
          <Button size="sm" onClick={() => refetch()} leftIcon={<IconRefresh size={16} />}>
            Retry
          </Button>
        </VStack>
      </Flex>
    )
  }

  return (
    <Box minH="100vh" pb={8} bg={pageBg} className="kb-logistics-dashboard-pattern">
      <Container maxW="full" pt="0" px={{ base: 4, md: 6 }}>
        <Box mb={6}>
          <PageHeader
            eyebrow="Kourier Boyz Admin"
            title="Control tower for operations, support and revenue"
            description="Track today's shipment flow, courier performance, support risk and cash movement from one focused view."
            meta={[
              { label: 'Today orders', value: toNum(todayOps.orders).toLocaleString() },
              { label: 'Delivery success', value: `${toNum(operational.deliverySuccessRate)}%` },
              { label: 'Net revenue', value: formatCurrency(financial.totalRevenue) },
            ]}
            actions={
              <HStack spacing={3} justify={{ base: 'stretch', xl: 'flex-end' }} flexWrap="wrap">
                <Button
                  size="sm"
                  leftIcon={isRefetching ? <Spinner size="sm" /> : <IconRefresh size={16} />}
                  isLoading={isRefetching}
                  onClick={() => refetch()}
                  bg="brand.500"
                  color="white"
                  borderRadius="14px"
                  px={5}
                  _hover={{ bg: 'brand.600' }}
                >
                  Refresh data
                </Button>
                <Button size="sm" variant="outline" borderColor={borderColor} borderRadius="14px" onClick={() => history.push('/admin/orders')}>
                  View orders
                </Button>
              </HStack>
            }
          />
        </Box>

        <SimpleGrid columns={{ base: 1, sm: 2, xl: 4 }} spacing={4} mb={6}>
          <MetricTile
            label="Today orders"
            value={toNum(todayOps.orders).toLocaleString()}
            muted={`${toNum(todayOps.pending)} of today's orders pending dispatch`}
            icon={<IconPackageExport size={18} />}
            accent="brand.500"
          />
          <MetricTile
            label="Delivery success"
            value={`${toNum(operational.deliverySuccessRate)}%`}
            muted={`${toNum(operational.deliveredOrders)} delivered out of ${toNum(operational.totalOrders)} orders`}
            icon={<IconCheck size={18} />}
            accent="green.500"
          />
          <MetricTile
            label="NDR rate"
            value={`${toNum(operational.ndrRate)}%`}
            muted={`${toNum(operational.ndrOrders)} active NDR orders`}
            icon={<IconAlertTriangle size={18} />}
            accent="orange.500"
          />
          <MetricTile
            label="Net revenue"
            value={formatCurrency(financial.totalRevenue)}
            muted={`Today ${formatCurrency(financial.todayRevenue)} | Freight - courier cost`}
            icon={<IconCoinRupee size={18} />}
            accent="secondary.500"
          />
        </SimpleGrid>

        <Grid templateColumns={{ base: '1fr', xl: '1.45fr 1fr' }} gap={6} mb={6}>
          <Card bg={panelBg} borderWidth="1px" borderColor={borderColor} borderRadius="16px" h="full">
            <CardHeader p={5} pb={2}>
              <Heading size="sm" color={textPrimary}>Orders Trend (7 days)</Heading>
              <Text fontSize="sm" color={textSecondary} mt={1}>Shipment volume by day</Text>
            </CardHeader>
            <CardBody p={5} pt={2}>
              <Box h={{ base: '240px', md: '320px' }}>
                <OrdersLineChart data={charts.ordersByDate || []} />
              </Box>
            </CardBody>
          </Card>

          <Card bg={panelBg} borderWidth="1px" borderColor={borderColor} borderRadius="16px" h="full">
            <CardHeader p={5} pb={2}>
              <Heading size="sm" color={textPrimary}>Action Queue</Heading>
              <Text fontSize="sm" color={textSecondary} mt={1}>Operational items needing attention</Text>
            </CardHeader>
            <CardBody p={5} pt={2}>
              <VStack spacing={4} align="stretch">
                {actionSections.map((section) => (
                  <Box key={section.title}>
                    <Text
                      mb={2}
                      fontSize="xs"
                      fontWeight="800"
                      color={textSecondary}
                      letterSpacing="0.45px"
                      textTransform="uppercase"
                    >
                      {section.title}
                    </Text>
                    <VStack spacing={2.5} align="stretch">
                      {section.items.map((item) => (
                        <Flex
                          key={item.title}
                          p={3.5}
                          borderRadius="12px"
                          borderWidth="1px"
                          borderColor={`${item.colorScheme}.200`}
                          bg={`${item.colorScheme}.50`}
                          justify="space-between"
                          align="center"
                          cursor="pointer"
                          onClick={() => history.push(item.route)}
                          _hover={{ transform: 'translateY(-1px)' }}
                          transition="all 0.2s"
                          gap={3}
                        >
                          <HStack spacing={3} minW={0}>
                            <Flex
                              w="30px"
                              h="30px"
                              align="center"
                              justify="center"
                              borderRadius="10px"
                              bg="white"
                              color={`${item.colorScheme}.600`}
                              flexShrink={0}
                            >
                              {item.icon}
                            </Flex>
                            <Box minW={0}>
                              <Text fontSize="sm" fontWeight="700" color={textPrimary}>
                                {item.title}
                              </Text>
                              <Text fontSize="xs" color={textSecondary}>
                                {item.note}
                              </Text>
                            </Box>
                          </HStack>
                          <Badge colorScheme={item.colorScheme} borderRadius="full" flexShrink={0}>
                            {item.value}
                          </Badge>
                        </Flex>
                      ))}
                    </VStack>
                  </Box>
                ))}
              </VStack>
            </CardBody>
          </Card>
        </Grid>

        <Grid templateColumns={{ base: '1fr', xl: '1fr 1fr' }} gap={6} mb={6}>
          <Card bg={panelBg} borderWidth="1px" borderColor={borderColor} borderRadius="16px" h="full">
            <CardHeader p={5} pb={2}>
              <Heading size="sm" color={textPrimary}>Revenue Trend (7 days)</Heading>
              <Text fontSize="sm" color={textSecondary} mt={1}>Net revenue performance</Text>
            </CardHeader>
            <CardBody p={5} pt={2}>
              <Box h={{ base: '240px', md: '300px' }}>
                <RevenueBarChart data={charts.revenueByDate || []} />
              </Box>
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3} mt={4}>
                <Box p={3.5} borderRadius="12px" borderWidth="1px" borderColor={borderColor} bg={tileBg}>
                  <Text fontSize="xs" textTransform="uppercase" letterSpacing="0.45px" color={textSecondary} fontWeight="700">
                    COD Outstanding
                  </Text>
                  <Text mt={1} fontWeight="800" color={textPrimary}>{formatCurrency(financial.codRemittanceDue)}</Text>
                </Box>
                <Box p={3.5} borderRadius="12px" borderWidth="1px" borderColor={borderColor} bg={tileBg}>
                  <Text fontSize="xs" textTransform="uppercase" letterSpacing="0.45px" color={textSecondary} fontWeight="700">
                    Total COD Value
                  </Text>
                  <Text mt={1} fontWeight="800" color={textPrimary}>{formatCurrency(financial.codAmount)}</Text>
                </Box>
              </SimpleGrid>
            </CardBody>
          </Card>

          <Card bg={panelBg} borderWidth="1px" borderColor={borderColor} borderRadius="16px" h="full">
            <CardHeader p={5} pb={2}>
              <Heading size="sm" color={textPrimary}>Courier Snapshot</Heading>
              <Text fontSize="sm" color={textSecondary} mt={1}>Top couriers by volume</Text>
            </CardHeader>
            <CardBody p={5} pt={2}>
              <VStack spacing={3} align="stretch">
                {topCouriers.length === 0 ? (
                  <Text fontSize="sm" color={textSecondary}>No courier data available.</Text>
                ) : (
                  topCouriers.map((courier, index) => (
                    <Box key={courier.name} p={3.5} borderRadius="12px" borderWidth="1px" borderColor={borderColor} bg={tileBg}>
                      <HStack justify="space-between" mb={2}>
                        <HStack spacing={2}>
                          <Badge borderRadius="full">{index + 1}</Badge>
                          <Text fontSize="sm" fontWeight="700" color={textPrimary}>{courier.name}</Text>
                        </HStack>
                        <Text fontSize="sm" color={textSecondary}>{courier.count} orders</Text>
                      </HStack>
                      <HStack justify="space-between" mb={2}>
                        <Text fontSize="xs" color={textSecondary}>Delivery Rate</Text>
                        <Text fontSize="xs" color={textSecondary}>{courier.deliveryRate}%</Text>
                      </HStack>
                      <Progress size="sm" borderRadius="full" value={courier.deliveryRate} colorScheme="green" mb={2} />
                      <Text fontSize="xs" color={textSecondary}>Revenue: {formatCurrency(courier.revenue)}</Text>
                    </Box>
                  ))
                )}
              </VStack>
            </CardBody>
          </Card>
        </Grid>

        <Grid templateColumns={{ base: '1fr', xl: '1fr 1fr' }} gap={6}>
          <Card bg={panelBg} borderWidth="1px" borderColor={borderColor} borderRadius="16px" h="full">
            <CardHeader p={5} pb={2}>
              <Heading size="sm" color={textPrimary}>Origin Hotspots</Heading>
            </CardHeader>
            <CardBody p={5} pt={2}>
              <Stack spacing={2.5}>
                {(geographic.topOriginCities || []).length === 0 ? (
                  <Text fontSize="sm" color={textSecondary}>No origin city data yet.</Text>
                ) : (
                  (geographic.topOriginCities || []).slice(0, 5).map((item) => (
                    <HStack key={`origin-${item.city}`} justify="space-between" p={3} borderRadius="10px" borderWidth="1px" borderColor={borderColor} bg={tileBg}>
                      <HStack spacing={2}>
                        <IconMapPin size={16} color="#1F4FA8" />
                        <Text color={textPrimary} fontSize="sm">{item.city}</Text>
                      </HStack>
                      <Badge>{toNum(item.count)}</Badge>
                    </HStack>
                  ))
                )}
              </Stack>
            </CardBody>
          </Card>

          <Card bg={panelBg} borderWidth="1px" borderColor={borderColor} borderRadius="16px" h="full">
            <CardHeader p={5} pb={2}>
              <Heading size="sm" color={textPrimary}>Destination Hotspots</Heading>
            </CardHeader>
            <CardBody p={5} pt={2}>
              <Stack spacing={2.5}>
                {(geographic.topDestinationCities || []).length === 0 ? (
                  <Text fontSize="sm" color={textSecondary}>No destination city data yet.</Text>
                ) : (
                  (geographic.topDestinationCities || []).slice(0, 5).map((item) => (
                    <HStack key={`dest-${item.city}`} justify="space-between" p={3} borderRadius="10px" borderWidth="1px" borderColor={borderColor} bg={tileBg}>
                      <HStack spacing={2}>
                        <IconMapPin size={16} color="#F57C22" />
                        <Text color={textPrimary} fontSize="sm">{item.city}</Text>
                      </HStack>
                      <Badge>{toNum(item.count)}</Badge>
                    </HStack>
                  ))
                )}
              </Stack>
            </CardBody>
          </Card>
        </Grid>
      </Container>
    </Box>
  )
}
