import { Router } from 'express'
import {
  addSubscriber,
  deleteSubscriber,
  getSubscribers,
  getSubscriberStats,
  subscribe,
  toggleSubscriberStatus,
  unsubscribe,
} from '../controllers/subscriber.controller'
import { protect, requirePermission } from '../middlewares/authMiddleware'

const router = Router()

// Public routes
router.post('/subscribe', subscribe)
router.get('/unsubscribe', unsubscribe)

// Admin routes
router.get('/stats', protect, requirePermission('promotional-emails', 'view'), getSubscriberStats)
router.get('/', protect, requirePermission('promotional-emails', 'view'), getSubscribers)
router.post('/', protect, requirePermission('promotional-emails', 'create'), addSubscriber)
router.delete('/:id', protect, requirePermission('promotional-emails', 'delete'), deleteSubscriber)
router.patch('/:id/toggle', protect, requirePermission('promotional-emails', 'update'), toggleSubscriberStatus)

export default router

