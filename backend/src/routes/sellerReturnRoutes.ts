import { Router } from 'express'
import {
  sellerApproveReturn,
  sellerConfirmReturnApproval,
  sellerGetReturnQuote,
  sellerRejectReturn,
  listSellerReturns,
} from '../controllers/return.controller'
import { authorize, protect } from '../middlewares/authMiddleware'

const router = Router()

// Seller-facing return routes
router.get('/returns', protect, authorize(['seller']), listSellerReturns)
router.get('/returns/:id/quote', protect, authorize(['seller']), sellerGetReturnQuote)
router.put('/returns/:id/approve', protect, authorize(['seller']), sellerApproveReturn)
router.post(
  '/returns/:id/confirm-approve',
  protect,
  authorize(['seller']),
  sellerConfirmReturnApproval,
)
router.put('/returns/:id/reject', protect, authorize(['seller']), sellerRejectReturn)

export default router
