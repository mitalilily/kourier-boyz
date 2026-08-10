import { motion } from 'framer-motion'
import { Loader2, Minus, Plus } from 'lucide-react'
import React, { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

interface QuantitySelectorProps {
  quantity: number
  onQuantityChange: (newQuantity: number) => void
  min?: number
  max?: number
  disabled?: boolean
  isLoading?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const QuantitySelector: React.FC<QuantitySelectorProps> = ({
  quantity,
  onQuantityChange,
  min = 1,
  max = 99,
  disabled = false,
  isLoading = false,
  size = 'md',
  className = '',
}) => {
  const [inputValue, setInputValue] = useState<string>(quantity.toString())
  const [isFocused, setIsFocused] = useState(false)
  const [shouldShake, setShouldShake] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync input value with quantity prop
  useEffect(() => {
    if (!isFocused) {
      setInputValue(quantity.toString())
    }
  }, [quantity, isFocused])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  const sizeConfig = {
    sm: {
      buttonSize: 'h-7 w-7',
      iconSize: 'w-3.5 h-3.5',
      inputSize: 'h-7 px-2 text-sm',
      fontSize: 'text-sm',
      gap: 'gap-1.5',
      inputWidth: 'w-12',
    },
    md: {
      buttonSize: 'h-8 w-8',
      iconSize: 'w-4 h-4',
      inputSize: 'h-8 px-2 text-sm',
      fontSize: 'text-sm',
      gap: 'gap-2',
      inputWidth: 'w-14',
    },
    lg: {
      buttonSize: 'h-10 w-10',
      iconSize: 'w-4.5 h-4.5',
      inputSize: 'h-10 px-3 text-base',
      fontSize: 'text-base',
      gap: 'gap-2.5',
      inputWidth: 'w-16',
    },
  }

  const config = sizeConfig[size]

  const validateAndUpdate = (value: string) => {
    // Allow empty input while typing
    if (value === '') {
      setInputValue('')
      return
    }

    // Remove non-numeric characters
    const numericValue = value.replace(/[^0-9]/g, '')
    if (numericValue === '') {
      setInputValue('')
      return
    }

    const numValue = parseInt(numericValue, 10)

    // Validate value is within min and max - don't allow changes outside bounds
    if (numValue < min) {
      // Revert to current quantity (don't change it)
      setInputValue(quantity.toString())
      // Trigger shake animation and show error if trying to set below min
      setShouldShake(true)
      setTimeout(() => setShouldShake(false), 500)
      toast.error(`Minimum order quantity is ${min} ${min === 1 ? 'unit' : 'units'}`)
      return // Don't call onQuantityChange
    }
    if (numValue > max) {
      // Revert to current quantity (don't change it)
      setInputValue(quantity.toString())
      // Trigger shake animation and show error if trying to set above max
      setShouldShake(true)
      setTimeout(() => setShouldShake(false), 500)
      toast.error(`Maximum order quantity is ${max} ${max === 1 ? 'unit' : 'units'}`)
      return // Don't call onQuantityChange
    }

    setInputValue(numericValue)
    onQuantityChange(numValue)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setInputValue(value)

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // Debounce validation
    timeoutRef.current = setTimeout(() => {
      validateAndUpdate(value)
    }, 300)
  }

  const handleInputBlur = () => {
    setIsFocused(false)
    // Validate and update on blur
    const parsedValue = parseInt(inputValue, 10)
    if (inputValue === '') {
      // If empty, set to min
      setInputValue(min.toString())
      onQuantityChange(min)
    } else if (!isNaN(parsedValue)) {
      if (parsedValue < min) {
        // Revert to current quantity if below min
        setInputValue(quantity.toString())
        // Trigger shake animation and show error if trying to set below min
        setShouldShake(true)
        setTimeout(() => setShouldShake(false), 500)
        toast.error(`Minimum order quantity is ${min} ${min === 1 ? 'unit' : 'units'}`)
        // Don't call onQuantityChange - keep current quantity
      } else if (parsedValue > max) {
        // Revert to current quantity if above max
        setInputValue(quantity.toString())
        // Trigger shake animation and show error if trying to set above max
        setShouldShake(true)
        setTimeout(() => setShouldShake(false), 500)
        toast.error(`Maximum order quantity is ${max} ${max === 1 ? 'unit' : 'units'}`)
        // Don't call onQuantityChange - keep current quantity
      } else {
        // Value is valid, proceed with update
        validateAndUpdate(inputValue)
      }
    } else {
      // Invalid input, revert to current quantity
      setInputValue(quantity.toString())
    }
  }

  const handleInputFocus = () => {
    setIsFocused(true)
    inputRef.current?.select()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      inputRef.current?.blur()
      return
    }

    // Allow: backspace, delete, tab, escape, enter
    const allowedKeys = ['Backspace', 'Delete', 'Tab', 'Escape', 'Enter']
    if (allowedKeys.includes(e.key)) {
      return
    }

    // Allow: Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
    if ((e.ctrlKey || e.metaKey) && ['a', 'c', 'v', 'x'].includes(e.key.toLowerCase())) {
      return
    }

    // Allow: Arrow keys, Home, End
    const navigationKeys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End']
    if (navigationKeys.includes(e.key)) {
      return
    }

    // Only allow numeric keys (0-9) on both main keyboard and numpad
    const isNumeric = /^[0-9]$/.test(e.key)
    if (!isNumeric) {
      e.preventDefault()
    }
  }

  const handleDecrease = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (disabled || isLoading) return
    
    // If trying to decrease below min, trigger shake animation and show error
    // Don't allow any decrease if we're already at or below min
    if (quantity <= min) {
      setShouldShake(true)
      setTimeout(() => setShouldShake(false), 500)
      toast.error(`Minimum order quantity is ${min} ${min === 1 ? 'unit' : 'units'}`)
      return // Exit early - don't call onQuantityChange
    }
    
    // Calculate new quantity, but ensure it's not below min
    const newQuantity = quantity - 1
    if (newQuantity < min) {
      setShouldShake(true)
      setTimeout(() => setShouldShake(false), 500)
      toast.error(`Minimum order quantity is ${min} ${min === 1 ? 'unit' : 'units'}`)
      return // Exit early - don't call onQuantityChange
    }
    
    setInputValue(newQuantity.toString())
    onQuantityChange(newQuantity)
  }

  const handleIncrease = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (disabled || isLoading) return
    
    // If trying to increase above max, trigger shake animation and show error
    // Don't allow any increase if we're already at or above max
    if (quantity >= max) {
      setShouldShake(true)
      setTimeout(() => setShouldShake(false), 500)
      toast.error(`Maximum order quantity is ${max} ${max === 1 ? 'unit' : 'units'}`)
      return // Exit early - don't call onQuantityChange
    }
    
    // Calculate new quantity, but ensure it's not above max
    const newQuantity = quantity + 1
    if (newQuantity > max) {
      setShouldShake(true)
      setTimeout(() => setShouldShake(false), 500)
      toast.error(`Maximum order quantity is ${max} ${max === 1 ? 'unit' : 'units'}`)
      return // Exit early - don't call onQuantityChange
    }
    
    setInputValue(newQuantity.toString())
    onQuantityChange(newQuantity)
  }

  // Don't disable buttons - let user click but prevent action if at limits
  const isDecreaseDisabled = disabled || isLoading
  const isIncreaseDisabled = disabled || isLoading

  // Shake animation variants
  const shakeVariants = {
    shake: {
      x: [0, -8, 8, -8, 8, -4, 4, 0],
      transition: {
        duration: 0.5,
        ease: 'easeInOut' as const,
      },
    },
    idle: {
      x: 0,
    },
  }

  return (
    <motion.div
      ref={containerRef}
      className={`inline-flex items-center mt-1 ${config.gap} ${className}`}
      onClick={(e) => e.stopPropagation()}
      animate={shouldShake ? 'shake' : 'idle'}
      variants={shakeVariants}
    >
      {/* Decrease Button */}
      <motion.button
        type="button"
        onClick={handleDecrease}
        disabled={isDecreaseDisabled}
        whileTap={!isDecreaseDisabled ? { scale: 0.95 } : {}}
        whileHover={!isDecreaseDisabled ? { scale: 1.05 } : {}}
        className={`
          ${config.buttonSize}
          rounded-full
          flex
          items-center
          justify-center
          transition-all
          duration-200
          disabled:opacity-30
          disabled:cursor-not-allowed
          shadow-sm
          ${
            isDecreaseDisabled
              ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
              : 'bg-gray-900 text-white hover:bg-gray-800 active:bg-gray-950 hover:shadow-md'
          }
          ${isLoading ? 'cursor-wait' : ''}
        `}
        aria-label="Decrease quantity"
      >
        {isLoading ? (
          <Loader2 className={`${config.iconSize} animate-spin`} />
        ) : (
          <Minus className={config.iconSize} strokeWidth={2.5} />
        )}
      </motion.button>

      {/* Quantity Input */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          disabled={disabled || isLoading}
          min={min}
          max={max}
          className={`
            ${config.inputSize}
            ${config.fontSize}
            ${config.inputWidth}
            text-center
            font-semibold
            text-gray-900
            border-2
            border-gray-200
            rounded-lg
            bg-white
            focus:outline-none
            focus:ring-2
            focus:ring-gray-900/20
            focus:border-gray-900
            disabled:opacity-50
            disabled:cursor-not-allowed
            disabled:bg-gray-50
            transition-all
            duration-200
            appearance-none
          `}
          aria-label="Quantity"
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={quantity}
        />
      </div>

      {/* Increase Button */}
      <motion.button
        type="button"
        onClick={handleIncrease}
        disabled={isIncreaseDisabled}
        whileTap={!isIncreaseDisabled ? { scale: 0.95 } : {}}
        whileHover={!isIncreaseDisabled ? { scale: 1.05 } : {}}
        className={`
          ${config.buttonSize}
          rounded-full
          flex
          items-center
          justify-center
          transition-all
          duration-200
          disabled:opacity-30
          disabled:cursor-not-allowed
          shadow-sm
          ${
            isIncreaseDisabled
              ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
              : 'bg-gray-900 text-white hover:bg-gray-800 active:bg-gray-950 hover:shadow-md'
          }
          ${isLoading ? 'cursor-wait' : ''}
        `}
        aria-label="Increase quantity"
      >
        {isLoading ? (
          <Loader2 className={`${config.iconSize} animate-spin`} />
        ) : (
          <Plus className={config.iconSize} strokeWidth={2.5} />
        )}
      </motion.button>
    </motion.div>
  )
}

export default QuantitySelector
