import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../store/authStore'
import type { UpdateStoreData } from './store'
import { updateStoreInfo } from './store'

export const useUpdateStore = () => {
  const queryClient = useQueryClient()
  const setUser = useAuthStore((state) => state.setUser)

  return useMutation({
    mutationFn: (data: UpdateStoreData) => updateStoreInfo(data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['profile'] })
      if (response.user) {
        setUser(response.user)
      }
    },
  })
}

// Re-export types for convenience
export type { PackagingStandard, PickupAddress, ShippingZone, UpdateStoreData } from './store'
