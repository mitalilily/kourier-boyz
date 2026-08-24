import API from './axiosInstance'

export type BrandType = 'OWN' | 'OTHER'
export type BrandStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'NEED_MORE_DOCS' | 'REVOKED'
export type DocumentType =
  | 'TM_CERTIFICATE'
  | 'TM_APPLICATION'
  | 'SALE_INVOICE'
  | 'AUTHORIZATION_LETTER'

export interface BrandDocument {
  _id: string
  brand_id: string
  document_type: DocumentType
  file_url: string
  uploaded_at: string
}

export interface Brand {
  _id: string
  seller_id: string
  brand_name: string
  brand_type: BrandType
  status: BrandStatus
  rejection_reason?: string
  reviewed_by?: {
    _id: string
    name: string
    email: string
  }
  reviewed_at?: string
  created_at: string
  updated_at: string
  documents?: BrandDocument[]
  /** Number of categories this brand is approved for (from backend) */
  approved_category_count?: number
  /** Category names/details when fetching single brand (from backend) */
  approved_categories?: Array<{ _id: string; name: string; slug?: string }>
}

export interface CreateBrandData {
  brand_name: string
  brand_type: BrandType
  documents: Array<{
    document_type: DocumentType
    file: File
  }>
}

export interface ApprovedBrand {
  _id: string
  brand_name: string
  brand_type: BrandType
}

// Get all brands for seller
export const getSellerBrands = async (): Promise<Brand[]> => {
  const response = await API.get('/brands')
  return response.data
}

// Get single brand
export const getBrand = async (id: string): Promise<Brand> => {
  const response = await API.get(`/brands/${id}`)
  return response.data
}

// Get approved brands (for product creation dropdown)
export const getApprovedBrands = async (): Promise<ApprovedBrand[]> => {
  const response = await API.get('/brands/approved')
  return response.data
}

// Create brand request (supports both JSON and FormData)
export const createBrand = async (data: CreateBrandData | FormData): Promise<Brand> => {
  const response = await API.post('/brands', data, {
    headers: data instanceof FormData ? { 'Content-Type': 'multipart/form-data' } : {},
  })
  return response.data
}

// Upload brand document
export const uploadBrandDocument = async (
  brandId: string,
  file: File,
  documentType: DocumentType,
): Promise<BrandDocument> => {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('document_type', documentType)
  formData.append('brand_id', brandId)

  const response = await API.post(`/brands/${brandId}/documents`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
  return response.data
}

