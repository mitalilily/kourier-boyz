import express from 'express'
import {
  bookMarketplaceDraft,
  cancelMarketplaceDraft,
  createMarketplaceDraft,
} from '../controllers/marketplaceFulfillment.controller'
import { requireInternalService } from '../middlewares/requireInternalService'
import { getShippingRatesController } from '../controllers/externalApi/shipping.controller'

const router = express.Router()
router.use(requireInternalService)
router.post('/orders', createMarketplaceDraft)
router.post('/orders/cancel', cancelMarketplaceDraft)
router.post('/orders/:orderId/book', bookMarketplaceDraft)
router.post('/rates', (req: any, res) => {
  req.userId = String(req.body?.logisticsUserId || '').trim()
  if (!req.userId) {
    return res.status(400).json({ success: false, message: 'Seller courier account is required' })
  }
  return getShippingRatesController(req, res)
})

export default router
