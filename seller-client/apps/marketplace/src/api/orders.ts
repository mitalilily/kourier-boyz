import API from './axiosInstance'

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

export interface SellerOrderItem {
  _id?: string
  item: {
    productId?: string
    variantId?: string
    name?: string
    baseName?: string
    sku?: string
    baseSku?: string
    mainImage?: string
  }
  quantity: number
  price: number
  subtotal: number
  instructions?: string
  // Optional coupon metadata for this line item
  couponCode?: string
  couponDiscountAmount?: number
  sellerStatus: SellerShipmentStatus
}

export interface SellerShipmentTrackingEvent {
  status: string
  location?: string
  message?: string
  timestamp: string
}

export interface SellerShipmentMetadata {
  awb?: string
  courier?: string
  label?: string
  tracking_link?: string
  weight?: number
  dimensions?: {
    length?: number
    width?: number
    height?: number
  }
  pickup_address?: {
    warehouseName?: string
    addressLine1?: string
    addressLine2?: string
    city?: string
    state?: string
    postalCode?: string
    country?: string
    contactName?: string
    contactPhone?: string
  }
  charges?: number
  estimated_delivery_date?: string
}

export interface SellerShipment {
  _id: string
  seller: string
  status: SellerShipmentStatus
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded'
  inventoryPacked: boolean
  inventoryPackedAt?: string
  readyToShipAt?: string
  shippedAt?: string
  deliveredAt?: string
  cancelledAt?: string
  sellerSnapshot?: {
    name?: string
    businessName?: string
    storeSlug?: string
    supportEmail?: string
    supportPhone?: string
  }
  shippingMeta?: SellerShipmentMetadata
  kourierBoyzLogistics?: {
    courier_id?: number
    order_id?: string
    rate?: number
    awb_number?: string
    label_url?: string
    tracking_link?: string
    estimated_delivery_date?: string
  }
  manifest?: {
    manifest_id?: string
    manifest_url?: string
    manifest_key?: string
  }
  invoice?: {
    invoice_id?: string
    invoice_url?: string
    invoice_number?: string
    generated_at?: string | Date
  }
  /** Triplicate copy (To Supplier) - same as customer invoice with "Triplicate - To Supplier" notation */
  triplicateInvoice?: {
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
  package?: {
    weight?: number
    dimensions?: {
      length?: number
      width?: number
      height?: number
    }
  }
  trackingEvents?: SellerShipmentTrackingEvent[]
  totals?: {
    itemSubtotal: number
    discount?: number
  }
  shareableTrackingLink?: string | null
}

export interface SellerOrder {
  _id: string
  orderNumber?: string
  batchId?: string
  batchCode?: string
  buyer: {
    name?: string
    phone?: string
    email?: string
  }
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded'
  paymentMethod: 'card' | 'cod' | 'wallet' | 'upi'
  status: SellerShipmentStatus
  total: number
  originalTotal?: number
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
  deliveryInstructions?: string
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
  sellerShipment?: SellerShipment
  // Optional admin/platform cart coupon used on this order (for transparency only)
  adminCoupon?: {
    code: string
    type: 'percentage' | 'fixed'
    value: number
  }
  items: SellerOrderItem[]
  canShip: boolean
}

export interface SellerOrderBatch {
  batchId?: string
  batchCode?: string
  summary: {
    orderCount: number
    buyerNames: string
    paymentStatus: SellerOrder['paymentStatus'] | 'mixed'
    status: SellerShipmentStatus | 'mixed'
    total: number
    orderedAt: string | Date
  }
  // Optional: pre-batched shipment groups from backend for this batch
  shipments?: Array<{
    shipmentId: string
    status: SellerShipmentStatus
    orderIds: string[]
    courier?: string
    awb?: string
    kourierBoyzLogisticsOrderId?: string
    shippingMeta?: SellerShipmentMetadata
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
    triplicateInvoice?: {
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
  }>
  orders: SellerOrder[]
}

export interface SellerBatchShipmentGroup {
  shipmentId: string
  status: SellerShipmentStatus
  orderIds: string[]
  courier?: string
  awb?: string
  kourierBoyzLogisticsOrderId?: string
  shippingMeta?: SellerShipmentMetadata
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
  triplicateInvoice?: {
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
}

export interface SellerBatchShipmentsResponse {
  success: boolean
  data: SellerBatchShipmentGroup[]
}

export interface SellerOrdersResponse {
  success: boolean
  data: SellerOrderBatch[]
  pagination: {
    total: number
    page: number
    limit: number
    pages: number
  }
}

export interface SellerOrderResponse {
  success: boolean
  data: SellerOrder
}

export interface SellerOrderBatchResponse {
  success: boolean
  data: SellerOrderBatch
}

export interface BulkStatusUpdatePayload {
  status: SellerShipmentStatus
  orderIds?: string[]
  batchId?: string
}

export interface BulkStatusUpdateResponse {
  success: boolean
}

export interface ShipmentRatesRequest {
  weight: number
  dimensions?: {
    length: number
    width: number
    height: number
  }
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
    pickupAddress?: Record<string, unknown>
  }
}

export interface CreateShipmentPayload {
  package: {
    weight: number
    length: number
    width: number
    height: number
  }
  courierId: number
  pickupAddressId?: string
  pickupDate?: string
  pickupTime?: string
  estimatedCharge?: number
}

export const fetchSellerOrders = async (params?: {
  status?: string
  paymentStatus?: string
  fromDate?: string
  toDate?: string
  search?: string
  page?: number
  limit?: number
}): Promise<SellerOrdersResponse> => {
  const response = await API.get('/orders', { params })
  return response.data
}

export const fetchSellerOrder = async (orderId: string): Promise<SellerOrderResponse> => {
  const response = await API.get(`/orders/${orderId}`)
  return response.data
}

export const fetchSellerOrderBatch = async (batchId: string): Promise<SellerOrderBatchResponse> => {
  const response = await API.get(`/orders/batch/${batchId}`)
  return response.data
}

export const fetchSellerBatchShipments = async (
  batchId: string,
): Promise<SellerBatchShipmentsResponse> => {
  const response = await API.get(`/orders/batch/${batchId}/shipments`)
  return response.data
}

export const updateSellerOrderStatusApi = async (
  orderId: string,
  status: SellerShipmentStatus,
): Promise<SellerOrderResponse> => {
  const response = await API.patch(`/orders/${orderId}/status`, { status })
  return response.data
}

export const bulkUpdateSellerOrderStatusApi = async (
  payload: BulkStatusUpdatePayload,
): Promise<BulkStatusUpdateResponse> => {
  const response = await API.patch('/orders/status/bulk', payload)
  return response.data
}

export const getShipmentRatesApi = async (
  orderId: string,
  payload: ShipmentRatesRequest,
): Promise<ShipmentRatesResponse> => {
  const response = await API.post(`/orders/${orderId}/ship/rates`, payload)
  return response.data
}

export const createShipmentApi = async (
  orderId: string,
  payload: CreateShipmentPayload,
): Promise<SellerOrderResponse> => {
  const response = await API.post(`/orders/${orderId}/ship`, payload)
  return response.data
}

export const getShipmentLabelApi = async (
  orderId: string,
  shipmentId: string,
): Promise<{ success: boolean; data?: Record<string, unknown> }> => {
  const response = await API.get(`/orders/${orderId}/shipments/${shipmentId}/label`)
  return response.data
}

export const trackShipmentApi = async (
  orderId: string,
  shipmentId: string,
): Promise<{ success: boolean; data?: Record<string, unknown> }> => {
  const response = await API.get(`/orders/${orderId}/shipments/${shipmentId}/track`)
  return response.data
}

export interface RequestPickupShipmentInput {
  package: {
    weight: number
    length: number
    width: number
    height: number
  }
  courierId: number
  providerCode?: string
  estimatedCharge?: number
  /**
   * List of order item IDs that this shipment should cover.
   * Enables multi-shipment per order by warehouse/warehouse+address groups.
   */
  itemIds: string[]
  /**
   * Whether this shipment contains fragile items
   */
  fragile?: boolean
}

export interface RequestPickupPayload {
  shipments: RequestPickupShipmentInput[]
  pickupAddressId?: string
  pickupDate?: string
  pickupTime?: string
}

export interface RequestPickupResponse extends SellerOrderResponse {
  manifest?: {
    manifest_id?: string
    manifest_url?: string
    invoice_url?: string
    label_url?: string
  }
}

export const requestPickupApi = async (
  orderId: string,
  payload: RequestPickupPayload,
): Promise<RequestPickupResponse> => {
  const response = await API.post(`/orders/${orderId}/request-pickup`, payload)
  return response.data
}

export const downloadSellerInvoiceApi = async (
  orderId: string,
): Promise<{ success: boolean; data: { invoice_url: string; invoice_number?: string } }> => {
  const response = await API.get(`/orders/${orderId}/invoice`)
  return response.data
}

export const downloadSellerLabelApi = async (
  orderId: string,
): Promise<{ success: boolean; data: { label_url: string; label_id?: string } }> => {
  const response = await API.get(`/orders/${orderId}/label`)
  return response.data
}

export const cancelSellerOrderApi = async (orderId: string): Promise<SellerOrderResponse> => {
  const response = await API.post(`/orders/${orderId}/cancel`)
  return response.data
}
