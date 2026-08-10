import type { CouponValidationResponse } from '@/api/coupons'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { motion } from 'framer-motion'
import { Loader2, ShieldCheck, Sparkles, Truck } from 'lucide-react'
import { CheckoutActions } from './CheckoutActions'

interface DeliveryStatus {
  status: 'success' | 'error' | 'loading' | null
  message: string
  estimatedDeliveryDate: string | null
  estimatedDeliveryDays: number | null
  allServiceable: boolean
}

interface OrderSummaryProps {
  cart: {
    totalAmount: number
    discountedAmount?: number
    totalQuantity: number
  }
  savings: number
  itemCouponDiscount: number
  cartCouponDiscount: number
  appliedCoupon: CouponValidationResponse['coupon'] | null
  finalTotal: number
  shipping: number
  hasOutOfStockItems: boolean
  hasSelectedItems: boolean
  promoCode: string
  setPromoCode: (code: string) => void
  showPromoInput: boolean
  setShowPromoInput: (show: boolean) => void
  couponError: string | null
  showSuccessAnimation: boolean
  isPending: boolean
  onApplyCoupon: () => void
  onRemoveCoupon: () => void
  onCancelPromo: () => void
  checkoutDisabledReason: string | null
  deliveryStatus?: DeliveryStatus | null
  isCheckingServiceability?: boolean
  onCheckout?: () => void
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

export const OrderSummary = ({
  cart,
  savings,
  itemCouponDiscount,
  cartCouponDiscount,
  appliedCoupon,
  finalTotal,
  shipping,
  hasOutOfStockItems,
  hasSelectedItems,
  checkoutDisabledReason,
  deliveryStatus,
  isCheckingServiceability = false,
  onCheckout,
}: OrderSummaryProps) => {
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
    if (deliveryStatus?.status === null) {
      return 'Select a delivery location to check availability.'
    }
    // Fallback to default estimate
    return getEstimatedDelivery()
  }

  const deliveryText = getDeliveryText()
  const showDeliveryStatus = deliveryStatus?.status !== null || isCheckingServiceability

  const isDeliveryError = deliveryStatus?.status === 'error'
  const isCheckoutDisabled =
    hasOutOfStockItems ||
    !hasSelectedItems ||
    !!checkoutDisabledReason ||
    isCheckingServiceability ||
    isDeliveryError

  const combinedDisabledReason =
    checkoutDisabledReason ||
    (isDeliveryError
      ? deliveryStatus?.message || 'Delivery not available to this location'
      : null) ||
    (hasOutOfStockItems ? 'Please remove out of stock items to checkout' : null)

  const totalDiscount = savings + itemCouponDiscount + cartCouponDiscount

  return (
    <div className="lg:col-span-1">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.3 }}
      >
        <Card className="sticky top-4 overflow-hidden rounded-[28px] border border-slate-200/80 bg-[linear-gradient(180deg,_#ffffff,_#f8fbff_30%,_#f8fafc)] shadow-[0_24px_60px_-36px_rgba(15,23,42,0.45)]">
          <CardContent className="p-0">
            <div className="border-b border-slate-100 bg-[radial-gradient(circle_at_top_right,_rgba(19,83,164,0.12),_transparent_30%),linear-gradient(180deg,_rgba(255,255,255,0.95),_rgba(248,251,255,0.95))] p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-white/85 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary shadow-sm">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Order summary
                  </div>
                  <p className="mt-4 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                    Payable now
                  </p>
                  <span className="mt-2 block text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                    ₹{finalTotal.toLocaleString('en-IN')}
                  </span>
                  {shipping > 0 && (
                    <span className="mt-1 block text-xs text-slate-500 sm:text-sm">
                      Includes ₹{shipping.toLocaleString('en-IN')} shipping
                    </span>
                  )}
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 sm:h-12 sm:w-12">
                  <Sparkles className="h-5 w-5 text-primary sm:h-6 sm:w-6" />
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                  You save
                </p>
                <p className="text-xl font-semibold text-emerald-950">
                  ₹{totalDiscount.toLocaleString('en-IN')}
                </p>
              </div>
            </div>

            <div className="space-y-5 p-5 sm:p-6">
              <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-slate-950">Price details</h3>
                    <p className="mt-1 text-sm text-slate-500">Clear total before you continue</p>
                  </div>
                  {appliedCoupon && (
                    <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">
                      Coupon applied
                    </Badge>
                  )}
                </div>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Items total</span>
                    <span>₹{cart.totalAmount.toLocaleString('en-IN')}</span>
                  </div>
                  {savings > 0 && (
                    <div className="flex items-center justify-between text-emerald-700">
                      <span>Product savings</span>
                      <span>-₹{savings.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  {itemCouponDiscount > 0 && (
                    <div className="flex items-center justify-between text-emerald-700">
                      <span>Item coupon savings</span>
                      <span>-₹{itemCouponDiscount.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  {cartCouponDiscount > 0 && (
                    <div className="flex items-center justify-between text-emerald-700">
                      <span>Cart coupon savings</span>
                      <span>-₹{cartCouponDiscount.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Shipping</span>
                    <span className={shipping === 0 ? 'font-medium text-emerald-700' : ''}>
                      {shipping === 0 ? 'Free' : `₹${shipping.toLocaleString('en-IN')}`}
                    </span>
                  </div>
                  <div className="border-t border-slate-100 pt-3">
                    <div className="flex items-center justify-between text-base font-semibold text-slate-950">
                      <span>Total payable</span>
                      <span>₹{finalTotal.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div
                className={`flex items-start gap-3 rounded-2xl border p-4 ${
                  deliveryStatus?.status === 'error'
                    ? 'border-red-100/70 bg-red-50/80'
                    : deliveryStatus?.status === 'success'
                      ? 'border-emerald-100/70 bg-emerald-50/80'
                      : 'border-blue-100/70 bg-gradient-to-br from-blue-50/80 to-indigo-50/50'
                }`}
              >
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                    deliveryStatus?.status === 'error'
                      ? 'bg-red-100'
                      : deliveryStatus?.status === 'success'
                        ? 'bg-emerald-100'
                        : 'bg-blue-100'
                  }`}
                >
                  {isCheckingServiceability ? (
                    <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                  ) : (
                    <Truck
                      className={`h-5 w-5 ${
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
                  <p
                    className={`mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${
                      deliveryStatus?.status === 'error'
                        ? 'text-red-900'
                        : deliveryStatus?.status === 'success'
                          ? 'text-emerald-900'
                          : 'text-blue-900'
                    }`}
                  >
                    {deliveryStatus?.status === null ? 'Delivery Availability' : 'Estimated Delivery'}
                  </p>
                  <p
                    className={`text-xs sm:text-sm font-medium leading-relaxed ${
                      deliveryStatus?.status === 'error'
                        ? 'text-red-700'
                        : deliveryStatus?.status === 'success'
                          ? 'text-emerald-700'
                          : 'text-blue-700'
                    }`}
                  >
                    {deliveryText}
                  </p>
                  {deliveryStatus?.status === 'success' && (
                    <p className="text-[10px] sm:text-xs text-emerald-600/70 mt-1 sm:mt-1.5">
                      Delivery available to your location
                    </p>
                  )}
                  {deliveryStatus?.status === 'error' && (
                    <p className="text-[10px] sm:text-xs text-red-600/70 mt-1 sm:mt-1.5">
                      Please check delivery availability
                    </p>
                  )}
                  {!showDeliveryStatus && (
                    <p className="text-[10px] sm:text-xs text-blue-600/70 mt-1 sm:mt-1.5">
                      No delivery estimate is calculated until a location is selected
                    </p>
                  )}
                </div>
              </div>

              <CheckoutActions
                isCheckoutDisabled={isCheckoutDisabled}
                disabledReason={combinedDisabledReason}
                onCheckout={onCheckout}
              />
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
