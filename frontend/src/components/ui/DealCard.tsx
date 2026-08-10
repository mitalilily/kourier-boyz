import { Card, CardContent } from '@/components/ui/card'
import React from 'react'

interface DealCardProps {
  name: string
  sellingPrice: string
  originalPrice?: string
  image: string
}

const DealCard: React.FC<DealCardProps> = ({ name, sellingPrice, originalPrice, image }) => {
  return (
    <div className="w-full h-64 sm:h-72 md:h-80 lg:h-96">
      <Card className="group relative border-0 w-full h-full overflow-hidden rounded-xl shadow-lg hover:shadow-xl cursor-pointer transition-all duration-300">
        <img
          src={image}
          alt={name}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />

        <CardContent className="absolute bottom-2 left-2 sm:bottom-3 sm:left-3 px-2 py-1 sm:px-3 sm:py-1.5 rounded-2xl sm:rounded-3xl bg-black/35 hover:bg-black/45 backdrop-blur-sm flex flex-col sm:flex-row items-start sm:items-center gap-1 sm:gap-2 max-w-[90%] sm:max-w-[85%] transition-all duration-300 will-change-transform">
          <h3 className="text-white text-xs sm:text-sm md:text-base font-medium truncate w-full sm:w-auto">
            {name}
          </h3>
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <span className="text-green-400 font-semibold text-xs sm:text-sm md:text-base">
              {sellingPrice}
            </span>
            {originalPrice && (
              <span className="text-gray-300 line-through text-[10px] sm:text-xs md:text-sm">
                {originalPrice}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default DealCard
