import { useNavigate } from 'react-router-dom'
import type { SellerCategory, SellerProduct } from '../../api/seller'
import type { ThemeConfig } from '../../utils/themes'
import ProductCard from '../ui/ProductCard'
import SectionHeading from '../ui/SectionHeading'
import { Button } from '../ui/button'
import { Skeleton } from '../ui/skeleton'

interface ProductVariant {
  _id: string
  sellingPrice?: number
  originalPrice?: number
  price?: number
  effectivePrice?: number // What customer actually pays (from backend)
  comparePrice?: number
}

interface ProductsSectionProps {
  products: SellerProduct[]
  isLoading: boolean
  searchQuery: string
  selectedCategory?: string
  categories: SellerCategory[]
  pagination?: {
    total: number
    page: number
    limit: number
    pages: number
  }
  currentPage: number
  onPageChange: (page: number) => void
  theme: ThemeConfig | null
}

export const ProductsSection = ({
  products,
  isLoading,
  searchQuery,
  selectedCategory,
  categories,
  pagination,
  currentPage,
  onPageChange,
  theme,
}: ProductsSectionProps) => {
  const navigate = useNavigate()
  const getCategoryName = () => {
    if (!selectedCategory) return null
    return categories.find((c) => c._id === selectedCategory)?.name || 'Category'
  }

  return (
    <div className="min-h-screen" id="products-section">
      <div className="mb-6">
        <SectionHeading
          title={
            selectedCategory
              ? `Products in ${getCategoryName()}`
              : searchQuery
              ? `Search results for "${searchQuery}"`
              : 'Products'
          }
          align="left"
          italicPart={selectedCategory ? getCategoryName() : searchQuery ? searchQuery : undefined}
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
          {[...Array(12)].map((_, i) => (
            <Skeleton key={i} className="h-96" />
          ))}
        </div>
      ) : products.length > 0 ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
            {products.map((product) => {
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
                <ProductCard
                  key={product._id}
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
              )
            })}
          </div>

          {/* Pagination */}
          {pagination && pagination.pages > 1 && (
            <div className="flex justify-center gap-2 mt-8">
              <Button
                variant="outline"
                onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                style={{
                  backgroundColor: theme?.colors.surface || '#ffffff',
                  borderColor: theme?.colors.border || '#d1d5db',
                  color: theme?.colors.text || '#111827',
                }}
              >
                Previous
              </Button>
              <span
                className="px-4 py-2 flex items-center"
                style={{ color: theme?.colors.text || '#111827' }}
              >
                Page {currentPage} of {pagination.pages}
              </span>
              <Button
                variant="outline"
                onClick={() => onPageChange(Math.min(pagination.pages, currentPage + 1))}
                disabled={currentPage === pagination.pages}
                style={{
                  backgroundColor: theme?.colors.surface || '#ffffff',
                  borderColor: theme?.colors.border || '#d1d5db',
                  color: theme?.colors.text || '#111827',
                }}
              >
                Next
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12">
          <p className="text-gray-600">No products available at the moment.</p>
        </div>
      )}
    </div>
  )
}
