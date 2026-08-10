import {
  FileExcelOutlined,
  FilePdfOutlined,
  FilterOutlined,
  ReloadOutlined,
  TruckOutlined,
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
  Alert,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs, { type Dayjs } from 'dayjs'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  fetchCourierChargesReport,
  type CourierChargesReportParams,
  type CourierChargesReportRow,
} from '../../api/reports'
import { useUsers, type AdminUser } from '../../api/users'

const { RangePicker } = DatePicker
const { Title } = Typography

const CourierChargesReport = () => {
  const { message } = App.useApp()

  // Default to last 30 days
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([
    dayjs().subtract(30, 'days'),
    dayjs(),
  ])
  const [filters, setFilters] = useState<CourierChargesReportParams>({})

  // Fetch sellers for filter
  const { data: sellersData } = useUsers({ role: 'seller' })
  const sellers = sellersData || []

  // Build query params
  const queryParams = useMemo<CourierChargesReportParams>(() => {
    const params: CourierChargesReportParams = {
      fromDate: dateRange[0].startOf('day').toISOString(),
      toDate: dateRange[1].endOf('day').toISOString(),
      ...filters,
    }
    return params
  }, [dateRange, filters])

  // Fetch courier charges report
  const { data: reportData, isLoading, refetch } = useQuery({
    queryKey: ['courierChargesReport', queryParams],
    queryFn: () => fetchCourierChargesReport(queryParams),
  })

  const report = reportData?.data
  const rows = useMemo(() => report?.rows || [], [report?.rows])
  const totals = report?.totals
  const note = reportData?.note

  // Extract unique courier partners from rows - computed directly to avoid state updates
  const courierPartners = useMemo(() => {
    if (!rows || rows.length === 0) return []
    
    const partners = new Set<string>()
    rows.forEach((row) => {
      if (row.courierPartner && row.courierPartner !== 'Unknown') {
        partners.add(row.courierPartner)
      }
    })
    return Array.from(partners).sort()
  }, [rows])

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount)
  }

  // Format date
  const formatDate = (date: string | null) => {
    if (!date) return 'N/A'
    return dayjs(date).format('DD MMM YYYY')
  }

  // Get shipment type color
  const getShipmentTypeColor = (type: string) => {
    switch (type) {
      case 'Forward':
        return 'blue'
      case 'RTO':
        return 'orange'
      case 'Return':
        return 'red'
      default:
        return 'default'
    }
  }

  // Export to CSV (Excel-compatible)
  const handleExportExcel = () => {
    if (!report) return

    const headers = [
      'Order ID',
      'Order Number',
      'AWB Number',
      'Shipment ID',
      'Seller Name',
      'Courier Partner',
      'Shipment Type',
      'Order Value (₹)',
      'Total Shipment Courier Charge (₹)',
      'Allocated Courier Charge for this Order (₹)',
      'COD Charge (₹)',
      'Shipment Date',
      'Status',
    ]

    const csvRows = [
      headers.join(','),
      ...rows.map((row) =>
        [
          `"${row.orderId}"`,
          `"${row.orderNumber}"`,
          `"${row.awbNumber}"`,
          `"${row.shipmentId}"`,
          `"${row.sellerName}"`,
          `"${row.courierPartner}"`,
          `"${row.shipmentType}"`,
          row.orderValue,
          row.totalShipmentCourierCharge,
          row.allocatedCourierCharge,
          row.codCharge,
          `"${formatDate(row.shipmentDate)}"`,
          `"${row.status}"`,
        ].join(',')
      ),
      '',
      'Totals,',
      ',',
      ',',
      ',',
      ',',
      ',',
      ',',
      totals?.totalAllocatedCourierCharges || 0,
      totals?.totalCodCharges || 0,
      ',',
      ',',
      '',
      'Breakdown,',
      `Forward: ${totals?.forwardBreakdown.count || 0} shipments, ${totals?.forwardBreakdown.totalCharges || 0}`,
      `RTO: ${totals?.rtoBreakdown.count || 0} shipments, ${totals?.rtoBreakdown.totalCharges || 0}`,
      `Return: ${totals?.returnBreakdown.count || 0} shipments, ${totals?.returnBreakdown.totalCharges || 0}`,
    ]

    const csvContent = csvRows.join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `courier-charges-report-${dayjs().format('YYYY-MM-DD')}.csv`)
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
          <title>Courier Charges Report</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { color: #333; }
            .note { background-color: #f0f0f0; padding: 10px; margin: 10px 0; border-radius: 4px; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 11px; }
            th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
            th { background-color: #f2f2f2; font-weight: bold; }
            .totals-row { font-weight: bold; background-color: #f9f9f9; }
            .breakdown { margin-top: 20px; }
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <h1>Courier Charges Report - Order & AWB Wise</h1>
          <p><strong>Date Range:</strong> ${dateRange[0].format('DD MMM YYYY')} - ${dateRange[1].format('DD MMM YYYY')}</p>
          <div class="note">
            <strong>Note:</strong> ${note || 'Courier charges are allocated proportionally when multiple orders share one shipment (AWB). This prevents double counting and matches actual carrier billing.'}
          </div>
          <table>
            <thead>
              <tr>
                <th>Order Number</th>
                <th>AWB Number</th>
                <th>Seller Name</th>
                <th>Courier Partner</th>
                <th>Shipment Type</th>
                <th>Order Value (₹)</th>
                <th>Total Shipment Charge (₹)</th>
                <th>Allocated Charge (₹)</th>
                <th>COD Charge (₹)</th>
                <th>Shipment Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${rows
                .map(
                  (row) => `
                <tr>
                  <td>${row.orderNumber}</td>
                  <td>${row.awbNumber}</td>
                  <td>${row.sellerName}</td>
                  <td>${row.courierPartner}</td>
                  <td>${row.shipmentType}</td>
                  <td>${formatCurrency(row.orderValue)}</td>
                  <td>${formatCurrency(row.totalShipmentCourierCharge)}</td>
                  <td>${formatCurrency(row.allocatedCourierCharge)}</td>
                  <td>${formatCurrency(row.codCharge)}</td>
                  <td>${formatDate(row.shipmentDate)}</td>
                  <td>${row.status}</td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>
          <div class="breakdown">
            <h3>Totals</h3>
            <p><strong>Total Allocated Courier Charges:</strong> ${formatCurrency(totals?.totalAllocatedCourierCharges || 0)}</p>
            <p><strong>Total COD Charges:</strong> ${formatCurrency(totals?.totalCodCharges || 0)}</p>
            <h4>Breakdown by Shipment Type</h4>
            <p><strong>Forward:</strong> ${totals?.forwardBreakdown.count || 0} shipments, ${formatCurrency(totals?.forwardBreakdown.totalCharges || 0)}</p>
            <p><strong>RTO:</strong> ${totals?.rtoBreakdown.count || 0} shipments, ${formatCurrency(totals?.rtoBreakdown.totalCharges || 0)}</p>
            <p><strong>Return:</strong> ${totals?.returnBreakdown.count || 0} shipments, ${formatCurrency(totals?.returnBreakdown.totalCharges || 0)}</p>
          </div>
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
  const columns: ColumnsType<CourierChargesReportRow> = [
    {
      title: 'Order Number',
      dataIndex: 'orderNumber',
      key: 'orderNumber',
      fixed: 'left',
      width: 150,
      render: (text: string) => <strong>{text}</strong>,
    },
    {
      title: 'AWB Number',
      dataIndex: 'awbNumber',
      key: 'awbNumber',
      width: 150,
    },
    {
      title: 'Seller Name',
      dataIndex: 'sellerName',
      key: 'sellerName',
      width: 200,
    },
    {
      title: 'Courier Partner',
      dataIndex: 'courierPartner',
      key: 'courierPartner',
      width: 150,
    },
    {
      title: 'Shipment Type',
      dataIndex: 'shipmentType',
      key: 'shipmentType',
      width: 120,
      render: (type: string) => (
        <Tag color={getShipmentTypeColor(type)}>{type}</Tag>
      ),
      filters: [
        { text: 'Forward', value: 'Forward' },
        { text: 'RTO', value: 'RTO' },
        { text: 'Return', value: 'Return' },
      ],
      onFilter: (value, record) => record.shipmentType === value,
    },
    {
      title: 'Order Value (₹)',
      dataIndex: 'orderValue',
      key: 'orderValue',
      align: 'right',
      width: 140,
      render: (value: number) => formatCurrency(value),
      sorter: (a, b) => a.orderValue - b.orderValue,
    },
    {
      title: 'Total Shipment Charge (₹)',
      dataIndex: 'totalShipmentCourierCharge',
      key: 'totalShipmentCourierCharge',
      align: 'right',
      width: 180,
      render: (value: number) => formatCurrency(value),
      sorter: (a, b) => a.totalShipmentCourierCharge - b.totalShipmentCourierCharge,
    },
    {
      title: 'Allocated Charge (₹)',
      dataIndex: 'allocatedCourierCharge',
      key: 'allocatedCourierCharge',
      align: 'right',
      width: 160,
      render: (value: number) => <strong>{formatCurrency(value)}</strong>,
      sorter: (a, b) => a.allocatedCourierCharge - b.allocatedCourierCharge,
    },
    {
      title: 'COD Charge (₹)',
      dataIndex: 'codCharge',
      key: 'codCharge',
      align: 'right',
      width: 130,
      render: (value: number) => value > 0 ? formatCurrency(value) : '-',
      sorter: (a, b) => a.codCharge - b.codCharge,
    },
    {
      title: 'Shipment Date',
      dataIndex: 'shipmentDate',
      key: 'shipmentDate',
      width: 130,
      render: (date: string | null) => formatDate(date),
      sorter: (a, b) => {
        const dateA = a.shipmentDate ? new Date(a.shipmentDate).getTime() : 0
        const dateB = b.shipmentDate ? new Date(b.shipmentDate).getTime() : 0
        return dateA - dateB
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: string) => (
        <Tag color={status === 'delivered' ? 'green' : status === 'cancelled' ? 'red' : 'default'}>
          {status}
        </Tag>
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
              <TruckOutlined /> Courier Charges Report
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

          {/* Note */}
          {note && (
            <Alert
              message="Allocation Note"
              description={note}
              type="info"
              showIcon
              closable
            />
          )}

          {/* Summary Statistics */}
          {totals && (
            <Row gutter={16}>
              <Col span={6}>
                <Statistic
                  title="Total Allocated Courier Charges"
                  value={totals.totalAllocatedCourierCharges}
                  prefix="₹"
                  precision={0}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="Total COD Charges"
                  value={totals.totalCodCharges}
                  prefix="₹"
                  precision={0}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="Forward Shipments"
                  value={totals.forwardBreakdown.count}
                  suffix={`(${formatCurrency(totals.forwardBreakdown.totalCharges)})`}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="RTO Shipments"
                  value={totals.rtoBreakdown.count}
                  suffix={`(${formatCurrency(totals.rtoBreakdown.totalCharges)})`}
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
                  <div style={{ marginBottom: 8 }}>Shipment Type</div>
                  <Select
                    style={{ width: '100%' }}
                    placeholder="All Types"
                    allowClear
                    value={filters.shipmentType}
                    onChange={(value) => setFilters({ ...filters, shipmentType: value })}
                    options={[
                      { label: 'Forward', value: 'Forward' },
                      { label: 'RTO', value: 'RTO' },
                      { label: 'Return', value: 'Return' },
                    ]}
                  />
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={8}>
                  <div style={{ marginBottom: 8 }}>Courier Partner</div>
                  <Select
                    style={{ width: '100%' }}
                    placeholder="All Couriers"
                    allowClear
                    value={filters.courierPartner}
                    onChange={(value) => setFilters({ ...filters, courierPartner: value })}
                    options={courierPartners.map((partner) => ({
                      label: partner,
                      value: partner,
                    }))}
                    showSearch
                    filterOption={(input, option) =>
                      (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                    }
                  />
                </Col>
                <Col span={8}>
                  <div style={{ marginBottom: 8 }}>AWB Number</div>
                  <Input
                    placeholder="Enter AWB number"
                    value={filters.awb}
                    onChange={(e) => setFilters({ ...filters, awb: e.target.value || undefined })}
                    allowClear
                  />
                </Col>
                <Col span={8}>
                  <div style={{ marginBottom: 8 }}>Order ID(s)</div>
                  <Select
                    mode="tags"
                    style={{ width: '100%' }}
                    placeholder="Enter Order ID(s) - supports multiple"
                    value={filters.orderId ? (Array.isArray(filters.orderId) ? filters.orderId : [filters.orderId]) : []}
                    onChange={(value) => {
                      if (value.length === 0) {
                        setFilters({ ...filters, orderId: undefined })
                      } else if (value.length === 1) {
                        setFilters({ ...filters, orderId: value[0] })
                      } else {
                        setFilters({ ...filters, orderId: value })
                      }
                    }}
                    allowClear
                    tokenSeparators={[',']}
                    filterOption={false}
                    notFoundContent={null}
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
            rowKey={(record) => `${record.orderId}-${record.awbNumber}-${record.shipmentId}`}
            scroll={{ x: 1500 }}
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
                    <Table.Summary.Cell index={1} />
                    <Table.Summary.Cell index={2} />
                    <Table.Summary.Cell index={3} />
                    <Table.Summary.Cell index={4} />
                    <Table.Summary.Cell index={5} align="right">
                      <strong>{formatCurrency(
                        rows.reduce((sum, row) => sum + row.orderValue, 0)
                      )}</strong>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={6} align="right">
                      <strong>{formatCurrency(
                        rows.reduce((sum, row) => sum + row.totalShipmentCourierCharge, 0)
                      )}</strong>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={7} align="right">
                      <strong>{formatCurrency(totals.totalAllocatedCourierCharges)}</strong>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={8} align="right">
                      <strong>{formatCurrency(totals.totalCodCharges)}</strong>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={9} />
                    <Table.Summary.Cell index={10} />
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

export default CourierChargesReport

