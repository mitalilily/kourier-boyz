import { useCategories } from '@/api/categories'
import { Card, CardContent } from '@/components/ui/card'
import { useIsMobile } from '@/hooks/useIsMobile'
import { cn } from '@/lib/utils'
import type { Category } from '@/types/category'
import { ChevronDown, ChevronRight, Menu } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router-dom'

const CategoriesNav = () => {
  const navigate = useNavigate()
  const { data: categoriesData, isLoading } = useCategories({
    status: 'active',
    includeSubcategories: true,
  })
  const isMobile = useIsMobile()
  const allCategories = categoriesData?.categories || []
  const navTopOffset = 'calc(104px + var(--banner-height, 0px))'

  // Filter to only show parent categories
  const categories = allCategories.filter((cat) => {
    if (!cat.parent) return true
    if (cat.parent === null) return true
    return false
  })

  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null)
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [visibleCount, setVisibleCount] = useState(10)
  const [dropdownPosition, setDropdownPosition] = useState<{ left: number; top: number } | null>(
    null,
  )
  const navRef = useRef<HTMLDivElement>(null)
  const categoryRefs = useRef<{ [key: string]: HTMLDivElement | null }>({})
  const dropdownRefs = useRef<{ [key: string]: HTMLDivElement | null }>({})

  // Calculate visible categories based on screen size
  useEffect(() => {
    const calculateVisibleCount = () => {
      if (isMobile) {
        setVisibleCount(5)
      } else if (window.innerWidth < 1024) {
        setVisibleCount(7)
      } else {
        setVisibleCount(10)
      }
    }

    calculateVisibleCount()
    window.addEventListener('resize', calculateVisibleCount)
    return () => window.removeEventListener('resize', calculateVisibleCount)
  }, [isMobile])

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setHoveredCategory(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Calculate dropdown position based on category link position
  useEffect(() => {
    if (hoveredCategory && categoryRefs.current[hoveredCategory]) {
      const categoryElement = categoryRefs.current[hoveredCategory]
      if (categoryElement) {
        const rect = categoryElement.getBoundingClientRect()
        const navRect = navRef.current?.getBoundingClientRect()
        const navBottom = navRect ? navRect.bottom : rect.bottom

        // Position dropdown to align with the left edge of the category link
        setDropdownPosition({
          left: rect.left, // Left edge of the category link
          top: navBottom, // Right at the bottom of the nav bar, no gap
        })
      }
    } else {
      setDropdownPosition(null)
    }
  }, [hoveredCategory])

  const visibleCategories = categories.slice(0, visibleCount)
  const moreCategories = categories.slice(visibleCount)

  // Recursive component to render nested subcategories
  const renderSubcategories = (subcats: Category[], level = 0, isMobile = false) => {
    if (!subcats || subcats.length === 0) return null

    return subcats.map((subcat) => (
      <div key={subcat._id} className={cn(level > 0 && !isMobile && 'pl-4')}>
        <div
          className={cn(
            'block transition-all duration-200 cursor-pointer',
            isMobile
              ? 'px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 hover:text-purple-600 rounded-lg'
              : level === 0
              ? 'text-sm font-semibold text-gray-900 mb-3 hover:text-purple-600 py-1'
              : 'text-xs text-gray-600 hover:text-gray-900 py-1.5',
          )}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            navigate(`/products/search?categoryId=${subcat._id || subcat.slug}&sort=relevance`)
            if (isMobile) {
              setExpandedCategory(null)
            } else {
              setHoveredCategory(null)
            }
          }}
        >
          <div className="flex items-center justify-between">
            <span>{subcat.name}</span>
            {isMobile && subcat.subcategories && subcat.subcategories.length > 0 && (
              <ChevronRight className="w-4 h-4 text-gray-400" />
            )}
          </div>
        </div>
        {/* Recursively render nested subcategories */}
        {subcat.subcategories && subcat.subcategories.length > 0 && (
          <div
            className={cn(
              'space-y-1',
              isMobile ? 'ml-4 mt-1' : 'pl-2',
              isMobile && expandedCategory !== subcat._id && 'hidden',
            )}
          >
            {renderSubcategories(subcat.subcategories, level + 1, isMobile)}
          </div>
        )}
      </div>
    ))
  }

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (showMobileMenu) {
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = ''
      }
    }
  }, [showMobileMenu])

  // Mobile menu component
  const MobileMenu = () => {
    if (!showMobileMenu) return null

    return (
      <div className="fixed inset-0 z-60 md:hidden">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300"
          onClick={() => setShowMobileMenu(false)}
          aria-hidden="true"
        />

        {/* Menu Panel */}
        <div className="fixed left-0 top-0 h-full w-[85vw] max-w-sm bg-white shadow-2xl overflow-y-auto transform transition-transform duration-300 ease-out">
          <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-4 flex items-center justify-between z-10 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Categories</h2>
            <button
              onClick={() => setShowMobileMenu(false)}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="Close menu"
            >
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          <div className="p-4 space-y-1">
            {categories.map((category) => {
              const hasSubcategories = category.subcategories && category.subcategories.length > 0
              const isExpanded = expandedCategory === category._id

              return (
                <div
                  key={category._id}
                  className="border-b border-gray-100 last:border-b-0 pb-2 last:pb-0"
                >
                  <div className="flex items-center justify-between">
                    <Link
                      to={`/products/search?categoryId=${
                        category._id || category.slug
                      }&sort=relevance`}
                      className="flex-1 px-4 py-3 text-base font-medium text-gray-900 hover:text-purple-600 transition-colors rounded-lg hover:bg-gray-50 active:bg-gray-100"
                      onClick={() => !hasSubcategories && setShowMobileMenu(false)}
                    >
                      {category.name}
                    </Link>
                    {hasSubcategories && (
                      <button
                        onClick={() => setExpandedCategory(isExpanded ? null : category._id)}
                        className="p-2 rounded-lg hover:bg-gray-100 active:bg-gray-200 transition-colors"
                        aria-label={isExpanded ? 'Collapse' : 'Expand'}
                        aria-expanded={isExpanded}
                      >
                        <ChevronDown
                          className={cn(
                            'w-5 h-5 text-gray-600 transition-transform duration-200',
                            isExpanded && 'rotate-180',
                          )}
                        />
                      </button>
                    )}
                  </div>
                  {hasSubcategories && isExpanded && (
                    <div className="mt-2 pl-4 space-y-1 overflow-hidden transition-all duration-200">
                      {renderSubcategories(category.subcategories || [], 0, true)}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // Desktop dropdown component - rendered as portal to avoid overflow clipping
  const DesktopDropdown = ({ category }: { category: Category }) => {
    if (!category.subcategories || category.subcategories.length === 0) return null

    const isHovered = hoveredCategory === category._id

    if (!isHovered || !dropdownPosition) return null

    const dropdownContent = (
      <div
        ref={(el) => {
          dropdownRefs.current[category._id] = el
        }}
        className="fixed z-100"
        style={{
          left: `${dropdownPosition.left}px`,
          top: `${dropdownPosition.top}px`,
        }}
        onMouseEnter={() => setHoveredCategory(category._id)}
        onMouseLeave={(e) => {
          // Don't close if moving to a child element (like a link)
          const relatedTarget = e.relatedTarget as HTMLElement
          const dropdown = dropdownRefs.current[category._id]
          if (dropdown && dropdown.contains(relatedTarget)) {
            return
          }

          // Longer delay to allow clicking on links
          setTimeout(() => {
            if (dropdown && !dropdown.matches(':hover')) {
              const categoryElement = categoryRefs.current[category._id]
              if (!categoryElement?.matches(':hover')) {
                setHoveredCategory(null)
              }
            }
          }, 300)
        }}
        data-dropdown={category._id}
      >
        {/* Invisible bridge to maintain hover between nav and dropdown */}
        <div className="absolute -top-1 left-0 right-0 h-1 pointer-events-none" />
        <Card className="w-[700px] max-w-[90vw] shadow-2xl border border-gray-200 overflow-hidden bg-white">
          <CardContent className="p-6">
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
              {category.subcategories.map((subcat) => (
                <div key={subcat._id} className="space-y-2">
                  <div
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      navigate(
                        `/products/search?categoryId=${subcat._id || subcat.slug}&sort=relevance`,
                      )
                      setHoveredCategory(null)
                    }}
                    className="block text-sm font-semibold text-gray-900 hover:text-purple-600 transition-colors mb-2 cursor-pointer relative z-10"
                  >
                    {subcat.name}
                  </div>
                  {subcat.subcategories && subcat.subcategories.length > 0 && (
                    <div className="space-y-1">
                      {renderSubcategories(subcat.subcategories, 1, false)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )

    // Render as portal to body to avoid overflow clipping
    return typeof document !== 'undefined' ? createPortal(dropdownContent, document.body) : null
  }

  if (isLoading) {
    return (
      <nav
        className="fixed left-0 right-0 z-40 border-b border-gray-200 bg-white shadow-sm"
        style={{ top: navTopOffset }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center h-14">
            <div className="flex space-x-2">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="h-4 w-20 bg-gray-200 rounded animate-pulse"
                  style={{ animationDelay: `${i * 0.1}s` }}
                />
              ))}
            </div>
          </div>
        </div>
      </nav>
    )
  }

  if (categories.length === 0) {
    return null
  }

  return (
    <>
      <nav
        ref={navRef}
        className="fixed left-0 right-0 z-40 border-b border-gray-200/80 bg-white shadow-sm backdrop-blur-sm"
        style={{ top: navTopOffset }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Mobile: Menu Button */}
          {isMobile ? (
            <div className="flex items-center h-14">
              <button
                onClick={() => setShowMobileMenu(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors"
                aria-label="Open categories menu"
              >
                <Menu className="w-5 h-5" />
                <span>Categories</span>
              </button>

              {/* Horizontal scroll for top categories */}
              <div className="flex-1 overflow-x-auto scrollbar-hide ml-4">
                <div className="flex items-center gap-2 h-14">
                  {visibleCategories.map((category) => (
                    <Link
                      key={category._id}
                      to={`/products/search?categoryId=${
                        category._id || category.slug
                      }&sort=relevance`}
                      className="shrink-0 px-3 py-2 text-sm font-medium text-gray-700 hover:text-purple-600 whitespace-nowrap transition-colors rounded-lg hover:bg-gray-50"
                    >
                      {category.name}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Desktop: Full Navigation */
            <div className="flex items-center h-14 relative overflow-visible">
              <div className="flex items-center flex-1 overflow-x-auto scrollbar-hide overflow-y-visible">
                {visibleCategories.map((category, index) => {
                  const hasSubcategories =
                    category.subcategories && category.subcategories.length > 0
                  const isHovered = hoveredCategory === category._id

                  return (
                    <div
                      key={category._id}
                      ref={(el) => {
                        categoryRefs.current[category._id] = el
                      }}
                      className="relative flex items-center"
                      onMouseEnter={() => {
                        if (hasSubcategories) {
                          setHoveredCategory(category._id)
                        }
                      }}
                      onMouseLeave={(e) => {
                        // Check if we're moving to the dropdown
                        const relatedTarget = e.relatedTarget as HTMLElement
                        const dropdown = dropdownRefs.current[category._id]

                        // If moving to dropdown, keep it open
                        if (
                          dropdown &&
                          (dropdown === relatedTarget || dropdown.contains(relatedTarget))
                        ) {
                          return
                        }

                        // Small delay to allow moving to dropdown
                        setTimeout(() => {
                          const isOverDropdown = dropdown?.matches(':hover')
                          const isOverCategory =
                            categoryRefs.current[category._id]?.matches(':hover')

                          if (!isOverDropdown && !isOverCategory) {
                            setHoveredCategory(null)
                          }
                        }, 150)
                      }}
                    >
                      <div className="relative">
                        <Link
                          to={`/products/search?categoryId=${
                            category._id || category.slug
                          }&sort=relevance`}
                          className={cn(
                            'flex items-center gap-1.5 px-4 py-3 text-sm font-medium transition-all duration-200 relative',
                            'text-gray-700 hover:text-purple-600',
                            isHovered && 'text-purple-600',
                          )}
                        >
                          <span>{category.name}</span>
                          {hasSubcategories && (
                            <ChevronDown
                              className={cn(
                                'w-4 h-4 transition-transform duration-200',
                                isHovered && 'rotate-180',
                              )}
                            />
                          )}
                          {isHovered && (
                            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600 transition-all duration-300" />
                          )}
                        </Link>
                      </div>

                      {/* Divider */}
                      {index < visibleCategories.length - 1 && (
                        <div className="h-6 w-px bg-gray-200 mx-1" />
                      )}
                    </div>
                  )
                })}

                {/* Render dropdowns outside the overflow container */}
                {visibleCategories.map((category) => {
                  if (category.subcategories && category.subcategories.length > 0) {
                    return <DesktopDropdown key={`dropdown-${category._id}`} category={category} />
                  }
                  return null
                })}

                {/* More Categories Dropdown */}
                {moreCategories.length > 0 && (
                  <>
                    <div className="h-6 w-px bg-gray-200 mx-1" />
                    <div
                      className="relative"
                      onMouseEnter={() => setHoveredCategory('more')}
                      onMouseLeave={() => setHoveredCategory(null)}
                    >
                      <button
                        className={cn(
                          'flex items-center gap-1.5 px-4 py-3 text-sm font-medium transition-all duration-200',
                          'text-gray-700 hover:text-purple-600',
                          hoveredCategory === 'more' && 'text-purple-600',
                        )}
                      >
                        <span>More</span>
                        <ChevronDown
                          className={cn(
                            'w-4 h-4 transition-transform duration-200',
                            hoveredCategory === 'more' && 'rotate-180',
                          )}
                        />
                      </button>

                      {hoveredCategory === 'more' && (
                        <div className="absolute left-0 top-full mt-2 z-50 transition-all duration-200 opacity-100 translate-y-0">
                          <Card className="w-64 shadow-2xl border border-gray-200/80 bg-white/98 backdrop-blur-xl">
                            <CardContent className="p-4">
                              <div className="space-y-1 max-h-96 overflow-y-auto scrollbar-hide">
                                {moreCategories.map((category) => (
                                  <Link
                                    key={category._id}
                                    to={`/products/search?categoryId=${
                                      category._id || category.slug
                                    }&sort=relevance`}
                                    className="block px-3 py-2 text-sm text-gray-700 hover:text-purple-600 hover:bg-gray-50 rounded-lg transition-colors"
                                  >
                                    {category.name}
                                  </Link>
                                ))}
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Mobile Menu */}
      <MobileMenu />
    </>
  )
}

export default CategoriesNav
