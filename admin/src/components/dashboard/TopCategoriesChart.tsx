import { Card, Empty, Spin } from 'antd'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import type { TopCategory } from '../../api/dashboard'

interface TopCategoriesChartProps {
  data?: TopCategory[]
  loading?: boolean
}

const COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe']

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null

  const data = payload[0].payload
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
      <p className="font-medium text-gray-800 mb-1">{data.categoryName}</p>
      <p className="text-sm text-gray-600">
        Revenue: <span className="font-medium">₹{data.revenue.toLocaleString('en-IN')}</span>
      </p>
      <p className="text-sm text-gray-600">
        Items Sold: <span className="font-medium">{data.itemsSold}</span>
      </p>
    </div>
  )
}

const TopCategoriesChart = ({ data, loading }: TopCategoriesChartProps) => {
  const chartData = data?.map((item, index) => ({
    ...item,
    fill: COLORS[index % COLORS.length],
    // Truncate long category names
    displayName: item.categoryName.length > 15 
      ? `${item.categoryName.slice(0, 15)}...` 
      : item.categoryName,
  }))

  return (
    <Card title={<span className="text-lg font-semibold">Top Categories</span>} className="h-full">
      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <Spin size="large" />
        </div>
      ) : !chartData?.length ? (
        <div className="h-64 flex items-center justify-center">
          <Empty description="No category data available" />
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart
            data={chartData}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis
              dataKey="displayName"
              tick={{ fontSize: 11, fill: '#6b7280' }}
              tickLine={false}
              axisLine={{ stroke: '#e5e7eb' }}
              interval={0}
              angle={-20}
              textAnchor="end"
              height={60}
            />
            <YAxis
              tick={{ fontSize: 12, fill: '#6b7280' }}
              tickLine={false}
              axisLine={{ stroke: '#e5e7eb' }}
              tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}K`}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f3f4f6' }} />
            <Bar dataKey="revenue" radius={[4, 4, 0, 0]} barSize={40}>
              {chartData.map((entry, index) => (
                <rect key={`bar-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  )
}

export default TopCategoriesChart

