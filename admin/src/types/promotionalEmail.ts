export interface PromotionalEmail {
  _id?: string
  subject: string
  content: string
  excerpt?: string
  featuredImage?: string
  author: {
    _id: string
    name: string
    email: string
  } | string
  status: 'draft' | 'published'
  publishedAt?: string
  sentAt?: string
  sentCount?: number
  scheduledAt?: string
  targetAudience: 'all' | 'subscribers'
  previewText?: string
  openCount?: number
  clickCount?: number
  createdAt?: string
  updatedAt?: string
}

export const PROMOTIONAL_EMAIL_STATUSES = [
  { label: 'Draft', value: 'draft' },
  { label: 'Published', value: 'published' },
] as const

export const TARGET_AUDIENCE_OPTIONS = [
  { label: 'Subscribers Only', value: 'subscribers' },
  { label: 'All (Subscribers + Customers)', value: 'all' },
] as const

export interface Subscriber {
  _id: string
  email: string
  name?: string
  isActive: boolean
  subscribedAt: string
  unsubscribedAt?: string
  source: 'website' | 'checkout' | 'manual' | 'import'
  user?: {
    _id: string
    name: string
    email: string
  }
  createdAt: string
  updatedAt: string
}

