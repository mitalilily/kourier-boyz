import { useEffect, useState } from 'react'
import { createRazorpayOrder, confirmRazorpayPayment } from '@/api/payments'
import { RazorpayEmbeddedCheckout } from '@/components/checkout/RazorpayEmbeddedCheckout'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

const TEST_AMOUNT = 100 // ₹100 for testing; replace with real amount from cart/checkout

const EmbeddedCheckoutPage: React.FC = () => {
  const [loading, setLoading] = useState(true)
  const [orderId, setOrderId] = useState<string | null>(null)
  const [amount, setAmount] = useState<number>(TEST_AMOUNT)
  const [currency, setCurrency] = useState<string>('INR')
  const [keyId, setKeyId] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const init = async () => {
      try {
        const res = await createRazorpayOrder({ amount: TEST_AMOUNT })
        if (!res.success) {
          toast.error(res.message || 'Failed to create Razorpay order')
          setLoading(false)
          return
        }
        setOrderId(res.data.orderId)
        setAmount(res.data.amount / 100)
        setCurrency(res.data.currency)
        setKeyId(res.data.keyId)
      } catch (err: any) {
        console.error('Error creating Razorpay order:', err)
        toast.error('Failed to create Razorpay order')
      } finally {
        setLoading(false)
      }
    }

    void init()
  }, [])

  const handleSuccess = async (token: string) => {
    if (!orderId) {
      toast.error('Missing order for payment confirmation')
      return
    }
    try {
      const res = await confirmRazorpayPayment({
        token,
        orderId,
        amount,
      })
      if (!res.success) {
        toast.error(res.message || 'Payment confirmation failed')
        return
      }
      toast.success('Payment completed successfully')
      navigate('/profile/orders')
    } catch (err: any) {
      console.error('Error confirming payment:', err)
      toast.error('Payment confirmation failed')
    }
  }

  const handleError = (message: string) => {
    if (message) toast.error(message)
  }

  if (loading || !orderId || !keyId) {
    return (
      <div className="min-h-screen pt-6 md:pt-24 px-4 sm:px-6 md:px-8 flex items-center justify-center">
        <p className="text-sm text-gray-500">Preparing secure checkout…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen pt-6 md:pt-24 px-4 sm:px-6 md:px-8 bg-linear-to-br from-gray-50 via-white to-gray-50">
      <div className="max-w-md mx-auto space-y-4">
        <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">
          Embedded Checkout (Razorpay)
        </h1>
        <p className="text-sm text-gray-600 text-center mb-4">
          Test embedded card / UPI payments using Razorpay Elements.
        </p>

        <RazorpayEmbeddedCheckout
          orderId={orderId}
          amount={amount}
          currency={currency}
          razorpayKey={keyId}
          onSuccess={handleSuccess}
          onError={handleError}
        />
      </div>
    </div>
  )
}

export default EmbeddedCheckoutPage






















