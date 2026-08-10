import { Router } from 'express'
import {
  createManualAdjustment,
  generateAdminSettlementBatches,
  generateAdminSettlementInvoice,
  getAdminCreditNotes,
  getAdminSettlementBatchDetail,
  getAdminSettlementInvoice,
  getAuditLogs,
  getGlobalSettlementSettings,
  getSellerLedger,
  getSellerSettlementSettings,
  getSettlementDueReport,
  getSettlementReport,
  getTcsReport,
  getTdsReport,
  importSettlementOrders,
  listAdminSettlementBatches,
  markAdminSettlementBatchPaid,
  updateGlobalSettlementSettings,
  upsertSellerSettlementSettings,
} from '../controllers/settlement.controller'
import { protect, requirePermission } from '../middlewares/authMiddleware'
import { uploadSettlementImport } from '../middlewares/upload.middleware'

const router = Router()

// All routes require authentication
router.use(protect)

// Settlement batches
router.get('/batches', requirePermission('settlements', 'view'), listAdminSettlementBatches)
router.get('/batches/:id', requirePermission('settlements', 'view'), getAdminSettlementBatchDetail)
router.post('/generate-batches', requirePermission('settlements', 'create'), generateAdminSettlementBatches)
router.put('/batches/:id/mark-paid', requirePermission('settlements', 'approve'), markAdminSettlementBatchPaid)
router.post('/batches/:id/generate-invoice', requirePermission('settlementInvoices', 'create'), generateAdminSettlementInvoice)
router.get('/batches/:id/invoice', requirePermission('settlementInvoices', 'view'), getAdminSettlementInvoice)

// Credit notes
router.get('/credit-notes', requirePermission('creditNotes', 'view'), getAdminCreditNotes)

// Manual adjustments and ledger
router.post('/import-orders', requirePermission('settlements', 'create'), uploadSettlementImport, importSettlementOrders)
router.post('/sellers/:sellerId/manual-adjustment', requirePermission('settlements', 'create'), createManualAdjustment)
router.get('/sellers/:sellerId/ledger', requirePermission('settlements', 'view'), getSellerLedger)

// Settlement settings
router.get('/global-settings', requirePermission('systemSettings', 'view'), getGlobalSettlementSettings)
router.put('/global-settings', requirePermission('systemSettings', 'update'), updateGlobalSettlementSettings)
router.get('/sellers/:sellerId/settlement-settings', requirePermission('systemSettings', 'view'), getSellerSettlementSettings)
router.put('/sellers/:sellerId/settlement-settings', requirePermission('systemSettings', 'update'), upsertSellerSettlementSettings)

// Audit logs (view only)
router.get('/audit-logs', requirePermission('auditLogs', 'view'), getAuditLogs)

// Reports (view only)
router.get('/reports/settlement', requirePermission('reports', 'view'), getSettlementReport)
router.get('/reports/tds', requirePermission('reports', 'view'), getTdsReport)
router.get('/reports/tcs', requirePermission('reports', 'view'), getTcsReport)
router.get('/reports/settlement-due', requirePermission('reports', 'view'), getSettlementDueReport)

export default router


