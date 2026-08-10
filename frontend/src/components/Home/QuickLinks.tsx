import { motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import {
  Apple,
  Baby,
  Camera,
  Car,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Dumbbell,
  Footprints,
  Gamepad2,
  Gem,
  Headphones,
  Laptop,
  Monitor,
  PawPrint,
  Phone,
  Shirt,
  ShoppingBag,
  Sofa,
  Sparkles,
  Stethoscope,
  UtensilsCrossed,
  Wallet,
} from 'lucide-react'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCategories } from '../../api/categories'
import type { Category } from '../../types/category'
import SectionHeading from '../ui/SectionHeading'

type IconMapping = {
  keywords: string[]
  icon: LucideIcon
}

const iconMappings: IconMapping[] = [
  {
    keywords: ['bag', 'handbag', 'crossbody', 'backpack', 'tote', 'sling', 'luggage', 'briefcase'],
    icon: ShoppingBag,
  },
  { keywords: ['wallet', 'card holder'], icon: Wallet },
  { keywords: ['heel', 'shoe', 'footwear', 'sandal', 'sneaker', 'boot'], icon: Footprints },
  { keywords: ['saree', 'kurta', 'ethnic', 'lehenga'], icon: Shirt },
  {
    keywords: ['dress', 'fashion', 'apparel', 'clothing', 'wear', 'jean', 'women', 'men'],
    icon: Shirt,
  },
  { keywords: ['jewel', 'accessor', 'watch', 'ring', 'bracelet'], icon: Gem },
  {
    keywords: ['beauty', 'cosmetic', 'makeup', 'skincare', 'fragrance', 'grooming', 'salon'],
    icon: Sparkles,
  },
  { keywords: ['phone', 'mobile', 'smartphone', 'cell', 'oppo', 'android', 'iphone'], icon: Phone },
  { keywords: ['laptop', 'computer', 'pc', 'notebook'], icon: Laptop },
  { keywords: ['tablet', 'monitor', 'screen', 'display'], icon: Monitor },
  { keywords: ['electronic', 'gadget', 'tech', 'device'], icon: Cpu },
  { keywords: ['audio', 'headphone', 'earbud', 'music'], icon: Headphones },
  { keywords: ['camera', 'dslr', 'photograph', 'lens'], icon: Camera },
  { keywords: ['gaming', 'console', 'game', 'playstation', 'xbox'], icon: Gamepad2 },
  { keywords: ['baby', 'infant', 'toddler', 'kids'], icon: Baby },
  {
    keywords: ['health', 'wellness', 'medical', 'pharma', 'care', 'homeopathic'],
    icon: Stethoscope,
  },
  { keywords: ['fitness', 'sport', 'gym', 'workout'], icon: Dumbbell },
  { keywords: ['home', 'furniture', 'decor', 'living', 'sofa'], icon: Sofa },
  {
    keywords: ['kitchen', 'cook', 'cookware', 'dining', 'utensil', 'appliance'],
    icon: UtensilsCrossed,
  },
  { keywords: ['grocery', 'food', 'beverage', 'organic', 'fruit', 'vegetable'], icon: Apple },
  { keywords: ['auto', 'car', 'vehicle', 'bike', 'automobile'], icon: Car },
  { keywords: ['pet', 'animal', 'dog', 'cat', 'petcare'], icon: PawPrint },
]

// Simplified color palette - more professional and subtle
const iconColors = [
  { bg: 'bg-blue-50', text: 'text-blue-600' },
  { bg: 'bg-purple-50', text: 'text-purple-600' },
  { bg: 'bg-pink-50', text: 'text-pink-600' },
  { bg: 'bg-indigo-50', text: 'text-indigo-600' },
  { bg: 'bg-cyan-50', text: 'text-cyan-600' },
  { bg: 'bg-emerald-50', text: 'text-emerald-600' },
  { bg: 'bg-amber-50', text: 'text-amber-600' },
  { bg: 'bg-rose-50', text: 'text-rose-600' },
]

// Icon mapping for categories
const getCategoryIcon = (categoryName: string): LucideIcon => {
  const name = categoryName.toLowerCase()

  for (const mapping of iconMappings) {
    if (mapping.keywords.some((keyword) => name.includes(keyword))) {
      return mapping.icon
    }
  }

  return ShoppingBag
}

const QuickLinks: React.FC = () => {
  const navigate = useNavigate()
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  // Fetch all active categories with subcategories
  const { data, isLoading } = useCategories({ status: 'active', includeSubcategories: true })

  // Flatten all categories including subcategories
  const flatCategories: Category[] = []
  const seenIds = new Set<string>()

  if (data?.categories) {
    data.categories.forEach((category) => {
      if (category._id && !seenIds.has(category._id)) {
        seenIds.add(category._id)
        flatCategories.push(category)
      }

      if (category.subcategories && category.subcategories.length > 0) {
        category.subcategories.forEach((subcat) => {
          if (subcat._id && !seenIds.has(subcat._id)) {
            seenIds.add(subcat._id)
            flatCategories.push(subcat)
          }
        })
      }
    })
  }

  // Show all available categories (deduplicated above)
  const displayedCategories = flatCategories

  const handleCategoryClick = (category: { _id?: string; slug: string }) => {
    navigate(`/products/search?categoryId=${category._id || category.slug}&sort=relevance`)
  }

  const updateScrollButtons = useCallback(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const { scrollLeft, scrollWidth, clientWidth } = container
    setCanScrollLeft(scrollLeft > 0)
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 1)
  }, [])

  const scrollByAmount = (direction: 'left' | 'right') => {
    const container = scrollContainerRef.current
    if (!container) return

    const scrollAmount = container.clientWidth * 0.8
    container.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    })
  }

  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    updateScrollButtons()

    const handleScroll = () => updateScrollButtons()
    container.addEventListener('scroll', handleScroll)
    window.addEventListener('resize', updateScrollButtons)

    return () => {
      container.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', updateScrollButtons)
    }
  }, [displayedCategories.length, updateScrollButtons])

  if (isLoading) {
    return (
      <div className="py-12 my-4 bg-white">
        <div className=" mx-auto px-4 md:px-8">
          <SectionHeading
            title="Shop by"
            italicPart="Category"
            subtitle="Browse our product categories"
          />
          <div className="flex gap-4 overflow-hidden mt-8">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="h-32 w-24 animate-pulse bg-gray-100 rounded-xl shrink-0" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (displayedCategories.length === 0) {
    return null
  }

  return (
    <div className="py-12 my-4 bg-white">
      <div className=" mx-auto px-4 md:px-8">
        <SectionHeading
          title="Shop by"
          italicPart="Category"
          subtitle="Browse our product categories"
        />

        <div className="relative mt-8">
          <div
            ref={scrollContainerRef}
            className="flex gap-4 overflow-x-auto overflow-y-hidden scrollbar-hide scroll-smooth pb-4"
            style={{
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            }}
          >
            {displayedCategories.map((category, index) => {
              const Icon = getCategoryIcon(category.name)
              const color = iconColors[index % iconColors.length]

              return (
                <motion.div
                  key={category._id || category.slug || category.name}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.02 }}
                  onClick={() => handleCategoryClick(category)}
                  className="group shrink-0 cursor-pointer w-28 sm:w-32"
                >
                  {/* Category Card */}
                  <div className="w-full h-36 bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-300 group-hover:-translate-y-1 p-4 flex flex-col items-center justify-between">
                    {/* Icon */}
                    <div
                      className={`w-14 h-14 ${color.bg} rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110 shrink-0`}
                    >
                      <Icon className={`h-7 w-7 ${color.text}`} strokeWidth={1.5} />
                    </div>

                    {/* Category Name */}
                    <div className="w-full text-center min-h-[2.5rem] flex items-center justify-center">
                      <span className="text-xs sm:text-sm font-medium text-gray-900 line-clamp-2 leading-tight">
                        {category.name}
                      </span>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>

          {/* Navigation Buttons */}
          <button
            type="button"
            aria-label="Scroll categories left"
            onClick={() => scrollByAmount('left')}
            className={`absolute -left-3 top-1/2 -translate-y-1/2 z-20 h-10 w-10 rounded-full bg-white shadow-lg border-2 border-gray-200 hover:bg-gray-50 hover:border-gray-300 hover:shadow-xl transition-all duration-300 flex items-center justify-center ${
              !canScrollLeft ? 'opacity-0 pointer-events-none' : ''
            }`}
          >
            <ChevronLeft className="h-5 w-5 text-yellow" />
          </button>

          <button
            type="button"
            aria-label="Scroll categories right"
            onClick={() => scrollByAmount('right')}
            className={`absolute -right-3 top-1/2 -translate-y-1/2 z-20 h-10 w-10 rounded-full bg-white shadow-lg border-2 border-gray-200 hover:bg-gray-50 hover:border-gray-300 hover:shadow-xl transition-all duration-300 flex items-center justify-center ${
              !canScrollRight ? 'opacity-0 pointer-events-none' : ''
            }`}
          >
            <ChevronRight className="h-5 w-5 text-yellow" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default QuickLinks
