import { useQuery } from '@tanstack/react-query'
import { fetchDashboardOverview } from '../../../api/dashboard'

export const useDashboardOverview = () => {
  return useQuery({
    queryKey: ['dashboardOverview'],
    queryFn: fetchDashboardOverview,
    staleTime: 30000, // Consider data fresh for 30 seconds
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    refetchOnWindowFocus: true, // Refetch when seller returns to tab so new orders show up
  })
}

