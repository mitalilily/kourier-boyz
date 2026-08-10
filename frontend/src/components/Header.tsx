import { useQueryClient } from '@tanstack/react-query'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useCart } from '../api/cart'
import { useCategories } from '../api/categories'
import { useIsMobile } from '../hooks/useIsMobile'
import { useAuthStore } from '../store/authStore'
import type { Category } from '../types/category'
import { guestCartUtils } from '../utils/guestCart'
import { DesktopNavigation } from './header/DesktopNavigation'
import { HeaderActions } from './header/HeaderActions'
import { LocationPopover } from './header/LocationPopover'
import { MobileHeaderMenu } from './header/MobileHeaderMenu'
import { PromotionalBanner } from './header/PromotionalBanner'
import SearchBar from './header/SearchBar'
import { useHeaderLocation } from './header/useHeaderLocation'

const Header: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated, user, logout } = useAuthStore()
  const { data: categoriesData } = useCategories({
    status: 'active',
    includeSubcategories: true,
    limit: 10,
  })
  const { data: cartData } = useCart()
  const cart = cartData?.data || cartData?.cart
  const [guestCartCount, setGuestCartCount] = useState(0)

  // Get guest cart count if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      setGuestCartCount(guestCartUtils.getCartCount())

      // Listen for guest cart updates
      const handleGuestCartUpdate = () => {
        setGuestCartCount(guestCartUtils.getCartCount())
      }

      window.addEventListener('guest-cart-updated', handleGuestCartUpdate)
      return () => {
        window.removeEventListener('guest-cart-updated', handleGuestCartUpdate)
      }
    } else {
      setGuestCartCount(0)
    }
  }, [isAuthenticated])

  const cartCount = isAuthenticated ? cart?.totalQuantity || 0 : guestCartCount

  const parentCategories = useMemo(() => {
    const categories = categoriesData?.categories ?? []
    return categories
      .filter((category: Category) => !category.parent || category.parent === null)
      .slice(0, 10)
  }, [categoriesData?.categories])

  const [isScrolled, setIsScrolled] = useState(false)
  const [isLightBg, setIsLightBg] = useState(false)
  const [isTabletOrMobile, setIsTabletOrMobile] = useState(false)
  const isMobile = useIsMobile()
  const [searchQuery, setSearchQuery] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null!)

  const {
    addressesLoading,
    addressLocationPairs,
    selectedLocation,
    isLocationPopoverOpen,
    setIsLocationPopoverOpen,
    showAllAddresses,
    toggleShowAllAddresses,
    handleAddressSelect,
    handleManualPinSubmit,
    pinInput,
    handlePinInputChange,
    locationError,
    isDetectingLocation,
    handleUseCurrentLocation,
  } = useHeaderLocation()

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 40)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Detect mobile and tablet (width < 1024px, which is lg breakpoint)
  useEffect(() => {
    const checkScreenSize = () => {
      setIsTabletOrMobile(window.innerWidth < 1024)
    }
    checkScreenSize()
    window.addEventListener('resize', checkScreenSize)
    return () => window.removeEventListener('resize', checkScreenSize)
  }, [])

  useEffect(() => {
    const handleBgCheck = () => {
      // Always use dark background on mobile and tablet
      if (isTabletOrMobile) {
        setIsLightBg(true)
        return
      }
      // On desktop, on home page, use scroll-based logic: transparent when at top, gradient dark when scrolled
      if (location.pathname === '/' || location.pathname === '/home') {
        const threshold = 500
        setIsLightBg(window.scrollY > threshold)
        return
      }
      // For all other pages on desktop, always use dark gradient background (isLightBg = true)
      setIsLightBg(true)
    }
    window.addEventListener('scroll', handleBgCheck)
    handleBgCheck()
    return () => window.removeEventListener('scroll', handleBgCheck)
  }, [location.pathname, isTabletOrMobile])

  const queryClient = useQueryClient()

  const handleLogout = () => {
    // Call logout (which clears localStorage, etc.)
    logout()

    // Clear all React Query cache (but keep guest cart in localStorage)
    queryClient.clear()

    // Trigger guest cart update event to refresh cart display
    window.dispatchEvent(new CustomEvent('guest-cart-updated'))

    // Navigate to home with replace to prevent ProtectedRoute from redirecting to login
    navigate('/', { replace: true })
  }

  // Always use white text for dark theme
  const textClass = 'text-white'

  // On mobile, always use scrolled colors regardless of scroll position
  const effectiveScrolled = isScrolled

  // Dark theme: transparent when !isLightBg, gradient dark when isLightBg
  const headerBackground = isLightBg
    ? 'linear-gradient(135deg, rgba(15,23,42,0.96), rgba(17,24,39,0.94) 48%, rgba(30,41,59,0.92))'
    : 'linear-gradient(135deg, rgba(15,23,42,0.78), rgba(15,23,42,0.54) 52%, rgba(30,41,59,0.34))'

  const headerBorder = isLightBg
    ? '1px solid rgba(255,255,255,0.14)'
    : effectiveScrolled
    ? '1px solid rgba(255,255,255,0.16)'
    : '1px solid rgba(255,255,255,0.12)'

  const headerShadow = isLightBg
    ? '0 18px 45px rgba(2, 6, 23, 0.34), 0 4px 20px rgba(15, 23, 42, 0.28)'
    : effectiveScrolled
    ? '0 18px 45px rgba(2, 6, 23, 0.34), 0 4px 20px rgba(15, 23, 42, 0.28)'
    : '0 14px 38px rgba(2, 6, 23, 0.26), 0 4px 16px rgba(15, 23, 42, 0.18)'

  // Blur effect for both - stronger when transparent
  const headerBackdrop = isLightBg ? 'blur(20px) saturate(180%)' : 'blur(20px) saturate(180%)'

  return (
    <>
      <PromotionalBanner />
      <header
        className={`fixed left-0 w-full flex flex-col items-center z-50 transition-all duration-500 ease-in-out`}
        style={{
          top: 'var(--banner-height, 0px)',
        }}
      >
        <div
          className="w-full px-3 pt-2 transition-all duration-700 ease-in-out sm:px-4 lg:px-6"
        >
          <div
            className={`relative flex w-full items-center justify-between gap-4 rounded-[22px] px-3 py-2.5 transition-all duration-700 ease-in-out sm:px-5 lg:px-6 ${
              effectiveScrolled ? 'shadow-xl' : 'shadow-lg'
            }`}
            style={{
              minHeight: 'fit-content',
              height: 'auto',
              background: headerBackground,
              backdropFilter: headerBackdrop,
              WebkitBackdropFilter: headerBackdrop,
              border: headerBorder,
              boxShadow: headerShadow,
              transition: 'all 0.5s cubic-bezier(0.4,0,0.2,1)',
            }}
          >
            <div className="absolute inset-x-0 top-0 -z-10 h-20 rounded-[22px] bg-linear-to-r from-amber-400/8 via-transparent to-sky-400/10 blur-2xl" />
            <div className="flex min-w-0 items-center gap-3 sm:gap-5">
              <Link
                to="/"
                className="flex shrink-0 items-center rounded-2xl border border-white/10 bg-white/6 px-2.5 py-1.5 transition-all hover:scale-[1.02] hover:border-white/20 hover:bg-white/10"
                aria-label="Kourier Boyz Home"
                style={{ height: '100%', display: 'flex', alignItems: 'center' }}
              >
                <img
                  src="/logo-shaded.png"
                  alt="Kourier Boyz"
                  className="h-12 w-16 object-contain brightness-110 transition-all duration-300 group-hover:scale-110 sm:h-14 sm:w-20 md:h-16 md:w-24"
                />
              </Link>

              {!isMobile && (
                <div className="shrink-0">
                  <LocationPopover
                    isLightBg={isLightBg}
                    selectedLocation={selectedLocation}
                    isOpen={isLocationPopoverOpen}
                    onOpenChange={setIsLocationPopoverOpen}
                    addressesLoading={addressesLoading}
                    addressLocationPairs={addressLocationPairs}
                    showAllAddresses={showAllAddresses}
                    onToggleShowAllAddresses={toggleShowAllAddresses}
                    onSelectAddress={handleAddressSelect}
                    onUseCurrentLocation={handleUseCurrentLocation}
                    isDetectingLocation={isDetectingLocation}
                    pinInput={pinInput}
                    onPinInputChange={handlePinInputChange}
                    onManualPinSubmit={handleManualPinSubmit}
                    locationError={locationError}
                  />
                </div>
              )}
            </div>

            <DesktopNavigation
              isLightBg={isLightBg}
              textClass={textClass}
              pathname={location.pathname}
              parentCategories={parentCategories}
              isAuthenticated={isAuthenticated}
            />

            <HeaderActions
              searchQuery={searchQuery}
              onSearchChange={(value) => setSearchQuery(value)}
              searchInputRef={searchInputRef}
              textClass={textClass}
              isLightBg={isLightBg}
              isScrolled={isScrolled}
              isAuthenticated={isAuthenticated}
              cartCount={cartCount}
              userName={user?.name}
              userEmail={user?.email}
              onLogout={handleLogout}
              pathname={location.pathname}
            />

            {isMobile && (
              <div className="flex shrink-0 items-center gap-2">
                <div className="shrink-0">
                  <LocationPopover
                    isLightBg={isLightBg}
                    selectedLocation={selectedLocation}
                    isOpen={isLocationPopoverOpen}
                    onOpenChange={setIsLocationPopoverOpen}
                    addressesLoading={addressesLoading}
                    addressLocationPairs={addressLocationPairs}
                    showAllAddresses={showAllAddresses}
                    onToggleShowAllAddresses={toggleShowAllAddresses}
                    onSelectAddress={handleAddressSelect}
                    onUseCurrentLocation={handleUseCurrentLocation}
                    isDetectingLocation={isDetectingLocation}
                    pinInput={pinInput}
                    onPinInputChange={handlePinInputChange}
                    onManualPinSubmit={handleManualPinSubmit}
                    locationError={locationError}
                  />
                </div>
                <MobileHeaderMenu
                  textClass={textClass}
                  isLightBg={isLightBg}
                  isScrolled={isScrolled}
                  selectedLocation={selectedLocation}
                  onMobileLocationChange={() => setIsLocationPopoverOpen(true)}
                  searchQuery={searchQuery}
                  onSearchChange={(value) => setSearchQuery(value)}
                  parentCategories={parentCategories}
                  pathname={location.pathname}
                  isAuthenticated={isAuthenticated}
                  onLogout={handleLogout}
                />
              </div>
            )}
          </div>
        </div>

        {/* Mobile/Tablet Search Bar - Part of Header */}
        <div
          className="lg:hidden w-full px-3 pb-2.5 pt-2 transition-all duration-500 ease-in-out sm:px-4 lg:px-6"
          style={{
          }}
        >
          <div
            className="rounded-[20px] px-3 py-3 shadow-lg"
            style={{
              background: headerBackground,
              backdropFilter: headerBackdrop,
              WebkitBackdropFilter: headerBackdrop,
              border: headerBorder,
              boxShadow: headerShadow,
            }}
          >
            <SearchBar
              searchQuery={searchQuery}
              onSearchChange={(value) => setSearchQuery(value)}
              searchInputRef={searchInputRef}
              isLightBg={isLightBg}
              isAuthenticated={isAuthenticated}
              containerClassName="items-center w-full"
              inputClassName="w-full h-10 sm:h-11 text-sm sm:text-base"
            />
          </div>
        </div>
      </header>
    </>
  )
}

export default Header
