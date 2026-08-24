import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getDashboardPreferences, saveDashboardPreferences, type DashboardPreferences } from '../api/dashboardPreferences.api'
import { isDemoLogisticsSession } from '../demo/demoSession'

export const useDashboardPreferences = () => {
  const demoMode = isDemoLogisticsSession()
  return useQuery<DashboardPreferences, Error>({
    queryKey: ['dashboardPreferences'],
    queryFn: getDashboardPreferences,
    enabled: !demoMode,
    initialData: demoMode
      ? {
          widgetVisibility: {},
          widgetOrder: [
            'quickStats',
            'quickActions',
            'insights',
            'actionItems',
            'performanceMetrics',
            'ordersTrend',
            'financialHealth',
            'recentActivity',
            'todaysOperations',
            'orderStatusChart',
            'courierComparison',
            'metricsOverview',
            'courierPerformance',
            'topDestinations',
          ],
          layout: { spacing: 2.2 },
          dateRange: { defaultRange: '30days' },
        }
      : undefined,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    refetchOnWindowFocus: false,
  })
}

export const useSaveDashboardPreferences = () => {
  const queryClient = useQueryClient()

  return useMutation<DashboardPreferences, Error, Partial<DashboardPreferences>>({
    mutationFn: saveDashboardPreferences,
    onSuccess: (data) => {
      queryClient.setQueryData(['dashboardPreferences'], data)
    },
  })
}
