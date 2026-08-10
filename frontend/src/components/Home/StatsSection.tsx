import { motion } from 'framer-motion'
import { Package, Star, TrendingUp, Users } from 'lucide-react'
import React, { useEffect, useRef, useState } from 'react'

const StatsSection: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false)
  const sectionRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
        }
      },
      { threshold: 0.2 },
    )

    const currentSection = sectionRef.current
    if (currentSection) {
      observer.observe(currentSection)
    }

    return () => {
      if (currentSection) {
        observer.unobserve(currentSection)
      }
    }
  }, [])

  const stats = [
    {
      icon: Users,
      value: '100K+',
      label: 'Happy Customers',
      color: 'from-blue-500 to-cyan-500',
      bgColor: 'bg-blue-50',
    },
    {
      icon: Package,
      value: '50K+',
      label: 'Products',
      color: 'from-purple-500 to-pink-500',
      bgColor: 'bg-purple-50',
    },
    {
      icon: TrendingUp,
      value: '95%+',
      label: 'Satisfaction Rate',
      color: 'from-green-500 to-emerald-500',
      bgColor: 'bg-green-50',
    },
    {
      icon: Star,
      value: '4.9',
      label: 'Average Rating',
      color: 'from-orange-500 to-yellow',
      bgColor: 'bg-orange-50',
    },
  ]

  return (
    <section
      ref={sectionRef}
      className="py-16 md:py-24 bg-gradient-to-br from-gray-50 via-white to-gray-50"
    >
      <div className=" mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
          {stats.map((stat, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={isVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="relative group"
            >
              {/* Card */}
              <div className="relative bg-white rounded-2xl p-6 md:p-8 shadow-md hover:shadow-xl transition-all duration-300 border border-gray-100 group-hover:border-transparent overflow-hidden">
                {/* Gradient overlay on hover */}
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${stat.color} opacity-0 group-hover:opacity-5 transition-opacity duration-300`}
                />

                {/* Icon container */}
                <div
                  className={`w-16 h-16 rounded-xl ${stat.bgColor} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}
                >
                  <stat.icon
                    className={`w-8 h-8 bg-gradient-to-br ${stat.color} bg-clip-text text-transparent`}
                  />
                </div>

                {/* Value */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={isVisible ? { opacity: 1 } : { opacity: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 + 0.2 }}
                  className="text-3xl md:text-4xl font-bold bg-gradient-to-br from-gray-900 to-gray-700 bg-clip-text text-transparent mb-2"
                >
                  {stat.value}
                </motion.div>

                {/* Label */}
                <div className="text-sm md:text-base text-gray-600 font-medium">{stat.label}</div>

                {/* Decorative dot */}
                <div className="absolute top-4 right-4">
                  <div
                    className={`w-2 h-2 rounded-full bg-gradient-to-br ${stat.color} opacity-60 group-hover:opacity-100 transition-opacity duration-300`}
                  />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default StatsSection
