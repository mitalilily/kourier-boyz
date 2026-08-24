import { Request, Response } from 'express'
import Category, { CertificateType } from '../models/Category'
import { getRequiredCertificatesForCategory } from '../utils/certificateUtils'
import { deleteFromR2, deleteMultipleFromR2, uploadToR2 } from '../utils/r2Upload'

type CertificateCache = Map<string, CertificateType[]>

const resolveRequiredCertificates = async (
  categoryId: string,
  cache: CertificateCache,
): Promise<CertificateType[]> => {
  const key = categoryId.toString()
  if (cache.has(key)) {
    return cache.get(key)!
  }
  const certs = await getRequiredCertificatesForCategory(categoryId)
  cache.set(key, certs)
  return certs
}

const decorateCategoryWithCertificates = async (
  category: any,
  cache: CertificateCache,
): Promise<any> => {
  const categoryId = category?._id?.toString()
  if (!categoryId) {
    return {
      ...category,
      effectiveRequiredCertificates: [],
      inheritedRequiredCertificates: [],
      inheritsParentCertificateRule: false,
    }
  }

  const ownCertificates: CertificateType[] = category.requiredCertificates || []
  const effectiveCertificates = await resolveRequiredCertificates(categoryId, cache)
  const inheritedCertificates = effectiveCertificates.filter(
    (certificate) => !ownCertificates.includes(certificate),
  )

  const inheritsParent = Boolean(category.parent) && !category.overrideParentCertificateRule

  return {
    ...category,
    effectiveRequiredCertificates: effectiveCertificates,
    inheritedRequiredCertificates: inheritedCertificates,
    inheritsParentCertificateRule: inheritsParent,
  }
}

// Recursive helper to get nested subcategories
const getNestedSubcategories = async (
  parentId: any,
  topOnly = false,
  certificateCache: CertificateCache,
): Promise<any[]> => {
  const query: any = { parent: parentId }
  if (topOnly) {
    query.top = true
  }

  const subcategories = await Category.find(query)
    .populate('parent', 'name slug')
    .sort({ name: 1 })
    .lean()

  // Recursively get subcategories for each subcategory
  const subcategoriesWithNested = await Promise.all(
    subcategories.map(async (subcat: any) => {
      const nested = await getNestedSubcategories(subcat._id, topOnly, certificateCache)
      return await decorateCategoryWithCertificates(
        { ...subcat, subcategories: nested },
        certificateCache,
      )
    }),
  )

  return subcategoriesWithNested
}

// --------------------
// GET all categories with search and filters
// --------------------
export const getCategories = async (req: Request, res: Response) => {
  try {
    const { search, status, top, parent, includeSubcategories } = req.query

    // Build query
    const query: any = {}

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ]
    }

    if (status) {
      query.status = status
    }

    // If top is requested AND includeSubcategories is true, get ALL top categories (root + subcategory)
    // Otherwise, if top is requested, only get root categories with top=true
    if (top !== undefined && top === 'true') {
      if (includeSubcategories === 'true') {
        // Get ALL categories with top=true (root and subcategory)
        query.top = true
        // Don't restrict parent, so we get both root and subcategories
      } else {
        // Get only root categories with top=true
        query.top = true
        query.parent = null
      }
    } else if (top !== undefined) {
      query.top = top === 'true'
    }

    // Filter by parent: null for root categories, specific ID for subcategories
    if (parent !== undefined && !(top === 'true' && includeSubcategories === 'true')) {
      // Don't override parent filter if we're getting all top categories including subcategories
      if (parent === 'null' || parent === '') {
        query.parent = null
      } else {
        query.parent = parent
      }
    }

    const categories = await Category.find(query)
      .populate('parent', 'name slug')
      .sort({ top: -1, createdAt: -1 })

    // If includeSubcategories is true, get subcategories for each category
    let categoriesWithSubcategories: any[] = []
    const certificateCache: CertificateCache = new Map()

    if (includeSubcategories === 'true') {
      // If we're getting top categories including subcategories, we already have all top categories
      // Organize them by parent-child relationship
      if (top === 'true') {
        // Separate root categories and subcategories - all with top=true
        const rootCategories = categories.filter((cat) => !cat.parent && cat.top)
        const topSubcategories = categories.filter((cat) => cat.parent && cat.top)

        // For each root category, get ONLY its top subcategories (nested recursively)
        categoriesWithSubcategories = await Promise.all(
          rootCategories.map(async (cat) => {
            const topSubcats = await getNestedSubcategories(cat._id, true, certificateCache)
            const catObj = cat.toObject()
            return await decorateCategoryWithCertificates(
              { ...catObj, subcategories: topSubcats },
              certificateCache,
            )
          }),
        )

        // Also add top subcategories that have non-top parents as standalone items
        for (const subcat of topSubcategories) {
          const subcatObj = subcat.toObject()
          const parentId = subcat.parent?.toString()
          // Check if parent is already included (as a top category)
          const parentIncluded = rootCategories.some((c) => c._id?.toString() === parentId)
          if (!parentIncluded && parentId) {
            const topSubSubcategories = await getNestedSubcategories(
              subcat._id,
              true,
              certificateCache,
            )
            const decorated = await decorateCategoryWithCertificates(
              {
                ...subcatObj,
                subcategories: topSubSubcategories,
              },
              certificateCache,
            )
            categoriesWithSubcategories.push(decorated)
          }
        }
      } else {
        // Normal case: get subcategories for each category (nested recursively)
        categoriesWithSubcategories = await Promise.all(
          categories.map(async (cat) => {
            const subcategories = await getNestedSubcategories(cat._id, false, certificateCache)
            const catObj = cat.toObject()
            return await decorateCategoryWithCertificates(
              { ...catObj, subcategories },
              certificateCache,
            )
          }),
        )
      }
    } else {
      categoriesWithSubcategories = await Promise.all(
        categories.map((cat) => decorateCategoryWithCertificates(cat.toObject(), certificateCache)),
      )
    }

    // Get stats
    const stats = {
      total: await Category.countDocuments(),
      active: await Category.countDocuments({ status: 'active' }),
      inactive: await Category.countDocuments({ status: 'inactive' }),
      top: await Category.countDocuments({ top: true }),
    }

    res.json({ categories: categoriesWithSubcategories, stats })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
}

// --------------------
// GET single category
// --------------------
export const getCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    // Try to find by ID first, then by slug
    let category = await Category.findById(id).populate('parent', 'name slug _id').lean()

    if (!category) {
      // If not found by ID, try to find by slug
      category = await Category.findOne({ slug: id }).populate('parent', 'name slug _id').lean()
    }

    if (!category) return res.status(404).json({ error: 'Category not found' })

    const certificateCache: CertificateCache = new Map()
    const subcategories = await getNestedSubcategories(category._id, false, certificateCache)

    const decoratedCategory = await decorateCategoryWithCertificates(
      { ...category, subcategories },
      certificateCache,
    )

    res.json(decoratedCategory)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
}

// --------------------
// CREATE category
// --------------------
export const createCategory = async (req: Request, res: Response) => {
  try {
    const {
      name,
      slug,
      description,
      top,
      status,
      suggestedAttributes,
      parent,
      mainImageUrl: providedMainImageUrl,
      hoverImageUrl: providedHoverImageUrl,
      bannerUrls: providedBannerUrls,
      requiredCertificates,
      overrideParentCertificateRule,
    } = req.body

    // Validate parent if provided
    if (parent && parent !== 'null' && parent !== '') {
      const parentCategory = await Category.findById(parent)
      if (!parentCategory) {
        return res.status(400).json({ error: 'Parent category not found' })
      }
    }

    // Handle main image - use provided URL or upload file
    let mainImageUrl: string
    if (
      providedMainImageUrl &&
      typeof providedMainImageUrl === 'string' &&
      providedMainImageUrl.trim()
    ) {
      mainImageUrl = providedMainImageUrl
    } else if (req.files && (req.files as any).mainImage && (req.files as any).mainImage[0]) {
      const mainImageFile = (req.files as any).mainImage[0]
      mainImageUrl = await uploadToR2(
        mainImageFile.buffer,
        mainImageFile.originalname,
        mainImageFile.mimetype,
        'categories',
      )
    } else {
      return res.status(400).json({
        error: 'Main image is required (either as URL or file upload)',
      })
    }

    // Handle hover image - use provided URL or upload file
    let hoverImageUrl: string
    if (
      providedHoverImageUrl &&
      typeof providedHoverImageUrl === 'string' &&
      providedHoverImageUrl.trim()
    ) {
      hoverImageUrl = providedHoverImageUrl
    } else if (req.files && (req.files as any).hoverImage && (req.files as any).hoverImage[0]) {
      const hoverImageFile = (req.files as any).hoverImage[0]
      hoverImageUrl = await uploadToR2(
        hoverImageFile.buffer,
        hoverImageFile.originalname,
        hoverImageFile.mimetype,
        'categories',
      )
    } else {
      return res.status(400).json({
        error: 'Hover image is required (either as URL or file upload)',
      })
    }

    // Handle banner images - use provided URLs or upload files
    let bannerUrls: string[] = []
    let parsedBannerUrls: string[] = []

    // Try to parse bannerUrls if it's a JSON string
    if (typeof providedBannerUrls === 'string' && providedBannerUrls.trim()) {
      try {
        parsedBannerUrls = JSON.parse(providedBannerUrls)
      } catch {
        // If parsing fails, treat as single URL
        if (providedBannerUrls.trim()) {
          parsedBannerUrls = [providedBannerUrls]
        }
      }
    } else if (Array.isArray(providedBannerUrls)) {
      parsedBannerUrls = providedBannerUrls
    }

    if (parsedBannerUrls.length > 0) {
      bannerUrls = parsedBannerUrls.filter((url: any) => typeof url === 'string' && url.trim())
    } else if (
      req.files &&
      (req.files as any).banners &&
      Array.isArray((req.files as any).banners)
    ) {
      const bannerFiles = (req.files as any).banners
      bannerUrls = await Promise.all(
        bannerFiles.map((file: any) =>
          uploadToR2(file.buffer, file.originalname, file.mimetype, 'categories'),
        ),
      )
    }

    // Parse requiredCertificates if it's a string (JSON)
    let parsedRequiredCertificates: string[] = []
    if (requiredCertificates) {
      if (typeof requiredCertificates === 'string') {
        try {
          parsedRequiredCertificates = JSON.parse(requiredCertificates)
        } catch {
          parsedRequiredCertificates = [requiredCertificates]
        }
      } else if (Array.isArray(requiredCertificates)) {
        parsedRequiredCertificates = requiredCertificates
      }
    }

    const category = await Category.create({
      name,
      slug:
        slug ||
        name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, ''),
      description,
      top: top === 'true' || top === true,
      status: status || 'active',
      mainImage: mainImageUrl,
      hoverImage: hoverImageUrl,
      banners: bannerUrls || [],
      parent: parent && parent !== 'null' && parent !== '' ? parent : null,
      suggestedAttributes: Array.isArray(suggestedAttributes)
        ? suggestedAttributes
        : typeof suggestedAttributes === 'string' && suggestedAttributes.trim().length
        ? suggestedAttributes.split(',').map((s: string) => s.trim())
        : [],
      requiredCertificates:
        parsedRequiredCertificates.length > 0 ? (parsedRequiredCertificates as any) : undefined,
      overrideParentCertificateRule:
        overrideParentCertificateRule === 'true' || overrideParentCertificateRule === true,
    })

    const populatedCategory = await Category.findById(category._id)
      .populate('parent', 'name slug')
      .lean()

    const certificateCache: CertificateCache = new Map()
    const decoratedCategory = populatedCategory
      ? await decorateCategoryWithCertificates(populatedCategory, certificateCache)
      : null

    res.status(201).json(decoratedCategory)
  } catch (err: any) {
    console.error('Error creating category:', err)
    if (err.code === 11000) {
      return res.status(400).json({ error: 'Category slug already exists under this parent' })
    }
    if (err.message && err.message.includes('parent')) {
      return res.status(400).json({ error: err.message })
    }
    res.status(500).json({ error: 'Server error' })
  }
}

// --------------------
// UPDATE category
// --------------------
export const updateCategory = async (req: Request, res: Response) => {
  try {
    const {
      name,
      slug,
      description,
      top,
      status,
      suggestedAttributes,
      parent,
      requiredCertificates,
      overrideParentCertificateRule,
    } = req.body
    const category = await Category.findById(req.params.id)
    if (!category) return res.status(404).json({ error: 'Category not found' })

    // Validate parent if provided
    if (parent !== undefined) {
      if (parent && parent !== 'null' && parent !== '') {
        const parentCategory = await Category.findById(parent)
        if (!parentCategory) {
          return res.status(400).json({ error: 'Parent category not found' })
        }
        // Prevent setting self as parent
        if (parent === req.params.id) {
          return res.status(400).json({ error: 'Category cannot be its own parent' })
        }
        category.parent = parent
      } else {
        category.parent = null
      }
    }

    if (req.files) {
      // Update main image
      if ((req.files as any).mainImage) {
        // Delete old main image from R2
        if (category.mainImage) {
          await deleteFromR2(category.mainImage).catch((err) =>
            console.error('Error deleting old main image:', err),
          )
        }

        // Upload new main image
        const mainImageFile = (req.files as any).mainImage[0]
        category.mainImage = await uploadToR2(
          mainImageFile.buffer,
          mainImageFile.originalname,
          mainImageFile.mimetype,
          'categories',
        )
      }

      // Update hover image
      if ((req.files as any).hoverImage) {
        // Delete old hover image from R2
        if (category.hoverImage) {
          await deleteFromR2(category.hoverImage).catch((err) =>
            console.error('Error deleting old hover image:', err),
          )
        }

        // Upload new hover image
        const hoverImageFile = (req.files as any).hoverImage[0]
        category.hoverImage = await uploadToR2(
          hoverImageFile.buffer,
          hoverImageFile.originalname,
          hoverImageFile.mimetype,
          'categories',
        )
      }

      // Update banners
      if ((req.files as any).banners) {
        // Delete old banners from R2
        if (category.banners && category.banners.length > 0) {
          await deleteMultipleFromR2(category.banners).catch((err) =>
            console.error('Error deleting old banners:', err),
          )
        }

        // Upload new banners
        const bannerFiles = (req.files as any).banners
        category.banners = await Promise.all(
          bannerFiles.map((file: any) =>
            uploadToR2(file.buffer, file.originalname, file.mimetype, 'categories'),
          ),
        )
      }
    }

    category.name = name ?? category.name
    category.slug = slug ?? category.slug
    category.description = description ?? category.description
    category.top = top !== undefined ? top === 'true' || top === true : category.top
    category.status = status ?? category.status
    if (suggestedAttributes !== undefined) {
      category.suggestedAttributes = Array.isArray(suggestedAttributes)
        ? suggestedAttributes
        : typeof suggestedAttributes === 'string' && suggestedAttributes.trim().length
        ? suggestedAttributes.split(',').map((s: string) => s.trim())
        : []
    }

    // Handle certificate requirements
    if (requiredCertificates !== undefined) {
      let parsedRequiredCertificates: string[] = []
      if (requiredCertificates) {
        if (typeof requiredCertificates === 'string') {
          try {
            parsedRequiredCertificates = JSON.parse(requiredCertificates)
          } catch {
            parsedRequiredCertificates = [requiredCertificates]
          }
        } else if (Array.isArray(requiredCertificates)) {
          parsedRequiredCertificates = requiredCertificates
        }
      }
      category.requiredCertificates =
        parsedRequiredCertificates.length > 0 ? (parsedRequiredCertificates as any) : undefined
    }

    if (overrideParentCertificateRule !== undefined) {
      category.overrideParentCertificateRule =
        overrideParentCertificateRule === 'true' || overrideParentCertificateRule === true
    }

    await category.save()
    const populatedCategory = await Category.findById(category._id)
      .populate('parent', 'name slug')
      .lean()
    const certificateCache: CertificateCache = new Map()
    const decoratedCategory = populatedCategory
      ? await decorateCategoryWithCertificates(populatedCategory, certificateCache)
      : null
    res.json(decoratedCategory)
  } catch (err: any) {
    console.error('Error updating category:', err)
    if (err.code === 11000) {
      return res.status(400).json({ error: 'Category slug already exists under this parent' })
    }
    if (err.message && err.message.includes('parent')) {
      return res.status(400).json({ error: err.message })
    }
    res.status(500).json({ error: 'Server error' })
  }
}

// --------------------
// DELETE category
// --------------------
export const deleteCategory = async (req: Request, res: Response) => {
  try {
    const category = await Category.findById(req.params.id)
    if (!category) return res.status(404).json({ error: 'Category not found' })

    // Check if category has subcategories
    const subcategoriesCount = await Category.countDocuments({
      parent: req.params.id,
    })
    if (subcategoriesCount > 0) {
      return res.status(400).json({
        error: `Cannot delete category. It has ${subcategoriesCount} subcategory(ies). Please delete or move subcategories first.`,
      })
    }

    // Delete all associated images from R2
    const filesToDelete: string[] = []

    if (category.mainImage) filesToDelete.push(category.mainImage)
    if (category.hoverImage) filesToDelete.push(category.hoverImage)
    if (category.banners && category.banners.length > 0) {
      filesToDelete.push(...category.banners)
    }

    // Delete files from R2
    if (filesToDelete.length > 0) {
      await deleteMultipleFromR2(filesToDelete).catch((err) =>
        console.error('Error deleting category images from R2:', err),
      )
    }

    // Delete category from database
    await Category.findByIdAndDelete(req.params.id)

    res.json({ message: 'Category deleted' })
  } catch (err) {
    console.error('Error deleting category:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// --------------------
// BULK DELETE categories
// --------------------
export const bulkDeleteCategories = async (req: Request, res: Response) => {
  try {
    const { ids } = req.body

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Please provide category IDs' })
    }

    const categories = await Category.find({ _id: { $in: ids } })

    // Collect all files to delete
    const filesToDelete: string[] = []
    categories.forEach((category) => {
      if (category.mainImage) filesToDelete.push(category.mainImage)
      if (category.hoverImage) filesToDelete.push(category.hoverImage)
      if (category.banners && category.banners.length > 0) {
        filesToDelete.push(...category.banners)
      }
    })

    // Delete files from R2
    if (filesToDelete.length > 0) {
      await deleteMultipleFromR2(filesToDelete).catch((err) =>
        console.error('Error deleting category images from R2:', err),
      )
    }

    // Delete categories from database
    await Category.deleteMany({ _id: { $in: ids } })

    res.json({ message: `${ids.length} categories deleted successfully` })
  } catch (err) {
    console.error('Error bulk deleting categories:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// --------------------
// BULK UPDATE status
// --------------------
export const bulkUpdateStatus = async (req: Request, res: Response) => {
  try {
    const { ids, status } = req.body

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Please provide category IDs' })
    }

    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' })
    }

    await Category.updateMany({ _id: { $in: ids } }, { status })

    res.json({ message: `${ids.length} categories updated successfully` })
  } catch (err) {
    console.error('Error bulk updating categories:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// --------------------
// GET subcategories of a category
// --------------------
export const getSubcategories = async (req: Request, res: Response) => {
  try {
    const subcategories = await Category.find({ parent: req.params.id })
      .populate('parent', 'name slug')
      .sort({ name: 1 })

    res.json(subcategories)
  } catch (err) {
    console.error('Error getting subcategories:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// --------------------
// GET root categories only
// --------------------
export const getRootCategories = async (req: Request, res: Response) => {
  try {
    const categories = await Category.find({ parent: null }).sort({
      top: -1,
      name: 1,
    })

    res.json(categories)
  } catch (err) {
    console.error('Error getting root categories:', err)
    res.status(500).json({ error: 'Server error' })
  }
}
