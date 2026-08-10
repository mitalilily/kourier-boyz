import { Router } from 'express'
import {
  getWebhookEvents,
  handleCourierCartWebhook,
  handleShipmozoWebhook,
  handleRazorpayWebhook,
} from '../controllers/webhook.controller'
import { protect, requirePermission } from '../middlewares/authMiddleware'

const router = Router()

// Public webhook endpoints (no auth required - verified by signature)
router.post('/couriercart', handleCourierCartWebhook)
router.post('/shipmozo', handleShipmozoWebhook)
router.post('/razorpay', handleRazorpayWebhook)

// Admin endpoint to view webhook events (protected) - requires view permission for auditLogs
router.get('/events', protect, requirePermission('auditLogs', 'view'), getWebhookEvents)

export default router












