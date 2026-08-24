import { Router } from 'express'
import {
  getPublicShippingRatesController,
  getPublicTrackingController,
} from '../controllers/publicTools.controller'

const router = Router()

router.get('/tracking', getPublicTrackingController)
router.post('/shipping/rates', getPublicShippingRatesController)

export default router
