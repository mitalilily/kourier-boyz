import { useEffect, useRef } from 'react'
import { toast } from 'sonner'

export const useNetworkStatus = () => {
  const wasOnlineRef = useRef(navigator.onLine)
  const offlineToastIdRef = useRef<string | number | null>(null)

  useEffect(() => {
    const handleOnline = () => {
    if (!wasOnlineRef.current) {
        // Dismiss the offline toast if it exists
        if (offlineToastIdRef.current !== null) {
          toast.dismiss(offlineToastIdRef.current)
          offlineToastIdRef.current = null
        }

        // Small delay to ensure offline toast is dismissed before showing online toast
        setTimeout(() => {
          toast.success('You are back online!', {
            position: 'bottom-center',
            duration: 3000,
          })
        }, 100)

        wasOnlineRef.current = true
      }
    }

    const handleOffline = () => {
      if (wasOnlineRef.current) {
        // Only show offline toast if we don't already have one
        if (offlineToastIdRef.current === null) {
          const toastId = toast.error('You are offline. Please connect to the internet.', {
            position: 'bottom-center',
            duration: Infinity, // Never auto-close
          })
          offlineToastIdRef.current = toastId
        }
        wasOnlineRef.current = false
      }
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Check initial status on mount
    if (!navigator.onLine) {
      const toastId = toast.error('You are offline. Please connect to the internet.', {
        position: 'bottom-center',
        duration: Infinity, // Never auto-close
      })
      offlineToastIdRef.current = toastId
      wasOnlineRef.current = false
    }

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      // Clean up toast on unmount
      if (offlineToastIdRef.current !== null) {
        toast.dismiss(offlineToastIdRef.current)
      }
    }
  }, [])

  return navigator.onLine
}
