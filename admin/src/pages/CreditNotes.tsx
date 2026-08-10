import { DownloadOutlined } from '@ant-design/icons'
import { Button, Card, Form, Select, Space, Table, Tag, Typography } from 'antd'
import dayjs from 'dayjs'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAdminCreditNotes } from '../api/settlementQueries'
import type { AdminCreditNote } from '../api/settlements'
import { useUsers, type AdminUser } from '../api/users'

const { Title } = Typography
const { Option } = Select

const CreditNotesPage = () => {
  const [form] = Form.useForm()
  const [filters, setFilters] = useState<{
    sellerId?: string
  }>({})
  const [page, setPage] = useState(1)

  const { data, isLoading } = useAdminCreditNotes({
    ...filters,
    page,
    limit: 50,
  })

  const { data: sellersData } = useUsers({ role: 'seller' })

  const handleFilterChange = (values: { sellerId?: string }) => {
    setFilters({
      sellerId: values.sellerId || undefined,
    })
    setPage(1)
  }

  const columns = [
    {
      title: 'Credit Note Number',
      dataIndex: 'creditNoteNumber',
      key: 'creditNoteNumber',
      width: 200,
      fixed: 'left' as const,
      render: (value: string, record: AdminCreditNote) => (
        <Space direction="vertical" size="small">
          <span style={{ fontWeight: 600, fontSize: 14 }}>{value}</span>
          {record.referenceInvoice && (
            <span style={{ fontSize: 12, color: '#666' }}>Ref: {record.referenceInvoice}</span>
          )}
        </Space>
      ),
    },
    {
      title: 'Seller',
      key: 'seller',
      width: 200,
      render: (_: unknown, record: AdminCreditNote) => {
        if (record.seller) {
          return (
            <Space direction="vertical" size="small">
              <Link to={`/sellers/${record.seller._id}`} target="_blank">
                {record.seller.businessName || record.seller.name}
              </Link>
              {record.seller.gstNumber && (
                <span style={{ fontSize: 12, color: '#666' }}>GST: {record.seller.gstNumber}</span>
              )}
            </Space>
          )
        }
        return <span style={{ color: '#999' }}>—</span>
      },
    },
    {
      title: 'Issue Date',
      dataIndex: 'issueDate',
      key: 'issueDate',
      width: 150,
      render: (value: string) => dayjs(value).format('DD MMM YYYY'),
    },
    {
      title: 'Reason',
      dataIndex: 'reason',
      key: 'reason',
      width: 180,
      render: (value: string) => {
        const colorMap: Record<string, string> = {
          'Commission Reversal': 'blue',
          Adjustment: 'orange',
          'Penalty Reversal': 'red',
        }
        return <Tag color={colorMap[value] || 'default'}>{value}</Tag>
      },
    },
    {
      title: 'Reference Invoice',
      dataIndex: 'referenceInvoice',
      key: 'referenceInvoice',
      width: 200,
      render: (value: string | null, record: AdminCreditNote) => {
        if (value) {
          return (
            <Space direction="vertical" size="small">
              <span>{value}</span>
              {record.settlementBatch && (
                <span style={{ fontSize: 12, color: '#666' }}>
                  {dayjs(record.settlementBatch.fromDate).format('DD MMM')} –{' '}
                  {dayjs(record.settlementBatch.toDate).format('DD MMM YYYY')}
                </span>
              )}
            </Space>
          )
        }
        return <span style={{ color: '#999' }}>—</span>
      },
    },
    {
      title: 'Tax Breakup',
      key: 'taxBreakup',
      width: 220,
      render: (_: unknown, record: AdminCreditNote) => {
        if (record.taxBreakup) {
          const { hsnSacCode, gstRatePercent, igst, cgst, sgst } = record.taxBreakup
          return (
            <Space direction="vertical" size="small" style={{ fontSize: 12 }}>
              {hsnSacCode && (
                <div>
                  <span style={{ color: '#666' }}>HSN/SAC: </span>
                  <span style={{ fontWeight: 500 }}>{hsnSacCode}</span>
                </div>
              )}
              {gstRatePercent && (
                <div>
                  <span style={{ color: '#666' }}>GST Rate: </span>
                  <span style={{ fontWeight: 500 }}>{gstRatePercent}%</span>
                </div>
              )}
              {(igst || cgst || sgst) && (
                <div style={{ marginTop: 4 }}>
                  {igst && igst > 0 && (
                    <Tag color="purple" style={{ marginRight: 4 }}>
                      IGST: ₹{igst.toFixed(2)}
                    </Tag>
                  )}
                  {cgst && cgst > 0 && (
                    <Tag color="cyan" style={{ marginRight: 4 }}>
                      CGST: ₹{cgst.toFixed(2)}
                    </Tag>
                  )}
                  {sgst && sgst > 0 && <Tag color="cyan">SGST: ₹{sgst.toFixed(2)}</Tag>}
                </div>
              )}
            </Space>
          )
        }
        return <span style={{ color: '#999' }}>—</span>
      },
    },
    {
      title: 'Amount Credited',
      dataIndex: 'amount',
      key: 'amount',
      width: 150,
      align: 'right' as const,
      render: (value: number) => (
        <span style={{ fontWeight: 600, color: '#059669', fontSize: 14 }}>
          +₹{value.toFixed(2)}
        </span>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 150,
      fixed: 'right' as const,
      render: (_: unknown, record: AdminCreditNote) => (
        <Space>
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={() => window.open(record.creditNoteUrl, '_blank')}
          >
            PDF
          </Button>
          {record.settlementBatch && (
            <Button
              type="link"
              onClick={() => (window.location.href = `/settlements/${record.settlementBatch!._id}`)}
            >
              Batch
            </Button>
          )}
        </Space>
      ),
    },
  ]

  return (
    <Space direction="vertical" size="large" className="w-full">
      <div className="flex items-center justify-between">
        <Title level={4} className="mb-0">
          Credit Notes
        </Title>
      </div>

      <Card>
        <Form layout="inline" form={form} onFinish={handleFilterChange}>
          <Form.Item name="sellerId" label="Filter by Seller">
            <Select
              placeholder="All Sellers"
              allowClear
              style={{ width: 300 }}
              showSearch
              filterOption={(input, option) => {
                const children = option?.children
                const text = typeof children === 'string' ? children : String(children || '')
                return text.toLowerCase().includes(input.toLowerCase())
              }}
            >
              {sellersData?.map((seller: AdminUser) => (
                <Option key={seller._id} value={seller._id}>
                  {seller.businessName || seller.name}
                </Option>
              ))}
            </Select>
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
          dataSource={data?.data.creditNotes || []}
          columns={columns}
          scroll={{ x: 1500 }}
          pagination={
            data?.data.pagination
              ? {
                  current: data.data.pagination.page,
                  total: data.data.pagination.total,
                  pageSize: data.data.pagination.limit,
                  showSizeChanger: true,
                  showTotal: (total) => `Total ${total} credit notes`,
                  onChange: (newPage) => setPage(newPage),
                }
              : false
          }
        />
      </Card>
    </Space>
  )
}

export default CreditNotesPage
