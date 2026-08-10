import { LockOutlined, MailOutlined, SafetyOutlined } from '@ant-design/icons'
import { Button, Card, Form, Input, message, Typography } from 'antd'
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLogin } from '../api/auth'
import { useAuthStore } from '../store/authStore'

const { Title, Text } = Typography

const Login = () => {
  const [form] = Form.useForm()
  const loginMutation = useLogin()
  const navigate = useNavigate()
  const token = useAuthStore((state) => state.token)

  useEffect(() => {
    if (token) {
      navigate('/dashboard', { replace: true })
    }
  }, [token, navigate])

  const onFinish = (values: { email: string; password: string }) => {
    loginMutation.mutate(values, {
      onSuccess: () => {
        // Navigation will happen automatically via useEffect
      },
      onError: (err: unknown) => {
        const axiosError = err as { response?: { data?: { error?: string } } }
        message.error(axiosError.response?.data?.error || 'Login failed')
      },
    })
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 relative overflow-hidden">
        {/* Animated Background Elements */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-20 left-20 w-72 h-72 bg-white rounded-full mix-blend-overlay animate-[float_6s_ease-in-out_infinite]"></div>
          <div className="absolute top-40 right-20 w-96 h-96 bg-white rounded-full mix-blend-overlay animate-[float_8s_ease-in-out_infinite_2s]"></div>
          <div className="absolute bottom-20 left-1/3 w-80 h-80 bg-white rounded-full mix-blend-overlay animate-[float_7s_ease-in-out_infinite_4s]"></div>
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center justify-center w-full p-12 text-white">
          <div className="max-w-md text-center space-y-8">
            <div>
              <img
                src="/logo-shaded.png"
                alt="Kourier Boyz"
                className="h-20 w-auto object-contain mb-4 mx-auto"
                style={{
                  aspectRatio: 'auto',
                  maxWidth: '100%',
                  height: 'auto',
                  objectFit: 'contain',
                  transform: 'none',
                }}
              />
              <p className="text-xl text-white/90 tracking-wide">Admin Dashboard</p>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-12">
              {[
                { icon: '📊', text: 'Analytics' },
                { icon: '📦', text: 'Orders' },
                { icon: '👥', text: 'Users' },
                { icon: '🏪', text: 'Products' },
              ].map((feature, index) => (
                <div
                  key={index}
                  className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 hover:bg-white/15 hover:scale-105 transition-all duration-300 cursor-default"
                >
                  <div className="text-3xl mb-2">{feature.icon}</div>
                  <div className="text-sm font-medium">{feature.text}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center bg-gray-50 p-6">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-8">
            <img
              src="/logo.png"
              alt="Kourier Boyz"
              className="h-16 w-auto object-contain mx-auto mb-4"
              style={{
                aspectRatio: 'auto',
                maxWidth: '100%',
                height: 'auto',
                objectFit: 'contain',
                transform: 'none',
              }}
            />
          </div>

          <Card
            className="shadow-xl border-0 rounded-2xl overflow-hidden"
            styles={{ body: { padding: '2.5rem' } }}
          >
            {/* Header */}
            <div className="text-center mb-8">
              <Title level={2} className="!mb-2 !text-3xl !font-bold">
                Welcome Back
              </Title>
              <Text className="text-gray-500 text-base">
                Sign in to access your admin dashboard
              </Text>
            </div>

            {/* Form */}
            <Form form={form} layout="vertical" onFinish={onFinish} size="large">
              <Form.Item
                name="email"
                rules={[
                  { required: true, message: 'Please enter your email' },
                  { type: 'email', message: 'Please enter a valid email' },
                ]}
              >
                <Input
                  prefix={<MailOutlined className="text-gray-400" />}
                  placeholder="Email address"
                  className="h-12 rounded-lg"
                />
              </Form.Item>

              <Form.Item
                name="password"
                rules={[{ required: true, message: 'Please enter your password' }]}
              >
                <Input.Password
                  prefix={<LockOutlined className="text-gray-400" />}
                  placeholder="Password"
                  className="h-12 rounded-lg"
                />
              </Form.Item>

              <Form.Item className="!mb-0">
                <Button
                  type="primary"
                  htmlType="submit"
                  block
                  loading={loginMutation.isPending}
                  className="h-12 text-base font-semibold rounded-lg bg-blue-600 border-0 hover:bg-blue-700 transition-all duration-300 hover:shadow-lg hover:scale-[1.02]"
                >
                  {loginMutation.isPending ? 'Signing in...' : 'Sign In'}
                </Button>
              </Form.Item>
            </Form>

            {/* Footer */}
            <div className="mt-8 pt-6 border-t border-gray-100 flex items-center justify-center gap-2 text-gray-500">
              <SafetyOutlined />
              <Text type="secondary" className="text-sm">
                Secure admin access only
              </Text>
            </div>
          </Card>

          {/* Additional Info */}
          <div className="mt-6 text-center">
            <Text type="secondary" className="text-xs">
              © 2025 KOURIER_BOYZ. All rights reserved.
            </Text>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login
