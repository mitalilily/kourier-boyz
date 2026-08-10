import API from './axiosInstance'

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'ready_to_ship'
  | 'shipped'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'
  | 'refunded'

export type SellerShipmentStatus =
  | 'pending'
  | 'processing'
  | 'ready_to_ship'
  | 'pickup_requested'
  | 'shipped'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'

export interface AdminSellerShipment {
  _id: string
  seller: {
    _id: string
    name?: string
    businessName?: string
    storeSlug?: string
  }
  status: SellerShipmentStatus
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded'
  inventoryPacked: boolean
  shippingMeta?: {
    awb?: string
    courier?: string
    label?: string
    tracking_link?: string
    estimated_delivery_date?: string
  }
  courierCart?: {
    courier_id?: number
    order_id?: string
    order_number?: string
    rate?: number
    awb_number?: string
    label_url?: string
    tracking_link?: string
    estimated_delivery_date?: string
  }
  invoice?: {
    invoice_id?: string
    invoice_url?: string
    invoice_number?: string
    generated_at?: string | Date
    hsnSummary?: Array<{
      hsnSacCode: string
      gstRatePercent: number
      taxableValueTotal: number
      igstAmountTotal: number
      cgstAmountTotal: number
      sgstAmountTotal: number
    }>
  }
  label?: {
    label_id?: string
    label_url?: string
    generated_at?: string | Date
  }
  totals?: {
    itemSubtotal: number
    discount?: number
  }
  trackingEvents?: Array<{
    status: string
    location?: string
    message?: string
    timestamp: string
  }>
  shareableTrackingLink?: string | null
}

export interface AdminOrder {
  _id: string
  orderNumber?: string
  buyer: {
    name?: string
    phone?: string
    email?: string
  }
  user?: string | { _id: string; name?: string; email?: string } // User ID for admin operations
  status: OrderStatus
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded'
  paymentMethod: 'card' | 'cod' | 'wallet' | 'upi'
  subtotal: number
  total: number
  shipping: number
  discount: number
  discountAmount?: number
  tax: number
  codCharges?: number
  orderedAt: string
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
  items: Array<{
    _id?: string
    product: {
      _id: string
      name?: string
      sku?: string
      mainImage?: string
      images?: string[]
    }
    variant?: {
      _id: string
      name?: string
      sku?: string
      mainImage?: string
      images?: string[]
      attributes?: Record<string, string>
    }
    seller?: string | { _id: string; name?: string; businessName?: string }
    quantity: number
    price: number
    effectivePrice?: number
    priceWithoutTax?: number
    subtotal: number
    hsnSacCode?: string
    gstRatePercent?: number
    gstTaxType?: 'IGST' | 'CGST_SGST'
    igst?: number
    cgst?: number
    sgst?: number
    variantName?: string
    variantSku?: string
    couponCode?: string
    discountAmount?: number
  }>
  sellerShipments: AdminSellerShipment[]
  invoice?: {
    invoice_id?: string
    invoice_url?: string
    invoice_number?: string
    generated_at?: string
    hsnSummary?: Array<{
      hsnSacCode: string
      gstRatePercent: number
      taxableValueTotal: number
      igstAmountTotal: number
      cgstAmountTotal: number
      sgstAmountTotal: number
    }>
  }
  label?: {
    label_id?: string
    label_url?: string
    generated_at?: string | Date
  }
  coupon?: {
    _id: string
    code?: string
    discountType?: string
  }
  couponCode?: string
  discountType?: string
  deliveryInstructions?: string
  estimatedDeliveryDate?: string
  settlementStatus?: string
  orderSource?: string
  notes?: string
  timeline?: Array<{
    status: string
    timestamp: string
    message?: string
  }>
}

export interface AdminOrdersResponse {
  success: boolean
  data: AdminOrder[]
  pagination: {
    total: number
    page: number
    limit: number
    pages: number
  }
}

export interface AdminOrderResponse {
  success: boolean
  data: AdminOrder
}

export interface AdminRefund {
  _id: string
  order: string
  refundAmount: number
  refundReason: string
  refundSource: 'PLATFORM' | 'SELLER'
  refundMethod: 'MANUAL_UPI' | 'MANUAL_BANK'
  referenceNumber: string
  refundDate: string
  initiatedByAdmin?:
    | {
        _id: string
        name?: string
        email?: string
      }
    | string
  adminNote?: string
  status: 'COMPLETED'
  creditNote?: {
    credit_note_id?: string
    credit_note_url?: string
    credit_note_number?: string
    generated_at?: string
    hsnSummary?: Array<{
      hsnSacCode: string
      gstRatePercent: number
      taxableValueTotal: number
      igstAmountTotal: number
      cgstAmountTotal: number
      sgstAmountTotal: number
    }>
  }
  createdAt: string
}

export interface AdminOrderRefundsResponse {
  success: boolean
  data: AdminRefund[]
}

export const fetchAdminOrders = async (params?: {
  status?: string
  paymentStatus?: string
  seller?: string
  fromDate?: string
  toDate?: string
  search?: string
  page?: number
  limit?: number
}): Promise<AdminOrdersResponse> => {
  const response = await API.get('/admin/orders', { params })
  return response.data
}

export const fetchAdminOrder = async (orderId: string): Promise<AdminOrderResponse> => {
  const response = await API.get(`/admin/orders/${orderId}`)
  return response.data
}

export const fetchOrderRefunds = async (orderId: string): Promise<AdminOrderRefundsResponse> => {
  const response = await API.get(`/admin/orders/${orderId}/refunds`)
  return response.data
}

export const updateAdminOrderStatusApi = async (orderId: string, status: OrderStatus) => {
  const response = await API.patch(`/admin/orders/${orderId}/status`, { status })
  return response.data
}

export const updateAdminPaymentStatusApi = async (
  orderId: string,
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded',
) => {
  const response = await API.patch(`/admin/orders/${orderId}/payment-status`, { paymentStatus })
  return response.data
}

export const updateAdminSellerShipmentStatusApi = async (
  orderId: string,
  shipmentId: string,
  status: SellerShipmentStatus,
) => {
  const response = await API.patch(`/admin/orders/${orderId}/seller/${shipmentId}/status`, {
    status,
  })
  return response.data
}

export const regenerateLabelApi = async (orderId: string, shipmentId: string) => {
  const response = await API.post(`/admin/orders/${orderId}/seller/${shipmentId}/label`)
  return response.data
}

export interface ManualRefundPayload {
  refundAmount: number
  refundReason: string
  refundSource: 'PLATFORM' | 'SELLER'
  refundMethod: 'MANUAL_UPI' | 'MANUAL_BANK'
  referenceNumber: string
  refundDate?: string
  adminNote?: string
}

export const createManualRefundApi = async (orderId: string, payload: ManualRefundPayload) => {
  const response = await API.post(`/admin/orders/${orderId}/refund`, payload)
  return response.data
}

export const cancelOrderApi = async (orderId: string) => {
  const response = await API.post(`/admin/orders/${orderId}/cancel`)
  return response.data
}

// Order processing types
export interface PickupAddress {
  _id: string
  warehouseName?: string
  addressLine1: string
  addressLine2?: string
  city: string
  state: string
  postalCode: string
  country: string
  contactName?: string
  contactPhone?: string
  isDefault?: boolean
}

export interface CourierRateOption {
  courier_id: number
  courier_name: string
  rate?: number
  estimated_delivery_days?: string
  estimated_delivery_date?: string
  serviceable?: boolean
  cod_available?: boolean
  zone?: string
  rate_details?: {
    forward?: {
      rate?: string | number
      cod_charges?: string | number
      cod_percent?: string | number
      other_charges?: string | number
    }
    rto?: {
      rate?: string | number
      cod_charges?: string | number
    }
  }
  provider_code?: string
}

export interface ShipmentRatesResponse {
  success: boolean
  data: {
    rates: CourierRateOption[]
    pickupAddress?: PickupAddress
  }
}

export interface RequestPickupPayload {
  package: {
    weight: number
    length: number
    width: number
    height: number
  }
  courierId: number
  providerCode?: string
  pickupAddressId?: string
  pickupDate?: string
  pickupTime?: string
  estimatedCharge?: number
}

// Get seller pickup addresses
export const getSellerPickupAddressesApi = async (
  orderId: string,
  shipmentId: string,
): Promise<{ success: boolean; data: PickupAddress[] }> => {
  const response = await API.get(`/admin/orders/${orderId}/seller/${shipmentId}/pickup-addresses`)
  return response.data
}

// Get shipping rates
export const getShipmentRatesApi = async (
  orderId: string,
  shipmentId: string,
  payload: { weight: number; dimensions?: { length: number; width: number; height: number } },
): Promise<ShipmentRatesResponse> => {
  const response = await API.post(`/admin/orders/${orderId}/seller/${shipmentId}/rates`, payload)
  return response.data
}

// Request pickup
export const requestPickupApi = async (
  orderId: string,
  shipmentId: string,
  payload: RequestPickupPayload,
): Promise<AdminOrderResponse> => {
  const response = await API.post(
    `/admin/orders/${orderId}/seller/${shipmentId}/request-pickup`,
    payload,
  )
  return response.data
}

// Track shipment
export const trackShipmentApi = async (
  orderId: string,
  shipmentId: string,
): Promise<{ success: boolean; data?: Record<string, unknown> }> => {
  const response = await API.get(`/admin/orders/${orderId}/seller/${shipmentId}/track`)
  return response.data
}

// Download invoice
export const downloadInvoiceApi = async (
  orderId: string,
  shipmentId: string,
): Promise<{ success: boolean; data: { invoice_url: string; invoice_number?: string } }> => {
  const response = await API.get(`/admin/orders/${orderId}/seller/${shipmentId}/invoice`)
  return response.data
}

// Download label
export const downloadLabelApi = async (
  orderId: string,
  shipmentId: string,
): Promise<{ success: boolean; data: { label_url: string; label_id?: string } }> => {
  const response = await API.get(`/admin/orders/${orderId}/seller/${shipmentId}/download-label`)
  return response.data
}

// Search orders for a seller
export interface OrderSearchResult {
  _id: string
  orderNumber: string
  status: OrderStatus
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded'
  total: number
  createdAt: string
  label: string
}

export interface OrderSearchResponse {
  success: boolean
  data: OrderSearchResult[]
}

export const searchSellerOrdersApi = async (
  sellerId: string,
  query: string,
): Promise<OrderSearchResponse> => {
  const response = await API.get(`/admin/orders/search/seller/${sellerId}`, {
    params: { q: query },
  })
  return response.data
}
