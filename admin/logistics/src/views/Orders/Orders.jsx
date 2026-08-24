import {
  Box,
  Button,
  Flex,
  Grid,
  HStack,
  Icon,
  Text,
  Select,
  useToast,
} from '@chakra-ui/react'
import MetricTile from 'components/Admin/MetricTile'
import PageHeader from 'components/Admin/PageHeader'
import Card from 'components/Card/Card'
import CardBody from 'components/Card/CardBody'
import OrdersTable from 'components/Tables/OrdersTable'
import TableFilters from 'components/Tables/TableFilters'
import { useOrders } from 'hooks/useOrders'
import { useEffect, useMemo, useState } from 'react'
import {
  FiAlertTriangle,
  FiCheckCircle,
  FiDownload,
  FiPackage,
  FiRefreshCw,
  FiTruck,
  FiXCircle,
} from 'react-icons/fi'
import { useLocation } from 'react-router-dom'
import { exportOrdersToCSV } from 'services/order.service'

const getRouteFiltersFromSearch = (search) => {
  const params = new URLSearchParams(search)
  return {
    status: params.get('status') || '',
    statusGroup: params.get('statusGroup') || '',
    pickupAlert: params.get('pickupAlert') || '',
    search: params.get('search') || '',
    fromDate: params.get('fromDate') || '',
    toDate: params.get('toDate') || '',
  }
}

const STATUS_GROUPS = {
  pending: ['pending', 'booked'],
  pickup: [
    'pickup_initiated',
    'pickup_requested',
    'manifested',
    'manifest_pending',
  ],
  shipped: [
    'shipment_created',
    'in_transit',
    'out_for_delivery',
  ],
  ndr: [
    'ndr',
    'undelivered',
    'lost',
    'address_issue',
    'nsl',
    'delivery_attempt_failed',
    'door_closed',
    'attempt_undelivered',
    'customer_not_available',
    'customer_unavailable',
    'consignee_not_available',
    'consignee_unavailable',
  ],
  delivered: ['delivered'],
  rto: ['rto', 'rto_in_transit', 'rto_delivered'],
  failed: ['failed', 'manifest_failed'],
  cancelled: ['cancelled', 'cancellation_requested'],
}

const buildFallbackStatusSummary = (orders = [], totalCount = 0) => {
  const summary = {
    total: totalCount || orders.length,
    pending: 0,
    pickup: 0,
    shipped: 0,
    ndr: 0,
    delivered: 0,
    rto: 0,
    failed: 0,
    cancelled: 0,
    other: 0,
    byStatus: {},
  }

  orders.forEach((order) => {
    const status = String(order?.order_status || 'pending').trim().toLowerCase()
    summary.byStatus[status] = (summary.byStatus[status] || 0) + 1

    const groupKey = Object.keys(STATUS_GROUPS).find((key) => STATUS_GROUPS[key].includes(status))
    if (groupKey) {
      summary[groupKey] += 1
    } else {
      summary.other += 1
    }
  })

  return summary
}

const Orders = () => {
  const location = useLocation()
  const initialRouteFilters = getRouteFiltersFromSearch(location.search)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [filters, setFilters] = useState({
    status: '',
    statusGroup: '',
    pickupAlert: '',
    sortBy: 'created_at',
    sortOrder: 'desc',
    search: '',
    fromDate: '',
    toDate: '',
    ...initialRouteFilters,
  })
  const [isExporting, setIsExporting] = useState(false)

  const { data: ordersData, isLoading, isFetching, refetch } = useOrders(page, limit, filters)
  const toast = useToast()

  useEffect(() => {
    const nextRouteFilters = getRouteFiltersFromSearch(location.search)
    setFilters((prev) => {
      return {
        ...prev,
        ...nextRouteFilters,
      }
    })
    setPage(1)
  }, [location.search])

  // Calculate statistics
  const stats = useMemo(() => {
    const orders = ordersData?.orders || []
    return ordersData?.statusSummary || buildFallbackStatusSummary(orders, ordersData?.totalCount || 0)
  }, [ordersData])

  const handleStatusFilter = (statusValue = '') => {
    setFilters((prev) => ({
      ...prev,
      status: statusValue,
      statusGroup: '',
    }))
    setPage(1)
  }

  const handleStatusGroupFilter = (statusGroup = '') => {
    setFilters((prev) => ({
      ...prev,
      status: '',
      statusGroup,
    }))
    setPage(1)
  }

  const isStatusActive = (statusValue = '') => filters.status === statusValue
  const isStatusGroupActive = (statusGroup = '') => filters.statusGroup === statusGroup

  const handleExport = async () => {
    try {
      setIsExporting(true)
      await exportOrdersToCSV(filters)
      toast({
        title: 'Export successful',
        description: 'Orders have been exported to CSV',
        status: 'success',
        duration: 3000,
        isClosable: true,
      })
    } catch (error) {
      toast({
        title: 'Export failed',
        description: error.message || 'Failed to export orders',
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
    } finally {
      setIsExporting(false)
    }
  }

  const filterOptions = [
    {
      key: 'search',
      label: 'Search',
      type: 'search',
      placeholder: 'Search by Order ID, AWB, or Customer...',
    },
    {
      key: 'status',
      label: 'Order Status',
      type: 'select',
      placeholder: 'All Statuses',
      options: [
        { value: 'pending', label: 'Pending' },
        { value: 'booked', label: 'Booked' },
        { value: 'pickup_requested', label: 'Pickup Requested' },
        { value: 'pickup_initiated', label: 'Pickup Initiated' },
        { value: 'shipment_created', label: 'Shipment Created' },
        { value: 'manifested', label: 'Manifested' },
        { value: 'manifest_pending', label: 'Manifest Pending' },
        { value: 'manifest_failed', label: 'Manifest Failed' },
        { value: 'failed', label: 'Failed' },
        { value: 'in_transit', label: 'In Transit' },
        { value: 'out_for_delivery', label: 'Out for Delivery' },
        { value: 'ndr', label: 'NDR' },
        { value: 'undelivered', label: 'Undelivered' },
        { value: 'delivered', label: 'Delivered' },
        { value: 'cancellation_requested', label: 'Cancellation Requested' },
        { value: 'cancelled', label: 'Cancelled' },
        { value: 'rto', label: 'RTO' },
        { value: 'rto_in_transit', label: 'RTO In Transit' },
        { value: 'rto_delivered', label: 'RTO Delivered' },
      ],
    },
    {
      key: 'fromDate',
      label: 'From Date',
      type: 'date',
      placeholder: 'Start Date',
    },
    {
      key: 'toDate',
      label: 'To Date',
      type: 'date',
      placeholder: 'End Date',
    },
    {
      key: 'pickupAlert',
      label: 'Pickup Alert',
      type: 'select',
      placeholder: 'All Pickup Alerts',
      options: [
        { value: 'pending_for_pickup', label: 'Pending for pickup' },
        { value: 'not_scheduled', label: 'Pickup not scheduled' },
      ],
    },
  ]

  return (
    <Box pt={{ base: '120px', md: '75px' }}>
      <Box mb={6}>
        <PageHeader
          eyebrow="Orders"
          title="Shipment desk for every live order"
          description="Review order flow, surface risky shipments early and move from investigation to action without leaving the queue."
          meta={[
            { label: 'Total orders', value: stats.total.toLocaleString() },
            { label: 'Pending', value: stats.pending.toLocaleString() },
            { label: 'Delivered', value: stats.delivered.toLocaleString() },
          ]}
          actions={
            <HStack spacing={3} flexWrap="wrap">
              <Button
                leftIcon={<FiRefreshCw />}
                onClick={() => refetch()}
                isLoading={isFetching}
                variant="outline"
                size="sm"
                borderRadius="14px"
              >
                Refresh
              </Button>
              <Button
                leftIcon={<FiDownload />}
                onClick={handleExport}
                isLoading={isExporting}
                loadingText="Exporting..."
                bg="brand.500"
                color="white"
                size="sm"
                borderRadius="14px"
                _hover={{ bg: 'brand.600' }}
              >
                Export CSV
              </Button>
            </HStack>
          }
        />
      </Box>

      <Grid
        templateColumns={{
          base: '1fr',
          md: 'repeat(2, 1fr)',
          xl: 'repeat(4, 1fr)',
        }}
        gap={4}
        mb={5}
      >
        <MetricTile
          label="Total"
          value={stats.total}
          muted="All orders in current result set"
          icon={<Icon as={FiPackage} w={5} h={5} />}
          onClick={() => handleStatusFilter('')}
          active={isStatusActive('')}
        />
        <MetricTile
          label="Pending"
          value={stats.pending}
          muted="Pending or booked"
          icon={<Icon as={FiRefreshCw} w={5} h={5} />}
          accent="orange.500"
          onClick={() => handleStatusGroupFilter('pending')}
          active={isStatusGroupActive('pending')}
        />
        <MetricTile
          label="Pickup"
          value={stats.pickup}
          muted="Pickup or manifest flow"
          icon={<Icon as={FiTruck} w={5} h={5} />}
          accent="brand.500"
          onClick={() => handleStatusGroupFilter('pickup')}
          active={isStatusGroupActive('pickup')}
        />
        <MetricTile
          label="Shipped"
          value={stats.shipped}
          muted="Created, in transit, or OFD"
          icon={<Icon as={FiTruck} w={5} h={5} />}
          accent="teal.500"
          onClick={() => handleStatusGroupFilter('shipped')}
          active={isStatusGroupActive('shipped')}
        />
        <MetricTile
          label="NDR"
          value={stats.ndr}
          muted="Need intervention"
          icon={<Icon as={FiAlertTriangle} w={5} h={5} />}
          accent="secondary.500"
          onClick={() => handleStatusGroupFilter('ndr')}
          active={isStatusGroupActive('ndr')}
        />
        <MetricTile
          label="Delivered"
          value={stats.delivered}
          muted="Closed successfully"
          icon={<Icon as={FiCheckCircle} w={5} h={5} />}
          accent="green.500"
          onClick={() => handleStatusGroupFilter('delivered')}
          active={isStatusGroupActive('delivered')}
        />
        <MetricTile
          label="RTO"
          value={stats.rto}
          muted="Return flow orders"
          icon={<Icon as={FiRefreshCw} w={5} h={5} />}
          accent="purple.500"
          onClick={() => handleStatusGroupFilter('rto')}
          active={isStatusGroupActive('rto')}
        />
        <MetricTile
          label="Failed"
          value={stats.failed + (stats.other || 0)}
          muted={stats.other ? `${stats.other} uncategorised statuses` : 'Failed or manifest failed'}
          icon={<Icon as={FiAlertTriangle} w={5} h={5} />}
          accent="red.500"
          onClick={() => handleStatusGroupFilter('failed')}
          active={isStatusGroupActive('failed')}
        />
        <MetricTile
          label="Cancelled"
          value={stats.cancelled}
          muted="Cancelled or requested"
          icon={<Icon as={FiXCircle} w={5} h={5} />}
          accent="red.500"
          onClick={() => handleStatusGroupFilter('cancelled')}
          active={isStatusGroupActive('cancelled')}
        />
      </Grid>

      <Flex justify="space-between" align={{ base: 'stretch', md: 'center' }} direction={{ base: 'column', md: 'row' }} gap={3} mb={4}>
        <Text fontSize="sm" color="gray.500">
          Use the status tiles for quick triage, then narrow the queue with filters below.
        </Text>
        <HStack spacing={3} align="center">
          <Text fontSize="sm" color="gray.500">
            Sort by Created At
          </Text>
          <Select
            size="sm"
            w="180px"
            borderRadius="14px"
            value={filters.sortOrder}
            onChange={(e) => {
              setFilters((prev) => ({
                ...prev,
                sortBy: 'created_at',
                sortOrder: e.target.value,
              }))
              setPage(1)
            }}
          >
            <option value="desc">Newest first</option>
            <option value="asc">Oldest first</option>
          </Select>
        </HStack>
      </Flex>

      <Card mb={4} boxShadow="sm" borderRadius="24px">
        <CardBody p={{ base: 4, md: 5 }}>
          <TableFilters
            filters={filterOptions}
            values={filters}
            onApply={(appliedFilters) => {
              setFilters((prev) => ({
                ...appliedFilters,
                statusGroup: '',
                sortBy: prev.sortBy || 'created_at',
                sortOrder: prev.sortOrder || 'desc',
              }))
              setPage(1)
            }}
            actions={[]}
            showActiveFiltersCount={true}
            cardStyle={false}
          />
        </CardBody>
      </Card>
      <OrdersTable
        orders={ordersData?.orders}
        totalCount={ordersData?.totalCount}
        page={page}
        setPage={setPage}
        perPage={limit}
        setPerPage={setLimit}
        loading={isLoading || isFetching}
        onRefresh={refetch}
      />
    </Box>
  )
}

export default Orders
