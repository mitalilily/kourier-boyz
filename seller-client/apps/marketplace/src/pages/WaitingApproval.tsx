import { ClockCircleOutlined, CloseCircleOutlined, MailOutlined, PhoneOutlined } from '@ant-design/icons'
import { Alert, Button, Card, Result, Space, Spin, Tag, Typography } from 'antd'
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProfileSync } from '../api/profileQueries'
import { useAuthStore } from '../store/authStore'

const { Title, Paragraph, Text } = Typography

const WaitingApproval = () => {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()

  // Poll API every 30 seconds to check for approval status updates
  const { data: latestProfile, isLoading } = useProfileSync()

  // If account has been approved, automatically send seller to dashboard
  useEffect(() => {
    const currentUser = latestProfile || user
    if (currentUser?.isApproved) {
      navigate('/dashboard', { replace: true })
    }
  }, [latestProfile, user, navigate])

  // Use latest profile data from API if available, otherwise fall back to auth store
  const currentUser = latestProfile || user

  if (!currentUser) {
    navigate('/login')
    return null
  }

  const isRejected = currentUser.rejectionReason

  // Show loading state while fetching initial profile
  if (isLoading && !user) {
    return (
      <div style={{ minHeight: '100vh', background: '#f0f2f5', padding: '48px 16px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <Spin size="large" />
      </div>
    )
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  if (isRejected) {
    return (
      <div style={{ minHeight: '100vh', background: '#f0f2f5', padding: '48px 16px' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <Card>
            <Result
              status="error"
              icon={<CloseCircleOutlined style={{ color: '#ff4d4f' }} />}
              title="KYC Application Rejected"
              subTitle="Unfortunately, your KYC application was not approved."
            />

            <Alert
              message="Reason for Rejection"
              description={currentUser.rejectionReason}
              type="error"
              showIcon
              style={{ marginBottom: 24 }}
            />

            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              <div>
                <Title level={4}>What can you do next?</Title>
                <ul style={{ paddingLeft: 20 }}>
                  <li>
                    <Text>Review the rejection reason above and correct any issues</Text>
                  </li>
                  <li>
                    <Text>Update your business information if needed</Text>
                  </li>
                  <li>
                    <Text>Contact support if you believe this was a mistake</Text>
                  </li>
                  <li>
                    <Text>Resubmit your application after making necessary changes</Text>
                  </li>
                </ul>
              </div>

              <Card style={{ background: '#fafafa' }}>
                <Title level={5}>Need Help?</Title>
                <Space direction="vertical">
                  <Text>
                    <MailOutlined /> Email: support@kourierboyz.com
                  </Text>
                  <Text>
                    <PhoneOutlined /> Phone: +91 1234567890
                  </Text>
                </Space>
              </Card>

              <Space>
                <Button type="primary" onClick={handleLogout}>
                  Logout
                </Button>
                <Button onClick={() => navigate('/submit-kyc')}>Update Profile</Button>
              </Space>
            </Space>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f0f2f5', padding: '48px 16px' }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <Card>
          <Result
            icon={<ClockCircleOutlined style={{ color: '#B78115' }} />}
            title="KYC Under Review"
            subTitle="Your application is being reviewed by our admin team"
          />

          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Alert
              message="Application Status"
              description={
                <Space direction="vertical" style={{ width: '100%' }}>
                  <div>
                    <Tag color="processing">Pending Approval</Tag>
                  </div>
                  <Text>
                    Your KYC application has been submitted and is currently under review. You will
                    receive an email notification once your application is reviewed. This page will
                    automatically refresh to show your approval status.
                  </Text>
                </Space>
              }
              type="info"
              showIcon
            />

            {!currentUser.isEmailVerified && (
              <Alert
                message="Email Verification Required"
                description={
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Text>
                      Please check your inbox and verify your email address. This is required for
                      account security and notifications.
                    </Text>
                    <Text type="secondary">
                      Check your spam folder if you don't see the verification email.
                    </Text>
                  </Space>
                }
                type="warning"
                showIcon
                icon={<MailOutlined />}
              />
            )}

            <Card style={{ background: '#f6ffed', borderColor: '#b7eb8f' }}>
              <Title level={5}>What happens next?</Title>
              <ul style={{ paddingLeft: 20, marginBottom: 0 }}>
                <li>
                  <Text>Our admin team will review your KYC details</Text>
                </li>
                <li>
                  <Text>This usually takes 24-48 hours</Text>
                </li>
                <li>
                  <Text>You'll receive an email with the decision</Text>
                </li>
                <li>
                  <Text>Once approved, you can access the full seller dashboard</Text>
                </li>
              </ul>
            </Card>

            <Card style={{ background: '#fafafa' }}>
              <Title level={5}>Your Submitted Information</Title>
              <Space direction="vertical" style={{ width: '100%' }}>
                <div>
                  <Text strong>Name:</Text> <Text>{currentUser.name}</Text>
                </div>
                <div>
                  <Text strong>Email:</Text> <Text>{currentUser.email}</Text>
                </div>
                <div>
                  <Text strong>Phone:</Text> <Text>{currentUser.phone || 'Not provided'}</Text>
                </div>
                <div>
                  <Text strong>Business Name:</Text>{' '}
                  <Text>{currentUser.businessName || 'Not provided'}</Text>
                </div>
                <div>
                  <Text strong>GST Number:</Text> <Text>{currentUser.gstNumber || 'Not provided'}</Text>
                </div>
              </Space>
            </Card>

            <Paragraph type="secondary" style={{ textAlign: 'center' }}>
              Please check your email regularly for updates. If you have any questions, feel free to
              contact our support team.
            </Paragraph>

            <div style={{ textAlign: 'center' }}>
              <Space>
                <Button onClick={() => navigate('/submit-kyc')}>Update Profile</Button>
                <Button type="primary" onClick={handleLogout}>
                  Logout
                </Button>
              </Space>
            </div>
          </Space>
        </Card>
      </div>
    </div>
  )
}

export default WaitingApproval
