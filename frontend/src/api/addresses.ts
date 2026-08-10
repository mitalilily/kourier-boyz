import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import API from '../lib/axios'
import { useAuthStore } from '../store/authStore'
import type { Address, AddressFormData, AddressResponse, AddressesResponse } from '../types/address'

const addressesQueryKey = (userId?: string) => ['addresses', userId] as const

export const useAddresses = () => {
  const { isAuthenticated, user } = useAuthStore()
  return useQuery<AddressesResponse>({
    queryKey: addressesQueryKey(user?.userId),
    queryFn: async () => {
      const response = await API.get('/addresses')
      return response.data
    },
    enabled: isAuthenticated,
  })
}

export const useAddress = (id: string) => {
  const { isAuthenticated, user } = useAuthStore()
  return useQuery<AddressResponse>({
    queryKey: ['addresses', user?.userId, id],
    queryFn: async () => {
      const response = await API.get(`/addresses/${id}`)
      return response.data
    },
    enabled: isAuthenticated && !!id,
  })
}

export const useDefaultAddress = () => {
  const { isAuthenticated, user } = useAuthStore()
  return useQuery<AddressResponse>({
    queryKey: ['addresses', user?.userId, 'default'],
    queryFn: async () => {
      const response = await API.get('/addresses/default')
      return response.data
    },
    enabled: isAuthenticated,
  })
}

export const useCreateAddress = () => {
  const queryClient = useQueryClient()
  const userId = useAuthStore((state) => state.user?.userId)
  const queryKey = addressesQueryKey(userId)

  return useMutation({
    mutationFn: async (data: AddressFormData): Promise<AddressResponse> => {
      const response = await API.post('/addresses', data)
      return response.data
    },
    onMutate: async (newAddress) => {
      await queryClient.cancelQueries({ queryKey })

      const previousAddresses = queryClient.getQueryData<AddressesResponse>(queryKey)

      if (previousAddresses) {
        const optimisticAddress: Address = {
          _id: `temp-${Date.now()}`,
          user: '',
          ...newAddress,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }

        queryClient.setQueryData<AddressesResponse>(queryKey, {
          addresses: [...previousAddresses.addresses, optimisticAddress],
        })
      }

      return { previousAddresses }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['addresses'] })
      toast.success('Address added successfully!')
    },
    onError: (error: unknown, _variables, context) => {
      // Rollback on error
      if (context?.previousAddresses) {
        queryClient.setQueryData(queryKey, context.previousAddresses)
      }

      const axiosError = error as { response?: { data?: { error?: string } } }
      toast.error(axiosError.response?.data?.error || 'Failed to add address')
    },
  })
}

// Update an existing address
export const useUpdateAddress = () => {
  const queryClient = useQueryClient()
  const userId = useAuthStore((state) => state.user?.userId)
  const queryKey = addressesQueryKey(userId)

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string
      data: Partial<AddressFormData>
    }): Promise<AddressResponse> => {
      const response = await API.put(`/addresses/${id}`, data)
      return response.data
    },
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey })
      await queryClient.cancelQueries({ queryKey: ['addresses', userId, id] })

      const previousAddresses = queryClient.getQueryData<AddressesResponse>(queryKey)
      const previousAddress = queryClient.getQueryData<AddressResponse>(['addresses', userId, id])

      if (previousAddresses) {
        queryClient.setQueryData<AddressesResponse>(queryKey, {
          addresses: previousAddresses.addresses.map((addr) =>
            addr._id === id ? { ...addr, ...data } : addr,
          ),
        })
      }

      if (previousAddress) {
        queryClient.setQueryData<AddressResponse>(['addresses', userId, id], {
          address: { ...previousAddress.address, ...data },
        })
      }

      return { previousAddresses, previousAddress }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['addresses'] })
      queryClient.invalidateQueries({ queryKey: ['addresses', userId, variables.id] })
      queryClient.invalidateQueries({ queryKey: ['addresses', userId, 'default'] })
      toast.success('Address updated successfully!')
    },
    onError: (error: unknown, _variables, context) => {
      if (context?.previousAddresses) {
        queryClient.setQueryData(queryKey, context.previousAddresses)
      }
      if (context?.previousAddress) {
        queryClient.setQueryData(['addresses', userId, _variables.id], context.previousAddress)
      }

      const axiosError = error as { response?: { data?: { error?: string } } }
      toast.error(axiosError.response?.data?.error || 'Failed to update address')
    },
  })
}

// Delete an address
export const useDeleteAddress = () => {
  const queryClient = useQueryClient()
  const userId = useAuthStore((state) => state.user?.userId)
  const queryKey = addressesQueryKey(userId)

  return useMutation({
    mutationFn: async (id: string): Promise<{ message: string }> => {
      const response = await API.delete(`/addresses/${id}`)
      return response.data
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey })

      const previousAddresses = queryClient.getQueryData<AddressesResponse>(queryKey)

      if (previousAddresses) {
        queryClient.setQueryData<AddressesResponse>(queryKey, {
          addresses: previousAddresses.addresses.filter((addr) => addr._id !== id),
        })
      }

      return { previousAddresses }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['addresses'] })
      queryClient.invalidateQueries({ queryKey: ['addresses', userId, 'default'] })
      toast.success('Address deleted successfully!')
    },
    onError: (error: unknown, _variables, context) => {
      if (context?.previousAddresses) {
        queryClient.setQueryData(queryKey, context.previousAddresses)
      }

      const axiosError = error as { response?: { data?: { error?: string } } }
      toast.error(axiosError.response?.data?.error || 'Failed to delete address')
    },
  })
}

// Set an address as default
export const useSetDefaultAddress = () => {
  const queryClient = useQueryClient()
  const userId = useAuthStore((state) => state.user?.userId)
  const queryKey = addressesQueryKey(userId)

  return useMutation({
    mutationFn: async (id: string): Promise<AddressResponse> => {
      const response = await API.patch(`/addresses/${id}/default`)
      return response.data
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey })
      await queryClient.cancelQueries({ queryKey: ['addresses', userId, 'default'] })

      const previousAddresses = queryClient.getQueryData<AddressesResponse>(queryKey)

      if (previousAddresses) {
        queryClient.setQueryData<AddressesResponse>(queryKey, {
          addresses: previousAddresses.addresses.map((addr) => ({
            ...addr,
            isDefault: addr._id === id,
          })),
        })
      }

      return { previousAddresses }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['addresses'] })
      queryClient.invalidateQueries({ queryKey: ['addresses', userId, 'default'] })
      toast.success('Default address updated successfully!')
    },
    onError: (error: unknown, _variables, context) => {
      if (context?.previousAddresses) {
        queryClient.setQueryData(queryKey, context.previousAddresses)
      }

      const axiosError = error as { response?: { data?: { error?: string } } }
      toast.error(axiosError.response?.data?.error || 'Failed to set default address')
    },
  })
}
