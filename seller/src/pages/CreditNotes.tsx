import { DownloadOutlined } from '@ant-design/icons'
import { Button, Card, Space, Table, Tag, Typography } from 'antd'
import dayjs from 'dayjs'
import { useSellerCreditNotes } from '../api/settlementQueries'
import type { SellerCreditNote } from '../api/settlements'

const { Title } = Typography

const CreditNotesPage = () => {
  const { data, isLoading } = useSellerCreditNotes()

  const columns = [
    {
      title: 'Credit Note Number',
      dataIndex: 'creditNoteNumber',
      key: 'creditNoteNumber',
      width: 200,
      render: (value: string, record: SellerCreditNote) => (
        <Space direction="vertical" size="small">
          <span style={{ fontWeight: 600, fontSize: 14 }}>{value}</span>
          {record.referenceInvoice && (
            <span style={{ fontSize: 12, color: '#666' }}>
              Ref: {record.referenceInvoice}
            </span>
          )}
        </Space>
      ),
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
          'Adjustment': 'orange',
          'Penalty Reversal': 'red',
        }
        return <Tag color={colorMap[value] || 'default'}>{value}</Tag>
      },
    },
    {
      title: 'Reference Invoice',
      dataIndex: 'referenceInvoice',
      key: 'referenceInvoice',
      width: 180,
      render: (value: string | null, record: SellerCreditNote) => {
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
      width: 200,
      render: (_: unknown, record: SellerCreditNote) => {
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
                  {sgst && sgst > 0 && (
                    <Tag color="cyan">SGST: ₹{sgst.toFixed(2)}</Tag>
                  )}
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
      render: (_: unknown, record: SellerCreditNote) => (
        <Button
          type="primary"
          icon={<DownloadOutlined />}
          onClick={() => window.open(record.creditNoteUrl, '_blank')}
        >
          Download PDF
        </Button>
      ),
    },
  ]

  return (
    <Space direction="vertical" size="large" className="w-full">
      <div className="flex items-center justify-between">
        <Title level={4} className="mb-0">
          Credit Notes
        </Title>
        <div style={{ fontSize: 14, color: '#666' }}>
          Total: {data?.data.total || 0} credit note(s)
        </div>
      </div>

      <Card>
        <Table
          rowKey="_id"
          loading={isLoading}
          dataSource={data?.data.creditNotes || []}
          columns={columns}
          pagination={
            data?.data.total && data.data.total > 0
              ? {
                  pageSize: 20,
                  showSizeChanger: true,
                  showTotal: (total) => `Total ${total} credit notes`,
                }
              : false
          }
          scroll={{ x: 1200 }}
        />
      </Card>
    </Space>
  )
}

export default CreditNotesPage

