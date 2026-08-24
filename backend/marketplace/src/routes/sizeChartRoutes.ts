import express from 'express'
import {
  createSizeChart,
  deleteSizeChart,
  getProductSizeChart,
  getSizeChart,
  getSizeCharts,
  updateSizeChart,
} from '../controllers/sizeChart.controller'
import { authorize, protect, requirePermission } from '../middlewares/authMiddleware'

const router = express.Router()

// Public route - Get size chart for a product
router.get('/product/:productId', getProductSizeChart)

// Protected routes
router.use(protect)

// Get all size charts (filtered by role)
router.get('/', getSizeCharts)

// Get single size chart
router.get('/:id', getSizeChart)

// Create size chart (sellers can create product-level, admins can create any)
router.post(
  '/',
  authorize(['seller', 'admin']),
  createSizeChart,
)

// Update size chart
router.put(
  '/:id',
  authorize(['seller', 'admin']),
  updateSizeChart,
)

// Delete size chart
router.delete(
  '/:id',
  authorize(['seller', 'admin']),
  deleteSizeChart,
)

export default router

