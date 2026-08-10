import { Router } from 'express'
import {
  getPaymentIntentDetails,
  verifyPaymentIntentManually,
} from '../controllers/adminPayment.controller'
import { protect, requirePermission } from '../middlewares/authMiddleware'

const router = Router()

// All admin payment routes require authentication
router.use(protect)

// Get payment intent details - requires view permission for orders module
router.get('/payment-intents/:razorpayOrderId', requirePermission('orders', 'view'), getPaymentIntentDetails)

// Manually verify and create orders from payment intent - requires update permission
router.post('/payment-intents/:razorpayOrderId/verify', requirePermission('orders', 'update'), verifyPaymentIntentManually)

export default router

