import { useAddToCart, useCart, useRemoveCartItem, useUpdateCartItem } from '@/api/cart'
import { useIsMobile } from '@/hooks/useIsMobile'
import { animate, motion, useMotionValue } from 'framer-motion'
import { ArrowRight, Loader2, ShoppingCart } from 'lucide-react'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import QuantitySelector from './QuantitySelector'
import { Button } from './button'

interface AddToCartProps {
  productId: string
  variantId?: string
  stock?: number // Optional, defaults to allow adding if not provided
  minOrderQuantity?: number // Minimum order quantity, defaults to 1
  priceLabel?: string
  className?: string
  size?: 'default' | 'sm' | 'lg' | 'icon'
  quantitySize?: 'sm' | 'md' | 'lg' // Size for quantity selector
  onAddToCartClick?: (e?: React.MouseEvent) => void // Callback when add to cart button is clicked (before mutation)
}

const AddToCart: React.FC<AddToCartProps> = ({
  productId,
  variantId,
  stock,
  minOrderQuantity = 1,
  priceLabel,
  className = '',
  size = 'default',
  quantitySize = 'sm',
  onAddToCartClick,
}) => {
  const controlSize = size
  const isMobile = useIsMobile()
  const { data: cartData } = useCart()
  const cart = cartData?.data || cartData?.cart
  const addToCartMutation = useAddToCart()
  const updateMutation = useUpdateCartItem()
  const removeMutation = useRemoveCartItem()
  const slideTrackRef = useRef<HTMLDivElement>(null)
  const slideThumbX = useMotionValue(0)
  const [slideTrackWidth, setSlideTrackWidth] = useState(0)
  const [hasTriggeredSlide, setHasTriggeredSlide] = useState(false)

  // Find if item is in cart
  const cartItem = useMemo(() => {
    if (!cart?.items) return null
    return cart.items.find((item) => {
      const matchProduct = item.product._id === productId
      const matchVariant = variantId ? item.variantId === variantId : !item.variantId
      return matchProduct && matchVariant
    })
  }, [cart?.items, productId, variantId])

  const isInCart = !!cartItem
  const quantity = cartItem?.quantity || 0
  const availableStock = stock ?? 999 // Default to high number if stock not provided
  const isOutOfStock = availableStock === 0
  const isIconOnly = controlSize === 'icon'

  // Separate loading states for better UX
  const isAdding = addToCartMutation.isPending
  const isUpdating = updateMutation.isPending
  const isRemoving = removeMutation.isPending
  const isLoading = isAdding || isUpdating || isRemoving
  const thumbWidth = 144
  const maxSlide = Math.max(slideTrackWidth - thumbWidth - 10, 0)
  const slideThreshold = maxSlide * 0.68

  useEffect(() => {
    const updateTrackWidth = () => {
      if (!slideTrackRef.current) return
      setSlideTrackWidth(slideTrackRef.current.offsetWidth)
    }

    updateTrackWidth()

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateTrackWidth)
      return () => window.removeEventListener('resize', updateTrackWidth)
    }

    const observer = new ResizeObserver(updateTrackWidth)
    if (slideTrackRef.current) {
      observer.observe(slideTrackRef.current)
    }

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!isAdding) {
      setHasTriggeredSlide(false)
      animate(slideThumbX, 0, { duration: 0.28, ease: 'easeOut' })
    }
  }, [isAdding, slideThumbX])

  const handleAddToCart = (e?: React.MouseEvent) => {
    e?.stopPropagation()

    // Allow guests to add to cart (guest cart will be used)
    // No need to redirect to login - guest cart functionality handles it

    if (isOutOfStock) return

    // If onAddToCartClick callback is provided, call it first (for variant selection)
    if (onAddToCartClick) {
      onAddToCartClick(e)
      return
    }

    addToCartMutation.mutate({
      productId,
      variantId,
      quantity: minOrderQuantity,
    })
  }

  const triggerSlideToAdd = () => {
    if (isOutOfStock || isAdding || hasTriggeredSlide) return
    setHasTriggeredSlide(true)
    animate(slideThumbX, maxSlide, { duration: 0.18, ease: 'easeOut' })
    handleAddToCart()
  }

  const handleQuantityChange = (newQuantity: number) => {
    if (isLoading) return
    if (newQuantity > availableStock) return

    // Enforce minimum order quantity - prevent going below min
    if (newQuantity < minOrderQuantity) {
      return
    }

    // If quantity would be 0 or less, remove the item instead
    if (newQuantity < 1) {
      removeMutation.mutate({
        productId,
        variantId,
      })
      return
    }

    // Otherwise update the quantity
    updateMutation.mutate({
      productId,
      variantId,
      quantity: newQuantity,
    })
  }

  // Show quantity controls if item is in cart
  if (isInCart) {
    const maxQuantity = Math.min(availableStock, 99)

    return (
      <QuantitySelector
        quantity={quantity}
        onQuantityChange={handleQuantityChange}
        min={minOrderQuantity}
        max={maxQuantity}
        disabled={isOutOfStock}
        isLoading={isLoading}
        size={quantitySize}
        className={className}
      />
    )
  }

  const shouldUseSlider = controlSize === 'sm' && !isIconOnly

  if (shouldUseSlider) {
    return (
      <div
        ref={slideTrackRef}
        className={`relative h-[56px] w-full overflow-hidden rounded-full border border-white/60 bg-[rgba(255,255,255,0.34)] p-[4px] shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] backdrop-blur-sm ${className}`}
        onClick={(e) => e.stopPropagation()}
        aria-label={isOutOfStock ? 'Out of Stock' : 'Slide to add to cart'}
      >
        <div className="pointer-events-none absolute inset-y-0 left-0 flex w-full items-center justify-end px-7">
          <div className="flex items-center gap-1.5 text-[15px] font-medium tracking-[-0.03em] text-black/80">
            <span>{isOutOfStock ? 'Unavailable' : onAddToCartClick ? 'Slide to choose' : 'Slide to add'}</span>
            <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.2} />
          </div>
        </div>

        <motion.div
          drag={isOutOfStock || isAdding || !isMobile ? false : 'x'}
          dragConstraints={{ left: 0, right: maxSlide }}
          dragElastic={0.04}
          dragMomentum={false}
          style={{ x: slideThumbX }}
          onClick={(e) => {
            e.stopPropagation()
            if (!isMobile && !isOutOfStock && !isAdding) {
              handleAddToCart()
            }
          }}
          onDragEnd={(_, info) => {
            if (info.offset.x >= slideThreshold) {
              triggerSlideToAdd()
              return
            }
            animate(slideThumbX, 0, { duration: 0.24, ease: 'easeOut' })
          }}
          className={`relative z-10 flex h-full min-w-[180px] items-center justify-center rounded-full px-5 text-white shadow-[0_8px_20px_rgba(0,0,0,0.14)] ${
            isOutOfStock
              ? 'cursor-not-allowed bg-slate-300'
              : isMobile
              ? 'cursor-grab active:cursor-grabbing bg-black'
              : 'cursor-pointer bg-black'
          }`}
          whileTap={{ scale: isOutOfStock ? 1 : 0.98 }}
        >
          <span className="flex items-center gap-2 text-[14px] font-semibold tracking-[-0.02em]">
            {isAdding ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ShoppingCart className="h-4 w-4" />
            )}
            <span>
              {isOutOfStock
                ? 'Out of Stock'
                : onAddToCartClick
                ? `Choose${priceLabel ? ` · ${priceLabel}` : ''}`
                : `Add to Cart${priceLabel ? ` · ${priceLabel}` : ''}`}
            </span>
          </span>
        </motion.div>
      </div>
    )
  }

  // Determine button style based on size prop
  const buttonHeight = controlSize === 'lg' ? 'h-11' : 'h-10'
  const buttonPadding = isIconOnly
    ? 'px-0 w-10'
    : controlSize === 'lg'
    ? 'px-6'
    : 'px-4'
  const textSize = controlSize === 'lg' ? 'text-base' : 'text-sm'
  const iconSize = controlSize === 'lg' ? 'w-5 h-5' : 'w-4 h-4'

  return (
    <Button
      onClick={handleAddToCart}
      disabled={isOutOfStock || isAdding}
      className={`
        relative ${buttonHeight} ${buttonPadding} 
        ${isIconOnly ? 'rounded-full w-10' : 'rounded-lg'}
       
        bg-yellow shadow-md shadow-gray-900/20
        flex items-center justify-center gap-2
        overflow-visible
        disabled:opacity-50 disabled:cursor-not-allowed
        group disabled:bg-gray-200 disabled:text-gray-400 disabled:border-gray-300
        hover:shadow-lg hover:shadow-gray-900/30
        ${isIconOnly ? 'hover:scale-110 hover:rotate-12' : 'hover:bg-gray-800'}
        active:scale-95
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 
        focus-visible:ring-offset-2 focus-visible:ring-offset-white
        transition-all duration-200 hover:text-white
        ${className}
      `}
      aria-label={isOutOfStock ? 'Out of Stock' : 'Add to Cart'}
    >
      {/* Loading Spinner */}
      {isAdding ? (
        <Loader2 className={`${iconSize} animate-spin text-white`} />
      ) : isOutOfStock ? (
        <>
          <ShoppingCart className={`${iconSize} text-gray-400`} />
          {!isIconOnly && (
            <span className={`${textSize} font-medium text-gray-400`}>Out of Stock</span>
          )}
        </>
      ) : (
        <>
          <ShoppingCart
            className={`${iconSize} hover:text-white  group-hover:scale-110 transition-transform duration-200`}
          />
          {!isIconOnly && (
            <span className={`${textSize} hover:text-white font-semibold `}>Add to Cart</span>
          )}
        </>
      )}
    </Button>
  )
}

export default AddToCart
