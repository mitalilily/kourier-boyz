import { Button, Layout, Modal, Progress, Space, Typography } from 'antd'
import { useCallback, useEffect, useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { useProfileSync } from '../api/profileQueries'
import { useAuthStore } from '../store/authStore'
import { useSellerTourStore } from '../store/sellerTourStore'
import SellerOnboardingTutorial from '../components/SellerOnboardingTutorial'
import HeaderBar from './HeaderBar'
import Sidebar from './Sidebar'

const { Sider, Content } = Layout
const { Text, Paragraph } = Typography

const SellerLayout = () => {
  const [collapsed, setCollapsed] = useState(window.innerWidth < 992)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 992)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)
  const runTour = useSellerTourStore((state) => state.runTour)
  const setRunTour = useSellerTourStore((state) => state.setRunTour)
  const handleTourComplete = useCallback(() => setRunTour(false), [setRunTour])

  // Automatically sync profile data to detect approval status changes
  useProfileSync()

  // Check if account is deactivated and log out immediately
  useEffect(() => {
    if (user?.role === 'seller' && user?.sellerLifecycleStatus === 'DEACTIVATED') {
      logout()
      navigate('/login', { replace: true })
    }
  }, [user?.sellerLifecycleStatus, user?.role, logout, navigate])

  // Compute a simple account completion percentage for sellers
  const getAccountCompletionPercentage = () => {
    if (!user || user.role !== 'seller') return 100

    let completed = 0
    const total = 4

    if (user.isEmailVerified) completed++
    if (user.kycSubmitted) completed++
    if (user.isApproved) completed++
    if (user.phone) completed++

    return Math.round((completed / total) * 100)
  }

  // Show "complete profile" modal whenever a seller is logged in
  // and their account is not 100% complete.
  useEffect(() => {
    const percent = getAccountCompletionPercentage()
    if (user && user.role === 'seller' && percent < 100) {
      setShowProfileModal(true)
    } else {
      setShowProfileModal(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 992
      setIsMobile(mobile)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible={!isMobile}
        collapsed={collapsed}
        onCollapse={setCollapsed}
        width={260}
        collapsedWidth={0}
        trigger={null}
        breakpoint="lg"
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          boxShadow: 'none',
          borderRight: '1px solid #e8e8e8',
          zIndex: 100,
        }}
        theme="light"
      >
        <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      </Sider>

      {/* Mobile backdrop overlay */}
      {!collapsed && isMobile && (
        <div
          onClick={() => setCollapsed(true)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.45)',
            zIndex: 99,
          }}
        />
      )}

      <Layout
        style={{
          marginLeft: collapsed || isMobile ? 0 : 260,
          transition: 'all 0.2s',
        }}
        className="site-layout"
      >
        {user?.role === 'seller' && (
          <SellerOnboardingTutorial run={runTour} onComplete={handleTourComplete} />
        )}
        <HeaderBar collapsed={collapsed} setCollapsed={setCollapsed} />
        <Content
          style={{
            margin: isMobile ? '8px' : '16px',
            overflow: 'initial',
            minHeight: 'calc(100vh - 112px)',
          }}
        >
          <div
            style={{
              padding: isMobile ? '16px' : '24px',
              background: '#fff',
              borderRadius: 8,
              minHeight: 360,
            }}
          >
            <Outlet />
          </div>
        </Content>
        <div
          style={{
            textAlign: 'center',
            padding: isMobile ? '12px' : '16px',
            color: '#999',
            fontSize: isMobile ? 11 : 12,
          }}
        >
          Kourier Boyz Seller Hub ©2025
        </div>
      </Layout>

      {/* Global profile completion modal for sellers */}
      <Modal
        open={showProfileModal}
        closable
        maskClosable={false}
        onCancel={() => setShowProfileModal(false)}
        footer={[
          <Button key="later" onClick={() => setShowProfileModal(false)}>
            Maybe later
          </Button>,
          <Button
            key="complete"
            type="primary"
            onClick={() => {
              setShowProfileModal(false)
              navigate('/profile')
            }}
          >
            Go to Profile
          </Button>,
        ]}
        title="Complete your seller profile"
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Paragraph type="secondary">
            For the best experience and faster approvals, please complete your seller profile and
            KYC details.
          </Paragraph>
          <div>
            <Text strong>Profile completion</Text>
            <Progress
              percent={getAccountCompletionPercentage()}
              status={getAccountCompletionPercentage() === 100 ? 'success' : 'active'}
            />
          </div>
          <ul style={{ paddingLeft: 20, marginBottom: 0 }}>
            {!user?.isEmailVerified && <li>Verify your email address</li>}
            {!user?.kycSubmitted && <li>Submit your KYC information</li>}
            {user?.kycSubmitted && !user?.isApproved && <li>Wait for KYC approval by admin</li>}
            {!user?.phone && <li>Add a valid phone number in your profile</li>}
          </ul>
        </Space>
      </Modal>
    </Layout>
  )
}

export default SellerLayout
