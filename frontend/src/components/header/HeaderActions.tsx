import { useProfile } from '@/api/auth'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Clock, Heart, LogOut, Package, ShoppingCart, User } from 'lucide-react'
import React, { type RefObject, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { NotificationBell } from './NotificationBell'
import SearchBar from './SearchBar'

interface HeaderActionsProps {
  searchQuery: string
  onSearchChange: (value: string) => void
  searchInputRef: RefObject<HTMLInputElement>
  textClass: string
  isLightBg: boolean
  isScrolled: boolean
  isAuthenticated: boolean
  cartCount: number
  userName?: string | null
  userEmail?: string | null
  onLogout: () => void
  pathname: string
}

export const HeaderActions: React.FC<HeaderActionsProps> = ({
  searchQuery,
  onSearchChange,
  searchInputRef,
  textClass,
  isLightBg,
  isScrolled,
  isAuthenticated,
  cartCount,
  userName,
  userEmail,
  onLogout,
  pathname,
}) => {
  const { t } = useTranslation()
  const containerRef = useRef<HTMLDivElement>(null)
  const { data: profile } = useProfile()
  const [imageError, setImageError] = useState(false)

  const profileImage = profile?.profilePhoto || profile?.profilePicture || profile?.avatar

  // Reset image error when profile changes
  useEffect(() => {
    if (profileImage) {
      setImageError(false)
    }
  }, [profileImage])

  return (
    <div className="flex min-w-0 items-center gap-2 md:gap-3">
      <div className="hidden md:flex items-center" ref={containerRef}>
        <SearchBar
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
          searchInputRef={searchInputRef}
          isLightBg={isLightBg}
          isAuthenticated={isAuthenticated}
          containerClassName="items-center"
          inputClassName="w-80 lg:w-[350px]"
        />
      </div>

      <div className="hidden md:flex items-center gap-2 rounded-[20px] border border-white/10 bg-white/6 px-2.5 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
        {/* <LanguageSelector
          buttonClassName={`${textClass} rounded-2xl px-4 py-2 text-xs font-medium transition-all duration-300 ${
            isScrolled
              ? isLightBg
                ? 'hover:bg-gray-100 hover:text-gray-900'
                : 'hover:bg-white/20'
              : 'hover:bg-white/10'
          }`}
          showLabel={false}
        /> */}

        {/* Cart Icon - Show for both guests and authenticated users */}
        <Link to="/cart" aria-label={t('navigation.cart')}>
          <div className="relative group">
            <div
              className={`relative flex h-11 w-11 items-center justify-center rounded-2xl cursor-pointer transition-all duration-300 shadow-md group-hover:-translate-y-0.5 group-hover:shadow-lg ${
                pathname === '/cart'
                  ? isLightBg
                    ? 'ring-2 ring-amber-300/60 ring-offset-2 ring-offset-slate-900'
                    : 'ring-2 ring-primary/60 ring-offset-2 ring-offset-transparent'
                  : ''
              } ${
                isLightBg
                  ? 'border border-white/12 bg-linear-to-br from-sky-500 via-blue-500 to-slate-800 text-white hover:from-sky-400 hover:via-blue-500 hover:to-slate-700'
                  : 'border border-white/20 bg-white/12 text-white hover:bg-white/18 backdrop-blur-sm'
              }`}
            >
              <ShoppingCart size={18} />
              {cartCount > 0 && (
                <span
                  className={`absolute -right-1.5 -top-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-[10px] font-bold ${
                    isLightBg ? 'bg-amber-300 text-slate-900' : 'bg-white text-gray-900'
                  }`}
                >
                  {cartCount > 99 ? '99+' : cartCount}
                </span>
              )}
            </div>
            {pathname === '/cart' && (
              <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-primary rounded-full" />
            )}
          </div>
        </Link>

        {!isAuthenticated ? (
          <>
            <Link to="/login">
              <Button
                variant="ghost"
                className={`h-11 rounded-2xl px-4 text-sm font-medium transition-all duration-300 cursor-pointer ${textClass} ${
                  isLightBg
                    ? 'border border-white/10 bg-white/6 hover:bg-white/12'
                    : 'border border-white/10 bg-white/6 hover:bg-white/14'
                }`}
              >
                {t('navigation.signIn')}
              </Button>
            </Link>
            <Link to="/register">
              <Button
                className={`h-11 rounded-2xl px-5 text-sm font-medium transition-all duration-300 shadow-lg cursor-pointer ${
                  isLightBg
                    ? 'border border-sky-300/35 bg-linear-to-r from-amber-300 via-orange-300 to-sky-300 text-slate-950 hover:brightness-105 hover:shadow-xl'
                    : 'border border-white/20 bg-white text-gray-900 hover:bg-gray-50 hover:shadow-xl'
                }`}
              >
                {t('navigation.signUp')}
              </Button>
            </Link>
          </>
        ) : (
          <>
            <NotificationBell isLightBg={isLightBg} textClass={textClass} isScrolled={isScrolled} />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <div className="relative group">
                  {profileImage && !imageError ? (
                    <div
                      className={`relative flex items-center gap-3 rounded-2xl cursor-pointer overflow-hidden border pl-1 pr-3 transition-all duration-300 shadow-md group-hover:-translate-y-0.5 group-hover:shadow-lg ${
                        isLightBg
                          ? 'border-white/12 bg-white/8'
                          : 'border-white/20 bg-white/10'
                      }`}
                      style={{ minHeight: '44px' }}
                    >
                      <img
                        src={profileImage}
                        alt={userName || 'User'}
                        className="h-9 w-9 rounded-xl object-cover"
                        onError={() => setImageError(true)}
                      />
                      <div className="hidden min-w-0 lg:block">
                        <p className="max-w-[120px] truncate text-sm font-semibold text-white">
                          {userName || t('navigation.profile')}
                        </p>
                        <p className="max-w-[120px] truncate text-[11px] text-white/65">
                          {userEmail || 'Kourier Boyz account'}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`relative flex h-11 items-center gap-3 rounded-2xl px-3 cursor-pointer transition-all duration-300 shadow-md group-hover:-translate-y-0.5 group-hover:shadow-lg ${
                        isLightBg
                          ? 'border border-white/12 bg-linear-to-br from-slate-800 via-slate-700 to-slate-900 text-white'
                          : 'border border-white/20 bg-white/12 text-white hover:bg-white/18 backdrop-blur-sm'
                      }`}
                    >
                      <User size={18} />
                      <div className="hidden text-left lg:block">
                        <p className="max-w-[120px] truncate text-sm font-semibold text-white">
                          {userName || t('navigation.profile')}
                        </p>
                        <p className="max-w-[120px] truncate text-[11px] text-white/65">
                          {userEmail || 'Kourier Boyz account'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-56 rounded-2xl backdrop-blur-xl"
                style={{
                  background: isLightBg ? 'rgba(255,255,255,0.98)' : 'rgba(255,255,255,0.95)',
                }}
              >
                <DropdownMenuLabel className="border-b border-gray-200 pb-3">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-semibold text-gray-900">{userName}</p>
                    <p className="text-xs text-gray-500 truncate">{userEmail}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuItem asChild>
                  <Link to="/profile" className="flex items-center space-x-2 cursor-pointer">
                    <User size={16} />
                    <span>{t('navigation.profile')}</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/profile/orders" className="flex items-center space-x-2 cursor-pointer">
                    <Package size={16} />
                    <span>{t('navigation.orders')}</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link
                    to="/profile/wishlist"
                    className="flex items-center space-x-2 cursor-pointer"
                  >
                    <Heart size={16} />
                    <span>{t('navigation.wishlist')}</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link
                    to="/profile/history"
                    className="flex items-center space-x-2 cursor-pointer"
                  >
                    <Clock size={16} />
                    <span>{t('navigation.history')}</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={onLogout}
                  className="text-red-600 focus:text-red-600 focus:bg-red-50 cursor-pointer"
                >
                  <LogOut size={16} className="mr-2" />
                  <span>{t('navigation.signOut')}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>
    </div>
  )
}
