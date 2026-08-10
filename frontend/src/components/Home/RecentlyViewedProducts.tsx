import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { getProductDisplayInfo } from '@/utils/productDisplay'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRecentlyViewedProducts } from '../../api/products'
import { useAuthStore } from '../../store/authStore'
import ProductCard from '../ui/ProductCard'
import SectionHeading from '../ui/SectionHeading'

const RecentlyViewedProducts: React.FC<{ fromOrdersPage?: boolean }> = ({
  fromOrdersPage = false,
}) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const navigate = useNavigate()
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)
  const { data, isLoading } = useRecentlyViewedProducts({
    limit: 12,
    enabled: isAuthenticated,
  })

  const products = useMemo(() => data?.products ?? [], [data])

  const cardData = useMemo(() => {
    return products.map((product) => {
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
  }, [products])

  const hasProducts = cardData.length > 0
  const shouldRender = isAuthenticated && (isLoading || hasProducts)

  const handleProductClick = (id: string | number) => {
    navigate(`/product/${id}`)
  }

  const handleAddToWishlist = (id: string | number) => {
    console.debug('Add to wishlist from recently viewed:', id)
  }

  const updateScrollButtons = () => {
    if (!scrollContainerRef.current) return
    const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current
    setCanScrollLeft(scrollLeft > 8)
    setCanScrollRight(scrollWidth - clientWidth - scrollLeft > 8)
  }

  useEffect(() => {
    updateScrollButtons()
    const container = scrollContainerRef.current
    if (!container) return
    container.addEventListener('scroll', updateScrollButtons)
    window.addEventListener('resize', updateScrollButtons)
    return () => {
      container.removeEventListener('scroll', updateScrollButtons)
      window.removeEventListener('resize', updateScrollButtons)
    }
  }, [cardData.length])

  const scroll = (direction: 'left' | 'right') => {
    const container = scrollContainerRef.current
    if (!container) return
    const cardWidth = container.querySelector('.product-card')?.clientWidth || 280
    const gap = 16
    const scrollAmount = cardWidth + gap

    container.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    })
  }

  if (!shouldRender) {
    return null
  }

  if (isLoading && !hasProducts) {
    return (
      <div className="my-4 bg-gray-50/60">
        <div className=" mx-auto px-4 md:px-8">
          <div className="h-12 bg-gray-200 rounded w-64 mb-8 animate-pulse" />
          <div className="flex gap-4 overflow-hidden">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-gray-200 rounded-2xl h-80 w-56 animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!hasProducts) {
    return null
  }

  return (
    <div className="flex flex-col ">
      {fromOrdersPage ? <Separator className="my-8" /> : null}
      <div className="bg-gray-50/60 py-8">
        <div className=" mx-auto px-4 md:px-8">
          <SectionHeading
            align="left"
            title="Continue Browsing"
            italicPart="Browsing"
            subtitle="Pick up where you left off"
          />

          <div className="relative w-full flex items-center justify-center mt-6">
            <div
              ref={scrollContainerRef}
              className="w-full overflow-x-auto overflow-y-hidden scrollbar-hide scroll-smooth rounded-2xlshadow-sm px-2 py-3"
              style={{
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
              }}
            >
              <div className="flex gap-4 pb-1 items-stretch">
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
                      image={product.displayImage || product.mainImage || '/image-placeholder.svg'}
                      rating={product.rating}
                      reviews={product.reviewCount || 0}
                      badge={product.badge}
                      discount={product.discount}
                      shortDescription={product.shortDescription || product.description}
                      description={product.description}
                      stock={product.displayStock ?? product.stock ?? product.totalStock}
                      variantId={product.displayVariantId}
                      product={product}
                      onAddToWishlist={handleAddToWishlist}
                      onClick={handleProductClick}
                    />
                  </motion.div>
                ))}
              </div>
            </div>

            <Button
              onClick={() => scroll('left')}
              variant="outline"
              size="icon"
              className="absolute -left-3 top-1/2 -translate-y-1/2 -translate-x-4 z-20 h-10 w-10 rounded-full bg-white shadow-lg border-2 border-gray-200 hover:bg-gray-50 hover:border-gray-300 hover:shadow-xl transition-all duration-300 disabled:opacity-0"
              aria-label="Previous products"
              disabled={!canScrollLeft}
            >
              <ChevronLeft className="w-5 h-5 text-yellow" />
            </Button>

            <Button
              onClick={() => scroll('right')}
              variant="outline"
              size="icon"
              className="absolute -right-3 top-1/2 -translate-y-1/2 translate-x-4 z-20 h-10 w-10 rounded-full bg-white shadow-lg border-2 border-gray-200 hover:bg-gray-50 hover:border-gray-300 hover:shadow-xl transition-all duration-300 disabled:opacity-0"
              aria-label="Next products"
              disabled={!canScrollRight}
            >
              <ChevronRight className="w-5 h-5 text-yellow" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default RecentlyViewedProducts
