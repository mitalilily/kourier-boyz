import express from "express";
import {
  addToCart,
  clearCart,
  getCart,
  getGuestCart,
  removeCartItem,
  saveForLater,
  toggleAllSelection,
  toggleItemSelection,
  updateCartItem,
} from "../controllers/cartController";
import { authorize, optionalAuth, protect } from "../middlewares/authMiddleware";

const router = express.Router();

// Guest cart endpoint (no auth required)
router.post("/guest", optionalAuth, getGuestCart);

// Protected routes (require authentication)
router.use(protect);
router.use(authorize(["customer"]));

router.get("/", getCart);
router.post("/", addToCart);
router.put("/item", updateCartItem);
router.delete("/item", removeCartItem);
router.delete("/", clearCart);
router.post("/save-for-later", saveForLater);
router.patch("/item/selection", toggleItemSelection);
router.patch("/selection/all", toggleAllSelection);

export default router;
