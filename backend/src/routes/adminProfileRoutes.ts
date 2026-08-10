import express from 'express'
import {
  changeSuperAdminPassword,
  forceLogoutUser,
  getAdminActivityLogs,
  verifyDeviceAndChangePassword,
} from '../controllers/adminProfile.controller'
import { authorize, protect, requirePermission } from '../middlewares/authMiddleware'

const router = express.Router()

// Public route for device verification (accessed via email link)
// Support both GET (direct link click) and POST (from frontend)
router.get('/verify-device-password-change/:token', verifyDeviceAndChangePassword)
router.post('/verify-device-password-change/:token', verifyDeviceAndChangePassword)

// Protected routes (require authentication)
router.use(protect)
// Password change - only super-admin can change password (controller enforces this)
router.post('/change-password', authorize(['super-admin']), changeSuperAdminPassword)
// Activity logs require auditLogs view permission
router.get('/activity', requirePermission('auditLogs', 'view'), getAdminActivityLogs)
// Force logout requires userManagement update permission
router.post('/logout-user/:id', requirePermission('userManagement', 'update'), forceLogoutUser)

export default router
