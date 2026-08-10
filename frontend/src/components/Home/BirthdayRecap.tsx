import { useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { Gift, MapPin, ShoppingBag, Sparkles, Tag } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getBirthdayRecap } from '../../api/orders'
import { getProductDisplayInfo } from '../../utils/productDisplay'
import { Button } from '../ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog'
import ProductCard from '../ui/ProductCard'

interface BirthdayRecapProps {
  userName?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

const BirthdayRecap: React.FC<BirthdayRecapProps> = ({
  userName = 'there',
  open,
  onOpenChange,
}) => {
  const navigate = useNavigate()
  const [currentSlide, setCurrentSlide] = useState(0)
  const { data, isLoading } = useQuery({
    queryKey: ['birthday-recap'],
    queryFn: getBirthdayRecap,
    enabled: open, // Only fetch when dialog is open
  })

  const stats = data?.data?.stats
  const popularProducts = data?.data?.popularProducts || []

  // Reset slide when dialog opens
  useEffect(() => {
    if (open) {
      setCurrentSlide(0)
    }
  }, [open])

  useEffect(() => {
    if (!isLoading && stats && open) {
      // Auto-advance slides (only 2 slides now)
      const timer = setTimeout(() => {
        if (currentSlide < 1) {
          setCurrentSlide(currentSlide + 1)
        }
      }, 4000)
      return () => clearTimeout(timer)
    }
  }, [currentSlide, isLoading, stats, open])

  // Don't render if no stats or no orders
  if (!open) {
    return null
  }

  if (!isLoading && (!stats || stats.totalOrders === 0)) {
    onOpenChange(false) // Close dialog if no data
    return null
  }

  const handleProductClick = (id: string | number) => {
    // Find the product to get its slug
    const product = popularProducts.find((p) => p._id === id || String(p._id) === String(id))
    if (product?.slug) {
      navigate(`/product/${product.slug}`)
    } else {
      navigate(`/product/${id}`)
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto bg-linear-to-br from-pink-500 via-purple-500 to-blue-500 p-0 text-white border-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Birthday Recap</DialogTitle>
          <DialogDescription>Your Year with Kourier Boyz Recap</DialogDescription>
        </DialogHeader>

        <div className="relative overflow-hidden">
          {/* Confetti effect */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {[...Array(30)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute h-2 w-2 rounded-full"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  backgroundColor: ['#ffd700', '#ff69b4', '#00ff00', '#00bfff', '#ff1493'][
                    Math.floor(Math.random() * 5)
                  ],
                }}
                animate={{
                  y: [0, 800],
                  x: [0, (Math.random() - 0.5) * 200],
                  opacity: [1, 0],
                  rotate: [0, 360],
                }}
                transition={{
                  duration: Math.random() * 3 + 2,
                  repeat: Infinity,
                  delay: Math.random() * 2,
                }}
              />
            ))}
          </div>

          <div className="relative p-8 md:p-12">
            {isLoading ? (
              <div className="py-16 text-center">
                <div className="mx-auto h-96 w-full max-w-2xl animate-pulse rounded-3xl bg-white/20" />
              </div>
            ) : (
              <>
                <AnimatePresence mode="wait">
                  {/* Slide 1: Stats */}
                  {currentSlide === 0 && (
                    <motion.div
                      key="slide-1"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.5 }}
                      className="text-center"
                    >
                      <motion.div
                        animate={{ rotate: [0, 10, -10, 0] }}
                        transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
                        className="mb-6 flex justify-center"
                      >
                        <div className="relative">
                          <Gift className="h-16 w-16 text-yellow-300 drop-shadow-lg md:h-20 md:w-20" />
                          <Sparkles className="absolute -right-3 -top-3 h-6 w-6 text-yellow-200 animate-pulse" />
                        </div>
                      </motion.div>
                      <h1 className="mb-3 text-3xl font-bold text-white drop-shadow-lg md:text-4xl">
                        Happy Birthday, {userName}! 🎉
                      </h1>
                      <p className="mb-8 text-lg text-white/90 md:text-xl">
                        Your Year with Kourier Boyz Recap
                      </p>
                      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                        <motion.div
                          initial={{ y: 50, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          transition={{ delay: 0.2 }}
                          className="rounded-2xl bg-white/20 p-6 backdrop-blur-sm"
                        >
                          <ShoppingBag className="mx-auto mb-4 h-10 w-10 text-yellow-300 md:h-12 md:w-12" />
                          <div className="mb-2 text-4xl font-bold text-white md:text-5xl">
                            {stats?.totalOrders || 0}
                          </div>
                          <div className="text-lg text-white/90 md:text-xl">Orders Placed</div>
                        </motion.div>
                        <motion.div
                          initial={{ y: 50, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          transition={{ delay: 0.4 }}
                          className="rounded-2xl bg-white/20 p-6 backdrop-blur-sm"
                        >
                          <Tag className="mx-auto mb-4 h-10 w-10 text-yellow-300 md:h-12 md:w-12" />
                          <div className="mb-2 text-4xl font-bold text-white md:text-5xl">
                            {stats?.categoriesExplored || 0}
                          </div>
                          <div className="text-lg text-white/90 md:text-xl">
                            Categories Explored
                          </div>
                        </motion.div>
                        <motion.div
                          initial={{ y: 50, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          transition={{ delay: 0.6 }}
                          className="rounded-2xl bg-white/20 p-6 backdrop-blur-sm"
                        >
                          <MapPin className="mx-auto mb-4 h-10 w-10 text-yellow-300 md:h-12 md:w-12" />
                          <div className="mb-2 text-4xl font-bold text-white md:text-5xl">
                            {stats?.citiesDelivered || 0}
                          </div>
                          <div className="text-lg text-white/90 md:text-xl">Cities Delivered</div>
                        </motion.div>
                      </div>
                    </motion.div>
                  )}

                  {/* Slide 2: Popular Products */}
                  {currentSlide === 1 && (
                    <motion.div
                      key="slide-2"
                      initial={{ opacity: 0, y: 50 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -50 }}
                      transition={{ duration: 0.5 }}
                    >
                      <h2 className="mb-4 text-center text-3xl font-bold text-white drop-shadow-lg md:text-4xl">
                        People like you loved these products...
                      </h2>
                      <p className="mb-8 text-center text-lg text-white/90 md:text-xl">
                        Discover what's trending among shoppers like you
                      </p>

                      {popularProducts.length > 0 ? (
                        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                          {popularProducts.slice(0, 8).map((product, index) => {
                            const display = getProductDisplayInfo(
                              product as Parameters<typeof getProductDisplayInfo>[0],
                            )
                            const actualPrice = display.price
                            const originalPrice =
                              display.comparePrice && display.comparePrice > actualPrice
                                ? display.comparePrice
                                : undefined

                            return (
                              <motion.div
                                key={product._id}
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: index * 0.1 }}
                                className="cursor-pointer"
                              >
                                <ProductCard
                                  id={product._id}
                                  slug={product.slug}
                                  name={product.name}
                                  price={actualPrice}
                                  originalPrice={originalPrice}
                                  image={
                                    product.mainImage ||
                                    product.images?.[0] ||
                                    '/image-placeholder.svg'
                                  }
                                  rating={product.rating}
                                  reviews={product.reviewCount || 0}
                                  discount={product.discountPercent || 0}
                                  product={product as any}
                                  onClick={handleProductClick}
                                />
                              </motion.div>
                            )
                          })}
                        </div>
                      ) : (
                        <div className="text-center text-white/80">
                          <p className="text-lg md:text-xl">
                            Check back soon for trending products!
                          </p>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Navigation dots */}
                <div className="mt-8 flex justify-center gap-3">
                  {[0, 1].map((index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentSlide(index)}
                      className={`h-3 rounded-full transition-all ${
                        currentSlide === index
                          ? 'w-8 bg-white'
                          : 'w-3 bg-white/50 hover:bg-white/75'
                      }`}
                    />
                  ))}
                </div>

                {/* Manual navigation buttons */}
                <div className="mt-6 flex justify-center gap-4">
                  {currentSlide > 0 && (
                    <Button
                      onClick={() => setCurrentSlide(currentSlide - 1)}
                      variant="outline"
                      className="bg-white/20 text-white backdrop-blur-sm hover:bg-white/30 border-white/30"
                    >
                      Previous
                    </Button>
                  )}
                  {currentSlide < 1 && (
                    <Button
                      onClick={() => setCurrentSlide(currentSlide + 1)}
                      className="bg-yellow-400 text-gray-900 hover:bg-yellow-300"
                    >
                      Next
                    </Button>
                  )}
                  {currentSlide === 1 && (
                    <Button
                      onClick={() => {
                        navigate('/shop-by-category')
                        onOpenChange(false)
                      }}
                      className="bg-yellow-400 text-gray-900 hover:bg-yellow-300"
                    >
                      Explore More Products
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default BirthdayRecap
