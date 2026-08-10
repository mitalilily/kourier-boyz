import React, { useEffect, useState } from 'react'
import { WavyBackground } from '../ui/shadcn-io/wavy-background'
import { CategorySection } from './CategoriesSection'

export interface Deal {
  name: string
  sellingPrice: string
  originalPrice?: string
  image: string
}

export interface CategoryDeals {
  category: string
  deals: Deal[]
}

const TopDealsCategoriesFull: React.FC = () => {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY
      setScrolled(scrollY > 1200)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const categoryDeals: CategoryDeals[] = [
    {
      category: 'Furniture',
      deals: Array.from({ length: 12 }).map((_, i) => ({
        name: `Furniture Item ${i + 1}`,
        sellingPrice: `₹${1999 + i * 100}`,
        originalPrice: `₹${2499 + i * 100}`,
        image: `/products/chair.jpg`,
      })),
    },
    {
      category: 'Electronics',
      deals: Array.from({ length: 12 }).map((_, i) => ({
        name: `Electronics Item ${i + 1}`,
        sellingPrice: `₹${1999 + i * 100}`,
        originalPrice: `₹${2499 + i * 100}`,
        image: `/image-placeholder.svg`,
      })),
    },
    {
      category: 'Fashion',
      deals: Array.from({ length: 12 }).map((_, i) => ({
        name: `Fashion Item ${i + 1}`,
        sellingPrice: `₹${1499 + i * 150}`,
        originalPrice: `₹${1999 + i * 150}`,
        image: `/products/chair.jpg`,
      })),
    },
  ]

  return (
    <section
      className={`sticky top-0 min-h-screen flex flex-col justify-center items-center overflow-hidden z-30 
        rounded-t-[4rem] transition-all duration-1000 ease-out ${
          scrolled ? '-mt-48 md:-mt-64' : 'mt-0'
        }`}
      style={{
        backgroundColor: '#fafafa',
        boxShadow: scrolled
          ? '0 -40px 80px rgba(0,0,0,0.3), 0 -15px 30px rgba(0,0,0,0.2)'
          : '0 -30px 60px rgba(0,0,0,0.2)',
        transform: scrolled ? 'scale(0.96)' : 'scale(1)',
        willChange: 'transform, margin, box-shadow',
        isolation: 'isolate',
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
      }}
    >
      {/* Subtle Grid Pattern */}
      <div
        className="absolute inset-0 opacity-[0.02] z-0"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      <div className="relative z-10 w-full text-center space-y-24 md:space-y-32 py-20 md:py-24">
        {categoryDeals.map((category, index) => (
          <div key={category.category} className="relative">
            <WavyBackground
              colors={
                index === 0
                  ? [
                      'rgba(249, 115, 22, 0.15)',
                      'rgba(239, 68, 68, 0.12)',
                      'rgba(236, 72, 153, 0.08)',
                      'rgba(217, 70, 239, 0.08)',
                    ]
                  : index === 1
                  ? [
                      'rgba(59, 130, 246, 0.15)',
                      'rgba(99, 102, 241, 0.12)',
                      'rgba(139, 92, 246, 0.08)',
                      'rgba(168, 85, 247, 0.08)',
                    ]
                  : [
                      'rgba(34, 197, 94, 0.15)',
                      'rgba(16, 185, 129, 0.12)',
                      'rgba(20, 184, 166, 0.08)',
                      'rgba(6, 182, 212, 0.08)',
                    ]
              }
              waveWidth={40}
              blur={15}
              speed="slow"
              waveOpacity={0.25}
              containerClassName="py-20"
              className="flex items-center justify-center"
            >
              <CategorySection category={category.category} deals={category.deals} />
            </WavyBackground>
          </div>
        ))}
      </div>
    </section>
  )
}

export default TopDealsCategoriesFull
