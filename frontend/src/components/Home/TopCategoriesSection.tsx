import { motion } from 'framer-motion'
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTopCategories } from '../../api/categories'
import type { Category } from '../../types/category'
import SectionHeading from '../ui/SectionHeading'
import { demoCategories } from './demoStoreData'

const TopCategoriesSection: React.FC = () => {
  const navigate = useNavigate()
  const { data } = useTopCategories()
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const [isCompactLayout, setIsCompactLayout] = useState(false)

  const apiCategories = data?.categories || []
  const categories = useMemo(
    () => (apiCategories.length > 0 ? apiCategories : demoCategories),
    [apiCategories],
  )

  const flatCategories: typeof categories = []
  const seenIds = new Set<string>()

  categories.forEach((cat) => {
    if (cat.top && cat._id && !seenIds.has(cat._id)) {
      seenIds.add(cat._id)
      flatCategories.push(cat)
    }

    if (cat.subcategories && cat.subcategories.length > 0) {
      cat.subcategories.forEach((subcat) => {
        if (subcat.top && subcat._id && !seenIds.has(subcat._id)) {
          seenIds.add(subcat._id)
          flatCategories.push(subcat)
        }
      })
    }
  })

  const displayedCategories = flatCategories.slice(0, 15) // 3 rows of 5 items for desktop
  const MOBILE_ITEMS_PER_PAGE = 4 // 2 rows × 2 columns

  // Chunk mobile categories into pages of 4 items (2 rows)
  const mobilePages: (typeof displayedCategories)[] = []
  for (let i = 0; i < displayedCategories.length; i += MOBILE_ITEMS_PER_PAGE) {
    mobilePages.push(displayedCategories.slice(i, i + MOBILE_ITEMS_PER_PAGE))
  }

  const handleCategoryClick = (category: { _id?: string; slug: string }) => {
    navigate(`/products/search?sort=relevance&categoryId=${category._id}`)
  }

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return

    const mediaQuery = window.matchMedia('(max-width: 1023px)')
    const updateLayout = () => setIsCompactLayout(mediaQuery.matches)

    updateLayout()
    mediaQuery.addEventListener('change', updateLayout)
    return () => mediaQuery.removeEventListener('change', updateLayout)
  }, [])

  const updateScrollButtons = useCallback(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const { scrollLeft, scrollWidth, clientWidth } = container
    const maxScrollLeft = scrollWidth - clientWidth
    const overflowThreshold = 32 // px buffer to avoid showing controls when everything fits
    const hasOverflow = maxScrollLeft > overflowThreshold

    setCanScrollLeft(hasOverflow && scrollLeft > overflowThreshold)
    setCanScrollRight(hasOverflow && scrollLeft < maxScrollLeft - overflowThreshold)
  }, [])

  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return
    updateScrollButtons()
    const raf = requestAnimationFrame(updateScrollButtons)

    const handleScroll = () => updateScrollButtons()
    container.addEventListener('scroll', handleScroll)
    window.addEventListener('resize', updateScrollButtons)

    return () => {
      cancelAnimationFrame(raf)
      container.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', updateScrollButtons)
    }
  }, [displayedCategories.length, mobilePages.length, isCompactLayout, updateScrollButtons])

  const scrollByAmount = (direction: 'left' | 'right') => {
    const container = scrollContainerRef.current
    if (!container) return

    const scrollAmount = container.clientWidth * 0.98
    container.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    })
  }

  const renderCategoryCard = (
    category: Category,
    key: string,
    animationIndex: number,
    isMobileView = false,
  ) => {
    const cardHeightClasses = isMobileView ? 'h-52 sm:h-60' : 'h-64 md:h-72 lg:h-80'

    return (
      <motion.div
        key={key}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: animationIndex * 0.04 }}
        whileHover={isMobileView ? undefined : { y: -6 }}
        onClick={() => handleCategoryClick(category)}
        className={`group relative cursor-pointer overflow-hidden rounded-2xl shadow-md transition-shadow duration-300 hover:shadow-xl ${cardHeightClasses}`}
      >
        <div className="absolute inset-0">
          <img
            src={category.mainImage}
            alt={category.name}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
          {category.hoverImage && (
            <img
              src={category.hoverImage}
              alt={`${category.name} hover`}
              className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-700 group-hover:opacity-100"
            />
          )}

          <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/30 to-transparent" />
        </div>

        <div className="absolute bottom-0 left-0 right-0 z-10 p-4 text-white">
          <motion.h3
            initial={{ y: 0 }}
            whileHover={isMobileView ? undefined : { y: -14 }}
            transition={{ type: 'spring', stiffness: 140, damping: 14 }}
            className="text-sm font-semibold leading-tight md:text-base"
          >
            {category.name}
          </motion.h3>

          {category.description && (
            <p
              className={
                isMobileView
                  ? 'mt-1 line-clamp-2 text-xs text-white/90'
                  : 'mt-1 line-clamp-2 max-h-0 translate-y-2 text-xs text-white/80 opacity-0 transition-all duration-400 group-hover:translate-y-0 group-hover:opacity-100 group-hover:max-h-20'
              }
            >
              {category.description}
            </p>
          )}

          <div className="mt-3">
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleCategoryClick(category)
              }}
              className={`inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-gray-900 transition-all duration-400 backdrop-blur-md md:px-4 md:py-2 ${
                isMobileView
                  ? ''
                  : 'translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100'
              }`}
            >
              Explore
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 -translate-x-full bg-linear-to-r from-transparent via-white/20 to-transparent opacity-0 transition-transform duration-1000 group-hover:translate-x-full group-hover:opacity-100" />
        </div>
      </motion.div>
    )
  }

  if (displayedCategories.length === 0) return null

  return (
    <div className="bg-linear-to-b py-12 from-white via-gray-50 to-white ">
      <div className=" mx-auto px-4 md:px-8">
        <SectionHeading
          title="Top"
          align="left"
          italicPart="Categories"
          subtitle="Discover our most loved collections"
        />

        {isCompactLayout ? (
          <div className="relative mt-6">
            {canScrollLeft && (
              <button
                type="button"
                aria-label="Scroll top categories left"
                onClick={() => scrollByAmount('left')}
                className="absolute left-0 top-1/2 z-20 -translate-y-1/2 rounded-full border border-gray-200 bg-white p-2 text-gray-600 shadow-md transition hover:scale-110 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
            <div
              ref={scrollContainerRef}
              className="flex gap-3 overflow-x-auto snap-x snap-mandatory px-1 py-1"
              style={{ WebkitOverflowScrolling: 'touch', scrollBehavior: 'smooth' }}
            >
              {mobilePages.map((page, pageIndex) => (
                <div
                  key={`mobile-page-${pageIndex}`}
                  className="snap-center shrink-0 w-[95vw] max-w-sm grid grid-cols-2 gap-3"
                >
                  {page.map((category, index) =>
                    renderCategoryCard(
                      category,
                      category._id || `mobile-${pageIndex}-${index}`,
                      pageIndex * MOBILE_ITEMS_PER_PAGE + index,
                      true,
                    ),
                  )}
                  {page.length < MOBILE_ITEMS_PER_PAGE &&
                    Array.from({ length: MOBILE_ITEMS_PER_PAGE - page.length }).map(
                      (_, placeholderIndex) => (
                        <div
                          key={`placeholder-${pageIndex}-${placeholderIndex}`}
                          className="h-52 rounded-2xl opacity-0"
                        />
                      ),
                    )}
                </div>
              ))}
            </div>
            {canScrollRight && (
              <button
                type="button"
                aria-label="Scroll top categories right"
                onClick={() => scrollByAmount('right')}
                className="absolute right-0 top-1/2 z-20 -translate-y-1/2 rounded-full border border-gray-200 bg-white p-2 text-gray-600 shadow-md transition hover:scale-110 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>
        ) : (
          <div className="relative mt-8">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 md:gap-6">
              {displayedCategories.map((category, index) =>
                renderCategoryCard(category, category._id || `category-${index}`, index),
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default TopCategoriesSection
