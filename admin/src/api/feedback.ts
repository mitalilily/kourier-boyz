import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import API from "./axiosInstance";

export type FeedbackType =
  | "general"
  | "product"
  | "delivery"
  | "support"
  | "app"
  | "other";

export interface FeedbackUser {
  _id: string;
  name: string;
  email: string;
  role?: string;
  businessName?: string;
}

export interface FeedbackItem {
  _id: string;
  user: FeedbackUser;
  rating: number;
  comment?: string;
  type: FeedbackType;
  source: string;
  metadata?: {
    page?: string;
    device?: string;
    userAgent?: string;
    storeId?: string;
  };
  isRead: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FeedbackStats {
  averageRating: string;
  totalCount: number;
  ratingDistribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
}

export interface FeedbackPagination {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface FeedbackResponse {
  feedback: FeedbackItem[];
  pagination: FeedbackPagination;
  stats: FeedbackStats;
}

export interface FeedbackFilters {
  page?: number;
  limit?: number;
  rating?: number;
  type?: string;
  isRead?: boolean;
}

// Get all feedback (admin)
export const useFeedback = (filters: FeedbackFilters = {}) => {
  const queryParams = new URLSearchParams();

  if (filters.page) queryParams.set("page", String(filters.page));
  if (filters.limit) queryParams.set("limit", String(filters.limit));
  if (filters.rating) queryParams.set("rating", String(filters.rating));
  if (filters.type) queryParams.set("type", filters.type);
  if (filters.isRead !== undefined)
    queryParams.set("isRead", String(filters.isRead));

  return useQuery<FeedbackResponse>({
    queryKey: ["admin-feedback", filters],
    queryFn: async () => {
      const res = await API.get(`/feedback/admin/all?${queryParams.toString()}`);
      return res.data;
    },
  });
};

// Mark feedback as read
export const markFeedbackRead = async (id: string): Promise<{ success: boolean }> => {
  const res = await API.patch(`/feedback/admin/${id}/read`);
  return res.data;
};

// Hook to mark feedback as read
export const useMarkFeedbackRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markFeedbackRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-feedback"] });
    },
  });
};

