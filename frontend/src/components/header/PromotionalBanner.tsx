import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { getActiveAnnouncements, type Announcement } from '../../api/announcements'
import { useAuthStore } from '../../store/authStore'

const marketplaceOffer: Announcement = {
  _id: 'marketplace-launch-offer',
  title: 'Marketplace launch offer',
  message: 'Up to 35% off selected fashion, home, and tech picks',
  link: '/shop-by-category',
  linkText: 'Explore the offer',
  backgroundColor: '#d8af3d',
  textColor: '#171717',
  isActive: true,
  dismissible: false,
  targetAudience: 'all',
  createdAt: '2026-08-10T00:00:00.000Z',
  updatedAt: '2026-08-10T00:00:00.000Z',
}

export const PromotionalBanner: React.FC = () => {
  const { isAuthenticated } = useAuthStore()
  const [announcements, setAnnouncements] = useState<Announcement[]>([marketplaceOffer])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [, setBannerHeight] = useState(0)
  // Measure and store banner height dynamically - MUST be before early returns
  const bannerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        const data = await getActiveAnnouncements(isAuthenticated)

        if (data.announcements && data.announcements.length > 0) {
          // Filter out dismissed announcements, but show them again if they were updated after dismissal
          const validAnnouncements = data.announcements.filter((announcement) => {
            const dismissedKey = `announcement_dismissed_${announcement._id}`
            const dismissedData = localStorage.getItem(dismissedKey)
            
            // If not dismissed, show it
            if (!dismissedData) return true
            
            try {
              // Parse dismissal data (stored as JSON with timestamp and updatedAt)
              const dismissal = JSON.parse(dismissedData)
              
              // If announcement was updated after dismissal, clear dismissal and show it
              if (announcement.updatedAt && dismissal.updatedAt) {
                const announcementUpdatedAt = new Date(announcement.updatedAt).getTime()
                const dismissalUpdatedAt = new Date(dismissal.updatedAt).getTime()
                
                // If announcement was updated after dismissal, clear dismissal
                if (announcementUpdatedAt > dismissalUpdatedAt) {
                  localStorage.removeItem(dismissedKey)
                  return true // Show the announcement
                }
              }
              
              // Check if it's the old format (just 'true')
              if (dismissedData === 'true') {
                // For old format, we can't compare, so we'll show it if announcement was recently updated
                // (within last hour, assume it might have been updated)
                if (announcement.updatedAt) {
                  const announcementUpdatedAt = new Date(announcement.updatedAt).getTime()
                  const oneHourAgo = Date.now() - 60 * 60 * 1000
                  // If updated recently, clear old dismissal and show
                  if (announcementUpdatedAt > oneHourAgo) {
                    localStorage.removeItem(dismissedKey)
                    return true
                  }
                }
              }
              
              // Still dismissed and not updated
              return false
            } catch {
              // If parsing fails, treat as old format
              if (dismissedData === 'true') {
                // For old format, check if announcement was updated recently
                if (announcement.updatedAt) {
                  const announcementUpdatedAt = new Date(announcement.updatedAt).getTime()
                  const oneHourAgo = Date.now() - 60 * 60 * 1000
                  if (announcementUpdatedAt > oneHourAgo) {
                    localStorage.removeItem(dismissedKey)
                    return true
                  }
                }
              }
              return false
            }
          })

          setAnnouncements([marketplaceOffer, ...validAnnouncements])
        }
      } catch (error) {
        console.error('Error fetching announcements:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchAnnouncements()
  }, [isAuthenticated])

  // Auto-rotate announcements every 5 seconds if multiple exist
  useEffect(() => {
    if (announcements.length <= 1) return

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev < announcements.length - 1 ? prev + 1 : 0))
    }, 5000)

    return () => clearInterval(interval)
  }, [announcements.length])

  // Measure and store banner height dynamically
  useEffect(() => {
    const updateHeight = () => {
      if (bannerRef.current && announcements.length > 0 && !isLoading) {
        const height = bannerRef.current.offsetHeight
        setBannerHeight(height)
        document.documentElement.style.setProperty('--banner-height', `${height}px`)
      } else {
        setBannerHeight(0)
        document.documentElement.style.setProperty('--banner-height', '0px')
      }
    }

    updateHeight()

    // Recalculate on window resize for responsive behavior
    window.addEventListener('resize', updateHeight)
    return () => window.removeEventListener('resize', updateHeight)
  }, [announcements.length, isLoading, currentIndex])

  const handleDismiss = () => {
    if (announcements[currentIndex]) {
      const announcement = announcements[currentIndex]
      const dismissedKey = `announcement_dismissed_${announcement._id}`
      
      // Store dismissal with timestamp and announcement's updatedAt for comparison
      const dismissalData = {
        dismissedAt: new Date().toISOString(),
        updatedAt: announcement.updatedAt || announcement.createdAt || new Date().toISOString(),
      }
      localStorage.setItem(dismissedKey, JSON.stringify(dismissalData))

      // Remove dismissed announcement
      const remaining = announcements.filter((_, idx) => idx !== currentIndex)
      setAnnouncements(remaining)

      // Adjust index if needed
      if (remaining.length > 0 && currentIndex >= remaining.length) {
        setCurrentIndex(remaining.length - 1)
      } else if (remaining.length === 0) {
        setCurrentIndex(0)
      }
    }
  }

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : announcements.length - 1))
  }


  if (isLoading || announcements.length === 0) {
    return null
  }

  const currentAnnouncement = announcements[currentIndex]
  if (!currentAnnouncement) return null

  const bannerStyle = {
    backgroundColor: currentAnnouncement.backgroundColor || '#FFE14B',
    color: currentAnnouncement.textColor || '#000000',
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        ref={bannerRef}
        key={currentAnnouncement._id}
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -50, opacity: 0 }}
        transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
        className="fixed top-0 left-0 right-0 w-full z-60 shadow-sm overflow-hidden"
        style={bannerStyle}
        onAnimationComplete={() => {
          // Re-measure height after animation
          if (bannerRef.current) {
            const height = bannerRef.current.offsetHeight
            setBannerHeight(height)
            document.documentElement.style.setProperty('--banner-height', `${height}px`)
          }
        }}
      >
        {/* Animated background gradient overlay */}
        <motion.div
          className="absolute inset-0 opacity-10"
          style={{
            background: `linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)`,
          }}
          animate={{
            x: ['-100%', '200%'],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: 'linear',
          }}
        />

        <div className="relative flex items-center justify-center py-2 md:py-2.5 px-2 sm:px-3 md:px-4 min-h-[40px] md:min-h-[44px]">
          {/* Content Container */}
          <div className="flex items-center justify-center gap-2 sm:gap-3 max-w-7xl w-full mx-auto px-2 sm:px-3 md:px-4">
            {/* Navigation Arrows (only for multiple) */}
            {announcements.length > 1 && (
              <motion.button
                onClick={handlePrevious}
                className="absolute left-1 sm:left-2 md:left-4 top-1/2 -translate-y-1/2 p-1 sm:p-1.5 hover:bg-black/10 rounded-full transition-all opacity-70 hover:opacity-100 z-10 flex-shrink-0"
                aria-label="Previous announcement"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
              >
                <ChevronLeft size={14} className="sm:w-4 sm:h-4" />
              </motion.button>
            )}

            {/* Main Content */}
            <div className="flex items-center justify-center gap-1.5 sm:gap-2 md:gap-2.5 flex-wrap text-center relative z-10 px-6 sm:px-8 md:px-12 flex-1 min-w-0">
              {currentAnnouncement.message ? (
                <>
                  <motion.span
                    className="font-bold text-xs sm:text-sm md:text-base tracking-tight truncate max-w-full"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1, duration: 0.4 }}
                    title={currentAnnouncement.title}
                  >
                    {currentAnnouncement.title}
                  </motion.span>
                  <motion.span
                    className="hidden sm:inline opacity-70"
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 0.7, scale: 1 }}
                    transition={{ delay: 0.2, duration: 0.3 }}
                  >
                    •
                  </motion.span>
                  <motion.span
                    className="text-[10px] sm:text-xs md:text-sm font-medium opacity-90 line-clamp-1 max-w-[200px] sm:max-w-none"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 0.9, x: 0 }}
                    transition={{ delay: 0.15, duration: 0.4 }}
                    title={currentAnnouncement.message}
                  >
                    {currentAnnouncement.message}
                  </motion.span>
                </>
              ) : (
                <motion.span
                  className="font-bold text-xs sm:text-sm md:text-base tracking-tight truncate max-w-full"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1, duration: 0.4 }}
                  title={currentAnnouncement.title}
                >
                  {currentAnnouncement.title}
                </motion.span>
              )}

              {currentAnnouncement.link && (
                <>
                  <motion.span
                    className="hidden sm:inline opacity-50"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.5 }}
                    transition={{ delay: 0.25, duration: 0.3 }}
                  >
                    •
                  </motion.span>
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3, duration: 0.4 }}
                    className="flex-shrink-0"
                  >
                    <Link
                      to={currentAnnouncement.link}
                      className="text-[10px] sm:text-xs md:text-sm font-bold underline hover:no-underline transition-all decoration-2 underline-offset-2 relative group whitespace-nowrap"
                      style={{ color: currentAnnouncement.textColor || '#000000' }}
                    >
                      <motion.span whileHover={{ scale: 1.05 }} className="inline-block">
                        {currentAnnouncement.linkText || 'Shop Now'}
                      </motion.span>
                      <motion.span
                        className="absolute bottom-0 left-0 w-0 h-0.5 bg-current group-hover:w-full transition-all duration-300"
                        initial={{ width: 0 }}
                        whileHover={{ width: '100%' }}
                      />
                    </Link>
                  </motion.div>
                </>
              )}
            </div>

            {/* Right Side Controls */}
            <div className="absolute right-1 sm:right-2 md:right-4 top-1/2 -translate-y-1/2 flex items-center gap-1 sm:gap-2 z-10 flex-shrink-0">
              {/* Dots Indicator (only for multiple) */}
              {announcements.length > 1 && (
                <motion.div
                  className="hidden sm:flex gap-1 sm:gap-1.5 mr-0 sm:mr-1"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                >
                  {announcements.map((_, idx) => (
                    <motion.button
                      key={idx}
                      onClick={() => setCurrentIndex(idx)}
                      className={`h-1 rounded-full ${
                        idx === currentIndex ? 'opacity-100' : 'opacity-40'
                      }`}
                      style={{ backgroundColor: currentAnnouncement.textColor || '#000000' }}
                      aria-label={`Go to announcement ${idx + 1}`}
                      initial={{ width: idx === currentIndex ? 20 : 4 }}
                      animate={{
                        width: idx === currentIndex ? 20 : 4,
                        opacity: idx === currentIndex ? 1 : 0.4,
                      }}
                      whileHover={{ scale: 1.2, opacity: 0.8 }}
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                    />
                  ))}
                </motion.div>
              )}

              {/* Dismiss Button */}
              {currentAnnouncement.dismissible && (
                <motion.button
                  onClick={handleDismiss}
                  className="p-1 sm:p-1.5 hover:bg-black/10 rounded-full transition-all opacity-70 hover:opacity-100 relative z-10"
                  aria-label="Dismiss announcement"
                  initial={{ opacity: 0, rotate: -90 }}
                  animate={{ opacity: 0.7, rotate: 0 }}
                  transition={{ delay: 0.35, duration: 0.3 }}
                  whileHover={{ scale: 1.15, opacity: 1, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <X size={14} className="sm:w-4 sm:h-4" />
                </motion.button>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
