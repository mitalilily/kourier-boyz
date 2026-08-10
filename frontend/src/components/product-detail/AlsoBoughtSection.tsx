import React, { useCallback, useEffect, useRef, useState } from 'react'

import { useAlsoBoughtProducts } from '@/api/products'
import { calculateDiscount, FALLBACK_IMAGE } from '@/components/product-detail/utils'
import ProductCard from '@/components/ui/ProductCard'
import SectionHeading from '@/components/ui/SectionHeading'
import { getProductDisplayInfo } from '@/utils/productDisplay'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, ShoppingCart } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface AlsoBoughtSectionProps {
  currentProductId: string
}

const AlsoBoughtSection: React.FC<AlsoBoughtSectionProps> = ({ currentProductId }) => {
  const { data, isLoading } = useAlsoBoughtProducts(currentProductId, { limit: 16 })
  const navigate = useNavigate()
  const carouselContentRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const alsoBoughtProducts = data?.products ?? []

  const updateScrollButtons = useCallback(() => {
    const container = carouselContentRef.current
    if (!container) return

    const { scrollLeft, scrollWidth, clientWidth } = container
    const maxScrollLeft = scrollWidth - clientWidth
    const threshold = 10

    setCanScrollLeft(scrollLeft > threshold)
    setCanScrollRight(scrollLeft < maxScrollLeft - threshold)
  }, [])

  useEffect(() => {
    const container = carouselContentRef.current
    if (!container) return

    const timeoutId = setTimeout(() => {
      updateScrollButtons()
    }, 100)

    container.addEventListener('scroll', updateScrollButtons)
    window.addEventListener('resize', updateScrollButtons)

    return () => {
      clearTimeout(timeoutId)
      container.removeEventListener('scroll', updateScrollButtons)
      window.removeEventListener('resize', updateScrollButtons)
    }
  }, [alsoBoughtProducts.length, updateScrollButtons])

  const handlePrev = () => {
    if (!carouselContentRef.current) return
    const scrollAmount = carouselContentRef.current.clientWidth * 0.98
    carouselContentRef.current.scrollBy({ left: -scrollAmount, behavior: 'smooth' })
  }

  const handleNext = () => {
    if (!carouselContentRef.current) return
    const scrollAmount = carouselContentRef.current.clientWidth * 0.98
    carouselContentRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' })
  }

  if (isLoading) {
    return (
      <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-primary/10 via-white to-blue/5 border border-primary/20 shadow-xl p-6 sm:p-8 lg:p-10">
        <div className="absolute inset-0 bg-linear-to-r from-primary/5 via-transparent to-blue/5 pointer-events-none" />

        <div className="relative">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-linear-to-br from-primary to-primary-dark text-black">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div className="h-6 w-48 bg-gray-200 rounded-lg animate-pulse" />
          </div>
          <div className="h-8 w-64 bg-gray-200 rounded-lg animate-pulse mb-8" />

          <div className="flex gap-5 overflow-hidden">
            {[...Array(3)].map((_, index) => (
              <div
                key={index}
                className="shrink-0 w-[280px] sm:w-[320px] h-96 rounded-2xl bg-gray-100 animate-pulse"
              />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!alsoBoughtProducts.length) return null

  return (
    <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-primary/10 via-white to-blue/5 border border-primary/20 shadow-xl">
      <div className="absolute inset-0 bg-linear-to-r from-primary/5 via-transparent to-blue/5 pointer-events-none" />

      <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

      <div className="relative p-6 sm:p-8 lg:p-10">
        <div className="mb-8">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="flex items-start gap-4"
          >
            <div className="relative shrink-0">
              <div className="absolute inset-0 bg-linear-to-br from-primary to-primary-dark rounded-2xl blur-md opacity-50" />
              <div className="relative p-3 rounded-2xl bg-linear-to-br from-primary to-primary-dark text-black shadow-lg">
                <ShoppingCart className="w-6 h-6 sm:w-7 sm:h-7" />
              </div>
            </div>
            <div className="flex-1">
              <SectionHeading
                align="left"
                title="Customers who bought this item also bought"
                subtitle="Frequently bought together"
                marginBottom={false}
              />
            </div>
          </motion.div>
        </div>

        <div className="relative w-full flex items-center justify-center group">
          <div className="w-full overflow-hidden relative z-0">
            <div
              ref={carouselContentRef}
              className="flex gap-5 overflow-x-auto overflow-y-hidden scrollbar-hide"
              style={{
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
                WebkitOverflowScrolling: 'touch',
              }}
            >
              {alsoBoughtProducts.map((product) => {
                const displayInfo = getProductDisplayInfo(product)

                const effectivePrice = displayInfo.price ?? 0

                const discount = calculateDiscount(
                  effectivePrice,
                  displayInfo.comparePrice,
                  product.discountPercent,
                )

                const originalPrice =
                  displayInfo.comparePrice && displayInfo.comparePrice > effectivePrice
                    ? displayInfo.comparePrice
                    : undefined

                return (
                  <div key={product._id} className="shrink-0 w-[280px] sm:w-[320px]">
                    <ProductCard
                      id={product._id}
                      slug={product.slug}
                      name={product.name}
                      price={effectivePrice}
                      originalPrice={originalPrice}
                      image={displayInfo.image || FALLBACK_IMAGE}
                      rating={product.rating}
                      reviews={product.reviewCount}
                      badge={product.isFeatured ? 'Featured' : undefined}
                      discount={discount}
                      shortDescription={product.shortDescription}
                      description={product.description}
                      stock={displayInfo.stock ?? product.stock ?? product.totalStock}
                      variantId={displayInfo.variantId}
                      product={product}
                      onClick={(id) => navigate(`/products/${id}`)}
                    />
                  </div>
                )
              })}
            </div>
          </div>

          {canScrollLeft && (
            <button
              onClick={handlePrev}
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-20 p-3 rounded-full bg-white/95 backdrop-blur-sm shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 hover:bg-white hover:shadow-xl border border-primary/20 hover:border-primary/40"
              aria-label="Previous products"
            >
              <ChevronLeft className="w-5 h-5 text-blue" />
            </button>
          )}

          {canScrollRight && (
            <button
              onClick={handleNext}
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-20 p-3 rounded-full bg-white/95 backdrop-blur-sm shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 hover:bg-white hover:shadow-xl border border-primary/20 hover:border-primary/40"
              aria-label="Next products"
            >
              <ChevronRight className="w-5 h-5 text-blue" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default AlsoBoughtSection
