import {
  Button,
  Card,
  DatePicker,
  Form,
  Progress,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { useState } from 'react'
import { useSellerSettlementBatches } from '../api/settlementQueries'
import type { SellerSettlementBatch } from '../api/settlements'

const { RangePicker } = DatePicker
const { Text, Title } = Typography

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value || 0)

const SettlementInvoicesPage = () => {
  const [form] = Form.useForm()
  const [filters, setFilters] = useState<{
    fromDate?: string
    toDate?: string
  }>({})
  const [page, setPage] = useState(1)

  const { data, isLoading } = useSellerSettlementBatches({
    status: 'PAID',
    ...filters,
    page,
    limit: 20,
  })

  const columns: ColumnsType<SellerSettlementBatch> = [
    {
      title: 'Invoice Number',
      dataIndex: 'invoiceNumber',
      render: (value: string | undefined, record: SellerSettlementBatch) =>
        record.invoiceUrl && value ? (
          <a href={record.invoiceUrl} target="_blank" rel="noreferrer">
            {value}
          </a>
        ) : (
          <span className="text-xs text-slate-500">Pending</span>
        ),
    },
    {
      title: 'Batch ID',
      dataIndex: '_id',
    },
    {
      title: 'Period',
      key: 'period',
      render: (_: unknown, record: SellerSettlementBatch) => (
        <span>
          {dayjs(record.fromDate).format('DD MMM YYYY')} –{' '}
          {dayjs(record.toDate).format('DD MMM YYYY')}
        </span>
      ),
    },
    {
      title: 'Orders',
      dataIndex: 'ordersCount',
    },
    {
      title: 'Gross Sales',
      dataIndex: 'totalSaleAmount',
      render: (value: number) => formatCurrency(value),
    },
    {
      title: 'Deductions',
      key: 'deductions',
      render: (_: unknown, record: SellerSettlementBatch) =>
        formatCurrency((record.totalCommissionAmount || 0) + (record.totalOtherCharges || 0)),
    },
    {
      title: 'Net Payout',
      dataIndex: 'totalNetPayout',
      render: (value: number) => formatCurrency(value),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      render: (value: 'PENDING' | 'PAID') => (
        <Tag color={value === 'PAID' ? 'green' : 'orange'}>{value}</Tag>
      ),
    },
    {
      title: 'Payout Date',
      dataIndex: 'payoutDate',
      render: (value?: string) => (value ? dayjs(value).format('DD MMM YYYY') : '—'),
    },
  ]

  const handleFilterChange = (values: { dateRange?: [dayjs.Dayjs, dayjs.Dayjs] }) => {
    const next: { fromDate?: string; toDate?: string } = {}
    if (values.dateRange && values.dateRange.length === 2) {
      next.fromDate = values.dateRange[0].startOf('day').toISOString()
      next.toDate = values.dateRange[1].endOf('day').toISOString()
    }
    setFilters(next)
    setPage(1)
  }

  const pagination = data?.pagination
  const rows = data?.data || []
  const summary = rows.reduce(
    (acc, row) => {
      acc.totalPayout += row.totalNetPayout || 0
      acc.totalSales += row.totalSaleAmount || 0
      acc.totalDeductions += (row.totalCommissionAmount || 0) + (row.totalOtherCharges || 0)
      acc.totalOrders += row.ordersCount || 0
      if (row.invoiceNumber && row.invoiceUrl) acc.readyInvoices += 1
      return acc
    },
    { totalPayout: 0, totalSales: 0, totalDeductions: 0, totalOrders: 0, readyInvoices: 0 },
  )
  const invoiceCoverage = rows.length > 0 ? Math.round((summary.readyInvoices / rows.length) * 100) : 0

  return (
    <Space direction="vertical" size="large" className="w-full">
      <div className="flex items-center justify-between">
        <Title level={4} className="mb-0">
          Settlement Invoices
        </Title>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <Statistic
            title="Current page payouts"
            value={summary.totalPayout}
            precision={2}
            prefix="₹"
          />
          <Text type="secondary">{rows.length} invoices in this view</Text>
        </Card>
        <Card>
          <Statistic
            title="Gross sales covered"
            value={summary.totalSales}
            precision={2}
            prefix="₹"
          />
          <Text type="secondary">{summary.totalOrders} orders included</Text>
        </Card>
        <Card>
          <Statistic
            title="Total deductions"
            value={summary.totalDeductions}
            precision={2}
            prefix="₹"
          />
          <Text type="secondary">
            Avg. {formatCurrency(rows.length ? summary.totalDeductions / rows.length : 0)} per invoice
          </Text>
        </Card>
        <Card>
          <Statistic title="Invoice readiness" value={invoiceCoverage} suffix="%" />
          <Progress percent={invoiceCoverage} size="small" showInfo={false} strokeColor="#16a34a" />
          <Text type="secondary">
            {summary.readyInvoices} of {rows.length} invoices are downloadable
          </Text>
        </Card>
      </div>

      <Card>
        <Form layout="inline" form={form} onFinish={handleFilterChange}>
          <Form.Item name="dateRange" label="Payout date range">
            <RangePicker />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                Apply
              </Button>
              <Button
                type="default"
                onClick={() => {
                  form.resetFields()
                  setFilters({})
                  setPage(1)
                }}
              >
                Reset
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <Card>
        <Table
          rowKey="_id"
          loading={isLoading}
          dataSource={rows}
          columns={columns}
          pagination={
            pagination
              ? {
                  current: pagination.page,
                  total: pagination.total,
                  pageSize: pagination.limit,
                  onChange: (nextPage) => setPage(nextPage),
                }
              : false
          }
        />
      </Card>
    </Space>
  )
}

export default SettlementInvoicesPage
