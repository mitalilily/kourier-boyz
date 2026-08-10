import axios, { AxiosInstance } from 'axios'
import dotenv from 'dotenv'

dotenv.config()

const SHIPMOZO_API_BASE_URL =
  (process.env.SHIPMOZO_API_BASE_URL || 'https://shipping-api.com/app/api/v1').replace(/\/+$/, '')
const SHIPMOZO_PUBLIC_KEY = process.env.SHIPMOZO_PUBLIC_KEY || ''
const SHIPMOZO_PRIVATE_KEY = process.env.SHIPMOZO_PRIVATE_KEY || ''

export interface ShipmozoInfoResponse {
  result: string
  message: string
  data?: {
    Info?: string
    [key: string]: unknown
  }
}

export interface ShipmozoProductDetail {
  name: string
  sku_number?: string
  quantity: number
  discount?: string | number
  hsn?: string
  unit_price: number
  product_category?: string
}

export interface ShipmozoPushOrderRequest {
  order_id: string
  order_date: string
  order_type?: string
  consignee_name: string
  consignee_phone: number
  consignee_alternate_phone?: number
  consignee_email?: string
  consignee_address_line_one: string
  consignee_address_line_two?: string
  consignee_pin_code: number
  consignee_city: string
  consignee_state: string
  product_detail: ShipmozoProductDetail[]
  payment_type: 'PREPAID' | 'COD'
  cod_amount?: string | number
  weight: number
  length: number
  width: number
  height: number
  warehouse_id: string
  gst_ewaybill_number?: string
  gstin_number?: string
}

export interface ShipmozoPushOrderResponse {
  result: string
  message: string
  data?: {
    Info?: string
    order_id?: string
    reference_id?: string
    [key: string]: unknown
  }
}

export interface ShipmozoPushReturnOrderRequest {
  order_id: string
  order_date: string
  order_type?: string
  pickup_name: string
  pickup_phone: number
  pickup_email?: string
  pickup_address_line_one: string
  pickup_address_line_two?: string
  pickup_pin_code: number
  pickup_city: string
  pickup_state: string
  product_detail: ShipmozoProductDetail[]
  payment_type: 'PREPAID' | 'COD'
  weight: number
  length: number
  width: number
  height: number
  warehouse_id?: string
  return_reason_id: number
  customer_request: string
  reason_comment?: string
}

export interface ShipmozoPushReturnOrderResponse {
  result: string
  message: string
  data?: {
    Info?: string
    order_id?: string
    reference_id?: string
    [key: string]: unknown
  }
}

export interface ShipmozoAssignCourierRequest {
  order_id: string
  courier_id: number
}

export interface ShipmozoAssignCourierResponse {
  result: string
  message: string
  data?: {
    order_id?: string
    reference_id?: string
    courier?: string
    [key: string]: unknown
  }
}

export interface ShipmozoSchedulePickupRequest {
  order_id: string
}

export interface ShipmozoSchedulePickupResponse {
  result: string
  message: string
  data?: {
    order_id?: string
    reference_id?: string
    courier?: string
    awb_number?: string
    lr_number?: string
    [key: string]: unknown
  }
}

export interface ShipmozoCancelOrderRequest {
  order_id: string
  awb_number: number
}

export interface ShipmozoCancelOrderResponse {
  result: string
  message: string
  data?: {
    order_id?: string
    reference_id?: string
    [key: string]: unknown
  }
}

export interface ShipmozoAutoAssignOrderRequest {
  order_id: string
}

export interface ShipmozoAutoAssignOrderResponse {
  result: string
  message: string
  data?: {
    order_id?: string
    reference_id?: string
    awb_number?: string
    courier_company?: string
    courier_company_service?: string
    error?: string
    [key: string]: unknown
  }
}

export interface ShipmozoOrderDetailResponse {
  result: string
  message: string
  data?: {
    [key: string]: unknown
  }
}

export interface ShipmozoLoginRequest {
  username: string
  password: string
}

export interface ShipmozoLoginResponse {
  result: string
  message: string
  data?: Array<{
    name?: string
    public_key?: string
    private_key?: string
    [key: string]: unknown
  }>
}

export interface ShipmozoRateCalculatorDimension {
  no_of_box: string
  length: string
  width: string
  height: string
}

export interface ShipmozoRateCalculatorRequest {
  order_id?: string
  pickup_pincode: number
  delivery_pincode: number
  payment_type: 'PREPAID' | 'COD'
  shipment_type: string
  order_amount: number
  type_of_package: string
  rov_type: string
  cod_amount?: string | number
  weight: number
  dimensions: ShipmozoRateCalculatorDimension[]
}

export interface ShipmozoRateCalculatorResponse {
  result: string
  message: string
  data?: {
    [key: string]: unknown
  }
}

export interface ShipmozoPincodeServiceabilityRequest {
  pickup_pincode: number
  delivery_pincode: number
}

export interface ShipmozoPincodeServiceabilityResponse {
  result: string
  message: string
  data?: {
    serviceable?: boolean
    [key: string]: unknown
  }
}

export interface ShipmozoReturnReason {
  id: number
  title: string
}

export interface ShipmozoReturnReasonResponse {
  result: string
  message: string
  data?: ShipmozoReturnReason[]
}

export interface ShipmozoOrderLabelRecord {
  label?: string
  created_at?: string
  [key: string]: unknown
}

export interface ShipmozoOrderLabelResponse {
  result: string
  message: string
  data?: ShipmozoOrderLabelRecord[]
}

export interface ShipmozoTrackOrderResponse {
  result: string
  message: string
  data?: {
    order_id?: string
    reference_id?: string
    awb_number?: string
    courier?: string
    expected_delivery_date?: string | null
    current_status?: string
    status_time?: string | null
    scan_detail?: unknown[]
    [key: string]: unknown
  }
}

export interface ShipmozoCreateWarehouseRequest {
  address_title: string
  name?: string
  phone?: number
  alternate_phone?: number
  email?: string
  address_line_one: string
  address_line_two?: string
  pin_code: number
}

export interface ShipmozoCreateWarehouseResponse {
  result: string
  message: string
  data?: {
    warehouse_id?: string
    [key: string]: unknown
  }
}

export interface ShipmozoUpdateWarehouseRequest {
  order_id: string
  warehouse_id: number
}

export interface ShipmozoUpdateWarehouseResponse {
  result: string
  message: string
  data?: {
    order_id?: string
    reference_id?: string
    [key: string]: unknown
  }
}

export interface ShipmozoWarehouse {
  id: number
  default?: string
  address_title?: string
  name?: string
  email?: string
  phone?: string
  alt_phone?: string
  address_line_one?: string
  address_line_two?: string
  pincode?: string
  city?: string
  state?: string
  country?: string
  status?: string
  [key: string]: unknown
}

export interface ShipmozoGetWarehousesResponse {
  result: string
  message: string
  data?: ShipmozoWarehouse[]
}

class ShipmozoService {
  private readonly client: AxiosInstance

  constructor() {
    if (!SHIPMOZO_PUBLIC_KEY || !SHIPMOZO_PRIVATE_KEY) {
      throw new Error('Shipmozo API keys are not configured')
    }

    this.client = axios.create({
      baseURL: SHIPMOZO_API_BASE_URL,
      headers: {
        'public-key': SHIPMOZO_PUBLIC_KEY,
        'private-key': SHIPMOZO_PRIVATE_KEY,
        'Content-Type': 'application/json',
      },
      timeout: 20000,
    })
  }

  static async login(payload: ShipmozoLoginRequest): Promise<ShipmozoLoginResponse> {
    try {
      const response = await axios.post<ShipmozoLoginResponse>(
        `${SHIPMOZO_API_BASE_URL}/login`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 20000,
        },
      )
      if (String(response.data?.result) !== '1') {
        throw new Error(response.data?.message || 'Shipmozo login request failed')
      }
      return response.data
    } catch (error: any) {
      const message =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        'Failed to login to Shipmozo'
      throw new Error(message)
    }
  }

  async getInfo(): Promise<ShipmozoInfoResponse> {
    try {
      const response = await this.client.get<ShipmozoInfoResponse>('/info')
      if (String(response.data?.result) !== '1') {
        throw new Error(response.data?.message || 'Shipmozo info request failed')
      }
      return response.data
    } catch (error: any) {
      const message =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        'Failed to fetch Shipmozo info'
      throw new Error(message)
    }
  }

  async pushOrder(payload: ShipmozoPushOrderRequest): Promise<ShipmozoPushOrderResponse> {
    try {
      const response = await this.client.post<ShipmozoPushOrderResponse>('/push-order', payload)
      if (String(response.data?.result) !== '1') {
        throw new Error(response.data?.message || 'Shipmozo push order request failed')
      }
      return response.data
    } catch (error: any) {
      const message =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        'Failed to push order to Shipmozo'
      throw new Error(message)
    }
  }

  async pushReturnOrder(
    payload: ShipmozoPushReturnOrderRequest,
  ): Promise<ShipmozoPushReturnOrderResponse> {
    try {
      const response = await this.client.post<ShipmozoPushReturnOrderResponse>(
        '/push-return-order',
        payload,
      )
      if (String(response.data?.result) !== '1') {
        throw new Error(response.data?.message || 'Shipmozo push return order request failed')
      }
      return response.data
    } catch (error: any) {
      const message =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        'Failed to push return order to Shipmozo'
      throw new Error(message)
    }
  }

  async assignCourier(
    payload: ShipmozoAssignCourierRequest,
  ): Promise<ShipmozoAssignCourierResponse> {
    try {
      const response = await this.client.post<ShipmozoAssignCourierResponse>(
        '/assign-courier',
        payload,
      )
      if (String(response.data?.result) !== '1') {
        throw new Error(response.data?.message || 'Shipmozo assign courier request failed')
      }
      return response.data
    } catch (error: any) {
      const message =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        'Failed to assign courier in Shipmozo'
      throw new Error(message)
    }
  }

  async schedulePickup(
    payload: ShipmozoSchedulePickupRequest,
  ): Promise<ShipmozoSchedulePickupResponse> {
    try {
      const response = await this.client.post<ShipmozoSchedulePickupResponse>(
        '/schedule-pickup',
        payload,
      )
      if (String(response.data?.result) !== '1') {
        throw new Error(response.data?.message || 'Shipmozo schedule pickup request failed')
      }
      return response.data
    } catch (error: any) {
      const message =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        'Failed to schedule pickup in Shipmozo'
      throw new Error(message)
    }
  }

  async cancelOrder(payload: ShipmozoCancelOrderRequest): Promise<ShipmozoCancelOrderResponse> {
    try {
      const response = await this.client.post<ShipmozoCancelOrderResponse>(
        '/cancel-order',
        payload,
      )
      if (String(response.data?.result) !== '1') {
        throw new Error(response.data?.message || 'Shipmozo cancel order request failed')
      }
      return response.data
    } catch (error: any) {
      const message =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        'Failed to cancel order in Shipmozo'
      throw new Error(message)
    }
  }

  async autoAssignOrder(
    payload: ShipmozoAutoAssignOrderRequest,
  ): Promise<ShipmozoAutoAssignOrderResponse> {
    try {
      const response = await this.client.post<ShipmozoAutoAssignOrderResponse>(
        '/auto-assign-order',
        payload,
      )
      if (String(response.data?.result) !== '1') {
        throw new Error(
          response.data?.data?.error ||
            response.data?.message ||
            'Shipmozo auto assign order request failed',
        )
      }
      return response.data
    } catch (error: any) {
      const message =
        error.response?.data?.data?.error ||
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        'Failed to auto assign order in Shipmozo'
      throw new Error(message)
    }
  }

  async getOrderDetail(orderId: string): Promise<ShipmozoOrderDetailResponse> {
    try {
      const response = await this.client.get<ShipmozoOrderDetailResponse>(
        `/get-order-detail/${encodeURIComponent(orderId)}`,
      )
      if (String(response.data?.result) !== '1') {
        throw new Error(response.data?.message || 'Shipmozo get order detail request failed')
      }
      return response.data
    } catch (error: any) {
      const message =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        'Failed to fetch order detail from Shipmozo'
      throw new Error(message)
    }
  }

  async rateCalculator(
    payload: ShipmozoRateCalculatorRequest,
  ): Promise<ShipmozoRateCalculatorResponse> {
    try {
      const response = await this.client.post<ShipmozoRateCalculatorResponse>(
        '/rate-calculator',
        payload,
      )
      if (String(response.data?.result) !== '1') {
        throw new Error(response.data?.message || 'Shipmozo rate calculator request failed')
      }
      return response.data
    } catch (error: any) {
      const message =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        'Failed to calculate rates from Shipmozo'
      throw new Error(message)
    }
  }

  async checkPincodeServiceability(
    payload: ShipmozoPincodeServiceabilityRequest,
  ): Promise<ShipmozoPincodeServiceabilityResponse> {
    try {
      const response = await this.client.post<ShipmozoPincodeServiceabilityResponse>(
        '/pincode-serviceability',
        payload,
      )
      if (String(response.data?.result) !== '1') {
        throw new Error(
          response.data?.message || 'Shipmozo pincode serviceability request failed',
        )
      }
      return response.data
    } catch (error: any) {
      const message =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        'Failed to check pincode serviceability from Shipmozo'
      throw new Error(message)
    }
  }

  async getReturnReasons(): Promise<ShipmozoReturnReasonResponse> {
    try {
      const response = await this.client.get<ShipmozoReturnReasonResponse>('/get-return-reason')
      if (String(response.data?.result) !== '1') {
        throw new Error(response.data?.message || 'Shipmozo get return reason request failed')
      }
      return response.data
    } catch (error: any) {
      const message =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        'Failed to fetch return reasons from Shipmozo'
      throw new Error(message)
    }
  }

  async getOrderLabel(awbNumber: string): Promise<ShipmozoOrderLabelResponse> {
    try {
      const response = await this.client.get<ShipmozoOrderLabelResponse>(
        `/get-order-label/${encodeURIComponent(awbNumber)}`,
      )
      if (String(response.data?.result) !== '1') {
        throw new Error(response.data?.message || 'Shipmozo get order label request failed')
      }
      return response.data
    } catch (error: any) {
      const message =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        'Failed to fetch order label from Shipmozo'
      throw new Error(message)
    }
  }

  async trackOrder(awbNumber: string): Promise<ShipmozoTrackOrderResponse> {
    try {
      const response = await this.client.get<ShipmozoTrackOrderResponse>('/track-order', {
        params: {
          awb_number: awbNumber,
        },
      })
      if (String(response.data?.result) !== '1') {
        throw new Error(response.data?.message || 'Shipmozo track order request failed')
      }
      return response.data
    } catch (error: any) {
      const message =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        'Failed to track order from Shipmozo'
      throw new Error(message)
    }
  }

  async createWarehouse(
    payload: ShipmozoCreateWarehouseRequest,
  ): Promise<ShipmozoCreateWarehouseResponse> {
    try {
      const response = await this.client.post<ShipmozoCreateWarehouseResponse>(
        '/create-warehouse',
        payload,
      )
      if (String(response.data?.result) !== '1') {
        throw new Error(response.data?.message || 'Shipmozo create warehouse request failed')
      }
      return response.data
    } catch (error: any) {
      const message =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        'Failed to create warehouse in Shipmozo'
      throw new Error(message)
    }
  }

  async updateWarehouse(
    payload: ShipmozoUpdateWarehouseRequest,
  ): Promise<ShipmozoUpdateWarehouseResponse> {
    try {
      const response = await this.client.post<ShipmozoUpdateWarehouseResponse>(
        '/order/update-warehouse',
        payload,
      )
      if (String(response.data?.result) !== '1') {
        throw new Error(response.data?.message || 'Shipmozo update warehouse request failed')
      }
      return response.data
    } catch (error: any) {
      const message =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        'Failed to update warehouse in Shipmozo'
      throw new Error(message)
    }
  }

  async getWarehouses(): Promise<ShipmozoGetWarehousesResponse> {
    try {
      const response = await this.client.get<ShipmozoGetWarehousesResponse>('/get-warehouses')
      if (String(response.data?.result) !== '1') {
        throw new Error(response.data?.message || 'Shipmozo get warehouses request failed')
      }
      return response.data
    } catch (error: any) {
      const message =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        'Failed to fetch warehouses from Shipmozo'
      throw new Error(message)
    }
  }
}

export const shipmozoService = new ShipmozoService()
export default ShipmozoService
