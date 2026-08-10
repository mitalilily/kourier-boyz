import { useEffect } from 'react'
import { useCategories } from '../../api/categories'

const StructuredData = () => {
  const {
    data: categoriesData,
    isLoading,
    isError,
  } = useCategories({
    status: 'active',
    includeSubcategories: true,
  })

  useEffect(() => {
    // Skip if still loading, has error, or no data
    if (
      isLoading ||
      isError ||
      !categoriesData?.categories ||
      categoriesData.categories.length === 0
    ) {
      return
    }

    // Remove only the dynamic category structured data script (not static ones)
    const existingScripts = document.querySelectorAll('script[data-structured-data="categories"]')
    existingScripts.forEach((script) => script.remove())

    try {
      // Get root categories (categories without parent)
      const rootCategories = categoriesData.categories
        .filter(
          (cat) => cat && (!cat.parent || cat.parent === null) && cat.name && (cat._id || cat.slug),
        )
        .slice(0, 12) // Limit to 12 top categories for SEO

      // Skip if no valid root categories
      if (rootCategories.length === 0) {
        return
      }

      // Generate ItemList schema for categories
      const categoryListSchema = {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: 'Product Categories',
        description: "Shop by categories on Kourier Boyz - India's leading online shopping marketplace",
        itemListElement: rootCategories.map((category, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: category.name,
          description: category.description || `Shop ${category.name} products online`,
          url:
            typeof window !== 'undefined' && window.location
              ? `${window.location.origin}/shop-by-category?category=${
                  category._id || category.slug
                }`
              : `/shop-by-category?category=${category._id || category.slug}`,
        })),
      }

      // Create and inject script
      const script = document.createElement('script')
      script.type = 'application/ld+json'
      script.setAttribute('data-structured-data', 'categories')
      script.textContent = JSON.stringify(categoryListSchema)

      // Only append if document.head exists
      if (document.head) {
        document.head.appendChild(script)
      }
    } catch (error) {
      // Silently fail to prevent breaking the page
      console.error('Error generating structured data:', error)
    }

    // Cleanup function
    return () => {
      try {
        const scripts = document.querySelectorAll('script[data-structured-data="categories"]')
        scripts.forEach((s) => {
          if (s.parentNode) {
            s.parentNode.removeChild(s)
          }
        })
      } catch (error) {
        // Silently fail cleanup
        console.error('Error cleaning up structured data:', error)
      }
    }
  }, [categoriesData, isLoading, isError])

  return null // This component doesn't render anything
}

export default StructuredData
