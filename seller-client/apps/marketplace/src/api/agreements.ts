import axios from 'axios'
import { marketplacePublicApiUrl } from './runtime'

export type AgreementType =
  | 'marketplace-terms'
  | 'seller-agreement'
  | 'return-refund-policy'
  | 'customer-return-refund-policy'
  | 'prohibited-items'
  | 'privacy-policy'
  | 'seller-privacy-policy'

export interface Agreement {
  _id: string
  type: AgreementType
  title: string
  content: string
  version: number
  isActive: boolean
  effectiveDate?: string
  pdfUrl?: string
  createdBy: {
    _id: string
    name: string
    email: string
  }
  updatedBy: {
    _id: string
    name: string
    email: string
  }
  createdAt: string
  updatedAt: string
}

// Agreements endpoint is public (no auth required)
const AGREEMENTS_API = axios.create({
  baseURL: marketplacePublicApiUrl,
  withCredentials: true,
})

export const getAgreementByType = async (type: AgreementType): Promise<Agreement> => {
  const response = await AGREEMENTS_API.get(`/agreements/type/${type}`)
  return response.data
}
