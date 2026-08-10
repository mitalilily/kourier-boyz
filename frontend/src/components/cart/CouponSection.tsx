import { useCart } from '@/api/cart'
import { useApplyCoupon, useGetClippedCoupons } from '@/api/sellerCouponQueries'
import type { CouponRedemption, SellerCoupon } from '@/api/sellerCoupons'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Check, Tag, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'

interface CouponSectionProps {
  onCouponApplied?: (couponId: string, discount: number) => void
  onCouponRemoved?: () => void
  appliedCouponId?: string | null
}

export const CouponSection: React.FC<CouponSectionProps> = ({
  onCouponApplied,
  onCouponRemoved,
  appliedCouponId,
}) => {
  const { data: cartData } = useCart()
  const cart = cartData?.data || cartData?.cart
  const { data: clippedCouponsData } = useGetClippedCoupons()
  const applyCouponMutation = useApplyCoupon()

  const [selectedCouponId, setSelectedCouponId] = useState<string | null>(appliedCouponId || null)

  const clippedCoupons = clippedCouponsData?.coupons || []
  const availableCoupons = clippedCoupons.filter(
    (redemption) => redemption.status === 'clipped' || redemption.status === 'applied',
  )

  const handleApplyCoupon = useCallback(
    async (couponId: string) => {
      if (!cart?.items || cart.items.length === 0) {
        toast.error('Your cart is empty')
        return
      }

      const selectedItems = cart.items.filter((item) => item.selected !== false)
      if (selectedItems.length === 0) {
        toast.error('Please select items to apply coupon')
        return
      }

      const cartItems = selectedItems.map((item) => ({
        product: { _id: item.product._id },
        variant: item.variantId ? { _id: item.variantId } : undefined,
        quantity: item.quantity,
        price: item.priceAtAddition || 0,
      }))

      const cartTotal = selectedItems.reduce(
        (sum, item) => sum + (item.priceAtAddition || 0) * item.quantity,
        0,
      )

      try {
        const result = await applyCouponMutation.mutateAsync({
          couponId,
          cartItems,
          cartTotal,
        })

        if (result.valid) {
          setSelectedCouponId(couponId)
          onCouponApplied?.(couponId, result.discount)
          toast.success(`Coupon applied! You saved ₹${result.discount.toFixed(2)}`)
        }
      } catch (error: unknown) {
        const errorMessage =
          error && typeof error === 'object' && 'response' in error
            ? (error as { response?: { data?: { error?: string } } })?.response?.data?.error
            : undefined
        toast.error(errorMessage || 'Failed to apply coupon')
      }
    },
    [cart?.items, applyCouponMutation, onCouponApplied],
  )

  // Auto-apply coupon when cart changes
  useEffect(() => {
    if (cart?.items && cart.items.length > 0 && availableCoupons.length > 0 && !selectedCouponId) {
      // Try to apply the first available coupon
      const firstCoupon = availableCoupons[0]
      if (firstCoupon.coupon && typeof firstCoupon.coupon !== 'string') {
        handleApplyCoupon(firstCoupon.coupon._id)
      }
    }
  }, [cart?.items, availableCoupons, selectedCouponId, handleApplyCoupon])

  const handleRemoveCoupon = () => {
    setSelectedCouponId(null)
    onCouponRemoved?.()
    toast.success('Coupon removed')
  }

  if (availableCoupons.length === 0 && !appliedCouponId) {
    return null
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <Tag className="w-4 h-4" />
          Available Coupons
        </h3>
      </div>

      {availableCoupons.map((redemption: CouponRedemption) => {
        // Type guard: ensure coupon is a SellerCoupon object, not a string
        if (!redemption.coupon || typeof redemption.coupon === 'string') return null
        const coupon = redemption.coupon as SellerCoupon

        const isApplied = selectedCouponId === coupon._id || appliedCouponId === coupon._id
        const discountText =
          coupon.discountType === 'percent'
            ? `${coupon.discountValue}% OFF`
            : `₹${coupon.discountValue} OFF`

        return (
          <Card key={redemption._id} className="p-3 border-2">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-primary">{coupon.couponCode}</span>
                  <span className="text-sm text-gray-600">{discountText}</span>
                </div>
                {coupon.description && (
                  <p className="text-xs text-gray-500 mt-1">{coupon.description}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {isApplied ? (
                  <>
                    <Check className="w-4 h-4 text-green-500" />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveCoupon}
                      className="h-8 px-2"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleApplyCoupon(coupon._id)}
                    disabled={applyCouponMutation.isPending}
                    className="h-8"
                  >
                    Apply
                  </Button>
                )}
              </div>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
