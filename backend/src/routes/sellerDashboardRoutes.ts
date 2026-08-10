import { Router } from 'express'
import { getSellerDashboardOverview } from '../controllers/settlement.controller'
import { authorize, protect } from '../middlewares/authMiddleware'

const router = Router()

router.use(protect, authorize(['seller']))

router.get('/overview', getSellerDashboardOverview)

export default router
