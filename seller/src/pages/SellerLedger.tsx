import { FilePdfOutlined, FileTextOutlined, QuestionCircleOutlined } from '@ant-design/icons'
import { Alert, App, Button, Card, Descriptions, Modal, Space, Table, Tag, Typography } from 'antd'
import dayjs from 'dayjs'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCreateSellerTicket } from '../api/tickets'
import { useSellerLedger } from '../api/settlementQueries'
import type { SellerLedgerEntry } from '../api/settlements'

const { Title, Text } = Typography

const SellerLedger = () => {
  const { modal } = App.useApp()
  const { data, isLoading } = useSellerLedger()
  const navigate = useNavigate()
  const createTicketMutation = useCreateSellerTicket()
  const [raiseQueryEntry, setRaiseQueryEntry] = useState<SellerLedgerEntry | null>(null)

  const columns = [
    {
      title: 'Date',
      dataIndex: 'createdAt',
      key: 'date',
      width: 180,
      render: (value: string) => dayjs(value).format('DD MMM YYYY, HH:mm'),
    },
    {
      title: 'Type',
      dataIndex: 'entryType',
      key: 'type',
      width: 100,
      render: (value: 'CREDIT' | 'DEBIT') => (
        <Tag color={value === 'CREDIT' ? 'green' : 'red'}>{value}</Tag>
      ),
    },
    {
      title: 'Transaction',
      dataIndex: 'reasonLabel',
      key: 'reason',
      width: 200,
    },
    {
      title: 'Order',
      key: 'order',
      width: 150,
      render: (_: unknown, record: SellerLedgerEntry) => {
        if (record.order?.orderNumber) {
          return (
            <Link to={`/orders/${record.order._id}`} target="_blank">
              {record.order.orderNumber}
            </Link>
          )
        }
        return <span style={{ color: '#999' }}>—</span>
      },
    },
    {
      title: 'Settlement',
      key: 'settlement',
      width: 180,
      render: (_: unknown, record: SellerLedgerEntry) => {
        if (record.settlementBatch) {
          const batch = record.settlementBatch
          const period = `${dayjs(batch.fromDate).format('DD MMM')} – ${dayjs(batch.toDate).format(
            'DD MMM YYYY',
          )}`
          return (
            <Link to={`/settlements/${batch._id}`}>
              <div>
                <div style={{ fontSize: 12 }}>{period}</div>
                <Tag color={batch.status === 'PAID' ? 'green' : 'orange'} style={{ marginTop: 4 }}>
                  {batch.status}
                </Tag>
              </div>
            </Link>
          )
        }
        return <span style={{ color: '#999' }}>—</span>
      },
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      width: 120,
      align: 'right' as const,
      render: (value: number, record: SellerLedgerEntry) => (
        <span
          style={{
            fontWeight: 600,
            color: record.entryType === 'DEBIT' ? '#dc2626' : '#059669',
          }}
        >
          {record.entryType === 'DEBIT' ? '-' : '+'}₹{value.toFixed(2)}
        </span>
      ),
    },
    {
      title: 'Running Balance',
      dataIndex: 'runningBalance',
      key: 'runningBalance',
      width: 140,
      align: 'right' as const,
      render: (value: number) => (
        <span
          style={{
            fontWeight: 600,
            color: value < 0 ? '#dc2626' : value > 0 ? '#059669' : '#666',
          }}
        >
          ₹{value.toFixed(2)}
        </span>
      ),
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      render: (value?: string | null) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {value || '—'}
        </Text>
      ),
    },
    {
      title: 'Credit/Debit Note',
      key: 'notes',
      width: 250,
      fixed: 'right' as const,
      render: (_: unknown, record: SellerLedgerEntry) => {
        if (record.creditNote?.credit_note_url) {
          return (
            <Space size="small" direction="vertical" style={{ width: '100%' }}>
              <Space size="small" wrap>
                <Tag color="blue" style={{ margin: 0 }}>
                  Credit Note
                </Tag>
                <Text code style={{ fontSize: 12, fontWeight: 600 }}>
                  {record.creditNote.credit_note_number || '—'}
                </Text>
              </Space>
              <Button
                size="small"
                type="primary"
                icon={<FilePdfOutlined />}
                onClick={() => window.open(record.creditNote!.credit_note_url!, '_blank')}
                style={{ width: '100%' }}
              >
                Download PDF
              </Button>
              <Button
                size="small"
                type="link"
                onClick={() => window.location.href = '/credit-notes'}
                style={{ padding: 0, fontSize: 11 }}
              >
                View All Credit Notes →
              </Button>
            </Space>
          )
        }
        if (record.debitNote?.debit_note_url) {
          return (
            <Space size="small" direction="vertical" style={{ width: '100%' }}>
              <Space size="small">
                <Text type="secondary" style={{ fontSize: 11, fontWeight: 500, color: '#ff4d4f' }}>
                  Debit Note:
                </Text>
                <Text code style={{ fontSize: 11, fontWeight: 600, color: '#ff4d4f' }}>
                  {record.debitNote.debit_note_number || '—'}
                </Text>
              </Space>
              <Button
                size="small"
                type="primary"
                danger
                icon={<FilePdfOutlined />}
                onClick={() => window.open(record.debitNote!.debit_note_url!, '_blank')}
                style={{ width: '100%' }}
              >
                Download PDF
              </Button>
            </Space>
          )
        }
        return <span style={{ color: '#999' }}>—</span>
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 150,
      fixed: 'right' as const,
      render: (_: unknown, record: SellerLedgerEntry) => (
        <Button
          size="small"
          icon={<QuestionCircleOutlined />}
          onClick={(e) => {
            e.stopPropagation()
            e.preventDefault()
            setRaiseQueryEntry(record)
          }}
        >
          Raise Query
        </Button>
      ),
    },
  ]

  return (
    <Space direction="vertical" size="large" className="w-full">
      <div className="flex items-center justify-between">
        <Title level={4} className="mb-0">
          <FileTextOutlined style={{ marginRight: 8 }} />
          Seller Ledger
        </Title>
      </div>

      <Alert
        message="Read-Only Ledger Snapshot"
        description="This ledger shows all financial transactions affecting your account balance. It is derived from your settlement entries and cannot be edited. For disputes or questions, please contact support."
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      {data && (
        <Card>
          <Descriptions column={4} size="small" bordered>
            <Descriptions.Item label="Opening Balance">
              <Text strong>₹{data.data.openingBalance.toFixed(2)}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Closing Balance">
              <div>
                <Text
                  strong
                  style={{
                    color: data.data.closingBalance < 0 ? '#dc2626' : '#059669',
                    fontSize: 16,
                  }}
                >
                  ₹{data.data.closingBalance.toFixed(2)}
                </Text>
                {data.data.closingBalance < 0 && (
                  <div style={{ fontSize: 12, marginTop: 4, color: '#666' }}>
                    This amount will be adjusted in your next settlement.
                  </div>
                )}
              </div>
            </Descriptions.Item>
            <Descriptions.Item label="Total Entries">
              <Text>{data.data.totalEntries}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Entries Shown">
              <Text>{data.data.entries.length}</Text>
            </Descriptions.Item>
          </Descriptions>
        </Card>
      )}

      <Card style={{ overflowX: 'auto' }}>
        <Table
          rowKey="_id"
          loading={isLoading}
          dataSource={data?.data.entries || []}
          columns={columns}
          pagination={{
            pageSize: 50,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} entries`,
          }}
          scroll={{ x: 'max-content' }}
        />
      </Card>

      <Card>
        <Title level={5}>Understanding Your Ledger</Title>
        <Space direction="vertical" size="small" style={{ width: '100%' }}>
          <Text>
            <strong>Credits (Green):</strong> Money added to your account (order earnings, shipping
            fees, returns, etc.)
          </Text>
          <Text>
            <strong>Debits (Red):</strong> Money deducted from your account (commissions, fees,
            refunds, etc.)
          </Text>
          <Text>
            <strong>Running Balance:</strong> Your account balance after each transaction
          </Text>
          <Text>
            <strong>Settlement Linkage:</strong> Entries linked to a settlement batch are included
            in that batch&apos;s payout calculation
          </Text>
          <Text type="secondary" style={{ fontSize: 12, marginTop: 8 }}>
            Note: Platform-only expenses and adjustments are not shown in this ledger. Negative
            balances will be adjusted in future settlement payouts.
          </Text>
        </Space>
      </Card>

      {/* Raise Query Modal */}
      <Modal
        title="Raise Query for Ledger Entry"
        open={!!raiseQueryEntry}
        onOk={async () => {
          if (!raiseQueryEntry) return
          try {
            await createTicketMutation.mutateAsync({
              subject: `Query regarding Ledger Entry - ${dayjs(raiseQueryEntry.createdAt).format('DD MMM YYYY')}`,
              category: 'ledger',
              description: `I have a question regarding this ledger entry:\n\nDate: ${dayjs(raiseQueryEntry.createdAt).format('DD MMM YYYY, HH:mm')}\nType: ${raiseQueryEntry.entryType}\nReason: ${raiseQueryEntry.reasonLabel}\nAmount: ₹${raiseQueryEntry.amount.toFixed(2)}\nDescription: ${raiseQueryEntry.description || 'N/A'}\n\nPlease provide clarification.`,
              priority: 'medium',
              ledgerEntryId: raiseQueryEntry._id,
            })
            modal.success({
              title: 'Ticket Created',
              content: 'Your query has been submitted. We will respond shortly.',
              onOk: () => {
                setRaiseQueryEntry(null)
                navigate('/tickets')
              },
            })
          } catch {
            modal.error({
              title: 'Error',
              content: 'Failed to create ticket. Please try again.',
            })
          }
        }}
        onCancel={() => setRaiseQueryEntry(null)}
        okText="Create Ticket"
        cancelText="Cancel"
        okButtonProps={{ loading: createTicketMutation.isPending }}
      >
        {raiseQueryEntry && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Date">
                {dayjs(raiseQueryEntry.createdAt).format('DD MMM YYYY, HH:mm')}
              </Descriptions.Item>
              <Descriptions.Item label="Type">
                <Tag color={raiseQueryEntry.entryType === 'CREDIT' ? 'green' : 'red'}>
                  {raiseQueryEntry.entryType}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Transaction">
                {raiseQueryEntry.reasonLabel}
              </Descriptions.Item>
              <Descriptions.Item label="Amount">
                ₹{raiseQueryEntry.amount.toFixed(2)}
              </Descriptions.Item>
              <Descriptions.Item label="Description">
                {raiseQueryEntry.description || '—'}
              </Descriptions.Item>
            </Descriptions>
            <Alert
              message="Creating a ticket"
              description="A support ticket will be created with details about this ledger entry. You can track the status in the Support Tickets section."
              type="info"
              showIcon
            />
          </Space>
        )}
      </Modal>
    </Space>
  )
}

export default SellerLedger
