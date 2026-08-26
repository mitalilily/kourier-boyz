import {
  ArrowRightOutlined,
  CheckCircleOutlined,
  CheckCircleTwoTone,
  CloseCircleTwoTone,
  LoadingOutlined,
  LockOutlined,
  MailOutlined,
  PhoneOutlined,
  UserOutlined,
} from '@ant-design/icons'
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Divider,
  Form,
  Input,
  Modal,
  Row,
  Space,
  Spin,
  Typography,
} from 'antd'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAgreementByType } from '../api/agreementQueries'
import type { RegisterData } from '../api/auth'
import { useRegister } from '../api/authQueries'
import MarketplacePublicShell from '../components/MarketplacePublicShell'

const { Title, Text, Paragraph } = Typography

const getPasswordChecks = (password?: string) => {
  const value = password || ''
  const hasMinLength = value.length >= 8
  const hasUppercase = /[A-Z]/.test(value)
  const hasLowercase = /[a-z]/.test(value)
  const hasNumber = /\d/.test(value)
  const hasSpecialChar = /[@$!%*?&]/.test(value)

  return {
    hasMinLength,
    hasUppercase,
    hasLowercase,
    hasNumber,
    hasSpecialChar,
  }
}

const PasswordRequirements = ({ password }: { password?: string }) => {
  const checks = getPasswordChecks(password)

  if (!password) {
    return (
      <div style={{ marginTop: 4, fontSize: '12px', color: '#8c8c8c' }}>
        Must contain: 8+ chars, A-Z, a-z, 0-9, special (@$!%*?&)
      </div>
    )
  }

  const requirements = [
    { key: 'length', label: '8+ chars', ok: checks.hasMinLength },
    { key: 'upper', label: 'A-Z', ok: checks.hasUppercase },
    { key: 'lower', label: 'a-z', ok: checks.hasLowercase },
    { key: 'number', label: '0-9', ok: checks.hasNumber },
    { key: 'special', label: '@$!%*?&', ok: checks.hasSpecialChar },
  ]

  const passedCount = requirements.filter((r) => r.ok).length
  const totalCount = requirements.length

  return (
    <div style={{ marginTop: 6 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flexWrap: 'wrap',
          fontSize: '12px',
        }}
      >
        {requirements.map((req) => (
          <span
            key={req.key}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 6px',
              borderRadius: '4px',
              backgroundColor: req.ok ? '#f6ffed' : '#fff2e8',
              color: req.ok ? '#52c41a' : '#fa8c16',
              border: `1px solid ${req.ok ? '#b7eb8f' : '#ffd591'}`,
              fontWeight: 500,
            }}
          >
            {req.ok ? (
              <CheckCircleTwoTone twoToneColor="#52c41a" style={{ fontSize: '12px' }} />
            ) : (
              <CloseCircleTwoTone twoToneColor="#fa8c16" style={{ fontSize: '12px' }} />
            )}
            <span>{req.label}</span>
          </span>
        ))}
      </div>
      {password && passedCount < totalCount && (
        <div style={{ marginTop: '4px', fontSize: '11px', color: '#8c8c8c' }}>
          {passedCount} of {totalCount} requirements met
        </div>
      )}
    </div>
  )
}

const Register = () => {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const registerMutation = useRegister()
  const googleOAuthMutation = { isPending: false }
  const [form] = Form.useForm()
  const passwordValue = Form.useWatch('password', form)
  const passwordChecks = getPasswordChecks(passwordValue)
  const isPasswordStrong =
    passwordChecks.hasMinLength &&
    passwordChecks.hasUppercase &&
    passwordChecks.hasLowercase &&
    passwordChecks.hasNumber &&
    passwordChecks.hasSpecialChar

  // Modal states
  const [termsModalOpen, setTermsModalOpen] = useState(false)
  const [privacyModalOpen, setPrivacyModalOpen] = useState(false)

  // Fetch agreements
  const { data: termsAgreement, isLoading: termsLoading } = useAgreementByType(
    termsModalOpen ? 'marketplace-terms' : null,
  )
  const { data: privacyAgreement, isLoading: privacyLoading } = useAgreementByType(
    privacyModalOpen ? 'seller-privacy-policy' : null,
  )

  useEffect(() => {
    if (registerMutation.isSuccess) {
      message.success('🎉 Registration successful! Please complete your KYC.')
      // Auto-login and redirect to KYC page
      setTimeout(() => navigate('/submit-kyc'), 1500)
    }
  }, [registerMutation.isSuccess, navigate, message])

  const handleGoogleSignUp = () => {
    message.info('Use the seller registration form to create a demo account.')
  }

  useEffect(() => {
    if (registerMutation.isError) {
      const error = registerMutation.error as { response?: { data?: { error?: string } } }
      message.error(error.response?.data?.error || 'Registration failed')
    }
  }, [registerMutation.isError, registerMutation.error, message])

  const onFinish = (values: RegisterData) => {
    registerMutation.mutate(values)
  }

  return (
    <MarketplacePublicShell>
      <div
      style={{
        minHeight: '100vh',
        background: 'radial-gradient(circle at top left, #e6f7ff 0, #f0f2f5 40%, #ffffff 100%)',
        padding: '48px 16px',
      }}
    >
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        {/* Header */}
        <Space direction="vertical" size="large" style={{ width: '100%', marginBottom: 32 }}>
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 12,
                marginBottom: 20,
              }}
            >
              <div
                style={{
                  width: 64,
                  height: 64,

                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                }}
              >
                <img
                  src="/store/brand/kourier-boyz-mark.png"
                  alt="Kourier Boyz"
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              </div>
              <div style={{ textAlign: 'left' }}>
                <Title level={2} style={{ margin: 0 }}>
                  Kourier Boyz Seller Hub
                </Title>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  Grow your business with the official Kourier Boyz marketplace platform
                </Text>
              </div>
            </div>
            <Paragraph style={{ fontSize: 16, color: '#595959', margin: 0 }}>
              Create your professional seller account on Kourier Boyz and start reaching customers across
              India.
            </Paragraph>
          </div>
        </Space>

        {/* Main Card */}
        <Card
          bordered={false}
          style={{
            boxShadow:
              '0 4px 24px rgba(0,0,0,0.06), 0 0 40px rgba(24, 144, 255, 0.08), 0 8px 48px rgba(24, 144, 255, 0.05)',
            borderRadius: 12,
          }}
        >
          {/* Progress Steps */}

          <Form form={form} name="register" onFinish={onFinish} layout="vertical" size="large">
            {/* Step 1: Account Information */}
            <Space direction="vertical" size="middle" style={{ width: '100%', marginBottom: 32 }}>
              <div>
                <Text type="secondary">
                  Tell us a few details so we can set up your Kourier Boyz seller profile
                </Text>
              </div>

              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="name"
                    label="Full Name"
                    rules={[
                      { required: true, message: 'Please enter your full name' },
                      { min: 2, message: 'Name must be at least 2 characters' },
                      { max: 100, message: 'Name must not exceed 100 characters' },
                      {
                        pattern: /^[a-zA-Z\s]+$/,
                        message: 'Name can only contain letters and spaces',
                      },
                      {
                        whitespace: true,
                        message: 'Name cannot be empty or just spaces',
                      },
                    ]}
                  >
                    <Input prefix={<UserOutlined />} placeholder="John Doe" autoComplete="name" />
                  </Form.Item>
                </Col>

                <Col xs={24} md={12}>
                  <Form.Item
                    name="email"
                    label="Email Address"
                    rules={[
                      { required: true, message: 'Please enter your email address' },
                      { type: 'email', message: 'Please enter a valid email address' },
                      { max: 100, message: 'Email must not exceed 100 characters' },
                    ]}
                  >
                    <Input
                      prefix={<MailOutlined />}
                      placeholder="john@example.com"
                      autoComplete="email"
                    />
                  </Form.Item>
                </Col>

                <Col xs={24} md={12}>
                  <Form.Item
                    name="phone"
                    label="Phone Number"
                    rules={[
                      { required: true, message: 'Please enter your phone number' },
                      {
                        pattern: /^[6-9]\d{9}$/,
                        message: 'Please enter a valid 10-digit mobile number',
                      },
                    ]}
                  >
                    <Input
                      addonBefore={
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <PhoneOutlined />
                          +91
                        </span>
                      }
                      placeholder="9876543210"
                      autoComplete="tel"
                      maxLength={10}
                    />
                  </Form.Item>
                </Col>

                <Col xs={24} md={12}>
                  <Form.Item
                    name="password"
                    label="Password"
                    rules={[
                      {
                        required: true,
                        message: 'Please enter your password',
                      },
                      {
                        validator: (_, value) => {
                          if (!value) return Promise.resolve()

                          const checks = getPasswordChecks(value)
                          const allOk =
                            checks.hasMinLength &&
                            checks.hasUppercase &&
                            checks.hasLowercase &&
                            checks.hasNumber &&
                            checks.hasSpecialChar

                          if (!allOk) {
                            return Promise.reject(
                              new Error('Password does not meet the requirements'),
                            )
                          }
                          return Promise.resolve()
                        },
                      },
                      { max: 50, message: 'Password must not exceed 50 characters' },
                    ]}
                    hasFeedback
                    validateStatus={
                      passwordValue ? (isPasswordStrong ? 'success' : 'error') : undefined
                    }
                    help={<PasswordRequirements password={passwordValue} />}
                  >
                    <Input.Password
                      prefix={<LockOutlined />}
                      placeholder="Minimum 8 characters"
                      autoComplete="new-password"
                    />
                  </Form.Item>
                </Col>

                <Col xs={24} md={12}>
                  <Form.Item
                    name="confirmPassword"
                    label="Confirm Password"
                    dependencies={['password']}
                    rules={[
                      { required: true, message: 'Please confirm your password' },
                      ({ getFieldValue }) => ({
                        validator(_, value) {
                          if (!value || getFieldValue('password') === value) {
                            return Promise.resolve()
                          }
                          return Promise.reject(new Error('Passwords do not match'))
                        },
                      }),
                    ]}
                    hasFeedback
                  >
                    <Input.Password
                      prefix={<LockOutlined />}
                      placeholder="Confirm your password"
                      autoComplete="new-password"
                    />
                  </Form.Item>
                </Col>
              </Row>
            </Space>

            {/* Info Alert */}
            <Alert
              message="What happens after you create your Kourier Boyz account?"
              description={
                <ul style={{ paddingLeft: 20, margin: 0 }}>
                  <li>Complete your KYC to verify your identity and business for Kourier Boyz</li>
                  <li>Add your GST, pickup address and bank account for payouts</li>
                  <li>Our team will review your Kourier Boyz seller application</li>
                  <li>You’ll receive an email from Kourier Boyz once your account is approved</li>
                </ul>
              }
              type="info"
              icon={<CheckCircleOutlined />}
              showIcon
              style={{ marginBottom: 24 }}
            />

            {/* Submit Button */}
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <Text
                type="secondary"
                style={{ textAlign: 'center', display: 'block', fontSize: '13px' }}
              >
                By creating a Kourier Boyz seller account, you agree to our{' '}
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    setTermsModalOpen(true)
                  }}
                  style={{ color: '#B78115', cursor: 'pointer' }}
                >
                  Terms of Service
                </a>{' '}
                and{' '}
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    setPrivacyModalOpen(true)
                  }}
                  style={{ color: '#B78115', cursor: 'pointer' }}
                >
                  Privacy Policy
                </a>
              </Text>

              <Button
                type="primary"
                htmlType="submit"
                block
                loading={registerMutation.isPending}
                size="large"
                icon={<ArrowRightOutlined />}
              >
                {registerMutation.isPending ? 'Creating Your Account...' : 'Create Seller Account'}
              </Button>

              <Divider plain>Or continue with</Divider>

              <button
                type="button"
                onClick={handleGoogleSignUp}
                disabled={googleOAuthMutation.isPending || registerMutation.isPending}
                style={{
                  width: '100%',
                  height: '48px',
                  borderRadius: '8px',
                  fontSize: '15px',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px',
                  border: '1px solid #dadce0',
                  background: '#ffffff',
                  color: '#3c4043',
                  cursor:
                    googleOAuthMutation.isPending || registerMutation.isPending
                      ? 'not-allowed'
                      : 'pointer',
                  boxShadow:
                    '0 1px 2px 0 rgba(60, 64, 67, 0.3), 0 1px 3px 1px rgba(60, 64, 67, 0.15)',
                  transition: 'all 0.2s ease-in-out',
                  outline: 'none',
                  opacity: googleOAuthMutation.isPending || registerMutation.isPending ? 0.6 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!googleOAuthMutation.isPending && !registerMutation.isPending) {
                    e.currentTarget.style.background = '#f8f9fa'
                    e.currentTarget.style.boxShadow =
                      '0 1px 3px 0 rgba(60, 64, 67, 0.3), 0 4px 8px 3px rgba(60, 64, 67, 0.15)'
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#ffffff'
                  e.currentTarget.style.boxShadow =
                    '0 1px 2px 0 rgba(60, 64, 67, 0.3), 0 1px 3px 1px rgba(60, 64, 67, 0.15)'
                }}
                onMouseDown={(e) => {
                  if (!googleOAuthMutation.isPending && !registerMutation.isPending) {
                    e.currentTarget.style.boxShadow =
                      '0 1px 2px 0 rgba(60, 64, 67, 0.3), 0 1px 3px 1px rgba(60, 64, 67, 0.15)'
                  }
                }}
              >
                {googleOAuthMutation.isPending ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Spin
                      size="small"
                      indicator={
                        <LoadingOutlined style={{ fontSize: 16, color: '#3c4043' }} spin />
                      }
                    />
                    <span>Signing up...</span>
                  </span>
                ) : (
                  <>
                    <svg width="20" height="20" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    <span>Continue with Google</span>
                  </>
                )}
              </button>

              <Divider plain>Already have an account?</Divider>

              <Link to="/login" style={{ display: 'block', textAlign: 'center' }}>
                <Button size="large">Sign In Instead</Button>
              </Link>
            </Space>
          </Form>
        </Card>

        {/* Footer */}
        <Text
          type="secondary"
          style={{
            display: 'block',
            textAlign: 'center',
            marginTop: 24,
          }}
        >
          © 2024 Kourier Boyz. All rights reserved.
        </Text>
      </div>

      {/* Terms of Service Modal */}
      <Modal
        title={
          termsAgreement ? (
            <>
              {termsAgreement.title}
              <Text type="secondary" style={{ fontSize: 12, marginLeft: 8, fontWeight: 'normal' }}>
                (Version {termsAgreement.version})
              </Text>
            </>
          ) : (
            'Terms of Service'
          )
        }
        open={termsModalOpen}
        onCancel={() => setTermsModalOpen(false)}
        footer={[
          <Button key="close" onClick={() => setTermsModalOpen(false)}>
            Close
          </Button>,
        ]}
        width={800}
        style={{ top: 20 }}
        bodyStyle={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}
      >
        {termsLoading ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Spin size="large" />
            <div style={{ marginTop: 16 }}>Loading Terms of Service...</div>
          </div>
        ) : termsAgreement ? (
          <div>
            {termsAgreement.effectiveDate && (
              <Paragraph type="secondary" style={{ marginBottom: 16 }}>
                Effective Date:{' '}
                {new Date(termsAgreement.effectiveDate).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </Paragraph>
            )}
            <div
              style={{
                padding: 16,
                background: '#fafafa',
                borderRadius: 4,
                lineHeight: 1.8,
              }}
              dangerouslySetInnerHTML={{ __html: termsAgreement.content }}
            />
          </div>
        ) : (
          <Paragraph>Terms of Service content not available. Please contact support.</Paragraph>
        )}
      </Modal>

      {/* Privacy Policy Modal */}
      <Modal
        title={
          privacyAgreement ? (
            <>
              {privacyAgreement.title}
              <Text type="secondary" style={{ fontSize: 12, marginLeft: 8, fontWeight: 'normal' }}>
                (Version {privacyAgreement.version})
              </Text>
            </>
          ) : (
            'Privacy Policy'
          )
        }
        open={privacyModalOpen}
        onCancel={() => setPrivacyModalOpen(false)}
        footer={[
          <Button key="close" onClick={() => setPrivacyModalOpen(false)}>
            Close
          </Button>,
        ]}
        width={800}
        style={{ top: 20 }}
        bodyStyle={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}
      >
        {privacyLoading ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Spin size="large" />
            <div style={{ marginTop: 16 }}>Loading Privacy Policy...</div>
          </div>
        ) : privacyAgreement ? (
          <div>
            {privacyAgreement.effectiveDate && (
              <Paragraph type="secondary" style={{ marginBottom: 16 }}>
                Effective Date:{' '}
                {new Date(privacyAgreement.effectiveDate).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </Paragraph>
            )}
            <div
              style={{
                padding: 16,
                background: '#fafafa',
                borderRadius: 4,
                lineHeight: 1.8,
              }}
              dangerouslySetInnerHTML={{ __html: privacyAgreement.content }}
            />
          </div>
        ) : (
          <Paragraph>Privacy Policy content not available. Please contact support.</Paragraph>
        )}
      </Modal>
      </div>
    </MarketplacePublicShell>
  )
}

export default Register
