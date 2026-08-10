import { Request, Response } from 'express'
import mongoose from 'mongoose'
import Cart from '../models/Cart'
import Category, { CertificateType, ICategory } from '../models/Category'
import Certificate, { ICertificate } from '../models/Certificate'
import InventoryLog from '../models/InventoryLog'
import Product, { IProductReview } from '../models/Product'
import ProductVariant from '../models/ProductVariant'
import User, { IUser } from '../models/User'
import { io } from '../server'
import {
  checkSellerCertificates,
  getRelatedCategoryIds,
  getRequiredCertificatesForCategory,
} from '../utils/certificateUtils'
import { emailTemplates, sendEmail } from '../utils/email'
import { deleteMultipleFromR2 } from '../utils/r2Upload'
import { createSellerNotification } from '../utils/sellerNotifications'

export const adminListProducts = async (req: Request, res: Response) => {
  try {
    const {
      status,
      search,
      category,
      seller,
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      order = 'desc',
      isFeatured,
      hasVariants,
      minPrice,
      maxPrice,
      minStock,
      maxStock,
      dateFrom,
      dateTo,
      dateField = 'createdAt',
    } = req.query

    const filter: Record<string, any> = {}

    // Basic filters
    if (status) filter.status = status
    if (category) {
      // If filtering by category, include subcategories
      const CategoryModel = mongoose.model('Category')
      const categoryDoc = await CategoryModel.findById(category)
      if (categoryDoc) {
        // Get all subcategory IDs including the category itself
        const subcategoryIds = await CategoryModel.find({
          $or: [{ _id: category }, { parent: category }],
        }).distinct('_id')
        filter.category = { $in: subcategoryIds }
      } else {
        filter.category = category
      }
    }
    if (seller) filter.seller = seller

    // Boolean filters
    if (isFeatured !== undefined) {
      const isFeaturedValue =
        typeof isFeatured === 'string' ? isFeatured === 'true' : Boolean(isFeatured)
      filter.isFeatured = isFeaturedValue
    }
    if (hasVariants !== undefined) {
      const hasVariantsValue =
        typeof hasVariants === 'string' ? hasVariants === 'true' : Boolean(hasVariants)
      filter.hasVariants = hasVariantsValue
    }

    // Price range
    if (minPrice || maxPrice) {
      const priceFilter: Record<string, any> = {}
      if (minPrice) priceFilter.$gte = Number(minPrice)
      if (maxPrice) priceFilter.$lte = Number(maxPrice)
      if (Object.keys(priceFilter).length > 0) {
        filter.$and = filter.$and || []
        filter.$and.push({ price: priceFilter })
      }
    }

    // Stock range - handle both regular stock and totalStock for variants
    if (minStock !== undefined || maxStock !== undefined) {
      const stockFilter: any[] = []
      const min = minStock !== undefined ? Number(minStock) : undefined
      const max = maxStock !== undefined ? Number(maxStock) : undefined

      if (min !== undefined && max !== undefined) {
        stockFilter.push({
          $or: [
            { hasVariants: false, stock: { $gte: min, $lte: max } },
            { hasVariants: true, totalStock: { $gte: min, $lte: max } },
          ],
        })
      } else if (min !== undefined) {
        stockFilter.push({
          $or: [
            { hasVariants: false, stock: { $gte: min } },
            { hasVariants: true, totalStock: { $gte: min } },
          ],
        })
      } else if (max !== undefined) {
        stockFilter.push({
          $or: [
            { hasVariants: false, stock: { $lte: max } },
            { hasVariants: true, totalStock: { $lte: max } },
          ],
        })
      }

      if (stockFilter.length > 0) {
        filter.$and = filter.$and || []
        filter.$and.push(...stockFilter)
      }
    }

    // Date range
    if (dateFrom || dateTo) {
      const dateFilter: Record<string, any> = {}
      const field = dateField === 'updatedAt' ? 'updatedAt' : 'createdAt'
      if (dateFrom)
        dateFilter[field] = {
          ...dateFilter[field],
          $gte: new Date(dateFrom as string),
        }
      if (dateTo) {
        const toDate = new Date(dateTo as string)
        toDate.setHours(23, 59, 59, 999) // Include entire day
        dateFilter[field] = { ...dateFilter[field], $lte: toDate }
      }
      if (Object.keys(dateFilter).length > 0) {
        Object.assign(filter, dateFilter)
      }
    }

    // Search filter
    if (search) {
      const searchFilter = {
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
          { brand: { $regex: search, $options: 'i' } },
          { sku: { $regex: search, $options: 'i' } },
        ],
      }
      if (filter.$and) {
        filter.$and.push(searchFilter)
      } else {
        filter.$or = searchFilter.$or
      }
    }

    const skip = (Number(page) - 1) * Number(limit)
    const sortOptions: Record<string, 1 | -1> = {
      [sortBy as string]: order === 'desc' ? -1 : 1,
    }

    const [products, total] = await Promise.all([
      Product.find(filter)
        .populate({
          path: 'category',
          select: 'name slug parent',
          populate: {
            path: 'parent',
            select: 'name slug',
          },
        })
        .populate('seller', 'name email')
        .sort(sortOptions)
        .skip(skip)
        .limit(Number(limit)),
      Product.countDocuments(filter),
    ])

    res.json({
      products,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
    })
  } catch (e) {
    res.status(500).json({ error: 'Server error' })
  }
}

export const adminGetProduct = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const product = await Product.findById(id)
      .populate('category', 'name')
      .populate('seller', 'name email')
    if (!product) return res.status(404).json({ error: 'Product not found' })

    const response: any = product.toObject()
    if (product.hasVariants) {
      response.variants = await ProductVariant.find({ product: id }).sort({
        isDefault: -1,
        createdAt: 1,
      })
    }

    res.json(response)
  } catch (e) {
    res.status(500).json({ error: 'Server error' })
  }
}

export const adminUpdateProductStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { status } = req.body as {
      status: 'draft' | 'active' | 'inactive' | 'out_of_stock' | 'pending_approval'
    }
    if (!['draft', 'active', 'inactive', 'out_of_stock', 'pending_approval'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' })
    }
    const product = await Product.findById(id).populate('category')
    if (!product) return res.status(404).json({ error: 'Product not found' })

    const adminId = req.user?.userId
    const previousStatus = product.status

    // If approving a product that was pending_approval, check certificates and auto-approve pending ones
    let missingCertificates: CertificateType[] | undefined
    let approvedCertificates: ICertificate[] = []

    if (
      product.status === 'pending_approval' &&
      (status === 'active' || status === 'inactive') &&
      product.category
    ) {
      try {
        const requiredCertificates = await getRequiredCertificatesForCategory(product.category._id)
        if (requiredCertificates.length > 0) {
          // Get certificate IDs from product if available, otherwise find by category requirements
          let certificatesToApprove: ICertificate[] = []

          if (product.certificateIds && product.certificateIds.length > 0) {
            // Use certificates linked to this product
            // IMPORTANT: Only get certificates from the SAME SELLER - seller-specific operation
            certificatesToApprove = await Certificate.find({
              _id: { $in: product.certificateIds },
              seller: product.seller, // CRITICAL: Only this seller's certificates
            })
          } else {
            // Fallback: find certificates by type (for backward compatibility)
            // IMPORTANT: Only get certificates from the SAME SELLER - seller-specific operation
            certificatesToApprove = await Certificate.find({
              seller: product.seller, // CRITICAL: Only this seller's certificates
              certificateType: { $in: requiredCertificates },
            }).sort({ createdAt: -1 })

            // Group by type and get latest
            const latestByType = new Map<string, ICertificate>()
            for (const cert of certificatesToApprove) {
              const type = cert.certificateType
              if (!latestByType.has(type) || cert.createdAt > latestByType.get(type)!.createdAt) {
                latestByType.set(type, cert)
              }
            }
            certificatesToApprove = Array.from(latestByType.values())
          }

          // Auto-approve pending certificates
          if (adminId) {
            const now = new Date()
            for (const cert of certificatesToApprove) {
              // Only approve if status is pending or expired (re-approval after expiry)
              if (cert.status === 'pending' || cert.status === 'expired') {
                // Check if certificate is expired - if so, don't auto-approve unless it's a renewal
                if (cert.expiryDate && cert.expiryDate <= now) {
                  // Certificate is expired, but admin is approving product with it
                  // This means it's a renewal - approve it
                  cert.status = 'approved'
                  cert.certificateVerifiedBy = new mongoose.Types.ObjectId(adminId)
                  cert.verifiedOn = now
                  cert.rejectionReason = undefined
                  await cert.save()
                  approvedCertificates.push(cert)
                } else if (cert.status === 'pending') {
                  // Pending certificate - approve it
                  cert.status = 'approved'
                  cert.certificateVerifiedBy = new mongoose.Types.ObjectId(adminId)
                  cert.verifiedOn = now
                  cert.rejectionReason = undefined
                  await cert.save()
                  approvedCertificates.push(cert)
                }
              }
            }

            if (approvedCertificates.length > 0) {
              console.log(
                `Auto-approved ${approvedCertificates.length} certificate(s) when approving product ${id}`,
              )

              // Send email notification to seller about certificate approval
              try {
                const seller = await User.findById(product.seller)
                if (seller && seller.email) {
                  const certificateLabels = approvedCertificates
                    .map((c) =>
                      c.certificateType
                        .split('_')
                        .map((w: string) => w.charAt(0) + w.slice(1).toLowerCase())
                        .join(' '),
                    )
                    .join(', ')

                  await sendEmail(
                    seller.email,
                    'Certificates Approved - Product Approved',
                    emailTemplates.certificateApprovedWithProduct(
                      seller.businessName || seller.name || 'Seller',
                      product.name,
                      certificateLabels,
                      (() => {
                        const sellerPanelUrl = process.env.SELLER_PANEL_URL
                        return sellerPanelUrl ? `${sellerPanelUrl}/products/${id}` : null
                      })(),
                    ),
                  )
                }
              } catch (emailErr) {
                console.error('Error sending certificate approval email:', emailErr)
              }
            }

            // Update product's certificateIds if not already set
            if (!product.certificateIds || product.certificateIds.length === 0) {
              product.certificateIds = certificatesToApprove
                .map((c) => c._id as mongoose.Types.ObjectId)
                .filter(Boolean)
            }
          }

          // Now check if all required certificates are available (including newly approved ones)
          const certificateCheck = await checkSellerCertificates(
            product.seller,
            requiredCertificates,
          )
          if (!certificateCheck.hasAllCertificates) {
            missingCertificates = certificateCheck.missingCertificates
          } else {
            // All certificates are approved - find all products using these certificates and approve them
            const approvedCertificateTypes = approvedCertificates.map((c) => c.certificateType)
            if (approvedCertificateTypes.length > 0 && product.category) {
              // Get all related categories (parent and children) for this product's category
              const relatedCategories = await getRelatedCategoryIds(product.category)

              // Find all products in the same category and related categories (parent/children) that use these certificates
              // IMPORTANT: Only find products from the SAME SELLER - seller-specific operation
              const productsToApprove = await Product.find({
                seller: product.seller, // CRITICAL: Only this seller's products
                category: { $in: relatedCategories.allIds },
                status: 'pending_approval',
                $or: [
                  { certificateIds: { $in: approvedCertificates.map((c) => c._id) } },
                  // Also check products that might not have certificateIds set yet
                  { certificateIds: { $exists: false } },
                ],
              })

              // For products without certificateIds, check if they're in categories requiring these certificates
              for (const prod of productsToApprove) {
                if (!prod.certificateIds || prod.certificateIds.length === 0) {
                  const prodRequiredCerts = await getRequiredCertificatesForCategory(prod.category)
                  const hasAllCerts = await checkSellerCertificates(prod.seller, prodRequiredCerts)
                  if (hasAllCerts.hasAllCertificates) {
                    // Update product status to active if it has stock
                    if (!prod.statusLockedByAdmin) {
                      prod.status = prod.hasVariants
                        ? (prod.totalStock || 0) > 0
                          ? 'active'
                          : 'out_of_stock'
                        : (prod.stock || 0) > 0
                        ? 'active'
                        : 'out_of_stock'
                    }
                    await prod.save()
                  }
                } else {
                  // Product has certificateIds - check if all are approved
                  const prodCerts = await Certificate.find({
                    _id: { $in: prod.certificateIds },
                    seller: prod.seller,
                  })
                  const allApproved = prodCerts.every(
                    (c) => c.status === 'approved' && (!c.expiryDate || c.expiryDate > new Date()),
                  )
                  if (allApproved && !prod.statusLockedByAdmin) {
                    prod.status = prod.hasVariants
                      ? (prod.totalStock || 0) > 0
                        ? 'active'
                        : 'out_of_stock'
                      : (prod.stock || 0) > 0
                      ? 'active'
                      : 'out_of_stock'
                    await prod.save()
                  }
                }
              }

              if (productsToApprove.length > 0) {
                console.log(
                  `Auto-approved ${productsToApprove.length} product(s) after certificate approval for product ${id}`,
                )
              }
            }
          }
        }
      } catch (certErr) {
        console.error('Error checking certificates during approval:', certErr)
      }
    }

    product.status = status as any
    // When approving a product (pending_approval -> active), set to auto mode (not locked)
    // For other status changes, lock the status
    if (previousStatus === 'pending_approval' && status === 'active') {
      ;(product as any).statusLockedByAdmin = false
    } else {
      ;(product as any).statusLockedByAdmin = true
    }
    await product.save()

    res.json({
      product,
      warnings: missingCertificates ? { missingCertificates } : undefined,
    })
  } catch (e) {
    res.status(500).json({ error: 'Server error' })
  }
}

export const adminRemindMissingCertificates = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { missingCertificates } = (req.body || {}) as {
      missingCertificates?: CertificateType[]
    }

    const product = await Product.findById(id).populate('seller').populate('category')
    if (!product) {
      return res.status(404).json({ error: 'Product not found' })
    }

    const sellerDoc = product.seller as unknown as
      | (mongoose.Document & IUser & { _id: mongoose.Types.ObjectId })
      | null
    if (!sellerDoc || !sellerDoc.email) {
      return res.status(400).json({ error: 'Seller contact information not available' })
    }

    let certificatesToRemind: CertificateType[] | undefined = missingCertificates
    if (!certificatesToRemind || certificatesToRemind.length === 0) {
      if (product.category) {
        const required = await getRequiredCertificatesForCategory(product.category._id)
        if (required.length > 0) {
          const check = await checkSellerCertificates(product.seller, required)
          certificatesToRemind = check.missingCertificates
        }
      }
    }

    certificatesToRemind = Array.from(new Set(certificatesToRemind || []))

    const subject = `Action needed: certificates required for ${product.name}`
    const prettyList =
      certificatesToRemind.length > 0
        ? certificatesToRemind.map((cert) => cert.replace(/_/g, ' ')).join(', ')
        : 'the required certificates'

    const sellerName = sellerDoc.businessName || sellerDoc.name || 'Seller'
    const productName = product.name
    const categoryName =
      typeof product.category === 'object' && product.category !== null
        ? (product.category as any).name
        : 'the selected category'

    const body = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #f8fafc;">
        <div style="background-color: #ffffff; border-radius: 12px; padding: 28px; border: 1px solid #e2e8f0;">
          <h2 style="color: #0f172a; margin-top: 0;">Certificates required to approve your product</h2>
          <p style="color: #475569; line-height: 1.6;">
            Hi ${sellerName},
          </p>
          <p style="color: #475569; line-height: 1.6;">
            An admin reviewed your product <strong>${productName}</strong> in the <strong>${categoryName}</strong> category.<br/>
            To complete the approval, please upload the following certificate(s):
          </p>
          <div style="background-color: #f1f5f9; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <strong style="color: #0f172a;">Required certificates:</strong>
            <p style="color: #334155; margin: 8px 0 0 0;">${prettyList}</p>
          </div>
          <p style="color: #475569; line-height: 1.6;">
            Once these certificates are uploaded and approved, we can activate your product.
          </p>
         
          <p style="color: #475569; line-height: 1.6;">
            Thanks,<br/>
            Admin Team
          </p>
        </div>
      </div>
    `

    await sendEmail(sellerDoc.email, subject, body)

    const sellerId = sellerDoc._id.toString()

    // Format certificate names for the message
    const certificateLabels = certificatesToRemind.map((cert) =>
      cert.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
    )
    const certificateList = certificateLabels.join(', ')

    // Create in-app notification for seller
    await createSellerNotification({
      sellerId,
      title: 'Certificates Required for Product Approval',
      message: `Admin requires certificates for product "${productName}": ${certificateList}. Please upload these certificates to complete product approval.`,
      link: `/products/${product._id?.toString()}`,
      type: 'system',
    })

    res.json({
      success: true,
      notifiedCertificates: certificatesToRemind,
    })
  } catch (err) {
    console.error('Error sending certificate reminder:', err)
    res.status(500).json({ error: 'Failed to send reminder' })
  }
}

export const adminGetProductCertificateSummary = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const product = await Product.findById(id)
      .populate('category')
      .populate('seller', 'name email businessName')

    if (!product) {
      return res.status(404).json({ error: 'Product not found' })
    }

    const sellerRef = product.seller as
      | mongoose.Types.ObjectId
      | (mongoose.Document & { _id: mongoose.Types.ObjectId })

    const sellerId =
      sellerRef && typeof (sellerRef as any)?._id !== 'undefined'
        ? ((sellerRef as any)._id as mongoose.Types.ObjectId)
        : (sellerRef as mongoose.Types.ObjectId | undefined)

    if (!product.category) {
      return res.json({
        productId: product._id,
        productName: product.name,
        seller: sellerRef
          ? {
              _id: sellerId?.toString(),
              name: (sellerRef as any)?.name,
              email: (sellerRef as any)?.email,
              businessName: (sellerRef as any)?.businessName,
            }
          : null,
        category: null,
        ownCertificates: [],
        inheritedCertificates: [],
        effectiveCertificates: [],
        inheritsParentRule: false,
        certificates: [],
        hasAllValid: true,
        missingCertificates: [],
      })
    }

    const categoryDoc = product.category as unknown as ICategory & {
      _id: mongoose.Types.ObjectId
    }

    const effectiveCertificates = await getRequiredCertificatesForCategory(categoryDoc._id)

    const ownCertificates = Array.from(new Set(categoryDoc.requiredCertificates || []))

    let inheritsParentRule = !categoryDoc.overrideParentCertificateRule && !!categoryDoc.parent

    let parentId: mongoose.Types.ObjectId | null = null
    let parentName: string | undefined
    let parentSlug: string | undefined

    if (categoryDoc.parent) {
      if (
        typeof categoryDoc.parent === 'object' &&
        categoryDoc.parent !== null &&
        '_id' in categoryDoc.parent
      ) {
        const parentObj = categoryDoc.parent as {
          _id: mongoose.Types.ObjectId
          name?: string
          slug?: string
        }
        parentId = parentObj._id
        parentName = parentObj.name
        parentSlug = parentObj.slug
      } else {
        try {
          parentId =
            typeof categoryDoc.parent === 'string'
              ? new mongoose.Types.ObjectId(categoryDoc.parent)
              : (categoryDoc.parent as mongoose.Types.ObjectId)
          const parentFetched = await Category.findById(parentId).lean<{
            _id: mongoose.Types.ObjectId
            name?: string
            slug?: string
          }>()
          if (parentFetched) {
            parentName = parentFetched.name
            parentSlug = parentFetched.slug
          }
        } catch {
          parentId = null
        }
      }
    }

    let inheritedCertificates: CertificateType[] = []
    if (inheritsParentRule && parentId) {
      const parentEffective = await getRequiredCertificatesForCategory(parentId)
      inheritedCertificates = parentEffective.filter((cert) => effectiveCertificates.includes(cert))
    } else {
      inheritsParentRule = false
    }

    const certificates =
      sellerId && effectiveCertificates.length > 0
        ? await Certificate.find({
            seller: sellerId,
            certificateType: { $in: effectiveCertificates },
          }).sort({ updatedAt: -1 })
        : []

    const latestByType = new Map<CertificateType, any>()
    for (const cert of certificates) {
      const certType = cert.certificateType as CertificateType
      const existing = latestByType.get(certType)
      if (!existing || existing.updatedAt < cert.updatedAt) {
        latestByType.set(certType, cert)
      }
    }

    const now = new Date()
    const certificateSummaries = effectiveCertificates.map((certType) => {
      const entry = latestByType.get(certType)
      if (!entry) {
        return {
          certificateType: certType,
          status: 'missing' as const,
          inherited: inheritedCertificates.includes(certType),
        }
      }

      const certObj = entry.toObject()
      let status = certObj.status as 'pending' | 'approved' | 'rejected' | 'expired'

      if (status === 'approved' && certObj.expiryDate && new Date(certObj.expiryDate) <= now) {
        status = 'expired'
      }

      return {
        certificateType: certType,
        status,
        inherited: inheritedCertificates.includes(certType),
        certificateId: certObj._id?.toString(),
        certificateNumber: certObj.certificateNumber,
        documentUrl: certObj.documentUrl,
        expiryDate: certObj.expiryDate,
        uploadedAt: certObj.createdAt,
        updatedAt: certObj.updatedAt,
        verifiedOn: certObj.verifiedOn,
        certificateVerifiedBy: certObj.certificateVerifiedBy
          ? certObj.certificateVerifiedBy.toString()
          : undefined,
        rejectionReason: certObj.rejectionReason,
      }
    })

    const hasAllValid = certificateSummaries.every((summary) => summary.status === 'approved')
    const missingCertificates = certificateSummaries
      .filter((summary) => summary.status === 'missing')
      .map((summary) => summary.certificateType)

    const sellerPayload = sellerRef
      ? {
          _id: sellerId?.toString(),
          name: (sellerRef as any)?.name,
          email: (sellerRef as any)?.email,
          businessName: (sellerRef as any)?.businessName,
        }
      : null

    return res.json({
      productId: product._id,
      productName: product.name,
      seller: sellerPayload,
      category: {
        _id: categoryDoc._id.toString(),
        name: categoryDoc.name,
        slug: categoryDoc.slug,
        parent: parentId
          ? {
              _id: parentId.toString(),
              name: parentName,
              slug: parentSlug,
            }
          : null,
      },
      ownCertificates,
      inheritedCertificates,
      effectiveCertificates,
      inheritsParentRule,
      certificates: certificateSummaries,
      hasAllValid,
      missingCertificates,
    })
  } catch (err) {
    console.error('Error fetching product certificate summary:', err)
    return res.status(500).json({ error: 'Server error' })
  }
}

export const adminToggleFeatured = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { isFeatured } = req.body as { isFeatured: boolean }
    const product = await Product.findByIdAndUpdate(
      id,
      { $set: { isFeatured: !!isFeatured } },
      { new: true },
    )
    if (!product) return res.status(404).json({ error: 'Product not found' })
    res.json(product)
  } catch (e) {
    res.status(500).json({ error: 'Server error' })
  }
}

export const adminDeleteProduct = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const product = await Product.findByIdAndDelete(id)
    if (!product) return res.status(404).json({ error: 'Product not found' })

    // Delete all variants of this product
    await ProductVariant.deleteMany({ product: id })

    // Remove this product from all carts
    try {
      await Cart.updateMany({ 'items.product': id }, { $pull: { items: { product: id } } })
    } catch (cartError) {
      console.error('Error removing product from carts:', cartError)
      // Don't fail the deletion if cart update fails
    }

    const imagesToDelete = [product.mainImage, ...product.images].filter(Boolean) as string[]
    if (imagesToDelete.length) await deleteMultipleFromR2(imagesToDelete)
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ error: 'Server error' })
  }
}

export const adminBulkUpdateStatus = async (req: Request, res: Response) => {
  try {
    const { productIds, status } = req.body as {
      productIds: string[]
      status: string
    }
    if (!Array.isArray(productIds) || !productIds.length)
      return res.status(400).json({ error: 'productIds required' })
    if (!['draft', 'active', 'inactive', 'out_of_stock', 'pending_approval'].includes(status))
      return res.status(400).json({ error: 'Invalid status' })

    // If approving products, check certificates for each and auto-approve pending certificates
    if (status === 'active' || status === 'inactive') {
      const adminId = req.user?.userId
      const products = await Product.find({ _id: { $in: productIds } })
        .populate('category')
        .populate('seller')

      const failedProducts: string[] = []
      // IMPORTANT: Process each product individually - each product's seller is isolated
      // Approving products from Seller A will NEVER affect Seller B's products or certificates
      for (const product of products) {
        if (product.status === 'pending_approval' && product.category) {
          try {
            const requiredCertificates = await getRequiredCertificatesForCategory(
              product.category._id,
            )
            if (requiredCertificates.length > 0) {
              // Auto-approve any pending certificates of the required types for this seller
              // CRITICAL: Only certificates from the SAME SELLER are auto-approved
              if (adminId) {
                const pendingCertificates = await Certificate.find({
                  seller: product.seller, // CRITICAL: Seller-specific - only this seller's certificates
                  certificateType: { $in: requiredCertificates },
                  status: 'pending',
                })

                if (pendingCertificates.length > 0) {
                  const now = new Date()
                  for (const cert of pendingCertificates) {
                    // Check if certificate is expired - if so, don't auto-approve
                    if (cert.expiryDate && cert.expiryDate <= now) {
                      cert.status = 'expired'
                    } else {
                      cert.status = 'approved'
                      cert.certificateVerifiedBy = new mongoose.Types.ObjectId(adminId)
                      cert.verifiedOn = now
                      cert.rejectionReason = undefined
                    }
                    await cert.save()
                  }

                  console.log(
                    `Auto-approved ${pendingCertificates.length} pending certificate(s) when bulk approving product ${product._id}`,
                  )
                }
              }

              // Now check if all required certificates are available (including newly approved ones)
              // CRITICAL: checkSellerCertificates is seller-specific - only checks certificates for this seller
              const certificateCheck = await checkSellerCertificates(
                product.seller, // CRITICAL: Seller-specific operation
                requiredCertificates,
              )
              if (!certificateCheck.hasAllCertificates) {
                failedProducts.push((product._id as mongoose.Types.ObjectId).toString())
                continue
              }
            }
          } catch (certErr) {
            console.error('Error checking certificates for product:', product._id, certErr)
            failedProducts.push((product._id as mongoose.Types.ObjectId).toString())
            continue
          }
        }
      }

      // Update only products that passed certificate check
      const validProductIds = productIds.filter((id) => !failedProducts.includes(id))
      if (validProductIds.length > 0) {
        await Product.updateMany(
          { _id: { $in: validProductIds } },
          { $set: { status, statusLockedByAdmin: true } },
        )
      }

      return res.json({
        modified: validProductIds.length,
        failed: failedProducts.length,
        failedProductIds: failedProducts,
      })
    }

    const result = await Product.updateMany(
      { _id: { $in: productIds } },
      { $set: { status, statusLockedByAdmin: true } },
    )
    res.json({ modified: result.modifiedCount })
  } catch (e) {
    res.status(500).json({ error: 'Server error' })
  }
}

export const adminBulkDelete = async (req: Request, res: Response) => {
  try {
    const { productIds } = req.body as { productIds: string[] }
    if (!Array.isArray(productIds) || !productIds.length)
      return res.status(400).json({ error: 'productIds required' })
    const products = await Product.find({ _id: { $in: productIds } })
    const imagesToDelete: string[] = []
    products.forEach((p) => {
      if (p.mainImage) imagesToDelete.push(p.mainImage)
      if (Array.isArray(p.images)) imagesToDelete.push(...p.images)
    })
    await Product.deleteMany({ _id: { $in: productIds } })
    await ProductVariant.deleteMany({ product: { $in: productIds } as any })

    // Remove these products from all carts
    try {
      await Cart.updateMany(
        { 'items.product': { $in: productIds } },
        { $pull: { items: { product: { $in: productIds } } } },
      )
    } catch (cartError) {
      console.error('Error removing products from carts:', cartError)
      // Don't fail the deletion if cart update fails
    }

    if (imagesToDelete.length) await deleteMultipleFromR2(imagesToDelete)
    res.json({ deleted: products.length })
  } catch (e) {
    res.status(500).json({ error: 'Server error' })
  }
}

export const adminExportProductsCSV = async (req: Request, res: Response) => {
  try {
    const { status, category, seller } = req.query
    const filter: Record<string, any> = {}
    if (status) filter.status = status
    if (category) filter.category = category
    if (seller) filter.seller = seller
    const products = await Product.find(filter).populate('category', 'name')

    const headers = [
      'name',
      'description',
      'shortDescription',
      'price',
      'comparePrice',
      'costPrice',
      'categoryId',
      'brand',
      'stock',
      'sku',
      'status',
      'isFeatured',
    ]
    const rows = products.map((p) => [
      p.name,
      (p.description || '').replace(/\n/g, ' '),
      p.shortDescription || '',
      String(p.price ?? ''),
      String(p.comparePrice ?? ''),
      String(p.costPrice ?? ''),
      String(p.category),
      p.brand || '',
      String(p.stock ?? ''),
      p.sku || '',
      p.status || 'draft',
      String(p.isFeatured || false),
    ])
    const csv = [
      headers.join(','),
      ...rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')),
    ].join('\n')
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', 'attachment; filename="admin-products.csv"')
    res.send(csv)
  } catch (e) {
    res.status(500).json({ error: 'Server error' })
  }
}

export const adminLowStockReport = async (req: Request, res: Response) => {
  try {
    const { threshold = 5, page = 1, limit = 10 } = req.query
    const skip = (Number(page) - 1) * Number(limit)
    const stockThreshold = Number(threshold)
    const [products, total] = await Promise.all([
      Product.find({
        status: 'active',
        $or: [{ stock: { $lte: stockThreshold } }, { lowStockVariants: { $gt: 0 } }],
      })
        .populate('category', 'name')
        .populate('seller', 'name email')
        .sort({ stock: 1, lowStockVariants: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Product.countDocuments({
        status: 'active',
        $or: [{ stock: { $lte: stockThreshold } }, { lowStockVariants: { $gt: 0 } }],
      }),
    ])
    res.json({
      products,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
    })
  } catch (e) {
    res.status(500).json({ error: 'Server error' })
  }
}

export const adminInventoryAnalytics = async (req: Request, res: Response) => {
  try {
    const { period = '30d' } = req.query
    const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 30
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const [
      totalProducts,
      activeProducts,
      outOfStockProducts,
      lowStockProducts,
      totalStockValue,
      inventoryLogs,
    ] = await Promise.all([
      Product.countDocuments({}),
      Product.countDocuments({ status: 'active' }),
      Product.countDocuments({ status: 'out_of_stock' }),
      Product.countDocuments({
        status: 'active',
        $or: [{ stock: { $lte: 5 } }, { lowStockVariants: { $gt: 0 } }],
      }),
      Product.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: { $multiply: ['$stock', '$price'] } },
          },
        },
      ]),
      InventoryLog.find({ createdAt: { $gte: startDate } })
        .sort({ createdAt: -1 })
        .limit(100),
    ])

    const stockValue = (totalStockValue as any)[0]?.total || 0
    const recentMovements = inventoryLogs.map((log) => ({
      productId: log.product,
      type: log.type,
      change: log.quantityChange,
      newStock: log.newStock,
      reason: log.reason,
      date: log.createdAt,
    }))

    res.json({
      summary: {
        totalProducts,
        activeProducts,
        outOfStockProducts,
        lowStockProducts,
        totalStockValue: stockValue,
        lowStockPercentage:
          totalProducts > 0 ? Math.round((lowStockProducts / totalProducts) * 100) : 0,
      },
      recentMovements,
      period: `${days} days`,
    })
  } catch (e) {
    res.status(500).json({ error: 'Server error' })
  }
}

export const adminRaiseObjection = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { reason } = req.body as { reason: string }
    if (!reason || !reason.trim()) return res.status(400).json({ error: 'Reason is required' })
    const adminId = req.user?.userId
    const product = await Product.findById(id)
    if (!product) return res.status(404).json({ error: 'Product not found' })

    const obj = {
      reason: reason.trim(),
      createdAt: new Date(),
      raisedBy: new mongoose.Types.ObjectId(adminId),
      resolved: false,
    } as any
    const objections = Array.isArray((product as any).objections)
      ? ([...(product as any).objections, obj] as any)
      : ([obj] as any)
    ;(product as any).objections = objections
    await product.save()
    try {
      io.to('super-admin').emit('notice:new', {
        productId: id,
        reason: obj.reason,
        createdAt: obj.createdAt,
      })
      io.to(`user:${(product as any).seller}`).emit('notice:new', {
        productId: id,
        reason: obj.reason,
        createdAt: obj.createdAt,
      })
    } catch {}
    res.status(201).json({ success: true, objection: obj })
  } catch (e) {
    res.status(500).json({ error: 'Server error' })
  }
}

export const adminToggleStatusLock = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { locked, recompute } = req.body as {
      locked: boolean
      recompute?: boolean
    }
    const product = await Product.findById(id)
    if (!product) return res.status(404).json({ error: 'Product not found' })
    ;(product as any).statusLockedByAdmin = !!locked

    if (!locked && recompute) {
      if (product.status !== 'draft') {
        const next = product.hasVariants ? (product.totalStock || 0) > 0 : (product.stock || 0) > 0
        product.status = next ? 'active' : 'out_of_stock'
      }
    }

    await product.save()
    res.json(product)
  } catch (e) {
    res.status(500).json({ error: 'Server error' })
  }
}

export const adminResolveLatestObjection = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { resolutionNote } = req.body as { resolutionNote?: string }
    const product = await Product.findById(id)
    if (!product) return res.status(404).json({ error: 'Product not found' })

    const list = (product as any).objections as Array<any>
    if (!Array.isArray(list) || list.length === 0) {
      return res.status(400).json({ error: 'No notices to resolve' })
    }
    // Find latest open (not resolved)
    let idx = -1
    for (let i = list.length - 1; i >= 0; i--) {
      if (!list[i].resolved) {
        idx = i
        break
      }
    }
    if (idx === -1) return res.status(400).json({ error: 'No open notices to resolve' })

    list[idx].resolved = true
    list[idx].resolvedAt = new Date()
    if (resolutionNote) list[idx].resolutionNote = resolutionNote
    ;(product as any).objections = list
    await product.save()
    try {
      io.to('super-admin').emit('notice:resolved', {
        productId: id,
        resolvedAt: list[idx].resolvedAt,
      })
      io.to(`user:${(product as any).seller}`).emit('notice:resolved', {
        productId: id,
        resolvedAt: list[idx].resolvedAt,
      })
    } catch {}
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ error: 'Server error' })
  }
}

// Helper function to map review for admin response
const mapReviewForAdmin = (
  review: IProductReview | (IProductReview & { toObject?: () => IProductReview }),
  productId: string,
  productName: string,
) => {
  const source =
    typeof (review as any)?.toObject === 'function' ? (review as any).toObject() : review
  return {
    _id: source._id,
    productId,
    productName,
    rating: source.rating,
    title: source.title,
    comment: source.comment,
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
    likes: source.likes ?? 0,
    dislikes: source.dislikes ?? 0,
    isVerifiedPurchase: source.isVerifiedPurchase ?? false,
    images: Array.isArray(source.images) ? source.images : [],
    videos: Array.isArray(source.videos) ? source.videos : [],
    moderationStatus: source.moderationStatus ?? 'pending',
    moderationReason: source.moderationReason,
    moderatedAt: source.moderatedAt,
    moderatedBy: source.moderatedBy,
    reviewer: {
      name: source.reviewer?.name ?? 'Anonymous',
      avatarUrl: source.reviewer?.avatarUrl,
      city: source.reviewer?.city,
      state: source.reviewer?.state,
    },
    userId: source.user,
  }
}

// Get all reviews for a product (admin view - shows all statuses)
export const adminGetProductReviews = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { status, page = 1, limit = 20 } = req.query

    // Validate that id is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid product ID' })
    }

    const product = await Product.findById(id).select('name reviews')

    if (!product) {
      return res.status(404).json({ error: 'Product not found' })
    }

    let reviews = Array.isArray(product.reviews) ? product.reviews : []

    // Filter by moderation status if provided
    if (status && (status === 'pending' || status === 'approved' || status === 'rejected')) {
      reviews = reviews.filter((r) => (r.moderationStatus ?? 'pending') === status)
    }

    // Sort by creation date (newest first)
    reviews.sort((a, b) => {
      const dateA = new Date(a.createdAt || 0).getTime()
      const dateB = new Date(b.createdAt || 0).getTime()
      return dateB - dateA
    })

    // Pagination
    const pageNum = Number(page)
    const limitNum = Number(limit)
    const skip = (pageNum - 1) * limitNum
    const paginatedReviews = reviews.slice(skip, skip + limitNum)

    const mappedReviews = paginatedReviews.map((review) =>
      mapReviewForAdmin(
        review as unknown as IProductReview,
        (product._id as mongoose.Types.ObjectId).toString(),
        product.name,
      ),
    )

    res.json({
      reviews: mappedReviews,
      pagination: {
        total: reviews.length,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(reviews.length / limitNum),
      },
    })
  } catch (e) {
    console.error('Error in adminGetProductReviews:', e)
    res.status(500).json({ error: 'Server error' })
  }
}

// Get all pending reviews across all products
export const adminGetPendingReviews = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 20, search } = req.query

    const pageNum = Number(page)
    const limitNum = Number(limit)
    const skip = (pageNum - 1) * limitNum

    // Find all products with pending reviews
    const products = await Product.find({
      reviews: { $exists: true, $ne: [] },
    })
      .select('name _id reviews')
      .lean()

    const allPendingReviews: Array<{
      review: IProductReview
      productId: string
      productName: string
    }> = []

    products.forEach((product) => {
      const reviews = Array.isArray(product.reviews) ? product.reviews : []
      reviews.forEach((review: any) => {
        const reviewStatus = review.moderationStatus ?? 'pending'
        if (reviewStatus === 'pending') {
          // Filter by search if provided
          if (search) {
            const searchLower = String(search).toLowerCase()
            const matchesSearch =
              (review.comment && review.comment.toLowerCase().includes(searchLower)) ||
              (review.title && review.title.toLowerCase().includes(searchLower)) ||
              (review.reviewer?.name && review.reviewer.name.toLowerCase().includes(searchLower)) ||
              (product.name && product.name.toLowerCase().includes(searchLower))
            if (!matchesSearch) return
          }

          allPendingReviews.push({
            review: review as IProductReview,
            productId: product._id.toString(),
            productName: product.name,
          })
        }
      })
    })

    // Sort by creation date (newest first)
    allPendingReviews.sort((a, b) => {
      const dateA = new Date(a.review.createdAt || 0).getTime()
      const dateB = new Date(b.review.createdAt || 0).getTime()
      return dateB - dateA
    })

    // Pagination
    const paginatedReviews = allPendingReviews.slice(skip, skip + limitNum)

    const mappedReviews = paginatedReviews.map((item) =>
      mapReviewForAdmin(item.review, item.productId, item.productName),
    )

    res.json({
      reviews: mappedReviews,
      pagination: {
        total: allPendingReviews.length,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(allPendingReviews.length / limitNum),
      },
    })
  } catch (e) {
    console.error('Error in adminGetPendingReviews:', e)
    res.status(500).json({ error: 'Server error' })
  }
}

// Approve a review
export const adminApproveReview = async (req: Request, res: Response) => {
  try {
    const { productId, reviewId } = req.params
    const adminId = req.user?.userId

    if (!adminId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const product = await Product.findById(productId)

    if (!product) {
      return res.status(404).json({ error: 'Product not found' })
    }

    const reviews = Array.isArray(product.reviews) ? product.reviews : []
    const reviewIndex = reviews.findIndex((r) => r._id && r._id.toString() === reviewId)

    if (reviewIndex === -1) {
      return res.status(404).json({ error: 'Review not found' })
    }

    const review = reviews[reviewIndex] as any
    review.moderationStatus = 'approved'
    review.moderationReason = undefined
    review.moderatedAt = new Date()
    review.moderatedBy = new mongoose.Types.ObjectId(adminId)

    // Recalculate product rating and review count
    const approvedReviews = (product.reviews || []).filter(
      (r) => (r.moderationStatus ?? 'pending') === 'approved',
    )
    const totalApprovedReviews = approvedReviews.length
    if (totalApprovedReviews > 0) {
      const aggregateRating = approvedReviews.reduce((acc, entry) => acc + (entry.rating ?? 0), 0)
      product.rating = Number((aggregateRating / totalApprovedReviews).toFixed(2))
      product.reviewCount = totalApprovedReviews
    } else {
      product.rating = 0
      product.reviewCount = 0
    }

    product.markModified('reviews')
    await product.save()

    const responseReview = mapReviewForAdmin(
      review as unknown as IProductReview,
      productId,
      product.name,
    )

    res.json({
      review: responseReview,
      rating: product.rating,
      reviewCount: product.reviewCount,
      message: 'Review approved successfully',
    })
  } catch (e) {
    console.error('Error in adminApproveReview:', e)
    res.status(500).json({ error: 'Server error' })
  }
}

// Reject a review
export const adminRejectReview = async (req: Request, res: Response) => {
  try {
    const { productId, reviewId } = req.params
    const { reason } = req.body
    const adminId = req.user?.userId

    if (!adminId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return res.status(400).json({ error: 'Rejection reason is required' })
    }

    const product = await Product.findById(productId)

    if (!product) {
      return res.status(404).json({ error: 'Product not found' })
    }

    const reviews = Array.isArray(product.reviews) ? product.reviews : []
    const reviewIndex = reviews.findIndex((r) => r._id && r._id.toString() === reviewId)

    if (reviewIndex === -1) {
      return res.status(404).json({ error: 'Review not found' })
    }

    const review = reviews[reviewIndex] as any
    review.moderationStatus = 'rejected'
    review.moderationReason = reason.trim().slice(0, 500)
    review.moderatedAt = new Date()
    review.moderatedBy = new mongoose.Types.ObjectId(adminId)

    // Recalculate product rating and review count (exclude rejected)
    const approvedReviews = (product.reviews || []).filter(
      (r) => (r.moderationStatus ?? 'pending') === 'approved',
    )
    const totalApprovedReviews = approvedReviews.length
    if (totalApprovedReviews > 0) {
      const aggregateRating = approvedReviews.reduce((acc, entry) => acc + (entry.rating ?? 0), 0)
      product.rating = Number((aggregateRating / totalApprovedReviews).toFixed(2))
      product.reviewCount = totalApprovedReviews
    } else {
      product.rating = 0
      product.reviewCount = 0
    }

    product.markModified('reviews')
    await product.save()

    const responseReview = mapReviewForAdmin(
      review as unknown as IProductReview,
      productId,
      product.name,
    )

    res.json({
      review: responseReview,
      rating: product.rating,
      reviewCount: product.reviewCount,
      message: 'Review rejected successfully',
    })
  } catch (e) {
    console.error('Error in adminRejectReview:', e)
    res.status(500).json({ error: 'Server error' })
  }
}

// Bulk approve reviews
export const adminBulkApproveReviews = async (req: Request, res: Response) => {
  try {
    const { reviewIds } = req.body
    const adminId = req.user?.userId

    if (!adminId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    if (!Array.isArray(reviewIds) || reviewIds.length === 0) {
      return res.status(400).json({ error: 'reviewIds array is required' })
    }

    const results: Array<{
      productId: string
      reviewId: string
      success: boolean
      error?: string
    }> = []

    for (const reviewId of reviewIds) {
      try {
        // Extract productId and reviewId from format "productId:reviewId"
        const [productId, actualReviewId] = reviewId.includes(':')
          ? reviewId.split(':')
          : [null, reviewId]

        if (!productId || !actualReviewId) {
          results.push({
            productId: '',
            reviewId,
            success: false,
            error: 'Invalid review ID format',
          })
          continue
        }

        const product = await Product.findById(productId)
        if (!product) {
          results.push({
            productId,
            reviewId: actualReviewId,
            success: false,
            error: 'Product not found',
          })
          continue
        }

        const reviews = Array.isArray(product.reviews) ? product.reviews : []
        const reviewIndex = reviews.findIndex((r) => r._id && r._id.toString() === actualReviewId)

        if (reviewIndex === -1) {
          results.push({
            productId,
            reviewId: actualReviewId,
            success: false,
            error: 'Review not found',
          })
          continue
        }

        const review = reviews[reviewIndex] as any
        review.moderationStatus = 'approved'
        review.moderationReason = undefined
        review.moderatedAt = new Date()
        review.moderatedBy = new mongoose.Types.ObjectId(adminId)

        // Recalculate product rating
        const approvedReviews = (product.reviews || []).filter(
          (r) => (r.moderationStatus ?? 'pending') === 'approved',
        )
        const totalApprovedReviews = approvedReviews.length
        if (totalApprovedReviews > 0) {
          const aggregateRating = approvedReviews.reduce(
            (acc, entry) => acc + (entry.rating ?? 0),
            0,
          )
          product.rating = Number((aggregateRating / totalApprovedReviews).toFixed(2))
          product.reviewCount = totalApprovedReviews
        } else {
          product.rating = 0
          product.reviewCount = 0
        }

        product.markModified('reviews')
        await product.save()

        results.push({ productId, reviewId: actualReviewId, success: true })
      } catch (error: any) {
        results.push({
          productId: '',
          reviewId,
          success: false,
          error: error?.message || 'Unknown error',
        })
      }
    }

    const successCount = results.filter((r) => r.success).length
    res.json({
      success: true,
      message: `Approved ${successCount} of ${results.length} reviews`,
      results,
    })
  } catch (e) {
    console.error('Error in adminBulkApproveReviews:', e)
    res.status(500).json({ error: 'Server error' })
  }
}

// Bulk reject reviews
export const adminBulkRejectReviews = async (req: Request, res: Response) => {
  try {
    const { reviewIds, reason } = req.body
    const adminId = req.user?.userId

    if (!adminId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    if (!Array.isArray(reviewIds) || reviewIds.length === 0) {
      return res.status(400).json({ error: 'reviewIds array is required' })
    }

    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return res.status(400).json({ error: 'Rejection reason is required' })
    }

    const rejectionReason = reason.trim().slice(0, 500)
    const results: Array<{
      productId: string
      reviewId: string
      success: boolean
      error?: string
    }> = []

    for (const reviewId of reviewIds) {
      try {
        // Extract productId and reviewId from format "productId:reviewId"
        const [productId, actualReviewId] = reviewId.includes(':')
          ? reviewId.split(':')
          : [null, reviewId]

        if (!productId || !actualReviewId) {
          results.push({
            productId: '',
            reviewId,
            success: false,
            error: 'Invalid review ID format',
          })
          continue
        }

        const product = await Product.findById(productId)
        if (!product) {
          results.push({
            productId,
            reviewId: actualReviewId,
            success: false,
            error: 'Product not found',
          })
          continue
        }

        const reviews = Array.isArray(product.reviews) ? product.reviews : []
        const reviewIndex = reviews.findIndex((r) => r._id && r._id.toString() === actualReviewId)

        if (reviewIndex === -1) {
          results.push({
            productId,
            reviewId: actualReviewId,
            success: false,
            error: 'Review not found',
          })
          continue
        }

        const review = reviews[reviewIndex] as any
        review.moderationStatus = 'rejected'
        review.moderationReason = rejectionReason
        review.moderatedAt = new Date()
        review.moderatedBy = new mongoose.Types.ObjectId(adminId)

        // Recalculate product rating
        const approvedReviews = (product.reviews || []).filter(
          (r) => (r.moderationStatus ?? 'pending') === 'approved',
        )
        const totalApprovedReviews = approvedReviews.length
        if (totalApprovedReviews > 0) {
          const aggregateRating = approvedReviews.reduce(
            (acc, entry) => acc + (entry.rating ?? 0),
            0,
          )
          product.rating = Number((aggregateRating / totalApprovedReviews).toFixed(2))
          product.reviewCount = totalApprovedReviews
        } else {
          product.rating = 0
          product.reviewCount = 0
        }

        product.markModified('reviews')
        await product.save()

        results.push({ productId, reviewId: actualReviewId, success: true })
      } catch (error: any) {
        results.push({
          productId: '',
          reviewId,
          success: false,
          error: error?.message || 'Unknown error',
        })
      }
    }

    const successCount = results.filter((r) => r.success).length
    res.json({
      success: true,
      message: `Rejected ${successCount} of ${results.length} reviews`,
      results,
    })
  } catch (e) {
    console.error('Error in adminBulkRejectReviews:', e)
    res.status(500).json({ error: 'Server error' })
  }
}

// Get pending reviews count for dashboard
export const adminGetPendingReviewsCount = async (req: Request, res: Response) => {
  try {
    const products = await Product.find({
      reviews: { $exists: true, $ne: [] },
    })
      .select('reviews')
      .lean()

    let pendingCount = 0
    products.forEach((product) => {
      const reviews = Array.isArray(product.reviews) ? product.reviews : []
      reviews.forEach((review: any) => {
        const reviewStatus = review.moderationStatus ?? 'pending'
        if (reviewStatus === 'pending') {
          pendingCount++
        }
      })
    })

    res.json({ count: pendingCount })
  } catch (e) {
    console.error('Error in adminGetPendingReviewsCount:', e)
    res.status(500).json({ error: 'Server error' })
  }
}

// Get all reviews across all products (with status filter)
export const adminGetAllReviews = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 20, search, status } = req.query

    const pageNum = Number(page)
    const limitNum = Number(limit)
    const skip = (pageNum - 1) * limitNum

    // Find all products with reviews
    const products = await Product.find({
      reviews: { $exists: true, $ne: [] },
    })
      .select('name _id reviews')
      .lean()

    const allReviews: Array<{
      review: IProductReview
      productId: string
      productName: string
    }> = []

    products.forEach((product) => {
      const reviews = Array.isArray(product.reviews) ? product.reviews : []
      reviews.forEach((review: any) => {
        const reviewStatus = review.moderationStatus ?? 'pending'

        // Filter by status if provided
        if (status && status !== 'all') {
          if (reviewStatus !== status) return
        }

        // Filter by search if provided
        if (search) {
          const searchLower = String(search).toLowerCase()
          const matchesSearch =
            (review.comment && review.comment.toLowerCase().includes(searchLower)) ||
            (review.title && review.title.toLowerCase().includes(searchLower)) ||
            (review.reviewer?.name && review.reviewer.name.toLowerCase().includes(searchLower)) ||
            (product.name && product.name.toLowerCase().includes(searchLower))
          if (!matchesSearch) return
        }

        allReviews.push({
          review: review as IProductReview,
          productId: product._id.toString(),
          productName: product.name,
        })
      })
    })

    // Sort by creation date (newest first)
    allReviews.sort((a, b) => {
      const dateA = new Date(a.review.createdAt || 0).getTime()
      const dateB = new Date(b.review.createdAt || 0).getTime()
      return dateB - dateA
    })

    // Pagination
    const paginatedReviews = allReviews.slice(skip, skip + limitNum)

    const mappedReviews = paginatedReviews.map((item) =>
      mapReviewForAdmin(item.review, item.productId, item.productName),
    )

    res.json({
      reviews: mappedReviews,
      pagination: {
        total: allReviews.length,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(allReviews.length / limitNum),
      },
    })
  } catch (e) {
    console.error('Error in adminGetAllReviews:', e)
    res.status(500).json({ error: 'Server error' })
  }
}

// Delete a review
export const adminDeleteReview = async (req: Request, res: Response) => {
  try {
    const { productId, reviewId } = req.params
    const adminId = req.user?.userId

    if (!adminId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const product = await Product.findById(productId)

    if (!product) {
      return res.status(404).json({ error: 'Product not found' })
    }

    const reviews = Array.isArray(product.reviews) ? product.reviews : []
    const reviewIndex = reviews.findIndex((r) => r._id && r._id.toString() === reviewId)

    if (reviewIndex === -1) {
      return res.status(404).json({ error: 'Review not found' })
    }

    // Delete review images/videos from R2 if they exist
    const review = reviews[reviewIndex] as any
    if (review.images && Array.isArray(review.images) && review.images.length > 0) {
      try {
        await deleteMultipleFromR2(review.images)
      } catch (error) {
        console.error('Error deleting review images:', error)
        // Continue even if deletion fails
      }
    }
    if (review.videos && Array.isArray(review.videos) && review.videos.length > 0) {
      try {
        await deleteMultipleFromR2(review.videos)
      } catch (error) {
        console.error('Error deleting review videos:', error)
        // Continue even if deletion fails
      }
    }

    // Remove the review from the array
    reviews.splice(reviewIndex, 1)
    product.reviews = reviews

    // Recalculate product rating and review count (only approved reviews)
    const approvedReviews = reviews.filter((r) => (r.moderationStatus ?? 'pending') === 'approved')
    const totalApprovedReviews = approvedReviews.length
    if (totalApprovedReviews > 0) {
      const aggregateRating = approvedReviews.reduce((acc, entry) => acc + (entry.rating ?? 0), 0)
      product.rating = Number((aggregateRating / totalApprovedReviews).toFixed(2))
      product.reviewCount = totalApprovedReviews
    } else {
      product.rating = 0
      product.reviewCount = 0
    }

    product.markModified('reviews')
    await product.save()

    res.json({
      message: 'Review deleted successfully',
      rating: product.rating,
      reviewCount: product.reviewCount,
    })
  } catch (e) {
    console.error('Error in adminDeleteReview:', e)
    res.status(500).json({ error: 'Server error' })
  }
}
