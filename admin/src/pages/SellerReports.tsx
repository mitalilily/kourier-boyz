import { FileExcelOutlined, FilePdfOutlined } from '@ant-design/icons'
import {
  Button,
  Card,
  Col,
  DatePicker,
  Divider,
  Empty,
  Row,
  Select,
  Space,
  Table,
  Tabs,
  Typography,
  message,
} from 'antd'
import dayjs, { Dayjs } from 'dayjs'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  fetchSettlementReport,
  fetchTcsReport,
  fetchTdsReport,
  type SettlementReportRow,
  type TcsReportRow,
  type TdsReportRow,
} from '../api/settlements'
import { useUser } from '../api/users'

const { Title, Text } = Typography
const { RangePicker } = DatePicker
const { TabPane } = Tabs

const SellerReports = () => {
  const { id: sellerId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: seller, isLoading: isLoadingSeller } = useUser(sellerId || '')
  
  const [activeTab, setActiveTab] = useState('settlement')
  const [loading, setLoading] = useState(false)
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null]>([null, null])
  const [financialYear, setFinancialYear] = useState<string>('')
  const [settlementStatusFilter, setSettlementStatusFilter] = useState<'PAID' | 'PENDING' | 'ALL'>(
    'PAID',
  )
  const [settlementData, setSettlementData] = useState<SettlementReportRow[]>([])
  const [settlementSummary, setSettlementSummary] = useState<{
    totalOrders: number
    totalReturns: number
    totalSalesAmount: number
    totalGstAmount: number
    totalAmount: number
    totalCommission: number
    totalTdsAmount: number
    totalTcsAmount: number
    totalNetSettlementPayable: number
  } | null>(null)
  const [tdsData, setTdsData] = useState<TdsReportRow[]>([])
  const [tdsSummary, setTdsSummary] = useState<{
    totalBatches: number
    totalSalesInclGst: number
    totalTdsAmount: number
    exemptedBatches: number
  } | null>(null)
  const [tcsData, setTcsData] = useState<TcsReportRow[]>([])
  const [tcsSummary, setTcsSummary] = useState<{
    totalBatches: number
    totalSalesExclGst: number
    totalTcsAmount: number
    totalTcsIgst: number
    totalTcsCgst: number
    totalTcsSgst: number
  } | null>(null)

  // Generate financial year options
  const financialYearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear()
    const options = []
    for (let i = currentYear; i >= currentYear - 5; i--) {
      options.push({
        label: `${i}-${String(i + 1).slice(-2)}`,
        value: `${i}-${String(i + 1).slice(-2)}`,
      })
    }
    return options
  }, [])

  // Set default to current financial year
  useEffect(() => {
    const currentYear = new Date().getFullYear()
    const currentMonth = new Date().getMonth()
    const fy =
      currentMonth >= 3
        ? `${currentYear}-${String(currentYear + 1).slice(-2)}`
        : `${currentYear - 1}-${String(currentYear).slice(-2)}`
    setFinancialYear(fy)
  }, [])

  const loadSettlementReport = useCallback(async () => {
    if (!sellerId) return
    setLoading(true)
    try {
      const params: {
        sellerId: string
        fromDate?: string
        toDate?: string
        financialYear?: string
        status?: 'PAID' | 'PENDING' | 'ALL'
      } = { sellerId }
      if (dateRange[0] && dateRange[1]) {
        params.fromDate = dateRange[0].format('YYYY-MM-DD')
        params.toDate = dateRange[1].format('YYYY-MM-DD')
      } else if (financialYear) {
        params.financialYear = financialYear
      }
      if (settlementStatusFilter !== 'ALL') {
        params.status = settlementStatusFilter
      }

      const response = await fetchSettlementReport(params)
      if (response && typeof response === 'object' && 'data' in response) {
        setSettlementData(response.data.report)
        setSettlementSummary(response.data.summary)
        if (response.data.report.length === 0) {
          message.info('No data found for the selected filters.')
        }
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } }
      message.error(err?.response?.data?.message || 'Failed to load settlement report')
    } finally {
      setLoading(false)
    }
  }, [sellerId, dateRange, financialYear, settlementStatusFilter])

  const loadTdsReport = useCallback(async () => {
    if (!sellerId) return
    setLoading(true)
    try {
      const params: {
        sellerId: string
        fromDate?: string
        toDate?: string
        financialYear?: string
      } = { sellerId }
      if (dateRange[0] && dateRange[1]) {
        params.fromDate = dateRange[0].format('YYYY-MM-DD')
        params.toDate = dateRange[1].format('YYYY-MM-DD')
      } else if (financialYear) {
        params.financialYear = financialYear
      }

      const response = await fetchTdsReport(params)
      if (response && typeof response === 'object' && 'data' in response) {
        setTdsData(response.data.report)
        setTdsSummary(response.data.summary)
        if (response.data.report.length === 0) {
          message.info('No data found for the selected filters.')
        }
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } }
      message.error(err?.response?.data?.message || 'Failed to load TDS report')
    } finally {
      setLoading(false)
    }
  }, [sellerId, dateRange, financialYear])

  const loadTcsReport = useCallback(async () => {
    if (!sellerId) return
    setLoading(true)
    try {
      const params: {
        sellerId: string
        fromDate?: string
        toDate?: string
        financialYear?: string
      } = { sellerId }
      if (dateRange[0] && dateRange[1]) {
        params.fromDate = dateRange[0].format('YYYY-MM-DD')
        params.toDate = dateRange[1].format('YYYY-MM-DD')
      } else if (financialYear) {
        params.financialYear = financialYear
      }

      const response = await fetchTcsReport(params)
      if (response && typeof response === 'object' && 'data' in response) {
        setTcsData(response.data.report)
        setTcsSummary(response.data.summary)
        if (response.data.report.length === 0) {
          message.info('No data found for the selected filters.')
        }
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } }
      message.error(err?.response?.data?.message || 'Failed to load TCS report')
    } finally {
      setLoading(false)
    }
  }, [sellerId, dateRange, financialYear])

  // Auto-load when tab changes
  useEffect(() => {
    if (!sellerId) return
    if (activeTab === 'settlement') {
      loadSettlementReport()
    } else if (activeTab === 'tds') {
      loadTdsReport()
    } else {
      loadTcsReport()
    }
  }, [activeTab, sellerId, loadSettlementReport, loadTdsReport, loadTcsReport])

  // Auto-load when filters change (with debounce)
  useEffect(() => {
    if (!sellerId) return
    const timer = setTimeout(() => {
      if (activeTab === 'settlement') {
        loadSettlementReport()
      } else if (activeTab === 'tds') {
        loadTdsReport()
      } else {
        loadTcsReport()
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [
    dateRange,
    financialYear,
    settlementStatusFilter,
    activeTab,
    sellerId,
    loadSettlementReport,
    loadTdsReport,
    loadTcsReport,
  ])

  const handleDownload = async (type: 'settlement' | 'tds' | 'tcs', format: 'excel' | 'pdf') => {
    if (!sellerId) return
    try {
      let response: Blob
      if (type === 'settlement') {
        const params: {
          sellerId: string
          fromDate?: string
          toDate?: string
          financialYear?: string
          status?: 'PAID' | 'PENDING' | 'ALL'
          format: 'excel' | 'pdf'
        } = { sellerId, format }
        if (dateRange[0] && dateRange[1]) {
          params.fromDate = dateRange[0].format('YYYY-MM-DD')
          params.toDate = dateRange[1].format('YYYY-MM-DD')
        } else if (financialYear) {
          params.financialYear = financialYear
        }
        if (settlementStatusFilter !== 'ALL') {
          params.status = settlementStatusFilter
        }
        response = (await fetchSettlementReport(params)) as Blob
      } else if (type === 'tds') {
        const params: {
          sellerId: string
          fromDate?: string
          toDate?: string
          financialYear?: string
          format: 'excel' | 'pdf'
        } = { sellerId, format }
        if (dateRange[0] && dateRange[1]) {
          params.fromDate = dateRange[0].format('YYYY-MM-DD')
          params.toDate = dateRange[1].format('YYYY-MM-DD')
        } else if (financialYear) {
          params.financialYear = financialYear
        }
        response = (await fetchTdsReport(params)) as Blob
      } else {
        const params: {
          sellerId: string
          fromDate?: string
          toDate?: string
          financialYear?: string
          format: 'excel' | 'pdf'
        } = { sellerId, format }
        if (dateRange[0] && dateRange[1]) {
          params.fromDate = dateRange[0].format('YYYY-MM-DD')
          params.toDate = dateRange[1].format('YYYY-MM-DD')
        } else if (financialYear) {
          params.financialYear = financialYear
        }
        response = (await fetchTcsReport(params)) as Blob
      }

      const url = window.URL.createObjectURL(response)
      const a = document.createElement('a')
      a.href = url
      a.download = `${type}-report-${new Date().toISOString().split('T')[0]}.${
        format === 'excel' ? 'xlsx' : 'pdf'
      }`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      message.success(`Report downloaded successfully`)
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } }
      message.error(err?.response?.data?.message || 'Failed to download report')
    }
  }

  const settlementColumns = [
    {
      title: 'Order ID',
      dataIndex: 'orderNumber',
      key: 'orderNumber',
    },
    {
      title: 'Invoice No',
      dataIndex: 'invoiceNumber',
      key: 'invoiceNumber',
      render: (text: string | null | undefined) => text || '-',
    },
    {
      title: 'Invoice Date',
      dataIndex: 'invoiceDate',
      key: 'invoiceDate',
      render: (text: string | null | undefined) => (text ? dayjs(text).format('DD/MM/YYYY') : '-'),
    },
    {
      title: 'Sales Amount',
      dataIndex: 'salesAmount',
      key: 'salesAmount',
      render: (val: number | null | undefined) => `₹${Number(val || 0).toFixed(2)}`,
      align: 'right' as const,
    },
    {
      title: 'GST Amount',
      dataIndex: 'gstAmount',
      key: 'gstAmount',
      render: (val: number | null | undefined) => `₹${Number(val || 0).toFixed(2)}`,
      align: 'right' as const,
    },
    {
      title: 'Total',
      dataIndex: 'total',
      key: 'total',
      render: (val: number | null | undefined) => `₹${Number(val || 0).toFixed(2)}`,
      align: 'right' as const,
    },
    {
      title: 'Commission',
      dataIndex: 'commission',
      key: 'commission',
      render: (val: number | null | undefined) => `₹${Number(val || 0).toFixed(2)}`,
      align: 'right' as const,
    },
    {
      title: 'Courier Charges (Forward)',
      dataIndex: 'courierChargesForward',
      key: 'courierChargesForward',
      render: (val: number | null | undefined) => `₹${Number(val || 0).toFixed(2)}`,
      align: 'right' as const,
    },
    {
      title: 'Courier Charges (Return)',
      dataIndex: 'courierChargesReturn',
      key: 'courierChargesReturn',
      render: (val: number | null | undefined) => `₹${Number(val || 0).toFixed(2)}`,
      align: 'right' as const,
    },
    {
      title: 'COD Fees (Forward)',
      dataIndex: 'codFeesForward',
      key: 'codFeesForward',
      render: (val: number | null | undefined) => `₹${Number(val || 0).toFixed(2)}`,
      align: 'right' as const,
    },
    {
      title: 'COD Fees (Reverse)',
      dataIndex: 'codFeesReverse',
      key: 'codFeesReverse',
      render: (val: number | null | undefined) => `₹${Number(val || 0).toFixed(2)}`,
      align: 'right' as const,
    },
    {
      title: 'Other Charges',
      dataIndex: 'otherCharges',
      key: 'otherCharges',
      render: (val: number | null | undefined) => `₹${Number(val || 0).toFixed(2)}`,
      align: 'right' as const,
    },
    {
      title: 'TDS Amount',
      dataIndex: 'tdsAmount',
      key: 'tdsAmount',
      render: (val: number | null | undefined) => `₹${Number(val || 0).toFixed(2)}`,
      align: 'right' as const,
    },
    {
      title: 'TCS Amount',
      dataIndex: 'tcsAmount',
      key: 'tcsAmount',
      render: (val: number | null | undefined) => `₹${Number(val || 0).toFixed(2)}`,
      align: 'right' as const,
    },
    {
      title: 'Net Settlement Payable',
      dataIndex: 'netSettlementPayable',
      key: 'netSettlementPayable',
      render: (val: number | null | undefined) => `₹${Number(val || 0).toFixed(2)}`,
      align: 'right' as const,
      fixed: 'right' as const,
    },
  ]

  const tdsColumns = [
    {
      title: 'Settlement Batch',
      dataIndex: 'settlementBatchId',
      key: 'settlementBatchId',
      render: (text: string | null | undefined) => (text ? String(text).slice(-8) : '-'),
    },
    {
      title: 'From Date',
      dataIndex: 'fromDate',
      key: 'fromDate',
      render: (text: string | null | undefined) => (text ? dayjs(text).format('DD/MM/YYYY') : '-'),
    },
    {
      title: 'To Date',
      dataIndex: 'toDate',
      key: 'toDate',
      render: (text: string | null | undefined) => (text ? dayjs(text).format('DD/MM/YYYY') : '-'),
    },
    {
      title: 'Payout Date',
      dataIndex: 'payoutDate',
      key: 'payoutDate',
      render: (text: string | null | undefined) => (text ? dayjs(text).format('DD/MM/YYYY') : '-'),
    },
    {
      title: 'Seller Trade Name',
      dataIndex: 'sellerTradeName',
      key: 'sellerTradeName',
    },
    {
      title: 'Seller GSTIN',
      dataIndex: 'sellerGstin',
      key: 'sellerGstin',
    },
    {
      title: 'Seller PAN',
      dataIndex: 'sellerPan',
      key: 'sellerPan',
    },
    {
      title: 'Total Sales (including GST)',
      dataIndex: 'totalSalesInclGst',
      key: 'totalSalesInclGst',
      render: (val: number | null | undefined) => `₹${Number(val || 0).toFixed(2)}`,
      align: 'right' as const,
    },
    {
      title: 'TDS Amount',
      dataIndex: 'tdsAmount',
      key: 'tdsAmount',
      render: (val: number | null | undefined) => `₹${Number(val || 0).toFixed(2)}`,
      align: 'right' as const,
    },
  ]

  const tcsColumns = [
    {
      title: 'Settlement Batch',
      dataIndex: 'settlementBatchId',
      key: 'settlementBatchId',
      render: (text: string | null | undefined) => (text ? String(text).slice(-8) : '-'),
    },
    {
      title: 'From Date',
      dataIndex: 'fromDate',
      key: 'fromDate',
      render: (text: string | null | undefined) => (text ? dayjs(text).format('DD/MM/YYYY') : '-'),
    },
    {
      title: 'To Date',
      dataIndex: 'toDate',
      key: 'toDate',
      render: (text: string | null | undefined) => (text ? dayjs(text).format('DD/MM/YYYY') : '-'),
    },
    {
      title: 'Seller State',
      dataIndex: 'sellerState',
      key: 'sellerState',
    },
    {
      title: 'Seller GSTIN',
      dataIndex: 'sellerGstin',
      key: 'sellerGstin',
    },
    {
      title: 'Customer Type',
      dataIndex: 'customerType',
      key: 'customerType',
      render: (value: string) => value || 'All',
    },
    {
      title: 'Sales Amount (excluding GST)',
      dataIndex: 'salesAmountExclGst',
      key: 'salesAmountExclGst',
      render: (val: number | null | undefined) => `₹${Number(val || 0).toFixed(2)}`,
      align: 'right' as const,
    },
    {
      title: 'IGST TCS',
      dataIndex: 'tcsIgstAmount',
      key: 'tcsIgstAmount',
      render: (val: number | null | undefined) => `₹${Number(val || 0).toFixed(2)}`,
      align: 'right' as const,
    },
    {
      title: 'CGST TCS',
      dataIndex: 'tcsCgstAmount',
      key: 'tcsCgstAmount',
      render: (val: number | null | undefined) => `₹${Number(val || 0).toFixed(2)}`,
      align: 'right' as const,
    },
    {
      title: 'SGST TCS',
      dataIndex: 'tcsSgstAmount',
      key: 'tcsSgstAmount',
      render: (val: number | null | undefined) => `₹${Number(val || 0).toFixed(2)}`,
      align: 'right' as const,
    },
    {
      title: 'Total TCS Amount',
      dataIndex: 'totalTcsAmount',
      key: 'totalTcsAmount',
      render: (val: number | null | undefined) => `₹${Number(val || 0).toFixed(2)}`,
      align: 'right' as const,
    },
  ]

  const hasData = settlementData.length > 0 || tdsData.length > 0 || tcsData.length > 0

  if (isLoadingSeller) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <Text>Loading seller information...</Text>
      </div>
    )
  }

  if (!seller || seller.role !== 'seller') {
    return (
      <div style={{ padding: '24px' }}>
        <Card>
          <Text type="danger">Invalid seller or seller not found.</Text>
          <Button onClick={() => navigate('/sellers')} style={{ marginTop: 16 }}>
            Back to Sellers
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div style={{ padding: '24px' }}>
      <div
        style={{
          marginBottom: 24,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <Title level={2} style={{ margin: 0 }}>
            Seller Reports: {seller.businessName || seller.name}
          </Title>
          <Text type="secondary">
            Viewing reports for seller. Numbers match exactly what seller sees.
          </Text>
        </div>
        <Space>
          <Button onClick={() => navigate(`/sellers/${sellerId}`)}>Back to Seller Details</Button>
          {hasData && (
            <>
              <Button
                icon={<FileExcelOutlined />}
                onClick={() => handleDownload(activeTab as 'settlement' | 'tds' | 'tcs', 'excel')}
              >
                Download Excel
              </Button>
              <Button
                icon={<FilePdfOutlined />}
                onClick={() => handleDownload(activeTab as 'settlement' | 'tds' | 'tcs', 'pdf')}
              >
                Download PDF
              </Button>
            </>
          )}
        </Space>
      </div>

      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          tabBarExtraContent={
            <Space>
              <Text type="secondary">Filter by:</Text>
              <RangePicker
                value={dateRange}
                onChange={(dates) => {
                  setDateRange(dates as [Dayjs | null, Dayjs | null])
                  setFinancialYear('')
                }}
                placeholder={['Start Date', 'End Date']}
              />
              <Text type="secondary">or</Text>
              <Select
                placeholder="Financial Year"
                style={{ width: 150 }}
                value={financialYear}
                onChange={(value) => {
                  setFinancialYear(value)
                  setDateRange([null, null])
                }}
                options={financialYearOptions}
                allowClear
              />
              {activeTab === 'settlement' && (
                <>
                  <Divider type="vertical" />
                  <Select
                    placeholder="Status"
                    style={{ width: 120 }}
                    value={settlementStatusFilter}
                    onChange={(value) =>
                      setSettlementStatusFilter(value as 'PAID' | 'PENDING' | 'ALL')
                    }
                    options={[
                      { label: 'Paid', value: 'PAID' },
                      { label: 'Pending', value: 'PENDING' },
                      { label: 'All', value: 'ALL' },
                    ]}
                  />
                </>
              )}
            </Space>
          }
        >
          <TabPane tab="Settlement Report" key="settlement">
            {loading && settlementData.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <Text type="secondary">Loading report data...</Text>
              </div>
            ) : settlementData.length > 0 ? (
              <>
                {settlementSummary && (
                  <Card size="small" style={{ marginBottom: 16, background: '#f5f5f5' }}>
                    <Row gutter={[16, 8]}>
                      <Col span={6}>
                        <Text strong>Total Orders:</Text> {settlementSummary.totalOrders}
                      </Col>
                      <Col span={6}>
                        <Text strong>Total Returns:</Text> {settlementSummary.totalReturns}
                      </Col>
                      <Col span={6}>
                        <Text strong>Total Sales:</Text> ₹
                        {Number(settlementSummary.totalSalesAmount || 0).toFixed(2)}
                      </Col>
                      <Col span={6}>
                        <Text strong>Total Commission:</Text> ₹
                        {Number(settlementSummary.totalCommission || 0).toFixed(2)}
                      </Col>
                      <Col span={6}>
                        <Text strong>Total TDS:</Text> ₹
                        {Number(settlementSummary.totalTdsAmount || 0).toFixed(2)}
                      </Col>
                      <Col span={6}>
                        <Text strong>Total TCS:</Text> ₹
                        {Number(settlementSummary.totalTcsAmount || 0).toFixed(2)}
                      </Col>
                      <Col span={6}>
                        <Text strong>Net Settlement:</Text> ₹
                        {Number(settlementSummary.totalNetSettlementPayable || 0).toFixed(2)}
                      </Col>
                    </Row>
                  </Card>
                )}
                <Table
                  columns={settlementColumns}
                  dataSource={settlementData}
                  rowKey="orderId"
                  scroll={{ x: 1500 }}
                  pagination={{ pageSize: 50, showSizeChanger: true }}
                  loading={loading}
                />
              </>
            ) : (
              <Empty
                description="No data found for the selected filters. Try adjusting your date range or financial year."
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            )}
          </TabPane>
          <TabPane tab="TDS Report (Section 194O)" key="tds">
            {loading && tdsData.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <Text type="secondary">Loading report data...</Text>
              </div>
            ) : tdsData.length > 0 ? (
              <>
                {tdsSummary && (
                  <Card size="small" style={{ marginBottom: 16, background: '#f5f5f5' }}>
                    <Row gutter={[16, 8]}>
                      <Col span={6}>
                        <Text strong>Total Batches:</Text> {tdsSummary.totalBatches}
                      </Col>
                      <Col span={6}>
                        <Text strong>Total Sales:</Text> ₹
                        {Number(tdsSummary.totalSalesInclGst || 0).toFixed(2)}
                      </Col>
                      <Col span={6}>
                        <Text strong>Total TDS:</Text> ₹
                        {Number(tdsSummary.totalTdsAmount || 0).toFixed(2)}
                      </Col>
                      <Col span={6}>
                        <Text strong>Exempted Batches:</Text> {tdsSummary.exemptedBatches}
                      </Col>
                    </Row>
                  </Card>
                )}
                <Table
                  columns={tdsColumns}
                  dataSource={tdsData}
                  rowKey={(record, index) => `${record.settlementBatchId}-${index}`}
                  scroll={{ x: 1200 }}
                  pagination={{ pageSize: 50, showSizeChanger: true }}
                  loading={loading}
                />
              </>
            ) : (
              <Empty
                description="No data found for the selected filters. Try adjusting your date range or financial year."
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            )}
          </TabPane>
          <TabPane tab="TCS Report (GST)" key="tcs">
            {loading && tcsData.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <Text type="secondary">Loading report data...</Text>
              </div>
            ) : tcsData.length > 0 ? (
              <>
                {tcsSummary && (
                  <Card size="small" style={{ marginBottom: 16, background: '#f5f5f5' }}>
                    <Row gutter={[16, 8]}>
                      <Col span={6}>
                        <Text strong>Total Batches:</Text> {tcsSummary.totalBatches}
                      </Col>
                      <Col span={6}>
                        <Text strong>Total Sales (excl GST):</Text> ₹
                        {Number(tcsSummary.totalSalesExclGst || 0).toFixed(2)}
                      </Col>
                      <Col span={6}>
                        <Text strong>Total TCS:</Text> ₹
                        {Number(tcsSummary.totalTcsAmount || 0).toFixed(2)}
                      </Col>
                      <Col span={6}>
                        <Text strong>IGST TCS:</Text> ₹
                        {Number(tcsSummary.totalTcsIgst || 0).toFixed(2)}
                      </Col>
                      <Col span={6}>
                        <Text strong>CGST TCS:</Text> ₹
                        {Number(tcsSummary.totalTcsCgst || 0).toFixed(2)}
                      </Col>
                      <Col span={6}>
                        <Text strong>SGST TCS:</Text> ₹
                        {Number(tcsSummary.totalTcsSgst || 0).toFixed(2)}
                      </Col>
                    </Row>
                  </Card>
                )}
                <Table
                  columns={tcsColumns}
                  dataSource={tcsData}
                  rowKey={(record, index) =>
                    `${record.settlementBatchId}-${record.customerType || 'all'}-${index}`
                  }
                  scroll={{ x: 1200 }}
                  pagination={{ pageSize: 50, showSizeChanger: true }}
                  loading={loading}
                />
              </>
            ) : (
              <Empty
                description="No data found for the selected filters. Try adjusting your date range or financial year."
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            )}
          </TabPane>
        </Tabs>
      </Card>
    </div>
  )
}

export default SellerReports

