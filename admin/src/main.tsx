import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { App as AntApp, ConfigProvider } from 'antd'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { Toaster } from 'sonner'
import App from './App'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false } },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ConfigProvider
        theme={{
          token: {
            colorPrimary: '#b78115',
            colorInfo: '#b78115',
            borderRadius: 6,
            fontFamily: "Inter, 'Segoe UI', sans-serif",
          },
          components: {
            Card: { borderRadiusLG: 8 },
            Button: { borderRadius: 6, primaryShadow: '0 8px 20px rgba(183, 129, 21, 0.2)' },
            Menu: { itemBorderRadius: 6, itemSelectedBg: '#f7f2e5', itemSelectedColor: '#8a620d' },
          },
        }}
      >
        <AntApp>
          <App />
          <Toaster position="top-center" richColors />
        </AntApp>
      </ConfigProvider>
    </QueryClientProvider>
  </React.StrictMode>,
)
