import {
  CalendarOutlined,
  DollarOutlined,
  FileTextOutlined,
  InfoCircleOutlined,
  ShoppingOutlined,
} from '@ant-design/icons'
import { Badge, Card, Col, Row, Tooltip } from 'antd'
import type { DashboardOverview } from '../../../api/dashboard'

interface KPICardsProps {
  data: DashboardOverview | undefined
  loading: boolean
}

const KPICards = ({ data, loading }: KPICardsProps) => {
  const cardConfigs = [
    {
      title: 'Available Balance',
      value: data?.availableBalance || 0,
      icon: DollarOutlined,
      accentColor: '#1353A4',
      valueColor: '#1353A4',
      tooltip:
        "Total earnings eligible for settlement. This includes all CREDIT entries that haven't been included in a settlement batch yet.",
      formatValue: (val: number) =>
        `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    },
    {
      title: 'Next Settlement',
      value: data?.nextSettlement?.amount || 0,
      icon: CalendarOutlined,
      accentColor: '#1353A4',
      valueColor: '#1353A4',
      tooltip:
        'Amount and expected date of your next scheduled settlement. Settlement may be blocked if KYC or bank details are incomplete.',
      formatValue: (val: number) =>
        val > 0
          ? `₹${val.toLocaleString('en-IN', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`
          : 'No pending settlement',
      extra: data?.nextSettlement
        ? {
            date: new Date(data.nextSettlement.expectedDate).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            }),
            status: data.nextSettlement.status,
          }
        : null,
    },
    {
      title: 'Gross Sales (This Month)',
      value: data?.grossSales || 0,
      icon: ShoppingOutlined,
      accentColor: '#1353A4',
      valueColor: '#1353A4',
      tooltip:
        'Total sales amount for the current month. This is the gross amount before commissions and charges.',
      formatValue: (val: number) =>
        `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    },
    {
      title: 'Orders (This Month)',
      value: data?.ordersCount || 0,
      icon: FileTextOutlined,
      accentColor: '#1353A4',
      valueColor: '#1353A4',
      tooltip: 'Total number of orders received in the current month.',
      formatValue: (val: number) => val.toLocaleString('en-IN'),
    },
  ]

  return (
    <Row gutter={[20, 20]} style={{ marginBottom: 24 }}>
      {cardConfigs.map((config, index) => {
        const Icon = config.icon
        return (
          <Col xs={24} sm={12} lg={6} key={index}>
            <Card
              loading={loading}
              bordered
              hoverable
              style={{
                borderRadius: 12,
                border: '1px solid #e8e8e8',
                background: 'white',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                overflow: 'hidden',
                position: 'relative',
              }}
              bodyStyle={{ padding: 24 }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)'
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'
                e.currentTarget.style.borderColor = config.accentColor
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = 'none'
                e.currentTarget.style.borderColor = '#e8e8e8'
              }}
            >
              {/* Subtle accent bar */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 3,
                  background: config.accentColor,
                }}
              />

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'start',
                  position: 'relative',
                  zIndex: 1,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <span
                      style={{
                        color: '#8c8c8c',
                        fontSize: 13,
                        fontWeight: 500,
                        letterSpacing: '0.3px',
                      }}
                    >
                      {config.title}
                    </span>
                    <Tooltip title={config.tooltip}>
                      <InfoCircleOutlined
                        style={{ color: '#bfbfbf', fontSize: 13, cursor: 'help' }}
                      />
                    </Tooltip>
                  </div>
                  <div
                    style={{
                      color: config.valueColor,
                      fontSize: 32,
                      fontWeight: 700,
                      lineHeight: '38px',
                      marginBottom: config.extra ? 8 : 0,
                    }}
                  >
                    {config.formatValue(config.value)}
                  </div>

                  {config.extra && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 6 }}>
                        {config.extra.date}
                      </div>
                      <Badge
                        status={config.extra.status === 'BLOCKED' ? 'error' : 'success'}
                        text={
                          <span style={{ fontSize: 12, fontWeight: 500 }}>
                            {config.extra.status === 'BLOCKED' ? 'BLOCKED' : 'SCHEDULED'}
                          </span>
                        }
                      />
                    </div>
                  )}
                </div>
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 10,
                    background: '#f0f7ff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Icon style={{ fontSize: 24, color: config.accentColor }} />
                </div>
              </div>
            </Card>
          </Col>
        )
      })}
    </Row>
  )
}

export default KPICards
