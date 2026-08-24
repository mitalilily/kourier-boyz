import { Request, Response } from 'express'
import mongoose from 'mongoose'
import Cart from '../models/Cart'
import Category from '../models/Category'
import CustomAttribute from '../models/CustomAttribute'
import InventoryLog from '../models/InventoryLog'
import Order from '../models/Order'
import Product from '../models/Product'
import ProductVariant from '../models/ProductVariant'
import User from '../models/User'
import { io } from '../server'
import { shippingProviderService } from '../services/shippingProvider.service'
import {
  generateSlug,
  generateUniqueVariantSku,
  normalizeFilterMetadata,
  updateProductTotalStock,
} from '../services/products/utils'
import {
  checkSellerCertificates,
  getRequiredCertificatesForCategory,
} from '../utils/certificateUtils'
import Certificate from '../models/Certificate'
import Brand from '../models/Brand'
import BrandCategoryScope from '../models/BrandCategoryScope'
import CategoryExtensionRequest from '../models/CategoryExtensionRequest'
import crypto from 'crypto'
import { R2_CONFIG } from '../config/r2.config'
import {
  deleteFromR2,
  deleteMultipleFromR2,
  getPresignedUploadUrl,
  sanitizeFileName,
  uploadToR2,
} from '../utils/r2Upload'

const uploadFilesToR2 = async (
  files: Express.Multer.File[] | undefined,
  sellerId: string,
  folder: string,
  timestamp: number,
  errorLabel?: string,
): Promise<string[]> => {
  if (!files || files.length === 0) return []
  return Promise.all(
    files.map((file, index) =>
      uploadToR2(
        file.buffer,
        `${sellerId}/${timestamp}-${index}-${file.originalname}`,
        file.mimetype,
        folder,
      ).catch((error) => {
        if (errorLabel) {
          throw new Error(`Failed to upload ${errorLabel}: ${file.originalname}`)
        }
        throw error
      }),
    ),
  )
}
const isEmptyFormValue = (value: unknown): boolean => {
  if (value === undefined || value === null) return true
  if (typeof value !== 'string') return false

  const normalized = value.trim().toLowerCase()
  return normalized === '' || normalized === 'undefined' || normalized === 'null'
}

const parseOptionalJsonField = <T>(
  value: unknown,
  fieldName: string,
  fallback?: T,
): T | undefined => {
  if (isEmptyFormValue(value)) return fallback
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T
    } catch {
      throw new Error(`Invalid ${fieldName} format`)
    }
  }
  return value as T
}

const parseOptionalNumber = (value: unknown, fieldName: string): number | undefined => {
  if (isEmptyFormValue(value)) return undefined

  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid ${fieldName} value`)
  }

  return parsed
}

export const getProductMediaPresign = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user?.userId
    if (!sellerId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const { fileName, contentType, scope } = req.body as {
      fileName?: string
      contentType?: string
      scope?: 'product' | 'variant' | 'other'
    }

    if (!fileName || !contentType) {
      return res.status(400).json({ error: 'fileName and contentType are required' })
    }

    const safeName = sanitizeFileName(fileName)
    const folder = scope === 'variant' ? 'variants' : 'products'
    const timestamp = Date.now()
    const randomId = crypto.randomUUID()
    const key = `${sellerId}/${folder}/${timestamp}-${randomId}-${safeName}`

    const uploadUrl = await getPresignedUploadUrl(key, contentType)
    const publicUrl = `${R2_CONFIG.publicUrl}/${key}`

    return res.json({ uploadUrl, publicUrl, key })
  } catch (error) {
    console.error('Error generating presigned upload URL:', error)
    return res.status(500).json({ error: 'Failed to generate upload URL' })
  }
}

export const deleteProductMedia = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user?.userId
    if (!sellerId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const { url, urls } = req.body as { url?: string; urls?: string[] }
    const urlList = Array.isArray(urls) ? urls : url ? [url] : []
    if (urlList.length === 0) {
      return res.status(400).json({ error: 'At least one url is required' })
    }

    if (!R2_CONFIG.publicUrl) {
      return res.status(500).json({ error: 'R2 public URL not configured' })
    }

    const publicUrl = R2_CONFIG.publicUrl
    const safeUrls = urlList.filter((mediaUrl) => {
      if (!mediaUrl.startsWith(publicUrl)) return false
      const key = mediaUrl.replace(`${publicUrl}/`, '')
      return key.startsWith(`${sellerId}/`)
    })

    if (safeUrls.length === 0) {
      return res.status(403).json({ error: 'No deletable media found for this seller' })
    }

    await deleteMultipleFromR2(safeUrls)
    return res.json({ success: true, deleted: safeUrls.length })
  } catch (error) {
    console.error('Error deleting product media:', error)
    return res.status(500).json({ error: 'Failed to delete media' })
  }
}

// Get Seller Dashboard Stats
export const getSellerDashboardStats = async (req: Request, res: Response) => {
  try {
    const sellerId = new mongoose.Types.ObjectId(req.user?.userId)

    const totalProducts = await Product.countDocuments({ seller: sellerId })
    const activeProducts = await Product.countDocuments({
      seller: sellerId,
      status: 'active',
    })
    const draftProducts = await Product.countDocuments({
      seller: sellerId,
      status: 'draft',
    })
    const lowStockProducts = await Product.countDocuments({
      seller: sellerId,
      stock: { $lt: 10 },
      status: 'active',
    })

    // Placeholder for sales, orders, views (requires Order model and more logic)
    const totalSales = 0
    const totalOrders = 0
    const totalViews = await Product.aggregate([
      { $match: { seller: sellerId } },
      { $group: { _id: null, total: { $sum: '$viewCount' } } },
    ]).then((result) => result[0]?.total || 0)

    res.json({
      totalProducts,
      activeProducts,
      draftProducts,
      lowStockProducts,
      totalSales,
      totalOrders,
      totalViews,
    })
  } catch (err: unknown) {
    console.error('Error fetching seller dashboard stats:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Get all products for a seller
export const getSellerProducts = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user?.userId
    const {
      status,
      search,
      category,
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      order = 'desc',
    } = req.query

    if (!sellerId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const filter: Record<string, unknown> = { seller: sellerId }

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
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { brand: { $regex: search, $options: 'i' } },
      ]
    }

    const skip = (Number(page) - 1) * Number(limit)
    const sortOptions: Record<string, 1 | -1> = {
      [sortBy as string]: order === 'desc' ? -1 : 1,
    }

    const [productsRaw, total] = await Promise.all([
      Product.find(filter)
        .populate({
          path: 'category',
          select: 'name slug parent',
          populate: {
            path: 'parent',
            select: 'name slug',
          },
        })
        .sort(sortOptions)
        .skip(skip)
        .limit(Number(limit)),
      Product.countDocuments(filter),
    ])

    // Self-heal incorrect status for variant products based on totalStock
    const products = await Promise.all(
      productsRaw.map(async (p) => {
        if (p.hasVariants && p.status !== 'draft' && !(p as any).statusLockedByAdmin) {
          const desired = (p.totalStock || 0) > 0 ? 'active' : 'out_of_stock'
          if (p.status !== desired) {
            p.status = desired as any
            await p.save()
          }
        }
        return p
      }),
    )

    res.json({
      products,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
    })
  } catch (err: unknown) {
    console.error('Error fetching seller products:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Get single product
export const getProduct = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user?.userId
    const { id } = req.params

    if (!sellerId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const product = await Product.findOne({
      _id: id,
      seller: sellerId,
    }).populate({
      path: 'category',
      select: 'name slug parent',
      populate: {
        path: 'parent',
        select: 'name slug',
      },
    })

    if (!product) {
      return res.status(404).json({ error: 'Product not found' })
    }

    // Self-heal incorrect status for variant products based on totalStock
    if (
      product.hasVariants &&
      product.status !== 'draft' &&
      !(product as any).statusLockedByAdmin
    ) {
      const desired = (product.totalStock || 0) > 0 ? 'active' : 'out_of_stock'
      if (product.status !== desired) {
        product.status = desired as any
        await product.save()
      }
    }

    // Fetch variants if product has variants
    let productWithVariants = product.toObject() as any
    if (product.hasVariants) {
      // Use lean() to get plain JavaScript objects directly - includes all fields including warehouseInventory
      const variants = await ProductVariant.find({ product: id })
        .sort({
          isDefault: -1,
          createdAt: 1,
        })
        .lean()

      productWithVariants.variants = variants
    }

    res.json(productWithVariants)
  } catch (err: unknown) {
    console.error('Error fetching product:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Get product details by SKU (returns only relevant data for that SKU)
export const getProductBySku = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user?.userId
    let { sku } = req.query

    if (!sellerId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    if (!sku || typeof sku !== 'string') {
      return res.status(400).json({ error: 'SKU is required' })
    }

    // Decode URL-encoded SKU (e.g., %23 becomes #, %20 becomes space)
    try {
      sku = decodeURIComponent(sku)
    } catch (e) {
      // If decoding fails, use original SKU
      console.warn('Failed to decode SKU, using original:', sku)
    }

    console.log('Original SKU from query:', req.query.sku)
    console.log('Decoded SKU:', sku)

    // Get seller's pickup addresses to add pickup IDs
    const seller = await User.findById(sellerId).select('pickupAddresses')
    const pickupAddresses = seller?.pickupAddresses || []

    // Helper function to find pickup address by warehouseId
    const findPickupAddress = (warehouseId: string) => {
      return pickupAddresses.find((addr: any) => {
        if (addr._id && String(addr._id) === warehouseId) return true
        if (
          addr.kourierBoyzLogisticsPickupAddressId &&
          String(addr.kourierBoyzLogisticsPickupAddressId) === warehouseId
        )
          return true
        return false
      })
    }

    // First, try to find a variant with this SKU
    console.log('Searching for variant with SKU:', sku)
    console.log('SKU length:', sku.length)
    console.log('SKU bytes:', Buffer.from(sku).toString('hex'))
    console.log('Seller ID:', sellerId)

    // Try exact match first
    let variant = await ProductVariant.findOne({
      sku: sku,
      seller: sellerId,
    }).lean()

    // If not found, try with trimmed SKU (in case of whitespace)
    if (!variant) {
      const trimmedSku = sku.trim()
      if (trimmedSku !== sku) {
        console.log('Trying with trimmed SKU:', trimmedSku)
        variant = await ProductVariant.findOne({
          sku: trimmedSku,
          seller: sellerId,
        }).lean()
      }
    }

    // If still not found, try without # characters (in case stored differently)
    if (!variant && sku.includes('#')) {
      const skuWithoutHash = sku.replace(/#/g, '')
      console.log('Trying SKU without #:', skuWithoutHash)
      variant = await ProductVariant.findOne({
        sku: skuWithoutHash,
        seller: sellerId,
      }).lean()
    }

    // If still not found, try case-insensitive search
    if (!variant) {
      console.log('Trying case-insensitive SKU search')
      const escapedSku = sku.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      variant = await ProductVariant.findOne({
        sku: { $regex: new RegExp(`^${escapedSku}$`, 'i') },
        seller: sellerId,
      }).lean()
    }

    // Debug: Check what variants exist for this seller
    if (!variant) {
      // Try to find variants with similar SKU pattern
      const skuPrefix = sku.split('-COL-')[0] // Get base SKU before color codes
      console.log('Searching for variants with similar SKU pattern:', skuPrefix)
      const similarVariants = await ProductVariant.find({
        seller: sellerId,
        sku: { $regex: new RegExp(`^${skuPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i') },
      })
        .select('sku product')
        .limit(10)
        .lean()
      console.log(
        'Similar variants found:',
        similarVariants.map((v) => ({ sku: v.sku, length: v.sku.length })),
      )

      // Also show a few random variants to see the format
      const sampleVariants = await ProductVariant.find({ seller: sellerId })
        .select('sku')
        .limit(3)
        .lean()
      console.log(
        'Sample variants for this seller:',
        sampleVariants.map((v) => ({ sku: v.sku, length: v.sku.length })),
      )
    }

    console.log('Variant query result:', variant ? `Found - ${variant.sku}` : 'Not found')

    if (variant) {
      // Found a variant - get parent product
      const product = await Product.findOne({
        _id: variant.product,
        seller: sellerId,
      })
        .select(
          '_id name description shortDescription brand category shippingWeight shippingDimensions weight dimensions mainImage images warehouseInventory manufacturerName manufacturerAddress importerName importerAddress countryOfOrigin',
        )
        .populate({
          path: 'category',
          select: 'name slug parent',
          populate: {
            path: 'parent',
            select: 'name slug',
          },
        })
        .lean()

      if (!product) {
        return res.status(404).json({ error: 'Product not found' })
      }

      // Debug logging
      console.log(
        'Variant warehouseInventory:',
        JSON.stringify(variant.warehouseInventory, null, 2),
      )
      console.log(
        'Product warehouseInventory:',
        JSON.stringify((product as any).warehouseInventory, null, 2),
      )

      // Add pickup IDs to variant warehouse inventory
      // Priority: variant.warehouseInventory (if has items) > product.warehouseInventory
      let warehouseInventory: any[] = []

      // Check if variant has warehouseInventory with items
      if (
        variant.warehouseInventory &&
        Array.isArray(variant.warehouseInventory) &&
        variant.warehouseInventory.length > 0
      ) {
        // Use variant's warehouseInventory if it has items
        warehouseInventory = variant.warehouseInventory
      } else if (
        (product as any).warehouseInventory &&
        Array.isArray((product as any).warehouseInventory) &&
        (product as any).warehouseInventory.length > 0
      ) {
        // Fallback to product's warehouseInventory if variant doesn't have items
        warehouseInventory = (product as any).warehouseInventory
      }

      // Map warehouse inventory and add pickup IDs
      if (Array.isArray(warehouseInventory) && warehouseInventory.length > 0) {
        warehouseInventory = warehouseInventory.map((warehouse: any) => {
          // Handle both string and ObjectId warehouseId
          const warehouseId =
            typeof warehouse.warehouseId === 'string'
              ? warehouse.warehouseId
              : String(warehouse.warehouseId?._id || warehouse.warehouseId || '')

          const pickupAddress = findPickupAddress(warehouseId)
          return {
            warehouseId: warehouseId,
            warehouseName: warehouse.warehouseName || 'Unknown Warehouse',
            quantity: Number(warehouse.quantity) || 0,
            lowStockThreshold: Number(warehouse.lowStockThreshold) || 0,
            pickupId: pickupAddress?.kourierBoyzLogisticsPickupAddressId || null,
          }
        })
      }

      // Return variant-specific data
      return res.json({
        _id: product._id,
        name: product.name,
        description: product.description,
        shortDescription: product.shortDescription,
        brand: product.brand,
        category: product.category,
        sku: variant.sku,
        variantName: variant.name,
        variantId: variant._id,
        price: variant.price,
        comparePrice: variant.comparePrice,
        costPrice: variant.costPrice,
        stock: variant.stock,
        lowStockThreshold: variant.lowStockThreshold,
        shippingWeight: product.shippingWeight || product.weight,
        shippingDimensions: product.shippingDimensions || product.dimensions,
        mainImage: variant.mainImage || product.mainImage,
        images: variant.images || product.images || [],
        warehouseInventory: warehouseInventory,
        manufacturerName: (product as any).manufacturerName,
        manufacturerAddress: (product as any).manufacturerAddress,
        importerName: (product as any).importerName,
        importerAddress: (product as any).importerAddress,
        countryOfOrigin: (product as any).countryOfOrigin,
      })
    }

    console.log('No variant Found!!', variant)

    // If no variant found, try to find a product with this SKU
    console.log('No variant found. Searching for product with SKU:', sku)
    console.log('Seller ID:', sellerId)

    const product = await Product.findOne({
      sku: sku,
      seller: sellerId,
    })
      .select(
        '_id name description shortDescription brand category price comparePrice costPrice sku stock lowStockThreshold shippingWeight shippingDimensions weight dimensions mainImage images warehouseInventory manufacturerName manufacturerAddress importerName importerAddress countryOfOrigin',
      )
      .populate({
        path: 'category',
        select: 'name slug parent',
        populate: {
          path: 'parent',
          select: 'name slug',
        },
      })
      .lean()

    if (!product) {
      return res.status(404).json({ error: 'Product not found for this SKU' })
    }

    // Check if product has variants - if yes, don't return product-level data
    if ((product as any).hasVariants) {
      return res.status(400).json({
        error: 'This product has variants. Please use a variant SKU instead.',
      })
    }

    // Add pickup IDs to product warehouse inventory
    let warehouseInventory = (product as any).warehouseInventory || []
    if (Array.isArray(warehouseInventory) && warehouseInventory.length > 0) {
      warehouseInventory = warehouseInventory.map((warehouse: any) => {
        const pickupAddress = findPickupAddress(warehouse.warehouseId)
        return {
          warehouseId: warehouse.warehouseId,
          warehouseName: warehouse.warehouseName,
          quantity: warehouse.quantity,
          lowStockThreshold: warehouse.lowStockThreshold,
          pickupId: pickupAddress?.kourierBoyzLogisticsPickupAddressId || null,
        }
      })
    }

    // Return product data
    return res.json({
      _id: product._id,
      name: product.name,
      description: product.description,
      shortDescription: product.shortDescription,
      brand: product.brand,
      category: product.category,
      sku: product.sku,
      price: product.price,
      comparePrice: product.comparePrice,
      costPrice: product.costPrice,
      stock: product.stock,
      lowStockThreshold: product.lowStockThreshold,
      shippingWeight: product.shippingWeight || product.weight,
      shippingDimensions: product.shippingDimensions || product.dimensions,
      mainImage: product.mainImage,
      images: product.images || [],
      warehouseInventory: warehouseInventory,
      manufacturerName: (product as any).manufacturerName,
      manufacturerAddress: (product as any).manufacturerAddress,
      importerName: (product as any).importerName,
      importerAddress: (product as any).importerAddress,
      countryOfOrigin: (product as any).countryOfOrigin,
    })
  } catch (err: unknown) {
    console.error('Error fetching product by SKU:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Get compact product + warehouse inventory details for multiple order item IDs
// Supports both simple products and variants, and enriches warehouses with pickup IDs.
export const getProductsForOrderItems = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user?.userId
    const { orderId } = req.params
    const { itemIds } = req.query

    if (!sellerId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ error: 'Valid orderId is required' })
    }

    let itemIdList: string[] = []
    if (Array.isArray(itemIds)) {
      itemIdList = (itemIds as string[]).flatMap((raw) =>
        raw
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean),
      )
    } else if (typeof itemIds === 'string') {
      itemIdList = itemIds
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean)
    }

    if (!itemIdList.length) {
      return res.status(400).json({ error: 'At least one itemId is required' })
    }

    const orderObjectId = new mongoose.Types.ObjectId(orderId)
    const order = await Order.findOne({
      _id: orderObjectId,
      'items.seller': sellerId,
    })
      .populate('items.product', 'name sku mainImage images warehouseInventory stock lowStockThreshold')
      .populate('items.variant', 'name sku mainImage images warehouseInventory stock lowStockThreshold')
      .lean()

    if (!order) {
      return res.status(404).json({ error: 'Order not found for this seller' })
    }

    // Get seller's pickup addresses to add pickup IDs
    const seller = await User.findById(sellerId).select('pickupAddresses')
    const pickupAddresses = seller?.pickupAddresses || []

    const findPickupAddress = (warehouseId: string) => {
      return pickupAddresses.find((addr: any) => {
        if (addr._id && String(addr._id) === warehouseId) return true
        if (
          addr.kourierBoyzLogisticsPickupAddressId &&
          String(addr.kourierBoyzLogisticsPickupAddressId) === warehouseId
        )
          return true
        return false
      })
    }

    const itemIdSet = new Set(
      itemIdList.filter((id) => mongoose.Types.ObjectId.isValid(id)).map((id) => id.toString()),
    )

    const results: Array<{
      itemId: string
      productId: string
      variantId?: string
      name: string
      sku: string
      mainImage?: string
      warehouseInventory: Array<{
        warehouseId: string
        warehouseName: string
        quantity: number
        lowStockThreshold?: number
        pickupId?: string | null
      }>
    }> = []

    order.items.forEach((item: any) => {
      const itemId = item?._id?.toString()
      if (!itemId || !itemIdSet.has(itemId)) return
      if (!item?.seller || String(item.seller) !== String(sellerId)) return

      const product: any = item.product
      const variant: any = item.variant
      if (!product) return

      let warehouseInventory: any[] = []
      if (
        variant &&
        Array.isArray(variant.warehouseInventory) &&
        variant.warehouseInventory.length > 0
      ) {
        warehouseInventory = variant.warehouseInventory
      } else if (
        product.warehouseInventory &&
        Array.isArray(product.warehouseInventory) &&
        product.warehouseInventory.length > 0
      ) {
        warehouseInventory = product.warehouseInventory
      }

      if ((!Array.isArray(warehouseInventory) || warehouseInventory.length === 0) && pickupAddresses.length) {
        const fallbackQuantityRaw = Number(variant?.stock ?? product.stock)
        const fallbackQuantity =
          Number.isFinite(fallbackQuantityRaw) && fallbackQuantityRaw > 0
            ? fallbackQuantityRaw
            : Math.max(Number(item.quantity) || 0, 1)
        const fallbackThresholdRaw = Number(variant?.lowStockThreshold ?? product.lowStockThreshold)
        const fallbackThreshold = Number.isFinite(fallbackThresholdRaw) ? fallbackThresholdRaw : 0

        warehouseInventory = pickupAddresses.map((pickup: any) => ({
          warehouseId: String(pickup?._id || pickup?.kourierBoyzLogisticsPickupAddressId || ''),
          warehouseName:
            pickup?.warehouseName ||
            pickup?.contactName ||
            pickup?.kourierBoyzLogisticsPickupAddressId ||
            'Default Pickup Address',
          quantity: fallbackQuantity,
          lowStockThreshold: fallbackThreshold,
        }))
      }

      if (!Array.isArray(warehouseInventory) || warehouseInventory.length === 0) {
        results.push({
          itemId,
          productId: String(product._id),
          variantId: variant?._id ? String(variant._id) : undefined,
          name: variant?.name || product.name,
          sku: variant?.sku || product.sku,
          mainImage: variant?.mainImage || product.mainImage,
          warehouseInventory: [],
        })
        return
      }

      const enriched = warehouseInventory.map((warehouse: any) => {
        const wid =
          typeof warehouse.warehouseId === 'string'
            ? warehouse.warehouseId
            : String(warehouse.warehouseId?._id || warehouse.warehouseId || '')
        const pickup = findPickupAddress(wid)
        return {
          warehouseId: wid,
          warehouseName: warehouse.warehouseName || 'Unknown Warehouse',
          quantity: Number(warehouse.quantity) || 0,
          lowStockThreshold: Number(warehouse.lowStockThreshold) || 0,
          pickupId: pickup?.kourierBoyzLogisticsPickupAddressId || null,
        }
      })

      results.push({
        itemId,
        productId: String(product._id),
        variantId: variant?._id ? String(variant._id) : undefined,
        name: variant?.name || product.name,
        sku: variant?.sku || product.sku,
        mainImage: variant?.mainImage || product.mainImage,
        warehouseInventory: enriched,
      })
    })

    return res.json(results)
  } catch (error: any) {
    console.error('Error fetching products for order items:', error)
    return res
      .status(500)
      .json({ error: 'Failed to fetch products for order items', details: error.message })
  }
}

// Get product serviceability (seller endpoint)
export const getProductServiceability = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user?.userId
    const { id: productId } = req.params
    const { destination, pickup_id, origin, orderAmount, paymentType } = req.query

    if (!sellerId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    if (!productId || !destination) {
      return res.status(400).json({
        success: false,
        message: 'Product ID and destination pincode are required',
      })
    }

    // Verify product belongs to seller
    const product = await Product.findOne({
      _id: productId,
      seller: sellerId,
    })
      .select('shippingWeight shippingDimensions weight dimensions')
      .lean()

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      })
    }

    // Get product weight and dimensions
    const weight = product.shippingWeight || product.weight || 500
    const dimensions = product.shippingDimensions || product.dimensions
    const length = dimensions?.length
    const width = dimensions?.width
    const height = dimensions?.height

    // Prepare serviceability request
    const serviceabilityRequest = {
      destination: destination as string,
      pickup_id: pickup_id as string | undefined,
      origin: origin as string | undefined,
      payment_type: (paymentType as 'cod' | 'prepaid') || 'prepaid',
      order_amount: orderAmount ? Number(orderAmount) : undefined,
      weight: weight,
      length: length,
      breadth: width,
      height: height,
      shipment_type: 'b2c' as const,
      is_reverse: false,
    }

    // Call KourierBoyzLogistics serviceability API
    const serviceabilityResponse = await shippingProviderService.checkServiceability(
      serviceabilityRequest,
    )

    if (!serviceabilityResponse.success) {
      return res.status(400).json({
        success: false,
        message: serviceabilityResponse.error || 'Serviceability check failed',
      })
    }

    return res.json({
      success: true,
      data: serviceabilityResponse.data,
    })
  } catch (err: unknown) {
    console.error('Error checking product serviceability:', err)
    res.status(500).json({
      success: false,
      message: (err as Error)?.message || 'Server error',
    })
  }
}

// Create product
export const createProduct = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user?.userId

    // Check seller status
    const seller = await User.findById(sellerId)
    if (!seller || seller.role !== 'seller') {
      return res.status(404).json({ error: 'Seller not found' })
    }

    // Check KYC status - must be APPROVED
    const isKycApproved =
      seller.kycStatus === 'APPROVED' || (seller.isApproved === true && seller.kycSubmitted === true)
    if (!isKycApproved) {
      return res.status(403).json({
        error: 'KYC must be approved before creating products',
        kycStatus: seller.kycStatus || (seller.isApproved ? 'APPROVED' : 'PENDING'),
      })
    }

    // Check if seller is GST registered
    // Seller is considered GST-registered if a GST number is present
    const isGstRegistered = Boolean((seller as any)?.gstNumber)

    const {
      name,
      description,
      shortDescription,
      price,
      comparePrice,
      costPrice,
      category,
      brand,
      brand_id,
      stock,
      sku,
      status: productStatus,
      isFeatured,
      specifications,
      tags,
      filterMetadata,
      // SEO fields
      metaTitle,
      metaDescription,
      seoKeywords,
      discountPercent,
      discountStart,
      discountEnd,
      // Inventory fields
      lowStockThreshold,
      trackInventory,
      minOrderQuantity,
      maxOrderQuantity,
      // Shipping fields
      requiresShipping,
      freeShipping,
      shippingCharge,
      shippingWeight,
      shippingDimensions,
      // Fulfillment field
      fulfillmentType,
      // Product Features & Policies
      payOnDelivery,
      returnable,
      returnDays,
      warranty,
      warrantyDays,
      // Manufacturer & Importer Information
      manufacturerName,
      manufacturerAddress,
      importerName,
      importerAddress,
      countryOfOrigin,
      // Tax fields
      taxClass,
      taxRate,
      // GST/HSN fields
      isGstApplicable,
      hsnSacCode,
      cgstRatePercent,
      sgstRatePercent,
      igstRatePercent,
      gstRatePercent,
      defaultHsnSacCode,
      defaultGstRatePercent,
      defaultCgstRatePercent,
      defaultSgstRatePercent,
      defaultIgstRatePercent,
      // Variants
      hasVariants,
      variantAttributes,
      variants,
      // Warehouse inventory
      warehouseInventory,
    } = req.body
    // Parse JSON fields if they are strings
    let parsedVariantAttributes = variantAttributes
    let parsedVariants = variants
    const normalizedFilterMetadata = normalizeFilterMetadata(filterMetadata)
    const hasVariantsEnabled = hasVariants === 'true' || hasVariants === true

    if (typeof variantAttributes === 'string') {
      try {
        parsedVariantAttributes = JSON.parse(variantAttributes)
      } catch (e) {
        console.log('Failed to parse variantAttributes:', e)
        // Failed to parse, keep original value
      }
    }

    if (typeof variants === 'string') {
      try {
        parsedVariants = JSON.parse(variants)
      } catch (e) {
        // Failed to parse, keep original value
      }
    }

    const parsedSpecifications = parseOptionalJsonField<Array<{ key?: string; value: string }>>(
      specifications,
      'specifications',
      [],
    )
    const parsedTags = parseOptionalJsonField<string[]>(tags, 'tags')
    const parsedShippingDimensions = parseOptionalJsonField<{
      length: number
      width: number
      height: number
    }>(shippingDimensions, 'shippingDimensions')
    const parsedSeoKeywords = parseOptionalJsonField<string[]>(seoKeywords, 'seoKeywords')
    const parsedWarehouseInventoryForProduct = parseOptionalJsonField<any[]>(
      warehouseInventory,
      'warehouseInventory',
    )

    if (!sellerId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    // Validate required fields
    if (!name || !description || !category) {
      return res.status(400).json({ error: 'Name, description, and category are required' })
    }

    // Validate brand_id if provided (required for non-draft products)
    const isDraft = productStatus === 'draft'
    if (!isDraft && !brand_id) {
      return res.status(400).json({ error: 'Brand is required for product listing' })
    }

    // Validate brand_id exists, belongs to seller, and is approved (Step 2-3 from spec)
    if (brand_id) {
      const brand = await Brand.findOne({
        _id: brand_id,
        seller_id: sellerId,
      })

      if (!brand) {
        return res.status(404).json({ error: 'Brand not found or does not belong to this seller' })
      }

      if (brand.status !== 'APPROVED') {
        return res.status(400).json({
          error: `Brand "${brand.brand_name}" is not approved. Current status: ${brand.status}`,
          brandStatus: brand.status,
        })
      }
    }

    // Validate category exists (Step 4 from spec) - required for non-draft products
    if (!isDraft && !category) {
      return res.status(400).json({ error: 'Category is required for product listing' })
    }
    
    if (category) {
      const categoryExists = await Category.findById(category)
      if (!categoryExists) {
        return res.status(400).json({ error: 'Selected category does not exist' })
      }
    }

    // Validate variants if hasVariants is true
    if (hasVariantsEnabled) {
      if (
        !parsedVariantAttributes ||
        !Array.isArray(parsedVariantAttributes) ||
        parsedVariantAttributes.length === 0
      ) {
        return res.status(400).json({
          error: 'Variant attributes are required when product has variants',
        })
      }
      if (!parsedVariants || !Array.isArray(parsedVariants) || parsedVariants.length === 0) {
        return res.status(400).json({
          error: 'At least one variant is required when product has variants',
        })
      }

      for (const variantData of parsedVariants as any[]) {
        if (!variantData?.name || !variantData?.sku) {
          return res.status(400).json({
            error: 'Each variant must have a name and SKU',
          })
        }
        if (
          !variantData.attributes ||
          typeof variantData.attributes !== 'object' ||
          Object.keys(variantData.attributes).length === 0
        ) {
          return res.status(400).json({
            error: 'Each variant must have at least one attribute',
          })
        }
      }
    }

    // Validate simple product price when publishing (non-draft) without variants
    if (!hasVariantsEnabled && !isDraft) {
      if (!(price && Number(price) > 0)) {
        return res.status(400).json({ error: 'Active simple products must have a positive price' })
      }
    }

    // Normalize files for both upload.fields and upload.any()
    const filesInput = req.files as any
    const files: { [fieldname: string]: Express.Multer.File[] } = Array.isArray(filesInput)
      ? (filesInput as Express.Multer.File[]).reduce((acc, f) => {
          const key = (f as any).fieldname
          if (!acc[key]) acc[key] = []
          acc[key].push(f)
          return acc
        }, {} as Record<string, Express.Multer.File[]>)
      : (filesInput as { [fieldname: string]: Express.Multer.File[] })

    const mainImageFile = files?.mainImage?.[0]
    const imagesFiles = files?.images || []
    const videosFiles = files?.videos || []
    const existingMainImage = (req.body as any).existingMainImage
    const existingImagesRaw = (req.body as any).existingImages
    const existingVideosRaw = (req.body as any).existingVideos

    const existingImages: string[] = existingImagesRaw
      ? (() => {
          try {
            return typeof existingImagesRaw === 'string' ? JSON.parse(existingImagesRaw) : []
          } catch {
            return []
          }
        })()
      : []

    const existingVideos: string[] = existingVideosRaw
      ? (() => {
          try {
            return typeof existingVideosRaw === 'string' ? JSON.parse(existingVideosRaw) : []
          } catch {
            return []
          }
        })()
      : []

    // Image validation temporarily disabled to match frontend

    // Generate unique slug per seller (allow same names)
    const slugBase = generateSlug(name)
    let slug = slugBase
    let suffix = 1
    // Ensure slug uniqueness for this seller
    // eslint-disable-next-line no-await-in-loop
    while (await Product.findOne({ seller: sellerId, slug })) {
      slug = `${slugBase}-${suffix++}`
    }

    // Generate unique SKU per seller
    let productSku = sku || `SKU-${Date.now()}`
    let skuSuffix = 1
    // Ensure SKU uniqueness for this seller
    // eslint-disable-next-line no-await-in-loop
    while (await Product.findOne({ seller: sellerId, sku: productSku })) {
      productSku = sku ? `${sku}-${skuSuffix++}` : `SKU-${Date.now()}-${skuSuffix++}`
    }

    const productUploadTimestamp = Date.now()

    // Upload main image to R2
    let mainImageUrl = ''
    if (mainImageFile) {
      mainImageUrl = await uploadToR2(
        mainImageFile.buffer,
        `${sellerId}/${productUploadTimestamp}-main-${mainImageFile.originalname}`,
        mainImageFile.mimetype,
        'products',
      )
    } else if (typeof existingMainImage === 'string' && existingMainImage.trim()) {
      mainImageUrl = existingMainImage.trim()
    }

    // Upload additional images + videos to R2 in parallel
    const [imageUrls, videoUrls] = await Promise.all([
      uploadFilesToR2(imagesFiles, sellerId, 'products', productUploadTimestamp),
      uploadFilesToR2(videosFiles, sellerId, 'products', productUploadTimestamp),
    ])

    // Merge existing URLs (presigned uploads) with newly uploaded files
    const mergedImageUrls = [...existingImages, ...imageUrls]
    const mergedVideoUrls = [...existingVideos, ...videoUrls]

    // Calculate stock from warehouse inventory if available, otherwise use provided stock
    let processedStock = 0
    if (
      parsedWarehouseInventoryForProduct &&
      Array.isArray(parsedWarehouseInventoryForProduct) &&
      parsedWarehouseInventoryForProduct.length > 0
    ) {
      // Sum quantities from all warehouses
      processedStock = parsedWarehouseInventoryForProduct.reduce(
        (sum: number, wi: { quantity?: number }) => sum + (Number(wi.quantity) || 0),
        0,
      )
    } else {
      // Use provided stock value
      processedStock =
        stock !== undefined && stock !== null && stock !== ''
          ? Math.max(0, Math.trunc(Number(stock)))
          : 0
    }

    // Check certificate requirements for the category
    // Product requires approval if:
    // 1. Category requires certificates AND
    // 2. Seller doesn't have ALL required certificates with "approved" status
    // Note: Pending certificates don't count - product needs approval until certificates are approved
    let requiresApproval = false

    // Use req.body.status directly if productStatus is undefined
    const actualStatus = productStatus || req.body.status || 'active'

    // Convert category to ObjectId if it's a string - needed for both certificate check and product creation
    let categoryId: mongoose.Types.ObjectId | undefined
    if (category) {
      try {
        categoryId = typeof category === 'string' ? new mongoose.Types.ObjectId(category) : category
      } catch (err) {
        console.error(`[Product Creation] Invalid category ID format: ${category}`, err)
        return res.status(400).json({ error: 'Invalid category ID' })
      }
    }

    // Track certificate IDs for this product
    let certificateIds: mongoose.Types.ObjectId[] = []

    if (categoryId && actualStatus !== 'draft') {
      try {
        // First, fetch the category to see its actual data
        const categoryDoc = await Category.findById(categoryId)

        if (!categoryDoc) {
          // If category not found, require approval for safety
          requiresApproval = true
        } else {
          const requiredCertificates = await getRequiredCertificatesForCategory(categoryId)

          if (requiredCertificates.length > 0) {
            // Find all certificates (including pending) for this seller and required types
            // We need to track which certificates are being used by this product
            const allCertificates = await Certificate.find({
              seller: sellerId,
              certificateType: { $in: requiredCertificates },
            })
              .sort({ createdAt: -1 })
              .exec()

            // Group by certificate type and get the latest one for each type
            const latestByType = new Map<string, typeof allCertificates[0]>()
            for (const cert of allCertificates) {
              const type = cert.certificateType
              if (!latestByType.has(type) || cert.createdAt > latestByType.get(type)!.createdAt) {
                latestByType.set(type, cert)
              }
            }

            // Store certificate IDs for this product
            certificateIds = Array.from(latestByType.values())
              .map((cert) => cert._id as mongoose.Types.ObjectId)
              .filter(Boolean)

            // Check if seller has all required certificates approved
            const certificateCheck = await checkSellerCertificates(sellerId, requiredCertificates)

            // Only approved certificates count - pending certificates require product approval
            if (!certificateCheck.hasAllCertificates) {
              requiresApproval = true
            }
          }
        }
      } catch (certErr) {
        console.error('Error checking certificates during product creation:', certErr)
        // If certificate check fails, require approval for safety
        requiresApproval = true
      }
    }

    // Determine status based on provided intent and product type
    // - If explicitly draft → keep draft
    // - If certificate not approved → pending_approval
    // - If hasVariants → default to active (variant stock will govern availability)
    // - Else for simple products → active if stock > 0 else out_of_stock
    // BUT: If seller not approved or missing store info, force draft
    let finalStatus = 'active'
    if (actualStatus === 'draft') {
      finalStatus = 'draft'
    } else if (!seller.isApproved) {
      // Force draft if not approved
      finalStatus = 'draft'
    } else if (requiresApproval) {
      // Set to pending_approval if certificates are missing
      finalStatus = 'pending_approval'
    } else if (hasVariantsEnabled) {
      finalStatus = 'active'
    } else {
      finalStatus = processedStock > 0 ? 'active' : 'out_of_stock'
    }

    // Override to draft if store info incomplete (unless explicitly draft or pending_approval)
    // Note: pending_approval takes precedence - don't override it to draft
    if (finalStatus !== 'draft' && finalStatus !== 'pending_approval' && actualStatus !== 'draft') {
      const missingInfo: string[] = []
      if (!seller.storeDescription || seller.storeDescription.trim().length === 0) {
        missingInfo.push('store description')
      }
      if (!seller.shippingPolicy || seller.shippingPolicy.trim().length === 0) {
        missingInfo.push('shipping policy')
      }
      if (!seller.returnPolicy || seller.returnPolicy.trim().length === 0) {
        missingInfo.push('return policy')
      }
      if (!seller.storeLogo) {
        missingInfo.push('store logo')
      }
      if (!seller.storeEmail || seller.storeEmail.trim().length === 0) {
        missingInfo.push('store email')
      }
      if (!seller.storePhone || seller.storePhone.trim().length === 0) {
        missingInfo.push('store phone')
      }
      if (!seller.supportEmail || seller.supportEmail.trim().length === 0) {
        missingInfo.push('support email')
      }
      if (!seller.sellerAgreementSigned) {
        missingInfo.push('seller agreement signature')
      }
      if (!seller.returnRefundPolicyAccepted) {
        missingInfo.push('return & refund policy acceptance')
      }

      if (missingInfo.length > 0) {
        finalStatus = 'draft'
      }
    }

    // Check brand + category scope (only for non-draft products with brand and category)
    let categoryNotApproved = false
    if (!isDraft && brand_id && categoryId) {
      const categoryScope = await BrandCategoryScope.findOne({
        seller_id: sellerId,
        brand_id: brand_id,
        category_id: categoryId,
        status: 'APPROVED',
      })

      if (!categoryScope) {
        // Category is not approved for this brand
        categoryNotApproved = true
        finalStatus = 'pending_category_approval'

        // Create category extension request if it doesn't exist (seller-scoped)
        // Note: reference_product_id will be set after product is created
        const existingRequest = await CategoryExtensionRequest.findOne({
          seller_id: sellerId,
          brand_id: brand_id,
          category_id: categoryId,
          status: { $in: ['PENDING', 'NEED_MORE_DOCS'] },
        })

        if (!existingRequest) {
          // Create new category extension request (reference_product_id will be updated after product creation)
          await CategoryExtensionRequest.create({
            seller_id: sellerId,
            brand_id: brand_id,
            category_id: categoryId,
            status: 'PENDING',
          })
        }
      }
    }

    const product = new Product({
      seller: sellerId,
      name,
      slug,
      description: description || '',
      shortDescription,
      price: price ? Number(price) : hasVariants ? undefined : 0,
      comparePrice: comparePrice ? Number(comparePrice) : undefined,
      costPrice: costPrice ? Number(costPrice) : undefined,
      category: categoryId || category || undefined,
      brand, // Legacy field
      brand_id: brand_id || undefined, // New field
      stock: processedStock,
      sku: productSku,
      status: finalStatus,
      isFeatured: isFeatured === 'true' || isFeatured === true,
      mainImage: mainImageUrl || (hasVariantsEnabled ? undefined : ''),
      images: mergedImageUrls,
      videos: mergedVideoUrls.length > 0 ? mergedVideoUrls : undefined,
      certificateIds: certificateIds.length > 0 ? certificateIds : undefined,
      specifications: (() => {
        let parsedSpecs = parsedSpecifications || []
        // Merge old features into specifications for backward compatibility
        // Check if old features field exists in request (may be sent from older clients)
        const oldFeatures = (req.body as any).features
        if (oldFeatures) {
          try {
            const parsedFeatures =
              typeof oldFeatures === 'string' ? JSON.parse(oldFeatures) : oldFeatures
            if (Array.isArray(parsedFeatures)) {
              // Convert features to specifications with empty key
              const featureSpecs = parsedFeatures.map((f: string) => ({ key: '', value: f }))
              parsedSpecs = [...(parsedSpecs || []), ...featureSpecs]
            }
          } catch (e) {
            console.error('Failed to parse old features:', e)
          }
        }
        return parsedSpecs.length > 0 ? parsedSpecs : undefined
      })(),
      tags: parsedTags,
      filterMetadata: normalizedFilterMetadata,
      // SEO fields
      metaTitle: metaTitle || undefined,
      metaDescription: metaDescription || undefined,
      seoKeywords: parsedSeoKeywords,
      discountPercent: parseOptionalNumber(discountPercent, 'discountPercent'),
      discountStart: discountStart && discountStart !== '' ? new Date(discountStart) : undefined,
      discountEnd: discountEnd && discountEnd !== '' ? new Date(discountEnd) : undefined,
      // Inventory fields
      lowStockThreshold: parseOptionalNumber(lowStockThreshold, 'lowStockThreshold') ?? 5,
      trackInventory: trackInventory === 'true' || trackInventory === true,
      minOrderQuantity: parseOptionalNumber(minOrderQuantity, 'minOrderQuantity') ?? 1,
      maxOrderQuantity: parseOptionalNumber(maxOrderQuantity, 'maxOrderQuantity'),
      // Warehouse inventory
      warehouseInventory: parsedWarehouseInventoryForProduct,
      // Shipping fields
      requiresShipping: requiresShipping === 'true' || requiresShipping === true,
      freeShipping: freeShipping === 'true' || freeShipping === true,
      shippingCharge: parseOptionalNumber(shippingCharge, 'shippingCharge'),
      shippingWeight: parseOptionalNumber(shippingWeight, 'shippingWeight'),
      shippingDimensions: parsedShippingDimensions,
      // Fulfillment field (optional - if not set, uses seller's default)
      fulfillmentType:
        fulfillmentType && fulfillmentType !== '' && fulfillmentType !== 'undefined'
          ? fulfillmentType
          : undefined,
      // Product Features & Policies
      payOnDelivery:
        payOnDelivery !== undefined && payOnDelivery !== null && payOnDelivery !== ''
          ? payOnDelivery === 'true' || payOnDelivery === true
          : true, // Default to true
      returnable:
        returnable !== undefined && returnable !== null && returnable !== ''
          ? returnable === 'true' || returnable === true
          : true, // Default to true
      returnDays:
        returnDays !== undefined && returnDays !== null && returnDays !== ''
          ? Number(returnDays)
          : 10, // Default to 10 days
      warranty:
        warranty !== undefined && warranty !== null && warranty !== ''
          ? warranty === 'true' || warranty === true
          : true, // Default to true
      warrantyDays:
        warrantyDays !== undefined && warrantyDays !== null && warrantyDays !== ''
          ? Number(warrantyDays)
          : 10, // Default to 10 days
      // Manufacturer & Importer Information
      manufacturerName: manufacturerName || undefined,
      manufacturerAddress: manufacturerAddress || undefined,
      importerName: importerName || undefined,
      importerAddress: importerAddress || undefined,
      countryOfOrigin: countryOfOrigin || undefined,
      // Tax fields
      taxClass: taxClass || undefined,
      taxRate: parseOptionalNumber(taxRate, 'taxRate'),
      // GST/HSN fields - force null if seller is not GST registered
      isGstApplicable: isGstRegistered
        ? isGstApplicable === 'true' || isGstApplicable === true
        : false,
      hsnSacCode: isGstRegistered ? hsnSacCode || undefined : null,
      cgstRatePercent: isGstRegistered
        ? parseOptionalNumber(cgstRatePercent, 'cgstRatePercent')
        : null,
      sgstRatePercent: isGstRegistered
        ? parseOptionalNumber(sgstRatePercent, 'sgstRatePercent')
        : null,
      igstRatePercent: isGstRegistered
        ? parseOptionalNumber(igstRatePercent, 'igstRatePercent')
        : null,
      gstRatePercent: isGstRegistered
        ? parseOptionalNumber(gstRatePercent, 'gstRatePercent')
        : null,
      defaultHsnSacCode: isGstRegistered ? defaultHsnSacCode || undefined : null,
      defaultGstRatePercent: isGstRegistered
        ? parseOptionalNumber(defaultGstRatePercent, 'defaultGstRatePercent')
        : null,
      // Separate default CGST, SGST, IGST fields
      defaultCgstRatePercent: isGstRegistered
        ? parseOptionalNumber(defaultCgstRatePercent, 'defaultCgstRatePercent')
        : null,
      defaultSgstRatePercent: isGstRegistered
        ? parseOptionalNumber(defaultSgstRatePercent, 'defaultSgstRatePercent')
        : null,
      defaultIgstRatePercent: isGstRegistered
        ? parseOptionalNumber(defaultIgstRatePercent, 'defaultIgstRatePercent')
        : null,
      // Set variant fields from the start
      hasVariants: hasVariantsEnabled,
      variantAttributes: parsedVariantAttributes || [],
      totalStock: 0, // Will be calculated from variants
      lowStockVariants: 0, // Will be calculated from variants
    })

    await product.save()

    // Handle variants if provided
    const createdVariantIds: mongoose.Types.ObjectId[] = []

    if (
      hasVariantsEnabled &&
      parsedVariants &&
      Array.isArray(parsedVariants) &&
      parsedVariants.length > 0
    ) {
      try {
        // Normalize default selection: ensure exactly one default; if none, set first as default; if only one, set it default
        if (parsedVariants.length === 1) {
          parsedVariants[0].isDefault = true
        } else {
          const numDefaults = parsedVariants.filter((v: any) => v.isDefault).length
          if (numDefaults === 0) parsedVariants[0].isDefault = true
          if (numDefaults > 1) {
            parsedVariants = parsedVariants.map((v: any, idx: number) => ({
              ...v,
              isDefault: idx === 0,
            }))
          }
        }

        // Create variants
        for (let i = 0; i < parsedVariants.length; i++) {
          const variantData = parsedVariants[i]
          // Log all variant data received to ensure everything is captured
          console.log(`[Create Product] Variant ${i} data:`, {
            name: variantData.name,
            hsnSacCode: variantData.hsnSacCode,
            gstRatePercent: variantData.gstRatePercent,
          })

          // Convert attributes object to Map for Mongoose
          let attributesMap = new Map()
          if (variantData.attributes && typeof variantData.attributes === 'object') {
            attributesMap = new Map(Object.entries(variantData.attributes))
          }

          // Derive product-level GST/HSN defaults for inheritance/prefill
          const productDefaultHsn: string | null =
            (product as any).defaultHsnSacCode ?? (product as any).hsnSacCode ?? null
          const productDefaultCgst: number | null = (product as any).defaultCgstRatePercent ?? null
          const productDefaultSgst: number | null = (product as any).defaultSgstRatePercent ?? null
          const productDefaultIgst: number | null =
            (product as any).defaultIgstRatePercent ??
            (product as any).defaultGstRatePercent ??
            (product as any).gstRatePercent ??
            (productDefaultCgst != null && productDefaultSgst != null
              ? productDefaultCgst + productDefaultSgst
              : null)
          // Note: productDefaultCgst/productDefaultSgst already defined above

          const rawVariantHsn = variantData.hsnSacCode
          const rawVariantIgst = variantData.igstRatePercent
          const rawVariantGst = variantData.gstRatePercent
          const rawVariantCgst = variantData.cgstRatePercent
          const rawVariantSgst = variantData.sgstRatePercent

          // Use variant GST values directly (no inheritance)
          const effectiveHsn =
            rawVariantHsn !== undefined &&
            rawVariantHsn !== null &&
            String(rawVariantHsn).trim() !== ''
              ? String(rawVariantHsn).trim()
              : undefined

          const effectiveIgst =
            rawVariantIgst !== undefined && rawVariantIgst !== null
              ? Number(rawVariantIgst)
              : rawVariantGst !== undefined && rawVariantGst !== null
              ? Number(rawVariantGst)
              : undefined

          // Handle CGST and SGST - convert to number if provided, allow 0 as valid value
          // Explicitly check if value is a number (including 0) or can be converted to a number
          const effectiveCgst = (() => {
            if (rawVariantCgst === undefined || rawVariantCgst === null) return undefined
            if (rawVariantCgst === '') return undefined
            const numValue = Number(rawVariantCgst)
            // Check if conversion resulted in a valid number (not NaN)
            if (isNaN(numValue)) return undefined
            return numValue
          })()

          const effectiveSgst = (() => {
            if (rawVariantSgst === undefined || rawVariantSgst === null) return undefined
            if (rawVariantSgst === '') return undefined
            const numValue = Number(rawVariantSgst)
            // Check if conversion resulted in a valid number (not NaN)
            if (isNaN(numValue)) return undefined
            return numValue
          })()

          console.log('[Create Product] GST values for variant:', {
            rawCgst: rawVariantCgst,
            rawSgst: rawVariantSgst,
            rawIgst: rawVariantIgst,
            effectiveCgst,
            effectiveSgst,
            effectiveIgst,
            isGstRegistered,
            willSaveCgst: isGstRegistered && effectiveCgst !== undefined,
            willSaveSgst: isGstRegistered && effectiveSgst !== undefined,
          })

          // Gather variant media inputs from multipart form
          let variantMainImageUrl = ''

          const existingVariantMain = (req.body as any)[`existingVariantMainImage_${i}`]
          const existingVariantImagesRaw = (req.body as any)[`existingVariantImages_${i}`]
          const existingVariantImages: string[] = existingVariantImagesRaw
            ? (() => {
                try {
                  return JSON.parse(existingVariantImagesRaw)
                } catch {
                  return []
                }
              })()
            : []

          const variantMainFile = (files?.[`variantMainImage_${i}`] || [])[0]
          const variantImagesFiles = files?.[`variantImages_${i}`] || []
          const variantVideosFiles = files?.[`variantVideos_${i}`] || []
          const variantUploadTimestamp = Date.now()

          const [uploadedVariantMain, uploadedVariantImages, uploadedVariantVideos] =
            await Promise.all([
              variantMainFile
                ? uploadToR2(
                    variantMainFile.buffer,
                    `${sellerId}/${variantUploadTimestamp}-main-${variantMainFile.originalname}`,
                    variantMainFile.mimetype,
                    'variants',
                  )
                : Promise.resolve(''),
              uploadFilesToR2(
                variantImagesFiles,
                sellerId,
                'variants',
                variantUploadTimestamp,
                'variant image',
              ),
              uploadFilesToR2(
                variantVideosFiles,
                sellerId,
                'variants',
                variantUploadTimestamp,
                'variant video',
              ),
            ])

          if (uploadedVariantMain) {
            variantMainImageUrl = uploadedVariantMain
          } else if (existingVariantMain) {
            variantMainImageUrl = existingVariantMain
          } else if (variantData.mainImage) {
            // Fallback if a URL string was provided directly in payload
            variantMainImageUrl = variantData.mainImage
          }

          // Merge existing variant image URLs
          const allVariantImageUrls = [...existingVariantImages, ...uploadedVariantImages]

          // Handle variant videos
          const existingVariantVideosRaw = (req.body as any)[`existingVariantVideos_${i}`]
          const existingVariantVideos: string[] = existingVariantVideosRaw
            ? (() => {
                try {
                  return JSON.parse(existingVariantVideosRaw)
                } catch {
                  return []
                }
              })()
            : []

          // Merge existing variant video URLs
          const allVariantVideoUrls = [...existingVariantVideos, ...uploadedVariantVideos]

          // Prepare variant data with all fields
          const variantFields: any = {
            product: product._id,
            seller: sellerId,
            name: variantData.name,
            sku: await generateUniqueVariantSku(
              sellerId,
              variantData.sku ||
                `${product.sku}-${variantData.name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()}`,
              (product._id as any).toString(),
            ),
            attributes: attributesMap,
            // Pricing fields (from PricingTab)
            price: variantData.price !== undefined ? Number(variantData.price) : undefined,
            comparePrice: variantData.comparePrice ? Number(variantData.comparePrice) : undefined,
            costPrice: variantData.costPrice ? Number(variantData.costPrice) : undefined,
            discountPercent:
              variantData.discountPercent !== undefined
                ? Number(variantData.discountPercent)
                : undefined,
            // Calculated pricing fields
            exclusivePrice:
              variantData.exclusivePrice !== undefined
                ? Number(variantData.exclusivePrice)
                : undefined,
            exclusiveTaxAmount:
              variantData.exclusiveTaxAmount !== undefined
                ? Number(variantData.exclusiveTaxAmount)
                : undefined,
            effectivePrice:
              variantData.effectivePrice !== undefined
                ? Number(variantData.effectivePrice)
                : undefined,
            profit: variantData.profit !== undefined ? Number(variantData.profit) : undefined,
            // Warehouse inventory (must be processed first)
            warehouseInventory: (() => {
              let whInventory = variantData.warehouseInventory

              // Parse if string
              if (typeof whInventory === 'string' && whInventory.trim() !== '') {
                try {
                  whInventory = JSON.parse(whInventory)
                } catch (e) {
                  console.error('Failed to parse variant warehouseInventory:', e)
                  whInventory = undefined
                }
              }

              // Ensure it's an array or undefined
              if (whInventory && Array.isArray(whInventory) && whInventory.length > 0) {
                // Validate and clean the warehouse inventory data
                return whInventory.map((wi: any) => ({
                  warehouseId: String(wi.warehouseId || ''),
                  warehouseName: String(wi.warehouseName || ''),
                  quantity: Number(wi.quantity) || 0,
                  lowStockThreshold:
                    wi.lowStockThreshold !== undefined ? Number(wi.lowStockThreshold) : 5,
                }))
              }

              // Return undefined if empty or invalid
              return undefined
            })(),
            // Inventory fields (from InventoryTab)
            // Stock will be calculated from warehouseInventory in pre-save hook if warehouseInventory exists
            // Only set stock directly if warehouseInventory is not provided
            stock: (() => {
              // Check if warehouseInventory was provided and is valid
              let whInventory = variantData.warehouseInventory
              if (typeof whInventory === 'string' && whInventory.trim() !== '') {
                try {
                  whInventory = JSON.parse(whInventory)
                } catch {
                  whInventory = undefined
                }
              }
              const hasWarehouseInventory =
                whInventory && Array.isArray(whInventory) && whInventory.length > 0

              if (hasWarehouseInventory) {
                // Let pre-save hook calculate from warehouseInventory
                return undefined
              }

              // Otherwise use provided stock value
              return variantData.stock !== undefined ? Number(variantData.stock) : 0
            })(),
            lowStockThreshold:
              variantData.lowStockThreshold !== undefined
                ? Number(variantData.lowStockThreshold)
                : 5,
            // Variant metadata
            isDefault: variantData.isDefault || false,
            status: variantData.status || 'active',
            // Media fields
            mainImage: variantMainImageUrl,
            images: allVariantImageUrls,
            videos: allVariantVideoUrls,
            // Additional fields that might be present
            weight: variantData.weight ? Number(variantData.weight) : undefined,
            dimensions: variantData.dimensions
              ? {
                  length: Number(variantData.dimensions.length) || 0,
                  width: Number(variantData.dimensions.width) || 0,
                  height: Number(variantData.dimensions.height) || 0,
                }
              : undefined,
            // GST/HSN fields for variants
            // If seller is not GST registered, force nulls; otherwise use provided values
            hsnSacCode: isGstRegistered ? effectiveHsn : null,
            // gstRatePercent is kept for backward compatibility (represents IGST)
            gstRatePercent: isGstRegistered ? effectiveIgst : null,
            // Separate CGST, SGST, IGST fields
            // Save CGST and SGST if provided (even if 0), otherwise undefined
            // Explicitly check for !== undefined to allow 0 as a valid value
            ...(isGstRegistered && effectiveCgst !== undefined
              ? { cgstRatePercent: effectiveCgst }
              : {}),
            ...(isGstRegistered && effectiveSgst !== undefined
              ? { sgstRatePercent: effectiveSgst }
              : {}),
            igstRatePercent: isGstRegistered ? effectiveIgst : null,
          }

          const variant = new ProductVariant(variantFields)

          await variant.save()

          // Verify it was saved
          createdVariantIds.push(variant._id as mongoose.Types.ObjectId)
        }

        // Update product total stock from variants
        await updateProductTotalStock((product._id as any).toString())

        // Mirror default variant SKU and media to product if missing
        const freshVariants = await ProductVariant.find({
          product: product._id,
        }).sort({
          isDefault: -1,
          createdAt: 1,
        })
        const def = freshVariants[0]
        if (def) {
          if (!product.sku) product.sku = def.sku
          if (!product.mainImage && def.mainImage) product.mainImage = def.mainImage
          if (Array.isArray(def.images) && def.images.length > 0) {
            product.images = Array.isArray(product.images)
              ? Array.from(new Set([...(product.images as string[]), ...def.images]))
              : def.images
          }
          await product.save()
        }
      } catch (variantError: unknown) {
        console.error('Error creating variants:', variantError)
        if (createdVariantIds.length > 0) {
          await ProductVariant.deleteMany({
            _id: { $in: createdVariantIds },
          })
        }
        await Product.deleteOne({ _id: product._id, seller: sellerId })
        return res.status(500).json({ error: 'Failed to create product variants' })
      }
    }

    // Update CategoryExtensionRequest with reference_product_id if category was not approved
    if (categoryNotApproved && brand_id && categoryId) {
      await CategoryExtensionRequest.findOneAndUpdate(
        {
          seller_id: sellerId,
          brand_id: brand_id,
          category_id: categoryId,
          status: { $in: ['PENDING', 'NEED_MORE_DOCS'] },
        },
        {
          reference_product_id: product._id,
        },
      )
    }

    // Fetch the updated product with variants if applicable
    let responseProduct = product.toObject() as any
    if (product.hasVariants) {
      const variants = await ProductVariant.find({ product: product._id }).sort({
        isDefault: -1,
        createdAt: 1,
      })
      // Convert variants to plain objects to ensure all fields including warehouseInventory are included
      responseProduct.variants = variants.map((v) => v.toObject())
    }

    // Include message if category is not approved
    const response: any = { ...responseProduct }
    if (categoryNotApproved) {
      response.message = 'This brand is not approved for the selected category. Awaiting admin approval.'
      response.categoryApprovalPending = true
    }

    res.status(201).json(response)
  } catch (err: unknown) {
    console.error('Error creating product:', err)
    const error = err as { code?: number; message?: string }
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Product with this name already exists' })
    }
    if (error.message?.startsWith('Invalid ')) {
      return res.status(400).json({ error: error.message })
    }
    res.status(500).json({ error: 'Server error' })
  }
}

// Update product
export const updateProduct = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user?.userId
    const { id } = req.params
    const {
      name,
      description,
      shortDescription,
      price,
      comparePrice,
      costPrice,
      category,
      brand,
      brand_id,
      stock,
      sku,
      status,
      isFeatured,
      specifications,
      tags,
      filterMetadata,
      // SEO fields
      metaTitle,
      metaDescription,
      seoKeywords,
      discountPercent,
      discountStart,
      discountEnd,
      existingMainImage,
      existingImages,
      existingVideos,
      // Inventory fields
      lowStockThreshold,
      trackInventory,
      minOrderQuantity,
      maxOrderQuantity,
      // Shipping fields
      requiresShipping,
      freeShipping,
      shippingCharge,
      shippingWeight,
      shippingDimensions,
      // Fulfillment field
      fulfillmentType,
      // Product Features & Policies
      payOnDelivery,
      returnable,
      returnDays,
      warranty,
      warrantyDays,
      // Manufacturer & Importer Information
      manufacturerName,
      manufacturerAddress,
      importerName,
      importerAddress,
      countryOfOrigin,
      // Tax fields
      taxClass,
      taxRate,
      // GST/HSN fields
      isGstApplicable,
      hsnSacCode,
      cgstRatePercent,
      sgstRatePercent,
      igstRatePercent,
      gstRatePercent,
      defaultHsnSacCode,
      defaultGstRatePercent,
      defaultCgstRatePercent,
      defaultSgstRatePercent,
      defaultIgstRatePercent,
      // Variants
      hasVariants,
      variantAttributes,
      variants,
      // Warehouse inventory
      warehouseInventory,
    } = req.body
    // Parse JSON fields if they are strings (align with create)
    let parsedVariantAttributes = variantAttributes as any
    let parsedVariants = variants as any
    console.log('variants in updateProduct==============', parsedVariants)
    let parsedWarehouseInventory = warehouseInventory
    if (typeof variantAttributes === 'string') {
      try {
        parsedVariantAttributes = JSON.parse(variantAttributes)
      } catch (e) {
        parsedVariantAttributes = variantAttributes
      }
    }
    if (typeof variants === 'string') {
      try {
        parsedVariants = JSON.parse(variants)
      } catch (e) {
        parsedVariants = variants
      }
    }
    console.log('parsedVariants', parsedVariants)
    if (typeof warehouseInventory === 'string') {
      try {
        parsedWarehouseInventory = JSON.parse(warehouseInventory)
      } catch (e) {
        parsedWarehouseInventory = warehouseInventory
      }
    }
    const normalizedFilterMetadata = normalizeFilterMetadata(filterMetadata)

    if (!sellerId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const product = await Product.findOne({ _id: id, seller: sellerId })
    if (!product) {
      return res.status(404).json({ error: 'Product not found' })
    }

    // Fetch seller for KYC check
    const seller = await User.findById(sellerId)
    if (!seller || seller.role !== 'seller') {
      return res.status(404).json({ error: 'Seller not found' })
    }

    // Check KYC status - must be APPROVED (not SUSPENDED or REJECTED)
    const isKycApproved =
      seller.kycStatus === 'APPROVED' || (seller.isApproved === true && seller.kycSubmitted === true)
    const isKycSuspendedOrRejected =
      seller.kycStatus === 'SUSPENDED' || seller.kycStatus === 'REJECTED'

    if (!isKycApproved) {
      if (isKycSuspendedOrRejected) {
        return res.status(403).json({
          error: 'KYC is suspended or rejected',
          message: `Your KYC status is ${seller.kycStatus}. Product listing is disabled. Please contact support.`,
          code: 'KYC_SUSPENDED_OR_REJECTED',
          kycStatus: seller.kycStatus,
        })
      }
      return res.status(403).json({
        error: 'KYC must be approved before updating products',
        kycStatus: seller.kycStatus || (seller.isApproved ? 'APPROVED' : 'PENDING'),
      })
    }

    // Check if seller is GST registered
    // Seller is considered GST-registered if a GST number is present
    const isGstRegistered = Boolean((seller as any)?.gstNumber)

    // Validate brand_id if provided or if product is being published
    const currentStatus = product.status
    const newStatus = status
    const isPublishing = currentStatus === 'draft' && newStatus && newStatus !== 'draft'

    // Validate brand_id if provided or if product is being published
    if (brand_id) {
      const brand = await Brand.findOne({
        _id: brand_id,
        seller_id: sellerId,
      })

      if (!brand) {
        return res.status(404).json({ error: 'Brand not found or does not belong to this seller' })
      }

      if (brand.status !== 'APPROVED') {
        return res.status(400).json({
          error: `Brand "${brand.brand_name}" is not approved. Current status: ${brand.status}`,
          brandStatus: brand.status,
          code: brand.status === 'REVOKED' ? 'BRAND_REVOKED' : 'BRAND_NOT_APPROVED',
        })
      }
    } else if (isPublishing && !product.brand_id) {
      // If publishing and no brand_id, require it
      return res.status(400).json({ error: 'Brand is required for product listing' })
    }

    // If product already has a brand_id, verify it's still approved (even if not changing brand)
    if (!brand_id && product.brand_id) {
      const existingBrand = await Brand.findOne({
        _id: product.brand_id,
        seller_id: sellerId,
      })

      if (existingBrand && existingBrand.status !== 'APPROVED') {
        return res.status(400).json({
          error: `Product's current brand "${existingBrand.brand_name}" is no longer approved. Status: ${existingBrand.status}`,
          brandStatus: existingBrand.status,
          code: existingBrand.status === 'REVOKED' ? 'BRAND_REVOKED' : 'BRAND_NOT_APPROVED',
        })
      }
    }

    // Check brand + category scope (Step 5 from spec)
    // Validate when: publishing, category changed, brand changed, or product is already active/inactive
    const finalBrandId = brand_id || product.brand_id
    const finalCategoryId = category || product.category
    let categoryNotApproved = false

    // Validate category exists if provided
    if (category) {
      const categoryExists = await Category.findById(category)
      if (!categoryExists) {
        return res.status(400).json({ error: 'Selected category does not exist' })
      }
    }

    // Check brand + category scope for non-draft products
    if (finalBrandId && finalCategoryId) {
      const isCurrentlyDraft = currentStatus === 'draft'
      const willBeDraft = newStatus === 'draft' || (!newStatus && isCurrentlyDraft)
      
      // Check scope if:
      // 1. Publishing (draft -> non-draft)
      // 2. Category changed
      // 3. Brand changed
      // 4. Product is already active/inactive and status is not being set to draft
      const categoryChanged = category && category.toString() !== product.category?.toString()
      const brandChanged = brand_id && brand_id.toString() !== product.brand_id?.toString()
      const needsValidation = isPublishing || categoryChanged || brandChanged || (!willBeDraft && !isCurrentlyDraft)

      if (needsValidation) {
        const categoryScope = await BrandCategoryScope.findOne({
          seller_id: sellerId,
          brand_id: finalBrandId,
          category_id: finalCategoryId,
          status: 'APPROVED',
        })

        if (!categoryScope) {
          categoryNotApproved = true

          // Create category extension request if it doesn't exist (seller-scoped)
          const existingRequest = await CategoryExtensionRequest.findOne({
            seller_id: sellerId,
            brand_id: finalBrandId,
            category_id: finalCategoryId,
            status: { $in: ['PENDING', 'NEED_MORE_DOCS'] },
          })

          if (!existingRequest) {
            await CategoryExtensionRequest.create({
              seller_id: sellerId,
              brand_id: finalBrandId,
              category_id: finalCategoryId,
              reference_product_id: product._id,
              status: 'PENDING',
            })
          }
        }
      }
    }

    // If trying to change status from draft to active, check requirements
    if (isPublishing) {
      // Check KYC approval
      if (!seller.isApproved) {
        return res.status(403).json({
          error: 'KYC approval required',
          message:
            'Your KYC is under review. You can only publish products after your account is approved.',
          code: 'KYC_NOT_APPROVED',
        })
      }

      // Check essential store info
      const missingInfo: string[] = []
      if (!seller.storeDescription || seller.storeDescription.trim().length === 0) {
        missingInfo.push('store description')
      }
      if (!seller.shippingPolicy || seller.shippingPolicy.trim().length === 0) {
        missingInfo.push('shipping policy')
      }
      if (!seller.returnPolicy || seller.returnPolicy.trim().length === 0) {
        missingInfo.push('return policy')
      }
      if (!seller.storeLogo) {
        missingInfo.push('store logo')
      }
      if (!seller.storeEmail || seller.storeEmail.trim().length === 0) {
        missingInfo.push('store email')
      }
      if (!seller.storePhone || seller.storePhone.trim().length === 0) {
        missingInfo.push('store phone')
      }
      if (!seller.supportEmail || seller.supportEmail.trim().length === 0) {
        missingInfo.push('support email')
      }
      if (!seller.sellerAgreementSigned) {
        missingInfo.push('seller agreement signature')
      }
      if (!seller.returnRefundPolicyAccepted) {
        missingInfo.push('return & refund policy acceptance')
      }

      if (missingInfo.length > 0) {
        return res.status(403).json({
          error: 'Store information incomplete',
          message: `Please complete the following before publishing products: ${missingInfo.join(
            ', ',
          )}`,
          code: 'STORE_INFO_INCOMPLETE',
          missingFields: missingInfo,
        })
      }

      // Check certificate requirements when changing from draft to active
      const productCategory = category || product.category
      let finalRequestedStatus: string | undefined = status
      if (productCategory) {
        try {
          const requiredCertificates = await getRequiredCertificatesForCategory(productCategory)
          if (requiredCertificates.length > 0) {
            const certificateCheck = await checkSellerCertificates(sellerId, requiredCertificates)
            if (!certificateCheck.hasAllCertificates) {
              // Set status to pending_approval if certificates are missing
              // Override the status that was requested
              finalRequestedStatus = 'pending_approval'
            }
          }
        } catch (certErr) {
          console.error('Error checking certificate requirements:', certErr)
          // Don't fail the update, but log the error
        }
      }
      // Store finalRequestedStatus for use in certificate check section below
      // Note: status is const, so we'll check finalRequestedStatus when needed
    }

    // Normalize files for both upload.fields and upload.any()
    const filesInput = req.files as any
    const files: { [fieldname: string]: Express.Multer.File[] } = Array.isArray(filesInput)
      ? (filesInput as Express.Multer.File[]).reduce((acc, f) => {
          const key = (f as any).fieldname
          if (!acc[key]) acc[key] = []
          acc[key].push(f)
          return acc
        }, {} as Record<string, Express.Multer.File[]>)
      : (filesInput as { [fieldname: string]: Express.Multer.File[] })

    const newMainImageFile = files?.mainImage?.[0]
    const newImagesFiles = files?.images || []
    const newVideosFiles = files?.videos || []
    const updateUploadTimestamp = Date.now()

    // Handle main image update
    let mainImageUrl = existingMainImage || product.mainImage
    if (newMainImageFile) {
      // Delete old main image from R2 if different
      if (product.mainImage && product.mainImage !== existingMainImage) {
        await deleteFromR2(product.mainImage)
      }
      mainImageUrl = await uploadToR2(
        newMainImageFile.buffer,
        `${sellerId}/${updateUploadTimestamp}-main-${newMainImageFile.originalname}`,
        newMainImageFile.mimetype,
        'products',
      )
    } else if (
      existingMainImage &&
      product.mainImage &&
      product.mainImage !== existingMainImage
    ) {
      await deleteFromR2(product.mainImage)
    } else if (!existingMainImage && product.mainImage) {
      // If main image was removed
      await deleteFromR2(product.mainImage)
      mainImageUrl = ''
    }

    // Handle additional images update
    // If existingImages not provided, retain current product images by default
    const updatedImageUrls: string[] = existingImages
      ? JSON.parse(existingImages)
      : Array.isArray(product.images)
      ? [...product.images]
      : []
    const imagesToDelete = product.images.filter((img) => !updatedImageUrls.includes(img))

    // Delete removed images from R2
    if (imagesToDelete.length > 0) {
      await deleteMultipleFromR2(imagesToDelete)
    }

    // Upload new images
    const newImageUrls = await uploadFilesToR2(
      newImagesFiles,
      sellerId,
      'products',
      updateUploadTimestamp,
      'product image',
    )
    updatedImageUrls.push(...newImageUrls)

    // Handle videos update
    // If existingVideos not provided, retain current product videos by default
    const updatedVideoUrls: string[] = existingVideos
      ? (typeof existingVideos === 'string' ? JSON.parse(existingVideos) : existingVideos)
      : Array.isArray(product.videos)
      ? [...product.videos]
      : []
    const videosToDelete = (product.videos || []).filter((vid) => !updatedVideoUrls.includes(vid))

    // Delete removed videos from R2
    if (videosToDelete.length > 0) {
      await deleteMultipleFromR2(videosToDelete)
    }

    // Upload new videos
    const newVideoUrls = await uploadFilesToR2(
      newVideosFiles,
      sellerId,
      'products',
      updateUploadTimestamp,
      'product video',
    )
    updatedVideoUrls.push(...newVideoUrls)

    // Update product fields
    if (name) {
      product.name = name
      // Recompute slug and ensure uniqueness for this seller (excluding current product)
      const slugBase = generateSlug(name)
      let newSlug = slugBase
      let suffix = 1
      // eslint-disable-next-line no-await-in-loop
      while (
        await Product.findOne({
          seller: sellerId,
          slug: newSlug,
          _id: { $ne: id },
        })
      ) {
        newSlug = `${slugBase}-${suffix++}`
      }
      product.slug = newSlug
    }
    if (description) product.description = description
    if (shortDescription !== undefined) product.shortDescription = shortDescription
    if (price) product.price = Number(price)
    if (comparePrice !== undefined)
      product.comparePrice = comparePrice ? Number(comparePrice) : undefined
    if (costPrice !== undefined) product.costPrice = costPrice ? Number(costPrice) : undefined
    if (category) {
      try {
        product.category =
          typeof category === 'string' ? new mongoose.Types.ObjectId(category) : category
      } catch (err) {
        console.error(`[Product Update] Invalid category ID format: ${category}`, err)
        return res.status(400).json({ error: 'Invalid category ID' })
      }
    }
    if (brand !== undefined) product.brand = brand // Legacy field
    if (brand_id !== undefined) product.brand_id = brand_id // New field

    // Update warehouse inventory if provided
    // For simple products: stock is always calculated from warehouseInventory when it exists
    // For variant products: stock comes from totalStock (sum of variant stocks)
    const hasWarehouseInventory =
      (parsedWarehouseInventory &&
        Array.isArray(parsedWarehouseInventory) &&
        parsedWarehouseInventory.length > 0) ||
      (product.warehouseInventory &&
        Array.isArray(product.warehouseInventory) &&
        product.warehouseInventory.length > 0)

    if (parsedWarehouseInventory !== undefined) {
      if (Array.isArray(parsedWarehouseInventory) && parsedWarehouseInventory.length > 0) {
        product.warehouseInventory = parsedWarehouseInventory
        // Calculate total stock from warehouse inventory (for simple products)
        // Stock will also be recalculated in pre-save hook to ensure consistency
        if (!product.hasVariants) {
          const totalWarehouseStock = parsedWarehouseInventory.reduce(
            (sum: number, wi: { quantity?: number }) => sum + (Number(wi.quantity) || 0),
            0,
          )
          product.stock = totalWarehouseStock
        }
      } else {
        product.warehouseInventory = undefined
      }
    }

    // Update stock (only if warehouse inventory doesn't exist and product has no variants)
    // For variant products, stock comes from totalStock (calculated from variant stocks)
    // For simple products with warehouseInventory, stock is calculated from warehouseInventory
    if (
      !hasWarehouseInventory &&
      !product.hasVariants &&
      stock !== undefined &&
      stock !== null &&
      stock !== ''
    ) {
      const numStock = Math.max(0, Math.trunc(Number(stock)))
      product.stock = numStock
    }
    if (sku) {
      // Check if SKU is unique for this seller (excluding current product)
      const existingProduct = await Product.findOne({
        seller: sellerId,
        sku: sku,
        _id: { $ne: id },
      })
      if (existingProduct) {
        return res.status(400).json({ error: 'SKU already exists for this seller' })
      }
      product.sku = sku
    }

    // Handle status updates based on stock (after stock is updated)
    // For products with variants, base availability on totalStock; for simple products, use product.stock
    // If category is not approved, set status to pending_category_approval (unless explicitly setting to draft)
    if (categoryNotApproved) {
      // Only set to pending_category_approval if not explicitly setting to draft
      if (newStatus !== 'draft' && (!status || status !== 'draft')) {
        product.status = 'pending_category_approval'
      }
    } else if (status) {
      if (status === 'draft') {
        // Draft status is always preserved
        product.status = status
      } else if (status === 'active' || status === 'inactive') {
        // Auto-update status based on current inventory for non-draft products
        if (product.hasVariants) {
          const totalStock = product.totalStock || 0
          product.status = totalStock > 0 ? 'active' : 'out_of_stock'
        } else {
          product.status = (product.stock || 0) > 0 ? 'active' : 'out_of_stock'
        }
      } else {
        product.status = status
      }
    } else if (stock !== undefined && stock !== null && stock !== '') {
      // If only stock is updated (simple product), auto-update status for non-draft products
      if (
        product.status !== 'draft' &&
        !product.hasVariants &&
        !(product as any).statusLockedByAdmin
      ) {
        product.status = (product.stock || 0) === 0 ? 'out_of_stock' : 'active'
      }
    }

    if (isFeatured !== undefined) product.isFeatured = isFeatured === 'true'
    if (specifications) {
      let parsedSpecs = JSON.parse(specifications)
      // Merge old features into specifications for backward compatibility
      const oldFeatures = (req.body as any).features
      if (oldFeatures) {
        try {
          const parsedFeatures =
            typeof oldFeatures === 'string' ? JSON.parse(oldFeatures) : oldFeatures
          if (Array.isArray(parsedFeatures)) {
            // Convert features to specifications with empty key
            const featureSpecs = parsedFeatures.map((f: string) => ({ key: '', value: f }))
            parsedSpecs = [...(parsedSpecs || []), ...featureSpecs]
          }
        } catch (e) {
          console.error('Failed to parse old features:', e)
        }
      }
      product.specifications = parsedSpecs
    }
    if (tags) product.tags = JSON.parse(tags)
    if (filterMetadata !== undefined) {
      product.filterMetadata =
        normalizedFilterMetadata !== undefined ? normalizedFilterMetadata : []
    }
    // SEO fields
    if (metaTitle !== undefined) product.metaTitle = metaTitle || undefined
    if (metaDescription !== undefined) product.metaDescription = metaDescription || undefined
    if (seoKeywords !== undefined)
      product.seoKeywords = seoKeywords
        ? typeof seoKeywords === 'string'
          ? (() => {
              try {
                return JSON.parse(seoKeywords)
              } catch {
                return []
              }
            })()
          : seoKeywords
        : []
    if (discountPercent !== undefined)
      product.discountPercent = discountPercent ? Number(discountPercent) : undefined
    if (discountStart !== undefined)
      product.discountStart =
        discountStart && discountStart !== '' ? new Date(discountStart) : undefined
    if (discountEnd !== undefined)
      product.discountEnd = discountEnd && discountEnd !== '' ? new Date(discountEnd) : undefined

    // Update inventory fields
    if (lowStockThreshold !== undefined) product.lowStockThreshold = Number(lowStockThreshold)
    if (trackInventory !== undefined)
      product.trackInventory = trackInventory === 'true' || trackInventory === true
    if (minOrderQuantity !== undefined) product.minOrderQuantity = Number(minOrderQuantity)
    if (maxOrderQuantity !== undefined)
      product.maxOrderQuantity = maxOrderQuantity ? Number(maxOrderQuantity) : undefined

    // Update shipping fields
    if (requiresShipping !== undefined)
      product.requiresShipping = requiresShipping === 'true' || requiresShipping === true
    if (freeShipping !== undefined)
      product.freeShipping = freeShipping === 'true' || freeShipping === true
    if (shippingCharge !== undefined && shippingCharge !== null && shippingCharge !== '')
      product.shippingCharge = Number(shippingCharge)
    else if (shippingCharge === null || shippingCharge === '')
      product.shippingCharge = undefined
    if (shippingWeight !== undefined)
      product.shippingWeight = shippingWeight ? Number(shippingWeight) : undefined
    if (shippingDimensions !== undefined)
      product.shippingDimensions = shippingDimensions
        ? typeof shippingDimensions === 'string'
          ? JSON.parse(shippingDimensions)
          : shippingDimensions
        : undefined

    // Update fulfillment field (optional - if not set or empty, uses seller's default)
    if (fulfillmentType !== undefined) {
      product.fulfillmentType =
        fulfillmentType && fulfillmentType !== '' && fulfillmentType !== 'undefined'
          ? fulfillmentType
          : undefined
    }

    // Update Product Features & Policies
    if (payOnDelivery !== undefined && payOnDelivery !== null && payOnDelivery !== '') {
      product.payOnDelivery = payOnDelivery === 'true' || payOnDelivery === true
    }
    if (returnable !== undefined && returnable !== null && returnable !== '') {
      product.returnable = returnable === 'true' || returnable === true
    }
    if (returnDays !== undefined && returnDays !== null && returnDays !== '') {
      product.returnDays = Number(returnDays)
    }
    if (warranty !== undefined && warranty !== null && warranty !== '') {
      product.warranty = warranty === 'true' || warranty === true
    }
    if (warrantyDays !== undefined && warrantyDays !== null && warrantyDays !== '') {
      product.warrantyDays = Number(warrantyDays)
    }

    // Update Manufacturer & Importer Information
    if (manufacturerName !== undefined) product.manufacturerName = manufacturerName || undefined
    if (manufacturerAddress !== undefined)
      product.manufacturerAddress = manufacturerAddress || undefined
    if (importerName !== undefined) product.importerName = importerName || undefined
    if (importerAddress !== undefined) product.importerAddress = importerAddress || undefined
    if (countryOfOrigin !== undefined) product.countryOfOrigin = countryOfOrigin || undefined

    // Update tax fields
    if (taxClass !== undefined) product.taxClass = taxClass || undefined
    if (taxRate !== undefined) product.taxRate = taxRate ? Number(taxRate) : undefined

    // Update GST/HSN fields - force null if seller is not GST registered
    if (isGstApplicable !== undefined)
      product.isGstApplicable = isGstRegistered
        ? isGstApplicable === 'true' || isGstApplicable === true
        : false
    if (hsnSacCode !== undefined)
      product.hsnSacCode = isGstRegistered ? hsnSacCode || undefined : null
    if (cgstRatePercent !== undefined)
      product.cgstRatePercent = isGstRegistered
        ? cgstRatePercent !== null && cgstRatePercent !== ''
          ? Number(cgstRatePercent)
          : undefined
        : null
    if (sgstRatePercent !== undefined)
      product.sgstRatePercent = isGstRegistered
        ? sgstRatePercent !== null && sgstRatePercent !== ''
          ? Number(sgstRatePercent)
          : undefined
        : null
    if (igstRatePercent !== undefined)
      product.igstRatePercent = isGstRegistered
        ? igstRatePercent !== null && igstRatePercent !== ''
          ? Number(igstRatePercent)
          : undefined
        : null
    if (gstRatePercent !== undefined)
      product.gstRatePercent = isGstRegistered
        ? gstRatePercent !== null
          ? Number(gstRatePercent)
          : undefined
        : null
    if (defaultHsnSacCode !== undefined)
      product.defaultHsnSacCode = isGstRegistered ? defaultHsnSacCode || undefined : null
    if (defaultGstRatePercent !== undefined)
      product.defaultGstRatePercent = isGstRegistered
        ? defaultGstRatePercent !== null
          ? Number(defaultGstRatePercent)
          : undefined
        : null
    // Update separate default CGST, SGST, IGST fields
    if (defaultCgstRatePercent !== undefined)
      product.defaultCgstRatePercent = isGstRegistered
        ? defaultCgstRatePercent !== null && defaultCgstRatePercent !== undefined
          ? Number(defaultCgstRatePercent)
          : undefined
        : null
    if (defaultSgstRatePercent !== undefined)
      product.defaultSgstRatePercent = isGstRegistered
        ? defaultSgstRatePercent !== null && defaultSgstRatePercent !== undefined
          ? Number(defaultSgstRatePercent)
          : undefined
        : null
    if (defaultIgstRatePercent !== undefined)
      product.defaultIgstRatePercent = isGstRegistered
        ? defaultIgstRatePercent !== null && defaultIgstRatePercent !== undefined
          ? Number(defaultIgstRatePercent)
          : undefined
        : null

    product.mainImage = mainImageUrl
    product.images = updatedImageUrls
    product.videos = updatedVideoUrls

    // Safety: for simple non-draft products, require a non-empty main image
    const willHaveVariants = hasVariants === 'true' || hasVariants === true || product.hasVariants
    const finalStatusCandidate = status || product.status
    const isNonDraft = finalStatusCandidate !== 'draft'
    if (!willHaveVariants && isNonDraft) {
      if (!product.mainImage || product.mainImage.trim() === '') {
        return res.status(400).json({
          error: 'Main image is required for simple non-draft products',
        })
      }
    }

    // Check certificate requirements if category changed or status is being updated to non-draft
    const updatedCategory = category ? new mongoose.Types.ObjectId(category) : product.category
    const willBeNonDraft = status && status !== 'draft' && status !== 'pending_approval'
    const categoryChanged = category && category.toString() !== product.category?.toString()

    // Store original status to avoid type narrowing issues (use different name to avoid redeclaration)
    // Explicitly type it to include all possible status values
    const originalProductStatus:
      | 'draft'
      | 'active'
      | 'inactive'
      | 'out_of_stock'
      | 'pending_approval'
      | 'pending_category_approval' = product.status

    if (
      (willBeNonDraft || categoryChanged) &&
      updatedCategory &&
      originalProductStatus !== 'draft'
    ) {
      try {
        const requiredCertificates = await getRequiredCertificatesForCategory(updatedCategory)
        if (requiredCertificates.length > 0) {
          // Update certificate IDs for this product
          const allCertificates = await Certificate.find({
            seller: sellerId,
            certificateType: { $in: requiredCertificates },
          })
            .sort({ createdAt: -1 })
            .exec()

          // Group by certificate type and get the latest one for each type
          const latestByType = new Map<string, typeof allCertificates[0]>()
          for (const cert of allCertificates) {
            const type = cert.certificateType
            if (!latestByType.has(type) || cert.createdAt > latestByType.get(type)!.createdAt) {
              latestByType.set(type, cert)
            }
          }

          // Update product's certificateIds
          product.certificateIds = Array.from(latestByType.values())
            .map((cert) => cert._id as mongoose.Types.ObjectId)
            .filter(Boolean)

          const certificateCheck = await checkSellerCertificates(sellerId, requiredCertificates)
          if (!certificateCheck.hasAllCertificates) {
            // Set status to pending_approval if certificates are missing
            product.status = 'pending_approval'
          } else if (status && status !== 'pending_approval') {
            // Only update status if certificates are valid
            // Final status check based on inventory (for non-draft products)
            if (!(product as any).statusLockedByAdmin) {
              if (product.hasVariants) {
                product.status = (product.totalStock || 0) > 0 ? 'active' : 'out_of_stock'
              } else {
                product.status = (product.stock || 0) > 0 ? 'active' : 'out_of_stock'
              }
            }
          }
        } else {
          // No certificate requirements, proceed with normal status update
          // Final status check based on inventory (for non-draft products)
          // Check if status is one that should be auto-updated (active, inactive, or out_of_stock)
          if (
            (originalProductStatus === 'active' ||
              originalProductStatus === 'inactive' ||
              originalProductStatus === 'out_of_stock') &&
            !(product as any).statusLockedByAdmin
          ) {
            if (product.hasVariants) {
              product.status = (product.totalStock || 0) > 0 ? 'active' : 'out_of_stock'
            } else {
              product.status = (product.stock || 0) > 0 ? 'active' : 'out_of_stock'
            }
          }
        }
      } catch (certErr) {
        console.error('Error checking certificate requirements:', certErr)
        // Don't fail the update, but log the error
        // Final status check based on inventory (for non-draft products)
        // Check if status is one that should be auto-updated (active, inactive, or out_of_stock)
        if (
          (originalProductStatus === 'active' ||
            originalProductStatus === 'inactive' ||
            originalProductStatus === 'out_of_stock') &&
          !(product as any).statusLockedByAdmin
        ) {
          if (product.hasVariants) {
            product.status = (product.totalStock || 0) > 0 ? 'active' : 'out_of_stock'
          } else {
            product.status = (product.stock || 0) > 0 ? 'active' : 'out_of_stock'
          }
        }
      }
    } else {
      // Final status check based on inventory (for non-draft products)
      // Check if status is one that should be auto-updated (active, inactive, or out_of_stock)
      if (
        (originalProductStatus === 'active' ||
          originalProductStatus === 'inactive' ||
          originalProductStatus === 'out_of_stock') &&
        !(product as any).statusLockedByAdmin
      ) {
        if (product.hasVariants) {
          product.status = (product.totalStock || 0) > 0 ? 'active' : 'out_of_stock'
        } else {
          product.status = (product.stock || 0) > 0 ? 'active' : 'out_of_stock'
        }
      }
    }

    await product.save()

    // Handle variants update
    if (hasVariants !== undefined) {
      if (
        hasVariants &&
        parsedVariants &&
        Array.isArray(parsedVariants) &&
        parsedVariants.length > 0
      ) {
        try {
          // Parse variants if string
          // parsedVariants already handled above

          // Validate variants match frontend requirements
          for (const variantData of parsedVariants) {
            if (!variantData.name || !variantData.sku) {
              return res.status(400).json({
                error: 'Each variant must have a name and SKU',
              })
            }
            if (!variantData.attributes || Object.keys(variantData.attributes).length === 0) {
              return res.status(400).json({
                error: 'Each variant must have at least one attribute',
              })
            }
          }

          // Update product with variant info
          product.hasVariants = true
          product.variantAttributes = parsedVariantAttributes || []
          product.totalStock = 0 // Will be calculated from variants
          product.lowStockVariants = 0 // Will be calculated from variants
          await product.save()

          const previousVariantMedia = await ProductVariant.find({ product: id })
            .select('mainImage images videos')
            .lean()
          const previousVariantUrls = new Set<string>()
          previousVariantMedia.forEach((variant) => {
            if (variant.mainImage) previousVariantUrls.add(variant.mainImage)
            if (Array.isArray(variant.images)) {
              variant.images.forEach((img) => previousVariantUrls.add(img))
            }
            if (Array.isArray(variant.videos)) {
              variant.videos.forEach((vid) => previousVariantUrls.add(vid))
            }
          })

          const nextVariantUrls = new Set<string>()

          // Delete existing variants
          await ProductVariant.deleteMany({ product: id })

          // Normalize default selection: ensure exactly one default; if none, set first as default; if only one, set it default
          if (parsedVariants.length === 1) {
            parsedVariants[0].isDefault = true
          } else {
            const numDefaults = parsedVariants.filter((v: any) => v.isDefault).length
            if (numDefaults === 0) parsedVariants[0].isDefault = true
            if (numDefaults > 1) {
              parsedVariants = parsedVariants.map((v: any, idx: number) => ({
                ...v,
                isDefault: idx === 0,
              }))
            }
          }

          // Create new variants
          for (let i = 0; i < parsedVariants.length; i++) {
            const variantData = parsedVariants[i]

            // Debug: Log variant data to see what we're receiving
            console.log(`[Update Product] Variant ${i} data:`, {
              name: variantData.name,
              hsnSacCode: variantData.hsnSacCode,
              gstRatePercent: variantData.gstRatePercent,
            })

            // Convert attributes object to Map for Mongoose
            let attributesMap = new Map()
            if (variantData.attributes && typeof variantData.attributes === 'object') {
              attributesMap = new Map(Object.entries(variantData.attributes))
            }

            // Gather variant media inputs from multipart form
            let variantMainImageUrl = ''

            const existingVariantMain = (req.body as any)[`existingVariantMainImage_${i}`]
            const existingVariantImagesRaw = (req.body as any)[`existingVariantImages_${i}`]
            const existingVariantImages: string[] = existingVariantImagesRaw
              ? (() => {
                  try {
                    return JSON.parse(existingVariantImagesRaw)
                  } catch {
                    return []
                  }
                })()
              : []

            const variantMainFile = files?.[`variantMainImage_${i}`]?.[0]
            const variantImagesFiles = files?.[`variantImages_${i}`] || []
            const variantVideosFiles = files?.[`variantVideos_${i}`] || []
            const variantUploadTimestamp = Date.now()

            const [uploadedVariantMain, uploadedVariantImages, uploadedVariantVideos] =
              await Promise.all([
                variantMainFile
                  ? uploadToR2(
                      variantMainFile.buffer,
                      `${sellerId}/${variantUploadTimestamp}-main-${variantMainFile.originalname}`,
                      variantMainFile.mimetype,
                      'variants',
                    )
                  : Promise.resolve(''),
                uploadFilesToR2(
                  variantImagesFiles,
                  sellerId,
                  'variants',
                  variantUploadTimestamp,
                  'variant image',
                ),
                uploadFilesToR2(
                  variantVideosFiles,
                  sellerId,
                  'variants',
                  variantUploadTimestamp,
                  'variant video',
                ),
              ])

            if (uploadedVariantMain) {
              variantMainImageUrl = uploadedVariantMain
            } else if (existingVariantMain) {
              variantMainImageUrl = existingVariantMain
            } else if (variantData.mainImage && typeof variantData.mainImage === 'string') {
              // Fallback if a URL string was provided directly in payload
              variantMainImageUrl = variantData.mainImage
            }

            // Merge existing variant image URLs
            const allVariantImageUrls = [...existingVariantImages, ...uploadedVariantImages]

            // Handle variant videos
            const existingVariantVideosRaw = (req.body as any)[`existingVariantVideos_${i}`]
            const existingVariantVideos: string[] = existingVariantVideosRaw
              ? (() => {
                  try {
                    return JSON.parse(existingVariantVideosRaw)
                  } catch {
                    return []
                  }
                })()
              : []

            // Merge existing variant video URLs
            const allVariantVideoUrls = [...existingVariantVideos, ...uploadedVariantVideos]

            // Derive product-level GST/HSN defaults for inheritance/prefill
            const productDefaultHsn: string | null =
              (product as any).defaultHsnSacCode ?? (product as any).hsnSacCode ?? null
            const productDefaultCgst: number | null =
              (product as any).defaultCgstRatePercent ?? null
            const productDefaultSgst: number | null =
              (product as any).defaultSgstRatePercent ?? null
            const productDefaultIgst: number | null =
              (product as any).defaultIgstRatePercent ??
              (product as any).defaultGstRatePercent ??
              (product as any).gstRatePercent ??
              (productDefaultCgst != null && productDefaultSgst != null
                ? productDefaultCgst + productDefaultSgst
                : null)

            const rawVariantHsn = variantData.hsnSacCode
            const rawVariantIgst = variantData.igstRatePercent
            const rawVariantGst = variantData.gstRatePercent
            const rawVariantCgst = variantData.cgstRatePercent
            const rawVariantSgst = variantData.sgstRatePercent
            console.log('rawVariantHsn', rawVariantHsn)
            // Use variant GST values directly (no inheritance)
            const effectiveHsn =
              rawVariantHsn !== undefined &&
              rawVariantHsn !== null &&
              String(rawVariantHsn).trim() !== ''
                ? String(rawVariantHsn).trim()
                : undefined

            const effectiveIgst =
              rawVariantIgst !== undefined && rawVariantIgst !== null
                ? Number(rawVariantIgst)
                : rawVariantGst !== undefined && rawVariantGst !== null
                ? Number(rawVariantGst)
                : undefined

            // Handle CGST and SGST - convert to number if provided, allow 0 as valid value
            // Explicitly check if value is a number (including 0) or can be converted to a number
            const effectiveCgst = (() => {
              if (rawVariantCgst === undefined || rawVariantCgst === null) return undefined
              if (rawVariantCgst === '') return undefined
              const numValue = Number(rawVariantCgst)
              // Check if conversion resulted in a valid number (not NaN)
              if (isNaN(numValue)) return undefined
              return numValue
            })()

            const effectiveSgst = (() => {
              if (rawVariantSgst === undefined || rawVariantSgst === null) return undefined
              if (rawVariantSgst === '') return undefined
              const numValue = Number(rawVariantSgst)
              // Check if conversion resulted in a valid number (not NaN)
              if (isNaN(numValue)) return undefined
              return numValue
            })()

            console.log('[Update Product] GST values for variant:', {
              rawCgst: rawVariantCgst,
              rawSgst: rawVariantSgst,
              rawIgst: rawVariantIgst,
              effectiveCgst,
              effectiveSgst,
              effectiveIgst,
              isGstRegistered,
              willSaveCgst: isGstRegistered && effectiveCgst !== undefined,
              willSaveSgst: isGstRegistered && effectiveSgst !== undefined,
            })

            // Prepare variant data with all fields for update
            const variantFields: any = {
              product: id,
              seller: sellerId,
              name: variantData.name,
              sku: await generateUniqueVariantSku(
                sellerId,
                variantData.sku ||
                  `${product.sku}-${variantData.name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()}`,
                id,
              ),
              attributes: attributesMap,
              // Pricing fields (from PricingTab)
              price: variantData.price !== undefined ? Number(variantData.price) : undefined,
              comparePrice: variantData.comparePrice ? Number(variantData.comparePrice) : undefined,
              costPrice: variantData.costPrice ? Number(variantData.costPrice) : undefined,
              discountPercent:
                variantData.discountPercent !== undefined
                  ? Number(variantData.discountPercent)
                  : undefined,
              // Calculated pricing fields
              exclusivePrice:
                variantData.exclusivePrice !== undefined
                  ? Number(variantData.exclusivePrice)
                  : undefined,
              exclusiveTaxAmount:
                variantData.exclusiveTaxAmount !== undefined
                  ? Number(variantData.exclusiveTaxAmount)
                  : undefined,
              effectivePrice:
                variantData.effectivePrice !== undefined
                  ? Number(variantData.effectivePrice)
                  : undefined,
              profit: variantData.profit !== undefined ? Number(variantData.profit) : undefined,
              // Warehouse inventory (must be processed first)
              warehouseInventory: (() => {
                let whInventory = variantData.warehouseInventory

                // Parse if string
                if (typeof whInventory === 'string' && whInventory.trim() !== '') {
                  try {
                    whInventory = JSON.parse(whInventory)
                  } catch (e) {
                    console.error('Failed to parse variant warehouseInventory:', e)
                    whInventory = undefined
                  }
                }

                // Ensure it's an array or undefined
                if (whInventory && Array.isArray(whInventory) && whInventory.length > 0) {
                  // Validate and clean the warehouse inventory data
                  return whInventory.map((wi: any) => ({
                    warehouseId: String(wi.warehouseId || ''),
                    warehouseName: String(wi.warehouseName || ''),
                    quantity: Number(wi.quantity) || 0,
                    lowStockThreshold:
                      wi.lowStockThreshold !== undefined ? Number(wi.lowStockThreshold) : 5,
                  }))
                }

                // Return undefined if empty or invalid
                return undefined
              })(),
              // Inventory fields (from InventoryTab)
              // Stock will be calculated from warehouseInventory in pre-save hook if warehouseInventory exists
              // Only set stock directly if warehouseInventory is not provided
              stock: (() => {
                // Check if warehouseInventory was provided and is valid
                let whInventory = variantData.warehouseInventory
                if (typeof whInventory === 'string' && whInventory.trim() !== '') {
                  try {
                    whInventory = JSON.parse(whInventory)
                  } catch {
                    whInventory = undefined
                  }
                }
                const hasWarehouseInventory =
                  whInventory && Array.isArray(whInventory) && whInventory.length > 0

                if (hasWarehouseInventory) {
                  // Let pre-save hook calculate from warehouseInventory
                  return undefined
                }

                // Otherwise use provided stock value
                return variantData.stock !== undefined ? Number(variantData.stock) : 0
              })(),
              lowStockThreshold:
                variantData.lowStockThreshold !== undefined
                  ? Number(variantData.lowStockThreshold)
                  : 5,
              // Variant metadata
              isDefault: variantData.isDefault || false,
              status: variantData.status || 'active',
              // Media fields
              mainImage: variantMainImageUrl,
              images: allVariantImageUrls,
              videos: allVariantVideoUrls.length > 0 ? allVariantVideoUrls : undefined,
              // Additional fields that might be present
              weight: variantData.weight ? Number(variantData.weight) : undefined,
              dimensions: variantData.dimensions
                ? {
                    length: Number(variantData.dimensions.length) || 0,
                    width: Number(variantData.dimensions.width) || 0,
                    height: Number(variantData.dimensions.height) || 0,
                  }
                : undefined,
              // GST/HSN fields for variants
              // If seller is not GST registered, force nulls; otherwise use provided values
              hsnSacCode: isGstRegistered ? effectiveHsn : null,
              // gstRatePercent is kept for backward compatibility (represents IGST)
              gstRatePercent: isGstRegistered ? effectiveIgst : null,
              // Separate CGST, SGST, IGST fields
              // Save CGST and SGST if provided (even if 0), otherwise undefined
              // Explicitly check for !== undefined to allow 0 as a valid value
              ...(isGstRegistered && effectiveCgst !== undefined
                ? { cgstRatePercent: effectiveCgst }
                : {}),
              ...(isGstRegistered && effectiveSgst !== undefined
                ? { sgstRatePercent: effectiveSgst }
                : {}),
              igstRatePercent: isGstRegistered ? effectiveIgst : null,
            }

            if (variantMainImageUrl) nextVariantUrls.add(variantMainImageUrl)
            allVariantImageUrls.forEach((url) => nextVariantUrls.add(url))
            allVariantVideoUrls.forEach((url) => nextVariantUrls.add(url))

            const variant = new ProductVariant(variantFields)
            await variant.save()
          }

          // Update product total stock from variants
          await updateProductTotalStock(id)

          // Mirror default variant SKU and media to product if missing
          const freshVariants = await ProductVariant.find({ product: id }).sort({
            isDefault: -1,
            createdAt: 1,
          })
          const def = freshVariants[0]
          if (def) {
            if (!product.sku) product.sku = def.sku
            if (!product.mainImage && def.mainImage) product.mainImage = def.mainImage
            if (Array.isArray(def.images) && def.images.length > 0) {
              product.images = Array.isArray(product.images)
                ? Array.from(new Set([...(product.images as string[]), ...def.images]))
                : def.images
            }
            await product.save()
          }

          const protectedUrls = new Set<string>()
          if (product.mainImage) protectedUrls.add(product.mainImage)
          if (Array.isArray(product.images)) {
            product.images.forEach((img) => protectedUrls.add(img))
          }
          if (Array.isArray(product.videos)) {
            product.videos.forEach((vid) => protectedUrls.add(vid))
          }

          const variantUrlsToDelete = Array.from(previousVariantUrls).filter(
            (url) => !nextVariantUrls.has(url) && !protectedUrls.has(url),
          )

          if (variantUrlsToDelete.length > 0) {
            await deleteMultipleFromR2(variantUrlsToDelete)
          }
        } catch (variantError) {
          console.error('Error updating variants:', variantError)
          return res.status(400).json({
            error: 'Failed to update variants. Please check variant data.',
          })
        }
      } else if (!hasVariants) {
        // Remove all variants and update product
        await ProductVariant.deleteMany({ product: id })
        product.hasVariants = false
        product.variantAttributes = []
        product.totalStock = product.stock || 0
        product.lowStockVariants = 0
        await product.save()
      } else if (
        hasVariants &&
        (!parsedVariantAttributes || parsedVariantAttributes.length === 0)
      ) {
        return res.status(400).json({
          error: 'Variant attributes are required when product has variants',
        })
      } else if (hasVariants && (!parsedVariants || parsedVariants.length === 0)) {
        return res.status(400).json({
          error: 'At least one variant is required when product has variants',
        })
      }
    }

    // Final validation: if product (after updates) is simple and non-draft, ensure price > 0
    const finalHasVariants = product.hasVariants
    if (!finalHasVariants && product.status !== 'draft') {
      if (!(product.price && Number(product.price) > 0)) {
        return res.status(400).json({ error: 'Active simple products must have a positive price' })
      }
    }

    // Convert product to object and include variants with warehouseInventory if applicable
    let responseProduct = product.toObject() as any
    if (product.hasVariants) {
      const variants = await ProductVariant.find({ product: id }).sort({
        isDefault: -1,
        createdAt: 1,
      })
      // Convert variants to plain objects to ensure all fields including warehouseInventory are included
      responseProduct.variants = variants.map((v) => v.toObject())
    }

    // Include message if category is not approved
    if (categoryNotApproved) {
      responseProduct.message = 'This brand is not approved for the selected category. Awaiting admin approval.'
      responseProduct.categoryApprovalPending = true
    }

    res.json(responseProduct)
  } catch (err: unknown) {
    console.error('Error updating product:', err)
    const error = err as { code?: number }
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Product name already exists' })
    }
    res.status(500).json({ error: 'Server error' })
  }
}

// Delete product
export const deleteProduct = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user?.userId
    const { id } = req.params

    if (!sellerId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const product = await Product.findOneAndDelete({
      _id: id,
      seller: sellerId,
    })
    if (!product) {
      return res.status(404).json({ error: 'Product not found' })
    }

    // Delete all variants of this product
    await ProductVariant.deleteMany({ product: id })

    // Remove this product from all carts
    try {
      await Cart.updateMany({ 'items.product': id }, { $pull: { items: { product: id } } })
    } catch (cartError) {
      console.error('Error removing product from carts:', cartError)
      // Don't fail the deletion if cart update fails
    }

    // Delete images from R2
    const imagesToDelete = [product.mainImage, ...product.images].filter(Boolean) as string[]
    if (imagesToDelete.length > 0) {
      await deleteMultipleFromR2(imagesToDelete)
    }

    res.json({ message: 'Product deleted successfully' })
  } catch (err: unknown) {
    console.error('Error deleting product:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Duplicate product
export const duplicateProduct = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user?.userId
    const { id } = req.params

    if (!sellerId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const original = await Product.findOne({ _id: id, seller: sellerId })
    if (!original) {
      return res.status(404).json({ error: 'Product not found' })
    }

    // Create a copy with new name, slug, and sku
    const copyName = `Copy of ${original.name}`
    const slugBase = copyName
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
    let slug = slugBase
    let i = 1
    while (await Product.findOne({ seller: sellerId, slug })) {
      slug = `${slugBase}-${i++}`
    }

    const newSku = `${original.sku}-COPY-${Date.now()}`

    const duplicated = new Product({
      seller: original.seller,
      name: copyName,
      slug,
      description: original.description,
      shortDescription: original.shortDescription,
      price: original.price,
      comparePrice: original.comparePrice,
      costPrice: original.costPrice,
      category: original.category,
      brand: original.brand,
      stock: 0, // start at 0 for safety
      sku: newSku,
      status: 'draft',
      isFeatured: false,
      mainImage: original.mainImage,
      images: original.images,
      specifications: (() => {
        // Merge old features into specifications for backward compatibility
        const oldSpecs = original.specifications || []
        const oldFeatures = (original as any).features || []
        const mergedSpecs = [
          ...oldSpecs.map((s: any) => ({ key: s.key || '', value: s.value })),
          ...oldFeatures.map((f: string) => ({ key: '', value: f })), // Empty key for simple features
        ]
        return mergedSpecs.length > 0 ? mergedSpecs : undefined
      })(),
      tags: original.tags,
      filterMetadata: original.filterMetadata,
    })

    await duplicated.save()
    res.status(201).json(duplicated)
  } catch (err: unknown) {
    console.error('Error duplicating product:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Bulk delete products
export const bulkDeleteProducts = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user?.userId
    const { productIds } = req.body

    if (!sellerId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ error: 'Product IDs are required' })
    }

    // Find all products
    const products = await Product.find({
      _id: { $in: productIds },
      seller: sellerId,
    })

    // Collect all image URLs to delete
    const imagesToDelete: string[] = []
    products.forEach((product) => {
      if (product.mainImage) imagesToDelete.push(product.mainImage)
      imagesToDelete.push(...product.images)
    })

    // Delete products from database
    await Product.deleteMany({ _id: { $in: productIds }, seller: sellerId })

    // Delete all variants of these products
    await ProductVariant.deleteMany({ product: { $in: productIds } })

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

    // Delete images from R2
    if (imagesToDelete.length > 0) {
      await deleteMultipleFromR2(imagesToDelete)
    }

    res.json({ message: `${products.length} products deleted successfully` })
  } catch (err: unknown) {
    console.error('Error bulk deleting products:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Bulk update product status
export const bulkUpdateProductStatus = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user?.userId
    const { productIds, status } = req.body

    if (!sellerId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ error: 'Product IDs are required' })
    }

    if (!['active', 'inactive', 'draft'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' })
    }

    // Check seller status if trying to activate products
    if (status === 'active' || status === 'inactive') {
      const seller = await User.findById(sellerId)
      if (!seller || seller.role !== 'seller') {
        return res.status(404).json({ error: 'Seller not found' })
      }

      // Get products that are currently draft
      const draftProducts = await Product.find({
        _id: { $in: productIds },
        seller: sellerId,
        status: 'draft',
      })

      if (draftProducts.length > 0) {
        // Check KYC approval
        if (!seller.isApproved) {
          return res.status(403).json({
            error: 'KYC approval required',
            message:
              'Your KYC is under review. You can only publish products after your account is approved.',
            code: 'KYC_NOT_APPROVED',
          })
        }

        // Check essential store info
        const missingInfo: string[] = []
        if (!seller.storeDescription || seller.storeDescription.trim().length === 0) {
          missingInfo.push('store description')
        }
        if (!seller.shippingPolicy || seller.shippingPolicy.trim().length === 0) {
          missingInfo.push('shipping policy')
        }
        if (!seller.returnPolicy || seller.returnPolicy.trim().length === 0) {
          missingInfo.push('return policy')
        }
        if (!seller.storeLogo) {
          missingInfo.push('store logo')
        }
        if (!seller.storeEmail || seller.storeEmail.trim().length === 0) {
          missingInfo.push('store email')
        }
        if (!seller.storePhone || seller.storePhone.trim().length === 0) {
          missingInfo.push('store phone')
        }
        if (!seller.supportEmail || seller.supportEmail.trim().length === 0) {
          missingInfo.push('support email')
        }
        if (!seller.marketplaceTermsAccepted) {
          missingInfo.push('marketplace terms acceptance')
        }
        if (!seller.sellerAgreementSigned) {
          missingInfo.push('seller agreement signature')
        }
        if (!seller.returnRefundPolicyAccepted) {
          missingInfo.push('return & refund policy acceptance')
        }

        if (missingInfo.length > 0) {
          return res.status(403).json({
            error: 'Store information incomplete',
            message: `Please complete the following before publishing products: ${missingInfo.join(
              ', ',
            )}`,
            code: 'STORE_INFO_INCOMPLETE',
            missingFields: missingInfo,
          })
        }
      }
    }

    const result = await Product.updateMany(
      { _id: { $in: productIds }, seller: sellerId },
      { $set: { status } },
    )

    res.json({
      message: `${result.modifiedCount} products updated successfully`,
    })
  } catch (err: unknown) {
    console.error('Error bulk updating product status:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Adjust product stock (increment/decrement)
export const adjustProductStock = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user?.userId
    const { id } = req.params
    const { delta, reason } = req.body as { delta: number; reason?: string }

    if (!sellerId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }
    if (typeof delta !== 'number' || !Number.isFinite(delta)) {
      return res.status(400).json({ error: 'Valid delta is required' })
    }

    const product = await Product.findOne({ _id: id, seller: sellerId })
    if (!product) {
      return res.status(404).json({ error: 'Product not found' })
    }

    // Check if product has variants - if yes, prevent product-level stock adjustment
    if (product.hasVariants) {
      return res.status(400).json({
        error: 'This product has variants. Please adjust stock at the variant level instead.',
      })
    }

    // Check if product uses warehouse inventory - if yes, prevent direct stock adjustment
    if (
      product.warehouseInventory &&
      Array.isArray(product.warehouseInventory) &&
      product.warehouseInventory.length > 0
    ) {
      return res.status(400).json({
        error:
          'This product uses warehouse inventory. Please update stock through warehouse inventory management instead.',
      })
    }

    const previousStock = product.stock
    const newStock = Math.max(0, previousStock + Math.trunc(delta))
    product.stock = newStock

    // Update status based on stock (for non-draft products)
    if (product.status !== 'draft' && !(product as any).statusLockedByAdmin) {
      if (newStock === 0) {
        product.status = 'out_of_stock'
      } else if (newStock > 0) {
        product.status = 'active'
      }
    }

    await product.save()

    await InventoryLog.create({
      product: product._id,
      seller: product.seller,
      type: 'adjust',
      quantityChange: newStock - previousStock,
      previousStock,
      newStock,
      reason,
    })

    // Low stock notification if tracking and crossing threshold
    try {
      if ((product as any).trackInventory) {
        const thr = (product as any).lowStockThreshold ?? 5
        const wasOk = previousStock > thr
        const nowLow = newStock <= thr
        if (wasOk && nowLow) {
          io.to(`user:${(product as any).seller}`).emit('inventory:low', {
            productId: String(product._id),
            stock: newStock,
            threshold: thr,
          })
        }
      }
    } catch {}

    res.json({ stock: product.stock })
  } catch (err: unknown) {
    console.error('Error adjusting stock:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Set product stock to an exact number
export const setProductStock = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user?.userId
    const { id } = req.params
    const { stock, reason } = req.body as { stock: number; reason?: string }

    if (!sellerId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }
    if (typeof stock !== 'number' || !Number.isFinite(stock) || stock < 0) {
      return res.status(400).json({ error: 'Valid non-negative stock is required' })
    }

    const product = await Product.findOne({ _id: id, seller: sellerId })
    if (!product) {
      return res.status(404).json({ error: 'Product not found' })
    }

    // Check if product has variants - if yes, prevent product-level stock adjustment
    if (product.hasVariants) {
      return res.status(400).json({
        error: 'This product has variants. Please set stock at the variant level instead.',
      })
    }

    // Check if product uses warehouse inventory - if yes, prevent direct stock setting
    if (
      product.warehouseInventory &&
      Array.isArray(product.warehouseInventory) &&
      product.warehouseInventory.length > 0
    ) {
      return res.status(400).json({
        error:
          'This product uses warehouse inventory. Please update stock through warehouse inventory management instead.',
      })
    }

    const previousStock = product.stock
    const newStock = Math.trunc(stock)
    product.stock = newStock

    // Update status based on stock (for non-draft products)
    if (product.status !== 'draft' && !(product as any).statusLockedByAdmin) {
      if (newStock === 0) {
        product.status = 'out_of_stock'
      } else if (newStock > 0) {
        product.status = 'active'
      }
    }

    await product.save()

    await InventoryLog.create({
      product: product._id,
      seller: product.seller,
      type: 'set',
      quantityChange: newStock - previousStock,
      previousStock,
      newStock,
      reason,
    })

    // Low stock notification if tracking and crossing threshold
    try {
      if ((product as any).trackInventory) {
        const thr = (product as any).lowStockThreshold ?? 5
        const wasOk = previousStock > thr
        const nowLow = newStock <= thr
        if (wasOk && nowLow) {
          io.to(`user:${(product as any).seller}`).emit('inventory:low', {
            productId: String(product._id),
            stock: newStock,
            threshold: thr,
          })
        }
      }
    } catch {}

    res.json({ stock: product.stock })
  } catch (err: unknown) {
    console.error('Error setting stock:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Update low stock threshold
export const updateLowStockThreshold = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user?.userId
    const { id } = req.params
    const { threshold } = req.body as { threshold: number }

    if (!sellerId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }
    if (typeof threshold !== 'number' || !Number.isFinite(threshold) || threshold < 0) {
      return res.status(400).json({ error: 'Valid non-negative threshold is required' })
    }

    const product = await Product.findOne({ _id: id, seller: sellerId })
    if (!product) {
      return res.status(404).json({ error: 'Product not found' })
    }

    // Check if product has variants - if yes, prevent product-level threshold update
    if (product.hasVariants) {
      return res.status(400).json({
        error:
          'This product has variants. Please set low stock threshold at the variant level instead.',
      })
    }

    product.lowStockThreshold = Math.trunc(threshold)
    await product.save()

    res.json({ lowStockThreshold: product.lowStockThreshold })
  } catch (err: unknown) {
    console.error('Error updating low stock threshold:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Get inventory logs for a product
export const getInventoryLogs = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user?.userId
    const { id } = req.params
    const { page = 1, limit = 10 } = req.query

    if (!sellerId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const product = await Product.findOne({ _id: id, seller: sellerId }).select('_id')
    if (!product) {
      return res.status(404).json({ error: 'Product not found' })
    }

    const skip = (Number(page) - 1) * Number(limit)

    const [logs, total] = await Promise.all([
      InventoryLog.find({ product: product._id, seller: sellerId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      InventoryLog.countDocuments({ product: product._id, seller: sellerId }),
    ])

    res.json({
      logs,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
    })
  } catch (err: unknown) {
    console.error('Error fetching inventory logs:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Variant Management
export const createProductVariant = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user?.userId
    const { productId } = req.params
    const {
      name,
      sku,
      attributes,
      price,
      comparePrice,
      costPrice,
      stock,
      lowStockThreshold,
      weight,
      dimensions,
      isDefault,
      warehouseInventory,
      // GST/HSN fields
      hsnSacCode,
      gstRatePercent,
      igstRatePercent,
      cgstRatePercent,
      sgstRatePercent,
    } = req.body

    if (!sellerId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    // Verify product exists and belongs to seller
    const product = await Product.findOne({ _id: productId, seller: sellerId })
    if (!product) {
      return res.status(404).json({ error: 'Product not found' })
    }

    // Check if seller is GST registered
    const seller = await User.findById(sellerId).select('gstNumber')
    const isGstRegistered = Boolean((seller as any)?.gstNumber)

    // Process GST fields
    const rawVariantHsn = hsnSacCode
    const rawVariantIgst = igstRatePercent
    const rawVariantGst = gstRatePercent
    const rawVariantCgst = cgstRatePercent
    const rawVariantSgst = sgstRatePercent

    // Use variant GST values directly (no inheritance)
    const effectiveHsn =
      rawVariantHsn !== undefined && rawVariantHsn !== null && String(rawVariantHsn).trim() !== ''
        ? String(rawVariantHsn).trim()
        : undefined

    const effectiveIgst =
      rawVariantIgst !== undefined && rawVariantIgst !== null
        ? Number(rawVariantIgst)
        : rawVariantGst !== undefined && rawVariantGst !== null
        ? Number(rawVariantGst)
        : undefined

    // Handle CGST and SGST - convert to number if provided, allow 0 as valid value
    const effectiveCgst = (() => {
      if (rawVariantCgst === undefined || rawVariantCgst === null) return undefined
      if (rawVariantCgst === '') return undefined
      const numValue = Number(rawVariantCgst)
      if (isNaN(numValue)) return undefined
      return numValue
    })()

    const effectiveSgst = (() => {
      if (rawVariantSgst === undefined || rawVariantSgst === null) return undefined
      if (rawVariantSgst === '') return undefined
      const numValue = Number(rawVariantSgst)
      if (isNaN(numValue)) return undefined
      return numValue
    })()

    // If this is the first variant, set hasVariants to true
    const existingVariants = await ProductVariant.countDocuments({
      product: productId,
    })
    if (existingVariants === 0) {
      await Product.updateOne({ _id: productId }, { hasVariants: true })
    }

    // Handle variant image uploads
    let mainImageUrl = ''
    let imageUrls: string[] = []

    // Check for existing main image URL
    if (req.body.existingMainImage) {
      mainImageUrl = req.body.existingMainImage
    }

    // Check for existing images URLs
    if (req.body.existingImages) {
      try {
        imageUrls = JSON.parse(req.body.existingImages)
      } catch (e) {
        console.error('Failed to parse existing images:', e)
        imageUrls = []
      }
    }

    if (req.files) {
      const files = req.files as Record<string, Express.Multer.File[]>

      // Upload new main image (overwrites existing)
      if (files.mainImage?.[0]) {
        const mainImageFile = files.mainImage[0]
        mainImageUrl = await uploadToR2(
          mainImageFile.buffer,
          `${sellerId}/${Date.now()}-${mainImageFile.originalname}`,
          mainImageFile.mimetype,
          'variants',
        )
      }

      // Upload new additional images (adds to existing)
      if (files.images?.length) {
        const newImageUrls = await Promise.all(
          files.images.map((file) =>
            uploadToR2(
              file.buffer,
              `${sellerId}/${Date.now()}-${file.originalname}`,
              file.mimetype,
              'variants',
            ),
          ),
        )
        imageUrls = [...imageUrls, ...newImageUrls]
      }
    }

    // Handle attributes field - convert to Map format if it exists
    let attributesMap = new Map()
    let processedAttributes = attributes

    if (processedAttributes) {
      // If it's a string (JSON), parse it first
      if (typeof processedAttributes === 'string') {
        try {
          processedAttributes = JSON.parse(processedAttributes)
        } catch (e) {
          console.error('Failed to parse attributes JSON in create:', e)
          processedAttributes = {}
        }
      }

      // Convert plain object to Map format for Mongoose
      if (typeof processedAttributes === 'object' && processedAttributes !== null) {
        attributesMap = new Map(Object.entries(processedAttributes))
      }
    }

    // Handle warehouse inventory if provided
    let parsedWarehouseInventory = warehouseInventory
    if (typeof warehouseInventory === 'string') {
      try {
        parsedWarehouseInventory = JSON.parse(warehouseInventory)
      } catch (e) {
        console.error('Failed to parse warehouseInventory:', e)
        parsedWarehouseInventory = undefined
      }
    }

    // Calculate stock from warehouse inventory if available, otherwise use provided stock
    let processedStock = 0
    if (
      parsedWarehouseInventory &&
      Array.isArray(parsedWarehouseInventory) &&
      parsedWarehouseInventory.length > 0
    ) {
      // Sum quantities from all warehouses
      processedStock = parsedWarehouseInventory.reduce(
        (sum: number, wi: { quantity?: number }) => sum + (Number(wi.quantity) || 0),
        0,
      )
      console.log(`[Create Variant] Calculated stock from warehouseInventory: ${processedStock}`)
    } else {
      // Use provided stock value
      processedStock =
        stock !== undefined && stock !== null && stock !== ''
          ? Math.max(0, Math.trunc(Number(stock)))
          : 0
    }

    // Default selection policy: do NOT auto-select default on create.
    // If explicitly requested as default, unset siblings first to satisfy unique constraint.
    let finalIsDefault = isDefault === true
    if (finalIsDefault) {
      await ProductVariant.updateMany(
        { product: productId, seller: sellerId },
        { $set: { isDefault: false } },
      )
    }

    const variant = new ProductVariant({
      product: productId,
      seller: sellerId,
      name,
      sku: sku || `V-${Date.now()}`,
      attributes: attributesMap,
      price: price !== undefined && price !== null && price !== '' ? Number(price) : undefined,
      comparePrice:
        comparePrice !== undefined && comparePrice !== null && comparePrice !== ''
          ? Number(comparePrice)
          : undefined,
      costPrice:
        costPrice !== undefined && costPrice !== null && costPrice !== ''
          ? Number(costPrice)
          : undefined,
      stock: processedStock,
      lowStockThreshold: lowStockThreshold || 5,
      warehouseInventory:
        parsedWarehouseInventory && Array.isArray(parsedWarehouseInventory)
          ? parsedWarehouseInventory.map((wi: any) => ({
              warehouseId: String(wi.warehouseId || ''),
              warehouseName: String(wi.warehouseName || ''),
              quantity: Number(wi.quantity) || 0,
              lowStockThreshold:
                wi.lowStockThreshold !== undefined ? Number(wi.lowStockThreshold) : 5,
            }))
          : undefined,
      weight,
      dimensions,
      isDefault: finalIsDefault,
      // Handle variant images
      mainImage: mainImageUrl,
      images: imageUrls,
      // GST/HSN fields for variants
      // If seller is not GST registered, force nulls; otherwise use provided values
      hsnSacCode: isGstRegistered ? effectiveHsn : null,
      // gstRatePercent is kept for backward compatibility (represents IGST)
      gstRatePercent: isGstRegistered ? effectiveIgst : null,
      // Separate CGST, SGST, IGST fields
      // Save CGST and SGST if provided (even if 0), otherwise undefined
      ...(isGstRegistered && effectiveCgst !== undefined ? { cgstRatePercent: effectiveCgst } : {}),
      ...(isGstRegistered && effectiveSgst !== undefined ? { sgstRatePercent: effectiveSgst } : {}),
      igstRatePercent: isGstRegistered ? effectiveIgst : null,
    })

    await variant.save()

    // Update product total stock
    await updateProductTotalStock(productId)

    res.status(201).json(variant)
  } catch (err: unknown) {
    console.error('Error creating product variant:', err)
    const error = err as { code?: number }
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Variant SKU already exists' })
    }
    res.status(500).json({ error: 'Server error' })
  }
}

export const getProductVariants = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user?.userId
    const { productId } = req.params

    if (!sellerId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const variants = await ProductVariant.find({
      product: productId,
      seller: sellerId,
    }).sort({
      isDefault: -1,
      createdAt: 1,
    })

    res.json(variants)
  } catch (err: unknown) {
    console.error('Error fetching product variants:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

export const updateProductVariant = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user?.userId
    const { variantId } = req.params
    const updateData = req.body

    if (!sellerId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    // Handle variant image uploads
    let mainImageUrl = ''
    let imageUrls: string[] = []

    // Check for existing main image URL
    if (req.body.existingMainImage) {
      mainImageUrl = req.body.existingMainImage
    }

    // Check for existing images URLs
    if (req.body.existingImages) {
      try {
        imageUrls = JSON.parse(req.body.existingImages)
      } catch (e) {
        console.error('Failed to parse existing images:', e)
        imageUrls = []
      }
    }

    if (req.files) {
      const files = req.files as Record<string, Express.Multer.File[]>

      // Upload new main image (overwrites existing)
      if (files.mainImage?.[0]) {
        const mainImageFile = files.mainImage[0]
        mainImageUrl = await uploadToR2(
          mainImageFile.buffer,
          `${sellerId}/${Date.now()}-${mainImageFile.originalname}`,
          mainImageFile.mimetype,
          'variants',
        )
      }

      // Upload new additional images (adds to existing)
      if (files.images?.length) {
        const newImageUrls = await Promise.all(
          files.images.map((file) =>
            uploadToR2(
              file.buffer,
              `${sellerId}/${Date.now()}-${file.originalname}`,
              file.mimetype,
              'variants',
            ),
          ),
        )
        imageUrls = [...imageUrls, ...newImageUrls]
      }
    }

    // Update the data with image URLs
    if (mainImageUrl) {
      updateData.mainImage = mainImageUrl
    }
    if (imageUrls.length > 0) {
      updateData.images = imageUrls
    }

    // Handle attributes field - convert to Map format if it exists
    if (updateData.attributes) {
      console.log('Raw attributes:', updateData.attributes, 'Type:', typeof updateData.attributes)

      // If it's a string (JSON), parse it first
      if (typeof updateData.attributes === 'string') {
        try {
          updateData.attributes = JSON.parse(updateData.attributes)
        } catch (e) {
          console.error('Failed to parse attributes JSON:', e)
          updateData.attributes = {}
        }
      }

      // Convert plain object to Map format for Mongoose
      if (typeof updateData.attributes === 'object' && updateData.attributes !== null) {
        const attributesMap = new Map(Object.entries(updateData.attributes))
        updateData.attributes = attributesMap
        console.log('Converted attributes to Map:', attributesMap)
      }
    }

    // Handle warehouse inventory if provided
    if (updateData.warehouseInventory !== undefined) {
      // Parse warehouse inventory if it's a string
      if (typeof updateData.warehouseInventory === 'string') {
        try {
          updateData.warehouseInventory = JSON.parse(updateData.warehouseInventory)
        } catch (e) {
          console.error('Failed to parse warehouseInventory:', e)
          delete updateData.warehouseInventory
        }
      }
      // If warehouseInventory is provided, calculate stock from it and remove direct stock update
      if (
        updateData.warehouseInventory &&
        Array.isArray(updateData.warehouseInventory) &&
        updateData.warehouseInventory.length > 0
      ) {
        // Calculate total stock from warehouse inventory
        const totalWarehouseStock = updateData.warehouseInventory.reduce(
          (sum: number, wi: { quantity?: number }) => sum + (Number(wi.quantity) || 0),
          0,
        )
        // Set stock to the calculated value (findOneAndUpdate doesn't trigger pre-save hook)
        updateData.stock = totalWarehouseStock
        console.log(
          `[Update Variant] Calculated stock from warehouseInventory: ${totalWarehouseStock}`,
        )
      } else {
        // If warehouseInventory is empty array, remove it and allow direct stock update
        delete updateData.warehouseInventory
      }
    }

    // Normalize numeric fields to avoid NaN
    ;(['price', 'comparePrice', 'costPrice', 'stock', 'lowStockThreshold'] as const).forEach(
      (key) => {
        if (updateData[key] === '' || updateData[key] === null) delete (updateData as any)[key]
        else if (updateData[key] !== undefined) (updateData as any)[key] = Number(updateData[key])
      },
    )

    // Handle GST fields (IGST, SGST, CGST) - check if seller is GST registered
    const seller = await User.findById(sellerId).select('gstNumber')
    const isGstRegistered = Boolean((seller as any)?.gstNumber)

    // Process IGST field
    if (updateData.igstRatePercent !== undefined) {
      if (isGstRegistered) {
        if (updateData.igstRatePercent === '' || updateData.igstRatePercent === null) {
          updateData.igstRatePercent = null
        } else {
          updateData.igstRatePercent = Number(updateData.igstRatePercent)
        }
      } else {
        updateData.igstRatePercent = null
      }
    }

    // Process SGST field
    if (updateData.sgstRatePercent !== undefined) {
      if (isGstRegistered) {
        if (updateData.sgstRatePercent === '' || updateData.sgstRatePercent === null) {
          updateData.sgstRatePercent = null // Set to null instead of deleting
        } else {
          const numValue = Number(updateData.sgstRatePercent)
          if (!isNaN(numValue)) {
            updateData.sgstRatePercent = numValue
          } else {
            updateData.sgstRatePercent = null // Set to null instead of deleting
          }
        }
      } else {
        updateData.sgstRatePercent = null
      }
    } else {
      // If not provided, don't include in update (preserve existing value)
      delete (updateData as any).sgstRatePercent
    }

    // Process CGST field
    if (updateData.cgstRatePercent !== undefined) {
      if (isGstRegistered) {
        if (updateData.cgstRatePercent === '' || updateData.cgstRatePercent === null) {
          updateData.cgstRatePercent = null // Set to null instead of deleting
        } else {
          const numValue = Number(updateData.cgstRatePercent)
          if (!isNaN(numValue)) {
            updateData.cgstRatePercent = numValue
          } else {
            updateData.cgstRatePercent = null // Set to null instead of deleting
          }
        }
      } else {
        updateData.cgstRatePercent = null
      }
    } else {
      // If not provided, don't include in update (preserve existing value)
      delete (updateData as any).cgstRatePercent
    }

    // Handle legacy gstRatePercent field (maps to IGST)
    if (updateData.gstRatePercent !== undefined) {
      if (isGstRegistered) {
        if (updateData.gstRatePercent === '' || updateData.gstRatePercent === null) {
          updateData.gstRatePercent = null
        } else {
          updateData.gstRatePercent = Number(updateData.gstRatePercent)
          // If igstRatePercent is not explicitly set, use gstRatePercent as IGST
          if (updateData.igstRatePercent === undefined) {
            updateData.igstRatePercent = updateData.gstRatePercent
          }
        }
      } else {
        updateData.gstRatePercent = null
      }
    }

    // Handle HSN/SAC code
    if (updateData.hsnSacCode !== undefined) {
      if (isGstRegistered) {
        if (updateData.hsnSacCode === '' || updateData.hsnSacCode === null) {
          updateData.hsnSacCode = null
        } else {
          updateData.hsnSacCode = String(updateData.hsnSacCode).trim()
        }
      } else {
        updateData.hsnSacCode = null
      }
    }

    // Robust default handling without relying on transactions (works on standalone Mongo too)
    let variantDoc: any = null
    const current = await ProductVariant.findOne({
      _id: variantId,
      seller: sellerId,
    })
    if (!current) {
      return res.status(404).json({ error: 'Variant not found' })
    }

    // Coerce toggleDefault from possible string/boolean payloads
    let toggleDefault: boolean | undefined
    if (typeof updateData.isDefault === 'boolean') {
      toggleDefault = updateData.isDefault
    } else if (typeof updateData.isDefault === 'string') {
      const v = updateData.isDefault.toLowerCase()
      if (v === 'true' || v === '1') toggleDefault = true
      else if (v === 'false' || v === '0') toggleDefault = false
    }
    const willUnsetDefault = toggleDefault === false && current.isDefault === true

    // Always remove isDefault from the general update to avoid unique index conflicts during field updates
    if (Object.prototype.hasOwnProperty.call(updateData, 'isDefault'))
      delete (updateData as any).isDefault

    // If warehouseInventory exists (current or new), ensure stock is calculated from it
    // Since findOneAndUpdate doesn't trigger pre-save hooks, we calculate stock manually
    const hasWarehouseInventory =
      (updateData.warehouseInventory &&
        Array.isArray(updateData.warehouseInventory) &&
        updateData.warehouseInventory.length > 0) ||
      (current.warehouseInventory &&
        Array.isArray(current.warehouseInventory) &&
        current.warehouseInventory.length > 0)

    if (hasWarehouseInventory) {
      // Use the warehouseInventory from updateData if provided, otherwise use current
      const warehouseInventoryToUse =
        updateData.warehouseInventory && Array.isArray(updateData.warehouseInventory)
          ? updateData.warehouseInventory
          : current.warehouseInventory

      if (warehouseInventoryToUse && Array.isArray(warehouseInventoryToUse)) {
        // Calculate total stock from warehouse inventory
        const totalWarehouseStock = warehouseInventoryToUse.reduce(
          (sum: number, wi: { quantity?: number }) => sum + (Number(wi.quantity) || 0),
          0,
        )
        // Set stock to the calculated value (findOneAndUpdate doesn't trigger pre-save hook)
        updateData.stock = totalWarehouseStock
        console.log(
          `[Update Variant] Calculated stock from warehouseInventory: ${totalWarehouseStock}`,
        )
      }
    }

    // If stock is updated and no explicit status provided, auto-derive variant status from stock
    // (Only if warehouseInventory doesn't exist - otherwise status will be derived from calculated stock)
    if (
      Object.prototype.hasOwnProperty.call(updateData, 'stock') &&
      updateData.status === undefined &&
      !hasWarehouseInventory
    ) {
      const nextStock =
        typeof updateData.stock === 'number' ? updateData.stock : Number(updateData.stock)
      if (!Number.isNaN(nextStock)) {
        updateData.status = nextStock === 0 ? 'out_of_stock' : 'active'
      }
    }

    const updateQuery: any = { $set: updateData }
    variantDoc = await ProductVariant.findOneAndUpdate(
      { _id: variantId, seller: sellerId },
      updateQuery,
      { new: true },
    )
    if (!variantDoc) return res.status(404).json({ error: 'Variant not found' })

    // Now handle default toggling separately to avoid E11000
    if (toggleDefault === true) {
      // Clear all defaults for this product, then set this variant as default
      await ProductVariant.updateMany({ product: current.product }, { $set: { isDefault: false } })
      await ProductVariant.updateOne({ _id: variantId }, { $set: { isDefault: true } })
      variantDoc = await ProductVariant.findById(variantId)
    } else if (toggleDefault === false) {
      // Unset default on this variant
      await ProductVariant.updateOne({ _id: variantId }, { $set: { isDefault: false } })
      // Ensure there is still one default: if none, pick the oldest and set as default
      const anyDefault = await ProductVariant.exists({
        product: current.product,
        isDefault: true,
      })
      if (!anyDefault) {
        const oldest = await ProductVariant.findOne({
          product: current.product,
        }).sort({
          createdAt: 1,
        })
        if (oldest) {
          oldest.isDefault = true
          await oldest.save()
        }
      }
      variantDoc = await ProductVariant.findById(variantId)
    }

    if (!variantDoc) {
      return res.status(404).json({ error: 'Variant not found' })
    }

    // Safety check: ensure exactly one default after operations
    if (toggleDefault === true) {
      const defaults = await ProductVariant.find({
        product: current.product,
        isDefault: true,
      })
      if (defaults.length > 1) {
        // Keep the most recent (target) and unset others
        const toUnset = defaults
          .filter((d) => String(d._id) !== String(variantDoc._id))
          .map((d) => d._id)
        if (toUnset.length) {
          await ProductVariant.updateMany({ _id: { $in: toUnset } }, { $set: { isDefault: false } })
        }
      } else if (defaults.length === 0) {
        // If none ended up default, set the target as default
        await ProductVariant.updateOne({ _id: variantDoc._id }, { $set: { isDefault: true } })
      }
    }

    if (willUnsetDefault) {
      const hasAnyDefault = await ProductVariant.exists({
        product: current.product,
        isDefault: true,
      })
      if (!hasAnyDefault) {
        const oldest = await ProductVariant.findOne({
          product: current.product,
        }).sort({
          createdAt: 1,
        })
        if (oldest) {
          oldest.isDefault = true
          await oldest.save()
        }
      }
    }

    if (!variantDoc) {
      return res.status(404).json({ error: 'Variant not found' })
    }

    // Ensure stock is correctly calculated from warehouseInventory (safety check)
    // This ensures consistency even if findOneAndUpdate didn't properly set the stock
    if (
      variantDoc.warehouseInventory &&
      Array.isArray(variantDoc.warehouseInventory) &&
      variantDoc.warehouseInventory.length > 0
    ) {
      const calculatedStock = variantDoc.warehouseInventory.reduce(
        (sum: number, wi: { quantity?: number }) => sum + (Number(wi.quantity) || 0),
        0,
      )
      if (variantDoc.stock !== calculatedStock) {
        variantDoc.stock = calculatedStock
        // Update status based on stock
        if (calculatedStock === 0 && variantDoc.status === 'active') {
          variantDoc.status = 'out_of_stock'
        } else if (calculatedStock > 0 && variantDoc.status === 'out_of_stock') {
          variantDoc.status = 'active'
        }
        await variantDoc.save()
        console.log(
          `[Update Variant] Corrected stock from ${variantDoc.stock} to ${calculatedStock} after update`,
        )
      }
    }

    // Update product total stock
    await updateProductTotalStock((variantDoc.product as any).toString())

    res.json(variantDoc)
  } catch (err: unknown) {
    console.error('Error updating product variant:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

export const deleteProductVariant = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user?.userId
    const { variantId } = req.params

    if (!sellerId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const variant = await ProductVariant.findOneAndDelete({
      _id: variantId,
      seller: sellerId,
    })
    if (!variant) {
      return res.status(404).json({ error: 'Variant not found' })
    }

    // Remove this variant from all carts
    try {
      await Cart.updateMany(
        { 'items.variant': variantId },
        { $pull: { items: { variant: variantId } } },
      )
    } catch (cartError) {
      console.error('Error removing variant from carts:', cartError)
      // Don't fail the deletion if cart update fails
    }

    // Update product total stock
    await updateProductTotalStock((variant.product as any).toString())

    // Check if no variants left, set hasVariants to false
    const remainingVariants = await ProductVariant.countDocuments({
      product: variant.product,
    })
    if (remainingVariants === 0) {
      await Product.updateOne({ _id: variant.product }, { hasVariants: false, totalStock: 0 })
    } else {
      // Ensure one default remains: if none is default, mark the oldest as default
      const remainingList = await ProductVariant.find({
        product: variant.product,
      })
        .sort({ isDefault: -1, createdAt: 1 })
        .limit(2)
      const hasDefault = remainingList.some((v) => v.isDefault)
      if (!hasDefault && remainingList.length > 0) {
        remainingList[0].isDefault = true
        await remainingList[0].save()
      }
    }

    res.json({ message: 'Variant deleted successfully' })
  } catch (err: unknown) {
    console.error('Error deleting product variant:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Export products as CSV
export const exportProductsCSV = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user?.userId
    if (!sellerId) return res.status(401).json({ error: 'Not authenticated' })

    const products = await Product.find({ seller: sellerId }).populate('category', 'name')

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
    res.setHeader('Content-Disposition', 'attachment; filename="products.csv"')
    res.send(csv)
  } catch (err: unknown) {
    console.error('Error exporting CSV:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Import products from CSV
export const importProductsCSV = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user?.userId
    if (!sellerId) return res.status(401).json({ error: 'Not authenticated' })

    const file = (req as any).file as Express.Multer.File
    if (!file) return res.status(400).json({ error: 'CSV file is required' })

    const content = file.buffer.toString('utf-8')
    const lines = content.split(/\r?\n/).filter(Boolean)
    if (lines.length < 2) return res.status(400).json({ error: 'CSV has no data' })

    const header = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''))
    const idx = (name: string) => header.indexOf(name)

    let created = 0
    let skipped = 0
    for (let i = 1; i < lines.length; i++) {
      const cols =
        lines[i]
          .match(/((?:"[^"]*(?:""[^"]*)*"|[^,]*))(?:,|$)/g)
          ?.map((c) => c.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"')) || []
      const name = cols[idx('name')]
      const description = cols[idx('description')] || ''
      if (!name || !description) {
        skipped++
        continue
      }
      const price = Number(cols[idx('price')] || 0)
      const comparePrice = cols[idx('comparePrice')] ? Number(cols[idx('comparePrice')]) : undefined
      const costPrice = cols[idx('costPrice')] ? Number(cols[idx('costPrice')]) : undefined
      const category = cols[idx('categoryId')] || undefined
      const brand = cols[idx('brand')] || undefined
      const stock = Number(cols[idx('stock')] || 0)
      const sku = cols[idx('sku')] || undefined
      const status = (cols[idx('status')] as any) || 'draft'
      const isFeatured = (cols[idx('isFeatured')] || 'false') === 'true'

      const slug = generateSlug(name)
      const exists = await Product.findOne({ seller: sellerId, slug })
      if (exists) {
        skipped++
        continue
      }

      const doc = new Product({
        seller: sellerId,
        name,
        slug,
        description,
        shortDescription: cols[idx('shortDescription')] || undefined,
        price,
        comparePrice,
        costPrice,
        category: category || undefined,
        brand,
        stock,
        sku: sku || `SKU-${Date.now()}-${i}`,
        status,
        isFeatured,
        mainImage: '',
        images: [],
      })
      await doc.save()
      created++
    }

    res.json({ created, skipped })
  } catch (err: unknown) {
    console.error('Error importing CSV:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Bulk inventory operations
export const bulkAdjustStock = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user?.userId
    const { productIds, delta, reason } = req.body as {
      productIds: string[]
      delta: number
      reason?: string
    }

    if (!sellerId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ error: 'Product IDs are required' })
    }

    if (typeof delta !== 'number' || !Number.isFinite(delta)) {
      return res.status(400).json({ error: 'Valid delta is required' })
    }

    const results = []
    for (const productId of productIds) {
      const product = await Product.findOne({
        _id: productId,
        seller: sellerId,
      })
      if (product) {
        const previousStock = product.stock
        const newStock = Math.max(0, previousStock + Math.trunc(delta))
        product.stock = newStock

        if (!(product as any).statusLockedByAdmin) {
          if (newStock === 0 && product.status === 'active') {
            product.status = 'out_of_stock'
          } else if (newStock > 0 && product.status === 'out_of_stock') {
            product.status = 'active'
          }
        }

        await product.save()

        await InventoryLog.create({
          product: product._id,
          seller: product.seller,
          type: 'adjust',
          quantityChange: newStock - previousStock,
          previousStock,
          newStock,
          reason: reason || 'Bulk adjustment',
        })

        results.push({ productId, stock: newStock })
      }
    }

    res.json({
      message: `${results.length} products updated successfully`,
      results,
    })
  } catch (err: unknown) {
    console.error('Error bulk adjusting stock:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

export const getLowStockProducts = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user?.userId
    const { page = 1, limit = 10 } = req.query

    if (!sellerId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const skip = (Number(page) - 1) * Number(limit)
    const defaultThreshold = 5

    // Get all products for the seller (not just active, to catch all low stock scenarios)
    // We'll filter by status later if needed, but include drafts/inactive that might be low stock
    const allProducts = await Product.find({
      seller: sellerId,
      status: { $in: ['active', 'inactive', 'draft', 'out_of_stock'] }, // Include all statuses
    }).populate({
      path: 'category',
      select: 'name slug parent',
      populate: {
        path: 'parent',
        select: 'name slug',
      },
    })

    // Filter and calculate low stock products
    const lowStockProducts = await Promise.all(
      allProducts.map(async (product) => {
        let isLowStock = false
        let lowStockVariantsCount = 0
        let lowStockVariants: any[] = []

        if (product.hasVariants) {
          // For variant products, check variants to see if any are low stock
          const variants = await ProductVariant.find({ product: product._id })

          // Recalculate totalStock and lowStockVariants
          const totalStock = variants.reduce((sum, variant) => sum + (variant.stock || 0), 0)

          // Find variants that are low stock (using their own threshold or default)
          // Only count variants that have stock > 0 AND <= threshold (exclude out of stock variants)
          lowStockVariants = variants.filter((variant) => {
            const stock = variant.stock || 0
            if (stock === 0) return false // Don't count out of stock variants as low stock
            const threshold = variant.lowStockThreshold ?? defaultThreshold
            return stock <= threshold
          })

          lowStockVariantsCount = lowStockVariants.length

          // Update product totals (async, don't wait)
          if (
            product.totalStock !== totalStock ||
            product.lowStockVariants !== lowStockVariantsCount
          ) {
            product.totalStock = totalStock
            product.lowStockVariants = lowStockVariantsCount
            product.save().catch((err) => console.error('Error saving product totals:', err))
          }

          isLowStock = lowStockVariantsCount > 0
        } else {
          // For non-variant products, check if stock <= product's lowStockThreshold or default
          // Only mark as low stock if stock > 0 and <= threshold (exclude out of stock)
          const stock = product.stock || 0
          if (stock === 0) {
            isLowStock = false // Don't mark out of stock products as low stock
          } else {
            const threshold = product.lowStockThreshold ?? defaultThreshold
            isLowStock = stock <= threshold
          }
        }

        return { product, isLowStock, lowStockVariantsCount, lowStockVariants }
      }),
    )

    // Filter to only low stock products and enhance with variant data
    const filteredProducts = lowStockProducts
      .filter((item) => item.isLowStock)
      .map((item) => {
        const productObj = item.product.toObject() as any
        // Include variants if it's a variant product
        if (item.product.hasVariants) {
          productObj.lowStockVariants = item.lowStockVariants
          productObj.lowStockVariantsCount = item.lowStockVariantsCount
        }
        return productObj
      })

    // Sort by priority: variant products with most low stock variants first, then by stock
    filteredProducts.sort((a, b) => {
      const aId = (a._id as mongoose.Types.ObjectId).toString()
      const bId = (b._id as mongoose.Types.ObjectId).toString()

      const aVariants =
        lowStockProducts.find((item) => {
          const itemId = (item.product._id as mongoose.Types.ObjectId).toString()
          return itemId === aId
        })?.lowStockVariantsCount || 0

      const bVariants =
        lowStockProducts.find((item) => {
          const itemId = (item.product._id as mongoose.Types.ObjectId).toString()
          return itemId === bId
        })?.lowStockVariantsCount || 0

      if (a.hasVariants && b.hasVariants) {
        // Both have variants - sort by lowStockVariants count (descending)
        return bVariants - aVariants
      } else if (a.hasVariants) {
        // a has variants, b doesn't - prioritize a
        return -1
      } else if (b.hasVariants) {
        // b has variants, a doesn't - prioritize b
        return 1
      } else {
        // Neither has variants - sort by stock ratio (ascending)
        const thresholdA = a.lowStockThreshold || defaultThreshold
        const thresholdB = b.lowStockThreshold || defaultThreshold
        const ratioA = (a.stock || 0) / thresholdA
        const ratioB = (b.stock || 0) / thresholdB
        return ratioA - ratioB
      }
    })

    const total = filteredProducts.length
    const paginatedProducts = filteredProducts.slice(skip, skip + Number(limit))

    // For variant products, fetch and include all variants in response
    const productsWithVariants = await Promise.all(
      paginatedProducts.map(async (product) => {
        if (product.hasVariants) {
          const variants = await ProductVariant.find({ product: product._id })
          return { ...product, variants }
        }
        return product
      }),
    )

    res.json({
      products: productsWithVariants,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
    })
  } catch (err: unknown) {
    console.error('Error fetching low stock products:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

export const getInventoryAnalytics = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user?.userId
    const { period = '30d' } = req.query

    if (!sellerId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 30
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // Get inventory statistics
    const [
      totalProducts,
      activeProducts,
      outOfStockProducts,
      lowStockProducts,
      totalStockValue,
      inventoryLogs,
    ] = await Promise.all([
      Product.countDocuments({ seller: sellerId }),
      Product.countDocuments({ seller: sellerId, status: 'active' }),
      Product.countDocuments({ seller: sellerId, status: 'out_of_stock' }),
      Product.countDocuments({
        seller: sellerId,
        status: 'active',
        $or: [{ stock: { $lte: 5 } }, { lowStockVariants: { $gt: 0 } }],
      }),
      Product.aggregate([
        { $match: { seller: new mongoose.Types.ObjectId(sellerId) } },
        {
          $group: {
            _id: null,
            total: { $sum: { $multiply: ['$stock', '$price'] } },
          },
        },
      ]),
      InventoryLog.find({
        seller: sellerId,
        createdAt: { $gte: startDate },
      })
        .sort({ createdAt: -1 })
        .limit(100),
    ])

    const stockValue = totalStockValue[0]?.total || 0

    // Get recent stock movements
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
  } catch (err: unknown) {
    console.error('Error fetching inventory analytics:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Seller Custom Attributes
export const getSellerCustomAttributes = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user?.userId
    if (!sellerId) return res.status(401).json({ error: 'Not authenticated' })

    const items = await CustomAttribute.find({ seller: sellerId }).sort({
      sortOrder: 1,
      createdAt: 1,
    })
    res.json(items)
  } catch (e) {
    res.status(500).json({ error: 'Server error' })
  }
}

export const upsertSellerCustomAttribute = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user?.userId
    if (!sellerId) return res.status(401).json({ error: 'Not authenticated' })

    const { key, label, type, required, description, sortOrder, options } = req.body
    if (!key || !label || !type)
      return res.status(400).json({ error: 'key, label and type are required' })

    const doc = await CustomAttribute.findOneAndUpdate(
      { seller: sellerId, key },
      {
        seller: sellerId,
        key,
        label,
        type,
        required: !!required,
        description,
        sortOrder: sortOrder ?? 999,
        options: Array.isArray(options) ? options : undefined,
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    )
    res.json(doc)
  } catch (e) {
    res.status(500).json({ error: 'Server error' })
  }
}

export const deleteSellerCustomAttribute = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user?.userId
    if (!sellerId) return res.status(401).json({ error: 'Not authenticated' })
    const { key } = req.params
    if (!key) return res.status(400).json({ error: 'key is required' })
    await CustomAttribute.findOneAndDelete({ seller: sellerId, key })
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ error: 'Server error' })
  }
}

// Generate unique SKU for product or variant
export const generateSku = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user?.userId
    if (!sellerId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const { productName, baseSku, attributes, productId, maxLength = 8 } = req.body

    // Generate base SKU from product name if provided
    let baseSkuValue = baseSku
    if (!baseSkuValue && productName) {
      baseSkuValue = productName
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
    }

    if (!baseSkuValue) {
      return res.status(400).json({ error: 'Either productName or baseSku is required' })
    }

    // For variants with maxLength constraint, use compact format
    let finalSku = baseSkuValue
    if (attributes && typeof attributes === 'object') {
      if (maxLength && maxLength <= 8) {
        // Compact format for short SKUs: base (4 chars) + attributes (4 chars)
        // Take first 4 chars of base SKU
        const basePart = baseSkuValue
          .substring(0, 4)
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, '')

        // Generate compact attribute suffix (max 4 chars)
        const attrParts = Object.entries(attributes)
          .map(([key, value]) => {
            if (!value || typeof value !== 'string') return ''
            // Use first char of attribute key and first char of value
            const keyChar = key.substring(0, 1).toUpperCase()
            const valueChar = value
              .substring(0, 1)
              .toUpperCase()
              .replace(/[^A-Z0-9]/g, '')
            return `${keyChar}${valueChar}`
          })
          .filter(Boolean)
          .join('')
          .substring(0, 4)

        finalSku = `${basePart}${attrParts}`.substring(0, maxLength)
      } else {
        // Original format for longer SKUs
        const skuSuffix = Object.entries(attributes)
          .map(([key, value]) => {
            if (!value || typeof value !== 'string') return ''
            const attrPrefix = key.substring(0, 3).toUpperCase()
            const valueUpper = value.toUpperCase().replace(/[^A-Z0-9]/g, '')
            return `${attrPrefix}-${valueUpper}`
          })
          .filter(Boolean)
          .join('-')

        if (skuSuffix) {
          finalSku = `${baseSkuValue}-${skuSuffix}`
        }
      }
    }

    // Truncate to maxLength if specified
    if (maxLength && finalSku.length > maxLength) {
      finalSku = finalSku.substring(0, maxLength)
    }

    // Ensure uniqueness per seller
    let uniqueSku = finalSku
    let suffix = 1
    const maxAttempts = 1000

    // Check both Product and ProductVariant collections for uniqueness
    // eslint-disable-next-line no-constant-condition
    while (suffix <= maxAttempts) {
      const [existingProduct, existingVariant] = await Promise.all([
        Product.findOne({
          seller: sellerId,
          sku: uniqueSku,
          ...(productId ? { _id: { $ne: new mongoose.Types.ObjectId(productId) } } : {}),
        }),
        ProductVariant.findOne({
          seller: sellerId,
          sku: uniqueSku,
        }),
      ])

      if (!existingProduct && !existingVariant) {
        break
      }

      // For short SKUs, replace last character(s) with suffix
      if (maxLength && maxLength <= 8) {
        const suffixStr = suffix.toString()
        const baseLength = Math.max(1, maxLength - suffixStr.length)
        uniqueSku = `${finalSku.substring(0, baseLength)}${suffixStr}`.substring(0, maxLength)
      } else {
        uniqueSku = `${finalSku}-${suffix}`
        // Truncate if it exceeds maxLength
        if (maxLength && uniqueSku.length > maxLength) {
          uniqueSku = uniqueSku.substring(0, maxLength)
        }
      }
      suffix++
    }

    if (suffix > maxAttempts) {
      return res.status(500).json({ error: 'Unable to generate unique SKU after maximum attempts' })
    }

    res.json({ sku: uniqueSku })
  } catch (err: unknown) {
    console.error('Error generating SKU:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Seller marks latest notice addressed
export const markLatestObjectionAddressed = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user?.userId
    const { id } = req.params
    if (!sellerId) return res.status(401).json({ error: 'Not authenticated' })
    const product = await Product.findOne({ _id: id, seller: sellerId })
    if (!product) return res.status(404).json({ error: 'Product not found' })
    const list = (product as any).objections as Array<any>
    if (!Array.isArray(list) || list.length === 0)
      return res.status(400).json({ error: 'No notices to address' })
    let idx = -1
    for (let i = list.length - 1; i >= 0; i--) {
      if (!list[i].resolved && !list[i].addressedBySeller) {
        idx = i
        break
      }
    }
    if (idx === -1) return res.status(400).json({ error: 'No open notices to address' })
    list[idx].addressedBySeller = true
    list[idx].addressedAt = new Date()
    ;(product as any).objections = list
    await product.save()
    try {
      io.to('super-admin').emit('notice:addressed', {
        productId: id,
        addressedAt: list[idx].addressedAt,
      })
    } catch {}
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ error: 'Server error' })
  }
}
