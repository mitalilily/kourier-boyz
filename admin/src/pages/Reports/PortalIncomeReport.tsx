import {
  DownOutlined,
  FileExcelOutlined,
  FilePdfOutlined,
  FilterOutlined,
  ReloadOutlined,
  RightOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import {
  App,
  Button,
  Card,
  Col,
  DatePicker,
  Input,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { ExpandableConfig } from 'antd/es/table/interface'
import dayjs, { type Dayjs } from 'dayjs'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  fetchPortalIncomeReport,
  type PortalIncomeOrderDetail,
  type PortalIncomeReportParams,
  type PortalIncomeSummaryRow,
} from '../../api/reports'
import { useUsers, type AdminUser } from '../../api/users'

const { RangePicker } = DatePicker
const { Title } = Typography

const PortalIncomeReport = () => {
  const { message } = App.useApp()

  // Default to last 30 days
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([
    dayjs().subtract(30, 'days'),
    dayjs(),
  ])
  const [filters, setFilters] = useState<PortalIncomeReportParams>({
    settlementStatus: 'ALL',
  })
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  // Fetch sellers for filter
  const { data: sellersData } = useUsers({ role: 'seller' })
  const sellers = sellersData || []

  // Build query params
  const queryParams = useMemo<PortalIncomeReportParams>(() => {
    return {
      fromDate: dateRange[0].startOf('day').toISOString(),
      toDate: dateRange[1].endOf('day').toISOString(),
      ...filters,
    }
  }, [dateRange, filters])

  // Fetch portal income report
  const {
    data: reportData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['portalIncomeReport', queryParams],
    queryFn: () => fetchPortalIncomeReport(queryParams),
  })

  const report = reportData?.data
  const summaryRows = report?.summary || []
  const totals = report?.totals

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount)
  }

  // Income type options
  const incomeTypeOptions = [
    { label: 'All Types', value: undefined },
    { label: 'Commission', value: 'Commission' },
    { label: 'Payment Gateway Fee', value: 'Payment Gateway Fee' },
    { label: 'Platform Adjustment', value: 'Platform Adjustment' },
    { label: 'Manual Adjustment', value: 'Manual Adjustment' },
    { label: 'COD Fee', value: 'COD Fee' },
  ]

  // Export to CSV (Excel-compatible)
  const handleExportExcel = () => {
    if (!report) return

    const headers = ['Date', 'Income Type', 'Gross Income', 'GST on Income', 'Net Portal Income']

    const csvRows = [
      headers.join(','),
      ...summaryRows.map((row) =>
        [
          row.date,
          `"${row.incomeType}"`,
          row.grossIncome,
          row.gstOnIncome,
          row.netPortalIncome,
        ].join(','),
      ),
      '',
      'Totals,',
      '',
      totals?.totalGrossIncome || 0,
      totals?.totalGstOnIncome || 0,
      totals?.totalNetPortalIncome || 0,
    ]

    const csvContent = csvRows.join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `portal-income-report-${dayjs().format('YYYY-MM-DD')}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    message.success('Report exported to CSV')
  }

  // Export to PDF (using print)
  const handleExportPDF = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Portal Income Report</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { color: #333; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; font-weight: bold; }
            .totals-row { font-weight: bold; background-color: #f9f9f9; }
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <h1>Portal Income Report</h1>
          <p><strong>Date Range:</strong> ${dateRange[0].format(
            'DD MMM YYYY',
          )} - ${dateRange[1].format('DD MMM YYYY')}</p>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Income Type</th>
                <th>Gross Income</th>
                <th>GST on Income</th>
                <th>Net Portal Income</th>
              </tr>
            </thead>
            <tbody>
              ${summaryRows
                .map(
                  (row) => `
                <tr>
                  <td>${row.date}</td>
                  <td>${row.incomeType}</td>
                  <td>${formatCurrency(row.grossIncome)}</td>
                  <td>${formatCurrency(row.gstOnIncome)}</td>
                  <td>${formatCurrency(row.netPortalIncome)}</td>
                </tr>
              `,
                )
                .join('')}
            </tbody>
            <tfoot>
              <tr class="totals-row">
                <td colspan="2"><strong>Totals</strong></td>
                <td><strong>${formatCurrency(totals?.totalGrossIncome || 0)}</strong></td>
                <td><strong>${formatCurrency(totals?.totalGstOnIncome || 0)}</strong></td>
                <td><strong>${formatCurrency(totals?.totalNetPortalIncome || 0)}</strong></td>
              </tr>
            </tfoot>
          </table>
        </body>
      </html>
    `

    printWindow.document.write(htmlContent)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => {
      printWindow.print()
    }, 250)
    message.success('Opening PDF print dialog')
  }

  // Order details columns (for expandable rows)
  const orderDetailColumns: ColumnsType<PortalIncomeOrderDetail> = [
    {
      title: 'Order ID',
      dataIndex: 'orderId',
      key: 'orderId',
      render: (orderId: string) => (
        <Link to={`/orders/${orderId}`} target="_blank">
          {orderId !== 'N/A' ? `ORD-${orderId.slice(-8)}` : 'N/A'}
        </Link>
      ),
    },
    {
      title: 'Seller Name',
      dataIndex: 'sellerName',
      key: 'sellerName',
    },
    {
      title: 'Income Type',
      dataIndex: 'incomeType',
      key: 'incomeType',
    },
    {
      title: 'Base Amount',
      dataIndex: 'baseAmount',
      key: 'baseAmount',
      align: 'right',
      render: (value: number) => formatCurrency(value),
    },
    {
      title: 'GST Amount',
      dataIndex: 'gstAmount',
      key: 'gstAmount',
      align: 'right',
      render: (value: number) => formatCurrency(value),
    },
    {
      title: 'Net Amount',
      dataIndex: 'netAmount',
      key: 'netAmount',
      align: 'right',
      render: (value: number) => <strong>{formatCurrency(value)}</strong>,
    },
    {
      title: 'Settlement Batch',
      dataIndex: 'settlementBatchId',
      key: 'settlementBatchId',
      render: (batchId?: string) =>
        batchId ? (
          <Link to={`/settlements/${batchId}`} target="_blank">
            View Batch
          </Link>
        ) : (
          <Tag color="default">Not Settled</Tag>
        ),
    },
  ]

  // Summary table columns
  const summaryColumns: ColumnsType<PortalIncomeSummaryRow> = [
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      fixed: 'left',
      width: 120,
      sorter: (a, b) => a.date.localeCompare(b.date),
    },
    {
      title: 'Income Type',
      dataIndex: 'incomeType',
      key: 'incomeType',
      width: 200,
      filters: [
        { text: 'Commission', value: 'Commission' },
        { text: 'Payment Gateway Fee', value: 'Payment Gateway Fee' },
        { text: 'Platform Adjustment', value: 'Platform Adjustment' },
        { text: 'Manual Adjustment', value: 'Manual Adjustment' },
        { text: 'COD Fee', value: 'COD Fee' },
      ],
      onFilter: (value, record) => record.incomeType === value,
    },
    {
      title: 'Gross Income',
      dataIndex: 'grossIncome',
      key: 'grossIncome',
      align: 'right',
      width: 150,
      render: (value: number) => formatCurrency(value),
      sorter: (a, b) => a.grossIncome - b.grossIncome,
    },
    {
      title: 'GST on Income',
      dataIndex: 'gstOnIncome',
      key: 'gstOnIncome',
      align: 'right',
      width: 150,
      render: (value: number) => formatCurrency(value),
      sorter: (a, b) => a.gstOnIncome - b.gstOnIncome,
    },
    {
      title: 'Net Portal Income',
      dataIndex: 'netPortalIncome',
      key: 'netPortalIncome',
      align: 'right',
      width: 180,
      render: (value: number) => <strong>{formatCurrency(value)}</strong>,
      sorter: (a, b) => a.netPortalIncome - b.netPortalIncome,
    },
  ]

  // Expandable configuration
  const expandable: ExpandableConfig<PortalIncomeSummaryRow> = {
    expandedRowRender: (record: PortalIncomeSummaryRow) => {
      const orderDetails = record.orderDetails || []
      if (orderDetails.length === 0) {
        return <div style={{ padding: '16px' }}>No order details available</div>
      }
      return (
        <Table
          columns={orderDetailColumns}
          dataSource={orderDetails}
          rowKey={(record: PortalIncomeOrderDetail) => `${record.orderId}-${record.incomeType}`}
          pagination={false}
          size="small"
        />
      )
    },
    expandRowByClick: false,
    expandIcon: ({
      expanded,
      onExpand,
      record,
    }: {
      expanded: boolean
      onExpand: (record: PortalIncomeSummaryRow, e: React.MouseEvent<HTMLElement>) => void
      record: PortalIncomeSummaryRow
    }) => {
      const rowKey = `${record.date}-${record.incomeType}`
      return (
        <Button
          type="text"
          size="small"
          icon={expanded ? <DownOutlined /> : <RightOutlined />}
          onClick={(e) => {
            e.stopPropagation()
            onExpand(record, e)
            const newExpanded = new Set(expandedRows)
            if (expanded) {
              newExpanded.delete(rowKey)
            } else {
              newExpanded.add(rowKey)
            }
            setExpandedRows(newExpanded)
          }}
        />
      )
    },
  }

  return (
    <div style={{ padding: '24px' }}>
      <Card>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Title level={2} style={{ margin: 0 }}>
              Portal Income Report
            </Title>
            <Space>
              <Button icon={<ReloadOutlined />} onClick={() => refetch()} loading={isLoading}>
                Refresh
              </Button>
              <Button
                type="primary"
                icon={<FileExcelOutlined />}
                onClick={handleExportExcel}
                disabled={!report}
              >
                Export Excel
              </Button>
              <Button
                type="primary"
                icon={<FilePdfOutlined />}
                onClick={handleExportPDF}
                disabled={!report}
              >
                Export PDF
              </Button>
            </Space>
          </div>

          {/* Summary Statistics */}
          {totals && (
            <Row gutter={16}>
              <Col span={8}>
                <Statistic
                  title="Total Gross Income"
                  value={totals.totalGrossIncome}
                  prefix="₹"
                  precision={0}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="Total GST on Income"
                  value={totals.totalGstOnIncome}
                  prefix="₹"
                  precision={0}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="Total Net Portal Income"
                  value={totals.totalNetPortalIncome}
                  prefix="₹"
                  precision={0}
                  valueStyle={{ color: '#1890ff', fontWeight: 'bold' }}
                />
              </Col>
            </Row>
          )}

          {/* Filters */}
          <Card
            size="small"
            title={
              <>
                <FilterOutlined /> Filters
              </>
            }
          >
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
                    onChange={(value) => setFilters({ ...filters, seller: value })}
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
                  <div style={{ marginBottom: 8 }}>Income Type</div>
                  <Select
                    style={{ width: '100%' }}
                    placeholder="All Types"
                    allowClear
                    value={filters.incomeType}
                    onChange={(value) => setFilters({ ...filters, incomeType: value })}
                    options={incomeTypeOptions}
                  />
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={8}>
                  <div style={{ marginBottom: 8 }}>Settlement Status</div>
                  <Select
                    style={{ width: '100%' }}
                    value={filters.settlementStatus}
                    onChange={(value) => setFilters({ ...filters, settlementStatus: value })}
                    options={[
                      { label: 'All', value: 'ALL' },
                      { label: 'Paid Only', value: 'PAID' },
                      { label: 'Pending Only', value: 'PENDING' },
                    ]}
                  />
                </Col>
                <Col span={8}>
                  <div style={{ marginBottom: 8 }}>Order ID</div>
                  <Input
                    placeholder="Search by Order ID"
                    allowClear
                    value={filters.orderId}
                    onChange={(e) =>
                      setFilters({ ...filters, orderId: e.target.value || undefined })
                    }
                  />
                </Col>
              </Row>
            </Space>
          </Card>

          {/* Report Table */}
          <Table
            columns={summaryColumns}
            dataSource={summaryRows}
            loading={isLoading}
            rowKey={(record) => `${record.date}-${record.incomeType}`}
            scroll={{ x: 1200 }}
            expandable={expandable}
            pagination={{
              pageSize: 50,
              showSizeChanger: true,
              showTotal: (total) => `Total ${total} entries`,
            }}
            summary={() => {
              if (!totals) return null
              return (
                <Table.Summary fixed>
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0} colSpan={2}>
                      <strong>Totals</strong>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={2} align="right">
                      <strong>{formatCurrency(totals.totalGrossIncome)}</strong>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={3} align="right">
                      <strong>{formatCurrency(totals.totalGstOnIncome)}</strong>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={4} align="right">
                      <strong style={{ color: '#1890ff' }}>
                        {formatCurrency(totals.totalNetPortalIncome)}
                      </strong>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                </Table.Summary>
              )
            }}
          />
        </Space>
      </Card>
    </div>
  )
}

export default PortalIncomeReport
