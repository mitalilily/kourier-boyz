import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useSellerBySlug, useSellerCategoriesBySlug, useSellerProductsBySlug } from '../api/seller'
import { CategoriesSection } from '../components/seller/CategoriesSection'
import { ProductsSection } from '../components/seller/ProductsSection'
import { StoreHeader } from '../components/seller/StoreHeader'
import { Skeleton } from '../components/ui/skeleton'
import { getThemeById, type ThemeConfig } from '../utils/themes'

const SellerCategoryProducts = () => {
  const { slug, categoryId } = useParams<{ slug: string; categoryId?: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { data: seller, isLoading: isLoadingSeller } = useSellerBySlug(slug || '')
  const { data: categoriesData } = useSellerCategoriesBySlug(slug || '')
  const [currentPage, setCurrentPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '')
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(searchParams.get('search') || '')
  const [theme, setTheme] = useState<ThemeConfig | null>(null)

  // Initialize search from URL params
  useEffect(() => {
    const urlSearch = searchParams.get('search')
    if (urlSearch) {
      setSearchQuery(urlSearch)
      setDebouncedSearchQuery(urlSearch)
    }
  }, [searchParams])

  // Debounce search query (300ms delay)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
      setCurrentPage(1) // Reset to first page when search changes

      // Navigate away from category page when search is active
      if (searchQuery.trim() && categoryId) {
        navigate(`/seller/${slug}/products?search=${encodeURIComponent(searchQuery.trim())}`)
      } else if (searchQuery.trim() && !categoryId) {
        // Update URL with search query
        navigate(`/seller/${slug}/products?search=${encodeURIComponent(searchQuery.trim())}`, {
          replace: true,
        })
      } else if (!searchQuery.trim() && !categoryId) {
        // Navigate to home if search is cleared
        navigate(`/seller/${slug}`, { replace: true })
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery, categoryId, slug, navigate])

  // When search is active, don't filter by category (but still allow category selection in UI)
  const activeCategory = debouncedSearchQuery ? undefined : categoryId

  const { data: productsData, isLoading: isLoadingProducts } = useSellerProductsBySlug(slug || '', {
    page: currentPage,
    limit: 20,
    status: 'active',
    search: debouncedSearchQuery || undefined,
    category: activeCategory, // Only filter by category if no search query
  })

  // Reset search when category changes from URL
  useEffect(() => {
    if (categoryId && debouncedSearchQuery) {
      // If user navigates to a category page (via URL), clear search
      setSearchQuery('')
      setDebouncedSearchQuery('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId]) // Only run when categoryId changes, not when debouncedSearchQuery changes (intentionally excluded)

  // Apply theme when seller data loads
  useEffect(() => {
    if (seller?.storeTheme) {
      const selectedTheme = getThemeById(seller.storeTheme)
      setTheme(selectedTheme)
      // Apply CSS variables for theme
      if (selectedTheme) {
        const root = document.documentElement
        root.style.setProperty('--theme-primary', selectedTheme.colors.primary)
        root.style.setProperty('--theme-secondary', selectedTheme.colors.secondary)
        root.style.setProperty('--theme-accent', selectedTheme.colors.accent)
        root.style.setProperty('--theme-background', selectedTheme.colors.background)
        root.style.setProperty('--theme-surface', selectedTheme.colors.surface)
        root.style.setProperty('--theme-text', selectedTheme.colors.text)
        root.style.setProperty('--theme-text-secondary', selectedTheme.colors.textSecondary)
        root.style.setProperty('--theme-border', selectedTheme.colors.border)
        root.style.setProperty(
          '--theme-border-radius',
          selectedTheme.styles.borderRadius || '0.75rem',
        )
      }
    }
  }, [seller?.storeTheme])

  // Reset page when category changes
  useEffect(() => {
    setCurrentPage(1)
  }, [categoryId])

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

  const products = productsData?.products || []
  const pagination = productsData?.pagination
  const categories = categoriesData?.categories || []

  const handleCategoryClick = (newCategoryId: string) => {
    // Clear search when category is clicked
    setSearchQuery('')
    setDebouncedSearchQuery('')
    navigate(`/seller/${slug}/category/${newCategoryId}`)
  }

  const handleClearCategory = () => {
    // Clear search when going to home
    setSearchQuery('')
    setDebouncedSearchQuery('')
    navigate(`/seller/${slug}`)
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setCurrentPage(1)
  }

  const themeStyles = theme
    ? {
        backgroundColor: theme.colors.background,
        color: theme.colors.text,
      }
    : {}

  return (
    <div className="min-h-screen" style={themeStyles}>
      {/* Store Header with Single Banner */}
      <StoreHeader seller={seller} theme={theme} />

      {/* Categories Section */}
      <CategoriesSection
        categories={categories}
        selectedCategory={categoryId} // Use categoryId from URL params so category is always selectable
        theme={theme}
        seller={seller}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchSubmit={handleSearch}
        onCategoryClick={handleCategoryClick}
        onClearCategory={handleClearCategory}
      />

      {/* Main Content */}
      <div className="mx-auto px-4 py-8" style={{ maxWidth: '1600px' }}>
        {/* Search Section */}
        {/* <SearchSection
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSearchSubmit={handleSearch}
          theme={theme}
        /> */}

        {/* Products Section */}
        <ProductsSection
          products={products}
          isLoading={isLoadingProducts}
          searchQuery={debouncedSearchQuery}
          selectedCategory={activeCategory} // Use activeCategory to clear selection when searching
          categories={categories}
          pagination={pagination}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          theme={theme}
        />
      </div>
    </div>
  )
}

export default SellerCategoryProducts
