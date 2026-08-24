import express from 'express'
import {
  getSellerBySlug,
  getSellerCategoriesBySlug,
  getSellerProductsBySlug,
} from '../controllers/publicSeller.controller'

const router = express.Router()

// Public routes - no authentication required
// More specific route first
router.get('/:slug/categories', getSellerCategoriesBySlug)
router.get('/:slug/products', getSellerProductsBySlug)
router.get('/:slug', getSellerBySlug)

export default router

