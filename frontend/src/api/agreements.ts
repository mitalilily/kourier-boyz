import API from '../lib/axios'

export type AgreementType =
  | 'marketplace-terms'
  | 'seller-agreement'
  | 'return-refund-policy'
  | 'customer-return-refund-policy'
  | 'prohibited-items'
  | 'privacy-policy'
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
  createdAt: string
  updatedAt: string
}

export const getAgreementByType = async (type: AgreementType): Promise<Agreement> => {
  try {
    const response = await API.get(`/agreements/type/${type}`)
    return response.data
  } catch (error: unknown) {
    // Handle 404 specifically - agreement not created yet
    const err = error as { response?: { status?: number; data?: { message?: string; error?: string } } }
    if (err.response?.status === 404) {
      const message = err.response?.data?.message || 
        err.response?.data?.error ||
        `No active agreement of type "${type}" exists. Please contact an administrator to create this agreement.`
      throw new Error(message)
    }
    // Handle 400 - invalid agreement type
    if (err.response?.status === 400) {
      throw new Error(err.response?.data?.error || 'Invalid agreement type')
    }
    // Handle other errors
    if (err.response?.data?.error) {
      throw new Error(err.response.data.error)
    }
    throw new Error('Failed to fetch agreement. Please try again later.')
  }
}
