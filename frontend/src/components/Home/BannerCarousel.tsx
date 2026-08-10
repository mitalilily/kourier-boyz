import { useBanners } from '@/api/banners'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { BannerLayer, ParallaxBanner } from 'react-scroll-parallax'

const BannerCarousel: React.FC = () => {
  const { data, isLoading } = useBanners('hero')
  const banners = data?.banners || []
  const [currentIndex, setCurrentIndex] = useState(0)

  // Auto-rotate banners if multiple exist
  useEffect(() => {
    if (banners.length <= 1) return

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % banners.length)
    }, 5000) // Change every 5 seconds

    return () => clearInterval(interval)
  }, [banners.length])

  if (isLoading) {
    return (
      <div className="bg-white w-full">
        <div className="h-[400px]  lg:h-[510px] bg-gray-200 animate-pulse" />
      </div>
    )
  }

  if (banners.length === 0) {
    return null
  }

  // Create parallax layers for a banner
  const createBannerLayers = (banner: (typeof banners)[0]): BannerLayer[] => {
    const background: BannerLayer = {
      image: banner.image,
      translateY: [0, 40],
      opacity: [1, 0.8],
      scale: [1, 1.05],
      shouldAlwaysCompleteAnimation: true,
    }

    const gradientOverlay: BannerLayer = {
      opacity: [0.6, 0.4],
      shouldAlwaysCompleteAnimation: true,
      expanded: false,
      children: (
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-black/30" />
      ),
    }

    const content: BannerLayer = {
      translateY: [0, 20],
      scale: [1, 0.98],
      opacity: [1, 1],
      shouldAlwaysCompleteAnimation: true,
      expanded: false,
      children: (
        <div className="absolute inset-0 flex flex-col items-start justify-center px-8 md:px-16 lg:px-32">
          <div className="max-w-3xl">
            {banner.title && (
              <h2 className="text-3xl md:text-5xl lg:text-6xl font-bold text-white mb-4 drop-shadow-2xl">
                {banner.title}
              </h2>
            )}
            {banner.subtitle && (
              <p className="text-lg md:text-2xl text-white/95 mb-6 drop-shadow-xl">
                {banner.subtitle}
              </p>
            )}
            {banner.link && (
              <a
                href={banner.link}
                className="inline-block px-8 py-3 md:px-10 md:py-4 bg-white text-gray-900 rounded-full font-semibold hover:bg-gray-100 hover:shadow-2xl transition-all duration-300 hover:scale-105 drop-shadow-lg"
              >
                {banner.linkText || 'Shop Now'} →
              </a>
            )}
          </div>
        </div>
      ),
    }

    return [background, gradientOverlay, content]
  }

  // Get current banner
  const currentBanner = banners[currentIndex]
  const layers = createBannerLayers(currentBanner)

  return (
    <div className="relative w-full overflow-hidden group h-[400px] md:h-[510px]">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="absolute inset-0"
        >
          <ParallaxBanner
            layers={layers}
            className="h-full w-full"
            style={{
              willChange: 'transform',
            }}
          />
        </motion.div>
      </AnimatePresence>

      {/* --- FIX: Ensure images don't get cropped --- */}
      <style>{`
        .parallax-banner img {
          image-rendering: auto;
          image-rendering: crisp-edges;
          image-rendering: -webkit-optimize-contrast;
          object-fit: contain; /* keeps full image visible */
          background-color: #000; /* fills any empty space gracefully */
          width: 100%;
          height: 100%;
        }
      `}</style>

      {/* Navigation dots */}
      {banners.length > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-3 z-20">
          {banners.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`w-3 h-3 rounded-full transition-all duration-300 ${
                index === currentIndex ? 'bg-white w-8 shadow-lg' : 'bg-white/50 hover:bg-white/75'
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      )}

      {/* Navigation arrows */}
      {banners.length > 1 && (
        <>
          <button
            onClick={() => setCurrentIndex((prev) => (prev - 1 + banners.length) % banners.length)}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/90 backdrop-blur-sm shadow-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 hover:bg-white hover:scale-110 z-20"
            aria-label="Previous banner"
          >
            <ChevronLeft className="w-6 h-6 text-gray-900" />
          </button>
          <button
            onClick={() => setCurrentIndex((prev) => (prev + 1) % banners.length)}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/90 backdrop-blur-sm shadow-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 hover:bg-white hover:scale-110 z-20"
            aria-label="Next banner"
          >
            <ChevronRight className="w-6 h-6 text-gray-900" />
          </button>
        </>
      )}
    </div>
  )
}

export default BannerCarousel
