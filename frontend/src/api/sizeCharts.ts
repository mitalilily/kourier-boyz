import API from '@/lib/axios'

export interface SizeChartMeasurement {
  name: string
  unit: 'cm' | 'inch'
}

export interface SizeChartRow {
  size: string
  measurements: Array<{
    name: string
    value: number | string
  }>
}

export interface SizeChart {
  _id: string
  title: string
  description?: string
  chartType: 'category' | 'product' | 'brand'
  category?: {
    _id: string
    name: string
    slug: string
  }
  product?: {
    _id: string
    name: string
    slug: string
  }
  brand?: string
  seller?: {
    _id: string
    name: string
    email: string
  }
  measurementType: 'US' | 'UK' | 'EU' | 'IN' | 'custom'
  measurements: SizeChartMeasurement[]
  rows: SizeChartRow[]
  image?: string
  isActive: boolean
  sortOrder?: number
  createdAt: string
  updatedAt: string
}

export interface SizeChartResponse {
  success: boolean
  data: SizeChart
}

export interface SizeChartsResponse {
  success: boolean
  data: SizeChart[]
}

// Get size chart for a product (public endpoint)
export const getProductSizeChart = async (productId: string): Promise<SizeChartResponse> => {
  const response = await API.get<SizeChartResponse>(`/size-charts/product/${productId}`)
  return response.data
}

// Get all size charts (for sellers/admins)
export const getSizeCharts = async (params?: {
  chartType?: 'category' | 'product' | 'brand'
  categoryId?: string
  productId?: string
  brand?: string
}): Promise<SizeChartsResponse> => {
  const response = await API.get<SizeChartsResponse>('/size-charts', { params })
  return response.data
}

// Get single size chart
export const getSizeChart = async (id: string): Promise<SizeChartResponse> => {
  const response = await API.get<SizeChartResponse>(`/size-charts/${id}`)
  return response.data
}

// Create size chart
export const createSizeChart = async (data: {
  title: string
  description?: string
  chartType: 'category' | 'product' | 'brand'
  category?: string
  product?: string
  brand?: string
  measurementType: 'US' | 'UK' | 'EU' | 'IN' | 'custom'
  measurements: SizeChartMeasurement[]
  rows: SizeChartRow[]
  image?: string
  isActive?: boolean
  sortOrder?: number
}): Promise<SizeChartResponse> => {
  const response = await API.post<SizeChartResponse>('/size-charts', data)
  return response.data
}

// Update size chart
export const updateSizeChart = async (
  id: string,
  data: Partial<{
    title: string
    description?: string
    measurementType: 'US' | 'UK' | 'EU' | 'IN' | 'custom'
    measurements: SizeChartMeasurement[]
    rows: SizeChartRow[]
    image?: string
    isActive?: boolean
    sortOrder?: number
  }>,
): Promise<SizeChartResponse> => {
  const response = await API.put<SizeChartResponse>(`/size-charts/${id}`, data)
  return response.data
}

// Delete size chart
export const deleteSizeChart = async (id: string): Promise<{ success: boolean; message: string }> => {
  const response = await API.delete<{ success: boolean; message: string }>(`/size-charts/${id}`)
  return response.data
}

