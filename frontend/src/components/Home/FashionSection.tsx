import { motion } from 'framer-motion'
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCategories } from '../../api/categories'
import type { Category } from '../../types/category'
import SectionHeading from '../ui/SectionHeading'

const GRID_PAGE_SIZE = 8 // 4x2 layout

const FashionSection: React.FC = () => {
  const navigate = useNavigate()
  const { data: allCategories, isLoading } = useCategories({
    status: 'active',
    includeSubcategories: true,
  })

  // find Fashion root
  const fashionParent = useMemo(
    () =>
      allCategories?.categories.find((cat) => cat.slug.toLowerCase() === 'fashion' && !cat.parent),
    [allCategories],
  )

  // flatten all subcategories
  const fashionSubcategories = useMemo(() => {
    if (!fashionParent || !allCategories?.categories) return []
    const result: Category[] = []
    const seen = new Set<string>()

    const collect = (cat: Category) => {
      const id = cat._id || cat.slug
      if (!id || seen.has(id)) return
      seen.add(id)
      if (cat.subcategories) {
        cat.subcategories.forEach((sub) => collect(sub as Category))
      }
      result.push(cat)
    }

    collect(fashionParent)
    return result.filter((c) => c._id !== fashionParent._id)
  }, [fashionParent, allCategories])

  const gradients = [
    'from-pink-300 to-rose-600',
    'from-purple-300 to-indigo-600',
    'from-blue-300 to-cyan-600',
    'from-amber-300 to-orange-600',
    'from-emerald-300 to-teal-600',
    'from-fuchsia-300 to-pink-600',
    'from-violet-300 to-purple-600',
    'from-rose-300 to-red-600',
  ]

  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [isAnimating, setIsAnimating] = useState(false)

  const handleCategoryClick = useCallback(
    (category: { _id?: string; slug: string }) => {
      navigate(`/shop-by-category?category=${category._id || category.slug}`)
    },
    [navigate],
  )

  // group into pages of 8 (4x2)
  const gridPages = useMemo(() => {
    const pages: Category[][] = []
    for (let i = 0; i < fashionSubcategories.length; i += GRID_PAGE_SIZE) {
      pages.push(fashionSubcategories.slice(i, i + GRID_PAGE_SIZE))
    }
    return pages
  }, [fashionSubcategories])

  // duplicate first and last pages for looping
  const loopedPages = useMemo(() => {
    if (gridPages.length <= 1) return gridPages
    const first = gridPages[0]
    const last = gridPages[gridPages.length - 1]
    return [last, ...gridPages, first]
  }, [gridPages])

  // handle infinite scroll looping
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const handleScroll = () => {
      if (isAnimating) return
      const maxScroll = container.scrollWidth - container.clientWidth
      const threshold = container.clientWidth * 0.5

      if (container.scrollLeft >= maxScroll - threshold) {
        setIsAnimating(true)
        container.scrollTo({
          left: container.clientWidth,
          behavior: 'auto',
        })
        setTimeout(() => setIsAnimating(false), 80)
      }

      if (container.scrollLeft <= 0) {
        setIsAnimating(true)
        container.scrollTo({
          left: maxScroll - 2 * container.clientWidth,
          behavior: 'auto',
        })
        setTimeout(() => setIsAnimating(false), 80)
      }
    }

    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [loopedPages, isAnimating])

  // scroll by width
  const scrollByAmount = (dir: 'left' | 'right') => {
    const container = scrollContainerRef.current
    if (!container) return
    const amount = container.clientWidth * 0.9
    container.scrollBy({
      left: dir === 'left' ? -amount : amount,
      behavior: 'smooth',
    })
  }

  const renderCategoryCard = (
    category: Category,
    key: string,
    animationIndex: number,
    gradientClass: string,
  ) => (
    <motion.div
      key={key}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: animationIndex * 0.03 }}
      whileHover={{ y: -6 }}
      onClick={() => handleCategoryClick(category)}
      className="group relative cursor-pointer overflow-hidden rounded-2xl shadow-md transition-shadow duration-300 hover:shadow-xl h-56 sm:h-64 md:h-72"
    >
      <div className="absolute inset-0">
        <img
          src={category.mainImage}
          alt={category.name}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
        {category.hoverImage ? (
          <img
            src={category.hoverImage}
            alt={`${category.name} hover`}
            className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-700 group-hover:opacity-100"
          />
        ) : null}
        <div
          className={`absolute inset-0 bg-linear-to-t ${gradientClass} opacity-65 group-hover:opacity-80`}
        />
      </div>

      <div className="absolute bottom-0 left-0 right-0 z-10 p-4 text-white">
        <h3 className="text-sm md:text-base font-semibold leading-tight line-clamp-2">
          {category.name}
        </h3>
        {category.productCount ? (
          <p className="mt-1 text-xs font-medium text-white/90">{category.productCount}+ items</p>
        ) : null}
        <button
          onClick={(e) => {
            e.stopPropagation()
            handleCategoryClick(category)
          }}
          className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-gray-900 transition-all backdrop-blur-md hover:bg-white"
        >
          Explore
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </motion.div>
  )

  if (isLoading)
    return (
      <div className="py-12  mx-auto px-4">
        <SectionHeading title="Fashion" italicPart="Hub" subtitle="Discover the latest trends" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-8">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-60 rounded-2xl bg-gray-200/70 animate-pulse" />
          ))}
        </div>
      </div>
    )

  if (!fashionParent || fashionSubcategories.length === 0) return null

  return (
    <div className="bg-linear-to-b py-12 from-white via-gray-50 to-white">
      <div className=" mx-auto px-4 md:px-8">
        <SectionHeading
          title="Fashion"
          italicPart="Hub"
          align="left"
          subtitle="Discover the latest trends and styles"
        />

        <div className="relative mt-8">
          {/* Arrows only show if multiple pages exist */}
          {gridPages.length > 1 && (
            <button
              onClick={() => scrollByAmount('left')}
              className="absolute -left-10 top-1/2 z-20 hidden -translate-y-1/2 rounded-full border border-gray-200 bg-white p-3 text-gray-600 shadow-lg hover:scale-110 md:flex"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}

          <div
            ref={scrollContainerRef}
            className="flex overflow-x-auto snap-x snap-mandatory gap-6 py-2 no-scrollbar"
            style={{ scrollBehavior: 'smooth', WebkitOverflowScrolling: 'touch' }}
          >
            {loopedPages.map((page, pageIndex) => (
              <div
                key={pageIndex}
                className="snap-center shrink-0 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 w-[90vw] sm:w-[85vw] lg:w-[80vw]"
              >
                {page.map((category, index) =>
                  renderCategoryCard(
                    category,
                    category._id || `${pageIndex}-${index}`,
                    pageIndex * GRID_PAGE_SIZE + index,
                    gradients[(pageIndex * GRID_PAGE_SIZE + index) % gradients.length],
                  ),
                )}
              </div>
            ))}
          </div>

          {gridPages.length > 1 && (
            <button
              onClick={() => scrollByAmount('right')}
              className="absolute -right-10 top-1/2 z-20 hidden -translate-y-1/2 rounded-full border border-gray-200 bg-white p-3 text-gray-600 shadow-lg hover:scale-110 md:flex"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default FashionSection
