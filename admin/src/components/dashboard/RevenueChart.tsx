import { Card, Empty, Segmented, Spin } from 'antd'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import type { RevenueChartData } from '../../api/dashboard'

interface RevenueChartProps {
  data?: RevenueChartData[]
  loading?: boolean
  granularity: 'daily' | 'weekly' | 'monthly'
  onGranularityChange: (value: 'daily' | 'weekly' | 'monthly') => void
}

const formatCurrency = (value: number) => {
  if (value >= 100000) {
    return `₹${(value / 100000).toFixed(1)}L`
  }
  if (value >= 1000) {
    return `₹${(value / 1000).toFixed(1)}K`
  }
  return `₹${value.toFixed(0)}`
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
      <p className="text-gray-600 text-sm font-medium mb-2">{label}</p>
      {payload.map((entry: any, index: number) => (
        <div key={index} className="flex items-center gap-2 text-sm">
          <span
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-gray-500">{entry.name}:</span>
          <span className="font-medium">
            {entry.name === 'Revenue' || 
             entry.name === 'Platform Revenue (After Settlement)' || 
             entry.name === 'AOV'
              ? `₹${entry.value.toLocaleString('en-IN')}`
              : entry.value}
          </span>
        </div>
      ))}
    </div>
  )
}

const RevenueChart = ({
  data,
  loading,
  granularity,
  onGranularityChange,
}: RevenueChartProps) => {
  return (
    <Card
      title={
        <div className="flex items-center justify-between flex-wrap gap-4">
          <span className="text-lg font-semibold">Platform Revenue Trend (After Settlement)</span>
          <Segmented
            size="small"
            value={granularity}
            onChange={(val) => onGranularityChange(val as 'daily' | 'weekly' | 'monthly')}
            options={[
              { label: 'Daily', value: 'daily' },
              { label: 'Weekly', value: 'weekly' },
              { label: 'Monthly', value: 'monthly' },
            ]}
          />
        </div>
      }
      className="h-full"
    >
      {loading ? (
        <div className="h-80 flex items-center justify-center">
          <Spin size="large" />
        </div>
      ) : !data?.length ? (
        <div className="h-80 flex items-center justify-center">
          <Empty description="No revenue data available" />
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={320}>
          <LineChart
            data={data}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12, fill: '#6b7280' }}
              tickLine={false}
              axisLine={{ stroke: '#e5e7eb' }}
            />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 12, fill: '#6b7280' }}
              tickLine={false}
              axisLine={{ stroke: '#e5e7eb' }}
              tickFormatter={formatCurrency}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 12, fill: '#6b7280' }}
              tickLine={false}
              axisLine={{ stroke: '#e5e7eb' }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ paddingTop: '20px' }}
              iconType="line"
              iconSize={12}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="revenue"
              name="Platform Revenue (After Settlement)"
              stroke="#6366f1"
              strokeWidth={3}
              dot={{ fill: '#6366f1', r: 4 }}
              activeDot={{ r: 6 }}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="orders"
              name="Orders"
              stroke="#10b981"
              strokeWidth={3}
              dot={{ fill: '#10b981', r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </Card>
  )
}

export default RevenueChart

