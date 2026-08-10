import React, { ReactNode, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import CategoriesNav from './CategoriesNav'
import FeedbackProvider from './feedback/FeedbackProvider'
import Footer from './Footer'
import Header from './Header'
import StructuredData from './SEO/StructuredData'
import MobileBottomNav from './navigation/MobileBottomNav'

interface LayoutProps {
  children: ReactNode
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation()
  const isProfilePage = location.pathname.startsWith('/profile')
  const isSellerStorefront = location.pathname.startsWith('/seller/')
  const [showHeader, setShowHeader] = useState(true)

  useEffect(() => {
    if (!isSellerStorefront) {
      setShowHeader(true)
      return
    }

    const handleScroll = () => {
      const headerHeight = 100
      const storeHeaderHeight = window.innerWidth >= 768 ? 384 : 256
      const scrollThreshold = storeHeaderHeight + headerHeight
      setShowHeader(window.scrollY < scrollThreshold)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()

    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [isSellerStorefront])

  return (
    <FeedbackProvider>
      <div className="flex flex-col min-h-screen bg-gray-50 overflow-x-hidden">
        {!isSellerStorefront && <StructuredData />}
        {showHeader && <Header />}

        {/* Only show CategoriesNav on desktop */}
        {isProfilePage && (
          <div className="hidden md:block">
            <CategoriesNav />
          </div>
        )}

        <main className="flex-1 bg-gray-50 pt-42 sm:pt-44 md:pt-0 pb-28 md:pb-0">
          {children}
        </main>
        <MobileBottomNav />
        <Footer />
      </div>
    </FeedbackProvider>
  )
}

export default Layout
