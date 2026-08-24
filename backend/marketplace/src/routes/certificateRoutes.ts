import express from "express";
import {
  approveCertificate,
  deleteCertificate,
  getCertificate,
  getCertificateTypes as getCertificateTypesController,
  listAllCertificates,
  listMyCertificates,
  rejectCertificate,
  uploadCertificate,
} from "../controllers/certificate.controller";
import { authorize, protect, requirePermission } from "../middlewares/authMiddleware";
import multer from "multer";

// Create upload middleware for certificate documents (PDFs and images)
const storage = multer.memoryStorage();
const certificateFileFilter = (
  _req: any,
  file: Express.Multer.File,
  cb: any
) => {
  const allowedMimes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/avif",
    "application/pdf",
  ];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Invalid file type. Only JPEG, PNG, GIF, WebP, AVIF, and PDF are allowed."
      ),
      false
    );
  }
};

const uploadCertificateDocument = multer({
  storage,
  fileFilter: certificateFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
}).fields([{ name: "document", maxCount: 1 }]);

const router = express.Router();

// Public route for certificate types (also exported for use in server.ts)
export const getCertificateTypes = getCertificateTypesController;
router.get("/types", getCertificateTypes);

// Seller routes
router.use(protect);
router.use(authorize(["seller"]));

router.get("/", listMyCertificates);
router.get("/:id", getCertificate);
router.post("/", uploadCertificateDocument, uploadCertificate);
router.delete("/:id", deleteCertificate);

// Admin routes - permission-based access
const adminRouter = express.Router();
adminRouter.use(protect);

adminRouter.get("/", requirePermission("certificates", "view"), listAllCertificates);
adminRouter.post("/:id/approve", requirePermission("certificates", "approve"), approveCertificate);
adminRouter.post("/:id/reject", requirePermission("certificates", "reject"), rejectCertificate);

export { adminRouter as adminCertificateRoutes };
export default router;
