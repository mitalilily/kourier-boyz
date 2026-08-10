import type { Category } from '@/types/category'
import { ChevronRight } from 'lucide-react'

interface CategoriesSidebarProps {
  categories: Category[]
  selectedCategoryId: string | null
  onCategorySelect: (categoryId: string) => void
}

const CategoriesSidebar: React.FC<CategoriesSidebarProps> = ({
  categories,
  selectedCategoryId,
  onCategorySelect,
}) => {
  const handleCategoryClick = (category: Category) => {
    onCategorySelect(category._id)
  }

  return (
    <div className="w-full md:w-64 lg:w-80 h-full bg-white rounded-2xl shadow-lg border border-gray-200/60 overflow-hidden backdrop-blur-sm">
      {/* Categories List */}
      <div className="overflow-y-auto h-[calc(100vh-200px)] max-h-[800px] scrollbar-hide">
        <nav className="p-3">
          {categories.length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              </div>
              <p className="text-sm text-gray-500 font-medium">No categories available</p>
              <p className="text-xs text-gray-400 mt-1">Check back later</p>
            </div>
          ) : (
            <ul className="space-y-1">
              {categories.map((category) => {
                const isSelected = selectedCategoryId === category._id

                return (
                  <li key={category._id}>
                    <button
                      type="button"
                      className={`group relative w-full flex items-center gap-3 p-2 rounded-xl transition-all duration-200 cursor-pointer text-left ${
                        isSelected
                          ? 'bg-linear-to-r from-blue-50 to-blue-50/50  shadow-sm'
                          : 'hover:bg-gray-50/80'
                      }`}
                      onClick={() => handleCategoryClick(category)}
                    >
                      {/* Selected Indicator */}
                      {isSelected && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-blue rounded-r-full" />
                      )}

                      {/* Category Image Thumbnail */}
                      <div
                        className={`shrink-0 w-12 h-12 rounded-xl overflow-hidden bg-gray-100 border-2 transition-all duration-200 ${
                          isSelected
                            ? 'border-blue-200 shadow-sm ring-2 ring-blue-100'
                            : 'border-gray-200 group-hover:border-gray-300'
                        }`}
                      >
                        <img
                          src={category.mainImage || '/brand/kourier-boyz-mark.png'}
                          alt={category.name}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                          loading="lazy"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement
                            target.src = '/brand/kourier-boyz-mark.png'
                          }}
                        />
                      </div>

                      {/* Category Name */}
                      <div className="flex-1 min-w-0">
                        <span
                          className={`block text-sm font-medium truncate transition-colors ${
                            isSelected
                              ? 'text-blue font-semibold'
                              : 'text-gray-700 group-hover:text-gray-900'
                          }`}
                        >
                          {category.name}
                        </span>
                        {category.description && (
                          <p
                            className={`text-xs truncate mt-0.5 transition-colors ${
                              isSelected
                                ? 'text-blue-600/70'
                                : 'text-gray-500 group-hover:text-gray-600'
                            }`}
                          >
                            {category.description}
                          </p>
                        )}
                      </div>

                      {/* Chevron Icon */}
                      <ChevronRight
                        className={`w-4 h-4 shrink-0 transition-all duration-200 ${
                          isSelected
                            ? 'text-blue-500 translate-x-0'
                            : 'text-gray-400 group-hover:text-gray-600 -translate-x-1 group-hover:translate-x-0'
                        }`}
                      />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </nav>
      </div>
    </div>
  )
}

export default CategoriesSidebar
