import { Button, Layout, Modal, Progress, Space, Typography } from 'antd'
import { useCallback, useEffect, useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import CourierSidebar from '../../../logistics/src/components/UI/Sidebar'
import { useProfileSync } from '../api/profileQueries'
import SellerOnboardingTutorial from '../components/SellerOnboardingTutorial'
import { useAuthStore } from '../store/authStore'
import { useSellerTourStore } from '../store/sellerTourStore'
import HeaderBar from './HeaderBar'

const { Content } = Layout
const { Text, Paragraph } = Typography

const SellerLayout = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 992)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)
  const runTour = useSellerTourStore((state) => state.runTour)
  const setRunTour = useSellerTourStore((state) => state.setRunTour)
  const handleTourComplete = useCallback(() => setRunTour(false), [setRunTour])

  useProfileSync()

  useEffect(() => {
    if (user?.role === 'seller' && user?.sellerLifecycleStatus === 'DEACTIVATED') {
      logout()
      navigate('/login', { replace: true })
    }
  }, [user?.sellerLifecycleStatus, user?.role, logout, navigate])

  const getAccountCompletionPercentage = () => {
    if (!user || user.role !== 'seller') return 100

    let completed = 0
    const total = 2

    if (user.isEmailVerified) completed++
    if (user.phone) completed++

    return Math.round((completed / total) * 100)
  }

  useEffect(() => {
    const percent = getAccountCompletionPercentage()
    setShowProfileModal(Boolean(user?.role === 'seller' && percent < 100))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 992)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return (
    <div className="kb-seller-shell">
      <CourierSidebar
        role="customer"
        pinned={false}
        externalNavigation
        marketplaceNavigation
      />

      <Layout className="site-layout kb-seller-workspace">
        {user?.role === 'seller' && (
          <SellerOnboardingTutorial run={runTour} onComplete={handleTourComplete} />
        )}
        <HeaderBar />
        {user?.isDemo && (
          <div className="kb-demo-workspace-notice">
            Demo workspace: explore the seller tools freely. Demo changes stay in this browser.
          </div>
        )}
        <Content className="kb-seller-content" style={{ margin: isMobile ? 8 : 16 }}>
          <div className="kb-seller-content-surface" style={{ padding: isMobile ? 16 : 24 }}>
            <Outlet />
          </div>
        </Content>
        <footer className="kb-seller-footer">Kourier Boyz Seller Hub (c) 2026</footer>
      </Layout>

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
            Complete your contact details here. Identity and business verification are managed once
            in your Kourier Boyz courier profile.
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
            {!user?.phone && <li>Add a valid phone number in your profile</li>}
          </ul>
        </Space>
      </Modal>
    </div>
  )
}

export default SellerLayout
