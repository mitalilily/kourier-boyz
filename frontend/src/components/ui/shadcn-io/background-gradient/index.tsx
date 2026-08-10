import React from 'react'
import { cn } from '@/lib/utils'

export const BackgroundGradient = ({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) => {
  return (
    <div
      className={cn(
        'relative rounded-2xl overflow-hidden bg-white dark:bg-zinc-900',
        className,
      )}
    >
      {/* Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-100 via-pink-50 to-blue-50 dark:from-purple-900/20 dark:via-pink-900/20 dark:to-blue-900/20" />
      
      {/* Pattern Overlay */}
      <div
        className="absolute inset-0 opacity-[0.02] dark:opacity-[0.05]"
        style={{
          backgroundImage: `radial-gradient(circle, rgb(0, 0, 0) 1px, transparent 1px)`,
          backgroundSize: '20px 20px',
        }}
      />

      {/* Content */}
      <div className="relative z-10">{children}</div>
    </div>
  )
}

