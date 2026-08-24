import {
  App,
  Button,
  Card,
  DatePicker,
  Empty,
  Input,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd'
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table'
import dayjs from 'dayjs'
import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useBulkUpdateSellerOrderStatus, useSellerOrders } from '../../api/orderQueries'
import type { SellerOrder, SellerOrderBatch, SellerShipmentStatus } from '../../api/orders'
import RequestPickupModal from '../../components/orders/RequestPickupModal'
import ShipOrderModal from '../../components/orders/ShipOrderModal'
import { useAuthStore } from '../../store/authStore'

const { RangePicker } = DatePicker
const { Title, Text } = Typography

const statusColors: Record<SellerShipmentStatus, string> = {
  pending: 'default',
  processing: 'blue',
  ready_to_ship: 'gold', // Keep for backward compatibility
  pickup_requested: 'cyan',
  shipped: 'blue',
  in_transit: 'purple',
  out_for_delivery: 'orange',
  delivered: 'green',
  cancelled: 'red',
}

const paymentColors: Record<string, string> = {
  paid: 'green',
  pending: 'gold',
  failed: 'red',
  refunded: 'purple',
}

const OrdersList = () => {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const status = searchParams.get('status') ?? undefined
  const [search, setSearch] = useState('')
  const [paymentStatus, setPaymentStatus] = useState<string | undefined>()
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([null, null])
  const [pagination, setPagination] = useState<TablePaginationConfig>({
    current: 1,
    pageSize: 10,
  })
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [activeOrder, setActiveOrder] = useState<SellerOrder | undefined>()
  const [pickupModalOpen, setPickupModalOpen] = useState(false)
  const [shipModalOpen, setShipModalOpen] = useState(false)
  const [bulkMode, setBulkMode] = useState<'pickup' | 'ship' | null>(null)
  const [bulkQueue, setBulkQueue] = useState<SellerOrder[]>([])

  const pickupAddresses = useAuthStore((state) => state.user?.pickupAddresses || [])

  const bulkStatusMutation = useBulkUpdateSellerOrderStatus()

  const { data, isLoading } = useSellerOrders({
    status,
    paymentStatus,
    fromDate: dateRange[0]?.startOf('day').toISOString(),
    toDate: dateRange[1]?.endOf('day').toISOString(),
    search,
    page: pagination.current,
    limit: pagination.pageSize,
  })

  // API already returns data batch-wise
  const batches: SellerOrderBatch[] = useMemo(() => data?.data || [], [data?.data])

  const selectedBatches: SellerOrderBatch[] = useMemo(
    () =>
      batches.filter((batch) =>
        selectedRowKeys.includes(batch.batchId || (batch.orders[0]?._id as string)),
      ),
    [batches, selectedRowKeys],
  )

  // Flatten selected batches into underlying orders for bulk operations
  const selectedOrders: SellerOrder[] = useMemo(
    () => selectedBatches.flatMap((batch) => batch.orders),
    [selectedBatches],
  )

  const columns: ColumnsType<SellerOrderBatch> = useMemo(
    () => [
      {
        title: 'Order Group',
        dataIndex: 'batchId',
        render: (_: unknown, record: SellerOrderBatch) => {
          const summary = record.summary
          const orderCount = summary?.orderCount ?? record.orders?.length ?? 0

          return (
            <Text
              strong
              className="cursor-pointer text-blue-600"
              onClick={() =>
                record.batchId
                  ? navigate(`/orders/batch/${record.batchId}`)
                  : navigate(`/orders/${record.orders[0]?._id}`)
              }
            >
              {record.batchCode
                ? `${record.batchCode} (${orderCount} orders)`
                : record.batchId
                ? `Group ${record.batchId.slice(-6)} (${orderCount} orders)`
                : record.orders[0]?._id}
            </Text>
          )
        },
      },
      {
        title: 'Buyer',
        dataIndex: 'buyerNames',
        render: (value: string, record: SellerOrderBatch) => (
          <div>
            <div className="font-medium">
              {value || record.summary?.buyerNames || record.orders?.[0]?.buyer?.name}
            </div>
            <div className="text-xs text-gray-500">{record.orders?.[0]?.buyer?.email}</div>
          </div>
        ),
      },
      {
        title: 'Status',
        dataIndex: 'status',
        render: (_: SellerShipmentStatus | 'mixed', record: SellerOrderBatch) => {
          const summaryStatus = record.summary?.status
          const value = summaryStatus || record.orders?.[0]?.status
          return (
            <Tag color={value === 'mixed' ? 'purple' : statusColors[value] || 'default'}>
              {value === 'mixed' ? 'Mixed' : value?.replace(/_/g, ' ')}
            </Tag>
          )
        },
      },
      {
        title: 'Payment',
        dataIndex: 'paymentStatus',
        render: (_: SellerOrder['paymentStatus'] | 'mixed', record: SellerOrderBatch) => {
          const summaryPayment = record.summary?.paymentStatus
          const value = summaryPayment || record.orders?.[0]?.paymentStatus
          if (value === 'mixed') {
            return <Tag color="purple">Mixed</Tag>
          }
          return <Tag color={paymentColors[value] || 'default'}>{value}</Tag>
        },
      },
      {
        title: 'Total',
        dataIndex: 'total',
        render: (_: number, record: SellerOrderBatch) => {
          const summaryTotal = record.summary?.total
          const total =
            typeof summaryTotal === 'number'
              ? summaryTotal
              : (record.orders || []).reduce((sum, o) => sum + (o.total || 0), 0)
          return `₹${total.toFixed(2)}`
        },
      },
      {
        title: 'Ordered at',
        dataIndex: 'orderedAt',
        render: (_: string, record: SellerOrderBatch) =>
          dayjs(record.summary?.orderedAt || record.orders?.[0]?.orderedAt).format(
            'DD MMM YYYY, HH:mm',
          ),
      },
      {
        title: 'Actions',
        key: 'actions',
        render: (_: unknown, record: SellerOrderBatch) => (
          <Space size="small">
            <Button
              type="link"
              size="small"
              onClick={() =>
                record.batchId
                  ? navigate(`/orders/batch/${record.batchId}`)
                  : navigate(`/orders/${record.orders[0]?._id}`)
              }
            >
              View
            </Button>
            {/* Use first order in batch to determine quick per-row actions */}
            {record.orders?.[0]?.status === 'processing' && (
              <Button
                type="link"
                size="small"
                onClick={() => {
                  setBulkMode(null)
                  setBulkQueue([])
                  setActiveOrder(record.orders[0])
                  setPickupModalOpen(true)
                }}
              >
                Request Pickup
              </Button>
            )}
            {record.orders?.[0]?.canShip && record.orders?.[0]?.status !== 'processing' && (
              <Button
                type="link"
                size="small"
                onClick={() => {
                  setBulkMode(null)
                  setBulkQueue([])
                  setActiveOrder(record.orders[0])
                  setShipModalOpen(true)
                }}
              >
                Ship
              </Button>
            )}
          </Space>
        ),
      },
    ],
    [navigate],
  )

  const handleTableChange = (nextPagination: TablePaginationConfig) => {
    setPagination(nextPagination)
  }

  const handleBulkPickup = () => {
    const eligible = selectedOrders.filter((order) => order.status === 'processing')
    if (eligible.length === 0) {
      message.warning('Select at least one order in processing status to request pickup')
      return
    }
    setBulkMode('pickup')
    setBulkQueue(eligible)
    setActiveOrder(eligible[0])
    setPickupModalOpen(true)
  }

  const handleBulkMarkProcessing = () => {
    const eligible = selectedOrders.filter((order) => order.sellerShipment?.status === 'pending')
    if (eligible.length === 0) {
      message.warning('Select at least one order in pending status to mark as processing')
      return
    }

    bulkStatusMutation.mutate(
      {
        status: 'processing',
        orderIds: eligible.map((o) => o._id),
      },
      {
        onSuccess: () => {
          message.success('Selected orders marked as processing')
        },
        onError: (error) => {
          message.error((error as Error)?.message || 'Failed to update status')
        },
      },
    )
  }

  const handlePickupSuccess = () => {
    if (bulkMode === 'pickup') {
      const [, ...rest] = bulkQueue
      if (rest.length > 0) {
        setBulkQueue(rest)
        setActiveOrder(rest[0])
      } else {
        setBulkMode(null)
        setBulkQueue([])
        setActiveOrder(undefined)
        setPickupModalOpen(false)
      }
    } else {
      setPickupModalOpen(false)
      setActiveOrder(undefined)
    }
  }

  const handleShipSuccess = () => {
    if (bulkMode === 'ship') {
      const [, ...rest] = bulkQueue
      if (rest.length > 0) {
        setBulkQueue(rest)
        setActiveOrder(rest[0])
      } else {
        setBulkMode(null)
        setBulkQueue([])
        setActiveOrder(undefined)
        setShipModalOpen(false)
      }
    } else {
      setShipModalOpen(false)
      setActiveOrder(undefined)
    }
  }

  const rowSelection = {
    selectedRowKeys,
    onChange: (newSelectedRowKeys: React.Key[]) => {
      setSelectedRowKeys(newSelectedRowKeys)
    },
  }

  return (
    <Card>
      <Space direction="vertical" size="large" className="w-full">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <Title level={4} className="mb-0">
              Orders
            </Title>
            <Text type="secondary">Monitor and manage incoming orders</Text>
          </div>
          <Space wrap>
            <Button
              disabled={selectedRowKeys.length === 0 || bulkStatusMutation.isPending}
              onClick={handleBulkMarkProcessing}
            >
              Mark Processing for Selected
            </Button>
            <Button
              type="primary"
              disabled={selectedRowKeys.length === 0}
              onClick={handleBulkPickup}
            >
              Request Pickup for Selected
            </Button>
          </Space>
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          <Input.Search
            placeholder="Search by order ID or buyer"
            allowClear
            onSearch={(value) => {
              setSearch(value)
              setPagination((prev) => ({ ...prev, current: 1 }))
            }}
            style={{ width: 250 }}
          />
          <Select
            placeholder="Status"
            allowClear
            style={{ width: 180 }}
            value={status || null}
            onChange={(value) => {
              setSearchParams((prev) => {
                const next = new URLSearchParams(prev)
                if (value) next.set('status', value)
                else next.delete('status')
                return next
              })
              setPagination((prev) => ({ ...prev, current: 1 }))
            }}
            options={[
              { value: 'pending', label: 'Pending' },
              { value: 'processing', label: 'Processing' },
              { value: 'ready_to_ship', label: 'Ready to Ship' },
              { value: 'pickup_requested', label: 'Pickup Requested' },
              { value: 'shipped', label: 'Shipped' },
              { value: 'in_transit', label: 'In Transit' },
              { value: 'out_for_delivery', label: 'Out for Delivery' },
              { value: 'delivered', label: 'Delivered' },
              { value: 'cancelled', label: 'Cancelled' },
            ]}
          />
          <Select
            placeholder="Payment status"
            allowClear
            style={{ width: 180 }}
            value={paymentStatus}
            onChange={(value) => {
              setPaymentStatus(value)
              setPagination((prev) => ({ ...prev, current: 1 }))
            }}
            options={[
              { value: 'paid', label: 'Paid' },
              { value: 'pending', label: 'Pending' },
              { value: 'failed', label: 'Failed' },
              { value: 'refunded', label: 'Refunded' },
            ]}
          />
          <RangePicker
            value={dateRange}
            onChange={(values) => {
              setDateRange(values || [null, null])
              setPagination((prev) => ({ ...prev, current: 1 }))
            }}
          />
        </div>

        <Table<SellerOrderBatch>
          rowKey={(record) => record.batchId || (record.orders[0]?._id as string)}
          loading={isLoading}
          columns={columns}
          dataSource={batches}
          rowSelection={rowSelection}
          pagination={{
            ...pagination,
            total: data?.pagination.total ?? 0,
            showSizeChanger: true,
          }}
          onChange={handleTableChange}
          locale={{ emptyText: <Empty description="No orders found" /> }}
        />
        <RequestPickupModal
          open={pickupModalOpen}
          onClose={() => {
            setPickupModalOpen(false)
            setBulkMode(null)
            setBulkQueue([])
            setActiveOrder(undefined)
          }}
          order={activeOrder}
          shipment={activeOrder?.sellerShipment}
          pickupAddresses={pickupAddresses}
          onSuccess={handlePickupSuccess}
        />
        <ShipOrderModal
          open={shipModalOpen}
          onClose={() => {
            setShipModalOpen(false)
            setBulkMode(null)
            setBulkQueue([])
            setActiveOrder(undefined)
          }}
          onSuccess={handleShipSuccess}
          order={activeOrder}
          shipment={activeOrder?.sellerShipment}
          pickupAddresses={pickupAddresses}
        />
      </Space>
    </Card>
  )
}

export default OrdersList
