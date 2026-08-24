import mongoose from 'mongoose'
import Category, { CertificateType } from '../models/Category'

/**
 * Get all related category IDs (parent and all children) for a given category
 * @param categoryId - The category ID
 * @returns Object with parentIds, childIds, and allIds (includes the category itself)
 */
export async function getRelatedCategoryIds(
  categoryId: string | mongoose.Types.ObjectId,
): Promise<{
  parentIds: mongoose.Types.ObjectId[]
  childIds: mongoose.Types.ObjectId[]
  allIds: mongoose.Types.ObjectId[]
}> {
  const id = typeof categoryId === 'string' ? new mongoose.Types.ObjectId(categoryId) : categoryId
  const parentIds: mongoose.Types.ObjectId[] = []
  const childIds: mongoose.Types.ObjectId[] = []

  // Get the category
  const category = await Category.findById(id)
  if (!category) {
    return { parentIds: [], childIds: [], allIds: [id] }
  }

  // Get all parent categories (walk up the tree)
  let currentCategory: any = category
  while (currentCategory && currentCategory.parent) {
    const parentId = currentCategory.parent
    if (parentId && !parentIds.some((p) => p.toString() === parentId.toString())) {
      parentIds.push(parentId)
      currentCategory = await Category.findById(parentId)
    } else {
      break
    }
  }

  // Get all child categories (recursively)
  const getChildrenRecursive = async (parentId: mongoose.Types.ObjectId) => {
    const children = await Category.find({ parent: parentId }).exec()
    for (const child of children) {
      const childId = child._id as mongoose.Types.ObjectId
      if (!childIds.some((c) => c.toString() === childId.toString())) {
        childIds.push(childId)
        // Recursively get grandchildren
        await getChildrenRecursive(childId)
      }
    }
  }

  await getChildrenRecursive(id)

  // Combine all IDs including the category itself
  const allIds = [id, ...parentIds, ...childIds]

  return { parentIds, childIds, allIds }
}

/**
 * Get required certificates for a category, considering parent inheritance
 * @param categoryId - The category ID to check
 * @returns Array of required certificate types
 */
export async function getRequiredCertificatesForCategory(
  categoryId: string | mongoose.Types.ObjectId,
): Promise<CertificateType[]> {
  // Convert to ObjectId if string
  let id: mongoose.Types.ObjectId
  try {
    id = typeof categoryId === 'string' ? new mongoose.Types.ObjectId(categoryId) : categoryId
  } catch (err) {
    console.error(`[getRequiredCertificatesForCategory] Invalid category ID: ${categoryId}`, err)
    return []
  }

  const category = await Category.findById(id)
  if (!category) {
    console.error(`[getRequiredCertificatesForCategory] Category not found: ${id}`)
    return []
  }

  // If category overrides parent rule, return only its own certificates
  if (category.overrideParentCertificateRule) {
    return category.requiredCertificates || []
  }

  // If category has a parent, check parent's certificates
  if (category.parent) {
    const parentCertificates = await getRequiredCertificatesForCategory(category.parent)
    const ownCertificates = category.requiredCertificates || []

    // Merge parent and own certificates, removing duplicates
    const allCertificates = [...new Set([...parentCertificates, ...ownCertificates])]
    return allCertificates
  }

  // No parent, return own certificates
  return category.requiredCertificates || []
}

/**
 * Check if a seller has valid (approved and not expired) certificates for required types
 * @param sellerId - The seller ID
 * @param requiredCertificates - Array of required certificate types
 * @returns Object with hasAllCertificates boolean and missingCertificates array
 */
export async function checkSellerCertificates(
  sellerId: string | mongoose.Types.ObjectId,
  requiredCertificates: CertificateType[],
): Promise<{
  hasAllCertificates: boolean
  missingCertificates: CertificateType[]
  validCertificates: CertificateType[]
}> {
  if (!requiredCertificates || requiredCertificates.length === 0) {
    return {
      hasAllCertificates: true,
      missingCertificates: [],
      validCertificates: [],
    }
  }

  const Certificate = mongoose.model('Certificate')
  const now = new Date()

  // Find all valid certificates for this seller
  // IMPORTANT: Only "approved" certificates count - pending/rejected/expired certificates don't count
  // This means products will require approval until certificates are approved by admin
  // Once approved and not expired, future products in the same category won't need approval
  // Must be approved status AND (no expiry date OR expiry date in the future)
  // Sort by verifiedOn (approval date) descending to prioritize most recently approved certificates
  const validCertificates = await Certificate.find({
    seller: sellerId,
    certificateType: { $in: requiredCertificates },
    status: 'approved', // Only approved certificates (excludes pending, rejected, expired)
    $or: [
      { expiryDate: { $exists: false } }, // No expiry date means it's valid forever
      { expiryDate: { $gt: now } }, // Expiry date must be in the future
    ],
  })
    .sort({ verifiedOn: -1, createdAt: -1 }) // Get most recently approved certificates first
    .exec()

  // Deduplicate by certificate type - only keep the most recent valid certificate per type
  // Since we sorted by verifiedOn descending, the first occurrence of each type is the most recent
  const certificateTypeMap = new Map<CertificateType, boolean>()
  for (const cert of validCertificates) {
    if (!certificateTypeMap.has(cert.certificateType)) {
      certificateTypeMap.set(cert.certificateType, true)
    }
  }

  const validCertificateTypes = Array.from(certificateTypeMap.keys())
  const missingCertificates = requiredCertificates.filter(
    (type) => !validCertificateTypes.includes(type),
  )

  return {
    hasAllCertificates: missingCertificates.length === 0,
    missingCertificates,
    validCertificates: validCertificateTypes,
  }
}
