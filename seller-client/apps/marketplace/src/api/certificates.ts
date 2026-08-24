import axios from 'axios'
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
  seller: string
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
  expiryReminderHistory?: Array<{
    reminderType: '30_days' | '7_days' | '1_day' | 'expired'
    sentAt: string
  }>
  createdAt: string
  updatedAt: string
}

export interface CertificateTypeOption {
  value: CertificateType
  label: string
}

export interface UploadCertificateData {
  certificateType: CertificateType
  certificateNumber?: string
  expiryDate?: string
  document: File
}

// Get my certificates
export const useMyCertificates = (params?: {
  status?: string
  certificateType?: string
}) =>
  useQuery<Certificate[]>({
    queryKey: ['my-certificates', params],
    queryFn: async () => {
      const queryParams = new URLSearchParams()
      if (params?.status) queryParams.append('status', params.status)
      if (params?.certificateType) queryParams.append('certificateType', params.certificateType)

      const url = queryParams.toString() ? `/certificates?${queryParams}` : '/certificates'
      return (await API.get(url)).data
    },
  })

// Get certificate types (public endpoint)
export const useCertificateTypes = () =>
  useQuery<CertificateTypeOption[]>({
    queryKey: ['certificate-types'],
    queryFn: async () => {
      // Use base API URL for public endpoint
      const baseURL = import.meta.env.VITE_API_URL?.replace('/seller', '') || 'http://localhost:5004/api'
      const { data } = await axios.get(`${baseURL}/certificates/types`, {
        withCredentials: true,
        headers: {
          Authorization: `Bearer ${localStorage.getItem('seller_token') || ''}`,
        },
      })
      return data
    },
  })

// Get single certificate
export const useCertificate = (id: string | undefined) =>
  useQuery<Certificate>({
    queryKey: ['certificate', id],
    queryFn: async () => (await API.get(`/certificates/${id}`)).data,
    enabled: !!id,
  })

// Upload certificate
export const useUploadCertificate = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: UploadCertificateData) => {
      const formData = new FormData()
      formData.append('certificateType', data.certificateType)
      if (data.certificateNumber) formData.append('certificateNumber', data.certificateNumber)
      // Always append expiryDate - if undefined, send empty string to indicate "no expiry date"
      // This allows clearing the expiry date when reuploading without an expiry date
      formData.append('expiryDate', data.expiryDate || '')
      formData.append('document', data.document)

      return (await API.post('/certificates', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })).data
    },
    onSuccess: () => {
      // Invalidate and refetch all my-certificates queries to update the UI immediately
      queryClient.invalidateQueries({ queryKey: ['my-certificates'], refetchType: 'active' })
    },
  })
}

// Delete certificate
export const useDeleteCertificate = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => (await API.delete(`/certificates/${id}`)).data,
    onSuccess: () => {
      // Invalidate and refetch all my-certificates queries to update the UI immediately
      queryClient.invalidateQueries({ queryKey: ['my-certificates'], refetchType: 'active' })
    },
  })
}

