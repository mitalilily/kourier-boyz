import {
  ArrowRightOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  LineChartOutlined,
  MessageOutlined,
  ReloadOutlined,
  TeamOutlined,
  TruckOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Badge, Button, Card, Col, DatePicker, Row, Select, Space, Tooltip } from 'antd'
import dayjs, { Dayjs } from 'dayjs'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  useCourierChargesSummary,
  useDashboardSummary,
  useHighReturnSellers,
  useOrderStatusDistribution,
  usePaymentMethodDistribution,
  usePendingActions,
  useProfitByCategory,
  useReturnReasonBreakdown,
  useRevenueChart,
  useSellerHealthScores,
  useTopCategories,
  useTopSellers,
  useTopSettlements,
} from '../api/dashboard'
import {
  fetchNewSellerRegistrationReport,
  fetchSLADashboardMetrics,
  fetchTicketSystemReport,
} from '../api/reports'
import {
  FeedbackRatingChart,
  HighReturnSellersTable,
  OrderStatusChart,
  PaymentMethodChart,
  ProfitByCategoryChart,
  QuickActions,
  ReturnReasonChart,
  RevenueChart,
  SellerHealthTable,
  SettlementsTable,
  StatCard,
  TopCategoriesChart,
  TopSellersTable,
} from '../components/dashboard'

const { RangePicker } = DatePicker

// Preset date ranges
const DATE_PRESETS = [
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'Last 7 Days', value: '7d' },
  { label: 'Last 30 Days', value: '30d' },
  { label: 'Last 90 Days', value: '90d' },
  { label: 'This Month', value: 'this_month' },
  { label: 'Last Month', value: 'last_month' },
  { label: 'This Year', value: 'this_year' },
]

const getDateRangeFromPreset = (preset: string): [Dayjs, Dayjs] => {
  const today = dayjs().endOf('day')

  switch (preset) {
    case 'today':
      return [dayjs().startOf('day'), today]
    case 'yesterday':
      return [dayjs().subtract(1, 'day').startOf('day'), dayjs().subtract(1, 'day').endOf('day')]
    case '7d':
      return [dayjs().subtract(6, 'day').startOf('day'), today]
    case '30d':
      return [dayjs().subtract(29, 'day').startOf('day'), today]
    case '90d':
      return [dayjs().subtract(89, 'day').startOf('day'), today]
    case 'this_month':
      return [dayjs().startOf('month'), today]
    case 'last_month':
      return [
        dayjs().subtract(1, 'month').startOf('month'),
        dayjs().subtract(1, 'month').endOf('month'),
      ]
    case 'this_year':
      return [dayjs().startOf('year'), today]
    default:
      return [dayjs().subtract(29, 'day').startOf('day'), today]
  }
}

// Format currency for display
const formatCurrency = (value: number | string): string => {
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (num >= 10000000) {
    return `₹${(num / 10000000).toFixed(2)}Cr`
  }
  if (num >= 100000) {
    return `₹${(num / 100000).toFixed(2)}L`
  }
  if (num >= 1000) {
    return `₹${(num / 1000).toFixed(1)}K`
  }
  return `₹${num.toLocaleString('en-IN')}`
}

const Dashboard = () => {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  // State for filters
  const [datePreset, setDatePreset] = useState('30d')
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>(getDateRangeFromPreset('30d'))
  const [granularity, setGranularity] = useState<'daily' | 'weekly' | 'monthly'>('daily')
  const [settlementStatus, setSettlementStatus] = useState<'PENDING' | 'PAID' | ''>('')

  // Convert date range to API params
  const dateParams = useMemo(
    () => ({
      startDate: dateRange[0].format('YYYY-MM-DD'),
      endDate: dateRange[1].format('YYYY-MM-DD'),
    }),
    [dateRange],
  )

  // API hooks
  const { data: summary, isLoading: summaryLoading } = useDashboardSummary(dateParams)
  const { data: revenueData, isLoading: revenueLoading } = useRevenueChart({
    ...dateParams,
    granularity,
  })
  const { data: topSellers, isLoading: topSellersLoading } = useTopSellers({
    ...dateParams,
    limit: 5,
  })
  const { data: highReturnSellers, isLoading: highReturnLoading } = useHighReturnSellers({
    ...dateParams,
    limit: 5,
  })
  const { data: orderStatus, isLoading: orderStatusLoading } =
    useOrderStatusDistribution(dateParams)
  const { data: returnReasons, isLoading: returnReasonsLoading } =
    useReturnReasonBreakdown(dateParams)
  const { data: pendingActions, isLoading: pendingActionsLoading } = usePendingActions()
  const { data: settlements, isLoading: settlementsLoading } = useTopSettlements({
    status: settlementStatus || undefined,
    limit: 5,
  })
  const { data: paymentMethods, isLoading: paymentMethodsLoading } =
    usePaymentMethodDistribution(dateParams)
  const { data: topCategories, isLoading: topCategoriesLoading } = useTopCategories({
    ...dateParams,
    limit: 5,
  })
  const { data: profitByCategory, isLoading: profitByCategoryLoading } = useProfitByCategory({
    ...dateParams,
    limit: 5,
  })
  const { data: sellerHealth, isLoading: sellerHealthLoading } = useSellerHealthScores({
    ...dateParams,
    limit: 20,
    minOrders: 5,
  })
  const { data: courierCharges, isLoading: courierChargesLoading } =
    useCourierChargesSummary(dateParams)

  // Fetch ticket metrics for dashboard widgets
  const { data: ticketMetricsData } = useQuery({
    queryKey: ['ticketMetrics'],
    queryFn: () => fetchTicketSystemReport({}),
    refetchInterval: 60000, // Refresh every minute
  })
  const ticketMetrics = ticketMetricsData?.data?.metrics

  // Fetch new seller registration data for this week
  const thisWeekStart = dayjs().subtract(7, 'days').startOf('day')
  const thisWeekEnd = dayjs().endOf('day')
  const { data: newSellersData } = useQuery({
    queryKey: [
      'new-sellers-this-week',
      thisWeekStart.format('YYYY-MM-DD'),
      thisWeekEnd.format('YYYY-MM-DD'),
    ],
    queryFn: () =>
      fetchNewSellerRegistrationReport({
        fromDate: thisWeekStart.toISOString(),
        toDate: thisWeekEnd.toISOString(),
      }),
  })

  // Fetch SLA metrics for today, MTD, and YTD
  const { data: slaMetricsToday } = useQuery({
    queryKey: ['sla-metrics', 'today'],
    queryFn: () => fetchSLADashboardMetrics('today'),
    refetchInterval: 60000, // Refresh every minute
  })
  const { data: slaMetricsMTD } = useQuery({
    queryKey: ['sla-metrics', 'mtd'],
    queryFn: () => fetchSLADashboardMetrics('mtd'),
  })

  // Handle date preset change
  const handlePresetChange = (value: string) => {
    setDatePreset(value)
    setDateRange(getDateRangeFromPreset(value))
  }

  // Handle custom date range change
  const handleDateRangeChange = (dates: [Dayjs | null, Dayjs | null] | null) => {
    if (dates && dates[0] && dates[1]) {
      setDatePreset('custom')
      setDateRange([dates[0], dates[1]])
    }
  }

  // Refresh all dashboard data
  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard-revenue-chart'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard-top-sellers'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard-high-return-sellers'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard-order-status'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard-pending-actions'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard-settlements'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard-payment-methods'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard-top-categories'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard-courier-charges-summary'] })
    queryClient.invalidateQueries({ queryKey: ['admin-feedback'] })
  }

  // Calculate total pending actions
  const totalPendingActions = pendingActions
    ? pendingActions.sellerApprovals.count +
      pendingActions.productApprovals.count +
      pendingActions.returnRequests.count +
      pendingActions.certificateApprovals.count +
      pendingActions.categoryRequests.count +
      pendingActions.reviewModeration.count
    : 0

  return (
    <div className="space-y-6 -m-6 p-6 bg-gray-50 min-h-full">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">
            Business overview for {dateRange[0].format('MMM DD')} -{' '}
            {dateRange[1].format('MMM DD, YYYY')}
          </p>
        </div>

        {/* Filters */}
        <Space wrap size="middle">
          <Space.Compact>
            <Select
              value={datePreset}
              onChange={handlePresetChange}
              style={{ width: 140 }}
              options={DATE_PRESETS}
              suffixIcon={<CalendarOutlined />}
            />
            <RangePicker
              value={dateRange}
              onChange={handleDateRangeChange}
              format="MMM DD, YYYY"
              allowClear={false}
              style={{ width: 260 }}
            />
          </Space.Compact>
          <Tooltip title="Refresh data">
            <Button icon={<ReloadOutlined />} onClick={handleRefresh} />
          </Tooltip>
        </Space>
      </div>

      {/* Section 1: Financial Overview */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={8}>
          <StatCard
            title="Gross Merchandise Value"
            value={summary?.gmv.value || 0}
            icon={<DollarOutlined />}
            iconBgColor="#f0fdf4"
            iconColor="#16a34a"
            accentColor="#16a34a"
            change={summary?.gmv.change}
            previousValue={summary?.gmv.previousValue}
            loading={summaryLoading}
            formatter={formatCurrency}
            tooltip="Total value of all paid orders (excluding cancelled/refunded)"
            onClick={() => {
              navigate(
                `/reports/sales?fromDate=${dateRange[0].format(
                  'YYYY-MM-DD',
                )}&toDate=${dateRange[1].format('YYYY-MM-DD')}`,
              )
            }}
          />
        </Col>
        <Col xs={24} lg={8}>
          <StatCard
            title="Platform Profit (After Settlement)"
            value={summary?.profit.value || 0}
            icon={<LineChartOutlined />}
            iconBgColor="#fef2f2"
            iconColor="#b91c1c"
            accentColor="#b91c1c"
            change={summary?.profit.change}
            previousValue={summary?.profit.previousValue}
            loading={summaryLoading}
            formatter={formatCurrency}
            tooltip="Platform Profit = Settled Sales (items + shipping) − Net Payout to Sellers"
            onClick={() => {
              navigate(
                `/reports/portal-income?fromDate=${dateRange[0].format(
                  'YYYY-MM-DD',
                )}&toDate=${dateRange[1].format('YYYY-MM-DD')}`,
              )
            }}
          />
        </Col>
        <Col xs={24} lg={8}>
          <StatCard
            title="Average Order Value"
            value={summary?.aov.value || 0}
            icon={<LineChartOutlined />}
            iconBgColor="#faf5ff"
            iconColor="#9333ea"
            accentColor="#9333ea"
            change={summary?.aov.change}
            previousValue={summary?.aov.previousValue}
            loading={summaryLoading}
            formatter={formatCurrency}
            tooltip="Average value per order (GMV / Total Orders)"
            onClick={() => {
              navigate(
                `/reports/sales?fromDate=${dateRange[0].format(
                  'YYYY-MM-DD',
                )}&toDate=${dateRange[1].format('YYYY-MM-DD')}`,
              )
            }}
          />
        </Col>
      </Row>

      {/* Section 2: Critical Alerts & Actions */}
      <QuickActions data={pendingActions} loading={pendingActionsLoading} />

      {/* Section 3: Operational Status */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={8}>
          <Card
            title={
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ClockCircleOutlined />
                  <span>Order Operations & SLA</span>
                </div>
                <Link to="/reports/sales-pending-status">
                  <Button type="link" size="small" icon={<ArrowRightOutlined />}>
                    View All
                  </Button>
                </Link>
              </div>
            }
          >
            <div className="space-y-3">
              <Tooltip title="Click to view">
                <div
                  className="p-3 border rounded-lg hover:border-orange-400 transition-colors cursor-pointer hover:shadow-md"
                  onClick={() => navigate('/reports/sales-pending-status?pendingStage=awb')}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-gray-600">Pending AWB</div>
                      <div className="text-xl font-bold text-orange-600">
                        {slaMetricsToday?.data?.metrics.pendingAWB || 0}
                      </div>
                    </div>
                    <ClockCircleOutlined className="text-xl text-orange-500" />
                  </div>
                </div>
              </Tooltip>
              <Tooltip title="Click to view">
                <div
                  className="p-3 border rounded-lg hover:border-green-400 transition-colors cursor-pointer hover:shadow-md"
                  onClick={() => navigate('/reports/sales-pending-status?pendingStage=pickup')}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-gray-600">Pending Pickup</div>
                      <div className="text-xl font-bold text-green-600">
                        {slaMetricsToday?.data?.metrics.pendingPickup || 0}
                      </div>
                    </div>
                    <TruckOutlined className="text-xl text-green-500" />
                  </div>
                </div>
              </Tooltip>
              <Tooltip title="Click to view">
                <div
                  className="p-3 border rounded-lg hover:border-red-400 transition-colors bg-red-50 cursor-pointer hover:shadow-md"
                  onClick={() => navigate('/reports/sales-pending-status?slaStatus=breached')}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-gray-600">Breached (Today)</div>
                      <div className="text-xl font-bold text-red-600">
                        {slaMetricsToday?.data?.metrics.totalBreachedSLA || 0}
                      </div>
                    </div>
                    <WarningOutlined className="text-xl text-red-500" />
                  </div>
                </div>
              </Tooltip>
              <Tooltip title="Click to view">
                <div
                  className="p-3 border rounded-lg hover:border-red-400 transition-colors cursor-pointer hover:shadow-md"
                  onClick={() => navigate('/reports/sales-pending-status?slaStatus=breached')}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-gray-600">Breached (MTD)</div>
                      <div className="text-xl font-bold text-red-600">
                        {slaMetricsMTD?.data?.metrics.totalBreachedSLA || 0}
                      </div>
                    </div>
                    <WarningOutlined className="text-xl text-red-500" />
                  </div>
                </div>
              </Tooltip>
            </div>
          </Card>
        </Col>

        {ticketMetrics && (
          <Col xs={24} lg={8}>
            <Card
              title={
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageOutlined />
                    <span>Support Tickets</span>
                  </div>
                  <Link to="/reports/tickets">
                    <Button type="link" size="small" icon={<ArrowRightOutlined />}>
                      View All
                    </Button>
                  </Link>
                </div>
              }
            >
              <div className="space-y-3">
                <Tooltip title="Click to view">
                  <div
                    className="p-3 border rounded-lg hover:border-red-400 transition-colors cursor-pointer hover:shadow-md"
                    onClick={() => navigate('/reports/tickets?slaBreached=YES')}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm text-gray-600">SLA Breached</div>
                        <div className="text-xl font-bold text-red-600">
                          {ticketMetrics.slaBreachedTickets}
                        </div>
                      </div>
                      <Badge count={ticketMetrics.slaBreachedTickets} showZero>
                        <WarningOutlined className="text-xl text-red-500" />
                      </Badge>
                    </div>
                  </div>
                </Tooltip>
                <Tooltip title="Click to view">
                  <div
                    className="p-3 border rounded-lg hover:border-orange-400 transition-colors cursor-pointer hover:shadow-md"
                    onClick={() => navigate('/reports/tickets')}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm text-gray-600">Near SLA</div>
                        <div className="text-xl font-bold text-orange-600">
                          {ticketMetricsData?.data?.rows.filter(
                            (row) =>
                              row.status !== 'closed' &&
                              row.slaHours &&
                              row.currentAgeHours > 0.75 * row.slaHours &&
                              row.slaBreached === 'NO',
                          ).length || 0}
                        </div>
                      </div>
                      <WarningOutlined className="text-xl text-orange-500" />
                    </div>
                  </div>
                </Tooltip>
                <Tooltip title="Click to view">
                  <div
                    className="p-3 border rounded-lg hover:border-blue-400 transition-colors cursor-pointer hover:shadow-md"
                    onClick={() => navigate('/reports/tickets?status=open')}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm text-gray-600">Open Tickets</div>
                        <div className="text-xl font-bold text-blue-600">
                          {ticketMetrics.openTickets}
                        </div>
                      </div>
                      <MessageOutlined className="text-xl text-blue-500" />
                    </div>
                  </div>
                </Tooltip>
                <Tooltip title="Click to view">
                  <div
                    className="p-3 border rounded-lg hover:border-purple-400 transition-colors cursor-pointer hover:shadow-md"
                    onClick={() => navigate('/reports/tickets')}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm text-gray-600">Avg Resolution</div>
                        <div className="text-xl font-bold text-purple-600">
                          {ticketMetrics.avgResolutionTime} hrs
                        </div>
                      </div>
                      <LineChartOutlined className="text-xl text-purple-500" />
                    </div>
                  </div>
                </Tooltip>
              </div>
            </Card>
          </Col>
        )}

        <Col xs={24} lg={8}>
          <Card
            title={
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TeamOutlined />
                  <span>Sellers & Growth</span>
                </div>
                <Link to="/sellers">
                  <Button type="link" size="small" icon={<ArrowRightOutlined />}>
                    View All
                  </Button>
                </Link>
              </div>
            }
          >
            <div className="space-y-3">
              <Tooltip title="Click to view">
                <div
                  className="p-3 border rounded-lg hover:border-orange-400 transition-colors cursor-pointer hover:shadow-md"
                  onClick={() => navigate('/sellers')}
                >
                  <div className="text-center">
                    <div className="text-sm text-gray-600 mb-1">Active Sellers</div>
                    <div className="text-2xl font-bold text-orange-600">
                      {summary?.sellers.active || 0}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      of {summary?.sellers.total || 0} total
                      {summary?.sellers.pendingApproval ? (
                        <span className="ml-1 text-amber-500">
                          <WarningOutlined /> {summary.sellers.pendingApproval}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </Tooltip>
              <Tooltip title="Click to view">
                <div
                  className="p-3 border rounded-lg hover:border-blue-400 transition-colors cursor-pointer hover:shadow-md"
                  onClick={() =>
                    navigate(
                      `/reports/new-sellers?fromDate=${encodeURIComponent(
                        thisWeekStart.toISOString(),
                      )}&toDate=${encodeURIComponent(thisWeekEnd.toISOString())}`,
                    )
                  }
                >
                  <div className="text-center">
                    <div className="text-sm text-gray-600 mb-1">New Sellers</div>
                    <div className="text-2xl font-bold text-blue-600">
                      {newSellersData?.data?.summary?.totalNewSellers || 0}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">This Week</div>
                  </div>
                </div>
              </Tooltip>
              <Tooltip title="Click to view">
                <div
                  className="p-3 border rounded-lg hover:border-green-400 transition-colors cursor-pointer hover:shadow-md"
                  onClick={() =>
                    navigate(
                      `/reports/new-sellers?productStatus=At least one product live&fromDate=${encodeURIComponent(
                        thisWeekStart.toISOString(),
                      )}&toDate=${encodeURIComponent(thisWeekEnd.toISOString())}`,
                    )
                  }
                >
                  <div className="text-center">
                    <div className="text-sm text-gray-600 mb-1">Live Sellers</div>
                    <div className="text-2xl font-bold text-green-600">
                      {newSellersData?.data?.summary?.liveProductSellersCount || 0}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">With products</div>
                  </div>
                </div>
              </Tooltip>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Section 5: Revenue & Analytics */}
      <Row gutter={[16, 16]}>
        <Col xs={24} xl={16}>
          <RevenueChart
            data={revenueData}
            loading={revenueLoading}
            granularity={granularity}
            onGranularityChange={setGranularity}
          />
        </Col>
        <Col xs={24} xl={8}>
          <div className="space-y-4">
            <OrderStatusChart data={orderStatus} loading={orderStatusLoading} />
            <PaymentMethodChart data={paymentMethods} loading={paymentMethodsLoading} />
          </div>
        </Col>
      </Row>

      {/* Section 6: Categories & Feedback */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <TopCategoriesChart data={topCategories} loading={topCategoriesLoading} />
        </Col>
        <Col xs={24} lg={12}>
          <FeedbackRatingChart />
        </Col>
      </Row>

      {/* Section 7: Financial Details */}
      <Row gutter={[16, 16]}>
        <Col xs={24}>
          <Card
            title={
              <div className="flex items-center gap-2">
                <TruckOutlined />
                <span className="text-lg font-semibold">Courier Charges (This Period)</span>
              </div>
            }
            loading={courierChargesLoading}
          >
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={8}>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">
                    {formatCurrency(courierCharges?.totalCourierCharges || 0)}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">Total Courier Charges (₹)</div>
                </div>
              </Col>
              <Col xs={24} sm={8}>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {formatCurrency(courierCharges?.forwardCharges || 0)}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">Forward Charges (₹)</div>
                </div>
              </Col>
              <Col xs={24} sm={8}>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {formatCurrency(courierCharges?.rtoAndReturnCharges || 0)}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">RTO + Return Charges (₹)</div>
                </div>
              </Col>
            </Row>
            <div className="mt-4 pt-4 border-t border-gray-200 text-xs text-gray-500">
              <p>
                <strong>Note:</strong> Charges are calculated from allocated courierCharge
                (order-level) to avoid double counting when multiple orders share one shipment
                (AWB).
              </p>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Section 8: Profit Analysis & Returns */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <ProfitByCategoryChart data={profitByCategory} loading={profitByCategoryLoading} />
        </Col>
        <Col xs={24} lg={12}>
          <ReturnReasonChart data={returnReasons} loading={returnReasonsLoading} />
        </Col>
      </Row>

      {/* Section 9: Seller Performance & Health */}
      <Row gutter={[16, 16]}>
        <Col xs={24} xl={12}>
          <TopSellersTable data={topSellers} loading={topSellersLoading} />
        </Col>
        <Col xs={24} xl={12}>
          <HighReturnSellersTable data={highReturnSellers} loading={highReturnLoading} />
        </Col>
      </Row>
      <Row gutter={[16, 16]}>
        <Col xs={24}>
          <SellerHealthTable data={sellerHealth} loading={sellerHealthLoading} />
        </Col>
      </Row>

      {/* Section 10: Settlements */}
      <SettlementsTable
        data={settlements}
        loading={settlementsLoading}
        statusFilter={settlementStatus}
        onStatusFilterChange={setSettlementStatus}
      />

      {/* Footer info */}
      <div className="text-center text-gray-400 text-xs py-4 border-t border-gray-200">
        <span>
          Showing data for {dateRange[0].format('MMM DD, YYYY')} -{' '}
          {dateRange[1].format('MMM DD, YYYY')}
        </span>
        {summary?.lowStockProducts ? (
          <span className="ml-4 text-amber-500">
            <WarningOutlined /> {summary.lowStockProducts} products with low stock
          </span>
        ) : null}
        {totalPendingActions > 0 && (
          <span className="ml-4 text-blue-500">{totalPendingActions} pending actions</span>
        )}
      </div>
    </div>
  )
}

export default Dashboard
