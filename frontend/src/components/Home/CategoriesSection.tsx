import { Carousel, CarouselContent, CarouselItem } from '@/components/ui/carousel'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import React, { useRef } from 'react'
import DealCard from '../ui/DealCard'
import SectionHeading from '../ui/SectionHeading'
import { CategoryDeals } from './TopDeals'

export const CategorySection: React.FC<CategoryDeals> = ({ category, deals }) => {
  const carouselContentRef = useRef<HTMLDivElement>(null)

  const handlePrev = () => {
    if (!carouselContentRef.current) return
    const width = carouselContentRef.current.clientWidth
    carouselContentRef.current.scrollBy({ left: -width, behavior: 'smooth' })
  }

  const handleNext = () => {
    if (!carouselContentRef.current) return
    const width = carouselContentRef.current.clientWidth
    carouselContentRef.current.scrollBy({ left: width, behavior: 'smooth' })
  }

  return (
    <section className="relative flex flex-col items-center rounded-t-[3rem] w-full">
      <SectionHeading align="left" title={`Top Deals on ${category}`} italicPart={category} />

      <div className="relative w-full flex items-center justify-center group">
        {/* Carousel container */}
        <div className="w-full  overflow-hidden relative z-0">
          <Carousel>
            <CarouselContent
              ref={carouselContentRef}
              className="flex gap-6 overflow-x-auto overflow-y-hidden scrollbar-none"
            >
              {deals.map((item, index) => (
                <CarouselItem
                  key={`${item.name} ${index}`}
                  className="flex-shrink-0 basis-1/3 md:basis-1/4 lg:basis-1/5"
                >
                  <DealCard
                    name={item.name}
                    sellingPrice={item.sellingPrice}
                    originalPrice={item.originalPrice}
                    image={item.image}
                  />
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
        </div>

        {/* Prev Button */}
        <button
          onClick={handlePrev}
          className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full z-20 p-3 rounded-full bg-white/20 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300 hover:bg-white/40"
        >
          <ChevronLeft className="w-6 h-6 text-gray-800" />
        </button>

        {/* Next Button */}
        <button
          onClick={handleNext}
          className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-full z-20 p-3 rounded-full bg-white/20 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300 hover:bg-white/40"
        >
          <ChevronRight className="w-6 h-6 text-gray-800" />
        </button>
      </div>
    </section>
  )
}
