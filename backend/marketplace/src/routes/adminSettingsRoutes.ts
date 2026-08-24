import { Router } from 'express'
import {
  getBrandingSettings,
  updateBrandingSettings,
  getPublicBranding,
  getAboutUsSettings,
  updateAboutUsSettings,
  getPublicAboutUs,
  getInvoiceSettings,
  getPublicInvoiceSettings,
  updateInvoiceSettings,
  getSLASettings,
  updateSLASettings,
  getFooterSettings,
  updateFooterSettings,
  getPublicFooter,
  getSettlementSettings,
  updateSettlementSettings,
} from '../controllers/adminSettings.controller'
import { protect, requirePermission } from '../middlewares/authMiddleware'
import { upload } from '../middlewares/upload.middleware'

const router = Router()

// Public routes - no auth required
router.get('/public/branding', getPublicBranding)
router.get('/public/invoice', getPublicInvoiceSettings)
router.get('/public/about-us', getPublicAboutUs)
router.get('/public/footer', getPublicFooter)

// Protected admin routes
router.use(protect)

// View routes - require view permission
router.get('/branding', requirePermission('systemSettings', 'view'), getBrandingSettings)
router.get('/about-us', requirePermission('systemSettings', 'view'), getAboutUsSettings)
router.get('/invoice', requirePermission('systemSettings', 'view'), getInvoiceSettings)
router.get('/sla', requirePermission('systemSettings', 'view'), getSLASettings)
router.get('/footer', requirePermission('systemSettings', 'view'), getFooterSettings)
router.get('/settlement', requirePermission('systemSettings', 'view'), getSettlementSettings)

// Update routes - require update permission
router.post(
  '/branding',
  requirePermission('systemSettings', 'update'),
  upload.fields([
    { name: 'invoiceLogo', maxCount: 1 },
    { name: 'labelLogo', maxCount: 1 },
    { name: 'authorizedSignature', maxCount: 1 },
  ]),
  updateBrandingSettings,
)
router.post(
  '/about-us',
  requirePermission('systemSettings', 'update'),
  upload.fields([{ name: 'heroImage', maxCount: 1 }]),
  updateAboutUsSettings,
)
router.post('/invoice', requirePermission('systemSettings', 'update'), updateInvoiceSettings)
router.put('/sla', requirePermission('systemSettings', 'update'), updateSLASettings)
router.post('/footer', requirePermission('systemSettings', 'update'), updateFooterSettings)
router.post('/settlement', requirePermission('systemSettings', 'update'), updateSettlementSettings)

export default router





















