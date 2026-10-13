import { ArrowRightOutlined, LockOutlined, MailOutlined, StopOutlined } from '@ant-design/icons'
import { Alert, App, Button, Card, Checkbox, Form, Input, Typography } from 'antd'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLogin } from '../api/authQueries'
import MarketplaceAuthFrame from '../components/MarketplaceAuthFrame'

const { Title, Text } = Typography
const REMEMBER_ME_KEY = 'seller_remember_email'
const REMEMBER_CHECKED_KEY = 'seller_remember_checked'

const Login = () => {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const loginMutation = useLogin()
  const [form] = Form.useForm()
  const [deactivationError, setDeactivationError] = useState<string | null>(null)

  useEffect(() => {
    const savedEmail = localStorage.getItem(REMEMBER_ME_KEY)
    if (savedEmail && localStorage.getItem(REMEMBER_CHECKED_KEY) === 'true') {
      form.setFieldsValue({ email: savedEmail, remember: true })
    }
  }, [form])

  useEffect(() => {
    if (loginMutation.isSuccess) {
      message.success('Welcome back')
      navigate('/dashboard')
    }
  }, [loginMutation.isSuccess, navigate, message])

  const onFinish = async (values: { email: string; password: string; remember?: boolean }) => {
    setDeactivationError(null)
    const { remember, ...loginData } = values
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
      const response = (error as {
        response?: { data?: { error?: string; message?: string; code?: string } }
      }).response?.data
      const errorMessage = response?.message || response?.error || 'Unable to sign in'
      if (response?.code === 'ACCOUNT_DEACTIVATED') setDeactivationError(errorMessage)
      message.error(errorMessage)
    }
  }

  return (
    <MarketplaceAuthFrame
      eyebrow="Seller workspace"
      title="Your catalogue and deliveries, finally in one place."
      description="Run marketplace orders and courier operations from one connected Kourier Boyz account."
    >
      <Card className="kb-seller-auth-card">
        <div className="kb-seller-auth-heading">
          <Text>Seller sign in</Text>
          <Title level={2}>Welcome back</Title>
          <p>Continue to your products, orders, inventory, and shipping workspace.</p>
        </div>

        {deactivationError && (
          <Alert
            message="Account deactivated"
            description={`${deactivationError} Contact support to restore access.`}
            type="error"
            icon={<StopOutlined />}
            showIcon
            closable
            onClose={() => setDeactivationError(null)}
            className="kb-seller-auth-alert"
          />
        )}

        <Form form={form} name="login" onFinish={onFinish} layout="vertical" size="large" requiredMark={false}>
          <Form.Item
            name="email"
            label="Email address"
            rules={[
              { required: true, message: 'Please enter your email' },
              { type: 'email', message: 'Please enter a valid email' },
              { max: 100, message: 'Email must not exceed 100 characters' },
            ]}
          >
            <Input prefix={<MailOutlined />} placeholder="seller@business.com" autoComplete="email" />
          </Form.Item>

          <Form.Item
            name="password"
            label="Password"
            rules={[
              { required: true, message: 'Please enter your password' },
              { min: 6, message: 'Password must be at least 6 characters' },
              { max: 50, message: 'Password must not exceed 50 characters' },
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="Enter your password" autoComplete="current-password" />
          </Form.Item>

          <div className="kb-seller-auth-options">
            <Form.Item name="remember" valuePropName="checked" noStyle>
              <Checkbox>Remember me</Checkbox>
            </Form.Item>
            <Link to="/forgot-password">Forgot password?</Link>
          </div>

          <Button
            type="primary"
            htmlType="submit"
            block
            loading={loginMutation.isPending}
            icon={!loginMutation.isPending ? <ArrowRightOutlined /> : undefined}
            iconPosition="end"
            className="kb-seller-auth-submit"
          >
            {loginMutation.isPending ? 'Signing in...' : 'Sign in'}
          </Button>

          <p className="kb-seller-auth-switch">
            New to the marketplace? <Link to="/register">Create a seller account</Link>
          </p>
        </Form>
      </Card>
    </MarketplaceAuthFrame>
  )
}

export default Login
