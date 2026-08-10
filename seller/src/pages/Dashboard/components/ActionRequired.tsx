import {
  ExclamationCircleOutlined,
  InfoCircleOutlined,
  ShoppingCartOutlined,
  SyncOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { Badge, Card, Col, Row, Typography } from 'antd'
import { useNavigate } from 'react-router-dom'
import type { DashboardOverview } from '../../../api/dashboard'

const { Text } = Typography

interface ActionRequiredProps {
  data: DashboardOverview | undefined
  loading: boolean
}

const ActionRequired = ({ data, loading }: ActionRequiredProps) => {
  const navigate = useNavigate()

  if (!data?.actionRequired) return null

  const actions = data.actionRequired
  const alerts = [
    actions.pendingShipments > 0 && {
      title: 'Pending Shipments',
      description: 'Orders need to be packed and shipped',
      count: actions.pendingShipments,
      severity: 'error' as const,
      icon: <ShoppingCartOutlined />,
      onClick: () => navigate('/orders?status=pending'),
    },
    actions.returnsAwaitingAction > 0 && {
      title: 'Returns Awaiting Action',
      description: 'Return requests need your approval',
      count: actions.returnsAwaitingAction,
      severity: 'error' as const,
      icon: <SyncOutlined />,
      onClick: () => navigate('/returns'),
    },
    actions.slaRiskOrders > 0 && {
      title: 'SLA Risk Orders',
      description: 'Orders at risk of missing SLA deadline',
      count: actions.slaRiskOrders,
      severity: 'warning' as const,
      icon: <WarningOutlined />,
      onClick: () => navigate('/orders'),
    },
    actions.lowInventorySkus > 0 && {
      title: 'Low Inventory',
      description: 'Products running low on stock',
      count: actions.lowInventorySkus,
      severity: 'warning' as const,
      icon: <ExclamationCircleOutlined />,
      onClick: () => navigate('/products?lowStock=true'),
    },
    actions.kycBankIncomplete > 0 && {
      title: 'KYC / Bank Details',
      description: 'Complete KYC and bank details for settlements',
      count: actions.kycBankIncomplete,
      severity: 'info' as const,
      icon: <InfoCircleOutlined />,
      onClick: () => navigate('/profile'),
    },
  ].filter(Boolean) as Array<{
    title: string
    description: string
    count: number
    severity: 'error' | 'warning' | 'info'
    icon: React.ReactNode
    onClick: () => void
  }>

  if (alerts.length === 0) return null

  const getSeverityConfig = (severity: 'error' | 'warning' | 'info') => {
    switch (severity) {
      case 'error':
        return {
          color: '#ff4d4f',
          bgColor: '#fff1f0',
          borderColor: '#ffccc7',
          iconColor: '#ff4d4f',
        }
      case 'warning':
        return {
          color: '#ffdc3b',
          bgColor: '#fffce6',
          borderColor: '#ffeeb3',
          iconColor: '#ffdc3b',
        }
      case 'info':
        return {
          color: '#1890ff',
          bgColor: '#f0f7ff',
          borderColor: '#d4e9ff',
          iconColor: '#1890ff',
        }
    }
  }

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
              background: '#f0f7ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ExclamationCircleOutlined style={{ color: '#1890ff', fontSize: 18 }} />
          </div>
          <span style={{ fontSize: 16, fontWeight: 600 }}>Action Required</span>
        </div>
      }
      style={{
        marginBottom: 0,
        borderRadius: 12,
        border: '1px solid #e8e8e8',
        boxShadow: 'none',
      }}
      bodyStyle={{ padding: '20px' }}
    >
      <Row gutter={[12, 12]}>
        {alerts.map((alert, index) => {
          const config = getSeverityConfig(alert.severity)
          return (
            <Col xs={24} sm={12} lg={8} key={index}>
              <Card
                hoverable
                onClick={alert.onClick}
                style={{
                  background: config.bgColor,
                  border: `1px solid ${config.borderColor}`,
                  borderRadius: 12,
                  cursor: 'pointer',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  height: '100%',
                }}
                bodyStyle={{ padding: '20px' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)'
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'
                  e.currentTarget.style.borderColor = config.color
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = 'none'
                  e.currentTarget.style.borderColor = config.borderColor
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 10,
                      background: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <div style={{ fontSize: 22, color: config.iconColor }}>
                      {alert.icon}
                    </div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 8,
                      }}
                    >
                      <Text strong style={{ fontSize: 14, color: config.color, fontWeight: 600 }}>
                        {alert.title}
                      </Text>
                      <Badge
                        count={alert.count}
                        style={{
                          backgroundColor: config.color,
                          fontSize: 11,
                          minWidth: 24,
                          height: 24,
                          lineHeight: '24px',
                          fontWeight: 700,
                          boxShadow: `0 2px 6px ${config.color}40`,
                        }}
                      />
                    </div>
                    <Text type="secondary" style={{ fontSize: 12, display: 'block', lineHeight: '18px' }}>
                      {alert.description}
                    </Text>
                  </div>
                </div>
              </Card>
            </Col>
          )
        })}
      </Row>
    </Card>
  )
}

export default ActionRequired

