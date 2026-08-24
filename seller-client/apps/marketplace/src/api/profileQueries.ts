import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useAuthStore } from '../store/authStore'
import type { ChangePasswordData, UpdateProfileData } from './profile'
import { changePassword, getProfile, markOnboardingTourCompleted, updateProfile } from './profile'

export const useProfile = () => {
  return useQuery({
    queryKey: ['profile'],
    queryFn: getProfile,
  })
}

// Hook to automatically sync user profile with auth store
export const useProfileSync = () => {
  const setUser = useAuthStore((state) => state.setUser)
  const logout = useAuthStore((state) => state.logout)
  const user = useAuthStore((state) => state.user)

  const query = useQuery({
    queryKey: ['profile-sync'],
    queryFn: getProfile,
    // Refetch every 30 seconds if user is not approved
    refetchInterval: !user?.isApproved ? 30000 : false,
    // Refetch on window focus
    refetchOnWindowFocus: true,
    enabled: !!user, // Only run if user is logged in
  })

  // Update auth store when profile data changes
  useEffect(() => {
    if (query.data) {
      // Check if account was deactivated
      if (
        query.data.sellerLifecycleStatus === 'DEACTIVATED' &&
        user?.sellerLifecycleStatus !== 'DEACTIVATED'
      ) {
        // Account was just deactivated - log out immediately
        logout()
        return
      }
      setUser(query.data)
    }
  }, [query.data, setUser, logout, user?.sellerLifecycleStatus])

  return query
}

export const useUpdateProfile = () => {
  const queryClient = useQueryClient()
  const setUser = useAuthStore((state) => state.setUser)

  return useMutation({
    mutationFn: (data: UpdateProfileData) => updateProfile(data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['profile'] })
      if (response.user) {
        setUser(response.user)
      }
    },
  })
}

export const useChangePassword = () => {
  return useMutation({
    mutationFn: (data: ChangePasswordData) => changePassword(data),
  })
}

export const useMarkOnboardingTourCompleted = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: markOnboardingTourCompleted,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] })
      queryClient.invalidateQueries({ queryKey: ['profile-sync'] })
    },
  })
}
