import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/store/authStore'
import { guestCartUtils } from '@/utils/guestCart'
import { ArrowRight } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

interface CheckoutActionsProps {
  isCheckoutDisabled: boolean
  disabledReason: string | null
  onCheckout?: () => void
}

export const CheckoutActions = ({
  isCheckoutDisabled,
  disabledReason,
  onCheckout,
}: CheckoutActionsProps) => {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuthStore()

  const handleCheckout = () => {
    if (onCheckout) {
      onCheckout()
      return
    }

    // If no onCheckout prop provided, use default behavior
    // For guests, allow them to go to checkout (they'll be asked to login at review)
    if (!isAuthenticated) {
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
      return
    }

    navigate('/cart/checkout', { state: { fromCart: true } })
  }

  return (
    <div className="space-y-3">
      <Button
        variant="primary"
        className="h-12 w-full rounded-xl text-sm font-semibold shadow-[0_16px_30px_-18px_rgba(19,91,180,0.7)] sm:text-base"
        size="lg"
        disabled={isCheckoutDisabled}
        onClick={handleCheckout}
      >
        <span className="hidden sm:inline">Proceed to </span>Checkout
        <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 ml-1 sm:ml-2" />
      </Button>
      {isCheckoutDisabled && disabledReason && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-center text-[10px] text-red-600 sm:text-xs">
          {disabledReason}
        </p>
      )}

      <Link to="/shop-by-category">
        <Button
          variant="outline"
          className="h-11 w-full rounded-xl border-slate-200 bg-white text-sm sm:text-base"
          size="lg"
        >
          Continue Shopping
        </Button>
      </Link>
    </div>
  )
}
