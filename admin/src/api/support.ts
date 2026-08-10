import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import API from './axiosInstance'

// Types
export interface SupportArticle {
  _id: string
  title: string
  content: string
  category: 'orders' | 'shipping' | 'returns' | 'payments' | 'account' | 'products' | 'other'
  tags: string[]
  views: number
  helpful: number
  notHelpful: number
  published: boolean
  priority: number
  createdBy: { _id: string; name: string; email: string }
  updatedBy?: { _id: string; name: string; email: string }
  createdAt: string
  updatedAt: string
}

export interface ChatMessage {
  _id: string
  chatId: string
  senderId: { _id: string; name: string; email: string }
  senderRole: 'customer' | 'super-admin' | 'support'
  message: string
  attachments?: string[]
  read: boolean
  readAt?: string
  createdAt: string
}

export interface SupportChat {
  _id: string
  customerId: { _id: string; name: string; email: string }
  assignedTo?: { _id: string; name: string; email: string }
  status: 'open' | 'active' | 'waiting' | 'closed'
  subject?: string
  issueType?: 'order' | 'refund' | 'product' | 'account' | 'shipping' | 'payment' | 'other'
  orderId?: string
  lastMessageAt?: string
  customerSatisfaction?: number
  customerFeedback?: string
  resolvedAt?: string
  createdAt: string
  updatedAt: string
}

export interface ContactForm {
  _id: string
  name: string
  email: string
  phone?: string
  subject: string
  message: string
  category: 'general' | 'order' | 'refund' | 'product' | 'account' | 'technical' | 'feedback'
  customerId?: { _id: string; name: string; email: string }
  orderId?: string
  status: 'new' | 'in-progress' | 'resolved' | 'closed'
  respondedBy?: { _id: string; name: string; email: string }
  response?: string
  respondedAt?: string
  attachments?: string[]
  createdAt: string
  updatedAt: string
}

// Support Articles
export const useSupportArticles = (params?: {
  category?: string
  published?: string
  search?: string
}) => {
  return useQuery<SupportArticle[]>({
    queryKey: ['supportArticles', params],
    queryFn: async () => {
      const queryParams = new URLSearchParams()
      if (params?.category) queryParams.append('category', params.category)
      if (params?.published !== undefined) queryParams.append('published', params.published)
      if (params?.search) queryParams.append('search', params.search)
      const url = queryParams.toString() ? `/support/articles?${queryParams}` : '/support/articles'
      const response = await API.get(url)
      return response.data
    },
  })
}

export const useSupportArticle = (id: string) => {
  return useQuery<SupportArticle>({
    queryKey: ['supportArticle', id],
    queryFn: async () => {
      const response = await API.get(`/support/articles/${id}`)
      return response.data
    },
    enabled: !!id,
  })
}

export const useCreateArticle = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: {
      title: string
      content: string
      category: string
      tags?: string[]
      published?: boolean
      priority?: number
    }) => {
      const response = await API.post('/support/articles', data)
      return response.data
    },
    onSuccess: () => {
      // Invalidate all supportArticles queries regardless of params
      queryClient.invalidateQueries({ queryKey: ['supportArticles'] })
      // Force refetch
      queryClient.refetchQueries({ queryKey: ['supportArticles'] })
    },
  })
}

export const useUpdateArticle = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: string
      title?: string
      content?: string
      category?: string
      tags?: string[]
      published?: boolean
      priority?: number
    }) => {
      const response = await API.put(`/support/articles/${id}`, data)
      return response.data
    },
    onSuccess: (_, variables) => {
      // Invalidate all supportArticles queries regardless of params
      queryClient.invalidateQueries({ queryKey: ['supportArticles'] })
      queryClient.refetchQueries({ queryKey: ['supportArticles'] })
      queryClient.invalidateQueries({ queryKey: ['supportArticle', variables.id] })
    },
  })
}

export const useDeleteArticle = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await API.delete(`/support/articles/${id}`)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supportArticles'] })
    },
  })
}

// Support Chats
export const useSupportChats = (params?: {
  status?: string
  assignedTo?: string
  issueType?: string
}) => {
  return useQuery<SupportChat[]>({
    queryKey: ['supportChats', params],
    queryFn: async () => {
      const queryParams = new URLSearchParams()
      if (params?.status) queryParams.append('status', params.status)
      if (params?.assignedTo) queryParams.append('assignedTo', params.assignedTo)
      if (params?.issueType) queryParams.append('issueType', params.issueType)
      const url = queryParams.toString() ? `/support/chat/all?${queryParams}` : '/support/chat/all'
      const response = await API.get(url)
      return response.data
    },
  })
}

export const useAssignChat = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, assignedTo }: { id: string; assignedTo: string }) => {
      const response = await API.post(`/support/chat/${id}/assign`, { assignedTo })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supportChats'] })
    },
  })
}

export const useUpdateChatStatus = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const response = await API.put(`/support/chat/${id}/status`, { status })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supportChats'] })
    },
  })
}

export const useAdminChat = (id: string) => {
  return useQuery<{ chat: SupportChat; messages: ChatMessage[] }>({
    queryKey: ['adminChat', id],
    queryFn: async () => {
      const response = await API.get(`/support/chat/${id}`)
      return response.data
    },
    enabled: !!id,
    refetchInterval: 3000, // Poll every 3 seconds for new messages
  })
}

export const useAdminSendMessage = () => {
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
      const response = await API.post(`/support/chat/${id}/message`, {
        message,
        attachments,
      })
      return response.data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['adminChat', variables.id] })
      queryClient.invalidateQueries({ queryKey: ['supportChats'] })
    },
  })
}

export const useAdminMarkAsRead = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (chatId: string) => {
      const response = await API.post(`/support/chat/${chatId}/read`)
      return response.data
    },
    onSuccess: (_, chatId) => {
      queryClient.invalidateQueries({ queryKey: ['adminChat', chatId] })
    },
  })
}

// Contact Forms
export const useContactForms = (params?: { status?: string; category?: string }) => {
  return useQuery<ContactForm[]>({
    queryKey: ['contactForms', params],
    queryFn: async () => {
      const queryParams = new URLSearchParams()
      if (params?.status) queryParams.append('status', params.status)
      if (params?.category) queryParams.append('category', params.category)
      const url = queryParams.toString() ? `/support/contact?${queryParams}` : '/support/contact'
      const response = await API.get(url)
      return response.data
    },
  })
}

export const useContactForm = (id: string) => {
  return useQuery<ContactForm>({
    queryKey: ['contactForm', id],
    queryFn: async () => {
      const response = await API.get(`/support/contact/${id}`)
      return response.data
    },
    enabled: !!id,
  })
}

export const useUpdateContactFormStatus = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const response = await API.put(`/support/contact/${id}/status`, { status })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contactForms'] })
    },
  })
}

export const useRespondToContactForm = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, response }: { id: string; response: string }) => {
      const response_data = await API.post(`/support/contact/${id}/respond`, { response })
      return response_data.data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['contactForms'] })
      queryClient.invalidateQueries({ queryKey: ['contactForm', variables.id] })
    },
  })
}

// Ticket Types
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
  customerId?: { _id: string; name: string; email: string }
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
  orderId?: string
  ledgerEntryId?: string
  settlementBatchId?: string
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

// Ticket Hooks
export const useTickets = (params?: {
  status?: string
  assignedTo?: string
  category?: string
  priority?: string
  ticketType?: string
}) => {
  return useQuery<Ticket[]>({
    queryKey: ['tickets', params],
    queryFn: async () => {
      const queryParams = new URLSearchParams()
      if (params?.status) queryParams.append('status', params.status)
      if (params?.assignedTo) queryParams.append('assignedTo', params.assignedTo)
      if (params?.category) queryParams.append('category', params.category)
      if (params?.priority) queryParams.append('priority', params.priority)
      if (params?.ticketType) queryParams.append('ticketType', params.ticketType)
      const url = queryParams.toString()
        ? `/support/tickets/all?${queryParams}`
        : '/support/tickets/all'
      const response = await API.get(url)
      return response.data
    },
  })
}

export const useCreateTicketAsAdmin = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: {
      customerId?: string
      sellerId?: string
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
      const response = await API.post('/support/tickets/admin', data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
    },
  })
}

export const useAssignTicket = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, assignedTo }: { id: string; assignedTo: string }) => {
      const response = await API.post(`/support/tickets/${id}/assign`, { assignedTo })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
    },
  })
}

export const useUpdateTicketStatus = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const response = await API.put(`/support/tickets/${id}/status`, { status })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
    },
  })
}

export const useUpdateTicketPriority = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, priority }: { id: string; priority: string }) => {
      const response = await API.put(`/support/tickets/${id}/priority`, { priority })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
    },
  })
}

export const useAdminTicket = (id: string) => {
  return useQuery<{ ticket: Ticket; messages: TicketMessage[] }>({
    queryKey: ['adminTicket', id],
    queryFn: async () => {
      const response = await API.get(`/support/tickets/${id}`)
      return response.data
    },
    enabled: !!id,
    refetchOnWindowFocus: false,
    staleTime: 100000, // 30 seconds - reasonable for a ticketing system
  })
}

export const useAdminSendTicketMessage = () => {
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
      const response = await API.post(`/support/tickets/${id}/message`, {
        message,
        attachments,
      })
      return response.data
    },
    onSuccess: (_, variables) => {
      // Refetch ticket to get new message, but use refetch for tickets list to prevent loops
      queryClient.invalidateQueries({ queryKey: ['adminTicket', variables.id] })
      // Don't invalidate tickets list - let it refresh naturally to prevent loops
    },
  })
}

export const useAdminMarkTicketAsRead = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (ticketId: string) => {
      const response = await API.post(`/support/tickets/${ticketId}/read`)
      return response.data
    },
    onSuccess: (_, ticketId) => {
      // Use setQueryData to update without triggering refetch, preventing loops
      queryClient.setQueryData<{ ticket: Ticket; messages: TicketMessage[] }>(
        ['adminTicket', ticketId],
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
        },
      )
    },
  })
}

export const useAdminSendSystemMessage = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, message }: { id: string; message: string }) => {
      const response = await API.post(`/support/tickets/${id}/system-message`, {
        message,
      })
      return response.data
    },
    onSuccess: (_, variables) => {
      // Refetch ticket to get new system message, but don't invalidate tickets list to prevent loops
      queryClient.invalidateQueries({ queryKey: ['adminTicket', variables.id] })
      // Don't invalidate tickets list - let it refresh naturally to prevent loops
    },
  })
}
