import { cn } from '@/lib/utils'
import * as SliderPrimitive from '@radix-ui/react-slider'
import * as React from 'react'

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn('relative flex w-full touch-none select-none items-center', className)}
    {...props}
  >
    {/* Track */}
    <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
      {/* Range */}
      <SliderPrimitive.Range className="absolute h-full bg-blue transition-all duration-300" />
    </SliderPrimitive.Track>

    {/* Dynamically render thumbs for each value */}
    {(Array.isArray(props.value) ? props.value : [props.value]).map((_, i) => (
      <SliderPrimitive.Thumb
        key={i}
        className={cn(
          'block h-4 w-4 rounded-full border border-primary/40 bg-blue',
          'shadow-md transition-all duration-200',
          'hover:scale-110 hover:border-primary focus-visible:outline-none',
          'focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2',
          'disabled:pointer-events-none disabled:opacity-50',
        )}
      />
    ))}
  </SliderPrimitive.Root>
))
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }
