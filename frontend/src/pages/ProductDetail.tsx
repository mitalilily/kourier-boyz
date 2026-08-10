import { useAddToCart, useCart, useRemoveCartItem, useUpdateCartItem } from '@/api/cart'
import type { CartItem } from '@/types/cart'
import { trackProductView, useProduct } from '@/api/products'
import { useCalculateProductDiscount, useGetAvailableCoupons } from '@/api/sellerCouponQueries'
import RecentlyViewedProducts from '@/components/Home/RecentlyViewedProducts'
import AlsoBoughtSection from '@/components/product-detail/AlsoBoughtSection'
import CustomerLoveSection from '@/components/product-detail/CustomerLoveSection'
import ProductGallery, { ZOOM_FACTOR } from '@/components/product-detail/ProductGallery'
import ProductHeaderBar from '@/components/product-detail/ProductHeaderBar'
import ProductHighlightsSection from '@/components/product-detail/ProductHighlightsSection'
import ProductIntelligenceTabs from '@/components/product-detail/ProductIntelligenceTabs'
import ProductReviewsSection from '@/components/product-detail/ProductReviewsSection'
import ProductSEO from '@/components/product-detail/ProductSEO'
import ProductShareSection from '@/components/product-detail/ProductShareSection'
import ProductSummarySidebar from '@/components/product-detail/ProductSummarySidebar'
import RelatedProductsSection from '@/components/product-detail/RelatedProductsSection'
import { useProductActions } from '@/components/product-detail/useProductActions'
import { useProductCalculations } from '@/components/product-detail/useProductCalculations'
import { useProductDelivery } from '@/components/product-detail/useProductDelivery'
import { useProductGallery } from '@/components/product-detail/useProductGallery'
import { useProductShare } from '@/components/product-detail/useProductShare'
import { useProductVariants } from '@/components/product-detail/useProductVariants'
import { Button } from '@/components/ui/button'
import { ShareButton } from '@/components/ui/ShareButton'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { guestCartUtils } from '@/utils/guestCart'
import { ChevronDown, Heart, Info, Share2 } from 'lucide-react'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

const ProductDetail: React.FC = () => {
  const { productIdOrSlug } = useParams<{ productIdOrSlug: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { data: product, isLoading, isError, error } = useProduct(productIdOrSlug || '')
  const { isAuthenticated } = useAuthStore()

  // Get variant ID from query params
  const variantIdFromQuery = searchParams.get('variant')
  const shouldOpenReviewDialog = searchParams.get('openReview') === '1'
  const lastSyncedVariantRef = useRef<string | null>(null)
  const { data: cartData, refetch: refetchCart } = useCart()
  const updateCartItemMutation = useUpdateCartItem()
  const removeCartItemMutation = useRemoveCartItem()
  const addToCartMutation = useAddToCart()
  const calculateDiscountMutation = useCalculateProductDiscount()
  // Force re-render when guest cart updates
  const [guestCartVersion, setGuestCartVersion] = useState(0)

  const cart = cartData?.data || cartData?.cart

  // Listen for guest cart updates to refresh cartItem
  useEffect(() => {
    if (!isAuthenticated) {
      const handleGuestCartUpdate = () => {
        setGuestCartVersion((v) => v + 1)
      }
      window.addEventListener('guest-cart-updated', handleGuestCartUpdate)
      return () => {
        window.removeEventListener('guest-cart-updated', handleGuestCartUpdate)
      }
    }
  }, [isAuthenticated])

  // Zoom state for product gallery
  const [zoomState, setZoomState] = useState<{
    isHovering: boolean
    zoomPosition: { x: number; y: number }
    selectedImage: string | null
  }>({
    isHovering: false,
    zoomPosition: { x: 0, y: 0 },
    selectedImage: null,
  })

  // Custom hooks for product logic
  const {
    variants,
    selectedAttributes,
    activeVariant,
    quantity,
    setQuantity,
    handleAttributeSelect: baseHandleAttributeSelect,
  } = useProductVariants({ product, initialVariantId: variantIdFromQuery })

  // Update query params when variant changes (only when variant actually changes)
  useEffect(() => {
    // Don't update query params if product is still loading
    if (isLoading || !product) return

    // If product has variants, wait for variants to be loaded before making decisions
    if (product.hasVariants && variants.length === 0) return

    const currentVariantId = activeVariant?._id || null

    // Skip if we've already synced this variant
    if (lastSyncedVariantRef.current === currentVariantId) return

    if (currentVariantId) {
      // Update query param to match current variant
      setSearchParams((prev) => {
        const currentParam = prev.get('variant')
        if (currentParam === currentVariantId) {
          // Already in sync, don't update
          return prev
        }
        const newParams = new URLSearchParams(prev)
        newParams.set('variant', currentVariantId)
        return newParams
      })
      lastSyncedVariantRef.current = currentVariantId
    } else {
      // No active variant - remove query param if it exists
      setSearchParams((prev) => {
        const hasVariantParam = prev.has('variant')
        if (!hasVariantParam) {
          // Already no param, don't update
          return prev
        }

        // Only remove if product doesn't have variants OR variant doesn't exist
        if (!product.hasVariants) {
          const newParams = new URLSearchParams(prev)
          newParams.delete('variant')
          return newParams
        } else if (variants.length > 0) {
          const queryVariantId = prev.get('variant')
          const variantExists = queryVariantId
            ? variants.some((v) => v._id === queryVariantId)
            : false
          if (!variantExists) {
            const newParams = new URLSearchParams(prev)
            newParams.delete('variant')
            return newParams
          }
          // Variant exists, keep the param
          return prev
        }
        return prev
      })
      lastSyncedVariantRef.current = null
    }
  }, [activeVariant?._id, isLoading, product, variants, setSearchParams])

  // Once we've seen openReview=1 once, remove it from the URL so refresh doesn't trigger again
  useEffect(() => {
    if (!shouldOpenReviewDialog) return
    // Delay removal slightly so the reviews section can auto-open the dialog first
    const timer = setTimeout(() => {
      setSearchParams((prev) => {
        if (!prev.has('openReview')) return prev
        const next = new URLSearchParams(prev)
        next.delete('openReview')
        return next
      })
    }, 1000)

    return () => clearTimeout(timer)
  }, [shouldOpenReviewDialog, setSearchParams])

  // Find cart item for current product/variant (works for both authenticated and guest users)
  const cartItem = useMemo(() => {
    if (!product?._id) return null

    // For authenticated users, check API cart
    if (isAuthenticated && cart?.items) {
      const foundItem = cart.items.find((item) => {
        const productMatch = item.product._id === product._id
        if (!productMatch) return false

        // If product has variants, match the active variant
        if (product.hasVariants) {
          const activeVariantId = activeVariant?._id
          if (!activeVariantId) return false
          return item.variantId === activeVariantId
        }

        // For non-variant products, match items without variants
        return !item.variantId
      })
      if (foundItem) return foundItem
    }

    // For guest users, check localStorage guest cart
    if (!isAuthenticated) {
      const guestCartItems = guestCartUtils.getCart()
      const guestItem = guestCartItems.find((item) => {
        const productMatch = item.productId === product._id
        if (!productMatch) return false

        // If product has variants, match the active variant
        if (product.hasVariants) {
          const activeVariantId = activeVariant?._id
          if (!activeVariantId) return false
          return item.variantId === activeVariantId
        }

        // For non-variant products, match items without variants
        return !item.variantId
      })

      if (guestItem) {
        // Convert guest cart item to match authenticated cart item structure
        // We only need product._id and quantity for checking if item is in cart
        return {
          product: { _id: guestItem.productId } as CartItem['product'],
          variantId: guestItem.variantId,
          quantity: guestItem.quantity,
          priceAtAddition: 0, // Not needed for cart detection
        } as CartItem
      }
    }

    return null
  }, [cart?.items, product?._id, product?.hasVariants, activeVariant?._id, isAuthenticated, guestCartVersion])

  // Initialize quantity from cart if product is already in cart, or reset to min order
  useEffect(() => {
    if (cartItem && cartItem.quantity > 0) {
      // Always sync quantity from cart when item is in cart
      setQuantity(cartItem.quantity)
    } else if (product) {
      // Reset to min order quantity if not in cart
      const minOrder = Math.max(product.minOrderQuantity ?? 1, 1)
      setQuantity(minOrder)
    }
  }, [cartItem?.quantity, cartItem?.product?._id, product?.minOrderQuantity, product?._id, activeVariant?._id, setQuantity, isAuthenticated])

  // Initialize applied coupon from cart if product is already in cart with coupon
  useEffect(() => {
    // When cart item or variant changes, sync the applied coupon
    if (cartItem?.appliedCoupon && cartItem?.couponCode) {
      // Product is already in cart with a coupon - set it as applied
      // The existing discount calculation effect will handle recalculating the discount
      // when appliedCouponId is set, so we just need to set it here
      if (appliedCouponId !== cartItem.appliedCoupon) {
        setAppliedCouponId(cartItem.appliedCoupon)
      }
    } else if (cartItem && !cartItem.appliedCoupon && appliedCouponId) {
      // Cart item exists but doesn't have a coupon - clear applied coupon
      // This handles the case where coupon was removed from cart item
      setAppliedCouponId(null)
      setDiscountedPriceData(null)
    } else if (!cartItem && appliedCouponId) {
      // Product is not in cart but coupon is applied - clear it
      // This handles the case where user removes item from cart or changes variant
      setAppliedCouponId(null)
      setDiscountedPriceData(null)
    }
    // Run when cart item, coupon, or variant changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartItem?.appliedCoupon, cartItem?.couponCode, activeVariant?._id])

  // Handle quantity change - update cart if product is already in cart
  const handleQuantityChange = async (newQuantity: number) => {
    const previousQuantity = quantity
    
    // Enforce minimum order quantity - prevent going below min
    if (newQuantity < minOrderQuantity) {
      // Don't update if trying to go below min (QuantitySelector should handle this, but extra safeguard)
      return
    }
    
    // Enforce maximum order quantity - prevent going above max
    if (newQuantity > maxOrderQuantity) {
      // Don't update if trying to go above max (QuantitySelector should handle this, but extra safeguard)
      return
    }
    
    setQuantity(newQuantity)

    // If product is already in cart, update cart immediately
    if (cartItem && product?._id) {
      try {
        if (isAuthenticated) {
          // Update authenticated cart
          await updateCartItemMutation.mutateAsync({
            productId: product._id,
            variantId: activeVariant?._id,
            quantity: newQuantity,
          })
        } else {
          // Update guest cart
          guestCartUtils.updateItem(product._id, activeVariant?._id, {
            quantity: newQuantity,
          })
          // Trigger event to update UI
          window.dispatchEvent(new CustomEvent('guest-cart-updated'))
          setGuestCartVersion((v) => v + 1)
        }
      } catch (err) {
        console.error('Failed to update cart quantity:', err)
        // Revert quantity on error
        setQuantity(previousQuantity)
      }
    }
  }

  const {
    galleryImages,
    galleryVideos,
    selectedImage,
    setSelectedImage,
    displayedImage,
    handleVariantHoverPreview,
  } = useProductGallery({
    product,
    activeVariant,
  })

  // Track product view when product loads
  useEffect(() => {
    if (product?._id && !isLoading) {
      // Track view asynchronously without blocking the UI
      trackProductView(product._id).catch((error) => {
        // Silently fail - view tracking shouldn't break the page
        console.error('Failed to track product view:', error)
      })
    }
  }, [product?._id, isLoading])

  const {
    price,
    comparePrice,
    effectiveDiscount,
    availableStock,
    isOutOfStock,
    isLowStock,
    minOrderQuantity,
    maxOrderQuantity,
  } = useProductCalculations({ product, activeVariant })

  const {
    isWishlistActive,
    isWishlistMutating,
    handleBuyNow,
    handleWishlistToggle,
    handleReviewLoginRedirect,
  } = useProductActions({
    product,
    activeVariant,
    isOutOfStock,
  })

  // Wrapper to add to cart with coupon
  const handleAddToCart = async () => {
    if (!product?._id) return

    if (isOutOfStock) {
      toast.error('This product is currently out of stock')
      return
    }

    // Allow guests to add to cart (guest cart will be used)
    // No need to redirect to login - guest cart functionality handles it

    if (product?.hasVariants && !activeVariant?._id) {
      toast.error('Please select a variant before adding to cart')
      return
    }

    // Ensure quantity is at least minOrderQuantity
    const quantityToAdd = Math.max(quantity, minOrderQuantity)

    try {
      await addToCartMutation.mutateAsync({
        productId: product._id,
        variantId: activeVariant?._id,
        quantity: quantityToAdd,
        couponId: appliedCouponId || undefined,
      })

      // Update local quantity state to match what was added
      setQuantity(quantityToAdd)

      // Only refetch cart for authenticated users (guests use localStorage)
      if (isAuthenticated) {
        // Refetch cart to get updated data
        const { data: updatedCartData } = await refetchCart()
        const updatedCart = updatedCartData?.data || updatedCartData?.cart

        if (updatedCart?.items && product?._id) {
          const updatedCartItem = updatedCart.items.find((item) => {
            const productMatch = item.product._id === product._id
            if (!productMatch) return false

            if (product.hasVariants) {
              const activeVariantId = activeVariant?._id
              if (!activeVariantId) return false
              return item.variantId === activeVariantId
            }

            return !item.variantId
          })

          // Update quantity from the updated cart item (this ensures sync with backend)
          if (updatedCartItem && updatedCartItem.quantity > 0) {
            setQuantity(updatedCartItem.quantity)
          }
        }
      } else {
        // For guest cart, trigger event to update localStorage cart
        window.dispatchEvent(new CustomEvent('guest-cart-updated'))
      }
    } catch (error: unknown) {
      const errorMessage =
        error && typeof error === 'object' && 'response' in error
          ? (error as { response?: { data?: { error?: string } } })?.response?.data?.error
          : undefined
      console.error('Error adding to cart:', error)
      toast.error(errorMessage || 'Failed to add to cart')
    }
  }

  // Handle remove from cart
  const handleRemoveFromCart = async () => {
    if (!product?._id || !isAuthenticated) return

    try {
      await removeCartItemMutation.mutateAsync({
        productId: product._id,
        variantId: activeVariant?._id,
      })

      // Refetch cart and reset quantity to min order
      await refetchCart()
      const minOrder = Math.max(product.minOrderQuantity ?? 1, 1)
      setQuantity(minOrder)
    } catch (err) {
      console.error('Failed to remove from cart:', err)
    }
  }

  const {
    deliveryPin,
    deliveryStatus,
    handleDeliveryCheck,
    handleDeliveryPinChange,
    isCheckingServiceability,
  } = useProductDelivery({ product, isOutOfStock })

  const { productUrl, shareSummary, shareImage, handleQuickShare, handleCopyLink } =
    useProductShare({
      product,
      variant: activeVariant,
      selectedImage,
    })

  // Coupon support
  const sellerId = typeof product?.seller === 'object' ? product.seller._id : product?.seller
  const categoryId = product?.category?._id

  const { data: availableCouponsData, isLoading: isCouponsLoading } = useGetAvailableCoupons({
    productIds: product?._id,
    categoryIds: categoryId,
    sellerId,
    enabled: !!product?._id,
  })

  // Filter available coupons for this product
  const filteredAvailableCoupons = useMemo(() => {
    const coupons = availableCouponsData?.coupons || []
    return coupons.filter((c) => c.status === 'active' && (!c.requiresApproval || c.isApproved))
  }, [availableCouponsData?.coupons])

  // State for applied coupon on product page
  const [appliedCouponId, setAppliedCouponId] = useState<string | null>(null)
  const [discountedPriceData, setDiscountedPriceData] = useState<{
    originalTotal: number
    discountAmount: number
    discountedTotal: number
    discountedPricePerUnit: number
    allowedDiscountUnits?: number
    fullPriceUnits?: number
  } | null>(null)
  const [processingCouponId, setProcessingCouponId] = useState<string | null>(null) // Track which coupon is being applied/removed

  // Calculate discount when coupon is applied or quantity changes
  useEffect(() => {
    if (!appliedCouponId) {
      setDiscountedPriceData(null)
      return
    }

    if (!isAuthenticated || !product?._id || quantity <= 0 || calculateDiscountMutation.isPending) {
      return
    }

    const timeoutId = setTimeout(() => {
      calculateDiscountMutation.mutate(
        {
          couponId: appliedCouponId,
          productId: product._id,
          quantity,
          variantId: activeVariant?._id,
        },
        {
          onSuccess: (data) => {
            if (data.valid) {
              setDiscountedPriceData({
                originalTotal: data.originalTotal,
                discountAmount: data.discountAmount,
                discountedTotal: data.discountedTotal,
                discountedPricePerUnit: data.discountedPricePerUnit,
                allowedDiscountUnits: data.allowedDiscountUnits,
                fullPriceUnits: data.fullPriceUnits,
              })
            }
          },
          onError: (error: unknown) => {
            console.error('Error calculating discount:', error)
            const errorResponse =
              error && typeof error === 'object' && 'response' in error
                ? (
                    error as {
                      response?: {
                        status?: number
                        data?: { error?: string }
                      }
                    }
                  )?.response
                : null
            if (errorResponse?.status === 400 || errorResponse?.status === 401) {
              setAppliedCouponId(null)
              setDiscountedPriceData(null)
              toast.error(errorResponse?.data?.error || 'Coupon is not valid')
            }
          },
        },
      )
    }, 300)

    return () => clearTimeout(timeoutId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedCouponId, product?._id, quantity, activeVariant?._id, isAuthenticated])

  // Handle applying coupon
  const handleApplyCoupon = async (couponId: string) => {
    if (!product?._id) return

    if (!isAuthenticated) {
      const redirectUrl = `${location.pathname}${location.search}`
      toast.error('Please log in to use coupons')
      navigate(`/login?redirect=${encodeURIComponent(redirectUrl)}`)
      return
    }

    // Prevent multiple simultaneous apply operations
    if (calculateDiscountMutation.isPending || updateCartItemMutation.isPending) return

    setProcessingCouponId(couponId)
    try {
      const result = await calculateDiscountMutation.mutateAsync({
        couponId,
        productId: product._id,
        quantity,
        variantId: activeVariant?._id,
      })

      if (result.valid) {
        if (cartItem && isAuthenticated) {
          try {
            await updateCartItemMutation.mutateAsync({
              productId: product._id,
              variantId: activeVariant?._id,
              couponId,
            })
            await refetchCart()
          } catch (applyError) {
            const errorMessage =
              applyError && typeof applyError === 'object' && 'response' in applyError
                ? (
                    applyError as {
                      response?: {
                        data?: { error?: string }
                      }
                    }
                  )?.response?.data?.error
                : null
            toast.error(errorMessage || 'Failed to apply coupon to cart item')
            return
          }
        }

        setAppliedCouponId(couponId)
        setDiscountedPriceData({
          originalTotal: result.originalTotal,
          discountAmount: result.discountAmount,
          discountedTotal: result.discountedTotal,
          discountedPricePerUnit: result.discountedPricePerUnit,
          allowedDiscountUnits: result.allowedDiscountUnits,
          fullPriceUnits: result.fullPriceUnits,
        })
        if (result.allowedDiscountUnits && result.allowedDiscountUnits < quantity) {
          toast.success(
            `Coupon applied! Discount on ${result.allowedDiscountUnits} unit(s), ${result.fullPriceUnits} at full price`,
          )
        } else {
          toast.success('Coupon applied!')
        }
      }
    } catch (error: unknown) {
      const errorMessage =
        error && typeof error === 'object' && 'response' in error
          ? (error as { response?: { data?: { error?: string } } })?.response?.data?.error
          : undefined
      toast.error(errorMessage || 'Failed to apply coupon')
    } finally {
      setProcessingCouponId(null)
    }
  }

  // Handle removing coupon
  const handleRemoveCoupon = async () => {
    // Prevent multiple simultaneous remove operations
    if (updateCartItemMutation.isPending || calculateDiscountMutation.isPending) return

    setProcessingCouponId(appliedCouponId)
    // If item is in cart, remove coupon from cart item
    if (cartItem && isAuthenticated && product?._id) {
      try {
        await updateCartItemMutation.mutateAsync({
          productId: product._id,
          variantId: activeVariant?._id,
          removeCoupon: true,
        })
        // Refetch cart to get updated data
        await refetchCart()
        // Clear local state
        setAppliedCouponId(null)
        setDiscountedPriceData(null)
      } catch (error: unknown) {
        const errorMessage =
          error && typeof error === 'object' && 'response' in error
            ? (error as { response?: { data?: { error?: string } } })?.response?.data?.error
            : undefined
        toast.error(errorMessage || 'Failed to remove coupon from cart')
      } finally {
        setProcessingCouponId(null)
      }
    } else {
      // Item not in cart yet - just clear local state
      setAppliedCouponId(null)
      setDiscountedPriceData(null)
      setProcessingCouponId(null)
      toast.success('Coupon removed')
    }
  }

  // Get final price (discounted or original)
  const finalPrice = useMemo(() => {
    if (discountedPriceData) {
      return discountedPriceData.discountedPricePerUnit
    }
    return price
  }, [discountedPriceData, price])

  // Get total price for all quantities
  const finalTotal = useMemo(() => {
    if (discountedPriceData) {
      return discountedPriceData.discountedTotal
    }
    return price * quantity
  }, [discountedPriceData, price, quantity])

  // Handle attribute selection with image update
  const handleAttributeSelect = (attribute: string, value: string) => {
    baseHandleAttributeSelect(attribute, value, (variant) => {
      if (variant?.mainImage || variant?.images?.length) {
        setSelectedImage(
          variant.mainImage || variant.images?.[0] || selectedImage || galleryImages[0],
        )
      }
    })
  }

  const goBack = () => {
    if (window.history.length > 1) {
      navigate(-1)
    } else {
      navigate('/shop-by-category')
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-[70vh] bg-linear-to-b from-white to-gray-50">
        <div className=" mx-auto px-3 sm:px-4 lg:px-8 py-8 sm:py-10 lg:py-12 animate-pulse">
          <div className="h-5 sm:h-6 w-32 sm:w-40 bg-gray-200 rounded mb-4 sm:mb-6" />
          <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-6 sm:gap-8 lg:gap-10">
            <div className="aspect-square rounded-2xl sm:rounded-3xl bg-gray-200" />
            <div className="space-y-4 sm:space-y-6">
              <div className="h-6 sm:h-8 bg-gray-200 rounded w-3/4" />
              <div className="h-3 sm:h-4 bg-gray-200 rounded w-1/3" />
              <div className="h-12 sm:h-16 bg-gray-200 rounded" />
              <div className="h-40 sm:h-52 bg-gray-200 rounded-2xl sm:rounded-3xl" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (isError || !product) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
        <div className="max-w-md space-y-4">
          <div className="mx-auto h-16 w-16 rounded-full bg-red-100 flex items-center justify-center">
            <Info className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Product unavailable</h1>
          <p className="text-gray-600">
            {error instanceof Error
              ? error.message
              : 'The product you are looking for was not found or is no longer available.'}
          </p>
          <Button onClick={() => navigate('/shop-by-category')} size="lg" className="mt-2">
            Browse products
          </Button>
        </div>
      </div>
    )
  }

  const hasSpecifications =
    Array.isArray(product.specifications) && product.specifications.length > 0

  return (
    <>
      {/* SEO Meta Tags - Variant-based OG image
          IMPORTANT: OG tags are set dynamically via ProductSEO component
          Social media platforms (Facebook, Twitter, LinkedIn, WhatsApp) will:
          1. Fetch the shared URL
          2. Execute JavaScript (modern crawlers do this)
          3. Read OG tags from the page
          4. Display image, title, and description in link preview
          
          The image WILL appear in share previews because:
          - og:image tag is set with absolute image URL
          - og:image:secure_url is set for HTTPS
          - twitter:image is set for Twitter cards
          - Image URL is variant-based (shows the correct product variant image)
      */}
      {product && (
        <ProductSEO
          product={product}
          variant={activeVariant}
          selectedImage={selectedImage}
          productUrl={productUrl}
        />
      )}
      <div className="bg-linear-to-b pt-5 md:pt-20 lg:pt-28 from-white via-gray-50 to-white pb-36 sm:pb-24 lg:pb-28">
        <ProductHeaderBar
          onBack={goBack}
          effectiveDiscount={effectiveDiscount}
          productUrl={productUrl}
          productName={product.name}
          shareSummary={shareSummary}
          onWishlistToggle={handleWishlistToggle}
          isWishlistActive={isWishlistActive}
          isWishlistMutating={isWishlistMutating}
        />

        <div className=" mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8">
          <div className="flex items-center justify-between gap-2 mb-4 sm:mb-6">
            <nav className="text-xs sm:text-sm text-gray-500 flex flex-wrap items-center gap-1">
              <Link to="/" className="hover:text-gray-900 transition-colors">
                Home
              </Link>
              <span>/</span>
              <Link to="/shop-by-category" className="hover:text-gray-900 transition-colors">
                Shop
              </Link>
              {product.category ? (
                <>
                  <span>/</span>
                  <Link
                    to={`/shop-by-category?category=${product.category._id}`}
                    className="hover:text-gray-900 transition-colors"
                  >
                    {product.category.name}
                  </Link>
                </>
              ) : null}
              <span>/</span>
              <span className="text-gray-900 font-medium truncate max-w-[150px] sm:max-w-none">
                {product.name}
              </span>
            </nav>
            {/* Share and Wishlist buttons - Medium screens and above */}
            <div className="hidden md:flex items-center gap-2">
              <ShareButton
                url={productUrl}
                title={product.name}
                description={shareSummary}
                variant="outline"
                size="icon"
                className="rounded-full border-gray-200 hover:border-gray-300 hover:bg-gray-100 h-8 w-8"
              />
              <button
                onClick={handleWishlistToggle}
                disabled={isWishlistMutating}
                className={cn(
                  'rounded-full border px-2 py-1.5 flex items-center gap-1.5 text-xs font-medium transition-all',
                  isWishlistActive
                    ? 'border-rose-200 bg-rose-50 text-rose-600'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-100',
                )}
              >
                <Heart
                  className={cn(
                    'w-3.5 h-3.5 shrink-0',
                    isWishlistActive ? 'fill-rose-500 text-rose-500' : 'text-gray-500',
                  )}
                />
              </button>
            </div>
          </div>

          {/* Zoomed product image view - Fixed to viewport, always visible when hovering */}
          {zoomState.isHovering && zoomState.selectedImage && (
            <div
              className="fixed top-28 z-50 lg:block hidden rounded-2xl overflow-hidden bg-gray-50 shadow-2xl border-2 border-gray-300 pointer-events-none"
              style={{
                width: 'clamp(450px, 45vw, 600px)',
                height: 'clamp(450px, 45vw, 600px)',
                aspectRatio: '1 / 1',
                right: 'clamp(1.5rem, calc((100vw - 1280px) / 2 + 1.5rem), 2.5rem)',
              }}
            >
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage: `url(${zoomState.selectedImage})`,
                  backgroundSize: `${ZOOM_FACTOR * 100}%`,
                  backgroundPosition: `${zoomState.zoomPosition.x}px ${zoomState.zoomPosition.y}px`,
                  backgroundRepeat: 'no-repeat',
                }}
              />
            </div>
          )}

          {/* Top Section: Gallery + Buy Box */}
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1.25fr)] gap-6 sm:gap-8 xl:gap-12 mb-8 sm:mb-10 lg:mb-12">
            {/* Left: Product Gallery (Sticky) */}
            <div className="order-1 lg:self-start">
              <div className="lg:sticky lg:top-28 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:overflow-x-hidden scrollbar-hide lg:pr-2">
                {/* Sticky Gallery Container */}
                <div className="space-y-6 sm:space-y-8 lg:pb-4">
                  <ProductGallery
                    galleryImages={galleryImages}
                    galleryVideos={galleryVideos}
                    selectedImage={displayedImage}
                    onImageSelect={setSelectedImage}
                    productName={product.name}
                    onZoomChange={setZoomState}
                  />

                  {/* Wishlist and Share buttons - Mobile/Tablet only */}
                  <div className="lg:hidden mt-4 flex items-center justify-center gap-3">
                    <button
                      onClick={handleWishlistToggle}
                      disabled={isWishlistMutating}
                      className={cn(
                        'flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium transition-all',
                        isWishlistActive
                          ? 'border-rose-200 bg-rose-50 text-rose-600'
                          : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-100',
                      )}
                    >
                      <Heart
                        className={cn(
                          'w-4 h-4',
                          isWishlistActive ? 'fill-rose-500 text-rose-500' : 'text-gray-500',
                        )}
                      />
                      {isWishlistActive ? 'Saved' : 'Wishlist'}
                    </button>
                    <ShareButton
                      url={productUrl}
                      title={product.name}
                      description={shareSummary}
                      image={shareImage}
                      shareText={`${product.name} - Check it out on Kourier Boyz!`}
                      showLabel={false}
                      triggerButton={
                        <Button
                          variant="outline"
                          className="rounded-full border-gray-200 px-4 py-2.5 text-sm font-medium hover:border-gray-300 hover:bg-gray-100"
                        >
                          <Share2 className="w-4 h-4 mr-2" />
                          Share
                        </Button>
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Specifications - Below Gallery (non-sticky, scrolls with page) */}
              {hasSpecifications && product.specifications && product.specifications.length > 0 && (
                <div className="hidden lg:block mt-6 sm:mt-8 rounded-2xl sm:rounded-3xl border border-gray-100 bg-white/90 shadow-sm p-4 sm:p-6 lg:p-8">
                  <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4 sm:mb-6">
                    Specifications
                  </h2>
                  <SpecificationsSection specifications={product.specifications} />
                </div>
              )}
            </div>

            {/* Right: Buy Box with Zoom Preview */}
            <aside
              className="lg:sticky lg:top-28 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto scrollbar-hide lg:pl-2 space-y-4 sm:space-y-6 order-2"
              id="product-sidebar"
            >
              {/* Buy Box */}
              <ProductSummarySidebar
                product={product}
                effectiveDiscount={effectiveDiscount}
                selectedAttributes={selectedAttributes}
                onAttributeSelect={handleAttributeSelect}
                variants={variants}
                isOutOfStock={isOutOfStock}
                isLowStock={isLowStock}
                availableStock={availableStock}
                price={price}
                comparePrice={comparePrice}
                quantity={cartItem?.quantity || quantity || minOrderQuantity}
                onQuantityChange={handleQuantityChange}
                minOrderQuantity={minOrderQuantity}
                maxOrderQuantity={maxOrderQuantity}
                deliveryPin={deliveryPin}
                deliveryStatus={deliveryStatus}
                isCheckingServiceability={isCheckingServiceability}
                onDeliveryCheck={handleDeliveryCheck}
                onDeliveryPinChange={handleDeliveryPinChange}
                onAddToCart={async () => {
                  await handleAddToCart()
                }}
                onRemoveFromCart={handleRemoveFromCart}
                onBuyNow={async () => {
                  await handleBuyNow({ quantity, couponId: appliedCouponId })
                }}
                addToCartPending={addToCartMutation.isPending}
                removeFromCartPending={removeCartItemMutation.isPending}
                isInCart={!!cartItem}
                onVariantHover={handleVariantHoverPreview}
                // Coupon props
                availableCoupons={filteredAvailableCoupons}
                appliedCouponId={appliedCouponId}
                discountedPriceData={discountedPriceData}
                onApplyCoupon={handleApplyCoupon}
                onRemoveCoupon={handleRemoveCoupon}
                finalPrice={finalPrice}
                finalTotal={finalTotal}
                isCouponsLoading={isCouponsLoading}
                isCalculatingDiscount={calculateDiscountMutation.isPending}
                isApplyingCoupon={calculateDiscountMutation.isPending}
                isRemovingCoupon={updateCartItemMutation.isPending}
                processingCouponId={processingCouponId}
              />
            </aside>
          </div>

          {/* Product Information Section */}
          <div className="space-y-6 sm:space-y-8 lg:space-y-10 mb-8 sm:mb-10 lg:mb-12">
            {/* Product Details: Description & Specifications */}
            <ProductIntelligenceTabs product={product} hasSpecifications={hasSpecifications} />

            {/* Specifications - Mobile Only (Below Product Intelligence) */}
            {hasSpecifications && product.specifications && product.specifications.length > 0 && (
              <div className="lg:hidden rounded-2xl sm:rounded-3xl border border-gray-100 bg-white/90 shadow-sm p-4 sm:p-6">
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4 sm:mb-6">
                  Specifications
                </h2>
                <SpecificationsSection specifications={product.specifications} />
              </div>
            )}

            {/* Product Highlights/Features (Combined) */}
            <ProductHighlightsSection product={product} />

            {/* Customer Trust Indicators */}
            <CustomerLoveSection productId={product._id} />
          </div>

          {/* Reviews Section - Full Width */}
          <div id="reviews-section" className="mb-8 sm:mb-10 lg:mb-12">
            <ProductReviewsSection
              averageRating={product.rating}
              reviewCount={product.reviewCount}
              reviews={product.reviews}
              productId={product._id}
              productQueryKey={productIdOrSlug || product._id}
              isAuthenticated={isAuthenticated}
              onRequestLogin={handleReviewLoginRedirect}
              autoOpenDialog={shouldOpenReviewDialog}
            />
          </div>

          {/* Bottom Section: Share & Related Products */}
          <div className="space-y-6 sm:space-y-8 lg:space-y-10">
            <div id="share-section">
              <ProductShareSection
                productName={product.name}
                productUrl={productUrl}
                shareSummary={shareSummary}
                shareImage={shareImage}
                onQuickShare={handleQuickShare}
                onCopyLink={handleCopyLink}
              />
            </div>

            <AlsoBoughtSection currentProductId={product._id} />

            <RelatedProductsSection
              currentProductId={product._id}
              categoryId={product.category?._id}
            />

            <RecentlyViewedProducts />
          </div>
        </div>
      </div>
    </>
  )
}

interface SpecificationsSectionProps {
  specifications: Array<{ key: string; value: string }>
}

const SpecificationsSection: React.FC<SpecificationsSectionProps> = ({ specifications }) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const contentRef = React.useRef<HTMLDivElement>(null)

  return (
    <div>
      <div
        ref={contentRef}
        className={`rounded-xl sm:rounded-2xl border border-gray-100 bg-gray-50/60 divide-y divide-gray-100 overflow-hidden transition-all duration-500 ease-in-out ${
          isExpanded ? 'max-h-none' : 'max-h-[400px]'
        }`}
      >
        {specifications.map((spec) => (
          <div key={spec.key} className="flex flex-col sm:flex-row sm:items-center">
            <div className="sm:w-1/3 px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-medium text-gray-600 uppercase tracking-wide">
              {spec.key}
            </div>
            <div className="flex-1 px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base text-gray-800 border-t sm:border-t-0 sm:border-l border-gray-100">
              {spec.value}
            </div>
          </div>
        ))}
      </div>
      {specifications.length > 4 && (
        <div className="mt-4 flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="rounded-full transition-all duration-300 hover:scale-105 active:scale-95"
          >
            <span
              className={`inline-flex items-center transition-transform duration-300 ${
                isExpanded ? 'rotate-180' : ''
              }`}
            >
              <ChevronDown className="w-4 h-4 mr-2" />
            </span>
            {isExpanded ? 'Show Less' : 'Read More'}
          </Button>
        </div>
      )}
    </div>
  )
}

export default ProductDetail
