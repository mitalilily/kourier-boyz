import { useProfile } from '@/api/auth'
import { type CouponValidationResponse } from '@/api/coupons'
import { createOrder, type CreateOrderRequest } from '@/api/orders'
import {
  checkOrderStatus,
  createPaymentIntent,
  createRazorpayOrder,
  verifyRazorpayPayment,
  type CreateRazorpayOrderResponse,
} from '@/api/payments'
import { OrderConfirmation } from '@/components/checkout/OrderConfirmation'
import { OrderSummarySidebar } from '@/components/checkout/OrderSummarySidebar'
import { PaymentWaitingState } from '@/components/checkout/PaymentWaitingState'
import { PhoneVerificationStep } from '@/components/checkout/PhoneVerificationStep'
import { ReviewItemsStep } from '@/components/checkout/ReviewItemsStep'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useCheckoutLogic } from '@/hooks/useCheckoutLogic'
import { useCheckoutStorage } from '@/hooks/useCheckoutStorage'
import { useAuthStore } from '@/store/authStore'
import type { CartItem } from '@/types/cart'
import { guestCartUtils } from '@/utils/guestCart'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

const loadRazorpayScript = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if (document.getElementById('razorpay-sdk')) {
      resolve(true)
      return
    }
    const script = document.createElement('script')
    script.id = 'razorpay-sdk'
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}

const ReviewPage: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { isAuthenticated } = useAuthStore()
  const { data: profile } = useProfile()
  const queryClient = useQueryClient()
  const [showPhoneVerification, setShowPhoneVerification] = useState(false)

  // Show phone verification step automatically if phone is not verified
  useEffect(() => {
    if (isAuthenticated && profile) {
      if (!profile.isPhoneVerified) {
        setShowPhoneVerification(true)
      } else {
        setShowPhoneVerification(false)
      }
    }
  }, [isAuthenticated, profile])
  const {
    clearAll,
    getSelectedAddress,
    getPaymentMethod,
    getDeliveryInstructions,
    getRazorpayMethod,
    getProductInstructions,
    saveProductInstructions,
    getAppliedCoupon,
    saveAppliedCoupon: persistAppliedCoupon,
    getPromoCode,
    savePromoCode,
  } = useCheckoutStorage()

  // Get stored data - initialize from localStorage
  const selectedAddress = getSelectedAddress()
  const selectedPaymentMethod = getPaymentMethod()
  const storedRazorpayMethod = getRazorpayMethod() as 'card' | 'upi' | 'wallet' | 'paylater' | null

  // Promo code state
  const [promoCode, setPromoCode] = useState(() => getPromoCode())
  const [appliedCouponState, setAppliedCouponState] = useState<
    CouponValidationResponse['coupon'] | null
  >(() => getAppliedCoupon())
  const [showPromoInput, setShowPromoInput] = useState(false)
  const [couponError, setCouponError] = useState<string | null>(null)
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false)

  // Order creation state
  const [isCreatingOrder, setIsCreatingOrder] = useState(false)
  const [isCreatingRazorpayOrder, setIsCreatingRazorpayOrder] = useState(false)
  const [isCreatingPaymentIntent, setIsCreatingPaymentIntent] = useState(false)
  const [orderId, setOrderId] = useState<string | null>(null)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [productInstructions, setProductInstructions] = useState<Record<string, string>>(
    () => getProductInstructions() || {},
  )
  // Payment waiting state
  const [pendingPaymentOrderId, setPendingPaymentOrderId] = useState<string | null>(() => {
    // Check for pending payment on page load (recovery from refresh)
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('pending_payment_order_id')
    }
    return null
  })
  const [showPaymentWaiting, setShowPaymentWaiting] = useState(false)

  const finalizeSuccessfulOrder = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['orders'] })
    queryClient.invalidateQueries({ queryKey: ['cart'] })
    queryClient.invalidateQueries({ queryKey: ['guest-cart'] })

    guestCartUtils.clearCart()
    window.dispatchEvent(new CustomEvent('guest-cart-updated'))

    clearAll()
    sessionStorage.removeItem('guest_cart_items')
    sessionStorage.removeItem('checkout_intent')
    sessionStorage.removeItem('checkout_redirect')
  }, [clearAll, queryClient])

  const setAppliedCoupon = useCallback(
    (coupon: CouponValidationResponse['coupon'] | null) => {
      setAppliedCouponState(coupon)
      persistAppliedCoupon(coupon)
    },
    [persistAppliedCoupon],
  )

  // Business logic hook
  const {
    selectedItems,
    subtotal,
    discount,
    shipping,
    finalTotal,
    cartLoading,
    handleApplyPromoCode,
    isPending,
  } = useCheckoutLogic({
    selectedAddress,
    selectedPaymentMethod,
    cardDetails: {
      cardNumber: '',
      expiryDate: '',
      cvv: '',
      nameOnCard: '',
    },
    appliedCoupon: appliedCouponState,
    setAppliedCoupon,
  })

  const buildInstructionKey = useCallback((productId?: string, variantId?: string | null) => {
    return `${productId || 'unknown'}-${variantId || 'no-variant'}`
  }, [])

  useEffect(() => {
    if (!selectedItems) return
    setProductInstructions((prev) => {
      const validKeys = new Set(
        selectedItems.map((item: CartItem) =>
          buildInstructionKey(item.product?._id, item.variantId),
        ),
      )
      const next: Record<string, string> = {}
      let changed = false
      Object.entries(prev).forEach(([key, value]) => {
        if (validKeys.has(key)) {
          next[key] = value
        } else {
          changed = true
        }
      })
      if (changed) {
        saveProductInstructions(next)
        return next
      }
      return prev
    })
  }, [buildInstructionKey, saveProductInstructions, selectedItems])

  const handleInstructionChange = useCallback(
    (itemKey: string, value: string) => {
      setProductInstructions((prev) => {
        const sanitized = value.slice(0, 300)
        const hasContent = sanitized.trim().length > 0
        const next = { ...prev }
        if (hasContent) {
          next[itemKey] = sanitized
        } else {
          delete next[itemKey]
        }
        saveProductInstructions(next)
        return next
      })
    },
    [saveProductInstructions],
  )

  // Check for pending payment on page load (recovery from refresh)
  useEffect(() => {
    const checkPendingPayment = async () => {
      const storedOrderId = sessionStorage.getItem('pending_payment_order_id')
      if (!storedOrderId) return

      // If not authenticated, wait a bit for auth to load, then check
      if (!isAuthenticated) {
        // Wait up to 2 seconds for authentication to load
        const checkAuth = setInterval(() => {
          if (isAuthenticated) {
            clearInterval(checkAuth)
            checkPendingPayment()
          }
        }, 200)

        setTimeout(() => clearInterval(checkAuth), 2000)
        return
      }

      try {
        const result = await checkOrderStatus(storedOrderId)

        if (result.success && result.data) {
          if (result.data.status === 'order_created' && result.data.orders) {
            // Order already created - navigate to orders
            sessionStorage.removeItem('pending_payment_order_id')
            sessionStorage.removeItem('pending_payment_timestamp')
            navigate('/profile/orders', { replace: true })
            toast.success('Your order has been confirmed!')
            return
          } else if (result.data.status === 'paid' || result.data.status === 'pending') {
            // Still waiting - show waiting state
            setPendingPaymentOrderId(storedOrderId)
            setShowPaymentWaiting(true)
            return
          } else if (result.data.status === 'failed') {
            // Payment failed - clear state
            sessionStorage.removeItem('pending_payment_order_id')
            sessionStorage.removeItem('pending_payment_timestamp')
            toast.error('Payment failed. Please try again.')
            return
          }
        }
      } catch (error) {
        console.error('Error checking pending payment:', error)
        // Clear invalid state only if it's been more than 1 hour
        const storedTime = sessionStorage.getItem('pending_payment_timestamp')
        if (storedTime) {
          const timeDiff = Date.now() - parseInt(storedTime, 10)
          if (timeDiff > 60 * 60 * 1000) {
            // More than 1 hour old - clear stale state
            sessionStorage.removeItem('pending_payment_order_id')
            sessionStorage.removeItem('pending_payment_timestamp')
          } else {
            // Still recent - show waiting state and let PaymentWaitingState handle it
            setPendingPaymentOrderId(storedOrderId)
            setShowPaymentWaiting(true)
          }
        } else {
          // No timestamp - clear it
          sessionStorage.removeItem('pending_payment_order_id')
        }
      }
    }

    checkPendingPayment()
  }, [isAuthenticated, navigate])

  // Set page title
  useEffect(() => {
    if (showConfirmation) {
      document.title = 'Order Confirmed! - Kourier Boyz'
    } else if (showPaymentWaiting) {
      document.title = 'Confirming Order... - Kourier Boyz'
    } else {
      document.title = 'Final Check! - Kourier Boyz'
    }
  }, [showConfirmation, showPaymentWaiting])

  // Don't redirect immediately - let guests see the review page
  // Login will be required when they click "Place Order" (handled in handlePlaceOrder)

  // Redirect if cart is empty
  useEffect(() => {
    if (!cartLoading && (!selectedItems || selectedItems.length === 0)) {
      if (showConfirmation) {
        navigate('/profile/orders', { replace: true })
      } else {
        navigate('/cart')
      }
    }
  }, [selectedItems, cartLoading, navigate, showConfirmation])

  // Redirect if address or payment method not selected
  // Don't redirect if showing confirmation (order was just placed)
  useEffect(() => {
    if (showConfirmation) return // Don't redirect after successful order

    if (!cartLoading && (!selectedAddress || !selectedPaymentMethod)) {
      toast.error('Please complete address and payment selection')
      // Preserve buy now params if present
      const productId = searchParams.get('productId')
      const variantId = searchParams.get('variantId')
      const params = new URLSearchParams()
      if (productId) params.set('productId', productId)
      if (variantId) params.set('variantId', variantId)
      const queryString = params.toString()
      navigate(`/cart/checkout${queryString ? `?${queryString}` : ''}`)
    }
  }, [
    cartLoading,
    selectedAddress,
    selectedPaymentMethod,
    navigate,
    searchParams,
    showConfirmation,
  ])

  // Promo code handlers
  const handleApply = useCallback(() => {
    handleApplyPromoCode(promoCode, setCouponError, setShowSuccessAnimation, (code) => {
      const normalizedCode = code.trim().toUpperCase()
      setPromoCode(normalizedCode)
      savePromoCode(normalizedCode)
    })
  }, [handleApplyPromoCode, promoCode, savePromoCode])

  const handleRemovePromoCode = useCallback(() => {
    setAppliedCoupon(null)
    setCouponError(null)
    setShowSuccessAnimation(false)
    savePromoCode(null)
  }, [savePromoCode, setAppliedCoupon])

  const handleCancelPromo = useCallback(() => {
    setShowPromoInput(false)
    setPromoCode('')
    setCouponError(null)
  }, [])

  // Order creation / payment handling
  const handlePlaceOrder = useCallback(async () => {
    // Check authentication FIRST - before placing order
    if (!isAuthenticated) {
      // Store checkout intent and redirect to login
      sessionStorage.setItem('checkout_intent', 'true')

      // Preserve buy now params if present
      const params = new URLSearchParams()
      const buyNowProductId = searchParams.get('productId')
      const buyNowVariantId = searchParams.get('variantId')
      if (buyNowProductId) params.set('productId', buyNowProductId)
      if (buyNowVariantId) params.set('variantId', buyNowVariantId)

      const queryString = params.toString()
      const redirectUrl = `/cart/checkout/review${queryString ? `?${queryString}` : ''}`
      sessionStorage.setItem('checkout_redirect', redirectUrl)

      navigate(`/login?redirect=${encodeURIComponent(redirectUrl)}`)
      toast.info('Please login to place your order')
      return
    }

    if (!selectedAddress || !selectedPaymentMethod) {
      toast.error('Please complete all steps')
      return
    }

    // Check phone verification before placing order
    if (profile && !profile.isPhoneVerified) {
      // Show phone verification step (it will handle both adding phone and verifying)
      setShowPhoneVerification(true)
      if (!profile.phone) {
        toast.info('Please add and verify your phone number to place your order')
      } else {
        toast.info('Please verify your phone number to place your order')
      }
      return
    }

    const placeOrder = async (
      razorpayOrderId?: string,
      razorpayPaymentId?: string,
      razorpayPaymentMethod?: 'card' | 'upi' | 'wallet' | 'paylater' | 'netbanking',
      razorpayPaymentDetails?: CreateOrderRequest['razorpayPaymentDetails'],
    ) => {
      setIsCreatingOrder(true)
      try {
        const deliveryInstructions = getDeliveryInstructions()
        const itemInstructionsPayload: Array<{
          productId: string
          variantId?: string
          instructions: string
        }> = []

        selectedItems?.forEach((item: CartItem) => {
          const key = buildInstructionKey(item.product?._id, item.variantId)
          const note = productInstructions[key]?.trim()
          if (!note) return
          itemInstructionsPayload.push({
            productId: item.product._id,
            variantId: item.variantId,
            instructions: note,
          })
        })

        const orderData: CreateOrderRequest = {
          shippingAddress: {
            name: selectedAddress.fullName,
            phone: selectedAddress.phone,
            addressLine1: selectedAddress.addressLine1,
            addressLine2: selectedAddress.addressLine2,
            city: selectedAddress.city,
            state: selectedAddress.state,
            postalCode: selectedAddress.postalCode,
            country: selectedAddress.country,
          },
          paymentMethod: selectedPaymentMethod.type,
          couponId: appliedCouponState?._id,
          deliveryInstructions: deliveryInstructions || undefined,
          itemInstructions: itemInstructionsPayload.length ? itemInstructionsPayload : undefined,
          razorpayOrderId,
          razorpayPaymentId,
          razorpayPaymentMethod,
          razorpayPaymentDetails,
        }

        const response = await createOrder(orderData)
        if (response.success) {
          const orders = Array.isArray(response.data) ? response.data : [response.data]
          const firstOrder = orders[0]

          if (firstOrder) {
            setOrderId(firstOrder._id)
            setShowConfirmation(true)
            setProductInstructions({})

            if (orders.length > 1) {
              toast.success(`Order placed successfully! ${orders.length} orders created.`)
            } else {
              toast.success('Order placed successfully!')
            }

            finalizeSuccessfulOrder()

            // Navigate first, then clear data to prevent redirect loops
            navigate('/profile/orders', { replace: true })
          } else {
            toast.error('Order created but no order data received')
          }
        } else {
          toast.error(response.message || 'Failed to place order')
        }
      } catch (error: unknown) {
        const axiosError = error as {
          response?: { data?: { error?: string; message?: string } }
        }
        toast.error(
          axiosError.response?.data?.error ||
            axiosError.response?.data?.message ||
            'Failed to place order',
        )
      } finally {
        setIsCreatingOrder(false)
      }
    }

    // Online payment via Razorpay (modal)
    if (selectedPaymentMethod.id === 'razorpay') {
      if (!finalTotal || finalTotal <= 0) {
        toast.error('Invalid order amount for online payment')
        return
      }

      try {
        setIsCreatingRazorpayOrder(true)
        // Step 1: Create Razorpay order
        const orderResponse: CreateRazorpayOrderResponse = await createRazorpayOrder({
          amount: finalTotal,
        })

        if (!orderResponse.success) {
          toast.error(orderResponse.message || 'Failed to start online payment')
          setIsCreatingRazorpayOrder(false)
          return
        }

        const { orderId: rzpOrderId, amount, currency, keyId } = orderResponse.data

        setIsCreatingRazorpayOrder(false)
        setIsCreatingPaymentIntent(true)

        // Step 2: Create payment intent (stores order data temporarily)
        const deliveryInstructions = getDeliveryInstructions()
        const itemInstructionsPayload: Array<{
          productId: string
          variantId?: string
          instructions: string
        }> = []

        selectedItems?.forEach((item: CartItem) => {
          const key = buildInstructionKey(item.product?._id, item.variantId)
          const note = productInstructions[key]?.trim()
          if (!note) return
          itemInstructionsPayload.push({
            productId: item.product._id,
            variantId: item.variantId,
            instructions: note,
          })
        })

        // Retry mechanism for payment intent creation - CRITICAL FIX #2
        let intentResult
        let retryCount = 0
        const maxRetries = 3
        const retryDelay = 1000 // 1 second

        while (retryCount < maxRetries) {
          try {
            intentResult = await createPaymentIntent({
              razorpayOrderId: rzpOrderId,
              shippingAddress: {
                name: selectedAddress.fullName,
                phone: selectedAddress.phone,
                addressLine1: selectedAddress.addressLine1,
                addressLine2: selectedAddress.addressLine2,
                city: selectedAddress.city,
                state: selectedAddress.state,
                postalCode: selectedAddress.postalCode,
                country: selectedAddress.country,
              },
              couponId: appliedCouponState?._id,
              deliveryInstructions: deliveryInstructions || undefined,
              itemInstructions: itemInstructionsPayload.length
                ? itemInstructionsPayload
                : undefined,
              giftWrap: false, // Can be enhanced later
            })

            if (intentResult.success) {
              break // Success, exit retry loop
            }

            // Check for specific error types - CRITICAL FIX #1
            const errorMessage = intentResult.message || ''
            if (errorMessage.includes('stock') || errorMessage.includes('Stock')) {
              setIsCreatingPaymentIntent(false)
              toast.error(
                'Some items in your cart are out of stock. Please remove them and try again.',
                { duration: 5000 },
              )
              navigate('/cart')
              return
            }

            if (errorMessage.includes('price') || errorMessage.includes('Price')) {
              setIsCreatingPaymentIntent(false)
              toast.error('Product prices have changed. Please review your cart and try again.', {
                duration: 5000,
              })
              navigate('/cart')
              return
            }

            if (errorMessage.includes('coupon') || errorMessage.includes('Coupon')) {
              setIsCreatingPaymentIntent(false)
              toast.error('Coupon is no longer valid. Please remove it and try again.')
              setAppliedCoupon(null)
              return
            }

            // For other errors, retry
            retryCount++
            if (retryCount < maxRetries) {
              await new Promise((resolve) => setTimeout(resolve, retryDelay * retryCount))
              continue
            }
          } catch (intentError: unknown) {
            retryCount++
            const error = intentError as {
              response?: { data?: { message?: string } }
              message?: string
            }
            const errorMessage =
              error?.response?.data?.message || error?.message || 'Failed to create payment intent'

            // Don't retry on specific errors
            if (
              errorMessage.includes('stock') ||
              errorMessage.includes('Stock') ||
              errorMessage.includes('price') ||
              errorMessage.includes('Price') ||
              errorMessage.includes('coupon') ||
              errorMessage.includes('Coupon')
            ) {
              setIsCreatingPaymentIntent(false)
              if (errorMessage.includes('stock') || errorMessage.includes('Stock')) {
                toast.error(
                  'Some items in your cart are out of stock. Please remove them and try again.',
                  { duration: 5000 },
                )
                navigate('/cart')
              } else if (errorMessage.includes('price') || errorMessage.includes('Price')) {
                toast.error('Product prices have changed. Please review your cart and try again.', {
                  duration: 5000,
                })
                navigate('/cart')
              } else {
                toast.error('Coupon is no longer valid. Please remove it and try again.')
                setAppliedCoupon(null)
              }
              return
            }

            if (retryCount < maxRetries) {
              await new Promise((resolve) => setTimeout(resolve, retryDelay * retryCount))
              continue
            } else {
              setIsCreatingPaymentIntent(false)
              toast.error(
                `Failed to create payment intent after ${maxRetries} attempts. Please try again.`,
                { duration: 5000 },
              )
              console.error('Payment intent creation error:', intentError)
              return
            }
          }
        }

        setIsCreatingPaymentIntent(false)

        if (!intentResult?.success) {
          toast.error(intentResult?.message || 'Failed to create payment intent')
          return
        }

        // Load Razorpay script
        const loaded = await loadRazorpayScript()
        if (!loaded) {
          toast.error('Unable to load Razorpay. Please try again.')
          return
        }

        const defaultPaymentMethod = storedRazorpayMethod || 'card'

        // Payment modal timeout - CRITICAL FIX #4
        let paymentModalTimeout: NodeJS.Timeout | null = null
        const PAYMENT_MODAL_TIMEOUT = 30 * 60 * 1000 // 30 minutes

        const options: unknown = {
          key: keyId,
          amount,
          currency,
          name: 'Kourier Boyz – Secure Checkout',
          order_id: rzpOrderId,
          description: 'Pay securely with UPI or card. Powered by Razorpay.',
          image: '/brand/kourier-boyz-mark.png',
          prefill: {
            name: selectedAddress.fullName,
            contact: selectedAddress.phone,
          },
          method: {
            card: true,
            upi: true,
            netbanking: false,
            wallet: true,
            emi: false,
            paylater: true,
          },
          config: {
            display: {
              preferences: {
                default_payment_method: defaultPaymentMethod,
              },
            },
          },
          handler: async (response: {
            razorpay_order_id: string
            razorpay_payment_id: string
            razorpay_signature: string
          }) => {
            // Clear timeout on successful payment
            if (paymentModalTimeout) {
              clearTimeout(paymentModalTimeout)
              paymentModalTimeout = null
            }

            try {
              // Verify payment signature
              const verifyResult = await verifyRazorpayPayment({
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              })

              if (!verifyResult.success) {
                toast.error(verifyResult.message || 'Payment verification failed')
                return
              }

              // Store payment order ID and timestamp for recovery - CRITICAL FIX #3
              sessionStorage.setItem('pending_payment_order_id', response.razorpay_order_id)
              sessionStorage.setItem('pending_payment_timestamp', Date.now().toString())

              // Show waiting state
              setPendingPaymentOrderId(response.razorpay_order_id)
              setShowPaymentWaiting(true)
            } catch (error) {
              toast.error('Payment verification failed. Please contact support.')
              console.error('Payment verification error:', error)
            }
          },
          modal: {
            ondismiss: () => {
              // Clear timeout when modal is dismissed
              if (paymentModalTimeout) {
                clearTimeout(paymentModalTimeout)
                paymentModalTimeout = null
              }
              toast.info('Payment popup closed. You can try again or choose COD.')
            },
          },
          theme: {
            color: '#0f172a', // deep navy
          },
        }

        const RazorpayConstructor = (
          window as typeof window & {
            Razorpay?: new (opts: unknown) => unknown
          }
        ).Razorpay
        if (!RazorpayConstructor) {
          toast.error('Unable to load Razorpay. Please try again.')
          return
        }
        const razorpay = new RazorpayConstructor(options)

        // Set timeout for payment modal - CRITICAL FIX #4
        paymentModalTimeout = setTimeout(() => {
          try {
            razorpay.close()
            toast.error(
              'Payment session expired. Your payment intent has expired. Please try placing the order again.',
              { duration: 6000 },
            )
            // Clear any pending state
            sessionStorage.removeItem('pending_payment_order_id')
            setPendingPaymentOrderId(null)
          } catch (error) {
            console.error('Error closing payment modal:', error)
          }
        }, PAYMENT_MODAL_TIMEOUT)

        razorpay.open()
      } catch (error: unknown) {
        setIsCreatingRazorpayOrder(false)
        setIsCreatingPaymentIntent(false)

        // Better error messages - CRITICAL FIX #1
        const err = error as {
          response?: { data?: { message?: string; error?: string } }
          message?: string
        }
        const errorMessage =
          err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          'Unable to start online payment'

        if (errorMessage.includes('stock') || errorMessage.includes('Stock')) {
          toast.error(
            'Some items in your cart are out of stock. Please remove them and try again.',
            { duration: 5000 },
          )
          navigate('/cart')
        } else if (errorMessage.includes('price') || errorMessage.includes('Price')) {
          toast.error('Product prices have changed. Please review your cart and try again.', {
            duration: 5000,
          })
          navigate('/cart')
        } else if (errorMessage.includes('network') || errorMessage.includes('Network')) {
          toast.error('Network error. Please check your connection and try again.', {
            duration: 5000,
          })
        } else {
          toast.error(errorMessage, { duration: 5000 })
        }

        console.error('Payment initialization error:', error)
      }

      return
    }

    // COD and any other methods fall back to direct order creation
    await placeOrder()
  }, [
    appliedCouponState,
    buildInstructionKey,
    clearAll,
    finalTotal,
    getDeliveryInstructions,
    isAuthenticated,
    navigate,
    productInstructions,
    searchParams,
    selectedAddress,
    selectedItems,
    selectedPaymentMethod,
    storedRazorpayMethod,
    profile,
    setAppliedCoupon,
  ])

  // Handle order created from payment waiting state
  const handleOrderCreated = useCallback(
    (orderIds: string[]) => {
      if (orderIds.length > 0) {
        setOrderId(orderIds[0])
        setShowConfirmation(true)
        setShowPaymentWaiting(false)
        setPendingPaymentOrderId(null)
        setProductInstructions({})

        // Clear pending payment state
        sessionStorage.removeItem('pending_payment_order_id')

        if (orderIds.length > 1) {
          toast.success(`Order placed successfully! ${orderIds.length} orders created.`)
        } else {
          toast.success('Order placed successfully!')
        }

        finalizeSuccessfulOrder()

        // Navigate to orders page
        navigate('/profile/orders', { replace: true })
      }
    },
    [finalizeSuccessfulOrder, navigate],
  )

  const handlePaymentWaitingCancel = useCallback(() => {
    setShowPaymentWaiting(false)
    setPendingPaymentOrderId(null)
    sessionStorage.removeItem('pending_payment_order_id')
    toast.info('You can try placing the order again.')
  }, [])

  if (cartLoading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-gray-50 via-white to-gray-50 py-8 px-3 sm:px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-96">
            <Loader2 className="w-8 h-8 animate-spin text-blue" />
          </div>
        </div>
      </div>
    )
  }

  if (!selectedItems || selectedItems.length === 0) {
    return null
  }

  if (showConfirmation) {
    return (
      <div className="min-h-screen bg-linear-to-br from-gray-50 via-white to-gray-50 py-6 sm:py-8 px-3 sm:px-4 md:px-6">
        <div className="max-w-7xl mx-auto">
          <OrderConfirmation
            orderId={orderId || undefined}
            items={selectedItems}
            subtotal={subtotal}
            discount={discount}
            finalTotal={finalTotal}
            shippingAddress={
              selectedAddress
                ? {
                    name: selectedAddress.fullName,
                    addressLine1: selectedAddress.addressLine1,
                    addressLine2: selectedAddress.addressLine2,
                    city: selectedAddress.city,
                    state: selectedAddress.state,
                    postalCode: selectedAddress.postalCode,
                    phone: selectedAddress.phone,
                  }
                : null
            }
            paymentMethod={selectedPaymentMethod?.name || null}
          />
        </div>
      </div>
    )
  }

  // Show payment waiting state
  if (showPaymentWaiting && pendingPaymentOrderId) {
    return (
      <div className="min-h-screen bg-linear-to-br from-gray-50 via-white to-gray-50 py-6 sm:py-8 px-3 sm:px-4 md:px-6">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-2xl mx-auto">
            <PaymentWaitingState
              razorpayOrderId={pendingPaymentOrderId}
              onOrderCreated={handleOrderCreated}
              onCancel={handlePaymentWaitingCancel}
            />
          </div>
        </div>
      </div>
    )
  }

  // Preserve buy now params for back navigation
  const productId = searchParams.get('productId')
  const variantId = searchParams.get('variantId')
  const backUrl = (() => {
    const params = new URLSearchParams()
    if (productId) params.set('productId', productId)
    if (variantId) params.set('variantId', variantId)
    const queryString = params.toString()
    return `/cart/checkout${queryString ? `?${queryString}` : ''}`
  })()

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-50 via-white to-gray-50 pt-4 sm:pt-6 md:pt-32 lg:pt-36 px-3 sm:px-4 md:px-6 lg:px-8 pb-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-4 sm:mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(backUrl)}
            className="mb-3 sm:mb-4 text-xs sm:text-sm"
          >
            <ArrowLeft className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
            Back to Checkout
          </Button>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1 sm:mb-2">
            Review Your Order
          </h1>
          <p className="text-sm sm:text-base text-gray-600">
            Please review your order details before placing it
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Left Column - Review Items */}
          <div className="lg:col-span-2">
            {/* Phone Verification Step - Show first if needed */}
            {showPhoneVerification && (
              <Card className="mb-4 sm:mb-6">
                <CardContent className="p-4 sm:p-6">
                  <PhoneVerificationStep
                    phoneNumber={profile?.phone}
                    selectedAddress={getSelectedAddress()}
                    onVerified={() => {
                      setShowPhoneVerification(false)
                      queryClient.invalidateQueries({ queryKey: ['profile'] })
                      toast.success('Phone number verified successfully!')
                    }}
                  />
                </CardContent>
              </Card>
            )}
            <ReviewItemsStep
              items={selectedItems}
              shippingAddress={
                selectedAddress
                  ? {
                      name: selectedAddress.fullName,
                      addressLine1: selectedAddress.addressLine1,
                      addressLine2: selectedAddress.addressLine2,
                      city: selectedAddress.city,
                      state: selectedAddress.state,
                      postalCode: selectedAddress.postalCode,
                      phone: selectedAddress.phone,
                    }
                  : null
              }
              paymentMethod={selectedPaymentMethod?.name || null}
              productInstructions={productInstructions}
              onInstructionChange={handleInstructionChange}
            />
          </div>

          {/* Right Column - Order Summary Sidebar */}
          <div className="lg:col-span-1">
            <div className="space-y-4">
              <OrderSummarySidebar
                selectedItemsCount={selectedItems.length}
                subtotal={subtotal}
                discount={discount}
                shipping={shipping}
                finalTotal={finalTotal}
                promoCode={promoCode}
                setPromoCode={setPromoCode}
                showPromoInput={showPromoInput}
                setShowPromoInput={setShowPromoInput}
                appliedCoupon={appliedCouponState}
                couponError={couponError}
                showSuccessAnimation={showSuccessAnimation}
                isPending={isPending || false}
                onApplyCoupon={handleApply}
                onRemoveCoupon={handleRemovePromoCode}
                onCancelPromo={handleCancelPromo}
                cartItems={selectedItems}
                actionButton={
                  <Button
                    variant="primary"
                    className="w-full text-sm sm:text-base"
                    size="lg"
                    onClick={handlePlaceOrder}
                    disabled={
                      isCreatingOrder ||
                      isCreatingRazorpayOrder ||
                      isCreatingPaymentIntent ||
                      showPaymentWaiting
                    }
                  >
                    {isCreatingRazorpayOrder ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Initializing Payment...
                      </>
                    ) : isCreatingPaymentIntent ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Preparing Order...
                      </>
                    ) : isCreatingOrder ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Placing Order...
                      </>
                    ) : showPaymentWaiting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Waiting for Confirmation...
                      </>
                    ) : (
                      <>
                        Place Order
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>
                }
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ReviewPage
