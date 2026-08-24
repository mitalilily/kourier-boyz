import { Router } from 'express'
import {
  getCustomerRefundRequests,
  getRefundRequest,
  listRefundRequests,
  updateRefundRequest,
} from '../controllers/refund.controller'
import { getReplacementVariants } from '../controllers/replacement.controller'
import {
  adminApproveReturn,
  adminCancelReturn,
  adminCreateReturnRequest,
  adminCreateReversePickup,
  adminGetReturnServiceability,
  adminMarkRefundCompleted,
  adminMarkRefundInitiated,
  adminMarkReturnReceived,
  adminRejectReturn,
  createReturnRequest,
  downloadCreditNote,
  getReturnReasons,
  listAdminReturns,
  listCustomerReturns,
} from '../controllers/return.controller'
import { authorize, protect, requirePermission } from '../middlewares/authMiddleware'
import { uploadReturnMedia } from '../middlewares/upload.middleware'

const router = Router()

// Customer-facing routes (mounted at /api)
router.get('/returns', protect, authorize(['customer']), listCustomerReturns)
router.get('/returns/reasons', getReturnReasons) // Public endpoint - no auth needed
router.post(
  '/returns/create',
  protect,
  authorize(['customer']),
  uploadReturnMedia, // Accept up to 5 images or videos
  createReturnRequest,
)
router.get(
  '/replacement/variants',
  protect,
  authorize(['customer', 'super-admin']),
  getReplacementVariants,
)
router.get('/refunds', protect, authorize(['customer']), getCustomerRefundRequests)

// Admin-facing
router.get('/admin/returns', protect, requirePermission('returns', 'view'), listAdminReturns)
router.post(
  '/admin/returns/create',
  protect,
  requirePermission('returns', 'create'),
  uploadReturnMedia, // Accept up to 5 images or videos
  adminCreateReturnRequest,
)
router.put(
  '/admin/returns/:id/approve',
  protect,
  requirePermission('returns', 'approve'),
  adminApproveReturn,
)
router.put(
  '/admin/returns/:id/reject',
  protect,
  requirePermission('returns', 'reject'),
  adminRejectReturn,
)
router.put(
  '/admin/returns/:id/cancel',
  protect,
  requirePermission('returns', 'update'),
  adminCancelReturn,
)
router.get(
  '/admin/returns/:id/quote',
  protect,
  requirePermission('returns', 'view'),
  adminGetReturnServiceability,
)
router.post(
  '/admin/returns/:id/create-reverse-pickup',
  protect,
  requirePermission('returns', 'update'),
  adminCreateReversePickup,
)
router.put(
  '/admin/returns/:id/mark-received',
  protect,
  requirePermission('returns', 'update'),
  adminMarkReturnReceived,
)
router.put(
  '/admin/returns/:id/refund-initiate',
  protect,
  requirePermission('returns', 'update'),
  adminMarkRefundInitiated,
)
router.put(
  '/admin/returns/:id/complete-refund',
  protect,
  requirePermission('returns', 'update'),
  adminMarkRefundCompleted,
)

// Download credit note (accessible by customer, seller, and admin)
router.get(
  '/returns/:id/credit-note',
  protect,
  authorize(['customer', 'seller', 'super-admin']),
  downloadCreditNote,
)

// Admin refund management
router.get('/admin/refunds', protect, requirePermission('returns', 'view'), listRefundRequests)
router.get('/admin/refunds/:id', protect, requirePermission('returns', 'view'), getRefundRequest)
router.put(
  '/admin/refunds/:id',
  protect,
  requirePermission('returns', 'update'),
  updateRefundRequest,
)

export default router
