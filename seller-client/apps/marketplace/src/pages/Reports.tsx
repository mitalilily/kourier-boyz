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
import {
  fetchSettlementReport,
  fetchTcsReport,
  fetchTdsReport,
  type SettlementReportRow,
  type TcsReportRow,
  type TdsReportRow,
} from '../api/settlements'

const { Title, Text } = Typography
const { RangePicker } = DatePicker
const { TabPane } = Tabs

const ReportsPage = () => {
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
    setLoading(true)
    try {
      const params: Record<string, string> = {}
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
  }, [dateRange, financialYear, settlementStatusFilter])

  const loadTdsReport = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (dateRange[0] && dateRange[1]) {
        params.fromDate = dateRange[0].format('YYYY-MM-DD')
        params.toDate = dateRange[1].format('YYYY-MM-DD')
      } else if (financialYear) {
        params.financialYear = financialYear
      }

      const response = await fetchTdsReport(params)
      if (response && typeof response === 'object' && 'data' in response) {
        // Backend returns 'rows' and 'totals', not 'report' and 'summary'
        const data = response.data as {
          rows?: TdsReportRow[]
          report?: TdsReportRow[]
          totals?: { settlementCount?: number; totalSales?: number; totalTds?: number }
          summary?: { settlementCount?: number; totalSales?: number; totalTds?: number }
        }
        const rows = data.rows || data.report || []
        const totals = data.totals || data.summary
        setTdsData(rows)
        setTdsSummary(totals ? {
          totalBatches: totals.settlementCount || 0,
          totalSalesInclGst: totals.totalSales || 0,
          totalTdsAmount: totals.totalTds || 0,
          exemptedBatches: 0,
        } : null)
        if (rows.length === 0) {
          message.info('No data found for the selected filters.')
        }
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } }
      message.error(err?.response?.data?.message || 'Failed to load TDS report')
    } finally {
      setLoading(false)
    }
  }, [dateRange, financialYear])

  const loadTcsReport = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (dateRange[0] && dateRange[1]) {
        params.fromDate = dateRange[0].format('YYYY-MM-DD')
        params.toDate = dateRange[1].format('YYYY-MM-DD')
      } else if (financialYear) {
        params.financialYear = financialYear
      }

      const response = await fetchTcsReport(params)
      if (response && typeof response === 'object' && 'data' in response) {
        // Backend returns 'rows' and 'totals', not 'report' and 'summary'
        const data = response.data as {
          rows?: TcsReportRow[]
          report?: TcsReportRow[]
          totals?: { settlementCount?: number; totalSales?: number; totalTcs?: number }
          summary?: { settlementCount?: number; totalSales?: number; totalTcs?: number }
        }
        const rows = data.rows || data.report || []
        const totals = data.totals || data.summary
        
        // Calculate IGST, CGST, SGST totals from rows
        const tcsTotals = rows.reduce(
          (acc, row) => ({
            totalTcsIgst: acc.totalTcsIgst + (row.tcsIgstAmount || 0),
            totalTcsCgst: acc.totalTcsCgst + (row.tcsCgstAmount || 0),
            totalTcsSgst: acc.totalTcsSgst + (row.tcsSgstAmount || 0),
          }),
          { totalTcsIgst: 0, totalTcsCgst: 0, totalTcsSgst: 0 },
        )
        
        setTcsData(rows)
        setTcsSummary(totals ? {
          totalBatches: totals.settlementCount || 0,
          totalSalesExclGst: totals.totalSales || 0,
          totalTcsAmount: totals.totalTcs || 0,
          totalTcsIgst: tcsTotals.totalTcsIgst,
          totalTcsCgst: tcsTotals.totalTcsCgst,
          totalTcsSgst: tcsTotals.totalTcsSgst,
        } : null)
        if (rows.length === 0) {
          message.info('No data found for the selected filters.')
        }
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } }
      message.error(err?.response?.data?.message || 'Failed to load TCS report')
    } finally {
      setLoading(false)
    }
  }, [dateRange, financialYear])

  // Auto-load when tab changes
  useEffect(() => {
    if (activeTab === 'settlement') {
      loadSettlementReport()
    } else if (activeTab === 'tds') {
      loadTdsReport()
    } else {
      loadTcsReport()
    }
  }, [activeTab, loadSettlementReport, loadTdsReport, loadTcsReport])

  // Auto-load when filters change (with debounce)
  useEffect(() => {
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
    loadSettlementReport,
    loadTdsReport,
    loadTcsReport,
  ])

  const handleDownload = async (type: 'settlement' | 'tds' | 'tcs', format: 'excel' | 'pdf') => {
    try {
      const params: Record<string, string> = { format }
      if (dateRange[0] && dateRange[1]) {
        params.fromDate = dateRange[0].format('YYYY-MM-DD')
        params.toDate = dateRange[1].format('YYYY-MM-DD')
      } else if (financialYear) {
        params.financialYear = financialYear
      }
      if (type === 'settlement' && settlementStatusFilter !== 'ALL') {
        params.status = settlementStatusFilter
      }

      let response: Blob
      if (type === 'settlement') {
        response = (await fetchSettlementReport(params)) as Blob
      } else if (type === 'tds') {
        response = (await fetchTdsReport(params)) as Blob
      } else {
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
      title: 'Financial Year',
      dataIndex: 'financialYear',
      key: 'financialYear',
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
      title: 'Gross Sales (Incl. GST)',
      dataIndex: 'grossSalesInclGst',
      key: 'grossSalesInclGst',
      render: (val: number | null | undefined) => `₹${Number(val || 0).toFixed(2)}`,
      align: 'right' as const,
    },
    {
      title: 'TDS Rate (%)',
      dataIndex: 'tdsRate',
      key: 'tdsRate',
      render: (val: number | null | undefined) => `${Number(val || 0)}%`,
      align: 'right' as const,
    },
    {
      title: 'TDS Deducted',
      dataIndex: 'tdsDeducted',
      key: 'tdsDeducted',
      render: (val: number | null | undefined) => `₹${Number(val || 0).toFixed(2)}`,
      align: 'right' as const,
    },
    {
      title: 'TDS Deduction Status',
      dataIndex: 'tdsDeductionStatus',
      key: 'tdsDeductionStatus',
    },
    {
      title: 'Last Settlement Date',
      dataIndex: 'lastSettlementDate',
      key: 'lastSettlementDate',
      render: (text: string | null | undefined) => (text ? dayjs(text).format('DD/MM/YYYY') : '-'),
    },
  ]

  const tcsColumns = [
    {
      title: 'Financial Year',
      dataIndex: 'financialYear',
      key: 'financialYear',
    },
    {
      title: 'Seller Trade Name',
      dataIndex: 'sellerTradeName',
      key: 'sellerTradeName',
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
      title: 'Supply Type',
      dataIndex: 'supplyType',
      key: 'supplyType',
    },
    {
      title: 'Taxable Sales Value (Excl. GST)',
      dataIndex: 'taxableSalesValue',
      key: 'taxableSalesValue',
      render: (val: number | null | undefined) => `₹${Number(val || 0).toFixed(2)}`,
      align: 'right' as const,
    },
    {
      title: 'TCS Rate (%)',
      dataIndex: 'tcsRate',
      key: 'tcsRate',
      render: (val: number | null | undefined) => `${Number(val || 0)}%`,
      align: 'right' as const,
    },
    {
      title: 'IGST TCS',
      dataIndex: 'igstTcsAmount',
      key: 'igstTcsAmount',
      render: (val: number | null | undefined) => (val && val > 0 ? `₹${Number(val).toFixed(2)}` : '-'),
      align: 'right' as const,
    },
    {
      title: 'CGST TCS',
      dataIndex: 'cgstTcsAmount',
      key: 'cgstTcsAmount',
      render: (val: number | null | undefined) => (val && val > 0 ? `₹${Number(val).toFixed(2)}` : '-'),
      align: 'right' as const,
    },
    {
      title: 'SGST TCS',
      dataIndex: 'sgstTcsAmount',
      key: 'sgstTcsAmount',
      render: (val: number | null | undefined) => (val && val > 0 ? `₹${Number(val).toFixed(2)}` : '-'),
      align: 'right' as const,
    },
    {
      title: 'Total TCS Amount',
      dataIndex: 'totalTcsAmount',
      key: 'totalTcsAmount',
      render: (val: number | null | undefined) => `₹${Number(val || 0).toFixed(2)}`,
      align: 'right' as const,
    },
    {
      title: 'Last Settlement Date',
      dataIndex: 'lastSettlementDate',
      key: 'lastSettlementDate',
      render: (text: string | null | undefined) => (text ? dayjs(text).format('DD/MM/YYYY') : '-'),
    },
  ]

  const hasData = settlementData.length > 0 || tdsData.length > 0 || tcsData.length > 0

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
        <Title level={2} style={{ margin: 0 }}>
          Reports
        </Title>
        {hasData && (
          <Space>
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
          </Space>
        )}
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
                  rowKey={(record, index) => `${record.settlementBatchId || 'batch'}-${index}`}
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
                    `${record.settlementBatchId || 'batch'}-${record.customerType || 'all'}-${index}`
                  }
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
        </Tabs>
      </Card>
    </div>
  )
}

export default ReportsPage
