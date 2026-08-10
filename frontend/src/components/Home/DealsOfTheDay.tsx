import { Card, CardContent } from '@/components/ui/card'
import { AuroraBackground } from '@/components/ui/shadcn-io/aurora-background'
import { getProductDisplayInfo } from '@/utils/productDisplay'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Clock,
  Heart,
  Zap,
} from 'lucide-react'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Product } from '../../api/products'
import { useDealsProducts } from '../../api/products'
import { demoProducts } from './demoStoreData'

// Countdown Timer Component
const CountdownTimer: React.FC<{ endDate?: string }> = ({ endDate }) => {
  const [timeLeft, setTimeLeft] = useState('')

  useEffect(() => {
    if (!endDate) {
      setTimeLeft('23:59:59') // Default fallback
      return
    }

    const calculateTimeLeft = () => {
      const end = new Date(endDate).getTime()
      const now = new Date().getTime()
      const difference = end - now

      if (difference <= 0) {
        setTimeLeft('0 hours')
        return
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24))
      const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((difference % (1000 * 60)) / 1000)

      if (days > 0) {
        setTimeLeft(
          `${days}d ${hours.toString().padStart(2, '0')}h ${minutes
            .toString()
            .padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`,
        )
      } else if (hours > 0) {
        setTimeLeft(
          `${hours}h ${minutes.toString().padStart(2, '0')}m ${seconds
            .toString()
            .padStart(2, '0')}s`,
        )
      } else {
        setTimeLeft(`${minutes}m ${seconds.toString().padStart(2, '0')}s`)
      }
    }

    calculateTimeLeft()
    const interval = setInterval(calculateTimeLeft, 1000)

    return () => clearInterval(interval)
  }, [endDate])

  return <span className="font-bold text-orange-600">{timeLeft}</span>
}

// Deal Card Component
const DealCard: React.FC<{
  deal: Product
  onViewDeal: (slug: string) => void
}> = ({ deal, onViewDeal }) => {
  const [isFavorite, setIsFavorite] = useState(false)
  const displayInfo = useMemo(() => getProductDisplayInfo(deal), [deal])
  const derivedDiscount =
    displayInfo.comparePrice && displayInfo.comparePrice > displayInfo.price
      ? Math.round(
          ((displayInfo.comparePrice - displayInfo.price) / displayInfo.comparePrice) * 100,
        )
      : 0
  const discount = deal.discountPercent || derivedDiscount
  const actualPrice = displayInfo.price
  const originalPrice = displayInfo.comparePrice || displayInfo.price

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      viewport={{ once: true }}
    >
      <Card className="group relative border-0 overflow-hidden cursor-pointer flex flex-col h-full rounded-2xl shadow-md hover:shadow-2xl transition-all duration-300 border-orange-100 hover:border-orange-400">
        {/* Top Section - Product Image */}
        <div className="relative h-48 bg-white overflow-hidden">
          {/* Discount Badge */}
          {discount > 0 && (
            <motion.div
              className="absolute inset-x-0 bottom-3 z-20 flex justify-center"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1, y: [0, -3, 0] }}
              transition={{
                delay: 0.15,
                duration: 0.45,
                ease: 'easeOut',
                y: { duration: 2.6, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' },
              }}
            >
              <div className="relative flex items-center justify-center">
                {/* Soft Gradient Glow Background */}
                <div className="relative flex items-center justify-center">
                  {/* Soft Glow */}
                  <div className="absolute  inset-0  bg-linear-to-r from-orange-400/30 via-red-400/20 to-pink-400/30 blur-sm opacity-60 group-hover:opacity-80 transition-opacity duration-300" />

                  {/* Main Badge */}
                  <div className="relative flex items-center gap-1.5 border border-white/20 rounded-2xl bg-linear-to-r from-orange-500/90 to-red-600/90 px-2 py-0.5 backdrop-blur-md text-white shadow-sm shadow-orange-500/20">
                    <Zap className="h-3 w-3 text-white opacity-90" />
                    <span className="text-[10px] font-semibold tracking-wide">{discount}% OFF</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Heart Icon */}
          <motion.button
            onClick={(e) => {
              e.stopPropagation()
              setIsFavorite(!isFavorite)
            }}
            className="absolute top-3 right-3 z-20 p-1 bg-white/90 backdrop-blur-sm rounded-full hover:bg-white transition-all shadow-md hover:scale-110"
            whileTap={{ scale: 0.9 }}
          >
            <Heart
              className={`w-4 h-4 ${isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-600'}`}
            />
          </motion.button>

          {/* Product Image */}
          <div className="relative h-full w-full p-4">
            <img
              src={displayInfo.image}
              alt={deal.name}
              className="w-full h-full object-cover rounded-2xl drop-shadow-lg group-hover:scale-105 transition-transform duration-500"
            />
          </div>
        </div>

        {/* Bottom Section */}
        <CardContent className="flex-1 flex flex-col p-4 bg-white">
          {/* Product Name (clamped to 2 lines) */}
          <h3
            className="text-sm font-bold text-gray-900 mb-2 leading-tight line-clamp-2"
            style={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              minHeight: '40px', // keeps layout consistent
            }}
          >
            {deal.name}
          </h3>

          {/* Price + Save */}
          <div className="mt-auto flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-gray-900">
                ₹{actualPrice.toLocaleString()}
              </span>
              {originalPrice > actualPrice && (
                <>
                  <span className="text-xs text-gray-400 line-through">
                    ₹{originalPrice.toLocaleString()}
                  </span>
                  <span className="text-xs font-bold text-red-600">
                    Save ₹{(originalPrice - actualPrice).toLocaleString()}
                  </span>
                </>
              )}
            </div>

            {/* View Deal Button */}
            <motion.button
              className="cursor-pointer w-full py-2 bg-linear-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-bold text-sm rounded-full shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2 group/button"
              whileTap={{ scale: 0.95 }}
              onClick={() => onViewDeal(deal.slug)}
            >
              <span>View Deal</span>
              <ArrowUpRight className="w-4 h-4 transition-transform duration-300 group-hover/button:translate-x-1 group-hover/button:-translate-y-1" />
            </motion.button>
          </div>
        </CardContent>

        {/* Hover Glow */}
        <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="absolute inset-0 bg-linear-to-br from-orange-500/5 to-red-600/5 rounded-2xl" />
        </div>
      </Card>
    </motion.div>
  )
}

const DealsOfTheDay: React.FC = () => {
  const navigate = useNavigate()
  const { data } = useDealsProducts({ take: 12, scope: 'today' })
  const apiDeals = useMemo(() => data?.products || [], [data])
  const deals = useMemo(
    () => (apiDeals.length > 0 ? apiDeals : demoProducts.filter((product) => product.discountPercent)),
    [apiDeals],
  )
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const handleViewDeal = useCallback(
    (slug: string) => {
      navigate(`/product/${slug}`)
    },
    [navigate],
  )

  // Find the earliest ending deal for the countdown timer
  const earliestEndDate = deals
    .filter((deal) => deal.discountEnd)
    .sort(
      (a, b) => new Date(a.discountEnd!).getTime() - new Date(b.discountEnd!).getTime(),
    )[0]?.discountEnd

  const auroraStyle = {
    '--aurora':
      'repeating-linear-gradient(120deg,#fff7ed 10%,#fde68a 20%,#f97316 30%,#facc15 40%,#f4f4f5 50%)',
    '--white-gradient':
      'repeating-linear-gradient(120deg,rgba(255,255,255,0.95) 0%,rgba(255,255,255,0.95) 7%,rgba(255,253,244,0.7) 10%,rgba(255,253,244,0.7) 12%,rgba(255,255,255,0.9) 16%)',
    '--dark-gradient':
      'repeating-linear-gradient(120deg,rgba(15,15,15,0.1) 0%,rgba(15,15,15,0.1) 7%,transparent 10%,transparent 12%,rgba(15,15,15,0.08) 16%)',
    '--blue-300': '#fde68a',
    '--blue-400': '#fb923c',
    '--blue-500': '#f97316',
    '--indigo-300': '#facc15',
    '--violet-200': '#fef3c7',
    '--black': '#0f0f0f',
    '--white': '#ffffff',
    '--transparent': 'transparent',
  } as React.CSSProperties

  const auroraClassName =
    'h-auto min-h-0  py-8 items-stretch justify-start overflow-hidden rounded-2xl border border-orange-100/40 bg-transparent'

  const updateScrollButtons = useCallback(() => {
    const container = scrollContainerRef.current
    if (!container) {
      setCanScrollLeft(false)
      setCanScrollRight(false)
      return
    }
    const { scrollLeft, scrollWidth, clientWidth } = container
    setCanScrollLeft(scrollLeft > 8)
    setCanScrollRight(scrollWidth - clientWidth - scrollLeft > 8)
  }, [])

  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return
    updateScrollButtons()
    container.addEventListener('scroll', updateScrollButtons)
    window.addEventListener('resize', updateScrollButtons)
    return () => {
      container.removeEventListener('scroll', updateScrollButtons)
      window.removeEventListener('resize', updateScrollButtons)
    }
  }, [deals.length, updateScrollButtons])

  const scroll = (direction: 'left' | 'right') => {
    const container = scrollContainerRef.current
    if (!container) return
    const cardWidth = container.querySelector('.deal-card')?.clientWidth || 280
    const gap = 16
    const scrollAmount = cardWidth + gap
    container.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    })
  }

  if (deals.length === 0) {
    return null
  }

  return (
    <div className="">
      <AuroraBackground className={auroraClassName} style={auroraStyle}>
        <div className="relative z-10  mx-auto w-full px-4 md:px-8 py-8 md:py-10">
          {/* Header */}
          <div className="flex flex-col gap-4 mb-6 md:gap-3">
            <div className="flex items-center justify-between md:justify-start md:gap-4">
              <div className="flex items-center gap-2 bg-linear-to-r from-orange-500 to-red-600 text-white px-4 py-2 rounded-lg shadow-lg">
                <Zap className="w-5 h-5" />
                <span className="font-bold text-lg">Flash Deals</span>
              </div>
              {earliestEndDate && (
                <div className="flex items-center gap-2 bg-orange-50/80 px-4 py-2 rounded-full border border-orange-200/80 backdrop-blur-sm">
                  <Clock className="w-5 h-5 text-orange-600" />
                  <div>
                    <span className="text-xs text-gray-600">Ends in: </span>
                    <CountdownTimer endDate={earliestEndDate} />
                  </div>
                </div>
              )}
            </div>
            <button
              className="self-center md:self-end flex items-center gap-2 px-6 py-2 text-blue-600 font-semibold hover:text-blue-700 transition-colors cursor-pointer"
              onClick={() => navigate('/events/deals')}
            >
              See All Offers
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>

          <div className="relative">
            <motion.button
              type="button"
              onClick={() => scroll('left')}
              className="flex items-center justify-center absolute -left-4 md:-left-4 top-1/2 -translate-y-1/2 h-10 w-10 md:h-12 md:w-12 rounded-full bg-white shadow-lg hover:border-orange-200 disabled:opacity-0 disabled:pointer-events-none transition-all z-10"
              whileTap={{ scale: 0.9 }}
              aria-label="Scroll deals left"
              disabled={!canScrollLeft}
            >
              <ChevronLeft className="w-4 h-4 md:w-5 md:h-5" />
            </motion.button>

            <motion.button
              type="button"
              onClick={() => scroll('right')}
              className="flex items-center justify-center absolute -right-4 md:-right-4 top-1/2 -translate-y-1/2 h-10 w-10 md:h-12 md:w-12 rounded-full bg-white shadow-lg hover:text-orange-700 hover:border-orange-200 disabled:opacity-0 disabled:pointer-events-none transition-all z-10"
              whileTap={{ scale: 0.9 }}
              aria-label="Scroll deals right"
              disabled={!canScrollRight}
            >
              <ChevronRight className="w-4 h-4 md:w-5 md:h-5" />
            </motion.button>

            <div
              ref={scrollContainerRef}
              className="flex gap-4 overflow-x-auto scroll-smooth pb-4 snap-x snap-mandatory [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            >
              {deals.map((deal) => (
                <div
                  key={deal._id}
                  className="deal-card snap-start shrink-0 w-[170px] sm:w-[190px] lg:w-[240px]"
                >
                  <DealCard deal={deal} onViewDeal={handleViewDeal} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </AuroraBackground>
    </div>
  )
}

export default DealsOfTheDay
