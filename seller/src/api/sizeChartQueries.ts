import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createSizeChart,
  deleteSizeChart,
  getSizeChart,
  getSizeCharts,
  updateSizeChart,
} from './sizeCharts'

// Get size charts for a product
export const useSizeCharts = (productId?: string) => {
  return useQuery({
    queryKey: ['sizeCharts', productId],
    queryFn: () => getSizeCharts(productId),
    enabled: !!productId,
  })
}

// Get single size chart
export const useSizeChart = (id: string) => {
  return useQuery({
    queryKey: ['sizeChart', id],
    queryFn: () => getSizeChart(id),
    enabled: !!id,
  })
}

// Create size chart mutation
export const useCreateSizeChart = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: {
      title: string
      description?: string
      chartType: 'product'
      product: string
      measurementType: 'US' | 'UK' | 'EU' | 'IN' | 'custom'
      measurements: Array<{ name: string; unit: 'cm' | 'inch' }>
      rows: Array<{
        size: string
        measurements: Array<{ name: string; value: number | string }>
      }>
      image?: string
      isActive?: boolean
      sortOrder?: number
    }) => createSizeChart(data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['sizeCharts', variables.product] })
      queryClient.invalidateQueries({ queryKey: ['sizeChart'] })
    },
  })
}

// Update size chart mutation
export const useUpdateSizeChart = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      data,
      imageFile,
    }: {
      id: string
      data: Partial<{
        title: string
        description?: string
        measurementType: 'US' | 'UK' | 'EU' | 'IN' | 'custom'
        measurements: Array<{ name: string; unit: 'cm' | 'inch' }>
        rows: Array<{
          size: string
          measurements: Array<{ name: string; value: number | string }>
        }>
        image?: string
        isActive?: boolean
        sortOrder?: number
      }>
      imageFile?: File | null
    }) => updateSizeChart(id, { ...data, imageFile }),
    onSuccess: (data) => {
      const productId = data.data.product?._id || data.data.product
      queryClient.invalidateQueries({ queryKey: ['sizeCharts', productId] })
      queryClient.invalidateQueries({ queryKey: ['sizeChart', data.data._id] })
    },
  })
}

// Delete size chart mutation
export const useDeleteSizeChart = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteSizeChart(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sizeCharts'] })
      queryClient.invalidateQueries({ queryKey: ['sizeChart'] })
    },
  })
}

