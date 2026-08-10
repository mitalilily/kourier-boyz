import { useQuery } from '@tanstack/react-query'
import API from './axiosInstance'
import type { ModulePermissions } from './roles'

export const usePermissions = () => {
  return useQuery<ModulePermissions>({
    queryKey: ['userPermissions'],
    queryFn: async () => {
      const res = await API.get('/admin/sellers/me/permissions')
      return res.data
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    refetchOnWindowFocus: false,
  })
}

