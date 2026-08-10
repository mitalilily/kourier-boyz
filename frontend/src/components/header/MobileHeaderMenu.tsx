import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  Calculator,
  Grid3x3,
  Heart,
  Home,
  LocateFixed,
  LogOut,
  Menu,
  Package,
  Search,
  ShoppingBag,
  Sparkles,
  Store,
  Truck,
} from 'lucide-react'
import type { FC, ReactElement } from 'react'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import type { Category } from '../../types/category'
import SearchBar from './SearchBar'
import type { HeaderLocation } from './useHeaderLocation'

interface MobileHeaderMenuProps {
  textClass: string
  isLightBg: boolean
  isScrolled: boolean
  selectedLocation: HeaderLocation | null
  onMobileLocationChange: () => void
  searchQuery: string
  onSearchChange: (value: string) => void
  parentCategories: Category[]
  pathname: string
  isAuthenticated: boolean
  onLogout: () => void
}

export const MobileHeaderMenu: FC<MobileHeaderMenuProps> = ({
  textClass,
  isLightBg,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  isScrolled,
  selectedLocation,
  onMobileLocationChange,
  searchQuery,
  onSearchChange,
  parentCategories,
  pathname,
  isAuthenticated,
  onLogout,
}) => {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null!)
  const isShopExperience =
    pathname === '/shop' ||
    pathname === '/store' ||
    pathname.startsWith('/product/') ||
    pathname.startsWith('/products/') ||
    pathname.startsWith('/shop-by-category') ||
    pathname.startsWith('/search') ||
    pathname === '/cart' ||
    pathname.startsWith('/profile/orders') ||
    pathname.startsWith('/profile/wishlist')
  const homeLink = isShopExperience ? '/shop' : '/'
  const homeLabel = isShopExperience ? 'Shop Home' : t('navigation.home')
  const platformLinks = isShopExperience
    ? [{ to: '/', label: 'Main Home', Icon: Home }]
    : [
        { to: '/shop', label: 'Shop', Icon: ShoppingBag },
        { to: '/ship', label: 'Ship', Icon: Truck },
        { to: '/track', label: 'Track', Icon: Search },
        { to: '/rates', label: 'Rates', Icon: Calculator },
        { to: '/become-a-seller', label: 'Sell', Icon: Store },
      ]

  const renderMobileCategoryItem = (category: Category, level = 0): ReactElement => {
    const hasSubcategories = category.subcategories && category.subcategories.length > 0
    const indentClass =
      level === 0 ? 'pl-4' : level === 1 ? 'pl-8' : level === 2 ? 'pl-12' : 'pl-16'

    return (
      <div key={category._id} className="space-y-1">
        <SheetClose asChild>
          <Link to={`/shop-by-category?category=${category._id}`}>
            <Button
              variant="ghost"
              className={`${indentClass} flex h-auto w-full justify-start rounded-2xl px-4 py-3 text-left text-[13px] font-medium leading-5 text-slate-700 hover:bg-slate-50 hover:text-slate-950 sm:text-sm`}
            >
              <span className="mr-2 text-base">
                {category.mainImage && category.mainImage !== 'default' ? '📦' : '📁'}
              </span>
              {category.name}
              {hasSubcategories ? (
                <span className="ml-auto text-xs text-gray-400">
                  ({category.subcategories?.length})
                </span>
              ) : null}
            </Button>
          </Link>
        </SheetClose>
        {hasSubcategories ? (
          <div className="space-y-1">
            {category.subcategories!.map((sub) => renderMobileCategoryItem(sub, level + 1))}
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <Sheet>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={`h-11 w-11 rounded-2xl border transition-all duration-300 ${textClass} ${
              isLightBg
                ? 'border-black/10 bg-white/46 text-[#1d1d1c] hover:bg-white/78'
                : 'border-white/16 bg-white/10 hover:bg-white/16'
            }`}
            aria-label={t('navigation.toggleMobileMenu')}
          >
            <Menu size={20} />
          </Button>
        </SheetTrigger>
        <SheetContent
          side="right"
          className="flex w-[88vw] flex-col border-l border-slate-200 bg-linear-to-b from-slate-50 via-white to-slate-50 p-0 sm:w-[430px]"
        >
          <SheetHeader className="border-b border-slate-200 bg-slate-950 px-6 pb-5 pt-6 text-left">
            <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-white">
              <Sparkles size={18} />
            </div>
            <SheetTitle className="text-xl text-white">{t('navigation.menuTitle')}</SheetTitle>
            <SheetDescription className="max-w-[22rem] text-sm leading-6 text-slate-300">
              {t('navigation.menuDescription')}
            </SheetDescription>
          </SheetHeader>

          {/* <div className="px-6 py-4 border-b">
            <LanguageSelector variant="select" />
          </div> */}

          <div className="border-b border-slate-200 px-6 py-5">
            <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-white">
                <LocateFixed size={18} />
                </span>
                <div className="flex-1">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">
                    {t('navigation.deliveringTo')}
                  </p>
                  <p className="mt-1 text-sm font-semibold leading-5 text-slate-950">
                    {selectedLocation?.label ?? t('navigation.selectLocation')}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {selectedLocation?.detail ?? t('navigation.addDeliveryPin')}
                  </p>
                </div>
                <SheetClose asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full border-slate-200 text-xs"
                    onClick={onMobileLocationChange}
                  >
                    {t('navigation.change')}
                  </Button>
                </SheetClose>
              </div>
            </div>
          </div>

          <div className="border-b border-slate-200 px-6 py-5">
            <SearchBar
              searchQuery={searchQuery}
              onSearchChange={onSearchChange}
              searchInputRef={inputRef}
              isLightBg={true}
              isAuthenticated={isAuthenticated}
              containerClassName="items-center"
              inputClassName="w-full"
            />
          </div>

          <nav className="flex-1 overflow-y-auto px-4 py-4" aria-label="Mobile navigation">
            <div className="space-y-2">
            <SheetClose asChild>
              <Link to={homeLink}>
                <Button
                  variant="ghost"
                    className={`h-12 w-full justify-start rounded-2xl px-4 text-sm font-medium transition-colors ${
                      (isShopExperience ? pathname === '/shop' || pathname === '/store' : pathname === '/')
                        ? 'bg-slate-950 text-white hover:bg-slate-900'
                        : 'bg-white'
                    }`}
                >
                  <Home className="mr-3 h-4 w-4" />
                  {homeLabel}
                </Button>
              </Link>
            </SheetClose>

            {platformLinks.map((item) => {
              const Icon = item.Icon
              return (
                <SheetClose asChild key={item.to}>
                  <Link to={item.to}>
                    <Button
                      variant="ghost"
                      className={`h-12 w-full justify-start rounded-2xl px-4 text-sm font-medium transition-colors ${
                        pathname === item.to ? 'bg-slate-950 text-white hover:bg-slate-900' : 'bg-white'
                      }`}
                    >
                      <Icon className="mr-3 h-4 w-4" />
                      {item.label}
                    </Button>
                  </Link>
                </SheetClose>
              )
            })}

            {isAuthenticated ? (
              <>
                <SheetClose asChild>
                  <Link to="/profile/orders">
                    <Button
                      variant="ghost"
                      className={`h-12 w-full justify-start rounded-2xl px-4 text-sm font-medium transition-colors ${
                        pathname === '/orders' || pathname.startsWith('/profile/orders')
                          ? 'bg-slate-950 text-white hover:bg-slate-900'
                          : 'bg-white'
                      }`}
                    >
                      <Package className="mr-3 h-4 w-4" />
                      {t('navigation.orders')}
                    </Button>
                  </Link>
                </SheetClose>
                <SheetClose asChild>
                  <Link to="/profile/wishlist">
                    <Button
                      variant="ghost"
                      className={`h-12 w-full justify-start rounded-2xl px-4 text-sm font-medium transition-colors ${
                        pathname === '/profile/wishlist'
                          ? 'bg-slate-950 text-white hover:bg-slate-900'
                          : 'bg-white'
                      }`}
                    >
                      <Heart className="mr-3 h-4 w-4" />
                      {t('navigation.wishlist')}
                    </Button>
                  </Link>
                </SheetClose>
              </>
            ) : null}
            </div>

            <div className="mt-5 rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <Grid3x3 size={16} />
                <span className="text-sm font-semibold">{t('navigation.categories')}</span>
              </div>
              <div className="max-h-[400px] space-y-1 overflow-y-auto">
                {parentCategories.length > 0 ? (
                  parentCategories.map((category) => renderMobileCategoryItem(category))
                ) : (
                  <div className="px-4 py-2 text-sm text-gray-500">
                    {t('navigation.noCategories')}
                  </div>
                )}
              </div>
              <SheetClose asChild>
                <Link to="/shop-by-category">
                  <Button
                    variant="ghost"
                    className="mt-3 h-11 w-full justify-center rounded-2xl border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-950"
                  >
                    {t('navigation.viewAllProducts')}
                  </Button>
                </Link>
              </SheetClose>
            </div>
          </nav>

          <div className="space-y-3 border-t border-slate-200 bg-white px-6 py-5">
            {isAuthenticated ? (
              <Button
                onClick={onLogout}
                variant="destructive"
                className="h-12 w-full rounded-2xl"
              >
                <LogOut className="mr-2 h-4 w-4" />
                {t('navigation.signOut')}
              </Button>
            ) : (
              <SheetClose asChild>
                <Link to="/login">
                  <Button className="h-12 w-full rounded-2xl">{t('navigation.signIn')}</Button>
                </Link>
              </SheetClose>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
