export interface Banner {
  _id: string
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

export interface BannersResponse {
  banners: Banner[]
}
