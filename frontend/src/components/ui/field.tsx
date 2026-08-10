import { cn } from '@/lib/utils'
import * as React from 'react'
import { Label } from './label'

const FieldGroup = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('space-y-4', className)} {...props} />
  ),
)
FieldGroup.displayName = 'FieldGroup'

const Field = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    'data-invalid'?: boolean
  }
>(({ className, 'data-invalid': dataInvalid, ...props }, ref) => (
  <div
    ref={ref}
    data-invalid={dataInvalid}
    className={cn('space-y-2', dataInvalid && 'data-[invalid=true]', className)}
    {...props}
  />
))
Field.displayName = 'Field'

const FieldLabel = React.forwardRef<
  React.ElementRef<typeof Label>,
  React.ComponentPropsWithoutRef<typeof Label>
>(({ className, ...props }, ref) => {
  return <Label ref={ref} className={cn('text-slate-700', className)} {...props} />
})
FieldLabel.displayName = 'FieldLabel'

const FieldDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />
))
FieldDescription.displayName = 'FieldDescription'

const FieldError = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement> & {
    errors?: Array<{ message?: string } | undefined | null>
  }
>(({ className, errors, ...props }, ref) => {
  const errorMessage = errors?.find((e) => e?.message)?.message
  if (!errorMessage) return null

  return (
    <p
      ref={ref}
      className={cn('text-sm text-red-600 font-medium mt-1.5 flex items-center gap-1.5', className)}
      {...props}
    >
      <span className="text-red-500">●</span>
      {errorMessage}
    </p>
  )
})
FieldError.displayName = 'FieldError'

export { Field, FieldDescription, FieldError, FieldGroup, FieldLabel }
