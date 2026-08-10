import { useServiceability } from '@/api/products'
import { getStoredDeliveryPin } from '@/utils/deliveryLocationStorage'
import { useEffect, useState } from 'react'
import { DeliveryStatus, getDeliveryDateLabel, sanitizePinCode } from './utils'

interface UseProductDeliveryProps {
  product:
    | {
        _id?: string
        freeShipping?: boolean
        price?: number
        effectivePrice?: number // What customer actually pays (from backend)
      }
    | null
    | undefined
  isOutOfStock: boolean
}

export const useProductDelivery = ({ product, isOutOfStock }: UseProductDeliveryProps) => {
  const initialPin = getStoredDeliveryPin()
  const [deliveryPin, setDeliveryPin] = useState(initialPin)
  const [deliveryStatus, setDeliveryStatus] = useState<DeliveryStatus>(null)
  const [shouldCheckServiceability, setShouldCheckServiceability] = useState(false)
  // Track the last pincode we checked to avoid re-checking the same pincode
  const [lastCheckedPin, setLastCheckedPin] = useState<string>('')
  const [autoCheckPending, setAutoCheckPending] = useState<boolean>(() =>
    initialPin ? initialPin.length >= 5 : false,
  )

  // Use the real API to check serviceability
  const sanitizedPin = sanitizePinCode(deliveryPin)
  const {
    data: serviceabilityData,
    isLoading: isCheckingServiceability,
    error: serviceabilityError,
  } = useServiceability(product?._id, sanitizedPin.length >= 5 ? sanitizedPin : undefined, {
    orderAmount: product?.effectivePrice ?? product?.price,
    paymentType: 'cod',
    enabled:
      shouldCheckServiceability && !!product?._id && sanitizedPin.length >= 5 && !isOutOfStock,
  })

  // Update delivery status based on API response
  useEffect(() => {
    if (!shouldCheckServiceability) return

    if (isCheckingServiceability) {
      setDeliveryStatus({
        status: 'success',
        message: 'Checking delivery availability...',
      })
      return
    }

    if (serviceabilityError) {
      setDeliveryStatus({
        status: 'error',
        message: 'Unable to check delivery availability right now. Please try again.',
      })
      return
    }

    if (serviceabilityData?.success) {
      const { courier, message } = serviceabilityData.data

      if (message || !courier) {
        setDeliveryStatus({
          status: 'error',
          message:
            message ||
            'We currently do not deliver to this location. Please try a different pincode or contact our support team for assistance.',
        })
        return
      }

      // Use courier (most economical - fastest and cheapest) option for delivery estimate
      const selectedOption = courier
      if (selectedOption) {
        const etaLabel = getDeliveryDateLabel(
          selectedOption.estimated_delivery_date,
          selectedOption.estimated_delivery_days,
        )

        setDeliveryStatus({
          status: 'success',
          message: etaLabel
            ? `Estimated delivery by ${etaLabel}.`
            : `Good news! We deliver to ${sanitizedPin}.`,
          etaDate: etaLabel,
          serviceabilityData: serviceabilityData.data,
        })
      }
    }
  }, [
    serviceabilityData,
    isCheckingServiceability,
    serviceabilityError,
    shouldCheckServiceability,
    sanitizedPin,
  ])

  // Auto-check serviceability when a valid pincode changes and auto-check is enabled
  useEffect(() => {
    const sanitized = sanitizePinCode(deliveryPin)
    // Auto-check if:
    // 1. We have a valid pincode (5+ digits)
    // 2. Product is loaded
    // 3. Product is not out of stock
    // 4. We haven't checked this specific pincode yet
    // 5. Auto-check has been requested
    if (
      autoCheckPending &&
      sanitized.length >= 5 &&
      !!product?._id &&
      !isOutOfStock &&
      sanitized !== lastCheckedPin
    ) {
      // Trigger serviceability check for the new pincode
      setLastCheckedPin(sanitized)
      setShouldCheckServiceability(true)
      setAutoCheckPending(false)
    }
  }, [deliveryPin, product?._id, isOutOfStock, lastCheckedPin, autoCheckPending])

  // Update PIN when localStorage changes
  useEffect(() => {
    const handleStorageChange = () => {
      const newPin = getStoredDeliveryPin()
      if (newPin !== deliveryPin) {
        setDeliveryPin(newPin)
        // Reset check flag and last checked pin when PIN changes from storage
        setShouldCheckServiceability(false)
        setLastCheckedPin('')
        setDeliveryStatus(null)
        setAutoCheckPending(newPin.length >= 5)
      }
    }

    // Check on mount
    handleStorageChange()

    // Listen for storage events (from other tabs/windows)
    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('kourier-boyz-location-changed', handleStorageChange)
    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('kourier-boyz-location-changed', handleStorageChange)
    }
  }, [deliveryPin])

  const handleDeliveryCheck = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    const sanitized = sanitizePinCode(deliveryPin)

    if (sanitized.length < 5) {
      setDeliveryStatus({
        status: 'error',
        message: 'Enter a valid 5 or 6 digit PIN or ZIP code.',
      })
      return
    }

    if (isOutOfStock) {
      setDeliveryStatus({
        status: 'error',
        message: 'This item is currently out of stock. Try again soon.',
      })
      return
    }

    // Trigger serviceability check
    setLastCheckedPin(sanitized)
    setShouldCheckServiceability(true)
    setAutoCheckPending(false)
  }

  const handleDeliveryPinChange = (value: string, options?: { autoCheck?: boolean }) => {
    const sanitized = sanitizePinCode(value)
    setDeliveryPin(value)
    // Reset state when PIN changes
    setShouldCheckServiceability(false)
    setLastCheckedPin('')
    setAutoCheckPending(Boolean(options?.autoCheck) && sanitized.length >= 5)
    if (deliveryStatus) {
      setDeliveryStatus(null)
    }
    // If the new PIN is valid and different, the auto-check useEffect will trigger
  }

  return {
    deliveryPin,
    deliveryStatus,
    handleDeliveryCheck,
    handleDeliveryPinChange,
    isCheckingServiceability,
    serviceabilityData: serviceabilityData?.data,
  }
}
