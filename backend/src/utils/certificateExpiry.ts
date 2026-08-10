import mongoose, { HydratedDocument } from 'mongoose'
import Category, { CertificateType } from '../models/Category'
import Certificate, { ICertificate } from '../models/Certificate'
import Product from '../models/Product'
import User from '../models/User'
import { notifyAdminCertificateExpiry } from './adminNotifications'
import {
  checkSellerCertificates,
  getRelatedCategoryIds,
  getRequiredCertificatesForCategory,
} from './certificateUtils'
import { emailTemplates, sendEmail } from './email'
import { createSellerNotification } from './sellerNotifications'

const MS_IN_DAY = 1000 * 60 * 60 * 24

const REMINDER_THRESHOLDS = [
  { type: '30_days' as const, days: 30 },
  { type: '7_days' as const, days: 7 },
  { type: '1_day' as const, days: 1 },
]

type ReminderType = (typeof REMINDER_THRESHOLDS)[number]['type'] | 'expired'

const formatCertificateLabel = (certificateType: string): string =>
  certificateType
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')

const hasReminderBeenSent = (
  certificate: HydratedDocument<ICertificate>,
  reminderType: ReminderType,
) => {
  return (
    certificate.expiryReminderHistory?.some((entry) => entry.reminderType === reminderType) ?? false
  )
}

const logReminder = (
  certificate: HydratedDocument<ICertificate>,
  reminderType: ReminderType,
  sentAt: Date,
) => {
  certificate.expiryReminderHistory = [
    ...(certificate.expiryReminderHistory || []),
    { reminderType, sentAt },
  ]
}

const sendReminderEmail = async (email: string, subject: string, html: string) => {
  try {
    await sendEmail(email, subject, html)
  } catch (err) {
    console.error('Error sending certificate reminder email:', err)
  }
}

const buildReminderEmail = (sellerName: string, certificateType: string, daysRemaining: number) => {
  const label = formatCertificateLabel(certificateType)
  const urgency =
    daysRemaining <= 1
      ? 'Your certificate expires tomorrow.'
      : `Your certificate will expire in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}.`

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
      <div style="background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <h1 style="color: #2563eb; margin-bottom: 20px;">Certificate Expiry Reminder</h1>
        <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
          Hi ${sellerName || 'Seller'},
        </p>
        <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
          ${urgency}
        </p>
        <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
          Certificate: <strong>${label}</strong>
        </p>
        <p style="font-size: 14px; color: #6b7280; margin-top: 20px;">
          Please upload a renewed certificate before it expires to avoid disruptions to your product listings.
        </p>
      </div>
    </div>
  `
}

// buildExpiryEmail is now replaced by emailTemplates.certificateExpiredSeller

/**
 * Process a single expired certificate (helper function for batch processing)
 * OPTIMIZATION: Non-blocking email sending, efficient queries
 */
async function processExpiredCertificate(certificate: any, now: Date, io: any): Promise<void> {
  if (!certificate.expiryDate) return

  const certificateId = (certificate._id as mongoose.Types.ObjectId)?.toString() ?? 'unknown'
  const sellerRef = certificate.seller as any
  let sellerId = sellerRef?._id?.toString() ?? sellerRef?.toString?.()
  let sellerEmail = sellerRef?.email
  let sellerName = sellerRef?.businessName || sellerRef?.name || 'Seller'

  // Fetch seller if not populated
  if (!sellerEmail && certificate.seller) {
    const seller = await User.findById(certificate.seller).select('email name businessName').lean()
    if (!seller?.email) {
      console.warn(
        `[Certificate Expiry Job] Skipping certificate ${certificate._id}: seller email not found`,
      )
      return
    }
    sellerEmail = seller.email
    sellerName = seller.businessName || seller.name || sellerName
    sellerId = (seller as any)._id?.toString() ?? sellerId
  }

  if (!sellerEmail || !sellerId) return

  // Check if already processed
  const certDoc = await Certificate.findById(certificate._id)
  if (!certDoc) return

  if (certDoc.status === 'expired' && hasReminderBeenSent(certDoc, 'expired')) {
    // Already processed, skip
    return
  }

  // Update certificate status
  certDoc.status = 'expired'
  logReminder(certDoc, 'expired', now)
  await certDoc.save()

  // Update products (seller-specific)
  const updatedProductCount = await updateProductsForExpiredCertificate(
    sellerId,
    certificate.certificateType,
  )

  // Prepare URLs
  const certificatesUrl = `${process.env.SELLER_PANEL_URL || 'http://localhost:5175'}/certificates`
  const productsUrl = `${
    process.env.ADMIN_PANEL_URL || 'http://localhost:5174'
  }/products?status=pending_approval&seller=${sellerId}`

  // OPTIMIZATION: Send notifications asynchronously (fire and forget)
  // Email to seller
  sendEmail(
    sellerEmail,
    'Certificate Expired - Action Required',
    emailTemplates.certificateExpiredSeller(
      sellerName,
      certificate.certificateType,
      updatedProductCount,
      certificatesUrl,
    ),
  ).catch((err) => console.error('Error sending certificate expiry email to seller:', err))

  // In-app notification to seller
  createSellerNotification({
    sellerId,
    title: 'Certificate Expired',
    message: `Your ${formatCertificateLabel(
      certificate.certificateType,
    )} certificate has expired. ${updatedProductCount} product(s) have been moved to pending approval. Please upload a renewed certificate.`,
    link: '/certificates',
    type: 'system',
  }).catch((err) => console.error('Error creating seller notification:', err))

  // Email to admin
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL
  if (adminEmail) {
    sendEmail(
      adminEmail,
      'Certificate Expired - Products Require Approval',
      emailTemplates.certificateExpiredAdmin(
        sellerName,
        sellerEmail,
        certificate.certificateType,
        updatedProductCount,
        productsUrl,
      ),
    ).catch((err) => console.error('Error sending certificate expiry email to admin:', err))
  }

  // In-app notification to admin
  notifyAdminCertificateExpiry(
    sellerId,
    sellerName,
    certificate.certificateType,
    updatedProductCount,
  ).catch((err) => console.error('Error creating admin notification:', err))

  // Socket event (non-blocking)
  io.to(`user:${sellerId}`).emit('certificate:update', {
    certificateId,
    certificateType: certificate.certificateType,
    status: 'expired',
    expiryDate: certificate.expiryDate,
    message: 'Certificate has expired. Please upload an updated document.',
    triggeredAt: new Date().toISOString(),
  })
}

// Cache for category certificate requirements to avoid repeated queries
const categoryCertificateCache = new Map<string, CertificateType[]>()
const categoryCacheExpiry = 5 * 60 * 1000 // 5 minutes cache
let categoryCacheTimestamp = 0

/**
 * Get cached or fresh category certificate requirements
 * This significantly reduces database queries when multiple certificates expire
 */
async function getCachedCategoryCertificates(
  categoryId: mongoose.Types.ObjectId,
): Promise<CertificateType[]> {
  const cacheKey = categoryId.toString()
  const now = Date.now()

  // Clear cache if expired
  if (now - categoryCacheTimestamp > categoryCacheExpiry) {
    categoryCertificateCache.clear()
    categoryCacheTimestamp = now
  }

  // Return cached if available
  if (categoryCertificateCache.has(cacheKey)) {
    return categoryCertificateCache.get(cacheKey)!
  }

  // Fetch and cache
  const certificates = await getRequiredCertificatesForCategory(categoryId)
  categoryCertificateCache.set(cacheKey, certificates)
  return certificates
}

/**
 * Update products to pending_approval when a certificate expires
 * Finds all categories that require the expired certificate type,
 * then updates all products in those categories for the seller
 * OPTIMIZED: Uses caching and bulk operations
 */
export const updateProductsForExpiredCertificate = async (
  sellerId: string | mongoose.Types.ObjectId,
  expiredCertificateType: CertificateType,
): Promise<number> => {
  try {
    // Convert sellerId to ObjectId if string
    const sellerObjectId =
      typeof sellerId === 'string' ? new mongoose.Types.ObjectId(sellerId) : sellerId

    // OPTIMIZATION: Find the expired certificate first to get its ID
    // This avoids unnecessary category lookups if no certificate exists
    const expiredCertificate = await Certificate.findOne({
      seller: sellerObjectId,
      certificateType: expiredCertificateType,
      status: 'expired',
    })
      .select('_id')
      .sort({ createdAt: -1 })
      .lean()
      .exec()

    if (!expiredCertificate) {
      // No expired certificate found, nothing to update
      return 0
    }

    const expiredCertificateId = expiredCertificate._id as mongoose.Types.ObjectId

    // OPTIMIZATION: Find categories that require this certificate type
    // Use lean() for faster queries and only select needed fields
    const allCategories = await Category.find({ status: 'active' })
      .select('_id name parent requiredCertificates overrideParentCertificateRule')
      .lean()
      .exec()

    const affectedCategoryIds = new Set<string>()

    // OPTIMIZATION: Process categories in parallel batches
    const categoryChecks = allCategories.map(async (category) => {
      const categoryId = category._id as mongoose.Types.ObjectId
      const requiredCertificates = await getCachedCategoryCertificates(categoryId)
      if (requiredCertificates.includes(expiredCertificateType)) {
        affectedCategoryIds.add(categoryId.toString())
        // Get related categories (parent and children)
        const related = await getRelatedCategoryIds(categoryId)
        related.allIds.forEach((id) => affectedCategoryIds.add(id.toString()))
      }
    })

    // Wait for all category checks to complete
    await Promise.all(categoryChecks)

    // Convert Set to Array of ObjectIds
    const allAffectedCategoryIds = Array.from(affectedCategoryIds).map(
      (id) => new mongoose.Types.ObjectId(id),
    )

    if (allAffectedCategoryIds.length === 0) {
      // No categories require this certificate type, nothing to update
      return 0
    }

    // OPTIMIZATION: Single bulk update query - no need for separate count queries
    // Update all matching products to pending_approval in one operation
    const updateQuery: any = {
      seller: sellerObjectId, // CRITICAL: Seller-specific
      $or: [
        {
          category: { $in: allAffectedCategoryIds },
          status: {
            $in: ['active', 'inactive', 'out_of_stock', 'pending_approval'],
          },
        },
        {
          certificateIds: expiredCertificateId,
          status: {
            $in: ['active', 'inactive', 'out_of_stock', 'pending_approval'],
          },
        },
      ],
    }

    const result = await Product.updateMany(updateQuery, {
      $set: { status: 'pending_approval' },
    })

    if (result.matchedCount > 0) {
      console.log(
        `[Certificate Expiry] Updated ${result.modifiedCount} product(s) for seller ${sellerObjectId}, certificate type ${expiredCertificateType}`,
      )
    }

    return result.modifiedCount || 0
  } catch (error) {
    console.error(
      `Error updating products for expired certificate ${expiredCertificateType} for seller ${sellerId}:`,
      error,
    )
    return 0
  }
}

/**
 * Update products to active status when a certificate is approved
 * Finds all categories that require the approved certificate type,
 * then updates all products in those categories for the seller that are in pending_approval
 * Only updates products where seller now has all required certificates for the category
 * OPTIMIZED: Uses caching and bulk operations
 */
export const updateProductsForApprovedCertificate = async (
  sellerId: string | mongoose.Types.ObjectId,
  approvedCertificateType: CertificateType,
): Promise<number> => {
  try {
    // Convert sellerId to ObjectId if string
    const sellerObjectId =
      typeof sellerId === 'string' ? new mongoose.Types.ObjectId(sellerId) : sellerId

    // Find categories that require this certificate type
    const allCategories = await Category.find({ status: 'active' })
      .select('_id name parent requiredCertificates overrideParentCertificateRule')
      .lean()
      .exec()

    const affectedCategoryIds = new Set<string>()

    // Process categories to find those that require this certificate
    const categoryChecks = allCategories.map(async (category) => {
      const categoryId = category._id as mongoose.Types.ObjectId
      const requiredCertificates = await getCachedCategoryCertificates(categoryId)
      if (requiredCertificates.includes(approvedCertificateType)) {
        affectedCategoryIds.add(categoryId.toString())
        // Get related categories (parent and children)
        const related = await getRelatedCategoryIds(categoryId)
        related.allIds.forEach((id) => affectedCategoryIds.add(id.toString()))
      }
    })

    // Wait for all category checks to complete
    await Promise.all(categoryChecks)

    // Convert Set to Array of ObjectIds
    const allAffectedCategoryIds = Array.from(affectedCategoryIds).map(
      (id) => new mongoose.Types.ObjectId(id),
    )

    if (allAffectedCategoryIds.length === 0) {
      // No categories require this certificate type, nothing to update
      return 0
    }

    // Find all products in pending_approval status for this seller in affected categories
    const productsInPendingApproval = await Product.find({
      seller: sellerObjectId,
      category: { $in: allAffectedCategoryIds },
      status: 'pending_approval',
    }).lean()

    if (productsInPendingApproval.length === 0) {
      return 0
    }

    // For each product, check if seller now has all required certificates for its category
    const productsToApprove: mongoose.Types.ObjectId[] = []

    for (const product of productsInPendingApproval) {
      const categoryId = product.category as mongoose.Types.ObjectId
      const requiredCertificates = await getCachedCategoryCertificates(categoryId)

      // Check if seller has all required certificates for this category
      const { hasAllCertificates } = await checkSellerCertificates(
        sellerObjectId,
        requiredCertificates,
      )

      if (hasAllCertificates) {
        productsToApprove.push(product._id as mongoose.Types.ObjectId)
      }
    }

    if (productsToApprove.length === 0) {
      return 0
    }

    // Update products to active status (or appropriate status based on stock)
    // We'll update to active, and let the product model hooks handle stock-based status if needed
    const result = await Product.updateMany(
      {
        _id: { $in: productsToApprove },
        status: 'pending_approval',
      },
      {
        $set: { status: 'active' },
      },
    )

    // After updating, we need to check stock and set appropriate status
    // For variant products, check totalStock; for simple products, check stock
    const updatedProducts = await Product.find({
      _id: { $in: productsToApprove },
    }).exec()

    for (const product of updatedProducts) {
      let targetStatus: 'active' | 'out_of_stock' = 'active'

      if (product.hasVariants) {
        // For variant products, check totalStock
        if ((product.totalStock || 0) === 0) {
          targetStatus = 'out_of_stock'
        }
      } else {
        // For simple products, check stock
        if ((product.stock || 0) === 0) {
          targetStatus = 'out_of_stock'
        }
      }

      if (product.status !== targetStatus) {
        product.status = targetStatus
        await product.save()
      }
    }

    if (result.matchedCount > 0) {
      console.log(
        `[Certificate Approval] Updated ${result.modifiedCount} product(s) for seller ${sellerObjectId}, certificate type ${approvedCertificateType}`,
      )
    }

    return result.modifiedCount || 0
  } catch (error) {
    console.error(
      `Error updating products for approved certificate ${approvedCertificateType} for seller ${sellerId}:`,
      error,
    )
    return 0
  }
}

export const runCertificateExpiryChecks = async () => {
  const now = new Date()
  const { io } = await import('../server')

  console.log(`[Certificate Expiry Job] Starting check at ${now.toISOString()}`)

  // OPTIMIZATION: Separate queries for expired vs reminders to optimize database queries
  // Query 1: Certificates that have expired (need product updates)
  const expiredCertificates = await Certificate.find({
    expiryDate: { $exists: true, $lte: now },
    status: { $in: ['approved', 'pending'] },
  })
    .populate('seller', 'email name businessName')
    .lean()
    .exec()

  // Query 2: Certificates needing reminders (not expired yet)
  const reminderCertificates = await Certificate.find({
    expiryDate: { $exists: true, $gt: now },
    status: 'approved',
  })
    .populate('seller', 'email name businessName')
    .lean()
    .exec()

  console.log(
    `[Certificate Expiry Job] Found ${expiredCertificates.length} expired certificate(s) and ${reminderCertificates.length} certificate(s) needing reminders`,
  )

  let processedCount = 0
  let expiredCount = 0
  let reminderCount = 0
  let errorCount = 0

  // OPTIMIZATION: Process expired certificates with limited concurrency to avoid overwhelming the server
  const MAX_CONCURRENT_EXPIRED = 5 // Process max 5 expired certificates at a time
  const expiredBatches: (typeof expiredCertificates)[] = []
  for (let i = 0; i < expiredCertificates.length; i += MAX_CONCURRENT_EXPIRED) {
    expiredBatches.push(expiredCertificates.slice(i, i + MAX_CONCURRENT_EXPIRED))
  }

  // Process expired certificates in batches
  for (const batch of expiredBatches) {
    await Promise.all(
      batch.map(async (certificate) => {
        processedCount++
        try {
          await processExpiredCertificate(certificate, now, io)
          expiredCount++
        } catch (error) {
          errorCount++
          console.error(
            `[Certificate Expiry Job] Error processing expired certificate ${certificate._id}:`,
            error,
          )
        }
      }),
    )
  }

  // Process reminder certificates (non-blocking, fire and forget)
  for (const certificate of reminderCertificates) {
    processedCount++
    try {
      if (!certificate.expiryDate) continue

      const certificateId = (certificate._id as mongoose.Types.ObjectId)?.toString() ?? 'unknown'
      const sellerRef = certificate.seller as any
      const sellerId = sellerRef?._id?.toString() ?? sellerRef?.toString?.()
      const sellerEmail = sellerRef?.email
      const sellerName = sellerRef?.businessName || sellerRef?.name || 'Seller'

      if (!sellerEmail || !sellerId) continue

      const expiryTime = new Date(certificate.expiryDate).getTime()
      const nowTime = now.getTime()
      const daysUntilExpiry = Math.ceil((expiryTime - nowTime) / MS_IN_DAY)

      if (daysUntilExpiry <= 0) continue

      let updated = false
      for (const { type, days } of REMINDER_THRESHOLDS) {
        if (daysUntilExpiry <= days && !hasReminderBeenSent(certificate as any, type)) {
          reminderCount++
          const remaining = Math.max(daysUntilExpiry, 0)
          // OPTIMIZATION: Fire and forget - don't wait for email
          sendReminderEmail(
            sellerEmail,
            `Certificate expiring in ${days} day${days === 1 ? '' : 's'}`,
            buildReminderEmail(sellerName, certificate.certificateType, remaining),
          ).catch((err) => console.error('Error sending reminder email:', err))

          // Update certificate reminder history
          await Certificate.findByIdAndUpdate(certificate._id, {
            $push: {
              expiryReminderHistory: { reminderType: type, sentAt: now },
            },
          })

          // Emit socket event (non-blocking)
          if (sellerId) {
            io.to(`user:${sellerId}`).emit('certificate:reminder', {
              certificateId,
              certificateType: certificate.certificateType,
              reminderType: type,
              daysRemaining: remaining,
              expiryDate: certificate.expiryDate,
              message: `Certificate expires in ${remaining} day${remaining === 1 ? '' : 's'}.`,
              triggeredAt: new Date().toISOString(),
            })
          }
          updated = true
        }
      }
    } catch (error) {
      errorCount++
      console.error(
        `[Certificate Expiry Job] Error processing reminder certificate ${certificate._id}:`,
        error,
      )
    }
  }

  console.log(
    `[Certificate Expiry Job] Completed: Processed ${processedCount} certificates, ${expiredCount} expired, ${reminderCount} reminders sent, ${errorCount} errors`,
  )
}
