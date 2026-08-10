import express from 'express'
import {
  addCategoriesToBrand,
  getAllBrands,
  getBrandApprovedCategories,
  updateBrandStatus,
} from '../controllers/brand.controller'
import { protect, requirePermission } from '../middlewares/authMiddleware'

const router = express.Router()

// All routes require authentication
router.use(protect)

// Get all brands (with filters) - requires view permission for requests module
router.get('/', requirePermission('requests', 'view'), getAllBrands)

// Get approved categories for a brand (for "Add categories" UI)
router.get('/:id/approved-categories', requirePermission('requests', 'view'), getBrandApprovedCategories)

// Add categories to an already approved brand (email + unblock products)
router.post('/:id/add-categories', requirePermission('requests', 'approve'), addCategoriesToBrand)

// Update brand status (approve/reject/request more docs/revoke) - requires approve permission
router.patch('/:id/status', requirePermission('requests', 'approve'), updateBrandStatus)

export default router

