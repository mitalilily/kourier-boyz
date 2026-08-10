import API from './axiosInstance'

export type AgreementType =
  | 'marketplace-terms'
  | 'seller-agreement'
  | 'return-refund-policy'
  | 'customer-return-refund-policy'
  | 'prohibited-items'
  | 'privacy-policy'
  | 'seller-privacy-policy'
  | 'customer-terms'

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

export interface CreateAgreementData {
  type: AgreementType
  title: string
  content: string
  effectiveDate?: string
  pdfUrl?: string
}

export const getAgreements = async (): Promise<Agreement[]> => {
  const response = await API.get('/agreements/')
  return response.data
}

export const getAgreementByType = async (type: AgreementType): Promise<Agreement> => {
  const response = await API.get(`/agreements/type/${type}`)
  return response.data
}

export const upsertAgreement = async (
  data: CreateAgreementData,
): Promise<{ message: string; agreement: Agreement }> => {
  const response = await API.post('/agreements/upsert', data)
  return response.data
}

export const generateAgreementPDF = async (
  type: AgreementType,
): Promise<{ message: string; agreement: Agreement }> => {
  const response = await API.post(`/agreements/${type}/pdf`)
  return response.data
}
