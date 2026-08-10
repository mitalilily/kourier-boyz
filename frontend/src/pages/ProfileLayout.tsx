'use client'

import type { Product } from '@/api/products'
import { useRecommendedByPurchases, useRecommendedByShoppingTrends } from '@/api/products'
import RecentlyViewedProducts from '@/components/Home/RecentlyViewedProducts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import ProductCard from '@/components/ui/ProductCard'
import SectionHeading from '@/components/ui/SectionHeading'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { getProductDisplayInfo } from '@/utils/productDisplay'
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  Clock,
  Heart,
  Lock,
  MapPin,
  Package,
  RotateCcw,
  Shield,
  User,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useProfile } from '../api/auth'
import { useUnreadNotificationCount } from '../api/notifications'

const ProfileLayout = () => {
  const { data: profile, isLoading } = useProfile()
  const location = useLocation()
  const currentPath = location.pathname
  const isOrdersPage = currentPath === '/profile/orders' || currentPath === '/profile'
  const { data: unreadCountData } = useUnreadNotificationCount()
  const unreadNotificationCount = unreadCountData?.count || 0
  const [imageError, setImageError] = useState(false)

  const profileInitial = profile?.name?.charAt(0).toUpperCase() || 'U'
  const profileImage = profile?.profilePhoto || profile?.profilePicture || profile?.avatar

  // Reset image error when profile changes
  useEffect(() => {
    if (profileImage) {
      setImageError(false)
    }
  }, [profileImage])

  if (isLoading) {
    return (
      <>
        <style>{`
          .profile-layout-loading {
            padding-top: calc(7rem + var(--banner-height, 0px));
            transition: padding-top 0.3s ease-in-out;
          }
          @media (min-width: 640px) {
            .profile-layout-loading {
              padding-top: calc(8rem + var(--banner-height, 0px));
            }
          }
          @media (min-width: 768px) {
            .profile-layout-loading {
              padding-top: calc(10rem + var(--banner-height, 0px));
            }
          }
        `}</style>
        <div className="profile-layout-loading max-w-6xl mx-auto px-4 py-8">
          <Skeleton className="h-20 w-64 mb-8" />
          <div className="flex gap-6">
            <Skeleton className="w-64 h-96" />
            <Skeleton className="flex-1 h-96" />
          </div>
        </div>
      </>
    )
  }

  const navItems = [
    { path: '/profile/orders', icon: Package, label: 'My Orders' },
    { path: '/profile/wishlist', icon: Heart, label: 'Wishlist' },
    { path: '/profile/returns', icon: RotateCcw, label: 'Returns' },
    { path: '/profile/history', icon: Clock, label: 'History' },
    { path: '/profile/info', icon: User, label: 'Personal Info' },
    { path: '/profile/addresses', icon: MapPin, label: 'Addresses' },
    // { path: "/profile/payments", icon: CreditCard, label: "Payment Methods" },

    { path: '/profile/security', icon: Lock, label: 'Security' },
    { path: '/profile/notifications', icon: Bell, label: 'Notifications' },
    { path: '/profile/account', icon: Shield, label: 'Account Settings' },
  ]

  const renderNavButton = (item: (typeof navItems)[number], size: 'sm' | 'base' = 'base') => {
    const Icon = item.icon
    const isActive =
      currentPath === item.path || (item.path === '/profile/orders' && currentPath === '/profile')
    const baseClasses =
      size === 'sm'
        ? 'rounded-full border px-4 py-2 text-sm font-medium transition-colors'
        : 'w-full justify-start rounded-xl'
    const showBadge = item.path === '/profile/notifications' && unreadNotificationCount > 0

    return (
      <Link key={item.path} to={item.path}>
        <Button
          variant="ghost"
          className={`${baseClasses} ${
            isActive ? 'bg-white shadow-md text-gray-900' : 'text-gray-600 hover:bg-white/60'
          }`}
        >
          <div className="relative flex items-center">
            <Icon className="w-4 h-4 mr-2" />
            {item.label}
            {showBadge && (
              <Badge variant="default" className="ml-2 h-5 min-w-[20px] px-1.5 text-xs">
                {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
              </Badge>
            )}
          </div>
        </Button>
      </Link>
    )
  }

  const primaryMobileItems = navItems.slice(0, 4)
  const secondaryMobileItems = navItems.slice(4)
  return (
    <>
      <style>{`
        .profile-layout-container {
          padding-top: calc(7rem + var(--banner-height, 0px));
          transition: padding-top 0.3s ease-in-out;
        }
        @media (min-width: 640px) {
          .profile-layout-container {
            padding-top: calc(8rem + var(--banner-height, 0px));
          }
        }
        @media (min-width: 768px) {
          .profile-layout-container {
            padding-top: calc(10rem + var(--banner-height, 0px));
          }
        }
      `}</style>
      <div className="profile-layout-container mx-auto px-4 pb-24 sm:px-6 md:pb-10 lg:px-8">
      <div className="flex flex-col gap-6 md:flex-row">
        {/* Mobile Header */}
        <div className="md:hidden space-y-4">
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
            <div className="flex items-center gap-3">
              {profileImage && !imageError ? (
                <img
                  src={profileImage}
                  alt={profile?.name || 'User'}
                  className="h-12 w-12 rounded-full object-cover shadow-lg ring-2 ring-white"
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-linear-to-br from-slate-900 via-blue-900 to-slate-700 text-lg font-semibold text-white shadow-lg">
                  {profileInitial}
                </div>
              )}
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Welcome back</p>
                <h2 className="text-lg font-semibold text-slate-900">
                  {profile?.name || 'Kourier Boyz Shopper'}
                </h2>
              </div>
            </div>
            <p className="mt-4 text-sm text-slate-500">
              Manage your orders, wishlist, addresses, and security settings from a single place.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {primaryMobileItems.map((item) => {
              const Icon = item.icon
              const isActive =
                currentPath === item.path ||
                (item.path === '/profile/orders' && currentPath === '/profile')
              const showBadge =
                item.path === '/profile/notifications' && unreadNotificationCount > 0
              return (
                <Link key={`mobile-card-${item.path}`} to={item.path}>
                  <div
                    className={`flex h-full flex-col justify-between rounded-3xl border p-4 shadow-sm transition duration-200 ${
                      isActive ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900/5 text-slate-700">
                        <Icon className="h-5 w-5" />
                      </div>
                      {showBadge && (
                        <Badge variant="default" className="h-5 min-w-[20px] px-1.5 text-xs">
                          {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-4 text-sm font-semibold text-slate-900">{item.label}</p>
                    <span className="mt-2 text-xs font-medium text-blue-600">View details →</span>
                  </div>
                </Link>
              )
            })}
          </div>

          {secondaryMobileItems.length > 0 ? (
            <div className="space-y-4">
              <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Account Settings
                </p>
                <div className="mt-2 space-y-1">
                  {secondaryMobileItems.map((item) => {
                    const Icon = item.icon
                    const isActive =
                      currentPath === item.path ||
                      (item.path === '/profile/orders' && currentPath === '/profile')
                    const showBadge =
                      item.path === '/profile/notifications' && unreadNotificationCount > 0
                    return (
                      <Link key={`mobile-list-${item.path}`} to={item.path}>
                        <div
                          className={`flex items-center justify-between rounded-2xl px-3 py-3 transition ${
                            isActive ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-100'
                          }`}
                        >
                          <div className="flex items-center gap-3 text-sm font-medium text-slate-700">
                            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900/5 text-slate-700">
                              <Icon className="h-4 w-4" />
                            </span>
                            {item.label}
                            {showBadge && (
                              <Badge
                                variant="default"
                                className="ml-2 h-5 min-w-[20px] px-1.5 text-xs"
                              >
                                {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
                              </Badge>
                            )}
                          </div>
                          <ChevronRight className="h-4 w-4 text-slate-400" />
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </div>

              <Sheet>
                <SheetTrigger asChild>
                  <Button className="w-full rounded-2xl bg-slate-900 text-sm font-medium text-white hover:bg-slate-800">
                    View full menu
                  </Button>
                </SheetTrigger>
                <SheetContent
                  side="bottom"
                  className="h-[70vh] rounded-t-3xl border-none bg-white px-6 pb-10 pt-6 shadow-[0_-16px_40px_rgba(15,23,42,0.18)]"
                >
                  <SheetHeader className="text-left">
                    <SheetTitle className="text-lg font-semibold text-slate-900">
                      Account Menu
                    </SheetTitle>
                    <p className="text-sm text-slate-500">
                      Jump to orders, wishlist, addresses, and more.
                    </p>
                  </SheetHeader>
                  <div className="mt-6 space-y-2">
                    {navItems.map((item) => (
                      <div key={`mobile-sheet-${item.path}`}>{renderNavButton(item)}</div>
                    ))}
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          ) : null}
        </div>

        {/* Desktop Sidebar */}
        <aside className="hidden w-72 shrink-0 md:block">
          <div className="rounded-3xl bg-white shadow-sm ring-1 ring-slate-100">
            <div className="border-b border-slate-200 p-6">
              <div className="flex items-center gap-3">
                {profileImage && !imageError ? (
                  <img
                    src={profileImage}
                    alt={profile?.name || 'User'}
                    className="h-12 w-12 rounded-full object-cover shadow-lg ring-2 ring-white"
                    onError={() => setImageError(true)}
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-linear-to-br from-slate-900 via-blue-900 to-slate-700 text-lg font-semibold text-white shadow-lg">
                    {profileInitial}
                  </div>
                )}
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">Hello</p>
                  <h2 className="text-lg font-semibold text-slate-900">
                    {profile?.name || 'Kourier Boyz Shopper'}
                  </h2>
                </div>
              </div>
            </div>
            <nav className="space-y-1 p-4">
              {navItems.map((item) => (
                <div key={`sidebar-${item.path}`}>{renderNavButton(item)}</div>
              ))}
            </nav>
          </div>
        </aside>

        {/* Content Area */}
        <section className="flex-1">
          <div className="space-y-6">
            <Outlet />
          </div>
        </section>
      </div>

      {/* Recommendation Sections - Only on Orders Page */}
      {isOrdersPage && <OrderRecommendations />}
    </div>
    </>
  )
}

// Recommendation Section Component
interface RecommendationSectionProps {
  title: string
  italicPart?: string
  subtitle?: string
  useQuery: (params?: { limit?: number; enabled?: boolean }) => {
    data?: { products: Product[] }
    isLoading: boolean
  }
}

const RecommendationSection: React.FC<RecommendationSectionProps> = ({
  title,
  italicPart,
  subtitle,
  useQuery,
}) => {
  const navigate = useNavigate()
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)
  const { data, isLoading } = useQuery({ limit: 12, enabled: true })

  const products = useMemo(() => data?.products ?? [], [data])

  const cardData = useMemo(() => {
    return products.map((product) => {
      const display = getProductDisplayInfo(product)
      const actualPrice = display.price
      const originalPrice =
        display.comparePrice && display.comparePrice > actualPrice
          ? display.comparePrice
          : undefined

      return {
        ...product,
        discount: product.discountPercent || 0,
        actualPrice,
        originalPrice,
        badge: product.isFeatured ? 'Featured' : '',
        displayImage: display.image,
        displayStock: display.stock,
        displayVariantId: display.variantId,
      }
    })
  }, [products])

  const hasProducts = cardData.length > 0
  const shouldRender = isLoading || hasProducts

  const handleProductClick = (id: string | number) => {
    navigate(`/product/${id}`)
  }

  const updateScrollButtons = () => {
    if (!scrollContainerRef.current) return
    const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current
    setCanScrollLeft(scrollLeft > 8)
    setCanScrollRight(scrollWidth - clientWidth - scrollLeft > 8)
  }

  useEffect(() => {
    updateScrollButtons()
    const container = scrollContainerRef.current
    if (!container) return
    container.addEventListener('scroll', updateScrollButtons)
    window.addEventListener('resize', updateScrollButtons)
    return () => {
      container.removeEventListener('scroll', updateScrollButtons)
      window.removeEventListener('resize', updateScrollButtons)
    }
  }, [cardData.length])

  const scroll = (direction: 'left' | 'right') => {
    const container = scrollContainerRef.current
    if (!container) return
    const cardWidth = container.querySelector('.product-card')?.clientWidth || 280
    const gap = 16
    const scrollAmount = cardWidth + gap

    container.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    })
  }

  if (!shouldRender) {
    return null
  }

  if (isLoading && !hasProducts) {
    return (
      <div className="py-8 bg-neutral-50">
        <div className="mx-auto px-4 md:px-8">
          <div className="h-12 bg-gray-200 rounded w-64 mb-8 animate-pulse" />
          <div className="flex gap-4 overflow-hidden">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-gray-200 rounded-2xl h-80 w-56 animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!hasProducts) {
    return null
  }

  return (
    <div className="py-8 bg-neutral-50">
      <div className="mx-auto px-4 md:px-8">
        <SectionHeading align="left" title={title} italicPart={italicPart} subtitle={subtitle} />

        <div className="relative w-full flex items-center justify-center mt-8">
          <div
            ref={scrollContainerRef}
            className="w-full overflow-x-auto overflow-y-hidden scrollbar-hide scroll-smooth"
            style={{
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            }}
          >
            <div className="flex gap-4 pb-4 items-stretch">
              {cardData.map((product) => (
                <div
                  key={product._id}
                  className="product-card shrink-0 w-[calc(50%-0.8rem)] sm:w-[calc(33.333%-1rem)] lg:w-[calc(20%-1.4rem)]"
                >
                  <ProductCard
                    id={product._id}
                    slug={product.slug}
                    name={product.name}
                    price={product.actualPrice}
                    originalPrice={product.originalPrice}
                    image={product.displayImage || product.mainImage || '/image-placeholder.svg'}
                    rating={product.rating}
                    reviews={product.reviewCount || 0}
                    badge={product.badge}
                    discount={product.discount}
                    shortDescription={product.shortDescription || product.description}
                    description={product.description}
                    stock={product.displayStock ?? product.stock ?? product.totalStock}
                    variantId={product.displayVariantId}
                    product={product}
                    onClick={handleProductClick}
                  />
                </div>
              ))}
            </div>
          </div>

          <Button
            onClick={() => scroll('left')}
            variant="outline"
            size="icon"
            className="absolute -left-3 top-1/2 -translate-y-1/2 -translate-x-4 z-20 h-10 w-10 rounded-full bg-white shadow-lg border-2 border-gray-200 hover:bg-gray-50 hover:border-gray-300 hover:shadow-xl transition-all duration-300 disabled:opacity-0"
            aria-label="Previous products"
            disabled={!canScrollLeft}
          >
            <ChevronLeft className="w-5 h-5 text-yellow" />
          </Button>

          <Button
            onClick={() => scroll('right')}
            variant="outline"
            size="icon"
            className="absolute -right-3 top-1/2 -translate-y-1/2 translate-x-4 z-20 h-10 w-10 rounded-full bg-white shadow-lg border-2 border-gray-200 hover:bg-gray-50 hover:border-gray-300 hover:shadow-xl transition-all duration-300 disabled:opacity-0"
            aria-label="Next products"
            disabled={!canScrollRight}
          >
            <ChevronRight className="w-5 h-5 text-yellow" />
          </Button>
        </div>
      </div>
    </div>
  )
}

// Order Recommendations Component
const OrderRecommendations = () => {
  // Check if recommendation sections have data or are loading
  const { data: shoppingTrendsData, isLoading: isLoadingShoppingTrends } =
    useRecommendedByShoppingTrends({ limit: 1, enabled: true })
  const { data: purchasesData, isLoading: isLoadingPurchases } = useRecommendedByPurchases({
    limit: 1,
    enabled: true,
  })

  const hasShoppingTrends = (shoppingTrendsData?.products?.length ?? 0) > 0
  const hasPurchases = (purchasesData?.products?.length ?? 0) > 0
  const isLoading = isLoadingShoppingTrends || isLoadingPurchases

  // Don't render anything if not loading and no data
  if (!isLoading && !hasShoppingTrends && !hasPurchases) {
    return null
  }

  // Show loading state while checking data
  if (isLoading && !hasShoppingTrends && !hasPurchases) {
    return (
      <>
        <Separator className="my-8" />
        <div className="py-8 bg-neutral-50">
          <div className="mx-auto px-4 md:px-8">
            <div className="h-12 bg-gray-200 rounded w-64 mb-8 animate-pulse" />
            <div className="flex gap-4 overflow-hidden">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-gray-200 rounded-2xl h-80 w-56 animate-pulse" />
              ))}
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Separator className="my-8" />
      {(hasShoppingTrends || isLoadingShoppingTrends) && (
        <RecommendationSection
          title="Recommended based on your shopping trends "
          italicPart="shopping trends"
          subtitle="Discover products matching your browsing style"
          useQuery={useRecommendedByShoppingTrends}
        />
      )}
      {(hasPurchases || isLoadingPurchases) && (
        <>
          {(hasShoppingTrends || isLoadingShoppingTrends) && <Separator className="my-8" />}
          <RecommendationSection
            title="Recommended based on your"
            italicPart="purchase"
            subtitle="Products you might like based on your orders"
            useQuery={useRecommendedByPurchases}
          />
        </>
      )}
      <RecentlyViewedProducts fromOrdersPage={true} />
    </>
  )
}

export default ProfileLayout
