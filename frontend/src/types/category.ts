export interface Category {
  _id: string
  id?: string
  name: string
  slug: string
  description?: string
  mainImage: string
  hoverImage: string
  banners: string[]
  top?: boolean
  status: 'active' | 'inactive'
  productCount?: number
  parent?: Category | string | null
  subcategories?: Category[]
  createdAt?: string
  updatedAt?: string
}

export interface CategoryStats {
  total: number
  active: number
  inactive: number
  top: number
}

export interface CategoriesResponse {
  categories: Category[]
  stats: CategoryStats
}
