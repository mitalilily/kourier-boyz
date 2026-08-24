import { InfoCircleOutlined } from '@ant-design/icons'
import { Badge, Card, Col, Row, Tooltip } from 'antd'
import { useState } from 'react'
import type { DashboardOverview } from '../../../api/dashboard'

interface SellerPerformanceProps {
  data: DashboardOverview | undefined
  loading: boolean
}

const SellerPerformance = ({ data, loading }: SellerPerformanceProps) => {
  const [hoveredMetric, setHoveredMetric] = useState<string | null>(null)

  if (!data?.performance) return null

  const performance = data.performance

  const getStatusConfig = (status: 'good' | 'needs_attention' | 'at_risk') => {
    switch (status) {
      case 'good':
        return { color: '#52c41a', text: 'Good' }
      case 'needs_attention':
        return { color: '#DFB743', text: 'Needs Attention' }
      case 'at_risk':
        return { color: '#ff4d4f', text: 'At Risk' }
    }
  }

  const metrics = [
    {
      key: 'cancellationRate',
      label: 'Cancellation Rate',
      value: performance.cancellationRate.value,
      status: performance.cancellationRate.status,
      tooltip:
        'Thresholds: Good (<5%), Needs Attention (5-10%), At Risk (>10%). Percentage of orders cancelled out of total orders.',
    },
    {
      key: 'returnRate',
      label: 'Return Rate',
      value: performance.returnRate.value,
      status: performance.returnRate.status,
      tooltip:
        'Thresholds: Good (<10%), Needs Attention (10-20%), At Risk (>20%). Percentage of orders returned out of total orders.',
    },
    {
      key: 'slaCompliance',
      label: 'SLA Compliance',
      value: performance.slaCompliance.value,
      status: performance.slaCompliance.status,
      tooltip:
        'Thresholds: Good (≥95%), Needs Attention (85-95%), At Risk (<85%). Percentage of orders meeting SLA deadlines.',
    },
    {
      key: 'sellerRating',
      label: 'Seller Rating',
      value: performance.sellerRating.value,
      status: performance.sellerRating.status,
      tooltip:
        'Thresholds: Good (≥4.0), Needs Attention (3.0-4.0), At Risk (<3.0). Average rating from customer reviews (out of 5).',
    },
  ]

  return (
    <Card
      loading={loading}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: '#F7F2E5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <InfoCircleOutlined style={{ color: '#B78115', fontSize: 18 }} />
          </div>
          <span style={{ fontSize: 16, fontWeight: 600 }}>Seller Performance</span>
        </div>
      }
      style={{
        marginBottom: 24,
        borderRadius: 12,
        border: '1px solid #e8e8e8',
        boxShadow: 'none',
      }}
      bodyStyle={{ padding: '20px' }}
    >
      <Row gutter={[16, 16]}>
        {metrics.map((metric) => {
          const statusConfig = getStatusConfig(metric.status)
          const isHovered = hoveredMetric === metric.key

          const getBgColor = () => {
            switch (metric.status) {
              case 'good':
                return '#f6ffed'
              case 'needs_attention':
                return '#fffce6'
              case 'at_risk':
                return '#fff1f0'
            }
          }

          return (
            <Col xs={24} sm={12} lg={6} key={metric.key}>
              <div
                onMouseEnter={() => setHoveredMetric(metric.key)}
                onMouseLeave={() => setHoveredMetric(null)}
                style={{
                  padding: '20px',
                  border: `1px solid ${statusConfig.color}40`,
                  borderRadius: 12,
                  background: getBgColor(),
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  cursor: 'pointer',
                  boxShadow: isHovered ? '0 4px 12px rgba(0,0,0,0.08)' : 'none',
                  transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#333', flex: 1 }}>
                    {metric.label}
                  </span>
                  <Tooltip title={metric.tooltip}>
                    <InfoCircleOutlined style={{ color: '#999', fontSize: 13, cursor: 'help' }} />
                  </Tooltip>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Badge
                    status={metric.status === 'good' ? 'success' : metric.status === 'needs_attention' ? 'warning' : 'error'}
                    text={
                      <span style={{ fontSize: 15, fontWeight: 700, color: statusConfig.color }}>
                        {statusConfig.text}
                      </span>
                    }
                  />
                  <span
                    style={{
                      fontSize: 13,
                      color: statusConfig.color,
                      fontWeight: 600,
                      background: 'white',
                      padding: '4px 10px',
                      borderRadius: 6,
                    }}
                  >
                    {metric.key === 'sellerRating'
                      ? `${metric.value.toFixed(1)}/5`
                      : `${metric.value.toFixed(1)}%`}
                  </span>
                </div>
              </div>
            </Col>
          )
        })}
      </Row>
    </Card>
  )
}

export default SellerPerformance

