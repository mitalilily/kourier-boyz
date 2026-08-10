import express from 'express'
import {
  adjustProductStock,
  bulkAdjustStock,
  bulkDeleteProducts,
  bulkUpdateProductStatus,
  createProduct,
  createProductVariant,
  deleteProduct,
  deleteProductVariant,
  deleteSellerCustomAttribute,
  duplicateProduct,
  exportProductsCSV,
  generateSku,
  getInventoryAnalytics,
  getInventoryLogs,
  getLowStockProducts,
  getProduct,
  getProductBySku,
  getProductServiceability,
  getProductsForOrderItems,
  getProductVariants,
  getProductMediaPresign,
  getSellerCustomAttributes,
  getSellerDashboardStats,
  getSellerProducts,
  importProductsCSV,
  deleteProductMedia,
  markLatestObjectionAddressed,
  setProductStock,
  updateLowStockThreshold,
  updateProduct,
  updateProductVariant,
  upsertSellerCustomAttribute,
} from '../controllers/product.controller'
import { authorize, protect } from '../middlewares/authMiddleware'
import { upload, uploadProductFiles } from '../middlewares/upload.middleware'

const router = express.Router()

// All routes require authentication and seller role
router.use(protect)
router.use(authorize(['seller']))

// Stats
router.get('/stats', getSellerDashboardStats)

// Bulk operations (must be before /:id routes)
router.post('/bulk/delete', bulkDeleteProducts)
router.post('/bulk/status', bulkUpdateProductStatus)

// Seller Custom Attributes (must be before /:id)
router.get('/attributes', getSellerCustomAttributes)
router.post('/attributes', upsertSellerCustomAttribute)
router.delete('/attributes/:key', deleteSellerCustomAttribute)

// Media uploads (presigned)
router.post('/media/presign', getProductMediaPresign)
router.post('/media/delete', deleteProductMedia)

// Product CRUD
router.get('/', getSellerProducts)
router.get('/by-sku', getProductBySku)
router.get('/by-order-items/:orderId', getProductsForOrderItems)
router.post('/generate-sku', generateSku)

// Advanced inventory operations (must be before /:id routes to avoid route conflicts)
router.post('/bulk/adjust-stock', bulkAdjustStock)
router.get('/low-stock', getLowStockProducts)
router.get('/analytics', getInventoryAnalytics)

// Product CRUD with :id (must be after specific routes like /low-stock)
// Serviceability route must come before /:id to avoid route conflicts
router.get('/:id/serviceability', getProductServiceability)
router.get('/:id', getProduct)
// Use uploadProductFiles to support both images and videos, and dynamic variant field names like variantMainImage_0, variantImages_0
router.post('/', uploadProductFiles, createProduct)
router.put('/:id', uploadProductFiles, updateProduct)
router.delete('/:id', deleteProduct)
router.post('/:id/duplicate', duplicateProduct)

// Inventory management
router.post('/:id/inventory/adjust', adjustProductStock)
router.post('/:id/inventory/set', setProductStock)
router.post('/:id/inventory/threshold', updateLowStockThreshold)
router.get('/:id/inventory/logs', getInventoryLogs)

// Notices
router.patch('/:id/objections/address', markLatestObjectionAddressed)

// Variant management
router.get('/:productId/variants', getProductVariants)
router.post(
  '/:productId/variants',
  upload.fields([
    { name: 'mainImage', maxCount: 1 },
    { name: 'images', maxCount: 10 },
  ]),
  createProductVariant,
)
router.put(
  '/variants/:variantId',
  upload.fields([
    { name: 'mainImage', maxCount: 1 },
    { name: 'images', maxCount: 10 },
  ]),
  updateProductVariant,
)
router.delete('/variants/:variantId', deleteProductVariant)

// CSV Import/Export
router.get('/export/csv', exportProductsCSV)
router.post('/import/csv', upload.single('file'), importProductsCSV)

export default router
