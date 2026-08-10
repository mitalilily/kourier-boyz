import { Router } from 'express'
import {
  applyCoupon,
  calculateProductDiscount,
  clipCoupon,
  createSellerCoupon,
  deleteSellerCoupon,
  getAvailableCoupons,
  getSellerCoupon,
  getSellerCoupons,
  getUserClippedCoupons,
  pauseSellerCoupon,
  resumeSellerCoupon,
  updateSellerCoupon,
} from '../controllers/sellerCoupon.controller'
import { authorize, protect } from '../middlewares/authMiddleware'

const router = Router()

// Public route - get available coupons for products
router.get('/available', getAvailableCoupons)

// Buyer route - calculate discount for a product (requires auth for accurate limits)
router.post('/calculate-discount', protect, authorize(['customer']), calculateProductDiscount)

// Buyer routes (authenticated)
router.post('/clip', protect, authorize(['customer']), clipCoupon)
router.get('/clipped', protect, authorize(['customer']), getUserClippedCoupons)
router.post('/apply', protect, authorize(['customer']), applyCoupon)

// Seller routes
router.get('/', protect, authorize(['seller']), getSellerCoupons)
router.get('/:id', protect, authorize(['seller']), getSellerCoupon)
router.post('/', protect, authorize(['seller']), createSellerCoupon)
router.put('/:id', protect, authorize(['seller']), updateSellerCoupon)
router.delete('/:id', protect, authorize(['seller']), deleteSellerCoupon)
router.post('/:id/pause', protect, authorize(['seller']), pauseSellerCoupon)
router.post('/:id/resume', protect, authorize(['seller']), resumeSellerCoupon)

export default router

