import { Card, Empty, Spin } from 'antd'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import type { ReturnReasonItem } from '../../api/dashboard'

interface ReturnReasonChartProps {
  data?: ReturnReasonItem[]
  loading?: boolean
}

const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6']

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null

  const item = payload[0].payload
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
      <p className="font-medium text-gray-800 mb-1">{item.reason}</p>
      <p className="text-sm text-gray-600">
        Returns:{' '}
        <span className="font-medium">
          {item.count} ({item.percentage}%)
        </span>
      </p>
      <p className="text-sm text-gray-600">
        Refund Amount:{' '}
        <span className="font-medium">₹{item.refundAmount.toLocaleString('en-IN')}</span>
      </p>
    </div>
  )
}

const ReturnReasonChart = ({ data, loading }: ReturnReasonChartProps) => {
  const chartData = data?.map((item, index) => ({
    ...item,
    fill: COLORS[index % COLORS.length],
  }))

  return (
    <Card
      title={<span className="text-lg font-semibold">Return Reasons</span>}
      className="h-full"
      extra={<span className="text-xs text-gray-400">Top reasons customers return orders</span>}
    >
      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <Spin size="large" />
        </div>
      ) : !chartData?.length ? (
        <div className="h-64 flex items-center justify-center">
          <Empty description="No return data available" />
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={chartData}
              dataKey="count"
              nameKey="reason"
              cx="50%"
              cy="50%"
              outerRadius={90}
              label={({ name, percent }) =>
                `${name ?? ''} (${percent !== undefined ? (percent * 100).toFixed(1) : '0.0'}%)`
              }
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend verticalAlign="bottom" height={36} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </Card>
  )
}

export default ReturnReasonChart


