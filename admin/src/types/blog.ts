export interface Blog {
  _id?: string
  title: string
  slug: string
  content: string
  excerpt?: string
  featuredImage?: string
  author: {
    _id: string
    name: string
    email: string
  } | string
  status: 'draft' | 'published' | 'archived'
  publishedAt?: string
  tags: string[]
  categories: string[]
  views: number
  metaTitle?: string
  metaDescription?: string
  seoKeywords?: string[]
  createdAt?: string
  updatedAt?: string
}

export const BLOG_STATUSES = [
  { label: 'Draft', value: 'draft' },
  { label: 'Published', value: 'published' },
  { label: 'Archived', value: 'archived' },
] as const


