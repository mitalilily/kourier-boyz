import {
  ArrowRightOutlined,
  LoadingOutlined,
  LockOutlined,
  MailOutlined,
  StopOutlined,
} from '@ant-design/icons'
import { useGoogleLogin } from '@react-oauth/google'
import { Alert, App, Button, Card, Checkbox, Divider, Form, Input, Spin, Typography } from 'antd'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useGoogleOAuth, useLogin } from '../api/authQueries'
import { GOOGLE_REDIRECT_URI } from '../config/googleAuth'

const { Title, Text, Paragraph } = Typography

const REMEMBER_ME_KEY = 'seller_remember_email'
const REMEMBER_CHECKED_KEY = 'seller_remember_checked'

const Login = () => {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const loginMutation = useLogin()
  const googleOAuthMutation = useGoogleOAuth()
  const [form] = Form.useForm()
  const [deactivationError, setDeactivationError] = useState<{
    message: string
    code?: string
  } | null>(null)

  // Load saved email on mount
  useEffect(() => {
    const savedEmail = localStorage.getItem(REMEMBER_ME_KEY)
    const rememberChecked = localStorage.getItem(REMEMBER_CHECKED_KEY) === 'true'

    if (savedEmail && rememberChecked) {
      form.setFieldsValue({
        email: savedEmail,
        remember: true,
      })
    }
  }, [form])

  useEffect(() => {
    if (loginMutation.isSuccess || googleOAuthMutation.isSuccess) {
      message.success('🎉 Welcome back!')
      navigate('/dashboard')
    }
  }, [loginMutation.isSuccess, googleOAuthMutation.isSuccess, navigate, message])

  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (codeResponse) => {
      try {
        await googleOAuthMutation.mutateAsync(codeResponse.code)
      } catch (error: unknown) {
        // Error handling is done in the mutation
        const axiosError = error as {
          code?: string
          message?: string
          response?: {
            data?: {
              error?: string
              message?: string
            }
          }
        }
        
        // Check for network errors (backend not running)
        if (axiosError.code === 'ERR_NETWORK' || axiosError.message === 'Network Error') {
          message.error({
            content: 'Cannot connect to server. Please ensure the backend server is running on localhost:5004',
            duration: 8,
          })
        } else {
          const errorMessage = axiosError.response?.data?.message || axiosError.response?.data?.error || 'Google sign-in failed'
          message.error(errorMessage)
        }
        console.error('Google OAuth login error:', error)
      }
    },
    onError: (error) => {
      // Handle OAuth popup errors (user cancellation, etc.)
      // The error object from @react-oauth/google may have different structures
      // If user cancels, we don't need to show an error
      const errorMessage = error?.error_description || error?.error
      if (errorMessage && (errorMessage.includes('popup_closed') || errorMessage.includes('user_cancelled'))) {
        // User closed the popup - don't show an error
        return
      }
      message.error('Google sign-in was cancelled or failed')
    },
    flow: 'auth-code',
    redirect_uri: GOOGLE_REDIRECT_URI, // Explicitly set redirect URI to match backend
  })

  // Keep error state when mutation resets (don't clear on success)
  useEffect(() => {
    if (loginMutation.isError) {
      const error = loginMutation.error as {
        response?: {
          data?: {
            error?: string
            message?: string
            code?: string
          }
        }
      }
      const errorCode = error.response?.data?.code
      const errorMessage = error.response?.data?.message || error.response?.data?.error

      // Show specific message for deactivated accounts
      if (errorCode === 'ACCOUNT_DEACTIVATED') {
        setDeactivationError({
          message:
            errorMessage ||
            'Your seller account has been deactivated. Please contact support for more information.',
          code: errorCode,
        })
        message.error({
          content:
            errorMessage ||
            'Your seller account has been deactivated. Please contact support for more information.',
          duration: 8,
        })
      } else {
        // Only clear deactivation error if it's a different error
        if (deactivationError) {
          setDeactivationError(null)
        }
        message.error(errorMessage || 'Login failed')
      }
    }
    // Don't clear error on success - let it persist until next attempt
  }, [loginMutation.isError, loginMutation.error, message, deactivationError])

  const onFinish = async (values: { email: string; password: string; remember?: boolean }) => {
    // Clear any previous deactivation error
    setDeactivationError(null)

    const { remember, ...loginData } = values

    // Handle remember me
    if (remember) {
      localStorage.setItem(REMEMBER_ME_KEY, values.email)
      localStorage.setItem(REMEMBER_CHECKED_KEY, 'true')
    } else {
      localStorage.removeItem(REMEMBER_ME_KEY)
      localStorage.removeItem(REMEMBER_CHECKED_KEY)
    }

    try {
      await loginMutation.mutateAsync(loginData)
    } catch (error: unknown) {
      // Error is handled by useEffect, but we also handle it here for immediate feedback
      const axiosError = error as {
        response?: {
          data?: {
            error?: string
            message?: string
            code?: string
          }
        }
      }
      const errorCode = axiosError.response?.data?.code
      const errorMessage = axiosError.response?.data?.message || axiosError.response?.data?.error

      // Show specific message for deactivated accounts
      if (errorCode === 'ACCOUNT_DEACTIVATED') {
        const deactivationMsg =
          errorMessage ||
          'Your seller account has been deactivated. Please contact support for more information.'
        console.log('Setting deactivation error:', { errorCode, errorMessage, deactivationMsg })
        setDeactivationError({
          message: deactivationMsg,
          code: errorCode,
        })
        // Use setTimeout to ensure state update happens
        setTimeout(() => {
          message.error({
            content: deactivationMsg,
            duration: 8,
          })
        }, 100)
      } else {
        setDeactivationError(null)
        message.error(errorMessage || 'Login failed')
      }
    }
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
                  Empower your business
                </Paragraph>
              </div>
            </div>
          </div>

          {/* Features */}
          <div className="space-y-6 mt-16">
            {[
              {
                icon: '📊',
                title: 'Real-time Analytics',
                desc: 'Monitor your sales, revenue, and customer insights',
              },
              {
                icon: '🚀',
                title: 'Quick Setup',
                desc: 'Launch your store and start selling in minutes',
              },
              {
                icon: '💳',
                title: 'Secure Payments',
                desc: 'Reliable and secure payment processing',
              },
              {
                icon: '📦',
                title: 'Inventory Management',
                desc: 'Keep track of stock levels and product variants',
              },
            ].map((feature, idx) => (
              <div
                key={idx}
                className="flex items-start gap-4 p-4 rounded-xl"
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                }}
              >
                <div
                  className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{
                    background: 'rgba(255, 255, 255, 0.2)',
                  }}
                >
                  <span className="text-2xl">{feature.icon}</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-1">{feature.title}</h3>
                  <p className="opacity-80 text-sm">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
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
            <h1 className="text-3xl font-bold text-gray-900">Seller Hub</h1>
          </div>

          {/* Login Card */}
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
            <div className="mb-8">
              <Title level={2} className="!mb-2 !text-gray-900">
                Welcome back
              </Title>
              <Text className="text-base text-gray-600">
                Sign in to access your seller dashboard
              </Text>
            </div>

            {/* Deactivation Error Alert */}
            {deactivationError && (
              <Alert
                message="Account Deactivated"
                description={
                  <div>
                    <Paragraph style={{ marginBottom: 8, color: '#991b1b' }}>
                      <strong>Your seller account has been deactivated.</strong>
                    </Paragraph>
                    <Paragraph style={{ marginBottom: 0, color: '#7f1d1d' }}>
                      {deactivationError.message}
                    </Paragraph>
                    <Paragraph
                      style={{ marginTop: 12, marginBottom: 0, fontSize: '13px', color: '#991b1b' }}
                    >
                      To reactivate your account, please contact our support team.
                    </Paragraph>
                  </div>
                }
                type="error"
                icon={<StopOutlined />}
                showIcon
                closable
                onClose={() => setDeactivationError(null)}
                style={{
                  marginBottom: 24,
                  borderRadius: '12px',
                  border: '1px solid #fca5a5',
                  backgroundColor: '#fef2f2',
                }}
              />
            )}

            {/* Form */}
            <Form
              form={form}
              name="login"
              onFinish={onFinish}
              layout="vertical"
              size="large"
              requiredMark={false}
            >
              <Form.Item
                name="email"
                label={<span style={{ fontWeight: 500, color: '#374151' }}>Email</span>}
                rules={[
                  { required: true, message: 'Please enter your email' },
                  { type: 'email', message: 'Please enter a valid email' },
                  {
                    pattern: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
                    message: 'Invalid email format',
                  },
                  { max: 100, message: 'Email must not exceed 100 characters' },
                ]}
              >
                <Input
                  prefix={<MailOutlined style={{ color: '#9CA3AF' }} />}
                  placeholder="Enter your email"
                  style={{
                    height: '48px',
                    borderRadius: '12px',
                    fontSize: '15px',
                  }}
                  autoComplete="email"
                />
              </Form.Item>

              <Form.Item
                name="password"
                label={<span style={{ fontWeight: 500, color: '#374151' }}>Password</span>}
                rules={[
                  { required: true, message: 'Please enter your password' },
                  { min: 6, message: 'Password must be at least 6 characters' },
                  { max: 50, message: 'Password must not exceed 50 characters' },
                ]}
              >
                <Input.Password
                  prefix={<LockOutlined style={{ color: '#9CA3AF' }} />}
                  placeholder="Enter your password"
                  style={{
                    height: '48px',
                    borderRadius: '12px',
                    fontSize: '15px',
                  }}
                  autoComplete="current-password"
                />
              </Form.Item>

              <div className="flex justify-between items-center mb-6">
                <Form.Item name="remember" valuePropName="checked" noStyle>
                  <Checkbox>Remember me</Checkbox>
                </Form.Item>
                <Link
                  to="/forgot-password"
                  style={{
                    color: '#4F5552',
                    fontWeight: 500,
                    fontSize: '14px',
                  }}
                  className="hover:underline"
                >
                  Forgot password?
                </Link>
              </div>

              <Form.Item className="!mb-4">
                <Button
                  type="primary"
                  htmlType="submit"
                  block
                  loading={loginMutation.isPending}
                  size="large"
                  icon={!loginMutation.isPending && <ArrowRightOutlined />}
                  iconPosition="end"
                  style={{
                    height: '48px',
                    borderRadius: '12px',
                    fontSize: '16px',
                    fontWeight: 600,
                  }}
                >
                  {loginMutation.isPending ? 'Signing in...' : 'Sign in'}
                </Button>
              </Form.Item>

              <Divider plain style={{ margin: '24px 0' }}>
                <span style={{ color: '#9CA3AF', fontSize: '14px' }}>Or continue with</span>
              </Divider>
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={googleOAuthMutation.isPending || loginMutation.isPending}
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
                    googleOAuthMutation.isPending || loginMutation.isPending
                      ? 'not-allowed'
                      : 'pointer',
                  boxShadow:
                    '0 1px 2px 0 rgba(60, 64, 67, 0.3), 0 1px 3px 1px rgba(60, 64, 67, 0.15)',
                  transition: 'all 0.2s ease-in-out',
                  outline: 'none',
                  opacity: googleOAuthMutation.isPending || loginMutation.isPending ? 0.6 : 1,
                  marginBottom: '24px',
                }}
                onMouseEnter={(e) => {
                  if (!googleOAuthMutation.isPending && !loginMutation.isPending) {
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
                  if (!googleOAuthMutation.isPending && !loginMutation.isPending) {
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
                    <span>Signing in...</span>
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

              <Divider plain style={{ margin: '24px 0' }}>
                <span style={{ color: '#9CA3AF', fontSize: '14px' }}>New seller?</span>
              </Divider>

              <div className="text-center">
                <Text style={{ fontSize: '15px', color: '#6B7280' }}>Don't have an account? </Text>
                <Link
                  to="/register"
                  style={{
                    color: '#4F5552',
                    fontWeight: 600,
                    fontSize: '15px',
                  }}
                  className="hover:underline"
                >
                  Create account
                </Link>
              </div>
            </Form>
          </Card>

          {/* Footer */}
          <p className="text-center text-gray-500 text-sm mt-8">
            © 2024 Kourier Boyz. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  )
}

export default Login
