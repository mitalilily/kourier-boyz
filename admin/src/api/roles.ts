import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import API from "./axiosInstance";

export type Permission =
  | "view"
  | "create"
  | "update"
  | "delete"
  | "approve"
  | "reject"
  | "assign"
  | "block";

// All available modules in the system
export type ModuleName =
  | "dashboard"
  | "sellerManagement"
  | "customerManagement"
  | "products"
  | "reviews"
  | "orders"
  | "returns"
  | "settlements"
  | "categories"
  | "coupons"
  | "banners"
  | "announcements"
  | "blogs"
  | "promotional-emails"
  | "agreements"
  | "supportArticles"
  | "supportChats"
  | "supportTickets"
  | "contactForms"
  | "notifications"
  | "requests"
  | "sellerCoupons"
  | "certificates"
  | "systemSettings"
  | "userManagement"
  | "roleManagement"
  | "feedback"
  | "creditNotes"
  | "settlementInvoices"
  | "auditLogs"
  | "reports"
  | "sellerDeactivationRequests";

// Maps each module to its allowed permissions
export type ModulePermissions = Partial<Record<ModuleName, Permission[]>>;

export interface Role {
  _id: string;
  name: string;
  description?: string;
  permissions: ModulePermissions;
  isSystemRole?: boolean;
  createdAt: string;
  updatedAt: string;
}

export const useRoles = () => {
  return useQuery<Role[]>({
    queryKey: ["roles"],
    queryFn: async () => {
      const res = await API.get("/admin/roles");
      return res.data;
    },
  });
};

export const useRole = (id: string) => {
  return useQuery<Role>({
    queryKey: ["role", id],
    queryFn: async () => {
      const res = await API.get(`/admin/roles/${id}`);
      return res.data;
    },
    enabled: !!id,
  });
};

export const useCreateRole = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      name: string;
      description?: string;
      permissions: ModulePermissions;
    }) => {
      const res = await API.post("/admin/roles", data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
    },
  });
};

export const useUpdateRole = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: {
        name?: string;
        description?: string;
        permissions?: ModulePermissions;
      };
    }) => {
      const res = await API.put(`/admin/roles/${id}`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      queryClient.invalidateQueries({ queryKey: ["role"] });
    },
  });
};

export const useDeleteRole = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await API.delete(`/admin/roles/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
    },
  });
};

export const useAssignRolesToUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      userId,
      roleIds,
    }: {
      userId: string;
      roleIds: string[];
    }) => {
      const res = await API.post(`/admin/sellers/${userId}/roles`, { roleIds });
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["user", variables.userId] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["sellers"] });
      queryClient.invalidateQueries({ queryKey: ["allUsers"] });
      queryClient.invalidateQueries({
        queryKey: ["userRoles", variables.userId],
      });
    },
  });
};

export const useUserRoles = (userId: string) => {
  return useQuery<Role[]>({
    queryKey: ["userRoles", userId],
    queryFn: async () => {
      const res = await API.get(`/admin/sellers/${userId}/roles`);
      return res.data;
    },
    enabled: !!userId,
  });
};
