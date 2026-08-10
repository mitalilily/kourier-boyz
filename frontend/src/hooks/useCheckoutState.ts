import type { CardDetails } from '@/components/checkout/PaymentMethodStep'
import { PAYMENT_METHODS, type PaymentMethod } from '@/config/checkout.config'
import type { Address } from '@/types/address'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useCheckoutStorage } from './useCheckoutStorage'

interface CheckoutState {
  selectedAddress: Address | null
  selectedPaymentMethod: PaymentMethod | null
  selectedUPI: string | null
  upiId: string
  razorpayMethod: 'card' | 'upi' | 'wallet' | 'paylater' | null
  cardDetails: CardDetails
  deliveryInstructions: string
}

/**
 * Custom hook to manage checkout state with optimized localStorage sync
 * Uses a single debounced effect instead of multiple useEffects
 */
export const useCheckoutState = () => {
  const {
    getPaymentMethod,
    getSelectedUPI,
    getUPIId,
    getCardDetails,
    getSelectedAddress,
    getDeliveryInstructions,
    savePaymentMethod,
    saveSelectedUPI,
    saveUPIId,
    saveCardDetails,
    saveSelectedAddress,
    saveDeliveryInstructions,
    getRazorpayMethod,
    saveRazorpayMethod,
  } = useCheckoutStorage()

  // Initialize state from localStorage
  // For selectedAddress, use saved address if it exists
  // AddressSelectionStep will handle matching it to header location
  const [state, setState] = useState<CheckoutState>(() => {
    const savedAddress = getSelectedAddress()
    const savedPaymentMethod = getPaymentMethod()
    
    // Default to COD if no payment method is saved
    const codMethod = PAYMENT_METHODS.find(m => m.id === 'cod')
    const defaultPaymentMethod = savedPaymentMethod || codMethod || null

    return {
      selectedAddress: savedAddress,
      selectedPaymentMethod: defaultPaymentMethod,
      selectedUPI: getSelectedUPI(),
      upiId: getUPIId(),
      razorpayMethod: (getRazorpayMethod() as CheckoutState['razorpayMethod']) || null,
      cardDetails: getCardDetails() || {
        cardNumber: '',
        expiryDate: '',
        cvv: '',
        nameOnCard: '',
      },
      deliveryInstructions: getDeliveryInstructions(),
    }
  })

  // Use ref to track if we should save (prevents saving on initial load)
  const shouldSaveRef = useRef(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Debounced save to localStorage
  useEffect(() => {
    if (!shouldSaveRef.current) {
      shouldSaveRef.current = true
      return
    }

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // Debounce saves to avoid excessive localStorage writes
    timeoutRef.current = setTimeout(() => {
      if (state.selectedAddress) {
        saveSelectedAddress(state.selectedAddress)
      }
      if (state.selectedPaymentMethod) {
        savePaymentMethod(state.selectedPaymentMethod)
      }
      if (state.selectedUPI) {
        saveSelectedUPI(state.selectedUPI)
      }
      if (state.upiId) {
        saveUPIId(state.upiId)
      }
      if (state.razorpayMethod) {
        saveRazorpayMethod(state.razorpayMethod)
      }
      if (state.cardDetails) {
        saveCardDetails(state.cardDetails)
      }
      if (state.deliveryInstructions) {
        saveDeliveryInstructions(state.deliveryInstructions)
      }
    }, 300) // 300ms debounce

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [
    state.selectedAddress,
    state.selectedPaymentMethod,
    state.selectedUPI,
    state.upiId,
    state.razorpayMethod,
    state.cardDetails,
    state.deliveryInstructions,
    saveSelectedAddress,
    savePaymentMethod,
    saveSelectedUPI,
    saveUPIId,
    saveRazorpayMethod,
    saveCardDetails,
    saveDeliveryInstructions,
  ])

  // State setters
  const updateState = useCallback(
    <K extends keyof CheckoutState>(key: K, value: CheckoutState[K]) => {
      setState((prev) => ({ ...prev, [key]: value }))
    },
    [],
  )

  const setSelectedAddress = useCallback(
    (address: Address | null) => updateState('selectedAddress', address),
    [updateState],
  )

  const setSelectedPaymentMethod = useCallback(
    (method: PaymentMethod | null) => updateState('selectedPaymentMethod', method),
    [updateState],
  )

  const setSelectedUPI = useCallback(
    (upi: string | null) => updateState('selectedUPI', upi),
    [updateState],
  )

  const setUpiId = useCallback((id: string) => updateState('upiId', id), [updateState])

  const setCardDetails = useCallback(
    (details: CardDetails) => updateState('cardDetails', details),
    [updateState],
  )

  const setDeliveryInstructions = useCallback(
    (instructions: string) => updateState('deliveryInstructions', instructions),
    [updateState],
  )

  const setRazorpayMethod = useCallback(
    (method: CheckoutState['razorpayMethod']) => updateState('razorpayMethod', method),
    [updateState],
  )

  return {
    ...state,
    setSelectedAddress,
    setSelectedPaymentMethod,
    setSelectedUPI,
    setUpiId,
    setCardDetails,
    setDeliveryInstructions,
    setRazorpayMethod,
  }
}
