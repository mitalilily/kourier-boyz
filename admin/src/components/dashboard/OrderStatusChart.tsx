import { Card, Empty, Spin } from 'antd'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'
import type { OrderStatusItem } from '../../api/dashboard'

interface OrderStatusChartProps {
  data?: OrderStatusItem[]
  loading?: boolean
}

// Status colors matching the order flow
const STATUS_COLORS: Record<string, string> = {
  pending: '#faad14',
  confirmed: '#1890ff',
  processing: '#722ed1',
  ready_to_ship: '#13c2c2',
  shipped: '#2f54eb',
  in_transit: '#1890ff',
  out_for_delivery: '#52c41a',
  delivered: '#52c41a',
  cancelled: '#ff4d4f',
  refunded: '#ff7875',
}

// Readable status labels
const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  processing: 'Processing',
  ready_to_ship: 'Ready to Ship',
  shipped: 'Shipped',
  in_transit: 'In Transit',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null

  const data = payload[0].payload
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
      <p className="font-medium text-gray-800 mb-1">
        {STATUS_LABELS[data.status] || data.status}
      </p>
      <p className="text-sm text-gray-600">
        Orders: <span className="font-medium">{data.count}</span>
      </p>
      <p className="text-sm text-gray-600">
        Value: <span className="font-medium">₹{data.value.toLocaleString('en-IN')}</span>
      </p>
    </div>
  )
}

const renderCustomLabel = ({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
}: any) => {
  if (percent < 0.05) return null // Don't show label for small slices
  
  const RADIAN = Math.PI / 180
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)

  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={12}
      fontWeight={600}
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  )
}

const OrderStatusChart = ({ data, loading }: OrderStatusChartProps) => {
  const chartData = data?.map((item) => ({
    ...item,
    name: STATUS_LABELS[item.status] || item.status,
    color: STATUS_COLORS[item.status] || '#8884d8',
  }))

  return (
    <Card title={<span className="text-lg font-semibold">Order Status Distribution</span>} className="h-full">
      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <Spin size="large" />
        </div>
      ) : !chartData?.length ? (
        <div className="h-64 flex items-center justify-center">
          <Empty description="No order data available" />
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={renderCustomLabel}
              outerRadius={90}
              innerRadius={45}
              dataKey="count"
              paddingAngle={2}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend
              layout="horizontal"
              verticalAlign="bottom"
              align="center"
              iconType="circle"
              iconSize={8}
              formatter={(value) => (
                <span className="text-xs text-gray-600">{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      )}
    </Card>
  )
}

export default OrderStatusChart

