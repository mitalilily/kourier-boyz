import { Router } from "express";
import {
  getDashboardSummary,
  getRevenueChart,
  getTopSellers,
  getHighReturnRateSellers,
  getOrderStatusDistribution,
  getPendingActions,
  getTopSettlements,
  getPaymentMethodDistribution,
  getTopCategories,
  getProfitByCategory,
  getReturnReasonBreakdown,
  getSellerHealthScores,
  getCourierChargesSummary,
} from "../controllers/adminDashboard.controller";
import { protect, requirePermission } from "../middlewares/authMiddleware";

const router = Router();

// All routes require authentication
router.use(protect);

// All dashboard routes require view permission for dashboard module
router.get("/summary", requirePermission('dashboard', 'view'), getDashboardSummary);
router.get("/revenue-chart", requirePermission('dashboard', 'view'), getRevenueChart);
router.get("/top-sellers", requirePermission('dashboard', 'view'), getTopSellers);
router.get("/high-return-sellers", requirePermission('dashboard', 'view'), getHighReturnRateSellers);
router.get("/order-status", requirePermission('dashboard', 'view'), getOrderStatusDistribution);
router.get("/pending-actions", requirePermission('dashboard', 'view'), getPendingActions);
router.get("/settlements", requirePermission('dashboard', 'view'), getTopSettlements);
router.get("/payment-methods", requirePermission('dashboard', 'view'), getPaymentMethodDistribution);
router.get("/top-categories", requirePermission('dashboard', 'view'), getTopCategories);
router.get("/profit-by-category", requirePermission('dashboard', 'view'), getProfitByCategory);
router.get("/return-reasons", requirePermission('dashboard', 'view'), getReturnReasonBreakdown);
router.get("/seller-health", requirePermission('dashboard', 'view'), getSellerHealthScores);
router.get("/courier-charges-summary", requirePermission('dashboard', 'view'), getCourierChargesSummary);

export default router;
