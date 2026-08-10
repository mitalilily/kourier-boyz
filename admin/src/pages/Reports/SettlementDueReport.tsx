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
  Input,
  InputNumber,
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
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  fetchSettlementDueReport,
  type SettlementDueReportParams,
  type SettlementDueReportRow,
} from '../../api/reports'
import { useUsers, type AdminUser } from '../../api/users'
import { Link } from 'react-router-dom'

const { RangePicker } = DatePicker
const { Title } = Typography

const SettlementDueReport = () => {
  const { message } = App.useApp()

  const [filters, setFilters] = useState<SettlementDueReportParams>({
    status: 'ALL', // Default: show all settlements
  })
  const [dueDateRange, setDueDateRange] = useState<[Dayjs | null, Dayjs | null]>([null, null])
  const [amountRange, setAmountRange] = useState<{ from?: string; to?: string }>({})
  const [customCycleDays, setCustomCycleDays] = useState<number | null>(null)

  // Fetch sellers for filter
  const { data: sellersData } = useUsers({ role: 'seller' })
  const sellers = sellersData || []

  // Build query params
  const queryParams = useMemo<SettlementDueReportParams>(() => {
    const params: SettlementDueReportParams = {
      ...filters,
    }

    // Handle custom settlement cycle
    if (filters.settlementCycle === 'Custom') {
      if (customCycleDays) {
        params.settlementCycle = `${customCycleDays} Days`
      } else {
        // If Custom is selected but no days entered, don't filter by cycle
        delete params.settlementCycle
      }
    }

    if (dueDateRange[0] && dueDateRange[1]) {
      params.dueDateFrom = dueDateRange[0].startOf('day').toISOString()
      params.dueDateTo = dueDateRange[1].endOf('day').toISOString()
    }

    if (amountRange.from) {
      params.amountFrom = amountRange.from
    }
    if (amountRange.to) {
      params.amountTo = amountRange.to
    }

    return params
  }, [filters, customCycleDays, dueDateRange, amountRange])

  // Fetch settlement due report
  const { data: reportData, isLoading, refetch } = useQuery({
    queryKey: ['settlementDueReport', queryParams],
    queryFn: () => fetchSettlementDueReport(queryParams),
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
      'Seller Name',
      'Seller GSTIN',
      'Settlement Period',
      'Settlement Amount',
      'Settlement Cycle',
      'Due Date',
      'Status',
    ]

    const csvRows = [
      headers.join(','),
      ...rows.map((row) =>
        [
          `"${row.sellerName}"`,
          row.sellerGstin || '',
          `"${row.settlementPeriod}"`,
          row.settlementAmount,
          `"${row.settlementCycle}"`,
          dayjs(row.dueDate).format('YYYY-MM-DD'),
          row.status,
        ].join(',')
      ),
      '',
      'Totals,',
      '',
      '',
      `Due: ${totals?.totalAmountDue || 0}, Settled: ${totals?.totalAmountSettled || 0}`,
      '',
      '',
      `Pending: ${totals?.pendingCount || 0}, Paid: ${totals?.paidCount || 0}`,
    ]

    const csvContent = csvRows.join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `settlement-due-report-${dayjs().format('YYYY-MM-DD')}.csv`)
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
          <title>Settlement Due Report</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { color: #333; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; font-weight: bold; }
            .totals-row { font-weight: bold; background-color: #f9f9f9; }
            .pending { color: #ff9800; }
            .paid { color: #4caf50; }
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <h1>Settlement Due Report</h1>
          <p><strong>Status Filter:</strong> ${filters.status || 'PENDING'}</p>
          ${dueDateRange[0] && dueDateRange[1] ? `<p><strong>Due Date Range:</strong> ${dueDateRange[0].format('DD MMM YYYY')} - ${dueDateRange[1].format('DD MMM YYYY')}</p>` : ''}
          <table>
            <thead>
              <tr>
                <th>Seller Name</th>
                <th>Seller GSTIN</th>
                <th>Settlement Period</th>
                <th>Settlement Amount</th>
                <th>Settlement Cycle</th>
                <th>Due Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${rows
                .map(
                  (row) => `
                <tr>
                  <td>${row.sellerName}</td>
                  <td>${row.sellerGstin || '-'}</td>
                  <td>${row.settlementPeriod}</td>
                  <td>${formatCurrency(row.settlementAmount)}</td>
                  <td>${row.settlementCycle}</td>
                  <td>${dayjs(row.dueDate).format('DD MMM YYYY')}</td>
                  <td class="${row.status === 'PENDING' ? 'pending' : 'paid'}">${row.status}</td>
                </tr>
              `
                )
                .join('')}
            </tbody>
            <tfoot>
              <tr class="totals-row">
                <td colspan="3"><strong>Totals</strong></td>
                <td>
                  <strong>
                    Due: ${formatCurrency(totals?.totalAmountDue || 0)}<br/>
                    Settled: ${formatCurrency(totals?.totalAmountSettled || 0)}
                  </strong>
                </td>
                <td colspan="2"></td>
                <td><strong>Pending: ${totals?.pendingCount || 0}, Paid: ${totals?.paidCount || 0}</strong></td>
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
  const columns: ColumnsType<SettlementDueReportRow> = [
    {
      title: 'Seller Name',
      dataIndex: 'sellerName',
      key: 'sellerName',
      fixed: 'left',
      width: 200,
      render: (text: string, record) => (
        <Link to={`/sellers/${record.sellerId}`}>{text}</Link>
      ),
    },
    {
      title: 'Seller GSTIN',
      dataIndex: 'sellerGstin',
      key: 'sellerGstin',
      width: 150,
      render: (gstin: string) => gstin || '-',
    },
    {
      title: 'Settlement Period',
      dataIndex: 'settlementPeriod',
      key: 'settlementPeriod',
      width: 200,
    },
    {
      title: 'Settlement Amount',
      dataIndex: 'settlementAmount',
      key: 'settlementAmount',
      align: 'right',
      width: 150,
      render: (value: number) => formatCurrency(value),
      sorter: (a, b) => a.settlementAmount - b.settlementAmount,
    },
    {
      title: 'Seller Ledger Balance',
      dataIndex: 'sellerLedgerBalance',
      key: 'sellerLedgerBalance',
      align: 'right',
      width: 180,
      render: (value: number | undefined) => {
        if (value === undefined) return '-'
        return (
          <span
            style={{
              color: value >= 0 ? '#4caf50' : '#ff4d4f',
              fontWeight: 'bold',
            }}
          >
            {formatCurrency(value)}
          </span>
        )
      },
      sorter: (a, b) => {
        const aBalance = a.sellerLedgerBalance ?? 0
        const bBalance = b.sellerLedgerBalance ?? 0
        return aBalance - bBalance
      },
    },
    {
      title: 'Settlement Cycle',
      dataIndex: 'settlementCycle',
      key: 'settlementCycle',
      width: 120,
    },
    {
      title: 'Due Date',
      dataIndex: 'dueDate',
      key: 'dueDate',
      width: 120,
      render: (date: string) => dayjs(date).format('DD MMM YYYY'),
      sorter: (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={status === 'PENDING' ? 'orange' : 'green'}>{status}</Tag>
      ),
      filters: [
        { text: 'Pending', value: 'PENDING' },
        { text: 'Paid', value: 'PAID' },
      ],
      onFilter: (value, record) => record.status === value,
    },
  ]

  return (
    <div style={{ padding: '24px' }}>
      <Card>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Title level={2} style={{ margin: 0 }}>
              Settlement Due Report
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

          {/* Seller Current Ledger Balance (when seller filter is applied) */}
          {report?.sellerLedgerBalance !== undefined && (
            <Card size="small" style={{ backgroundColor: '#f0f5ff', borderColor: '#91d5ff' }}>
              <Statistic
                title="Seller Current Ledger Balance"
                value={report.sellerLedgerBalance}
                prefix="₹"
                precision={2}
                valueStyle={{
                  color: report.sellerLedgerBalance >= 0 ? '#4caf50' : '#ff4d4f',
                  fontSize: '24px',
                  fontWeight: 'bold',
                }}
              />
              <div style={{ marginTop: 8, fontSize: '12px', color: '#666' }}>
                This is the actual current balance from the seller's ledger (includes all adjustments).
                The amounts below reflect settlement batch amounts at creation time.
              </div>
            </Card>
          )}

          {/* Summary Statistics */}
          {totals && (
            <>
              <Row gutter={16}>
                <Col span={6}>
                  <Statistic
                    title="Total Amount Due (as per batches)"
                    value={totals.totalAmountDue}
                    prefix="₹"
                    precision={0}
                    valueStyle={{ color: '#ff9800' }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="Total Amount Settled"
                    value={totals.totalAmountSettled}
                    prefix="₹"
                    precision={0}
                    valueStyle={{ color: '#4caf50' }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic title="Pending Settlements" value={totals.pendingCount} />
                </Col>
                <Col span={6}>
                  <Statistic title="Paid Settlements" value={totals.paidCount} />
                </Col>
              </Row>
              <div style={{ marginTop: 8, padding: '8px 12px', backgroundColor: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 4, fontSize: '12px', color: '#666' }}>
                💡 <strong>Note:</strong> This reflects settlement batch amounts. Actual payable balance may differ due to manual adjustments. 
                {report?.sellerLedgerBalance !== undefined && (
                  <> Check the ledger balance above for the current actual balance.</>
                )}
                {report?.sellerLedgerBalance === undefined && (
                  <> Filter by a specific seller to see their current ledger balance.</>
                )}
              </div>
            </>
          )}

          {/* Filters */}
          <Card size="small" title={<><FilterOutlined /> Filters</>}>
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
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
                  <div style={{ marginBottom: 8 }}>Settlement Cycle</div>
                  <Select
                    style={{ width: '100%' }}
                    placeholder="All Cycles"
                    allowClear
                    value={filters.settlementCycle}
                    onChange={(value) => {
                      setFilters({ ...filters, settlementCycle: value || undefined })
                      // Reset custom days if not selecting Custom or if clearing
                      if (value !== 'Custom') {
                        setCustomCycleDays(null)
                      }
                    }}
                    options={[
                      { label: 'Daily', value: 'Daily' },
                      { label: 'Weekly', value: 'Weekly' },
                      { label: 'Fortnightly', value: 'Fortnightly' },
                      { label: 'Monthly', value: 'Monthly' },
                      { label: 'Custom', value: 'Custom' },
                    ]}
                  />
                  {filters.settlementCycle === 'Custom' && (
                    <div style={{ marginTop: 8 }}>
                      <InputNumber
                        style={{ width: '100%' }}
                        placeholder="Enter number of days"
                        min={1}
                        max={365}
                        value={customCycleDays}
                        onChange={(value) => setCustomCycleDays(value)}
                        addonAfter="days"
                      />
                    </div>
                  )}
                </Col>
                <Col span={8}>
                  <div style={{ marginBottom: 8 }}>Status</div>
                  <Select
                    style={{ width: '100%' }}
                    value={filters.status}
                    onChange={(value) => setFilters({ ...filters, status: value })}
                    options={[
                      { label: 'All', value: 'ALL' },
                      { label: 'Pending Only', value: 'PENDING' },
                    ]}
                  />
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={8}>
                  <div style={{ marginBottom: 8 }}>Due Date Range</div>
                  <RangePicker
                    style={{ width: '100%' }}
                    value={dueDateRange as [Dayjs, Dayjs]}
                    onChange={(dates) => {
                      if (dates) {
                        setDueDateRange([dates[0] || null, dates[1] || null])
                      } else {
                        setDueDateRange([null, null])
                      }
                    }}
                  />
                </Col>
                <Col span={8}>
                  <div style={{ marginBottom: 8 }}>Amount From</div>
                  <Input
                    type="number"
                    placeholder="Min Amount"
                    value={amountRange.from}
                    onChange={(e) =>
                      setAmountRange({ ...amountRange, from: e.target.value || undefined })
                    }
                  />
                </Col>
                <Col span={8}>
                  <div style={{ marginBottom: 8 }}>Amount To</div>
                  <Input
                    type="number"
                    placeholder="Max Amount"
                    value={amountRange.to}
                    onChange={(e) =>
                      setAmountRange({ ...amountRange, to: e.target.value || undefined })
                    }
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
            rowKey="batchId"
            scroll={{ x: 1200 }}
            pagination={{
              pageSize: 50,
              showSizeChanger: true,
              showTotal: (total) => `Total ${total} settlements`,
            }}
            summary={() => {
              if (!totals) return null
              return (
                <Table.Summary fixed>
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0} colSpan={3}>
                      <strong>Totals</strong>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={3} align="right">
                      <div>
                        <div>
                          <strong style={{ color: '#ff9800' }}>
                            Due (as per batches): {formatCurrency(totals.totalAmountDue)}
                          </strong>
                        </div>
                        <div>
                          <strong style={{ color: '#4caf50' }}>
                            Settled: {formatCurrency(totals.totalAmountSettled)}
                          </strong>
                        </div>
                      </div>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={4} colSpan={2}></Table.Summary.Cell>
                    <Table.Summary.Cell index={6}>
                      <strong>
                        Pending: {totals.pendingCount}, Paid: {totals.paidCount}
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

export default SettlementDueReport

