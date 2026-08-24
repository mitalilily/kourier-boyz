import { Router } from "express";
import {
  bulkUpdateSellerOrderStatus,
  cancelSellerOrder,
  createSellerShipment,
  downloadSellerInvoice,
  downloadSellerLabel,
  getSellerBatchDetail,
  getSellerBatchShipments,
  getSellerOrderDetail,
  getSellerOrders,
  getSellerShipmentLabel,
  getSellerShipmentRates,
  requestPickup,
  searchMyOrders,
  trackSellerShipment,
  updateSellerOrderStatus,
} from "../controllers/sellerOrder.controller";
import {
  authorize,
  protect,
  requireFullSellerSetup,
} from "../middlewares/authMiddleware";

const router = Router();

router.use(protect, authorize(["seller"]));
router.use(requireFullSellerSetup);

router.get("/", getSellerOrders);
router.get("/search", searchMyOrders);
router.get("/batch/:batchId", getSellerBatchDetail);
router.get("/batch/:batchId/shipments", getSellerBatchShipments);
router.get("/:id", getSellerOrderDetail);
router.patch("/:id/status", updateSellerOrderStatus);
router.patch("/status/bulk", bulkUpdateSellerOrderStatus);
router.post("/:id/cancel", cancelSellerOrder);
router.post("/:id/ship/rates", getSellerShipmentRates);
router.post("/:id/ship", createSellerShipment);
router.post("/:id/request-pickup", requestPickup);
router.get("/:id/invoice", downloadSellerInvoice);
router.get("/:id/label", downloadSellerLabel);
router.get("/:id/shipments/:shipmentId/label", getSellerShipmentLabel);
router.get("/:id/shipments/:shipmentId/track", trackSellerShipment);

export default router;
