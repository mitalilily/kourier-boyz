import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import API from './axiosInstance'

export type CategoryRequest = {
  _id: string
  name: string
  description?: string
  status: 'pending' | 'approved' | 'rejected'
  requestedBy?: { _id?: string; name?: string; email?: string }
  suggestedMainImage?: string
  suggestedHoverImage?: string
  suggestedBanners?: string[]
  parent?: { _id: string; name: string; slug: string } | string | null
  requiredCertificates?: string[]
  inheritedCertificates?: string[]
  effectiveCertificates?: string[]
  overrideParentCertificateRule?: boolean
  adminNote?: string
  createdAt: string
}

export const useCategoryRequests = (status?: 'pending' | 'approved' | 'rejected') =>
  useQuery<CategoryRequest[]>({
    queryKey: ['category-requests', status],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (status) params.set('status', status)
      const url = params.toString() ? `/category-requests?${params}` : '/category-requests'
      return (await API.get(url)).data
    },
  })

export const useApproveCategoryRequest = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      requiredCertificates,
      overrideParentCertificateRule,
      adminNote,
    }: {
      id: string
      requiredCertificates?: string[]
      overrideParentCertificateRule?: boolean
      adminNote?: string
    }) =>
      (
        await API.post(`/category-requests/${id}/approve`, {
          requiredCertificates,
          overrideParentCertificateRule,
          adminNote,
        })
      ).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['category-requests'] }),
  })
}

export const useRejectCategoryRequest = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, adminNote }: { id: string; adminNote?: string }) =>
      (await API.post(`/category-requests/${id}/reject`, { adminNote })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['category-requests'] }),
  })
}
