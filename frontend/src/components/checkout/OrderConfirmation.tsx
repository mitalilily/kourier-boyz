import { useFeedbackContext } from '@/components/feedback'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { CartItem } from '@/types/cart'
import { motion } from 'framer-motion'
import { CheckCircle2, Package, Truck } from 'lucide-react'
import { useEffect } from 'react'
import { Link } from 'react-router-dom'

interface OrderConfirmationProps {
  orderId?: string
  items: CartItem[]
  subtotal: number
  discount: number
  finalTotal: number
  shippingAddress: {
    name: string
    addressLine1: string
    addressLine2?: string
    city: string
    state: string
    postalCode: string
    phone: string
  } | null
  paymentMethod: string | null
}

export const OrderConfirmation = ({
  orderId,
  items,
  subtotal,
  discount,
  finalTotal,
  shippingAddress,
  paymentMethod,
}: OrderConfirmationProps) => {
  const { triggerFeedback } = useFeedbackContext()

  // Trigger feedback prompt after successful purchase (with delay to not interrupt celebration)
  useEffect(() => {
    const timer = setTimeout(() => {
      triggerFeedback('after_purchase')
    }, 5000) // Wait 5 seconds after order confirmation

    return () => clearTimeout(timer)
  }, [triggerFeedback])

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Success Header */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="text-center py-8"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4"
        >
          <CheckCircle2 className="w-12 h-12 text-green-600" />
        </motion.div>
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Order Confirmed!</h2>
        <p className="text-gray-600">
          {orderId ? `Order ID: ${orderId}` : 'Your order has been placed successfully'}
        </p>
      </motion.div>

      {/* Order Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Items */}
        <div className="space-y-6">
          <Card>
            <CardContent className="p-6">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Package className="w-5 h-5 text-blue" />
                Order Items ({items.length})
              </h3>
              <div className="space-y-4">
                {items.map((item) => (
                  <div
                    key={`${item.product._id}-${item.variantId || 'no-variant'}`}
                    className="flex gap-4 pb-4 border-b border-gray-200 last:border-0 last:pb-0"
                  >
                    <Link
                      to={`/product/${item.product.slug || item.product._id}`}
                      className="shrink-0"
                    >
                      <img
                        src={item.product.mainImage || '/image-placeholder.svg'}
                        alt={item.product.name}
                        className="w-16 h-16 object-cover rounded-lg border border-gray-200"
                      />
                    </Link>
                    <div className="flex-1 min-w-0">
                      <Link
                        to={`/product/${item.product.slug || item.product._id}`}
                        className="block"
                      >
                        <h4 className="font-medium text-gray-900 hover:text-blue transition-colors line-clamp-2">
                          {item.product.name}
                        </h4>
                      </Link>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-sm text-gray-600">Qty: {item.quantity}</span>
                        <span className="font-semibold text-gray-900">
                          ₹
                          {(
                            (item.discountedPrice || item.priceAtAddition) * item.quantity
                          ).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Delivery Info */}
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-6">
              <div className="flex items-start gap-3">
                <Truck className="w-5 h-5 text-blue-600 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900 mb-2">Delivery Information</h4>
                  {shippingAddress ? (
                    <div className="text-sm text-gray-700 space-y-1">
                      <p className="font-medium">{shippingAddress.name}</p>
                      <p>{shippingAddress.addressLine1}</p>
                      {shippingAddress.addressLine2 && <p>{shippingAddress.addressLine2}</p>}
                      <p>
                        {shippingAddress.city}, {shippingAddress.state} -{' '}
                        {shippingAddress.postalCode}
                      </p>
                      <p>Phone: {shippingAddress.phone}</p>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-600">Address not available</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Summary */}
        <div className="space-y-6">
          {/* Payment Summary */}
          <Card>
            <CardContent className="p-6">
              <h4 className="font-semibold text-gray-900 mb-4">Payment Summary</h4>
              <div className="space-y-2 text-sm mb-4">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span>₹{subtotal.toLocaleString()}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount</span>
                    <span>-₹{discount.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-gray-600">
                  <span>Shipping</span>
                  <span className="text-green-600">Free</span>
                </div>
                <div className="flex justify-between font-bold text-lg text-gray-900 pt-2 border-t-2 border-gray-300">
                  <span>Total Paid</span>
                  <span>₹{finalTotal.toLocaleString()}</span>
                </div>
              </div>
              {paymentMethod && (
                <div className="pt-4 border-t border-gray-200">
                  <p className="text-sm text-gray-600">
                    Payment Method: <span className="font-medium capitalize">{paymentMethod}</span>
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="space-y-3">
            <Link to="/profile/orders" className="block">
              <Button variant="primary" className="w-full" size="lg">
                View Order Details
              </Button>
            </Link>
            <Link to="/shop-by-category" className="block">
              <Button variant="outline" className="w-full" size="lg">
                Continue Shopping
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
