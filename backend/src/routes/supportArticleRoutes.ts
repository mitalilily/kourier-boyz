import express from 'express'
import { protect, requirePermission } from '../middlewares/authMiddleware'
import {
  createArticle,
  deleteArticle,
  getAllArticles,
  getArticle,
  getPublishedArticles,
  rateArticle,
  updateArticle,
} from '../controllers/supportArticle.controller'

const router = express.Router()

// Public routes
router.get('/published', getPublishedArticles)
router.get('/published/:id', getArticle)
router.post('/published/:id/rate', rateArticle)

// Admin routes - permission-based access
router.get('/', protect, requirePermission('supportArticles', 'view'), getAllArticles)
router.post('/', protect, requirePermission('supportArticles', 'create'), createArticle)
router.put('/:id', protect, requirePermission('supportArticles', 'update'), updateArticle)
router.delete('/:id', protect, requirePermission('supportArticles', 'delete'), deleteArticle)

export default router

