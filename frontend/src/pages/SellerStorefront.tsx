import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useSellerBySlug, useSellerCategoriesBySlug, useSellerProductsBySlug } from '../api/seller'
import { CategoriesSection } from '../components/seller/CategoriesSection'
import { FeaturedProductsSection } from '../components/seller/FeaturedProductsSection'
import { StorefrontBannersSection } from '../components/seller/StorefrontBannersSection'
import { StoreHeader } from '../components/seller/StoreHeader'
import { VideoSection } from '../components/seller/VideoSection'
import { Skeleton } from '../components/ui/skeleton'
import { getThemeById, type ThemeConfig } from '../utils/themes'
import { applyTheme } from '../utils/themeUtils'

const SellerStorefront = () => {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { data: seller, isLoading: isLoadingSeller } = useSellerBySlug(slug || '')
  const { data: categoriesData } = useSellerCategoriesBySlug(slug || '')
  const { data: featuredProductsData, isLoading: isLoadingFeatured } = useSellerProductsBySlug(
    slug || '',
    {
      status: 'active',
      featured: true,
      limit: 12, // Show up to 12 featured products
      sortBy: 'createdAt',
      order: 'desc',
    },
  )
  const [theme, setTheme] = useState<ThemeConfig | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // Debounce search query (300ms delay) and navigate to products page when search is active
  useEffect(() => {
    const timer = setTimeout(() => {
      // Navigate to products page when search is active
      if (searchQuery.trim()) {
        navigate(`/seller/${slug}/products?search=${encodeURIComponent(searchQuery.trim())}`)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery, slug, navigate])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      navigate(`/seller/${slug}/products?search=${encodeURIComponent(searchQuery.trim())}`)
    }
  }

  // Apply theme when seller data loads
  useEffect(() => {
    if (seller?.storeTheme) {
      const selectedTheme = getThemeById(seller.storeTheme)
      setTheme(selectedTheme)
      applyTheme(selectedTheme)
    } else {
      setTheme(null)
      applyTheme(null)
    }
  }, [seller?.storeTheme])

  if (isLoadingSeller) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Skeleton className="h-64 w-full mb-8" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-96" />
          ))}
        </div>
      </div>
    )
  }

  if (!seller) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Seller Not Found</h1>
        <p className="text-gray-600">The seller you're looking for doesn't exist or is inactive.</p>
      </div>
    )
  }

  const categories = categoriesData?.categories || []

  const handleStorefrontBannerClick = (categoryId?: string) => {
    if (categoryId) {
      navigate(`/seller/${slug}/category/${categoryId}`)
    }
  }

  const handleCategoryClick = (categoryId: string) => {
    navigate(`/seller/${slug}/category/${categoryId}`)
  }

  const handleClearCategory = () => {
    // Stay on home page, do nothing
  }

  return (
    <div className="min-h-screen theme-bg-background theme-text-primary">
      {/* Store Header with Single Banner */}
      <StoreHeader seller={seller} theme={theme} />

      {/* Categories Section */}
      <CategoriesSection
        categories={categories}
        selectedCategory={undefined}
        theme={theme}
        seller={seller}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchSubmit={handleSearch}
        onCategoryClick={handleCategoryClick}
        onClearCategory={handleClearCategory}
      />

      {/* Video Section (before banners) */}
      <VideoSection seller={seller} theme={theme} />

      {/* Storefront Banners Section (below video) */}
      <StorefrontBannersSection
        seller={seller}
        theme={theme}
        onBannerClick={handleStorefrontBannerClick}
      />

      {/* Featured Products Section */}
      <FeaturedProductsSection
        products={featuredProductsData?.products || []}
        isLoading={isLoadingFeatured}
        theme={theme}
        sellerName={seller?.businessName || seller?.name}
      />
    </div>
  )
}

export default SellerStorefront
