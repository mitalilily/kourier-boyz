import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, ChevronRight, Grid3x3, Search } from 'lucide-react'
import { memo, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import type { Category } from '../../types/category'
import { Card } from '../ui/card'
import { ScrollArea } from '../ui/scroll-area'

const FALLBACK_IMAGE = '/logo.png'

interface CategoriesPopoverProps {
  categories: Category[]
  hoveredCategory: string | null
  onCategoryHover: (categoryId: string | null) => void
}

// Animation variants for smooth transitions
const containerVariants = {
  hidden: { opacity: 0, y: -10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.2,
      ease: [0.4, 0, 0.2, 1] as const,
      staggerChildren: 0.03,
    },
  },
  exit: {
    opacity: 0,
    y: -10,
    transition: { duration: 0.15 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, x: -10 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.2, ease: [0.4, 0, 0.2, 1] as const },
  },
}

const contentVariants = {
  hidden: { opacity: 0, x: 10 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.25, ease: [0.4, 0, 0.2, 1] as const },
  },
  exit: {
    opacity: 0,
    x: 10,
    transition: { duration: 0.2 },
  },
}

// Utility function to get category URL
const getCategoryUrl = (category: Category): string => {
  return `/products/search?sort=relevance&categoryId=${category._id}`
}

// Utility function to check if category has subcategories
const hasSubcategories = (category: Category): boolean => {
  return Boolean(category.subcategories && category.subcategories.length > 0)
}

// Utility function to get category image URL
const getCategoryImageUrl = (category: Category): string => {
  if (category.mainImage && category.mainImage !== 'default') {
    return category.mainImage
  }
  return FALLBACK_IMAGE
}

// Category Image Component with hover support
interface CategoryImageProps {
  category: Category
  size?: 'sm' | 'md' | 'lg'
  className?: string
  showHover?: boolean
}

const CategoryImage = memo(
  ({ category, size = 'md', className = '', showHover = false }: CategoryImageProps) => {
    const [imageError, setImageError] = useState(false)
    const [hoverImageError, setHoverImageError] = useState(false)
    const [isHovering, setIsHovering] = useState(false)

    const sizeClasses = {
      sm: 'w-10 h-10',
      md: 'w-12 h-12',
      lg: 'w-20 h-20',
    }

    // Reset error states when category changes
    useEffect(() => {
      setImageError(false)
      setHoverImageError(false)
      setIsHovering(false)
    }, [category._id, category.mainImage])

    const imageUrl = imageError ? FALLBACK_IMAGE : getCategoryImageUrl(category)
    const hoverImageUrl =
      category.hoverImage && category.hoverImage !== 'default' && !hoverImageError
        ? category.hoverImage
        : null

    const handleImageError = () => {
      // Only set error if we're not already using fallback
      if (!imageError && imageUrl !== FALLBACK_IMAGE) {
        setImageError(true)
      }
    }

    const handleHoverImageError = () => {
      setHoverImageError(true)
    }

    return (
      <div
        className={`relative ${sizeClasses[size]} flex-shrink-0 rounded-lg overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200/60 shadow-sm ${className}`}
        onMouseEnter={() => showHover && setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        <img
          key={`${category._id}-main-${category.mainImage}`}
          src={imageUrl}
          alt={category.name}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
            isHovering && hoverImageUrl ? 'opacity-0' : 'opacity-100'
          }`}
          loading="lazy"
          decoding="async"
          onError={handleImageError}
        />
        {hoverImageUrl && (
          <img
            key={`${category._id}-hover-${category.hoverImage}`}
            src={hoverImageUrl}
            alt={`${category.name} hover`}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
              isHovering ? 'opacity-100' : 'opacity-0'
            }`}
            loading="lazy"
            decoding="async"
            onError={handleHoverImageError}
          />
        )}
      </div>
    )
  },
  (prevProps, nextProps) => {
    // Custom comparison function for memo
    return (
      prevProps.category._id === nextProps.category._id &&
      prevProps.category.mainImage === nextProps.category.mainImage &&
      prevProps.category.hoverImage === nextProps.category.hoverImage &&
      prevProps.size === nextProps.size &&
      prevProps.className === nextProps.className &&
      prevProps.showHover === nextProps.showHover
    )
  },
)

CategoryImage.displayName = 'CategoryImage'

// Category Item Component (DRY principle)
interface CategoryItemProps {
  category: Category
  isHovered: boolean
  onMouseEnter: () => void
}

const CategoryItem = memo(({ category, isHovered, onMouseEnter }: CategoryItemProps) => {
  const hasSubs = hasSubcategories(category)
  const subCount = category.subcategories?.length || 0

  return (
    <motion.button
      type="button"
      variants={itemVariants}
      onMouseEnter={onMouseEnter}
      className={`group relative w-full text-left transition-all duration-200 ${
        isHovered
          ? 'bg-gradient-to-r from-blue-50 to-indigo-50 text-gray-900 shadow-sm'
          : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50/80'
      }`}
    >
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <CategoryImage
            category={category}
            size="sm"
            showHover={true}
            className={`transition-all duration-200 ${
              isHovered ? 'ring-2 ring-blue-500 ring-offset-1 scale-105' : 'group-hover:scale-105'
            }`}
          />
          <span className="text-sm font-medium truncate">{category.name}</span>
        </div>
        {hasSubs && (
          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
            <span
              className={`text-xs px-2 py-0.5 rounded-full transition-colors duration-200 ${
                isHovered
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600 group-hover:bg-gray-200'
              }`}
            >
              {subCount}
            </span>
            <ChevronRight
              className={`w-4 h-4 transition-transform duration-200 ${
                isHovered ? 'text-blue-600 translate-x-0.5' : 'text-gray-400'
              }`}
            />
          </div>
        )}
      </div>
      {isHovered && (
        <motion.div
          layoutId="activeIndicator"
          className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-500 to-indigo-600 rounded-r-full"
          initial={false}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        />
      )}
    </motion.button>
  )
})

CategoryItem.displayName = 'CategoryItem'

// Subcategory Item Component
interface SubcategoryItemProps {
  subcategory: Category
  level?: number
}

const SubcategoryItem = memo(({ subcategory, level = 0 }: SubcategoryItemProps) => {
  const hasNested = hasSubcategories(subcategory)
  const nestedCount = subcategory.subcategories?.length || 0

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, delay: level * 0.03 }}
    >
      <Link
        to={getCategoryUrl(subcategory)}
        className="group flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 hover:shadow-sm border border-transparent hover:border-blue-100"
      >
        <CategoryImage
          category={subcategory}
          size="sm"
          showHover={true}
          className="group-hover:ring-2 group-hover:ring-blue-400 group-hover:ring-offset-1 group-hover:scale-105 transition-all duration-200"
        />
        <span className="flex-1 text-sm font-medium text-gray-700 group-hover:text-gray-900">
          {subcategory.name}
        </span>
        {hasNested && (
          <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full group-hover:bg-blue-100 group-hover:text-blue-700 transition-colors duration-200">
            {nestedCount}
          </span>
        )}
        <ArrowRight className="w-3 h-3 text-gray-400 group-hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-all duration-200 transform group-hover:translate-x-0.5" />
      </Link>
      {hasNested && (
        <div className="pl-7 mt-1 space-y-1">
          {subcategory.subcategories?.map((nested) => (
            <SubcategoryItem key={nested._id} subcategory={nested} level={level + 1} />
          ))}
        </div>
      )}
    </motion.div>
  )
})

SubcategoryItem.displayName = 'SubcategoryItem'

// Main Categories Popover Content Component
export const CategoriesPopoverContent = memo(
  ({ categories, hoveredCategory, onCategoryHover }: CategoriesPopoverProps) => {
    const { t } = useTranslation()

    const selectedCategory = useMemo(() => {
      if (!hoveredCategory) return null
      return categories.find((cat) => cat._id === hoveredCategory) || null
    }, [categories, hoveredCategory])

    const hasSubs = selectedCategory ? hasSubcategories(selectedCategory) : false
    const subcategories = selectedCategory?.subcategories || []

    return (
      <Card
        className="w-[800px] max-w-[90vw] shadow-2xl border-0 overflow-hidden"
        style={{
          background: 'rgba(255, 255, 255, 0.98)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          boxShadow:
            '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05), 0 0 40px rgba(59, 130, 246, 0.1)',
        }}
      >
        <div className="flex h-[500px]">
          {/* Left Sidebar - Categories List */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="w-64 border-r border-gray-200/60 bg-gradient-to-b from-gray-50/30 to-white overflow-hidden flex flex-col"
          >
            <div className="sticky top-0 bg-white/95 backdrop-blur-sm border-b border-gray-200/60 px-4 py-3.5 z-10">
              <div className="flex items-center gap-2">
                <Grid3x3 className="w-4 h-4 text-gray-500" />
                <h3 className="text-xs font-bold text-gray-600 uppercase tracking-wider">
                  {t('navigation.categories')}
                </h3>
              </div>
            </div>
            <ScrollArea className="flex-1">
              <div className="py-2">
                {categories.length > 0 ? (
                  categories.map((category) => (
                    <CategoryItem
                      key={category._id}
                      category={category}
                      isHovered={hoveredCategory === category._id}
                      onMouseEnter={() => onCategoryHover(category._id)}
                    />
                  ))
                ) : (
                  <div className="px-4 py-8 text-center text-sm text-gray-500">
                    No categories available
                  </div>
                )}
              </div>
            </ScrollArea>
          </motion.div>

          {/* Right Content Area - Subcategories */}
          <div className="flex-1 bg-white overflow-hidden relative">
            <AnimatePresence mode="wait">
              {selectedCategory && hasSubs ? (
                <motion.div
                  key={selectedCategory._id}
                  variants={contentVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="h-full"
                >
                  <ScrollArea className="h-full">
                    <div className="p-6 pr-4">
                      {/* Category Header */}
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2 }}
                        className="mb-6 pb-4 border-b border-gray-200/60"
                      >
                        <div className="flex items-center gap-4 mb-2">
                          <CategoryImage
                            category={selectedCategory}
                            size="lg"
                            showHover={true}
                            className="ring-2 ring-blue-200 ring-offset-2"
                          />
                          <div>
                            <h3 className="text-lg font-bold text-gray-900">
                              {selectedCategory.name}
                            </h3>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {t('navigation.subcategoryCount', {
                                count: subcategories.length,
                              })}
                            </p>
                          </div>
                        </div>
                      </motion.div>

                      {/* View All Button */}
                      <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: 0.1 }}
                        className="mb-4"
                      >
                        <Link
                          to={getCategoryUrl(selectedCategory)}
                          className="group flex items-center justify-between gap-3 px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 border border-blue-200 hover:border-blue-300 rounded-xl transition-all duration-200 hover:shadow-md"
                        >
                          <span className="text-sm font-semibold text-gray-900">
                            {t('navigation.viewAllCategory', {
                              category: selectedCategory.name,
                            })}
                          </span>
                          <ArrowRight className="w-4 h-4 text-blue-600 transform group-hover:translate-x-1 transition-transform duration-200" />
                        </Link>
                      </motion.div>

                      {/* Subcategories Grid */}
                      <div className="space-y-2">
                        {subcategories.map((subcat) => (
                          <SubcategoryItem key={subcat._id} subcategory={subcat} />
                        ))}
                      </div>
                    </div>
                  </ScrollArea>
                </motion.div>
              ) : selectedCategory && !hasSubs ? (
                <motion.div
                  key={`empty-${selectedCategory._id}`}
                  variants={contentVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="h-full flex items-center justify-center p-6"
                >
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.2 }}
                    className="text-center"
                  >
                    <div className="flex justify-center mb-4">
                      <CategoryImage
                        category={selectedCategory}
                        size="lg"
                        showHover={true}
                        className="ring-2 ring-blue-200 ring-offset-4"
                      />
                    </div>
                    <p className="text-sm font-medium text-gray-600 mb-1">
                      {t('navigation.noSubcategories')}
                    </p>
                    <Link
                      to={getCategoryUrl(selectedCategory)}
                      className="inline-flex items-center gap-2 mt-3 px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors duration-200"
                    >
                      View {selectedCategory.name}
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </motion.div>
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  variants={contentVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="h-full flex items-center justify-center p-6"
                >
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.2 }}
                    className="text-center"
                  >
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 mb-4">
                      <Search className="w-8 h-8 text-blue-600" />
                    </div>
                    <p className="text-sm font-medium text-gray-600 mb-1">
                      {t('navigation.hoverCategory')}
                    </p>
                    <p className="text-xs text-gray-400">{t('navigation.toViewSubcategories')}</p>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200/60 bg-gradient-to-r from-gray-50/50 to-white p-4">
          <Link
            to="/shop-by-category"
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-white hover:bg-gray-50 border border-gray-200 hover:border-gray-300 rounded-lg transition-all duration-200 hover:shadow-sm group"
          >
            <span className="text-sm font-semibold text-gray-900">
              {t('navigation.shopByCategories')}
            </span>
            <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transform group-hover:translate-x-0.5 transition-all duration-200" />
          </Link>
        </div>
      </Card>
    )
  },
)

CategoriesPopoverContent.displayName = 'CategoriesPopoverContent'
