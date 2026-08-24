import express from "express";
import {
  shouldAskFeedback,
  submitFeedback,
  dismissFeedback,
  getUserFeedback,
  optInFeedback,
  getAllFeedback,
  markFeedbackRead,
} from "../controllers/feedbackController";
import { protect, requirePermission } from "../middlewares/authMiddleware";

const router = express.Router();

// All routes require authentication
router.use(protect);

// Customer routes
router.get("/should-ask", shouldAskFeedback);
router.post("/", submitFeedback);
router.post("/dismiss", dismissFeedback);
router.get("/my-feedback", getUserFeedback);
router.post("/opt-in", optInFeedback);

// Admin routes - require permission for feedback module
router.get("/admin/all", requirePermission("feedback", "view"), getAllFeedback);
router.patch("/admin/:id/read", requirePermission("feedback", "update"), markFeedbackRead);

export default router;
