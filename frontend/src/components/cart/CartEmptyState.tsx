import { useCategories } from '@/api/categories'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { motion } from 'framer-motion'
import { ArrowRight, Package, ShoppingBag, ShoppingCart, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'

export const CartEmptyState = () => {
  const { data: categoriesData } = useCategories({
    status: 'active',
    top: true,
    limit: 6,
  })

  const topCategories = categoriesData?.categories?.slice(0, 6) || []

  return (
    <div className="min-h-screen flex items-center justify-center py-12 md:py-40 px-4 bg-linear-to-br from-gray-50 via-white to-gray-50 pt-36">
      {/* Subtle animated background elements - matching theme */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{
            scale: [1, 1.15, 1],
            opacity: [0.15, 0.25, 0.15],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="absolute top-20 left-10 w-72 h-72 bg-primary/20 rounded-full blur-3xl"
        />
        <motion.div
          animate={{
            scale: [1.15, 1, 1.15],
            opacity: [0.2, 0.1, 0.2],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 2,
          }}
          className="absolute bottom-20 right-10 w-96 h-96 bg-[#1353A4]/10 rounded-full blur-3xl"
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
        className="w-full max-w-5xl relative z-10"
      >
        {/* Main Empty State Card - matching theme style */}
        <Card className="w-full p-6 sm:p-10 md:p-14 text-center shadow-xl border border-gray-200/60 bg-white/95 backdrop-blur-sm overflow-hidden relative mb-8 rounded-2xl">
          {/* Theme accent top border */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-primary-dark to-[#1353A4]" />

          <div className="relative z-10">
            {/* Animated Shopping Cart Icon - theme colors */}
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{
                delay: 0.2,
                type: 'spring',
                stiffness: 200,
                damping: 15,
              }}
              className="mb-8 sm:mb-10"
            >
              <div className="relative inline-block">
                {/* Main cart icon */}
                <motion.div
                  animate={{
                    y: [0, -10, 0],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                  className="relative"
                >
                  <div className="relative w-28 h-28 sm:w-36 sm:h-36 mx-auto">
                    {/* Glow effect - theme yellow */}
                    <motion.div
                      animate={{
                        scale: [1, 1.08, 1],
                        opacity: [0.3, 0.5, 0.3],
                      }}
                      transition={{
                        duration: 2.5,
                        repeat: Infinity,
                        ease: 'easeInOut',
                      }}
                      className="absolute inset-0 bg-gradient-to-br from-primary/30 to-primary-dark/20 rounded-full blur-2xl"
                    />
                    {/* Cart circle - theme colors */}
                    <div className="relative w-full h-full bg-gradient-to-br from-primary/10 via-primary-light/5 to-white rounded-full flex items-center justify-center border-2 border-primary/30 shadow-lg">
                      <ShoppingCart className="w-14 h-14 sm:w-18 sm:h-18 text-[#1353A4]/80" />
                    </div>
                  </div>
                </motion.div>

                {/* Floating sparkle - theme yellow */}
                <motion.div
                  initial={{ scale: 0, opacity: 0, rotate: -45 }}
                  animate={{ scale: 1, opacity: 1, rotate: 0 }}
                  transition={{ delay: 0.6, type: 'spring' }}
                  className="absolute -top-3 -right-3 sm:-top-4 sm:-right-4"
                >
                  <motion.div
                    animate={{
                      rotate: 360,
                      scale: [1, 1.15, 1],
                    }}
                    transition={{
                      rotate: { duration: 4, repeat: Infinity, ease: 'linear' },
                      scale: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
                    }}
                  >
                    <Sparkles className="w-8 h-8 sm:w-10 sm:h-10 text-primary drop-shadow-md" />
                  </motion.div>
                </motion.div>
              </div>
            </motion.div>

            {/* Title - professional typography */}
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-xl  md:text-3xl font-bold mb-4 text-gray-900 leading-tight"
            >
              Your cart is empty
            </motion.h1>

            {/* Description - clean and professional */}
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="text-gray-600 mb-8 sm:mb-12 text-base sm:text-md max-w-lg mx-auto leading-relaxed"
            >
              Looks like you haven't added anything to your cart yet. Discover amazing products and
              start filling it up!
            </motion.p>

            {/* Action Buttons - matching theme button styles */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="flex flex-col sm:flex-row gap-4 sm:gap-4 justify-center items-center mb-8"
            >
              <Link to="/" className="w-full sm:w-auto">
                <Button
                  variant="primary"
                  className="w-full sm:w-auto px-8 sm:px-10 py-6 sm:py-7 text-base sm:text-lg font-semibold shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 group"
                  size="lg"
                >
                  <ShoppingBag className="w-5 h-5 sm:w-6 sm:h-6 mr-2 group-hover:translate-x-1 transition-transform" />
                  Start Shopping
                </Button>
              </Link>
              <Link to="/shop-by-category" className="w-full sm:w-auto">
                <Button
                  variant="outline"
                  className="w-full sm:w-auto px-8 sm:px-10 py-6 sm:py-7 text-base sm:text-lg font-semibold border-2 border-gray-300 hover:border-[#1353A4] hover:bg-[#1353A4]/5 transition-all duration-200 hover:scale-105 group"
                  size="lg"
                >
                  <Package className="w-5 h-5 sm:w-6 sm:h-6 mr-2 group-hover:rotate-12 transition-transform" />
                  Browse Categories
                </Button>
              </Link>
            </motion.div>
          </div>
        </Card>

        {/* Top Categories Section - professional grid */}
        {topCategories.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="relative z-10"
          >
            <div className="text-center mb-6">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Shop by Category</h2>
              <p className="text-gray-600 text-sm sm:text-base">
                Explore our top categories to find what you're looking for
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 sm:gap-4">
              {topCategories.map((category, index) => (
                <motion.div
                  key={category._id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.9 + index * 0.1 }}
                  whileHover={{ scale: 1.05, y: -4 }}
                  className="group"
                >
                  <Link to={`/shop-by-category?category=${category.slug}`} className="block h-full">
                    <Card className="p-3 sm:p-4 md:p-5 hover:shadow-lg transition-all duration-300 border border-gray-200/60 bg-white/90 backdrop-blur-sm h-full group-hover:border-[#1353A4]/50 cursor-pointer rounded-2xl">
                      <div className="aspect-square w-full mb-2 sm:mb-3 rounded-xl overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200">
                        <img
                          src={category.mainImage}
                          alt={category.name}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        />
                      </div>
                      <h3 className="text-xs sm:text-sm font-semibold text-gray-900 group-hover:text-[#1353A4] transition-colors line-clamp-2 text-center">
                        {category.name}
                      </h3>
                    </Card>
                  </Link>
                </motion.div>
              ))}
            </div>

            {/* View All Categories Link - theme blue */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.3 }}
              className="text-center mt-6 sm:mt-8"
            >
              <Link
                to="/shop-by-category"
                className="inline-flex items-center gap-2 text-[#1353A4] hover:text-[#0f4280] font-semibold text-sm sm:text-base group transition-colors"
              >
                <span>View All Categories</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </motion.div>
          </motion.div>
        )}
      </motion.div>
    </div>
  )
}
