import { RouterProvider } from 'react-router-dom'
import { router } from './routes'
import { useNetworkStatus } from './hooks/useNetworkStatus'

const App = () => {
  // Monitor network status and show toasts
  useNetworkStatus()

  return <RouterProvider router={router} />
}
export default App
