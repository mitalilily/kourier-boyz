import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { I18nextProvider } from 'react-i18next'
import { Toaster } from 'sonner'
import App from './App'
import { GOOGLE_CLIENT_ID } from './config/googleAuth'
import i18n from './i18n'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <I18nextProvider i18n={i18n}>
          <App />
          <Toaster position="bottom-right" />
        </I18nextProvider>
      </GoogleOAuthProvider>
    </QueryClientProvider>
  </React.StrictMode>,
)
