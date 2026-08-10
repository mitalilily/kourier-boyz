import { Router } from 'express'
import {
  getBreachedSLAs,
  getSLATrackingByOrder,
  sendManualReminder,
  getSLABreachReport,
  getSLAAuditLog,
  triggerAutomaticReminders,
  triggerSLAResolutionCheck,
  getSellerSLAReport,
} from '../controllers/slaReminder.controller'
import { authorize, protect, requirePermission } from '../middlewares/authMiddleware'

const router = Router()

// Admin routes
const adminRouter = Router()
adminRouter.use(protect)
// View routes - require view permission for reports module (SLA reports)
adminRouter.get('/breached', requirePermission('reports', 'view'), getBreachedSLAs)
adminRouter.get('/tracking', requirePermission('reports', 'view'), getSLATrackingByOrder)
adminRouter.get('/report', requirePermission('reports', 'view'), getSLABreachReport)
adminRouter.get('/audit-log', requirePermission('auditLogs', 'view'), getSLAAuditLog)
// Update routes - require update permission for orders module
adminRouter.post('/reminder', requirePermission('orders', 'update'), sendManualReminder)
adminRouter.post('/trigger-reminders', requirePermission('orders', 'update'), triggerAutomaticReminders)
adminRouter.post('/trigger-resolution-check', requirePermission('orders', 'update'), triggerSLAResolutionCheck)

// Seller routes
const sellerRouter = Router()
sellerRouter.use(protect, authorize(['seller']))
sellerRouter.get('/report', getSellerSLAReport)

router.use('/admin', adminRouter)
router.use('/seller', sellerRouter)

export default router

