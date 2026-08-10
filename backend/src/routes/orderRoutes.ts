import { Router } from "express";
import {
  cancelOrder,
  createOrder,
  downloadInvoice,
  downloadLabel,
  getOrder,
  getUserOrders,
  getBirthdayRecap,
} from "../controllers/order.controller";
import { authorize, protect } from "../middlewares/authMiddleware";

const router = Router();

// All routes require authentication and customer role
router.use(protect, authorize(["customer"]));

router.post("/", createOrder);
router.get("/", getUserOrders);
router.get("/birthday-recap", getBirthdayRecap);
router.get("/:id", getOrder);
router.post("/:id/cancel", cancelOrder);
router.get("/:id/invoice", downloadInvoice);
router.get("/:id/label", downloadLabel);

export default router;
