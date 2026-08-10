import React from 'react'

import { cn } from '@/lib/utils'

interface StarRatingProps {
  value?: number
  reviews?: number
}

const StarRating: React.FC<StarRatingProps> = ({ value, reviews }) => {
  if (!value || value <= 0) return null
  const rounded = Math.round(value * 2) / 2
  const stars = Array.from({ length: 5 })

  const handleReviewClick = () => {
    const reviewsSection = document.getElementById('reviews-section')
    if (reviewsSection) {
      reviewsSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      {stars.map((_, index) => {
        const starValue = index + 1
        const isFull = starValue <= rounded
        const isHalf = !isFull && starValue - 0.5 === rounded
        return (
          <svg
            key={starValue}
            viewBox="0 0 24 24"
            className={cn(
              'h-4 w-4',
              isFull || isHalf ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300 fill-gray-200',
            )}
          >
            <path d="M12 2l2.922 6.2L22 9.27l-5 4.87L18.844 21 12 17.77 5.156 21 7 14.14 2 9.27l7.078-1.07L12 2z" />
          </svg>
        )
      })}
      <span className="text-sm font-semibold text-gray-800">{value.toFixed(1)}</span>
      {reviews !== undefined && reviews > 0 ? (
        <button
          onClick={handleReviewClick}
          className="text-xs text-gray-600 font-medium hover:text-gray-900 hover:underline cursor-pointer transition-colors"
        >
          ({reviews.toLocaleString()} {reviews === 1 ? 'rating' : 'ratings'})
        </button>
      ) : null}
    </div>
  )
}

export default StarRating
