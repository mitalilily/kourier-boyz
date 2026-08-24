import API from './axiosInstance'

export interface ProductReview {
  _id: string
  user: string
  reviewer: {
    name: string
    avatarUrl?: string
    city?: string
    state?: string
  }
  rating: number
  title?: string
  comment: string
  isVerifiedPurchase?: boolean
  likes?: number
  dislikes?: number
  images?: string[]
  videos?: string[]
  moderationStatus: 'pending' | 'approved' | 'rejected'
  moderationReason?: string
  createdAt: string
  updatedAt: string
  product: {
    _id: string
    name: string
    mainImage?: string
    slug: string
  }
}

export type FeedbackType = 'product' | 'delivery' | 'support'

export interface SellerFeedbackItem {
  _id: string
  rating: number
  comment?: string
  type: FeedbackType
  createdAt: string
  product?: {
    _id: string
    name: string
    mainImage?: string
    slug: string
  }
  metadata?: {
    orderId?: string
    productId?: string
  }
}

export interface SellerReviewStats {
  overallRating: number
  totalReviews: number
  averageRating: number
  ratingDistribution: {
    5: number
    4: number
    3: number
    2: number
    1: number
  }
  recentReviews: ProductReview[]
  explicitFeedbackCount?: number
  topRatedProducts: Array<{
    _id: string
    name: string
    rating: number
    reviewCount: number
    mainImage?: string
  }>
}

export interface ReviewsResponse {
  reviews: ProductReview[]
  total: number
  page: number
  pages: number
}

export interface SellerFeedbackResponse {
  feedback: SellerFeedbackItem[]
  total: number
  page: number
  pages: number
}

// Get seller review stats
export const getSellerReviewStats = async (): Promise<SellerReviewStats> => {
  const response = await API.get('/reviews/stats')
  return response.data
}

// Get all product reviews for seller
export const getSellerReviews = async (params?: {
  page?: number
  limit?: number
  rating?: number
  productId?: string
  status?: 'pending' | 'approved' | 'rejected'
  search?: string
}): Promise<ReviewsResponse> => {
  const response = await API.get('/reviews', { params })
  return response.data
}

// Get explicit feedback (delivery / support / product) for seller's products
export const getSellerFeedback = async (params?: {
  page?: number
  limit?: number
  type?: FeedbackType
  rating?: number
}): Promise<SellerFeedbackResponse> => {
  const response = await API.get('/reviews/feedback', { params })
  return response.data
}

// Get reviews for a specific product
export const getProductReviews = async (
  productId: string,
  params?: {
    page?: number
    limit?: number
    rating?: number
  },
): Promise<ReviewsResponse> => {
  const response = await API.get(`/reviews/product/${productId}`, { params })
  return response.data
}

