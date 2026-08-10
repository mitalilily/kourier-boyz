import { motion } from 'framer-motion'
import { ArrowRight, Zap } from 'lucide-react'
import React from 'react'

const FeaturedBanner: React.FC = () => {
  return (
    <section className="py-20 md:py-28 relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-600 via-pink-600 to-orange-600 opacity-95" />
      
      {/* Animated pattern overlay */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />
      </div>

      {/* Floating shapes */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{
            y: [0, -20, 0],
            x: [0, 10, 0],
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 6,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute top-20 left-20 w-32 h-32 bg-white/10 rounded-full blur-xl"
        />
        <motion.div
          animate={{
            y: [0, 20, 0],
            x: [0, -15, 0],
            scale: [1, 0.9, 1],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1,
          }}
          className="absolute bottom-20 right-20 w-40 h-40 bg-white/10 rounded-full blur-xl"
        />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
        >
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <motion.div
              animate={{
                rotate: [0, 10, -10, 0],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center"
            >
              <Zap className="w-10 h-10 text-white" />
            </motion.div>
          </div>

          {/* Heading */}
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
            Flash Sale Weekend
            <br />
            <span className="bg-gradient-to-r from-yellow to-orange-300 bg-clip-text text-transparent">
              Up to 70% Off!
            </span>
          </h2>

          {/* Description */}
          <p className="text-xl md:text-2xl text-white/90 mb-10 max-w-3xl mx-auto leading-relaxed">
            Don't miss out on our biggest sale of the year. Limited time offer on thousands of products across all categories.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="group relative px-8 py-4 bg-white text-purple-600 rounded-full font-bold text-lg overflow-hidden shadow-2xl"
            >
              <span className="relative z-10 flex items-center gap-2">
                Shop Now
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" />
              </span>
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-purple-100 to-pink-100 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                initial={false}
              />
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-8 py-4 bg-transparent border-2 border-white text-white rounded-full font-bold text-lg hover:bg-white/10 transition-colors duration-300"
            >
              View Categories
            </motion.button>
          </div>

          {/* Timer */}
          <div className="mt-12">
            <p className="text-white/80 text-sm md:text-base mb-4 font-medium">Sale ends in:</p>
            <div className="flex items-center justify-center gap-3 md:gap-4">
              {[
                { label: 'Days', value: '02' },
                { label: 'Hours', value: '18' },
                { label: 'Minutes', value: '45' },
                { label: 'Seconds', value: '30' },
              ].map((item, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  viewport={{ once: true }}
                  className="relative"
                >
                  <div className="w-16 h-16 md:w-20 md:h-20 bg-white/20 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center border border-white/30">
                    <span className="text-2xl md:text-3xl font-bold text-white">{item.value}</span>
                    <span className="text-xs md:text-sm text-white/80 font-medium">{item.label}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

export default FeaturedBanner


