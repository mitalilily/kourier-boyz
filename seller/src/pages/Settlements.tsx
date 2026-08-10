import { QuestionCircleOutlined } from '@ant-design/icons'
import { Alert, App, Button, Card, DatePicker, Form, Modal, Select, Space, Table, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCreateSellerTicket } from '../api/tickets'
import { useSellerSettlementBatches } from '../api/settlementQueries'
import type { SellerSettlementBatch } from '../api/settlements'

const { RangePicker } = DatePicker
const { Title } = Typography

const SettlementsPage = () => {
  const { modal } = App.useApp()
  const [form] = Form.useForm()
  const navigate = useNavigate()
  const createTicketMutation = useCreateSellerTicket()
  const [raiseQuerySettlement, setRaiseQuerySettlement] = useState<SellerSettlementBatch | null>(
    null,
  )
  const [filters, setFilters] = useState<{
    status?: 'PENDING' | 'PAID'
    fromDate?: string
    toDate?: string
  }>({})

  const [page, setPage] = useState(1)

  const { data, isLoading } = useSellerSettlementBatches({
    ...filters,
    page,
    limit: 20,
  })

  const columns: ColumnsType<SellerSettlementBatch> = [
    {
      title: 'Batch ID',
      dataIndex: '_id',
      render: (value: string) => <Link to={`/settlements/${value}`}>{value}</Link>,
    },
    {
      title: 'Period',
      key: 'period',
      render: (_: unknown, record: SellerSettlementBatch) => (
        <span>
          {dayjs(record.fromDate).format('DD MMM YYYY')} –{' '}
          {dayjs(record.toDate).format('DD MMM YYYY')}
        </span>
      ),
    },
    {
      title: 'Orders',
      dataIndex: 'ordersCount',
    },
    {
      title: 'Total Net Payout',
      dataIndex: 'totalNetPayout',
      render: (value: number) => `₹${value.toFixed(2)}`,
    },
    {
      title: 'Invoice',
      key: 'invoice',
      render: (_: unknown, record: SellerSettlementBatch) => {
        if (record.invoiceUrl && record.invoiceNumber) {
          return (
            <a href={record.invoiceUrl} target="_blank" rel="noreferrer">
              {record.invoiceNumber}
            </a>
          )
        }
        if (record.status === 'PAID') {
          return <span className="text-xs text-slate-500">Pending invoice</span>
        }
        return <span className="text-xs text-slate-400">—</span>
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      render: (value: 'PENDING' | 'PAID') => (
        <Tag color={value === 'PAID' ? 'green' : 'orange'}>{value}</Tag>
      ),
    },
    {
      title: 'Payout Date',
      dataIndex: 'payoutDate',
      render: (value?: string) => (value ? dayjs(value).format('DD MMM YYYY') : '—'),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 150,
      fixed: 'right' as const,
      render: (_: unknown, record: SellerSettlementBatch) => (
        <Button
          size="small"
          icon={<QuestionCircleOutlined />}
          onClick={(e) => {
            e.stopPropagation()
            e.preventDefault()
            setRaiseQuerySettlement(record)
          }}
        >
          Raise Query
        </Button>
      ),
    },
  ]

  const handleFilterChange = (values: { status?: 'PENDING' | 'PAID'; dateRange?: [dayjs.Dayjs, dayjs.Dayjs] }) => {
    const next: { status?: 'PENDING' | 'PAID'; fromDate?: string; toDate?: string } = {}
    if (values.status) next.status = values.status
    if (values.dateRange && values.dateRange.length === 2) {
      next.fromDate = values.dateRange[0].startOf('day').toISOString()
      next.toDate = values.dateRange[1].endOf('day').toISOString()
    }
    setFilters(next)
    setPage(1)
  }

  const pagination = data?.pagination

  return (
    <Space direction="vertical" size="large" className="w-full">
      <div className="flex items-center justify-between">
        <Title level={4} className="mb-0">
          Settlements
        </Title>
      </div>

      <Card>
        <Form
          layout="inline"
          form={form}
          initialValues={{ status: filters.status }}
          onFinish={handleFilterChange}
        >
          <Form.Item name="status" label="Status">
            <Select
              allowClear
              style={{ width: 160 }}
              options={[
                { label: 'Pending', value: 'PENDING' },
                { label: 'Paid', value: 'PAID' },
              ]}
            />
          </Form.Item>
          <Form.Item name="dateRange" label="Date range">
            <RangePicker />
          </Form.Item>
          <Form.Item>
            <Space>
              <button
                type="submit"
                className="inline-flex items-center px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                Apply
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
            pagination
              ? {
                  current: pagination.page,
                  total: pagination.total,
                  pageSize: pagination.limit,
                  onChange: (nextPage) => setPage(nextPage),
                }
              : false
          }
        />
      </Card>

      {/* Raise Query Modal */}
      <Modal
        title="Raise Query for Settlement"
        open={!!raiseQuerySettlement}
        onOk={async () => {
          if (!raiseQuerySettlement) return
          try {
            await createTicketMutation.mutateAsync({
              subject: `Query regarding Settlement - ${dayjs(raiseQuerySettlement.fromDate).format('DD MMM')} to ${dayjs(raiseQuerySettlement.toDate).format('DD MMM YYYY')}`,
              category: 'settlement',
              description: `I have a question regarding this settlement batch:\n\nPeriod: ${dayjs(raiseQuerySettlement.fromDate).format('DD MMM YYYY')} to ${dayjs(raiseQuerySettlement.toDate).format('DD MMM YYYY')}\nOrders: ${raiseQuerySettlement.ordersCount}\nTotal Net Payout: ₹${raiseQuerySettlement.totalNetPayout.toFixed(2)}\nStatus: ${raiseQuerySettlement.status}\n\nPlease provide clarification.`,
              priority: 'medium',
              settlementBatchId: raiseQuerySettlement._id,
            })
            modal.success({
              title: 'Ticket Created',
              content: 'Your query has been submitted. We will respond shortly.',
              onOk: () => {
                setRaiseQuerySettlement(null)
                navigate('/tickets')
              },
            })
          } catch {
            modal.error({
              title: 'Error',
              content: 'Failed to create ticket. Please try again.',
            })
          }
        }}
        onCancel={() => setRaiseQuerySettlement(null)}
        okText="Create Ticket"
        cancelText="Cancel"
        okButtonProps={{ loading: createTicketMutation.isPending }}
      >
        {raiseQuerySettlement && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <div>
              <strong>Period:</strong> {dayjs(raiseQuerySettlement.fromDate).format('DD MMM YYYY')} - {dayjs(raiseQuerySettlement.toDate).format('DD MMM YYYY')}
            </div>
            <div>
              <strong>Orders:</strong> {raiseQuerySettlement.ordersCount}
            </div>
            <div>
              <strong>Total Net Payout:</strong> ₹{raiseQuerySettlement.totalNetPayout.toFixed(2)}
            </div>
            <div>
              <strong>Status:</strong> <Tag color={raiseQuerySettlement.status === 'PAID' ? 'green' : 'orange'}>{raiseQuerySettlement.status}</Tag>
            </div>
            <Alert
              message="Creating a ticket"
              description="A support ticket will be created with details about this settlement. You can track the status in the Support Tickets section."
              type="info"
              showIcon
            />
          </Space>
        )}
      </Modal>
    </Space>
  )
}

export default SettlementsPage


