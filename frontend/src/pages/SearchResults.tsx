import { useProductFilters, type Product, type ProductFiltersParams } from '@/api/products'
import { useSearchInfinite, type SearchSort } from '@/api/search'
import FiltersSidebar, { SelectedFilters } from '@/components/deals/FiltersSidebar'
import SearchProductCard from '@/components/search/SearchProductCard'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useIsMobile } from '@/hooks/useIsMobile'
import { getProductDisplayInfo } from '@/utils/productDisplay'
import { Loader2 } from 'lucide-react'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

const createInitialFiltersState = (): SelectedFilters => ({
  categories: [],
  brands: [],
  sellers: [],
  tags: [],
  attributes: {},
  availability: [],
  price: undefined,
  discount: undefined,
  rating: undefined,
})

const normalizeArray = (values: string[] | undefined) =>
  Array.isArray(values) ? [...values].sort() : []

const serializeFilters = (filters: SelectedFilters) => {
  const normalizedAttributes = Object.keys(filters.attributes || {})
    .sort()
    .reduce<Record<string, string[]>>((acc, key) => {
      acc[key] = normalizeArray(filters.attributes[key])
      return acc
    }, {})

  return JSON.stringify({
    categories: normalizeArray(filters.categories),
    brands: normalizeArray(filters.brands),
    sellers: normalizeArray(filters.sellers),
    tags: normalizeArray(filters.tags),
    availability: normalizeArray(filters.availability),
    price: filters.price
      ? { min: filters.price.min ?? null, max: filters.price.max ?? null }
      : null,
    discount: filters.discount
      ? { min: filters.discount.min ?? null, max: filters.discount.max ?? null }
      : null,
    rating: filters.rating ?? null,
    attributes: normalizedAttributes,
  })
}

const SearchResults: React.FC = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const params = new URLSearchParams(location.search)
  const q = params.get('q')?.trim() || ''
  const categoryId = params.get('categoryId') || ''
  const initialSort = (params.get('sort') as SearchSort) || 'relevance'
  const [sort, setSort] = useState<SearchSort>(
    ['relevance', 'price_asc', 'price_desc', 'newest'].includes(initialSort)
      ? initialSort
      : 'relevance',
  )
  const [selectedFilters, setSelectedFilters] = useState<SelectedFilters>(createInitialFiltersState)
  const lastSyncedSearchRef = useRef<string>(
    location.search.startsWith('?') ? location.search.slice(1) : '',
  )

  const PAGE_LIMIT = 24

  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage } = useSearchInfinite({
    q,
    categoryId: categoryId || undefined,
    limit: PAGE_LIMIT,
    sort,
    filters: {
      category: categoryId || selectedFilters.categories[0],
      brand: selectedFilters.brands,
      tag: selectedFilters.tags,
      minPrice: selectedFilters.price?.min,
      maxPrice: selectedFilters.price?.max,
      minRating: selectedFilters.rating,
      includeOutOfStock: selectedFilters.availability.includes('include_out_of_stock'),
      attributes:
        Object.keys(selectedFilters.attributes || {}).length > 0
          ? selectedFilters.attributes
          : undefined,
    },
  })

  const pages = useMemo(() => data?.pages ?? [], [data])
  const products = useMemo(() => pages.flatMap((p) => p.products ?? []), [pages])
  const displayProducts = useMemo(() => {
    return products.map((product) => {
      const typedProduct = product as Product
      const display = getProductDisplayInfo(typedProduct)
      return {
        ...typedProduct,
        price: display.price,
        comparePrice: display.comparePrice ?? typedProduct.comparePrice,
        mainImage: display.image || typedProduct.mainImage,
        stock: display.stock ?? typedProduct.stock ?? typedProduct.totalStock,
      } as Product
    })
  }, [products])
  const didYouMean = useMemo(() => pages?.[0]?.didYouMean, [pages])
  const totalResults = useMemo(() => pages?.[0]?.pagination?.total ?? 0, [pages])
  const showingEnd = totalResults
    ? Math.min(products.length || (pages[0]?.pagination?.limit ?? PAGE_LIMIT), totalResults)
    : products.length
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  const filterParams = useMemo<ProductFiltersParams>(() => {
    const p: ProductFiltersParams = {}
    // Only add search if it's not empty
    if (q) {
      p.search = q
    }
    // Prioritize categoryId from URL over selectedFilters
    if (categoryId) {
      p.categoryId = categoryId
    } else if (selectedFilters.categories.length > 0) {
      p.category = selectedFilters.categories
    }
    if (selectedFilters.brands.length > 0) p.brand = selectedFilters.brands
    if (selectedFilters.sellers.length > 0) p.seller = selectedFilters.sellers
    if (selectedFilters.tags.length > 0) p.tag = selectedFilters.tags
    if (selectedFilters.availability.length > 0) p.availability = selectedFilters.availability
    if (selectedFilters.availability.includes('include_out_of_stock')) {
      p.includeOutOfStock = true
    }
    if (selectedFilters.price?.min !== undefined) p.minPrice = selectedFilters.price.min
    if (selectedFilters.price?.max !== undefined) p.maxPrice = selectedFilters.price.max
    if (selectedFilters.discount?.min !== undefined) p.minDiscount = selectedFilters.discount.min
    if (selectedFilters.discount?.max !== undefined) p.maxDiscount = selectedFilters.discount.max
    if (selectedFilters.rating !== undefined) p.minRating = selectedFilters.rating
    if (Object.keys(selectedFilters.attributes || {}).length > 0) {
      p.attributes = selectedFilters.attributes
    }
    return p
  }, [q, categoryId, selectedFilters])

  const { data: filtersData, isLoading: filtersLoading } = useProductFilters(filterParams)

  useEffect(() => {
    if (!filtersData) return
    const searchParams = new URLSearchParams(location.search)
    const currentSearch = location.search.startsWith('?') ? location.search.slice(1) : ''
    if (!location.pathname.includes('/products/search')) return
    if (currentSearch === lastSyncedSearchRef.current) return
    const parseList = (key: string) =>
      searchParams.getAll(key).flatMap((value) =>
        value
          .split(',')
          .map((entry) => entry.trim())
          .filter(Boolean),
      )

    const matchLower = (value: string) => value.trim().toLowerCase()
    const next = createInitialFiltersState()

    // Handle categoryId from URL (priority) or category parameter
    const categoryIdFromUrl = searchParams.get('categoryId')
    const categoryValues = new Set(parseList('category').map(matchLower))

    if (categoryIdFromUrl) {
      // If categoryId is in URL, find matching category in filtersData
      const matchedCategory = filtersData.categories.find(
        (cat) => cat.id === categoryIdFromUrl || cat.slug === categoryIdFromUrl,
      )
      if (matchedCategory) {
        next.categories = [matchedCategory.id]
      } else {
        // If not found in filtersData yet, still set it (will be validated later)
        next.categories = [categoryIdFromUrl]
      }
    } else if (categoryValues.size > 0) {
      next.categories = filtersData.categories
        .filter(
          (cat) =>
            categoryValues.has(matchLower(cat.id)) ||
            (cat.slug && categoryValues.has(matchLower(cat.slug))),
        )
        .map((cat) => cat.id)
    }

    const brandValues = new Set(parseList('brand').map(matchLower))
    if (brandValues.size > 0) {
      next.brands = filtersData.brands
        .filter((brand) => brandValues.has(matchLower(brand.name)))
        .map((brand) => brand.name)
    }

    const sellerValues = new Set(parseList('seller').map(matchLower))
    if (sellerValues.size > 0) {
      next.sellers = filtersData.sellers
        .filter((seller) => sellerValues.has(matchLower(seller.id)))
        .map((seller) => seller.id)
    }

    const tagValues = new Set(parseList('tag').map(matchLower))
    if (tagValues.size > 0) {
      next.tags = filtersData.tags
        .filter((tag) => tagValues.has(matchLower(tag.value)))
        .map((tag) => tag.value)
    }

    const availabilityValues = parseList('availability').map((value) => value.toLowerCase())
    const includeOutOfStock = availabilityValues.some((value) =>
      ['include_out_of_stock', 'out_of_stock'].includes(value),
    )
    next.availability = includeOutOfStock ? ['include_out_of_stock'] : []

    const priceMinRaw = searchParams.get('minPrice')
    const priceMaxRaw = searchParams.get('maxPrice')
    const priceMin = priceMinRaw !== null ? Number(priceMinRaw) : undefined
    const priceMax = priceMaxRaw !== null ? Number(priceMaxRaw) : undefined
    if (
      (priceMin !== undefined && !Number.isNaN(priceMin) && priceMin !== 0) ||
      (priceMax !== undefined && !Number.isNaN(priceMax) && priceMax !== 0)
    ) {
      next.price = {
        min: priceMin !== undefined && !Number.isNaN(priceMin) ? priceMin : undefined,
        max: priceMax !== undefined && !Number.isNaN(priceMax) ? priceMax : undefined,
      }
    }

    const discountMinRaw = searchParams.get('minDiscount')
    const discountMaxRaw = searchParams.get('maxDiscount')
    const discountMin = discountMinRaw !== null ? Number(discountMinRaw) : undefined
    const discountMax = discountMaxRaw !== null ? Number(discountMaxRaw) : undefined
    if (
      (discountMin !== undefined && !Number.isNaN(discountMin) && discountMin !== 0) ||
      (discountMax !== undefined && !Number.isNaN(discountMax) && discountMax !== 0)
    ) {
      next.discount = {
        min: discountMin !== undefined && !Number.isNaN(discountMin) ? discountMin : undefined,
        max: discountMax !== undefined && !Number.isNaN(discountMax) ? discountMax : undefined,
      }
    }

    const ratingRaw = searchParams.get('minRating')
    const rating = ratingRaw !== null ? Number(ratingRaw) : undefined
    if (rating !== undefined && !Number.isNaN(rating) && rating !== 0) {
      next.rating = rating
    }

    const attributeEntries: Record<string, string[]> = {}
    searchParams.forEach((value, key) => {
      if (!key.startsWith('attr:')) return
      const attributeName = decodeURIComponent(key.slice(5))
      attributeEntries[attributeName] = value
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)
    })

    const validAttributes: Record<string, string[]> = {}
    Object.entries(attributeEntries).forEach(([rawName, requestedValues]) => {
      const attributeDefinition = filtersData.attributes.find(
        (attr) => matchLower(attr.name) === matchLower(rawName),
      )
      if (!attributeDefinition) return
      const allowedValues = attributeDefinition.values.map((val) => matchLower(val.value))
      const matched = requestedValues.filter((requested) =>
        allowedValues.includes(matchLower(requested)),
      )
      if (matched.length) {
        validAttributes[attributeDefinition.name] = matched
      }
    })
    next.attributes = validAttributes

    setSelectedFilters((prev) => {
      const prevSerialized = serializeFilters(prev)
      const nextSerialized = serializeFilters(next)
      if (prevSerialized === nextSerialized) return prev
      lastSyncedSearchRef.current = currentSearch
      return next
    })
  }, [filtersData, location.pathname, location.search])

  useEffect(() => {
    if (!location.pathname.includes('/products/search')) return
    const params = new URLSearchParams()
    const appendArrayParam = (key: string, values: string[]) => {
      if (values.length === 0) {
        params.delete(key)
        return
      }
      params.set(key, values.join(','))
    }

    // Handle category: if categoryId is in URL, use that; otherwise use selectedFilters.categories
    if (categoryId) {
      params.set('categoryId', categoryId)
      // Don't set 'category' param when categoryId is present
    } else if (selectedFilters.categories.length > 0) {
      appendArrayParam('category', selectedFilters.categories)
    } else {
      params.delete('category')
      params.delete('categoryId')
    }

    appendArrayParam('brand', selectedFilters.brands)
    appendArrayParam('seller', selectedFilters.sellers)
    appendArrayParam('tag', selectedFilters.tags)
    appendArrayParam('availability', selectedFilters.availability)

    Object.entries(selectedFilters.attributes).forEach(([key, values]) => {
      if (!values || values.length === 0) {
        params.delete(`attr:${encodeURIComponent(key)}`)
        return
      }
      params.set(`attr:${encodeURIComponent(key)}`, values.join(','))
    })

    const setNumericParam = (key: string, value: number | undefined) => {
      if (value === undefined || Number.isNaN(value)) {
        params.delete(key)
        return
      }
      params.set(key, String(value))
    }

    setNumericParam('minPrice', selectedFilters.price?.min)
    setNumericParam('maxPrice', selectedFilters.price?.max)
    setNumericParam('minDiscount', selectedFilters.discount?.min)
    setNumericParam('maxDiscount', selectedFilters.discount?.max)
    setNumericParam('minRating', selectedFilters.rating)

    params.set('sort', sort)
    if (q) {
      params.set('q', q)
    } else {
      params.delete('q')
    }
    // categoryId is already handled above, no need to set it again

    const newSearch = params.toString()
    const currentSearch = location.search.startsWith('?')
      ? location.search.slice(1)
      : location.search

    if (newSearch !== currentSearch) {
      lastSyncedSearchRef.current = newSearch
      navigate(
        {
          pathname: location.pathname,
          search: newSearch ? `?${newSearch}` : '',
        },
        { replace: true },
      )
    } else {
      lastSyncedSearchRef.current = currentSearch
    }
  }, [selectedFilters, sort, q, categoryId, location.pathname, location.search, navigate])
  useEffect(() => {
    const node = sentinelRef.current
    if (!node || !hasNextPage) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) fetchNextPage()
      },
      { root: null, rootMargin: '200px', threshold: 0 },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [fetchNextPage, hasNextPage])

  return (
    <div className="min-h-screen bg-slate-50/40">
      <div className="md:mt-24 mt-0 mx-auto w-full px-4 md:py-8 py-0 lg:px-5">
        <div className="mb-5 space-y-3 rounded-2xl border border-slate-200/80 bg-white/95 px-5 py-4 shadow-sm">
          <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
            <div className="text-2xl font-semibold text-slate-900">
              {q ? `Results for "${q}"` : categoryId ? 'Browse Products' : 'Search Results'}
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <div className="flex items-center gap-1 text-slate-600">
                <span className="text-[11px] uppercase tracking-wide text-slate-400">Showing</span>
                <span className="font-semibold text-slate-800">
                  {totalResults > 0 ? showingEnd : products.length}
                </span>
                <span className="text-[11px] uppercase tracking-wide text-slate-400">of</span>
                <span className="font-semibold text-slate-800">
                  {totalResults > 0 ? totalResults.toLocaleString() : 0}
                </span>
                <span className="text-[11px] uppercase tracking-wide text-slate-400">results</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            {didYouMean && didYouMean.toLowerCase() !== q.toLowerCase() ? (
              <div className="text-xs text-slate-600">
                Show results for{' '}
                <button
                  className="font-semibold text-indigo-600 underline-offset-2 hover:underline"
                  onClick={() => navigate(`/products/search?q=${encodeURIComponent(didYouMean)}`)}
                >
                  {didYouMean}
                </button>{' '}
                instead?
              </div>
            ) : null}
            {isMobile ? (
              /* Mobile: Dropdown Select */
              <div className="flex items-center gap-2">
                <span className="text-xs whitespace-nowrap font-medium uppercase tracking-wide text-slate-400">
                  Sort by
                </span>
                <Select value={sort} onValueChange={(value) => setSort(value as SearchSort)}>
                  <SelectTrigger className="h-9 w-full min-w-[180px] border-slate-200 text-xs font-medium text-slate-700 shadow-sm focus:border-indigo-500 focus:ring-indigo-500/20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="relevance">Relevance</SelectItem>
                    <SelectItem value="price_asc">Price -- Low to High</SelectItem>
                    <SelectItem value="price_desc">Price -- High to Low</SelectItem>
                    <SelectItem value="newest">Newest First</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : (
              /* Desktop: Button Pills */
              <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-slate-500">
                <span className="uppercase tracking-wide text-slate-400">Sort by</span>
                {[
                  { label: 'Relevance', value: 'relevance' as SearchSort },
                  {
                    label: 'Price -- Low to High',
                    value: 'price_asc' as SearchSort,
                  },
                  {
                    label: 'Price -- High to Low',
                    value: 'price_desc' as SearchSort,
                  },
                  { label: 'Newest First', value: 'newest' as SearchSort },
                ].map(({ label, value }) => (
                  <button
                    key={value}
                    onClick={() => setSort(value)}
                    className={`rounded-full border px-3 py-1 transition ${
                      sort === value
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-600'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <div className="hidden md:block">
            <div className="sticky top-28">
              <div className="rounded-2xl border border-slate-200/70 bg-white shadow-sm">
                <FiltersSidebar
                  filters={filtersData}
                  isLoading={filtersLoading}
                  selected={selectedFilters}
                  height="calc(100vh - 160px)"
                  onChange={(value) => setSelectedFilters(value)}
                  onReset={() => setSelectedFilters(createInitialFiltersState())}
                />
              </div>
            </div>
          </div>
          <div className="flex-1 pr-0 md:pr-4 min-h-[60vh]">
            <ScrollArea className="h-[calc(200vh-120px)] pr-2">
              <div className="pr-2 sm:pr-4">
                {isLoading && !pages.length ? (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
                    {[...Array(8)].map((_, index) => (
                      <div
                        key={index}
                        className="flex h-[320px] flex-col overflow-hidden rounded-3xl border border-slate-200/60 bg-white shadow-sm"
                        aria-label="Loading product"
                      >
                        <div className="h-2/3 animate-pulse bg-indigo-100/50" />
                        <div className="flex flex-1 flex-col gap-3 px-5 py-4">
                          <div className="h-5 w-3/4 animate-pulse rounded-full bg-indigo-100/80" />
                          <div className="h-5 w-1/2 animate-pulse rounded-full bg-indigo-100/60" />
                          <div className="mt-auto flex gap-2">
                            <div className="h-9 flex-1 animate-pulse rounded-full bg-indigo-100/40" />
                            <div className="h-9 w-9 animate-pulse rounded-full bg-indigo-100/40" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : products.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-3xl border border-dashed border-slate-300 bg-white/70 px-8 py-12 shadow-sm">
                      <div className="text-xl font-semibold text-gray-900">No results found</div>
                      <p className="mt-1 text-sm text-gray-500">
                        Try a different keyword or adjust your filters.
                      </p>
                      <Button
                        variant="secondary"
                        className="rounded-full md:hidden flex border border-slate-200 bg-white text-indigo-600 hover:bg-indigo-50"
                        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                      >
                        Review filters
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
                      {displayProducts.map((product) => (
                        <SearchProductCard key={product._id} product={product} />
                      ))}
                    </div>
                    <div ref={sentinelRef} className="h-8 w-full" />
                    {isFetchingNextPage && (
                      <div className="flex items-center justify-center py-6 text-slate-500">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Hang on, Loading more results…
                      </div>
                    )}
                    {hasNextPage && !isFetchingNextPage && (
                      <div className="py-6 text-center">
                        <Button
                          variant="outline"
                          onClick={() => fetchNextPage()}
                          className="rounded-full border-slate-300 text-slate-700 hover:bg-slate-50"
                        >
                          Load more results
                        </Button>
                      </div>
                    )}
                    {!hasNextPage && products.length > 0 && (
                      <div className="py-6 text-center text-sm text-slate-400">
                        You’ve reached the end.
                      </div>
                    )}
                  </>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SearchResults
