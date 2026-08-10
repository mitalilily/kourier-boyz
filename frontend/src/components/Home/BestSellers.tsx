import { Button } from '@/components/ui/button'
import { getProductDisplayInfo } from '@/utils/productDisplay'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBestSellersProductsInfinite } from '../../api/products'
import ProductCard from '../ui/ProductCard'
import SectionHeading from '../ui/SectionHeading'

const BestSellers: React.FC = () => {
  const navigate = useNavigate()
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)
  const { data, isLoading } = useBestSellersProductsInfinite({ limit: 12, minRating: 4, sort: 'relevance' })
  
  // Get products from first page
  const products = useMemo(() => {
    if (data?.pages && data.pages.length > 0) {
      return data.pages[0].products || []
    }
    return []
  }, [data?.pages])

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
  const shouldRender = isLoading || hasProducts

  const checkScrollButtons = () => {
    if (!scrollContainerRef.current) return
    const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current
    setCanScrollLeft(scrollLeft > 0)
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10)
  }

  useEffect(() => {
    checkScrollButtons()
    const container = scrollContainerRef.current
    if (!container) return

    container.addEventListener('scroll', checkScrollButtons)
    window.addEventListener('resize', checkScrollButtons)

    return () => {
      container.removeEventListener('scroll', checkScrollButtons)
      window.removeEventListener('resize', checkScrollButtons)
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

  const handleProductClick = (id: string | number) => {
    navigate(`/product/${id}`)
  }

  const handleAddToWishlist = (id: string | number) => {
    console.debug('Add to wishlist from best sellers:', id)
  }

  const handleViewAll = () => {
    navigate('/best-sellers')
  }

  if (!shouldRender) {
    return null
  }

  if (isLoading && !hasProducts) {
    return (
      <div className="py-12 my-4 bg-white">
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
    <div className="py-12 my-4 bg-white">
      <div className=" mx-auto px-4 md:px-8">
        <div className="flex items-center justify-between mb-8">
          <SectionHeading
            align="left"
            title="Best Sellers"
            italicPart="Sellers"
            subtitle="Top-rated products loved by customers"
          />
          <Button
            onClick={handleViewAll}
            variant="outline"
            className="hidden sm:flex items-center gap-2 rounded-full border-2 border-indigo-600 text-indigo-600 hover:bg-indigo-50 hover:border-indigo-700 transition-all duration-300"
          >
            View All
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <div className="relative w-full flex items-center justify-center group mt-8">
          <div
            ref={scrollContainerRef}
            className="w-full overflow-x-auto overflow-y-hidden scrollbar-hide scroll-smooth"
            style={{
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            }}
          >
            <div className="flex gap-4 pb-4 items-stretch">
              {cardData.map((product) => (
                <div
                  key={product._id}
                  className="product-card shrink-0 w-[calc(50%-0.8rem)] sm:w-[calc(33.333%-1rem)] lg:w-[calc(20%-1.4rem)]"
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
                </div>
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

        {/* Mobile View All Button */}
        <div className="flex justify-center mt-6 sm:hidden">
          <Button
            onClick={handleViewAll}
            variant="outline"
            className="flex items-center gap-2 rounded-full border-2 border-indigo-600 text-indigo-600 hover:bg-indigo-50 hover:border-indigo-700 transition-all duration-300"
          >
            View All Best Sellers
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

export default BestSellers


