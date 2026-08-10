import { useCategories } from '@/api/categories'
import CategoriesSidebar from '@/components/categories/CategoriesSidebar'
import SubcategoryCard from '@/components/categories/SubcategoryCard'
import SectionHeading from '@/components/ui/SectionHeading'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { motion } from 'framer-motion'
import { RefreshCcw } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

const Categories = () => {
  const {
    data: categoriesData,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useCategories({
    status: 'active',
    includeSubcategories: true,
  })

  const [searchTerm, setSearchTerm] = useState('')

  const allCategories = useMemo(() => {
    return categoriesData?.categories || []
  }, [categoriesData?.categories])

  // Filter to get only main categories (no parent)
  const mainCategories = useMemo(() => {
    return allCategories.filter((cat) => {
      if (!cat.parent) return true
      if (cat.parent === null) return true
      return false
    })
  }, [allCategories])

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)

  // Set first category as selected by default
  useEffect(() => {
    if (mainCategories.length > 0 && !selectedCategoryId) {
      setSelectedCategoryId(mainCategories[0]._id)
    }
  }, [mainCategories, selectedCategoryId])

  // Get subcategories for selected category
  const selectedCategory = useMemo(() => {
    if (!selectedCategoryId) return null
    return mainCategories.find((cat) => cat._id === selectedCategoryId)
  }, [selectedCategoryId, mainCategories])

  const subcategories = useMemo(() => {
    if (!selectedCategory) return []
    if (!searchTerm.trim()) return selectedCategory.subcategories || []

    const term = searchTerm.trim().toLowerCase()
    return (selectedCategory.subcategories || []).filter((subcategory) => {
      return (
        subcategory.name.toLowerCase().includes(term) ||
        (subcategory.description ?? '').toLowerCase().includes(term)
      )
    })
  }, [selectedCategory, searchTerm])

  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategoryId(categoryId)
    setSearchTerm('')
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6 sm:py-10 lg:py-30">
        <div className="flex flex-col gap-6 sm:gap-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-3">
              <Skeleton className="h-8 w-48 rounded-full" />
              <Skeleton className="h-4 w-72 sm:w-96 rounded-full" />
            </div>
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-64 rounded-xl" />
              <Skeleton className="h-10 w-28 rounded-xl" />
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-5 lg:gap-7">
            <aside className="w-full lg:w-72 xl:w-80">
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <Skeleton key={index} className="h-12 rounded-2xl" />
                ))}
              </div>
            </aside>
            <main className="flex-1 space-y-6">
              <Skeleton className="h-32 rounded-3xl" />
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
                {Array.from({ length: 6 }).map((_, index) => (
                  <Skeleton key={index} className="h-72 rounded-3xl" />
                ))}
              </div>
            </main>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8 sm:py-12">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-4">
            <div>
              <p className="text-lg font-semibold theme-text-primary mb-2">
                Unable to load categories
              </p>
              <p className="text-sm theme-text-secondary">Check your connection and try again.</p>
            </div>
            <Button
              type="button"
              onClick={() => refetch()}
              className="inline-flex items-center gap-2"
              disabled={isFetching}
            >
              <RefreshCcw className="w-4 h-4" />
              Retry
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-6 sm:py-10 lg:py-30">
      <div className="flex flex-col gap-6 sm:gap-3">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div>
            <SectionHeading
              title="Browse Categories"
              italicPart="Categories"
              subtitle="Navigate the entire marketplace by category and discover new sub-collections."
              align="left"
            />
          </div>
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: 'easeOut', delay: 0.05 }}
            className="flex items-center gap-3"
          >
            <Button
              type="button"
              variant="outline"
              className="rounded-xl border-gray-200"
              onClick={() => {
                setSearchTerm('')
                refetch()
              }}
              disabled={isFetching}
            >
              <RefreshCcw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          className="flex flex-col lg:flex-row gap-5 lg:gap-7"
        >
          <motion.aside
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.45, ease: 'easeOut', delay: 0.05 }}
            className="w-full lg:w-72 xl:w-80"
          >
            <div className="sticky top-24">
              <CategoriesSidebar
                categories={mainCategories}
                selectedCategoryId={selectedCategoryId}
                onCategorySelect={handleCategorySelect}
              />
            </div>
          </motion.aside>

          <motion.main
            key={selectedCategoryId || 'none'}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: 'easeOut', delay: 0.1 }}
            className="flex-1 min-w-0 space-y-5"
          >
            {selectedCategory ? (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                className="space-y-6"
              >
                {subcategories.length > 0 ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.35, ease: 'easeOut', delay: 0.1 }}
                    className="grid grid-cols-1 sm:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6"
                  >
                    {subcategories.map((subcategory) => (
                      <SubcategoryCard key={subcategory._id} category={subcategory} />
                    ))}
                  </motion.div>
                ) : (
                  <div className="rounded-3xl border border-dashed border-gray-200 bg-gray-50/80 py-16 text-center space-y-2">
                    <p className="text-lg font-semibold theme-text-primary">
                      No matches in this category
                    </p>
                    <p className="text-sm theme-text-secondary">
                      Try adjusting your search or explore another category.
                    </p>
                  </div>
                )}
              </motion.div>
            ) : (
              <div className="rounded-3xl border border-gray-100 bg-white/90 shadow-sm px-6 py-16 text-center space-y-2">
                <p className="text-lg font-semibold theme-text-primary">
                  Select a category to get started
                </p>
                <p className="text-sm theme-text-secondary">
                  Choose a main category from the left to explore collections and subcategories.
                </p>
              </div>
            )}
          </motion.main>
        </motion.div>
      </div>
    </div>
  )
}

export default Categories
