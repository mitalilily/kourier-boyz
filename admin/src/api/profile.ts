import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import API from './axiosInstance'

export interface ActivityLogEntry {
  _id: string
  action: string
  status: 'success' | 'failure'
  ipAddress?: string
  userAgent?: string
  email?: string
  metadata?: Record<string, any>
  createdAt: string
  user?: { _id: string; name: string; email: string; role: string }
}

export const useAdminActivityLogs = (
  params?: {
    userId?: string
    action?: string
    status?: 'success' | 'failure'
    limit?: number
  },
  options?: { enabled?: boolean },
) => {
  return useQuery<ActivityLogEntry[]>({
    queryKey: ['adminActivityLogs', params],
    queryFn: async () => {
      const searchParams = new URLSearchParams()
      if (params?.userId) searchParams.append('userId', params.userId)
      if (params?.action) searchParams.append('action', params.action)
      if (params?.status) searchParams.append('status', params.status)
      if (params?.limit) searchParams.append('limit', params.limit.toString())
      const query = searchParams.toString()
      const res = await API.get(`/admin/profile/activity${query ? `?${query}` : ''}`)
      return res.data
    },
    enabled: options?.enabled ?? true,
  })
}

export const useChangeSuperAdminPassword = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { currentPassword: string; newPassword: string }) => {
      const res = await API.post('/admin/profile/change-password', payload)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminActivityLogs'] })
    },
  })
}

export const useForceLogoutUser = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { userId: string }) => {
      const res = await API.post(`/admin/profile/logout-user/${payload.userId}`)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminActivityLogs'] })
    },
  })
}
