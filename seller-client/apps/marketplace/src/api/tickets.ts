import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'

// Create a separate axios instance for support tickets (they're under /api/support, not /api/seller)
const getTicketAPI = () => {
  const token = localStorage.getItem('seller_token')
  const instance = axios.create({
    baseURL: import.meta.env.VITE_API_URL?.replace('/seller', '') || 'http://localhost:5004/api',
    withCredentials: true,
  })
  
  if (token) {
    instance.defaults.headers.common['Authorization'] = `Bearer ${token}`
  }
  
  return instance
}

// Types
export interface TicketMessage {
  _id: string
  ticketId: string
  senderId: { _id: string; name: string; email: string }
  senderRole: 'customer' | 'seller' | 'super-admin' | 'support'
  message: string
  attachments?: string[]
  read: boolean
  readAt?: string
  isSystemMessage?: boolean
  createdAt: string
}

export interface Ticket {
  _id: string
  ticketNumber: string
  ticketType: 'customer' | 'seller'
  sellerId?: { _id: string; name: string; email: string; businessName?: string }
  createdBy?: { _id: string; name: string; email: string }
  assignedTo?: { _id: string; name: string; email: string }
  status: 'open' | 'in-progress' | 'resolved' | 'closed'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  subject: string
  category:
    | 'order'
    | 'refund'
    | 'product'
    | 'account'
    | 'shipping'
    | 'payment'
    | 'technical'
    | 'settlement'
    | 'ledger'
    | 'payout'
    | 'other'
  description: string
  orderId?: string | { _id: string; orderNumber?: string }
  ledgerEntryId?: string
  settlementBatchId?: string | { _id: string; fromDate: string; toDate: string; status: string }
  refundRequestId?: string
  lastMessageAt?: string
  lastActivityAt?: string
  customerSatisfaction?: number
  customerFeedback?: string
  resolvedAt?: string
  closedAt?: string
  createdAt: string
  updatedAt: string
}

// Get seller's tickets
export const useSellerTickets = (params?: { status?: string }) => {
  return useQuery<Ticket[]>({
    queryKey: ['sellerTickets', params],
    queryFn: async () => {
      const queryParams = new URLSearchParams()
      if (params?.status) queryParams.append('status', params.status)
      const url = queryParams.toString()
        ? `/support/tickets/my?${queryParams}`
        : '/support/tickets/my'
      const api = getTicketAPI()
      const response = await api.get(url)
      return response.data
    },
    refetchOnWindowFocus: false, // Prevent refetch loops
    staleTime: 10000, // Consider data fresh for 10 seconds
  })
}

// Get single ticket with messages
export const useSellerTicket = (id: string) => {
  return useQuery<{ ticket: Ticket; messages: TicketMessage[] }>({
    queryKey: ['sellerTicket', id],
    queryFn: async () => {
      const api = getTicketAPI()
      const response = await api.get(`/support/tickets/my/${id}`)
      return response.data
    },
    enabled: !!id,
    refetchOnWindowFocus: false,
    staleTime: 30000, // 30 seconds - reasonable for a ticketing system
  })
}

// Create seller ticket
export const useCreateSellerTicket = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: {
      subject: string
      category: string
      description: string
      priority?: string
      orderId?: string
      ledgerEntryId?: string
      settlementBatchId?: string
      refundRequestId?: string
      attachments?: string[]
    }) => {
      const api = getTicketAPI()
      const response = await api.post('/support/tickets/seller', data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sellerTickets'] })
    },
  })
}

// Send message in ticket
export const useSendTicketMessage = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      message,
      attachments,
    }: {
      id: string
      message: string
      attachments?: string[]
    }) => {
      const api = getTicketAPI()
      const response = await api.post(`/support/tickets/my/${id}/message`, {
        message,
        attachments,
      })
      return response.data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['sellerTicket', variables.id] })
      queryClient.invalidateQueries({ queryKey: ['sellerTickets'] })
    },
  })
}

// Mark messages as read
export const useMarkTicketMessagesAsRead = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (ticketId: string) => {
      const api = getTicketAPI()
      const response = await api.post(`/support/tickets/my/${ticketId}/read`)
      return response.data
    },
    onSuccess: (_, ticketId) => {
      // Use setQueryData to update read status without triggering refetch
      queryClient.setQueryData<{ ticket: Ticket; messages: TicketMessage[] }>(
        ['sellerTicket', ticketId],
        (oldData) => {
          if (!oldData) return oldData
          return {
            ...oldData,
            messages: oldData.messages.map((msg) => ({
              ...msg,
              read: true,
              readAt: new Date().toISOString(),
            })),
          }
        }
      )
    },
  })
}

// Update ticket status (seller can close their own tickets)
export const useUpdateTicketStatus = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const api = getTicketAPI()
      const response = await api.put(`/support/tickets/my/${id}/status`, { status })
      return response.data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['sellerTicket', variables.id] })
      queryClient.invalidateQueries({ queryKey: ['sellerTickets'] })
    },
  })
}

// Rate ticket
export const useRateTicket = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      satisfaction,
      feedback,
    }: {
      id: string
      satisfaction: number
      feedback?: string
    }) => {
      const api = getTicketAPI()
      const response = await api.post(`/support/tickets/my/${id}/rate`, {
        satisfaction,
        feedback,
      })
      return response.data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['sellerTicket', variables.id] })
      queryClient.invalidateQueries({ queryKey: ['sellerTickets'] })
    },
  })
}

// Upload ticket attachments
export const useUploadTicketAttachments = () => {
  return useMutation({
    mutationFn: async (files: File[]) => {
      const api = getTicketAPI()
      const formData = new FormData()
      files.forEach((file) => {
        formData.append('attachments', file)
      })
      // Don't set Content-Type manually - let axios set it with the boundary parameter
      const response = await api.post('/support/tickets/upload-attachments', formData)
      return response.data
    },
  })
}

