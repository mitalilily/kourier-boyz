import { BarChartOutlined } from '@ant-design/icons'
import { Card, Typography } from 'antd'
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
import type { DashboardOverview } from '../../../api/dashboard'

const { Title } = Typography

interface ReturnReasonsBreakdownProps {
  data: DashboardOverview | undefined
  loading: boolean
}

const ReturnReasonsBreakdown = ({ data, loading }: ReturnReasonsBreakdownProps) => {
  if (!data?.returnReasonsBreakdown) return null

  const breakdown = data.returnReasonsBreakdown.breakdown

  // Color palette for bars - using subtle red tones
  const colors = ['#ff4d4f', '#ff7875', '#ffa39e', '#ffccc7', '#ffe7e6']

  // Custom tooltip
  const CustomTooltip = ({
    active,
    payload,
  }: {
    active?: boolean
    payload?: Array<{ payload: { reason: string; count: number; percentage: number } }>
  }) => {
    if (active && payload && payload.length) {
      const data = payload[0]?.payload as {
        reason: string
        count: number
        percentage: number
      }
      return (
        <div
          style={{
            background: 'white',
            border: '1px solid #d9d9d9',
            borderRadius: 4,
            padding: '8px 12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          }}
        >
          <p style={{ margin: 0, marginBottom: 4, fontWeight: 600, fontSize: 13 }}>
            {data.reason}
          </p>
          <p style={{ margin: 0, color: '#666', fontSize: 12 }}>
            Count: <strong>{data.count}</strong>
          </p>
          <p style={{ margin: 0, color: '#666', fontSize: 12 }}>
            Percentage: <strong>{data.percentage.toFixed(1)}%</strong>
          </p>
        </div>
      )
    }
    return null
  }

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
              background: '#F7F2E5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <BarChartOutlined style={{ color: '#B78115', fontSize: 18 }} />
          </div>
          <Title level={4} style={{ margin: 0, fontWeight: 600 }}>
            Return Reasons Breakdown
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
      {breakdown.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
          No return reasons data available.
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart
              data={breakdown}
              layout="vertical"
              margin={{ top: 5, right: 30, bottom: 5, left: 100 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" stroke="#666" style={{ fontSize: 12 }} />
              <YAxis
                type="category"
                dataKey="reason"
                stroke="#666"
                style={{ fontSize: 12 }}
                width={90}
                tick={{ fontSize: 11 }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {breakdown.map((_entry, index) => (
                  <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div style={{ marginTop: 12, textAlign: 'center' }}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Top 5 return reasons • Total returns: {data.returnReasonsBreakdown.totalReturns} • 
              Actionable insights to improve product listings
            </Typography.Text>
          </div>
        </>
      )}
    </Card>
  )
}

export default ReturnReasonsBreakdown

