import express from 'express'
import { protect, requirePermission } from '../middlewares/authMiddleware'
import {
  getAllContactForms,
  getContactForm,
  getMyContactForms,
  respondToContactForm,
  submitContactForm,
  updateContactFormStatus,
} from '../controllers/contactForm.controller'

const router = express.Router()

// Public route (no auth required)
router.post('/', submitContactForm)

// Customer route (if authenticated, can see their own submissions)
router.get('/my', protect, getMyContactForms)

// Admin routes - permission-based access
router.get('/', protect, requirePermission('contactForms', 'view'), getAllContactForms)
router.get('/:id', protect, requirePermission('contactForms', 'view'), getContactForm)
router.put('/:id/status', protect, requirePermission('contactForms', 'update'), updateContactFormStatus)
router.post('/:id/respond', protect, requirePermission('contactForms', 'update'), respondToContactForm)

export default router

