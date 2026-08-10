import API from '@/lib/axios'

export interface OrderItem {
  _id?: string // Order item ID
  product: {
    _id: string
    name: string
    slug?: string
    mainImage?: string
    reviewedByUser?: boolean
    returnable?: boolean
    returnDays?: number
  }
  variant?: { _id: string; name?: string; sku?: string; mainImage?: string }
  quantity: number
  price: number
  effectivePrice?: number // Effective price per unit (what customer actually pays)
  priceWithoutTax?: number // Price per unit exclusive of GST
  subtotal: number
  discountAmount?: number // Total discount applied to this line from item-level coupon
  instructions?: string
  variantId?: string
}

export interface Order {
  _id: string
  orderNumber?: string
  batchId?: string // Unique ID to track orders from same cart checkout
  user: string | { _id: string; name?: string; email?: string; gstNumber?: string }
  items: OrderItem[]
  subtotal: number
  discount: number
  shipping: number
  tax: number
  total: number
  status:
    | 'pending'
    | 'ready_to_ship'
    | 'confirmed'
    | 'processing'
    | 'shipped'
    | 'pickup_requested'
    | 'in_transit'
    | 'out_for_delivery'
    | 'delivered'
    | 'cancelled'
    | 'refunded'
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded'
  paymentMethod: 'card' | 'cod' | 'wallet' | 'upi'
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
  deliveryInstructions?: string
  // Admin/global coupon attached to this order (if any)
  coupon?: {
    _id: string
    code?: string
    type?: 'percentage' | 'fixed'
    value?: number
    description?: string
  }
  couponRedemption?: string
  discountAmount?: number
  invoice?: {
    invoice_id?: string
    invoice_url?: string
    invoice_number?: string
    generated_at?: string | Date
  }
  label?: {
    label_id?: string
    label_url?: string
    generated_at?: string | Date
  }
  // Returns
  canRequestReturn?: boolean
  returnRequested?: boolean
  returnStatus?: string
  isReturnLocked?: boolean
  // Replacement order tracking
  isReplacement?: boolean
  originalOrderId?: string
  returnId?: string
  // Payment gateway metadata
  razorpayOrderId?: string | null
  razorpayPaymentId?: string | null
  paymentGateway?: 'razorpay' | 'stripe' | 'cashfree' | 'phonepe' | null
  razorpayPaymentMethod?: 'card' | 'upi' | 'wallet' | 'paylater' | 'netbanking' | null
  razorpayPaymentDetails?: {
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
  } | null
  createdAt: string | Date
  updatedAt: string | Date
}

export interface CreateOrderRequest {
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
  paymentMethod: 'card' | 'cod' | 'wallet' | 'upi'
  couponId?: string
  deliveryInstructions?: string
  itemInstructions?: Array<{
    productId: string
    variantId?: string
    instructions: string
  }>
  razorpayOrderId?: string
  razorpayPaymentId?: string
  razorpayPaymentMethod?: 'card' | 'upi' | 'wallet' | 'paylater' | 'netbanking'
  razorpayPaymentDetails?: {
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
  } | null
}

export interface CreateOrderResponse {
  success: boolean
  message: string
  data: Order | Order[] // Can be single order or array of orders (for batch orders)
  batchId?: string // Unique ID to track orders from same cart checkout
}

export interface OrdersResponse {
  success: boolean
  data: Order[]
  pagination: {
    total: number
    page: number
    limit: number
    pages: number
  }
}

export interface OrderResponse {
  success: boolean
  data: Order
}

// Create order
export const createOrder = async (data: CreateOrderRequest): Promise<CreateOrderResponse> => {
  const response = await API.post('/orders', data)
  return response.data
}

// Get user orders
export const getUserOrders = async (params?: {
  status?: string
  page?: number
  limit?: number
  search?: string
  months?: number
}): Promise<OrdersResponse> => {
  const response = await API.get('/orders', { params })
  return response.data
}

// Get customer orders (admin endpoint - retrieves all orders for a particular customer)
export const getCustomerOrders = async (
  customerId: string,
  params?: {
    status?: string
    paymentStatus?: string
    page?: number
    limit?: number
    search?: string
    fromDate?: string
    toDate?: string
  },
): Promise<OrdersResponse> => {
  const response = await API.get(`/admin/orders/customer/${customerId}`, {
    params,
  })
  return response.data
}

// Get single order
export const getOrder = async (id: string): Promise<OrderResponse> => {
  const response = await API.get(`/orders/${id}`)
  return response.data
}

// Download invoice (returns blob for PDF download)
export const downloadInvoice = async (
  id: string,
  onProgress?: (progress: { loaded: number; total?: number }) => void,
): Promise<Blob> => {
  const response = await API.get(`/orders/${id}/invoice`, {
    responseType: 'blob',
    onDownloadProgress: (progressEvent) => {
      if (onProgress) {
        onProgress({
          loaded: progressEvent.loaded,
          total: progressEvent.total,
        })
      }
    },
  })
  return response.data
}

// Download label
export const downloadLabel = async (
  id: string,
): Promise<{
  success: boolean
  data: { label_url: string; label_id?: string }
}> => {
  const response = await API.get(`/orders/${id}/label`)
  return response.data
}

// Get birthday recap
export interface BirthdayRecapResponse {
  success: boolean
  data: {
    stats: {
      totalOrders: number
      categoriesExplored: number
      citiesDelivered: number
    }
    popularProducts: Array<{
      _id: string
      name: string
      slug: string
      mainImage?: string
      images: string[]
      price?: number
      comparePrice?: number
      discountPercent?: number
      rating?: number
      reviewCount?: number
      soldCount?: number
    }>
  }
}

export const getBirthdayRecap = async (): Promise<BirthdayRecapResponse> => {
  const response = await API.get('/orders/birthday-recap')
  return response.data
}

// Cancel order
export const cancelOrder = async (id: string): Promise<OrderResponse> => {
  const response = await API.post(`/orders/${id}/cancel`)
  return response.data
}
