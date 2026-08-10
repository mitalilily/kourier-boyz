'use client'

import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'

function FloatingPaths({ position }: { position: number }) {
  const paths = Array.from({ length: 36 }, (_, i) => ({
    id: i,
    d: `M-${380 - i * 5 * position} -${189 + i * 6}C-${380 - i * 5 * position} -${189 + i * 6} -${
      312 - i * 5 * position
    } ${216 - i * 6} ${152 - i * 5 * position} ${343 - i * 6}C${616 - i * 5 * position} ${
      470 - i * 6
    } ${684 - i * 5 * position} ${875 - i * 6} ${684 - i * 5 * position} ${875 - i * 6}`,
    color: `rgba(15,23,42,${0.1 + i * 0.03})`,
    width: 0.5 + i * 0.03,
  }))
  return (
    <div className="absolute inset-0 pointer-events-none">
      <svg className="w-full h-full" viewBox="0 0 696 316" fill="none">
        <title>Background Paths</title>
        {paths.map((path) => (
          <motion.path
            key={path.id}
            d={path.d}
            stroke="#1353A4"
            strokeWidth={path.width}
            strokeOpacity={0.005 + path.id * 0.0008}
            animate={{
              pathLength: [0, 1],
            }}
            transition={{
              duration: 20 + Math.random() * 10,
              repeat: Number.POSITIVE_INFINITY,
              ease: 'linear',
            }}
          />
        ))}
      </svg>
    </div>
  )
}

export interface BackgroundPathsProps {
  className?: string
  children?: React.ReactNode
}

export function BackgroundPaths({ className, children }: BackgroundPathsProps) {
  return (
    <div className={cn('absolute inset-0 overflow-hidden pointer-events-none', className)}>
      <div className="absolute inset-0">
        <FloatingPaths position={1} />
        <FloatingPaths position={-1} />
      </div>
      {children && <div className="relative z-10">{children}</div>}
    </div>
  )
}
