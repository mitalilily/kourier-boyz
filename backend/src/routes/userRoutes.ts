import express from "express";
import {
  adminDeactivateBuyer,
  adminReactivateBuyer,
  hardDeleteBuyer,
} from "../controllers/buyerDeactivationController";
import {
  assignRolesToUser,
  createUser,
  deleteUser,
  getAllCustomers,
  getAllSellers,
  getAllUsers,
  getCurrentUserPermissions,
  getUserById,
  getUserRoles,
  getUsersWithModulePermission,
  resetUserPasswordByAdmin,
  updateAdminUserStatus,
  updateCustomerStatus,
  updateSellerApproval,
  updateUser,
} from "../controllers/userController";
import {
  authorize,
  protect,
  requirePermission,
  requirePermissionByQueryRole,
  requirePermissionByUserId,
} from "../middlewares/authMiddleware";

const router = express.Router();

// All routes require authentication
router.use(protect);

// Get current user permissions (accessible to all authenticated admin users - must be before super-admin check)
router.get(
  "/me/permissions",
  authorize(["super-admin", "user"]),
  getCurrentUserPermissions
);

// Get users with specific module permission
router.get(
  "/with-permission",
  requirePermission("userManagement", "view"),
  getUsersWithModulePermission
);

// User management routes - permission-based access
// Super-admin has access to all, others need appropriate permissions
// Check role query parameter to determine which permission to check
router.get("/", requirePermissionByQueryRole("view"), getAllUsers);
router.get(
  "/sellers",
  requirePermission("sellerManagement", "view"),
  getAllSellers
);
router.get(
  "/customers",
  requirePermission("customerManagement", "view"),
  getAllCustomers
);
// Get user by ID - check permission based on user's role
router.get("/:id", requirePermissionByUserId("view"), getUserById);
router.post("/", requirePermission("userManagement", "create"), createUser);
router.put("/:id", requirePermission("userManagement", "update"), updateUser);
router.delete(
  "/:id",
  requirePermission("userManagement", "delete"),
  deleteUser
);
router.post(
  "/:id/reset-password",
  requirePermissionByUserId("update"),
  resetUserPasswordByAdmin
);

// Seller approval
router.patch(
  "/:id/approve",
  requirePermission("sellerManagement", "approve"),
  updateSellerApproval
);

// Customer management
router.patch(
  "/customers/:id/block",
  requirePermission("customerManagement", "update"),
  updateCustomerStatus
);

// Buyer deactivation management (admin only)
router.post(
  "/buyers/:id/deactivate",
  requirePermission("customerManagement", "update"),
  adminDeactivateBuyer
);
router.post(
  "/buyers/:id/reactivate",
  requirePermission("customerManagement", "update"),
  adminReactivateBuyer
);
router.delete(
  "/buyers/:id",
  requirePermission("customerManagement", "delete"),
  hardDeleteBuyer
);

// Admin user management - block/unblock (super-admin only, requires block permission)
router.patch(
  "/:id/block",
  requirePermission("userManagement", "block"),
  updateAdminUserStatus
);

// Role management
router.get(
  "/:id/roles",
  requirePermission("roleManagement", "view"),
  getUserRoles
);
router.post(
  "/:id/roles",
  requirePermission("userManagement", "assign"),
  assignRolesToUser
);

export default router;
