import { FileTextOutlined } from '@ant-design/icons'
import { Spin, Tabs } from 'antd'
import { Suspense, lazy, useCallback, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ErrorBoundary } from '../components/ErrorBoundary'

// Lazy load settings components for code splitting
const BrandingSettings = lazy(() => import('../components/settings/BrandingSettings'))
const AboutUsSettings = lazy(() => import('../components/settings/AboutUsSettings'))
const InvoiceSettingsTab = lazy(() => import('../components/settings/InvoiceSettings'))
const SLASettings = lazy(() => import('../components/settings/SLASettings'))
const FooterSettings = lazy(() => import('../components/settings/FooterSettings'))

const LoadingFallback = () => (
  <div className="flex items-center justify-center py-10">
    <Spin />
  </div>
)

function TabContentWithBoundary({
  children,
  retryKey,
  onRetry,
}: {
  children: React.ReactNode
  retryKey: number
  onRetry: () => void
}) {
  return (
    <ErrorBoundary key={retryKey} onRetry={onRetry} subTitle="If the problem continues, refresh the page.">
      <Suspense fallback={<LoadingFallback />}>{children}</Suspense>
    </ErrorBoundary>
  )
}

const Settings = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const tabFromUrl = searchParams.get('tab') || 'branding'
  const [retryKeys, setRetryKeys] = useState<Record<string, number>>({})

  const handleTabChange = (key: string) => {
    setSearchParams({ tab: key })
  }

  const handleRetry = useCallback((tabKey: string) => {
    setRetryKeys((prev) => ({ ...prev, [tabKey]: (prev[tabKey] ?? 0) + 1 }))
  }, [])

  return (
    <div className="space-y-6">
      <Tabs
        activeKey={tabFromUrl}
        onChange={handleTabChange}
        items={[
          {
            key: 'branding',
            label: 'Invoice & Label Branding',
            children: (
              <TabContentWithBoundary
                retryKey={retryKeys['branding'] ?? 0}
                onRetry={() => handleRetry('branding')}
              >
                <BrandingSettings />
              </TabContentWithBoundary>
            ),
          },
          {
            key: 'about-us',
            label: 'About Us Page',
            children: (
              <TabContentWithBoundary
                retryKey={retryKeys['about-us'] ?? 0}
                onRetry={() => handleRetry('about-us')}
              >
                <AboutUsSettings />
              </TabContentWithBoundary>
            ),
          },
          {
            key: 'invoice',
            label: 'Invoice Settings',
            icon: <FileTextOutlined />,
            children: (
              <TabContentWithBoundary
                retryKey={retryKeys['invoice'] ?? 0}
                onRetry={() => handleRetry('invoice')}
              >
                <InvoiceSettingsTab />
              </TabContentWithBoundary>
            ),
          },
          {
            key: 'sla',
            label: 'SLA / TAT Settings',
            children: (
              <TabContentWithBoundary
                retryKey={retryKeys['sla'] ?? 0}
                onRetry={() => handleRetry('sla')}
              >
                <SLASettings />
              </TabContentWithBoundary>
            ),
          },
          {
            key: 'footer',
            label: 'Buyer Footer Settings',
            children: (
              <TabContentWithBoundary
                retryKey={retryKeys['footer'] ?? 0}
                onRetry={() => handleRetry('footer')}
              >
                <FooterSettings />
              </TabContentWithBoundary>
            ),
          },
        ]}
      />
    </div>
  )
}

export default Settings
