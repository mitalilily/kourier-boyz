import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useSocket } from '@/hooks/useSocket'
import { checkOrderStatus } from '@/api/payments'
import { CheckCircle2, Clock, Loader2, Sparkles, Wifi, WifiOff, XCircle } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

interface PaymentWaitingStateProps {
  razorpayOrderId: string
  onOrderCreated: (orderIds: string[]) => void
  onCancel?: () => void
}

export const PaymentWaitingState: React.FC<PaymentWaitingStateProps> = ({
  razorpayOrderId,
  onOrderCreated,
  onCancel,
}) => {
  const { socket, isConnected } = useSocket()
  const [status, setStatus] = useState<'waiting' | 'processing' | 'success' | 'failed'>('waiting')
  const [pollCount, setPollCount] = useState(0)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isChecking, setIsChecking] = useState(true) // Track initial check
  const orderCreatedRef = useRef(false)
  const socketHandledRef = useRef(false)

  // Immediate check on mount (for page refresh recovery)
  useEffect(() => {
    const checkStatusImmediately = async () => {
      if (!razorpayOrderId || orderCreatedRef.current) return

      try {
        const result = await checkOrderStatus(razorpayOrderId)

        if (result.success && result.data) {
          if (result.data.status === 'order_created' && result.data.orders) {
            // Order already created
            orderCreatedRef.current = true
            setStatus('success')
            setIsChecking(false)
            const orderIds = result.data.orders.map((o: any) => o._id)
            setTimeout(() => {
              onOrderCreated(orderIds)
            }, 1000)
            return
          } else if (result.data.status === 'paid') {
            // Payment confirmed, order creation in progress
            setStatus('processing')
            setIsChecking(false)
            return
          } else if (result.data.status === 'failed') {
            // Payment failed
            setStatus('failed')
            setErrorMessage('Payment failed. Please try again.')
            setIsChecking(false)
            return
          } else if (result.data.status === 'pending') {
            // Still pending
            setStatus('waiting')
            setIsChecking(false)
            return
          }
        }
        setIsChecking(false)
      } catch (error) {
        console.error('[PaymentWaitingState] Error checking status on mount:', error)
        // Don't fail immediately - let polling handle it
        setIsChecking(false)
      }
    }

    checkStatusImmediately()
  }, [razorpayOrderId, onOrderCreated])

  // Socket event handler (primary method - real-time)
  useEffect(() => {
    if (!socket || socketHandledRef.current) return

    const handleOrderCreated = (data: {
      razorpayOrderId: string
      orderIds: string[]
      orderNumbers: string[]
      timestamp: string
    }) => {
      if (data.razorpayOrderId === razorpayOrderId && !orderCreatedRef.current) {
        console.log('[PaymentWaitingState] Order created via socket', data)
        orderCreatedRef.current = true
        socketHandledRef.current = true
        setStatus('success')
        // Small delay to show success state
        setTimeout(() => {
          onOrderCreated(data.orderIds)
        }, 1000)
      }
    }

    const handlePaymentConfirmed = (data: {
      orderId: string
      orderNumber: string
      razorpayOrderId: string
      paymentStatus: string
      timestamp: string
    }) => {
      if (data.razorpayOrderId === razorpayOrderId && !orderCreatedRef.current) {
        console.log('[PaymentWaitingState] Payment confirmed via socket', data)
        setStatus('processing')
        // Payment confirmed, order creation should follow soon
      }
    }

    if (socket.connected) {
      socket.on('order:created', handleOrderCreated)
      socket.on('order:payment_confirmed', handlePaymentConfirmed)
    } else {
      // Wait for connection
      socket.on('connect', () => {
        socket.on('order:created', handleOrderCreated)
        socket.on('order:payment_confirmed', handlePaymentConfirmed)
      })
    }

    return () => {
      socket.off('order:created', handleOrderCreated)
      socket.off('order:payment_confirmed', handlePaymentConfirmed)
    }
  }, [socket, razorpayOrderId, onOrderCreated])

  // Polling fallback (only if socket is not connected or after delay)
  useEffect(() => {
    // If socket handled it, skip polling
    if (socketHandledRef.current || orderCreatedRef.current) return
    // Wait for initial check to complete
    if (isChecking) return

    let pollInterval: NodeJS.Timeout | null = null
    let timeoutId: NodeJS.Timeout | null = null
    let isMounted = true
    // Start polling after a short delay (initial check already happened)
    const pollDelay = isConnected ? 2000 : 500

    const pollForOrder = async () => {
      try {
        const result = await checkOrderStatus(razorpayOrderId)

        if (!isMounted || orderCreatedRef.current) return

        if (result.success && result.data) {
          const data = result.data
          if (data.status === 'order_created' && data.orders) {
            orderCreatedRef.current = true
            setStatus('success')
            if (pollInterval) clearInterval(pollInterval)
            if (timeoutId) clearTimeout(timeoutId)
            // Small delay to show success state
            const orderIds = data.orders.map((o) => o._id)
            setTimeout(() => {
              if (isMounted) {
                onOrderCreated(orderIds)
              }
            }, 1000)
            return
          } else if (data.status === 'failed') {
            setStatus('failed')
            setErrorMessage('Payment failed. Please try again.')
            if (pollInterval) clearInterval(pollInterval)
            if (timeoutId) clearTimeout(timeoutId)
            return
          } else if (data.status === 'paid') {
            setStatus('processing')
          }
        }

        setPollCount((prev) => prev + 1)
      } catch (error) {
        console.error('Error polling order status:', error)
        // Don't fail immediately on network errors - keep polling
        if (pollCount > 15) {
          // After 15 failed polls, show error
          setStatus('failed')
          setErrorMessage('Unable to confirm order status. Please check your orders page.')
          if (pollInterval) clearInterval(pollInterval)
          if (timeoutId) clearTimeout(timeoutId)
        }
      }
    }

    // Start polling after delay (give socket time to work first)
    const startPolling = setTimeout(() => {
      if (!orderCreatedRef.current && isMounted) {
        pollForOrder() // Initial poll
        // Poll every 2 seconds (less frequent since socket is primary)
        pollInterval = setInterval(pollForOrder, 2000)
      }
    }, pollDelay)

    // Timeout after 45 seconds
    timeoutId = setTimeout(() => {
      if (isMounted && !orderCreatedRef.current) {
        setStatus('failed')
        setErrorMessage(
          'Order confirmation is taking longer than expected. Please check your orders page or contact support.',
        )
        if (pollInterval) clearInterval(pollInterval)
      }
    }, 45000)

    return () => {
      isMounted = false
      clearTimeout(startPolling)
      if (pollInterval) clearInterval(pollInterval)
      if (timeoutId) clearTimeout(timeoutId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [razorpayOrderId, onOrderCreated, isConnected, isChecking])

  if (status === 'success') {
    return (
      <Card className="relative overflow-hidden border-2 md:pt-36 pt-4 border-green-300 bg-gradient-to-br from-green-50 via-emerald-50 to-green-100 shadow-lg shadow-green-200/50">
        <div className="absolute inset-0 bg-gradient-to-r from-green-400/10 via-transparent to-emerald-400/10 animate-pulse" />
        <CardContent className="relative p-8 text-center">
          <div className="relative inline-block mb-6">
            <div className="absolute inset-0 bg-green-400 rounded-full blur-2xl opacity-30 animate-ping" />
            <CheckCircle2 className="relative w-16 h-16 text-green-600 mx-auto animate-in zoom-in duration-500" />
          </div>
          <div className="space-y-3">
            <h3 className="text-2xl font-bold text-green-900 mb-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
              Order Confirmed! 🎉
            </h3>
            <p className="text-base text-green-700 font-medium animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
              Your order has been successfully placed
            </p>
            <div className="flex items-center justify-center gap-2 mt-4 text-sm text-green-600 animate-in fade-in duration-700 delay-200">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Redirecting to your orders...</span>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (status === 'failed') {
    return (
      <Card className="relative overflow-hidden border-2  md:pt-36 pt-4 border-red-300 bg-gradient-to-br from-red-50 via-rose-50 to-red-100 shadow-lg shadow-red-200/50">
        <div className="absolute inset-0 bg-gradient-to-r from-red-400/10 via-transparent to-rose-400/10" />
        <CardContent className="relative p-8 text-center">
          <div className="relative inline-block mb-6">
            <div className="absolute inset-0 bg-red-400 rounded-full blur-2xl opacity-20" />
            <XCircle className="relative w-16 h-16 text-red-600 mx-auto animate-in zoom-in duration-500" />
          </div>
          <div className="space-y-4">
            <h3 className="text-2xl font-bold text-red-900 mb-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
              Order Confirmation Failed
            </h3>
            <p className="text-base text-red-700 font-medium max-w-md mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
              {errorMessage ||
                'We encountered an issue confirming your order. Please try again or contact support.'}
            </p>
            {onCancel && (
              <div className="pt-2 animate-in fade-in duration-700 delay-200">
                <Button
                  variant="outline"
                  onClick={onCancel}
                  className="mt-4 border-red-300 text-red-700 hover:bg-red-100 hover:text-red-900 transition-colors"
                >
                  Go Back
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  const progressPercentage = Math.min(((pollCount * 2) / 45) * 100, 100)

  // Show loading state during initial check (prevents blank page on refresh)
  if (isChecking) {
    return (
      <Card className="relative overflow-hidden md:pt-36 pt-4 border-2 border-blue-300 bg-gradient-to-br from-blue-50 via-indigo-50 to-blue-100 shadow-lg shadow-blue-200/50">
        <CardContent className="relative p-8 text-center">
          <div className="relative inline-block mb-6">
            <div className="absolute inset-0 bg-blue-400 rounded-full blur-2xl opacity-30 animate-pulse" />
            <Loader2 className="relative w-16 h-16 text-blue-600 mx-auto animate-spin" />
          </div>
          <div className="space-y-4">
            <h3 className="text-2xl font-bold text-blue-900 mb-2">
              Checking Order Status...
            </h3>
            <p className="text-base text-blue-700 font-medium max-w-md mx-auto">
              Please wait while we verify your payment status.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="relative overflow-hidden  md:pt-36 pt-4 border-2 border-blue-300 bg-gradient-to-br from-blue-50 via-indigo-50 to-blue-100 shadow-lg shadow-blue-200/50">
      {/* Animated background gradient */}
      <div
        className="absolute inset-0 bg-gradient-to-r from-blue-400/10 via-indigo-400/10 to-blue-400/10"
        style={{
          animation: 'shimmer 3s ease-in-out infinite',
          backgroundSize: '200% 100%',
        }}
      />

      <CardContent className="relative p-8  text-center">
        {/* Icon with animated background */}
        <div className="relative inline-block mb-6">
          <div className="absolute inset-0 bg-blue-400 rounded-full blur-2xl opacity-30 animate-pulse" />
          {status === 'processing' ? (
            <div className="relative">
              <Sparkles className="w-16 h-16 text-blue-600 mx-auto animate-in zoom-in duration-500" />
              <Loader2 className="absolute inset-0 w-16 h-16 text-blue-400 mx-auto animate-spin opacity-50" />
            </div>
          ) : (
            <Loader2 className="relative w-16 h-16 text-blue-600 mx-auto animate-spin" />
          )}
        </div>

        {/* Content */}
        <div className="space-y-4">
          <h3 className="text-2xl font-bold text-blue-900 mb-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {status === 'processing'
              ? 'Processing Your Order...'
              : 'Waiting for Payment Confirmation...'}
          </h3>

          <p className="text-base text-blue-700 font-medium max-w-md mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
            {status === 'processing'
              ? "Your payment is confirmed! We're now creating your order..."
              : "Your payment was successful! We're confirming your order with the payment gateway."}
          </p>

          {/* Connection status indicator */}
          <div className="flex items-center justify-center gap-2 text-sm text-blue-600 mt-4 animate-in fade-in duration-700 delay-200">
            {isConnected ? (
              <>
                <Wifi className="w-4 h-4 text-green-500" />
                <span className="font-medium">Real-time connection active</span>
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4 text-amber-500" />
                <span>Using polling mode</span>
              </>
            )}
          </div>

          {/* Progress indicator */}
          {pollCount > 0 && !socketHandledRef.current && (
            <div className="mt-6 space-y-2 animate-in fade-in duration-700 delay-300">
              <div className="flex items-center justify-between text-xs text-blue-600 px-2">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Checking status...
                </span>
                <span className="font-medium">{pollCount * 2}s</span>
              </div>
              <div className="w-full max-w-xs mx-auto h-2 bg-blue-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
            </div>
          )}

          {/* Helpful message */}
          <p className="text-xs text-blue-500 mt-4 animate-in fade-in duration-700 delay-300">
            {isConnected
              ? "You'll be notified instantly when your order is ready"
              : "This usually takes a few seconds. Please don't close this page."}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
