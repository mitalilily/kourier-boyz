import { Router } from 'express'
import {
  createAnnouncement,
  deleteAnnouncement,
  getAllAnnouncements,
  getAnnouncement,
  getActiveAnnouncements,
  updateAnnouncement,
} from '../controllers/announcement.controller'
import { authorize, protect, requirePermission } from '../middlewares/authMiddleware'

const router = Router()

// Public route - get active announcements for frontend
router.get('/active', getActiveAnnouncements)

// Protected admin routes
router.get('/', protect, requirePermission('announcements', 'view'), getAllAnnouncements)
router.get('/:id', protect, requirePermission('announcements', 'view'), getAnnouncement)
router.post('/', protect, requirePermission('announcements', 'create'), createAnnouncement)
router.put('/:id', protect, requirePermission('announcements', 'update'), updateAnnouncement)
router.delete('/:id', protect, requirePermission('announcements', 'delete'), deleteAnnouncement)

export default router

