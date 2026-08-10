import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { AlertCircle } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

interface RazorpayEmbeddedCheckoutProps {
  orderId: string
  amount: number
  currency: string
  razorpayKey: string
  onSuccess: (paymentId: string) => void
  onError: (message: string) => void
}

type PaymentMethod = 'card' | 'upi_collect' | 'upi_intent'

declare global {
  interface Window {
    // We intentionally leave Razorpay as `any` so we can construct it from the SDK.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Razorpay?: any
  }
}

export const RazorpayEmbeddedCheckout: React.FC<RazorpayEmbeddedCheckoutProps> = ({
  orderId,
  amount,
  currency,
  razorpayKey,
  onSuccess,
  onError,
}) => {
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('card')
  const [fieldError, setFieldError] = useState<string | null>(null)

  const cardNumberRef = useRef<HTMLDivElement | null>(null)
  const cardExpiryRef = useRef<HTMLDivElement | null>(null)
  const cardCvvRef = useRef<HTMLDivElement | null>(null)
  const upiCollectRef = useRef<HTMLDivElement | null>(null)
  const upiIntentRef = useRef<HTMLDivElement | null>(null)

  // These use loose typing because Razorpay Elements types are not available.
  // We intentionally use `any` here to avoid fighting the type system over SDK internals.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const elementsRef = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cardNumberElRef = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cardExpiryElRef = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cardCvvElRef = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const upiCollectElRef = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const upiIntentElRef = useRef<any>(null)

  // Load Razorpay Elements script
  useEffect(() => {
    if (!orderId || !razorpayKey || !amount) {
      setLoading(false)
      return
    }

    const existing = document.getElementById('razorpay-elements')
    if (existing) {
      setLoading(false)
      return
    }

    const script = document.createElement('script')
    script.id = 'razorpay-elements'
    script.src = 'https://checkout.razorpay.com/v1/elements.js'
    script.async = true
    script.onload = () => setLoading(false)
    script.onerror = () => {
      setLoading(false)
      onError('Unable to load Razorpay. Please try again later.')
    }
    document.body.appendChild(script)
  }, [amount, razorpayKey, orderId, onError])

  // Initialise Elements and mount fields
  useEffect(() => {
    if (loading) return
    if (!window.Razorpay) return
    if (!orderId || !razorpayKey || !amount) return

    try {
      const razorpay = new window.Razorpay({
        key: razorpayKey,
        amount: Math.round(amount * 100),
        currency,
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const elements: any = razorpay.elements()
      elementsRef.current = elements

      // Card fields
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cardNumber: any = elements.create('cardNumber')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cardExpiry: any = elements.create('cardExpiry')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cardCvv: any = elements.create('cardCvv')

      if (cardNumberRef.current) cardNumber.mount(cardNumberRef.current)
      if (cardExpiryRef.current) cardExpiry.mount(cardExpiryRef.current)
      if (cardCvvRef.current) cardCvv.mount(cardCvvRef.current)

      cardNumberElRef.current = cardNumber
      cardExpiryElRef.current = cardExpiry
      cardCvvElRef.current = cardCvv

      // UPI collect and intent
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const upiCollect: any = elements.create('upi', { flow: 'collect' })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const upiIntent: any = elements.create('upi', { flow: 'intent' })

      if (upiCollectRef.current) upiCollect.mount(upiCollectRef.current)
      if (upiIntentRef.current) upiIntent.mount(upiIntentRef.current)

      upiCollectElRef.current = upiCollect
      upiIntentElRef.current = upiIntent
    } catch (err) {
      console.error('Error initialising Razorpay Elements:', err)
      onError('Failed to initialise payment fields. Please refresh and try again.')
    }

    return () => {
      try {
        if (cardNumberElRef.current && typeof cardNumberElRef.current.destroy === 'function') {
          cardNumberElRef.current.destroy()
        }
        if (cardExpiryElRef.current && typeof cardExpiryElRef.current.destroy === 'function') {
          cardExpiryElRef.current.destroy()
        }
        if (cardCvvElRef.current && typeof cardCvvElRef.current.destroy === 'function') {
          cardCvvElRef.current.destroy()
        }
        if (upiCollectElRef.current && typeof upiCollectElRef.current.destroy === 'function') {
          upiCollectElRef.current.destroy()
        }
        if (upiIntentElRef.current && typeof upiIntentElRef.current.destroy === 'function') {
          upiIntentElRef.current.destroy()
        }
      } catch {
        // ignore cleanup errors
      }
    }
  }, [amount, currency, loading, onError, orderId, razorpayKey])

  const handlePayNow = async () => {
    setFieldError(null)

    if (!window.Razorpay || !elementsRef.current) {
      onError('Payment is not ready yet. Please wait a moment and try again.')
      return
    }

    const razorpay = new window.Razorpay({
      key: razorpayKey,
      amount: Math.round(amount * 100),
      currency,
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let selectedElement: any | null = null
    if (selectedMethod === 'card') {
      selectedElement = cardNumberElRef.current
    } else if (selectedMethod === 'upi_collect') {
      selectedElement = upiCollectElRef.current
    } else if (selectedMethod === 'upi_intent') {
      selectedElement = upiIntentElRef.current
    }

    if (!selectedElement) {
      setFieldError('Please select a payment method.')
      return
    }

    setSubmitting(true)
    try {
      // NOTE: The actual API may differ; align this with Razorpay Elements docs.
      const { token, error } = await razorpay.createToken(selectedElement)

      if (error) {
        setFieldError(error.message || 'Payment details are invalid. Please check and try again.')
        setSubmitting(false)
        return
      }

      if (!token) {
        setFieldError('Unable to create payment token. Please try again.')
        setSubmitting(false)
        return
      }

      // Pass token + orderId back to parent; parent will call backend confirm API.
      await onSuccess(token.id || token)
    } catch (err) {
      console.error('Error during payment:', err)
      const anyErr = err as { message?: string } | null
      const message =
        anyErr && typeof anyErr.message === 'string'
          ? anyErr.message
          : 'Payment failed. Please try again.'
      setFieldError(message)
      onError(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card className="border border-gray-200 shadow-sm">
      <CardContent className="p-6 space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Payment</h3>
          <p className="text-xs text-gray-500 mt-1">
            Secure payment powered by Razorpay. We do not store your card details.
          </p>
        </div>

        {loading && <div className="text-sm text-gray-500">Loading secure payment fields…</div>}

        {!loading && (
          <>
            {/* Method selector */}
            <div className="flex gap-2 text-xs font-medium rounded-full bg-gray-100 p-1 w-fit">
              <button
                type="button"
                onClick={() => setSelectedMethod('card')}
                className={cn(
                  'px-3 py-1 rounded-full transition-colors',
                  selectedMethod === 'card'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900',
                )}
              >
                Card
              </button>
              <button
                type="button"
                onClick={() => setSelectedMethod('upi_collect')}
                className={cn(
                  'px-3 py-1 rounded-full transition-colors',
                  selectedMethod === 'upi_collect'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900',
                )}
              >
                UPI ID
              </button>
              <button
                type="button"
                onClick={() => setSelectedMethod('upi_intent')}
                className={cn(
                  'px-3 py-1 rounded-full transition-colors',
                  selectedMethod === 'upi_intent'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900',
                )}
              >
                UPI Apps
              </button>
            </div>

            {/* Card fields */}
            {selectedMethod === 'card' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Card number
                  </label>
                  <div
                    ref={cardNumberRef}
                    className="h-10 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Expiry</label>
                    <div
                      ref={cardExpiryRef}
                      className="h-10 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">CVV</label>
                    <div
                      ref={cardCvvRef}
                      className="h-10 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* UPI collect */}
            {selectedMethod === 'upi_collect' && (
              <div className="space-y-2">
                <label className="block text-xs font-medium text-gray-700">
                  UPI ID (for example: yourname@upi)
                </label>
                <div
                  ref={upiCollectRef}
                  className="h-10 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
                />
              </div>
            )}

            {/* UPI intent (apps) */}
            {selectedMethod === 'upi_intent' && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-700">Pay with your preferred UPI app</p>
                <div
                  ref={upiIntentRef}
                  className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
                />
                <p className="text-[11px] text-gray-500">
                  You&apos;ll see buttons for apps like Google Pay, PhonePe, Paytm when available.
                </p>
              </div>
            )}

            {fieldError && (
              <div className="flex items-start gap-2 text-xs text-red-600">
                <AlertCircle className="w-4 h-4 mt-0.5" />
                <p>{fieldError}</p>
              </div>
            )}

            <div className="pt-2">
              <Button
                type="button"
                className="w-full"
                variant="primary"
                size="lg"
                onClick={handlePayNow}
                disabled={submitting || loading}
              >
                {submitting ? 'Processing…' : `Pay ₹${amount.toFixed(2)}`}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
