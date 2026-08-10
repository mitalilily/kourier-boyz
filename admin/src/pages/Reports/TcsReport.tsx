import {
  FileExcelOutlined,
  FilePdfOutlined,
  FilterOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import {
  App,
  Button,
  Card,
  Col,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Typography,
  Alert,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useMemo, useState } from 'react'
import { fetchTcsReport, type TcsReportParams, type TcsReportRow } from '../../api/reports'
import { useUsers, type AdminUser } from '../../api/users'

const { Title } = Typography

const TcsReport = () => {
  const { message } = App.useApp()

  const [filters, setFilters] = useState<TcsReportParams>({
    settlementStatus: 'PAID',
    customerType: 'ALL',
  })

  // Fetch sellers for filter
  const { data: sellersData } = useUsers({ role: 'seller' })
  const sellers = sellersData || []

  // Build query params
  const queryParams = useMemo<TcsReportParams>(() => {
    return {
      ...filters,
    }
  }, [filters])

  // Fetch TCS report
  const {
    data: reportData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['tcsReport', queryParams],
    queryFn: () => fetchTcsReport(queryParams),
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

  // Generate financial year options
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1
  const currentFY = currentMonth >= 4 ? currentYear : currentYear - 1
  const financialYearOptions = []
  for (let i = currentFY; i >= currentFY - 5; i--) {
    const fyEnd = String(i + 1).slice(-2)
    financialYearOptions.push({
      label: `${i}-${fyEnd}`,
      value: `${i}-${fyEnd}`,
    })
  }

  // Get unique states from rows
  const uniqueStates = useMemo(() => {
    const states = new Set(rows.map((row) => row.sellerState))
    return Array.from(states).sort()
  }, [rows])

  // Export to Excel
  const handleExportExcel = () => {
    if (!report) return

    const headers = [
      'Seller Trade Name',
      'Seller GSTIN',
      'Seller State',
      'Customer Type',
      'Supply Type',
      'Taxable Sales Value (Excl. GST)',
      'TCS Rate (%)',
      'IGST TCS Amount',
      'CGST TCS Amount',
      'SGST TCS Amount',
      'Total TCS Amount',
      'Financial Year',
      'Last Settlement Date',
    ]

    const csvRows = [
      headers.join(','),
      ...rows.map((row) =>
        [
          `"${row.sellerTradeName}"`,
          row.sellerGstin,
          row.sellerState,
          row.customerType,
          row.supplyType,
          row.taxableSalesValue,
          row.tcsRate,
          row.igstTcsAmount,
          row.cgstTcsAmount,
          row.sgstTcsAmount,
          row.totalTcsAmount,
          row.financialYear,
          new Date(row.lastSettlementDate).toLocaleDateString('en-IN'),
        ].join(','),
      ),
      '',
      'Totals,',
      '',
      '',
      '',
      totals?.totalSales || 0,
      '',
      '',
      '',
      '',
      totals?.totalTcs || 0,
      '',
      '',
    ]

    const csvContent = csvRows.join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `tcs-report-${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    message.success('Report exported to CSV')
  }

  // Export to PDF
  const handleExportPDF = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>TCS Report (GST – Section 52)</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { color: #333; }
            .note { margin-bottom: 20px; padding: 10px; background-color: #f0f0f0; border-left: 4px solid #1890ff; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 11px; }
            th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
            th { background-color: #f2f2f2; font-weight: bold; }
            .totals-row { font-weight: bold; background-color: #f9f9f9; }
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <h1>TCS Report (GST – Section 52)</h1>
          <div class="note">
            <strong>Note:</strong> TCS is collected as per GST Section 52 based on settled transactions only.
          </div>
          <table>
            <thead>
              <tr>
                <th>Seller Trade Name</th>
                <th>Seller GSTIN</th>
                <th>Seller State</th>
                <th>Customer Type</th>
                <th>Supply Type</th>
                <th>Taxable Sales Value</th>
                <th>TCS Rate (%)</th>
                <th>IGST TCS</th>
                <th>CGST TCS</th>
                <th>SGST TCS</th>
                <th>Total TCS</th>
                <th>Financial Year</th>
                <th>Last Settlement Date</th>
              </tr>
            </thead>
            <tbody>
              ${rows
                .map(
                  (row) => `
                <tr>
                  <td>${row.sellerTradeName}</td>
                  <td>${row.sellerGstin}</td>
                  <td>${row.sellerState}</td>
                  <td>${row.customerType}</td>
                  <td>${row.supplyType}</td>
                  <td>${formatCurrency(row.taxableSalesValue)}</td>
                  <td>${row.tcsRate}%</td>
                  <td>${formatCurrency(row.igstTcsAmount)}</td>
                  <td>${formatCurrency(row.cgstTcsAmount)}</td>
                  <td>${formatCurrency(row.sgstTcsAmount)}</td>
                  <td>${formatCurrency(row.totalTcsAmount)}</td>
                  <td>${row.financialYear}</td>
                  <td>${new Date(row.lastSettlementDate).toLocaleDateString('en-IN')}</td>
                </tr>
              `,
                )
                .join('')}
            </tbody>
            <tfoot>
              <tr class="totals-row">
                <td colspan="5"><strong>Totals</strong></td>
                <td><strong>${formatCurrency(totals?.totalSales || 0)}</strong></td>
                <td></td>
                <td colspan="4"><strong>${formatCurrency(totals?.totalTcs || 0)}</strong></td>
                <td colspan="2"></td>
              </tr>
            </tfoot>
          </table>
          <p style="margin-top: 20px;">
            <strong>Summary:</strong> ${totals?.sellerCount || 0} sellers, ${totals?.settlementCount || 0} settlements
          </p>
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
  const columns: ColumnsType<TcsReportRow> = [
    {
      title: 'Seller Trade Name',
      dataIndex: 'sellerTradeName',
      key: 'sellerTradeName',
      fixed: 'left',
      width: 200,
    },
    {
      title: 'Seller GSTIN',
      dataIndex: 'sellerGstin',
      key: 'sellerGstin',
      width: 150,
    },
    {
      title: 'Seller State',
      dataIndex: 'sellerState',
      key: 'sellerState',
      width: 150,
      filters: uniqueStates.map((state) => ({ text: state, value: state })),
      onFilter: (value, record) => record.sellerState === value,
    },
    {
      title: 'Customer Type',
      dataIndex: 'customerType',
      key: 'customerType',
      width: 130,
      filters: [
        { text: 'Registered', value: 'Registered' },
        { text: 'Unregistered', value: 'Unregistered' },
      ],
      onFilter: (value, record) => record.customerType === value,
    },
    {
      title: 'Supply Type',
      dataIndex: 'supplyType',
      key: 'supplyType',
      width: 130,
      filters: [
        { text: 'Inter-State', value: 'Inter-State' },
        { text: 'Intra-State', value: 'Intra-State' },
      ],
      onFilter: (value, record) => record.supplyType === value,
    },
    {
      title: 'Taxable Sales Value (Excl. GST)',
      dataIndex: 'taxableSalesValue',
      key: 'taxableSalesValue',
      align: 'right',
      width: 200,
      render: (value: number) => formatCurrency(value),
      sorter: (a, b) => a.taxableSalesValue - b.taxableSalesValue,
    },
    {
      title: 'TCS Rate (%)',
      dataIndex: 'tcsRate',
      key: 'tcsRate',
      align: 'right',
      width: 120,
      render: (value: number) => `${value}%`,
    },
    {
      title: 'IGST TCS Amount',
      dataIndex: 'igstTcsAmount',
      key: 'igstTcsAmount',
      align: 'right',
      width: 150,
      render: (value: number) => (value > 0 ? formatCurrency(value) : '-'),
    },
    {
      title: 'CGST TCS Amount',
      dataIndex: 'cgstTcsAmount',
      key: 'cgstTcsAmount',
      align: 'right',
      width: 150,
      render: (value: number) => (value > 0 ? formatCurrency(value) : '-'),
    },
    {
      title: 'SGST TCS Amount',
      dataIndex: 'sgstTcsAmount',
      key: 'sgstTcsAmount',
      align: 'right',
      width: 150,
      render: (value: number) => (value > 0 ? formatCurrency(value) : '-'),
    },
    {
      title: 'Total TCS Amount',
      dataIndex: 'totalTcsAmount',
      key: 'totalTcsAmount',
      align: 'right',
      width: 150,
      render: (value: number) => <strong>{formatCurrency(value)}</strong>,
      sorter: (a, b) => a.totalTcsAmount - b.totalTcsAmount,
    },
    {
      title: 'Financial Year',
      dataIndex: 'financialYear',
      key: 'financialYear',
      width: 120,
      sorter: (a, b) => a.financialYear.localeCompare(b.financialYear),
    },
    {
      title: 'Last Settlement Date',
      dataIndex: 'lastSettlementDate',
      key: 'lastSettlementDate',
      width: 150,
      render: (date: string) => new Date(date).toLocaleDateString('en-IN'),
      sorter: (a, b) => new Date(a.lastSettlementDate).getTime() - new Date(b.lastSettlementDate).getTime(),
    },
  ]

  return (
    <div style={{ padding: '24px' }}>
      <Card>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Title level={2} style={{ margin: 0 }}>
              TCS Report (GST – Section 52)
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

          {/* Note */}
          <Alert
            message="TCS Report Information"
            description="TCS is collected as per GST Section 52 based on settled transactions only."
            type="info"
            showIcon
            closable
          />

          {/* Summary Statistics */}
          {totals && (
            <Row gutter={16}>
              <Col span={6}>
                <Statistic
                  title="Total Taxable Sales (Excl. GST)"
                  value={totals.totalSales}
                  prefix="₹"
                  precision={0}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="Total TCS Collected"
                  value={totals.totalTcs}
                  prefix="₹"
                  precision={0}
                  valueStyle={{ color: '#1890ff', fontWeight: 'bold' }}
                />
              </Col>
              <Col span={6}>
                <Statistic title="Total Sellers" value={totals.sellerCount} />
              </Col>
              <Col span={6}>
                <Statistic title="Total Settlements" value={totals.settlementCount} />
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
                  <div style={{ marginBottom: 8 }}>Financial Year</div>
                  <Select
                    style={{ width: '100%' }}
                    placeholder="All Financial Years"
                    allowClear
                    value={filters.financialYear}
                    onChange={(value) => setFilters({ ...filters, financialYear: value })}
                    options={financialYearOptions}
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
                  <div style={{ marginBottom: 8 }}>Seller State</div>
                  <Select
                    style={{ width: '100%' }}
                    placeholder="All States"
                    allowClear
                    value={filters.sellerState}
                    onChange={(value) => setFilters({ ...filters, sellerState: value })}
                    options={uniqueStates.map((state) => ({ label: state, value: state }))}
                    showSearch
                  />
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={8}>
                  <div style={{ marginBottom: 8 }}>Customer Type</div>
                  <Select
                    style={{ width: '100%' }}
                    value={filters.customerType}
                    onChange={(value) => setFilters({ ...filters, customerType: value })}
                    options={[
                      { label: 'All', value: 'ALL' },
                      { label: 'Registered', value: 'Registered' },
                      { label: 'Unregistered', value: 'Unregistered' },
                    ]}
                  />
                </Col>
                <Col span={8}>
                  <div style={{ marginBottom: 8 }}>Settlement Status</div>
                  <Select
                    style={{ width: '100%' }}
                    value={filters.settlementStatus}
                    onChange={(value) => setFilters({ ...filters, settlementStatus: value })}
                    options={[
                      { label: 'Paid Only', value: 'PAID' },
                      { label: 'All', value: 'ALL' },
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
            rowKey={(record) =>
              `${record.sellerId}-${record.sellerState}-${record.customerType}-${record.supplyType}-${record.financialYear}`
            }
            scroll={{ x: 2000 }}
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
                    <Table.Summary.Cell index={0} colSpan={5}>
                      <strong>Totals</strong>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={5} align="right">
                      <strong>{formatCurrency(totals.totalSales)}</strong>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={6}></Table.Summary.Cell>
                    <Table.Summary.Cell index={7} colSpan={4} align="right">
                      <strong style={{ color: '#1890ff' }}>{formatCurrency(totals.totalTcs)}</strong>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={11} colSpan={2}></Table.Summary.Cell>
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

export default TcsReport

