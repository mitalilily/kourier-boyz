import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Category, CategoryStats } from "../types/category";
import API from "./axiosInstance";

// Get all categories with stats
export const useCategories = (params?: {
  search?: string;
  status?: string;
  top?: string;
  parent?: string | null;
  includeSubcategories?: boolean;
  enabled?: boolean;
}) => {
  const { enabled, ...apiParams } = params || {};
  return useQuery<{ categories: Category[]; stats: CategoryStats }>({
    queryKey: ["categories", apiParams],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (apiParams?.search) queryParams.append("search", apiParams.search);
      if (apiParams?.status) queryParams.append("status", apiParams.status);
      if (apiParams?.top) queryParams.append("top", apiParams.top);
      if (apiParams?.parent !== undefined) {
        queryParams.append("parent", apiParams.parent || "null");
      }
      if (apiParams?.includeSubcategories) {
        queryParams.append("includeSubcategories", "true");
      }

      const url = queryParams.toString()
        ? `/categories?${queryParams}`
        : "/categories";
      return (await API.get(url)).data;
    },
    enabled: enabled !== false,
  });
};

// Get root categories only
export const useRootCategories = () =>
  useQuery<Category[]>({
    queryKey: ["rootCategories"],
    queryFn: async () => (await API.get("/categories/root")).data,
  });

// Get subcategories of a category
export const useSubcategories = (categoryId: string | undefined) =>
  useQuery<Category[]>({
    queryKey: ["subcategories", categoryId],
    queryFn: async () =>
      (await API.get(`/categories/${categoryId}/subcategories`)).data,
    enabled: !!categoryId,
  });

// Create category
export const useCreateCategory = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (formData: FormData) =>
      (
        await API.post("/categories", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        })
      ).data,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["categories"] }),
  });
};

// Update category
export const useUpdateCategory = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, formData }: { id: string; formData: FormData }) =>
      (
        await API.put(`/categories/${id}`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        })
      ).data,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["categories"] }),
  });
};

// Delete category
export const useDeleteCategory = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => await API.delete(`/categories/${id}`),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["categories"] }),
  });
};

// Bulk delete categories
export const useBulkDeleteCategories = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) =>
      await API.post("/categories/bulk/delete", { ids }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["categories"] }),
  });
};

// Bulk update status
export const useBulkUpdateStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: string }) =>
      await API.post("/categories/bulk/status", { ids, status }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["categories"] }),
  });
};
