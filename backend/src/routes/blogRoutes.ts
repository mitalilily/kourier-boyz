import { Router } from 'express'
import {
  createBlog,
  deleteBlog,
  getBlog,
  getBlogs,
  getBlogStats,
  getNewsletterSubscribers,
  updateBlog,
} from '../controllers/blog.controller'
import { authorize, protect, requirePermission } from '../middlewares/authMiddleware'
import { upload } from '../middlewares/upload.middleware'

const router = Router()

// Public routes
router.get('/', getBlogs)
router.get('/stats', protect, requirePermission('blogs', 'view'), getBlogStats)
router.get('/subscribers/newsletter', protect, requirePermission('blogs', 'view'), getNewsletterSubscribers)
router.get('/:id', getBlog)

// Protected routes - require authentication and permissions
router.post('/', protect, requirePermission('blogs', 'create'), upload.single('featuredImage'), createBlog)
router.put('/:id', protect, requirePermission('blogs', 'update'), upload.single('featuredImage'), updateBlog)
router.delete('/:id', protect, requirePermission('blogs', 'delete'), deleteBlog)

export default router

