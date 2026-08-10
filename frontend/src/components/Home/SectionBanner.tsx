import { useBanners } from '@/api/banners'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { BannerLayer, ParallaxBanner } from 'react-scroll-parallax'
import { demoSectionBanners } from './demoStoreData'

interface SectionBannerProps {
  position: 'deals' | 'fashion' | 'trending' | 'featured' | 'newsletter'
  className?: string
}

const SectionBanner: React.FC<SectionBannerProps> = ({ position, className }) => {
  const { data } = useBanners(position)
  const apiBanners = data?.banners || []
  const banners = apiBanners.length > 0 ? apiBanners : demoSectionBanners[position]
  const [currentIndex, setCurrentIndex] = useState(0)

  // Auto-rotate banners if multiple exist
  useEffect(() => {
    if (banners.length <= 1) return

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % banners.length)
    }, 5000) // Change every 5 seconds

    return () => clearInterval(interval)
  }, [banners.length])

  if (banners.length === 0) {
    return null
  }

  // Create parallax layers for a banner
  const createBannerLayers = (banner: (typeof banners)[0]): BannerLayer[] => {
    const background: BannerLayer = {
      image: banner.image,
      translateY: [0, 30],
      opacity: [1, 0.9],
      scale: [1, 1.03],
      shouldAlwaysCompleteAnimation: true,
    }

    const gradientOverlay: BannerLayer = {
      opacity: [0.6, 0.4],
      shouldAlwaysCompleteAnimation: true,
      expanded: false,
      children: (
        <div className="absolute inset-0 bg-linear-to-r from-black/60 via-black/40 to-transparent" />
      ),
    }

    const content: BannerLayer = {
      translateY: [0, 15],
      scale: [1, 0.99],
      opacity: [1, 1],
      shouldAlwaysCompleteAnimation: true,
      expanded: false,
      children: (
        <div className="absolute inset-0 flex items-center justify-start px-4 md:px-12">
          <div>
            {banner.title && (
              <h3 className="text-2xl md:text-4xl font-bold text-white mb-2 drop-shadow-lg">
                {banner.title}
              </h3>
            )}
            {banner.subtitle && (
              <p className="text-lg md:text-xl text-white/90 mb-4 drop-shadow-md">
                {banner.subtitle}
              </p>
            )}
            {banner.link && banner.linkText && (
              <span className="inline-block px-6 py-2 bg-white text-gray-900 rounded-full font-semibold hover:bg-gray-100 transition-all duration-300 group-hover:scale-105">
                {banner.linkText} →
              </span>
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
    <div className="px-4 md:px-8 my-8">
      <div className={`relative w-full overflow-hidden rounded-2xl group ${className || ''}`}>
        <ParallaxBanner
          layers={layers}
          className="w-full h-full"
          style={{
            willChange: 'transform',
          }}
        />

        {/* CSS for high-quality image rendering */}
        <style>{`
        .parallax-banner img {
          image-rendering: auto;
          image-rendering: crisp-edges;
          image-rendering: -webkit-optimize-contrast;
          object-fit: cover;
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
                  index === currentIndex
                    ? 'bg-white w-8 shadow-lg'
                    : 'bg-white/50 hover:bg-white/75'
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
              onClick={() =>
                setCurrentIndex((prev) => (prev - 1 + banners.length) % banners.length)
              }
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
    </div>
  )
}

export default SectionBanner
