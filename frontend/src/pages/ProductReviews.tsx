import { useProductReviews } from '@/api/products'
import ProductReviewsSection from '@/components/product-detail/ProductReviewsSection'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/store/authStore'
import { ArrowLeft } from 'lucide-react'
import React from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

const ProductReviews: React.FC = () => {
  const { productIdOrSlug } = useParams<{ productIdOrSlug: string }>()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuthStore()
  const { data: reviewsData, isLoading, isError } = useProductReviews(productIdOrSlug || '')

  const product = reviewsData?.product

  // Update document title when product loads
  React.useEffect(() => {
    if (product) {
      document.title = `${product.name} - Reviews | Kourier Boyz`
    }
  }, [product])

  const handleReviewLoginRedirect = () => {
    const redirectUrl = `/product/${productIdOrSlug}/reviews`
    navigate(`/login?redirect=${encodeURIComponent(redirectUrl)}`)
  }

  if (isLoading) {
    return (
      <div className="min-h-[70vh] bg-linear-to-b from-white to-gray-50">
        <div className=" mx-auto px-4 lg:px-8 py-12 animate-pulse">
          <div className="h-6 w-40 bg-gray-200 rounded mb-6" />
          <div className="grid lg:grid-cols-[280px_1fr] gap-8">
            <div className="h-96 bg-gray-200 rounded-3xl" />
            <div className="space-y-6">
              <div className="h-8 bg-gray-200 rounded w-1/3" />
              <div className="h-32 bg-gray-200 rounded" />
              <div className="h-32 bg-gray-200 rounded" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (isError || !reviewsData || !product) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
        <div className="max-w-md space-y-4">
          <h1 className="text-2xl font-bold text-gray-900">Product not found</h1>
          <p className="text-gray-600">The product you are looking for was not found.</p>
          <Button onClick={() => navigate('/shop-by-category')} size="lg" className="mt-2">
            Browse products
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-linear-to-b pt-6 sm:pt-8 md:pt-24 from-white via-gray-50 to-white pb-28">
      <div className=" mx-auto px-4 lg:px-8 py-8">
        {/* Breadcrumb */}
        <nav className="text-xs sm:text-sm text-gray-500 mb-6 flex flex-wrap items-center gap-1">
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
          <Link
            to={`/product/${productIdOrSlug}`}
            className="hover:text-gray-900 transition-colors"
          >
            {product.name}
          </Link>
          <span>/</span>
          <span className="text-gray-900 font-medium">Reviews</span>
        </nav>

        {/* Back to product button */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate(`/product/${productIdOrSlug}`)}
            className="text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to product
          </Button>
        </div>

        {/* Product Info Header */}
        <div className="mb-8 flex items-start gap-4 pb-6 border-b border-gray-200">
          {product.mainImage && (
            <img
              src={product.mainImage}
              alt={product.name}
              className="w-20 h-20 object-cover rounded-xl border border-gray-200"
            />
          )}
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-1">{product.name}</h1>
            <Link
              to={`/product/${productIdOrSlug}`}
              className="text-sm text-gray-600 hover:text-gray-900 hover:underline"
            >
              View product details
            </Link>
          </div>
        </div>

        {/* Reviews Section */}
        <ProductReviewsSection
          averageRating={reviewsData.rating}
          reviewCount={reviewsData.reviewCount}
          reviews={reviewsData.reviews}
          productId={product._id}
          productQueryKey={productIdOrSlug || product._id}
          isAuthenticated={isAuthenticated}
          onRequestLogin={handleReviewLoginRedirect}
          limitReviews={undefined}
        />
      </div>
    </div>
  )
}

export default ProductReviews
