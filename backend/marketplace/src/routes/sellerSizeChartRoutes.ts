import express from "express";
import {
  createSizeChart,
  deleteSizeChart,
  getProductsWithSizeCharts,
  getSizeChart,
  getSizeCharts,
  updateSizeChart,
} from "../controllers/sizeChart.controller";
import { authorize, protect } from "../middlewares/authMiddleware";
import { upload } from "../middlewares/upload.middleware";

const router = express.Router();

// All routes require authentication and seller role
router.use(protect);
router.use(authorize(["seller"]));

// Get products with their size charts (optimized endpoint)
router.get("/products-with-charts", getProductsWithSizeCharts);

// Get all size charts for seller's products
router.get("/", getSizeCharts);

// Get single size chart
router.get("/:id", getSizeChart);

// Create size chart (product-level only for sellers) - with file upload support
router.post("/", upload.single("image"), createSizeChart);

// Update size chart - with file upload support
router.put("/:id", upload.single("image"), updateSizeChart);

// Delete size chart
router.delete("/:id", deleteSizeChart);

export default router;
