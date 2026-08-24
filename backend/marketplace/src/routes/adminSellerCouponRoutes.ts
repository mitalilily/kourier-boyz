import { Router } from 'express'
import {
  approveSellerCoupon,
  deleteSellerCouponAdmin,
  getAllSellerCoupons,
  getCouponAnalytics,
  getSellerCouponAdmin,
  pauseSellerCouponAdmin,
  denySellerCoupon,
  updateSellerCouponStatus,
} from '../controllers/adminSellerCoupon.controller'
import { authorize, protect, requirePermission } from '../middlewares/authMiddleware'

const router = Router()

// All routes require admin authentication
router.use(protect)

// Permission-based access
router.get('/', requirePermission('sellerCoupons', 'view'), getAllSellerCoupons)
router.get('/analytics', requirePermission('sellerCoupons', 'view'), getCouponAnalytics)
router.get('/:id', requirePermission('sellerCoupons', 'view'), getSellerCouponAdmin)
router.post('/:id/approve', requirePermission('sellerCoupons', 'approve'), approveSellerCoupon)
router.post('/:id/deny', requirePermission('sellerCoupons', 'reject'), denySellerCoupon)
router.post('/:id/pause', requirePermission('sellerCoupons', 'update'), pauseSellerCouponAdmin)
router.put('/:id/status', requirePermission('sellerCoupons', 'update'), updateSellerCouponStatus)
router.delete('/:id', requirePermission('sellerCoupons', 'delete'), deleteSellerCouponAdmin)

export default router

