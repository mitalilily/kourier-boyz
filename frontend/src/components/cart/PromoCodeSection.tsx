import {
  useApplicableCoupons,
  type ApplicableCoupon,
  type CouponValidationResponse,
} from '@/api/coupons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tooltip } from '@/components/ui/tooltip'
import { useAuthStore } from '@/store/authStore'
import type { CartItem } from '@/types/cart'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, ChevronDown, ChevronUp, Loader2, PartyPopper, Tag } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CouponDetailsModal } from './CouponDetailsModal'

interface PromoCodeSectionProps {
  promoCode: string
  setPromoCode: (code: string) => void
  showPromoInput: boolean
  setShowPromoInput: (show: boolean) => void
  appliedCoupon: CouponValidationResponse['coupon'] | null
  couponError: string | null
  showSuccessAnimation: boolean
  isPending: boolean
  onApply: () => void
  onRemove: () => void
  onCancel: () => void
  cartTotal: number
  cartItems: CartItem[]
}

export const PromoCodeSection = ({
  promoCode,
  setPromoCode,
  showPromoInput,
  setShowPromoInput,
  appliedCoupon,
  couponError,
  showSuccessAnimation,
  isPending,
  onApply,
  onRemove,
  onCancel,
  cartTotal,
  cartItems,
}: PromoCodeSectionProps) => {
  const { user, isAuthenticated } = useAuthStore()
  const navigate = useNavigate()
  const [showAllCoupons, setShowAllCoupons] = useState(false)
  const [selectedCoupon, setSelectedCoupon] = useState<ApplicableCoupon | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const { data: applicableCouponsData, isLoading: isLoadingCoupons } = useApplicableCoupons(
    cartTotal,
    cartItems,
    user?.userId,
    !appliedCoupon && !showPromoInput, // Only fetch when not showing input and no coupon applied
  )

  const applicableCoupons = applicableCouponsData?.coupons || []
  const displayLimit = isAuthenticated ? (showAllCoupons ? applicableCoupons.length : 2) : 1
  const couponsToShow = applicableCoupons.slice(0, displayLimit)
  const hasMoreCoupons = applicableCoupons.length > 2 && !showAllCoupons
  const hasLessCoupons = showAllCoupons && applicableCoupons.length > 2

  const handleCouponClick = (coupon: ApplicableCoupon) => {
    if (coupon.isAlmostApplicable) {
      return // Don't allow clicking on almost applicable coupons
    }
    setSelectedCoupon(coupon)
    setIsModalOpen(true)
  }

  const handleApplyFromModal = () => {
    if (selectedCoupon) {
      const couponCode = selectedCoupon.code
      setPromoCode(couponCode)
      setIsModalOpen(false)
      setSelectedCoupon(null)
      // Use setTimeout to ensure state is updated before calling onApply
      // The onApply function reads from promoCode state, so we need to wait for the update
      setTimeout(() => {
        onApply()
      }, 10)
    }
  }

  const handleApplyCoupon = (code: string, isAlmostApplicable?: boolean) => {
    if (!isAuthenticated) {
      navigate('/login?redirect=' + encodeURIComponent(window.location.pathname))
      return
    }
    // Don't allow applying almost applicable coupons
    if (isAlmostApplicable) {
      return
    }
    setPromoCode(code)
    onApply()
  }

  return (
    <div className="mb-6 pb-6 border-b border-gray-200">
      {!appliedCoupon ? (
        <div className="space-y-3">
          {!showPromoInput ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowPromoInput(true)
                }}
                className="w-full text-blue hover:text-blue-dark hover:bg-blue/10"
              >
                <Tag className="w-4 h-4 mr-2" />
                Have a promo code?
              </Button>

              {/* Applicable Coupons */}
              {isLoadingCoupons ? (
                <div className="flex items-center justify-center py-2">
                  <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                </div>
              ) : couponsToShow.length > 0 ? (
                <div className="space-y-2.5 w-full">
                  <AnimatePresence mode="popLayout">
                    {couponsToShow.map((coupon, index) => (
                      <Tooltip
                        key={coupon._id}
                        title={coupon.isAlmostApplicable ? undefined : 'View coupon details'}
                        className="w-full block"
                      >
                        <motion.div
                          initial={{ opacity: 0, y: -10, height: 0 }}
                          animate={{ opacity: 1, y: 0, height: 'auto' }}
                          exit={{ opacity: 0, y: -10, height: 0 }}
                          transition={{
                            duration: 0.3,
                            delay: index * 0.05,
                            ease: 'easeOut',
                          }}
                          className={`relative group w-full block ${
                            coupon.isAlmostApplicable ? 'cursor-default' : 'cursor-pointer'
                          }`}
                          onClick={(e) => {
                            // Don't open modal if clicking on the Apply button
                            if ((e.target as HTMLElement).closest('button, [role="button"]')) {
                              return
                            }
                            if (coupon.isAlmostApplicable) {
                              return // Don't allow clicking on almost applicable coupons
                            }
                            if (isAuthenticated) {
                              handleCouponClick(coupon)
                            } else {
                              navigate(
                                '/login?redirect=' + encodeURIComponent(window.location.pathname),
                              )
                            }
                          }}
                        >
                          {/* Coupon Card */}
                          <div
                            className={`relative w-full bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-dashed rounded-md overflow-hidden transition-all ${
                              coupon.isAlmostApplicable
                                ? 'border-orange-300 hover:border-orange-400'
                                : 'border-blue-300 hover:border-blue-400 hover:shadow-sm'
                            }`}
                          >
                            <div className="flex items-stretch pr-3 min-h-[60px]">
                              {/* Left side - Discount - Fixed width and height */}
                              <div className="flex-shrink-0 w-20 px-2.5 py-2 bg-gradient-to-br from-blue-400 to-indigo-500 text-white flex flex-col justify-center">
                                <div className="text-xs font-medium opacity-90 mb-0.5">SAVE</div>
                                <div className="text-base font-bold leading-tight">
                                  {coupon.type === 'percentage' ? (
                                    <>
                                      {coupon.value}%
                                      {coupon.maxDiscountAmount && (
                                        <span className="text-[10px] font-normal block mt-0.5">
                                          up to ₹{coupon.maxDiscountAmount.toLocaleString()}
                                        </span>
                                      )}
                                    </>
                                  ) : (
                                    <>₹{coupon.value.toLocaleString()}</>
                                  )}
                                </div>
                              </div>

                              {/* Right side - Code and details */}
                              <div className="flex-1 min-w-0 py-2 pl-2.5 flex flex-col justify-center">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="font-bold text-sm text-gray-900">
                                        {coupon.code}
                                      </span>
                                      {coupon.minPurchaseAmount && (
                                        <span className="text-xs text-gray-500">
                                          Min ₹{coupon.minPurchaseAmount.toLocaleString()}
                                        </span>
                                      )}
                                    </div>
                                    {/* Show savings amount prominently */}
                                    {!coupon.isAlmostApplicable && (
                                      <p className="text-xs font-bold text-emerald-600 mt-1">
                                        Save ₹{coupon.discount.toLocaleString()}!
                                      </p>
                                    )}
                                    {coupon.isAlmostApplicable && coupon.amountNeeded && (
                                      <p className="text-xs font-semibold text-orange-600 mt-1">
                                        Add ₹{coupon.amountNeeded.toLocaleString()} more to save ₹
                                        {coupon.discount.toLocaleString()}!
                                      </p>
                                    )}
                                  </div>
                                  {isAuthenticated ? (
                                    <div className="flex-shrink-0">
                                      {coupon.isAlmostApplicable ? (
                                        <div className="px-2.5 py-1 bg-gray-400 text-white text-xs font-semibold rounded-md cursor-not-allowed opacity-75 whitespace-nowrap">
                                          Add More
                                        </div>
                                      ) : (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            handleApplyCoupon(
                                              coupon.code,
                                              coupon.isAlmostApplicable,
                                            )
                                          }}
                                          className="px-2.5 py-1 text-white text-xs font-semibold cursor-pointer rounded-md transition-colors whitespace-nowrap"
                                          style={{ backgroundColor: '#135bb4' }}
                                          onMouseEnter={(e) => {
                                            e.currentTarget.style.backgroundColor = '#0f4a8f'
                                          }}
                                          onMouseLeave={(e) => {
                                            e.currentTarget.style.backgroundColor = '#135bb4'
                                          }}
                                        >
                                          Apply
                                        </button>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="flex-shrink-0">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          navigate(
                                            '/login?redirect=' +
                                              encodeURIComponent(window.location.pathname),
                                          )
                                        }}
                                        className="px-2.5 py-1 text-white text-xs font-semibold rounded-md transition-colors shadow-sm whitespace-nowrap"
                                        style={{ backgroundColor: '#135bb4' }}
                                        onMouseEnter={(e) => {
                                          e.currentTarget.style.backgroundColor = '#0f4a8f'
                                        }}
                                        onMouseLeave={(e) => {
                                          e.currentTarget.style.backgroundColor = '#135bb4'
                                        }}
                                      >
                                        Login
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      </Tooltip>
                    ))}
                  </AnimatePresence>

                  {(hasMoreCoupons || hasLessCoupons) && isAuthenticated && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowAllCoupons(!showAllCoupons)}
                        className="w-full text-xs text-gray-600"
                      >
                        {showAllCoupons ? (
                          <>
                            Show less
                            <ChevronUp className="w-3 h-3 ml-1" />
                          </>
                        ) : (
                          <>
                            Show {applicableCoupons.length - 2} more
                            <ChevronDown className="w-3 h-3 ml-1" />
                          </>
                        )}
                      </Button>
                    </motion.div>
                  )}
                </div>
              ) : null}
            </>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    placeholder="Enter promo code"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && onApply()}
                    className={`flex-1 ${
                      couponError ? 'border-red-500 focus-visible:ring-red-500' : ''
                    }`}
                  />
                  {couponError && (
                    <motion.p
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-sm text-red-600 mt-1.5"
                    >
                      {couponError}
                    </motion.p>
                  )}
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={onApply}
                  disabled={!promoCode.trim() || isPending}
                >
                  {isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Validating...
                    </>
                  ) : (
                    'Apply'
                  )}
                </Button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={onCancel}
                className="w-full text-xs text-gray-500"
              >
                Cancel
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <div className="flex flex-col">
                <span className="text-sm font-medium text-green-900">{appliedCoupon.code}</span>
                {appliedCoupon.description && (
                  <span className="text-xs text-green-700">{appliedCoupon.description}</span>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onRemove}
              className="h-6 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              Remove
            </Button>
          </div>

          {/* Success Animation */}
          <AnimatePresence>
            {showSuccessAnimation && appliedCoupon && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8, y: -20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8, y: -20 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="relative overflow-hidden p-4 bg-gradient-to-r from-green-50 via-yellow-50 to-green-50 border-2 border-green-300 rounded-2xl shadow-lg"
              >
                <div className="flex items-center gap-3">
                  <motion.div
                    animate={{
                      rotate: [0, 10, -10, 10, -10, 0],
                      scale: [1, 1.2, 1],
                    }}
                    transition={{
                      duration: 0.5,
                      repeat: 2,
                    }}
                  >
                    <PartyPopper className="w-8 h-8 text-yellow-500" />
                  </motion.div>
                  <div className="flex-1">
                    <motion.h3
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.2 }}
                      className="text-lg font-bold text-green-800"
                    >
                      Woohoo! 🎉
                    </motion.h3>
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.3 }}
                      className="text-sm text-green-700 mt-0.5"
                    >
                      You saved{' '}
                      <span className="font-bold text-green-800 text-base">
                        ₹{appliedCoupon.discount.toLocaleString()}
                      </span>
                    </motion.p>
                  </div>
                </div>

                {/* Animated sparkles */}
                {[...Array(6)].map((_, i) => {
                  const randomX = 50 + (Math.random() - 0.5) * 200
                  const randomY = 50 + (Math.random() - 0.5) * 200
                  return (
                    <motion.div
                      key={i}
                      className="absolute w-2 h-2 bg-yellow-400 rounded-full"
                      initial={{
                        x: '50%',
                        y: '50%',
                        opacity: 0,
                        scale: 0,
                      }}
                      animate={{
                        x: `${randomX}%`,
                        y: `${randomY}%`,
                        opacity: [0, 1, 0.8, 0],
                        scale: [0, 1, 1, 0],
                      }}
                      transition={{
                        duration: 2,
                        delay: i * 0.2,
                        repeat: Infinity,
                        repeatDelay: 1,
                      }}
                    />
                  )
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Coupon Details Modal */}
      <CouponDetailsModal
        coupon={selectedCoupon}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setSelectedCoupon(null)
        }}
        onApply={handleApplyFromModal}
        isAlmostApplicable={selectedCoupon?.isAlmostApplicable || false}
      />
    </div>
  )
}
