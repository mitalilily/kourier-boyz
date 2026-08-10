import { HomeOutlined, ReloadOutlined } from '@ant-design/icons'
import { Button, Result, Typography } from 'antd'
import { useNavigate, useRouteError } from 'react-router-dom'

const { Text } = Typography

/**
 * Renders when a route throws (e.g. lazy load failure).
 * Used as errorElement in createBrowserRouter.
 */
const RouteErrorPage = () => {
  const error = useRouteError() as Error | undefined
  const navigate = useNavigate()
  const message = error?.message ?? 'An unexpected error occurred'
  const isChunkError =
    typeof message === 'string' &&
    (message.includes('Failed to fetch dynamically imported module') ||
      message.includes('Loading chunk'))

  const handleRetry = () => {
    window.location.reload()
  }

  const handleGoHome = () => {
    navigate('/')
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <Result
        status="error"
        title={isChunkError ? 'Failed to load page' : 'Something went wrong'}
        subTitle={
          isChunkError ? (
            <>
              The page could not be loaded. This often happens after a new deployment when your
              browser is still using an old version. Try refreshing the page.
            </>
          ) : (
            <Text type="secondary" className="block mt-2">
              {message}
            </Text>
          )
        }
        extra={[
          <Button key="retry" type="primary" icon={<ReloadOutlined />} onClick={handleRetry}>
            Refresh page
          </Button>,
          <Button key="home" icon={<HomeOutlined />} onClick={handleGoHome}>
            Go to Dashboard
          </Button>,
        ]}
      />
    </div>
  )
}

export default RouteErrorPage
