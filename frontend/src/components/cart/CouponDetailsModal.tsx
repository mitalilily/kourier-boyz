import type { ApplicableCoupon } from '@/api/coupons'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Calendar, Info, Tag } from 'lucide-react'

interface CouponDetailsModalProps {
  coupon: ApplicableCoupon | null
  isOpen: boolean
  onClose: () => void
  onApply: () => void
  isAlmostApplicable?: boolean
}

export const CouponDetailsModal = ({
  coupon,
  isOpen,
  onClose,
  onApply,
  isAlmostApplicable = false,
}: CouponDetailsModalProps) => {
  if (!coupon) return null

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Tag className="w-5 h-5 text-blue-600" />
            Coupon Details
          </DialogTitle>
          <DialogDescription>View all details about this coupon</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Coupon Code & Discount */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-dashed border-blue-300 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-gray-600 mb-1">Coupon Code</div>
                <div className="text-2xl font-bold text-gray-900">{coupon.code}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium text-gray-600 mb-1">Discount</div>
                <div className="text-2xl font-bold text-blue-600">
                  {coupon.type === 'percentage' ? (
                    <>
                      {coupon.value}%
                      {coupon.maxDiscountAmount && (
                        <span className="text-sm font-normal block text-gray-600">
                          up to ₹{coupon.maxDiscountAmount.toLocaleString()}
                        </span>
                      )}
                    </>
                  ) : (
                    <>₹{coupon.value.toLocaleString()}</>
                  )}
                </div>
              </div>
            </div>
            {!isAlmostApplicable && (
              <div className="mt-3 pt-3 border-t border-blue-200">
                <div className="text-sm font-bold text-emerald-600">
                  Save ₹{coupon.discount.toLocaleString()} on this order!
                </div>
              </div>
            )}
          </div>

          {/* Description */}
          {coupon.description && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Info className="w-4 h-4 text-gray-500" />
                <div className="text-sm font-semibold text-gray-700">Description</div>
              </div>
              <p className="text-sm text-gray-600">{coupon.description}</p>
            </div>
          )}

          {/* Validity */}
          {(coupon.validFrom || coupon.validTo) && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-4 h-4 text-gray-500" />
                <div className="text-sm font-semibold text-gray-700">Validity</div>
              </div>
              <div className="text-sm text-gray-600">
                {coupon.validFrom && coupon.validTo ? (
                  <>
                    Valid from {formatDate(coupon.validFrom)} to {formatDate(coupon.validTo)}
                  </>
                ) : coupon.validTo ? (
                  <>Valid until {formatDate(coupon.validTo)}</>
                ) : (
                  <>Valid from {formatDate(coupon.validFrom)}</>
                )}
              </div>
            </div>
          )}

          {/* Minimum Purchase */}
          {coupon.minPurchaseAmount && (
            <div>
              <div className="text-sm font-semibold text-gray-700 mb-1">Minimum Purchase</div>
              <div className="text-sm text-gray-600">
                Minimum order value of ₹{coupon.minPurchaseAmount.toLocaleString()} required
              </div>
            </div>
          )}

          {/* Terms and Conditions */}
          {coupon.termsAndConditions && coupon.termsAndConditions.length > 0 && (
            <div>
              <div className="text-sm font-semibold text-gray-700 mb-2">Terms & Conditions</div>
              <div className="bg-gray-50 p-3 rounded-md border border-gray-200">
                <ul className="list-disc list-inside space-y-1.5">
                  {coupon.termsAndConditions.map((term, index) => (
                    <li key={index} className="text-sm text-gray-600">
                      {term}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Almost Applicable Message */}
          {isAlmostApplicable && coupon.amountNeeded && (
            <div className="bg-orange-50 border border-orange-200 rounded-md p-3">
              <div className="text-sm font-semibold text-orange-700 mb-1">Almost There!</div>
              <div className="text-sm text-orange-600">
                Add ₹{coupon.amountNeeded.toLocaleString()} more to your cart to apply this coupon
                and save ₹{coupon.discount.toLocaleString()}!
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-6">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Close
          </Button>
          {!isAlmostApplicable && (
            <Button
              onClick={onApply}
              className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-black font-semibold"
            >
              Apply Coupon
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
