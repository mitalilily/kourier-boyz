import { SwapOutlined } from '@ant-design/icons'
import { Card, Typography } from 'antd'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { DashboardOverview } from '../../../api/dashboard'

const { Title, Text } = Typography

interface OrdersReturnsTrendProps {
  data: DashboardOverview | undefined
  loading: boolean
}

const OrdersReturnsTrend = ({ data, loading }: OrdersReturnsTrendProps) => {
  if (!data?.ordersReturnsTrend) return null

  const chartData = data.ordersReturnsTrend

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  // Custom tooltip to show orders, returns, and return reasons
  const CustomTooltip = ({
    active,
    payload,
  }: {
    active?: boolean
    payload?: Array<{ payload: { date: string; orders: number; returns: number; returnReasons?: Record<string, number> } }>
  }) => {
    if (active && payload && payload.length) {
      const data = payload[0]?.payload as {
        date: string
        orders: number
        returns: number
        returnReasons?: Record<string, number>
      }
      const returnReasons = data.returnReasons || {}

      return (
        <div
          style={{
            background: 'white',
            border: '1px solid #d9d9d9',
            borderRadius: 4,
            padding: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            minWidth: 200,
          }}
        >
          <p style={{ margin: 0, marginBottom: 8, fontWeight: 600, fontSize: 14 }}>
            {formatDate(data.date)}
          </p>
          <div style={{ marginBottom: 8 }}>
            <p style={{ margin: 0, color: '#1890ff', fontSize: 13 }}>
              Orders: <strong>{data.orders}</strong>
            </p>
            <p style={{ margin: 0, color: '#ff4d4f', fontSize: 13 }}>
              Returns: <strong>{data.returns}</strong>
            </p>
          </div>
          {data.returns > 0 && Object.keys(returnReasons).length > 0 && (
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #f0f0f0' }}>
              <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                Return Reasons:
              </Text>
              {Object.entries(returnReasons).map(([reason, count]) => (
                <div
                  key={reason}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 11,
                    color: '#666',
                    marginBottom: 2,
                  }}
                >
                  <span>{reason}:</span>
                  <strong>{count}</strong>
                </div>
              ))}
            </div>
          )}
        </div>
      )
    }
    return null
  }

  // Calculate max value for same scale
  const maxValue = Math.max(
    ...chartData.map((d) => Math.max(d.orders, d.returns)),
    1, // At least 1 to avoid division by zero
  )
  const yAxisDomain = [0, Math.ceil(maxValue * 1.1)] // Add 10% padding at top

  return (
    <Card
      loading={loading}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: '#f0f7ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <SwapOutlined style={{ color: '#1890ff', fontSize: 18 }} />
          </div>
          <Title level={4} style={{ margin: 0, fontWeight: 600 }}>
            Orders vs Returns Trend
          </Title>
        </div>
      }
      style={{
        marginBottom: 24,
        borderRadius: 12,
        border: '1px solid #e8e8e8',
        boxShadow: 'none',
      }}
    >
      {chartData.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
          No data available for the last 30 days.
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                stroke="#666"
                style={{ fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis
                stroke="#666"
                style={{ fontSize: 12 }}
                domain={yAxisDomain}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ paddingTop: 20 }}
                iconType="line"
                formatter={(value) => (
                  <span style={{ fontSize: 12, color: '#666' }}>{value}</span>
                )}
              />
              <Line
                type="monotone"
                dataKey="orders"
                stroke="#1890ff"
                strokeWidth={2}
                dot={{ fill: '#1890ff', r: 3 }}
                activeDot={{ r: 5 }}
                name="Orders Placed"
              />
              <Line
                type="monotone"
                dataKey="returns"
                stroke="#ff4d4f"
                strokeWidth={2}
                dot={{ fill: '#ff4d4f', r: 3 }}
                activeDot={{ r: 5 }}
                name="Returns Initiated"
              />
            </LineChart>
          </ResponsiveContainer>
          <div style={{ marginTop: 12, textAlign: 'center' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Last 30 days • Hover to see return reason breakdown
            </Text>
          </div>
        </>
      )}
    </Card>
  )
}

export default OrdersReturnsTrend

