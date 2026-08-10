import { Request, Response } from "express";
import mongoose from "mongoose";
import Certificate from "../models/Certificate";
import { uploadToR2, deleteFromR2 } from "../utils/r2Upload";
import { CertificateType } from "../models/Certificate";
import { io } from "../server";
import { updateProductsForExpiredCertificate, updateProductsForApprovedCertificate } from "../utils/certificateExpiry";

const emitSellerCertificateEvent = (
  sellerId: mongoose.Types.ObjectId | string,
  event: "certificate:update" | "certificate:reminder",
  payload: Record<string, unknown>
) => {
  if (!sellerId) return;
  io.to(`user:${sellerId.toString()}`).emit(event, {
    ...payload,
    triggeredAt: new Date().toISOString(),
  });
};

const notifyAdminsOfPendingCertificate = (payload: Record<string, unknown>) => {
  io.to("super-admin").emit("certificate:pending", {
    ...payload,
    triggeredAt: new Date().toISOString(),
  });
};

const serializeCertificate = (certificate: any) => ({
  certificateId: certificate._id?.toString(),
  certificateType: certificate.certificateType,
  status: certificate.status,
  expiryDate: certificate.expiryDate,
  certificateNumber: certificate.certificateNumber,
  verifiedOn: certificate.verifiedOn,
  certificateVerifiedBy: certificate.certificateVerifiedBy,
  rejectionReason: certificate.rejectionReason,
  updatedAt: certificate.updatedAt,
});

// Seller: Upload a certificate
export const uploadCertificate = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user?.userId;
    if (!sellerId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { certificateType, certificateNumber, expiryDate } = req.body;

    if (!certificateType) {
      return res.status(400).json({ error: "Certificate type is required" });
    }

    // Validate certificate type
    const validTypes: CertificateType[] = [
      "FSSAI_LICENSE",
      "DRUG_LICENSE",
      "AYUSH_APPROVAL",
      "FDA_CDSCO_APPROVAL",
      "BIS_CERTIFICATE",
      "WPC_ETA_APPROVAL",
      "BIS_HALLMARK",
      "ARAI_APPROVAL",
      "CDSCO_REGISTRATION",
      "MSDS",
      "FCO_SEED_LICENSE",
      "STATE_EXCISE_LICENSE",
    ];

    if (!validTypes.includes(certificateType as CertificateType)) {
      return res.status(400).json({ error: "Invalid certificate type" });
    }

    // Handle file upload
    let documentUrl = "";
    if (
      req.files &&
      (req.files as any).document &&
      (req.files as any).document[0]
    ) {
      const file = (req.files as any).document[0];
      documentUrl = await uploadToR2(
        file.buffer,
        `${sellerId}/${Date.now()}-${file.originalname}`,
        file.mimetype,
        "certificates"
      );
    } else {
      return res
        .status(400)
        .json({ error: "Certificate document is required" });
    }

    // Parse expiry date if provided
    // If expiryDate is provided and not empty, parse it
    // If expiryDate is empty string, null, or undefined, treat it as "no expiry date" (undefined)
    let parsedExpiryDate: Date | undefined = undefined;
    if (expiryDate && expiryDate !== '' && expiryDate !== null) {
      parsedExpiryDate = new Date(expiryDate);
      if (isNaN(parsedExpiryDate.getTime())) {
        return res.status(400).json({ error: "Invalid expiry date format" });
      }
    }
    // If expiryDate is undefined, null, or empty string, parsedExpiryDate remains undefined (no expiry date)

    // Check if seller already has a pending or approved certificate of this type
    const existingCertificate = await Certificate.findOne({
      seller: sellerId,
      certificateType,
    })
      .sort({ createdAt: -1 })
      .exec();

    if (existingCertificate) {
      // Delete old document if it exists
      if (existingCertificate.documentUrl) {
        await deleteFromR2(existingCertificate.documentUrl).catch((err) =>
          console.error("Error deleting old certificate:", err)
        );
      }
      // Update existing certificate
      existingCertificate.documentUrl = documentUrl;
      existingCertificate.certificateNumber =
        certificateNumber || existingCertificate.certificateNumber;
      // Always set expiryDate to parsedExpiryDate (which is undefined if not provided, clearing the old expiry date)
      existingCertificate.expiryDate = parsedExpiryDate;
      existingCertificate.status = "pending";
      existingCertificate.rejectionReason = undefined;
      existingCertificate.expiryReminderHistory = [];
      existingCertificate.certificateVerifiedBy = undefined;
      existingCertificate.verifiedOn = undefined;
      await existingCertificate.save();
      
      // Note: Expiry check will happen automatically via pre-save hook when status changes to "approved"
      // Newly uploaded/re-uploaded certificates should always be "pending" for admin review

      const payload = serializeCertificate(existingCertificate);
      emitSellerCertificateEvent(
        existingCertificate.seller,
        "certificate:update",
        {
          ...payload,
          message: "Certificate re-uploaded and sent for admin review",
        }
      );
      notifyAdminsOfPendingCertificate({
        ...payload,
        sellerId: existingCertificate.seller.toString(),
      });
      return res.json(existingCertificate);
    }

    // Create new certificate - always start with "pending" status
    // Expiry check will happen automatically via pre-save hook when status changes to "approved"
    const certificate = await Certificate.create({
      seller: sellerId,
      certificateType,
      certificateNumber,
      documentUrl,
      expiryDate: parsedExpiryDate,
      status: "pending",
      expiryReminderHistory: [],
    });

    const payload = serializeCertificate(certificate);
    emitSellerCertificateEvent(certificate.seller, "certificate:update", {
      ...payload,
      message: "Certificate uploaded and pending admin review",
    });
    notifyAdminsOfPendingCertificate({
      ...payload,
      sellerId,
    });

    res.status(201).json(certificate);
  } catch (err) {
    console.error("Error uploading certificate:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// Seller: List own certificates
export const listMyCertificates = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user?.userId;
    if (!sellerId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { status, certificateType } = req.query;

    const query: any = { seller: sellerId };
    if (status) query.status = status;
    if (certificateType) query.certificateType = certificateType;

    const certificates = await Certificate.find(query)
      .populate("certificateVerifiedBy", "name email")
      .sort({ createdAt: -1 });

    res.json(certificates);
  } catch (err) {
    console.error("Error listing certificates:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// Seller: Get single certificate
export const getCertificate = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user?.userId;
    const { id } = req.params;

    if (!sellerId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const certificate = await Certificate.findOne({
      _id: id,
      seller: sellerId,
    }).populate("certificateVerifiedBy", "name email");

    if (!certificate) {
      return res.status(404).json({ error: "Certificate not found" });
    }

    res.json(certificate);
  } catch (err) {
    console.error("Error fetching certificate:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// Seller: Delete certificate
export const deleteCertificate = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user?.userId;
    const { id } = req.params;

    if (!sellerId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const certificate = await Certificate.findOne({
      _id: id,
      seller: sellerId,
    });
    if (!certificate) {
      return res.status(404).json({ error: "Certificate not found" });
    }

    // Delete document from R2
    if (certificate.documentUrl) {
      await deleteFromR2(certificate.documentUrl).catch((err) =>
        console.error("Error deleting certificate document:", err)
      );
    }

    await Certificate.findByIdAndDelete(id);
    emitSellerCertificateEvent(certificate.seller, "certificate:update", {
      certificateId: certificate._id?.toString(),
      certificateType: certificate.certificateType,
      status: "deleted",
      message: "Certificate deleted successfully",
    });
    res.json({ message: "Certificate deleted successfully" });
  } catch (err) {
    console.error("Error deleting certificate:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// Admin: List all certificates (with filters)
export const listAllCertificates = async (req: Request, res: Response) => {
  try {
    const {
      status,
      certificateType,
      sellerId,
      page = 1,
      limit = 20,
    } = req.query;

    const query: any = {};
    if (status) query.status = status;
    if (certificateType) query.certificateType = certificateType;
    if (sellerId) query.seller = sellerId;

    const skip = (Number(page) - 1) * Number(limit);

    const [certificates, total] = await Promise.all([
      Certificate.find(query)
        .populate("seller", "name email businessName")
        .populate("certificateVerifiedBy", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Certificate.countDocuments(query),
    ]);

    res.json({
      certificates,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (err) {
    console.error("Error listing certificates:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// Admin: Approve certificate
export const approveCertificate = async (req: Request, res: Response) => {
  try {
    const adminId = req.user?.userId;
    const { id } = req.params;

    if (!adminId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const certificate = await Certificate.findById(id);
    if (!certificate) {
      return res.status(404).json({ error: "Certificate not found" });
    }

    certificate.status = "approved";
    certificate.certificateVerifiedBy = new mongoose.Types.ObjectId(adminId);
    certificate.verifiedOn = new Date();
    certificate.rejectionReason = undefined;

    await certificate.save();

    // Reload certificate to get actual status after pre-save hook (which may have changed it to "expired")
    const savedCertificate = await Certificate.findById(id);
    if (!savedCertificate) {
      return res.status(404).json({ error: "Certificate not found after save" });
    }

    // Check if certificate became expired due to pre-save hook (if expiryDate < now)
    // If it did, update products to pending_approval
    // CRITICAL: updateProductsForExpiredCertificate is seller-specific - only affects this seller's products
    if (savedCertificate.status === "expired") {
      const updatedProductCount = await updateProductsForExpiredCertificate(
        savedCertificate.seller, // CRITICAL: Seller-specific - only this seller's products are affected
        savedCertificate.certificateType
      );
      if (updatedProductCount > 0) {
        console.log(
          `Updated ${updatedProductCount} product(s) to pending_approval due to expired certificate ${savedCertificate.certificateType} for seller ${savedCertificate.seller}`
        );
      }
    } else if (savedCertificate.status === "approved") {
      // Certificate was successfully approved (not expired)
      // Update products in categories requiring this certificate from pending_approval to active
      // Only if seller now has all required certificates for those categories
      const updatedProductCount = await updateProductsForApprovedCertificate(
        savedCertificate.seller, // CRITICAL: Seller-specific - only this seller's products are affected
        savedCertificate.certificateType
      );
      if (updatedProductCount > 0) {
        console.log(
          `Updated ${updatedProductCount} product(s) to active status after certificate ${savedCertificate.certificateType} approval for seller ${savedCertificate.seller}`
        );
      }
    }

    const payload = serializeCertificate(savedCertificate);
    emitSellerCertificateEvent(savedCertificate.seller, "certificate:update", {
      ...payload,
      message: savedCertificate.status === "expired" 
        ? "Certificate approved but already expired - products require approval"
        : "Certificate approved by admin - products have been automatically approved",
    });

    res.json(savedCertificate);
  } catch (err) {
    console.error("Error approving certificate:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// Admin: Reject certificate
export const rejectCertificate = async (req: Request, res: Response) => {
  try {
    const adminId = req.user?.userId;
    const { id } = req.params;
    const { rejectionReason } = req.body;

    if (!adminId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const certificate = await Certificate.findById(id);
    if (!certificate) {
      return res.status(404).json({ error: "Certificate not found" });
    }

    certificate.status = "rejected";
    certificate.certificateVerifiedBy = new mongoose.Types.ObjectId(adminId);
    certificate.verifiedOn = new Date();
    certificate.rejectionReason =
      rejectionReason || "Certificate rejected by admin";

    await certificate.save();

    const payload = serializeCertificate(certificate);
    emitSellerCertificateEvent(certificate.seller, "certificate:update", {
      ...payload,
      message:
        rejectionReason ||
        "Certificate rejected by admin. Please review and upload again.",
    });

    res.json(certificate);
  } catch (err) {
    console.error("Error rejecting certificate:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// Get certificate types (for dropdowns)
export const getCertificateTypes = async (req: Request, res: Response) => {
  const certificateTypes = [
    { value: "FSSAI_LICENSE", label: "FSSAI License" },
    { value: "DRUG_LICENSE", label: "Drug License (Form 20B/21B)" },
    { value: "AYUSH_APPROVAL", label: "AYUSH Approval" },
    { value: "FDA_CDSCO_APPROVAL", label: "FDA / CDSCO Approval" },
    { value: "BIS_CERTIFICATE", label: "BIS Certificate" },
    { value: "WPC_ETA_APPROVAL", label: "WPC / ETA Approval" },
    { value: "BIS_HALLMARK", label: "BIS Hallmark" },
    { value: "ARAI_APPROVAL", label: "ARAI Approval" },
    { value: "CDSCO_REGISTRATION", label: "CDSCO Registration" },
    { value: "MSDS", label: "MSDS (Material Safety Data Sheet)" },
    {
      value: "FCO_SEED_LICENSE",
      label: "FCO / Seed License / CIBRC Registration",
    },
    { value: "STATE_EXCISE_LICENSE", label: "State Excise License" },
  ];

  res.json(certificateTypes);
};
