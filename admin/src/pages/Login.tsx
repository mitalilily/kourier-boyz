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
import { useSearchParams } from 'react-router-dom'
import { useLogin } from '../api/auth'
import {
  ADMIN_WORKSPACE_STORAGE,
  getAdminWorkspaceDestination,
  hasAdminWorkspaceSession,
  type AdminWorkspace,
} from '../config/adminWorkspace'
import { useAuthStore } from '../store/authStore'

const { Title, Text } = Typography

const Login = () => {
  const [form] = Form.useForm()
  const loginMutation = useLogin()
  const [searchParams] = useSearchParams()
  const token = useAuthStore((state) => state.token)

  const requestedWorkspace: AdminWorkspace =
    searchParams.get('workspace') === 'logistics' ? 'logistics' : 'marketplace'

  const enterWorkspace = (workspace: AdminWorkspace) => {
    localStorage.setItem(ADMIN_WORKSPACE_STORAGE.active, workspace)
    window.location.replace(getAdminWorkspaceDestination(workspace))
  }

  useEffect(() => {
    if (loginMutation.isPending) return

    if (hasAdminWorkspaceSession(requestedWorkspace)) {
      enterWorkspace(requestedWorkspace)
      return
    }

    if (token) enterWorkspace('marketplace')
  }, [loginMutation.isPending, requestedWorkspace, token])

  const onFinish = (values: { email: string; password: string }) => {
    loginMutation.mutate(values, {
      onSuccess: (session) => {
        if (requestedWorkspace === 'logistics' && session.logistics) {
          enterWorkspace('logistics')
          return
        }

        if (session.marketplace) {
          enterWorkspace('marketplace')
          return
        }

        enterWorkspace('logistics')
      },
      onError: (err: unknown) => {
        message.error(err instanceof Error ? err.message : 'Login failed')
      },
    })
  }

  return (
    <main className="min-h-screen flex bg-[#f5f6f4] text-[#202321]" style={{ colorScheme: 'light' }}>
      <section className="hidden lg:flex lg:w-[52%] relative overflow-hidden border-r border-[#d9dcda] bg-[#eef0ed] text-[#202321]">
        <div
          className="absolute inset-0 opacity-70"
          style={{
            backgroundImage:
              'linear-gradient(rgba(101,109,105,0.09) 1px, transparent 1px), linear-gradient(90deg, rgba(101,109,105,0.09) 1px, transparent 1px), repeating-linear-gradient(135deg, transparent 0 52px, rgba(183,129,21,0.11) 52px 54px)',
            backgroundSize: '44px 44px, 44px 44px, 120px 120px',
          }}
        />
        <div className="absolute inset-y-0 right-0 w-1 bg-[#d8b24a]" />

        <div className="relative z-10 flex w-full items-center justify-center px-14 py-12">
          <div className="w-full max-w-xl">
            <img
              src="/brand/kourier-boyz-logo-transparent.png"
              alt="Kourier Boyz"
              className="w-full max-w-[500px] rounded-md border border-[#d1d5d2] bg-white px-6 py-4 object-contain shadow-[0_16px_42px_rgba(32,35,33,0.12)]"
            />

            <div className="mt-14 max-w-lg">
              <p className="text-sm font-semibold uppercase text-[#dfb743]">
                Unified operations
              </p>
              <h1 className="mt-3 text-4xl font-bold leading-tight text-[#202321]">
                Every order, seller and shipment in one command center.
              </h1>
              <p className="mt-5 max-w-md text-base leading-7 text-[#626966]">
                Manage marketplace growth and courier performance with one secure Kourier Boyz
                workspace.
              </p>
            </div>

            <div className="mt-12 grid grid-cols-3 border-y border-[#cfd3d0]">
              <div className="py-5 pr-4">
                <ShopOutlined className="text-xl text-[#dfb743]" />
                <p className="mt-2 text-sm font-medium text-[#303532]">Marketplace</p>
              </div>
              <div className="border-x border-[#cfd3d0] px-5 py-5">
                <TruckOutlined className="text-xl text-[#dfb743]" />
                <p className="mt-2 text-sm font-medium text-[#303532]">Logistics</p>
              </div>
              <div className="py-5 pl-5">
                <BarChartOutlined className="text-xl text-[#dfb743]" />
                <p className="mt-2 text-sm font-medium text-[#303532]">Performance</p>
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
              src="/brand/kourier-boyz-logo-transparent.png"
              alt="Kourier Boyz"
              className="mx-auto w-full max-w-[330px] rounded-md border border-[#d9dcda] bg-[#fffefb] px-4 py-3 object-contain shadow-sm"
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
                One secure sign-in for marketplace and courier operations.
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
              <Text className="text-sm !text-[#626966]">
                Access is granted independently for each workspace
              </Text>
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
