import { CalculatorOutlined, DollarOutlined } from '@ant-design/icons'
import { Spin, Tabs } from 'antd'
import { Suspense, lazy } from 'react'
import { useSearchParams } from 'react-router-dom'

// Lazy load calculation settings components
const GSTRoundingSettings = lazy(() => import('../components/settings/GSTRoundingSettings'))
const SettlementCalculationSettings = lazy(
  () => import('../components/settings/SettlementCalculationSettings'),
)

const LoadingFallback = () => (
  <div className="flex items-center justify-center py-10">
    <Spin />
  </div>
)

const Calculations = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const tabFromUrl = searchParams.get('tab') || 'gst-rounding'
  
  const handleTabChange = (key: string) => {
    setSearchParams({ tab: key })
  }

  return (
    <div className="space-y-6">
      <Tabs
        activeKey={tabFromUrl}
        onChange={handleTabChange}
        items={[
          {
            key: 'gst-rounding',
            label: 'GST Rounding',
            icon: <CalculatorOutlined />,
            children: (
              <Suspense fallback={<LoadingFallback />}>
                <GSTRoundingSettings />
              </Suspense>
            ),
          },
          {
            key: 'settlement-calculations',
            label: 'Settlement Calculations',
            icon: <DollarOutlined />,
            children: (
              <Suspense fallback={<LoadingFallback />}>
                <SettlementCalculationSettings />
              </Suspense>
            ),
          },
        ]}
      />
    </div>
  )
}

export default Calculations

