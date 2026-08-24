import { Request, Response } from 'express'
import mongoose from 'mongoose'
import Category from '../models/Category'
import Feedback from '../models/Feedback'
import Order from '../models/Order'
import Product, { IProductReview } from '../models/Product'
import ProductVariant from '../models/ProductVariant'
import UserProductViews from '../models/ProductView'
import User from '../models/User'
import type { ShippingCourier } from '../services/shippingProvider.service'
import { shippingProviderService } from '../services/shippingProvider.service'
import {
  isValidAttributeName,
  normalizeAttributeName,
  sanitizeAttributeName,
} from '../utils/attributeNormalizer'
import { deleteMultipleFromR2, uploadToR2 } from '../utils/r2Upload'
import { moderateReviewContent } from '../utils/reviewModeration'

// Helper function to calculate discount percentage if comparePrice exists but discountPercent doesn't
const calculateDiscountPercent = (product: any): number | undefined => {
  // If discountPercent already exists, use it
  if (product.discountPercent !== undefined && product.discountPercent !== null) {
    return product.discountPercent
  }

  // Otherwise, calculate from comparePrice and price if both exist (prefer effectivePrice)
  const effectivePrice = product.effectivePrice ?? product.price
  if (product.comparePrice && effectivePrice && product.comparePrice > effectivePrice) {
    return Math.round(((product.comparePrice - effectivePrice) / product.comparePrice) * 100)
  }

  return undefined
}
// Helper function to enhance product with calculated discount
const enhanceProductWithDiscount = async (product: any) => {
  const productObj = product.toObject ? product.toObject() : product
  const calculatedDiscount = calculateDiscountPercent(productObj)

  if (calculatedDiscount !== undefined) {
    productObj.discountPercent = calculatedDiscount
  }

  // Transform seller: map businessName to storeName for frontend compatibility and add rating
  if (productObj.seller) {
    await transformSeller(productObj.seller)
  }

  return productObj
}

const getInventoryCount = (value: unknown): number => {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

const hasAvailableInventory = (product: Record<string, any>): boolean => {
  if (Array.isArray(product.variants) && product.variants.length > 0) {
    const variantHasStock = product.variants.some(
      (variant: any) => getInventoryCount(variant?.stock) > 0,
    )
    if (variantHasStock) {
      return true
    }
  }

  if (getInventoryCount(product.totalStock) > 0) {
    return true
  }

  return getInventoryCount(product.stock ?? product.quantity) > 0
}

const categoryDescendantsCache = new Map<string, string[]>()

const parseNumericValue = (value?: number | string | null): number | undefined => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }

  return undefined
}

const isShippingCourier = (value: unknown): value is ShippingCourier => {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Record<string, unknown>
  return typeof candidate.courier_id === 'number'
}

const normalizeCourierData = (courier: ShippingCourier): ShippingCourier => {
  const alternateDeliveryDays =
    typeof courier['estimated delivery days'] === 'string'
      ? courier['estimated delivery days']
      : undefined
  const alternateDeliveryDate =
    typeof courier['estimated delivery_date'] === 'string'
      ? courier['estimated delivery_date']
      : undefined

  const normalizedRate =
    parseNumericValue(courier.rate) ??
    parseNumericValue(courier.local_rate_details?.forward?.rate) ??
    0

  const normalizedDeliveryDays =
    courier.estimated_delivery_days ||
    alternateDeliveryDays ||
    courier.estimated_delivery_date ||
    alternateDeliveryDate ||
    '3-5'

  const normalizedDeliveryDate = courier.estimated_delivery_date || alternateDeliveryDate || ''

  const codCharge = parseNumericValue(courier.local_rate_details?.forward?.cod_charges)
  const normalizedCodAvailable =
    courier.cod_available ?? (typeof codCharge === 'number' ? codCharge > 0 : false)

  return {
    ...courier,
    rate: normalizedRate,
    estimated_delivery_days: normalizedDeliveryDays,
    estimated_delivery_date: normalizedDeliveryDate,
    serviceable: courier.serviceable ?? true,
    cod_available: normalizedCodAvailable,
    zone: courier.zone || courier.local_rate_details?.forward?.mode || 'N/A',
  }
}

const extractCourierList = (payload: unknown): ShippingCourier[] => {
  if (!payload) {
    return []
  }

  if (Array.isArray(payload)) {
    return payload.filter((entry) => isShippingCourier(entry))
  }

  if (typeof payload === 'object') {
    const typedPayload = payload as {
      couriers?: unknown
      courier?: unknown
    }

    const couriers: ShippingCourier[] = []

    if (Array.isArray(typedPayload.couriers)) {
      typedPayload.couriers.forEach((entry) => {
        if (isShippingCourier(entry)) {
          couriers.push(entry)
        }
      })
    }

    if (typedPayload.courier && isShippingCourier(typedPayload.courier)) {
      couriers.push(typedPayload.courier)
    }

    if (isShippingCourier(payload)) {
      couriers.push(payload)
    }

    return couriers
  }

  return []
}

const extractMinDeliveryDays = (daysStr?: string): number => {
  if (!daysStr) {
    return 5
  }

  const match = daysStr.match(/^(\d+)/)
  return match ? Number.parseInt(match[1], 10) : 5
}

const getCourierEtaTimestamp = (courier: ShippingCourier): number => {
  const alternateDeliveryDate =
    typeof courier['estimated delivery_date'] === 'string'
      ? courier['estimated delivery_date']
      : undefined
  const alternateDeliveryDays =
    typeof courier['estimated delivery days'] === 'string'
      ? courier['estimated delivery days']
      : undefined

  const deliveryDate = courier.estimated_delivery_date || alternateDeliveryDate

  if (deliveryDate) {
    const etaDate = new Date(deliveryDate)
    if (!Number.isNaN(etaDate.getTime())) {
      return etaDate.getTime()
    }
  }

  const fallbackDays = courier.estimated_delivery_days || alternateDeliveryDays || '5'
  const minDays = extractMinDeliveryDays(fallbackDays)
  const fallbackDate = new Date()
  fallbackDate.setDate(fallbackDate.getDate() + minDays)
  return fallbackDate.getTime()
}

type shippingProviderServiceabilityMeta = {
  couriers?: ShippingCourier[]
  courier?: ShippingCourier
  origin_pincode?: string
  destination_pincode?: string
  payment_type?: string
  weight_grams?: number
}

const getServiceabilityMeta = (payload: unknown): shippingProviderServiceabilityMeta | undefined => {
  if (!payload || Array.isArray(payload) || isShippingCourier(payload)) {
    return undefined
  }

  return payload as shippingProviderServiceabilityMeta
}

const parseQueryToArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .flatMap((entry) =>
        typeof entry === 'string'
          ? entry
              .split(',')
              .map((item) => item.trim())
              .filter(Boolean)
          : [],
      )
      .filter(Boolean)
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  }

  return []
}

const parseNumberQuery = (value: unknown): number | undefined => {
  if (Array.isArray(value)) {
    return parseNumberQuery(value[0])
  }

  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }

  return undefined
}

const computeDiscount = (price?: number, comparePrice?: number): number | undefined => {
  if (
    price === null ||
    price === undefined ||
    comparePrice === null ||
    comparePrice === undefined ||
    comparePrice <= price
  ) {
    return undefined
  }

  const raw = Math.round(((comparePrice - price) / comparePrice) * 100)
  return Number.isFinite(raw) ? raw : undefined
}

const mapReviewForResponse = (
  review: IProductReview | (IProductReview & { toObject?: () => IProductReview }),
  currentUserId?: string,
) => {
  const source =
    typeof (review as any)?.toObject === 'function' ? (review as any).toObject() : review
  const hasLiked =
    currentUserId && Array.isArray(source.likedBy)
      ? source.likedBy.some(
          (id: mongoose.Types.ObjectId) => id.toString() === currentUserId.toString(),
        )
      : false
  const hasDisliked =
    currentUserId && Array.isArray(source.dislikedBy)
      ? source.dislikedBy.some(
          (id: mongoose.Types.ObjectId) => id.toString() === currentUserId.toString(),
        )
      : false

  return {
    _id: source._id,
    rating: source.rating,
    title: source.title,
    comment: source.comment,
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
    likes: source.likes ?? 0,
    dislikes: source.dislikes ?? 0,
    hasLiked,
    hasDisliked,
    isVerifiedPurchase: source.isVerifiedPurchase ?? false,
    images: Array.isArray(source.images) ? source.images : [],
    videos: Array.isArray(source.videos) ? source.videos : [],
    moderationStatus: source.moderationStatus ?? 'pending',
    moderationReason: source.moderationReason,
    reviewer: {
      name: source.reviewer?.name ?? 'Anonymous',
      avatarUrl: source.reviewer?.avatarUrl,
      city: source.reviewer?.city,
      state: source.reviewer?.state,
    },
    isOwner:
      currentUserId && source.user ? source.user.toString() === currentUserId.toString() : false,
  }
}

// Helper function to calculate seller rating from:
// - All approved product reviews across all products
// - Plus explicit feedback ratings linked to those products (delivery/support/product)
const calculateSellerRating = async (
  sellerId: string | mongoose.Types.ObjectId,
): Promise<{ rating: number; reviewCount: number }> => {
  try {
    const sellerObjectId =
      typeof sellerId === 'string' ? new mongoose.Types.ObjectId(sellerId) : sellerId

    // Get all products by this seller (we need both reviews and product IDs)
    const products = await Product.find({ seller: sellerObjectId }).select('_id reviews')

    // Collect all approved product reviews from all products
    const allApprovedReviews: IProductReview[] = []
    products.forEach((product) => {
      if (product.reviews && Array.isArray(product.reviews)) {
        const approvedReviews = product.reviews.filter(
          (review: IProductReview) => (review.moderationStatus ?? 'pending') === 'approved',
        )
        allApprovedReviews.push(...approvedReviews)
      }
    })

    // Collect explicit feedback ratings linked to this seller's products
    const productIds = products.map((p: any) => p._id.toString())

    let feedbackRatings: number[] = []
    if (productIds.length > 0) {
      const feedbackDocs = await Feedback.find({
        'metadata.productId': { $in: productIds },
        rating: { $gte: 1, $lte: 5 },
        // Only include relevant feedback types that reflect seller performance
        type: { $in: ['delivery', 'support', 'product'] },
      }).select('rating')

      feedbackRatings = feedbackDocs.map((f) => f.rating)
    }

    const productReviewRatings = allApprovedReviews.map((r) => r.rating)
    const combinedRatings = [...productReviewRatings, ...feedbackRatings]

    if (combinedRatings.length === 0) {
      return { rating: 0, reviewCount: 0 }
    }

    const totalRating = combinedRatings.reduce((sum, value) => sum + value, 0)
    const averageRating = totalRating / combinedRatings.length

    return {
      // Round to 1 decimal place
      rating: Math.round(averageRating * 10) / 10,
      // Use combined count so seller sees impact of both reviews + explicit feedback
      reviewCount: combinedRatings.length,
    }
  } catch (error) {
    console.error('Error calculating seller rating:', error)
    return { rating: 0, reviewCount: 0 }
  }
}

// Helper function to transform seller object: map businessName to storeName for frontend compatibility
const transformSeller = async (seller: any): Promise<any> => {
  if (!seller) return seller
  if (seller.businessName && !seller.storeName) {
    seller.storeName = seller.businessName
  }

  // Calculate and add seller rating
  if (seller._id) {
    const sellerStats = await calculateSellerRating(seller._id)
    seller.sellerRating = sellerStats.rating
    seller.sellerReviewCount = sellerStats.reviewCount
  }

  return seller
}

type NormalizedAttributeValue = { label: string; hex?: string }

const extractAttributeValues = (raw: string): NormalizedAttributeValue[] => {
  const segments = raw
    .split(/[;,]/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)

  const results: NormalizedAttributeValue[] = []

  segments.forEach((segment) => {
    let workingSegment = segment
    const hexMatch = workingSegment.match(/#[0-9a-fA-F]{3,8}/)
    const hex = hexMatch ? hexMatch[0].toLowerCase() : undefined
    if (hex) {
      workingSegment = workingSegment.replace(/#[0-9a-fA-F]{3,8}/g, ' ')
    }

    const candidates = workingSegment
      .split('|')
      .map((entry) => entry.replace(/[()]/g, '').trim())
      .filter((entry) => entry.length > 0)

    if (candidates.length === 0 && hex) {
      candidates.push(hex)
    }

    if (candidates.length === 0) {
      return
    }

    candidates.forEach((label, index) => {
      results.push({
        label,
        hex: index === 0 ? hex : undefined,
      })
    })
  })

  return results
}

const normalizeAttributeKeyValuePairs = (rawKey: string, rawValue: string) => {
  const keys = rawKey
    .split('|')
    .map((key) => normalizeAttributeName(key))
    .filter((key) => key.length > 0)

  const values = extractAttributeValues(rawValue)

  if (keys.length === 0) {
    keys.push(normalizeAttributeName('Specifications'))
  }

  if (values.length === 0) {
    const trimmed = rawValue.trim()
    if (trimmed) {
      values.push({ label: trimmed })
    }
  }

  return { keys, values }
}

const buildProductAttributeMetadata = (
  product: any,
  variantsByProduct?: Record<string, any[]>,
): Record<string, Array<{ label: string; hex?: string }>> => {
  const attributeMap = new Map<string, Map<string, { label: string; hex?: string }>>()

  const collect = (rawKey: string, rawValue: string) => {
    const { keys, values } = normalizeAttributeKeyValuePairs(rawKey, rawValue)
    keys.forEach((key) => {
      const normalizedKey = normalizeAttributeName(key)
      const sanitizedKey = sanitizeAttributeName(normalizedKey)
      if (!sanitizedKey || sanitizedKey.trim() === '') return
      if (!attributeMap.has(sanitizedKey)) {
        attributeMap.set(sanitizedKey, new Map<string, { label: string; hex?: string }>())
      }
      const store = attributeMap.get(sanitizedKey)!
      values.forEach(({ label, hex }) => {
        const trimmedLabel = label?.trim() || ''
        if (!trimmedLabel) return
        const normalizedLabel = trimmedLabel.toLowerCase()
        const existing = store.get(normalizedLabel)
        if (!existing) {
          store.set(normalizedLabel, {
            label: trimmedLabel,
            hex: hex?.toLowerCase(),
          })
        } else if (!existing.hex && hex) {
          existing.hex = hex.toLowerCase()
        }
      })
    })
  }

  const productId = product?._id ? String(product._id) : undefined
  if (productId && variantsByProduct && variantsByProduct[productId]) {
    variantsByProduct[productId].forEach((variant) => {
      const attrs =
        variant.attributes instanceof Map
          ? Object.fromEntries(variant.attributes)
          : (variant.attributes as Record<string, string>)
      if (attrs && typeof attrs === 'object') {
        Object.entries(attrs).forEach(([rawKey, value]) => {
          if (value === undefined || value === null) return
          collect(rawKey, value.toString())
        })
      }
    })
  }

  if (Array.isArray(product?.specifications)) {
    product.specifications.forEach((spec: any) => {
      if (!spec) return
      collect(spec.key ?? '', spec.value ?? '')
    })
  }

  if (Array.isArray(product?.features)) {
    product.features.forEach((feature: any) => {
      if (typeof feature !== 'string') return
      const featureText = feature.trim()
      if (!featureText) return
      const [rawKey, rawValue] = featureText.includes(':')
        ? featureText.split(':', 2)
        : ['Specifications', featureText]
      collect(rawKey, rawValue)
    })
  }

  if (Array.isArray(product?.filterMetadata)) {
    product.filterMetadata.forEach((entry: any) => {
      if (!entry || typeof entry !== 'object') return
      const key = typeof entry.key === 'string' ? entry.key : ''
      const normalizedKey = normalizeAttributeName(key || 'Specifications')
      const sanitizedKey = sanitizeAttributeName(normalizedKey)

      const valuesSource = entry.values
      const values: string[] = Array.isArray(valuesSource)
        ? valuesSource
            .map((value) =>
              typeof value === 'string'
                ? value.trim()
                : value !== undefined && value !== null
                ? String(value).trim()
                : '',
            )
            .filter((value) => value.length > 0)
        : typeof valuesSource === 'string'
        ? valuesSource
            .split(',')
            .map((value) => value.trim())
            .filter((value) => value.length > 0)
        : []

      values.forEach((value) => {
        if (value && value.trim()) {
          collect(sanitizedKey, value)
        }
      })
    })
  }

  const result: Record<string, Array<{ label: string; hex?: string }>> = {}
  attributeMap.forEach((valueMap, key) => {
    result[key] = Array.from(valueMap.values())
  })
  return result
}

const deriveColorHex = (rawValue: string): string => {
  const trimmed = rawValue.trim()
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(trimmed)) {
    return trimmed.length === 4
      ? `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`
      : trimmed
  }

  const knownColors: Record<string, string> = {
    black: '#000000',
    white: '#ffffff',
    red: '#ff0000',
    blue: '#0000ff',
    green: '#008000',
    yellow: '#ffff00',
    purple: '#800080',
    orange: '#ffa500',
    brown: '#8b4513',
    pink: '#ffc0cb',
    grey: '#808080',
    gray: '#808080',
    cyan: '#00ffff',
    magenta: '#ff00ff',
    beige: '#f5f5dc',
    ivory: '#fffff0',
    teal: '#008080',
  }

  const lower = trimmed.toLowerCase()
  if (knownColors[lower]) {
    return knownColors[lower]
  }

  // Hash-based fallback
  let hash = 0
  for (let i = 0; i < trimmed.length; i += 1) {
    hash = trimmed.charCodeAt(i) + ((hash << 5) - hash)
    hash &= hash
  }

  let color = '#'
  for (let i = 0; i < 3; i += 1) {
    const value = (hash >> (i * 8)) & 0xff
    color += `00${value.toString(16)}`.slice(-2)
  }
  return color
}

const getCategoryWithDescendants = async (
  categoryId: mongoose.Types.ObjectId,
): Promise<string[]> => {
  const idString = categoryId.toString()
  if (categoryDescendantsCache.has(idString)) {
    return categoryDescendantsCache.get(idString)!
  }

  const collectedIds = new Set<string>([idString])
  const queue: mongoose.Types.ObjectId[] = [categoryId]

  while (queue.length > 0) {
    const currentId = queue.shift()!
    const children = await Category.find({
      parent: currentId,
      status: 'active',
    })
      .select('_id')
      .lean()

    children.forEach((child) => {
      const childObjectId = new mongoose.Types.ObjectId(String(child._id))
      const childId = childObjectId.toString()
      if (!collectedIds.has(childId)) {
        collectedIds.add(childId)
        queue.push(childObjectId)
      }
    })
  }

  const idList = Array.from(collectedIds)
  categoryDescendantsCache.set(idString, idList)
  return idList
}

// Public endpoint to list active products for customers
export const publicGetProductFilters = async (req: Request, res: Response) => {
  try {
    const {
      category,
      categoryId,
      search,
      brand,
      tag,
      minPrice,
      maxPrice,
      minDiscount,
      maxDiscount,
      minRating,
      availability,
      event,
    } = req.query

    const match: Record<string, any> = { status: 'active' }

    const approvedSellerIds = await User.find({
      role: 'seller',
      isApproved: true,
    }).distinct('_id')
    if (approvedSellerIds.length === 0) {
      return res.json({
        meta: {
          total: 0,
          price: { min: null, max: null },
          discount: { min: null, max: null },
          rating: { min: null, max: null, average: null },
        },
        categories: [],
        brands: [],
        tags: [],
        attributes: [],
        availability: { inStock: 0, outOfStock: 0 },
        ratingBuckets: [
          { label: '4+', minRating: 4, count: 0 },
          { label: '3+', minRating: 3, count: 0 },
          { label: '2+', minRating: 2, count: 0 },
          { label: '1+', minRating: 1, count: 0 },
        ],
      })
    }

    match.seller = { $in: approvedSellerIds }

    // Only apply search filter if search is not empty
    const searchQuery = typeof search === 'string' ? search.trim() : ''
    if (searchQuery) {
      match.$or = [
        { name: { $regex: searchQuery, $options: 'i' } },
        { description: { $regex: searchQuery, $options: 'i' } },
        { brand: { $regex: searchQuery, $options: 'i' } },
      ]
    }

    // Handle categoryId from query param (priority) or category parameter
    const effectiveCategoryId = (categoryId as string)?.trim() || null
    const categoryFilters = effectiveCategoryId
      ? [effectiveCategoryId]
      : parseQueryToArray(category)
    const brandFilters = parseQueryToArray(brand)
    const tagFilters = parseQueryToArray(tag)
    const availabilityFilters = parseQueryToArray(availability).map((value) => value.toLowerCase())
    const includeOutOfStockFilter = availabilityFilters.some((value) =>
      ['include_out_of_stock', 'out_of_stock'].includes(value),
    )
    const sellerFilters = parseQueryToArray(req.query.seller)

    const minPriceFilter = parseNumberQuery(minPrice)
    const maxPriceFilter = parseNumberQuery(maxPrice)
    const minDiscountFilter = parseNumberQuery(minDiscount)
    const maxDiscountFilter = parseNumberQuery(maxDiscount)
    const minRatingFilter = parseNumberQuery(minRating)

    const categoryFilterSet = new Set<string>()
    if (categoryFilters.length > 0) {
      for (const entry of categoryFilters) {
        let categoryIdObj: mongoose.Types.ObjectId | null = null
        if (mongoose.Types.ObjectId.isValid(entry)) {
          categoryIdObj = new mongoose.Types.ObjectId(entry)
        } else {
          const categoryDoc = await Category.findOne({
            slug: entry.toLowerCase(),
          })
            .select('_id')
            .lean()
          if (categoryDoc?._id) {
            categoryIdObj = new mongoose.Types.ObjectId(String(categoryDoc._id))
          }
        }

        if (categoryIdObj) {
          // Check if it's a parent or child category
          const categoryDoc = await Category.findById(categoryIdObj).select('parent').lean().exec()
          if (categoryDoc) {
            if (categoryDoc.parent) {
              // It's a child category - just use this category
              categoryFilterSet.add(categoryIdObj.toString())
            } else {
              // It's a parent category - include parent + all descendants
              const descendantIds = await getCategoryWithDescendants(categoryIdObj)
              descendantIds.forEach((id) => categoryFilterSet.add(id))
            }
          } else {
            // Category not found, try using descendants anyway
            const descendantIds = await getCategoryWithDescendants(categoryIdObj)
            descendantIds.forEach((id) => categoryFilterSet.add(id))
          }
        }
      }
    }

    // Apply category filter to the match query if categoryId is provided
    if (effectiveCategoryId && mongoose.Types.ObjectId.isValid(effectiveCategoryId)) {
      try {
        const categoryObjectId = new mongoose.Types.ObjectId(effectiveCategoryId)
        const categoryDoc = await Category.findById(effectiveCategoryId)
          .select('parent')
          .lean()
          .exec()
        if (categoryDoc) {
          if (categoryDoc.parent) {
            // It's a child category - just use this category
            match.category = categoryObjectId
          } else {
            // It's a parent category - include parent + all its subcategories
            const subcategoryIds = await Category.find({
              $or: [{ _id: categoryObjectId }, { parent: categoryObjectId }],
            }).distinct('_id')
            if (subcategoryIds.length > 0) {
              match.category = { $in: subcategoryIds }
            } else {
              match.category = categoryObjectId
            }
          }
        } else {
          match.category = categoryObjectId
        }
      } catch (err) {
        console.error('Error processing categoryId filter:', err)
      }
    }

    if (typeof event === 'string') {
      const normalizedEvent = event.trim().toLowerCase()
      if (normalizedEvent === 'deals') {
        const now = new Date()
        match.$and = [
          ...(match.$and || []),
          {
            $or: [
              { discountPercent: { $exists: true, $gt: 0 } },
              { comparePrice: { $exists: true } },
            ],
          },
          {
            $or: [{ discountStart: { $exists: false } }, { discountStart: { $lte: now } }],
          },
          {
            $or: [{ discountEnd: { $exists: false } }, { discountEnd: { $gte: now } }],
          },
        ]
      }
    }

    let sellerFilterIdSet: Set<string> | undefined
    if (sellerFilters.length > 0) {
      const sellerIds = sellerFilters
        .map((value) => {
          if (mongoose.Types.ObjectId.isValid(value)) {
            return new mongoose.Types.ObjectId(value)
          }
          return null
        })
        .filter((value): value is mongoose.Types.ObjectId => value !== null)

      if (sellerIds.length > 0) {
        sellerFilterIdSet = new Set(sellerIds.map((id) => id.toString()))
      }
    }

    const products = await Product.find(match)
      .select(
        'category brand price comparePrice discountPercent rating reviewCount hasVariants totalStock stock tags variantAttributes specifications features filterMetadata seller status',
      )
      .populate({
        path: 'category',
        select: 'name slug parent',
        populate: { path: 'parent', select: 'name slug' },
      })
      .populate({ path: 'seller', select: 'name businessName storeSlug' })
      .lean()

    if (!products.length) {
      return res.json({
        meta: {
          total: 0,
          price: { min: null, max: null },
          discount: { min: null, max: null },
          rating: { min: null, max: null, average: null },
        },
        categories: [],
        brands: [],
        tags: [],
        attributes: [],
        availability: { inStock: 0, outOfStock: 0 },
        ratingBuckets: [
          { label: '4+', minRating: 4, count: 0 },
          { label: '3+', minRating: 3, count: 0 },
          { label: '2+', minRating: 2, count: 0 },
          { label: '1+', minRating: 1, count: 0 },
        ],
      })
    }

    const productIdsWithVariants = products
      .filter((product) => product.hasVariants)
      .map((product) => product._id)

    const variants = productIdsWithVariants.length
      ? await ProductVariant.find({
          product: { $in: productIdsWithVariants },
          status: { $in: ['active', 'out_of_stock'] },
        })
          .select(
            'product price comparePrice costPrice discountPercent effectivePrice attributes status',
          )
          .lean()
      : []

    const variantsByProduct = variants.reduce<Record<string, typeof variants>>((acc, variant) => {
      const key = String(variant.product)
      if (!acc[key]) {
        acc[key] = []
      }
      acc[key].push(variant)
      return acc
    }, {})

    type ComputedProduct = {
      id: string
      category?: {
        id: string
        name: string
        slug?: string
        parent?: { id: string; name: string; slug?: string }
      }
      brand?: string
      seller?: { id: string; name: string }
      tags: string[]
      minPrice?: number
      maxPrice?: number
      minDiscount?: number
      maxDiscount?: number
      rating?: number
      hasStock: boolean
      attributeValues: Record<string, Map<string, { label: string; hex?: string }>>
    }

    const computedProducts: ComputedProduct[] = products.map((product) => {
      const productId = String(product._id)
      const populatedCategory = product.category as any
      const categoryData =
        populatedCategory && typeof populatedCategory === 'object'
          ? {
              id: String(populatedCategory._id),
              name: populatedCategory.name,
              slug: populatedCategory.slug,
              parent:
                populatedCategory.parent && typeof populatedCategory.parent === 'object'
                  ? {
                      id: String(populatedCategory.parent._id),
                      name: populatedCategory.parent.name,
                      slug: populatedCategory.parent.slug,
                    }
                  : undefined,
            }
          : undefined

      const productVariants = variantsByProduct[productId] || []

      const collectVariantNumbers = (key: 'price' | 'comparePrice' | 'discountPercent') =>
        productVariants
          .map((variant) =>
            typeof variant[key] === 'number' ? (variant[key] as number) : undefined,
          )
          .filter((value): value is number => value !== undefined && Number.isFinite(value))

      // Collect effectivePrice first, fallback to price
      const variantPrices = productVariants
        .map((variant) => {
          const effectivePrice = variant.effectivePrice ?? variant.price
          return typeof effectivePrice === 'number' && Number.isFinite(effectivePrice)
            ? effectivePrice
            : undefined
        })
        .filter((value): value is number => value !== undefined)
      const variantComparePrices = collectVariantNumbers('comparePrice')
      const variantDiscounts = collectVariantNumbers('discountPercent')

      const variantDerivedDiscounts: number[] = []
      if (!variantDiscounts.length && variantPrices.length && variantComparePrices.length) {
        productVariants.forEach((variant) => {
          const variantEffectivePrice = variant.effectivePrice ?? variant.price
          const derived = computeDiscount(
            typeof variantEffectivePrice === 'number' ? variantEffectivePrice : undefined,
            typeof variant.comparePrice === 'number' ? variant.comparePrice : undefined,
          )
          if (derived !== undefined) {
            variantDerivedDiscounts.push(derived)
          }
        })
      }

      const productEffectivePrice = product.effectivePrice ?? product.price
      const priceCandidates = [
        typeof productEffectivePrice === 'number' ? productEffectivePrice : undefined,
        ...variantPrices,
      ].filter((value): value is number => value !== undefined && Number.isFinite(value))

      const comparePriceCandidates = [
        typeof product.comparePrice === 'number' ? product.comparePrice : undefined,
        ...variantComparePrices,
      ].filter((value): value is number => value !== undefined && Number.isFinite(value))

      const productDiscountCandidates = [
        typeof product.discountPercent === 'number' ? product.discountPercent : undefined,
        computeDiscount(
          typeof productEffectivePrice === 'number' ? productEffectivePrice : undefined,
          typeof product.comparePrice === 'number' ? product.comparePrice : undefined,
        ),
        ...variantDiscounts,
        ...variantDerivedDiscounts,
      ].filter((value): value is number => value !== undefined && Number.isFinite(value))

      const minPriceValue = priceCandidates.length ? Math.min(...priceCandidates) : undefined
      const maxPriceValue = priceCandidates.length ? Math.max(...priceCandidates) : undefined

      const minDiscountValue = productDiscountCandidates.length
        ? Math.min(...productDiscountCandidates)
        : undefined
      const maxDiscountValue = productDiscountCandidates.length
        ? Math.max(...productDiscountCandidates)
        : undefined

      const normalizedBrand =
        typeof product.brand === 'string' ? product.brand.trim() || undefined : undefined
      const normalizedTags = Array.isArray(product.tags)
        ? product.tags
            .map((tag) => (typeof tag === 'string' ? tag.trim() : ''))
            .filter((tag) => tag.length > 0)
        : []

      const attributeMetadata = buildProductAttributeMetadata(product, variantsByProduct)
      const attributeValues: Record<string, Map<string, { label: string; hex?: string }>> = {}
      Object.entries(attributeMetadata).forEach(([attributeLabel, values]) => {
        attributeValues[attributeLabel] = new Map<string, { label: string; hex?: string }>()
        values.forEach(({ label, hex }) => {
          const normalizedValueKey = label.trim().toLowerCase()
          if (!normalizedValueKey) return
          attributeValues[attributeLabel].set(normalizedValueKey, {
            label: label.trim(),
            hex: hex?.toLowerCase(),
          })
        })
      })

      const sellerDoc = product.seller as any
      const sellerData =
        sellerDoc && typeof sellerDoc === 'object'
          ? {
              id: String(sellerDoc._id || product.seller),
              name: sellerDoc.businessName || sellerDoc.name || 'Seller',
            }
          : undefined

      const hasStock = product.hasVariants
        ? (typeof product.totalStock === 'number' ? product.totalStock : 0) > 0
        : (typeof product.stock === 'number' ? product.stock : 0) > 0

      return {
        id: productId,
        category: categoryData,
        brand: normalizedBrand,
        seller: sellerData,
        tags: normalizedTags,
        minPrice: minPriceValue,
        maxPrice: maxPriceValue,
        minDiscount: minDiscountValue,
        maxDiscount: maxDiscountValue,
        rating:
          typeof product.rating === 'number' && Number.isFinite(product.rating)
            ? product.rating
            : undefined,
        hasStock,
        attributeValues,
      }
    })

    let filteredProducts = computedProducts

    if (brandFilters.length > 0) {
      const normalizedBrands = brandFilters.map((value) => value.toLowerCase())
      filteredProducts = filteredProducts.filter((product) =>
        product.brand ? normalizedBrands.includes(product.brand.toLowerCase()) : false,
      )
    }

    if (categoryFilterSet.size > 0) {
      filteredProducts = filteredProducts.filter((product) =>
        product.category ? categoryFilterSet.has(product.category.id) : false,
      )
    }

    if (sellerFilterIdSet && sellerFilterIdSet.size > 0) {
      filteredProducts = filteredProducts.filter((product) =>
        product.seller ? sellerFilterIdSet!.has(product.seller.id) : false,
      )
    }

    if (tagFilters.length > 0) {
      filteredProducts = filteredProducts.filter((product) =>
        product.tags.some((tagValue) => tagFilters.includes(tagValue)),
      )
    }

    if (!includeOutOfStockFilter) {
      filteredProducts = filteredProducts.filter((product) => product.hasStock)
    }

    if (minPriceFilter !== undefined) {
      filteredProducts = filteredProducts.filter(
        (product) =>
          product.maxPrice !== undefined &&
          Number.isFinite(product.maxPrice) &&
          product.maxPrice >= minPriceFilter,
      )
    }

    if (maxPriceFilter !== undefined) {
      filteredProducts = filteredProducts.filter(
        (product) =>
          product.minPrice !== undefined &&
          Number.isFinite(product.minPrice) &&
          product.minPrice <= maxPriceFilter,
      )
    }

    if (minDiscountFilter !== undefined) {
      filteredProducts = filteredProducts.filter(
        (product) =>
          product.maxDiscount !== undefined &&
          Number.isFinite(product.maxDiscount) &&
          product.maxDiscount >= minDiscountFilter,
      )
    }

    if (maxDiscountFilter !== undefined) {
      filteredProducts = filteredProducts.filter(
        (product) =>
          product.minDiscount !== undefined &&
          Number.isFinite(product.minDiscount) &&
          product.minDiscount <= maxDiscountFilter,
      )
    }

    if (minRatingFilter !== undefined) {
      filteredProducts = filteredProducts.filter(
        (product) =>
          product.rating !== undefined &&
          Number.isFinite(product.rating) &&
          product.rating >= minRatingFilter,
      )
    }

    const totalProducts = filteredProducts.length
    const aggregationProducts = computedProducts

    const priceValues = aggregationProducts
      .flatMap((product) =>
        [product.minPrice, product.maxPrice].filter(
          (value): value is number => value !== undefined && Number.isFinite(value),
        ),
      )
      .filter((value, index, self) => self.indexOf(value) === index)

    const discountValues = aggregationProducts
      .flatMap((product) =>
        [product.minDiscount, product.maxDiscount].filter(
          (value): value is number => value !== undefined && Number.isFinite(value),
        ),
      )
      .filter((value, index, self) => self.indexOf(value) === index)

    const ratingValues = aggregationProducts
      .map((product) => product.rating)
      .filter((value): value is number => value !== undefined && Number.isFinite(value))

    const categoriesMap = new Map<
      string,
      {
        id: string
        name: string
        slug?: string
        parent?: { id: string; name: string; slug?: string }
        count: number
      }
    >()

    const brandsMap = new Map<string, { name: string; count: number }>()
    const sellersMap = new Map<string, { id: string; name: string; count: number }>()
    const tagsMap = new Map<string, { value: string; count: number }>()
    const attributesMap = new Map<
      string,
      {
        label: string
        values: Map<string, { count: number; label: string; hex?: string }>
      }
    >()

    let inStockCount = 0
    let outOfStockCount = 0

    aggregationProducts.forEach((product) => {
      if (product.category) {
        const existing = categoriesMap.get(product.category.id)
        if (existing) {
          existing.count += 1
        } else {
          categoriesMap.set(product.category.id, {
            ...product.category,
            count: 1,
          })
        }
      }

      if (product.brand) {
        const existingBrand = brandsMap.get(product.brand)
        if (existingBrand) {
          existingBrand.count += 1
        } else {
          brandsMap.set(product.brand, { name: product.brand, count: 1 })
        }
      }

      if (product.seller) {
        const existingSeller = sellersMap.get(product.seller.id)
        if (existingSeller) {
          existingSeller.count += 1
        } else {
          sellersMap.set(product.seller.id, {
            id: product.seller.id,
            name: product.seller.name,
            count: 1,
          })
        }
      }

      product.tags.forEach((tagValue) => {
        const existingTag = tagsMap.get(tagValue)
        if (existingTag) {
          existingTag.count += 1
        } else {
          tagsMap.set(tagValue, { value: tagValue, count: 1 })
        }
      })

      Object.entries(product.attributeValues).forEach(([attributeKey, values]) => {
        const attributeLabel = attributeKey.trim()
        if (!attributeLabel) return
        const sanitizedLabel = sanitizeAttributeName(attributeLabel)
        const attributeMapKey = sanitizedLabel.toLowerCase()
        if (!attributesMap.has(attributeMapKey)) {
          attributesMap.set(attributeMapKey, {
            label: sanitizedLabel,
            values: new Map<string, { count: number; label: string; hex?: string }>(),
          })
        }
        const entry = attributesMap.get(attributeMapKey)!
        // Update label if it's empty or use the sanitized version if better
        if (!entry.label || entry.label.trim() === '') {
          entry.label = sanitizedLabel
        }
        values.forEach((valueObj, valueKey) => {
          const normalizedValue = valueKey
          if (!normalizedValue) return
          const existing = entry.values.get(normalizedValue)
          if (!existing) {
            entry.values.set(normalizedValue, {
              count: 1,
              label: valueObj.label,
              hex: valueObj.hex,
            })
          } else {
            existing.count += 1
            if (!existing.hex && valueObj.hex) {
              existing.hex = valueObj.hex
            }
          }
        })
      })

      if (product.hasStock) {
        inStockCount += 1
      } else {
        outOfStockCount += 1
      }
    })

    const categories = Array.from(
      new Map(Array.from(categoriesMap.values()).map((entry) => [entry.id, entry])).values(),
    ).sort((a, b) => b.count - a.count)

    const brandsList = Array.from(
      new Map(
        Array.from(brandsMap.values()).map((entry) => [entry.name.toLowerCase(), entry]),
      ).values(),
    ).sort((a, b) => b.count - a.count)

    const sellersList = Array.from(
      new Map(Array.from(sellersMap.values()).map((entry) => [entry.id, entry])).values(),
    ).sort((a, b) => b.count - a.count)

    const tagsList = Array.from(
      new Map(
        Array.from(tagsMap.values()).map((entry) => [entry.value.toLowerCase(), entry]),
      ).values(),
    ).sort((a, b) => b.count - a.count)

    const attributesList = Array.from(attributesMap.values())
      .map(({ label, values }) => {
        // Sanitize and validate the label
        const sanitizedLabel = sanitizeAttributeName(label)

        // Skip if label is empty, invalid, or defaults to 'Specifications' for a bad name
        if (!sanitizedLabel || sanitizedLabel.trim() === '') {
          return null
        }

        // Skip if the original label was invalid but we defaulted to 'Specifications'
        // Only include 'Specifications' if it was actually the original value
        const originalLabelTrimmed = label?.trim().toLowerCase() || ''
        if (
          sanitizedLabel === 'Specifications' &&
          originalLabelTrimmed !== '' &&
          originalLabelTrimmed !== 'specifications' &&
          !isValidAttributeName(label)
        ) {
          return null // Skip attributes that were invalid and defaulted
        }

        const dedupedValues = Array.from(values.entries())
          .reduce<Array<{ value: string; count: number; hex?: string }>>(
            (acc, [valueKey, meta]) => {
              const valueLabel = meta.label?.trim() || ''
              // Filter out values that look like garbage
              if (valueLabel.length < 1 || valueLabel.length > 200) {
                return acc
              }
              // Filter out values that are mostly numbers or special chars
              const alphanumericChars = valueLabel.replace(/[^a-zA-Z0-9\s]/g, '').length
              const totalChars = valueLabel.replace(/\s/g, '').length
              if (totalChars > 0 && alphanumericChars / totalChars < 0.3) {
                return acc // Too many special characters
              }
              acc.push({
                value: valueLabel,
                count: meta.count,
                hex: meta.hex,
              })
              return acc
            },
            [],
          )
          .sort((a, b) => b.count - a.count)

        // Only include attributes that have at least one valid value
        if (dedupedValues.length === 0) {
          return null
        }

        // Final validation: ensure the attribute name is meaningful
        if (!isValidAttributeName(sanitizedLabel)) {
          return null
        }

        return {
          name: sanitizedLabel,
          values: dedupedValues,
        }
      })
      .filter((attr): attr is NonNullable<typeof attr> => attr !== null)
      // Sort attributes alphabetically for consistent ordering
      .sort((a, b) => a.name.localeCompare(b.name))

    const priceMin = priceValues.length ? Math.min(...priceValues) : null
    const priceMax = priceValues.length ? Math.max(...priceValues) : null
    const discountMin = discountValues.length ? Math.min(...discountValues) : null
    const discountMax = discountValues.length ? Math.max(...discountValues) : null
    const ratingMin = ratingValues.length ? Math.min(...ratingValues) : null
    const ratingMax = ratingValues.length ? Math.max(...ratingValues) : null
    const ratingAverage =
      ratingValues.length && Number.isFinite(ratingValues.reduce((sum, value) => sum + value, 0))
        ? Number(
            (ratingValues.reduce((sum, value) => sum + value, 0) / ratingValues.length).toFixed(2),
          )
        : null

    const ratingBuckets = [
      {
        label: '4+',
        minRating: 4,
        count: aggregationProducts.filter((p) => (p.rating ?? 0) >= 4).length,
      },
      {
        label: '3+',
        minRating: 3,
        count: aggregationProducts.filter((p) => (p.rating ?? 0) >= 3).length,
      },
      {
        label: '2+',
        minRating: 2,
        count: aggregationProducts.filter((p) => (p.rating ?? 0) >= 2).length,
      },
      {
        label: '1+',
        minRating: 1,
        count: aggregationProducts.filter((p) => (p.rating ?? 0) >= 1).length,
      },
    ]

    res.json({
      meta: {
        total: totalProducts,
        price: { min: priceMin, max: priceMax },
        discount: { min: discountMin, max: discountMax },
        rating: { min: ratingMin, max: ratingMax, average: ratingAverage },
      },
      categories,
      brands: brandsList,
      sellers: sellersList,
      tags: tagsList,
      attributes: attributesList,
      availability: { inStock: inStockCount, outOfStock: outOfStockCount },
      ratingBuckets,
    })
  } catch (error) {
    console.error('Error in publicGetProductFilters:', error)
    res.status(500).json({ error: 'Server error' })
  }
}

// Public endpoint to list active products for customers
export const publicListProducts = async (req: Request, res: Response) => {
  try {
    const {
      status = 'active',
      search,
      category,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      order = 'desc',
      isFeatured,
      minPrice,
      maxPrice,
    } = req.query

    const filter: Record<string, any> = { status: 'active' } // Only show active products

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

    // Only show products from approved sellers
    const approvedSellers = await User.find({
      role: 'seller',
      isApproved: true,
    }).distinct('_id')
    filter.seller = { $in: approvedSellers }

    // Boolean filters
    if (isFeatured !== undefined) {
      const isFeaturedValue =
        typeof isFeatured === 'string' ? isFeatured === 'true' : Boolean(isFeatured)
      filter.isFeatured = isFeaturedValue
    }

    // Price range
    if (minPrice || maxPrice) {
      const priceFilter: Record<string, any> = {}
      if (minPrice) priceFilter.$gte = Number(minPrice)
      if (maxPrice) priceFilter.$lte = Number(maxPrice)
      if (Object.keys(priceFilter).length > 0) {
        filter.price = priceFilter
      }
    }

    // Search filter
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

    const [products, total] = await Promise.all([
      Product.find(filter)
        .populate({
          path: 'category',
          select: 'name slug mainImage',
          populate: {
            path: 'parent',
            select: 'name slug',
          },
        })
        .populate('seller', 'name businessName storeSlug')
        .sort(sortOptions)
        .skip(skip)
        .limit(Number(limit)),
      Product.countDocuments(filter),
    ])

    // Convert to ProductDocument type for hydration
    const productDocs = products as unknown as ProductDocument[]

    // Hydrate products with variants
    const hydratedProducts = await hydrateProductsWithVariants(productDocs)

    // Enhance products with calculated discount
    const enhancedProducts = await Promise.all(hydratedProducts.map(enhanceProductWithDiscount))

    res.json({
      products: enhancedProducts,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
    })
  } catch (e) {
    console.error('Error in publicListProducts:', e)
    res.status(500).json({ error: 'Server error' })
  }
}

// Public endpoint to get a single product
export const publicGetProduct = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const identifier = id
    const productFilter: Record<string, any> = { status: { $in: ['active', 'out_of_stock'] } }

    if (mongoose.Types.ObjectId.isValid(identifier)) {
      productFilter._id = identifier
    } else {
      productFilter.slug = identifier.toLowerCase()
    }

    const product = await Product.findOne(productFilter)
      .populate('category', 'name slug')
      .populate('seller', 'name businessName storeDescription storeSlug')

    if (!product) return res.status(404).json({ error: 'Product not found' })

    // Check if seller is approved
    const seller = await User.findById(product.seller)
    if (!seller || !seller.isApproved) {
      return res.status(404).json({ error: 'Product not found' })
    }

    // Recalculate rating and reviewCount based only on approved reviews to ensure consistency
    const reviews = Array.isArray(product.reviews) ? product.reviews : []

    // Auto-approve pending reviews that should have been approved (text passed but was pending due to old logic)
    let needsSave = false
    for (const review of reviews) {
      if (
        (review.moderationStatus ?? 'pending') === 'pending' &&
        !review.moderationReason?.includes('inappropriate')
      ) {
        // This review is pending but wasn't rejected - likely due to old logic that required manual approval for media
        // Auto-approve it now
        review.moderationStatus = 'approved'
        review.moderationReason = undefined
        needsSave = true
      }
    }

    if (needsSave) {
      product.markModified('reviews')
    }

    // Filter approved reviews
    const approvedReviews = reviews.filter((r) => (r.moderationStatus ?? 'pending') === 'approved')
    const totalApprovedReviews = approvedReviews.length

    // Calculate new values
    let newRating = 0
    let newReviewCount = 0

    if (totalApprovedReviews > 0) {
      const aggregateRating = approvedReviews.reduce((acc, entry) => acc + (entry.rating ?? 0), 0)
      newRating = Number((aggregateRating / totalApprovedReviews).toFixed(2))
      newReviewCount = totalApprovedReviews
    }

    // Update if values are different (checking for both null/undefined and value differences)
    const ratingChanged = (product.rating ?? 0) !== newRating
    const reviewCountChanged = (product.reviewCount ?? 0) !== newReviewCount

    if (ratingChanged || reviewCountChanged || needsSave) {
      product.rating = newRating
      product.reviewCount = newReviewCount
      product.markModified('rating')
      product.markModified('reviewCount')
      await product.save()
    }

    const response: any = await enhanceProductWithDiscount(product)

    // Ensure response has the recalculated rating and reviewCount
    response.rating = newRating
    response.reviewCount = newReviewCount

    // Transform businessName to storeName for frontend compatibility
    if (response.seller && response.seller.businessName) {
      response.seller.storeName = response.seller.businessName
    }
    if (product.hasVariants) {
      // Include both 'active' and 'out_of_stock' variants to show all variants
      // Exclude only 'inactive' variants
      response.variants = await ProductVariant.find({
        product: product._id,
        status: { $in: ['active', 'out_of_stock'] },
      })
        .select(
          'name sku price comparePrice costPrice discountPercent effectivePrice attributes stock lowStockThreshold mainImage images videos isDefault warehouseInventory',
        )
        .sort({
          isDefault: -1,
          createdAt: 1,
        })
        .lean()
    }

    const currentUserId = req.user?.userId
    // Show approved reviews to everyone
    // Show pending reviews only to the owner (so they know it's being reviewed)
    // Never show rejected reviews (even to the owner)
    const filteredReviews = reviews.filter((review) => {
      const reviewStatus = review.moderationStatus ?? 'pending'
      const isOwner = currentUserId && review.user && review.user.toString() === currentUserId

      // Never show rejected reviews
      if (reviewStatus === 'rejected') {
        return false
      }

      // Show approved reviews to everyone
      if (reviewStatus === 'approved') {
        return true
      }

      // Show pending reviews only to the owner
      if (reviewStatus === 'pending') {
        return isOwner
      }

      return false
    })
    response.reviews = filteredReviews
      .map((review) => mapReviewForResponse(review as unknown as IProductReview, currentUserId))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 3) // Limit to 3 reviews for product detail page

    res.json(response)
  } catch (e) {
    console.error('Error in publicGetProduct:', e)
    res.status(500).json({ error: 'Server error' })
  }
}

// Get customer highlights based on reviews
export const publicGetCustomerHighlights = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const identifier = id
    const productFilter: Record<string, any> = { status: { $in: ['active', 'out_of_stock'] } }

    if (mongoose.Types.ObjectId.isValid(identifier)) {
      productFilter._id = identifier
    } else {
      productFilter.slug = identifier.toLowerCase()
    }

    const product = await Product.findOne(productFilter).select('reviews')

    if (!product) {
      return res.status(404).json({ error: 'Product not found' })
    }

    const reviews = Array.isArray(product.reviews) ? product.reviews : []
    // Only analyze approved reviews
    const approvedReviews = reviews.filter((r) => (r.moderationStatus ?? 'pending') === 'approved')

    if (approvedReviews.length === 0) {
      return res.json({
        highlights: [],
        reviewCount: 0,
      })
    }

    // Feature keywords mapping
    const featureKeywords: Record<string, { title: string; keyword: string }> = {
      quality: { title: 'Premium Quality', keyword: 'quality' },
      durable: { title: 'Durable & Long-lasting', keyword: 'durable' },
      design: { title: 'Great Design', keyword: 'design' },
      value: { title: 'Great Value', keyword: 'value' },
      fast: { title: 'Fast Delivery', keyword: 'fast' },
      easy: { title: 'Easy to Use', keyword: 'easy' },
      reliable: { title: 'Reliable', keyword: 'reliable' },
      comfortable: { title: 'Comfortable', keyword: 'comfortable' },
      excellent: { title: 'Excellent Product', keyword: 'excellent' },
    }

    // Extract text from all reviews
    const allText = approvedReviews
      .map((review) => `${review.title || ''} ${review.comment}`.toLowerCase())
      .join(' ')

    // Count keyword matches
    const keywordCounts: Record<string, number> = {}
    Object.keys(featureKeywords).forEach((key) => {
      const keyword = featureKeywords[key].keyword
      const regex = new RegExp(`\\b${keyword}\\w*`, 'gi')
      const matches = allText.match(regex)
      keywordCounts[key] = matches ? matches.length : 0
    })

    // Also check for common positive phrases
    const positivePhrases: Record<string, { keyword: string }> = {
      'great quality': { keyword: 'quality' },
      'good quality': { keyword: 'quality' },
      'excellent quality': { keyword: 'quality' },
      'very durable': { keyword: 'durable' },
      'long lasting': { keyword: 'durable' },
      'beautiful design': { keyword: 'design' },
      'nice design': { keyword: 'design' },
      'great value': { keyword: 'value' },
      'good value': { keyword: 'value' },
      'fast shipping': { keyword: 'fast' },
      'quick delivery': { keyword: 'fast' },
      'easy to use': { keyword: 'easy' },
      'very comfortable': { keyword: 'comfortable' },
      'highly recommend': { keyword: 'excellent' },
      'best product': { keyword: 'excellent' },
    }

    Object.keys(positivePhrases).forEach((phrase) => {
      const regex = new RegExp(phrase, 'gi')
      const matches = allText.match(regex)
      if (matches) {
        const keyword = positivePhrases[phrase].keyword
        const key = Object.keys(featureKeywords).find((k) => featureKeywords[k].keyword === keyword)
        if (key) {
          keywordCounts[key] = (keywordCounts[key] || 0) + matches.length
        }
      }
    })

    // Get top features based on mentions (max 6)
    const allUsedDescriptions = new Set<string>()
    const sortedFeatures = Object.entries(keywordCounts)
      .filter(([_, count]) => count > 0)
      .sort(([_, a], [__, b]) => b - a)
      .slice(0, 6) // Ensure max 6
      .map(([key]) => {
        const feature = featureKeywords[key]
        if (!feature) return null

        // Find all reviews that mention this feature
        const relevantReviews = approvedReviews.filter((review) => {
          const text = `${review.title || ''} ${review.comment}`.toLowerCase()
          return text.includes(feature.keyword) || text.includes(feature.title.toLowerCase())
        })

        // Extract the best description from reviews
        let description = feature.title

        // Try to find a good sentence from reviews
        for (const review of relevantReviews) {
          const comment = review.comment.trim()
          if (!comment) continue

          // Split into sentences
          const sentences = comment
            .split(/[.!?]+/)
            .map((s) => s.trim())
            .filter((s) => s.length > 20 && s.length < 120) // Reasonable sentence length

          // Find a sentence that mentions the feature and is unique across all highlights
          for (const sentence of sentences) {
            const lowerSentence = sentence.toLowerCase()
            const isRelevant =
              lowerSentence.includes(feature.keyword) ||
              lowerSentence.includes(feature.title.toLowerCase())
            const isUnique = !allUsedDescriptions.has(lowerSentence)
            const isSubstantial = lowerSentence.length > 30 // Avoid too short generic phrases
            const isNotGeneric = !lowerSentence.match(
              /^(it'?s|this is|very|really|so|too)\s+(great|good|nice|awesome|amazing)/i,
            )

            if (isRelevant && isUnique && isSubstantial && isNotGeneric) {
              description = sentence
              allUsedDescriptions.add(lowerSentence)
              break
            }
          }

          // If we found a good description, stop looking
          if (description !== feature.title && description.length > 30) {
            break
          }
        }

        // If no good sentence found, create a logical description based on the feature
        if (description === feature.title || description.length < 20) {
          const defaultDescriptions: Record<string, string> = {
            'Premium Quality':
              'High-quality materials and excellent craftsmanship that customers notice and appreciate.',
            'Durable & Long-lasting':
              'Built with durable construction designed to withstand daily use over time.',
            'Great Design': 'Thoughtfully designed with both style and functionality in mind.',
            'Great Value':
              'Offers excellent value with quality features at a reasonable price point.',
            'Fast Delivery': 'Reliable and prompt delivery service that customers can count on.',
            'Easy to Use':
              'Intuitive design with straightforward setup and user-friendly interface.',
            Reliable: 'Consistent performance and dependable operation that customers trust.',
            Comfortable: 'Ergonomic design that provides comfort during extended use.',
            'Excellent Product': 'Exceeds expectations with outstanding performance and quality.',
          }
          const defaultDesc =
            defaultDescriptions[feature.title] || `${feature.title} that customers love.`
          const lowerDefault = defaultDesc.toLowerCase()

          // Only use default if it's not already used
          if (!allUsedDescriptions.has(lowerDefault)) {
            description = defaultDesc
            allUsedDescriptions.add(lowerDefault)
          } else {
            // If default is used, create a unique variation
            description = `${feature.title} that customers consistently praise in their reviews.`
            allUsedDescriptions.add(description.toLowerCase())
          }
        }

        return {
          title: feature.title,
          description,
        }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .slice(0, 6) // Final check to ensure max 6

    res.json({
      highlights: sortedFeatures,
      reviewCount: approvedReviews.length,
    })
  } catch (e) {
    console.error('Error in publicGetCustomerHighlights:', e)
    res.status(500).json({ error: 'Server error' })
  }
}

export const publicCreateProductReview = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId
    const userRole = req.user?.role
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    if (userRole && userRole !== 'customer') {
      return res.status(403).json({ error: 'Only customers can submit reviews' })
    }

    const { id } = req.params
    const { rating, title, comment, postAnonymously } = req.body ?? {}

    const parsedRating = Number(rating)
    if (!Number.isFinite(parsedRating) || parsedRating < 1 || parsedRating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' })
    }

    if (!comment || typeof comment !== 'string' || comment.trim().length < 10) {
      return res.status(400).json({ error: 'Comment must be at least 10 characters long' })
    }

    const sanitizedComment = comment.trim().slice(0, 2000)
    const sanitizedTitle =
      typeof title === 'string' && title.trim().length > 0 ? title.trim().slice(0, 140) : undefined

    const identifier = id
    const filter: Record<string, any> = { status: 'active' }

    if (mongoose.Types.ObjectId.isValid(identifier)) {
      filter._id = identifier
    } else {
      filter.slug = identifier.toLowerCase()
    }

    const product = await Product.findOne(filter).select('seller reviews rating reviewCount')

    if (!product) {
      return res.status(404).json({ error: 'Product not found' })
    }

    const seller = await User.findById(product.seller).select('isApproved')
    if (!seller || !seller.isApproved) {
      return res.status(404).json({ error: 'Product not found' })
    }

    const reviewer = await User.findById(userId).select('name city state role')
    if (!reviewer) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Check if user wants to post anonymously
    const shouldPostAnonymously = postAnonymously === 'true' || postAnonymously === true
    const reviewerInfo: { name: string; city?: string; state?: string } = shouldPostAnonymously
      ? {
          name: 'Anonymous',
        }
      : {
          name: reviewer.name,
          city: reviewer.city,
          state: reviewer.state,
        }

    product.reviews = product.reviews ?? []

    const existingReviewIndex = product.reviews.findIndex(
      (entry) => entry.user && entry.user.toString() === userId,
    )

    const filesInput = req.files as
      | { [fieldname: string]: Express.Multer.File[] }
      | Express.Multer.File[]
      | undefined
    const files: { [fieldname: string]: Express.Multer.File[] } = Array.isArray(filesInput)
      ? filesInput.reduce((acc, file) => {
          const key = (file as any).fieldname
          if (!acc[key]) acc[key] = []
          acc[key].push(file)
          return acc
        }, {} as Record<string, Express.Multer.File[]>)
      : filesInput ?? {}

    const parseExistingMedia = (raw: unknown): string[] => {
      if (!raw) return []
      if (Array.isArray(raw)) {
        return raw
          .map((item) => (typeof item === 'string' ? item.trim() : ''))
          .filter((val) => val.length > 0)
      }
      if (typeof raw === 'string') {
        try {
          const parsed = JSON.parse(raw)
          if (Array.isArray(parsed)) {
            return parsed
              .map((item) => (typeof item === 'string' ? item.trim() : ''))
              .filter((val) => val.length > 0)
          }
        } catch {
          // treat as comma-separated list
        }
        return raw
          .split(',')
          .map((entry) => entry.trim())
          .filter((entry) => entry.length > 0)
      }
      return []
    }

    const existingImagesInput = parseExistingMedia(req.body?.existingImages)
    const existingVideosInput = parseExistingMedia(req.body?.existingVideos)

    const imageFiles = files?.images ?? []
    const videoFiles = files?.videos ?? []

    const productObjectId = product._id as mongoose.Types.ObjectId
    const productIdString = productObjectId.toString()

    const uploadImagesPromise = Promise.all(
      imageFiles.map((file) =>
        uploadToR2(
          file.buffer,
          `${productIdString}/reviews/${Date.now()}-${file.originalname}`,
          file.mimetype,
          'review-images',
        ),
      ),
    )

    const uploadVideosPromise = Promise.all(
      videoFiles.map((file) =>
        uploadToR2(
          file.buffer,
          `${productIdString}/reviews/videos/${Date.now()}-${file.originalname}`,
          file.mimetype,
          'review-videos',
        ),
      ),
    )

    const [newImageUrls, newVideoUrls] = await Promise.all([
      uploadImagesPromise,
      uploadVideosPromise,
    ])

    let targetReview: any
    let previousImages: string[] = []
    let previousVideos: string[] = []

    if (existingReviewIndex !== -1) {
      targetReview = product.reviews[existingReviewIndex] as any
      previousImages = Array.isArray(targetReview.images) ? [...targetReview.images] : []
      previousVideos = Array.isArray(targetReview.videos) ? [...targetReview.videos] : []
      targetReview.rating = parsedRating
      targetReview.title = sanitizedTitle
      targetReview.comment = sanitizedComment
      targetReview.reviewer = {
        ...(targetReview.reviewer ?? {}),
        name: reviewerInfo.name,
        city: reviewerInfo.city,
        state: reviewerInfo.state,
      }
      targetReview.updatedAt = new Date()
    } else {
      targetReview = {
        user: new mongoose.Types.ObjectId(userId),
        rating: parsedRating,
        title: sanitizedTitle,
        comment: sanitizedComment,
        reviewer: {
          name: reviewerInfo.name,
          city: reviewerInfo.city,
          state: reviewerInfo.state,
        },
        isVerifiedPurchase: false,
        likes: 0,
        dislikes: 0,
        images: [],
        videos: [],
      }
      product.reviews.unshift(targetReview as IProductReview)
      targetReview = product.reviews[0]
    }

    // Only keep images/videos that are explicitly in existingImagesInput/existingVideosInput
    // plus any newly uploaded ones. This allows users to remove media by not including it.
    const combinedImages = Array.from(new Set([...existingImagesInput, ...newImageUrls])).filter(
      Boolean,
    )
    const combinedVideos = Array.from(new Set([...existingVideosInput, ...newVideoUrls])).filter(
      Boolean,
    )

    targetReview.images = combinedImages
    targetReview.videos = combinedVideos

    const imagesToRemove =
      previousImages.length > 0 ? previousImages.filter((url) => !combinedImages.includes(url)) : []
    const videosToRemove =
      previousVideos.length > 0 ? previousVideos.filter((url) => !combinedVideos.includes(url)) : []

    if (imagesToRemove.length > 0) {
      await deleteMultipleFromR2(imagesToRemove)
    }
    if (videosToRemove.length > 0) {
      await deleteMultipleFromR2(videosToRemove)
    }

    // Run content moderation
    const moderationResult = await moderateReviewContent(
      sanitizedTitle,
      sanitizedComment,
      combinedImages,
      combinedVideos,
    )

    // Set moderation status based on result
    if (moderationResult.approved) {
      // Text passed - auto-approved
      targetReview.moderationStatus = 'approved'
      targetReview.moderationReason = undefined
    } else if (moderationResult.reason?.includes('inappropriate')) {
      // Explicitly rejected due to inappropriate content
      targetReview.moderationStatus = 'rejected'
      targetReview.moderationReason = moderationResult.reason
      targetReview.moderatedAt = new Date()
    } else if (moderationResult.textResult?.approved) {
      // Text passed but was marked pending for other reasons - auto-approve anyway
      targetReview.moderationStatus = 'approved'
      targetReview.moderationReason = undefined
    } else {
      // Needs manual review for other reasons
      targetReview.moderationStatus = 'pending'
      targetReview.moderationReason = moderationResult.reason
    }

    // Calculate rating and review count based only on approved reviews
    const approvedReviews = product.reviews.filter((r) => r.moderationStatus === 'approved')
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

    // Also record a lightweight product-level feedback entry so that
    // we can detect that this user has already reviewed this product
    // (and so seller rating can factor in explicit product feedback).
    try {
      await Feedback.findOneAndUpdate(
        {
          user: userId,
          type: 'product',
          'metadata.productId': productIdString,
        },
        {
          $set: {
            rating: parsedRating,
            comment: sanitizedComment,
            type: 'product',
            source: 'post-order',
            metadata: {
              productId: productIdString,
            },
          },
        },
        { upsert: true },
      )
    } catch (err) {
      // Don't block review flow if feedback sync fails
      console.error('Failed to upsert product feedback from review:', err)
    }

    const responseReview = mapReviewForResponse(targetReview as unknown as IProductReview, userId)

    // Determine response message based on moderation status
    let message = 'Review submitted successfully'
    if (targetReview.moderationStatus === 'pending') {
      message = 'Review submitted and pending moderation. It will be visible after approval.'
    } else if (targetReview.moderationStatus === 'rejected') {
      message = 'Review was rejected due to inappropriate content.'
    }

    res.status(existingReviewIndex !== -1 ? 200 : 201).json({
      review: responseReview,
      rating: product.rating,
      reviewCount: product.reviewCount,
      message,
      moderationStatus: targetReview.moderationStatus,
    })
  } catch (e) {
    console.error('Error in publicCreateProductReview:', e)
    res.status(500).json({ error: 'Server error' })
  }
}

export const publicIncrementProductView = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const identifier = id
    const filter: Record<string, any> = { status: { $in: ['active', 'out_of_stock'] } }

    if (mongoose.Types.ObjectId.isValid(identifier)) {
      filter._id = identifier
    } else {
      filter.slug = identifier.toLowerCase()
    }

    const product = await Product.findOne(filter).select('_id seller viewCount')

    if (!product) {
      return res.status(404).json({ error: 'Product not found' })
    }

    const seller = await User.findById(product.seller).select('isApproved')
    if (!seller || !seller.isApproved) {
      return res.status(404).json({ error: 'Product not found' })
    }

    const forwardedFor = req.headers['x-forwarded-for']
    const ipAddress =
      typeof forwardedFor === 'string'
        ? forwardedFor.split(',')[0].trim()
        : Array.isArray(forwardedFor)
        ? forwardedFor[0]
        : req.ip
    const metadata = {
      userAgent: req.headers['user-agent'],
      ipAddress,
      referer: req.get('referer') || req.get('referrer'),
    }

    const userId = req.user?.userId
    let userViewInfo:
      | {
          viewCount: number
          firstViewedAt: Date
          lastViewedAt: Date
        }
      | undefined

    // Track user's personal view history (for recently viewed products)
    if (userId) {
      const userViews = await UserProductViews.findOne({ user: userId })

      const now = new Date()

      if (userViews) {
        const productIdString = String(product._id)
        const viewEntry = userViews.views.find(
          (entry) => entry.product.toString() === productIdString,
        )
        if (viewEntry) {
          // User has viewed this product before - update their personal view count
          viewEntry.viewCount += 1
          viewEntry.lastViewedAt = now
          viewEntry.metadata = {
            ...viewEntry.metadata,
            ...metadata,
          }
          await userViews.save()
          userViewInfo = {
            viewCount: viewEntry.viewCount,
            firstViewedAt: viewEntry.firstViewedAt,
            lastViewedAt: viewEntry.lastViewedAt,
          }
        } else {
          // First time this user views this product
          userViews.views.push({
            product: product._id,
            viewCount: 1,
            firstViewedAt: now,
            lastViewedAt: now,
            metadata,
          })
          await userViews.save()
          userViewInfo = {
            viewCount: 1,
            firstViewedAt: now,
            lastViewedAt: now,
          }
        }
      } else {
        // First time this user views any product
        const created = await UserProductViews.create({
          user: userId,
          views: [
            {
              product: product._id,
              viewCount: 1,
              firstViewedAt: now,
              lastViewedAt: now,
              metadata,
            },
          ],
        })
        userViewInfo = {
          viewCount: 1,
          firstViewedAt: created.views[0].firstViewedAt,
          lastViewedAt: created.views[0].lastViewedAt,
        }
      }
    }

    // Always increment product view count - every page view counts
    await Product.updateOne({ _id: product._id }, { $inc: { viewCount: 1 } })

    const currentViewCount = (product.viewCount || 0) + 1

    res.json({
      viewCount: currentViewCount,
      userView: userViewInfo,
    })
  } catch (e) {
    console.error('Error in publicIncrementProductView:', e)
    res.status(500).json({ error: 'Server error' })
  }
}

export const publicGetRecentlyViewedProducts = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const page = parseInt(req.query.page as string) || 1
    const requestedLimit = Number(req.query.limit) || 10
    const limit = Math.min(Math.max(requestedLimit, 1), 12)
    const skip = (page - 1) * limit

    const userViews = await UserProductViews.findOne(
      { user: userId },
      { views: { $slice: [skip, limit] } },
    )
      .select('views')
      .populate({
        path: 'views.product',
        // Remove status filter to return all products regardless of status
        populate: [
          { path: 'category', select: 'name slug mainImage' },
          { path: 'seller', select: 'name businessName' },
        ],
      })

    if (!userViews || userViews.views.length === 0) {
      return res.json({ products: [] })
    }

    // Return all products regardless of status, sorted by last viewed date
    const sortedEntries = userViews.views
      .filter((entry) => entry.product) // Only filter out null/undefined products
      .sort((a, b) => new Date(b.lastViewedAt).getTime() - new Date(a.lastViewedAt).getTime())
      .slice(0, limit)

    const productDocs = sortedEntries.map((entry) => entry.product as unknown as ProductDocument)
    const hydratedProducts = await hydrateProductsWithVariants(productDocs)
    const productsWithViewInfo = hydratedProducts.map((product, index) => ({
      ...product,
      viewInfo: {
        viewCount: sortedEntries[index].viewCount,
        firstViewedAt: sortedEntries[index].firstViewedAt,
        lastViewedAt: sortedEntries[index].lastViewedAt,
      },
    }))

    // Return all products regardless of inventory status
    const allProducts = productsWithViewInfo

    // Get total count for pagination metadata
    const totalUserViews = await UserProductViews.findOne({ user: userId }, { views: 1 })
    const totalItems = totalUserViews?.views?.length || 0
    const totalPages = Math.ceil(totalItems / limit)

    res.json({
      products: allProducts,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems,
        itemsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    })
  } catch (e) {
    console.error('Error in publicGetRecentlyViewedProducts:', e)
    res.status(500).json({ error: 'Server error' })
  }
}

export const publicClearViewingHistory = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    await UserProductViews.updateOne({ user: userId }, { $set: { views: [] } })

    res.status(200).json({
      success: true,
      message: 'Viewing history cleared successfully',
    })
  } catch (e) {
    console.error('Error in publicClearViewingHistory:', e)
    res.status(500).json({ error: 'Server error' })
  }
}

export const publicGetRecommendedProducts = async (req: Request, res: Response) => {
  try {
    const limitParam = Number(req.query.limit) || 12
    const limit = Math.min(Math.max(limitParam, 1), 20)

    const approvedSellers = await User.find({
      role: 'seller',
      isApproved: true,
    }).distinct('_id')

    const userId = req.user?.userId
    const recommended: any[] = []
    const excludeIds = new Set<string>()
    let categoryIds: string[] = []

    if (userId) {
      const userViews = await UserProductViews.findOne({ user: userId }).select('views')

      if (userViews && userViews.views.length > 0) {
        const viewedProductIds = userViews.views.map((entry) => entry.product)
        viewedProductIds.forEach((id) => excludeIds.add(String(id)))

        const viewedProducts = await Product.find({
          _id: { $in: viewedProductIds },
          status: 'active',
        })
          .select('category')
          .lean()

        const categorySet = new Set<string>()
        viewedProducts.forEach((product) => {
          if (product?.category) {
            categorySet.add(String(product.category))
          }
        })

        categoryIds = Array.from(categorySet)

        if (categoryIds.length > 0) {
          const similarProducts = await Product.find({
            status: 'active',
            seller: { $in: approvedSellers },
            category: { $in: categoryIds },
            _id: { $nin: Array.from(excludeIds) },
          })
            .populate('category', 'name slug mainImage')
            .populate('seller', 'name businessName storeSlug')
            .sort({ viewCount: -1, createdAt: -1 })
            .limit(limit)

          similarProducts.forEach((product) => {
            recommended.push(product)
            excludeIds.add(String(product._id))
          })
        }
      }
    }

    if (recommended.length < limit) {
      const fallbackProducts = await Product.find({
        status: 'active',
        seller: { $in: approvedSellers },
        _id: { $nin: Array.from(excludeIds) },
      })
        .populate('category', 'name slug mainImage')
        .populate('seller', 'name businessName storeSlug')
        .sort({ viewCount: -1, soldCount: -1 })
        .limit(limit - recommended.length)

      fallbackProducts.forEach((product) => {
        recommended.push(product)
        excludeIds.add(String(product._id))
      })
    }

    // Hydrate products with variants to get variant data
    const hydratedProducts = await hydrateProductsWithVariants(recommended)

    // Set product price from default variant or minimum variant price if product doesn't have a price
    // Prefer effectivePrice (what customer actually pays)
    const enhancedProducts = hydratedProducts.map((product) => {
      // If product already has a valid effectivePrice or price, use it
      const productEffectivePrice = product.effectivePrice ?? product.price
      if (
        typeof productEffectivePrice === 'number' &&
        Number.isFinite(productEffectivePrice) &&
        productEffectivePrice > 0
      ) {
        return product
      }

      // If product has variants, try to get price from default variant or minimum price
      if (product.hasVariants && Array.isArray(product.variants) && product.variants.length > 0) {
        // First, try to find default variant (prefer effectivePrice)
        const defaultVariant = product.variants.find((v: any) => v.isDefault)
        if (defaultVariant) {
          const variantEffectivePrice = defaultVariant.effectivePrice ?? defaultVariant.price
          if (
            variantEffectivePrice !== undefined &&
            typeof variantEffectivePrice === 'number' &&
            Number.isFinite(variantEffectivePrice) &&
            variantEffectivePrice > 0
          ) {
            return {
              ...product,
              price: variantEffectivePrice,
              effectivePrice: variantEffectivePrice,
              comparePrice: defaultVariant.comparePrice ?? product.comparePrice,
            }
          }
        }

        // If no default variant or default has no price, find minimum price from all variants (prefer effectivePrice)
        const variantPrices = product.variants
          .map((v: any) => v.effectivePrice ?? v.price)
          .filter((p: any) => typeof p === 'number' && Number.isFinite(p) && p > 0)

        if (variantPrices.length > 0) {
          const minPrice = Math.min(...variantPrices)
          const variantWithMinPrice = product.variants.find(
            (v: any) => (v.effectivePrice ?? v.price) === minPrice,
          )
          return {
            ...product,
            price: minPrice,
            effectivePrice: minPrice,
            comparePrice: variantWithMinPrice?.comparePrice ?? product.comparePrice,
          }
        }
      }

      return product
    })

    const inStockProducts = enhancedProducts.filter(hasAvailableInventory).slice(0, limit)

    res.json({ products: inStockProducts })
  } catch (e) {
    console.error('Error in publicGetRecommendedProducts:', e)
    res.status(500).json({ error: 'Server error' })
  }
}

// Get recommended products based on shopping trends (viewing history)
export const publicGetRecommendedByShoppingTrends = async (req: Request, res: Response) => {
  try {
    const limitParam = Number(req.query.limit) || 12
    const limit = Math.min(Math.max(limitParam, 1), 20)

    const userId = req.user?.userId
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    const approvedSellers = await User.find({
      role: 'seller',
      isApproved: true,
    }).distinct('_id')

    const recommended: any[] = []
    const excludeIds = new Set<string>()

    // Get user's viewing history
    const userViews = await UserProductViews.findOne({ user: userId }).select('views')

    if (!userViews || userViews.views.length === 0) {
      // No viewing history, return empty or trending products
      return res.json({ products: [] })
    }

    // Get viewed product IDs
    const viewedProductIds = userViews.views.map((entry) => entry.product)
    viewedProductIds.forEach((id) => excludeIds.add(String(id)))

    // Get categories from viewed products (prioritize recent views)
    const viewedProducts = await Product.find({
      _id: { $in: viewedProductIds },
      status: 'active',
    })
      .select('category')
      .lean()

    // Count category frequency (weighted by view count)
    const categoryFrequency = new Map<string, number>()
    userViews.views.forEach((view) => {
      const viewedProduct = viewedProducts.find((p) => String(p._id) === String(view.product))
      if (viewedProduct?.category) {
        const categoryId = String(viewedProduct.category)
        const currentCount = categoryFrequency.get(categoryId) || 0
        categoryFrequency.set(categoryId, currentCount + (view.viewCount || 1))
      }
    })

    // Sort categories by frequency and get top categories
    const sortedCategories = Array.from(categoryFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([categoryId]) => categoryId)

    if (sortedCategories.length > 0) {
      // Get products from top categories
      const similarProducts = await Product.find({
        status: 'active',
        seller: { $in: approvedSellers },
        category: { $in: sortedCategories },
        _id: { $nin: Array.from(excludeIds) },
      })
        .populate('category', 'name slug mainImage')
        .populate('seller', 'name businessName storeSlug')
        .sort({ viewCount: -1, soldCount: -1, createdAt: -1 })
        .limit(limit)

      similarProducts.forEach((product) => {
        recommended.push(product)
        excludeIds.add(String(product._id))
      })
    }

    // If we still need more products, fill with trending products from any category
    if (recommended.length < limit) {
      const fallbackProducts = await Product.find({
        status: 'active',
        seller: { $in: approvedSellers },
        _id: { $nin: Array.from(excludeIds) },
      })
        .populate('category', 'name slug mainImage')
        .populate('seller', 'name businessName storeSlug')
        .sort({ viewCount: -1, soldCount: -1 })
        .limit(limit - recommended.length)

      fallbackProducts.forEach((product) => {
        recommended.push(product)
        excludeIds.add(String(product._id))
      })
    }

    // Hydrate products with variants
    const hydratedProducts = await hydrateProductsWithVariants(recommended)

    // Set product price from default variant or minimum variant price (prefer effectivePrice)
    const enhancedProducts = hydratedProducts.map((product) => {
      const productEffectivePrice = product.effectivePrice ?? product.price
      if (
        typeof productEffectivePrice === 'number' &&
        Number.isFinite(productEffectivePrice) &&
        productEffectivePrice > 0
      ) {
        return product
      }

      if (product.hasVariants && Array.isArray(product.variants) && product.variants.length > 0) {
        const defaultVariant = product.variants.find((v: any) => v.isDefault)
        if (defaultVariant) {
          const variantEffectivePrice = defaultVariant.effectivePrice ?? defaultVariant.price
          if (
            variantEffectivePrice !== undefined &&
            typeof variantEffectivePrice === 'number' &&
            Number.isFinite(variantEffectivePrice) &&
            variantEffectivePrice > 0
          ) {
            return {
              ...product,
              price: variantEffectivePrice,
              effectivePrice: variantEffectivePrice,
              comparePrice: defaultVariant.comparePrice ?? product.comparePrice,
            }
          }
        }

        const variantPrices = product.variants
          .map((v: any) => v.effectivePrice ?? v.price)
          .filter((p: any) => typeof p === 'number' && Number.isFinite(p) && p > 0)

        if (variantPrices.length > 0) {
          const minPrice = Math.min(...variantPrices)
          const variantWithMinPrice = product.variants.find(
            (v: any) => (v.effectivePrice ?? v.price) === minPrice,
          )
          return {
            ...product,
            price: minPrice,
            effectivePrice: minPrice,
            comparePrice: variantWithMinPrice?.comparePrice ?? product.comparePrice,
          }
        }
      }

      return product
    })

    const inStockProducts = enhancedProducts.filter(hasAvailableInventory).slice(0, limit)

    res.json({ products: inStockProducts })
  } catch (e) {
    console.error('Error in publicGetRecommendedByShoppingTrends:', e)
    res.status(500).json({ error: 'Server error' })
  }
}

// Get recommended products based on purchase history
export const publicGetRecommendedByPurchases = async (req: Request, res: Response) => {
  try {
    const limitParam = Number(req.query.limit) || 12
    const limit = Math.min(Math.max(limitParam, 1), 20)

    const userId = req.user?.userId
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    const approvedSellers = await User.find({
      role: 'seller',
      isApproved: true,
    }).distinct('_id')

    const recommended: any[] = []
    const excludeIds = new Set<string>()

    // Get user's order history (delivered orders only for better recommendations)
    const orders = await Order.find({
      user: userId,
      status: { $in: ['delivered'] },
    })
      .select('items')
      .lean()

    if (!orders || orders.length === 0) {
      // No purchase history, return empty
      return res.json({ products: [] })
    }

    // Extract product IDs from orders
    const purchasedProductIds = new Set<string>()
    orders.forEach((order: any) => {
      if (order.items && Array.isArray(order.items)) {
        order.items.forEach((item: any) => {
          if (item.product) {
            purchasedProductIds.add(String(item.product))
            excludeIds.add(String(item.product))
          }
        })
      }
    })

    if (purchasedProductIds.size === 0) {
      return res.json({ products: [] })
    }

    // Get purchased products to find their categories
    const purchasedProducts = await Product.find({
      _id: { $in: Array.from(purchasedProductIds) },
      status: 'active',
    })
      .select('category')
      .lean()

    // Get categories from purchased products
    const categorySet = new Set<string>()
    purchasedProducts.forEach((product) => {
      if (product?.category) {
        categorySet.add(String(product.category))
      }
    })

    const categoryIds = Array.from(categorySet)

    if (categoryIds.length > 0) {
      // Get similar products from same categories (people who bought this also bought...)
      const similarProducts = await Product.find({
        status: 'active',
        seller: { $in: approvedSellers },
        category: { $in: categoryIds },
        _id: { $nin: Array.from(excludeIds) },
      })
        .populate('category', 'name slug mainImage')
        .populate('seller', 'name businessName storeSlug')
        .sort({ soldCount: -1, rating: -1, viewCount: -1 })
        .limit(limit)

      similarProducts.forEach((product) => {
        recommended.push(product)
        excludeIds.add(String(product._id))
      })
    }

    // If we still need more products, fill with trending products
    if (recommended.length < limit) {
      const fallbackProducts = await Product.find({
        status: 'active',
        seller: { $in: approvedSellers },
        _id: { $nin: Array.from(excludeIds) },
      })
        .populate('category', 'name slug mainImage')
        .populate('seller', 'name businessName storeSlug')
        .sort({ soldCount: -1, rating: -1 })
        .limit(limit - recommended.length)

      fallbackProducts.forEach((product) => {
        recommended.push(product)
        excludeIds.add(String(product._id))
      })
    }

    // Hydrate products with variants
    const hydratedProducts = await hydrateProductsWithVariants(recommended)

    // Set product price from default variant or minimum variant price (prefer effectivePrice)
    const enhancedProducts = hydratedProducts.map((product) => {
      const productEffectivePrice = product.effectivePrice ?? product.price
      if (
        typeof productEffectivePrice === 'number' &&
        Number.isFinite(productEffectivePrice) &&
        productEffectivePrice > 0
      ) {
        return product
      }

      if (product.hasVariants && Array.isArray(product.variants) && product.variants.length > 0) {
        const defaultVariant = product.variants.find((v: any) => v.isDefault)
        if (defaultVariant) {
          const variantEffectivePrice = defaultVariant.effectivePrice ?? defaultVariant.price
          if (
            variantEffectivePrice !== undefined &&
            typeof variantEffectivePrice === 'number' &&
            Number.isFinite(variantEffectivePrice) &&
            variantEffectivePrice > 0
          ) {
            return {
              ...product,
              price: variantEffectivePrice,
              effectivePrice: variantEffectivePrice,
              comparePrice: defaultVariant.comparePrice ?? product.comparePrice,
            }
          }
        }

        const variantPrices = product.variants
          .map((v: any) => v.effectivePrice ?? v.price)
          .filter((p: any) => typeof p === 'number' && Number.isFinite(p) && p > 0)

        if (variantPrices.length > 0) {
          const minPrice = Math.min(...variantPrices)
          const variantWithMinPrice = product.variants.find(
            (v: any) => (v.effectivePrice ?? v.price) === minPrice,
          )
          return {
            ...product,
            price: minPrice,
            effectivePrice: minPrice,
            comparePrice: variantWithMinPrice?.comparePrice ?? product.comparePrice,
          }
        }
      }

      return product
    })

    const inStockProducts = enhancedProducts.filter(hasAvailableInventory).slice(0, limit)

    res.json({ products: inStockProducts })
  } catch (e) {
    console.error('Error in publicGetRecommendedByPurchases:', e)
    res.status(500).json({ error: 'Server error' })
  }
}

// Public endpoint to get featured products
export const publicGetFeaturedProducts = async (req: Request, res: Response) => {
  try {
    const requestedLimit = Math.max(1, Number(req.query.limit) || 10)
    const fetchLimit = requestedLimit * 3

    // Only show products from approved sellers
    const approvedSellers = await User.find({
      role: 'seller',
      isApproved: true,
    }).distinct('_id')

    const products = await Product.find({
      status: 'active',
      isFeatured: true,
      seller: { $in: approvedSellers },
    })
      .populate('category', 'name slug')
      .populate('seller', 'name businessName')
      .sort({ createdAt: -1 })
      .limit(fetchLimit)

    const productDocs = products as unknown as ProductDocument[]
    const hydratedProducts = await hydrateProductsWithVariants(productDocs)
    const inStockProducts = hydratedProducts.filter(hasAvailableInventory).slice(0, requestedLimit)

    res.json({ products: inStockProducts })
  } catch (e) {
    console.error('Error in publicGetFeaturedProducts:', e)
    res.status(500).json({ error: 'Server error' })
  }
}

// Public endpoint to get trending products (based on viewCount and soldCount)
export const publicGetTrendingProducts = async (req: Request, res: Response) => {
  try {
    const requestedLimit = Math.max(1, Number(req.query.limit) || 10)
    const fetchLimit = requestedLimit * 3

    // Only show products from approved sellers
    const approvedSellers = await User.find({
      role: 'seller',
      isApproved: true,
    }).distinct('_id')

    const products = await Product.find({
      status: 'active',
      seller: { $in: approvedSellers },
    })
      .populate('category', 'name slug')
      .populate('seller', 'name businessName')
      .sort({ viewCount: -1, soldCount: -1 })
      .limit(fetchLimit)

    const productDocs = products as unknown as ProductDocument[]
    const hydratedProducts = await hydrateProductsWithVariants(productDocs)
    const inStockProducts = hydratedProducts.filter(hasAvailableInventory).slice(0, requestedLimit)

    res.json({ products: inStockProducts })
  } catch (e) {
    console.error('Error in publicGetTrendingProducts:', e)
    res.status(500).json({ error: 'Server error' })
  }
}

// Public endpoint to get products on sale (with discounts)
type DealsScope = 'today' | 'all'

const DEFAULT_DEALS_LIMIT = 20
const MIN_TODAY_DEAL_DISCOUNT = 5

const parseTakeQuery = (value: unknown, fallback = DEFAULT_DEALS_LIMIT): number => {
  if (value === undefined || value === null) return fallback
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.floor(parsed)
}

const parseSkipQuery = (value: unknown, fallback = 0): number => {
  if (value === undefined || value === null) return fallback
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) return fallback
  return Math.floor(parsed)
}

const resolveDealsScope = (params: { scopeParam?: unknown; scopeQuery?: unknown }): DealsScope => {
  const raw =
    typeof params.scopeParam === 'string'
      ? params.scopeParam
      : typeof params.scopeQuery === 'string'
      ? params.scopeQuery
      : ''

  const normalized = raw.trim().toLowerCase()

  if (['all', 'all-deals', 'all_deals', 'alldeals'].includes(normalized)) {
    return 'all'
  }

  return 'today'
}

const buildDealsMatch = (
  approvedSellerIds: Array<mongoose.Types.ObjectId | string>,
  scope: DealsScope,
  now: Date,
) => {
  const baseMatch: Record<string, unknown> = {
    status: 'active',
    seller: { $in: approvedSellerIds },
    $or: [
      { discountPercent: { $exists: true, $gt: 0 } },
      { comparePrice: { $exists: true, $gt: 0 } },
    ],
  }

  if (scope === 'today') {
    baseMatch.$and = [
      {
        $or: [{ discountStart: { $exists: false } }, { discountStart: { $lte: now } }],
      },
      {
        $or: [{ discountEnd: { $exists: false } }, { discountEnd: { $gte: now } }],
      },
    ]
  } else {
    baseMatch.$and = [
      {
        $or: [{ discountEnd: { $exists: false } }, { discountEnd: { $gte: now } }],
      },
    ]
  }

  return baseMatch
}

interface FetchDealsOptions {
  take?: number
  scope?: DealsScope
  now?: Date
  skip?: number
  sort?: 'relevance' | 'price_asc' | 'price_desc' | 'newest'
}

type ProductDocument = mongoose.Document & {
  toObject?: () => Record<string, any>
}

const hydrateProductsWithVariants = async (
  productDocs: ProductDocument[],
): Promise<Array<Record<string, any>>> => {
  if (!productDocs.length) return []

  const productIds = productDocs.map((product) => product._id)

  const variants = await ProductVariant.find({
    product: { $in: productIds },
    status: { $in: ['active', 'out_of_stock'] },
  })
    .select(
      'product attributes status effectivePrice costPrice mainImage images media gallery price sellingPrice comparePrice discountPercent stock isDefault',
    )
    .lean()

  const variantsByProduct = variants.reduce<Record<string, typeof variants>>((acc, variant) => {
    const key = String(variant.product)
    if (!acc[key]) {
      acc[key] = []
    }
    acc[key].push(variant)
    return acc
  }, {})

  const results = await Promise.all(
    productDocs.map(async (productDoc) => {
      const plainProduct = productDoc.toObject ? productDoc.toObject() : (productDoc as any)
      const attributeMetadata = buildProductAttributeMetadata(plainProduct, variantsByProduct)
      const enhanced = await enhanceProductWithDiscount(plainProduct)
      const productPrice =
        typeof enhanced.price === 'number' && Number.isFinite(enhanced.price)
          ? enhanced.price
          : undefined
      const productComparePrice =
        typeof enhanced.comparePrice === 'number' && Number.isFinite(enhanced.comparePrice)
          ? enhanced.comparePrice
          : undefined
      const derivedDiscount = computeDiscount(productPrice, productComparePrice)
      const normalizedDiscount =
        derivedDiscount !== undefined
          ? derivedDiscount
          : typeof enhanced.discountPercent === 'number' &&
            Number.isFinite(enhanced.discountPercent)
          ? Math.max(0, Math.round(enhanced.discountPercent))
          : undefined

      const productVariants = variantsByProduct[String(plainProduct._id)] ?? []
      const normalizedVariants = productVariants.map((variant) => {
        const rawAttributes =
          variant.attributes instanceof Map
            ? Object.fromEntries(variant.attributes)
            : (variant.attributes as Record<string, unknown>)
        const attributes: Record<string, string> = {}
        if (rawAttributes && typeof rawAttributes === 'object') {
          Object.entries(rawAttributes).forEach(([key, value]) => {
            if (value === undefined || value === null) return
            const trimmed = String(value).trim()
            if (trimmed.length === 0) return
            attributes[key] = trimmed
          })
        }

        const price =
          typeof (variant.effectivePrice ?? variant.price) === 'number'
            ? variant.effectivePrice ?? variant.price
            : typeof (variant as any).sellingPrice === 'number'
            ? (variant as any).sellingPrice
            : undefined

        const comparePrice =
          typeof variant.comparePrice === 'number' ? variant.comparePrice : undefined

        const variantDiscountPercent =
          typeof variant.discountPercent === 'number' && Number.isFinite(variant.discountPercent)
            ? variant.discountPercent
            : undefined

        const calculatedDiscount =
          price !== undefined
            ? computeDiscount(price, comparePrice) ??
              (variantDiscountPercent !== undefined
                ? Math.max(0, Math.round(variantDiscountPercent))
                : undefined)
            : variantDiscountPercent !== undefined
            ? Math.max(0, Math.round(variantDiscountPercent))
            : undefined

        const mainImage =
          variant.mainImage ||
          (Array.isArray(variant.images)
            ? variant.images.find((img) => typeof img === 'string' && img.length > 0)
            : undefined)

        const supplementalImages = Array.isArray(variant.images)
          ? variant.images.filter((img): img is string => typeof img === 'string' && img.length > 0)
          : []

        return {
          _id: String(variant._id),
          price,
          comparePrice,
          discountPercent: variantDiscountPercent,
          calculatedDiscount,
          attributes,
          mainImage,
          images: supplementalImages,
          isDefault: Boolean((variant as any).isDefault),
          stock:
            typeof variant.stock === 'number' && Number.isFinite(variant.stock)
              ? variant.stock
              : undefined,
        }
      })

      return {
        ...enhanced,
        calculatedDiscount: normalizedDiscount,
        variants: normalizedVariants,
        attributeMetadata,
      }
    }),
  )

  return results
}

const fetchDealsProducts = async ({
  take = DEFAULT_DEALS_LIMIT,
  scope = 'today',
  now = new Date(),
  skip = 0,
  sort = 'relevance',
}: FetchDealsOptions) => {
  const approvedSellers = (await User.find({
    role: 'seller',
    isApproved: true,
  }).distinct('_id')) as Array<mongoose.Types.ObjectId | string>

  const match = buildDealsMatch(approvedSellers, scope, now)

  const query = Product.find(match)
    .populate('category', 'name slug')
    .populate('seller', 'name storeName')
    .sort({ discountPercent: -1, createdAt: -1 })

  if (skip > 0) {
    query.skip(skip)
  }
  if (take > 0) {
    query.limit(take)
  }

  const productDocs = (await query.exec()) as unknown as ProductDocument[]
  const hydratedProducts = await hydrateProductsWithVariants(productDocs)
  const inventoryFilteredProducts = hydratedProducts.filter(hasAvailableInventory)

  const minDiscount = scope === 'today' ? MIN_TODAY_DEAL_DISCOUNT : 0
  const nowMs = now.getTime()
  const recentThreshold = nowMs - 24 * 60 * 60 * 1000

  const getDiscountValue = (deal: Record<string, any>) => {
    if (typeof deal.calculatedDiscount === 'number' && Number.isFinite(deal.calculatedDiscount)) {
      return deal.calculatedDiscount
    }
    if (typeof deal.discountPercent === 'number' && Number.isFinite(deal.discountPercent)) {
      return deal.discountPercent
    }
    return 0
  }

  const filteredDeals = inventoryFilteredProducts.filter(
    (deal) => getDiscountValue(deal) >= minDiscount,
  )

  const resolveComparablePrice = (deal: Record<string, any>): number => {
    const defaultVariant = Array.isArray(deal.variants)
      ? deal.variants.find((variant: any) => variant?.isDefault)
      : undefined
    if (defaultVariant) {
      const variantEffectivePrice = defaultVariant.effectivePrice ?? defaultVariant.price
      if (typeof variantEffectivePrice === 'number' && Number.isFinite(variantEffectivePrice)) {
        return variantEffectivePrice
      }
    }
    if (typeof deal.minPrice === 'number' && Number.isFinite(deal.minPrice)) {
      return deal.minPrice
    }
    if (Array.isArray(deal.variants)) {
      const variantPrices = deal.variants
        .map((variant: any) => {
          const variantEffectivePrice = variant?.effectivePrice ?? variant?.price
          return typeof variantEffectivePrice === 'number' && Number.isFinite(variantEffectivePrice)
            ? variantEffectivePrice
            : undefined
        })
        .filter((price: number | undefined): price is number => typeof price === 'number')
      if (variantPrices.length > 0) {
        return Math.min(...variantPrices)
      }
    }
    const dealEffectivePrice = deal.effectivePrice ?? deal.price
    if (typeof dealEffectivePrice === 'number' && Number.isFinite(dealEffectivePrice)) {
      return dealEffectivePrice
    }
    return Number.POSITIVE_INFINITY
  }

  const relevanceSorted = [...filteredDeals].sort((a, b) => {
    const endA = a.discountEnd ? new Date(a.discountEnd).getTime() : Number.POSITIVE_INFINITY
    const endB = b.discountEnd ? new Date(b.discountEnd).getTime() : Number.POSITIVE_INFINITY

    if (endA !== endB) {
      return endA - endB
    }

    const startA = a.discountStart ? new Date(a.discountStart).getTime() : undefined
    const startB = b.discountStart ? new Date(b.discountStart).getTime() : undefined
    const startedRecentlyA = typeof startA === 'number' && startA >= recentThreshold
    const startedRecentlyB = typeof startB === 'number' && startB >= recentThreshold

    if (startedRecentlyA !== startedRecentlyB) {
      return startedRecentlyA ? -1 : 1
    }

    const discountA = getDiscountValue(a)
    const discountB = getDiscountValue(b)
    if (discountA !== discountB) {
      return discountB - discountA
    }

    const createdA = a.createdAt ? new Date(a.createdAt).getTime() : 0
    const createdB = b.createdAt ? new Date(b.createdAt).getTime() : 0
    return createdB - createdA
  })

  if (sort === 'price_asc') {
    return [...filteredDeals].sort((a, b) => resolveComparablePrice(a) - resolveComparablePrice(b))
  }

  if (sort === 'price_desc') {
    return [...filteredDeals].sort((a, b) => resolveComparablePrice(b) - resolveComparablePrice(a))
  }

  if (sort === 'newest') {
    return [...filteredDeals].sort(
      (a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime(),
    )
  }

  return relevanceSorted
}

export const publicGetDealsProducts = async (req: Request, res: Response) => {
  try {
    const take = parseTakeQuery(req.query.take ?? req.query.limit)
    const skip = parseSkipQuery(req.query.skip)
    const sortParam = typeof req.query.sort === 'string' ? req.query.sort : undefined
    const sort: FetchDealsOptions['sort'] = [
      'price_asc',
      'price_desc',
      'newest',
      'relevance',
    ].includes(sortParam as any)
      ? (sortParam as FetchDealsOptions['sort'])
      : 'relevance'
    const products = await fetchDealsProducts({
      take,
      skip,
      scope: 'today',
      sort,
    })
    res.json({ products })
  } catch (e) {
    console.error('Error in publicGetDealsProducts:', e)
    res.status(500).json({ error: 'Server error' })
  }
}

export const publicGetDealsByScope = async (req: Request, res: Response) => {
  try {
    const scope = resolveDealsScope({
      scopeParam: req.params.scope,
      scopeQuery: req.query.scope,
    })
    const take = parseTakeQuery(req.query.take ?? req.query.limit)
    const skip = parseSkipQuery(req.query.skip)
    const sortParam = typeof req.query.sort === 'string' ? req.query.sort : undefined
    const sort: FetchDealsOptions['sort'] = [
      'price_asc',
      'price_desc',
      'newest',
      'relevance',
    ].includes(sortParam as any)
      ? (sortParam as FetchDealsOptions['sort'])
      : 'relevance'
    const products = await fetchDealsProducts({ take, skip, scope, sort })
    res.json({ products })
  } catch (e) {
    console.error('Error in publicGetDealsByScope:', e)
    res.status(500).json({ error: 'Server error' })
  }
}

export const publicGetNewArrivalsProducts = async (req: Request, res: Response) => {
  try {
    const requestedLimit = Math.max(1, Number(req.query.limit) || 20)
    const fetchLimit = requestedLimit * 3

    const approvedSellers = await User.find({
      role: 'seller',
      isApproved: true,
    }).distinct('_id')

    const products = await Product.find({
      status: 'active',
      seller: { $in: approvedSellers },
    })
      .populate('category', 'name slug mainImage')
      .populate('seller', 'name businessName')
      .sort({ createdAt: -1 })
      .limit(fetchLimit)

    const productDocs = products as unknown as ProductDocument[]
    const hydratedProducts = await hydrateProductsWithVariants(productDocs)
    const inStockProducts = hydratedProducts.filter(hasAvailableInventory).slice(0, requestedLimit)

    res.json({ products: inStockProducts })
  } catch (e) {
    console.error('Error in publicGetNewArrivalsProducts:', e)
    res.status(500).json({ error: 'Server error' })
  }
}

export const publicGetBestSellersProducts = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1)
    const limit = Math.max(1, Math.min(Number(req.query.limit) || 24, 100))
    const skip = (page - 1) * limit
    const sortParam = typeof req.query.sort === 'string' ? req.query.sort : 'relevance'
    const minRating = Math.max(4, Number(req.query.minRating) || 4) // Default to 4, minimum 4

    // Get approved sellers
    const approvedSellers = await User.find({
      role: 'seller',
      isApproved: true,
    }).distinct('_id')

    if (approvedSellers.length === 0) {
      return res.json({
        products: [],
        pagination: {
          total: 0,
          page,
          limit,
          pages: 0,
          hasMore: false,
        },
      })
    }

    // Build sort options
    let sortOptions: Record<string, 1 | -1> = {}
    switch (sortParam) {
      case 'price_asc':
        sortOptions = { effectivePrice: 1, price: 1 }
        break
      case 'price_desc':
        sortOptions = { effectivePrice: -1, price: -1 }
        break
      case 'newest':
        sortOptions = { createdAt: -1 }
        break
      case 'relevance':
      default:
        // Sort by rating (desc), then reviewCount (desc), then soldCount (desc)
        sortOptions = { rating: -1, reviewCount: -1, soldCount: -1 }
        break
    }

    // Build filter query
    const filter: Record<string, any> = {
      status: 'active',
      seller: { $in: approvedSellers },
      rating: { $gte: minRating }, // Only products with rating >= 4
      reviewCount: { $gt: 0 }, // Must have at least one review
    }

    // Get total count for pagination
    const total = await Product.countDocuments(filter)

    // Fetch products
    const products = await Product.find(filter)
      .populate('category', 'name slug mainImage')
      .populate('seller', 'name businessName storeSlug')
      .sort(sortOptions)
      .skip(skip)
      .limit(limit)

    const productDocs = products as unknown as ProductDocument[]
    const hydratedProducts = await hydrateProductsWithVariants(productDocs)

    // Enhance products with discount calculation
    const enhancedProducts = await Promise.all(hydratedProducts.map(enhanceProductWithDiscount))

    // Filter to only in-stock products
    const inStockProducts = enhancedProducts.filter(hasAvailableInventory)

    const pages = Math.ceil(total / limit)
    const hasMore = page < pages

    res.json({
      products: inStockProducts,
      pagination: {
        total,
        page,
        limit,
        pages,
        hasMore,
      },
    })
  } catch (e) {
    console.error('Error in publicGetBestSellersProducts:', e)
    res.status(500).json({ error: 'Server error' })
  }
}

export const publicGetCategoryHighlights = async (req: Request, res: Response) => {
  try {
    const limitParam = Number(req.query.limit) || 4
    const discountThresholdParam = Number(req.query.discountThreshold)
    const priceThresholdParam = Number(req.query.priceThreshold)

    const limit = Math.min(Math.max(limitParam, 2), 8)
    const discountThreshold = Number.isFinite(discountThresholdParam) ? discountThresholdParam : 40
    const priceThreshold = Number.isFinite(priceThresholdParam) ? priceThresholdParam : 199

    const approvedSellers = await User.find({
      role: 'seller',
      isApproved: true,
    }).distinct('_id')

    const topCategories = await Category.find({ status: 'active', top: true })
      .select('name slug mainImage hoverImage')
      .sort({ updatedAt: -1, createdAt: -1 })
      .lean()

    const highlights: {
      discount?: { category: any; products: any[] }
      budget?: { category: any; products: any[] }
    } = {}

    const usedCategoryIds = new Set<string>()

    const fetchProductsForCategory = async (
      categoryId: mongoose.Types.ObjectId,
      sort: Record<string, 1 | -1>,
      fetchLimit = limit * 4,
    ) => {
      const categoryIds = await getCategoryWithDescendants(categoryId)
      const categoryObjectIds = categoryIds.map((id) => new mongoose.Types.ObjectId(id))

      const products = await Product.find({
        status: 'active',
        seller: { $in: approvedSellers },
        category: { $in: categoryObjectIds },
      })
        .populate('category', 'name slug mainImage')
        .populate('seller', 'name businessName storeSlug')
        .sort(sort)
        .limit(fetchLimit)

      const productDocs = products as unknown as ProductDocument[]
      const hydrated = await hydrateProductsWithVariants(productDocs)
      return hydrated.filter(hasAvailableInventory)
    }

    for (const category of topCategories) {
      const categoryObjectId = new mongoose.Types.ObjectId(String(category._id))
      const enhanced = await fetchProductsForCategory(categoryObjectId, {
        discountPercent: -1 as -1,
        comparePrice: -1 as -1,
        createdAt: -1 as -1,
      })
      const filtered = enhanced.filter(
        (product) => (product.discountPercent ?? 0) >= discountThreshold,
      )

      if (filtered.length > 0) {
        highlights.discount = {
          category: {
            ...category,
            _id: category._id.toString(),
          },
          products: filtered.slice(0, limit),
        }
        usedCategoryIds.add(category._id.toString())
        break
      }
    }

    if (!highlights.discount && topCategories.length > 0) {
      const fallbackCategory = topCategories[0]
      const fallbackCategoryId = new mongoose.Types.ObjectId(String(fallbackCategory._id))
      const enhanced = await fetchProductsForCategory(fallbackCategoryId, {
        discountPercent: -1 as -1,
        createdAt: -1 as -1,
      })
      if (enhanced.length > 0) {
        highlights.discount = {
          category: {
            ...fallbackCategory,
            _id: fallbackCategory._id.toString(),
          },
          products: enhanced.slice(0, limit),
        }
        usedCategoryIds.add(fallbackCategory._id.toString())
      }
    }

    for (const category of topCategories) {
      const categoryIdString = category._id.toString()
      if (usedCategoryIds.has(categoryIdString)) continue

      const categoryObjectId = new mongoose.Types.ObjectId(categoryIdString)
      const enhanced = await fetchProductsForCategory(categoryObjectId, {
        price: 1 as 1,
        createdAt: -1 as -1,
      })
      const filtered = enhanced.filter((product) => (product.price ?? 0) >= priceThreshold)

      if (filtered.length > 0) {
        highlights.budget = {
          category: {
            ...category,
            _id: categoryIdString,
          },
          products: filtered.slice(0, limit),
        }
        usedCategoryIds.add(categoryIdString)
        break
      }
    }

    if (!highlights.budget) {
      const fallbackCategory = topCategories.find(
        (category) => !usedCategoryIds.has(category._id.toString()),
      )

      if (fallbackCategory) {
        const fallbackCategoryId = new mongoose.Types.ObjectId(String(fallbackCategory._id))
        const enhanced = await fetchProductsForCategory(fallbackCategoryId, {
          price: 1 as 1,
          createdAt: -1 as -1,
        })
        const filtered = enhanced.filter((product) => (product.price ?? 0) >= priceThreshold)
        const productsForBudget = filtered.length > 0 ? filtered : enhanced
        if (productsForBudget.length > 0) {
          highlights.budget = {
            category: {
              ...fallbackCategory,
              _id: fallbackCategory._id.toString(),
            },
            products: productsForBudget.slice(0, limit),
          }
          usedCategoryIds.add(fallbackCategory._id.toString())
        }
      }
    }

    res.json({
      discount: highlights.discount ?? null,
      budget: highlights.budget ?? null,
    })
  } catch (e) {
    console.error('Error in publicGetCategoryHighlights:', e)
    res.status(500).json({ error: 'Server error' })
  }
}

export const publicGetAdditionalCategoryHighlights = async (req: Request, res: Response) => {
  try {
    const limitParam = Number(req.query.limit) || 4
    const discountMaxParam = Number(req.query.discountMax)
    const ratingThresholdParam = Number(req.query.ratingThreshold)
    const excludeParam = req.query.exclude

    const limit = Math.min(Math.max(limitParam, 2), 8)
    const discountMax = Number.isFinite(discountMaxParam) ? discountMaxParam : 40
    const ratingThreshold = Number.isFinite(ratingThresholdParam) ? ratingThresholdParam : 4

    const approvedSellers = await User.find({
      role: 'seller',
      isApproved: true,
    }).distinct('_id')

    const topCategories = await Category.find({ status: 'active', top: true })
      .select('name slug mainImage hoverImage')
      .sort({ updatedAt: -1, createdAt: -1 })
      .lean()

    const initialExcluded = new Set<string>()
    if (typeof excludeParam === 'string') {
      excludeParam
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
        .forEach((value) => initialExcluded.add(value))
    }

    const highlights: {
      discount?: { category: any; products: any[] }
      topRated?: { category: any; products: any[] }
    } = {}

    const usedCategoryIds = new Set<string>(initialExcluded)

    const fetchProductsForCategory = async (
      categoryId: mongoose.Types.ObjectId,
      sort: Record<string, 1 | -1>,
      fetchLimit = limit * 4,
    ) => {
      const categoryIds = await getCategoryWithDescendants(categoryId)
      const categoryObjectIds = categoryIds.map((id) => new mongoose.Types.ObjectId(id))

      const products = await Product.find({
        status: 'active',
        seller: { $in: approvedSellers },
        category: { $in: categoryObjectIds },
      })
        .populate('category', 'name slug mainImage')
        .populate('seller', 'name businessName storeSlug')
        .sort(sort)
        .limit(fetchLimit)

      const productDocs = products as unknown as ProductDocument[]
      const hydrated = await hydrateProductsWithVariants(productDocs)
      return hydrated.filter(hasAvailableInventory)
    }

    for (const category of topCategories) {
      const categoryIdString = category._id.toString()
      if (usedCategoryIds.has(categoryIdString)) {
        continue
      }
      const categoryObjectId = new mongoose.Types.ObjectId(categoryIdString)
      const enhanced = await fetchProductsForCategory(categoryObjectId, {
        discountPercent: -1 as -1,
        createdAt: -1 as -1,
      })

      const filtered = enhanced.filter((product) => {
        const discount = product.discountPercent ?? 0
        return discount > 0 && discount <= discountMax
      })

      if (filtered.length > 0) {
        highlights.discount = {
          category: {
            ...category,
            _id: category._id.toString(),
          },
          products: filtered.slice(0, limit),
        }
        usedCategoryIds.add(categoryIdString)
        break
      }
    }

    if (!highlights.discount && topCategories.length > 0) {
      const fallbackCategory = topCategories.find(
        (category) => !usedCategoryIds.has(category._id.toString()),
      )

      if (fallbackCategory) {
        const fallbackCategoryId = new mongoose.Types.ObjectId(String(fallbackCategory._id))
        const enhanced = await fetchProductsForCategory(fallbackCategoryId, {
          discountPercent: -1 as -1,
          createdAt: -1 as -1,
        })

        if (enhanced.length > 0) {
          const filtered = enhanced.filter((product) => {
            const discount = product.discountPercent ?? 0
            return discount > 0 && discount <= discountMax
          })
          const productsForDiscount = filtered.length > 0 ? filtered : enhanced

          highlights.discount = {
            category: {
              ...fallbackCategory,
              _id: fallbackCategory._id.toString(),
            },
            products: productsForDiscount.slice(0, limit),
          }
          usedCategoryIds.add(fallbackCategory._id.toString())
        }
      }
    }

    for (const category of topCategories) {
      const categoryIdString = category._id.toString()
      if (usedCategoryIds.has(categoryIdString)) continue

      const categoryObjectId = new mongoose.Types.ObjectId(categoryIdString)
      const enhanced = await fetchProductsForCategory(categoryObjectId, {
        rating: -1 as -1,
        reviewCount: -1 as -1,
        soldCount: -1 as -1,
      })

      const filtered = enhanced.filter(
        (product) => (product.rating ?? 0) >= ratingThreshold && (product.reviewCount ?? 0) > 0,
      )

      if (filtered.length > 0) {
        highlights.topRated = {
          category: {
            ...category,
            _id: categoryIdString,
          },
          products: filtered.slice(0, limit),
        }
        usedCategoryIds.add(categoryIdString)
        break
      }
    }

    if (!highlights.topRated) {
      const fallbackCategory = topCategories.find(
        (category) => !usedCategoryIds.has(category._id.toString()),
      )

      if (fallbackCategory) {
        const fallbackCategoryId = new mongoose.Types.ObjectId(String(fallbackCategory._id))
        const enhanced = await fetchProductsForCategory(fallbackCategoryId, {
          rating: -1 as -1,
          reviewCount: -1 as -1,
          soldCount: -1 as -1,
        })

        if (enhanced.length > 0) {
          highlights.topRated = {
            category: {
              ...fallbackCategory,
              _id: fallbackCategory._id.toString(),
            },
            products: enhanced.slice(0, limit),
          }
          usedCategoryIds.add(fallbackCategory._id.toString())
        }
      }
    }

    res.json({
      uptoForty: highlights.discount ?? null,
      topRated: highlights.topRated ?? null,
    })
  } catch (e) {
    console.error('Error in publicGetAdditionalCategoryHighlights:', e)
    res.status(500).json({ error: 'Server error' })
  }
}

export const publicLikeReview = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId
    const { id: productId, reviewId } = req.params
    const identifier = productId
    const filter: Record<string, any> = { status: { $in: ['active', 'out_of_stock'] } }

    // Get IP address for anonymous users
    const forwardedFor = req.headers['x-forwarded-for']
    const ipAddress =
      typeof forwardedFor === 'string'
        ? forwardedFor.split(',')[0].trim()
        : Array.isArray(forwardedFor)
        ? forwardedFor[0]
        : req.ip || 'unknown'

    if (mongoose.Types.ObjectId.isValid(identifier)) {
      filter._id = identifier
    } else {
      filter.slug = identifier.toLowerCase()
    }

    const product = await Product.findOne(filter).select('reviews')

    if (!product) {
      return res.status(404).json({ error: 'Product not found' })
    }

    if (!product.reviews || !Array.isArray(product.reviews)) {
      return res.status(404).json({ error: 'Review not found' })
    }

    const reviewIndex = product.reviews.findIndex((r) => r._id?.toString() === reviewId)

    if (reviewIndex === -1) {
      return res.status(404).json({ error: 'Review not found' })
    }

    const review = product.reviews[reviewIndex] as any

    // Initialize arrays if they don't exist
    if (!review.likedBy) {
      review.likedBy = []
    }
    if (!review.dislikedBy) {
      review.dislikedBy = []
    }
    if (!review.anonymousLikedBy) {
      review.anonymousLikedBy = []
    }
    if (!review.anonymousDislikedBy) {
      review.anonymousDislikedBy = []
    }

    if (userId) {
      // Authenticated user
      const userObjectId = new mongoose.Types.ObjectId(userId)
      const hasLiked = review.likedBy.some(
        (id: mongoose.Types.ObjectId) => id.toString() === userId,
      )
      const hasDisliked = review.dislikedBy.some(
        (id: mongoose.Types.ObjectId) => id.toString() === userId,
      )

      if (hasLiked) {
        // User already liked, remove the like
        review.likedBy = review.likedBy.filter(
          (id: mongoose.Types.ObjectId) => id.toString() !== userId,
        )
        review.likes = Math.max(0, (review.likes || 0) - 1)
      } else {
        // Add like
        if (hasDisliked) {
          // Remove from dislikes first
          review.dislikedBy = review.dislikedBy.filter(
            (id: mongoose.Types.ObjectId) => id.toString() !== userId,
          )
          review.dislikes = Math.max(0, (review.dislikes || 0) - 1)
        }
        review.likedBy.push(userObjectId)
        review.likes = (review.likes || 0) + 1
      }

      const finalHasLiked = review.likedBy.some(
        (id: mongoose.Types.ObjectId) => id.toString() === userId,
      )
      const finalHasDisliked = review.dislikedBy.some(
        (id: mongoose.Types.ObjectId) => id.toString() === userId,
      )

      product.markModified('reviews')
      await product.save()

      res.json({
        likes: review.likes || 0,
        dislikes: review.dislikes || 0,
        hasLiked: finalHasLiked,
        hasDisliked: finalHasDisliked,
      })
    } else {
      // Anonymous user - track by IP
      const hasLiked = review.anonymousLikedBy.includes(ipAddress)
      const hasDisliked = review.anonymousDislikedBy.includes(ipAddress)

      if (hasLiked) {
        // Already liked, remove the like
        review.anonymousLikedBy = review.anonymousLikedBy.filter((ip: string) => ip !== ipAddress)
        review.likes = Math.max(0, (review.likes || 0) - 1)
      } else {
        // Add like
        if (hasDisliked) {
          // Remove from dislikes first
          review.anonymousDislikedBy = review.anonymousDislikedBy.filter(
            (ip: string) => ip !== ipAddress,
          )
          review.dislikes = Math.max(0, (review.dislikes || 0) - 1)
        }
        review.anonymousLikedBy.push(ipAddress)
        review.likes = (review.likes || 0) + 1
      }

      const finalHasLiked = review.anonymousLikedBy.includes(ipAddress)
      const finalHasDisliked = review.anonymousDislikedBy.includes(ipAddress)

      product.markModified('reviews')
      await product.save()

      res.json({
        likes: review.likes || 0,
        dislikes: review.dislikes || 0,
        hasLiked: finalHasLiked,
        hasDisliked: finalHasDisliked,
      })
    }
  } catch (e) {
    console.error('Error in publicLikeReview:', e)
    res.status(500).json({ error: 'Server error' })
  }
}

export const publicGetProductReviews = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const identifier = id
    const productFilter: Record<string, any> = { status: { $in: ['active', 'out_of_stock'] } }

    if (mongoose.Types.ObjectId.isValid(identifier)) {
      productFilter._id = identifier
    } else {
      productFilter.slug = identifier.toLowerCase()
    }

    const product = await Product.findOne(productFilter)
      .populate('category', 'name slug')
      .select('reviews rating reviewCount seller name mainImage category slug')

    if (!product) {
      console.error('Product not found for reviews:', {
        identifier,
        productFilter,
      })
      return res.status(404).json({ error: 'Product not found' })
    }

    // Check if seller is approved
    if (!product.seller) {
      console.error('Product has no seller:', product._id)
      return res.status(404).json({ error: 'Product not found' })
    }

    const seller = await User.findById(product.seller).select('isApproved')
    if (!seller || !seller.isApproved) {
      console.error('Seller not approved or not found:', {
        sellerId: product.seller,
        seller,
      })
      return res.status(404).json({ error: 'Product not found' })
    }

    const reviews = Array.isArray(product.reviews) ? product.reviews : []
    const currentUserId = req.user?.userId

    // Filter reviews: show approved to everyone, pending only to owner, never show rejected
    const filteredReviews = reviews.filter((review) => {
      const reviewStatus = review.moderationStatus ?? 'pending'
      const isOwner = currentUserId && review.user && review.user.toString() === currentUserId

      if (reviewStatus === 'rejected') {
        return false
      }

      if (reviewStatus === 'approved') {
        return true
      }

      if (reviewStatus === 'pending') {
        return isOwner
      }

      return false
    })

    const mappedReviews = filteredReviews
      .map((review) => mapReviewForResponse(review as unknown as IProductReview, currentUserId))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    res.json({
      reviews: mappedReviews,
      rating: product.rating ?? 0,
      reviewCount: product.reviewCount ?? 0,
      product: {
        _id: product._id,
        name: product.name,
        mainImage: product.mainImage,
        category: product.category,
        slug: product.slug,
      },
    })
  } catch (e) {
    console.error('Error in publicGetProductReviews:', e)
    res.status(500).json({ error: 'Server error' })
  }
}

export const publicDislikeReview = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId
    const { id: productId, reviewId } = req.params
    const identifier = productId
    const filter: Record<string, any> = { status: { $in: ['active', 'out_of_stock'] } }

    // Get IP address for anonymous users
    const forwardedFor = req.headers['x-forwarded-for']
    const ipAddress =
      typeof forwardedFor === 'string'
        ? forwardedFor.split(',')[0].trim()
        : Array.isArray(forwardedFor)
        ? forwardedFor[0]
        : req.ip || 'unknown'

    if (mongoose.Types.ObjectId.isValid(identifier)) {
      filter._id = identifier
    } else {
      filter.slug = identifier.toLowerCase()
    }

    const product = await Product.findOne(filter).select('reviews')

    if (!product) {
      return res.status(404).json({ error: 'Product not found' })
    }

    if (!product.reviews || !Array.isArray(product.reviews)) {
      return res.status(404).json({ error: 'Review not found' })
    }

    const reviewIndex = product.reviews.findIndex((r) => r._id?.toString() === reviewId)

    if (reviewIndex === -1) {
      return res.status(404).json({ error: 'Review not found' })
    }

    const review = product.reviews[reviewIndex] as any

    // Initialize arrays if they don't exist
    if (!review.likedBy) {
      review.likedBy = []
    }
    if (!review.dislikedBy) {
      review.dislikedBy = []
    }
    if (!review.anonymousLikedBy) {
      review.anonymousLikedBy = []
    }
    if (!review.anonymousDislikedBy) {
      review.anonymousDislikedBy = []
    }

    if (userId) {
      // Authenticated user
      const userObjectId = new mongoose.Types.ObjectId(userId)
      const hasLiked = review.likedBy.some(
        (id: mongoose.Types.ObjectId) => id.toString() === userId,
      )
      const hasDisliked = review.dislikedBy.some(
        (id: mongoose.Types.ObjectId) => id.toString() === userId,
      )

      if (hasDisliked) {
        // User already disliked, remove the dislike
        review.dislikedBy = review.dislikedBy.filter(
          (id: mongoose.Types.ObjectId) => id.toString() !== userId,
        )
        review.dislikes = Math.max(0, (review.dislikes || 0) - 1)
      } else {
        // Add dislike
        if (hasLiked) {
          // Remove from likes first
          review.likedBy = review.likedBy.filter(
            (id: mongoose.Types.ObjectId) => id.toString() !== userId,
          )
          review.likes = Math.max(0, (review.likes || 0) - 1)
        }
        review.dislikedBy.push(userObjectId)
        review.dislikes = (review.dislikes || 0) + 1
      }

      const finalHasLiked = review.likedBy.some(
        (id: mongoose.Types.ObjectId) => id.toString() === userId,
      )
      const finalHasDisliked = review.dislikedBy.some(
        (id: mongoose.Types.ObjectId) => id.toString() === userId,
      )

      product.markModified('reviews')
      await product.save()

      res.json({
        likes: review.likes || 0,
        dislikes: review.dislikes || 0,
        hasLiked: finalHasLiked,
        hasDisliked: finalHasDisliked,
      })
    } else {
      // Anonymous user - track by IP
      const hasLiked = review.anonymousLikedBy.includes(ipAddress)
      const hasDisliked = review.anonymousDislikedBy.includes(ipAddress)

      if (hasDisliked) {
        // Already disliked, remove the dislike
        review.anonymousDislikedBy = review.anonymousDislikedBy.filter(
          (ip: string) => ip !== ipAddress,
        )
        review.dislikes = Math.max(0, (review.dislikes || 0) - 1)
      } else {
        // Add dislike
        if (hasLiked) {
          // Remove from likes first
          review.anonymousLikedBy = review.anonymousLikedBy.filter((ip: string) => ip !== ipAddress)
          review.likes = Math.max(0, (review.likes || 0) - 1)
        }
        review.anonymousDislikedBy.push(ipAddress)
        review.dislikes = (review.dislikes || 0) + 1
      }

      const finalHasLiked = review.anonymousLikedBy.includes(ipAddress)
      const finalHasDisliked = review.anonymousDislikedBy.includes(ipAddress)

      product.markModified('reviews')
      await product.save()

      res.json({
        likes: review.likes || 0,
        dislikes: review.dislikes || 0,
        hasLiked: finalHasLiked,
        hasDisliked: finalHasDisliked,
      })
    }
  } catch (e) {
    console.error('Error in publicDislikeReview:', e)
    res.status(500).json({ error: 'Server error' })
  }
}

/**
 * Get products frequently bought together with a specific product
 * Analyzes order data to find products that were purchased together with the given product
 */
export const publicGetAlsoBoughtProducts = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const limitParam = Number(req.query.limit) || 16
    const limit = Math.min(Math.max(limitParam, 1), 20)

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Valid product ID is required' })
    }

    const productId = new mongoose.Types.ObjectId(id)

    // Get approved sellers only
    const approvedSellers = await User.find({
      role: 'seller',
      isApproved: true,
    }).distinct('_id')

    // Find all orders that contain this product
    // Only include delivered/confirmed orders for better data quality
    const orders = await Order.find({
      'items.product': productId,
      status: {
        $in: ['delivered', 'confirmed', 'processing', 'shipped', 'in_transit', 'out_for_delivery'],
      },
    })
      .select('items')
      .lean()

    if (!orders || orders.length === 0) {
      return res.json({ products: [] })
    }

    // Count frequency of products bought together
    const productFrequency = new Map<string, number>()

    orders.forEach((order: any) => {
      if (order.items && Array.isArray(order.items)) {
        // Get all product IDs from this order (excluding the current product)
        const orderProductIds = new Set<string>()
        order.items.forEach((item: any) => {
          if (item.product) {
            const itemProductId = String(item.product)
            if (itemProductId !== id) {
              orderProductIds.add(itemProductId)
            }
          }
        })

        // Increment frequency for each product in this order
        orderProductIds.forEach((productIdStr) => {
          const currentCount = productFrequency.get(productIdStr) || 0
          productFrequency.set(productIdStr, currentCount + 1)
        })
      }
    })

    if (productFrequency.size === 0) {
      return res.json({ products: [] })
    }

    // Sort by frequency (descending) and get top product IDs
    const sortedProductIds = Array.from(productFrequency.entries())
      .sort((a, b) => b[1] - a[1]) // Sort by frequency descending
      .slice(0, limit * 2) // Get more than needed to filter by availability
      .map(([productIdStr]) => new mongoose.Types.ObjectId(productIdStr))

    // Fetch products that were frequently bought together
    const products = await Product.find({
      _id: { $in: sortedProductIds },
      status: 'active',
      seller: { $in: approvedSellers },
    })
      .populate('category', 'name slug mainImage')
      .populate('seller', 'name businessName storeSlug')
      .lean()

    // Sort products to match the frequency order
    const productMap = new Map(products.map((p) => [String(p._id), p]))
    const sortedProducts = sortedProductIds
      .map((id) => productMap.get(String(id)))
      .filter((p): p is (typeof products)[0] => p !== undefined)
      .slice(0, limit)

    // Convert to ProductDocument type for hydration
    const productDocs = sortedProducts as unknown as ProductDocument[]

    // Hydrate products with variants
    const hydratedProducts = await hydrateProductsWithVariants(productDocs)

    // Enhance products with effective prices and filter by availability
    const enhancedProducts = hydratedProducts.map((product) => {
      const productEffectivePrice = product.effectivePrice ?? product.price
      if (
        typeof productEffectivePrice === 'number' &&
        Number.isFinite(productEffectivePrice) &&
        productEffectivePrice > 0
      ) {
        return product
      }

      if (product.hasVariants && Array.isArray(product.variants) && product.variants.length > 0) {
        const defaultVariant = product.variants.find((v: any) => v.isDefault)
        if (defaultVariant) {
          const variantEffectivePrice = defaultVariant.effectivePrice ?? defaultVariant.price
          if (
            variantEffectivePrice !== undefined &&
            typeof variantEffectivePrice === 'number' &&
            Number.isFinite(variantEffectivePrice) &&
            variantEffectivePrice > 0
          ) {
            return {
              ...product,
              price: variantEffectivePrice,
              effectivePrice: variantEffectivePrice,
              comparePrice: defaultVariant.comparePrice ?? product.comparePrice,
            }
          }
        }

        const variantPrices = product.variants
          .map((v: any) => v.effectivePrice ?? v.price)
          .filter((p: any) => typeof p === 'number' && Number.isFinite(p) && p > 0)

        if (variantPrices.length > 0) {
          const minPrice = Math.min(...variantPrices)
          const variantWithMinPrice = product.variants.find(
            (v: any) => (v.effectivePrice ?? v.price) === minPrice,
          )
          return {
            ...product,
            price: minPrice,
            effectivePrice: minPrice,
            comparePrice: variantWithMinPrice?.comparePrice ?? product.comparePrice,
          }
        }
      }

      return product
    })

    const inStockProducts = enhancedProducts.filter(hasAvailableInventory).slice(0, limit)

    res.json({ products: inStockProducts })
  } catch (e) {
    console.error('Error in publicGetAlsoBoughtProducts:', e)
    res.status(500).json({ error: 'Server error' })
  }
}

/**
 * Check serviceability and get delivery options (fastest and cheapest)
 */
export const publicCheckServiceability = async (req: Request, res: Response) => {
  try {
    const { id: productId } = req.params
    const { destination, orderAmount, paymentType, pickup_id, origin } = req.query

    if (!productId || !destination) {
      return res.status(400).json({
        success: false,
        message: 'Product ID and destination pincode are required',
      })
    }

    // Get product with seller info
    const product = await Product.findById(productId).populate(
      'seller',
      'kourierBoyzLogisticsPickupAddressId pickupAddresses addressLine1 city state postalCode country',
    )

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      })
    }

    const seller = product.seller as any

    // Get product weight and dimensions (use shipping weight/dimensions if available, otherwise regular)
    // Use defaults if not available - API will handle gracefully
    const weight = product.shippingWeight || product.weight || 500 // Default to 500g
    const dimensions = product.shippingDimensions || product.dimensions
    const length = dimensions?.length
    const width = dimensions?.width
    const height = dimensions?.height

    // Get origin (pickup_id or origin pincode)
    // Priority: 1. Query param pickup_id/origin, 2. pickupAddresses (default or first), 3. root kourierBoyzLogisticsPickupAddressId, 4. business address postalCode
    let pickupId: string | undefined = pickup_id as string | undefined
    let originPincode: string | undefined = origin as string | undefined

    // If pickup_id or origin provided in query, use them (skip seller defaults)
    if (!pickupId && !originPincode) {
      // Check pickupAddresses array first
      if (
        seller?.pickupAddresses &&
        Array.isArray(seller.pickupAddresses) &&
        seller.pickupAddresses.length > 0
      ) {
        // Find default pickup address or use first one
        const defaultPickup =
          seller.pickupAddresses.find((addr: any) => addr.isDefault) || seller.pickupAddresses[0]
        if (defaultPickup?.kourierBoyzLogisticsPickupAddressId) {
          pickupId = defaultPickup.kourierBoyzLogisticsPickupAddressId
        }
        // Always carry the configured pickup pincode as a safe provider-independent fallback.
        if (defaultPickup?.postalCode) {
          originPincode = defaultPickup.postalCode
        }
      }

      // Fallback to root-level kourierBoyzLogisticsPickupAddressId
      if (!pickupId && !originPincode && seller?.kourierBoyzLogisticsPickupAddressId) {
        pickupId = seller.kourierBoyzLogisticsPickupAddressId
      }

      // Fallback to business address postalCode
      if (!pickupId && !originPincode && seller?.postalCode) {
        originPincode = seller.postalCode
      }
    }

    if (!pickupId && !originPincode) {
      return res.status(400).json({
        success: false,
        message: 'Seller pickup address not configured',
      })
    }

    // Prepare serviceability request
    const serviceabilityRequest = {
      destination: destination as string,
      pickup_id: pickupId,
      origin: originPincode,
      payment_type: (paymentType as 'cod' | 'prepaid') || 'prepaid',
      order_amount: orderAmount ? Number(orderAmount) : undefined,
      weight: weight,
      length: length,
      breadth: width,
      height: height,
      shipment_type: 'b2c' as const,
      is_reverse: false,
    }

    // Call shipping provider serviceability API
    const serviceabilityResponse = await shippingProviderService.checkServiceability(
      serviceabilityRequest,
    )
    console.log('serviceabilityResponse', serviceabilityResponse)

    if (!serviceabilityResponse.success) {
      return res.status(400).json({
        success: false,
        message:
          serviceabilityResponse.error ||
          serviceabilityResponse.message ||
          'Serviceability check failed',
      })
    }

    const couriersPayload = extractCourierList(serviceabilityResponse.data)
    const couriers = couriersPayload.map(normalizeCourierData).filter((c) => c.serviceable)

    if (couriersPayload.length === 0) {
      return res.status(400).json({
        success: false,
        message:
          serviceabilityResponse.error ||
          serviceabilityResponse.message ||
          'No courier options were returned for this route.',
      })
    }

    if (couriers.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          courier: null,
          couriers: [],
          message:
            'We currently do not deliver to this location. Please try a different pincode or contact our support team for assistance.',
        },
      })
    }

    // Find the courier that is BOTH fastest (by date) AND most economical
    const couriersWithEta = couriers.map((courier) => ({
      courier,
      etaTimestamp: getCourierEtaTimestamp(courier),
    }))

    const minEta = Math.min(...couriersWithEta.map((entry) => entry.etaTimestamp))
    const fastestCouriers = couriersWithEta.filter((entry) => entry.etaTimestamp === minEta)

    const getCourierRate = (courier: ShippingCourier) => courier.rate ?? Number.POSITIVE_INFINITY
    const mostEconomicalEntry = fastestCouriers.reduce((prev, current) => {
      return getCourierRate(current.courier) < getCourierRate(prev.courier) ? current : prev
    })
    const mostEconomical = mostEconomicalEntry.courier

    const serviceabilityMeta = getServiceabilityMeta(serviceabilityResponse.data)

    return res.status(200).json({
      success: true,
      data: {
        courier: mostEconomical,
        origin_pincode: serviceabilityMeta?.origin_pincode,
        destination_pincode: serviceabilityMeta?.destination_pincode,
        payment_type: serviceabilityMeta?.payment_type,
      },
    })
  } catch (error: any) {
    console.error('Error checking serviceability:', error)
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to check serviceability',
    })
  }
}

// Get top seller testimonials (5-star reviews and feedback)
export const getTopSellerTestimonials = async (req: Request, res: Response) => {
  try {
    const { limit = 10 } = req.query
    const limitNum = Math.min(Number(limit) || 10, 50) // Max 50

    // Get all products with approved 5-star reviews
    const products = await Product.find({
      'reviews.rating': 5,
      'reviews.moderationStatus': 'approved',
    })
      .select('_id name seller reviews')
      .populate('seller', 'name businessName storeName profilePhoto')
      .lean()

    // Collect all 5-star approved reviews with seller info
    const testimonials: Array<{
      _id: string
      rating: number
      comment: string
      title?: string
      reviewer: {
        name: string
        avatarUrl?: string
        city?: string
        state?: string
      }
      seller: {
        _id: string
        name: string
        businessName?: string
        storeName?: string
        profilePhoto?: string
      }
      product?: {
        _id: string
        name: string
      }
      createdAt: Date
      type: 'product_review' | 'feedback'
    }> = []

    // Process product reviews
    products.forEach((product: any) => {
      if (product.reviews && Array.isArray(product.reviews) && product.seller) {
        product.reviews.forEach((review: any) => {
          if (
            review.rating === 5 &&
            (review.moderationStatus ?? 'pending') === 'approved' &&
            review.comment
          ) {
            testimonials.push({
              _id: String(review._id),
              rating: review.rating,
              comment: review.comment,
              title: review.title,
              reviewer: {
                name: review.reviewer?.name || 'Anonymous',
                avatarUrl: review.reviewer?.avatarUrl,
                city: review.reviewer?.city,
                state: review.reviewer?.state,
              },
              seller: {
                _id: String(product.seller._id),
                name: product.seller.name || '',
                businessName: product.seller.businessName,
                storeName: product.seller.storeName || product.seller.businessName,
                profilePhoto: product.seller.profilePhoto,
              },
              product: {
                _id: String(product._id),
                name: product.name,
              },
              createdAt: review.createdAt ? new Date(review.createdAt) : new Date(),
              type: 'product_review',
            })
          }
        })
      }
    })

    // Get 5-star feedback linked to sellers' products
    const allProductIds = products.map((p: any) => String(p._id))
    if (allProductIds.length > 0) {
      const feedbackDocs = await Feedback.find({
        'metadata.productId': { $in: allProductIds },
        rating: 5,
        type: { $in: ['delivery', 'support', 'product'] },
        comment: { $exists: true, $ne: '' },
      })
        .populate('user', 'name profilePhoto')
        .sort({ createdAt: -1 })
        .limit(limitNum * 2) // Get more to filter
        .lean()

      // Map feedback to testimonials
      feedbackDocs.forEach((fb: any) => {
        const product = products.find((p: any) => String(p._id) === fb.metadata?.productId)
        if (product && product.seller) {
          const seller = product.seller as any
          testimonials.push({
            _id: String(fb._id),
            rating: fb.rating,
            comment: fb.comment || '',
            reviewer: {
              name: fb.user?.name || 'Anonymous',
              avatarUrl: fb.user?.profilePhoto,
            },
            seller: {
              _id: String(seller._id || seller),
              name: seller.name || '',
              businessName: seller.businessName,
              storeName: seller.storeName || seller.businessName,
              profilePhoto: seller.profilePhoto,
            },
            product: {
              _id: String(product._id),
              name: product.name,
            },
            createdAt: fb.createdAt ? new Date(fb.createdAt) : new Date(),
            type: 'feedback',
          })
        }
      })
    }

    // Sort by date (newest first) and take top ones
    testimonials.sort((a, b) => {
      const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt)
      const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt)
      return dateB.getTime() - dateA.getTime()
    })
    const topTestimonials = testimonials.slice(0, limitNum)

    res.json({
      testimonials: topTestimonials,
      total: testimonials.length,
    })
  } catch (error: any) {
    console.error('Error fetching top seller testimonials:', error)
    res.status(500).json({
      error: 'Failed to fetch testimonials',
      message: error.message,
    })
  }
}
