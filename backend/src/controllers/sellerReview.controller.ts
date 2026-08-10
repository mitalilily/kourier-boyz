import { Request, Response } from 'express'
import mongoose from 'mongoose'
import Feedback from '../models/Feedback'
import Product from '../models/Product'

// Get seller review stats
export const getSellerReviewStats = async (req: Request, res: Response) => {
  try {
    const sellerId = new mongoose.Types.ObjectId(req.user?.userId)

    if (!sellerId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    // Get all products for this seller
    const products = await Product.find({ seller: sellerId })
      .select('_id name mainImage slug rating reviewCount reviews')
      .lean()

    // Aggregate all approved product reviews
    const allReviews: Array<{
      rating: number
      product: { _id: mongoose.Types.ObjectId; name: string; mainImage?: string; slug: string }
    }> = []

    products.forEach((product: any) => {
      if (product.reviews && Array.isArray(product.reviews)) {
        product.reviews.forEach((review: any) => {
          if (review.moderationStatus === 'approved') {
            allReviews.push({
              rating: review.rating,
              product: {
                _id: product._id as mongoose.Types.ObjectId,
                name: product.name,
                mainImage: product.mainImage,
                slug: product.slug,
              },
            })
          }
        })
      }
    })

    // Start with ratings coming from product reviews
    const productReviewRatings = allReviews.map((r) => r.rating)

    // Also aggregate explicit feedback (delivery / support / product) for this seller,
    // using productId linkage in Feedback.metadata.productId
    const productIds = products.map((p) => String(p._id))
    let explicitFeedbackCount = 0
    let feedbackRatings: number[] = []
    if (productIds.length > 0) {
      const feedbackDocs = await Feedback.find({
        'metadata.productId': { $in: productIds },
        rating: { $gte: 1, $lte: 5 },
        type: { $in: ['delivery', 'support', 'product'] },
      })
        .select('rating')
        .lean()

      explicitFeedbackCount = feedbackDocs.length
      feedbackRatings = feedbackDocs.map((f: any) => f.rating)
    }

    // Combine product review ratings + explicit feedback ratings
    const combinedRatings = [...productReviewRatings, ...feedbackRatings]

    // Calculate stats from combined ratings
    const totalReviews = combinedRatings.length
    const totalRating = combinedRatings.reduce((sum, rating) => sum + rating, 0)
    const averageRating = totalReviews > 0 ? totalRating / totalReviews : 0

    // Rating distribution (also based on combined ratings)
    const ratingDistribution = {
      5: combinedRatings.filter((r) => r === 5).length,
      4: combinedRatings.filter((r) => r === 4).length,
      3: combinedRatings.filter((r) => r === 3).length,
      2: combinedRatings.filter((r) => r === 2).length,
      1: combinedRatings.filter((r) => r === 1).length,
    }

    // Get top rated products
    const topRatedProducts = products
      .filter((p: any) => p.rating && p.reviewCount && p.reviewCount > 0)
      .map((p: any) => ({
        _id: (p._id as mongoose.Types.ObjectId).toString(),
        name: p.name,
        rating: p.rating || 0,
        reviewCount: p.reviewCount || 0,
        mainImage: p.mainImage,
      }))
      .sort((a, b) => {
        // Sort by rating first, then by review count
        if (b.rating !== a.rating) {
          return b.rating - a.rating
        }
        return b.reviewCount - a.reviewCount
      })
      .slice(0, 10)

    // Get recent reviews (last 5) – from product reviews only
    const recentReviews: any[] = []
    products.forEach((product: any) => {
      if (product.reviews && Array.isArray(product.reviews)) {
        product.reviews
          .filter((r: any) => r.moderationStatus === 'approved')
          .sort(
            (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          )
          .slice(0, 5)
          .forEach((review: any) => {
            recentReviews.push({
              ...review,
              product: {
                _id: product._id as mongoose.Types.ObjectId,
                name: product.name,
                mainImage: product.mainImage,
                slug: product.slug,
              },
            })
          })
      }
    })
    recentReviews.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    const topRecentReviews = recentReviews.slice(0, 5)

    res.json({
      overallRating: averageRating,
      totalReviews,
      averageRating,
      ratingDistribution,
      recentReviews: topRecentReviews,
      topRatedProducts,
      explicitFeedbackCount,
    })
  } catch (err: unknown) {
    console.error('Error fetching seller review stats:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Get all reviews for seller's products (product reviews only)
export const getSellerReviews = async (req: Request, res: Response) => {
  try {
    const sellerId = new mongoose.Types.ObjectId(req.user?.userId)
    const { page = 1, limit = 10, rating, productId, status, search } = req.query

    if (!sellerId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    // Build product filter
    const productFilter: Record<string, unknown> = { seller: sellerId }
    if (productId) {
      productFilter._id = new mongoose.Types.ObjectId(productId as string)
    }

    // Get products
    const products = await Product.find(productFilter)
      .select('_id name mainImage slug reviews')
      .lean()

    // Collect all product reviews
    const allReviews: any[] = []
    products.forEach((product: any) => {
      if (product.reviews && Array.isArray(product.reviews)) {
        product.reviews.forEach((review: any) => {
          // Apply filters
          if (rating && review.rating !== Number(rating)) {
            return
          }
          if (status && review.moderationStatus !== status) {
            return
          }
          if (search) {
            const searchLower = (search as string).toLowerCase()
            const matchesSearch =
              review.comment?.toLowerCase().includes(searchLower) ||
              review.title?.toLowerCase().includes(searchLower) ||
              review.reviewer?.name?.toLowerCase().includes(searchLower) ||
              product.name.toLowerCase().includes(searchLower)
            if (!matchesSearch) {
              return
            }
          }

          allReviews.push({
            ...review,
            product: {
              _id: product._id as mongoose.Types.ObjectId,
              name: product.name,
              mainImage: product.mainImage,
              slug: product.slug,
            },
          })
        })
      }
    })

    // Sort by date (newest first)
    allReviews.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    // Paginate
    const skip = (Number(page) - 1) * Number(limit)
    const paginatedReviews = allReviews.slice(skip, skip + Number(limit))

    res.json({
      reviews: paginatedReviews,
      total: allReviews.length,
      page: Number(page),
      pages: Math.ceil(allReviews.length / Number(limit)),
    })
  } catch (err: unknown) {
    console.error('Error fetching seller reviews:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Get explicit feedback linked to seller's products (delivery / support / product)
export const getSellerFeedback = async (req: Request, res: Response) => {
  try {
    const sellerId = new mongoose.Types.ObjectId(req.user?.userId)
    const { page = 1, limit = 10, type, rating } = req.query

    if (!sellerId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    // Get all products for this seller (we need their IDs to link feedback)
    const products = await Product.find({ seller: sellerId })
      .select('_id name mainImage slug')
      .lean()

    const productIdMap = new Map<
      string,
      { _id: string; name: string; mainImage?: string; slug: string }
    >()
    const productIds: string[] = []
    products.forEach((p: any) => {
      const id = String(p._id)
      productIds.push(id)
      productIdMap.set(id, {
        _id: id,
        name: p.name,
        mainImage: p.mainImage,
        slug: p.slug,
      })
    })

    if (productIds.length === 0) {
      return res.json({
        feedback: [],
        total: 0,
        page: Number(page),
        pages: 0,
      })
    }

    const filter: any = {
      'metadata.productId': { $in: productIds },
      type: { $in: ['delivery', 'support', 'product'] },
    }

    if (type && typeof type === 'string') {
      // Narrow down to a single feedback type if requested
      filter.type = type
    }

    if (rating) {
      filter.rating = Number(rating)
    }

    const skip = (Number(page) - 1) * Number(limit)

    const [feedbackDocs, total] = await Promise.all([
      Feedback.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
      Feedback.countDocuments(filter),
    ])

    const items = feedbackDocs.map((fb: any) => {
      const product = fb.metadata?.productId
        ? productIdMap.get(String(fb.metadata.productId))
        : undefined

      return {
        _id: String(fb._id),
        rating: fb.rating,
        comment: fb.comment,
        type: fb.type as 'delivery' | 'support' | 'product',
        createdAt: fb.createdAt,
        product,
        metadata: {
          orderId: fb.metadata?.orderId,
          productId: fb.metadata?.productId,
        },
      }
    })

    res.json({
      feedback: items,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
    })
  } catch (err: unknown) {
    console.error('Error fetching seller feedback:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Get reviews for a specific product
export const getProductReviews = async (req: Request, res: Response) => {
  try {
    const sellerId = new mongoose.Types.ObjectId(req.user?.userId)
    const { productId } = req.params
    const { page = 1, limit = 10, rating } = req.query

    if (!sellerId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const product = await Product.findOne({
      _id: productId,
      seller: sellerId,
    }).select('_id name mainImage slug reviews')

    if (!product) {
      return res.status(404).json({ error: 'Product not found' })
    }

    let reviews = product.reviews || []

    // Apply filters
    if (rating) {
      reviews = reviews.filter((r: any) => r.rating === Number(rating))
    }

    // Sort by date (newest first)
    reviews.sort(
      (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )

    // Paginate
    const skip = (Number(page) - 1) * Number(limit)
    const paginatedReviews = reviews.slice(skip, skip + Number(limit))

    res.json({
      reviews: paginatedReviews,
      total: reviews.length,
      page: Number(page),
      pages: Math.ceil(reviews.length / Number(limit)),
    })
  } catch (err: unknown) {
    console.error('Error fetching product reviews:', err)
    res.status(500).json({ error: 'Server error' })
  }
}
