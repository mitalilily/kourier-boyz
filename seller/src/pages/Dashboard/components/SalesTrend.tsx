import { LineChartOutlined } from '@ant-design/icons'
import { Card, Segmented, Typography } from 'antd'
import { useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { DashboardOverview } from '../../../api/dashboard'

const { Title } = Typography

interface SalesTrendProps {
  data: DashboardOverview | undefined
  loading: boolean
}

const SalesTrend = ({ data, loading }: SalesTrendProps) => {
  const [period, setPeriod] = useState<'7days' | '30days'>('7days')

  if (!data?.salesTrend) return null

  const chartData = period === '7days' ? data.salesTrend.last7Days : data.salesTrend.last30Days

  // Format date for display (e.g., "Jan 15" or "15 Jan")
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  // Custom tooltip to show both sales and orders
  const CustomTooltip = ({
    active,
    payload,
  }: {
    active?: boolean
    payload?: Array<{ payload: { date: string; sales: number; orders: number } }>
  }) => {
    if (active && payload && payload.length) {
      const data = payload[0]?.payload as {
        date: string
        sales: number
        orders: number
      }
      return (
        <div
          style={{
            background: 'white',
            border: '1px solid rgba(0,0,0,0.1)',
            borderRadius: 12,
            padding: '12px 16px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            minWidth: 160,
          }}
        >
          <p style={{ margin: 0, marginBottom: 8, fontWeight: 600, fontSize: 13, color: '#333' }}>
            {formatDate(data.date)}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#1890ff' }} />
              <span style={{ fontSize: 12, color: '#666' }}>Sales:</span>
              <strong style={{ fontSize: 13, color: '#1890ff', marginLeft: 'auto' }}>
                ₹{data.sales.toLocaleString('en-IN')}
              </strong>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#52c41a' }} />
              <span style={{ fontSize: 12, color: '#666' }}>Orders:</span>
              <strong style={{ fontSize: 13, color: '#52c41a', marginLeft: 'auto' }}>
                {data.orders}
              </strong>
            </div>
          </div>
        </div>
      )
    }
    return null
  }

  const maxSales = Math.max(...chartData.map((d) => d.sales), 0)
  const yAxisDomain = [0, maxSales * 1.1] // Add 10% padding at top

  return (
    <Card
      loading={loading}
      title={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
              <LineChartOutlined style={{ color: '#1890ff', fontSize: 18 }} />
            </div>
            <Title level={4} style={{ margin: 0, fontWeight: 600 }}>
              Sales Trend
            </Title>
          </div>
          <Segmented
            options={[
              { label: '7 Days', value: '7days' },
              { label: '30 Days', value: '30days' },
            ]}
            value={period}
            onChange={(value) => setPeriod(value as '7days' | '30days')}
            size="small"
            style={{ background: '#f5f5f5' }}
          />
        </div>
      }
      style={{
        marginBottom: 24,
        borderRadius: 12,
        border: '1px solid #e8e8e8',
        boxShadow: 'none',
      }}
      bodyStyle={{ padding: '24px' }}
    >
      {chartData.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#999' }}>
          <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>📊</div>
          <div style={{ fontSize: 14 }}>No sales data available for the selected period.</div>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={chartData} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
            <defs>
              <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#1890ff" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#1890ff" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              stroke="#999"
              style={{ fontSize: 12, fontWeight: 500 }}
              angle={period === '30days' ? -45 : 0}
              textAnchor={period === '30days' ? 'end' : 'middle'}
              height={period === '30days' ? 60 : 30}
              tickLine={false}
            />
            <YAxis
              stroke="#999"
              style={{ fontSize: 12, fontWeight: 500 }}
              domain={yAxisDomain}
              tickFormatter={(value) => {
                if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`
                if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`
                return `₹${value}`
              }}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="sales"
              stroke="#1890ff"
              strokeWidth={3}
              dot={{ fill: '#1890ff', r: 5, strokeWidth: 2, stroke: 'white' }}
              activeDot={{ r: 7, strokeWidth: 2, stroke: 'white', fill: '#1890ff' }}
              name="Sales"
            />
          </LineChart>
        </ResponsiveContainer>
      )}
      <div style={{ marginTop: 16, textAlign: 'center' }}>
        <Typography.Text type="secondary" style={{ fontSize: 12, color: '#999' }}>
          💡 Hover over data points to see exact sales (₹) and orders count
        </Typography.Text>
      </div>
    </Card>
  )
}

export default SalesTrend

