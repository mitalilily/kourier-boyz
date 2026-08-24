import express from 'express'
import {
  createBrand,
  getApprovedBrands,
  getBrand,
  getSellerBrands,
  uploadBrandDocument,
} from '../controllers/brand.controller'
import { authorize, protect } from '../middlewares/authMiddleware'
import { upload, uploadBrandDocuments } from '../middlewares/upload.middleware'

const router = express.Router()

// All routes require authentication and seller role
router.use(protect)
router.use(authorize(['seller']))

// Get all brands for seller
router.get('/', getSellerBrands)

// Get approved brands (for product creation dropdown)
router.get('/approved', getApprovedBrands)

// Get single brand
router.get('/:id', getBrand)

// Create brand request (supports both JSON with file URLs and FormData with files)
router.post('/', uploadBrandDocuments, createBrand)

// Upload brand document
router.post('/:id/documents', uploadBrandDocuments, uploadBrandDocument)

export default router

