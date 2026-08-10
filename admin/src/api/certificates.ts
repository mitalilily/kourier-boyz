import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import API from './axiosInstance'

export type CertificateType =
  | 'FSSAI_LICENSE'
  | 'DRUG_LICENSE'
  | 'AYUSH_APPROVAL'
  | 'FDA_CDSCO_APPROVAL'
  | 'BIS_CERTIFICATE'
  | 'WPC_ETA_APPROVAL'
  | 'BIS_HALLMARK'
  | 'ARAI_APPROVAL'
  | 'CDSCO_REGISTRATION'
  | 'MSDS'
  | 'FCO_SEED_LICENSE'
  | 'STATE_EXCISE_LICENSE'

export interface Certificate {
  _id: string
  seller: {
    _id: string
    name: string
    email: string
    businessName?: string
  }
  certificateType: CertificateType
  certificateNumber?: string
  documentUrl: string
  expiryDate?: string
  status: 'pending' | 'approved' | 'rejected' | 'expired'
  certificateVerifiedBy?: {
    _id: string
    name: string
    email: string
  }
  verifiedOn?: string
  rejectionReason?: string
  createdAt: string
  updatedAt: string
}

export interface CertificatesResponse {
  certificates: Certificate[]
  pagination: {
    total: number
    page: number
    limit: number
    pages: number
  }
}

export interface CertificateTypeOption {
  value: CertificateType
  label: string
}

// Get all certificates (admin)
export const useCertificates = (params?: {
  status?: string
  certificateType?: string
  sellerId?: string
  page?: number
  limit?: number
}) =>
  useQuery<CertificatesResponse>({
    queryKey: ['certificates', params],
    queryFn: async () => {
      const queryParams = new URLSearchParams()
      if (params?.status) queryParams.append('status', params.status)
      if (params?.certificateType) queryParams.append('certificateType', params.certificateType)
      if (params?.sellerId) queryParams.append('sellerId', params.sellerId)
      if (params?.page) queryParams.append('page', String(params.page))
      if (params?.limit) queryParams.append('limit', String(params.limit))

      const url = queryParams.toString() ? `/admin/certificates?${queryParams}` : '/admin/certificates'
      return (await API.get(url)).data
    },
  })

// Get certificate types
export const useCertificateTypes = () =>
  useQuery<CertificateTypeOption[]>({
    queryKey: ['certificate-types'],
    queryFn: async () => (await API.get('/certificates/types')).data,
  })

// Approve certificate
export const useApproveCertificate = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => (await API.post(`/admin/certificates/${id}/approve`)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['certificates'] })
    },
  })
}

// Reject certificate
export const useRejectCertificate = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, rejectionReason }: { id: string; rejectionReason?: string }) =>
      (await API.post(`/admin/certificates/${id}/reject`, { rejectionReason })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['certificates'] })
    },
  })
}



