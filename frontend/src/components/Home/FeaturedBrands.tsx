import { motion } from 'framer-motion'
import { CheckCircle } from 'lucide-react'
import React from 'react'

const FeaturedBrands: React.FC = () => {
  const brands = [
    { name: 'Nike', logo: 'https://logos-world.net/wp-content/uploads/2020/04/Nike-Logo.png' },
    { name: 'Apple', logo: 'https://logos-world.net/wp-content/uploads/2020/04/Apple-Logo.png' },
    {
      name: 'Samsung',
      logo: 'https://logos-world.net/wp-content/uploads/2020/06/Samsung-Logo.png',
    },
    { name: 'Adidas', logo: 'https://logos-world.net/wp-content/uploads/2020/04/Adidas-Logo.png' },
    { name: 'Sony', logo: 'https://logos-world.net/wp-content/uploads/2020/06/Sony-Logo.png' },
    { name: 'LG', logo: 'https://logos-world.net/wp-content/uploads/2020/06/LG-Logo.png' },
  ]

  const features = ['Authentic Products', 'Warranty Included', 'Easy Returns', 'Free Delivery']

  return (
    <div className="bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 py-16 my-4">
      <div className=" mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
        >
          {/* Header */}
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Shop from Top Brands</h2>
            <p className="text-gray-300 text-lg">
              Premium quality products from trusted manufacturers
            </p>
          </div>

          {/* Brands Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 mb-12">
            {brands.map((brand, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-all duration-300 cursor-pointer group"
              >
                <div className="aspect-square flex items-center justify-center bg-white rounded-lg p-4 group-hover:scale-110 transition-transform duration-300">
                  <img
                    src={brand.logo}
                    alt={brand.name}
                    className="max-w-full max-h-full object-contain filter brightness-0 invert"
                  />
                </div>
              </motion.div>
            ))}
          </div>

          {/* Features */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="flex items-center gap-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-4"
              >
                <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0" />
                <span className="text-white font-medium">{feature}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  )
}

export default FeaturedBrands
