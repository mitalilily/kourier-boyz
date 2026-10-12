import { useBanners } from '@/api/banners'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, ChevronLeft, ChevronRight, PackagePlus, Store } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

const BannerCarousel: React.FC = () => {
  const { data } = useBanners('hero')
  const banners = data?.banners || []
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    if (banners.length <= 1) return
    const interval = window.setInterval(
      () => setCurrentIndex((current) => (current + 1) % banners.length),
      6500,
    )
    return () => window.clearInterval(interval)
  }, [banners.length])

  if (banners.length === 0) {
    return (
      <section className="kb-store-hero relative flex min-h-[430px] w-full items-center overflow-hidden bg-[#1d1d1c] px-5 pt-20 text-white md:min-h-[540px] sm:px-8 lg:px-10">
        <div className="absolute inset-0 opacity-50 [background-image:linear-gradient(115deg,transparent_0%,transparent_48%,rgba(223,183,67,0.2)_48%,rgba(223,183,67,0.2)_49%,transparent_49%),radial-gradient(circle_at_82%_25%,rgba(255,255,255,0.15),transparent_26%)]" />
        <div className="relative mx-auto w-full max-w-7xl">
          <span className="kb-kicker text-[#dfb743]">Kourier Boyz Marketplace</span>
          <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">
            A fresh marketplace is taking shape.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-white/75">
            Products published by approved sellers will appear here. Sellers can start building their catalogue today.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/become-a-seller" className="kb-button kb-button-gold"><PackagePlus className="h-5 w-5" /> Open your store</Link>
            <Link to="/" className="kb-button border border-white/30 bg-white/5 text-white"><Store className="h-5 w-5" /> Kourier Boyz home <ArrowRight className="h-4 w-4" /></Link>
          </div>
        </div>
      </section>
    )
  }

  const currentBanner = banners[currentIndex]

  return (
    <section className="kb-store-hero group relative h-[430px] w-full overflow-hidden bg-[#1d1d1c] md:h-[540px]">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentBanner._id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45 }}
          className="absolute inset-0"
        >
          <img src={currentBanner.image} alt="" className="h-full w-full object-cover object-center" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(24,24,23,0.92)_0%,rgba(24,24,23,0.75)_42%,rgba(24,24,23,0.12)_80%)]" />
          <div className="absolute inset-0 mx-auto flex max-w-7xl items-center px-5 pt-20 sm:px-8 lg:px-10">
            <div className="max-w-2xl text-white">
              <span className="kb-kicker text-[#dfb743]">Kourier Boyz Marketplace</span>
              {currentBanner.title && <h1 className="mt-4 text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">{currentBanner.title}</h1>}
              {currentBanner.subtitle && <p className="mt-5 max-w-xl text-lg leading-8 text-white/75">{currentBanner.subtitle}</p>}
              {currentBanner.link && <Link to={currentBanner.link} className="kb-button kb-button-gold mt-7">{currentBanner.linkText || 'Shop now'} <span aria-hidden="true">→</span></Link>}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {banners.length > 1 && (
        <>
          <div className="absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 gap-2">
            {banners.map((banner, index) => <button key={banner._id} onClick={() => setCurrentIndex(index)} className={`h-1.5 transition-all ${index === currentIndex ? 'w-9 bg-[#dfb743]' : 'w-4 bg-white/45'}`} aria-label={`Show banner ${index + 1}`} />)}
          </div>
          <button onClick={() => setCurrentIndex((currentIndex - 1 + banners.length) % banners.length)} className="absolute left-4 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center border border-white/25 bg-black/30 text-white backdrop-blur-sm transition hover:bg-black/55 sm:flex" aria-label="Previous banner"><ChevronLeft className="h-5 w-5" /></button>
          <button onClick={() => setCurrentIndex((currentIndex + 1) % banners.length)} className="absolute right-4 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center border border-white/25 bg-black/30 text-white backdrop-blur-sm transition hover:bg-black/55 sm:flex" aria-label="Next banner"><ChevronRight className="h-5 w-5" /></button>
        </>
      )}
    </section>
  )
}

export default BannerCarousel
