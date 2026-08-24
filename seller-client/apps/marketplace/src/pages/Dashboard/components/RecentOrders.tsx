import { RightOutlined, ShoppingCartOutlined } from '@ant-design/icons'
import { Card, Skeleton, Tag, Typography } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useSellerOrders } from '../../../api/orderQueries'
import type { SellerOrderBatch } from '../../../api/orders'

const { Text } = Typography

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount)

const formatRelativeTime = (dateStr: string | Date) => {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins} min ago`
  if (diffHours < 24) return `${diffHours} hr ago`
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`
  return date.toLocaleDateString()
}

const statusLabel: Record<string, string> = {
  pending: 'Pending',
  processing: 'Processing',
  ready_to_ship: 'Ready to ship',
  pickup_requested: 'Pickup requested',
  shipped: 'Shipped',
  in_transit: 'In transit',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  mixed: 'Mixed',
}

const statusTagColor: Record<string, string> = {
  pending: 'orange',
  processing: 'blue',
  ready_to_ship: 'cyan',
  pickup_requested: 'geekblue',
  shipped: 'blue',
  in_transit: 'purple',
  out_for_delivery: 'purple',
  delivered: 'green',
  cancelled: 'default',
  mixed: 'default',
}

const RecentOrders = () => {
  const navigate = useNavigate()
  const { data, isLoading } = useSellerOrders({ page: 1, limit: 5 })

  const batches: SellerOrderBatch[] = data?.data ?? []
  const totalOrders = data?.pagination?.total ?? 0

  return (
    <Card
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: '#e6f4ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ShoppingCartOutlined style={{ color: '#B78115', fontSize: 18 }} />
          </div>
          <span style={{ fontSize: 16, fontWeight: 600, color: '#262626' }}>Recent Orders</span>
        </div>
      }
      extra={
        totalOrders > 0 ? (
          <Text
            type="secondary"
            style={{
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 500,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              color: '#B78115',
            }}
            onClick={() => navigate('/orders')}
          >
            View all
            <RightOutlined style={{ fontSize: 12 }} />
          </Text>
        ) : null
      }
      style={{
        borderRadius: 12,
        border: '1px solid #e8e8e8',
        boxShadow: 'none',
      }}
      bodyStyle={{
        padding: batches.length === 0 && !isLoading ? 24 : '16px 20px',
      }}
    >
      {isLoading ? (
        <Skeleton active paragraph={{ rows: 3 }} />
      ) : batches.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '24px 16px',
            background: '#fafafa',
            borderRadius: 10,
            border: '1px dashed #e8e8e8',
          }}
        >
          <ShoppingCartOutlined style={{ fontSize: 32, color: '#bfbfbf', marginBottom: 12, display: 'block' }} />
          <Text type="secondary" style={{ fontSize: 14 }}>
            No orders yet. New orders will appear here.
          </Text>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {batches.map((batch, index) => {
            const b = batch as SellerOrderBatch & {
              orderCount?: number
              total?: number
              orderedAt?: string
              status?: string
            }
            const orderCount = batch.summary?.orderCount ?? b.orderCount ?? batch.orders?.length ?? 1
            const total = batch.summary?.total ?? b.total ?? 0
            const orderedAt = batch.summary?.orderedAt ?? b.orderedAt
            const status = (batch.summary?.status ?? b.status ?? 'pending') as string
            const tagColor = statusTagColor[status] ?? 'default'

            return (
              <div
                key={batch.batchId ?? batch.batchCode ?? index}
                role="button"
                tabIndex={0}
                onClick={() => navigate('/orders')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    navigate('/orders')
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: '12px 14px',
                  borderRadius: 10,
                  cursor: 'pointer',
                  transition: 'background 0.2s, box-shadow 0.2s',
                  border: '1px solid transparent',
                  marginBottom: index < batches.length - 1 ? 4 : 0,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#f5f9ff'
                  e.currentTarget.style.borderColor = '#d6e4ff'
                  e.currentTarget.style.boxShadow = '0 1px 4px rgba(24, 144, 255, 0.08)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = ''
                  e.currentTarget.style.borderColor = 'transparent'
                  e.currentTarget.style.boxShadow = ''
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Text strong style={{ fontSize: 15, color: '#262626' }}>
                      {orderCount} order{orderCount !== 1 ? 's' : ''}
                    </Text>
                    <Text style={{ fontSize: 15, fontWeight: 600, color: '#4F5552' }}>
                      {formatCurrency(total)}
                    </Text>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {orderedAt ? (
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {formatRelativeTime(orderedAt)}
                      </Text>
                    ) : null}
                    {orderedAt && status ? (
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        ·
                      </Text>
                    ) : null}
                    <Tag color={tagColor} style={{ marginRight: 0, fontSize: 11 }}>
                      {statusLabel[status] ?? status}
                    </Tag>
                  </div>
                </div>
                <RightOutlined style={{ fontSize: 12, color: '#8c8c8c', flexShrink: 0 }} />
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}

export default RecentOrders
