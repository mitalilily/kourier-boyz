import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { message } from 'antd'
import {
  type Brand,
  type CreateBrandData,
  type DocumentType,
  createBrand,
  getApprovedBrands,
  getBrand,
  getSellerBrands,
  uploadBrandDocument,
} from './brands'

// Re-export types for convenience
export type { Brand, CreateBrandData, DocumentType }

// Query keys
export const brandKeys = {
  all: ['brands'] as const,
  lists: () => [...brandKeys.all, 'list'] as const,
  list: (filters: string) => [...brandKeys.lists(), { filters }] as const,
  details: () => [...brandKeys.all, 'detail'] as const,
  detail: (id: string) => [...brandKeys.details(), id] as const,
  approved: () => [...brandKeys.all, 'approved'] as const,
}

// Get all brands for seller
export const useSellerBrands = () => {
  return useQuery({
    queryKey: brandKeys.lists(),
    queryFn: getSellerBrands,
  })
}

// Get single brand
export const useBrand = (id: string) => {
  return useQuery({
    queryKey: brandKeys.detail(id),
    queryFn: () => getBrand(id),
    enabled: !!id,
  })
}

// Get approved brands (for product creation dropdown)
export const useApprovedBrands = () => {
  return useQuery({
    queryKey: brandKeys.approved(),
    queryFn: getApprovedBrands,
  })
}

// Create brand mutation
export const useCreateBrand = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateBrandData | FormData) => createBrand(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: brandKeys.lists() })
      message.success('Brand request submitted successfully')
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { error?: string } }; message?: string }
      const errorMessage =
        err?.response?.data?.error || err?.message || 'Failed to create brand request'
      message.error(errorMessage)
    },
  })
}

// Upload brand document mutation
export const useUploadBrandDocument = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      brandId,
      file,
      documentType,
    }: {
      brandId: string
      file: File
      documentType: DocumentType
    }) => uploadBrandDocument(brandId, file, documentType),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: brandKeys.detail(variables.brandId) })
      queryClient.invalidateQueries({ queryKey: brandKeys.lists() })
      message.success('Document uploaded successfully')
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { error?: string } }; message?: string }
      const errorMessage =
        err?.response?.data?.error || err?.message || 'Failed to upload document'
      message.error(errorMessage)
    },
  })
}

