import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCategoryHighlights } from '../../api/products'
const MAX_PRODUCTS_PER_COLUMN = 4

const CategoryHighlights: React.FC = () => {
  const navigate = useNavigate()
  const { data, isLoading } = useCategoryHighlights(MAX_PRODUCTS_PER_COLUMN)
  const discountScrollRef = useRef<HTMLDivElement | null>(null)
  const budgetScrollRef = useRef<HTMLDivElement | null>(null)
  const [canScrollDiscountLeft, setCanScrollDiscountLeft] = useState(false)
  const [canScrollDiscountRight, setCanScrollDiscountRight] = useState(false)
  const [canScrollBudgetLeft, setCanScrollBudgetLeft] = useState(false)
  const [canScrollBudgetRight, setCanScrollBudgetRight] = useState(false)

  const discountHighlight = data?.discount ?? null
  const budgetHighlight = data?.budget ?? null

  const discountProducts = useMemo(
    () => (discountHighlight?.products ?? []).slice(0, MAX_PRODUCTS_PER_COLUMN),
    [discountHighlight],
  )

  const budgetProducts = useMemo(
    () => (budgetHighlight?.products ?? []).slice(0, MAX_PRODUCTS_PER_COLUMN),
    [budgetHighlight],
  )

  const handleNavigateToCategory = useCallback(
    (slug?: string, extraParams?: Record<string, string | number | boolean | undefined | null>) => {
      if (!slug) return

      const searchParams = new URLSearchParams({ category: slug })

      if (extraParams) {
        Object.entries(extraParams).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            searchParams.set(key, String(value))
          }
        })
      }

      navigate(`/shop-by-category?${searchParams.toString()}`)
    },
    [navigate],
  )

  const handleProductClick = useCallback(
    (slugOrId: string | number) => {
      navigate(`/product/${slugOrId}`)
    },
    [navigate],
  )

  const updateScrollButtons = useCallback(() => {
    updateButtons(discountScrollRef.current, setCanScrollDiscountLeft, setCanScrollDiscountRight)
    updateButtons(budgetScrollRef.current, setCanScrollBudgetLeft, setCanScrollBudgetRight)
  }, [])

  const handleScroll = useCallback(
    (ref: React.RefObject<HTMLDivElement | null>, direction: 'left' | 'right') => {
      const container = ref.current
      if (!container) return
      const childWidth = container.querySelector('button')?.clientWidth || 180
      const gap = 16
      const scrollAmount = childWidth + gap

      container.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      })
    },
    [],
  )

  const renderSkeletons = () =>
    Array.from({ length: MAX_PRODUCTS_PER_COLUMN }).map((_, index) => (
      <Skeleton key={index} className="h-56 w-full md:w-44 shrink-0 rounded-2xl" />
    ))

  const renderScrollableGrid = (
    products: typeof discountProducts,
    ref: React.RefObject<HTMLDivElement | null>,
    isLoadingSection: boolean,
    variant: 'discount' | 'budget',
  ) => (
    <div className="relative w-full">
      <div
        ref={ref}
        className="flex w-full gap-4 overflow-x-auto overflow-y-hidden py-1 scrollbar-hide"
        onScroll={updateScrollButtons}
      >
        {isLoadingSection
          ? renderSkeletons()
          : products.map((product) => (
              <button
                key={product._id}
                type="button"
                onClick={() => handleProductClick(product.slug)}
                className="group relative flex h-56 w-full md:w-44 shrink-0 flex-col overflow-hidden rounded-2xl bg-white shadow-sm transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white focus-visible:ring-yellow-500"
              >
                <img
                  src={product.mainImage || '/image-placeholder.svg'}
                  alt={product.name}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                  decoding="async"
                />
                {variant === 'discount' && product.discountPercent ? (
                  <span className="absolute left-2 top-2 rounded-full bg-yellow-500/90 px-2 py-1 text-xs font-semibold text-white shadow">
                    {product.discountPercent}% OFF
                  </span>
                ) : null}
                <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/80 via-black/40 to-transparent p-2.5 text-left">
                  <p className="truncate text-xs font-semibold text-white md:text-sm">
                    {product.name}
                  </p>
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-white/90 md:text-xs">
                    {(() => {
                      // Use effectivePrice (what customer actually pays)
                      const effectivePrice =
                        product.hasVariants &&
                        product.variants &&
                        Array.isArray(product.variants) &&
                        product.variants.length > 0
                          ? (product.variants.find((v) => v.isDefault) || product.variants[0])
                              ?.effectivePrice ??
                            (product.variants.find((v) => v.isDefault) || product.variants[0])
                              ?.price ??
                            product.effectivePrice ??
                            product.price ??
                            0
                          : product.effectivePrice ?? product.price ?? 0
                      const comparePrice =
                        product.hasVariants &&
                        product.variants &&
                        Array.isArray(product.variants) &&
                        product.variants.length > 0
                          ? (product.variants.find((v) => v.isDefault) || product.variants[0])
                              ?.comparePrice ?? product.comparePrice
                          : product.comparePrice
                      return (
                        <>
                          <span className="font-bold text-white">
                            ₹{effectivePrice.toLocaleString()}
                          </span>
                          {comparePrice && comparePrice > effectivePrice ? (
                            <span className="text-white/70 line-through">
                              ₹{comparePrice.toLocaleString()}
                            </span>
                          ) : null}
                        </>
                      )
                    })()}
                  </div>
                </div>
              </button>
            ))}
      </div>
      {ref === discountScrollRef ? (
        <>
          {canScrollDiscountLeft && (
            <Button
              variant="outline"
              size="icon"
              className="absolute left-0 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-lg hover:bg-yellow-50 hover:text-yellow-600 lg:inline-flex"
              onClick={() => handleScroll(discountScrollRef, 'left')}
              aria-label="Scroll left"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
          )}
          {canScrollDiscountRight && (
            <Button
              variant="outline"
              size="icon"
              className="absolute right-0 top-1/2 hidden translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-lg hover:bg-yellow-50 hover:text-yellow-600 lg:inline-flex"
              onClick={() => handleScroll(discountScrollRef, 'right')}
              aria-label="Scroll right"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          )}
        </>
      ) : (
        <>
          {canScrollBudgetLeft && (
            <Button
              variant="outline"
              size="icon"
              className="absolute left-0 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-lg hover:bg-blue-50 hover:text-blue-600 lg:inline-flex"
              onClick={() => handleScroll(budgetScrollRef, 'left')}
              aria-label="Scroll left"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
          )}
          {canScrollBudgetRight && (
            <Button
              variant="outline"
              size="icon"
              className="absolute right-0 top-1/2 hidden translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-lg hover:bg-blue-50 hover:text-blue-600 lg:inline-flex"
              onClick={() => handleScroll(budgetScrollRef, 'right')}
              aria-label="Scroll right"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          )}
        </>
      )}
    </div>
  )

  useEffect(() => {
    updateScrollButtons()
  }, [discountProducts, budgetProducts, updateScrollButtons])

  useEffect(() => {
    window.addEventListener('resize', updateScrollButtons)
    return () => window.removeEventListener('resize', updateScrollButtons)
  }, [updateScrollButtons])

  if (!discountHighlight && !budgetHighlight && !isLoading) {
    return null
  }

  return (
    <section className=" mx-auto px-4 md:px-8 my-12">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {(discountHighlight || isLoading) && (
          <div className="flex flex-col gap-4 rounded-3xl border border-yellow-100 bg-linear-to-br from-yellow-50 via-white to-orange-50 p-6 shadow-md">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-yellow-600">
                  Up to 60% off
                </p>
                <h3 className="text-2xl font-extrabold text-gray-900">
                  {discountHighlight?.category?.name ?? 'Top category picks'}
                </h3>
                <p className="mt-1 text-sm text-gray-600">
                  Hand-picked deals bursting with big savings
                </p>
              </div>
              <Button
                variant="ghost"
                className="hidden items-center gap-2 text-yellow-600 hover:text-yellow-700 lg:flex"
                onClick={() =>
                  handleNavigateToCategory(discountHighlight?.category?.slug, {
                    deal: 'upto-60',
                  })
                }
                disabled={!discountHighlight?.category?.slug}
              >
                See more
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>

            {renderScrollableGrid(discountProducts, discountScrollRef, isLoading, 'discount')}

            <Button
              variant="outline"
              className="flex w-full justify-center gap-2 border-yellow-200 text-yellow-600 hover:text-yellow-700 lg:hidden"
              onClick={() =>
                handleNavigateToCategory(discountHighlight?.category?.slug, {
                  deal: 'upto-60',
                })
              }
              disabled={!discountHighlight?.category?.slug}
            >
              See more deals
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {(budgetHighlight || isLoading) && (
          <div className="flex flex-col gap-4 rounded-3xl border border-blue-100 bg-linear-to-br from-blue-50 via-white to-cyan-50 p-6 shadow-md">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
                  Starting ₹199
                </p>
                <h3 className="text-2xl font-extrabold text-gray-900">
                  {budgetHighlight?.category?.name ?? 'Budget friendly picks'}
                </h3>
                <p className="mt-1 text-sm text-gray-600">
                  Pocket friendly finds for everyday needs
                </p>
              </div>
              <Button
                variant="ghost"
                className="hidden items-center gap-2 text-blue-600 hover:text-blue-700 lg:flex"
                onClick={() =>
                  handleNavigateToCategory(budgetHighlight?.category?.slug, {
                    deal: 'starting-199',
                  })
                }
                disabled={!budgetHighlight?.category?.slug}
              >
                Shop more
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>

            {renderScrollableGrid(budgetProducts, budgetScrollRef, isLoading, 'budget')}

            <Button
              variant="outline"
              className="flex w-full justify-center gap-2 border-blue-200 text-blue-600 hover:text-blue-700 lg:hidden"
              onClick={() =>
                handleNavigateToCategory(budgetHighlight?.category?.slug, {
                  deal: 'starting-199',
                })
              }
              disabled={!budgetHighlight?.category?.slug}
            >
              Discover more
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </section>
  )
}

export default CategoryHighlights

const updateButtons = (
  container: HTMLDivElement | null,
  setLeft: React.Dispatch<React.SetStateAction<boolean>>,
  setRight: React.Dispatch<React.SetStateAction<boolean>>,
) => {
  if (!container) {
    setLeft(false)
    setRight(false)
    return
  }

  const { scrollLeft, scrollWidth, clientWidth } = container
  setLeft(scrollLeft > 0)
  setRight(scrollLeft < scrollWidth - clientWidth - 10)
}
