import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  ShoppingCartOutlined,
  SyncOutlined,
  TruckOutlined,
  UndoOutlined,
} from '@ant-design/icons'
import { Card, Col, Divider, Row, Statistic, Tooltip, Typography } from 'antd'
import { useNavigate } from 'react-router-dom'
import type { DashboardOverview } from '../../../api/dashboard'

const { Text } = Typography

interface OrdersReturnsOverviewProps {
  data: DashboardOverview | undefined
  loading: boolean
}

const OrdersReturnsOverview = ({ data, loading }: OrdersReturnsOverviewProps) => {
  const navigate = useNavigate()

  if (!data?.ordersOverview && !data?.returnsOverview) return null

  const ordersStats = [
    {
      key: 'pending',
      label: 'Pending',
      value: data?.ordersOverview?.pending || 0,
      color: '#DFB743',
      icon: <ClockCircleOutlined />,
      bgColor: '#fffce6',
      borderColor: '#ffeeb3',
      tooltip: 'Orders that are pending shipment - need to be packed and shipped',
      onClick: () => navigate('/orders?status=pending'),
    },
    {
      key: 'shipped',
      label: 'Shipped',
      value: data?.ordersOverview?.shipped || 0,
      color: '#B78115',
      icon: <TruckOutlined />,
      bgColor: '#F7F2E5',
      borderColor: '#D9DCDA',
      tooltip: 'Orders that have been shipped and are in transit',
      onClick: () => navigate('/orders?status=shipped'),
    },
    {
      key: 'delivered',
      label: 'Delivered',
      value: data?.ordersOverview?.delivered || 0,
      color: '#52c41a',
      icon: <CheckCircleOutlined />,
      bgColor: '#f6ffed',
      borderColor: '#d9f7be',
      tooltip: 'Orders that have been successfully delivered to customers',
      onClick: () => navigate('/orders?status=delivered'),
    },
    {
      key: 'returned',
      label: 'Returned',
      value: data?.ordersOverview?.returned || 0,
      color: '#ff4d4f',
      icon: <UndoOutlined />,
      bgColor: '#fff1f0',
      borderColor: '#ffccc7',
      tooltip: 'Orders that have been returned or cancelled',
      onClick: () => navigate('/orders?status=returned'),
    },
  ]

  const returnsStats = [
    {
      key: 'requested',
      label: 'Requested',
      value: data?.returnsOverview?.requested || 0,
      color: '#DFB743',
      icon: <ClockCircleOutlined />,
      bgColor: '#fffce6',
      borderColor: '#ffeeb3',
      tooltip: 'Return requests that are awaiting seller approval',
      onClick: () => navigate('/returns'),
    },
    {
      key: 'approved',
      label: 'Approved',
      value: data?.returnsOverview?.approved || 0,
      color: '#B78115',
      icon: <SyncOutlined />,
      bgColor: '#F7F2E5',
      borderColor: '#D9DCDA',
      tooltip: 'Returns that have been approved and are in process (pickup, transit, etc.)',
      onClick: () => navigate('/returns'),
    },
    {
      key: 'completed',
      label: 'Completed',
      value: data?.returnsOverview?.completed || 0,
      color: '#52c41a',
      icon: <CheckCircleOutlined />,
      bgColor: '#f6ffed',
      borderColor: '#d9f7be',
      tooltip: 'Returns that have been completed with refund processed',
      onClick: () => navigate('/returns'),
    },
  ]

  const StatCard = ({
    label,
    value,
    color,
    icon,
    bgColor,
    borderColor,
    tooltip,
    onClick,
  }: {
    label: string
    value: number
    color: string
    icon: React.ReactNode
    bgColor: string
    borderColor: string
    tooltip: string
    onClick: () => void
  }) => (
    <Tooltip title={tooltip}>
      <Card
        hoverable
        onClick={onClick}
        style={{
          background: bgColor,
          border: `1px solid ${borderColor}`,
          borderRadius: 12,
          cursor: 'pointer',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          height: '100%',
        }}
        bodyStyle={{ padding: '20px', textAlign: 'center' }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-4px)'
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'
          e.currentTarget.style.borderColor = color
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)'
          e.currentTarget.style.boxShadow = 'none'
          e.currentTarget.style.borderColor = borderColor
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 10,
            background: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 12px',
          }}
        >
          <div style={{ fontSize: 24, color }}>{icon}</div>
        </div>
        <Statistic
          value={value}
          valueStyle={{
            fontSize: 26,
            fontWeight: 700,
            color,
            marginBottom: 6,
            lineHeight: '32px',
          }}
        />
        <Text type="secondary" style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.3px' }}>
          {label}
        </Text>
      </Card>
    </Tooltip>
  )

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
            <ShoppingCartOutlined style={{ color: '#B78115', fontSize: 18 }} />
          </div>
          <span style={{ fontSize: 16, fontWeight: 600 }}>Orders & Returns Overview</span>
        </div>
      }
      style={{
        marginBottom: 0,
        borderRadius: 12,
        border: '1px solid #e8e8e8',
        boxShadow: 'none',
      }}
      bodyStyle={{ padding: '24px' }}
    >
      <Row gutter={[16, 16]}>
        {/* Orders Section */}
        <Col xs={24} md={12}>
          <div style={{ marginBottom: 8 }}>
            <Text strong style={{ fontSize: 14, color: '#B78115' }}>
              Orders
            </Text>
          </div>
          <Row gutter={[12, 12]}>
            {ordersStats.map((stat) => (
              <Col xs={12} key={stat.key}>
                <StatCard {...stat} />
              </Col>
            ))}
          </Row>
        </Col>

        {/* Divider */}
        <Col xs={0} md={0}>
          <Divider type="vertical" style={{ height: '100%', margin: 0 }} />
        </Col>

        {/* Returns Section */}
        <Col xs={24} md={12}>
          <div style={{ marginBottom: 8 }}>
            <Text strong style={{ fontSize: 14, color: '#ff4d4f' }}>
              Returns
            </Text>
          </div>
          <Row gutter={[12, 12]}>
            {returnsStats.map((stat) => (
              <Col xs={8} key={stat.key}>
                <StatCard {...stat} />
              </Col>
            ))}
            <Col xs={8}></Col>
          </Row>
        </Col>
      </Row>
    </Card>
  )
}

export default OrdersReturnsOverview

