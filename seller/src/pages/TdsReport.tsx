import { FileExcelOutlined, FilePdfOutlined, ReloadOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useMemo, useState } from 'react'
import { fetchTdsReport, type TdsReportParams, type TdsReportRow } from '../api/reports'

const { Title } = Typography

const TdsReport = () => {
  const { message } = App.useApp()

  const [filters, setFilters] = useState<TdsReportParams>({
    settlementStatus: 'PAID',
  })

  // Build query params
  const queryParams = useMemo<TdsReportParams>(() => {
    return {
      ...filters,
    }
  }, [filters])

  // Fetch TDS report
  const {
    data: reportData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['sellerTdsReport', queryParams],
    queryFn: () => fetchTdsReport(queryParams),
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

  // Export to Excel
  const handleExportExcel = () => {
    if (!report) return

    const headers = [
      'Financial Year',
      'Gross Sales (Incl. GST)',
      'TDS Rate (%)',
      'TDS Deducted (₹)',
      'TDS Deduction Status',
      'Last Settlement Date',
    ]

    const csvRows = [
      headers.join(','),
      ...rows.map((row) =>
        [
          row.financialYear,
          row.grossSalesInclGst,
          row.tdsRate,
          row.tdsDeducted,
          row.tdsDeductionStatus,
          new Date(row.lastSettlementDate).toLocaleDateString('en-IN'),
        ].join(','),
      ),
      '',
      'Totals,',
      totals?.totalSales || 0,
      '',
      totals?.totalTds || 0,
      '',
      '',
    ]

    const csvContent = csvRows.join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `tds-report-${new Date().toISOString().split('T')[0]}.csv`)
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
          <title>TDS Report (u/s 194-O)</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { color: #333; }
            .note { margin-bottom: 20px; padding: 10px; background-color: #f0f0f0; border-left: 4px solid #1890ff; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; font-weight: bold; }
            .totals-row { font-weight: bold; background-color: #f9f9f9; }
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <h1>TDS Report (u/s 194-O)</h1>
          <div class="note">
            <strong>Note:</strong> TDS is deducted under Section 194-O based on settled sales.
            Threshold exemption (500000) for Individual/HUF sellers is applied automatically.
          </div>
          <table>
            <thead>
              <tr>
                <th>Financial Year</th>
                <th>Gross Sales (Incl. GST)</th>
                <th>TDS Rate (%)</th>
                <th>TDS Deducted (₹)</th>
                <th>TDS Deduction Status</th>
                <th>Last Settlement Date</th>
              </tr>
            </thead>
            <tbody>
              ${rows
                .map(
                  (row) => `
                <tr>
                  <td>${row.financialYear}</td>
                  <td>${formatCurrency(row.grossSalesInclGst)}</td>
                  <td>${row.tdsRate}%</td>
                  <td>${formatCurrency(row.tdsDeducted)}</td>
                  <td>${row.tdsDeductionStatus}</td>
                  <td>${new Date(row.lastSettlementDate).toLocaleDateString('en-IN')}</td>
                </tr>
              `,
                )
                .join('')}
            </tbody>
            <tfoot>
              <tr class="totals-row">
                <td><strong>Totals</strong></td>
                <td><strong>${formatCurrency(totals?.totalSales || 0)}</strong></td>
                <td></td>
                <td><strong>${formatCurrency(totals?.totalTds || 0)}</strong></td>
                <td colspan="2"></td>
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
  const columns: ColumnsType<TdsReportRow> = [
    {
      title: 'Financial Year',
      dataIndex: 'financialYear',
      key: 'financialYear',
      width: 120,
      sorter: (a, b) => a.financialYear.localeCompare(b.financialYear),
    },
    {
      title: 'Gross Sales (Incl. GST)',
      dataIndex: 'grossSalesInclGst',
      key: 'grossSalesInclGst',
      align: 'right',
      width: 180,
      render: (value: number) => formatCurrency(value),
      sorter: (a, b) => a.grossSalesInclGst - b.grossSalesInclGst,
    },
    {
      title: 'TDS Rate (%)',
      dataIndex: 'tdsRate',
      key: 'tdsRate',
      align: 'right',
      width: 120,
      render: (value: number) => `${value}%`,
    },
    {
      title: 'TDS Deducted (₹)',
      dataIndex: 'tdsDeducted',
      key: 'tdsDeducted',
      align: 'right',
      width: 150,
      render: (value: number) => <strong>{formatCurrency(value)}</strong>,
      sorter: (a, b) => a.tdsDeducted - b.tdsDeducted,
    },
    {
      title: 'TDS Deduction Status',
      dataIndex: 'tdsDeductionStatus',
      key: 'tdsDeductionStatus',
      width: 180,
      render: (status: string) => {
        const colorMap: Record<string, string> = {
          'Not Applicable': 'default',
          Applicable: 'blue',
          'Threshold Crossed': 'orange',
        }
        return <Tag color={colorMap[status] || 'default'}>{status}</Tag>
      },
    },
    {
      title: 'Last Settlement Date',
      dataIndex: 'lastSettlementDate',
      key: 'lastSettlementDate',
      width: 150,
      render: (date: string) => new Date(date).toLocaleDateString('en-IN'),
      sorter: (a, b) =>
        new Date(a.lastSettlementDate).getTime() - new Date(b.lastSettlementDate).getTime(),
    },
  ]

  return (
    <div style={{ padding: '24px' }}>
      <Card>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Title level={2} style={{ margin: 0 }}>
              TDS Report (u/s 194-O)
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
            message="TDS Report Information"
            description="TDS is deducted under Section 194-O based on settled sales. Threshold exemption for Individual/HUF sellers is applied automatically."
            type="info"
            showIcon
            closable
          />

          {/* Summary Statistics */}
          {totals && (
            <Row gutter={16}>
              <Col span={8}>
                <Statistic
                  title="Total Sales (Incl. GST)"
                  value={totals.totalSales}
                  prefix="₹"
                  precision={0}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="Total TDS Deducted"
                  value={totals.totalTds}
                  prefix="₹"
                  precision={0}
                  valueStyle={{ color: '#1890ff', fontWeight: 'bold' }}
                />
              </Col>
              <Col span={8}>
                <Statistic title="Total Settlements" value={totals.settlementCount} />
              </Col>
            </Row>
          )}

          {/* Filters */}
          <Card size="small" title="Filters">
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <Row gutter={16}>
                <Col span={12}>
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
                <Col span={12}>
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
            rowKey={(record) => record.financialYear}
            scroll={{ x: 1000 }}
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
                      <strong>{formatCurrency(totals.totalSales)}</strong>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={2}></Table.Summary.Cell>
                    <Table.Summary.Cell index={3} align="right">
                      <strong style={{ color: '#1890ff' }}>
                        {formatCurrency(totals.totalTds)}
                      </strong>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={4} colSpan={2}></Table.Summary.Cell>
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

export default TdsReport
