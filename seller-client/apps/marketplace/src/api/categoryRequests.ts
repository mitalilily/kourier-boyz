import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_ROOT_URL || 'http://localhost:5004/api'

const api = axios.create({ baseURL: API_BASE })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('seller_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

import type { CertificateType } from './categories'

export async function submitCategoryRequest(
  name: string,
  description?: string,
  parent?: string | null,
  suggestedImages?: {
    mainImage?: File
    hoverImage?: File
    banners?: File[]
  },
) {
  const formData = new FormData()
  formData.append('name', name)
  if (description) formData.append('description', description)
  if (parent && parent !== 'null' && parent !== '') {
    formData.append('parent', parent)
  } else {
    formData.append('parent', 'null')
  }

  if (suggestedImages) {
    if (suggestedImages.mainImage) {
      formData.append('suggestedMainImage', suggestedImages.mainImage)
    }
    if (suggestedImages.hoverImage) {
      formData.append('suggestedHoverImage', suggestedImages.hoverImage)
    }
    if (suggestedImages.banners) {
      suggestedImages.banners.forEach((banner) => {
        formData.append('suggestedBanners', banner)
      })
    }
  }

  const { data } = await api.post('/category-requests', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
  return data as {
    _id: string
    name: string
    description?: string
    status: 'pending' | 'approved' | 'rejected'
    requiredCertificates?: CertificateType[]
    overrideParentCertificateRule?: boolean
    suggestedMainImage?: string
    suggestedHoverImage?: string
    suggestedBanners?: string[]
    parent?: { _id: string; name: string; slug: string } | string | null
    adminNote?: string
    createdAt: string
  }
}

export async function getMyCategoryRequests() {
  const { data } = await api.get('/category-requests/mine')
  return data as Array<{
    _id: string
    name: string
    description?: string
    status: 'pending' | 'approved' | 'rejected'
    adminNote?: string
    requiredCertificates?: CertificateType[]
    overrideParentCertificateRule?: boolean
    parent?: { _id: string; name: string; slug: string } | string | null
    createdAt: string
  }>
}
