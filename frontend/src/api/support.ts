import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import API from "../lib/axios";

// Types
export interface SupportArticle {
  _id: string;
  title: string;
  content: string;
  category:
    | "orders"
    | "shipping"
    | "returns"
    | "payments"
    | "account"
    | "products"
    | "other";
  tags: string[];
  views: number;
  helpful: number;
  notHelpful: number;
  published: boolean;
  priority: number;
  createdBy: {
    _id: string;
    name: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  _id: string;
  chatId: string;
  senderId: {
    _id: string;
    name: string;
    email: string;
  };
  senderRole: "customer" | "super-admin" | "support";
  message: string;
  attachments?: string[];
  read: boolean;
  readAt?: string;
  createdAt: string;
}

export interface SupportChat {
  _id: string;
  customerId: {
    _id: string;
    name: string;
    email: string;
  };
  assignedTo?: {
    _id: string;
    name: string;
    email: string;
  };
  status: "open" | "active" | "waiting" | "closed";
  subject?: string;
  issueType?:
    | "order"
    | "refund"
    | "product"
    | "account"
    | "shipping"
    | "payment"
    | "other";
  orderId?: string;
  lastMessageAt?: string;
  customerSatisfaction?: number;
  customerFeedback?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ContactForm {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  category:
    | "general"
    | "order"
    | "refund"
    | "product"
    | "account"
    | "technical"
    | "feedback";
  orderId?: string;
  status: "new" | "in-progress" | "resolved" | "closed";
  respondedBy?: {
    _id: string;
    name: string;
    email: string;
  };
  response?: string;
  respondedAt?: string;
  attachments?: string[];
  createdAt: string;
  updatedAt: string;
}

// Support Articles
export const useSupportArticles = (params?: {
  category?: string;
  search?: string;
}) => {
  return useQuery<SupportArticle[]>({
    queryKey: ["supportArticles", params],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (params?.category) queryParams.append("category", params.category);
      if (params?.search) queryParams.append("search", params.search);
      const url = queryParams.toString()
        ? `/support/articles/published?${queryParams}`
        : "/support/articles/published";
      const response = await API.get(url);
      return response.data;
    },
  });
};

export const useSupportArticle = (id: string) => {
  return useQuery<SupportArticle>({
    queryKey: ["supportArticle", id],
    queryFn: async () => {
      const response = await API.get(`/support/articles/published/${id}`);
      return response.data;
    },
    enabled: !!id,
  });
};

export const useRateArticle = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, helpful }: { id: string; helpful: boolean }) => {
      const response = await API.post(
        `/support/articles/published/${id}/rate`,
        { helpful }
      );
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["supportArticle", variables.id],
      });
    },
  });
};

// Support Chat
export const useMyChats = (status?: string) => {
  return useQuery<SupportChat[]>({
    queryKey: ["supportChats", "my", status],
    queryFn: async () => {
      const url = status
        ? `/support/chat/my?status=${status}`
        : "/support/chat/my";
      const response = await API.get(url);
      return response.data;
    },
  });
};

export const useChat = (id: string) => {
  return useQuery<{ chat: SupportChat; messages: ChatMessage[] }>({
    queryKey: ["supportChat", id],
    queryFn: async () => {
      const response = await API.get(`/support/chat/my/${id}`);
      return response.data;
    },
    enabled: !!id,
    refetchInterval: 3000, // Poll every 3 seconds for new messages
  });
};

export const useCreateChat = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      subject?: string;
      issueType?: string;
      orderId?: string;
    }) => {
      const response = await API.post("/support/chat", data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supportChats", "my"] });
    },
  });
};

export const useSendMessage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      chatId,
      message,
      attachments,
    }: {
      chatId: string;
      message: string;
      attachments?: string[];
    }) => {
      const response = await API.post(`/support/chat/my/${chatId}/message`, {
        message,
        attachments,
      });
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["supportChat", variables.chatId],
      });
    },
  });
};

export const useMarkMessagesAsRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (chatId: string) => {
      const response = await API.post(`/support/chat/my/${chatId}/read`);
      return response.data;
    },
    onSuccess: (_, chatId) => {
      queryClient.invalidateQueries({ queryKey: ["supportChat", chatId] });
    },
  });
};

export const useRateChat = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      chatId,
      satisfaction,
      feedback,
    }: {
      chatId: string;
      satisfaction: number;
      feedback?: string;
    }) => {
      const response = await API.post(`/support/chat/my/${chatId}/rate`, {
        satisfaction,
        feedback,
      });
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["supportChat", variables.chatId],
      });
    },
  });
};

export const useCloseChat = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (chatId: string) => {
      const response = await API.put(`/support/chat/my/${chatId}/status`, {
        status: "closed",
      });
      return response.data;
    },
    onSuccess: (_, chatId) => {
      queryClient.invalidateQueries({ queryKey: ["supportChat", chatId] });
      queryClient.invalidateQueries({ queryKey: ["supportChats", "my"] });
    },
  });
};

// Contact Form
export const useSubmitContactForm = () => {
  return useMutation({
    mutationFn: async (data: {
      name: string;
      email: string;
      phone?: string;
      subject: string;
      message: string;
      category?: string;
      orderId?: string;
    }) => {
      const response = await API.post("/support/contact", data);
      return response.data;
    },
  });
};

export const useMyContactForms = () => {
  return useQuery<ContactForm[]>({
    queryKey: ["contactForms", "my"],
    queryFn: async () => {
      const response = await API.get("/support/contact/my");
      return response.data;
    },
  });
};

// Ticket Types
export interface TicketMessage {
  _id: string;
  ticketId: string;
  senderId: {
    _id: string;
    name: string;
    email: string;
  };
  senderRole: "customer" | "super-admin" | "support";
  message: string;
  attachments?: string[];
  read: boolean;
  readAt?: string;
  isSystemMessage?: boolean;
  createdAt: string;
}

export interface Ticket {
  _id: string;
  ticketNumber: string;
  customerId: {
    _id: string;
    name: string;
    email: string;
  };
  createdBy?: {
    _id: string;
    name: string;
    email: string;
  };
  assignedTo?: {
    _id: string;
    name: string;
    email: string;
  };
  status: "open" | "in-progress" | "resolved" | "closed";
  priority: "low" | "medium" | "high" | "urgent";
  subject: string;
  category:
    | "order"
    | "refund"
    | "product"
    | "account"
    | "shipping"
    | "payment"
    | "technical"
    | "other";
  description: string;
  orderId?: string;
  lastMessageAt?: string;
  lastActivityAt?: string;
  customerSatisfaction?: number;
  customerFeedback?: string;
  resolvedAt?: string;
  closedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// Ticket Hooks
export const useMyTickets = (status?: string, options?: { enabled?: boolean }) => {
  return useQuery<Ticket[]>({
    queryKey: ["tickets", "my", status],
    queryFn: async () => {
      const url = status
        ? `/support/tickets/my?status=${status}`
        : "/support/tickets/my";
      const response = await API.get(url);
      return response.data;
    },
    enabled: options?.enabled !== false,
  });
};

export const useTicket = (id: string, options?: { enabled?: boolean }) => {
  return useQuery<{ ticket: Ticket; messages: TicketMessage[] }>({
    queryKey: ["ticket", id],
    queryFn: async () => {
      const response = await API.get(`/support/tickets/my/${id}`);
      return response.data;
    },
    enabled: (options?.enabled !== false) && !!id,
    refetchOnWindowFocus: false,
    staleTime: 30000, // Consider data fresh for 30 seconds
  });
};

export const useCreateTicket = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      subject: string;
      category: string;
      description: string;
      priority?: string;
      orderId?: string;
      attachments?: string[];
    }) => {
      const response = await API.post("/support/tickets", data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tickets", "my"] });
    },
  });
};

export const useSendTicketMessage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      ticketId,
      message,
      attachments,
    }: {
      ticketId: string;
      message: string;
      attachments?: string[];
    }) => {
      const response = await API.post(
        `/support/tickets/my/${ticketId}/message`,
        {
          message,
          attachments,
        }
      );
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["ticket", variables.ticketId],
      });
    },
  });
};

export const useMarkTicketMessagesAsRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ticketId: string) => {
      const response = await API.post(`/support/tickets/my/${ticketId}/read`);
      return response.data;
    },
    onSuccess: (_, ticketId) => {
      queryClient.invalidateQueries({ queryKey: ["ticket", ticketId] });
    },
  });
};

export const useRateTicket = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      ticketId,
      satisfaction,
      feedback,
    }: {
      ticketId: string;
      satisfaction: number;
      feedback?: string;
    }) => {
      const response = await API.post(`/support/tickets/my/${ticketId}/rate`, {
        satisfaction,
        feedback,
      });
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["ticket", variables.ticketId],
      });
    },
  });
};

export const useCloseTicket = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ticketId: string) => {
      const response = await API.put(`/support/tickets/my/${ticketId}/status`, {
        status: "closed",
      });
      return response.data;
    },
    onSuccess: (_, ticketId) => {
      queryClient.invalidateQueries({ queryKey: ["ticket", ticketId] });
      queryClient.invalidateQueries({ queryKey: ["tickets", "my"] });
    },
  });
};

// Upload ticket attachments
export const useUploadTicketAttachments = () => {
  return useMutation({
    mutationFn: async (files: File[]) => {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append("attachments", file);
      });
      // FormData will have Content-Type set automatically by axios with boundary
      // The request interceptor removes the default Content-Type for FormData
      const response = await API.post("/support/tickets/upload-attachments", formData);
      return response.data;
    },
  });
};
