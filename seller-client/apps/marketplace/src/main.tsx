import { message, notification } from 'antd'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Suppress harmless COOP (Cross-Origin-Opener-Policy) warnings from @react-oauth/google
// These warnings occur when the library tries to check window.closed on OAuth popups,
// but they don't affect functionality since the library uses postMessage for communication.
if (typeof window !== 'undefined') {
  const originalError = console.error
  console.error = (...args: unknown[]) => {
    const logMessage = args[0]?.toString() || ''
    // Suppress COOP-related warnings from @react-oauth/google
    if (
      logMessage.includes('Cross-Origin-Opener-Policy') &&
      logMessage.includes('window.closed')
    ) {
      // Suppress this specific warning - it's harmless
      return
    }
    originalError.apply(console, args)
  }
}

message.config({
  top: 72,
  duration: 3,
  maxCount: 3,
})

notification.config({
  placement: 'topRight',
  top: 72,
  duration: 4,
})

createRoot(document.getElementById('root')!).render(<App />)
