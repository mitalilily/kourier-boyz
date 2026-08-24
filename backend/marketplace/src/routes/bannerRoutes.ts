import { Router } from 'express'
import {
  createBanner,
  deleteBanner,
  getBanners,
  updateBanner,
  updateBannerOrders,
} from '../controllers/banner.controller'
import { authorize, protect, requirePermission } from '../middlewares/authMiddleware'
import { upload } from '../middlewares/upload.middleware'

const router = Router()

// Public route - get active banners
router.get('/', getBanners)

// Protected routes - permission-based access
router.post('/', protect, requirePermission('banners', 'create'), upload.single('image'), createBanner)
// Specific routes must come before parameterized routes
router.put('/update-orders', protect, requirePermission('banners', 'update'), updateBannerOrders)
router.put('/:id', protect, requirePermission('banners', 'update'), upload.single('image'), updateBanner)
router.delete('/:id', protect, requirePermission('banners', 'delete'), deleteBanner)

export default router
