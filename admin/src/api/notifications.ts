import API from './axiosInstance'

export interface Notification {
  _id: string
  userId: string
  title: string
  message: string
  type: 'order' | 'promotional' | 'newsletter' | 'system' | 'other'
  read: boolean
  link?: string
  createdAt: string
  updatedAt: string
}

export interface NotificationsResponse {
  success: boolean
  data: Notification[]
  unreadCount: number
  total: number
}

export interface UnreadCountResponse {
  success: boolean
  count: number
}

// Get all notifications
export const getNotifications = async (params?: {
  page?: number
  limit?: number
  read?: boolean
}): Promise<NotificationsResponse> => {
  const response = await API.get('/notifications', { params })
  return response.data
}

// Get unread notification count
export const getUnreadNotificationCount = async (): Promise<UnreadCountResponse> => {
  const response = await API.get('/notifications/unread-count')
  return response.data
}

// Mark notification as read
export const markNotificationRead = async (id: string): Promise<{ success: boolean }> => {
  const response = await API.patch(`/notifications/${id}/read`)
  return response.data
}

// Mark all notifications as read
export const markAllNotificationsRead = async (): Promise<{
  success: boolean
  updatedCount: number
}> => {
  const response = await API.patch('/notifications/read-all')
  return response.data
}

