import express from 'express'
import {
  addToWishlist,
  bulkRemoveFromWishlist,
  checkWishlistStatus,
  generateShareToken,
  getSharedWishlist,
  getWishlist,
  moveAllToCart,
  removeFromWishlist,
  updateWishlistItemNote,
  updateWishlistVisibility,
} from '../controllers/wishlistController'
import { protect } from '../middlewares/authMiddleware'

const router = express.Router()

// Public route for shared wishlist
router.get('/shared/:token', getSharedWishlist)

// All other routes require authentication
router.use(protect)

// Get user's wishlist
router.get('/', getWishlist)

// Add product to wishlist
router.post('/', addToWishlist)

// Remove product from wishlist
router.delete('/:productId', removeFromWishlist)

// Bulk remove products from wishlist
router.delete('/bulk/remove', bulkRemoveFromWishlist)

// Update wishlist item note
router.patch('/item/:productId/note', updateWishlistItemNote)

// Move all items to cart
router.post('/move-to-cart', moveAllToCart)

// Check if product is in wishlist
router.get('/check/:productId', checkWishlistStatus)

// Update wishlist visibility
router.patch('/visibility', updateWishlistVisibility)

// Generate share token
router.post('/share/generate', generateShareToken)

export default router

