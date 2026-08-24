import { Router } from "express";
import {
  approveCategoryRequest,
  listCategoryRequests,
  listMyCategoryRequests,
  rejectCategoryRequest,
  submitCategoryRequest,
} from "../controllers/categoryRequest.controller";
import {
  authorize,
  protect,
  requirePermission,
} from "../middlewares/authMiddleware";
import { upload } from "../middlewares/upload.middleware";

const router = Router();

// Seller submits a request (optional suggested images)
router.post(
  "/",
  protect,
  authorize(["seller"]),
  upload.fields([
    { name: "suggestedMainImage", maxCount: 1 },
    { name: "suggestedHoverImage", maxCount: 1 },
    { name: "suggestedBanners", maxCount: 10 },
  ]),
  submitCategoryRequest
);
router.get("/mine", protect, authorize(["seller"]), listMyCategoryRequests);

// Admin manages requests - permission-based access
router.get(
  "/",
  protect,
  requirePermission("requests", "view"),
  listCategoryRequests
);
router.post(
  "/:id/approve",
  protect,
  requirePermission("requests", "approve"),
  approveCategoryRequest
);
router.post(
  "/:id/reject",
  protect,
  requirePermission("requests", "reject"),
  rejectCategoryRequest
);

export default router;
