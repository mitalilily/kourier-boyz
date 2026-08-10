import { motion } from 'framer-motion'
import React from 'react'

interface SectionHeadingProps {
  title: string
  italicPart?: string | null
  subtitle?: string
  align?: 'left' | 'center' | 'right'
  marginBottom?: boolean
}

const SectionHeading: React.FC<SectionHeadingProps> = ({
  title,
  italicPart,
  subtitle,
  align = 'center',
  marginBottom = true,
}) => {
  // Split title into normal + italic parts dynamically
  const [beforeItalic, afterItalic] = italicPart ? title.split(italicPart) : [title, '']

  const alignClasses = {
    left: 'items-start text-left',
    center: 'items-center text-center',
    right: 'items-end text-right',
  }

  return (
    <div
      className={`w-full flex flex-col ${alignClasses[align]} justify-center ${
        marginBottom ? 'mb-6 sm:mb-8 md:mb-10' : ''
      } `}
    >
      {/* Animated Gradient Line */}
      {/* <motion.div
        initial={{ width: 0 }}
        whileInView={{ width: '80px' }}
        transition={{ duration: 0.6 }}
        viewport={{ once: true }}
        className="h-[3px] rounded-full mb-4 bg-gradient-to-r from-pink-500 via-yellow to-purple-500 bg-[length:200%_100%] animate-gradient-x"
        style={{ willChange: 'width, transform' }}
      /> */}

      {/* Title */}
      <motion.h2
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        viewport={{ once: true }}
        className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-semibold tracking-tight theme-text-primary"
        style={{
          willChange: 'opacity, transform',
          color: 'var(--theme-text, #111827)',
        }}
      >
        {beforeItalic}
        {italicPart && (
          <span
            className="italic ml-1 sm:ml-2 font-light text-base sm:text-lg md:text-xl lg:text-2xl xl:text-3xl 2xl:text-4xl"
            style={{
              fontFamily: 'var(--font-italic-cursive)',
              color: '#2563eb',
            }}
          >
            {italicPart}
          </span>
        )}
        {afterItalic}
      </motion.h2>

      {/* Subtitle */}
      {subtitle && (
        <p
          className="text-xs sm:text-sm md:text-base mt-1 sm:mt-2 max-w-lg theme-text-secondary"
          style={{ color: 'var(--theme-text-secondary, #6b7280)' }}
        >
          {subtitle}
        </p>
      )}
    </div>
  )
}

export default SectionHeading
