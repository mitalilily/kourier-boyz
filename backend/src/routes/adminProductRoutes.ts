import express from 'express'
import {
  adminBulkDelete,
  adminBulkUpdateStatus,
  adminDeleteProduct,
  adminExportProductsCSV,
  adminGetProduct,
  adminGetProductCertificateSummary,
  adminInventoryAnalytics,
  adminListProducts,
  adminLowStockReport,
  adminRemindMissingCertificates,
  adminRaiseObjection,
  adminToggleFeatured,
  adminToggleStatusLock,
  adminResolveLatestObjection,
  adminUpdateProductStatus,
  adminGetProductReviews,
  adminGetPendingReviews,
  adminApproveReview,
  adminRejectReview,
  adminBulkApproveReviews,
  adminBulkRejectReviews,
  adminGetPendingReviewsCount,
  adminGetAllReviews,
  adminDeleteReview,
} from '../controllers/adminProduct.controller'
import { authorize, protect, requirePermission } from '../middlewares/authMiddleware'

const router = express.Router()

router.use(protect)

// View routes - require view permission
router.get('/', requirePermission('products', 'view'), adminListProducts)
router.get('/low-stock', requirePermission('products', 'view'), adminLowStockReport)
router.get('/analytics', requirePermission('products', 'view'), adminInventoryAnalytics)
router.get('/export/csv', requirePermission('products', 'view'), adminExportProductsCSV)

// Review moderation routes
router.get('/reviews/pending', requirePermission('reviews', 'view'), adminGetPendingReviews)
router.get('/reviews/pending/count', requirePermission('reviews', 'view'), adminGetPendingReviewsCount)
router.get('/reviews/all', requirePermission('reviews', 'view'), adminGetAllReviews)
router.post('/reviews/bulk-approve', requirePermission('reviews', 'approve'), adminBulkApproveReviews)
router.post('/reviews/bulk-reject', requirePermission('reviews', 'reject'), adminBulkRejectReviews)

router.get('/:id/certificates', requirePermission('products', 'view'), adminGetProductCertificateSummary)
router.get('/:id/reviews', requirePermission('reviews', 'view'), adminGetProductReviews)
router.get('/:id', requirePermission('products', 'view'), adminGetProduct)

// Update routes - require update/approve/reject permissions
router.patch('/:id/status', requirePermission('products', 'update'), adminUpdateProductStatus)
router.patch('/:id/feature', requirePermission('products', 'update'), adminToggleFeatured)
router.patch('/:id/status-lock', requirePermission('products', 'update'), adminToggleStatusLock)
router.delete('/:id', requirePermission('products', 'delete'), adminDeleteProduct)
router.post('/bulk/status', requirePermission('products', 'update'), adminBulkUpdateStatus)
router.post('/bulk/delete', requirePermission('products', 'delete'), adminBulkDelete)
router.post('/:id/objections', requirePermission('products', 'reject'), adminRaiseObjection)
router.patch('/:id/objections/resolve', requirePermission('products', 'update'), adminResolveLatestObjection)
router.post('/:id/remind-missing-certificates', requirePermission('products', 'update'), adminRemindMissingCertificates)

// Review moderation actions
router.patch('/:productId/reviews/:reviewId/approve', requirePermission('reviews', 'approve'), adminApproveReview)
router.patch('/:productId/reviews/:reviewId/reject', requirePermission('reviews', 'reject'), adminRejectReview)
router.delete('/:productId/reviews/:reviewId', requirePermission('reviews', 'delete'), adminDeleteReview)

export default router
