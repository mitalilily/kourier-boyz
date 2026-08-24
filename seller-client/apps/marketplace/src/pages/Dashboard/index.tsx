import {
  ClockCircleOutlined,
  FileTextOutlined,
  MailOutlined,
  PlusOutlined,
  ReloadOutlined,
  ShoppingCartOutlined,
  TruckOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Alert, App, Button, Card, Col, Row, Space, Typography } from 'antd'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import API from '../../api/axiosInstance'
import { useProfile } from '../../api/profileQueries'
import { useAuthStore } from '../../store/authStore'
import { useSellerTourStore } from '../../store/sellerTourStore'
import ActionRequired from './components/ActionRequired'
import InventoryVelocity from './components/InventoryVelocity'
import KPICards from './components/KPICards'
import OrdersReturnsOverview from './components/OrdersReturnsOverview'
import OrdersReturnsTrend from './components/OrdersReturnsTrend'
import QuickActions from './components/QuickActions'
import RecentOrders from './components/RecentOrders'
import ReturnReasonsBreakdown from './components/ReturnReasonsBreakdown'
import SalesTrend from './components/SalesTrend'
import SellerPerformance from './components/SellerPerformance'
import SettlementBlockedAlert from './components/SettlementBlockedAlert'
import SettlementSnapshot from './components/SettlementSnapshot'
import TopSellingProducts from './components/TopSellingProducts'
import { useDashboardOverview } from './hooks/useDashboardOverview'

const { Title, Paragraph } = Typography

interface Stats {
  totalProducts: number
  activeProducts: number
  draftProducts: number
  lowStockProducts: number
  totalSales: number
  totalOrders: number
  totalViews: number
}

const Dashboard = () => {
  const navigate = useNavigate()
  const { message } = App.useApp()
  const user = useAuthStore((state) => state.user)
  const setUser = useAuthStore((state) => state.setUser)
  const [refreshing, setRefreshing] = useState(false)
  const setRunTour = useSellerTourStore((state) => state.setRunTour)
  const { data: profileData, isLoading: profileLoading, refetch: refetchProfile } = useProfile()

  // Auto-show platform tour only once for new onboarded (approved) sellers; backend is source of truth
  useEffect(() => {
    if (
      user?.isApproved &&
      !profileLoading &&
      profileData &&
      !profileData.onboardingTourCompletedAt
    ) {
      setRunTour(true)
    }
  }, [user?.isApproved, profileLoading, profileData, setRunTour])

  // Fetch dashboard overview (KPI data) - using custom hook with proper caching
  const { data: dashboardOverview, isLoading: overviewLoading } = useDashboardOverview()

  // Fetch stats using React Query - with proper caching
  const { data: stats, isLoading: statsLoading } = useQuery<Stats>({
    queryKey: ['dashboardStats'],
    queryFn: async () => {
      const response = await API.get('/products/stats')
      return response.data
    },
    staleTime: 30000, // Consider data fresh for 30 seconds
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
  })

  const handleRefreshStatus = async () => {
    setRefreshing(true)
    try {
      const { data } = await refetchProfile()
      if (data) {
        setUser(data)
        if (data.isApproved) {
          message.success('🎉 Congratulations! Your account has been approved!')
        } else {
          message.info("Your approval is still pending. We'll notify you once it's approved.")
        }
      }
    } catch {
      message.error('Failed to refresh status')
    } finally {
      setRefreshing(false)
    }
  }

  const statsCards = [
    {
      title: 'Total Products',
      value: stats?.totalProducts || 0,
      icon: <FileTextOutlined />,
      color: '#B78115',
      onClick: () => navigate('/products'),
    },
    {
      title: 'Active Products',
      value: stats?.activeProducts || 0,
      icon: <FileTextOutlined />,
      color: '#DFB743',
      onClick: () => navigate('/products?status=active'),
    },
    {
      title: 'Total Sales',
      value: stats?.totalSales || 0,
      icon: <FileTextOutlined />,
      color: '#B78115',
    },
    {
      title: 'Total Views',
      value: stats?.totalViews || 0,
      icon: <FileTextOutlined />,
      color: '#DFB743',
    },
  ]

  return (
    <div>
      {/* Welcome Section - used as first step target for onboarding tour */}
      <div data-tour="dashboard-welcome" style={{ marginBottom: 32 }}>
        <Title level={2} style={{ marginBottom: 12, fontWeight: 700, fontSize: 28 }}>
          Welcome back, {user?.name}! 👋
        </Title>
        <Paragraph style={{ fontSize: 15, color: '#666', marginBottom: 0, fontWeight: 400 }}>
          Here's what's happening with your store today.
          {user?.isApproved && (
            <>
              {' '}
              <Button type="link" size="small" style={{ padding: 0, height: 'auto', fontWeight: 500 }} onClick={() => setRunTour(true)}>
                Take a platform tour
              </Button>
            </>
          )}
        </Paragraph>
      </div>

      {/* KYC Status Alerts */}
      {!user?.kycSubmitted && (
        <Alert
          message="Complete Your KYC to Start Selling"
          description={
            <div>
              <Paragraph style={{ marginBottom: 8 }}>
                Your account is incomplete. Please submit your KYC documents to get verified and
                start listing products on Kourier Boyz.
              </Paragraph>
              <Button
                type="primary"
                icon={<FileTextOutlined />}
                onClick={() => navigate('/submit-kyc')}
              >
                Submit KYC Now
              </Button>
            </div>
          }
          type="warning"
          showIcon
          icon={<WarningOutlined />}
          closable
          style={{ marginBottom: 24 }}
        />
      )}

      {user?.kycSubmitted && !user?.isApproved && (
        <Alert
          message="KYC Under Review"
          description={
            <div>
              <Paragraph style={{ marginBottom: 8 }}>
                Your KYC documents have been submitted and are currently under review by our admin
                team. You'll receive an email notification once your account is approved.
              </Paragraph>
              <Space>
                <Button
                  type="primary"
                  icon={<ReloadOutlined />}
                  onClick={handleRefreshStatus}
                  loading={refreshing}
                >
                  Check Status Now
                </Button>
                <Button type="default" onClick={() => navigate('/profile')}>
                  View KYC Details
                </Button>
              </Space>
            </div>
          }
          type="info"
          showIcon
          icon={<ClockCircleOutlined />}
          style={{ marginBottom: 24 }}
        />
      )}

      {user?.rejectionReason && (
        <Alert
          message="KYC Rejected - Action Required"
          description={
            <div>
              <Paragraph style={{ marginBottom: 8 }}>
                <strong>Reason:</strong> {user.rejectionReason}
              </Paragraph>
              <Space>
                <Button type="primary" danger onClick={() => navigate('/submit-kyc')}>
                  Resubmit KYC
                </Button>
                <Button type="default" onClick={() => navigate('/profile')}>
                  View Details
                </Button>
              </Space>
            </div>
          }
          type="error"
          showIcon
          icon={<WarningOutlined />}
          closable
          style={{ marginBottom: 24 }}
        />
      )}

      {/* New orders alert - prominent at top when seller has pending orders */}
      {user?.isApproved &&
        (dashboardOverview?.data?.actionRequired?.pendingShipments ?? dashboardOverview?.data?.ordersOverview?.pending ?? 0) > 0 && (
          <Alert
            message={
              <span style={{ fontWeight: 600, fontSize: 15 }}>
                You&apos;ve received{' '}
                <strong>
                  {dashboardOverview?.data?.actionRequired?.pendingShipments ??
                    dashboardOverview?.data?.ordersOverview?.pending ??
                    0}
                </strong>{' '}
                new order(s)
              </span>
            }
            description="Process them at earliest to maintain good delivery performance and customer satisfaction."
            type="info"
            showIcon
            icon={<ShoppingCartOutlined />}
            action={
              <Button type="primary" size="middle" onClick={() => navigate('/orders?status=pending')}>
                View & Process Orders
              </Button>
            }
            style={{ marginBottom: 24 }}
          />
        )}

      {/* Quick Setup Cards */}
      {user?.isApproved && (
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          {(!profileData?.pickupAddresses ||
            !Array.isArray(profileData.pickupAddresses) ||
            profileData.pickupAddresses.length === 0) && (
            <Col xs={24} md={12}>
              <Card
                hoverable
                style={{
                  borderRadius: 12,
                  border: '1px solid #e8e8e8',
                  background: '#fff',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
                bodyStyle={{ padding: '20px 24px' }}
                onClick={() => navigate('/store-settings?tab=shipping')}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)'
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'
                  e.currentTarget.style.borderColor = '#B78115'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = 'none'
                  e.currentTarget.style.borderColor = '#e8e8e8'
                }}
              >
                <Space size="middle" style={{ width: '100%' }}>
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 10,
                      background: '#F7F2E5',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <TruckOutlined style={{ fontSize: 20, color: '#B78115' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{ fontWeight: 600, fontSize: 15, marginBottom: 4, color: '#262626' }}
                    >
                      Add Pickup Address
                    </div>
                    <div style={{ fontSize: 13, color: '#8c8c8c' }}>
                      Required for order fulfillment
                    </div>
                  </div>
                  <PlusOutlined style={{ color: '#8c8c8c', fontSize: 18 }} />
                </Space>
              </Card>
            </Col>
          )}

          {(!profileData?.storeEmail ||
            (profileData.storeEmail as string).trim().length === 0 ||
            !profileData?.storePhone ||
            (profileData.storePhone as string).trim().length === 0 ||
            !profileData?.supportEmail ||
            (profileData.supportEmail as string).trim().length === 0) && (
            <Col xs={24} md={12}>
              <Card
                hoverable
                style={{
                  borderRadius: 12,
                  border: '1px solid #e8e8e8',
                  background: '#fff',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
                bodyStyle={{ padding: '20px 24px' }}
                onClick={() => navigate('/store-settings?tab=contact')}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)'
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'
                  e.currentTarget.style.borderColor = '#B78115'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = 'none'
                  e.currentTarget.style.borderColor = '#e8e8e8'
                }}
              >
                <Space size="middle" style={{ width: '100%' }}>
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 10,
                      background: '#F7F2E5',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <MailOutlined style={{ fontSize: 20, color: '#B78115' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{ fontWeight: 600, fontSize: 15, marginBottom: 4, color: '#262626' }}
                    >
                      Add Contact Information
                    </div>
                    <div style={{ fontSize: 13, color: '#8c8c8c' }}>
                      Required to publish products
                    </div>
                  </div>
                  <PlusOutlined style={{ color: '#8c8c8c', fontSize: 18 }} />
                </Space>
              </Card>
            </Col>
          )}
        </Row>
      )}

      {/* Quick Actions - Immediate actions at the top */}
      {user?.isApproved && <QuickActions />}

      {/* Recent Orders - So seller sees new orders as soon as they land on dashboard */}
      {user?.isApproved && (
        <div style={{ marginBottom: 24 }}>
          <RecentOrders />
        </div>
      )}

      {/* Settlement Blocked Alert - Critical financial info */}
      {user?.isApproved && <SettlementBlockedAlert data={dashboardOverview?.data} />}

      {/* KPI Cards - Key metrics at a glance */}
      {user?.kycSubmitted && <KPICards data={dashboardOverview?.data} loading={overviewLoading} />}

      {/* Row 1: Primary Graph and Financial Status */}
      {user?.kycSubmitted && (
        <Row gutter={[20, 20]} style={{ marginBottom: 28 }}>
          <Col xs={24} lg={10}>
            {/* Sales Trend Graph - Primary visualization (momentum) */}
            <SalesTrend data={dashboardOverview?.data} loading={overviewLoading} />
          </Col>
          <Col xs={24} lg={14}>
            {/* Settlement Snapshot - Financial status */}
            <SettlementSnapshot data={dashboardOverview?.data} loading={overviewLoading} />
          </Col>
        </Row>
      )}

      {/* Row 2: Action Items and Performance */}
      {user?.kycSubmitted && (
        <Row gutter={[20, 20]} style={{ marginBottom: 28 }}>
          <Col xs={24} lg={24}>
            {/* Action Required - Urgent items needing attention */}
            <ActionRequired data={dashboardOverview?.data} loading={overviewLoading} />
          </Col>
          <Col xs={24} lg={24}>
            {/* Seller Performance - Performance metrics */}
            <SellerPerformance data={dashboardOverview?.data} loading={overviewLoading} />
          </Col>
        </Row>
      )}

      {/* Row 3: Positive Reinforcement and Summary */}
      {user?.kycSubmitted && (
        <Row gutter={[20, 20]} style={{ marginBottom: 28 }}>
          <Col xs={24} lg={24}>
            {/* Top Selling Products - Positive reinforcement */}
            {user?.isApproved && (
              <TopSellingProducts data={dashboardOverview?.data} loading={overviewLoading} />
            )}
          </Col>
          <Col xs={24} lg={24}>
            {/* Orders & Returns Overview - Summary stats */}
            <OrdersReturnsOverview data={dashboardOverview?.data} loading={overviewLoading} />
          </Col>
        </Row>
      )}

      {/* Row 4: Analysis Graphs */}
      {user?.kycSubmitted && (
        <Row gutter={[20, 20]} style={{ marginBottom: 28 }}>
          <Col xs={24} lg={12}>
            {/* Orders vs Returns Trend - Secondary graph (correlation analysis) */}
            <OrdersReturnsTrend data={dashboardOverview?.data} loading={overviewLoading} />
          </Col>
          <Col xs={24} lg={12}>
            {/* Return Reasons Breakdown - Detailed analysis */}
            <ReturnReasonsBreakdown data={dashboardOverview?.data} loading={overviewLoading} />
          </Col>
        </Row>
      )}

      {/* Row 5: Operational Insights */}
      {user?.kycSubmitted && (
        <Row gutter={[20, 20]} style={{ marginBottom: 28 }}>
          <Col xs={24}>
            {/* Inventory Velocity - Operational insights */}
            <InventoryVelocity data={dashboardOverview?.data} loading={overviewLoading} />
          </Col>
        </Row>
      )}

      {/* Main Stats Cards */}
      <Row gutter={[20, 20]} style={{ marginBottom: 24 }}>
        {statsCards.map((stat, index) => (
          <Col xs={24} sm={12} lg={6} key={index}>
            <Card
              loading={statsLoading}
              bordered
              hoverable={!!stat.onClick}
              onClick={stat.onClick}
              style={{
                background: '#fff',
                borderRadius: 12,
                border: '1px solid #e8e8e8',
                cursor: stat.onClick ? 'pointer' : 'default',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                overflow: 'hidden',
                position: 'relative',
              }}
              bodyStyle={{ padding: 24 }}
              onMouseEnter={(e) => {
                if (stat.onClick) {
                  e.currentTarget.style.transform = 'translateY(-4px)'
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'
                  e.currentTarget.style.borderColor = stat.color
                }
              }}
              onMouseLeave={(e) => {
                if (stat.onClick) {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = 'none'
                  e.currentTarget.style.borderColor = '#e8e8e8'
                }
              }}
            >
              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}
              >
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      color: '#8c8c8c',
                      fontSize: 13,
                      marginBottom: 10,
                      fontWeight: 500,
                      letterSpacing: '0.3px',
                    }}
                  >
                    {stat.title}
                  </div>
                  <div
                    style={{ color: '#262626', fontSize: 32, fontWeight: 700, lineHeight: '38px' }}
                  >
                    {stat.value.toLocaleString()}
                  </div>
                </div>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 10,
                    background: '#F7F2E5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <div style={{ fontSize: 24, color: stat.color }}>{stat.icon}</div>
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  )
}

export default Dashboard
