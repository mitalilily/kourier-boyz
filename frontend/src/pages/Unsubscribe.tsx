import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import API from '../lib/axios'

const Unsubscribe = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const token = searchParams.get('token')
  const email = searchParams.get('email')

  useEffect(() => {
    const unsubscribe = async () => {
      if (!token && !email) {
        setStatus('error')
        setMessage('Invalid unsubscribe link. Missing token or email.')
        return
      }

      try {
        const params: { token?: string; email?: string } = {}
        if (token) params.token = token
        if (email) params.email = email

        const response = await API.get('/subscribers/unsubscribe', { params })
        setStatus('success')
        setMessage(response.data.message || 'Successfully unsubscribed from promotional emails')
      } catch (error: any) {
        setStatus('error')
        setMessage(
          error.response?.data?.error ||
            'Failed to unsubscribe. Please try again or contact support.',
        )
      }
    }

    unsubscribe()
  }, [token, email])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        <div className="text-center">
          {status === 'loading' && (
            <>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Processing...</h1>
              <p className="text-gray-600">Please wait while we process your unsubscribe request.</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                <svg
                  className="h-6 w-6 text-green-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Unsubscribed Successfully</h1>
              <p className="text-gray-600 mb-6">{message}</p>
              <button
                onClick={() => navigate('/')}
                className="inline-flex items-center px-4 py-2 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Go to Homepage
              </button>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                <svg
                  className="h-6 w-6 text-red-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Unsubscribe Failed</h1>
              <p className="text-gray-600 mb-6">{message}</p>
              <div className="space-y-3">
                <button
                  onClick={() => navigate('/')}
                  className="w-full inline-flex justify-center items-center px-4 py-2 border border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Go to Homepage
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Try Again
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default Unsubscribe

