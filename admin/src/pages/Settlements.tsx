import { App, Button, Card, DatePicker, Form, Input, Modal, Select, Space, Table, Tag } from 'antd'
import dayjs from 'dayjs'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  useSettlementBatches,
  useGenerateSettlementBatches,
  useImportSettlementOrders,
} from '../api/settlementQueries'

const { RangePicker } = DatePicker

const SettlementsPage = () => {
  const { message, notification } = App.useApp()
  const [searchParams, setSearchParams] = useSearchParams()
  const [form] = Form.useForm()
  const [importForm] = Form.useForm()
  const [page, setPage] = useState(Number(searchParams.get('page') || 1))

  const status = (searchParams.get('status') || undefined) as 'PENDING' | 'PAID' | undefined

  const fromDate = searchParams.get('fromDate') || undefined
  const toDate = searchParams.get('toDate') || undefined

  const { data, isLoading } = useSettlementBatches({
    status,
    fromDate,
    toDate,
    page,
    limit: 20,
  })

  const generateBatches = useGenerateSettlementBatches()
  const importOrders = useImportSettlementOrders()
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)

  const handleFilterChange = (values: any) => {
    const next: any = {}
    if (values.status) next.status = values.status
    if (values.dateRange && values.dateRange.length === 2) {
      next.fromDate = values.dateRange[0].startOf('day').toISOString()
      next.toDate = values.dateRange[1].endOf('day').toISOString()
    }
    setSearchParams(next)
    setPage(1)
  }

  const handleGenerate = async () => {
    try {
      const result = await generateBatches.mutateAsync()
      const created = result?.data?.created ?? 0
      if (created > 0) {
        message.success(`Generated ${created} new settlement batch${created === 1 ? '' : 'es'}`)
      } else {
        message.info('No eligible orders found for settlement')
      }
    } catch (error) {
      message.error((error as Error)?.message || 'Failed to generate settlement batches')
    }
  }

  const handleImportSubmit = async (values: any) => {
    if (!importFile) {
      message.error('Please select a CSV file to import.')
      return
    }
    try {
      await importOrders.mutateAsync({
        file: importFile,
        batchId: values.batchId || undefined,
      })
      message.success(
        values.batchId
          ? 'Orders imported into existing batch. Totals recomputed from ledger.'
          : 'New settlement batch created from imported orders. Totals computed from ledger.',
      )
      setImportModalOpen(false)
      setImportFile(null)
      importForm.resetFields()
    } catch (error: any) {
      // Handle axios error response structure
      const errorMessage = error?.response?.data?.message || error?.message || 'Failed to import settlement orders'
      const details = error?.response?.data?.details
      
      if (details?.alreadyInBatches && Array.isArray(details.alreadyInBatches) && details.alreadyInBatches.length > 0) {
        // Show detailed error with list of orders already in batches using notification for better formatting
        const orderList = details.alreadyInBatches.join(', ')
        notification.error({
          message: 'Import Failed',
          description: (
            <div>
              <div style={{ marginBottom: 8 }}>{errorMessage}</div>
              <div style={{ fontSize: '13px', color: '#8c8c8c' }}>
                <strong>Orders already in batches:</strong> {orderList}
              </div>
            </div>
          ),
          duration: 8,
        })
      } else {
        message.error(errorMessage)
      }
    }
  }

  const handleDownloadSampleCsv = () => {
    // Sample CSV with proper header and examples
    const sample = [
      'order_id,order_number',
      '66f1a9c2e4b0f1a23c4d5678,TO-10001',
      '66f1a9c2e4b0f1a23c4d5679,TO-10002',
      ',TO-10003', // Example with only order_number
      '66f1a9c2e4b0f1a23c4d5680,', // Example with only order_id
    ].join('\n')
    const blob = new Blob([sample], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'settlement-orders-sample.csv'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const columns = [
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
      title: 'Total Net Payout',
      dataIndex: 'totalNetPayout',
      render: (value: number) => `₹${value.toFixed(2)}`,
    },
    {
      title: 'Invoice',
      key: 'invoice',
      render: (_: any, record: any) => {
        if (record.invoiceUrl && record.invoiceNumber) {
          return (
            <a href={record.invoiceUrl} target="_blank" rel="noreferrer">
              {record.invoiceNumber}
            </a>
          )
        }
        if (record.status === 'PAID') {
          return <span className="text-xs text-slate-500">Pending invoice</span>
        }
        return <span className="text-xs text-slate-400">—</span>
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      render: (value: 'PENDING' | 'PAID') => (
        <Tag color={value === 'PAID' ? 'green' : 'orange'}>{value}</Tag>
      ),
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      render: (value: string) => dayjs(value).format('DD MMM YYYY, HH:mm'),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => <Link to={`/settlements/${record._id}`}>View</Link>,
    },
  ]

  const initialValues: any = {}
  if (status) initialValues.status = status
  if (fromDate && toDate) {
    initialValues.dateRange = [dayjs(fromDate), dayjs(toDate)]
  }

  const pagination = data?.pagination

  return (
    <Space direction="vertical" size="large" className="w-full">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Settlement Batches</h1>
        <Space>
          <Button onClick={() => setImportModalOpen(true)}>Import Orders (CSV/Excel)</Button>
          <Button type="primary" onClick={handleGenerate} loading={generateBatches.isPending}>
            Generate Settlement Batches
          </Button>
        </Space>
      </div>

      <Card>
        <Form
          layout="inline"
          form={form}
          initialValues={initialValues}
          onFinish={handleFilterChange}
        >
          <Form.Item name="status" label="Status">
            <Select
              allowClear
              style={{ width: 160 }}
              options={[
                { label: 'Pending', value: 'PENDING' },
                { label: 'Paid', value: 'PAID' },
              ]}
            />
          </Form.Item>
          <Form.Item name="dateRange" label="Date range">
            <RangePicker />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                Apply
              </Button>
              <Button
                onClick={() => {
                  form.resetFields()
                  setSearchParams({})
                  setPage(1)
                }}
              >
                Reset
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <Modal
        title="Import Orders into Settlement"
        open={importModalOpen}
        onCancel={() => {
          setImportModalOpen(false)
          setImportFile(null)
          importForm.resetFields()
        }}
        onOk={() => {
          void importForm.validateFields().then(handleImportSubmit).catch(() => undefined)
        }}
        confirmLoading={importOrders.isPending}
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Upload a CSV or Excel file with columns like <strong>order_id</strong> and/or{' '}
            <strong>order_number</strong>. All orders must belong to the same seller.
          </p>
          <p className="text-xs text-slate-500">
            If you provide a <strong>Batch ID</strong>, matching orders will be{' '}
            <strong>added to that batch</strong> and totals will be recomputed from the ledger. If
            you leave it empty, a <strong>new batch will be created</strong> for the seller using
            the imported orders.
          </p>
          <button
            type="button"
            onClick={handleDownloadSampleCsv}
            className="inline-flex items-center px-3 py-1.5 rounded-md bg-gray-100 text-gray-800 text-xs font-medium hover:bg-gray-200 transition-colors"
          >
            Download sample CSV
          </button>
          <Form form={importForm} layout="vertical">
            <Form.Item label="File" required>
              <Input
                type="file"
                accept=".csv, application/vnd.ms-excel, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null
                  setImportFile(file)
                }}
              />
            </Form.Item>
            <Form.Item name="batchId" label="Existing Batch ID (optional)">
              <Input placeholder="If provided, orders will be added into this batch" />
            </Form.Item>
          </Form>
        </div>
      </Modal>

      <Card>
        <Table
          rowKey="_id"
          loading={isLoading}
          dataSource={data?.data || []}
          columns={columns}
          pagination={
            pagination
              ? {
                  current: pagination.page,
                  total: pagination.total,
                  pageSize: pagination.limit,
                  onChange: (nextPage) => {
                    setPage(nextPage)
                    setSearchParams({
                      ...Object.fromEntries(searchParams.entries()),
                      page: String(nextPage),
                    })
                  },
                }
              : false
          }
        />
      </Card>
    </Space>
  )
}

export default SettlementsPage


