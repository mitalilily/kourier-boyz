import {
  BarChartOutlined,
  LockOutlined,
  MailOutlined,
  SafetyOutlined,
  ShopOutlined,
  TruckOutlined,
} from '@ant-design/icons'
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
      onError: (err: unknown) => {
        const axiosError = err as { response?: { data?: { error?: string } } }
        message.error(axiosError.response?.data?.error || 'Login failed')
      },
    })
  }

  return (
    <main className="min-h-screen flex bg-[#f5f6f4]">
      <section className="hidden lg:flex lg:w-[52%] relative overflow-hidden bg-[#202321] text-white">
        <div
          className="absolute inset-0 opacity-70"
          style={{
            backgroundImage:
              'linear-gradient(rgba(207,211,209,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(207,211,209,0.08) 1px, transparent 1px), repeating-linear-gradient(135deg, transparent 0 52px, rgba(223,183,67,0.08) 52px 54px)',
            backgroundSize: '44px 44px, 44px 44px, 120px 120px',
          }}
        />
        <div className="absolute inset-y-0 right-0 w-1 bg-[#d8b24a]" />

        <div className="relative z-10 flex w-full items-center justify-center px-14 py-12">
          <div className="w-full max-w-xl">
            <img
              src="/brand/kourier-boyz-logo-nav-cropped.png"
              alt="Kourier Boyz"
              className="w-full max-w-[500px] object-contain"
            />

            <div className="mt-14 max-w-lg">
              <p className="text-sm font-semibold uppercase text-[#dfb743]">
                Unified operations
              </p>
              <h1 className="mt-3 text-4xl font-bold leading-tight text-white">
                Every order, seller and shipment in one command center.
              </h1>
              <p className="mt-5 max-w-md text-base leading-7 text-[#ced2d0]">
                Manage marketplace growth and courier performance with one secure Kourier Boyz
                workspace.
              </p>
            </div>

            <div className="mt-12 grid grid-cols-3 border-y border-white/15">
              <div className="py-5 pr-4">
                <ShopOutlined className="text-xl text-[#dfb743]" />
                <p className="mt-2 text-sm font-medium text-white">Marketplace</p>
              </div>
              <div className="border-x border-white/15 px-5 py-5">
                <TruckOutlined className="text-xl text-[#dfb743]" />
                <p className="mt-2 text-sm font-medium text-white">Logistics</p>
              </div>
              <div className="py-5 pl-5">
                <BarChartOutlined className="text-xl text-[#dfb743]" />
                <p className="mt-2 text-sm font-medium text-white">Performance</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        className="flex w-full items-center justify-center p-6 lg:w-[48%]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgba(85,93,97,0.14) 1px, transparent 0)',
          backgroundSize: '24px 24px',
        }}
      >
        <div className="w-full max-w-md">
          <div className="mb-8 text-center lg:hidden">
            <img
              src="/brand/kourier-boyz-logo-nav-cropped.png"
              alt="Kourier Boyz"
              className="mx-auto w-full max-w-[330px] object-contain"
            />
          </div>

          <Card
            className="overflow-hidden rounded-lg border border-[#d9dcda] shadow-[0_24px_70px_rgba(32,35,33,0.12)]"
            styles={{ body: { padding: '2.5rem' } }}
          >
            <div className="mb-8">
              <Text className="text-sm font-semibold uppercase !text-[#9b7119]">
                Administration
              </Text>
              <Title level={2} className="!mb-2 !mt-2 !text-3xl !font-bold !text-[#202321]">
                Welcome back
              </Title>
              <Text className="text-base !text-[#626966]">
                Sign in with your authorized admin account.
              </Text>
            </div>

            <Form form={form} layout="vertical" onFinish={onFinish} size="large">
              <Form.Item
                name="email"
                label="Email address"
                rules={[
                  { required: true, message: 'Please enter your email' },
                  { type: 'email', message: 'Please enter a valid email' },
                ]}
              >
                <Input
                  prefix={<MailOutlined className="text-[#7f8783]" />}
                  placeholder="admin@kourierboyz.com"
                  className="h-12 rounded-md border-[#ced2d0]"
                />
              </Form.Item>

              <Form.Item
                name="password"
                label="Password"
                rules={[{ required: true, message: 'Please enter your password' }]}
              >
                <Input.Password
                  prefix={<LockOutlined className="text-[#7f8783]" />}
                  placeholder="Enter your password"
                  className="h-12 rounded-md border-[#ced2d0]"
                />
              </Form.Item>

              <Form.Item className="!mb-0 !mt-7">
                <Button
                  type="primary"
                  htmlType="submit"
                  block
                  loading={loginMutation.isPending}
                  className="h-12 rounded-md border-0 !bg-[#b78115] text-base font-semibold !text-white shadow-[0_10px_28px_rgba(183,129,21,0.22)] transition-all duration-300 hover:!-translate-y-0.5 hover:!bg-[#8f650f]"
                >
                  {loginMutation.isPending ? 'Signing in...' : 'Sign in'}
                </Button>
              </Form.Item>
            </Form>

            <div className="mt-8 flex items-center justify-center gap-2 border-t border-[#e4e7e5] pt-6">
              <SafetyOutlined className="text-[#8f650f]" />
              <Text className="text-sm !text-[#626966]">Secure admin access</Text>
            </div>
          </Card>

          <p className="mt-6 text-center text-xs text-[#7f8783]">
            &copy; {new Date().getFullYear()} Kourier Boyz. All rights reserved.
          </p>
        </div>
      </section>
    </main>
  )
}

export default Login
