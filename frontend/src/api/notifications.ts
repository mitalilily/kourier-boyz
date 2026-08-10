import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import API from "../lib/axios";

export interface Notification {
  _id: string;
  userId: string;
  title: string;
  message: string;
  type: "order" | "promotional" | "newsletter" | "system" | "other";
  read: boolean;
  createdAt: string;
  updatedAt: string;
  link?: string;
}

export interface NotificationPreferences {
  orderUpdates: boolean;
  promotionalEmails: boolean;
  newsletter: boolean;
}

export interface NotificationsResponse {
  success: boolean;
  data: Notification[];
  unreadCount: number;
  total: number;
}

export interface NotificationPreferencesResponse {
  success: boolean;
  data: NotificationPreferences;
}

// Get all notifications
export const useNotifications = (params?: {
  page?: number;
  limit?: number;
  read?: boolean;
}) => {
  return useQuery<NotificationsResponse>({
    queryKey: ["notifications", params],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (params?.page) queryParams.append("page", params.page.toString());
      if (params?.limit) queryParams.append("limit", params.limit.toString());
      if (params?.read !== undefined)
        queryParams.append("read", params.read.toString());
      const url = queryParams.toString()
        ? `/notifications?${queryParams}`
        : "/notifications";
      const response = await API.get(url);
      return response.data;
    },
  });
};

// Get unread notification count
export const useUnreadNotificationCount = () => {
  return useQuery<{ success: boolean; count: number }>({
    queryKey: ["notifications", "unread-count"],
    queryFn: async () => {
      const response = await API.get("/notifications/unread-count");
      return response.data;
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });
};

// Mark notification as read
export const useMarkNotificationRead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      notificationId: string
    ): Promise<{ success: boolean; message: string }> => {
      const response = await API.patch(`/notifications/${notificationId}/read`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({
        queryKey: ["notifications", "unread-count"],
      });
    },
    onError: (error: unknown) => {
      const axiosError = error as { response?: { data?: { error?: string } } };
      toast.error(
        axiosError?.response?.data?.error ||
          "Failed to mark notification as read"
      );
    },
  });
};

// Mark all notifications as read
export const useMarkAllNotificationsRead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<{ success: boolean; message: string }> => {
      const response = await API.patch("/notifications/read-all");
      return response.data;
    },
    onSuccess: () => {
      toast.success("All notifications marked as read");
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({
        queryKey: ["notifications", "unread-count"],
      });
    },
    onError: (error: unknown) => {
      const axiosError = error as { response?: { data?: { error?: string } } };
      toast.error(
        axiosError?.response?.data?.error ||
          "Failed to mark all notifications as read"
      );
    },
  });
};

// Get notification preferences
export const useNotificationPreferences = () => {
  return useQuery<NotificationPreferencesResponse>({
    queryKey: ["notification-preferences"],
    queryFn: async () => {
      const response = await API.get("/notifications/preferences");
      return response.data;
    },
  });
};

// Update notification preferences
export const useUpdateNotificationPreferences = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      preferences: Partial<NotificationPreferences>
    ): Promise<NotificationPreferencesResponse> => {
      const response = await API.put("/notifications/preferences", preferences);
      return response.data;
    },
    onSuccess: () => {
      toast.success("Notification preferences updated successfully");
      queryClient.invalidateQueries({ queryKey: ["notification-preferences"] });
    },
    onError: (error: unknown) => {
      const axiosError = error as { response?: { data?: { error?: string } } };
      toast.error(
        axiosError?.response?.data?.error ||
          "Failed to update notification preferences"
      );
    },
  });
};
