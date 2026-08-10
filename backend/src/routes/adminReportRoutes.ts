import { Router } from 'express'
import {
  getCourierChargesReport,
  getPortalIncomeReport,
  getSalesReport,
  getSettlementDueReport,
  getTdsReport,
  getTcsReport,
  getNewSellerRegistrationReport,
  getTicketSystemReport,
  getSalesPendingStatusReport,
  getSLADashboardMetrics,
} from '../controllers/adminReport.controller'
import { protect, requirePermission } from '../middlewares/authMiddleware'

const router = Router()

// All routes require authentication
router.use(protect)

// All report routes require view permission for reports module
router.get('/sales', requirePermission('reports', 'view'), getSalesReport)
router.get('/sales-pending-status', requirePermission('reports', 'view'), getSalesPendingStatusReport)
router.get('/settlement-due', requirePermission('reports', 'view'), getSettlementDueReport)
router.get('/courier-charges', requirePermission('reports', 'view'), getCourierChargesReport)
router.get('/portal-income', requirePermission('reports', 'view'), getPortalIncomeReport)
router.get('/tds', requirePermission('reports', 'view'), getTdsReport)
router.get('/tcs', requirePermission('reports', 'view'), getTcsReport)
router.get('/new-sellers', requirePermission('reports', 'view'), getNewSellerRegistrationReport)
router.get('/tickets', requirePermission('reports', 'view'), getTicketSystemReport)
router.get('/sla-metrics', requirePermission('reports', 'view'), getSLADashboardMetrics)

export default router
