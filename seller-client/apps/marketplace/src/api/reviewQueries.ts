import { useQuery } from '@tanstack/react-query'
import {
  getProductReviews,
  getSellerFeedback,
  getSellerReviewStats,
  getSellerReviews,
  type ReviewsResponse,
  type SellerFeedbackResponse,
  type SellerReviewStats,
  type FeedbackType,
} from './reviews'

export const useSellerReviewStats = () => {
  return useQuery<SellerReviewStats>({
    queryKey: ['sellerReviewStats'],
    queryFn: getSellerReviewStats,
  })
}

export const useSellerReviews = (params?: {
  page?: number
  limit?: number
  rating?: number
  productId?: string
  status?: 'pending' | 'approved' | 'rejected'
  search?: string
}) => {
  return useQuery<ReviewsResponse>({
    queryKey: ['sellerReviews', params],
    queryFn: () => getSellerReviews(params),
  })
}

export const useSellerFeedback = (params?: {
  page?: number
  limit?: number
  type?: FeedbackType
  rating?: number
}) => {
  return useQuery<SellerFeedbackResponse>({
    queryKey: ['sellerFeedback', params],
    queryFn: () => getSellerFeedback(params),
  })
}

export const useProductReviews = (
  productId: string,
  params?: {
    page?: number
    limit?: number
    rating?: number
  },
) => {
  return useQuery<ReviewsResponse>({
    queryKey: ['productReviews', productId, params],
    queryFn: () => getProductReviews(productId, params),
    enabled: !!productId,
  })
}

