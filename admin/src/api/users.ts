import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import API from "./axiosInstance";

export type AdminUser = {
  _id: string;
  name: string;
  email: string;
  role: "super-admin" | "user" | "seller";
  phone?: string;
  dateOfBirth?: string;
  gender?: "male" | "female" | "other" | "prefer-not-to-say";
  businessName?: string;
  isApproved?: boolean;
  kycSubmitted?: boolean;
  createdAt?: string;
  updatedAt?: string;
  rejectionReason?: string;
  storeDescription?: string;
  businessType?: string;
  businessRegistrationNumber?: string;
  dateOfEstablishment?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  // Store & branding
  storeSlug?: string;
  storeStatus?: "active" | "inactive";
  storeBanner?: string;
  storeEmail?: string;
  storePhone?: string;
  website?: string;
  facebook?: string;
  instagram?: string;
  twitter?: string;
  youtube?: string;
  linkedin?: string;
  bankAccountNumber?: string;
  accountHolderName?: string;
  bankName?: string;
  ifscCode?: string;
  panNumber?: string;
  gstNumber?: string;
  aadhaarNumber?: string;
  storeLogo?: string;
  cancelledCheque?: string;
  // Missing KYC fields
  idProof?: string;
  addressProof?: string;
  gstCertificate?: string;
  certificateOfIncorporation?: string;
  trustDeed?: string;
  authorizedPersonName?: string;
  authorizedPersonDesignation?: string;
  // Store policies & shipping
  shippingPolicy?: string;
  returnPolicy?: string;
  refundPolicy?: string;
  cancellationPolicy?: string;
  warrantyPolicy?: string;
  freeShippingThreshold?: number;
  defaultShippingRate?: number;
  // Notifications
  lowStockNotification?: boolean;
  newOrderNotification?: boolean;
  // Account & verification
  isBlocked?: boolean;
  blockedReason?: string;
  isEmailVerified?: boolean;
  isPhoneVerified?: boolean;
  // Agreements & consents
  marketplaceTermsAccepted?: boolean;
  sellerAgreementSigned?: boolean;
  returnRefundPolicyAccepted?: boolean;
  prohibitedItemsDeclared?: boolean;
  dataPrivacyConsent?: boolean;
};

export async function getUserById(id: string) {
  const { data } = await API.get(`/admin/sellers/${id}`);
  return data as AdminUser;
}

// Admin: Get a single user by ID
export const useUser = (id: string) => {
  return useQuery<AdminUser>({
    queryKey: ["user", id],
    queryFn: async () => (await API.get(`/admin/sellers/${id}`)).data,
    enabled: !!id, // Only run query if id is available
  });
};

// Admin: Update seller approval status
export const useUpdateSellerApproval = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      isApproved,
    }: {
      id: string;
      isApproved: boolean;
    }) =>
      (await API.patch(`/admin/sellers/${id}/approve`, { isApproved })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["user"] }); // Invalidate single user query too
    },
  });
};

export interface UserFilters {
  role?: string;
  status?: string;
  search?: string;
  kycStatus?: string;
  businessType?: string;
}

export const useUsers = (filters?: UserFilters & { enabled?: boolean }) => {
  const { enabled, ...apiFilters } = filters || {};
  return useQuery({
    queryKey: ["sellers", apiFilters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (apiFilters?.role) params.append("role", apiFilters.role);
      if (apiFilters?.status) params.append("status", apiFilters.status);
      if (apiFilters?.search) params.append("search", apiFilters.search);
      if (apiFilters?.kycStatus)
        params.append("kycStatus", apiFilters.kycStatus);
      if (apiFilters?.businessType)
        params.append("businessType", apiFilters.businessType);

      const res = await API.get(`/admin/sellers?${params.toString()}`);
      return res.data;
    },
    enabled: enabled !== false,
  });
};

export const useCreateUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      name: string;
      email: string;
      password: string;
      role: "super-admin" | "customer" | "seller" | "user";
      phone?: string;
      roleIds?: string[];
    }) => {
      const res = await API.post("/admin/sellers", data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sellers"] });
      queryClient.invalidateQueries({ queryKey: ["allUsers"] });
    },
  });
};

export const useUpdateUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: { isApproved?: boolean; rejectionReason?: string };
    }) => {
      const res = await API.put(`/admin/sellers/${id}`, data);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sellers"] }),
  });
};

export const useDeleteUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await API.delete(`/admin/sellers/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sellers"] }),
  });
};

// Get all users (for User Management page)
export interface AllUserFilters {
  role?: string;
  status?: string;
  search?: string;
  kycStatus?: string;
  businessType?: string;
}

export const useAllUsers = (filters?: AllUserFilters) =>
  useQuery({
    queryKey: ["allUsers", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.role) params.append("role", filters.role);
      if (filters?.status) params.append("status", filters.status);
      if (filters?.search) params.append("search", filters.search);
      if (filters?.kycStatus) params.append("kycStatus", filters.kycStatus);
      if (filters?.businessType)
        params.append("businessType", filters.businessType);

      const res = await API.get(`/admin/sellers?${params.toString()}`);
      return res.data;
    },
  });

// Block/unblock admin user
export const useBlockAdminUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      isBlocked,
      blockedReason,
    }: {
      id: string;
      isBlocked: boolean;
      blockedReason?: string;
    }) => {
      const res = await API.patch(`/admin/sellers/${id}/block`, {
        isBlocked,
        blockedReason,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allUsers"] });
      queryClient.invalidateQueries({ queryKey: ["sellers"] });
      queryClient.invalidateQueries({ queryKey: ["user"] });
    },
  });
};

export const useResetUserPassword = () => {
  return useMutation({
    mutationFn: async ({
      id,
      password,
    }: {
      id: string;
      password: string;
    }) => {
      const res = await API.post(`/admin/sellers/${id}/reset-password`, {
        password,
      });
      return res.data;
    },
  });
};

// Get users with specific module permission
export const useUsersWithPermission = (module: string, permission: string) => {
  return useQuery<AdminUser[]>({
    queryKey: ["usersWithPermission", module, permission],
    queryFn: async () => {
      const res = await API.get(
        `/admin/sellers/with-permission?module=${module}&permission=${permission}`
      );
      return res.data;
    },
    enabled: !!module && !!permission,
  });
};
