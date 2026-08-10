import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'

import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-2xl border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-blue-600 bg-blue-50 text-blue-600 shadow-sm hover:bg-blue-50 dark:border-blue-400 dark:bg-gray-900 dark:text-blue-400 dark:hover:bg-gray-800',
        secondary:
          'border-gray-300 bg-gray-50 text-gray-900 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700',
        destructive:
          'border-red-600 bg-red-50 text-red-900 hover:bg-red-100 dark:border-red-400 dark:bg-red-950 dark:text-red-100 dark:hover:bg-red-900',
        outline: 'border-gray-900 text-gray-900 dark:border-gray-100 dark:text-gray-100',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, ...props }, ref) => {
    return <div ref={ref} className={cn(badgeVariants({ variant }), className)} {...props} />
  },
)
Badge.displayName = 'Badge'

// eslint-disable-next-line react-refresh/only-export-components
export { Badge, badgeVariants }
