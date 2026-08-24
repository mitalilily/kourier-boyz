import { Router } from 'express'
import {
  approveDeactivation,
  getDeactivationRequests,
  reactivateSeller,
  rejectDeactivation,
} from '../controllers/sellerDeactivation.controller'
import { protect, requirePermission } from '../middlewares/authMiddleware'

const router = Router()

// All routes require authentication
router.use(protect)

// Get all pending deactivation requests
router.get(
  '/requests',
  requirePermission('sellerDeactivationRequests', 'view'),
  getDeactivationRequests,
)

// Approve deactivation request
router.post(
  '/sellers/:id/approve-deactivation',
  requirePermission('sellerDeactivationRequests', 'approve'),
  approveDeactivation,
)

// Reject deactivation request
router.post(
  '/sellers/:id/reject-deactivation',
  requirePermission('sellerDeactivationRequests', 'reject'),
  rejectDeactivation,
)

// Reactivate deactivated seller
router.post(
  '/sellers/:id/reactivate',
  requirePermission('sellerDeactivationRequests', 'approve'),
  reactivateSeller,
)

export default router


















