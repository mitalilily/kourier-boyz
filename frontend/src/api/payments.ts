import API from '@/lib/axios'

export interface CreateRazorpayOrderRequest {
  amount: number
}

export interface CreateRazorpayOrderResponse {
  success: boolean
  message: string
  data: {
    orderId: string
    amount: number
    currency: string
    keyId: string
  }
}

export const createRazorpayOrder = async (
  payload: CreateRazorpayOrderRequest,
): Promise<CreateRazorpayOrderResponse> => {
  const response = await API.post('/payments/razorpay/order', payload)
  return response.data
}

export interface VerifyRazorpayPaymentRequest {
  razorpayOrderId: string
  razorpayPaymentId: string
  razorpaySignature: string
}

export interface RazorpayPaymentDetails {
  method?: string | null
  card?: {
    last4?: string | null
    network?: string | null
    issuer?: string | null
    type?: string | null
  }
  upi?: {
    vpa?: string | null
    payer_account_type?: string | null
  }
  wallet?: {
    wallet_name?: string | null
  }
  paylater?: {
    provider?: string | null
  }
  netbanking?: {
    bank?: string | null
  }
  bank?: string | null
  contact?: string | null
  email?: string | null
  international?: boolean
  notes?: Record<string, string>
}

export interface VerifyRazorpayPaymentResponse {
  success: boolean
  message: string
  data?: {
    razorpayPaymentId: string
    razorpayOrderId: string
    paymentMethod: string | null
    paymentDetails: RazorpayPaymentDetails | null
  }
}

export const verifyRazorpayPayment = async (
  payload: VerifyRazorpayPaymentRequest,
): Promise<VerifyRazorpayPaymentResponse> => {
  const response = await API.post('/payments/razorpay/verify', payload)
  return response.data
}

export interface ConfirmRazorpayPaymentRequest {
  token: string
  orderId: string
  amount: number
}

export interface ConfirmRazorpayPaymentResponse {
  success: boolean
  message: string
  data?: unknown
}

export const confirmRazorpayPayment = async (
  payload: ConfirmRazorpayPaymentRequest,
): Promise<ConfirmRazorpayPaymentResponse> => {
  const response = await API.post('/payments/razorpay/confirm', payload)
  return response.data
}

export interface CreatePaymentIntentRequest {
  razorpayOrderId: string
  shippingAddress: {
    name: string
    phone: string
    addressLine1: string
    addressLine2?: string
    city: string
    state: string
    postalCode: string
    country: string
  }
  couponId?: string
  deliveryInstructions?: string
  itemInstructions?: Array<{
    productId: string
    variantId?: string
    instructions: string
  }>
  giftWrap?: boolean
}

export interface CreatePaymentIntentResponse {
  success: boolean
  message: string
  data?: {
    intentId: string
    razorpayOrderId: string
    status: string
    expiresAt: string
  }
}

export const createPaymentIntent = async (
  payload: CreatePaymentIntentRequest,
): Promise<CreatePaymentIntentResponse> => {
  const response = await API.post('/payments/razorpay/intent', payload)
  return response.data
}

export interface CheckOrderStatusResponse {
  success: boolean
  data?: {
    status: 'pending' | 'paid' | 'failed' | 'expired' | 'order_created'
    intentId?: string
    razorpayOrderId?: string
    razorpayPaymentId?: string
    orderIds?: string[]
    orders?: Array<{
      _id: string
      orderNumber: string
      status: string
      paymentStatus: string
      total: number
      createdAt: string
    }>
  }
}

export const checkOrderStatus = async (
  razorpayOrderId: string,
): Promise<CheckOrderStatusResponse> => {
  const response = await API.get(`/payments/razorpay/status/${razorpayOrderId}`)
  return response.data
}
