import { Router } from 'express'
import {
  calculateClientInternationalRateController,
  createInternationalShipmentController,
  listAdminInternationalShipmentsController,
  listClientInternationalRateCardsController,
  listMyInternationalShipmentsController,
  updateAdminInternationalShipmentController,
} from '../controllers/internationalShipment.controller'
import { isAdminMiddleware } from '../middlewares/isAdmin'
import { requireAuth } from '../middlewares/requireAuth'

const router = Router()

router.get('/international/rate-cards', requireAuth, listClientInternationalRateCardsController)
router.post('/international/rate-calculator', requireAuth, calculateClientInternationalRateController)
router.post('/international/shipments', requireAuth, createInternationalShipmentController)
router.get('/international/shipments', requireAuth, listMyInternationalShipmentsController)
router.get('/admin/international/shipments', requireAuth, isAdminMiddleware, listAdminInternationalShipmentsController)
router.patch('/admin/international/shipments/:id', requireAuth, isAdminMiddleware, updateAdminInternationalShipmentController)

export default router
