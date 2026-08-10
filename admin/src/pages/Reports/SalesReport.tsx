import {
  FileExcelOutlined,
  FilePdfOutlined,
  FilterOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import {
  App,
  Button,
  Card,
  DatePicker,
  Select,
  Space,
  Table,
  Typography,
  Row,
  Col,
  Statistic,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs, { type Dayjs } from 'dayjs'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchSalesReport, type SalesReportParams, type SalesReportRow, type GroupingType, type DateGroupingType } from '../../api/reports'
import { useCategories } from '../../api/category'
import { useUsers, type AdminUser } from '../../api/users'

const { RangePicker } = DatePicker
const { Title } = Typography

// Get unique states from sellers
const getSellerStates = (sellers: any[]) => {
  const states = new Set<string>()
  sellers.forEach((seller) => {
    if (seller.state) {
      states.add(seller.state)
    }
  })
  return Array.from(states).sort()
}

const SalesReport = () => {
  const { message } = App.useApp()
  
  // Default to last 30 days
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([
    dayjs().subtract(30, 'days'),
    dayjs(),
  ])
  const [filters, setFilters] = useState<SalesReportParams>({
    grouping: 'seller',
    dateGrouping: 'daily',
  })
  const [grouping, setGrouping] = useState<GroupingType>('seller')
  const [dateGrouping, setDateGrouping] = useState<DateGroupingType>('daily')

  // Fetch sellers for filter
  const { data: sellersData } = useUsers({ role: 'seller' })
  const sellers = sellersData || []
  const sellerStates = useMemo(() => getSellerStates(sellers), [sellers])

  // Fetch categories for filter
  const { data: categoriesData } = useCategories()
  const categories = categoriesData?.categories || []

  // Build query params
  const queryParams = useMemo<SalesReportParams>(() => {
    const params: SalesReportParams = {
      fromDate: dateRange[0].startOf('day').toISOString(),
      toDate: dateRange[1].endOf('day').toISOString(),
      grouping,
      ...filters,
    }
    
    if (grouping === 'date') {
      params.dateGrouping = dateGrouping
    }
    
    return params
  }, [dateRange, filters, grouping, dateGrouping])

  // Fetch sales report
  const { data: reportData, isLoading, refetch } = useQuery({
    queryKey: ['salesReport', queryParams],
    queryFn: () => fetchSalesReport(queryParams),
  })

  const report = reportData?.data
  const rows = report?.rows || []
  const totals = report?.totals

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount)
  }

  // Export to CSV (Excel-compatible)
  const handleExportExcel = () => {
    if (!report) return

    const headers = [
      'Identifier',
      'Gross Sales (Excl. GST)',
      'GST Amount',
      'Returns Amount',
      'Net Sales',
      'Shipping',
      'Discount',
      'Order Count',
      'Return Count',
      'Total Value',
    ]

    const fmt = (n: number | undefined) => (Number(n ?? 0)).toFixed(2)
    const int = (n: number | undefined) => String(Math.round(Number(n ?? 0)))

    const csvRows = [
      headers.join(','),
      ...rows.map((row) =>
        [
          `"${row.identifier}"`,
          fmt(row.grossSales),
          fmt(row.gstAmount),
          fmt(row.returnsAmount),
          fmt(row.netSales),
          fmt(row.shipping),
          fmt(row.discount),
          int(row.orderCount),
          int(row.returnCount),
          fmt(row.totalValue),
        ].join(',')
      ),
      '',
      [
        'Totals',
        fmt(totals?.grossSales),
        fmt(totals?.gstAmount),
        fmt(totals?.returnsAmount),
        fmt(totals?.netSales),
        fmt(totals?.shipping),
        fmt(totals?.discount),
        int(totals?.orderCount),
        int(totals?.returnCount),
        fmt(totals?.totalValue),
      ].join(','),
    ]

    const csvContent = csvRows.join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `sales-report-${dayjs().format('YYYY-MM-DD')}.csv`)
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
          <title>Sales Report</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { color: #333; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; font-weight: bold; }
            .totals-row { font-weight: bold; background-color: #f9f9f9; }
            .negative { color: #ff4d4f; }
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <h1>Sales Report</h1>
          <p><strong>Date Range:</strong> ${dateRange[0].format('DD MMM YYYY')} - ${dateRange[1].format('DD MMM YYYY')}</p>
          <p><strong>Grouping:</strong> ${grouping}</p>
          ${grouping === 'date' ? `<p><strong>Date Grouping:</strong> ${dateGrouping}</p>` : ''}
          <table>
            <thead>
              <tr>
                <th>Identifier</th>
                <th>Gross Sales (Excl. GST)</th>
                <th>GST Amount</th>
                <th>Returns Amount</th>
                <th>Net Sales</th>
                <th>Shipping</th>
                <th>Discount</th>
                <th>Order Count</th>
                <th>Return Count</th>
                <th>Total Value</th>
              </tr>
            </thead>
            <tbody>
              ${rows
                .map(
                  (row) => `
                <tr>
                  <td>${row.identifier}</td>
                  <td>${formatCurrency(row.grossSales)}</td>
                  <td>${formatCurrency(row.gstAmount)}</td>
                  <td class="${row.returnsAmount < 0 ? 'negative' : ''}">${formatCurrency(row.returnsAmount)}</td>
                  <td>${formatCurrency(row.netSales)}</td>
                  <td>${formatCurrency(row.shipping)}</td>
                  <td>${formatCurrency(row.discount)}</td>
                  <td>${row.orderCount}</td>
                  <td>${row.returnCount}</td>
                  <td>${formatCurrency(row.totalValue)}</td>
                </tr>
              `
                )
                .join('')}
            </tbody>
            <tfoot>
              <tr class="totals-row">
                <td><strong>Totals</strong></td>
                <td><strong>${formatCurrency(totals?.grossSales || 0)}</strong></td>
                <td><strong>${formatCurrency(totals?.gstAmount || 0)}</strong></td>
                <td class="${(totals?.returnsAmount || 0) < 0 ? 'negative' : ''}"><strong>${formatCurrency(totals?.returnsAmount || 0)}</strong></td>
                <td><strong>${formatCurrency(totals?.netSales || 0)}</strong></td>
                <td><strong>${formatCurrency(totals?.shipping || 0)}</strong></td>
                <td><strong>${formatCurrency(totals?.discount || 0)}</strong></td>
                <td><strong>${totals?.orderCount || 0}</strong></td>
                <td><strong>${totals?.returnCount || 0}</strong></td>
                <td><strong>${formatCurrency(totals?.totalValue || 0)}</strong></td>
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

  // Table columns
  const columns: ColumnsType<SalesReportRow> = [
    {
      title: 'Identifier',
      dataIndex: 'identifier',
      key: 'identifier',
      fixed: 'left',
      width: 200,
    },
    {
      title: 'Gross Sales (Excl. GST)',
      dataIndex: 'grossSales',
      key: 'grossSales',
      align: 'right',
      render: (value: number) => formatCurrency(value),
      sorter: (a, b) => a.grossSales - b.grossSales,
    },
    {
      title: 'GST Amount',
      dataIndex: 'gstAmount',
      key: 'gstAmount',
      align: 'right',
      render: (value: number) => formatCurrency(value),
      sorter: (a, b) => a.gstAmount - b.gstAmount,
    },
    {
      title: 'Returns Amount',
      dataIndex: 'returnsAmount',
      key: 'returnsAmount',
      align: 'right',
      render: (value: number) => (
        <span style={{ color: value < 0 ? '#ff4d4f' : undefined }}>
          {formatCurrency(value)}
        </span>
      ),
      sorter: (a, b) => a.returnsAmount - b.returnsAmount,
    },
    {
      title: 'Net Sales',
      dataIndex: 'netSales',
      key: 'netSales',
      align: 'right',
      render: (value: number) => formatCurrency(value),
      sorter: (a, b) => a.netSales - b.netSales,
    },
    {
      title: 'Shipping',
      dataIndex: 'shipping',
      key: 'shipping',
      align: 'right',
      render: (value: number) => formatCurrency(value),
      sorter: (a, b) => a.shipping - b.shipping,
    },
    {
      title: 'Discount',
      dataIndex: 'discount',
      key: 'discount',
      align: 'right',
      render: (value: number) => formatCurrency(value),
      sorter: (a, b) => a.discount - b.discount,
    },
    {
      title: 'Order Count',
      dataIndex: 'orderCount',
      key: 'orderCount',
      align: 'right',
      sorter: (a, b) => a.orderCount - b.orderCount,
    },
    {
      title: 'Return Count',
      dataIndex: 'returnCount',
      key: 'returnCount',
      align: 'right',
      sorter: (a, b) => a.returnCount - b.returnCount,
    },
    {
      title: 'Total Value',
      dataIndex: 'totalValue',
      key: 'totalValue',
      align: 'right',
      render: (value: number) => <strong>{formatCurrency(value)}</strong>,
      sorter: (a, b) => a.totalValue - b.totalValue,
    },
  ]

  return (
    <div style={{ padding: '24px' }}>
      <Card>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Title level={2} style={{ margin: 0 }}>
              Sales Report
            </Title>
            <Space>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => refetch()}
                loading={isLoading}
              >
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
              <Col span={6}>
                <Statistic
                  title="Gross Sales"
                  value={totals.grossSales}
                  prefix="₹"
                  precision={0}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="Net Sales"
                  value={totals.netSales}
                  prefix="₹"
                  precision={0}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="Total Orders"
                  value={totals.orderCount}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="Total Returns"
                  value={totals.returnCount}
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
                      }
                    }}
                  />
                </Col>
                <Col span={8}>
                  <div style={{ marginBottom: 8 }}>Group By</div>
                  <Select
                    style={{ width: '100%' }}
                    value={grouping}
                    onChange={(value) => {
                      setGrouping(value)
                      setFilters({ ...filters, grouping: value })
                    }}
                    options={[
                      { label: 'Seller-wise', value: 'seller' },
                      { label: 'State-wise', value: 'state' },
                      { label: 'Category-wise', value: 'category' },
                      { label: 'Product-wise', value: 'product' },
                      { label: 'Date-wise', value: 'date' },
                    ]}
                  />
                </Col>
                {grouping === 'date' && (
                  <Col span={8}>
                    <div style={{ marginBottom: 8 }}>Date Grouping</div>
                    <Select
                      style={{ width: '100%' }}
                      value={dateGrouping}
                      onChange={(value) => {
                        setDateGrouping(value)
                        setFilters({ ...filters, dateGrouping: value })
                      }}
                      options={[
                        { label: 'Daily', value: 'daily' },
                        { label: 'Weekly', value: 'weekly' },
                        { label: 'Monthly', value: 'monthly' },
                      ]}
                    />
                  </Col>
                )}
              </Row>
              <Row gutter={16}>
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
                  <div style={{ marginBottom: 8 }}>Seller State</div>
                  <Select
                    style={{ width: '100%' }}
                    placeholder="All States"
                    allowClear
                    value={filters.sellerState}
                    onChange={(value) => setFilters({ ...filters, sellerState: value })}
                    options={sellerStates.map((state) => ({
                      label: state,
                      value: state,
                    }))}
                  />
                </Col>
                <Col span={8}>
                  <div style={{ marginBottom: 8 }}>Category</div>
                  <Select
                    style={{ width: '100%' }}
                    placeholder="All Categories"
                    allowClear
                    value={filters.category}
                    onChange={(value) => setFilters({ ...filters, category: value })}
                    options={categories.map((cat) => ({
                      label: cat.name,
                      value: cat._id,
                    }))}
                    showSearch
                    filterOption={(input, option) =>
                      (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                    }
                  />
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={8}>
                  <div style={{ marginBottom: 8 }}>Order Status</div>
                  <Select
                    style={{ width: '100%' }}
                    placeholder="All Statuses"
                    allowClear
                    value={filters.orderStatus}
                    onChange={(value) => setFilters({ ...filters, orderStatus: value })}
                    options={[
                      { label: 'Delivered', value: 'delivered' },
                      { label: 'Returned', value: 'returned' },
                    ]}
                  />
                </Col>
                <Col span={8}>
                  <div style={{ marginBottom: 8 }}>Payment Method</div>
                  <Select
                    style={{ width: '100%' }}
                    placeholder="All Methods"
                    allowClear
                    value={filters.paymentMethod}
                    onChange={(value) => setFilters({ ...filters, paymentMethod: value })}
                    options={[
                      { label: 'COD', value: 'COD' },
                      { label: 'Prepaid', value: 'Prepaid' },
                    ]}
                  />
                </Col>
              </Row>
            </Space>
          </Card>

          {/* Report Table */}
          <Table
            columns={columns}
            dataSource={rows}
            loading={isLoading}
            rowKey="identifier"
            scroll={{ x: 1200 }}
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
                    <Table.Summary.Cell index={0}>
                      <strong>Totals</strong>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={1} align="right">
                      <strong>{formatCurrency(totals.grossSales)}</strong>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={2} align="right">
                      <strong>{formatCurrency(totals.gstAmount)}</strong>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={3} align="right">
                      <strong style={{ color: totals.returnsAmount < 0 ? '#ff4d4f' : undefined }}>
                        {formatCurrency(totals.returnsAmount)}
                      </strong>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={4} align="right">
                      <strong>{formatCurrency(totals.netSales)}</strong>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={5} align="right">
                      <strong>{totals.orderCount}</strong>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={6} align="right">
                      <strong>{totals.returnCount}</strong>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={7} align="right">
                      <strong>{formatCurrency(totals.totalValue)}</strong>
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

export default SalesReport

