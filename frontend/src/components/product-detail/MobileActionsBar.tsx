import React, { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'

interface MobileActionsBarProps {
  addToCartPending: boolean
  isOutOfStock: boolean
  onAddToCart: () => void | Promise<void>
  onBuyNow: () => void | Promise<void>
  price: number
  formattedPrice?: string
}

const MobileActionsBar: React.FC<MobileActionsBarProps> = ({
  addToCartPending,
  formattedPrice,
  isOutOfStock,
  onAddToCart,
  onBuyNow,
  price,
}) => {
  const [showBar, setShowBar] = useState(false)

  useEffect(() => {
    const buttonContainer = document.getElementById('product-action-buttons')
    if (!buttonContainer) {
      // If buttons container doesn't exist, show the bar
      setShowBar(true)
      return
    }

    let observer: IntersectionObserver | null = null

    // Wait a bit for DOM to be ready
    const timeoutId = setTimeout(() => {
      observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[0]
          // Hide mobile bar when buttons are visible
          setShowBar(!entry.isIntersecting)
        },
        {
          threshold: 0, // Trigger as soon as any part is visible
          rootMargin: '-10px 0px', // Add small margin to trigger slightly before fully in view
        },
      )

      observer.observe(buttonContainer)
    }, 100)

    return () => {
      clearTimeout(timeoutId)
      if (observer) {
        observer.disconnect()
      }
    }
  }, [])

  if (!showBar) {
    return null
  }

  return (
    <div className="lg:hidden fixed bottom-16 left-0 right-0 z-30 border-t border-gray-200 bg-white/95 backdrop-blur px-4 py-3">
      <div className=" mx-auto flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-gray-500">Starts at</p>
          <p className="text-lg font-semibold text-gray-900">
            ₹{formattedPrice ?? price.toLocaleString('en-IN')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={onAddToCart}
            disabled={isOutOfStock || addToCartPending}
            className="rounded-full bg-gray-900 px-5 text-white hover:bg-gray-800 disabled:opacity-60"
          >
            {addToCartPending ? 'Adding…' : 'Add to cart'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onBuyNow}
            disabled={isOutOfStock || addToCartPending}
            className="rounded-full border-gray-900 px-5 text-gray-900 hover:bg-gray-900/5"
          >
            Buy now
          </Button>
        </div>
      </div>
    </div>
  )
}

export default MobileActionsBar
