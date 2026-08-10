import {
  FileExcelOutlined,
  FilePdfOutlined,
  FilterOutlined,
  ReloadOutlined,
  UserOutlined,
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
  Tag,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs, { type Dayjs } from 'dayjs'
import { useMemo, useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import {
  fetchNewSellerRegistrationReport,
  type NewSellerReportParams,
  type NewSellerReportRow,
} from '../../api/reports'
import { useUsers } from '../../api/users'
import { Link } from 'react-router-dom'

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

const NewSellerRegistrationReport = () => {
  const { message } = App.useApp()
  const [searchParams, setSearchParams] = useSearchParams()

  // Read initial values from URL params
  const urlFromDate = searchParams.get('fromDate')
  const urlToDate = searchParams.get('toDate')
  const urlVerificationStatus = searchParams.get('verificationStatus') as 'PENDING' | 'VERIFIED' | 'REJECTED' | null
  const urlProductStatus = searchParams.get('productStatus') as 'No product added' | 'Products added but not live' | 'At least one product live' | null
  const urlState = searchParams.get('state')
  const urlGstStatus = searchParams.get('gstStatus') as 'Provided' | 'Not Provided' | null
  const urlPanStatus = searchParams.get('panStatus') as 'Provided' | 'Not Provided' | null

  // Default to last 7 days, or use URL params
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([
    urlFromDate ? dayjs(urlFromDate) : dayjs().subtract(7, 'days'),
    urlToDate ? dayjs(urlToDate) : dayjs(),
  ])
  const [filters, setFilters] = useState<NewSellerReportParams>({
    verificationStatus: urlVerificationStatus || undefined,
    productStatus: urlProductStatus || undefined,
    state: urlState || undefined,
    gstStatus: urlGstStatus || undefined,
    panStatus: urlPanStatus || undefined,
  })
  const [sortBy, setSortBy] = useState<'registrationDate' | 'businessName' | 'verificationStatus' | 'productStatus'>('registrationDate')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // Update URL params when filters change
  useEffect(() => {
    const params = new URLSearchParams()
    params.set('fromDate', dateRange[0].toISOString())
    params.set('toDate', dateRange[1].toISOString())
    if (filters.verificationStatus) params.set('verificationStatus', filters.verificationStatus)
    if (filters.productStatus) params.set('productStatus', filters.productStatus)
    if (filters.state) params.set('state', filters.state)
    if (filters.gstStatus) params.set('gstStatus', filters.gstStatus)
    if (filters.panStatus) params.set('panStatus', filters.panStatus)
    setSearchParams(params, { replace: true })
  }, [dateRange, filters, setSearchParams])

  // Fetch sellers for filter
  const { data: sellersData } = useUsers({ role: 'seller' })
  const sellers = sellersData || []
  const sellerStates = useMemo(() => getSellerStates(sellers), [sellers])

  // Build query params
  const queryParams = useMemo<NewSellerReportParams>(() => {
    const params: NewSellerReportParams = {
      fromDate: dateRange[0].startOf('day').toISOString(),
      toDate: dateRange[1].endOf('day').toISOString(),
      sortBy,
      sortOrder,
      ...filters,
    }
    return params
  }, [dateRange, filters, sortBy, sortOrder])

  // Fetch new seller registration report
  const { data: reportData, isLoading, refetch } = useQuery({
    queryKey: ['newSellerRegistrationReport', queryParams],
    queryFn: () => fetchNewSellerRegistrationReport(queryParams),
  })

  const report = reportData?.data
  const rows = report?.rows || []
  const summary = report?.summary

  // Export to CSV (Excel-compatible)
  const handleExportExcel = () => {
    if (!report) return

    const headers = [
      'Seller ID',
      'Business Name',
      'Email',
      'Phone',
      'Registration Date',
      'Seller State',
      'Verification Status',
      'GST Status',
      'PAN Status',
      'Product Status',
      'First Product Live Date',
      'Total Products',
      'Live Products',
    ]

    const csvRows = [
      headers.join(','),
      ...rows.map((row) =>
        [
          row.sellerId,
          `"${row.businessName}"`,
          row.email,
          row.phone,
          dayjs(row.registrationDate).format('YYYY-MM-DD'),
          `"${row.sellerState}"`,
          row.verificationStatus,
          row.gstStatus,
          row.panStatus,
          `"${row.productStatus}"`,
          row.firstProductLiveDate ? dayjs(row.firstProductLiveDate).format('YYYY-MM-DD') : '',
          row.totalProducts,
          row.liveProducts,
        ].join(',')
      ),
    ]

    const csvContent = csvRows.join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `new-seller-registration-report-${dayjs().format('YYYY-MM-DD')}.csv`)
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
          <title>New Seller Registration Report</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { color: #333; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; font-weight: bold; }
            .summary { margin-bottom: 20px; padding: 15px; background-color: #f9f9f9; border-radius: 5px; }
            .summary-item { display: inline-block; margin-right: 20px; }
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <h1>New Seller Registration Report</h1>
          <p><strong>Date Range:</strong> ${dateRange[0].format('DD MMM YYYY')} - ${dateRange[1].format('DD MMM YYYY')}</p>
          ${summary ? `
            <div class="summary">
              <div class="summary-item"><strong>Total New Sellers:</strong> ${summary.totalNewSellers}</div>
              <div class="summary-item"><strong>Pending Verification:</strong> ${summary.pendingVerificationCount}</div>
              <div class="summary-item"><strong>Verified:</strong> ${summary.verifiedSellersCount}</div>
              <div class="summary-item"><strong>Rejected:</strong> ${summary.rejectedSellersCount}</div>
              <div class="summary-item"><strong>No Products:</strong> ${summary.noProductSellersCount}</div>
              <div class="summary-item"><strong>Products Not Live:</strong> ${summary.productAddedNotLiveCount}</div>
              <div class="summary-item"><strong>Live Products:</strong> ${summary.liveProductSellersCount}</div>
            </div>
          ` : ''}
          <table>
            <thead>
              <tr>
                <th>Seller ID</th>
                <th>Business Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Registration Date</th>
                <th>State</th>
                <th>Verification Status</th>
                <th>GST Status</th>
                <th>PAN Status</th>
                <th>Product Status</th>
                <th>Total Products</th>
                <th>Live Products</th>
              </tr>
            </thead>
            <tbody>
              ${rows
                .map(
                  (row) => `
                <tr>
                  <td>${row.sellerId}</td>
                  <td>${row.businessName}</td>
                  <td>${row.email}</td>
                  <td>${row.phone}</td>
                  <td>${dayjs(row.registrationDate).format('DD MMM YYYY')}</td>
                  <td>${row.sellerState}</td>
                  <td>${row.verificationStatus}</td>
                  <td>${row.gstStatus}</td>
                  <td>${row.panStatus}</td>
                  <td>${row.productStatus}</td>
                  <td>${row.totalProducts}</td>
                  <td>${row.liveProducts}</td>
                </tr>
              `
                )
                .join('')}
            </tbody>
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

  // Get verification status color
  const getVerificationStatusColor = (status: string) => {
    switch (status) {
      case 'VERIFIED':
        return 'green'
      case 'REJECTED':
        return 'red'
      case 'PENDING':
        return 'orange'
      default:
        return 'default'
    }
  }

  // Get product status color
  const getProductStatusColor = (status: string) => {
    switch (status) {
      case 'At least one product live':
        return 'green'
      case 'Products added but not live':
        return 'orange'
      case 'No product added':
        return 'red'
      default:
        return 'default'
    }
  }

  // Table columns
  const columns: ColumnsType<NewSellerReportRow> = [
    {
      title: 'Seller ID',
      dataIndex: 'sellerId',
      key: 'sellerId',
      width: 100,
      render: (text: string) => (
        <Link to={`/sellers/${text}`} className="text-blue-600 hover:underline">
          {text.substring(0, 8)}...
        </Link>
      ),
    },
    {
      title: 'Business Name',
      dataIndex: 'businessName',
      key: 'businessName',
      width: 200,
      sorter: (a, b) => a.businessName.localeCompare(b.businessName),
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      width: 200,
    },
    {
      title: 'Phone',
      dataIndex: 'phone',
      key: 'phone',
      width: 120,
    },
    {
      title: 'Registration Date',
      dataIndex: 'registrationDate',
      key: 'registrationDate',
      width: 150,
      render: (date: string) => dayjs(date).format('DD MMM YYYY'),
      sorter: (a, b) => new Date(a.registrationDate).getTime() - new Date(b.registrationDate).getTime(),
      defaultSortOrder: 'descend',
    },
    {
      title: 'State',
      dataIndex: 'sellerState',
      key: 'sellerState',
      width: 120,
    },
    {
      title: 'Verification Status',
      dataIndex: 'verificationStatus',
      key: 'verificationStatus',
      width: 150,
      render: (status: string) => (
        <Tag color={getVerificationStatusColor(status)}>{status}</Tag>
      ),
      sorter: (a, b) => a.verificationStatus.localeCompare(b.verificationStatus),
    },
    {
      title: 'GST Status',
      dataIndex: 'gstStatus',
      key: 'gstStatus',
      width: 120,
      render: (status: string) => (
        <Tag color={status === 'Provided' ? 'green' : 'default'}>{status}</Tag>
      ),
    },
    {
      title: 'PAN Status',
      dataIndex: 'panStatus',
      key: 'panStatus',
      width: 120,
      render: (status: string) => (
        <Tag color={status === 'Provided' ? 'green' : 'default'}>{status}</Tag>
      ),
    },
    {
      title: 'Product Status',
      dataIndex: 'productStatus',
      key: 'productStatus',
      width: 200,
      render: (status: string) => (
        <Tag color={getProductStatusColor(status)}>{status}</Tag>
      ),
      sorter: (a, b) => a.productStatus.localeCompare(b.productStatus),
    },
    {
      title: 'First Product Live Date',
      dataIndex: 'firstProductLiveDate',
      key: 'firstProductLiveDate',
      width: 150,
      render: (date?: string) => (date ? dayjs(date).format('DD MMM YYYY') : 'N/A'),
    },
    {
      title: 'Total Products',
      dataIndex: 'totalProducts',
      key: 'totalProducts',
      width: 120,
      align: 'right',
      sorter: (a, b) => a.totalProducts - b.totalProducts,
    },
    {
      title: 'Live Products',
      dataIndex: 'liveProducts',
      key: 'liveProducts',
      width: 120,
      align: 'right',
      sorter: (a, b) => a.liveProducts - b.liveProducts,
    },
  ]

  return (
    <div style={{ padding: '24px' }}>
      <Card>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Title level={2} style={{ margin: 0 }}>
              New Seller Registration Report
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
          {summary && (
            <Row gutter={16}>
              <Col span={6}>
                <Statistic
                  title="Total New Sellers"
                  value={summary.totalNewSellers}
                  prefix={<UserOutlined />}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="Pending Verification"
                  value={summary.pendingVerificationCount}
                  valueStyle={{ color: '#fa8c16' }}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="Verified Sellers"
                  value={summary.verifiedSellersCount}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="Rejected Sellers"
                  value={summary.rejectedSellersCount}
                  valueStyle={{ color: '#ff4d4f' }}
                />
              </Col>
            </Row>
          )}

          {summary && (
            <Row gutter={16}>
              <Col span={8}>
                <Statistic
                  title="No Product Added"
                  value={summary.noProductSellersCount}
                  valueStyle={{ color: '#ff4d4f' }}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="Products Added But Not Live"
                  value={summary.productAddedNotLiveCount}
                  valueStyle={{ color: '#fa8c16' }}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="At Least One Product Live"
                  value={summary.liveProductSellersCount}
                  valueStyle={{ color: '#52c41a' }}
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
                  <div style={{ marginBottom: 8 }}>Verification Status</div>
                  <Select
                    style={{ width: '100%' }}
                    placeholder="All Statuses"
                    allowClear
                    value={filters.verificationStatus}
                    onChange={(value) => setFilters({ ...filters, verificationStatus: value })}
                    options={[
                      { label: 'Pending', value: 'PENDING' },
                      { label: 'Verified', value: 'VERIFIED' },
                      { label: 'Rejected', value: 'REJECTED' },
                    ]}
                  />
                </Col>
                <Col span={8}>
                  <div style={{ marginBottom: 8 }}>Product Status</div>
                  <Select
                    style={{ width: '100%' }}
                    placeholder="All Statuses"
                    allowClear
                    value={filters.productStatus}
                    onChange={(value) => setFilters({ ...filters, productStatus: value })}
                    options={[
                      { label: 'No product added', value: 'No product added' },
                      { label: 'Products added but not live', value: 'Products added but not live' },
                      { label: 'At least one product live', value: 'At least one product live' },
                    ]}
                  />
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={8}>
                  <div style={{ marginBottom: 8 }}>Seller State</div>
                  <Select
                    style={{ width: '100%' }}
                    placeholder="All States"
                    allowClear
                    value={filters.state}
                    onChange={(value) => setFilters({ ...filters, state: value })}
                    options={sellerStates.map((state) => ({
                      label: state,
                      value: state,
                    }))}
                  />
                </Col>
                <Col span={8}>
                  <div style={{ marginBottom: 8 }}>GST Status</div>
                  <Select
                    style={{ width: '100%' }}
                    placeholder="All Statuses"
                    allowClear
                    value={filters.gstStatus}
                    onChange={(value) => setFilters({ ...filters, gstStatus: value })}
                    options={[
                      { label: 'Provided', value: 'Provided' },
                      { label: 'Not Provided', value: 'Not Provided' },
                    ]}
                  />
                </Col>
                <Col span={8}>
                  <div style={{ marginBottom: 8 }}>PAN Status</div>
                  <Select
                    style={{ width: '100%' }}
                    placeholder="All Statuses"
                    allowClear
                    value={filters.panStatus}
                    onChange={(value) => setFilters({ ...filters, panStatus: value })}
                    options={[
                      { label: 'Provided', value: 'Provided' },
                      { label: 'Not Provided', value: 'Not Provided' },
                    ]}
                  />
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={8}>
                  <div style={{ marginBottom: 8 }}>Sort By</div>
                  <Select
                    style={{ width: '100%' }}
                    value={sortBy}
                    onChange={(value) => setSortBy(value)}
                    options={[
                      { label: 'Registration Date', value: 'registrationDate' },
                      { label: 'Business Name', value: 'businessName' },
                      { label: 'Verification Status', value: 'verificationStatus' },
                      { label: 'Product Status', value: 'productStatus' },
                    ]}
                  />
                </Col>
                <Col span={8}>
                  <div style={{ marginBottom: 8 }}>Sort Order</div>
                  <Select
                    style={{ width: '100%' }}
                    value={sortOrder}
                    onChange={(value) => setSortOrder(value)}
                    options={[
                      { label: 'Ascending', value: 'asc' },
                      { label: 'Descending', value: 'desc' },
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
            rowKey="sellerId"
            scroll={{ x: 1500 }}
            pagination={{
              pageSize: 50,
              showSizeChanger: true,
              showTotal: (total) => `Total ${total} sellers`,
            }}
          />
        </Space>
      </Card>
    </div>
  )
}

export default NewSellerRegistrationReport

