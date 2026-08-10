import { useQueryClient } from '@tanstack/react-query'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useCart } from '../api/cart'
import { useCategories } from '../api/categories'
import { useAuthStore } from '../store/authStore'
import type { Category } from '../types/category'
import { guestCartUtils } from '../utils/guestCart'
import { isShopPath } from '../lib/navigation'
import PlatformHeader from './PlatformHeader'
import { DesktopNavigation } from './header/DesktopNavigation'
import { HeaderActions } from './header/HeaderActions'
import { LocationPopover } from './header/LocationPopover'
import { MobileHeaderMenu } from './header/MobileHeaderMenu'
import { PromotionalBanner } from './header/PromotionalBanner'
import SearchBar from './header/SearchBar'
import { useHeaderLocation } from './header/useHeaderLocation'

const StoreHeader: React.FC = () => {
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
  const isLightBg = true
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

  const textClass = 'text-[#1d1d1c]'
  const logoLink = '/shop'

  // On mobile, always use scrolled colors regardless of scroll position
  const effectiveScrolled = isScrolled

  const headerBackground = 'rgba(255,255,255,0.82)'
  const headerBorder = '1px solid rgba(255,255,255,0.76)'
  const headerShadow = effectiveScrolled
    ? '0 18px 48px rgba(40,40,36,0.15), inset 0 1px 0 rgba(255,255,255,0.94)'
    : '0 14px 40px rgba(40,40,36,0.12), inset 0 1px 0 rgba(255,255,255,0.94)'
  const headerBackdrop = 'blur(26px) saturate(175%)'

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
            className={`relative mx-auto flex w-full max-w-[1480px] items-center justify-between gap-2 rounded-md px-3 py-2.5 transition-all duration-700 ease-in-out sm:px-4 xl:gap-3 xl:px-5 ${
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
            <div className="flex min-w-0 shrink-0 items-center gap-3 xl:gap-4">
              <Link
                to={logoLink}
                className="flex shrink-0 items-center px-1 py-1 transition-opacity hover:opacity-90"
                aria-label="Kourier Boyz Home"
                style={{ height: '100%', display: 'flex', alignItems: 'center' }}
              >
                <img
                  src="/brand/kourier-boyz-logo-nav-cropped.png"
                  alt="Kourier Boyz"
                  className="h-11 w-40 object-contain sm:w-44 xl:h-12 xl:w-48"
                />
              </Link>

              <div className="hidden shrink-0 2xl:block">
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

            <div className="flex shrink-0 items-center gap-2 2xl:hidden">
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
          </div>
        </div>

        {/* Mobile/Tablet Search Bar - Part of Header */}
        <div
          className="w-full px-3 pb-2.5 pt-2 transition-all duration-500 ease-in-out sm:px-4 2xl:hidden"
          style={{
          }}
        >
          <div
            className="rounded-md px-3 py-3 shadow-lg"
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

const Header: React.FC = () => {
  const location = useLocation()
  return isShopPath(location.pathname) ? <StoreHeader /> : <PlatformHeader />
}

export default Header
