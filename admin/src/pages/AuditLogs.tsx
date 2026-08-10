import { SafetyOutlined } from '@ant-design/icons'
import { Card, DatePicker, Descriptions, Form, Select, Space, Table, Tag, Typography } from 'antd'
import dayjs from 'dayjs'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuditLogs } from '../api/settlementQueries'

const { RangePicker } = DatePicker
const { Title, Text } = Typography

const AuditLogs = () => {
  const [form] = Form.useForm()
  const [filters, setFilters] = useState<{
    action?: string
    entityType?: string
    entityId?: string
    performedBy?: string
    fromDate?: string
    toDate?: string
  }>({})
  const [page, setPage] = useState(1)

  const { data, isLoading } = useAuditLogs({
    ...filters,
    page,
    limit: 50,
  })

  const actionLabels: Record<string, string> = {
    REFUND_ISSUED: 'Refund Issued',
    REFUND_OVERRIDE_APPROVED: 'Refund Override Approved',
    PAYOUT_MARKED_PAID: 'Payout Marked Paid',
    SETTLEMENT_STATUS_CHANGED: 'Settlement Status Changed',
    MANUAL_ADJUSTMENT_CREATED: 'Manual Adjustment Created',
    MANUAL_ADJUSTMENT_OVERRIDE_APPROVED: 'Manual Adjustment Override Approved',
  }

  const actionColors: Record<string, string> = {
    REFUND_ISSUED: 'orange',
    REFUND_OVERRIDE_APPROVED: 'red',
    PAYOUT_MARKED_PAID: 'green',
    SETTLEMENT_STATUS_CHANGED: 'blue',
    MANUAL_ADJUSTMENT_CREATED: 'purple',
    MANUAL_ADJUSTMENT_OVERRIDE_APPROVED: 'red',
  }

  const handleFilterChange = (values: any) => {
    const next: any = {}
    if (values.action) next.action = values.action
    if (values.entityType) next.entityType = values.entityType
    if (values.entityId) next.entityId = values.entityId
    if (values.performedBy) next.performedBy = values.performedBy
    if (values.dateRange && values.dateRange.length === 2) {
      next.fromDate = values.dateRange[0].startOf('day').toISOString()
      next.toDate = values.dateRange[1].endOf('day').toISOString()
    }
    setFilters(next)
    setPage(1)
  }

  const columns = [
    {
      title: 'Timestamp',
      dataIndex: 'createdAt',
      key: 'timestamp',
      width: 180,
      render: (value: string) => dayjs(value).format('DD MMM YYYY, HH:mm:ss'),
    },
    {
      title: 'Action',
      dataIndex: 'action',
      key: 'action',
      width: 200,
      render: (value: string) => (
        <Tag color={actionColors[value] || 'default'}>{actionLabels[value] || value}</Tag>
      ),
    },
    {
      title: 'Performed By',
      key: 'performedBy',
      width: 200,
      render: (_: unknown, record: any) => {
        const user = record.performedBy || {}
        const name = record.performedByName || user.name || 'Unknown'
        const email = record.performedByEmail || user.email || ''
        return (
          <div>
            <div>{name}</div>
            {email && <Text type="secondary" style={{ fontSize: 12 }}>{email}</Text>}
          </div>
        )
      },
    },
    {
      title: 'IP Address',
      dataIndex: 'ipAddress',
      key: 'ipAddress',
      width: 150,
      render: (value: string) => <Text code style={{ fontSize: 12 }}>{value}</Text>,
    },
    {
      title: 'Entity',
      key: 'entity',
      width: 150,
      render: (_: unknown, record: any) => {
        const { entityType, metadata } = record
        if (entityType === 'REFUND' && metadata?.orderId) {
          return (
            <Link to={`/orders/${metadata.orderId}`}>
              <Tag>Refund</Tag>
            </Link>
          )
        }
        if (entityType === 'SETTLEMENT_BATCH' && metadata?.batchId) {
          return (
            <Link to={`/settlements/${metadata.batchId}`}>
              <Tag>Batch</Tag>
            </Link>
          )
        }
        if (entityType === 'MANUAL_ADJUSTMENT' && metadata?.sellerId) {
          return (
            <Link to={`/sellers/${metadata.sellerId}`}>
              <Tag>Adjustment</Tag>
            </Link>
          )
        }
        return <Tag>{entityType}</Tag>
      },
    },
    {
      title: 'Details',
      key: 'details',
      render: (_: unknown, record: any) => {
        const { action, metadata } = record
        const details: string[] = []

        if (action === 'REFUND_ISSUED') {
          if (metadata?.refundAmount) details.push(`₹${metadata.refundAmount.toFixed(2)}`)
          if (metadata?.orderNumber) details.push(`Order: ${metadata.orderNumber}`)
          if (metadata?.refundSource) details.push(`Source: ${metadata.refundSource}`)
        } else if (action === 'PAYOUT_MARKED_PAID' || action === 'SETTLEMENT_STATUS_CHANGED') {
          if (metadata?.payoutAmount) details.push(`₹${metadata.payoutAmount.toFixed(2)}`)
          if (metadata?.previousStatus && metadata?.newStatus) {
            details.push(`${metadata.previousStatus} → ${metadata.newStatus}`)
          }
        } else if (action === 'MANUAL_ADJUSTMENT_CREATED') {
          if (metadata?.adjustmentAmount) details.push(`₹${metadata.adjustmentAmount.toFixed(2)}`)
          if (metadata?.adjustmentType) details.push(metadata.adjustmentType)
        }

        return (
          <div>
            {details.map((detail, idx) => (
              <div key={idx} style={{ fontSize: 12, color: '#666' }}>
                {detail}
              </div>
            ))}
          </div>
        )
      },
    },
  ]

  return (
    <Space direction="vertical" size="large" className="w-full">
      <div className="flex items-center justify-between">
        <Title level={4} className="mb-0">
          <SafetyOutlined style={{ marginRight: 8 }} />
          Audit Logs
        </Title>
      </div>

      <Card>
        <Form layout="inline" form={form} onFinish={handleFilterChange}>
          <Form.Item name="action" label="Action">
            <Select
              allowClear
              style={{ width: 200 }}
              placeholder="All Actions"
              options={Object.entries(actionLabels).map(([value, label]) => ({
                label,
                value,
              }))}
            />
          </Form.Item>
          <Form.Item name="entityType" label="Entity Type">
            <Select
              allowClear
              style={{ width: 150 }}
              placeholder="All Types"
              options={[
                { label: 'Refund', value: 'REFUND' },
                { label: 'Settlement Batch', value: 'SETTLEMENT_BATCH' },
                { label: 'Manual Adjustment', value: 'MANUAL_ADJUSTMENT' },
                { label: 'Order', value: 'ORDER' },
              ]}
            />
          </Form.Item>
          <Form.Item name="dateRange" label="Date Range">
            <RangePicker />
          </Form.Item>
          <Form.Item>
            <Space>
              <button
                type="submit"
                className="inline-flex items-center px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                Apply Filters
              </button>
              <button
                type="button"
                onClick={() => {
                  form.resetFields()
                  setFilters({})
                  setPage(1)
                }}
                className="inline-flex items-center px-4 py-2 rounded-md bg-gray-100 text-gray-800 text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                Reset
              </button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <Card>
        <Table
          rowKey="_id"
          loading={isLoading}
          dataSource={data?.data || []}
          columns={columns}
          pagination={
            data?.pagination
              ? {
                  current: data.pagination.page,
                  total: data.pagination.total,
                  pageSize: data.pagination.limit,
                  onChange: (nextPage) => setPage(nextPage),
                  showTotal: (total) => `Total ${total} entries`,
                }
              : false
          }
          expandable={{
            expandedRowRender: (record) => (
              <Descriptions column={2} size="small" bordered>
                <Descriptions.Item label="User Agent" span={2}>
                  <Text code style={{ fontSize: 11 }}>
                    {record.userAgent || 'N/A'}
                  </Text>
                </Descriptions.Item>
                <Descriptions.Item label="Entity ID" span={2}>
                  <Text code>{record.entityId}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Metadata" span={2}>
                  <pre style={{ fontSize: 11, maxHeight: 200, overflow: 'auto' }}>
                    {JSON.stringify(record.metadata, null, 2)}
                  </pre>
                </Descriptions.Item>
              </Descriptions>
            ),
          }}
          scroll={{ x: 1200 }}
        />
      </Card>
    </Space>
  )
}

export default AuditLogs

