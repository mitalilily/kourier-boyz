import {
  CustomerServiceOutlined,
  DollarOutlined,
  PlusOutlined,
  TruckOutlined,
} from '@ant-design/icons'
import { Button, Card, Col, Row } from 'antd'
import { useNavigate } from 'react-router-dom'

const QuickActions = () => {
  const navigate = useNavigate()

  const actions = [
    {
      label: 'Add Product',
      icon: <PlusOutlined />,
      onClick: () => navigate('/products/new'),
      type: 'primary' as const,
      color: '#DFB743',
    },
    {
      label: 'Ship Orders',
      icon: <TruckOutlined />,
      onClick: () => navigate('/orders?status=pending'),
      type: 'default' as const,
      color: '#B78115',
    },
    {
      label: 'View Settlements',
      icon: <DollarOutlined />,
      onClick: () => navigate('/settlements'),
      type: 'default' as const,
      color: '#B78115',
    },
    {
      label: 'Contact Support',
      icon: <CustomerServiceOutlined />,
      onClick: () => navigate('/tickets'),
      type: 'default' as const,
      color: '#B78115',
    },
  ]

  return (
    <Card
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: '#fffce6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <PlusOutlined style={{ color: '#DFB743', fontSize: 18 }} />
          </div>
          <span style={{ fontSize: 16, fontWeight: 600 }}>Quick Actions</span>
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
        {actions.map((action, index) => (
          <Col xs={24} sm={12} lg={6} key={index}>
            <Button
              type={action.type}
              icon={action.icon}
              onClick={action.onClick}
              block
              style={{
                height: '56px',
                fontSize: '15px',
                fontWeight: 500,
                borderRadius: 10,
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                ...(action.type === 'primary'
                  ? { background: action.color, borderColor: action.color }
                  : {
                      borderColor: action.color,
                      color: action.color,
                    }),
              }}
              size="large"
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = `0 4px 12px ${action.color}30`
                if (action.type === 'default') {
                  e.currentTarget.style.background = `${action.color}10`
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = 'none'
                if (action.type === 'default') {
                  e.currentTarget.style.background = 'transparent'
                }
              }}
            >
              {action.label}
            </Button>
          </Col>
        ))}
      </Row>
    </Card>
  )
}

export default QuickActions
