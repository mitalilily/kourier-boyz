import express from 'express'
import {
  getProductReviews,
  getSellerReviewStats,
  getSellerReviews,
  getSellerFeedback,
} from '../controllers/sellerReview.controller'
import { authorize, protect } from '../middlewares/authMiddleware'

const router = express.Router()

// All routes require authentication and seller role
router.use(protect)
router.use(authorize(['seller']))

// Get seller review stats
router.get('/stats', getSellerReviewStats)

// Get all reviews for seller's products
router.get('/', getSellerReviews)

// Get explicit feedback (delivery / support / product) linked to seller's products
router.get('/feedback', getSellerFeedback)

// Get reviews for a specific product
router.get('/product/:productId', getProductReviews)

export default router

