import express from 'express'
import {
  getSellerCustomerDetail,
  getSellerCustomerStats,
  getSellerCustomers,
} from '../controllers/userController'
import { authorize, protect } from '../middlewares/authMiddleware'

const router = express.Router()

// All routes require authentication and seller role
router.use(protect)
router.use(authorize(['seller']))

// Get customer stats
router.get('/stats', getSellerCustomerStats)

// Get customers for seller
router.get('/', getSellerCustomers)

// Get a specific customer by ID with order history
router.get('/:id', getSellerCustomerDetail)

export default router
