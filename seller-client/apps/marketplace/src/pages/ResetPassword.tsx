import { ArrowLeftOutlined, ArrowRightOutlined, LockOutlined } from '@ant-design/icons'
import { App, Button, Card, Form, Input, Result, Typography } from 'antd'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useResetPassword } from '../api/authQueries'
import MarketplaceAuthFrame from '../components/MarketplaceAuthFrame'

const { Title, Text } = Typography

const ResetPassword = () => {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const { message } = App.useApp()
  const resetPasswordMutation = useResetPassword()
  const [resetSuccess, setResetSuccess] = useState(false)

  useEffect(() => {
    if (resetPasswordMutation.isSuccess) {
      setResetSuccess(true)
      const timer = window.setTimeout(() => navigate('/login'), 3000)
      return () => window.clearTimeout(timer)
    }
  }, [resetPasswordMutation.isSuccess, navigate])

  useEffect(() => {
    if (resetPasswordMutation.isError) {
      const error = resetPasswordMutation.error as { response?: { data?: { error?: string } } }
      message.error(error.response?.data?.error || 'Failed to reset password')
    }
  }, [resetPasswordMutation.isError, resetPasswordMutation.error, message])

  const onFinish = (values: { password: string }) => {
    if (!token) return message.error('This reset link is invalid')
    resetPasswordMutation.mutate({ token, password: values.password })
  }

  return (
    <MarketplaceAuthFrame
      eyebrow="Account recovery"
      title="A strong password keeps your store moving safely."
      description="Choose a new password for your connected marketplace and fulfilment workspace."
    >
      <Card className="kb-seller-auth-card">
        {resetSuccess ? (
          <Result
            status="success"
            title="Password updated"
            subTitle="Your new password is active. We will return you to sign in shortly."
            extra={<Link to="/login"><Button type="primary" icon={<ArrowRightOutlined />} iconPosition="end">Go to sign in</Button></Link>}
          />
        ) : (
          <>
            <div className="kb-seller-auth-heading">
              <Text>Secure reset</Text>
              <Title level={2}>Create a new password</Title>
              <p>Use at least six characters and avoid passwords used elsewhere.</p>
            </div>
            <Form name="reset-password" onFinish={onFinish} layout="vertical" size="large" requiredMark={false}>
              <Form.Item name="password" label="New password" rules={[{ required: true, message: 'Password is required' }, { min: 6, message: 'Use at least 6 characters' }]}>
                <Input.Password prefix={<LockOutlined />} placeholder="Enter a new password" autoComplete="new-password" />
              </Form.Item>
              <Form.Item
                name="confirmPassword"
                label="Confirm password"
                dependencies={['password']}
                rules={[
                  { required: true, message: 'Please confirm your password' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      return !value || getFieldValue('password') === value
                        ? Promise.resolve()
                        : Promise.reject(new Error('Passwords do not match'))
                    },
                  }),
                ]}
              >
                <Input.Password prefix={<LockOutlined />} placeholder="Re-enter your password" autoComplete="new-password" />
              </Form.Item>
              <Button type="primary" htmlType="submit" block loading={resetPasswordMutation.isPending} className="kb-seller-auth-submit">
                {resetPasswordMutation.isPending ? 'Updating password...' : 'Update password'}
              </Button>
              <p className="kb-seller-auth-switch"><Link to="/login"><ArrowLeftOutlined /> Back to sign in</Link></p>
            </Form>
          </>
        )}
      </Card>
    </MarketplaceAuthFrame>
  )
}

export default ResetPassword
