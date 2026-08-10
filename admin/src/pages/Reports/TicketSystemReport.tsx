import {
  FileExcelOutlined,
  FilterOutlined,
  ReloadOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import {
  App,
  Button,
  Card,
  DatePicker,
  Input,
  Select,
  Space,
  Table,
  Typography,
  Row,
  Col,
  Statistic,
  Tag,
  Badge,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs, { type Dayjs } from 'dayjs'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  fetchTicketSystemReport,
  type TicketSystemReportParams,
  type TicketSystemReportRow,
} from '../../api/reports'
import { useUsers } from '../../api/users'
import { Link } from 'react-router-dom'

const { RangePicker } = DatePicker
const { Title } = Typography

const TicketSystemReport = () => {
  const { message } = App.useApp()

  const [filters, setFilters] = useState<TicketSystemReportParams>({})
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null]>([null, null])

  // Fetch sellers and users for filters
  const { data: sellersData } = useUsers({ role: 'seller' })
  const sellers = sellersData || []
  const { data: usersData } = useUsers({ role: 'super-admin' })
  const users = usersData || []

  // Build query params
  const queryParams = useMemo<TicketSystemReportParams>(() => {
    const params: TicketSystemReportParams = {
      ...filters,
    }

    if (dateRange[0] && dateRange[1]) {
      params.fromDate = dateRange[0].startOf('day').toISOString()
      params.toDate = dateRange[1].endOf('day').toISOString()
    }

    return params
  }, [filters, dateRange])

  // Fetch ticket system report
  const { data: reportData, isLoading, refetch } = useQuery({
    queryKey: ['ticketSystemReport', queryParams],
    queryFn: () => fetchTicketSystemReport(queryParams),
  })

  const report = reportData?.data
  const rows = report?.rows || []
  const metrics = report?.metrics

  // Export to CSV
  const handleExportExcel = () => {
    if (!report) return

    const headers = [
      'Ticket No',
      'Seller / Order ID',
      'Category',
      'Priority',
      'Status',
      'Assigned Role',
      'Assigned To',
      'Created At',
      'SLA (Hours)',
      'SLA Deadline',
      'Current Age (hrs)',
      'SLA Breached',
      'Resolution Time (hrs)',
      'TAT Status',
    ]

    const csvRows = [
      headers.join(','),
      ...rows.map((row) =>
        [
          row.ticketNumber,
          row.orderNumber || row.sellerName || '',
          row.category,
          row.priority,
          row.status,
          row.assignedRole || '',
          row.assignedToName || '',
          dayjs(row.createdAt).format('YYYY-MM-DD HH:mm:ss'),
          row.slaHours || '',
          row.slaDeadline ? dayjs(row.slaDeadline).format('YYYY-MM-DD HH:mm:ss') : '',
          row.currentAgeHours,
          row.slaBreached,
          row.resolutionTimeHours || '',
          row.tatStatus,
        ].join(',')
      ),
      '',
      'Metrics,',
      `Total Tickets,${metrics?.totalTickets || 0}`,
      `Open Tickets,${metrics?.openTickets || 0}`,
      `Closed Tickets,${metrics?.closedTickets || 0}`,
      `SLA Breached Tickets,${metrics?.slaBreachedTickets || 0}`,
      `SLA Breached %,${(metrics?.slaBreachedPercentage || 0).toFixed(2)}%`,
      `Avg Resolution Time,${metrics?.avgResolutionTime || 0} hrs`,
    ]

    const csvContent = csvRows.join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `ticket-system-report-${dayjs().format('YYYY-MM-DD')}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    message.success('Report exported to CSV')
  }

  const columns: ColumnsType<TicketSystemReportRow> = [
    {
      title: 'Ticket No',
      dataIndex: 'ticketNumber',
      key: 'ticketNumber',
      fixed: 'left',
      width: 150,
      render: (text: string) => (
        <Link to={`/support/tickets`} className="font-mono text-blue-600 hover:underline">
          {text}
        </Link>
      ),
    },
    {
      title: 'Seller / Order ID',
      key: 'context',
      width: 200,
      render: (_: unknown, record: TicketSystemReportRow) => (
        <div>
          {record.sellerName && (
            <div>
              <span className="text-gray-600">Seller: </span>
              <span className="font-medium">{record.sellerName}</span>
            </div>
          )}
          {record.orderNumber && (
            <div>
              <Link
                to={`/orders/${record.orderId}`}
                className="text-blue-600 hover:underline text-sm"
              >
                Order: {record.orderNumber}
              </Link>
            </div>
          )}
          {!record.sellerName && !record.orderNumber && <span className="text-gray-400">—</span>}
        </div>
      ),
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      width: 120,
      render: (category: string) => <Tag>{category}</Tag>,
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      width: 100,
      render: (priority: string) => {
        const colorMap: Record<string, string> = {
          low: 'default',
          medium: 'blue',
          high: 'orange',
          urgent: 'red',
        }
        return <Tag color={colorMap[priority] || 'default'}>{priority.toUpperCase()}</Tag>
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: string) => {
        const colorMap: Record<string, string> = {
          open: 'blue',
          'in-progress': 'processing',
          resolved: 'success',
          closed: 'default',
        }
        return (
          <Badge
            status={colorMap[status] as 'default' | 'processing' | 'success'}
            text={status}
          />
        )
      },
    },
    {
      title: 'Assigned Role',
      dataIndex: 'assignedRole',
      key: 'assignedRole',
      width: 140,
      render: (role?: string) => (role ? <Tag>{role}</Tag> : <span className="text-gray-400">—</span>),
    },
    {
      title: 'Assigned To',
      dataIndex: 'assignedToName',
      key: 'assignedTo',
      width: 150,
      render: (name?: string) => (name ? name : <span className="text-gray-400">Unassigned</span>),
    },
    {
      title: 'Created At',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date: string) => dayjs(date).format('DD MMM YYYY HH:mm'),
    },
    {
      title: 'SLA (Hours)',
      dataIndex: 'slaHours',
      key: 'slaHours',
      width: 100,
      render: (hours?: number) => (hours ? `${hours}h` : <span className="text-gray-400">—</span>),
    },
    {
      title: 'SLA Deadline',
      dataIndex: 'slaDeadline',
      key: 'slaDeadline',
      width: 180,
      render: (deadline?: string) =>
        deadline ? dayjs(deadline).format('DD MMM YYYY HH:mm') : <span className="text-gray-400">—</span>,
    },
    {
      title: 'Current Age (hrs)',
      dataIndex: 'currentAgeHours',
      key: 'currentAgeHours',
      width: 130,
      render: (hours: number) => `${hours.toFixed(1)}h`,
    },
    {
      title: 'SLA Breached',
      dataIndex: 'slaBreached',
      key: 'slaBreached',
      width: 120,
      render: (breached: 'YES' | 'NO') => (
        <Tag color={breached === 'YES' ? 'red' : 'green'}>{breached}</Tag>
      ),
    },
    {
      title: 'Resolution Time (hrs)',
      dataIndex: 'resolutionTimeHours',
      key: 'resolutionTimeHours',
      width: 150,
      render: (hours?: number) =>
        hours ? `${hours.toFixed(1)}h` : <span className="text-gray-400">—</span>,
    },
    {
      title: 'TAT Status',
      dataIndex: 'tatStatus',
      key: 'tatStatus',
      width: 120,
      render: (status: 'WITHIN_SLA' | 'BREACHED') => (
        <Tag color={status === 'BREACHED' ? 'red' : 'green'}>
          {status === 'BREACHED' ? 'BREACHED' : 'WITHIN SLA'}
        </Tag>
      ),
    },
  ]

  return (
    <div className="space-y-6 -m-6 p-6 bg-gray-50 min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Title level={2} className="!mb-2">
            Ticket System Report
          </Title>
          <p className="text-gray-500 text-sm">
            Comprehensive SLA tracking, breach detection, and escalation visibility
          </p>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
            Refresh
          </Button>
          <Button icon={<FileExcelOutlined />} onClick={handleExportExcel} type="primary">
            Export CSV
          </Button>
        </Space>
      </div>

      {/* Metrics Summary */}
      {metrics && (
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Total Tickets"
                value={metrics.totalTickets}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Open Tickets"
                value={metrics.openTickets}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="SLA Breached"
                value={metrics.slaBreachedTickets}
                prefix={<WarningOutlined />}
                valueStyle={{ color: '#ff4d4f' }}
                suffix={`(${metrics.slaBreachedPercentage.toFixed(1)}%)`}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Avg Resolution Time"
                value={metrics.avgResolutionTime}
                suffix="hrs"
                valueStyle={{ color: '#722ed1' }}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* Filters */}
      <Card
        title={
          <div className="flex items-center gap-2">
            <FilterOutlined />
            <span>Filters</span>
          </div>
        }
        size="small"
      >
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={6}>
            <div className="text-sm text-gray-600 mb-1">Date Range</div>
            <RangePicker
              value={dateRange}
              onChange={(dates) => {
                if (dates) {
                  setDateRange([dates[0], dates[1]])
                } else {
                  setDateRange([null, null])
                }
              }}
              format="DD MMM YYYY"
              style={{ width: '100%' }}
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <div className="text-sm text-gray-600 mb-1">Status</div>
            <Select
              placeholder="All Statuses"
              allowClear
              style={{ width: '100%' }}
              value={filters.status}
              onChange={(value) => setFilters({ ...filters, status: value })}
            >
              <Select.Option value="open">Open</Select.Option>
              <Select.Option value="in-progress">In Progress</Select.Option>
              <Select.Option value="resolved">Resolved</Select.Option>
              <Select.Option value="closed">Closed</Select.Option>
            </Select>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <div className="text-sm text-gray-600 mb-1">Category</div>
            <Select
              placeholder="All Categories"
              allowClear
              style={{ width: '100%' }}
              value={filters.category}
              onChange={(value) => setFilters({ ...filters, category: value })}
            >
              <Select.Option value="order">Order</Select.Option>
              <Select.Option value="refund">Refund</Select.Option>
              <Select.Option value="payment">Payment</Select.Option>
              <Select.Option value="technical">Technical</Select.Option>
              <Select.Option value="settlement">Settlement</Select.Option>
              <Select.Option value="ledger">Ledger</Select.Option>
              <Select.Option value="payout">Payout</Select.Option>
              <Select.Option value="shipping">Shipping</Select.Option>
              <Select.Option value="product">Product</Select.Option>
              <Select.Option value="account">Account</Select.Option>
              <Select.Option value="other">Other</Select.Option>
            </Select>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <div className="text-sm text-gray-600 mb-1">Priority</div>
            <Select
              placeholder="All Priorities"
              allowClear
              style={{ width: '100%' }}
              value={filters.priority}
              onChange={(value) => setFilters({ ...filters, priority: value })}
            >
              <Select.Option value="low">Low</Select.Option>
              <Select.Option value="medium">Medium</Select.Option>
              <Select.Option value="high">High</Select.Option>
              <Select.Option value="urgent">Urgent</Select.Option>
            </Select>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <div className="text-sm text-gray-600 mb-1">Assigned Role</div>
            <Select
              placeholder="All Roles"
              allowClear
              style={{ width: '100%' }}
              value={filters.assignedRole}
              onChange={(value) => setFilters({ ...filters, assignedRole: value })}
            >
              <Select.Option value="SELLER_SUPPORT">Seller Support</Select.Option>
              <Select.Option value="FINANCE">Finance</Select.Option>
              <Select.Option value="OPS">Ops</Select.Option>
              <Select.Option value="TECH">Tech</Select.Option>
              <Select.Option value="ADMIN">Admin</Select.Option>
            </Select>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <div className="text-sm text-gray-600 mb-1">Assigned User</div>
            <Select
              placeholder="All Users"
              allowClear
              showSearch
              filterOption={(input, option) => {
                const children = option?.children
                const label = typeof children === 'string' ? children : String(children || '')
                return label.toLowerCase().includes(input.toLowerCase())
              }}
              style={{ width: '100%' }}
              value={filters.assignedTo}
              onChange={(value) => setFilters({ ...filters, assignedTo: value })}
            >
              {users.map((user: { _id: string; name: string }) => (
                <Select.Option key={user._id} value={user._id}>
                  {user.name}
                </Select.Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <div className="text-sm text-gray-600 mb-1">SLA Breached</div>
            <Select
              placeholder="All"
              allowClear
              style={{ width: '100%' }}
              value={filters.slaBreached}
              onChange={(value) => setFilters({ ...filters, slaBreached: value })}
            >
              <Select.Option value="YES">Yes</Select.Option>
              <Select.Option value="NO">No</Select.Option>
            </Select>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <div className="text-sm text-gray-600 mb-1">Seller</div>
            <Select
              placeholder="All Sellers"
              allowClear
              showSearch
              filterOption={(input, option) => {
                const children = option?.children
                const label = typeof children === 'string' ? children : String(children || '')
                return label.toLowerCase().includes(input.toLowerCase())
              }}
              style={{ width: '100%' }}
              value={filters.seller}
              onChange={(value) => setFilters({ ...filters, seller: value })}
            >
              {sellers.map((seller: { _id: string; businessName?: string; name: string }) => (
                <Select.Option key={seller._id} value={seller._id}>
                  {seller.businessName || seller.name}
                </Select.Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <div className="text-sm text-gray-600 mb-1">Order ID</div>
            <Input
              placeholder="Enter Order ID"
              allowClear
              value={filters.orderId}
              onChange={(e) => setFilters({ ...filters, orderId: e.target.value || undefined })}
            />
          </Col>
        </Row>
      </Card>

      {/* Report Table */}
      <Card>
        <Table
          columns={columns}
          dataSource={rows}
          loading={isLoading}
          rowKey="ticketNumber"
          pagination={{ pageSize: 50, showSizeChanger: true }}
          scroll={{ x: 2000 }}
          size="small"
        />
      </Card>
    </div>
  )
}

export default TicketSystemReport

