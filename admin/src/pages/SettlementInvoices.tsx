import { Card, DatePicker, Form, Progress, Space, Statistic, Table, Tag, Typography } from 'antd'
import dayjs from 'dayjs'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { SettlementBatch } from '../api/settlements'
import { useSettlementBatches } from '../api/settlementQueries'

const { RangePicker } = DatePicker
const { Text } = Typography

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value || 0)

const SettlementInvoicesPage = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const [form] = Form.useForm()
  const [page, setPage] = useState(Number(searchParams.get('page') || 1))

  const fromDate = searchParams.get('fromDate') || undefined
  const toDate = searchParams.get('toDate') || undefined

  const { data, isLoading } = useSettlementBatches({
    status: 'PAID',
    fromDate,
    toDate,
    page,
    limit: 20,
  })

  const handleFilterChange = (values: any) => {
    const next: any = { status: 'PAID' }
    if (values.dateRange && values.dateRange.length === 2) {
      next.fromDate = values.dateRange[0].startOf('day').toISOString()
      next.toDate = values.dateRange[1].endOf('day').toISOString()
    }
    setSearchParams(next)
    setPage(1)
  }

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
    {
      totalPayout: 0,
      totalSales: 0,
      totalDeductions: 0,
      totalOrders: 0,
      readyInvoices: 0,
    },
  )
  const invoiceCoverage = rows.length > 0 ? Math.round((summary.readyInvoices / rows.length) * 100) : 0

  const columns = [
    {
      title: 'Invoice Number',
      dataIndex: 'invoiceNumber',
      render: (value: string, record: any) =>
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
      render: (value: string) => <Link to={`/settlements/${value}`}>{value}</Link>,
    },
    {
      title: 'Seller',
      dataIndex: ['seller', 'businessName'],
      render: (_: any, record: any) =>
        record.seller?.businessName || record.seller?.name || 'Seller',
    },
    {
      title: 'Period',
      key: 'period',
      render: (_: any, record: any) => (
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
      render: (_: unknown, record: SettlementBatch) =>
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

  const initialValues: any = { status: 'PAID' }
  if (fromDate && toDate) {
    initialValues.dateRange = [dayjs(fromDate), dayjs(toDate)]
  }

  const pagination = data?.pagination

  return (
    <Space direction="vertical" size="large" className="w-full">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Settlement Invoices</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <Statistic
            title="Current page payouts"
            value={summary.totalPayout}
            precision={2}
            prefix="₹"
          />
          <Text type="secondary">{rows.length} invoices in view</Text>
        </Card>
        <Card>
          <Statistic
            title="Gross sales covered"
            value={summary.totalSales}
            precision={2}
            prefix="₹"
          />
          <Text type="secondary">{summary.totalOrders} orders across visible invoices</Text>
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
            {summary.readyInvoices} of {rows.length} invoices have downloadable PDFs
          </Text>
        </Card>
      </div>

      <Card>
        <Form
          layout="inline"
          form={form}
          initialValues={initialValues}
          onFinish={handleFilterChange}
        >
          <Form.Item name="dateRange" label="Payout date range">
            <RangePicker />
          </Form.Item>
          <Form.Item>
            <Space>
              <button
                type="submit"
                className="inline-flex items-center px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                Apply
              </button>
              <button
                type="button"
                onClick={() => {
                  form.resetFields()
                  setSearchParams({ status: 'PAID' })
                  setPage(1)
                }}
                className="inline-flex items-center px-4 py-2 rounded-md bg-gray-100 text-gray-800 text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                Reset
              </button>
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

