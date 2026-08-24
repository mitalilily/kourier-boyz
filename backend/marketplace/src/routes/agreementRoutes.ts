import express from 'express'
import {
  generateAgreementPDF,
  getActiveAgreementByType,
  getAgreements,
  upsertAgreement,
} from '../controllers/agreement.controller'
import { protect, requirePermission } from '../middlewares/authMiddleware'

const router = express.Router()

// Get all agreements - permission-based access
router.get('/', protect, requirePermission('agreements', 'view'), getAgreements)

// Get active agreement by type (public for sellers)
router.get('/type/:type', getActiveAgreementByType)

// Create or update agreement - permission-based access
router.post('/upsert', protect, requirePermission('agreements', 'update'), upsertAgreement)

// Generate PDF for agreement - permission-based access
router.post('/:type/pdf', protect, requirePermission('agreements', 'view'), generateAgreementPDF)

export default router
