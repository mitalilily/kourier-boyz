import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
} from './notifications'

// Get all notifications
export const useNotifications = (params?: { page?: number; limit?: number; read?: boolean }) => {
  return useQuery({
    queryKey: ['notifications', params],
    queryFn: () => getNotifications(params),
    staleTime: 30000, // 30 seconds
  })
}

// Get unread notification count
export const useUnreadNotificationCount = () => {
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => getUnreadNotificationCount(),
    staleTime: 10000, // 10 seconds
    refetchInterval: 30000, // Refetch every 30 seconds
  })
}

// Mark notification as read
export const useMarkNotificationRead = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

// Mark all notifications as read
export const useMarkAllNotificationsRead = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

