import { Button, Card, Descriptions, Space, Table, Tag, Typography } from 'antd'
import dayjs from 'dayjs'
import { useParams } from 'react-router-dom'
import { useSellerSettlementBatchDetail } from '../api/settlementQueries'

const { Title, Text } = Typography

const SettlementBatchDetail = () => {
  const { id } = useParams<{ id: string }>()
  const { data, isLoading } = useSellerSettlementBatchDetail(id)

  const batch = data?.data.batch
  const orders = data?.data.orders || []

  const totals = orders.reduce(
    (acc, order) => {
      const sale = typeof order.sellerSaleAmount === 'number' ? order.sellerSaleAmount : 0
      const commission =
        typeof order.sellerCommissionAmount === 'number' ? order.sellerCommissionAmount : 0
      const net = typeof order.sellerNetAmount === 'number' ? order.sellerNetAmount : 0
      acc.totalSale += sale
      acc.totalCommission += commission
      acc.totalNet += net
      return acc
    },
    { totalSale: 0, totalCommission: 0, totalNet: 0 },
  )

  if (isLoading) {
    return <Text>Loading...</Text>
  }

  if (!batch) {
    return <Text>Settlement batch not found</Text>
  }

  const columns = [
    {
      title: 'Order ID',
      dataIndex: '_id',
    },
    {
      title: 'Order Number',
      dataIndex: 'orderNumber',
    },
    {
      title: 'Order Date',
      dataIndex: 'createdAt',
      render: (value: string) => dayjs(value).format('DD MMM YYYY, HH:mm'),
    },
    {
      title: 'Sale Amount',
      dataIndex: 'sellerSaleAmount',
      render: (value: number) => `₹${(value || 0).toFixed(2)}`,
    },
    {
      title: 'Commission',
      dataIndex: 'sellerCommissionAmount',
      render: (value: number) => `₹${(value || 0).toFixed(2)}`,
    },
    {
      title: 'Net Amount',
      dataIndex: 'sellerNetAmount',
      render: (value: number) => `₹${(value || 0).toFixed(2)}`,
    },
    {
      title: 'Settlement Status',
      dataIndex: 'settlementStatus',
      render: (value: string) => <Tag>{value || 'N/A'}</Tag>,
    },
  ]

  return (
    <Space direction="vertical" size="large" className="w-full">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Title level={4} className="mb-0">
            Settlement Batch #{batch._id}
          </Title>
          <Text type="secondary">
            Period: {dayjs(batch.fromDate).format('DD MMM YYYY')} –{' '}
            {dayjs(batch.toDate).format('DD MMM YYYY')}
          </Text>
        </div>
        {batch.invoiceUrl && (
          <Button
            onClick={() => {
              window.open(batch.invoiceUrl, '_blank', 'noopener,noreferrer')
            }}
          >
            Download Invoice
          </Button>
        )}
      </div>

      <Card title="Summary">
        <Descriptions column={2} labelStyle={{ fontWeight: 500 }}>
          {batch.invoiceNumber && (
            <Descriptions.Item label="Invoice Number">{batch.invoiceNumber}</Descriptions.Item>
          )}
          <Descriptions.Item label="Orders Count">{batch.ordersCount}</Descriptions.Item>
          <Descriptions.Item label="Status">
            <Tag color={batch.status === 'PAID' ? 'green' : 'orange'}>{batch.status}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Total Sale Amount">
            ₹{batch.totalSaleAmount.toFixed(2)}
          </Descriptions.Item>
          <Descriptions.Item label="Total Commission">
            ₹{batch.totalCommissionAmount.toFixed(2)}
          </Descriptions.Item>
          <Descriptions.Item label="Other Charges">
            ₹{batch.totalOtherCharges.toFixed(2)}
          </Descriptions.Item>
          <Descriptions.Item label="Total Net Payout">
            <Text strong>₹{batch.totalNetPayout.toFixed(2)}</Text>
          </Descriptions.Item>
          {batch.payoutDate && (
            <Descriptions.Item label="Payout Date">
              {dayjs(batch.payoutDate).format('DD MMM YYYY, HH:mm')}
            </Descriptions.Item>
          )}
          {batch.payoutReference && (
            <Descriptions.Item label="Payout Reference">{batch.payoutReference}</Descriptions.Item>
          )}
          {batch.payoutNotes && (
            <Descriptions.Item label="Payout Notes">{batch.payoutNotes}</Descriptions.Item>
          )}
        </Descriptions>
      </Card>

      <Card title="Ledger Breakdown">
        <Descriptions column={3} labelStyle={{ fontWeight: 500 }}>
          <Descriptions.Item label="Total Credits">
            <Text strong>₹{totals.totalSale.toFixed(2)}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Total Debits">
            <Text strong>₹{(totals.totalCommission + batch.totalOtherCharges).toFixed(2)}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Net Payout">
            <Text strong type="success">
              ₹{batch.totalNetPayout.toFixed(2)}
            </Text>
          </Descriptions.Item>
        </Descriptions>

        <Descriptions column={2} labelStyle={{ fontWeight: 500 }} className="mt-4">
          <Descriptions.Item label="ORDER_EARNING (credits)">
            ₹{totals.totalSale.toFixed(2)}
          </Descriptions.Item>
          <Descriptions.Item label="COMMISSION (debits)">
            ₹{totals.totalCommission.toFixed(2)}
          </Descriptions.Item>
          <Descriptions.Item label="OTHER_CHARGES (debits)">
            ₹{batch.totalOtherCharges.toFixed(2)}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="Orders in this batch">
        <Table rowKey="_id" dataSource={orders} columns={columns} pagination={false} />
      </Card>
    </Space>
  )
}

export default SettlementBatchDetail
