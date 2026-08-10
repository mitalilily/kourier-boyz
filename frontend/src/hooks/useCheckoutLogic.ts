import { useCart } from '@/api/cart'
import { useValidateCoupon, type CouponValidationResponse } from '@/api/coupons'
import type { CardDetails } from '@/components/checkout/PaymentMethodStep'
import type { PaymentMethod } from '@/config/checkout.config'
import { useGuestCart } from '@/hooks/useGuestCart'
import { useAuthStore } from '@/store/authStore'
import type { Address } from '@/types/address'
import type { Cart, CartItem } from '@/types/cart'
import confetti from 'canvas-confetti'
import { useCallback, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

interface UseCheckoutLogicProps {
  selectedAddress: Address | null
  selectedPaymentMethod: PaymentMethod | null
  cardDetails: CardDetails
  appliedCoupon: CouponValidationResponse['coupon'] | null
  setAppliedCoupon: (coupon: CouponValidationResponse['coupon'] | null) => void
}

/**
 * Custom hook for checkout business logic
 * Separates business logic from UI components
 */
export const useCheckoutLogic = ({
  selectedAddress,
  selectedPaymentMethod,
  cardDetails,
  appliedCoupon,
  setAppliedCoupon,
}: UseCheckoutLogicProps) => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user, isAuthenticated } = useAuthStore()
  const { data: cartData, isLoading: cartLoading, refetch: refetchCart } = useCart()
  const {
    data: guestCartData,
    isLoading: isGuestCartLoading,
    refetch: refetchGuestCart,
  } = useGuestCart()

  // Use guest cart if not authenticated, otherwise use authenticated cart
  // Normalize cart data structure - both authenticated and guest carts should have the same structure
  const activeCart = useMemo(() => {
    if (isAuthenticated) {
      // Authenticated cart: could be in data.data or data.cart
      return cartData?.data || cartData?.cart || null
    } else {
      // Guest cart: should already be in the correct format
      return guestCartData || null
    }
  }, [isAuthenticated, cartData, guestCartData])

  const isLoadingCart = isAuthenticated ? cartLoading : isGuestCartLoading

  const cart = activeCart

  // Force refetch cart when authentication state changes to ensure fresh data
  // This is important when user logs in from guest checkout
  useEffect(() => {
    if (isAuthenticated) {
      // When user becomes authenticated, refetch cart to get latest data
      // This ensures calculations use fresh data after login
      refetchCart().catch((error) => {
        console.error('Failed to refetch cart after login:', error)
      })
    } else {
      // When user logs out, refetch guest cart
      refetchGuestCart().catch((error) => {
        console.error('Failed to refetch guest cart after logout:', error)
      })
    }
  }, [isAuthenticated, refetchCart, refetchGuestCart])
  const validateCouponMutation = useValidateCoupon()

  // Check if this is a "Buy Now" flow (single product checkout)
  const buyNowProductId = searchParams.get('productId')
  const buyNowVariantId = searchParams.get('variantId')

  // Get selected items - filter for buy now if applicable
  // Also filter to only show guest cart items if user came from guest checkout
  const selectedItems = useMemo(() => {
    // Ensure cart is loaded and has items before filtering
    // Don't calculate if cart is still loading to avoid using stale/incomplete data
    if (isLoadingCart || !cart || !cart.items || cart.items.length === 0) {
      return []
    }

    // Get all items that are selected (selected !== false means selected or undefined)
    const allItems = cart.items.filter((item: CartItem) => item.selected !== false)

    // If buy now, only return the specific product
    if (buyNowProductId) {
      return allItems.filter((item: CartItem) => {
        const productMatch = item.product?._id === buyNowProductId
        if (!productMatch) return false

        // If variant specified, match it
        if (buyNowVariantId) {
          return item.variantId === buyNowVariantId
        }

        // If no variant specified, match items without variants
        return !item.variantId
      })
    }

    // If user came from guest checkout, filter to only show items that were in guest cart
    // This ensures that after login, only the items they added as guest are shown
    // BUT: Only apply this filter if we're actually in a guest checkout flow
    // If checkout_intent is not set, show all selected items (normal checkout flow)
    if (isAuthenticated && typeof window !== 'undefined') {
      const checkoutIntent = sessionStorage.getItem('checkout_intent')
      const guestCartItemsStr = sessionStorage.getItem('guest_cart_items')

      // Only filter if we have both checkout_intent and guest_cart_items
      // This means user came from guest checkout and logged in
      if (checkoutIntent === 'true' && guestCartItemsStr) {
        try {
          const guestCartItems = JSON.parse(guestCartItemsStr) as Array<{
            productId: string
            variantId?: string
          }>

          // Filter items to only include those that were in guest cart
          const filtered = allItems.filter((item: CartItem) => {
            return guestCartItems.some((guestItem) => {
              const productMatch = item.product?._id === guestItem.productId
              if (!productMatch) return false

              // Match variant if both have variants, or both don't have variants
              const itemVariantId = item.variantId || undefined
              const guestVariantId = guestItem.variantId || undefined
              return itemVariantId === guestVariantId
            })
          })

          // If filtering resulted in empty array, return all items (fallback)
          // This can happen if guest cart items don't match current cart items
          return filtered.length > 0 ? filtered : allItems
        } catch (error) {
          console.error('Error parsing guest cart items:', error)
          // If parsing fails, return all items (fallback)
          return allItems
        }
      }
    }

    // Normal checkout flow: return all selected items
    return allItems
  }, [cart, buyNowProductId, buyNowVariantId, isAuthenticated, isLoadingCart])

  // Calculate totals
  // Only calculate if cart is loaded (not loading) to avoid using stale data
  const { subtotal, discount, shipping, finalTotal } = useMemo(() => {
    // If cart is still loading or cart is null, return zeros to avoid using stale data
    if (isLoadingCart || !cart || !cart.items || cart.items.length === 0) {
      return {
        subtotal: 0,
        discount: 0,
        shipping: 0,
        finalTotal: 0,
      }
    }

    // If no selected items, return zeros
    if (!selectedItems || selectedItems.length === 0) {
      return {
        subtotal: 0,
        discount: 0,
        shipping: 0,
        finalTotal: 0,
      }
    }

    // Calculate original subtotal (before any discounts) for display and cart coupon calculation
    // Use current effectivePrice from product, fallback to priceAtAddition
    const originalSubtotal = selectedItems.reduce((total: number, item: CartItem) => {
      const effectivePrice = item.product?.effectivePrice ?? item.priceAtAddition ?? 0
      return total + effectivePrice * item.quantity
    }, 0)

    // Use item subtotals (which already include item-level discounts and quantity)
    // item.subtotal is calculated as: quantity * effectivePrice (with discounts if applicable)
    const itemsSubtotal = selectedItems.reduce((total: number, item: CartItem) => {
      // item.subtotal already includes quantity, so use it directly
      if (item.subtotal !== undefined && item.subtotal !== null) {
        return total + item.subtotal
      }
      // Fallback: calculate from current effectivePrice and quantity
      const effectivePrice = item.product?.effectivePrice ?? item.priceAtAddition ?? 0
      return total + effectivePrice * item.quantity
    }, 0)

    // Item-level coupon discounts are already included in item.subtotal
    // So we calculate the item discount amount for display purposes
    const itemCouponDiscount = selectedItems.reduce((total: number, item: CartItem) => {
      if (item.appliedCoupon && item.discountAmount) {
        return total + (item.discountAmount || 0)
      }
      return total
    }, 0)

    // Cart-level coupon discount (applied on original subtotal - NOT including shipping)
    // IMPORTANT: Coupons are always applied on order subtotal, never on total with shipping
    const cartCouponDiscount = appliedCoupon
      ? appliedCoupon.type === 'percentage'
        ? Math.min(
            (originalSubtotal * appliedCoupon.value) / 100, // Calculate on subtotal only
            appliedCoupon.maxDiscountAmount || Infinity,
          )
        : appliedCoupon.value // Fixed discount amount
      : 0

    // Total discount = item discounts (already in subtotal) + cart coupon discount
    const totalDiscount = itemCouponDiscount + cartCouponDiscount

    // Final subtotal after all discounts = items subtotal (with item discounts) - cart coupon
    // This is the discounted subtotal (before shipping)
    const discountedSubtotal = Math.max(0, itemsSubtotal - cartCouponDiscount)

    // Get shipping from cart (calculated on backend)
    // Shipping is added AFTER discount is applied
    // Calculate shipping from selected items if cart shipping is not available
    let cartShipping = (cart as Cart & { shipping?: number })?.shipping || 0

    // If cart shipping is 0 or not available, calculate from selected items
    // This ensures shipping is always correct even if cart data is incomplete
    if (cartShipping === 0 && selectedItems.length > 0) {
      cartShipping = selectedItems.reduce((total: number, item: CartItem) => {
        return total + (item.shipping || 0)
      }, 0)
    }

    // Final total = discounted subtotal + shipping
    // Discount is NOT applied to shipping
    const final = discountedSubtotal + cartShipping

    return {
      subtotal: originalSubtotal, // Original subtotal for display
      discount: totalDiscount, // Total discount for display
      shipping: cartShipping,
      finalTotal: final,
    }
  }, [selectedItems, appliedCoupon, cart, isLoadingCart])

  // Confetti trigger
  const triggerConfetti = useCallback(() => {
    confetti({
      particleCount: 30,
      spread: 60,
      origin: { y: 0.6 },
      colors: ['#10b981', '#fbbf24', '#3b82f6'],
      startVelocity: 20,
      ticks: 100,
      zIndex: 0,
    })
  }, [])

  // Promo code validation
  const handleApplyPromoCode = useCallback(
    (
      promoCode: string,
      setCouponError: (error: string | null) => void,
      setShowSuccessAnimation: (show: boolean) => void,
      onCouponApplied?: (code: string, coupon: CouponValidationResponse['coupon']) => void,
    ) => {
      setCouponError(null)

      if (!promoCode.trim()) {
        setCouponError('Please enter a promo code')
        return
      }

      if (!activeCart || activeCart.items?.length === 0) {
        setCouponError('Your cart is empty')
        return
      }

      const cartItems = selectedItems.map((item: CartItem) => ({
        product: {
          _id: item.product._id,
        },
      }))

      validateCouponMutation.mutate(
        {
          code: promoCode.trim().toUpperCase(),
          cartTotal: subtotal || 0,
          userId: user?.userId || undefined,
          cartItems,
        },
        {
          onSuccess: (data) => {
            if (data.valid && data.coupon) {
              setAppliedCoupon(data.coupon)
              onCouponApplied?.(promoCode.trim().toUpperCase(), data.coupon)
              setCouponError(null)
              triggerConfetti()
              setShowSuccessAnimation(true)
              setTimeout(() => {
                setShowSuccessAnimation(false)
              }, 2500)
            } else {
              setCouponError(data.error || 'Invalid coupon code')
            }
          },
          onError: (error: unknown) => {
            const axiosError = error as {
              response?: { data?: { error?: string } }
            }
            const errorMessage = axiosError.response?.data?.error || 'Failed to validate coupon'
            setCouponError(errorMessage)
          },
        },
      )
    },
    [
      activeCart,
      selectedItems,
      subtotal,
      user?.userId,
      validateCouponMutation,
      triggerConfetti,
      setAppliedCoupon,
    ],
  )

  // Validation logic
  const canProceedToReview = useMemo(() => {
    if (!selectedAddress) return false
    if (!selectedPaymentMethod) return false

    const isValidCardNumber = (value: string) => {
      const digits = value.replace(/\s/g, '')
      if (digits.length < 13 || digits.length > 19) return false

      // Luhn algorithm
      let sum = 0
      let shouldDouble = false
      for (let i = digits.length - 1; i >= 0; i -= 1) {
        let digit = parseInt(digits.charAt(i), 10)
        if (Number.isNaN(digit)) return false
        if (shouldDouble) {
          digit *= 2
          if (digit > 9) digit -= 9
        }
        sum += digit
        shouldDouble = !shouldDouble
      }
      return sum % 10 === 0
    }

    const isValidExpiry = (value: string) => {
      if (value.length !== 5 || !/^\d{2}\/\d{2}$/.test(value)) return false
      const [mm, yy] = value.split('/')
      const month = Number(mm)
      const year = Number(yy)
      if (month < 1 || month > 12) return false

      const now = new Date()
      const currentYear = now.getFullYear() % 100
      const currentMonth = now.getMonth() + 1

      if (year < currentYear) return false
      if (year === currentYear && month < currentMonth) return false
      return true
    }

    // If card payment is selected, validate card details
    if (selectedPaymentMethod.id === 'card') {
      return (
        isValidCardNumber(cardDetails.cardNumber) &&
        isValidExpiry(cardDetails.expiryDate) &&
        cardDetails.cvv.length === 3 &&
        cardDetails.nameOnCard.trim().length >= 2
      )
    }

    return true
  }, [selectedAddress, selectedPaymentMethod, cardDetails])

  const handleContinueToReview = useCallback(() => {
    if (!canProceedToReview) {
      toast.error('Please complete address and payment method selection')
      return
    }

    // Allow guests to proceed to review page - login will be required when placing order
    // Preserve buy now params if present
    const params = new URLSearchParams()
    if (buyNowProductId) params.set('productId', buyNowProductId)
    if (buyNowVariantId) params.set('variantId', buyNowVariantId)

    const queryString = params.toString()
    navigate(`/cart/checkout/review${queryString ? `?${queryString}` : ''}`)
  }, [canProceedToReview, navigate, buyNowProductId, buyNowVariantId])

  return {
    selectedItems,
    subtotal,
    discount,
    shipping,
    finalTotal,
    cartLoading: isLoadingCart,
    canProceedToReview,
    handleApplyPromoCode,
    handleContinueToReview,
    isPending: validateCouponMutation.isPending,
    isBuyNow: !!buyNowProductId,
  }
}
