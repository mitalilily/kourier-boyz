import React from 'react'
import { BannerLayer, ParallaxBanner } from 'react-scroll-parallax'

const HeroCinematicModern: React.FC = () => {
  const background: BannerLayer = {
    image: '/shop2.png',
    translateY: [0, 50],
    opacity: [1, 0.3],
    scale: [1, 1.15],
    shouldAlwaysCompleteAnimation: true,
  }

  const gradientOverlay: BannerLayer = {
    opacity: [0.7, 0.9],
    shouldAlwaysCompleteAnimation: true,
    expanded: false,
    children: (
      <div className="absolute inset-0 bg-gradient-to-r from-gray-900/95 via-gray-900/70 to-transparent" />
    ),
  }

  const headline: BannerLayer = {
    translateY: [0, 30],
    scale: [1, 0.95],
    opacity: [1, 0],
    shouldAlwaysCompleteAnimation: true,
    expanded: false,
    children: (
      <div className="absolute inset-0 flex flex-col items-start justify-center px-6 sm:px-10 md:px-20 lg:px-32">
        <div className="max-w-3xl">
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl text-white font-bold leading-tight mb-4 md:mb-6">
            Shop Smarter,
            <br />
            <span className="bg-gradient-to-r from-yellow via-orange-400 to-pink-500 bg-clip-text text-transparent">
              Live Better.
            </span>
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-gray-200 max-w-xl mb-6 md:mb-8 leading-relaxed">
            Discover exclusive products, unbeatable deals, and a seamless shopping experience — all
            in one place, only on <span className="font-bold text-white">Kourier Boyz</span>.
          </p>
          <button className="bg-white text-gray-900 px-8 py-3 md:px-10 md:py-4 rounded-full text-base md:text-lg font-semibold hover:bg-gray-100 hover:shadow-2xl transition-all duration-300 hover:scale-105">
            Start Exploring →
          </button>
        </div>
      </div>
    ),
  }

  return (
    <div className="relative z-10" style={{ isolation: 'isolate' }}>
      <ParallaxBanner
        layers={[background, gradientOverlay, headline]}
        className="h-[100vh] w-full bg-gray-900"
        style={{ willChange: 'transform' }}
      />
    </div>
  )
}

export default HeroCinematicModern
