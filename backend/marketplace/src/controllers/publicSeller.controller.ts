import { Request, Response } from 'express'
import Product from '../models/Product'
import ProductVariant from '../models/ProductVariant'
import User from '../models/User'

// Get seller public profile by slug
export const getSellerBySlug = async (req: Request, res: Response) => {
  try {
    const { slug } = req.params

    if (!slug) {
      return res.status(400).json({ error: 'Slug is required' })
    }

    // Find seller by slug, must be approved
    const seller = await User.findOne({
      storeSlug: slug.toLowerCase(),
      role: 'seller',
      isApproved: true,
      storeStatus: 'active', // Only show active stores
    }).select(
      '-password -emailVerificationToken -resetPasswordToken -phoneVerificationCode -tempEmailOTP',
    )

    if (!seller) {
      return res.status(404).json({ error: 'Seller not found' })
    }

    // Return public seller data
    const sellerData = {
      _id: seller._id,
      name: seller.name,
      businessName: seller.businessName,
      storeLogo: seller.storeLogo,
      storeSlug: seller.storeSlug,
      storeBanner: seller.storeBanner, // Single banner for header
      storefrontBanners: seller.storefrontBanners || [], // Multiple banners for home page (below categories)
      storeVideo: seller.storeVideo, // Video URL (YouTube, Vimeo, etc.)
      storeVideoFile: seller.storeVideoFile, // Uploaded video file (either this OR storeVideo, not both)
      storeDescription: seller.storeDescription,
      storeStatus: seller.storeStatus,
      // Store Policies
      shippingPolicy: seller.shippingPolicy,
      returnPolicy: seller.returnPolicy,
      refundPolicy: seller.refundPolicy,
      cancellationPolicy: seller.cancellationPolicy,
      warrantyPolicy: seller.warrantyPolicy,
      replacementPolicy: seller.replacementPolicy,
      // Shipping Settings
      defaultShippingRate: seller.defaultShippingRate,
      // Contact Information
      storeEmail: seller.storeEmail,
      storePhone: seller.storePhone,
      supportEmail: seller.supportEmail,
      // Social Media
      website: seller.website,
      facebook: seller.facebook,
      instagram: seller.instagram,
      twitter: seller.twitter,
      youtube: seller.youtube,
      linkedin: seller.linkedin,
      // SEO
      storeMetaTitle: seller.storeMetaTitle,
      storeMetaDescription: seller.storeMetaDescription,
      // Brand
      brandNames: seller.brandNames,
      // Theme
      storeTheme: seller.storeTheme || 'modern',
      createdAt: seller.createdAt,
    }

    res.json(sellerData)
  } catch (error) {
    console.error('Error fetching seller by slug:', error)
    res.status(500).json({ error: 'Server error' })
  }
}

// Get seller categories (public)
export const getSellerCategoriesBySlug = async (req: Request, res: Response) => {
  try {
    const { slug } = req.params

    if (!slug) {
      return res.status(400).json({ error: 'Slug is required' })
    }

    // Find seller by slug
    const seller = await User.findOne({
      storeSlug: slug.toLowerCase(),
      role: 'seller',
      isApproved: true,
      storeStatus: 'active',
    })

    if (!seller) {
      return res.status(404).json({ error: 'Seller not found' })
    }

    // Get distinct categories from seller's products
    const CategoryModel = require('../models/Category').default
    const categoryIds = await Product.distinct('category', {
      seller: seller._id,
      status: 'active',
    })

    if (categoryIds.length === 0) {
      return res.json({ categories: [] })
    }

    // Get all category details (including parent information)
    const categoryDetails = await CategoryModel.find({
      _id: { $in: categoryIds },
      status: 'active',
    })
      .select('name slug mainImage parent')
      .populate('parent', 'name slug')
      .lean()

    // Get product count per category
    const categoryCounts = await Product.aggregate([
      {
        $match: {
          seller: seller._id,
          status: 'active',
        },
      },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
        },
      },
    ])

    const countMap = categoryCounts.reduce((acc: any, item: any) => {
      acc[item._id.toString()] = item.count
      return acc
    }, {})

    // Separate root categories (no parent) and subcategories (have parent)
    const rootCategories = categoryDetails.filter((cat: any) => !cat.parent)
    const subcategories = categoryDetails.filter((cat: any) => cat.parent)

    // Group subcategories by their parent ID
    const subcategoriesByParentId: Record<string, any[]> = {}
    
    subcategories.forEach((subcat: any) => {
      const parentId = subcat.parent._id.toString()
      if (!subcategoriesByParentId[parentId]) {
        subcategoriesByParentId[parentId] = []
      }
      subcategoriesByParentId[parentId].push({
        _id: subcat._id,
        name: subcat.name,
        slug: subcat.slug,
        mainImage: subcat.mainImage,
        parent: subcat.parent,
        productCount: countMap[subcat._id.toString()] || 0,
      })
    })

    // Build parent categories with their subcategories
    // First, get all unique parent IDs from subcategories
    const parentIds = new Set<string>()
    subcategories.forEach((subcat: any) => {
      if (subcat.parent && subcat.parent._id) {
        parentIds.add(subcat.parent._id.toString())
      }
    })

    // Get all parent category details (even if seller doesn't have products in parent itself)
    const allParentCategories = await CategoryModel.find({
      _id: { $in: Array.from(parentIds) },
      status: 'active',
    })
      .select('name slug mainImage parent')
      .lean()

    // Combine root categories (from products) and parent categories (from subcategories)
    const allParentCategoryIds = new Set<string>()
    rootCategories.forEach((cat: any) => {
      allParentCategoryIds.add(cat._id.toString())
    })
    allParentCategories.forEach((cat: any) => {
      allParentCategoryIds.add(cat._id.toString())
    })

    // Get final parent category details
    const finalParentCategories = await CategoryModel.find({
      _id: { $in: Array.from(allParentCategoryIds) },
      status: 'active',
    })
      .select('name slug mainImage parent')
      .lean()

    // Build the response: parent categories with their subcategories
    const categoriesWithSubcategories = finalParentCategories.map((parentCat: any) => {
      const subcats = subcategoriesByParentId[parentCat._id.toString()] || []
      
      // Calculate total product count: products in parent + products in all subcategories
      const parentCount = countMap[parentCat._id.toString()] || 0
      const subcategoriesCount = subcats.reduce((sum: number, subcat: any) => sum + (subcat.productCount || 0), 0)
      const totalProductCount = parentCount + subcategoriesCount

      return {
        _id: parentCat._id,
        name: parentCat.name,
        slug: parentCat.slug,
        mainImage: parentCat.mainImage,
        productCount: totalProductCount,
        subcategories: subcats.length > 0 ? subcats : undefined,
      }
    })

    // Sort by name
    categoriesWithSubcategories.sort((a: any, b: any) => a.name.localeCompare(b.name))

    res.json({ categories: categoriesWithSubcategories })
  } catch (error) {
    console.error('Error fetching seller categories by slug:', error)
    res.status(500).json({ error: 'Server error' })
  }
}

// Get seller products by slug (public)
export const getSellerProductsBySlug = async (req: Request, res: Response) => {
  try {
    const { slug } = req.params
    const {
      status = 'active',
      search,
      category,
      featured,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      order = 'desc',
      minPrice,
      maxPrice,
    } = req.query

    if (!slug) {
      return res.status(400).json({ error: 'Slug is required' })
    }

    // Find seller by slug
    const seller = await User.findOne({
      storeSlug: slug.toLowerCase(),
      role: 'seller',
      isApproved: true,
      storeStatus: 'active',
    })

    if (!seller) {
      return res.status(404).json({ error: 'Seller not found' })
    }

    // Build filter for products
    const filter: Record<string, any> = {
      seller: seller._id,
      status: status === 'active' ? 'active' : status, // Only show active products by default
    }

    // Filter by category (including subcategories if it's a root category)
    if (category) {
      const CategoryModel = require('../models/Category').default
      const categoryDoc = await CategoryModel.findById(category).populate('parent').lean()
      if (categoryDoc) {
        // If category has a parent, it's a subcategory - show only that subcategory
        // If category doesn't have a parent, it's a root category - show it and its subcategories
        if (categoryDoc.parent) {
          // Subcategory selected - show only products from this subcategory
          filter.category = category
        } else {
          // Root category selected - show products from this category and its subcategories
          const subcategoryIds = await CategoryModel.find({
            $or: [{ _id: category }, { parent: category }],
          }).distinct('_id')
          filter.category = { $in: subcategoryIds }
        }
      } else {
        filter.category = category
      }
    }

    // Filter by featured products
    if (featured === 'true') {
      filter.isFeatured = true
    }

    // Search filter - searches in name, description, brand, and SKU
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { brand: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } },
      ]
    }

    // Price filters - use $and to combine with search filter
    if (minPrice || maxPrice) {
      const priceFilter: any = {}
      if (minPrice) {
        priceFilter['variants.sellingPrice'] = { $gte: Number(minPrice) }
      }
      if (maxPrice) {
        priceFilter['variants.sellingPrice'] = {
          ...priceFilter['variants.sellingPrice'],
          $lte: Number(maxPrice),
        }
      }
      if (Object.keys(priceFilter).length > 0) {
        filter.$and = filter.$and || []
        filter.$and.push(priceFilter)
      }
    }

    const skip = (Number(page) - 1) * Number(limit)
    const sortOptions: Record<string, 1 | -1> = { [sortBy as string]: order === 'desc' ? -1 : 1 }

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
        .populate({
          path: 'seller',
          select: 'name businessName storeLogo storeSlug',
        })
        .select('-__v')
        .sort(sortOptions)
        .skip(skip)
        .limit(Number(limit)),
      Product.countDocuments(filter),
    ])

    // Get variants for products that have them
    const productIds = products.map((p) => p._id)
    const variants = await ProductVariant.find({
      product: { $in: productIds },
      status: 'active',
    }).select('product name sku price effectivePrice comparePrice stock images attributes mainImage')

    // Group variants by product
    const variantsByProduct = variants.reduce((acc: any, variant: any) => {
      const productId = variant.product.toString()
      if (!acc[productId]) {
        acc[productId] = []
      }
      acc[productId].push({
        _id: variant._id,
        name: variant.name,
        sku: variant.sku,
        sellingPrice: variant.effectivePrice ?? variant.price,
        originalPrice: variant.comparePrice,
        stock: variant.stock,
        images: variant.images,
        attributes: variant.attributes,
        mainImage: variant.mainImage,
      })
      return acc
    }, {})

    // Format products for public view
    const formattedProducts = products.map((product: any) => ({
      _id: product._id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      brand: product.brand,
      mainImage: product.mainImage,
      images: product.images,
      category: product.category,
      seller: product.seller,
      status: product.status,
      isFeatured: product.isFeatured,
      hasVariants: product.hasVariants,
      variants: product.hasVariants ? variantsByProduct[product._id.toString()] || [] : [],
      sellingPrice: product.effectivePrice ?? product.price,
      originalPrice: product.comparePrice,
      stock: product.stock,
      totalStock: product.totalStock,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    }))

    res.json({
      products: formattedProducts,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
    })
  } catch (error) {
    console.error('Error fetching seller products by slug:', error)
    res.status(500).json({ error: 'Server error' })
  }
}

