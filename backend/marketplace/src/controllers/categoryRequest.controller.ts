import { Request, Response } from "express";
import mongoose from "mongoose";
import Category, { CertificateType } from "../models/Category";
import CategoryRequest from "../models/CategoryRequest";
import { io } from "../server";
import { uploadToR2 } from "../utils/r2Upload";
import { getRequiredCertificatesForCategory } from "../utils/certificateUtils";

// Seller: submit new category request
export const submitCategoryRequest = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { name, description, parent } = req.body as {
      name: string;
      description?: string;
      parent?: string | null;
    };

    if (!userId) return res.status(401).json({ error: "Not authenticated" });
    if (!name || name.trim().length < 2) {
      return res.status(400).json({ error: "Name is required" });
    }

    // Validate parent if provided
    if (parent && parent !== "null" && parent !== "") {
      const CategoryModel = mongoose.model("Category");
      const parentCategory = await CategoryModel.findById(parent);
      if (!parentCategory) {
        return res.status(400).json({ error: "Parent category not found" });
      }
    }

    // If category already exists, short-circuit
    const existingCategory = await Category.findOne({
      name: new RegExp(`^${name}$`, "i"),
    });
    if (existingCategory) {
      return res.status(409).json({ error: "Category already exists" });
    }

    // Optional suggested images upload
    let suggestedMainImage: string | undefined;
    let suggestedHoverImage: string | undefined;
    let suggestedBanners: string[] | undefined;

    if (req.files) {
      const files = req.files as Record<string, Express.Multer.File[]>;
      if (files.suggestedMainImage?.[0]) {
        const f = files.suggestedMainImage[0];
        suggestedMainImage = await uploadToR2(
          f.buffer,
          f.originalname,
          f.mimetype,
          "categories/suggested"
        );
      }
      if (files.suggestedHoverImage?.[0]) {
        const f = files.suggestedHoverImage[0];
        suggestedHoverImage = await uploadToR2(
          f.buffer,
          f.originalname,
          f.mimetype,
          "categories/suggested"
        );
      }
      if (files.suggestedBanners?.length) {
        suggestedBanners = await Promise.all(
          files.suggestedBanners.map((f) =>
            uploadToR2(
              f.buffer,
              f.originalname,
              f.mimetype,
              "categories/suggested"
            )
          )
        );
      }
    }

    const request = await CategoryRequest.create({
      name: name.trim(),
      description,
      requestedBy: userId,
      suggestedMainImage,
      suggestedHoverImage,
      suggestedBanners,
      parent: parent && parent !== "null" && parent !== "" ? parent : null,
    });
    // Notify admins (role room)
    io.to("super-admin").emit("categoryRequest:submitted", {
      id: request._id,
      name: request.name,
    });
    return res.status(201).json(request);
  } catch (err: any) {
    if (err?.code === 11000) {
      return res
        .status(409)
        .json({ error: "You already have a pending request for this name" });
    }
    console.error("Error submitting category request:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

// Seller: list own category requests
export const listMyCategoryRequests = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });
    const requests = await CategoryRequest.find({ requestedBy: userId })
      .populate("parent", "name slug")
      .sort({ createdAt: -1 });
    const decorated = await Promise.all(
      requests.map(async (request) => {
        const obj = request.toObject();
        const parent = obj.parent as { _id?: string } | string | null;
        const parentId =
          parent && typeof parent === "object"
            ? parent._id
            : typeof parent === "string"
            ? parent
            : null;
        let inherited: CertificateType[] = [];
        if (parentId) {
          inherited = (await getRequiredCertificatesForCategory(parentId)) as CertificateType[];
        }
        const own = (obj.requiredCertificates || []) as CertificateType[];
        const overrides = obj.overrideParentCertificateRule ?? false;
        const effective = overrides
          ? own
          : Array.from(new Set<CertificateType>([...inherited, ...own]));

        return {
          ...obj,
          inheritedCertificates: inherited,
          effectiveCertificates: effective,
        };
      })
    );
    res.json(decorated);
  } catch (err) {
    console.error("Error listing my category requests:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// Admin: list category requests with filters
export const listCategoryRequests = async (req: Request, res: Response) => {
  try {
    const { status } = req.query as { status?: string };
    const query: any = {};
    if (status) query.status = status;
    const requests = await CategoryRequest.find(query)
      .populate("requestedBy", "name email")
      .populate("parent", "name slug");
    const decorated = await Promise.all(
      requests.map(async (request) => {
        const obj = request.toObject();
        const parent = obj.parent as { _id?: string } | string | null;
        const parentId =
          parent && typeof parent === "object"
            ? parent._id
            : typeof parent === "string"
            ? parent
            : null;
        let inherited: CertificateType[] = [];
        if (parentId) {
          inherited = (await getRequiredCertificatesForCategory(parentId)) as CertificateType[];
        }
        const own = (obj.requiredCertificates || []) as CertificateType[];
        const overrides = obj.overrideParentCertificateRule ?? false;
        const effective = overrides
          ? own
          : Array.from(new Set<CertificateType>([...inherited, ...own]));

        return {
          ...obj,
          inheritedCertificates: inherited,
          effectiveCertificates: effective,
        };
      })
    );
    res.json(decorated);
  } catch (err) {
    console.error("Error listing category requests:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// Admin: approve request -> optionally create Category stub (without images)
export const approveCategoryRequest = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { adminNote, requiredCertificates, overrideParentCertificateRule } =
      (req.body || {}) as {
        adminNote?: string;
        requiredCertificates?: string[];
        overrideParentCertificateRule?: boolean;
      };

    const request = await CategoryRequest.findById(id);
    if (!request) return res.status(404).json({ error: "Request not found" });
    if (request.status !== "pending")
      return res.status(400).json({ error: "Request not pending" });

    request.status = "approved";
    if (adminNote) request.adminNote = adminNote;
    if (requiredCertificates !== undefined) {
      request.requiredCertificates = requiredCertificates as CertificateType[];
    }
    if (overrideParentCertificateRule !== undefined) {
      request.overrideParentCertificateRule = overrideParentCertificateRule;
    }

    // If no explicit override flag provided, default to inheriting unless child already overrides
    if (
      overrideParentCertificateRule === undefined &&
      (request.overrideParentCertificateRule === null ||
        request.overrideParentCertificateRule === undefined)
    ) {
      request.overrideParentCertificateRule = false;
    }

    // Always compute effective requirements based on parent hierarchy
    const parentId =
      request.parent && typeof request.parent === "object"
        ? request.parent._id || request.parent.id
        : request.parent || null;
    let inheritedCertificates: CertificateType[] = [];
    if (parentId) {
      inheritedCertificates = (await getRequiredCertificatesForCategory(parentId)) as CertificateType[];
    }
    request.inheritedCertificates = inheritedCertificates;

    const ownCertificates = request.requiredCertificates || [];
    const effectiveCertificates = request.overrideParentCertificateRule
      ? ownCertificates
      : Array.from(new Set<CertificateType>([...inheritedCertificates, ...ownCertificates]));
    request.effectiveCertificates = effectiveCertificates;
    request.requiredCertificates = ownCertificates;

    await request.save();

    // Do not auto-create full Category (needs images). Optionally create placeholder inactive category?
    // Keeping simple: just mark approved; admin can create category via normal flow.

    // Notify requester (user room)
    io.to(`user:${request.requestedBy.toString()}`).emit(
      "categoryRequest:update",
      {
        id: request._id,
        status: request.status,
        adminNote: request.adminNote,
      }
    );
    res.json({ message: "Request approved", request });
  } catch (err) {
    console.error("Error approving category request:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// Admin: reject request
export const rejectCategoryRequest = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { adminNote } = (req.body || {}) as { adminNote?: string };

    const request = await CategoryRequest.findById(id);
    if (!request) return res.status(404).json({ error: "Request not found" });
    if (request.status !== "pending")
      return res.status(400).json({ error: "Request not pending" });

    request.status = "rejected";
    if (adminNote) request.adminNote = adminNote;
    await request.save();

    // Notify requester (user room)
    io.to(`user:${request.requestedBy.toString()}`).emit(
      "categoryRequest:update",
      {
        id: request._id,
        status: request.status,
        adminNote: request.adminNote,
      }
    );
    res.json({ message: "Request rejected", request });
  } catch (err) {
    console.error("Error rejecting category request:", err);
    res.status(500).json({ error: "Server error" });
  }
};
