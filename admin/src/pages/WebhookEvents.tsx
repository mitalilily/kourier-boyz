import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  CopyOutlined,
  EyeOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import {
  Alert,
  App,
  Button,
  Card,
  DatePicker,
  Empty,
  Input,
  Modal,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getWebhookEvents, type WebhookEvent, type WebhookEventStatus } from '../api/webhooks'

const { RangePicker } = DatePicker
const { Title, Text } = Typography

const statusColors: Record<WebhookEventStatus, string> = {
  pending: 'default',
  processed: 'green',
  failed: 'red',
  retrying: 'orange',
}

const statusIcons: Record<WebhookEventStatus, React.ReactNode> = {
  pending: <ClockCircleOutlined />,
  processed: <CheckCircleOutlined />,
  failed: <CloseCircleOutlined />,
  retrying: <ReloadOutlined />,
}

const WebhookEvents = () => {
  const { message } = App.useApp()
  const [filters, setFilters] = useState({
    status: undefined as WebhookEventStatus | undefined,
    eventType: '',
    razorpayOrderId: '',
    webhookId: '',
    dateRange: [null, null] as [dayjs.Dayjs | null, dayjs.Dayjs | null],
    page: 1,
    limit: 50,
  })

  const [selectedEvent, setSelectedEvent] = useState<WebhookEvent | null>(null)
  const [payloadModalOpen, setPayloadModalOpen] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['webhookEvents', filters],
    queryFn: () =>
      getWebhookEvents({
        page: filters.page,
        limit: filters.limit,
        status: filters.status,
        eventType: filters.eventType || undefined,
        razorpayOrderId: filters.razorpayOrderId || undefined,
        webhookId: filters.webhookId || undefined,
        startDate: filters.dateRange[0]?.startOf('day').toISOString(),
        endDate: filters.dateRange[1]?.endOf('day').toISOString(),
      }),
  })

  const events = data?.events || []
  const pagination = data?.pagination
  const summary = data?.summary

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    message.success(`${label} copied to clipboard`)
  }

  const handleViewPayload = (event: WebhookEvent) => {
    setSelectedEvent(event)
    setPayloadModalOpen(true)
  }

  const columns: ColumnsType<WebhookEvent> = [
    {
      title: 'Webhook ID',
      dataIndex: 'webhookId',
      key: 'webhookId',
      width: 200,
      render: (webhookId: string) => (
        <Space>
          <Text code className="text-xs">
            {webhookId.substring(0, 20)}...
          </Text>
          <Tooltip title="Copy Webhook ID">
            <Button
              type="text"
              size="small"
              icon={<CopyOutlined />}
              onClick={(e) => {
                e.stopPropagation()
                handleCopy(webhookId, 'Webhook ID')
              }}
            />
          </Tooltip>
        </Space>
      ),
    },
    {
      title: 'Event Type',
      dataIndex: 'eventType',
      key: 'eventType',
      width: 180,
      render: (eventType: string) => (
        <Tag color="blue" className="font-mono text-xs">
          {eventType}
        </Tag>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: WebhookEventStatus) => (
        <Tag color={statusColors[status]} icon={statusIcons[status]}>
          {status.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Razorpay Order ID',
      dataIndex: 'razorpayOrderId',
      key: 'razorpayOrderId',
      width: 180,
      render: (orderId: string) => (
        <Text code className="text-xs">
          {orderId}
        </Text>
      ),
    },
    {
      title: 'Payment ID',
      dataIndex: 'razorpayPaymentId',
      key: 'razorpayPaymentId',
      width: 180,
      render: (paymentId: string) =>
        paymentId ? (
          <Text code className="text-xs">
            {paymentId}
          </Text>
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
    {
      title: 'Orders Created',
      dataIndex: 'orderIds',
      key: 'orderIds',
      width: 150,
      render: (orderIds: WebhookEvent['orderIds']) => {
        if (!orderIds || orderIds.length === 0) {
          return <Text type="secondary">-</Text>
        }
        return (
          <Space direction="vertical" size={2}>
            {orderIds.map((order) => (
              <Tag key={order._id} color="cyan">
                {order.orderNumber || order._id.substring(0, 8)}
              </Tag>
            ))}
          </Space>
        )
      },
    },
    {
      title: 'Attempts',
      dataIndex: 'processingAttempts',
      key: 'processingAttempts',
      width: 100,
      render: (attempts: number) => (
        <Tag color={attempts > 1 ? 'orange' : 'default'}>{attempts}</Tag>
      ),
    },
    {
      title: 'Last Error',
      dataIndex: 'lastError',
      key: 'lastError',
      width: 200,
      ellipsis: true,
      render: (error: string) =>
        error ? (
          <Tooltip title={error}>
            <Text type="danger" className="text-xs">
              {error.substring(0, 50)}...
            </Text>
          </Tooltip>
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
    {
      title: 'Received At',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date: string) => dayjs(date).format('DD MMM YYYY, HH:mm:ss'),
    },
    {
      title: 'Processed At',
      dataIndex: 'processedAt',
      key: 'processedAt',
      width: 180,
      render: (date: string) =>
        date ? dayjs(date).format('DD MMM YYYY, HH:mm:ss') : <Text type="secondary">-</Text>,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      fixed: 'right' as const,
      render: (_: unknown, record: WebhookEvent) => (
        <Space size={4}>
          <Tooltip title="View Payload">
            <Button
              type="default"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleViewPayload(record)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ]

  return (
    <Card>
      <Space direction="vertical" size="large" className="w-full">
        <Alert
          message="Development & Audit Purposes Only"
          description="This page is for development debugging and audit purposes. Use it to monitor webhook processing, troubleshoot payment issues, and verify webhook event handling."
          type="warning"
          showIcon
          closable
        />

        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <Title level={4} className="mb-0">
              Webhook Events
            </Title>
            <Text type="secondary">Monitor and debug webhook processing</Text>
          </div>
        </div>

        {/* Summary Statistics */}
        {summary && (
          <div className="grid grid-cols-4 gap-4">
            <Card>
              <Statistic
                title="Pending"
                value={summary.pending}
                valueStyle={{ color: '#8c8c8c' }}
                prefix={<ClockCircleOutlined />}
              />
            </Card>
            <Card>
              <Statistic
                title="Processed"
                value={summary.processed}
                valueStyle={{ color: '#52c41a' }}
                prefix={<CheckCircleOutlined />}
              />
            </Card>
            <Card>
              <Statistic
                title="Failed"
                value={summary.failed}
                valueStyle={{ color: '#ff4d4f' }}
                prefix={<CloseCircleOutlined />}
              />
            </Card>
            <Card>
              <Statistic
                title="Retrying"
                value={summary.retrying}
                valueStyle={{ color: '#fa8c16' }}
                prefix={<ReloadOutlined />}
              />
            </Card>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <Input.Search
            placeholder="Search Webhook ID"
            allowClear
            style={{ width: 220 }}
            value={filters.webhookId}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                webhookId: e.target.value,
                page: 1,
              }))
            }
            onSearch={() => setFilters((prev) => ({ ...prev, page: 1 }))}
          />
          <Input.Search
            placeholder="Razorpay Order ID"
            allowClear
            style={{ width: 220 }}
            value={filters.razorpayOrderId}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                razorpayOrderId: e.target.value,
                page: 1,
              }))
            }
            onSearch={() => setFilters((prev) => ({ ...prev, page: 1 }))}
          />
          <Input.Search
            placeholder="Event Type"
            allowClear
            style={{ width: 200 }}
            value={filters.eventType}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                eventType: e.target.value,
                page: 1,
              }))
            }
            onSearch={() => setFilters((prev) => ({ ...prev, page: 1 }))}
          />
          <Select
            placeholder="Status"
            allowClear
            style={{ width: 150 }}
            value={filters.status}
            onChange={(value) =>
              setFilters((prev) => ({
                ...prev,
                status: value,
                page: 1,
              }))
            }
          >
            <Select.Option value="pending">Pending</Select.Option>
            <Select.Option value="processed">Processed</Select.Option>
            <Select.Option value="failed">Failed</Select.Option>
            <Select.Option value="retrying">Retrying</Select.Option>
          </Select>
          <RangePicker
            placeholder={['Start Date', 'End Date']}
            value={filters.dateRange}
            onChange={(dates) =>
              setFilters((prev) => ({
                ...prev,
                dateRange: dates || [null, null],
                page: 1,
              }))
            }
            showTime
            format="DD/MM/YYYY HH:mm"
          />
        </div>

        {/* Table */}
        <Table
          columns={columns}
          dataSource={events}
          loading={isLoading}
          rowKey="_id"
          scroll={{ x: 1500 }}
          pagination={{
            current: pagination?.page || 1,
            pageSize: pagination?.limit || 50,
            total: pagination?.total || 0,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} webhook events`,
            onChange: (page, pageSize) => {
              setFilters((prev) => ({
                ...prev,
                page,
                limit: pageSize,
              }))
            },
          }}
          locale={{
            emptyText: <Empty description="No webhook events found" />,
          }}
        />
      </Space>

      {/* Payload Modal */}
      <Modal
        title="Webhook Payload"
        open={payloadModalOpen}
        onCancel={() => {
          setPayloadModalOpen(false)
          setSelectedEvent(null)
        }}
        footer={[
          <Button
            key="copy"
            icon={<CopyOutlined />}
            onClick={() => {
              if (selectedEvent) {
                handleCopy(JSON.stringify(selectedEvent.payload, null, 2), 'Payload')
              }
            }}
          >
            Copy JSON
          </Button>,
          <Button key="close" onClick={() => setPayloadModalOpen(false)}>
            Close
          </Button>,
        ]}
        width={800}
      >
        {selectedEvent && (
          <div>
            <Space direction="vertical" size="middle" className="w-full">
              <div>
                <Text strong>Webhook ID: </Text>
                <Text code>{selectedEvent.webhookId}</Text>
              </div>
              <div>
                <Text strong>Event Type: </Text>
                <Tag>{selectedEvent.eventType}</Tag>
              </div>
              <div>
                <Text strong>Status: </Text>
                <Tag color={statusColors[selectedEvent.status]}>{selectedEvent.status}</Tag>
              </div>
              {selectedEvent.lastError && (
                <div>
                  <Text strong>Last Error: </Text>
                  <Text type="danger">{selectedEvent.lastError}</Text>
                </div>
              )}
              <div>
                <Text strong>Payload:</Text>
                <pre className="mt-2 p-4 bg-gray-50 rounded overflow-auto max-h-96 text-xs">
                  {JSON.stringify(selectedEvent.payload, null, 2)}
                </pre>
              </div>
            </Space>
          </div>
        )}
      </Modal>
    </Card>
  )
}

export default WebhookEvents

