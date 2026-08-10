import { MessageOutlined, StarFilled } from '@ant-design/icons'
import { Card, Empty, Spin, Statistic } from 'antd'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useFeedback } from '../../api/feedback'

const RATING_COLORS = {
  5: '#10b981',
  4: '#52c41a',
  3: '#f59e0b',
  2: '#faad14',
  1: '#ef4444',
}

interface TooltipProps {
  active?: boolean
  payload?: Array<{
    payload: {
      rating: string
      count: number
      percentage: number
    }
  }>
}

const CustomTooltip = ({ active, payload }: TooltipProps) => {
  if (!active || !payload?.length) return null

  const data = payload[0].payload
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
      <p className="font-medium text-gray-800 mb-1">{data.rating} Star Rating</p>
      <p className="text-sm text-gray-600">
        Count: <span className="font-medium">{data.count}</span>
      </p>
      <p className="text-sm text-gray-600">
        Percentage: <span className="font-medium">{data.percentage.toFixed(1)}%</span>
      </p>
    </div>
  )
}

const FeedbackRatingChart = () => {
  const { data, isLoading } = useFeedback({
    limit: 1000, // Get more data for accurate stats
  })

  const chartData = useMemo(() => {
    if (!data?.stats?.ratingDistribution) return []

    const distribution = data.stats.ratingDistribution
    const total = data.stats.totalCount || 1

    return [5, 4, 3, 2, 1].map((rating) => {
      const count = distribution[rating as keyof typeof distribution] || 0
      return {
        rating: `${rating}★`,
        count,
        percentage: (count / total) * 100,
        color: RATING_COLORS[rating as keyof typeof RATING_COLORS],
      }
    })
  }, [data])

  return (
    <Card
      title={
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageOutlined />
            <span className="text-lg font-semibold">Platform Feedback</span>
          </div>
          <Link to="/feedback" className="text-sm text-blue-600 hover:text-blue-800">
            View Details →
          </Link>
        </div>
      }
      className="h-full"
    >
      {isLoading ? (
        <div className="h-64 flex items-center justify-center">
          <Spin size="large" />
        </div>
      ) : !chartData.length ? (
        <div className="h-64 flex items-center justify-center">
          <Empty description="No feedback data available" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-4">
            <Statistic
              title="Average Rating"
              value={data?.stats?.averageRating || '0.0'}
              prefix={<StarFilled style={{ color: '#f59e0b' }} />}
              suffix="/ 5.0"
              valueStyle={{ color: '#f59e0b', fontSize: 20 }}
            />
            <Statistic
              title="Total Feedback"
              value={data?.stats?.totalCount || 0}
              valueStyle={{ color: '#1890ff', fontSize: 20 }}
            />
            <Statistic
              title="Satisfaction"
              value={
                data?.stats?.totalCount
                  ? Math.round(
                      (((chartData[0]?.count || 0) + (chartData[1]?.count || 0)) /
                        data.stats.totalCount) *
                        100,
                    )
                  : 0
              }
              suffix="%"
              valueStyle={{ color: '#52c41a', fontSize: 20 }}
            />
          </div>

          {/* Rating Distribution Chart */}
          <div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="rating" tick={{ fontSize: 12 }} stroke="#666" />
                <YAxis tick={{ fontSize: 12 }} stroke="#666" />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Rating Breakdown */}
          <div className="grid grid-cols-5 gap-2 pt-2 border-t">
            {chartData.map((item) => (
              <div key={item.rating} className="text-center">
                <div className="text-xs text-gray-500 mb-1">{item.rating}</div>
                <div className="text-lg font-bold" style={{ color: item.color }}>
                  {item.count}
                </div>
                <div className="text-xs text-gray-400">{item.percentage.toFixed(0)}%</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}

export default FeedbackRatingChart
