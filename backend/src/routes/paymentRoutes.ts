import { Router } from 'express'
import {
  checkOrderStatus,
  confirmRazorpayPayment,
  createPaymentIntent,
  createRazorpayOrder,
  verifyRazorpayPayment,
} from '../controllers/payment.controller'
import { authorize, protect } from '../middlewares/authMiddleware'

const router = Router()

// All payment routes require authenticated customer
router.use(protect, authorize(['customer']))

router.post('/razorpay/order', createRazorpayOrder)
router.post('/razorpay/verify', verifyRazorpayPayment)
router.post('/razorpay/confirm', confirmRazorpayPayment)
router.post('/razorpay/intent', createPaymentIntent)
router.get('/razorpay/status/:razorpayOrderId', checkOrderStatus)

export default router
