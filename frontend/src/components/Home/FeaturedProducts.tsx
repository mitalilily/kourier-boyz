import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import React from 'react'
import { useNavigate } from 'react-router-dom'
import ProductCard from '../ui/ProductCard'
import SectionHeading from '../ui/SectionHeading'

// Mock product data - replace with real data from your backend
const mockProducts = [
  {
    id: 1,
    name: 'Wireless Headphones Pro',
    price: 299,
    originalPrice: 399,
    image: '/image-placeholder.svg',
    rating: 4.8,
    reviews: 324,
    badge: 'Best Seller',
  },
  {
    id: 2,
    name: 'Smart Watch Series',
    price: 599,
    originalPrice: 799,
    image: '/image-placeholder.svg',
    rating: 4.9,
    reviews: 512,
    badge: 'New Arrival',
  },
  {
    id: 3,
    name: 'Organic Cotton T-Shirt',
    price: 49,
    originalPrice: 79,
    image: '/products/tshirt.jpg',
    rating: 4.7,
    reviews: 189,
    badge: 'Hot Deal',
  },
  {
    id: 4,
    name: 'Ergonomic Office Chair',
    price: 349,
    originalPrice: 499,
    image: '/products/chair.jpg',
    rating: 4.6,
    reviews: 245,
    badge: 'Featured',
  },
  {
    id: 5,
    name: 'Minimalist Backpack',
    price: 129,
    originalPrice: 179,
    image: '/products/chair.jpg',
    rating: 4.9,
    reviews: 678,
    badge: 'Popular',
  },
  {
    id: 6,
    name: 'Noise Cancelling Earbuds',
    price: 179,
    originalPrice: 249,
    image: '/image-placeholder.svg',
    rating: 4.8,
    reviews: 892,
    badge: 'Top Rated',
  },
]

const FeaturedProducts: React.FC = () => {
  const navigate = useNavigate()

  const calculateDiscount = (price: number, originalPrice: number) => {
    return Math.round(((originalPrice - price) / originalPrice) * 100)
  }

  return (
    <section className="py-20 md:py-32 bg-gradient-to-b from-white via-gray-50 to-white">
      <div className=" mx-auto px-6">
        {/* Section Header */}
        <div className="flex items-center justify-between mb-12">
          <SectionHeading
            title="Featured Products"
            italicPart="Featured"
            subtitle="Handpicked selections from our collection"
            align="left"
          />
          <button
            onClick={() => navigate('/shop-by-category')}
            className="hidden md:flex items-center gap-2 px-6 py-3 bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 hover:from-slate-800 hover:via-blue-800 hover:to-slate-700 text-white rounded-full font-semibold hover:shadow-lg hover:scale-105 transition-all duration-300"
          >
            View All
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>

        {/* Products Carousel */}
        <Carousel
          opts={{
            align: 'start',
            loop: true,
          }}
          className="w-full"
        >
          <CarouselContent className="-ml-2 md:-ml-4">
            {mockProducts.map((product, index) => (
              <CarouselItem
                key={product.id}
                className="pl-2 md:pl-4 basis-full sm:basis-1/2 lg:basis-1/3 xl:basis-1/4"
              >
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  viewport={{ once: true }}
                >
                  <ProductCard
                    id={product.id}
                    name={product.name}
                    price={product.price}
                    originalPrice={product.originalPrice}
                    image={product.image}
                    rating={product.rating}
                    reviews={product.reviews}
                    badge={product.badge}
                    discount={calculateDiscount(product.price, product.originalPrice)}
                    onClick={() => navigate(`/products/${product.id}`)}
                  />
                </motion.div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="hidden lg:flex -left-12 bg-white/80 backdrop-blur-sm border-gray-200 hover:bg-white" />
          <CarouselNext className="hidden lg:flex -right-12 bg-white/80 backdrop-blur-sm border-gray-200 hover:bg-white" />
        </Carousel>

        {/* Mobile View All Button */}
        <div className="flex md:hidden justify-center mt-8">
          <button
            onClick={() => navigate('/shop-by-category')}
            className="flex items-center gap-2 px-8 py-3 bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 hover:from-slate-800 hover:via-blue-800 hover:to-slate-700 text-white rounded-full font-semibold shadow-lg"
          >
            View All Products
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </section>
  )
}

export default FeaturedProducts
