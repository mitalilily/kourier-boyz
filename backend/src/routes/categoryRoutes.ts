import { Router } from 'express'
import {
  bulkDeleteCategories,
  bulkUpdateStatus,
  createCategory,
  deleteCategory,
  getCategories,
  getCategory,
  getRootCategories,
  getSubcategories,
  updateCategory,
} from '../controllers/category.controller'
import { authorize, protect, requirePermission } from '../middlewares/authMiddleware'
import { uploadCategoryImages } from '../middlewares/upload.middleware'

const router = Router()

// Bulk operations (must come BEFORE /:id routes)
router.post('/bulk/delete', protect, requirePermission('categories', 'delete'), bulkDeleteCategories)
router.post('/bulk/status', protect, requirePermission('categories', 'update'), bulkUpdateStatus)

// Regular CRUD operations - GET routes are public, POST/PUT/DELETE require permissions
router.get('/', getCategories)
router.get('/root', getRootCategories) // Must come before /:id
router.get('/:id/subcategories', getSubcategories) // Must come before /:id
router.get('/:id', getCategory)
router.post('/', protect, requirePermission('categories', 'create'), uploadCategoryImages, createCategory)
router.put('/:id', protect, requirePermission('categories', 'update'), uploadCategoryImages, updateCategory)
router.delete('/:id', protect, requirePermission('categories', 'delete'), deleteCategory)

export default router
