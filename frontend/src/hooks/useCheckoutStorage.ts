import type { CouponValidationResponse } from '@/api/coupons'
import type { CardDetails } from '@/components/checkout/PaymentMethodStep'
import type { PaymentMethod } from '@/config/checkout.config'
import type { Address } from '@/types/address'
import { useCallback } from 'react'

const STORAGE_KEYS = {
  PAYMENT_METHOD: 'checkout_payment_method',
  SELECTED_UPI: 'checkout_selected_upi',
  UPI_ID: 'checkout_upi_id',
  CARD_DETAILS: 'checkout_card_details',
  RAZORPAY_METHOD: 'checkout_razorpay_method',
  SELECTED_ADDRESS: 'checkout_selected_address',
  DELIVERY_INSTRUCTIONS: 'checkout_delivery_instructions',
  PRODUCT_INSTRUCTIONS: 'checkout_product_instructions',
  APPLIED_COUPON: 'checkout_applied_coupon',
  APPLIED_PROMO_CODE: 'checkout_applied_promo_code',
} as const

export const useCheckoutStorage = () => {
  const savePaymentMethod = useCallback((method: PaymentMethod | null) => {
    if (method) {
      localStorage.setItem(STORAGE_KEYS.PAYMENT_METHOD, JSON.stringify(method))
    } else {
      localStorage.removeItem(STORAGE_KEYS.PAYMENT_METHOD)
    }
  }, [])

  const getPaymentMethod = useCallback((): PaymentMethod | null => {
    const stored = localStorage.getItem(STORAGE_KEYS.PAYMENT_METHOD)
    return stored ? JSON.parse(stored) : null
  }, [])

  const saveSelectedUPI = useCallback((upiId: string | null) => {
    if (upiId) {
      localStorage.setItem(STORAGE_KEYS.SELECTED_UPI, upiId)
    } else {
      localStorage.removeItem(STORAGE_KEYS.SELECTED_UPI)
    }
  }, [])

  const getSelectedUPI = useCallback((): string | null => {
    return localStorage.getItem(STORAGE_KEYS.SELECTED_UPI)
  }, [])

  const saveUPIId = useCallback((upiId: string) => {
    if (upiId) {
      localStorage.setItem(STORAGE_KEYS.UPI_ID, upiId)
    } else {
      localStorage.removeItem(STORAGE_KEYS.UPI_ID)
    }
  }, [])

  const getUPIId = useCallback((): string => {
    return localStorage.getItem(STORAGE_KEYS.UPI_ID) || ''
  }, [])

  const saveCardDetails = useCallback((details: CardDetails) => {
    localStorage.setItem(STORAGE_KEYS.CARD_DETAILS, JSON.stringify(details))
  }, [])

  const getCardDetails = useCallback((): CardDetails | null => {
    const stored = localStorage.getItem(STORAGE_KEYS.CARD_DETAILS)
    return stored ? JSON.parse(stored) : null
  }, [])

  const saveRazorpayMethod = useCallback((method: string | null) => {
    if (method) {
      localStorage.setItem(STORAGE_KEYS.RAZORPAY_METHOD, method)
    } else {
      localStorage.removeItem(STORAGE_KEYS.RAZORPAY_METHOD)
    }
  }, [])

  const getRazorpayMethod = useCallback((): string | null => {
    return localStorage.getItem(STORAGE_KEYS.RAZORPAY_METHOD)
  }, [])

  const saveSelectedAddress = useCallback((address: Address | null) => {
    if (address) {
      localStorage.setItem(STORAGE_KEYS.SELECTED_ADDRESS, JSON.stringify(address))
    } else {
      localStorage.removeItem(STORAGE_KEYS.SELECTED_ADDRESS)
    }
  }, [])

  const getSelectedAddress = useCallback((): Address | null => {
    const stored = localStorage.getItem(STORAGE_KEYS.SELECTED_ADDRESS)
    return stored ? JSON.parse(stored) : null
  }, [])

  const saveDeliveryInstructions = useCallback((instructions: string) => {
    if (instructions) {
      localStorage.setItem(STORAGE_KEYS.DELIVERY_INSTRUCTIONS, instructions)
    } else {
      localStorage.removeItem(STORAGE_KEYS.DELIVERY_INSTRUCTIONS)
    }
  }, [])

  const getDeliveryInstructions = useCallback((): string => {
    return localStorage.getItem(STORAGE_KEYS.DELIVERY_INSTRUCTIONS) || ''
  }, [])

  const saveProductInstructions = useCallback((instructions: Record<string, string>) => {
    if (instructions && Object.keys(instructions).length > 0) {
      localStorage.setItem(STORAGE_KEYS.PRODUCT_INSTRUCTIONS, JSON.stringify(instructions))
    } else {
      localStorage.removeItem(STORAGE_KEYS.PRODUCT_INSTRUCTIONS)
    }
  }, [])

  const getProductInstructions = useCallback((): Record<string, string> => {
    const stored = localStorage.getItem(STORAGE_KEYS.PRODUCT_INSTRUCTIONS)
    return stored ? JSON.parse(stored) : {}
  }, [])

  const saveAppliedCoupon = useCallback(
    (coupon: CouponValidationResponse['coupon'] | null) => {
      if (coupon) {
        localStorage.setItem(STORAGE_KEYS.APPLIED_COUPON, JSON.stringify(coupon))
      } else {
        localStorage.removeItem(STORAGE_KEYS.APPLIED_COUPON)
      }
    },
    [],
  )

  const getAppliedCoupon = useCallback((): CouponValidationResponse['coupon'] | null => {
    const stored = localStorage.getItem(STORAGE_KEYS.APPLIED_COUPON)
    return stored ? JSON.parse(stored) : null
  }, [])

  const savePromoCode = useCallback((code: string | null) => {
    if (code && code.trim().length > 0) {
      localStorage.setItem(STORAGE_KEYS.APPLIED_PROMO_CODE, code)
    } else {
      localStorage.removeItem(STORAGE_KEYS.APPLIED_PROMO_CODE)
    }
  }, [])

  const getPromoCode = useCallback((): string => {
    return localStorage.getItem(STORAGE_KEYS.APPLIED_PROMO_CODE) || ''
  }, [])

  const clearAll = useCallback(() => {
    Object.values(STORAGE_KEYS).forEach((key) => {
      localStorage.removeItem(key)
    })
  }, [])

  return {
    savePaymentMethod,
    getPaymentMethod,
    saveSelectedUPI,
    getSelectedUPI,
    saveUPIId,
    getUPIId,
    saveCardDetails,
    getCardDetails,
    saveSelectedAddress,
    getSelectedAddress,
    saveDeliveryInstructions,
    getDeliveryInstructions,
    saveRazorpayMethod,
    getRazorpayMethod,
    saveProductInstructions,
    getProductInstructions,
    saveAppliedCoupon,
    getAppliedCoupon,
    savePromoCode,
    getPromoCode,
    clearAll,
  }
}
