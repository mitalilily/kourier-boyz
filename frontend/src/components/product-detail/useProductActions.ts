import { useAddToCart } from '@/api/cart'
import { useToggleWishlist, useWishlistStatus } from '@/api/wishlist'
import { useAuthStore } from '@/store/authStore'
import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ProductVariant } from './utils'

interface UseProductActionsProps {
  product:
    | {
        _id: string
        hasVariants?: boolean
        status?: string
        stock?: number
        totalStock?: number
      }
    | null
    | undefined
  activeVariant: ProductVariant | null
  isOutOfStock: boolean
}

export const useProductActions = ({
  product,
  activeVariant,
  isOutOfStock,
}: UseProductActionsProps) => {
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated } = useAuthStore()
  const { toggleProduct, isLoading: isWishlistMutating } = useToggleWishlist()
  const { isInWishlist } = useWishlistStatus(product?._id)
  const addToCartMutation = useAddToCart()
  const [isWishlistActive, setIsWishlistActive] = useState(false)

  // Sync wishlist status
  useEffect(() => {
    setIsWishlistActive(isInWishlist)
  }, [isInWishlist])

  const handleAddToCart = async (): Promise<boolean> => {
    if (!product?._id) return false

    if (isOutOfStock) {
      toast.error('This product is currently out of stock')
      return false
    }

    // Allow guests to add to cart (guest cart will be used)
    // No need to redirect to login - guest cart functionality handles it

    if (product?.hasVariants && !activeVariant?._id) {
      toast.error('Please select a variant before adding to cart')
      return false
    }

    try {
      // Always add 1 to cart, regardless of quantity selector value
      await addToCartMutation.mutateAsync({
        productId: product._id,
        variantId: activeVariant?._id,
        quantity: 1,
      })
      return true
    } catch (err) {
      console.error(err)
      return false
    }
  }

  const handleBuyNow = async (options?: { quantity?: number; couponId?: string | null }) => {
    if (!product?._id) return

    if (isOutOfStock) {
      toast.error('This product is currently out of stock')
      return
    }

    // Allow guests to use buy now - they'll be prompted to login at checkout
    // Guest cart will be used to store the item temporarily

    if (product?.hasVariants && !activeVariant?._id) {
      toast.error('Please select a variant before buying')
      return
    }

    // Navigate directly to checkout with product info (Amazon-style Buy Now)
    // The checkout page will handle adding the item to cart if needed
    // For guests, checkout will prompt login when they try to proceed to review
    const params = new URLSearchParams()
    params.set('productId', product._id)
    params.set('quantity', String(options?.quantity || 1))
    if (activeVariant?._id) {
      params.set('variantId', activeVariant._id)
    }
    if (options?.couponId) {
      params.set('couponId', options.couponId)
    }
    params.set('buyNow', 'true') // Flag to indicate this is a buy now flow

    navigate(`/cart/checkout?${params.toString()}`)
  }

  const handleWishlistToggle = async () => {
    if (!product?._id) return

    if (!isAuthenticated) {
      localStorage.setItem('pendingWishlistProduct', product._id)
      const redirectUrl = `${location.pathname}${location.search}`
      navigate(`/login?redirect=${encodeURIComponent(redirectUrl)}`)
      return
    }

    setIsWishlistActive((prev) => !prev)
    try {
      // Pass variantId if product has variants and variant is selected
      await toggleProduct(product._id, activeVariant?._id)
    } catch (err) {
      setIsWishlistActive((prev) => !prev)
      console.error(err)
    }
  }

  const handleReviewLoginRedirect = () => {
    const redirectUrl = `${location.pathname}${location.search}`
    navigate(`/login?redirect=${encodeURIComponent(redirectUrl)}`)
  }

  return {
    isWishlistActive,
    isWishlistMutating,
    addToCartPending: addToCartMutation.isPending,
    handleAddToCart,
    handleBuyNow,
    handleWishlistToggle,
    handleReviewLoginRedirect,
  }
}
