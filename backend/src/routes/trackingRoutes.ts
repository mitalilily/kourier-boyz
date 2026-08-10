import { Router } from 'express'
import { trackOrder } from '../controllers/tracking.controller'

const router = Router()

// Public tracking endpoint - no authentication required
router.get('/:identifier', trackOrder)

export default router
