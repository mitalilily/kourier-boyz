import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTrendingProducts } from '../../api/products'
import ProductCard from '../ui/ProductCard'
import SectionHeading from '../ui/SectionHeading'
import { getProductDisplayInfo } from '@/utils/productDisplay'
import { demoProducts } from './demoStoreData'

const TrendingProducts: React.FC = () => {
  const { data } = useTrendingProducts(20) // Fetch more products for scrolling
  const apiProducts = useMemo(() => data?.products || [], [data?.products])
  const trendingProducts = useMemo(
    () =>
      apiProducts.length > 0
        ? apiProducts
        : demoProducts.slice().sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0)),
    [apiProducts],
  )
  const displayProducts = useMemo(() => {
    return trendingProducts.map((product) => {
      const display = getProductDisplayInfo(product)
      const actualPrice = display.price
      const originalPrice =
        display.comparePrice && display.comparePrice > actualPrice
          ? display.comparePrice
          : undefined

      return {
        ...product,
        actualPrice,
        originalPrice,
        displayImage: display.image,
        displayStock: display.stock,
        displayVariantId: display.variantId,
      }
    })
  }, [trendingProducts])
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)
  const navigate = useNavigate()

  const handleAddToWishlist = (id: string | number) => {
    console.log('Add to wishlist:', id)
  }

  const handleProductClick = (id: string | number) => {
    navigate(`/product/${id}`)
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
  }, [displayProducts.length])

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

  if (displayProducts.length === 0) {
    return null
  }

  return (
    <div className="py-8">
      <div className=" mx-auto px-4 md:px-8">
        <SectionHeading
          align="left"
          title="Most Loved Products"
          italicPart="Products"
          subtitle="Shop our most loved products"
        />

        <div className="relative w-full flex items-center justify-center mt-8">
          <div
            ref={scrollContainerRef}
            className="w-full overflow-x-auto overflow-y-hidden scrollbar-hide scroll-smooth"
            style={{
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            }}
          >
            <div className="flex gap-4 pb-4 items-stretch">
              {displayProducts.map((product) => (
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
                    badge={product.isFeatured ? 'Featured' : ''}
                    discount={product.discountPercent || 0}
                    shortDescription={product.shortDescription}
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
      </div>
    </div>
  )
}

export default TrendingProducts
