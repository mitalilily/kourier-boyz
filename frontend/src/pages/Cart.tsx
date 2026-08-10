import {
  CartEmptyState,
  CartHeader,
  CartItemsList,
  CartLoadingState,
  OrderSummary,
  OutOfStockWarning,
} from '@/components/cart'
import { useCartDelivery } from '@/hooks/useCartDelivery'
import { useCheckoutStorage } from '@/hooks/useCheckoutStorage'
import { useGuestCart } from '@/hooks/useGuestCart'
import { useQueryClient } from '@tanstack/react-query'
import confetti from 'canvas-confetti'
import { AnimatePresence, motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  useCart,
  useClearCart,
  useRemoveCartItem,
  useSaveForLater,
  useToggleAllSelection,
  useToggleItemSelection,
  useUpdateCartItem,
} from '../api/cart'
import { useValidateCoupon, type CouponValidationResponse } from '../api/coupons'
import { useAuthStore } from '../store/authStore'
import type { CartItem } from '../types/cart'
import { getStoredDeliveryPin } from '../utils/deliveryLocationStorage'
import { guestCartUtils } from '../utils/guestCart'

const getCartItemKey = (productId: string, variantId?: string) =>
  `${productId}::${variantId || 'no-variant'}`

const Cart: React.FC = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { clearAll } = useCheckoutStorage()
  const { isAuthenticated } = useAuthStore()
  const { data: cartData, isLoading } = useCart()
  const { data: guestCartData, isLoading: isGuestCartLoading } = useGuestCart()
  const cart = cartData?.data || cartData?.cart

  // Refetch cart when authentication state changes (e.g., after login/logout)
  useEffect(() => {
    if (isAuthenticated) {
      // User just logged in - refetch cart to get merged items
      console.log('User logged in, refetching cart')
      queryClient.invalidateQueries({ queryKey: ['cart'] })
      queryClient.refetchQueries({ queryKey: ['cart'] })
    } else {
      // Check if there are items in guest cart
      const guestCartItems = guestCartUtils.getCart()
      console.log('User logged out, guest cart items:', guestCartItems.length)

      // Invalidate and refetch guest cart when user logs out
      queryClient.invalidateQueries({ queryKey: ['guest-cart'] })
      window.dispatchEvent(new CustomEvent('guest-cart-updated'))

      // Force refetch after a short delay to ensure state is updated
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['guest-cart'] })
      }, 100)
    }
  }, [isAuthenticated, queryClient])
  const updateMutation = useUpdateCartItem()
  const removeMutation = useRemoveCartItem()
  const clearMutation = useClearCart()
  const saveForLaterMutation = useSaveForLater()
  const toggleItemSelectionMutation = useToggleItemSelection()
  const toggleAllSelectionMutation = useToggleAllSelection()
  const validateCouponMutation = useValidateCoupon()
  const { user } = useAuthStore()

  // Use guest cart if not authenticated
  // Transform guest cart data to match authenticated cart structure
  const activeCart = useMemo(() => {
    if (isAuthenticated) {
      return cart
    } else {
      // Transform guest cart data to match cart structure
      // If query hasn't loaded yet or is loading, return empty structure
      if (isGuestCartLoading) {
        return {
          _id: 'guest',
          user: 'guest',
          items: [],
          totalQuantity: 0,
          totalAmount: 0,
          shipping: 0,
          totalWithShipping: 0,
        }
      }

      if (guestCartData) {
        console.log('Guest cart data received:', {
          itemsCount: guestCartData.items?.length || 0,
          totalQuantity: guestCartData.totalQuantity,
          totalAmount: guestCartData.totalAmount,
          shipping: guestCartData.shipping,
        })
        return {
          _id: 'guest',
          user: 'guest',
          items: guestCartData.items || [],
          totalQuantity: guestCartData.totalQuantity || 0,
          totalAmount: guestCartData.totalAmount || 0,
          shipping: guestCartData.shipping || 0,
          totalWithShipping: guestCartData.totalWithShipping || guestCartData.totalAmount || 0,
        }
      }

      // If no guestCartData but we're not loading, check localStorage directly
      if (!isGuestCartLoading) {
        const directCart = guestCartUtils.getCart()
        console.log(
          'No guestCartData but not loading, checking localStorage directly:',
          directCart.length,
          'items',
        )
        if (directCart.length > 0) {
          // Force a refetch - the query should pick this up
          setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: ['guest-cart'] })
            window.dispatchEvent(new CustomEvent('guest-cart-updated'))
          }, 100)
        }
      }

      // Return empty cart structure if no data
      return {
        _id: 'guest',
        user: 'guest',
        items: [],
        totalQuantity: 0,
        totalAmount: 0,
        shipping: 0,
        totalWithShipping: 0,
      }
    }
  }, [isAuthenticated, cart, guestCartData, isGuestCartLoading, queryClient])

  const isLoadingCart = isAuthenticated ? isLoading : isGuestCartLoading
  const [promoCode, setPromoCode] = useState('')
  const [appliedCoupon, setAppliedCoupon] = useState<CouponValidationResponse['coupon'] | null>(
    null,
  )
  const [showPromoInput, setShowPromoInput] = useState(false)
  const [couponError, setCouponError] = useState<string | null>(null)
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false)

  // Set page title
  useEffect(() => {
    document.title = 'Your Shopping Cart - Kourier Boyz'
  }, [])

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

  const handleQuantityChange = (item: CartItem, newQuantity: number) => {
    // Enforce minimum order quantity
    const minOrderQuantity = item.product.minOrderQuantity ?? 1
    if (newQuantity < minOrderQuantity) {
      // Don't allow decreasing below min order quantity
      return
    }

    const availableStock = item.product.stock
    const maxOrderQuantity = item.product.maxOrderQuantity ?? availableStock
    const maxAllowed = Math.min(availableStock, maxOrderQuantity)

    if (newQuantity > maxAllowed) {
      toast.error(`Maximum order quantity is ${maxAllowed} ${maxAllowed === 1 ? 'unit' : 'units'}`)
      return
    }

    if (!isAuthenticated) {
      // Update guest cart
      guestCartUtils.updateItem(item.product._id, item.variantId, { quantity: newQuantity })
      window.dispatchEvent(new CustomEvent('guest-cart-updated'))
      toast.success('Cart updated')
      return
    }

    updateMutation.mutate({
      productId: item.product._id,
      variantId: item.variantId || undefined,
      quantity: newQuantity,
    })
  }

  const handleRemove = (item: CartItem) => {
    if (!isAuthenticated) {
      // Remove from guest cart
      guestCartUtils.removeItem(item.product._id, item.variantId)
      window.dispatchEvent(new CustomEvent('guest-cart-updated'))
      toast.success('Item removed')
      return
    }

    removeMutation.mutate({
      productId: item.product._id,
      variantId: item.variantId,
    })
  }

  const handleSaveForLater = (item: CartItem) => {
    if (!isAuthenticated) {
      toast.info('Please login to save items for later')
      navigate('/login?redirect=/cart')
      return
    }

    saveForLaterMutation.mutate({
      productId: item.product._id,
      variantId: item.variantId,
    })
  }

  const handleSelectionChange = (item: CartItem, selected: boolean) => {
    if (!isAuthenticated) {
      // Update guest cart selection
      guestCartUtils.updateItem(item.product._id, item.variantId, { selected })
      window.dispatchEvent(new CustomEvent('guest-cart-updated'))
      return
    }

    toggleItemSelectionMutation.mutate({
      productId: item.product._id,
      variantId: item.variantId,
      selected,
    })
  }

  const handleToggleAllSelection = (selected: boolean) => {
    if (!isAuthenticated) {
      // Update all guest cart items selection
      const guestCart = guestCartUtils.getCart()
      guestCart.forEach((item) => {
        guestCartUtils.updateItem(item.productId, item.variantId, { selected })
      })
      window.dispatchEvent(new CustomEvent('guest-cart-updated'))
      return
    }

    toggleAllSelectionMutation.mutate({ selected })
  }

  const triggerConfetti = () => {
    // Reduced confetti - single burst from center
    confetti({
      particleCount: 30,
      spread: 60,
      origin: { y: 0.6 },
      colors: ['#10b981', '#fbbf24', '#3b82f6'],
      startVelocity: 20,
      ticks: 100,
      zIndex: 0,
    })
  }

  const handleApplyPromoCode = () => {
    setCouponError(null)

    if (!promoCode.trim()) {
      setCouponError('Please enter a promo code')
      return
    }

    if (!activeCart || activeCart.items?.length === 0) {
      setCouponError('Your cart is empty')
      return
    }

    // Prepare selected cart items for validation (only product IDs needed, backend will fetch categories)
    const cartItems = selectedItems.map((item: CartItem) => ({
      product: {
        _id: item.product._id,
      },
    }))

    validateCouponMutation.mutate(
      {
        code: promoCode.trim().toUpperCase(),
        cartTotal: originalSubtotal || 0,
        userId: user?.userId || undefined,
        cartItems,
      },
      {
        onSuccess: (data) => {
          if (data.valid && data.coupon) {
            setAppliedCoupon(data.coupon)
            setCouponError(null)
            setPromoCode('')
            setShowPromoInput(false)

            // Trigger confetti animation
            triggerConfetti()

            // Show success animation
            setShowSuccessAnimation(true)
            setTimeout(() => {
              setShowSuccessAnimation(false)
            }, 2500) // Reduced from 5000ms to 2500ms (2.5 seconds)
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
  }

  const handleRemovePromoCode = () => {
    setAppliedCoupon(null)
    setCouponError(null)
    setShowSuccessAnimation(false)
  }

  const handleCancelPromo = () => {
    setShowPromoInput(false)
    setPromoCode('')
    setCouponError(null)
  }

  const updatingItemKey =
    isAuthenticated && updateMutation.isPending && updateMutation.variables
      ? getCartItemKey(updateMutation.variables.productId, updateMutation.variables.variantId)
      : null

  const removingItemKey =
    isAuthenticated && removeMutation.isPending && removeMutation.variables
      ? getCartItemKey(removeMutation.variables.productId, removeMutation.variables.variantId)
      : null

  const savingItemKey =
    isAuthenticated && saveForLaterMutation.isPending && saveForLaterMutation.variables
      ? getCartItemKey(saveForLaterMutation.variables.productId, saveForLaterMutation.variables.variantId)
      : null

  const isOutOfStock = (item: CartItem) => {
    if (item.unavailable) return true
    const stock = item.product.stock
    const status = item.product.status
    return stock === 0 || status === 'out_of_stock' || status === 'inactive'
  }

  const isLowStock = (item: CartItem) => {
    const stock = item.product.stock
    return stock > 0 && stock <= 5 && !isOutOfStock(item)
  }

  // Get selected items (default to all if selected is undefined)
  const selectedItems = activeCart?.items?.filter((item: CartItem) => item.selected !== false) || []
  const selectedCount = selectedItems.length
  const allSelected = activeCart?.items
    ? activeCart.items.length > 0 && activeCart.items.every((item: CartItem) => item.selected !== false)
    : false

  // Get delivery PIN from localStorage
  const getDeliveryPin = () => {
    return getStoredDeliveryPin()
  }

  // Track header location changes so we can recompute delivery PIN without a full page refresh
  const [locationChangeTick, setLocationChangeTick] = useState(0)

  useEffect(() => {
    const handleLocationChange = () => {
      setLocationChangeTick((prev) => prev + 1)
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('kourier-boyz-location-changed', handleLocationChange)
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('kourier-boyz-location-changed', handleLocationChange)
      }
    }
  }, [])

  const deliveryPin = useMemo(() => getDeliveryPin(), [locationChangeTick])

  // Use cart delivery hook to get serviceability
  const { deliveryStatus, isCheckingServiceability } = useCartDelivery({
    selectedItems,
    deliveryPin,
    paymentType: 'cod',
  })

  const outOfStockItems = activeCart?.items?.filter((item: CartItem) => isOutOfStock(item)) || []
  const selectedOutOfStockItems = selectedItems.filter((item: CartItem) => isOutOfStock(item))

  // Calculate subtotal based on selected items only (using discounted prices if coupon applied)
  const selectedSubtotal = selectedItems.reduce((total: number, item: CartItem) => {
    // Use subtotal from cart (which includes discount) or calculate using current effectivePrice
    if (item.subtotal !== undefined) {
      return total + item.subtotal
    }
    // If subtotal is not available, calculate using discounted price or current effectivePrice
    // Variant data is now merged into product
    const currentEffectivePrice =
      item.product.effectivePrice ?? item.product.price ?? item.priceAtAddition
    const itemPrice = item.discountedPrice ?? currentEffectivePrice ?? 0
    return total + itemPrice * item.quantity
  }, 0)

  // Calculate original subtotal using current effectivePrice (before discounts) for display
  const originalSubtotal = selectedItems.reduce((total: number, item: CartItem) => {
    // Variant data is now merged into product
    const currentEffectivePrice =
      item.product.effectivePrice ?? item.product.price ?? item.priceAtAddition
    return total + currentEffectivePrice * item.quantity
  }, 0)

  // Calculate total discount from item-level coupons (applied per unit)
  const itemCouponDiscount = selectedItems.reduce((total: number, item: CartItem) => {
    if (item.appliedCoupon && item.discountAmount) {
      return total + (item.discountAmount || 0)
    }
    return total
  }, 0)

  // Calculate other savings (product discounts, not coupons)
  const calculateSavings = () => {
    if (!activeCart) return 0
    return selectedItems.reduce((total: number, item: CartItem) => {
      // Only count savings from product-level discounts, not coupons
      if (item.appliedCoupon) return total // Skip items with coupons
      const originalPrice = item.product.effectivePrice ?? (item.product.price || 0)
      const currentPrice = item.priceAtAddition || 0
      if (originalPrice > currentPrice) {
        return total + (originalPrice - currentPrice) * item.quantity
      }
      return total
    }, 0)
  }

  const savings = calculateSavings()
  const hasSelectedOutOfStockItems = selectedOutOfStockItems.length > 0
  const hasSelectedItems = selectedCount > 0

  // Calculate cart-level coupon discount (from promo code input)
  // IMPORTANT: Cart-level coupons are calculated on the original subtotal (NOT including shipping)
  // Coupons are always applied on order subtotal, never on total with shipping
  const cartCouponDiscount = appliedCoupon
    ? appliedCoupon.type === 'percentage'
      ? (originalSubtotal * appliedCoupon.value) / 100 // Calculate on subtotal only
      : appliedCoupon.value // Fixed discount amount
    : 0

  // Apply max discount limit if applicable (for cart-level coupons)
  const finalCartCouponDiscount =
    appliedCoupon && appliedCoupon.maxDiscountAmount
      ? Math.min(cartCouponDiscount, appliedCoupon.maxDiscountAmount)
      : cartCouponDiscount

  // Final subtotal after discounts = selected items subtotal (with item discounts) - cart coupon discount
  // This is the discounted subtotal (before shipping)
  const discountedSubtotal = Math.max(0, selectedSubtotal - finalCartCouponDiscount)

  // Get shipping from cart (calculated on backend for selected items)
  // For authenticated users, use cart.shipping
  // For guest users, use activeCart.shipping (from guestCartData)
  const cartShipping = isAuthenticated 
    ? (cart?.shipping || 0)
    : (activeCart?.shipping || 0)

  // Final total = discounted subtotal + shipping
  // IMPORTANT: Discount is applied to subtotal, then shipping is added
  // Discount is NOT applied to shipping charges
  const finalTotal = discountedSubtotal + cartShipping

  // Clear coupon if cart becomes empty
  useEffect(() => {
    if (appliedCoupon && (!activeCart || activeCart.items?.length === 0)) {
      setAppliedCoupon(null)
    }
  }, [appliedCoupon, activeCart])

  if (isLoadingCart) {
    return <CartLoadingState />
  }

  // Check if cart is actually empty (not just loading)
  const hasItems = activeCart?.items && activeCart.items.length > 0
  console.log('activeCart', activeCart)
  if (!hasItems && !isLoadingCart) {
    return <CartEmptyState />
  }

  const checkoutDisabledReason = hasSelectedOutOfStockItems
    ? 'Please remove, save, or deselect out of stock items to checkout'
    : !hasSelectedItems
    ? 'Select at least one item to proceed'
    : null

  return (
    <div className="relative mt-0 min-h-screen overflow-hidden bg-[linear-gradient(180deg,_#f8fafc,_#ffffff_18%,_#f8fafc_100%)] p-3 sm:p-4 md:mt-28 md:p-4 lg:p-6">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[28rem] bg-[radial-gradient(circle_at_top_left,_rgba(19,83,164,0.10),_transparent_36%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.08),_transparent_28%)]" />
      {/* Loading Overlay */}
      <AnimatePresence>
        {(removeMutation.isPending || clearMutation.isPending) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 h-full w-full flex justify-center items-center bg-white/80 backdrop-blur-sm z-50"
          >
            <div className="text-center">
              <Loader2 className="w-8 h-8 sm:w-10 sm:h-10 animate-spin text-primary mx-auto mb-3" />
              <p className="text-sm sm:text-base text-gray-700 font-medium">
                {clearMutation.isPending ? 'Clearing cart...' : 'Updating cart...'}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative mx-auto max-w-7xl">
        <CartHeader
          savings={savings}
          itemCount={activeCart?.items?.length || 0}
          onClearCart={() => {
            if (!isAuthenticated) {
              guestCartUtils.clearCart()
              window.dispatchEvent(new CustomEvent('guest-cart-updated'))
              toast.success('Cart cleared')
            } else {
              clearMutation.mutate()
            }
          }}
          isClearing={isAuthenticated ? clearMutation.isPending : false}
        />

        <OutOfStockWarning
          totalOutOfStockItems={outOfStockItems.length}
          selectedOutOfStockItems={selectedOutOfStockItems.length}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          <CartItemsList
            items={activeCart?.items || []}
            selectedCount={selectedCount}
            allSelected={allSelected}
            onToggleAllSelection={handleToggleAllSelection}
            onQuantityChange={handleQuantityChange}
            onRemove={handleRemove}
            onSaveForLater={handleSaveForLater}
            onSelectionChange={handleSelectionChange}
            isOutOfStock={isOutOfStock}
            isLowStock={isLowStock}
            isUpdatingItem={(item) =>
              updatingItemKey === getCartItemKey(item.product._id, item.variantId)
            }
            isRemovingItem={(item) =>
              removingItemKey === getCartItemKey(item.product._id, item.variantId)
            }
            isSavingForLaterItem={(item) =>
              savingItemKey === getCartItemKey(item.product._id, item.variantId)
            }
            isTogglingSelection={isAuthenticated ? toggleAllSelectionMutation.isPending : false}
          />

          <OrderSummary
            cart={{
              totalAmount: originalSubtotal,
              discountedAmount: selectedSubtotal,
              totalQuantity: selectedItems.reduce((sum: number, item: CartItem) => sum + item.quantity, 0),
            }}
            savings={savings}
            itemCouponDiscount={itemCouponDiscount}
            cartCouponDiscount={finalCartCouponDiscount}
            appliedCoupon={appliedCoupon}
            finalTotal={finalTotal}
            shipping={cartShipping}
            hasOutOfStockItems={hasSelectedOutOfStockItems}
            hasSelectedItems={hasSelectedItems}
            promoCode={promoCode}
            setPromoCode={setPromoCode}
            showPromoInput={showPromoInput}
            setShowPromoInput={setShowPromoInput}
            couponError={couponError}
            showSuccessAnimation={showSuccessAnimation}
            isPending={validateCouponMutation.isPending || false}
            onApplyCoupon={handleApplyPromoCode}
            onRemoveCoupon={handleRemovePromoCode}
            onCancelPromo={handleCancelPromo}
            checkoutDisabledReason={checkoutDisabledReason}
            deliveryStatus={deliveryStatus}
            isCheckingServiceability={isCheckingServiceability}
            onCheckout={() => {
              if (!isAuthenticated) {
                // For guests, allow them to go to checkout and fill details
                // They'll be asked to login at review page
                // Store guest cart items for filtering in review page
                const guestCart = guestCartUtils.getCart()
                const guestCartItems = guestCart.map((item) => ({
                  productId: item.productId,
                  variantId: item.variantId,
                }))
                sessionStorage.setItem('guest_cart_items', JSON.stringify(guestCartItems))
                sessionStorage.setItem('checkout_intent', 'true')
                sessionStorage.setItem('checkout_redirect', '/cart/checkout/review')

                navigate('/cart/checkout', { state: { fromCart: true } })
              } else {
                navigate('/cart/checkout', { state: { fromCart: true } })
              }
            }}
          />
        </div>
      </div>
    </div>
  )
}

export default Cart
