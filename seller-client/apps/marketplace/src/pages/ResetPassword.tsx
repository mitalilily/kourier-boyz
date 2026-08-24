import { ArrowLeftOutlined, ArrowRightOutlined, CheckCircleOutlined, LockOutlined } from '@ant-design/icons'
import { App, Button, Card, Form, Input, Result, Typography } from 'antd'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useResetPassword } from '../api/authQueries'

const { Title, Text } = Typography

const ResetPassword = () => {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const { message } = App.useApp()
  const resetPasswordMutation = useResetPassword()
  const [resetSuccess, setResetSuccess] = useState(false)
  const [form] = Form.useForm()

  useEffect(() => {
    if (resetPasswordMutation.isSuccess) {
      setResetSuccess(true)
      setTimeout(() => navigate('/login'), 3000)
    }
  }, [resetPasswordMutation.isSuccess, navigate])

  useEffect(() => {
    if (resetPasswordMutation.isError) {
      const error = resetPasswordMutation.error as { response?: { data?: { error?: string } } }
      message.error(error.response?.data?.error || 'Failed to reset password')
    }
  }, [resetPasswordMutation.isError, resetPasswordMutation.error, message])

  const onFinish = (values: { password: string; confirmPassword: string }) => {
    if (!token) {
      message.error('Invalid reset token')
      return
    }
    resetPasswordMutation.mutate({ token, password: values.password })
  }

  if (resetSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 p-4 sm:p-6 lg:p-8 relative overflow-hidden">
        {/* Grid Pattern Background */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='0.02'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            maskImage: 'linear-gradient(0deg, white, transparent)',
          }}
        />

        {/* Dots Pattern Background */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `radial-gradient(circle, rgb(0, 0, 0) 1px, transparent 1px)`,
            backgroundSize: '20px 20px',
          }}
        />

        <div className="relative z-10 w-full max-w-lg">
          <Card className="bg-white/95 backdrop-blur-sm shadow-xl border border-slate-200/50 rounded-3xl">
            <Result
              status="success"
              icon={
                <div className="flex justify-center mb-4">
                  <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-emerald-600 rounded-full flex items-center justify-center shadow-lg">
                    <CheckCircleOutlined className="text-5xl text-white" />
                  </div>
                </div>
              }
              title={
                <Title level={2} className="!mb-2 !text-slate-900">
                  Password Reset Successfully!
                </Title>
              }
              subTitle={
                <Text className="text-sm text-slate-600">
                  Your password has been updated. Redirecting you to login page...
                </Text>
              }
              extra={[
                <Link to="/login" key="login">
                  <Button
                    type="primary"
                    size="large"
                    className="h-11 rounded-xl"
                    icon={<ArrowRightOutlined />}
                    iconPosition="end"
                  >
                    Go to Login
                  </Button>
                </Link>,
              ]}
            />
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 p-4 sm:p-6 lg:p-8 relative overflow-hidden">
      {/* Grid Pattern Background */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='0.02'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          maskImage: 'linear-gradient(0deg, white, transparent)',
        }}
      />

      {/* Dots Pattern Background */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `radial-gradient(circle, rgb(0, 0, 0) 1px, transparent 1px)`,
          backgroundSize: '20px 20px',
        }}
      />

      <div className="relative z-10 w-full max-w-lg">
        <Card className="bg-white/95 backdrop-blur-sm shadow-xl border border-slate-200/50 rounded-3xl">
          <div className="px-6 pt-6 pb-4 text-center space-y-1">
            <img
              src="/store/brand/kourier-boyz-logo-transparent.png"
              alt="Kourier Boyz"
              className="w-24 h-14 object-contain mb-3 mx-auto drop-shadow-lg"
            />
            <Title level={2} className="!mb-2 !text-2xl !text-slate-900">
              Create New Password
            </Title>
            <Text className="text-sm text-slate-600">Enter your new password below</Text>
          </div>

          <div className="px-6 pb-6">
            <Form
              form={form}
              name="reset-password"
              onFinish={onFinish}
              layout="vertical"
              size="large"
              requiredMark={false}
            >
              <Form.Item
                name="password"
                label={<span className="text-sm text-slate-700">New Password</span>}
                rules={[
                  { required: true, message: 'Password is required' },
                  { min: 6, message: 'Password must be at least 6 characters' },
                ]}
              >
                <Input.Password
                  prefix={<LockOutlined className="text-slate-400" />}
                  placeholder="Enter new password"
                  className="h-11 rounded-2xl"
                  styles={{
                    input: {
                      borderRadius: '1rem',
                    },
                  }}
                />
              </Form.Item>

              <Form.Item
                name="confirmPassword"
                label={<span className="text-sm text-slate-700">Confirm Password</span>}
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
              >
                <Input.Password
                  prefix={<LockOutlined className="text-slate-400" />}
                  placeholder="Confirm new password"
                  className="h-11 rounded-2xl"
                  styles={{
                    input: {
                      borderRadius: '1rem',
                    },
                  }}
                />
              </Form.Item>

              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  block
                  loading={resetPasswordMutation.isPending}
                  size="large"
                  className="h-11 rounded-xl mt-2"
                >
                  {resetPasswordMutation.isPending ? 'Resetting Password...' : 'Reset Password'}
                </Button>
              </Form.Item>
            </Form>

            <div className="mt-4 text-center">
              <Link
                to="/login"
                className="text-sm text-slate-600 hover:text-slate-900 transition-colors inline-flex items-center gap-1.5"
              >
                <ArrowLeftOutlined /> Back to Login
              </Link>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}

export default ResetPassword
