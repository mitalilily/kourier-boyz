import { useNavigate } from 'react-router-dom'
import type { SellerProduct } from '../../api/seller'
import type { ThemeConfig } from '../../utils/themes'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '../ui/carousel'
import ProductCard from '../ui/ProductCard'
import SectionHeading from '../ui/SectionHeading'
import { Skeleton } from '../ui/skeleton'

interface ProductVariant {
  _id: string
  sellingPrice?: number
  originalPrice?: number
  price?: number
  effectivePrice?: number // What customer actually pays (from backend)
  comparePrice?: number
}

interface FeaturedProductsSectionProps {
  products: SellerProduct[]
  isLoading: boolean
  theme: ThemeConfig | null
  sellerName?: string
}

export const FeaturedProductsSection = ({
  products,
  isLoading,
  theme,
  sellerName,
}: FeaturedProductsSectionProps) => {
  const navigate = useNavigate()

  if (isLoading) {
    return (
      <div className="mx-auto px-2 sm:px-4 py-6 sm:py-8" style={{ maxWidth: '1600px' }}>
        <Skeleton className="h-12 w-64 mb-8" />
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 sm:gap-4 md:gap-6">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-96" />
          ))}
        </div>
      </div>
    )
  }

  if (products.length === 0) {
    return null // Don't show section if no featured products
  }

  return (
    <div className="mx-auto px-2 sm:px-4 py-6 sm:py-8" style={{ maxWidth: '1600px' }}>
      <SectionHeading
        title={sellerName ? `Top Picks by ${sellerName}` : 'Top Picks'}
        italicPart={sellerName ? sellerName : undefined}
        subtitle="Handpicked products just for you"
        align="left"
      />
      <div className="relative">
        <Carousel
          opts={{
            align: 'start',
            loop: false,
          }}
          className="w-full"
        >
          <CarouselContent className="-ml-2 sm:-ml-4 md:-ml-6">
            {products?.map((product) => {
              // Get the main image
              const mainImage = product.mainImage || product.images?.[0] || '/placeholder.jpg'
              // Get price (handle variants)
              const price =
                product.hasVariants && product.variants && product.variants.length > 0
                  ? Math.min(
                      ...product.variants
                        .map(
                          (v: ProductVariant) => v.effectivePrice ?? v.sellingPrice ?? v.price ?? 0,
                        )
                        .filter((p: number) => p > 0),
                    )
                  : product.sellingPrice || 0
              const originalPrice =
                product.hasVariants && product.variants && product.variants.length > 0
                  ? product.variants.find((v: ProductVariant) => v.originalPrice || v.comparePrice)
                      ?.originalPrice ||
                    product.variants.find((v: ProductVariant) => v.originalPrice || v.comparePrice)
                      ?.comparePrice
                  : product.originalPrice

              return (
                <CarouselItem
                  key={product._id}
                  className="pl-2 sm:pl-4 md:pl-6 basis-full sm:basis-1/2 md:basis-1/3 lg:basis-1/4 py-6 xl:basis-1/6"
                >
                  <ProductCard
                    id={product._id}
                    slug={product.slug}
                    name={product.name}
                    price={price}
                    originalPrice={originalPrice}
                    image={mainImage}
                    shortDescription={product.shortDescription}
                    description={product.description}
                    product={product as any}
                    theme={
                      theme
                        ? {
                            primary: theme.colors.primary,
                            secondary: theme.colors.secondary,
                            accent: theme.colors.accent,
                            text: theme.colors.text,
                            textSecondary: theme.colors.textSecondary,
                            surface: theme.colors.surface,
                            border: theme.colors.border,
                          }
                        : undefined
                    }
                    onClick={() => navigate(`/product/${product.slug || product._id}`)}
                  />
                </CarouselItem>
              )
            })}
          </CarouselContent>
          <CarouselPrevious
            className="absolute left-2 sm:left-4 md:-left-12 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full shadow-lg z-20 hover:scale-110 transition-transform pointer-events-auto"
            style={{
              backgroundColor: theme?.colors.surface || '#ffffff',
              borderColor: theme?.colors.border || '#e5e7eb',
              color: theme?.colors.text || '#111827',
            }}
            onClick={(e) => {
              e.stopPropagation()
            }}
          />
          <CarouselNext
            className="absolute right-2 sm:right-4 md:-right-12 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full shadow-lg z-20 hover:scale-110 transition-transform pointer-events-auto"
            style={{
              backgroundColor: theme?.colors.surface || '#ffffff',
              borderColor: theme?.colors.border || '#e5e7eb',
              color: theme?.colors.text || '#111827',
            }}
            onClick={(e) => {
              e.stopPropagation()
            }}
          />
        </Carousel>
      </div>
    </div>
  )
}
