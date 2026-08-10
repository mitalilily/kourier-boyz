import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useProducts } from '@/api/products'
import { FALLBACK_IMAGE } from '@/components/product-detail/utils'
import ProductCard from '@/components/ui/ProductCard'
import { getProductDisplayInfo } from '@/utils/productDisplay'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface RelatedProductsSectionProps {
  categoryId?: string
  currentProductId: string
}

type ProductGridParams = {
  category?: string
  limit?: number
  sortBy?: string
  order?: 'asc' | 'desc'
}

const RelatedProductsSection: React.FC<RelatedProductsSectionProps> = ({
  categoryId,
  currentProductId,
}) => {
  const params: ProductGridParams = useMemo(() => {
    if (categoryId) {
      return { category: categoryId, limit: 16 }
    }
    return { limit: 16, sortBy: 'viewCount', order: 'desc' }
  }, [categoryId])

  const { data, isLoading } = useProducts(params)
  const navigate = useNavigate()
  const carouselContentRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const relatedProducts = useMemo(() => {
    const products = data?.products ?? []
    return products.filter((item) => item._id !== currentProductId).slice(0, 16)
  }, [data?.products, currentProductId])

  const cardData = useMemo(() => {
    return relatedProducts.map((product) => {
      const display = getProductDisplayInfo(product)
      const actualPrice = display.price
      const originalPrice =
        display.comparePrice && display.comparePrice > actualPrice
          ? display.comparePrice
          : undefined

      return {
        ...product,
        discount: product.discountPercent || 0,
        actualPrice,
        originalPrice,
        badge: product.isFeatured ? 'Featured' : '',
        displayImage: display.image,
        displayStock: display.stock,
        displayVariantId: display.variantId,
      }
    })
  }, [relatedProducts])

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

    // Initial check
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
  }, [cardData.length, updateScrollButtons])

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
        {/* Decorative gradient overlay */}
        <div className="absolute inset-0 bg-linear-to-r from-primary/5 via-transparent to-blue/5 pointer-events-none" />

        <div className="relative">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-linear-to-br from-primary to-primary-dark text-black">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="h-6 w-32 bg-gray-200 rounded-lg animate-pulse" />
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

  if (!cardData.length) return null

  return (
    <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-primary/10 via-white to-blue/5 border border-primary/20 shadow-xl">
      {/* Decorative gradient overlay */}
      <div className="absolute inset-0 bg-linear-to-r from-primary/5 via-transparent to-blue/5 pointer-events-none" />

      {/* Animated background elements */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

      <div className="relative p-6 sm:p-8 lg:p-10">
        {/* Header Section */}
        <div className="mb-8">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="flex items-center gap-4"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-linear-to-br from-primary to-primary-dark rounded-2xl blur-md opacity-50" />
              <div className="relative p-3 rounded-2xl bg-linear-to-br from-primary to-primary-dark text-black shadow-lg">
                <Sparkles className="w-6 h-6 sm:w-7 sm:h-7" />
              </div>
            </div>
            <div>
              <p className="text-[10px] sm:text-xs md:text-sm lg:text-base font-semibold uppercase tracking-widest text-blue mb-1">
                Curated for you
              </p>
              <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900">
                You may also like
              </h2>
            </div>
          </motion.div>
        </div>

        {/* Carousel Container */}
        <div className="relative w-full flex items-center justify-center group">
          {/* Products Carousel */}
          <div className="w-full overflow-hidden relative z-0">
            <div
              ref={carouselContentRef}
              className="flex gap-5 overflow-x-auto overflow-y-hidden py-2 scrollbar-hide"
              style={{
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
                WebkitOverflowScrolling: 'touch',
              }}
            >
              {cardData.map((product, index) => (
                <motion.div
                  key={product._id}
                  className="product-card shrink-0 w-[calc(50%-0.8rem)] sm:w-[calc(33.333%-1rem)] lg:w-[calc(20%-1.4rem)]"
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.25, delay: Math.min(index * 0.03, 0.18) }}
                >
                  <ProductCard
                    id={product._id}
                    slug={product.slug}
                    name={product.name}
                    price={product.actualPrice}
                    originalPrice={product.originalPrice}
                    image={product.displayImage || product.mainImage || FALLBACK_IMAGE}
                    rating={product.rating}
                    reviews={product.reviewCount || 0}
                    badge={product.badge}
                    discount={product.discount}
                    shortDescription={product.shortDescription || product.description}
                    description={product.description}
                    stock={product.displayStock ?? product.stock ?? product.totalStock}
                    variantId={product.displayVariantId}
                    product={product}
                    onClick={(id) => navigate(`/product/${id}`)}
                  />
                </motion.div>
              ))}
            </div>
          </div>

          {/* Prev Button */}
          {canScrollLeft && (
            <button
              onClick={handlePrev}
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-20 p-3 rounded-full bg-white/95 backdrop-blur-sm shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 hover:bg-white hover:shadow-xl border border-primary/20 hover:border-primary/40"
              aria-label="Previous products"
            >
              <ChevronLeft className="w-5 h-5 text-blue" />
            </button>
          )}

          {/* Next Button */}
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

export default RelatedProductsSection
