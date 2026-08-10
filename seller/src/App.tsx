import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { App as AntApp, ConfigProvider } from 'antd'
import AppRoutes from './routes'
import { GOOGLE_CLIENT_ID } from './config/googleAuth'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <ConfigProvider
          theme={{
            token: {
              colorPrimary: '#1890ff',
              colorLink: '#1890ff',
              borderRadius: 12,
              colorBgContainer: '#ffffff',
              colorWarning: '#ffdc3b',
            },
            components: {
              Menu: {
                itemSelectedBg: '#f0f7ff',
                itemSelectedColor: '#1890ff',
                itemHoverBg: '#fafafa',
                itemActiveBg: '#f0f7ff',
                subMenuItemBg: '#fafafa',
                itemMarginInline: 8,
                itemBorderRadius: 8,
                itemHeight: 40,
                groupTitleColor: '#8c8c8c',
                groupTitleFontSize: 11,
                groupTitleLineHeight: '32px',
              },
            },
          }}
        >
          <AntApp>
            <AppRoutes />
          </AntApp>
        </ConfigProvider>
      </GoogleOAuthProvider>
    </QueryClientProvider>
  )
}

export default App
