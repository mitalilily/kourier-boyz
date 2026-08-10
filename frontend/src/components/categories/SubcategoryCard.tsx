import { Card } from '@/components/ui/card'
import type { Category } from '@/types/category'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import React from 'react'
import { useNavigate } from 'react-router-dom'

interface SubcategoryCardProps {
  category: Category
}

const SubcategoryCard: React.FC<SubcategoryCardProps> = ({ category }) => {
  const navigate = useNavigate()
  const fallbackImage = '/brand/kourier-boyz-mark.png'

  const handleClick = () => {
    navigate(`/products/search?sort=relevance&categoryId=${category._id}`)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      whileHover={{ y: -6 }}
      className="h-full"
    >
      <Card
        className="group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm shadow-gray-200/70 transition-all duration-500 hover:-translate-y-1 hover:shadow-xl hover:shadow-gray-200"
        onClick={handleClick}
      >
        <div className="relative h-full">
          <div className="h-[230px]  overflow-hidden">
            <img
              src={category.mainImage || fallbackImage}
              alt={category.name}
              className="h-full w-full object-cover transition-transform duration-900 ease-out group-hover:scale-110"
              loading="lazy"
              decoding="async"
              onError={(event) => {
                const target = event.target as HTMLImageElement
                target.src = fallbackImage
              }}
            />
          </div>

          {/* Default overlay */}
          <div className="absolute inset-x-0 bottom-0 h-28 bg-linear-to-t from-black/40 via-black/60 to-transparent transition-all duration-300 group-hover:h-40" />

          {/* Default content */}
          <div className="absolute bottom-3 left-3 right-3 flex flex-col gap-1.5 transition-all duration-300 group-hover:bottom-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/70">Collection</p>
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm sm:text-base font-semibold text-white drop-shadow-md line-clamp-1 group-hover:line-clamp-none flex-1 transition-all duration-300">
                {category.name}
              </h3>
              <span
                className="shrink-0 text-white text-xs font-medium hover:text-white/80 transition-colors cursor-pointer flex items-center gap-1"
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation()
                  handleClick()
                }}
              >
                View
                <ArrowRight className="w-3 h-3" />
              </span>
            </div>
          </div>

          {/* Hover overlay with description */}
          <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/95 via-black/75 to-black/70 p-4 opacity-0 group-hover:opacity-100 transform translate-y-4 group-hover:translate-y-0 transition-all duration-300 ease-out">
            <div className="flex flex-col gap-2">
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/70">Collection</p>
              <h3 className="text-base sm:text-lg font-semibold text-white drop-shadow-md">
                {category.name}
              </h3>
              {category.description && (
                <p className="text-xs text-white/90 line-clamp-2 sm:line-clamp-3 leading-relaxed opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-75">
                  {category.description}
                </p>
              )}
              <span
                className="self-start mt-1 text-white text-xs font-medium hover:text-white/80 transition-all duration-300 delay-150 cursor-pointer flex items-center gap-1 opacity-0 group-hover:opacity-100"
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation()
                  handleClick()
                }}
              >
                View
                <ArrowRight className="w-3 h-3" />
              </span>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  )
}

export default SubcategoryCard
