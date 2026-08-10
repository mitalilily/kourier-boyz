import { useProfile } from '@/api/auth'
import type { CouponValidationResponse } from '@/api/coupons'
import { AddressSelectionStep } from '@/components/checkout/AddressSelectionStep'
import { OrderSummarySidebar } from '@/components/checkout/OrderSummarySidebar'
import { PaymentMethodStep } from '@/components/checkout/PaymentMethodStep'
import { PhoneVerificationStep } from '@/components/checkout/PhoneVerificationStep'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useCartDelivery } from '@/hooks/useCartDelivery'
import { useCheckoutLogic } from '@/hooks/useCheckoutLogic'
import { useCheckoutState } from '@/hooks/useCheckoutState'
import { useCheckoutStorage } from '@/hooks/useCheckoutStorage'
import API from '@/lib/axios'
import { useAuthStore } from '@/store/authStore'
import type { CartItem } from '@/types/cart'
import { getStoredDeliveryPin } from '@/utils/deliveryLocationStorage'
import { guestCartUtils } from '@/utils/guestCart'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'

const CheckoutPage: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { isAuthenticated } = useAuthStore()
  const { data: profile } = useProfile()
  const queryClient = useQueryClient()
  const [isAddingToCart, setIsAddingToCart] = useState(false)
  const [showPhoneVerification, setShowPhoneVerification] = useState(false)
  const buyNowProcessedRef = useRef(false)
  const {
    clearAll,
    getAppliedCoupon,
    saveAppliedCoupon: persistAppliedCoupon,
    getPromoCode,
    savePromoCode,
  } = useCheckoutStorage()

  // State management with optimized localStorage sync
  const checkoutState = useCheckoutState()

  // Promo code state
  const [promoCode, setPromoCode] = useState(() => getPromoCode())
  const [appliedCouponState, setAppliedCouponState] = useState<
    CouponValidationResponse['coupon'] | null
  >(() => getAppliedCoupon())
  const [showPromoInput, setShowPromoInput] = useState(false)
  const [couponError, setCouponError] = useState<string | null>(null)
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false)

  const setAppliedCoupon = useCallback(
    (coupon: CouponValidationResponse['coupon'] | null) => {
      setAppliedCouponState(coupon)
      persistAppliedCoupon(coupon)
    },
    [persistAppliedCoupon],
  )

  // Business logic hook - MUST be called unconditionally before any early returns
  const checkoutLogicResult = useCheckoutLogic({
    selectedAddress: checkoutState.selectedAddress,
    selectedPaymentMethod: checkoutState.selectedPaymentMethod,
    cardDetails: checkoutState.cardDetails,
    appliedCoupon: appliedCouponState,
    setAppliedCoupon,
  })

  const {
    selectedItems,
    subtotal,
    discount,
    shipping,
    finalTotal,
    cartLoading,
    canProceedToReview,
    handleApplyPromoCode,
    handleContinueToReview,
    isPending,
    isBuyNow,
  } = checkoutLogicResult

  // Get delivery PIN - use the exact same logic as Cart page
  // Compute delivery PIN based on selected address and header location
  const deliveryPin = (() => {
    // First check if user selected an address
    if (checkoutState.selectedAddress?.postalCode) {
      return checkoutState.selectedAddress.postalCode
    }

    // Fallback to header location (localStorage) - same order as Cart page
    return getStoredDeliveryPin()
  })()

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1)
    } else {
      navigate('/cart')
    }
  }

  const paymentType: 'cod' | 'prepaid' =
    checkoutState.selectedPaymentMethod?.type === 'cod' ? 'cod' : 'prepaid'

  // Use cart delivery hook to get serviceability - MUST be called unconditionally
  // Always pass valid defaults to ensure hooks are called in the same order
  const { deliveryStatus, isCheckingServiceability } = useCartDelivery({
    selectedItems: selectedItems || [],
    deliveryPin: deliveryPin || '',
    paymentType,
  })

  // Set page title
  useEffect(() => {
    document.title = 'Almost There! - Kourier Boyz'
  }, [])

  // Note: We allow guests to access checkout and fill details
  // They will be prompted to login when trying to proceed to review
  // Buy now flow also works for guests - item will be added to guest cart

  // Listen for header location changes so we can recompute delivery PIN without refresh
  useEffect(() => {
    const handleLocationChange = () => {
      // Force a state update via checkoutState so this component re-renders
      // and recalculates delivery PIN from localStorage
      checkoutState.setDeliveryInstructions(checkoutState.deliveryInstructions || '')
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('kourier-boyz-location-changed', handleLocationChange)
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('kourier-boyz-location-changed', handleLocationChange)
      }
    }
  }, [checkoutState])

  // Ensure checkout is only accessible from Cart, Buy Now, or Add to Cart flows
  // For guests, allow access from add to cart (they'll be prompted to login at review)
  useEffect(() => {
    const buyNow = searchParams.get('buyNow') === 'true'
    const productId = searchParams.get('productId')
    const cameFromCart = (location.state as { fromCart?: boolean } | null)?.fromCart
    const hasCheckoutIntent = sessionStorage.getItem('checkout_intent') === 'true'

    // Allow access if:
    // - Coming from an explicit cart navigation (fromCart)
    // - Or it's a Buy Now flow (buyNow flag or productId present)
    // - Or user has checkout intent (from add to cart for guests)
    // - Or user is authenticated (they can access checkout directly)
    if (!cameFromCart && !buyNow && !productId && !hasCheckoutIntent && !isAuthenticated) {
      // Only redirect if cart is empty
      const guestCart = guestCartUtils.getCart()
      if (guestCart.length === 0) {
        navigate('/cart', { replace: true })
      }
    }
  }, [location.state, navigate, searchParams, isAuthenticated])

  // Handle Buy Now flow - automatically add item to cart if not already there
  useEffect(() => {
    const buyNow = searchParams.get('buyNow') === 'true'
    const productId = searchParams.get('productId')
    const variantId = searchParams.get('variantId')
    const quantity = searchParams.get('quantity')
    const couponId = searchParams.get('couponId')

    if (buyNow && productId && !cartLoading && !buyNowProcessedRef.current && !isAddingToCart) {
      // For guests, add to guest cart
      if (!isAuthenticated) {
        const guestCart = guestCartUtils.getCart()
        const itemInGuestCart = guestCart.some(
          (item) => item.productId === productId && item.variantId === variantId,
        )

        if (!itemInGuestCart) {
          guestCartUtils.addItem({
            productId,
            variantId: variantId || undefined,
            quantity: quantity ? parseInt(quantity, 10) : 1,
            couponId: couponId || undefined,
            selected: true,
          })
          window.dispatchEvent(new CustomEvent('guest-cart-updated'))
        }

        // Store guest cart items for filtering in review page (buy now flow)
        const currentGuestCart = guestCartUtils.getCart()
        const guestCartItems = currentGuestCart.map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
        }))
        sessionStorage.setItem('guest_cart_items', JSON.stringify(guestCartItems))

        // Remove buyNow flag from URL
        const newParams = new URLSearchParams(searchParams)
        newParams.delete('buyNow')
        navigate(`/cart/checkout?${newParams.toString()}`, { replace: true })
        buyNowProcessedRef.current = true
        return
      }

      // For authenticated users, use API
      // Check if item is already in cart
      const itemInCart = selectedItems?.some((item: CartItem) => {
        const productMatch = item.product._id === productId
        if (!productMatch) return false
        if (variantId) {
          return item.variantId === variantId
        }
        return !item.variantId
      })

      // If item is not in cart, add it silently (no toast)
      if (!itemInCart) {
        buyNowProcessedRef.current = true
        setIsAddingToCart(true)

        API.post('/cart', {
          productId,
          variantId: variantId || undefined,
          quantity: quantity ? parseInt(quantity, 10) : 1,
          couponId: couponId || undefined,
        })
          .then(() => {
            // Invalidate cart queries to refresh data
            queryClient.invalidateQueries({ queryKey: ['cart'] })
            queryClient.invalidateQueries({ queryKey: ['wishlist'] })

            // Remove buyNow flag from URL after adding to cart
            const newParams = new URLSearchParams(searchParams)
            newParams.delete('buyNow')
            navigate(`/cart/checkout?${newParams.toString()}`, {
              replace: true,
            })
            setIsAddingToCart(false)
          })
          .catch((error) => {
            console.error('Failed to add item to cart for buy now:', error)
            buyNowProcessedRef.current = false
            setIsAddingToCart(false)
            // On error, redirect to cart
            navigate('/cart')
          })
      } else {
        // Item already in cart, just remove buyNow flag
        const newParams = new URLSearchParams(searchParams)
        newParams.delete('buyNow')
        navigate(`/cart/checkout?${newParams.toString()}`, { replace: true })
      }
    }
  }, [
    searchParams,
    cartLoading,
    selectedItems,
    isAuthenticated,
    navigate,
    queryClient,
    isAddingToCart,
  ])

  // Redirect if cart is empty (but not during buy now processing or for guests with buy now)
  useEffect(() => {
    // Don't redirect if:
    // 1. Cart is loading
    // 2. Adding to cart (buy now flow)
    // 3. Buy now was just processed (give time for guest cart to update)
    // 4. It's a buy now flow (productId in URL) - guest cart might still be loading
    const buyNowProductId = searchParams.get('productId')
    const isBuyNowFlow = buyNowProductId !== null

    if (
      !cartLoading &&
      !isAddingToCart &&
      (!selectedItems || selectedItems.length === 0) &&
      !buyNowProcessedRef.current &&
      !isBuyNowFlow // Don't redirect during buy now flow - guest cart needs time to load
    ) {
      navigate('/cart')
    }
  }, [selectedItems, cartLoading, navigate, isAddingToCart, searchParams])

  // Clear checkout localStorage when navigating away from cart/checkout pages
  useEffect(() => {
    return () => {
      // Check the current location when component unmounts
      // Only clear if we're not navigating to another cart/checkout route
      const currentPath = window.location.pathname
      const isCheckoutRoute = currentPath.startsWith('/cart/checkout') || currentPath === '/cart'

      if (!isCheckoutRoute) {
        clearAll()
      }
    }
  }, [clearAll])

  // Promo code handlers
  const handleApply = useCallback(() => {
    handleApplyPromoCode(promoCode, setCouponError, setShowSuccessAnimation, (code) => {
      const normalizedCode = code.trim().toUpperCase()
      setPromoCode(normalizedCode)
      savePromoCode(normalizedCode)
    })
  }, [handleApplyPromoCode, promoCode, savePromoCode])

  const handleRemovePromoCode = useCallback(() => {
    setAppliedCoupon(null)
    setCouponError(null)
    setShowSuccessAnimation(false)
    savePromoCode(null)
  }, [savePromoCode, setAppliedCoupon])

  const handleCancelPromo = useCallback(() => {
    setShowPromoInput(false)
    setPromoCode('')
    setCouponError(null)
  }, [])

  // Conditional rendering - check conditions after all hooks are called
  if (cartLoading || isAddingToCart) {
    return (
      <div className="min-h-screen bg-linear-to-br from-gray-50 via-white to-gray-50 py-8 px-3 sm:px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-96">
            <Loader2 className="w-8 h-8 animate-spin text-blue" />
          </div>
        </div>
      </div>
    )
  }

  if (!selectedItems || selectedItems.length === 0) {
    return null
  }

  return (
    <div className="min-h-screen pt-4 sm:pt-6 md:pt-32 lg:pt-36 bg-linear-to-br from-gray-50 via-white to-gray-50 px-3 sm:px-4 md:px-6 lg:px-8 pb-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-4 sm:mb-6 space-y-2">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center text-xs sm:text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
            Back
          </button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1 sm:mb-2">Checkout</h1>
            <p className="text-sm sm:text-base text-gray-600">
              {isBuyNow
                ? 'Complete your purchase'
                : 'Enter your delivery address and payment details'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Left Column - Address and Payment */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-6">
            {/* Phone Verification Step - Show first if needed */}
            {showPhoneVerification && (
              <PhoneVerificationStep
                phoneNumber={profile?.phone}
                onVerified={() => {
                  setShowPhoneVerification(false)
                  queryClient.invalidateQueries({ queryKey: ['profile'] })
                }}
              />
            )}

            {/* Address Section */}
            <Card>
              <CardContent className="p-4 sm:p-6">
                <AddressSelectionStep
                  selectedAddress={checkoutState.selectedAddress}
                  onAddressSelect={checkoutState.setSelectedAddress}
                  deliveryInstructions={checkoutState.deliveryInstructions}
                  onDeliveryInstructionsChange={checkoutState.setDeliveryInstructions}
                />
              </CardContent>
            </Card>

            {/* Payment Section */}
            <Card>
              <CardContent className="p-4 sm:p-6">
                <PaymentMethodStep
                  selectedPaymentMethod={checkoutState.selectedPaymentMethod}
                  selectedUPI={checkoutState.selectedUPI}
                  onPaymentMethodSelect={checkoutState.setSelectedPaymentMethod}
                  onUPISelect={checkoutState.setSelectedUPI}
                  onUPIIdChange={checkoutState.setUpiId}
                  cardDetails={checkoutState.cardDetails}
                  onCardDetailsChange={checkoutState.setCardDetails}
                  razorpayMethod={checkoutState.razorpayMethod || 'card'}
                  onRazorpayMethodChange={checkoutState.setRazorpayMethod}
                />
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Order Summary Sidebar */}
          <div className="lg:col-span-1">
            <OrderSummarySidebar
              selectedItemsCount={selectedItems.length}
              subtotal={subtotal}
              discount={discount}
              shipping={shipping}
              finalTotal={finalTotal}
              promoCode={promoCode}
              setPromoCode={setPromoCode}
              showPromoInput={showPromoInput}
              setShowPromoInput={setShowPromoInput}
              appliedCoupon={appliedCouponState}
              couponError={couponError}
              showSuccessAnimation={showSuccessAnimation}
              isPending={isPending || false}
              onApplyCoupon={handleApply}
              onRemoveCoupon={handleRemovePromoCode}
              onCancelPromo={handleCancelPromo}
              deliveryStatus={deliveryStatus}
              isCheckingServiceability={isCheckingServiceability}
              deliveryPin={deliveryPin}
              cartItems={selectedItems}
              actionButton={
                <Button
                  variant="primary"
                  className="w-full text-sm sm:text-base"
                  size="lg"
                  onClick={handleContinueToReview}
                  disabled={
                    !canProceedToReview ||
                    deliveryStatus.status === 'error' ||
                    !deliveryStatus.allServiceable ||
                    deliveryStatus.message?.includes('We currently do not deliver to this location')
                  }
                >
                  <span className="hidden sm:inline">Continue to </span>Review
                  <ArrowRight className="w-4 h-4 ml-1 sm:ml-2" />
                </Button>
              }
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default CheckoutPage
