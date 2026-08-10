import { Card, Empty, Spin } from 'antd'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import type { PaymentMethodItem } from '../../api/dashboard'

interface PaymentMethodChartProps {
  data?: PaymentMethodItem[]
  loading?: boolean
}

// Payment method colors
const METHOD_COLORS: Record<string, string> = {
  card: '#6366f1',
  upi: '#8b5cf6',
  cod: '#f59e0b',
  wallet: '#10b981',
}

// Readable labels
const METHOD_LABELS: Record<string, string> = {
  card: 'Card',
  upi: 'UPI',
  cod: 'Cash on Delivery',
  wallet: 'Wallet',
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null

  const data = payload[0].payload
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
      <p className="font-medium text-gray-800 mb-1">
        {METHOD_LABELS[data.method] || data.method}
      </p>
      <p className="text-sm text-gray-600">
        Orders: <span className="font-medium">{data.count}</span>
      </p>
      <p className="text-sm text-gray-600">
        Value: <span className="font-medium">₹{data.value.toLocaleString('en-IN')}</span>
      </p>
      <p className="text-sm text-gray-600">
        Share: <span className="font-medium">{data.percentage}%</span>
      </p>
    </div>
  )
}

const PaymentMethodChart = ({ data, loading }: PaymentMethodChartProps) => {
  const chartData = data?.map((item) => ({
    ...item,
    name: METHOD_LABELS[item.method] || item.method,
    color: METHOD_COLORS[item.method] || '#8884d8',
  }))

  return (
    <Card title={<span className="text-lg font-semibold">Payment Methods</span>} className="h-full">
      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <Spin size="large" />
        </div>
      ) : !chartData?.length ? (
        <div className="h-64 flex items-center justify-center">
          <Empty description="No payment data available" />
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fontSize: 12, fill: '#6b7280' }}
              tickLine={false}
              axisLine={{ stroke: '#e5e7eb' }}
              tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}K`}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 12, fill: '#6b7280' }}
              tickLine={false}
              axisLine={{ stroke: '#e5e7eb' }}
              width={100}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f3f4f6' }} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  )
}

export default PaymentMethodChart

