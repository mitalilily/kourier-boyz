export interface Banner {
  _id?: string
  title: string
  subtitle?: string
  image: string
  link?: string
  linkText?: string
  position: 'hero' | 'deals' | 'fashion' | 'trending' | 'featured' | 'newsletter'
  active: boolean
  order: number
  startDate?: string
  endDate?: string
  createdAt?: string
  updatedAt?: string
}

export const BANNER_POSITIONS = [
  { label: 'Hero Section', value: 'hero' },
  { label: 'Deals Section', value: 'deals' },
  { label: 'Fashion Section', value: 'fashion' },
  { label: 'Trending Section', value: 'trending' },
  { label: 'Featured Section', value: 'featured' },
  { label: 'Newsletter Section', value: 'newsletter' },
] as const
