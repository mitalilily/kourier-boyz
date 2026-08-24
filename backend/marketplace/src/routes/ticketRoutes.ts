import express from "express";
import { protect, requirePermission } from "../middlewares/authMiddleware";
import { uploadTicketAttachments } from "../middlewares/upload.middleware";
import {
  assignTicket,
  createTicket,
  createTicketAsAdmin,
  createSellerTicket,
  getAllTickets,
  getMyTickets,
  getTicket,
  markMessagesAsRead,
  rateTicket,
  sendMessage,
  sendSystemMessage,
  updateTicketPriority,
  updateTicketStatus,
  uploadTicketAttachments as uploadTicketAttachmentsHandler,
} from "../controllers/ticket.controller";

const router = express.Router();

// Customer routes (require authentication)
router.post("/", protect, createTicket);
router.get("/my", protect, getMyTickets);
router.get("/my/:id", protect, getTicket);
router.post("/my/:id/message", protect, sendMessage);
router.post("/my/:id/read", protect, markMessagesAsRead);
router.post("/my/:id/rate", protect, rateTicket);
router.put("/my/:id/status", protect, updateTicketStatus); // Allow customers to close their own tickets

// Seller routes (require authentication)
router.post("/seller", protect, createSellerTicket);

// Upload attachments (for seller and customer tickets)
router.post(
  "/upload-attachments",
  protect,
  uploadTicketAttachments,
  uploadTicketAttachmentsHandler
);

// Admin routes - permission-based access
router.post(
  "/admin",
  protect,
  requirePermission("supportTickets", "create"),
  createTicketAsAdmin
);
router.get(
  "/all",
  protect,
  requirePermission("supportTickets", "view"),
  getAllTickets
);
router.get("/:id", protect, requirePermission("supportTickets", "view"), getTicket);
router.post(
  "/:id/assign",
  protect,
  requirePermission("supportTickets", "update"),
  assignTicket
);
router.put(
  "/:id/status",
  protect,
  requirePermission("supportTickets", "update"),
  updateTicketStatus
);
router.put(
  "/:id/priority",
  protect,
  requirePermission("supportTickets", "update"),
  updateTicketPriority
);
router.post(
  "/:id/message",
  protect,
  requirePermission("supportTickets", "update"),
  sendMessage
);
router.post(
  "/:id/system-message",
  protect,
  requirePermission("supportTickets", "update"),
  sendSystemMessage
);
router.post(
  "/:id/read",
  protect,
  requirePermission("supportTickets", "update"),
  markMessagesAsRead
);

export default router;

