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
              colorPrimary: '#B78115',
              colorLink: '#8F650F',
              borderRadius: 6,
              colorBgContainer: '#ffffff',
              colorWarning: '#DFB743',
              colorText: '#202321',
              colorTextSecondary: '#6A706D',
              colorBorder: '#D9DCDA',
              fontFamily: 'Manrope, Segoe UI, sans-serif',
            },
            components: {
              Menu: {
                itemSelectedBg: '#F7F2E5',
                itemSelectedColor: '#8F650F',
                itemHoverBg: '#F1F2F0',
                itemActiveBg: '#F7F2E5',
                subMenuItemBg: '#F8F8F6',
                itemMarginInline: 8,
                itemBorderRadius: 4,
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
