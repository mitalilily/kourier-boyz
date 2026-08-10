import API from './axiosInstance'

export type WebhookEventStatus = 'pending' | 'processed' | 'failed' | 'retrying'

export interface WebhookEvent {
  _id: string
  webhookId: string
  eventType: string
  razorpayOrderId: string
  razorpayPaymentId?: string
  status: WebhookEventStatus
  payload: any
  processingAttempts: number
  lastError?: string
  lastErrorAt?: string
  processedAt?: string
  orderIds?: Array<{
    _id: string
    orderNumber?: string
    totalAmount?: number
    paymentStatus?: string
  }>
  createdAt: string
  updatedAt: string
}

export interface WebhookEventsResponse {
  success: boolean
  data: {
    events: WebhookEvent[]
    pagination: {
      page: number
      limit: number
      total: number
      pages: number
    }
    summary: {
      pending: number
      processed: number
      failed: number
      retrying: number
    }
  }
}

export interface WebhookEventsFilters {
  page?: number
  limit?: number
  status?: WebhookEventStatus
  eventType?: string
  razorpayOrderId?: string
  webhookId?: string
  startDate?: string
  endDate?: string
}

export const getWebhookEvents = async (
  filters?: WebhookEventsFilters,
): Promise<WebhookEventsResponse['data']> => {
  const params = new URLSearchParams()

  if (filters?.page) params.append('page', filters.page.toString())
  if (filters?.limit) params.append('limit', filters.limit.toString())
  if (filters?.status) params.append('status', filters.status)
  if (filters?.eventType) params.append('eventType', filters.eventType)
  if (filters?.razorpayOrderId) params.append('razorpayOrderId', filters.razorpayOrderId)
  if (filters?.webhookId) params.append('webhookId', filters.webhookId)
  if (filters?.startDate) params.append('startDate', filters.startDate)
  if (filters?.endDate) params.append('endDate', filters.endDate)

  const response = await API.get<WebhookEventsResponse>(`/webhooks/events?${params.toString()}`)
  return response.data.data
}


