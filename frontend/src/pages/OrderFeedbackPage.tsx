import { useSubmitFeedback } from '@/api/feedback'
import { useOrder } from '@/api/orderQueries'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { Loader2, Star } from 'lucide-react'
import React, { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'

const getDeviceType = (): 'mobile' | 'tablet' | 'desktop' => {
  if (typeof window === 'undefined') return 'desktop'
  const width = window.innerWidth
  if (width < 640) return 'mobile'
  if (width < 1024) return 'tablet'
  return 'desktop'
}

const OrderFeedbackPage: React.FC = () => {
  const { orderId, type } = useParams<{ orderId: string; type: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated } = useAuthStore()

  const { data, isLoading, isError } = useOrder(orderId)
  const submitFeedback = useSubmitFeedback()

  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')

  const order = data?.data
  const mainProduct = order?.items[0]?.product

  const feedbackLabel = useMemo(() => {
    if (type === 'delivery') return 'Delivery feedback'
    if (type === 'seller') return 'Seller feedback'
    return 'Order feedback'
  }, [type])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!orderId) return
    if (!isAuthenticated) {
      toast.error('Please login to share your feedback.')
      navigate('/login', { state: { from: location } })
      return
    }

    if (!rating || rating < 1) {
      toast.error('Please select a rating.')
      return
    }

    try {
      await submitFeedback.mutateAsync({
        rating,
        comment: comment.trim() || undefined,
        type: type === 'delivery' ? 'delivery' : 'support',
        source: 'post-order',
        metadata: {
          orderId,
          productId: mainProduct?._id,
          page: location.pathname,
          device: getDeviceType(),
        },
      })
      toast.success('Thanks for your feedback!')
      navigate('/profile/orders')
    } catch (error) {
      console.error('Feedback submission failed', error)
      toast.error('Unable to submit feedback right now.')
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
      </div>
    )
  }

  if (isError || !order) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center space-y-3">
        <p className="text-sm text-gray-600">We could not find this order.</p>
        <Button variant="outline" asChild>
          <Link to="/profile/orders">Back to orders</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto py-6 sm:py-30 px-4">
      <Button variant="ghost" size="sm" className="mb-3 px-0" asChild>
        <Link to="/profile/orders">&#8592; Back to your orders</Link>
      </Button>

      <Card className="border border-gray-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg sm:text-xl font-semibold text-gray-900">
            {feedbackLabel} for order #{order.orderNumber || order._id}
          </CardTitle>
          <p className="text-xs sm:text-sm text-gray-600 mt-1">
            Help us improve your future experiences by sharing how this{' '}
            {type === 'delivery' ? 'delivery' : 'order'} went.
          </p>
        </CardHeader>
        <CardContent>
          {/* Order summary */}
          <div className="mb-4 rounded-lg border border-gray-100 bg-gray-50/60 p-3 flex gap-3">
            {mainProduct && (
              <img
                src={mainProduct.mainImage || '/image-placeholder.svg'}
                alt={mainProduct.name}
                className="h-16 w-16 rounded border object-cover shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {mainProduct?.name || 'Order items'}
              </p>
              <p className="text-xs text-gray-600 mt-0.5">
                Placed on{' '}
                {new Date(order.createdAt).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </p>
              <p className="text-xs text-gray-600 mt-0.5">
                Total: <span className="font-semibold">&#8377;{order.total}</span>
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Rating */}
            <div>
              <p className="text-xs sm:text-sm font-medium text-gray-800 mb-1.5">Overall rating</p>
              <div className="flex items-center gap-2">
                {Array.from({ length: 5 }).map((_, index) => {
                  const value = index + 1
                  const active = rating >= value
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setRating(value)}
                      className={cn(
                        'flex h-10 w-10 items-center justify-center rounded-full border transition-all',
                        active
                          ? 'border-yellow-400 bg-yellow-100/60 text-yellow-500 shadow-sm'
                          : 'border-gray-200 text-gray-400 hover:border-yellow-300 hover:text-yellow-400 hover:bg-yellow-50/50',
                      )}
                      aria-label={`${value} star${value > 1 ? 's' : ''}`}
                    >
                      <Star
                        className={cn(
                          'h-5 w-5',
                          active ? 'fill-yellow-400 text-yellow-500' : 'fill-transparent',
                        )}
                      />
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Comment */}
            <div>
              <p className="text-xs sm:text-sm font-medium text-gray-800 mb-1.5">
                Tell us a bit more (optional)
              </p>
              <Textarea
                rows={4}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={
                  type === 'delivery'
                    ? 'Share about delivery speed, packaging, courier behaviour, etc.'
                    : 'Share about the seller communication, service quality, etc.'
                }
              />
              <p className="mt-1 text-[10px] sm:text-xs text-gray-500">
                Please avoid sharing sensitive information like card details or phone OTPs.
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/profile/orders')}
                disabled={submitFeedback.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitFeedback.isPending}>
                {submitFeedback.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Submit feedback
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default OrderFeedbackPage
