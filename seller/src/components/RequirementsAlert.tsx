import {
  ExclamationCircleOutlined,
  MailOutlined,
  SettingOutlined,
  ShopOutlined,
} from '@ant-design/icons'
import { Alert, Button, List, Space, Typography } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useProfile } from '../api/profileQueries'
import { useAuthStore } from '../store/authStore'

const { Title, Text, Paragraph } = Typography

interface MissingRequirement {
  field: string
  label: string
  section: string
  path: string
}

const RequirementsAlert = () => {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const { data: profileData } = useProfile()

  if (!user || user.role !== 'seller') return null

  const missingRequirements: MissingRequirement[] = []

  // Check KYC
  if (!user.kycSubmitted) {
    missingRequirements.push({
      field: 'kyc',
      label: 'KYC Submission',
      section: 'Verification',
      path: '/submit-kyc',
    })
  }

  // If KYC is submitted but not approved, don't show other requirements as blockers
  if (!user.isApproved && user.kycSubmitted) {
    return null // KYC approval is the main blocker
  }

  // If not approved, don't check other requirements
  if (!user.isApproved) {
    return null
  }

  // Check Store Information
  if (
    !profileData?.storeDescription ||
    (profileData.storeDescription as string).trim().length === 0
  ) {
    missingRequirements.push({
      field: 'storeDescription',
      label: 'Store Description',
      section: 'Store Settings',
      path: '/store-settings?tab=general',
    })
  }

  if (!profileData?.storeLogo) {
    missingRequirements.push({
      field: 'storeLogo',
      label: 'Store Logo',
      section: 'Store Settings',
      path: '/store-settings?tab=general',
    })
  }

  if (!profileData?.shippingPolicy || (profileData.shippingPolicy as string).trim().length === 0) {
    missingRequirements.push({
      field: 'shippingPolicy',
      label: 'Shipping Policy',
      section: 'Store Settings',
      path: '/store-settings?tab=policies',
    })
  }

  if (!profileData?.returnPolicy || (profileData.returnPolicy as string).trim().length === 0) {
    missingRequirements.push({
      field: 'returnPolicy',
      label: 'Return Policy',
      section: 'Store Settings',
      path: '/store-settings?tab=policies',
    })
  }

  // Check Contact Information
  if (!profileData?.storeEmail || (profileData.storeEmail as string).trim().length === 0) {
    missingRequirements.push({
      field: 'storeEmail',
      label: 'Store Email',
      section: 'Contact Information',
      path: '/store-settings?tab=contact',
    })
  }

  if (!profileData?.storePhone || (profileData.storePhone as string).trim().length === 0) {
    missingRequirements.push({
      field: 'storePhone',
      label: 'Store Phone',
      section: 'Contact Information',
      path: '/store-settings?tab=contact',
    })
  }

  if (!profileData?.supportEmail || (profileData.supportEmail as string).trim().length === 0) {
    missingRequirements.push({
      field: 'supportEmail',
      label: 'Support Email',
      section: 'Contact Information',
      path: '/store-settings?tab=contact',
    })
  }

  // Check Compliance Agreements
  if (!profileData?.sellerAgreementSigned) {
    missingRequirements.push({
      field: 'sellerAgreementSigned',
      label: 'Seller Agreement Signature',
      section: 'Compliance',
      path: '/store-settings?tab=compliance',
    })
  }

  if (!profileData?.returnRefundPolicyAccepted) {
    missingRequirements.push({
      field: 'returnRefundPolicyAccepted',
      label: 'Return & Refund Policy Acceptance',
      section: 'Compliance',
      path: '/store-settings?tab=compliance',
    })
  }

  if (missingRequirements.length === 0) {
    return null
  }

  // Group by section
  const groupedBySection = missingRequirements.reduce((acc, req) => {
    if (!acc[req.section]) {
      acc[req.section] = []
    }
    acc[req.section].push(req)
    return acc
  }, {} as Record<string, MissingRequirement[]>)

  const getSectionIcon = (section: string) => {
    switch (section) {
      case 'Verification':
        return <ExclamationCircleOutlined />
      case 'Store Settings':
        return <ShopOutlined />
      case 'Contact Information':
        return <MailOutlined />
      case 'Compliance':
        return <SettingOutlined />
      default:
        return <ExclamationCircleOutlined />
    }
  }

  return (
    <Alert
      message={
        <Space>
          <ExclamationCircleOutlined />
          <strong>Complete Required Information to Publish Products</strong>
        </Space>
      }
      description={
        <div style={{ marginTop: 16 }}>
          <Paragraph style={{ marginBottom: 16 }}>
            Please complete the following required information before you can publish products:
          </Paragraph>

          {Object.entries(groupedBySection).map(([section, requirements]) => (
            <div key={section} style={{ marginBottom: 16 }}>
              <Title level={5} style={{ marginBottom: 8, fontSize: 14 }}>
                {getSectionIcon(section)} {section}
              </Title>
              <List
                size="small"
                dataSource={requirements}
                renderItem={(req) => (
                  <List.Item style={{ padding: '4px 0' }}>
                    <Space>
                      <ExclamationCircleOutlined style={{ color: '#faad14' }} />
                      <Text>{req.label}</Text>
                    </Space>
                  </List.Item>
                )}
              />
            </div>
          ))}

          <Space style={{ marginTop: 16 }}>
            <Button
              type="primary"
              icon={<SettingOutlined />}
              onClick={() => navigate('/store-settings')}
            >
              Go to Store Settings
            </Button>
            {missingRequirements.some((r) => r.path.includes('submit-kyc')) && (
              <Button icon={<ExclamationCircleOutlined />} onClick={() => navigate('/submit-kyc')}>
                Submit KYC
              </Button>
            )}
          </Space>
        </div>
      }
      type="warning"
      showIcon
      closable
      style={{ marginBottom: 24 }}
    />
  )
}

export default RequirementsAlert
