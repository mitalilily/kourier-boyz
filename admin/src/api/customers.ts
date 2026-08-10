import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import API from './axiosInstance'

export type AdminCustomer = {
  _id: string
  name: string
  email: string
  role: 'customer'
  phone?: string
  isEmailVerified?: boolean
  isPhoneVerified?: boolean
  isBlocked?: boolean
  blockedAt?: string
  blockedReason?: string
  buyerLifecycleStatus?: 'ACTIVE' | 'DEACTIVATION_REQUESTED' | 'DEACTIVATED'
  buyerDeactivationRequestedAt?: string
  buyerDeactivatedAt?: string
  buyerDeactivationReason?: string
  createdAt?: string
  updatedAt?: string
  // Address fields if available
  addressLine1?: string
  addressLine2?: string
  city?: string
  state?: string
  postalCode?: string
  country?: string
}

export interface CustomerFilters {
  status?: string
  search?: string
  isBlocked?: string
}

// Admin: Get all customers
export const useCustomers = (filters?: CustomerFilters) => {
  return useQuery<AdminCustomer[]>({
    queryKey: ['customers', filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filters?.status) params.append('status', filters.status)
      if (filters?.search) params.append('search', filters.search)
      if (filters?.isBlocked) params.append('isBlocked', filters.isBlocked)

      const res = await API.get(`/admin/sellers/customers?${params.toString()}`)
      return res.data
    },
  })
}

// Admin: Get a single customer by ID
export const useCustomer = (id: string) => {
  return useQuery<AdminCustomer>({
    queryKey: ['customer', id],
    queryFn: async () => (await API.get(`/admin/sellers/${id}`)).data,
    enabled: !!id,
  })
}

// Admin: Block/Unblock customer
export const useUpdateCustomerStatus = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      isBlocked,
      blockedReason,
    }: {
      id: string
      isBlocked: boolean
      blockedReason?: string
    }) => {
      const res = await API.patch(`/admin/sellers/customers/${id}/block`, {
        isBlocked,
        blockedReason,
      })
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      queryClient.invalidateQueries({ queryKey: ['customer'] })
    },
  })
}

// Admin: Deactivate buyer
export const useDeactivateBuyer = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const res = await API.post(`/admin/users/buyers/${id}/deactivate`, { reason })
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      queryClient.invalidateQueries({ queryKey: ['customer'] })
      queryClient.invalidateQueries({ queryKey: ['allUsers'] })
    },
  })
}

// Admin: Reactivate buyer
export const useReactivateBuyer = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await API.post(`/admin/users/buyers/${id}/reactivate`)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      queryClient.invalidateQueries({ queryKey: ['customer'] })
      queryClient.invalidateQueries({ queryKey: ['allUsers'] })
    },
  })
}

// Admin: Hard delete buyer (only if eligible)
export const useHardDeleteBuyer = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await API.delete(`/admin/users/buyers/${id}`)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      queryClient.invalidateQueries({ queryKey: ['allUsers'] })
    },
  })
}

