import { Router } from 'express'
import { getSellerTcsReport, getSellerTdsReport } from '../controllers/adminReport.controller'
import {
  getSellerCreditNotes,
  getSellerLedgerForSeller,
  getSellerSettlementBatchDetail,
  getSellerSettlementInvoice,
  getSettlementReport,
  listSellerSettlementBatches,
} from '../controllers/settlement.controller'
import { authorize, protect, requireFullSellerSetup } from '../middlewares/authMiddleware'

const router = Router()

router.use(protect, authorize(['seller']))
router.use(requireFullSellerSetup)

router.get('/batches', listSellerSettlementBatches)
router.get('/batches/:id', getSellerSettlementBatchDetail)
router.get('/batches/:id/invoice', getSellerSettlementInvoice)
router.get('/ledger', getSellerLedgerForSeller)
router.get('/credit-notes', getSellerCreditNotes)
router.get('/reports/settlement', getSettlementReport)
router.get('/reports/tds', getSellerTdsReport)
router.get('/reports/tcs', getSellerTcsReport)

export default router
