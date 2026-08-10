import { ArrowLeftOutlined, ShoppingOutlined } from '@ant-design/icons'
import {
  Button,
  Card,
  Descriptions,
  Empty,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
} from 'antd'
import dayjs from 'dayjs'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { OrderHistoryItem } from '../api/customers'
import { useSellerCustomer } from '../api/customers'

const { Title, Text } = Typography

const CustomerDetail = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [orderPage, setOrderPage] = useState(1)
  const orderLimit = 10

  const { data: customer, isLoading, error } = useSellerCustomer(id || '', orderPage, orderLimit)

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
      </div>
    )
  }

  if (error || !customer) {
    return (
      <Card title="Customer Details">
        <p>Error loading customer details or customer not found.</p>
        <Button onClick={() => navigate(-1)}>Back</Button>
      </Card>
    )
  }

  return (
    <Card
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
            Back
          </Button>
          <Title level={3} style={{ margin: 0 }}>
            Customer Details: {customer.name}
          </Title>
        </div>
      }
    >
      <Descriptions bordered column={{ xs: 1, sm: 2, md: 3 }} layout="vertical">
        <Descriptions.Item label="Name">{customer.name}</Descriptions.Item>
        <Descriptions.Item label="Total Orders">
          {customer.totalOrders !== undefined ? customer.totalOrders : 'N/A'}
        </Descriptions.Item>
        <Descriptions.Item label="Total Spent">
          {customer.totalSpent !== undefined
            ? `₹${customer.totalSpent.toLocaleString('en-IN')}`
            : 'N/A'}
        </Descriptions.Item>
        <Descriptions.Item label="Average Order Value">
          {customer.avgOrderValue !== undefined
            ? `₹${Math.round(customer.avgOrderValue).toLocaleString('en-IN')}`
            : 'N/A'}
        </Descriptions.Item>
        <Descriptions.Item label="First Order">
          {customer.firstOrderDate
            ? dayjs(customer.firstOrderDate).format('YYYY-MM-DD')
            : 'N/A'}
        </Descriptions.Item>
        <Descriptions.Item label="Last Order">
          {customer.lastOrderDate
            ? dayjs(customer.lastOrderDate).format('YYYY-MM-DD')
            : 'N/A'}
        </Descriptions.Item>
      </Descriptions>

      {/* Purchase History Section */}
      <Card
        style={{ marginTop: 16 }}
        title={
          <Space>
            <ShoppingOutlined />
            <span>Purchase History</span>
            {customer.orderHistoryPagination && (
              <Tag color="blue">{customer.orderHistoryPagination.total} orders</Tag>
            )}
          </Space>
        }
      >
        {customer.orderHistory && customer.orderHistory.length > 0 ? (
          <Table<OrderHistoryItem>
            rowKey="_id"
            dataSource={customer.orderHistory}
            pagination={{
              current: customer.orderHistoryPagination?.page || orderPage,
              total: customer.orderHistoryPagination?.total || 0,
              pageSize: customer.orderHistoryPagination?.limit || orderLimit,
              showSizeChanger: false,
              showTotal: (total) => `Total ${total} orders`,
              onChange: (page) => setOrderPage(page),
            }}
            columns={[
              {
                title: 'Order Number',
                dataIndex: 'orderNumber',
                key: 'orderNumber',
                render: (orderNumber: string, record) => (
                  <Link to={`/orders/${record._id}`} style={{ fontWeight: 500 }}>
                    {orderNumber || `#${record._id.slice(-8)}`}
                  </Link>
                ),
              },
              {
                title: 'Date',
                dataIndex: 'deliveredAt',
                key: 'deliveredAt',
                render: (date: string) =>
                  date ? dayjs(date).format('YYYY-MM-DD') : '-',
              },
              {
                title: 'Items',
                key: 'items',
                render: (_: unknown, record) => (
                  <Text type="secondary">
                    {record.items?.length || 0} item{(record.items?.length || 0) !== 1 ? 's' : ''}
                  </Text>
                ),
              },
              {
                title: 'Total',
                dataIndex: 'total',
                key: 'total',
                render: (total: number) => (
                  <Text strong style={{ color: '#52c41a' }}>
                    ₹{total.toLocaleString('en-IN')}
                  </Text>
                ),
              },
              {
                title: 'Status',
                dataIndex: 'status',
                key: 'status',
                render: (status: string) => (
                  <Tag color={status === 'delivered' ? 'green' : 'default'}>
                    {status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ')}
                  </Tag>
                ),
              },
            ]}
            expandable={{
              expandedRowRender: (record) => (
                <div style={{ padding: '12px 0' }}>
                  <Space direction="vertical" size="small" style={{ width: '100%' }}>
                    {record.items?.map((item, idx) => (
                      <div
                        key={item._id || idx}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '8px',
                          background: '#fafafa',
                          borderRadius: '4px',
                        }}
                      >
                        <div>
                          <Text strong>
                            {item.product?.name || item.variant?.name || 'Product'}
                            {item.variant?.name && ` - ${item.variant.name}`}
                          </Text>
                          <br />
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            Qty: {item.quantity} × ₹{(item.effectivePrice ?? item.price).toLocaleString('en-IN')} = ₹
                            {item.subtotal.toLocaleString('en-IN')}
                          </Text>
                        </div>
                      </div>
                    ))}
                  </Space>
                </div>
              ),
            }}
          />
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="No order history available"
          />
        )}
      </Card>
    </Card>
  )
}

export default CustomerDetail

