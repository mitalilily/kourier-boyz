import { ArrowLeftOutlined, MailOutlined } from '@ant-design/icons'
import { App, Button, Card, Form, Input, Result, Typography } from 'antd'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useForgotPassword } from '../api/authQueries'

const { Title, Text, Paragraph } = Typography

const ForgotPassword = () => {
  const { message } = App.useApp()
  const forgotPasswordMutation = useForgotPassword()
  const [emailSent, setEmailSent] = useState(false)
  const [form] = Form.useForm()

  useEffect(() => {
    if (forgotPasswordMutation.isSuccess) {
      setEmailSent(true)
    }
  }, [forgotPasswordMutation.isSuccess])

  useEffect(() => {
    if (forgotPasswordMutation.isError) {
      const error = forgotPasswordMutation.error as { response?: { data?: { error?: string } } }
      message.error(error.response?.data?.error || 'Failed to send reset email')
    }
  }, [forgotPasswordMutation.isError, forgotPasswordMutation.error, message])

  const onFinish = (values: { email: string }) => {
    forgotPasswordMutation.mutate(values.email)
  }

  if (emailSent) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-8"
        style={{ background: 'linear-gradient(135deg, #4F5552 0%, #303537 100%)' }}
      >
        <Card
          className="w-full max-w-lg shadow-2xl border-0"
          style={{
            borderRadius: '24px',
            background: 'white',
          }}
        >
          <Result
            status="success"
            icon={
              <div className="flex justify-center mb-4">
                <div
                  style={{
                    width: '80px',
                    height: '80px',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                  }}
                >
                  <MailOutlined style={{ fontSize: '40px', color: 'white' }} />
                </div>
              </div>
            }
            title={
              <Title level={2} style={{ marginBottom: '8px', color: '#1f2937' }}>
                Check Your Email!
              </Title>
            }
            subTitle={
              <div style={{ marginTop: '16px' }}>
                <Paragraph style={{ fontSize: '15px', color: '#6b7280', marginBottom: '16px' }}>
                  If an account exists with this email, you will receive password reset instructions
                  shortly.
                </Paragraph>
                <div
                  style={{
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    borderRadius: '12px',
                    padding: '12px',
                    marginTop: '16px',
                  }}
                >
                  <Text style={{ fontSize: '13px', color: '#1e40af' }}>
                    <strong>Tip:</strong> Check your spam folder if you don't see the email within a
                    few minutes.
                  </Text>
                </div>
              </div>
            }
            extra={[
              <Link to="/login" key="login">
                <Button
                  type="primary"
                  size="large"
                  style={{
                    height: '48px',
                    borderRadius: '12px',
                    fontSize: '15px',
                    fontWeight: 600,
                    padding: '0 32px',
                  }}
                >
                  Back to Login
                </Button>
              </Link>,
            ]}
          />
        </Card>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen flex overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #4F5552 0%, #303537 100%)' }}
    >
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 p-12 items-center justify-center relative overflow-hidden">
        {/* Subtle Background Pattern */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `radial-gradient(circle at 20% 50%, white 0%, transparent 50%),
                              radial-gradient(circle at 80% 80%, white 0%, transparent 50%)`,
          }}
        />

        <div className="relative z-10 text-white max-w-lg">
          {/* Logo & Title */}
          <div className="mb-12">
            <div
              style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}
            >
              <img
                src="/store/brand/kourier-boyz-logo-transparent.png"
                alt="Kourier Boyz"
                style={{
                  width: '80px',
                  height: '80px',
                  objectFit: 'contain',
                }}
              />
              <div>
                <h1 className="text-4xl font-bold mb-2" style={{ lineHeight: '1.2', margin: 0 }}>
                  Seller Hub
                </h1>
                <Paragraph className="text-base !text-white opacity-90 leading-relaxed !mb-0">
                  Reset your password
                </Paragraph>
              </div>
            </div>
          </div>

          {/* Features */}
          <div style={{ marginTop: '64px' }}>
            {[
              {
                icon: '📧',
                title: 'Secure Reset',
                desc: 'Password reset links are sent securely to your email',
              },
              {
                icon: '🔒',
                title: 'Quick Process',
                desc: 'Reset your password in just a few clicks',
              },
              {
                icon: '✨',
                title: 'Easy Access',
                desc: 'Get back to managing your seller account quickly',
              },
            ].map((feature, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '16px',
                  padding: '16px',
                  borderRadius: '12px',
                  marginBottom: '16px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                }}
              >
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <span style={{ fontSize: '24px' }}>{feature.icon}</span>
                </div>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '4px' }}>
                    {feature.title}
                  </h3>
                  <p style={{ opacity: 0.8, fontSize: '14px', margin: 0 }}>{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 md:p-12 relative">
        {/* Subtle Background */}
        <div
          className="absolute inset-0"
          style={{
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(20px)',
          }}
        />

        <div className="w-full max-w-md relative z-10">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-10">
            <img
              src="/store/brand/kourier-boyz-mark.png"
              alt="Kourier Boyz"
              style={{
                width: '80px',
                height: '80px',
                objectFit: 'contain',
                marginBottom: 16,
              }}
            />
            <h1 className="text-3xl font-bold" style={{ color: '#1f2937' }}>
              Seller Hub
            </h1>
          </div>

          {/* Forgot Password Card */}
          <Card
            className="border-0"
            style={{
              background: 'white',
              borderRadius: '24px',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.08)',
              padding: '16px',
            }}
          >
            {/* Header */}
            <div style={{ marginBottom: '32px' }}>
              <Title level={2} style={{ marginBottom: '8px', color: '#1f2937' }}>
                Forgot Password?
              </Title>
              <Text style={{ fontSize: '15px', color: '#6b7280' }}>
                No worries! Enter your email and we'll send you reset instructions
              </Text>
            </div>

            <Form
              form={form}
              name="forgot-password"
              onFinish={onFinish}
              layout="vertical"
              size="large"
              requiredMark={false}
            >
              <Form.Item
                name="email"
                label={<span style={{ fontSize: '14px', fontWeight: 500 }}>Email Address</span>}
                rules={[
                  { required: true, message: 'Please enter your email!' },
                  { type: 'email', message: 'Please enter a valid email!' },
                ]}
              >
                <Input
                  prefix={<MailOutlined style={{ color: '#9ca3af' }} />}
                  placeholder="seller@example.com"
                  style={{
                    height: '48px',
                    borderRadius: '12px',
                    fontSize: '15px',
                  }}
                />
              </Form.Item>

              <Form.Item style={{ marginBottom: '24px', marginTop: '32px' }}>
                <Button
                  type="primary"
                  htmlType="submit"
                  block
                  loading={forgotPasswordMutation.isPending}
                  size="large"
                  style={{
                    height: '48px',
                    borderRadius: '12px',
                    fontSize: '15px',
                    fontWeight: 600,
                  }}
                >
                  {forgotPasswordMutation.isPending ? 'Sending...' : 'Send Reset Link'}
                </Button>
              </Form.Item>
            </Form>

            {/* Footer Links */}
            <div style={{ textAlign: 'center', marginTop: '24px' }}>
              <Link
                to="/login"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: '#6b7280',
                  fontSize: '14px',
                  textDecoration: 'none',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#374151'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#6b7280'
                }}
              >
                <ArrowLeftOutlined />
                Back to Login
              </Link>
            </div>
          </Card>

          {/* Footer */}
          <p
            style={{
              textAlign: 'center',
              color: '#9ca3af',
              fontSize: '13px',
              marginTop: '32px',
            }}
          >
            © 2024 Kourier Boyz. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  )
}

export default ForgotPassword
