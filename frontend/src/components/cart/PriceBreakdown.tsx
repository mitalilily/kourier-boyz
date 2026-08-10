import { Sparkles, Tag } from 'lucide-react'
import type { CouponValidationResponse } from '@/api/coupons'

interface PriceBreakdownProps {
  subtotal: number
  discountedAmount?: number
  totalQuantity: number
  savings: number
  itemCouponDiscount: number
  cartCouponDiscount: number
  appliedCoupon: CouponValidationResponse['coupon'] | null
  finalTotal: number
}

export const PriceBreakdown = ({
  subtotal,
  totalQuantity,
  savings,
  itemCouponDiscount,
  cartCouponDiscount,
  appliedCoupon,
  finalTotal,
}: PriceBreakdownProps) => {
  const totalDiscount = itemCouponDiscount + cartCouponDiscount
  const hasAnyDiscount = totalDiscount > 0 || savings > 0

  return (
    <div className="space-y-3 mb-6">
      {/* Subtotal - Always show original amount */}
      <div className="flex justify-between text-sm">
        <span className="text-gray-600">
          Subtotal ({totalQuantity} {totalQuantity === 1 ? 'item' : 'items'})
        </span>
        <span className="font-semibold text-gray-900">₹{subtotal.toLocaleString()}</span>
      </div>

      {/* Product Savings (non-coupon discounts) */}
      {savings > 0 && (
        <div className="flex justify-between text-sm">
          <span className="text-green-600 flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            Product Savings
          </span>
          <span className="font-semibold text-green-600">-₹{savings.toLocaleString()}</span>
        </div>
      )}

      {/* Item-level Coupon Discounts */}
      {itemCouponDiscount > 0 && (
        <div className="flex justify-between text-sm">
          <span className="text-green-600 flex items-center gap-1">
            <Tag className="w-3 h-3" />
            Coupon Discount
          </span>
          <span className="font-semibold text-green-600">-₹{itemCouponDiscount.toLocaleString()}</span>
        </div>
      )}

      {/* Shipping */}
      <div className="flex justify-between text-sm">
        <span className="text-gray-600">Shipping</span>
        <span className="text-gray-500 font-semibold">Free</span>
      </div>

      {/* Cart-level Coupon Discount (from promo code) */}
      {appliedCoupon && cartCouponDiscount > 0 && (
        <div className="flex justify-between text-sm">
          <span className="text-gray-600 flex items-center gap-1">
            <Tag className="w-3 h-3" />
            Cart Discount ({appliedCoupon.code})
          </span>
          <span className="font-semibold text-green-600">
            -₹{cartCouponDiscount.toLocaleString()}
          </span>
        </div>
      )}

      {/* Order Total */}
      <div className="border-t border-gray-300 pt-4 mt-4">
        <div className="flex justify-between items-center">
          <span className="text-lg font-bold text-gray-900">Order Total</span>
          <div className="flex flex-col items-end">
            <span className="text-3xl font-bold text-gray-800">₹{finalTotal.toLocaleString()}</span>
            {hasAnyDiscount && finalTotal < subtotal && (
              <span className="text-xs text-gray-400 line-through mt-1">
                ₹{subtotal.toLocaleString()}
              </span>
            )}
          </div>
        </div>
        {totalDiscount > 0 && (
          <p className="text-xs text-green-600 mt-1 text-right">
            You saved ₹{totalDiscount.toLocaleString()}!
          </p>
        )}
      </div>
    </div>
  )
}

