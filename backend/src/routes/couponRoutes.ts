import { Router } from 'express'
import {
  createCoupon,
  deleteCoupon,
  getApplicableCoupons,
  getCoupon,
  getCoupons,
  updateCoupon,
  validateCoupon,
} from '../controllers/coupon.controller'
import { authorize, protect, requirePermission } from '../middlewares/authMiddleware'

const router = Router()

// Public routes
router.post('/validate', validateCoupon)
router.get('/applicable', getApplicableCoupons)

// Admin routes - permission-based access
router.get('/', protect, requirePermission('coupons', 'view'), getCoupons)
router.get('/:id', protect, requirePermission('coupons', 'view'), getCoupon)
router.post('/', protect, requirePermission('coupons', 'create'), createCoupon)
router.put('/:id', protect, requirePermission('coupons', 'update'), updateCoupon)
router.delete('/:id', protect, requirePermission('coupons', 'delete'), deleteCoupon)

export default router

