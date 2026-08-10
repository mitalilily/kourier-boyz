import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import API from "../lib/axios";

export type FeedbackType =
  | "general"
  | "product"
  | "delivery"
  | "support"
  | "app"
  | "other";
export type FeedbackSource =
  | "modal"
  | "page"
  | "post-order"
  | "post-support"
  | "manual";

export interface FeedbackMetadata {
  page?: string;
  device?: "mobile" | "tablet" | "desktop";
  orderId?: string;
  productId?: string;
  sessionDuration?: number;
}

export interface SubmitFeedbackPayload {
  rating: number;
  comment?: string;
  type?: FeedbackType;
  source?: FeedbackSource;
  metadata?: FeedbackMetadata;
}

export interface ShouldAskFeedbackResponse {
  shouldAsk: boolean;
  reason?: string;
  daysRemaining?: number;
  feedbackCount?: number;
  isFirstTime?: boolean;
  nextCheckAfter?: number;
}

export interface FeedbackItem {
  _id: string;
  rating: number;
  comment?: string;
  type: FeedbackType;
  createdAt: string;
  adminResponse?: string;
  respondedAt?: string;
  metadata?: FeedbackMetadata;
}

export interface UserFeedbackResponse {
  feedback: FeedbackItem[];
  stats: {
    totalCount: number;
    lastFeedbackDate?: string;
    optedOut: boolean;
  };
}

// Check if we should ask for feedback
export const useShouldAskFeedback = (enabled = true) => {
  return useQuery<ShouldAskFeedbackResponse>({
    queryKey: ["feedback", "should-ask"],
    queryFn: async () => {
      const response = await API.get("/feedback/should-ask");
      return response.data;
    },
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false, // Don't retry on failure
  });
};

// Submit feedback
export const useSubmitFeedback = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: SubmitFeedbackPayload) => {
      const response = await API.post("/feedback", payload);
      return response.data;
    },
    onSuccess: () => {
      // Invalidate the should-ask query so it rechecks
      queryClient.invalidateQueries({ queryKey: ["feedback", "should-ask"] });
      queryClient.invalidateQueries({ queryKey: ["feedback", "my-feedback"] });
    },
  });
};

// Dismiss feedback prompt
export const useDismissFeedback = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (reason?: "later" | "not_now" | "dont_ask") => {
      const response = await API.post("/feedback/dismiss", { reason });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feedback", "should-ask"] });
    },
  });
};

// Get user's feedback history
export const useUserFeedback = () => {
  return useQuery<UserFeedbackResponse>({
    queryKey: ["feedback", "my-feedback"],
    queryFn: async () => {
      const response = await API.get("/feedback/my-feedback");
      return response.data;
    },
  });
};

// Opt back into feedback
export const useOptInFeedback = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await API.post("/feedback/opt-in");
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feedback", "should-ask"] });
      queryClient.invalidateQueries({ queryKey: ["feedback", "my-feedback"] });
    },
  });
};

