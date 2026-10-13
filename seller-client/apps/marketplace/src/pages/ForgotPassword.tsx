import { ArrowLeftOutlined, MailOutlined } from '@ant-design/icons'
import { App, Button, Card, Form, Input, Result, Typography } from 'antd'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useForgotPassword } from '../api/authQueries'
import MarketplaceAuthFrame from '../components/MarketplaceAuthFrame'

const { Title, Text } = Typography

const ForgotPassword = () => {
  const { message } = App.useApp()
  const forgotPasswordMutation = useForgotPassword()
  const [emailSent, setEmailSent] = useState(false)

  useEffect(() => {
    if (forgotPasswordMutation.isSuccess) setEmailSent(true)
  }, [forgotPasswordMutation.isSuccess])

  useEffect(() => {
    if (forgotPasswordMutation.isError) {
      const error = forgotPasswordMutation.error as { response?: { data?: { error?: string } } }
      message.error(error.response?.data?.error || 'Failed to send reset email')
    }
  }, [forgotPasswordMutation.isError, forgotPasswordMutation.error, message])

  return (
    <MarketplaceAuthFrame
      eyebrow="Account recovery"
      title="Secure access without slowing down your business."
      description="Reset your seller password securely, then return to orders and fulfilment without losing your place."
    >
      <Card className="kb-seller-auth-card">
        {emailSent ? (
          <Result
            status="success"
            title="Check your inbox"
            subTitle="If a seller account exists for that address, password reset instructions are on the way. Check spam if the email does not arrive within a few minutes."
            extra={<Link to="/login"><Button type="primary">Back to sign in</Button></Link>}
          />
        ) : (
          <>
            <div className="kb-seller-auth-heading">
              <Text>Password assistance</Text>
              <Title level={2}>Reset your password</Title>
              <p>Enter the email connected to your seller account.</p>
            </div>
            <Form
              name="forgot-password"
              onFinish={(values: { email: string }) => forgotPasswordMutation.mutate(values.email)}
              layout="vertical"
              size="large"
              requiredMark={false}
            >
              <Form.Item
                name="email"
                label="Email address"
                rules={[
                  { required: true, message: 'Please enter your email' },
                  { type: 'email', message: 'Please enter a valid email' },
                ]}
              >
                <Input prefix={<MailOutlined />} placeholder="seller@business.com" autoComplete="email" />
              </Form.Item>
              <Button type="primary" htmlType="submit" block loading={forgotPasswordMutation.isPending} className="kb-seller-auth-submit">
                {forgotPasswordMutation.isPending ? 'Sending reset link...' : 'Send reset link'}
              </Button>
              <p className="kb-seller-auth-switch">
                <Link to="/login"><ArrowLeftOutlined /> Back to sign in</Link>
              </p>
            </Form>
          </>
        )}
      </Card>
    </MarketplaceAuthFrame>
  )
}

export default ForgotPassword
