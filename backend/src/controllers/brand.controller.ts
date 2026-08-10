import { Request, Response } from 'express'
import mongoose from 'mongoose'
import Brand from '../models/Brand'
import BrandCategoryScope from '../models/BrandCategoryScope'
import BrandDocument, { type DocumentType } from '../models/BrandDocument'
import Category from '../models/Category'
import Product from '../models/Product'
import User from '../models/User'
import { io } from '../server'
import { emailTemplates, sendEmail } from '../utils/email'
import { uploadToR2 } from '../utils/r2Upload'

// Helper to check if seller KYC is approved
const isKycApproved = (seller: any): boolean => {
  return (
    seller.kycStatus === 'APPROVED' || (seller.isApproved === true && seller.kycSubmitted === true)
  )
}

// Get all brands for a seller
export const getSellerBrands = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user?.userId

    if (!sellerId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    // Check seller KYC status
    const seller = await User.findById(sellerId)
    if (!seller) {
      return res.status(404).json({ error: 'Seller not found' })
    }

    if (!isKycApproved(seller)) {
      return res.status(403).json({
        error: 'KYC must be approved before accessing brand management',
        kycStatus: seller.kycStatus || (seller.isApproved ? 'APPROVED' : 'PENDING'),
      })
    }

    const brands = await Brand.find({ seller_id: sellerId })
      .populate('reviewed_by', 'name email')
      .sort({ created_at: -1 })
      .lean()

    // Approved category count per brand (seller-scoped)
    const scopeCounts = await BrandCategoryScope.aggregate([
      { $match: { seller_id: new mongoose.Types.ObjectId(sellerId), status: 'APPROVED' } },
      { $group: { _id: '$brand_id', count: { $sum: 1 } } },
    ])
    const countByBrandId = new Map(scopeCounts.map((r: any) => [r._id.toString(), r.count]))

    // Get documents for each brand
    const brandsWithDocuments = await Promise.all(
      brands.map(async (brand: any) => {
        const documents = await BrandDocument.find({ brand_id: brand._id }).lean()
        return {
          ...brand,
          documents,
          approved_category_count: countByBrandId.get(brand._id.toString()) ?? 0,
        }
      }),
    )

    res.json(brandsWithDocuments)
  } catch (error) {
    console.error('Error fetching seller brands:', error)
    res.status(500).json({ error: 'Server error' })
  }
}

// Get single brand by ID
export const getBrand = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user?.userId
    const { id } = req.params

    if (!sellerId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    // Check seller KYC status
    const seller = await User.findById(sellerId)
    if (!seller) {
      return res.status(404).json({ error: 'Seller not found' })
    }

    if (!isKycApproved(seller)) {
      return res.status(403).json({
        error: 'KYC must be approved before accessing brand management',
        kycStatus: seller.kycStatus || (seller.isApproved ? 'APPROVED' : 'PENDING'),
      })
    }

    const brand = await Brand.findOne({ _id: id, seller_id: sellerId })
      .populate('reviewed_by', 'name email')
      .lean()

    if (!brand) {
      return res.status(404).json({ error: 'Brand not found' })
    }

    const documents = await BrandDocument.find({ brand_id: id }).lean()

    const scopes = await BrandCategoryScope.find({
      brand_id: id,
      seller_id: sellerId,
      status: 'APPROVED',
    })
      .populate('category_id', 'name slug')
      .lean()

    const approved_categories = (scopes as any[]).map((s) => s.category_id).filter(Boolean)

    res.json({
      ...brand,
      documents,
      approved_category_count: approved_categories.length,
      approved_categories,
    })
  } catch (error) {
    console.error('Error fetching brand:', error)
    res.status(500).json({ error: 'Server error' })
  }
}

// Create brand request
export const createBrand = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user?.userId

    if (!sellerId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    // Check seller KYC status
    const seller = await User.findById(sellerId)
    if (!seller) {
      return res.status(404).json({ error: 'Seller not found' })
    }

    if (!isKycApproved(seller)) {
      return res.status(403).json({
        error: 'KYC must be approved before requesting brand approval',
        kycStatus: seller.kycStatus || (seller.isApproved ? 'APPROVED' : 'PENDING'),
      })
    }

    const { brand_name, brand_type, documents } = req.body

    // Handle file uploads if files are provided in FormData
    // This allows frontend to send files directly
    const uploadedDocuments: Array<{ document_type: DocumentType; file_url: string }> = []

    // Check if files are in req.files (from multer)
    if ((req as any).files) {
      const files = (req as any).files as Express.Multer.File[]
      const documentTypes = (req.body.document_types || '').split(',').filter(Boolean)

      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const docType = documentTypes[i] as DocumentType
        if (file && docType) {
          const fileUrl = await uploadToR2(
            file.buffer,
            `${docType}-${Date.now()}-${file.originalname}`,
            file.mimetype || 'application/octet-stream',
            'brands/documents',
          )
          uploadedDocuments.push({
            document_type: docType,
            file_url: fileUrl,
          })
        }
      }
    } else if (documents && Array.isArray(documents)) {
      // Use provided document URLs (already uploaded)
      uploadedDocuments.push(...documents)
    }

    if (!brand_name || !brand_type) {
      return res.status(400).json({ error: 'Brand name and type are required' })
    }

    if (!['OWN', 'OTHER'].includes(brand_type)) {
      return res.status(400).json({ error: 'Invalid brand type' })
    }

    // Check for duplicate brand name per seller
    const existingBrand = await Brand.findOne({
      seller_id: sellerId,
      brand_name: brand_name.trim(),
    })

    if (existingBrand) {
      return res.status(400).json({ error: 'Brand name already exists for this seller' })
    }

    // Validate documents based on brand type
    if (brand_type === 'OWN') {
      // Require at least ONE: TM_CERTIFICATE or TM_APPLICATION
      const hasRequiredDoc = uploadedDocuments.some(
        (doc) => doc.document_type === 'TM_CERTIFICATE' || doc.document_type === 'TM_APPLICATION',
      )

      if (!hasRequiredDoc) {
        return res.status(400).json({
          error:
            'For OWN brands, at least one of the following is required: Trademark Registration Certificate or Trademark Application',
        })
      }
    } else if (brand_type === 'OTHER') {
      // Require ALL: SALE_INVOICE, TM_CERTIFICATE, AUTHORIZATION_LETTER
      const requiredTypes = ['SALE_INVOICE', 'TM_CERTIFICATE', 'AUTHORIZATION_LETTER']
      const providedTypes = uploadedDocuments.map((doc) => doc.document_type)

      const missingTypes = requiredTypes.filter(
        (type: string) => !providedTypes.includes(type as DocumentType),
      )

      if (missingTypes.length > 0) {
        return res.status(400).json({
          error: `For OTHER brands, all of the following are required: ${missingTypes.join(', ')}`,
          missingTypes,
        })
      }
    }

    // Create brand
    const brand = new Brand({
      seller_id: sellerId,
      brand_name: brand_name.trim(),
      brand_type,
      status: 'PENDING',
    })

    await brand.save()

    // Upload and save documents
    if (uploadedDocuments.length > 0) {
      const documentPromises = uploadedDocuments.map(async (doc) => {
        if (!doc.file_url || !doc.document_type) {
          return null
        }

        const brandDoc = new BrandDocument({
          brand_id: brand._id,
          document_type: doc.document_type,
          file_url: doc.file_url,
        })

        return brandDoc.save()
      })

      await Promise.all(documentPromises.filter((p) => p !== null))
    }

    const savedBrand = await Brand.findById(brand._id).lean()
    const brandDocuments = await BrandDocument.find({ brand_id: brand._id }).lean()

    // Notify admins about new brand request
    try {
      const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL
      const adminPanelUrl = process.env.ADMIN_PANEL_URL
      const adminDashboardUrl = adminPanelUrl ? `${adminPanelUrl}/brand-approvals` : null
      const sellerName = seller.name || seller.businessName || 'Seller'
      const sellerEmail = seller.email

      // Send email to admin notification address
      if (adminEmail) {
        await sendEmail(
          adminEmail,
          `New Brand Approval Request: ${brand_name}`,
          emailTemplates.brandRequestSubmitted(
            sellerName,
            sellerEmail,
            brand_name,
            brand_type === 'OWN' ? 'Own Brand' : 'Other Brand',
            adminDashboardUrl,
          ),
        )
      }

      // Real-time notification via Socket.IO
      try {
        io.to('super-admin').emit('brand:pending', {
          brandId: (brand._id as mongoose.Types.ObjectId).toString(),
          brandName: brand_name,
          sellerName,
          sellerEmail,
          brandType: brand_type,
          triggeredAt: new Date().toISOString(),
        })
      } catch (socketError) {
        console.error('Error sending socket notification:', socketError)
      }
    } catch (notificationError) {
      console.error('Error sending brand request notifications:', notificationError)
      // Don't fail the request if notifications fail
    }

    res.status(201).json({
      ...savedBrand,
      documents: brandDocuments,
    })
  } catch (error: any) {
    console.error('Error creating brand:', error)
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Brand name already exists for this seller' })
    }
    res.status(500).json({ error: 'Server error' })
  }
}

// Upload document for brand
export const uploadBrandDocument = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user?.userId
    const { brand_id, document_type } = req.body

    if (!sellerId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    if (!brand_id || !document_type) {
      return res.status(400).json({ error: 'Brand ID and document type are required' })
    }

    // Check seller KYC status
    const seller = await User.findById(sellerId)
    if (!seller) {
      return res.status(404).json({ error: 'Seller not found' })
    }

    if (!isKycApproved(seller)) {
      return res.status(403).json({
        error: 'KYC must be approved before uploading brand documents',
        kycStatus: seller.kycStatus || (seller.isApproved ? 'APPROVED' : 'PENDING'),
      })
    }

    // Verify brand belongs to seller
    const brand = await Brand.findOne({ _id: brand_id, seller_id: sellerId })
    if (!brand) {
      return res.status(404).json({ error: 'Brand not found' })
    }

    // Only allow uploads if brand is PENDING or NEED_MORE_DOCS
    if (!['PENDING', 'NEED_MORE_DOCS'].includes(brand.status)) {
      return res.status(400).json({ error: 'Documents can only be uploaded for pending brands' })
    }

    // Handle file upload
    const files = (req as any).files as Express.Multer.File[]
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'File is required' })
    }

    // Use the first file (for single file upload endpoint)
    const file = files[0]
    const fileUrl = await uploadToR2(
      file.buffer,
      `${document_type}-${Date.now()}-${file.originalname}`,
      file.mimetype || 'application/octet-stream',
      `brands/${brand_id}/documents`,
    )

    // Create document record
    const brandDoc = new BrandDocument({
      brand_id,
      document_type,
      file_url: fileUrl,
    })

    await brandDoc.save()

    if (brand.status === 'NEED_MORE_DOCS') {
      brand.status = 'PENDING'
      brand.rejection_reason = undefined
      brand.reviewed_at = undefined
      brand.reviewed_by = undefined
      await brand.save()
    }

    res.status(201).json(brandDoc)
  } catch (error) {
    console.error('Error uploading brand document:', error)
    res.status(500).json({ error: 'Server error' })
  }
}

// Admin: Get all brands for approval
export const getAllBrands = async (req: Request, res: Response) => {
  try {
    const { status, seller_id, page = 1, limit = 20 } = req.query

    const filter: any = {}
    if (status) {
      filter.status = status
    }
    if (seller_id) {
      filter.seller_id = seller_id
    }

    const skip = (Number(page) - 1) * Number(limit)

    const brands = await Brand.find(filter)
      .populate('seller_id', 'name email businessName')
      .populate('reviewed_by', 'name email')
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean()

    const total = await Brand.countDocuments(filter)

    // Get documents for each brand
    const brandsWithDocuments = await Promise.all(
      brands.map(async (brand) => {
        const documents = await BrandDocument.find({ brand_id: brand._id }).lean()
        return {
          ...brand,
          documents,
        }
      }),
    )

    res.json({
      brands: brandsWithDocuments,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
    })
  } catch (error) {
    console.error('Error fetching all brands:', error)
    res.status(500).json({ error: 'Server error' })
  }
}

// Admin: Update brand status
export const updateBrandStatus = async (req: Request, res: Response) => {
  try {
    const adminId = req.user?.userId
    const { id } = req.params
    const { status, rejection_reason, approved_categories } = req.body

    if (!adminId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    if (!['APPROVED', 'REJECTED', 'NEED_MORE_DOCS', 'REVOKED'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' })
    }

    if ((status === 'REJECTED' || status === 'REVOKED') && !rejection_reason) {
      return res
        .status(400)
        .json({ error: 'Rejection reason is required for rejection or revocation' })
    }
    if (status === 'NEED_MORE_DOCS' && !rejection_reason) {
      return res.status(400).json({ error: 'Please specify which documents are required' })
    }

    // For APPROVED status, require approved_categories array
    if (status === 'APPROVED') {
      if (
        !approved_categories ||
        !Array.isArray(approved_categories) ||
        approved_categories.length === 0
      ) {
        return res
          .status(400)
          .json({ error: 'At least one category must be selected for brand approval' })
      }
    }

    const brand = await Brand.findById(id)
    if (!brand) {
      return res.status(404).json({ error: 'Brand not found' })
    }

    brand.status = status as any
    brand.reviewed_by = adminId as any
    brand.reviewed_at = new Date()

    if (status === 'REJECTED' || status === 'REVOKED') {
      brand.rejection_reason = rejection_reason
    } else if (status === 'APPROVED') {
      brand.rejection_reason = undefined
    } else if (status === 'NEED_MORE_DOCS') {
      brand.rejection_reason = rejection_reason
    }

    await brand.save()

    // If brand is APPROVED, create BrandCategoryScope entries for approved categories
    if (status === 'APPROVED' && approved_categories && Array.isArray(approved_categories)) {
      const sellerId = brand.seller_id

      // Remove any existing PENDING/REJECTED entries for this brand
      await BrandCategoryScope.deleteMany({
        seller_id: sellerId,
        brand_id: id,
        status: { $in: ['PENDING', 'REJECTED'] },
      })

      // Create APPROVED entries for selected categories
      const scopePromises = approved_categories.map((categoryId: string) => {
        return BrandCategoryScope.findOneAndUpdate(
          { seller_id: sellerId, brand_id: id, category_id: categoryId },
          {
            seller_id: sellerId,
            brand_id: id,
            category_id: categoryId,
            status: 'APPROVED',
            approved_by_admin_id: adminId,
            rejection_reason: undefined,
          },
          { upsert: true, new: true },
        )
      })

      await Promise.all(scopePromises)

      // Auto-unblock products that were waiting for category approval (seller-scoped)
      const Product = mongoose.model('Product')
      const approvedCategoryIds = approved_categories.map(
        (catId: string) => new mongoose.Types.ObjectId(catId),
      )

      await Product.updateMany(
        {
          seller: sellerId,
          brand_id: id,
          category: { $in: approvedCategoryIds },
          status: 'pending_category_approval',
        },
        { $set: { status: 'pending_approval' } }, // Move to pending_approval for admin review
      )
    }

    // If brand is revoked, disable all products under this brand and revoke all category scopes
    if (status === 'REVOKED') {
      const Product = mongoose.model('Product')
      const sellerId = brand.seller_id
      await Product.updateMany(
        { seller: sellerId, brand_id: id, status: { $in: ['active', 'inactive'] } },
        { $set: { status: 'inactive' } },
      )

      // Revoke all category scopes for this brand
      await BrandCategoryScope.updateMany(
        { seller_id: brand.seller_id, brand_id: id, status: 'APPROVED' },
        { $set: { status: 'REVOKED' } },
      )
    }

    const updatedBrand = await Brand.findById(id)
      .populate('seller_id', 'name email businessName')
      .populate('reviewed_by', 'name email')
      .lean()

    const documents = await BrandDocument.find({ brand_id: id }).lean()

    // Send email notification to seller based on status
    try {
      const seller = updatedBrand?.seller_id as any
      if (seller && seller.email) {
        const sellerName = seller.businessName || seller.name || 'Seller'
        const brandName = updatedBrand?.brand_name || ''
        const sellerPanelUrl = process.env.SELLER_PANEL_URL
        const sellerDashboardUrl = sellerPanelUrl ? `${sellerPanelUrl}/brands` : null

        let emailSubject = ''
        let emailHtml = ''

        switch (status) {
          case 'APPROVED':
            emailSubject = `Brand Approved: ${brandName}`
            emailHtml = emailTemplates.brandApproved(sellerName, brandName, sellerDashboardUrl)
            break
          case 'REJECTED':
            emailSubject = `Brand Request Rejected: ${brandName}`
            emailHtml = emailTemplates.brandRejected(
              sellerName,
              brandName,
              rejection_reason || 'No reason provided',
              sellerDashboardUrl,
            )
            break
          case 'NEED_MORE_DOCS':
            emailSubject = `Additional Documents Required: ${brandName}`
            emailHtml = emailTemplates.brandNeedsMoreDocs(
              sellerName,
              brandName,
              rejection_reason || 'No specific reason provided. Please check your brand details.',
              sellerDashboardUrl,
            )
            break
          case 'REVOKED':
            emailSubject = `Brand Revoked: ${brandName}`
            emailHtml = emailTemplates.brandRevoked(
              sellerName,
              brandName,
              rejection_reason || 'No reason provided',
              sellerDashboardUrl,
            )
            break
        }

        if (emailSubject && emailHtml) {
          await sendEmail(seller.email, emailSubject, emailHtml)
        }

        // Real-time notification via Socket.IO
        try {
          io.to(`user:${seller._id.toString()}`).emit('brand:status-updated', {
            brandId: id,
            brandName,
            status,
            rejectionReason: rejection_reason,
            triggeredAt: new Date().toISOString(),
          })
        } catch (socketError) {
          console.error('Error sending socket notification:', socketError)
        }
      }
    } catch (notificationError) {
      console.error('Error sending brand status notification:', notificationError)
      // Don't fail the request if notifications fail
    }

    res.json({
      ...updatedBrand,
      documents,
    })
  } catch (error) {
    console.error('Error updating brand status:', error)
    res.status(500).json({ error: 'Server error' })
  }
}

// Get approved brands for seller (for product creation dropdown)
export const getApprovedBrands = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user?.userId

    if (!sellerId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    // Check seller KYC status
    const seller = await User.findById(sellerId)
    if (!seller) {
      return res.status(404).json({ error: 'Seller not found' })
    }

    if (!isKycApproved(seller)) {
      return res.status(403).json({
        error: 'KYC must be approved before accessing brands',
        kycStatus: seller.kycStatus || (seller.isApproved ? 'APPROVED' : 'PENDING'),
      })
    }

    const brands = await Brand.find({
      seller_id: sellerId,
      status: 'APPROVED',
    })
      .select('_id brand_name brand_type')
      .sort({ brand_name: 1 })
      .lean()

    res.json(brands)
  } catch (error) {
    console.error('Error fetching approved brands:', error)
    res.status(500).json({ error: 'Server error' })
  }
}

// Admin: Get approved categories for a brand (for "Add categories" UI).
// Returns approved categories and available_to_add_categories (excludes assigned + their subcategories).
export const getBrandApprovedCategories = async (req: Request, res: Response) => {
  try {
    const adminId = req.user?.userId
    const { id: brandId } = req.params

    if (!adminId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const brand = await Brand.findById(brandId)
      .populate('seller_id', 'name email businessName')
      .lean()

    if (!brand) {
      return res.status(404).json({ error: 'Brand not found' })
    }

    const scopes = await BrandCategoryScope.find({
      brand_id: brandId,
      status: 'APPROVED',
    })
      .populate('category_id', 'name slug')
      .lean()

    const categoryIds = scopes.map((s: any) => s.category_id?._id?.toString()).filter(Boolean)
    const categories = scopes.map((s: any) => s.category_id).filter(Boolean)

    // All active categories (with parent) to compute available-to-add (exclude assigned + subcategories)
    const allActive = await Category.find({ status: 'active' })
      .select('_id name slug parent')
      .populate('parent', 'name _id')
      .lean()

    const approvedSet = new Set(categoryIds.map(String))
    const childrenByParent = new Map<string, string[]>()
    for (const c of allActive as any[]) {
      const id = c._id?.toString()
      if (!id) continue
      const parentId = c.parent ? (typeof c.parent === 'object' ? c.parent?._id?.toString() : String(c.parent)) : null
      if (parentId != null) {
        if (!childrenByParent.has(parentId)) childrenByParent.set(parentId, [])
        childrenByParent.get(parentId)!.push(id)
      }
    }
    const hiddenIds = new Set(approvedSet)
    const queue = [...approvedSet]
    while (queue.length > 0) {
      const id = queue.shift()!
      const children = childrenByParent.get(id) ?? []
      for (const childId of children) {
        if (!hiddenIds.has(childId)) {
          hiddenIds.add(childId)
          queue.push(childId)
        }
      }
    }
    const availableToAdd = (allActive as any[]).filter((c) => {
      const id = c._id?.toString()
      return id && !hiddenIds.has(id)
    })

    res.json({
      brand_id: brandId,
      brand_name: (brand as any).brand_name,
      category_ids: categoryIds,
      categories,
      available_to_add_categories: availableToAdd,
    })
  } catch (error) {
    console.error('Error fetching brand approved categories:', error)
    res.status(500).json({ error: 'Server error' })
  }
}

// Admin: Add categories to an already approved brand (with email notification, unblock products)
export const addCategoriesToBrand = async (req: Request, res: Response) => {
  try {
    const adminId = req.user?.userId
    const { id: brandId } = req.params
    const { category_ids: categoryIds } = req.body

    if (!adminId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    if (!categoryIds || !Array.isArray(categoryIds) || categoryIds.length === 0) {
      return res.status(400).json({
        error: 'At least one category must be selected',
      })
    }

    const brand = await Brand.findById(brandId)
      .populate('seller_id', 'name email businessName')
      .lean()

    if (!brand) {
      return res.status(404).json({ error: 'Brand not found' })
    }

    if ((brand as any).status !== 'APPROVED') {
      return res.status(400).json({
        error: 'Only approved brands can have categories added. Approve the brand first.',
      })
    }

    const sellerRef = (brand as any).seller_id
    const sellerId = sellerRef && typeof sellerRef === 'object' && sellerRef._id
      ? sellerRef._id
      : sellerRef

    // Validate categories exist
    const categories = await Category.find({ _id: { $in: categoryIds } }).lean()
    const foundIds = new Set(categories.map((c: any) => c._id.toString()))
    const invalidIds = categoryIds.filter((id: string) => !foundIds.has(id))
    if (invalidIds.length > 0) {
      return res.status(400).json({
        error: `Invalid or missing category IDs: ${invalidIds.join(', ')}`,
      })
    }

    // Create or update BrandCategoryScope for each category (only add APPROVED; don't overwrite REVOKED with APPROVED without a dedicated flow)
    const scopePromises = categoryIds.map((categoryId: string) =>
      BrandCategoryScope.findOneAndUpdate(
        {
          seller_id: sellerId,
          brand_id: brandId,
          category_id: categoryId,
        },
        {
          seller_id: sellerId,
          brand_id: brandId,
          category_id: categoryId,
          status: 'APPROVED',
          approved_by_admin_id: adminId,
          rejection_reason: undefined,
        },
        { upsert: true, new: true },
      ),
    )

    await Promise.all(scopePromises)

    // Unblock products that were waiting for category approval (same as category extension approval)
    const categoryObjectIds = categoryIds.map((id: string) => new mongoose.Types.ObjectId(id))
    const productUpdate = await Product.updateMany(
      {
        seller: sellerId,
        brand_id: brandId,
        category: { $in: categoryObjectIds },
        status: 'pending_category_approval',
      },
      { $set: { status: 'pending_approval' } },
    )

    const categoryNames = categories.map((c: any) => c.name).filter(Boolean)
    const brandName = (brand as any).brand_name || ''

    // Email notification to seller
    try {
      const seller = (brand as any).seller_id
      const sellerEmail = seller?.email
      const sellerName = seller?.businessName || seller?.name || 'Seller'
      const sellerPanelUrl = process.env.SELLER_PANEL_URL
      const dashboardUrl = sellerPanelUrl ? `${sellerPanelUrl}/products` : null

      if (sellerEmail && categoryNames.length > 0) {
        const emailSubject = `Categories added to your brand: ${brandName}`
        const emailHtml = emailTemplates.brandCategoriesAdded(
          sellerName,
          brandName,
          categoryNames,
          dashboardUrl,
        )
        await sendEmail(sellerEmail, emailSubject, emailHtml)
      }

      // Real-time notification
      const sellerIdStr = sellerId?.toString?.() ?? String(sellerId)
      try {
        io.to(`user:${sellerIdStr}`).emit('brand:categories-added', {
          brandId,
          brandName,
          categoryIds,
          categoryNames,
          productCountUnblocked: productUpdate.modifiedCount,
          triggeredAt: new Date().toISOString(),
        })
      } catch (socketError) {
        console.error('Error sending socket notification:', socketError)
      }
    } catch (notificationError) {
      console.error('Error sending brand categories added notification:', notificationError)
    }

    res.json({
      message: 'Categories added to brand successfully. Seller has been notified.',
      added_count: categoryIds.length,
      product_count_unblocked: productUpdate.modifiedCount,
      category_names: categoryNames,
    })
  } catch (error) {
    console.error('Error adding categories to brand:', error)
    res.status(500).json({ error: 'Server error' })
  }
}
