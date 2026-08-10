import {
  ChevronDown,
  Menu,
  Search,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { Seller, SellerCategory } from '../../api/seller'
import type { ThemeConfig } from '../../utils/themes'
import { Button } from '../ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import { Input } from '../ui/input'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '../ui/sheet'
import { ShareButton } from '../ui/ShareButton'

interface CategoriesSectionProps {
  categories: SellerCategory[]
  selectedCategory?: string
  theme: ThemeConfig | null
  seller?: Seller
  searchQuery?: string
  onSearchChange?: (query: string) => void
  onSearchSubmit?: (e: React.FormEvent) => void
  onCategoryClick: (categoryId: string) => void
  onClearCategory: () => void
}

export const CategoriesSection = ({
  categories,
  selectedCategory,
  theme,
  seller,
  searchQuery: externalSearchQuery,
  onSearchChange,
  onSearchSubmit,
  onCategoryClick,
  onClearCategory,
}: CategoriesSectionProps) => {
  // Filter out subcategories (they'll be shown in dropdowns)
  const rootCategories = categories.filter((cat) => !cat.parent)
  const [isSticky, setIsSticky] = useState(false)
  const sectionRef = useRef<HTMLDivElement>(null)
  const [internalSearchQuery, setInternalSearchQuery] = useState('')
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  // Use external search query if provided, otherwise use internal state
  const searchQuery = externalSearchQuery !== undefined ? externalSearchQuery : internalSearchQuery
  const handleSearchChange = (value: string) => {
    if (onSearchChange) {
      onSearchChange(value)
    } else {
      setInternalSearchQuery(value)
    }
  }

  // Check if navbar is sticky (scrolled past the header)
  useEffect(() => {
    const handleScroll = () => {
      if (sectionRef.current) {
        const rect = sectionRef.current.getBoundingClientRect()
        // Check if the section is at the top (sticky position)
        setIsSticky(rect.top <= 0)
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll() // Check initial state

    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  if (rootCategories.length === 0 && categories.length === 0) return null

  return (
    <div
      ref={sectionRef}
      className={`sticky top-0 z-50 transition-all duration-300 theme-border ${
        isSticky ? 'bg-white/98' : 'bg-white/95'
      }`}
      style={{
        backdropFilter: 'blur(12px) saturate(180%)',
        WebkitBackdropFilter: 'blur(12px) saturate(180%)',
        borderBottom: `1px solid var(--theme-border, rgba(229, 231, 235, 0.8))`,
        boxShadow: isSticky
          ? '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
          : '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
      }}
    >
      <div className="mx-auto px-2 sm:px-4 py-2 sm:py-3" style={{ maxWidth: '1600px' }}>
        <div className="flex gap-2 sm:gap-4 items-center">
          {/* Mobile Menu Button (hamburger) - Left Aligned */}
          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden p-2 shrink-0 theme-text-primary"
              >
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-[280px] sm:w-[320px] overflow-y-auto theme-bg-surface theme-text-primary"
            >
              <SheetHeader>
                        <SheetTitle className="theme-text-primary">
                          Categories
                        </SheetTitle>
                        <SheetDescription className="theme-text-secondary">
                          Browse products by category
                        </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-1">
                {/* Home Button */}
                <Button
                  variant={!selectedCategory ? 'default' : 'ghost'}
                  onClick={() => {
                    onClearCategory()
                    setIsMobileMenuOpen(false)
                  }}
                  className="w-full justify-start h-auto py-3 px-4 rounded-lg"
                  style={{
                    backgroundColor: !selectedCategory
                      ? theme?.colors.primary || '#2563eb'
                      : 'transparent',
                    color: !selectedCategory ? '#ffffff' : theme?.colors.text || '#111827',
                  }}
                >
                  <span className="font-medium">Home</span>
                </Button>

                {/* Categories List */}
                {rootCategories.map((category) => {
                  const hasSubcategories = category.subcategories && category.subcategories.length > 0
                  const isSelected = selectedCategory === category._id

                  return (
                    <div key={category._id} className="space-y-1">
                      {/* Parent Category */}
                      <Button
                        variant={isSelected ? 'default' : 'ghost'}
                        onClick={() => {
                          onCategoryClick(category._id)
                          setIsMobileMenuOpen(false)
                        }}
                        className={`w-full justify-between h-auto py-3 px-4 rounded-lg ${
                          isSelected ? 'theme-bg-primary text-white' : 'bg-transparent theme-text-primary'
                        }`}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {category.mainImage && (
                            <img
                              src={category.mainImage}
                              alt={category.name}
                              className="w-8 h-8 rounded-full object-cover shrink-0"
                              loading="lazy"
                              decoding="async"
                            />
                          )}
                          <div className="flex-1 min-w-0 text-left">
                            <span className="font-medium block truncate">{category.name}</span>
                            <span
                              className={`text-xs opacity-75 ${
                                isSelected ? 'text-white/80' : 'theme-text-secondary'
                              }`}
                            >
                              ({category.productCount})
                            </span>
                          </div>
                        </div>
                        {hasSubcategories && (
                          <ChevronDown
                            className={`w-4 h-4 shrink-0 transition-transform ${
                              isSelected ? 'text-white' : ''
                            }`}
                            style={{
                              color: isSelected
                                ? '#ffffff'
                                : theme?.colors.textSecondary || '#6b7280',
                            }}
                          />
                        )}
                      </Button>

                      {/* Subcategories */}
                      {hasSubcategories && category.subcategories && (
                        <div className="ml-4 space-y-1 pl-4 border-l-2 theme-border">
                          {category.subcategories.map((subcat) => {
                            const isSubSelected = selectedCategory === subcat._id
                            return (
                              <Button
                                key={subcat._id}
                                variant={isSubSelected ? 'default' : 'ghost'}
                                onClick={() => {
                                  onCategoryClick(subcat._id)
                                  setIsMobileMenuOpen(false)
                                }}
                                className="w-full justify-start h-auto py-2.5 px-3 rounded-lg"
                                style={{
                                  backgroundColor: isSubSelected
                                    ? theme?.colors.primary || '#2563eb'
                                    : 'transparent',
                                  color: isSubSelected
                                    ? '#ffffff'
                                    : theme?.colors.text || '#111827',
                                }}
                              >
                                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                  {subcat.mainImage ? (
                                    <img
                                      src={subcat.mainImage}
                                      alt={subcat.name}
                                      className="w-6 h-6 rounded-full object-cover shrink-0"
                                      loading="lazy"
                                      decoding="async"
                                    />
                                  ) : (
                                    <div
                                      className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center"
                                      style={{
                                        backgroundColor:
                                          theme?.colors.border + '40' ||
                                          'rgba(229, 231, 235, 0.4)',
                                      }}
                                    >
                                      <ChevronDown
                                        className="w-3 h-3 -rotate-90"
                                        style={{
                                          color: theme?.colors.textSecondary || '#6b7280',
                                        }}
                                      />
                                    </div>
                                  )}
                                  <div className="flex-1 min-w-0 text-left">
                                    <span className="text-sm font-medium block truncate">
                                      {subcat.name}
                                    </span>
                                    <span
                                      className="text-xs opacity-75"
                                      style={{
                                        color: isSubSelected
                                          ? 'rgba(255, 255, 255, 0.8)'
                                          : theme?.colors.textSecondary || '#6b7280',
                                      }}
                                    >
                                      ({subcat.productCount})
                                    </span>
                                  </div>
                                </div>
                              </Button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </SheetContent>
          </Sheet>

          {/* Store Logo and Name - Left Aligned (only when sticky) */}
          {isSticky && seller?.storeLogo && (
            <div className="shrink-0 flex items-center gap-2 sm:gap-3 animate-in fade-in slide-in-from-left duration-300">
              <div
                className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 overflow-hidden bg-white shadow-md transition-all duration-300 hover:scale-110 hover:shadow-lg"
                style={{ borderColor: theme?.colors.border || '#e5e7eb' }}
              >
                <img
                  src={seller.storeLogo}
                  alt={seller.businessName || seller.name}
                  className="w-full h-full object-cover"
                  loading="eager"
                  decoding="async"
                  fetchPriority="high"
                />
              </div>
              {(seller.businessName || seller.name) && (
                <span
                  className="font-semibold text-xs sm:text-sm whitespace-nowrap transition-colors duration-200 hidden sm:inline"
                  style={{ color: theme?.colors.text || '#111827' }}
                >
                  {seller.businessName || seller.name}
                </span>
              )}
            </div>
          )}

          {/* Categories - Centered (Desktop only) */}
          <div className="flex-1 hidden md:flex gap-1 sm:gap-2 md:ml-0 lg:ml-60 justify-center items-center overflow-x-auto scrollbar-hide pb-1">
            <div className="flex gap-1 sm:gap-2 items-center">
                      <Button
                        variant={!selectedCategory ? 'default' : 'outline'}
                        size="sm"
                        onClick={onClearCategory}
                        className={`rounded-full whitespace-nowrap transition-all duration-200 hover:scale-105 active:scale-95 font-medium text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2 ${
                          !selectedCategory
                            ? 'text-white shadow-lg hover:shadow-xl'
                            : 'theme-border'
                        }`}
                        style={{
                          backgroundColor: !selectedCategory
                            ? `var(--theme-primary, ${theme?.colors.primary || '#2563eb'})`
                            : 'transparent',
                          color: !selectedCategory ? '#ffffff' : `var(--theme-text, ${theme?.colors.text || '#111827'})`,
                          borderColor: selectedCategory ? `var(--theme-border, ${theme?.colors.border || '#e5e7eb'})` : 'transparent',
                          boxShadow: !selectedCategory
                            ? `0 4px 12px ${theme?.colors.primary || '#2563eb'}40, 0 2px 4px ${theme?.colors.primary || '#2563eb'}20`
                            : 'none',
                          background: !selectedCategory
                            ? `linear-gradient(135deg, var(--theme-primary, ${theme?.colors.primary || '#2563eb'}) 0%, var(--theme-secondary, ${theme?.colors.secondary || '#10b981'}) 100%)`
                            : 'transparent',
                        }}
                      >
                        Home
                      </Button>
              {rootCategories.map((category) => {
                const hasSubcategories = category.subcategories && category.subcategories.length > 0
                const isSelected = selectedCategory === category._id

                if (hasSubcategories) {
                  return (
                    <DropdownMenu key={category._id}>
                      <DropdownMenuTrigger asChild>
                                <Button
                                  variant={isSelected ? 'default' : 'outline'}
                                  size="sm"
                                  className={`rounded-full whitespace-nowrap flex items-center gap-1 sm:gap-2 transition-all duration-200 hover:scale-105 active:scale-95 font-medium text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2 ${
                                    isSelected ? 'text-white shadow-lg hover:shadow-xl' : 'theme-border'
                                  }`}
                                  style={{
                                    backgroundColor: isSelected
                                      ? `var(--theme-primary, ${theme?.colors.primary || '#2563eb'})`
                                      : 'transparent',
                                    color: isSelected ? '#ffffff' : `var(--theme-text, ${theme?.colors.text || '#111827'})`,
                                    borderColor: isSelected
                                      ? 'transparent'
                                      : `var(--theme-border, ${theme?.colors.border || '#e5e7eb'})`,
                                    boxShadow: isSelected
                                      ? `0 4px 12px ${theme?.colors.primary || '#2563eb'}40, 0 2px 4px ${theme?.colors.primary || '#2563eb'}20`
                                      : 'none',
                                    background: isSelected
                                      ? `linear-gradient(135deg, var(--theme-primary, ${theme?.colors.primary || '#2563eb'}) 0%, var(--theme-secondary, ${theme?.colors.secondary || '#10b981'}) 100%)`
                                      : 'transparent',
                                  }}
                                >
                          {category.mainImage && (
                            <img
                              src={category.mainImage}
                              alt={category.name}
                              className="w-4 h-4 sm:w-6 sm:h-6 rounded-full object-cover shrink-0"
                              style={{
                                width: '16px',
                                height: '16px',
                                minWidth: '16px',
                                minHeight: '16px',
                              }}
                              loading="lazy"
                              decoding="async"
                              fetchPriority="low"
                            />
                          )}
                          <span>{category.name}</span>
                          <span className="text-[10px] sm:text-xs opacity-75 hidden sm:inline">({category.productCount})</span>
                          <ChevronDown className="w-3 h-3 sm:w-4 sm:h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="start"
                        className="min-w-[220px] max-h-[400px] overflow-hidden p-1.5 shadow-lg"
                        style={{
                          backgroundColor: theme?.colors.surface || '#ffffff',
                          borderColor: theme?.colors.border || '#e5e7eb',
                          borderWidth: '1px',
                          borderRadius: theme?.styles.borderRadius || '0.75rem',
                          boxShadow:
                            '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                        }}
                      >
                        <div className="max-h-[380px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
                          {/* Parent Category Item */}
                          <DropdownMenuItem
                            onClick={() => onCategoryClick(category._id)}
                            className="cursor-pointer rounded-md transition-colors duration-150 mb-1"
                            style={{
                              backgroundColor: isSelected
                                ? `${theme?.colors.primary || '#2563eb'}15`
                                : 'transparent',
                              padding: '0.5rem',
                            }}
                          >
                            <div className="flex items-center gap-2 w-full">
                              {category.mainImage && (
                                <div
                                  className="w-7 h-7 rounded-full overflow-hidden border flex-shrink-0"
                                  style={{ borderColor: theme?.colors.border || '#e5e7eb' }}
                                >
                                  <img
                                    src={category.mainImage}
                                    alt={category.name}
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                    decoding="async"
                                  />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <span
                                  className="font-medium text-sm block truncate"
                                  style={{ color: theme?.colors.text || '#111827' }}
                                >
                                  {category.name}
                                </span>
                                <span
                                  className="text-xs opacity-70"
                                  style={{ color: theme?.colors.textSecondary || '#6b7280' }}
                                >
                                  ({category.productCount})
                                </span>
                              </div>
                            </div>
                          </DropdownMenuItem>

                          {/* Subcategories Section */}
                          {category.subcategories && category.subcategories.length > 0 && (
                            <>
                              <div
                                className="h-px my-1.5 mx-1"
                                style={{ backgroundColor: theme?.colors.border || '#e5e7eb' }}
                              />
                              <div className="space-y-0.5">
                                {category.subcategories.map((subcat) => {
                                  const isSubSelected = selectedCategory === subcat._id
                                  return (
                                    <DropdownMenuItem
                                      key={subcat._id}
                                      onClick={() => onCategoryClick(subcat._id)}
                                      className="cursor-pointer rounded-md transition-colors duration-150"
                                      style={{
                                        backgroundColor: isSubSelected
                                          ? `${theme?.colors.primary || '#2563eb'}15`
                                          : 'transparent',
                                        padding: '0.5rem 0.75rem',
                                        marginLeft: '0.5rem',
                                      }}
                                    >
                                      <div className="flex items-center gap-2 w-full">
                                        {subcat.mainImage ? (
                                          <div
                                            className="w-6 h-6 rounded-full overflow-hidden border flex-shrink-0"
                                            style={{
                                              borderColor: theme?.colors.border || '#e5e7eb',
                                            }}
                                          >
                                            <img
                                              src={subcat.mainImage}
                                              alt={subcat.name}
                                              className="w-full h-full object-cover"
                                              loading="lazy"
                                              decoding="async"
                                            />
                                          </div>
                                        ) : (
                                          <div
                                            className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center"
                                            style={{
                                              backgroundColor:
                                                theme?.colors.border + '40' ||
                                                'rgba(229, 231, 235, 0.4)',
                                            }}
                                          >
                                            <ChevronDown
                                              className="w-3 h-3 -rotate-90"
                                              style={{
                                                color: theme?.colors.textSecondary || '#6b7280',
                                              }}
                                            />
                                          </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                          <span
                                            className="font-medium text-sm block truncate"
                                            style={{ color: theme?.colors.text || '#111827' }}
                                          >
                                            {subcat.name}
                                          </span>
                                          <span
                                            className="text-xs opacity-70"
                                            style={{
                                              color: theme?.colors.textSecondary || '#6b7280',
                                            }}
                                          >
                                            ({subcat.productCount})
                                          </span>
                                        </div>
                                        {isSubSelected && (
                                          <div
                                            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                            style={{
                                              backgroundColor: theme?.colors.primary || '#2563eb',
                                            }}
                                          />
                                        )}
                                      </div>
                                    </DropdownMenuItem>
                                  )
                                })}
                              </div>
                            </>
                          )}
                        </div>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )
                }

                        return (
                          <Button
                            key={category._id}
                            variant={isSelected ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => onCategoryClick(category._id)}
                            className={`rounded-full whitespace-nowrap flex items-center gap-1 sm:gap-2 transition-all duration-200 hover:scale-105 active:scale-95 font-medium text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2 ${
                              isSelected ? 'text-white shadow-lg hover:shadow-xl' : 'theme-border'
                            }`}
                            style={{
                              backgroundColor: isSelected
                                ? `var(--theme-primary, ${theme?.colors.primary || '#2563eb'})`
                                : 'transparent',
                              color: isSelected ? '#ffffff' : `var(--theme-text, ${theme?.colors.text || '#111827'})`,
                              borderColor: isSelected ? 'transparent' : `var(--theme-border, ${theme?.colors.border || '#e5e7eb'})`,
                              boxShadow: isSelected
                                ? `0 4px 12px ${theme?.colors.primary || '#2563eb'}40, 0 2px 4px ${theme?.colors.primary || '#2563eb'}20`
                                : 'none',
                              background: isSelected
                                ? `linear-gradient(135deg, var(--theme-primary, ${theme?.colors.primary || '#2563eb'}) 0%, var(--theme-secondary, ${theme?.colors.secondary || '#10b981'}) 100%)`
                                : 'transparent',
                            }}
                          >
                    {category.mainImage && (
                      <img
                        src={category.mainImage}
                        alt={category.name}
                        className="w-4 h-4 sm:w-6 sm:h-6 rounded-full object-cover shrink-0"
                        style={{
                          width: '16px',
                          height: '16px',
                          minWidth: '16px',
                          minHeight: '16px',
                        }}
                        loading="lazy"
                        decoding="async"
                        fetchPriority="low"
                      />
                    )}
                    <span>{category.name}</span>
                    <span className="text-[10px] sm:text-xs opacity-75 hidden sm:inline">({category.productCount})</span>
                  </Button>
                )
              })}
            </div>
          </div>

          {/* Search Bar and Share Button - Right Aligned */}
          <div className="shrink-0 flex items-center gap-2 sm:gap-3">
            {/* Search Bar - Right (always visible) */}
            <form
              onSubmit={(e) => {
                e.preventDefault()
                onSearchSubmit?.(e)
              }}
              className="flex items-center"
            >
              <div className="relative">
                <Search
                  className="absolute left-2 sm:left-3 top-1/2 transform -translate-y-1/2 w-3 h-3 sm:w-4 sm:h-4"
                  style={{ color: theme?.colors.textSecondary || '#9ca3af' }}
                />
                <Input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-7 sm:pl-9 pr-2 sm:pr-3 py-1.5 sm:py-2 h-8 sm:h-9 w-32 sm:w-40 md:w-48 text-xs sm:text-sm rounded-full border transition-all duration-200 focus:w-40 sm:focus:w-56"
                  style={{
                    borderColor: theme?.colors.border || '#d1d5db',
                    color: theme?.colors.text || '#111827',
                    backgroundColor: theme?.colors.surface || '#ffffff',
                  }}
                />
              </div>
            </form>

            {/* Share Button - Rightmost (only visible when sticky/scrolled on desktop) */}
            {isSticky && seller && (
              <ShareButton
                url={window.location.href}
                title="Store"
                description={`Share ${seller.businessName || seller.name}'s store with others`}
                shareText={`Check out ${seller.businessName || seller.name} on Kourier Boyz: ${window.location.href}`}
                variant="ghost"
                size="icon"
                className="p-2 sm:p-2.5 rounded-full transition-all duration-200 hover:scale-110 active:scale-95 shadow-sm hidden sm:flex"
                iconClassName="w-3 h-3 sm:w-4 sm:h-4 transition-transform duration-200"
                buttonStyle={{
                  backgroundColor: theme?.colors.surface || 'rgba(255, 255, 255, 0.8)',
                  borderColor: theme?.colors.border || '#e5e7eb',
                  borderWidth: '1px',
                }}
                iconStyle={{ color: theme?.colors.text || '#111827' }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
