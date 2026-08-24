import express from 'express'
import {
  getTopSellerTestimonials,
  publicCheckServiceability,
  publicClearViewingHistory,
  publicCreateProductReview,
  publicDislikeReview,
  publicGetAdditionalCategoryHighlights,
  publicGetAlsoBoughtProducts,
  publicGetBestSellersProducts,
  publicGetCategoryHighlights,
  publicGetCustomerHighlights,
  publicGetDealsByScope,
  publicGetDealsProducts,
  publicGetFeaturedProducts,
  publicGetNewArrivalsProducts,
  publicGetProduct,
  publicGetProductFilters,
  publicGetProductReviews,
  publicGetRecentlyViewedProducts,
  publicGetRecommendedByPurchases,
  publicGetRecommendedByShoppingTrends,
  publicGetRecommendedProducts,
  publicGetTrendingProducts,
  publicIncrementProductView,
  publicLikeReview,
  publicListProducts,
} from '../controllers/publicProduct.controller'
import { optionalAuth, protect } from '../middlewares/authMiddleware'
import { uploadReviewMedia } from '../middlewares/upload.middleware'

const router = express.Router()

// Public routes - no authentication required
router.get('/', publicListProducts)
router.get('/featured', publicGetFeaturedProducts)
router.get('/trending', publicGetTrendingProducts)
router.get('/deals', publicGetDealsProducts)
router.get('/deals/:scope', publicGetDealsByScope)
router.get('/new-arrivals', publicGetNewArrivalsProducts)
router.get('/best-sellers', publicGetBestSellersProducts)
router.get('/category-highlights', publicGetCategoryHighlights)
router.get('/category-highlights/additional', publicGetAdditionalCategoryHighlights)
router.get('/filters', publicGetProductFilters)
router.get('/seller-testimonials', getTopSellerTestimonials)
router.get('/recommended', optionalAuth, publicGetRecommendedProducts)
router.get('/recommended/shopping-trends', protect, publicGetRecommendedByShoppingTrends)
router.get('/recommended/purchases', protect, publicGetRecommendedByPurchases)
router.get('/recently-viewed', protect, publicGetRecentlyViewedProducts)
router.delete('/recently-viewed', protect, publicClearViewingHistory)
router.post('/:id/view', optionalAuth, publicIncrementProductView)
router.get('/:id/reviews', optionalAuth, publicGetProductReviews)
router.post('/:id/reviews', protect, uploadReviewMedia, publicCreateProductReview)
router.post('/:id/reviews/:reviewId/like', optionalAuth, publicLikeReview)
router.post('/:id/reviews/:reviewId/dislike', optionalAuth, publicDislikeReview)
router.get('/:id/customer-highlights', optionalAuth, publicGetCustomerHighlights)
router.get('/:id/also-bought', optionalAuth, publicGetAlsoBoughtProducts)
router.get('/:id/serviceability', publicCheckServiceability)
router.get('/:id', optionalAuth, publicGetProduct)

export default router
