import express from 'express'
import {
  getAllCategoryExtensionRequests,
  getCategoryExtensionRequest,
  updateCategoryExtensionRequestStatus,
  revokeCategoryScope,
} from '../controllers/adminCategoryExtension.controller'
import { protect, requirePermission } from '../middlewares/authMiddleware'

const router = express.Router()

// All routes require authentication
router.use(protect)

// View routes - require view permission for requests module
router.get('/', requirePermission('requests', 'view'), getAllCategoryExtensionRequests)
router.get('/:id', requirePermission('requests', 'view'), getCategoryExtensionRequest)

// Update routes - require approve permission
router.patch('/:id/status', requirePermission('requests', 'approve'), updateCategoryExtensionRequestStatus)
router.post('/revoke', requirePermission('requests', 'update'), revokeCategoryScope)

export default router

