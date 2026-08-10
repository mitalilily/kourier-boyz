import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdditionalCategoryHighlights, useCategoryHighlights } from '../../api/products'

const MAX_PRODUCTS = 4

const AdditionalCategoryHighlights: React.FC = () => {
  const navigate = useNavigate()
  const { data: primaryHighlights } = useCategoryHighlights(MAX_PRODUCTS)

  const excludeCategoryIds = useMemo(() => {
    const ids: string[] = []
    if (primaryHighlights?.discount?.category?._id) {
      ids.push(primaryHighlights.discount.category._id)
    }
    if (primaryHighlights?.budget?.category?._id) {
      ids.push(primaryHighlights.budget.category._id)
    }
    return ids
  }, [primaryHighlights])

  const { data, isLoading } = useAdditionalCategoryHighlights({
    limit: MAX_PRODUCTS,
    exclude: excludeCategoryIds,
  })

  const uptoFortyHighlight = data?.uptoForty ?? null
  const topRatedHighlight = data?.topRated ?? null

  const uptoFortyProducts = useMemo(
    () => (uptoFortyHighlight?.products ?? []).slice(0, MAX_PRODUCTS),
    [uptoFortyHighlight],
  )
  const topRatedProducts = useMemo(
    () => (topRatedHighlight?.products ?? []).slice(0, MAX_PRODUCTS),
    [topRatedHighlight],
  )

  const uptoFortyRef = useRef<HTMLDivElement | null>(null)
  const topRatedRef = useRef<HTMLDivElement | null>(null)

  const [canScrollUptoFortyLeft, setCanScrollUptoFortyLeft] = useState(false)
  const [canScrollUptoFortyRight, setCanScrollUptoFortyRight] = useState(false)
  const [canScrollTopRatedLeft, setCanScrollTopRatedLeft] = useState(false)
  const [canScrollTopRatedRight, setCanScrollTopRatedRight] = useState(false)

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
    updateButtons(uptoFortyRef.current, setCanScrollUptoFortyLeft, setCanScrollUptoFortyRight)
    updateButtons(topRatedRef.current, setCanScrollTopRatedLeft, setCanScrollTopRatedRight)
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
    Array.from({ length: MAX_PRODUCTS }).map((_, index) => (
      <Skeleton key={index} className="h-56 w-full md:w-44 shrink-0 rounded-2xl" />
    ))

  const renderScrollableGrid = (
    products: typeof uptoFortyProducts,
    ref: React.RefObject<HTMLDivElement | null>,
    isLoadingSection: boolean,
    variant: 'uptoForty' | 'topRated',
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
                className="group relative flex h-56 w-full md:w-44 shrink-0 flex-col overflow-hidden rounded-2xl bg-white shadow-sm transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white focus-visible:ring-emerald-500"
              >
                <img
                  src={product.mainImage || '/image-placeholder.svg'}
                  alt={product.name}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                  decoding="async"
                />
                {variant === 'uptoForty' && product.discountPercent ? (
                  <span className="absolute left-2 top-2 rounded-full bg-emerald-500/90 px-2 py-1 text-xs font-semibold text-white shadow">
                    {product.discountPercent}% OFF
                  </span>
                ) : null}
                {variant === 'topRated' && product.rating ? (
                  <span className="absolute left-2 top-2 rounded-full bg-purple-500/90 px-2 py-1 text-xs font-semibold text-white shadow">
                    ★ {product.rating.toFixed(1)}
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

      {ref === uptoFortyRef ? (
        <>
          {canScrollUptoFortyLeft && (
            <Button
              variant="outline"
              size="icon"
              className="absolute left-0 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-lg hover:bg-emerald-50 hover:text-emerald-600 lg:inline-flex"
              onClick={() => handleScroll(uptoFortyRef, 'left')}
              aria-label="Scroll left"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
          )}
          {canScrollUptoFortyRight && (
            <Button
              variant="outline"
              size="icon"
              className="absolute right-0 top-1/2 hidden translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-lg hover:bg-emerald-50 hover:text-emerald-600 lg:inline-flex"
              onClick={() => handleScroll(uptoFortyRef, 'right')}
              aria-label="Scroll right"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          )}
        </>
      ) : (
        <>
          {canScrollTopRatedLeft && (
            <Button
              variant="outline"
              size="icon"
              className="absolute left-0 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-lg hover:bg-purple-50 hover:text-purple-600 lg:inline-flex"
              onClick={() => handleScroll(topRatedRef, 'left')}
              aria-label="Scroll left"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
          )}
          {canScrollTopRatedRight && (
            <Button
              variant="outline"
              size="icon"
              className="absolute right-0 top-1/2 hidden translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-lg hover:bg-purple-50 hover:text-purple-600 lg:inline-flex"
              onClick={() => handleScroll(topRatedRef, 'right')}
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
  }, [uptoFortyProducts, topRatedProducts, updateScrollButtons])

  useEffect(() => {
    window.addEventListener('resize', updateScrollButtons)
    return () => window.removeEventListener('resize', updateScrollButtons)
  }, [updateScrollButtons])

  if (!uptoFortyHighlight && !topRatedHighlight && !isLoading) {
    return null
  }

  return (
    <section className=" mx-auto px-4 md:px-8 my-12">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {(uptoFortyHighlight || isLoading) && (
          <div className="flex flex-col gap-4 rounded-3xl border border-emerald-100 bg-linear-to-br from-emerald-50 via-white to-lime-50 p-6 shadow-md">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-emerald-600">
                  Up to 40% off
                </p>
                <h3 className="text-2xl font-extrabold text-gray-900">
                  {uptoFortyHighlight?.category?.name ?? 'Smart savings picks'}
                </h3>
                <p className="mt-1 text-sm text-gray-600">
                  Fresh finds with gentle price drops you can’t miss
                </p>
              </div>
              <Button
                variant="ghost"
                className="hidden items-center gap-2 text-emerald-600 hover:text-emerald-700 lg:flex"
                onClick={() =>
                  handleNavigateToCategory(uptoFortyHighlight?.category?.slug, {
                    deal: 'upto-40',
                  })
                }
                disabled={!uptoFortyHighlight?.category?.slug}
              >
                See all
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>

            {renderScrollableGrid(
              uptoFortyProducts,
              uptoFortyRef,
              isLoading && !uptoFortyHighlight,
              'uptoForty',
            )}

            <Button
              variant="outline"
              className="flex w-full justify-center gap-2 border-emerald-200 text-emerald-600 hover:text-emerald-700 lg:hidden"
              onClick={() =>
                handleNavigateToCategory(uptoFortyHighlight?.category?.slug, {
                  deal: 'upto-40',
                })
              }
              disabled={!uptoFortyHighlight?.category?.slug}
            >
              Browse more deals
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {(topRatedHighlight || isLoading) && (
          <div className="flex flex-col gap-4 rounded-3xl border border-purple-100 bg-linear-to-br from-purple-50 via-white to-pink-50 p-6 shadow-md">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-purple-600">
                  Highly Rated
                </p>
                <h3 className="text-2xl font-extrabold text-gray-900">
                  {topRatedHighlight?.category?.name ?? 'Loved by shoppers'}
                </h3>
                <p className="mt-1 text-sm text-gray-600">Crowd favorites with glowing reviews</p>
              </div>
              <Button
                variant="ghost"
                className="hidden items-center gap-2 text-purple-600 hover:text-purple-700 lg:flex"
                onClick={() =>
                  handleNavigateToCategory(topRatedHighlight?.category?.slug, {
                    deal: 'top-rated',
                  })
                }
                disabled={!topRatedHighlight?.category?.slug}
              >
                Shop favorites
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>

            {renderScrollableGrid(
              topRatedProducts,
              topRatedRef,
              isLoading && !topRatedHighlight,
              'topRated',
            )}

            <Button
              variant="outline"
              className="flex w-full justify-center gap-2 border-purple-200 text-purple-600 hover:text-purple-700 lg:hidden"
              onClick={() =>
                handleNavigateToCategory(topRatedHighlight?.category?.slug, {
                  deal: 'top-rated',
                })
              }
              disabled={!topRatedHighlight?.category?.slug}
            >
              Explore more
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </section>
  )
}

export default AdditionalCategoryHighlights

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
