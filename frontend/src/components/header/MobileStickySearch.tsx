import { useAuthStore } from '@/store/authStore'
import React, { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import SearchBar from './SearchBar'

const MobileStickySearch: React.FC = () => {
  const { isAuthenticated } = useAuthStore()
  const location = useLocation()
  const [query, setQuery] = useState('')
  const [isScrolled, setIsScrolled] = useState(false)
  const [isLightBg, setIsLightBg] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null!)

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 40)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    const handleBgCheck = () => {
      if (location.pathname.startsWith('/profile') || location.pathname.startsWith('/events')) {
        setIsLightBg(true)
        return
      }
      const threshold = 500
      setIsLightBg(window.scrollY > threshold)
    }
    window.addEventListener('scroll', handleBgCheck)
    handleBgCheck()
    return () => window.removeEventListener('scroll', handleBgCheck)
  }, [location.pathname])

  // Match header styling exactly
  const headerBackground = isLightBg
    ? 'linear-gradient(135deg, rgba(247,250,255,0.9), rgba(232,243,255,0.92))'
    : isScrolled
    ? 'rgba(255,255,255,0.12)'
    : 'rgba(255,255,255,0.08)'

  const headerBorder = isLightBg
    ? '1px solid rgba(148,163,184,0.25)'
    : isScrolled
    ? '1px solid rgba(255,255,255,0.25)'
    : '1px solid rgba(255,255,255,0.18)'

  const headerShadow = isLightBg
    ? '0 18px 40px rgba(15, 23, 42, 0.14), 0 2px 8px rgba(15, 23, 42, 0.06)'
    : isScrolled
    ? '0 8px 32px rgba(0,0,0,0.2), 0 2px 8px rgba(0,0,0,0.15)'
    : '0 4px 24px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.08)'

  const headerBackdrop = isLightBg ? 'blur(18px) saturate(180%)' : 'blur(4px) saturate(180%)'

  return (
    <>
      <div
        className="md:hidden sticky z-40 top-[96px] transition-all duration-500 ease-in-out -mt-1"
        style={{
          background: headerBackground,
          backdropFilter: headerBackdrop,
          WebkitBackdropFilter: headerBackdrop,
          borderTop: headerBorder,
          boxShadow: headerShadow,
        }}
      >
        <div className="px-4 py-2.5">
          <SearchBar
            searchQuery={query}
            onSearchChange={(v) => setQuery(v)}
            searchInputRef={inputRef}
            isLightBg={isLightBg}
            isAuthenticated={isAuthenticated}
            containerClassName="items-center"
            inputClassName="w-full"
          />
        </div>
      </div>
      {/* Spacer to avoid content being covered by the sticky bar on mobile */}
      <div className="h-14 md:hidden" />
    </>
  )
}

export default MobileStickySearch
