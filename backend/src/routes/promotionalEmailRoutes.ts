import { Router } from 'express'
import {
  createPromotionalEmail,
  deletePromotionalEmail,
  getPromotionalEmail,
  getPromotionalEmails,
  getPromotionalEmailStats,
  sendPromotionalEmail,
  updatePromotionalEmail,
} from '../controllers/promotionalEmail.controller'
import { protect, requirePermission } from '../middlewares/authMiddleware'
import { upload } from '../middlewares/upload.middleware'

const router = Router()

// All routes require authentication and promotional-emails permission
router.get('/stats', protect, requirePermission('promotional-emails', 'view'), getPromotionalEmailStats)
router.get('/', protect, requirePermission('promotional-emails', 'view'), getPromotionalEmails)
router.get('/:id', protect, requirePermission('promotional-emails', 'view'), getPromotionalEmail)
router.post(
  '/',
  protect,
  requirePermission('promotional-emails', 'create'),
  upload.single('featuredImage'),
  createPromotionalEmail,
)
router.put(
  '/:id',
  protect,
  requirePermission('promotional-emails', 'update'),
  upload.single('featuredImage'),
  updatePromotionalEmail,
)
router.delete('/:id', protect, requirePermission('promotional-emails', 'delete'), deletePromotionalEmail)
router.post('/:id/send', protect, requirePermission('promotional-emails', 'create'), sendPromotionalEmail)

export default router

