import { Router } from 'express'
import {
  adminDownloadInvoice,
  adminDownloadLabel,
  adminRequestPickup,
  adminTrackShipment,
  cancelOrder,
  createManualRefund,
  getAdminOrderDetail,
  getAdminOrders,
  getAdminShipmentRates,
  getCustomerOrders,
  getOrderRefunds,
  getSellerPickupAddresses,
  regenerateSellerShipmentLabel,
  searchSellerOrders,
  updateAdminOrderStatus,
  updateAdminPaymentStatus,
  updateAdminSellerShipmentStatus,
} from '../controllers/adminOrder.controller'
import { protect, requirePermission } from '../middlewares/authMiddleware'

const router = Router()

// All routes require authentication
router.use(protect)

// View routes - require view permission
router.get('/', requirePermission('orders', 'view'), getAdminOrders)
router.get('/customer/:customerId', requirePermission('orders', 'view'), getCustomerOrders)
router.get('/search/seller/:sellerId', requirePermission('orders', 'view'), searchSellerOrders)
router.get('/:id', requirePermission('orders', 'view'), getAdminOrderDetail)
router.get('/:id/refunds', requirePermission('orders', 'view'), getOrderRefunds)

// Order processing routes - view permissions
router.get('/:id/seller/:shipmentId/pickup-addresses', requirePermission('orders', 'view'), getSellerPickupAddresses)
router.get('/:id/seller/:shipmentId/track', requirePermission('orders', 'view'), adminTrackShipment)
router.get('/:id/seller/:shipmentId/invoice', requirePermission('orders', 'view'), adminDownloadInvoice)
router.get('/:id/seller/:shipmentId/download-label', requirePermission('orders', 'view'), adminDownloadLabel)

// Update routes - require update permission
router.patch('/:id/status', requirePermission('orders', 'update'), updateAdminOrderStatus)
router.patch('/:id/payment-status', requirePermission('orders', 'update'), updateAdminPaymentStatus)
router.patch('/:id/seller/:shipmentId/status', requirePermission('orders', 'update'), updateAdminSellerShipmentStatus)
router.post('/:id/seller/:shipmentId/rates', requirePermission('orders', 'update'), getAdminShipmentRates)
router.post('/:id/seller/:shipmentId/request-pickup', requirePermission('orders', 'update'), adminRequestPickup)
router.post('/:id/seller/:shipmentId/label', requirePermission('orders', 'update'), regenerateSellerShipmentLabel)
router.post('/:id/refund', requirePermission('orders', 'update'), createManualRefund)
router.post('/:id/cancel', requirePermission('orders', 'update'), cancelOrder)

export default router
