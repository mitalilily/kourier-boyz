import { useEffect, useState } from 'react'
import { ParallaxProvider } from 'react-scroll-parallax'
import { useProfile } from '../../api/auth'
import { useAuthStore } from '../../store/authStore'
import AdditionalCategoryHighlights from './AdditionalCategoryHighlights'
import BannerCarousel from './BannerCarousel'
import BestSellers from './BestSellers'
import BirthdayRecap from './BirthdayRecap'
import CategoryHighlights from './CategoryHighlights'
import DealsOfTheDay from './DealsOfTheDay'
import FashionSection from './FashionSection'
import LatestBlogPosts from './LatestBlogPosts'
import NewArrivals from './NewArrivals'
import QuickLinks from './QuickLinks'
import RecentlyViewedProducts from './RecentlyViewedProducts'
import RecommendedProducts from './RecommendedProducts'
import SectionBanner from './SectionBanner'
import TopCategoriesSection from './TopCategoriesSection'
import TrendingProducts from './TrendingProducts'

const Home = () => {
  const { isAuthenticated } = useAuthStore()
  const { data: profile } = useProfile()
  const [showBirthdayRecap, setShowBirthdayRecap] = useState(false)
  const [hasSeenBirthdayRecap, setHasSeenBirthdayRecap] = useState(false)

  // Check if it's the user's birthday and show recap once per day
  useEffect(() => {
    if (!isAuthenticated || !profile?.dateOfBirth) {
      return
    }

    // Check if user has already seen the birthday recap today
    const today = new Date().toDateString()
    const lastSeenKey = `birthday-recap-${profile._id}-${today}`
    const lastSeen = localStorage.getItem(lastSeenKey)

    if (lastSeen === 'true') {
      setHasSeenBirthdayRecap(true)
      setShowBirthdayRecap(false)
      return
    }

    try {
      const birthDate = new Date(profile.dateOfBirth)
      const currentDate = new Date()

      // Check if month and day match (ignore year)
      const isBirthday =
        birthDate.getMonth() === currentDate.getMonth() &&
        birthDate.getDate() === currentDate.getDate()

      if (isBirthday) {
        setShowBirthdayRecap(true)
      }
    } catch (error) {
      console.error('Error checking birthday:', error)
    }
  }, [isAuthenticated, profile])

  const handleCloseBirthdayRecap = () => {
    setShowBirthdayRecap(false)
    if (profile?._id) {
      const today = new Date().toDateString()
      const lastSeenKey = `birthday-recap-${profile._id}-${today}`
      localStorage.setItem(lastSeenKey, 'true')
      setHasSeenBirthdayRecap(true)
    }
  }

  return (
    <ParallaxProvider>
      <>
        <style>{`
          .home-page-container {
            margin-top: var(--banner-height, 0px);
            transition: margin-top 0.3s ease-in-out;
          }
        `}</style>
        <div className="home-page-container min-h-screen">
        {/* Birthday Recap Modal - Show once per day if it's the user's birthday */}
        {isAuthenticated && (
          <BirthdayRecap
            userName={profile?.name}
            open={showBirthdayRecap && !hasSeenBirthdayRecap}
            onOpenChange={handleCloseBirthdayRecap}
          />
        )}

        {/* Hero Banner with Offers */}
        <BannerCarousel />

        {/* Quick Links */}
        <QuickLinks />

        {/* Top Categories */}
        <TopCategoriesSection />

        {/* Section Banner for Deals */}
        <SectionBanner position="deals" className="h-72 md:h-[50vh]" />

        {/* Deals of the Day */}
        <DealsOfTheDay />

        {/* New Arrivals */}
        <NewArrivals />

        {/* Best Sellers */}
        <BestSellers />

        {/* Category Highlights Grid */}
        <CategoryHighlights />

        {/* Additional Category Highlights */}
        <AdditionalCategoryHighlights />

        {/* Recommended */}
        <RecommendedProducts />

        {/* Section Banner for Fashion */}
        <SectionBanner position="fashion" className="h-72 md:h-96" />

        {/* Fashion Section */}
        <FashionSection />

        {/* Section Banner for Trending */}
        <SectionBanner position="trending" className="h-72 md:h-96" />

        {/* Trending Products */}
        <TrendingProducts />

        {/* Recently Viewed */}
        <RecentlyViewedProducts />

        {/* Latest Blog Posts */}
        <LatestBlogPosts />

        {/* Featured Brands */}
        {/* <FeaturedBrands /> */}
      </div>
      </>
    </ParallaxProvider>
  )
}

export default Home
