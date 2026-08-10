import { useCart } from '@/api/cart'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { useAuthStore } from '@/store/authStore'
import { guestCartUtils } from '@/utils/guestCart'
import { Heart, Home, ListTree, Menu, ShoppingBag, ShoppingCart, User } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'

const navItemBaseClasses =
  'relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-sm px-1.5 py-2 text-[10px] font-semibold leading-tight transition-all'

interface BottomLink {
  labelKey: string
  label?: string
  href: string
  icon: React.ComponentType<{ size?: number }>
  requiresAuth?: boolean
}

const primaryLinks: BottomLink[] = [
  { labelKey: 'navigation.home', href: '/', icon: Home },
  { labelKey: 'navigation.shop', href: '/shop-by-category', icon: ShoppingBag },
  { labelKey: 'navigation.wishlist', href: '/profile/wishlist', icon: Heart, requiresAuth: true },
  { labelKey: 'navigation.cart', href: '/cart', icon: ShoppingCart },
]

const secondaryLinks: BottomLink[] = [
  { labelKey: 'navigation.orders', href: '/orders', icon: ShoppingBag, requiresAuth: true },
  { labelKey: 'navigation.profile', href: '/profile', icon: User, requiresAuth: true },
  { labelKey: 'navigation.helpCenter', href: '/help', icon: ListTree },
  { labelKey: 'navigation.contactUs', href: '/contact', icon: ListTree },
  // { labelKey: 'navigation.chatSupport', href: '/chat', icon: ListTree },
]

const MobileBottomNav = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { isAuthenticated } = useAuthStore()
  const [isMoreOpen, setIsMoreOpen] = useState(false)
  const { data: cartData } = useCart()
  const cart = cartData?.data || cartData?.cart
  const [guestCartCount, setGuestCartCount] = useState(0)

  // Get guest cart count if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      setGuestCartCount(guestCartUtils.getCartCount())
      const handleGuestCartUpdate = () => {
        setGuestCartCount(guestCartUtils.getCartCount())
      }
      window.addEventListener('guest-cart-updated', handleGuestCartUpdate)
      return () => {
        window.removeEventListener('guest-cart-updated', handleGuestCartUpdate)
      }
    }
  }, [isAuthenticated])

  const cartCount = isAuthenticated ? (cart?.totalQuantity || 0) : guestCartCount

  const activePath = location.pathname

  const isShopExperience =
    activePath === '/shop' ||
    activePath === '/store' ||
    activePath.startsWith('/product/') ||
    activePath.startsWith('/products/') ||
    activePath.startsWith('/shop-by-category') ||
    activePath.startsWith('/search') ||
    activePath === '/cart' ||
    activePath.startsWith('/profile/orders') ||
    activePath.startsWith('/profile/wishlist')

  const experiencePrimaryLinks: BottomLink[] = isShopExperience
    ? [
        { labelKey: 'shop-home', label: 'Shop Home', href: '/shop', icon: Home },
        { labelKey: 'main-home', label: 'Main Home', href: '/', icon: ShoppingBag },
        { labelKey: 'navigation.wishlist', href: '/profile/wishlist', icon: Heart, requiresAuth: true },
        { labelKey: 'navigation.cart', href: '/cart', icon: ShoppingCart },
      ]
    : primaryLinks

  const filteredPrimaryLinks = useMemo(() => {
    return experiencePrimaryLinks.map((link) => {
      if (link.requiresAuth && !isAuthenticated) {
        return { ...link, href: '/login?redirect=' + encodeURIComponent(link.href) }
      }
      return link
    })
  }, [experiencePrimaryLinks, isAuthenticated])

  const filteredSecondaryLinks = useMemo(() => {
    return secondaryLinks.map((link) => {
      if (link.requiresAuth && !isAuthenticated) {
        return { ...link, href: '/login?redirect=' + encodeURIComponent(link.href) }
      }
      return link
    })
  }, [isAuthenticated])

  const handleNavClick = (href: string, closeSheet?: () => void) => {
    navigate(href)
    if (closeSheet) {
      closeSheet()
    }
  }

  // Hide on seller storefront routes to avoid layout conflicts
  if (activePath.startsWith('/seller/')) {
    return null
  }

  return (
    <div className="md:hidden">
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 px-2 pt-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] backdrop-blur-lg shadow-[0_-6px_25px_rgba(15,23,42,0.12)]">
        <div className="mx-auto flex max-w-3xl items-center gap-1">
          {filteredPrimaryLinks.map((link) => {
            const label = link.label || t(link.labelKey)
            const Icon = link.icon
            const isActive =
              activePath === link.href || (link.href !== '/' && activePath.startsWith(link.href))
            const textClass = isActive ? 'text-[#9a6b0c] font-semibold' : 'text-slate-600'
            return (
              <button
                key={link.labelKey}
                type="button"
                onClick={() => handleNavClick(link.href)}
                className={`${navItemBaseClasses} ${textClass} ${
                  isActive ? 'bg-[#f5ecd6]' : ''
                } transition-colors duration-200`}
              >
                <span className={isActive ? 'text-[#a9730c]' : 'text-slate-600'}>
                  <Icon size={20} />
                </span>
                <span className="max-w-full truncate text-center">{label}</span>
                {link.labelKey === 'navigation.cart' && cartCount > 0 ? (
                  <span className="absolute -top-1.5 right-3 inline-flex min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-semibold text-white">
                    {cartCount > 9 ? '9+' : cartCount}
                  </span>
                ) : null}
                {isActive && (
                  <span className="absolute bottom-0 left-1/2 h-0.5 w-8 -translate-x-1/2 bg-[#b78115]" />
                )}
              </button>
            )
          })}

          <Sheet open={isMoreOpen} onOpenChange={setIsMoreOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                className={`${navItemBaseClasses} text-slate-600`}
                aria-label={t('navigation.moreOptionsTitle')}
              >
                <Menu size={20} />
                <span className="max-w-full truncate text-center">{t('navigation.more')}</span>
              </button>
            </SheetTrigger>
            <SheetContent
              side="bottom"
              className="z-50 h-[80vh] rounded-t-3xl border-none bg-white px-5 shadow-[0_-20px_40px_rgba(15,23,42,0.18)]"
            >
              <SheetHeader className="pt-4 pb-2 text-left">
                <SheetTitle className="text-lg font-semibold text-slate-900">
                  {t('navigation.moreOptionsTitle')}
                </SheetTitle>
                <SheetDescription className="max-w-[24rem] text-sm leading-6 text-slate-500">
                  {t('navigation.moreOptionsSubtitle')}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {t('navigation.discover')}
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-3">
                    <Button
                      variant="secondary"
                      className="h-auto justify-start rounded-2xl px-4 py-3 text-left text-sm leading-5"
                      onClick={() => handleNavClick('/deals', () => setIsMoreOpen(false))}
                    >
                      🔥 {t('navigation.deals')}
                    </Button>
                    <Button
                      variant="secondary"
                      className="h-auto justify-start rounded-2xl px-4 py-3 text-left text-sm leading-5"
                      onClick={() =>
                        handleNavClick('/shop-by-category?filter=new', () => setIsMoreOpen(false))
                      }
                    >
                      ✨ {t('navigation.newArrivals')}
                    </Button>
                    <Button
                      variant="secondary"
                      className="h-auto justify-start rounded-2xl px-4 py-3 text-left text-sm leading-5"
                      onClick={() =>
                        handleNavClick('/shop-by-category?filter=trending', () =>
                          setIsMoreOpen(false),
                        )
                      }
                    >
                      📈 {t('navigation.trending')}
                    </Button>
                    <Button
                      variant="secondary"
                      className="h-auto justify-start rounded-2xl px-4 py-3 text-left text-sm leading-5"
                      onClick={() =>
                        handleNavClick('/shop-by-category?filter=best-sellers', () =>
                          setIsMoreOpen(false),
                        )
                      }
                    >
                      🏆 {t('navigation.bestSellers')}
                    </Button>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {t('navigation.yourStuff')}
                  </p>
                  <div className="mt-2 space-y-1">
                    {filteredSecondaryLinks.map((link) => {
                      const Icon = link.icon
                      const iconTone =
                        link.labelKey === 'navigation.profile'
                          ? 'text-purple-500'
                          : 'text-slate-500'
                      return (
                        <Button
                          key={link.labelKey}
                          variant="ghost"
                          className="h-auto w-full justify-start rounded-xl px-3 py-3 text-left text-[15px] font-medium leading-5 hover:bg-slate-100"
                          onClick={() => handleNavClick(link.href, () => setIsMoreOpen(false))}
                        >
                          <span
                            className={`mr-3 flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 ${iconTone}`}
                          >
                            <Icon size={18} />
                          </span>
                          {t(link.labelKey)}
                        </Button>
                      )
                    })}
                  </div>
                </div>
              </div>
              {/* <div className="mt-6">
                <LanguageSelector variant="select" />
              </div> */}
            </SheetContent>
          </Sheet>
        </div>
      </nav>
      <div className="h-24" aria-hidden="true" />
    </div>
  )
}

export default MobileBottomNav
