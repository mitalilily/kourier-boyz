import type { CouponValidationResponse } from '@/api/coupons'
import { PromoCodeSection } from '@/components/cart/PromoCodeSection'
import { Card, CardContent } from '@/components/ui/card'
import type { CartItem } from '@/types/cart'
import { Loader2, Truck } from 'lucide-react'
import { memo } from 'react'

interface DeliveryStatus {
  status: 'success' | 'error' | 'loading' | null
  message: string
  estimatedDeliveryDate: string | null
  estimatedDeliveryDays: number | null
  allServiceable: boolean
  serviceabilityData?: Array<{
    destination_pincode?: string
    [key: string]: unknown
  }>
}

interface OrderSummarySidebarProps {
  selectedItemsCount: number
  subtotal: number
  discount: number
  shipping?: number
  finalTotal: number
  promoCode: string
  setPromoCode: (code: string) => void
  showPromoInput: boolean
  setShowPromoInput: (show: boolean) => void
  appliedCoupon: CouponValidationResponse['coupon'] | null
  couponError: string | null
  showSuccessAnimation: boolean
  isPending: boolean
  onApplyCoupon: () => void
  onRemoveCoupon: () => void
  onCancelPromo: () => void
  deliveryStatus?: DeliveryStatus | null
  isCheckingServiceability?: boolean
  deliveryPin?: string
  actionButton?: React.ReactNode
  cartItems?: CartItem[]
}

const getEstimatedDelivery = () => {
  const today = new Date()
  const deliveryDate = new Date(today)
  deliveryDate.setDate(today.getDate() + 5)
  return deliveryDate.toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export const OrderSummarySidebar = memo(
  ({
    selectedItemsCount,
    subtotal,
    discount,
    shipping = 0,
    finalTotal,
    promoCode,
    setPromoCode,
    showPromoInput,
    setShowPromoInput,
    appliedCoupon,
    couponError,
    showSuccessAnimation,
    isPending,
    onApplyCoupon,
    onRemoveCoupon,
    onCancelPromo,
    deliveryStatus,
    isCheckingServiceability = false,
    deliveryPin,
    actionButton,
    cartItems = [],
  }: OrderSummarySidebarProps) => {
    // Determine delivery display text
    const getDeliveryText = () => {
      if (isCheckingServiceability) {
        return 'Checking delivery...'
      }
      if (deliveryStatus?.status === 'success' && deliveryStatus.estimatedDeliveryDate) {
        return deliveryStatus.estimatedDeliveryDate
      }
      if (deliveryStatus?.status === 'error') {
        return deliveryStatus.message || 'Unable to check delivery'
      }
      // Fallback to default estimate
      return getEstimatedDelivery()
    }

    const deliveryText = getDeliveryText()
    const showDeliveryStatus = deliveryStatus?.status !== null || isCheckingServiceability
    return (
      <Card className="sticky top-4 shadow-lg border-2 border-gray-200">
        <CardContent className="p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Order Summary</h3>

          {/* Promo Code Section */}
          <PromoCodeSection
            promoCode={promoCode}
            setPromoCode={setPromoCode}
            showPromoInput={showPromoInput}
            setShowPromoInput={setShowPromoInput}
            appliedCoupon={appliedCoupon}
            couponError={couponError}
            showSuccessAnimation={showSuccessAnimation}
            isPending={isPending}
            onApply={onApplyCoupon}
            onRemove={onRemoveCoupon}
            onCancel={onCancelPromo}
            cartTotal={subtotal}
            cartItems={cartItems}
          />

          {/* Price Breakdown */}
          <div className="space-y-2 text-sm mb-4 pb-4 border-b border-gray-200">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal ({selectedItemsCount} items)</span>
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
              <span className={shipping === 0 ? 'text-green-600' : ''}>
                {shipping === 0 ? 'Free' : `₹${shipping.toLocaleString()}`}
              </span>
            </div>
          </div>

          <div className="flex justify-between font-bold text-lg text-gray-900 mb-4 pt-4 border-t-2 border-gray-300">
            <span>Total</span>
            <span>₹{finalTotal.toLocaleString()}</span>
          </div>

          {/* Estimated Delivery Section */}
          {showDeliveryStatus && (
            <div className="mb-6 pb-4 border-b border-gray-200">
              <div
                className={`flex items-start gap-3 p-3 rounded-lg border ${
                  deliveryStatus?.status === 'error'
                    ? 'bg-red-50 border-red-200'
                    : deliveryStatus?.status === 'success'
                    ? 'bg-emerald-50 border-emerald-200'
                    : 'bg-blue-50 border-blue-200'
                }`}
              >
                <div
                  className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    deliveryStatus?.status === 'error'
                      ? 'bg-red-100'
                      : deliveryStatus?.status === 'success'
                      ? 'bg-emerald-100'
                      : 'bg-blue-100'
                  }`}
                >
                  {isCheckingServiceability ? (
                    <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                  ) : (
                    <Truck
                      className={`w-4 h-4 ${
                        deliveryStatus?.status === 'error'
                          ? 'text-red-600'
                          : deliveryStatus?.status === 'success'
                          ? 'text-emerald-600'
                          : 'text-blue-600'
                      }`}
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  {isCheckingServiceability ? (
                    <p className="text-sm font-medium text-blue-700">
                      Checking delivery availability...
                    </p>
                  ) : deliveryStatus?.status === 'success' ? (
                    <>
                      <p className="text-xs font-semibold text-emerald-900 mb-1">
                        Delivery available to {deliveryPin || deliveryStatus?.serviceabilityData?.[0]?.destination_pincode || 'your location'}
                      </p>
                      {deliveryStatus.estimatedDeliveryDate && (
                        <p className="text-sm font-medium text-emerald-700">
                          Arrives by {deliveryStatus.estimatedDeliveryDate}
                        </p>
                      )}
                    </>
                  ) : deliveryStatus?.status === 'error' ? (
                    <>
                      <p className="text-xs font-semibold text-red-900 mb-1">
                        Delivery not available
                      </p>
                      <p className="text-sm font-medium text-red-700">
                        {deliveryText}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm font-medium text-blue-700">
                      {deliveryText}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Action Button */}
          {actionButton && <div className="space-y-3">{actionButton}</div>}
        </CardContent>
      </Card>
    )
  },
)

OrderSummarySidebar.displayName = 'OrderSummarySidebar'
