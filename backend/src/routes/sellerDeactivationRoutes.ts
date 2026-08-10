import { Router } from 'express'
import {
  approveDeactivation,
  checkEligibility,
  getDeactivationRequests,
  reactivateSeller,
  rejectDeactivation,
  requestDeactivation,
} from '../controllers/sellerDeactivation.controller'
import { authorize, protect, requirePermission } from '../middlewares/authMiddleware'

const router = Router()

// Seller routes (protected, seller only)
router.use(protect)
router.get('/check-eligibility', authorize(['seller']), checkEligibility)
router.post('/request', authorize(['seller']), requestDeactivation)

export default router

