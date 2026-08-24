import axiosInstance from './axiosInstance'

export interface TrackingHistory {
  status_code: string // CAN, PP, IT, OFD, DL, RT, etc.
  location: string
  event_time: string
  message: string
}

export interface TrackingResponse {
  id: string
  order_id: string
  order_number: string
  awb_number: string
  courier_name: string
  status: string // cancelled, in-transit, delivered, etc.
  edd: string
  history: TrackingHistory[]
  payment_type: string
  shipment_info: string
}

export interface TrackingParams {
  awb?: string
  orderNumber?: string
  contact?: string
}

interface ApiResponse {
  success: boolean
  data: TrackingResponse
}

export async function fetchTracking(params: TrackingParams): Promise<TrackingResponse> {
  try {
    const { data } = await axiosInstance.get<ApiResponse>('/orders/track', { params })

    if (!data.success || !data.data) {
      throw new Error('No shipment found!')
    }

    return data.data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    throw new Error(error.response?.data?.message || error.message || 'Failed to fetch tracking')
  }
}
