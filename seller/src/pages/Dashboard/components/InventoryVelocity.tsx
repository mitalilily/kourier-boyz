import { ThunderboltOutlined } from '@ant-design/icons'
import { Card, Empty, Typography } from 'antd'
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

const { Title, Text } = Typography

interface InventoryVelocityProps {
  data: DashboardOverview | undefined
  loading: boolean
}

const InventoryVelocity = ({ data, loading }: InventoryVelocityProps) => {
  if (!data?.inventoryVelocity || data.inventoryVelocity.length === 0) return null

  const velocityData = data.inventoryVelocity

  // Color palette for bars (green gradient for positive velocity)
  const colors = ['#52c41a', '#73d13d', '#95de64', '#b7eb8f', '#d9f7be']

  // Custom tooltip
  const CustomTooltip = ({
    active,
    payload,
  }: {
    active?: boolean
    payload?: Array<{ payload: { productName: string; sku: string; unitsPerDay: number; totalUnitsSold: number } }>
  }) => {
    if (active && payload && payload.length) {
      const data = payload[0]?.payload as {
        productName: string
        sku: string
        unitsPerDay: number
        totalUnitsSold: number
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
            {data.productName}
          </p>
          <p style={{ margin: 0, color: '#666', fontSize: 12 }}>
            SKU: <strong>{data.sku}</strong>
          </p>
          <p style={{ margin: 0, color: '#52c41a', fontSize: 12, marginTop: 4 }}>
            Units/Day: <strong>{data.unitsPerDay.toFixed(2)}</strong>
          </p>
          <p style={{ margin: 0, color: '#666', fontSize: 11, marginTop: 2 }}>
            Total (30 days): {data.totalUnitsSold} units
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
              background: '#f0f7ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ThunderboltOutlined style={{ color: '#1890ff', fontSize: 18 }} />
          </div>
          <Title level={4} style={{ margin: 0, fontWeight: 600 }}>
            Inventory Velocity
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
      {velocityData.length === 0 ? (
        <Empty
          description={
            <Text type="secondary">
              No sales data available. Start selling to see your fastest-moving products!
            </Text>
          }
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      ) : (
        <>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart
              data={velocityData}
              margin={{ top: 5, right: 30, bottom: 5, left: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="productName"
                stroke="#666"
                style={{ fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={80}
                tick={{ fontSize: 11 }}
                tickFormatter={(value) => {
                  // Truncate long product names
                  return value.length > 20 ? `${value.substring(0, 20)}...` : value
                }}
              />
              <YAxis
                stroke="#666"
                style={{ fontSize: 12 }}
                label={{ value: 'Units/Day', angle: -90, position: 'insideLeft', style: { fontSize: 12 } }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="unitsPerDay" radius={[4, 4, 0, 0]}>
                {velocityData.map((_entry, index) => (
                  <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div style={{ marginTop: 12, textAlign: 'center' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Top 5 fastest-selling products (last 30 days) • Helps restocking decisions • 
              Consider adding variants for popular products
            </Text>
          </div>
        </>
      )}
    </Card>
  )
}

export default InventoryVelocity

