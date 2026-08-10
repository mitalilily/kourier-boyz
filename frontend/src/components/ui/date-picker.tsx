'use client'

import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { ChevronDownIcon } from 'lucide-react'
import * as React from 'react'

interface DatePickerProps {
  date?: Date
  onSelect?: (date: Date | undefined) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  maxDate?: Date
}

export function DatePicker({
  date,
  onSelect,
  placeholder = 'Select date',
  className,
  disabled,
  maxDate,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            'w-full h-10 rounded-2xl border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors justify-between font-normal hover:bg-gray-50 focus-visible:outline-none focus-visible:border-purple-500 focus-visible:ring-purple-500/20 disabled:cursor-not-allowed disabled:opacity-50',
            !date && 'text-gray-500',
            className,
          )}
        >
          {date
            ? date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
            : placeholder}
          <ChevronDownIcon className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto overflow-hidden p-0 z-[100]"
        align="start"
        side="bottom"
        sideOffset={8}
      >
        <Calendar
          mode="single"
          selected={date}
          captionLayout="dropdown"
          onSelect={(selectedDate) => {
            onSelect?.(selectedDate)
            setOpen(false)
          }}
          disabled={disabled}
          toDate={maxDate}
        />
      </PopoverContent>
    </Popover>
  )
}
