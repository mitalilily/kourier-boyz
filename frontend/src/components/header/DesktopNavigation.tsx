import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { motion } from 'framer-motion'
import { ChevronDown, Grid3x3 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import type { Category } from '../../types/category'
import { CategoriesPopoverContent } from './CategoriesPopover'

interface DesktopNavigationProps {
  isLightBg: boolean
  textClass: string
  pathname: string
  parentCategories: Category[]
  isAuthenticated: boolean
}

export const DesktopNavigation: React.FC<DesktopNavigationProps> = ({
  isLightBg,
  textClass,
  pathname,
  parentCategories,
  isAuthenticated,
}) => {
  const { t } = useTranslation()

  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null)
  const [categoriesDropdownOpen, setCategoriesDropdownOpen] = useState(false)

  // Find default category with subcategories when dropdown opens
  const defaultCategory = useMemo(() => {
    if (!categoriesDropdownOpen) return null
    const firstWithSubs = parentCategories.find(
      (category) => category.subcategories && category.subcategories.length > 0,
    )
    return firstWithSubs?._id || parentCategories[0]?._id || null
  }, [categoriesDropdownOpen, parentCategories])

  useEffect(() => {
    if (categoriesDropdownOpen && defaultCategory && !hoveredCategory) {
      setHoveredCategory(defaultCategory)
    }
  }, [categoriesDropdownOpen, defaultCategory, hoveredCategory])

  // Reset hovered category when dropdown closes
  useEffect(() => {
    if (!categoriesDropdownOpen) {
      setHoveredCategory(null)
    }
  }, [categoriesDropdownOpen])

  const isHomeActive = pathname === '/'
  const isCategoriesActive = pathname.startsWith('/shop-by-category') || categoriesDropdownOpen
  const isOrdersActive = pathname === '/orders' || pathname.startsWith('/profile/orders')
  const isWishlistActive = pathname === '/profile/wishlist'
  const navShellClass = isLightBg
    ? 'border-white/10 bg-white/6 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
    : 'border-white/12 bg-slate-950/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
  const baseButtonClass =
    'relative h-11 rounded-2xl px-4 text-sm font-medium cursor-pointer overflow-hidden text-white transition-all duration-300 hover:text-white'
  const activeSurfaceClass = isLightBg
    ? 'absolute inset-0 rounded-2xl border border-amber-300/25 bg-white/12 shadow-[0_10px_24px_rgba(15,23,42,0.18)]'
    : 'absolute inset-0 rounded-2xl border border-white/18 bg-white/10 shadow-[0_10px_24px_rgba(15,23,42,0.16)]'
  const hoverSurfaceClass = isLightBg ? 'group-hover:bg-white/10' : 'group-hover:bg-white/8'

  return (
    <nav
      className={`hidden lg:flex items-center gap-1 rounded-[20px] border px-2 py-2 ${navShellClass}`}
      aria-label="Main navigation"
    >
      <Link to="/">
        <motion.div className="relative group">
          <Button variant="ghost" className={`${baseButtonClass} ${isHomeActive ? 'font-semibold' : ''}`}>
            {isHomeActive && (
              <motion.div
                layoutId="activeTab"
                className={activeSurfaceClass}
                initial={false}
                transition={{
                  type: 'spring',
                  stiffness: 500,
                  damping: 30,
                }}
              />
            )}
            {!isHomeActive && (
              <motion.div
                className={`absolute inset-0 rounded-2xl bg-white/0 transition-colors duration-200 ${hoverSurfaceClass}`}
              />
            )}
            <motion.span
              className={`relative z-10 ${textClass}`}
              animate={{
                color: '#FFFFFF',
              }}
              transition={{ duration: 0.2 }}
            >
              {t('navigation.home')}
            </motion.span>
            {isHomeActive && (
              <motion.div
                className="absolute bottom-1.5 left-4 right-4 h-0.5 rounded-full bg-linear-to-r from-amber-300 via-orange-300 to-sky-300"
                layoutId="activeTabIndicator"
                initial={false}
                transition={{
                  type: 'spring',
                  stiffness: 500,
                  damping: 30,
                }}
              />
            )}
          </Button>
        </motion.div>
      </Link>

      <div
        className="relative"
        onMouseEnter={() => setCategoriesDropdownOpen(true)}
        onMouseLeave={() => {
          setCategoriesDropdownOpen(false)
        }}
      >
        <DropdownMenu open={categoriesDropdownOpen} onOpenChange={setCategoriesDropdownOpen}>
          <DropdownMenuTrigger asChild>
            <motion.div className="relative group">
              <Button
                variant="ghost"
                className={`${baseButtonClass} ${
                  isCategoriesActive ? 'font-semibold' : ''
                }`}
              >
                {isCategoriesActive && (
                  <motion.div
                    layoutId="activeTab"
                    className={activeSurfaceClass}
                    initial={false}
                    transition={{
                      type: 'spring',
                      stiffness: 500,
                      damping: 30,
                    }}
                  />
                )}
                {!isCategoriesActive && (
                  <motion.div
                    className={`absolute inset-0 rounded-2xl bg-white/0 transition-colors duration-200 ${hoverSurfaceClass}`}
                  />
                )}
                <motion.span
                  className={`relative z-10 flex items-center gap-2 ${textClass}`}
                  animate={{
                    color: '#FFFFFF',
                  }}
                  transition={{ duration: 0.2 }}
                >
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-xl border border-white/12 bg-white/10">
                    <Grid3x3 className="h-4 w-4" />
                  </span>
                  {t('navigation.categories')}
                </motion.span>
                <motion.div
                  className="relative z-10 ml-1 text-white/80"
                  animate={{ rotate: categoriesDropdownOpen ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronDown className="h-4 w-4" />
                </motion.div>
                {isCategoriesActive && (
                  <motion.div
                    className="absolute bottom-1.5 left-4 right-4 h-0.5 rounded-full bg-linear-to-r from-amber-300 via-orange-300 to-sky-300"
                    layoutId="activeTabIndicator"
                    initial={false}
                    transition={{
                      type: 'spring',
                      stiffness: 500,
                      damping: 30,
                    }}
                  />
                )}
              </Button>
            </motion.div>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="p-0 overflow-visible border-0 data-[state=open]:animate-none"
            style={{
              background: 'transparent',
              boxShadow: 'none',
              zIndex: 55,
            }}
            onCloseAutoFocus={(e) => e.preventDefault()}
          >
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            >
              <CategoriesPopoverContent
                categories={parentCategories}
                hoveredCategory={hoveredCategory}
                onCategoryHover={setHoveredCategory}
              />
            </motion.div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {isAuthenticated ? (
        <>
          <Link to="/profile/orders">
            <motion.div className="relative group">
              <Button
                variant="ghost"
                className={`${baseButtonClass} ${
                  isOrdersActive ? 'font-semibold' : ''
                }`}
              >
                {isOrdersActive && (
                  <motion.div
                    layoutId="activeTab"
                    className={activeSurfaceClass}
                    initial={false}
                    transition={{
                      type: 'spring',
                      stiffness: 500,
                      damping: 30,
                    }}
                  />
                )}
                {!isOrdersActive && (
                  <motion.div
                    className={`absolute inset-0 rounded-2xl bg-white/0 transition-colors duration-200 ${hoverSurfaceClass}`}
                  />
                )}
                <motion.span
                  className={`relative z-10 ${textClass}`}
                  animate={{
                    color: '#FFFFFF',
                  }}
                  transition={{ duration: 0.2 }}
                >
                  {t('navigation.orders')}
                </motion.span>
                {isOrdersActive && (
                  <motion.div
                    className="absolute bottom-1.5 left-4 right-4 h-0.5 rounded-full bg-linear-to-r from-amber-300 via-orange-300 to-sky-300"
                    layoutId="activeTabIndicator"
                    initial={false}
                    transition={{
                      type: 'spring',
                      stiffness: 500,
                      damping: 30,
                    }}
                  />
                )}
              </Button>
            </motion.div>
          </Link>
          <Link to="/profile/wishlist">
            <motion.div className="relative group">
              <Button
                variant="ghost"
                className={`${baseButtonClass} ${
                  isWishlistActive ? 'font-semibold' : ''
                }`}
              >
                {isWishlistActive && (
                  <motion.div
                    layoutId="activeTab"
                    className={activeSurfaceClass}
                    initial={false}
                    transition={{
                      type: 'spring',
                      stiffness: 500,
                      damping: 30,
                    }}
                  />
                )}
                {!isWishlistActive && (
                  <motion.div
                    className={`absolute inset-0 rounded-2xl bg-white/0 transition-colors duration-200 ${hoverSurfaceClass}`}
                  />
                )}
                <motion.span
                  className={`relative z-10 ${textClass}`}
                  animate={{
                    color: '#FFFFFF',
                  }}
                  transition={{ duration: 0.2 }}
                >
                  {t('navigation.wishlist')}
                </motion.span>
                {isWishlistActive && (
                  <motion.div
                    className="absolute bottom-1.5 left-4 right-4 h-0.5 rounded-full bg-linear-to-r from-amber-300 via-orange-300 to-sky-300"
                    layoutId="activeTabIndicator"
                    initial={false}
                    transition={{
                      type: 'spring',
                      stiffness: 500,
                      damping: 30,
                    }}
                  />
                )}
              </Button>
            </motion.div>
          </Link>
        </>
      ) : null}
    </nav>
  )
}
