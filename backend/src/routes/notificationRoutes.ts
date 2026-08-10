import { Router } from 'express'
import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
  getNotificationPreferences,
  updateNotificationPreferences,
} from '../controllers/notificationController'
import { protect } from '../middlewares/authMiddleware'

const router = Router()

// All routes require authentication
router.use(protect)

// Get all notifications
router.get('/', getNotifications)

// Get unread notification count
router.get('/unread-count', getUnreadNotificationCount)

// Mark notification as read
router.patch('/:id/read', markNotificationRead)

// Mark all notifications as read
router.patch('/read-all', markAllNotificationsRead)

// Get notification preferences
router.get('/preferences', getNotificationPreferences)

// Update notification preferences
router.put('/preferences', updateNotificationPreferences)

export default router

