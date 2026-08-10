import {
  ClockCircleOutlined,
  FilterOutlined,
  ReloadOutlined,
  WarningOutlined,
  MailOutlined,
  FileTextOutlined,
} from '@ant-design/icons'
import {
  Button,
  Card,
  DatePicker,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  Row,
  Col,
  Statistic,
  Modal,
  Input,
  Tabs,
  message,
  Tooltip,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs, { type Dayjs } from 'dayjs'
import { useMemo, useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import {
  fetchSalesPendingStatusReport,
  sendManualReminder,
  fetchSLAAuditLog,
  type SalesPendingStatusParams,
  type SalesPendingStatusRow,
  type SLAAuditLogParams,
  type SLAAuditLogRow,
} from '../../api/reports'
import { useUsers, type AdminUser } from '../../api/users'

const { RangePicker } = DatePicker
const { Title, Text } = Typography
const { TextArea } = Input

const SalesPendingStatusReport = () => {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState('report')
  const [selectedSLA, setSelectedSLA] = useState<SalesPendingStatusRow | null>(null)
  const [customMessage, setCustomMessage] = useState('')
  const [reminderModalVisible, setReminderModalVisible] = useState(false)
  
  // Pagination state
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  
  // Audit log filters
  const [auditLogFilters, setAuditLogFilters] = useState<SLAAuditLogParams>({})
  const [auditLogDateRange, setAuditLogDateRange] = useState<[Dayjs, Dayjs] | null>(null)
  const [auditLogPage, setAuditLogPage] = useState(1)
  const [auditLogLimit] = useState(50)
  
  // Read filters from URL query parameters
  const pendingStage = searchParams.get('pendingStage') as 'acceptance' | 'awb' | 'pickup' | null
  const slaStatus = searchParams.get('slaStatus') as 'within_tat' | 'breached' | null
  const seller = searchParams.get('seller') || undefined
  const courier = searchParams.get('courier') || undefined
  const fromDateParam = searchParams.get('fromDate')
  const toDateParam = searchParams.get('toDate')

  // Default to last 30 days or use URL params
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([
    fromDateParam ? dayjs(fromDateParam) : dayjs().subtract(30, 'days'),
    toDateParam ? dayjs(toDateParam) : dayjs(),
  ])
  
  const [filters, setFilters] = useState<SalesPendingStatusParams>({
    pendingStage: pendingStage || undefined,
    slaStatus: slaStatus || undefined,
    seller: seller,
    courier: courier,
  })

  // Update filters when URL params change
  useEffect(() => {
    setFilters({
      pendingStage: pendingStage || undefined,
      slaStatus: slaStatus || undefined,
      seller: seller,
      courier: courier,
    })
    if (fromDateParam) {
      setDateRange([dayjs(fromDateParam), toDateParam ? dayjs(toDateParam) : dayjs()])
    }
  }, [pendingStage, slaStatus, seller, courier, fromDateParam, toDateParam])

  // Fetch sellers for filter
  const { data: sellersData } = useUsers({ role: 'seller' })
  const sellers = sellersData || []

  // Build query params
  const queryParams = useMemo<SalesPendingStatusParams & { page?: number; limit?: number }>(() => {
    const params: SalesPendingStatusParams & { page?: number; limit?: number } = {
      fromDate: dateRange[0].startOf('day').toISOString(),
      toDate: dateRange[1].endOf('day').toISOString(),
      ...filters,
      page,
      limit: pageSize,
    }
    return params
  }, [dateRange, filters, page, pageSize])

  // Fetch report
  const { data: reportData, isLoading, refetch } = useQuery({
    queryKey: ['salesPendingStatusReport', queryParams],
    queryFn: () => fetchSalesPendingStatusReport(queryParams),
  })

  const report = reportData?.data
  const rows = report?.rows || []
  const summary = report?.summary

  // Send reminder mutation
  const sendReminderMutation = useMutation({
    mutationFn: sendManualReminder,
    onSuccess: () => {
      message.success({
        content: 'Reminder sent successfully to seller',
        duration: 4,
        style: { marginTop: '20px' },
      })
      setReminderModalVisible(false)
      setSelectedSLA(null)
      setCustomMessage('')
      queryClient.invalidateQueries({ queryKey: ['salesPendingStatusReport'] })
      queryClient.invalidateQueries({ queryKey: ['slaAuditLog'] })
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } }
      const errorMessage =
        err.response?.data?.message ||
        (err as { message?: string })?.message ||
        'Failed to send reminder. Please try again.'
      
      message.error({
        content: `Error: ${errorMessage}`,
        duration: 6,
        style: { marginTop: '20px' },
      })
      console.error('Error sending reminder:', error)
    },
  })

  const handleSendReminder = (row: SalesPendingStatusRow) => {
    setSelectedSLA(row)
    setCustomMessage('')
    setReminderModalVisible(true)
  }

  const handleConfirmSendReminder = async () => {
    if (!selectedSLA) return

    // Determine SLA type based on current stage
    let slaType: 'AWB' | 'DISPATCH' | undefined
    if (selectedSLA.currentStage === 'pending_awb') {
      slaType = 'AWB'
    } else if (selectedSLA.currentStage === 'pending_pickup') {
      slaType = 'DISPATCH'
    } else if (selectedSLA.currentStage === 'pending_acceptance') {
      slaType = 'AWB' // Acceptance stage also uses AWB SLA
    }

    // Show loading message
    message.loading({
      content: 'Sending reminder...',
      key: 'sending-reminder',
      duration: 0,
      style: { marginTop: '20px' },
    })

    sendReminderMutation.mutate(
      {
        orderId: selectedSLA.orderId,
        sellerId: selectedSLA.sellerId,
        slaType,
        customMessage: customMessage || undefined,
      },
      {
        onSettled: () => {
          message.destroy('sending-reminder')
        },
      },
    )
  }

  // Audit log query params
  const auditLogParams = useMemo<SLAAuditLogParams>(() => {
    const params: SLAAuditLogParams = {
      ...auditLogFilters,
      page: auditLogPage,
      limit: auditLogLimit,
    }
    if (auditLogDateRange) {
      params.fromDate = auditLogDateRange[0].startOf('day').toISOString()
      params.toDate = auditLogDateRange[1].endOf('day').toISOString()
    }
    return params
  }, [auditLogFilters, auditLogDateRange, auditLogPage, auditLogLimit])

  // Fetch audit logs
  const {
    data: auditLogData,
    isLoading: auditLogLoading,
    refetch: refetchAuditLog,
  } = useQuery({
    queryKey: ['slaAuditLog', auditLogParams],
    queryFn: () => fetchSLAAuditLog(auditLogParams),
    enabled: activeTab === 'audit-log',
  })

  // Format hours
  const formatHours = (hours: number) => {
    if (hours < 1) {
      return `${Math.round(hours * 60)}m`
    }
    if (hours < 24) {
      return `${Math.round(hours)}h`
    }
    return `${Math.round(hours / 24)}d ${Math.round(hours % 24)}h`
  }

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount)
  }

  // Table columns
  const columns: ColumnsType<SalesPendingStatusRow> = [
    {
      title: 'Order Number',
      dataIndex: 'orderNumber',
      key: 'orderNumber',
      fixed: 'left',
      width: 150,
      render: (value, record) => {
        const displayValue = value || record.orderId.slice(-8)
        return (
          <Link
            to={`/orders/${record.orderId}`}
            className="text-blue-600 hover:text-blue-800 hover:underline"
          >
            {displayValue}
          </Link>
        )
      },
    },
    {
      title: 'Seller',
      dataIndex: 'sellerName',
      key: 'sellerName',
      width: 200,
      render: (value) => value || 'N/A',
    },
    {
      title: 'Current Stage',
      dataIndex: 'currentStage',
      key: 'currentStage',
      width: 150,
      render: (stage) => {
        const stageLabels: Record<string, string> = {
          pending_acceptance: 'Pending Acceptance',
          pending_awb: 'Pending AWB',
          pending_pickup: 'Pending Pickup',
          completed: 'Completed',
        }
        const colors: Record<string, string> = {
          pending_acceptance: 'orange',
          pending_awb: 'blue',
          pending_pickup: 'purple',
          completed: 'green',
        }
        return <Tag color={colors[stage]}>{stageLabels[stage] || stage}</Tag>
      },
    },
    {
      title: 'Pending Since',
      key: 'pendingSince',
      width: 150,
      render: (_, record) => {
        const relevantTAT = record.acceptanceTAT || record.awbTAT || record.pickupTAT
        if (!relevantTAT) return 'N/A'
        return formatHours(relevantTAT.pendingSinceHours)
      },
    },
    {
      title: 'SLA Deadline',
      key: 'slaDeadline',
      width: 180,
      render: (_, record) => {
        const relevantTAT = record.acceptanceTAT || record.awbTAT || record.pickupTAT
        if (!relevantTAT) return 'N/A'
        return dayjs(relevantTAT.deadline).format('DD MMM YYYY, HH:mm')
      },
    },
    {
      title: 'SLA Status',
      key: 'slaStatus',
      width: 120,
      render: (_, record) => {
        const relevantTAT = record.acceptanceTAT || record.awbTAT || record.pickupTAT
        if (!relevantTAT) return <Tag>N/A</Tag>
        return (
          <Tag color={relevantTAT.slaStatus === 'breached' ? 'red' : 'green'}>
            {relevantTAT.slaStatus === 'breached' ? (
              <>
                <WarningOutlined /> Breached
              </>
            ) : (
              <>
                <ClockCircleOutlined /> Within TAT
              </>
            )}
          </Tag>
        )
      },
    },
    {
      title: 'Order Total',
      dataIndex: 'orderTotal',
      key: 'orderTotal',
      align: 'right',
      width: 120,
      render: (value) => (value ? formatCurrency(value) : 'N/A'),
    },
    {
      title: 'Courier',
      dataIndex: 'courier',
      key: 'courier',
      width: 120,
      render: (value) => value || 'N/A',
    },
    {
      title: 'Actions',
      key: 'actions',
      fixed: 'right',
      width: 80,
      render: (_, record) => {
        const relevantTAT = record.acceptanceTAT || record.awbTAT || record.pickupTAT
        const isBreached = relevantTAT?.slaStatus === 'breached'
        // Admin can always send reminders (no limit), but only if SLA is breached and not completed
        const canSendReminder = isBreached && record.currentStage !== 'completed'

        return (
          <Tooltip
            title={
              !isBreached
                ? 'SLA not breached'
                : record.currentStage === 'completed'
                ? 'Order completed'
                : 'Send reminder to seller (Admin can send unlimited reminders)'
            }
          >
            <Button
              type="primary"
              icon={<MailOutlined />}
              size="small"
              onClick={() => handleSendReminder(record)}
              disabled={!canSendReminder}
            />
          </Tooltip>
        )
      },
    },
  ]

  // Audit log columns
  const auditLogColumns: ColumnsType<SLAAuditLogRow> = [
    {
      title: 'Timestamp',
      dataIndex: 'timestamp',
      key: 'timestamp',
      render: (time) => dayjs(time).format('YYYY-MM-DD HH:mm:ss'),
      sorter: (a, b) => dayjs(a.timestamp).unix() - dayjs(b.timestamp).unix(),
    },
    {
      title: 'Event Type',
      dataIndex: 'eventType',
      key: 'eventType',
      render: (type) => {
        const colors: Record<string, string> = {
          SLA_STARTED: 'blue',
          SLA_BREACHED: 'red',
          SLA_REMINDER_SENT: 'orange',
          SLA_RESOLVED: 'green',
        }
        return <Tag color={colors[type]}>{type.replace(/_/g, ' ')}</Tag>
      },
    },
    {
      title: 'Order Number',
      dataIndex: 'orderNumber',
      key: 'orderNumber',
      render: (text, record) => (
        <Link
          to={`/orders/${record.orderId}`}
          className="text-blue-600 hover:text-blue-800 hover:underline"
        >
          {text || 'N/A'}
        </Link>
      ),
    },
    {
      title: 'Seller',
      dataIndex: 'sellerName',
      key: 'sellerName',
      render: (text) => text || 'N/A',
    },
    {
      title: 'SLA Type',
      dataIndex: 'slaType',
      key: 'slaType',
      render: (type) => <Tag color={type === 'AWB' ? 'blue' : 'green'}>{type}</Tag>,
    },
    {
      title: 'Actor',
      dataIndex: 'actor',
      key: 'actor',
      render: (actor, record) => (
        <Space>
          <Tag color={actor === 'SYSTEM' ? 'default' : 'purple'}>
            {actor === 'SYSTEM' ? 'SYSTEM' : record.actorName || 'Admin'}
          </Tag>
          {record.reminderType && (
            <Tag color={record.reminderType === 'AUTO' ? 'cyan' : 'magenta'}>
              {record.reminderType}
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: 'Details',
      key: 'details',
      render: (_, record) => (
        <Space direction="vertical" size="small">
          {record.triggerReason && (
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {record.triggerReason}
            </Text>
          )}
          {record.reminderCount !== undefined && (
            <Text type="secondary" style={{ fontSize: '12px' }}>
              Reminder #{record.reminderCount}
            </Text>
          )}
          {record.resolvedReason && <Tag color="green">{record.resolvedReason}</Tag>}
        </Space>
      ),
    },
  ]

  return (
    <div style={{ padding: '24px' }}>
      <Card>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Title level={2} style={{ margin: 0 }}>
              Sales Pending Status Report
            </Title>
            <Space>
              <Button icon={<ReloadOutlined />} onClick={() => refetch()} loading={isLoading}>
                Refresh
              </Button>
            </Space>
          </div>

          {/* Summary Statistics */}
          {summary && (
            <Row gutter={16}>
              <Col span={6}>
                <Statistic title="Total Pending" value={summary.totalPending} />
              </Col>
              <Col span={6}>
                <Statistic title="Pending Acceptance" value={summary.pendingAcceptance} />
              </Col>
              <Col span={6}>
                <Statistic title="Pending AWB" value={summary.pendingAWB} />
              </Col>
              <Col span={6}>
                <Statistic title="Pending Pickup" value={summary.pendingPickup} />
              </Col>
              <Col span={6}>
                <Statistic
                  title="Breached SLA"
                  value={summary.breachedSLA}
                  valueStyle={{ color: '#cf1322' }}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="Within SLA"
                  value={summary.withinSLA}
                  valueStyle={{ color: '#3f8600' }}
                />
              </Col>
            </Row>
          )}

          {/* Filters */}
          <Card size="small" title={<><FilterOutlined /> Filters</>}>
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <Row gutter={16}>
                <Col span={8}>
                  <div style={{ marginBottom: 8 }}>Date Range</div>
                  <RangePicker
                    style={{ width: '100%' }}
                    value={dateRange}
                    onChange={(dates) => {
                      if (dates) {
                        setDateRange([dates[0]!, dates[1]!])
                        setPage(1) // Reset to first page when date range changes
                        // Update URL
                        const params = new URLSearchParams(searchParams)
                        if (dates[0] && dates[1]) {
                          params.set('fromDate', dates[0].startOf('day').toISOString())
                          params.set('toDate', dates[1].endOf('day').toISOString())
                        } else {
                          params.delete('fromDate')
                          params.delete('toDate')
                        }
                        setSearchParams(params)
                      }
                    }}
                  />
                </Col>
                <Col span={8}>
                  <div style={{ marginBottom: 8 }}>Seller</div>
                  <Select
                    style={{ width: '100%' }}
                    placeholder="All Sellers"
                    allowClear
                    value={filters.seller}
                    onChange={(value) => {
                      const newFilters = { ...filters, seller: value }
                      setFilters(newFilters)
                      setPage(1) // Reset to first page when filter changes
                      // Update URL
                      const params = new URLSearchParams(searchParams)
                      if (value) {
                        params.set('seller', value)
                      } else {
                        params.delete('seller')
                      }
                      setSearchParams(params)
                    }}
                    options={sellers.map((seller: AdminUser) => ({
                      label: seller.businessName || seller.name,
                      value: seller._id,
                    }))}
                    showSearch
                    filterOption={(input, option) => {
                      const label = String(option?.label ?? '')
                      return label.toLowerCase().includes(input.toLowerCase())
                    }}
                  />
                </Col>
                <Col span={8}>
                  <div style={{ marginBottom: 8 }}>Pending Stage</div>
                  <Select
                    style={{ width: '100%' }}
                    placeholder="All Stages"
                    allowClear
                    value={filters.pendingStage}
                    onChange={(value) => {
                      const newFilters = { ...filters, pendingStage: value }
                      setFilters(newFilters)
                      setPage(1) // Reset to first page when filter changes
                      // Update URL
                      const params = new URLSearchParams(searchParams)
                      if (value) {
                        params.set('pendingStage', value)
                      } else {
                        params.delete('pendingStage')
                      }
                      setSearchParams(params)
                    }}
                    options={[
                      { label: 'Pending Acceptance', value: 'acceptance' },
                      { label: 'Pending AWB', value: 'awb' },
                      { label: 'Pending Pickup', value: 'pickup' },
                    ]}
                  />
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={8}>
                  <div style={{ marginBottom: 8 }}>SLA Status</div>
                  <Select
                    style={{ width: '100%' }}
                    placeholder="All Statuses"
                    allowClear
                    value={filters.slaStatus}
                    onChange={(value) => {
                      const newFilters = { ...filters, slaStatus: value }
                      setFilters(newFilters)
                      setPage(1) // Reset to first page when filter changes
                      // Update URL
                      const params = new URLSearchParams(searchParams)
                      if (value) {
                        params.set('slaStatus', value)
                      } else {
                        params.delete('slaStatus')
                      }
                      setSearchParams(params)
                    }}
                    options={[
                      { label: 'Within TAT', value: 'within_tat' },
                      { label: 'Breached', value: 'breached' },
                    ]}
                  />
                </Col>
                <Col span={8}>
                  <div style={{ marginBottom: 8 }}>Courier</div>
                  <Select
                    style={{ width: '100%' }}
                    placeholder="All Couriers"
                    allowClear
                    value={filters.courier}
                    onChange={(value) => {
                      const newFilters = { ...filters, courier: value }
                      setFilters(newFilters)
                      setPage(1) // Reset to first page when filter changes
                      // Update URL
                      const params = new URLSearchParams(searchParams)
                      if (value) {
                        params.set('courier', value)
                      } else {
                        params.delete('courier')
                      }
                      setSearchParams(params)
                    }}
                    options={Array.from(new Set(rows.map((r) => r.courier).filter(Boolean))).map(
                      (courier) => ({
                        label: courier,
                        value: courier,
                      }),
                    )}
                  />
                </Col>
              </Row>
            </Space>
          </Card>

          {/* Tabs */}
          <Tabs activeKey={activeTab} onChange={setActiveTab}>
            <Tabs.TabPane
              tab={
                <span>
                  <ClockCircleOutlined /> Pending Status Report
                </span>
              }
              key="report"
            >
          {/* Send Reminder Modal */}
          <Modal
            title="Send Manual Reminder"
            open={reminderModalVisible}
            onOk={handleConfirmSendReminder}
            onCancel={() => {
              setReminderModalVisible(false)
              setSelectedSLA(null)
              setCustomMessage('')
            }}
            confirmLoading={sendReminderMutation.isPending}
            okText="Send Reminder"
            cancelText="Cancel"
          >
            {selectedSLA && (
              <Space direction="vertical" style={{ width: '100%' }} size="large">
                <div>
                  <Text strong>Order:</Text> {selectedSLA.orderNumber || 'N/A'}
                </div>
                <div>
                  <Text strong>Seller:</Text> {selectedSLA.sellerName || 'N/A'}
                </div>
                <div>
                  <Text strong>Current Stage:</Text>{' '}
                  <Tag color={selectedSLA.currentStage === 'pending_awb' ? 'blue' : 'purple'}>
                    {selectedSLA.currentStage === 'pending_awb'
                      ? 'Pending AWB'
                      : selectedSLA.currentStage === 'pending_pickup'
                      ? 'Pending Pickup'
                      : selectedSLA.currentStage}
                  </Tag>
                </div>
                <div>
                  <Text strong>SLA Status:</Text>{' '}
                  {(selectedSLA.acceptanceTAT || selectedSLA.awbTAT || selectedSLA.pickupTAT)
                    ?.slaStatus === 'breached' ? (
                    <Tag color="red">Breached</Tag>
                  ) : (
                    <Tag color="green">Within TAT</Tag>
                  )}
                </div>
                <div>
                  <Text strong>Custom Message (Optional):</Text>
                  <TextArea
                    rows={4}
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    placeholder="Add a custom message to include in the reminder email..."
                  />
                </div>
              </Space>
            )}
          </Modal>

          {/* Report Table */}
          <Table
                columns={columns}
                dataSource={rows}
                loading={isLoading}
                rowKey="orderId"
                scroll={{ x: 1200 }}
                pagination={{
                  current: page,
                  pageSize: pageSize,
                  total: reportData?.data?.pagination?.total || rows.length,
                  showSizeChanger: true,
                  pageSizeOptions: ['20', '50', '100', '200'],
                  showTotal: (total, range) =>
                    `${range[0]}-${range[1]} of ${total} entries`,
                  onChange: (newPage, newPageSize) => {
                    setPage(newPage)
                    if (newPageSize !== pageSize) {
                      setPageSize(newPageSize)
                      setPage(1) // Reset to first page when page size changes
                    }
                  },
                }}
              />
            </Tabs.TabPane>
            <Tabs.TabPane
              tab={
                <span>
                  <FileTextOutlined /> SLA Audit Logs
                </span>
              }
              key="audit-log"
            >
              {/* Audit Log Filters */}
              <Card size="small" style={{ marginBottom: '16px' }}>
                <Space wrap>
                  <Select
                    placeholder="Event Type"
                    style={{ width: 200 }}
                    allowClear
                    value={auditLogFilters.eventType}
                    onChange={(value) =>
                      setAuditLogFilters({ ...auditLogFilters, eventType: value })
                    }
                  >
                    <Select.Option value="SLA_STARTED">SLA Started</Select.Option>
                    <Select.Option value="SLA_BREACHED">SLA Breached</Select.Option>
                    <Select.Option value="SLA_REMINDER_SENT">Reminder Sent</Select.Option>
                    <Select.Option value="SLA_RESOLVED">SLA Resolved</Select.Option>
                  </Select>

                  <Select
                    placeholder="SLA Type"
                    style={{ width: 150 }}
                    allowClear
                    value={auditLogFilters.slaType}
                    onChange={(value) =>
                      setAuditLogFilters({ ...auditLogFilters, slaType: value })
                    }
                  >
                    <Select.Option value="AWB">AWB</Select.Option>
                    <Select.Option value="DISPATCH">DISPATCH</Select.Option>
                  </Select>

                  <Select
                    placeholder="Seller"
                    style={{ width: 200 }}
                    allowClear
                    showSearch
                    optionFilterProp="children"
                    value={auditLogFilters.sellerId}
                    onChange={(value) =>
                      setAuditLogFilters({ ...auditLogFilters, sellerId: value })
                    }
                  >
                    {sellers.map((seller: AdminUser) => (
                      <Select.Option key={seller._id} value={seller._id}>
                        {seller.businessName || seller.name}
                      </Select.Option>
                    ))}
                  </Select>

                  <RangePicker
                    value={auditLogDateRange}
                    onChange={(dates) => setAuditLogDateRange(dates as [Dayjs, Dayjs] | null)}
                    showTime
                  />

                  <Button icon={<ReloadOutlined />} onClick={() => refetchAuditLog()}>
                    Refresh
                  </Button>
                </Space>
              </Card>

              <Table
                columns={auditLogColumns}
                dataSource={auditLogData?.data?.rows || []}
                loading={auditLogLoading}
                rowKey="_id"
                pagination={{
                  current: auditLogPage,
                  pageSize: auditLogLimit,
                  total: auditLogData?.data?.pagination?.total || 0,
                  onChange: (newPage) => setAuditLogPage(newPage),
                  showSizeChanger: false,
                  showTotal: (total) => `Total ${total} events`,
                }}
              />
            </Tabs.TabPane>
          </Tabs>
        </Space>
      </Card>
    </div>
  )
}

export default SalesPendingStatusReport

