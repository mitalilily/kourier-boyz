import { useBlogs } from '@/api/blogs'
import { Button } from '@/components/ui/button'
import { formatDistanceToNow } from 'date-fns'
import { Calendar, ChevronLeft, ChevronRight, Clock } from 'lucide-react'
import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import SectionHeading from '../ui/SectionHeading'

const LatestBlogPosts: React.FC = () => {
  const navigate = useNavigate()
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)

  const { data, isLoading } = useBlogs({
    status: 'published',
    limit: 6,
    page: 1,
  })

  const blogs = data?.blogs || []

  const checkScrollButtons = () => {
    if (!scrollContainerRef.current) return
    const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current
    setCanScrollLeft(scrollLeft > 0)
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10)
  }

  useEffect(() => {
    checkScrollButtons()
    const container = scrollContainerRef.current
    if (!container) return

    container.addEventListener('scroll', checkScrollButtons)
    window.addEventListener('resize', checkScrollButtons)

    return () => {
      container.removeEventListener('scroll', checkScrollButtons)
      window.removeEventListener('resize', checkScrollButtons)
    }
  }, [blogs.length])

  const scroll = (direction: 'left' | 'right') => {
    const container = scrollContainerRef.current
    if (!container) return
    const cardWidth = container.querySelector('.blog-card')?.clientWidth || 320
    const gap = 16
    const scrollAmount = cardWidth + gap

    container.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    })
  }

  const handleBlogClick = (slug: string) => {
    navigate(`/blog/${slug}`)
  }

  if (isLoading) {
    return (
      <div className="py-12 my-4 bg-white">
        <div className=" mx-auto px-4 md:px-8">
          <div className="h-12 bg-gray-200 rounded w-64 mb-8 animate-pulse" />
          <div className="flex gap-4 overflow-hidden">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-gray-200 rounded-2xl h-96 w-80 animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (blogs.length === 0) {
    return null
  }

  return (
    <div className="py-12 my-4 bg-white">
      <div className=" mx-auto px-4 md:px-8">
        <div className="flex items-center justify-between mb-8">
          <SectionHeading
            align="left"
            title="Latest from Our Blog"
            italicPart="Blog"
            subtitle="Discover tips, trends, and stories from our team"
          />
          <Button
            onClick={() => navigate('/blog')}
            variant="outline"
            className="hidden sm:flex items-center gap-2 rounded-full border-2 border-indigo-600 text-indigo-600 hover:bg-indigo-50 hover:border-indigo-700 transition-all duration-300"
          >
            View All
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <div className="relative w-full flex items-center justify-center group mt-8">
          <div
            ref={scrollContainerRef}
            className="w-full overflow-x-auto overflow-y-hidden scrollbar-hide scroll-smooth"
            style={{
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            }}
          >
            <div className="flex gap-4 pb-4 items-stretch">
              {blogs.map((blog) => (
                <div
                  key={blog._id}
                  className="blog-card shrink-0 w-[calc(85vw-2rem)] sm:w-[calc(50%-0.8rem)] md:w-[calc(40%-1rem)] lg:w-[calc(33.333%-1.4rem)]"
                >
                  <div
                    onClick={() => handleBlogClick(blog.slug)}
                    className="group relative bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer h-full flex flex-col border-0"
                  >
                    {/* Image */}
                    <div className="relative w-full h-56 sm:h-64 overflow-hidden bg-gray-100">
                      {blog.featuredImage ? (
                        <img
                          src={blog.featuredImage}
                          alt={blog.title}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        />
                      ) : (
                        <div className="w-full h-full bg-linear-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
                          <span className="text-5xl opacity-50">📝</span>
                        </div>
                      )}

                      {/* Gradient overlay bottom */}
                      <div className="absolute bottom-0 left-0 right-0 h-24 bg-linear-to-t from-black/40 via-black/10 to-transparent pointer-events-none" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 flex flex-col p-4 space-y-2">
                      {/* Tags */}
                      {blog.tags && blog.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {blog.tags.slice(0, 2).map((tag, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 text-xs font-medium bg-indigo-50 text-indigo-700 rounded-md"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Title */}
                      <h3 className="text-base font-semibold text-gray-900 line-clamp-2 group-hover:text-indigo-600 transition-colors leading-snug">
                        {blog.title}
                      </h3>

                      {/* Meta info */}
                      <div className="flex items-center gap-3 text-xs text-gray-500 mt-auto pt-2">
                        {blog.publishedAt && (
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            <span className="whitespace-nowrap">
                              {formatDistanceToNow(new Date(blog.publishedAt), { addSuffix: true })}
                            </span>
                          </div>
                        )}
                        {blog.views !== undefined && (
                          <>
                            <span className="text-gray-300">•</span>
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>{blog.views}</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Button
            onClick={() => scroll('left')}
            variant="outline"
            size="icon"
            className="absolute -left-3 top-1/2 -translate-y-1/2 -translate-x-4 z-20 h-10 w-10 rounded-full bg-white shadow-lg border-2 border-gray-200 hover:bg-gray-50 hover:border-gray-300 hover:shadow-xl transition-all duration-300 disabled:opacity-0"
            aria-label="Previous blogs"
            disabled={!canScrollLeft}
          >
            <ChevronLeft className="w-5 h-5 text-yellow" />
          </Button>

          <Button
            onClick={() => scroll('right')}
            variant="outline"
            size="icon"
            className="absolute -right-3 top-1/2 -translate-y-1/2 translate-x-4 z-20 h-10 w-10 rounded-full bg-white shadow-lg border-2 border-gray-200 hover:bg-gray-50 hover:border-gray-300 hover:shadow-xl transition-all duration-300 disabled:opacity-0"
            aria-label="Next blogs"
            disabled={!canScrollRight}
          >
            <ChevronRight className="w-5 h-5 text-yellow" />
          </Button>
        </div>

        {/* Mobile View All Button */}
        <div className="flex justify-center mt-6 sm:hidden">
          <Button
            onClick={() => navigate('/blog')}
            variant="outline"
            className="flex items-center gap-2 rounded-full border-2 border-indigo-600 text-indigo-600 hover:bg-indigo-50 hover:border-indigo-700 transition-all duration-300"
          >
            View All Blog Posts
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

export default LatestBlogPosts
