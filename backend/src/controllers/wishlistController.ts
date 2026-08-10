import crypto from 'crypto'
import { Request, Response } from 'express'
import Cart from '../models/Cart'
import Product from '../models/Product'
import ProductVariant from '../models/ProductVariant'
import Wishlist from '../models/Wishlist'
import { getOrCreateCart } from '../utils/cartUtils'

// Get user's wishlist
export const getWishlist = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    // Pagination parameters
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 10
    const skip = (page - 1) * limit

    let wishlist = await Wishlist.findOne(
      { user: userId },
      {
        items: { $slice: [skip, limit] },
      },
    )

    if (!wishlist) {
      // Create an empty wishlist if it doesn't exist
      return res.json({ wishlist: { items: [] } })
    }

    // Store original document reference to check for old structure
    const wishlistDoc = wishlist as any
    const hasOldProducts =
      wishlistDoc.products && Array.isArray(wishlistDoc.products) && wishlistDoc.products.length > 0
    const hasNoItems = !wishlist.items || wishlist.items.length === 0

    // First, populate products if old structure exists (before migration)
    if (hasOldProducts && hasNoItems) {
      // Populate products for backward compatibility BEFORE migration
      const productIds = wishlistDoc.products as string[]
      const populatedProducts = await Product.find({
        _id: { $in: productIds },
      })
        .select(
          'name mainImage price effectivePrice comparePrice costPrice discountPercent rating reviewCount seller slug status stock description shortDescription hasVariants',
        )
        .populate({
          path: 'seller',
          select: 'businessName',
        })

      // Convert to plain objects and attach populated products to the wishlist object
      // Maintain the order of productIds
      const productsMap = new Map(
        populatedProducts.map((p: any) => {
          const productObj = p.toObject ? p.toObject() : p
          return [p._id.toString(), productObj]
        }),
      )
      const orderedProducts = productIds
        .map((id) => {
          const product = productsMap.get(id.toString())
          if (product && product.seller && typeof product.seller.toObject === 'function') {
            product.seller = product.seller.toObject()
          }
          return product
        })
        .filter((p) => p !== undefined)

      // Fetch variants for products that have them (old structure)
      const productIdsWithVariants = orderedProducts
        .filter((p: any) => p && p.hasVariants)
        .map((p: any) => p._id.toString())

      // Initialize variantsByProduct for use in migration
      let variantsByProduct: Record<string, any[]> = {}

      if (productIdsWithVariants.length > 0) {
        // Fetch all variants (not just active) to get effectivePrice for wishlist display
        const variants = await ProductVariant.find({
          product: { $in: productIdsWithVariants },
        })
          .select(
            'name price effectivePrice comparePrice sku stock mainImage status discountPercent isDefault attributes',
          )
          .sort({ isDefault: -1, createdAt: 1 })
          .lean()

        // Group variants by product ID
        variantsByProduct = variants.reduce((acc: any, variant: any) => {
          // Check if variant has a product field before calling toString
          if (!variant.product) {
            return acc // Skip variants without product reference
          }
          const productId = variant.product.toString()
          if (!acc[productId]) {
            acc[productId] = []
          }
          acc[productId].push(variant)
          return acc
        }, {})

        // Attach variants to products
        orderedProducts.forEach((product: any) => {
          if (product && product.hasVariants) {
            const productId = product._id.toString()
            product.variants = variantsByProduct[productId] || []
          }
        })
      }

      // Attach populated products to response - ensure it's a plain object
      ;(wishlist as any).products = orderedProducts

      // Now migrate to new structure (but keep products in response for this request)
      if (wishlist) {
        const createdAt = wishlist.createdAt || new Date()

        // Use already fetched products for price map - use effectivePrice from variant if product has variants
        const productPriceMap = new Map<string, number>()
        populatedProducts.forEach((p: any) => {
          const productId = p._id.toString()
          let effectivePrice = p.effectivePrice ?? p.price ?? 0

          // If product has variants, get effectivePrice from default/first variant
          if (
            p.hasVariants &&
            variantsByProduct[productId] &&
            variantsByProduct[productId].length > 0
          ) {
            const defaultVariant =
              variantsByProduct[productId].find((v: any) => v.isDefault) ||
              variantsByProduct[productId][0]
            if (defaultVariant) {
              effectivePrice =
                defaultVariant.effectivePrice ??
                defaultVariant.price ??
                p.effectivePrice ??
                p.price ??
                0
            }
          }

          productPriceMap.set(productId, effectivePrice)
        })

        wishlist.items = productIds.map((productId: any) => ({
          product: productId,
          // Don't store priceAtAddition - we'll use effectivePrice from product/variant in response
          addedAt: createdAt,
        }))

        // Use unset to remove the old products field from the document
        await Wishlist.updateOne({ _id: wishlist._id }, { $unset: { products: '' } })

        // Save the items
        await wishlist.save()
      }
    }

    // Populate items if they exist
    if (wishlist.items && wishlist.items.length > 0) {
      // New structure - populate items
      await wishlist.populate({
        path: 'items.product',
        select:
          'name mainImage price effectivePrice comparePrice costPrice discountPercent rating reviewCount seller slug status stock description shortDescription hasVariants',
        populate: {
          path: 'seller',
          select: 'businessName',
        },
      })
    }

    // Convert wishlist to plain object for JSON serialization
    // This ensures populated products are included in the response
    const wishlistResponse = wishlist.toObject ? wishlist.toObject() : (wishlist as any)

    // Fetch only the selected variant for each wishlist item (if variantId is stored)
    if (wishlistResponse.items && wishlistResponse.items.length > 0) {
      // Get all variantIds from wishlist items
      const variantIds = wishlistResponse.items
        .filter((item: any) => item.variantId)
        .map((item: any) => item.variantId.toString())

      // For products without variantId but with variants, we'll fetch default variant
      const productIdsNeedingDefaultVariant = wishlistResponse.items
        .filter((item: any) => item.product && item.product.hasVariants && !item.variantId)
        .map((item: any) => item.product._id.toString())

      // Fetch selected variants by variantId
      let selectedVariants: any[] = []
      if (variantIds.length > 0) {
        selectedVariants = await ProductVariant.find({
          _id: { $in: variantIds },
        })
          .select(
            'name price product _id effectivePrice comparePrice sku stock mainImage status discountPercent isDefault attributes',
          )
          .lean()
      }

      // Fetch default variants for products without stored variantId
      let defaultVariants: any[] = []
      if (productIdsNeedingDefaultVariant.length > 0) {
        defaultVariants = await ProductVariant.find({
          product: { $in: productIdsNeedingDefaultVariant },
          isDefault: true,
        })
          .select(
            'name price product _id effectivePrice comparePrice sku stock mainImage status discountPercent isDefault attributes',
          )
          .sort({ createdAt: 1 })
          .lean()

        // If no default variant found, get first variant
        const productsWithoutDefault = productIdsNeedingDefaultVariant.filter(
          (pid: string) => !defaultVariants.some((v) => v.product?.toString() === pid),
        )
        if (productsWithoutDefault.length > 0) {
          const firstVariants = await ProductVariant.find({
            product: { $in: productsWithoutDefault },
          })
            .select(
              'name price product _id effectivePrice comparePrice sku stock mainImage status discountPercent isDefault attributes',
            )
            .sort({ createdAt: 1 })
            .limit(productsWithoutDefault.length)
            .lean()

          // Group by product and take first variant for each
          const firstVariantByProduct = firstVariants.reduce((acc: any, variant: any) => {
            if (!variant.product) return acc
            const productId = variant.product.toString()
            if (!acc[productId]) {
              acc[productId] = variant
            }
            return acc
          }, {})

          defaultVariants.push(...Object.values(firstVariantByProduct))
        }
      }

      // Create a map of variantId -> variant
      const variantMap = new Map()
      selectedVariants.forEach((v) => {
        variantMap.set(v._id.toString(), v)
      })
      defaultVariants.forEach((v) => {
        if (v.product) {
          variantMap.set(v.product.toString(), v)
        }
      })

      // Fetch all variants for products that have variants (for variant selector)
      const allProductIdsWithVariants = wishlistResponse.items
        .filter((item: any) => item.product && item.product.hasVariants)
        .map((item: any) => item.product._id.toString())

      let allVariantsByProduct: Record<string, any[]> = {}
      if (allProductIdsWithVariants.length > 0) {
        const allVariants = await ProductVariant.find({
          product: { $in: allProductIdsWithVariants },
        })
          .select(
            'name price product _id effectivePrice comparePrice sku stock mainImage status discountPercent isDefault attributes',
          )
          .sort({ isDefault: -1, createdAt: 1 })
          .lean()

        allVariantsByProduct = allVariants.reduce((acc: any, variant: any) => {
          if (!variant.product) return acc
          const productId = variant.product.toString()
          if (!acc[productId]) {
            acc[productId] = []
          }
          acc[productId].push(variant)
          return acc
        }, {})
      }

      // Merge variant data into product and attach all variants for selector
      wishlistResponse.items.forEach((item: any) => {
        if (item.product && item.product.hasVariants) {
          let selectedVariant = null

          // If variantId is stored, use that variant
          if (item.variantId) {
            selectedVariant = variantMap.get(item.variantId.toString())
          } else {
            // Otherwise use default variant for this product
            const productId = item.product._id.toString()
            selectedVariant = variantMap.get(productId)
          }

          if (selectedVariant) {
            // Merge variant data into product (don't send variant as separate field)
            if (
              selectedVariant.effectivePrice !== undefined &&
              selectedVariant.effectivePrice !== null
            ) {
              item.product.effectivePrice = selectedVariant.effectivePrice
            } else if (selectedVariant.price !== undefined && selectedVariant.price !== null) {
              item.product.effectivePrice = selectedVariant.price
            }
            if (selectedVariant.price !== undefined && selectedVariant.price !== null) {
              item.product.price = selectedVariant.price
            }
            if (
              selectedVariant.comparePrice !== undefined &&
              selectedVariant.comparePrice !== null
            ) {
              item.product.comparePrice = selectedVariant.comparePrice
            }
            // Merge other variant fields into product if needed
            if (selectedVariant.stock !== undefined) {
              item.product.stock = selectedVariant.stock
            }
            if (selectedVariant.mainImage) {
              item.product.mainImage = selectedVariant.mainImage
            }
            if (selectedVariant.name) {
              item.product.name = selectedVariant.name
            }
          }

          // Attach all variants for this product (for variant selector)
          const productId = item.product._id.toString()
          item.product.variants = allVariantsByProduct[productId] || []
        }
      })
    }

    // For products without variants or if variants array is empty, use stored effectivePrice from product
    // The effectivePrice field should already be in the response from the select statement
    // Don't override - use what's stored in database

    // Get total count for pagination metadata
    const totalWishlist = await Wishlist.findOne({ user: userId }, { items: 1 })
    const totalItems = totalWishlist?.items?.length || 0
    const totalPages = Math.ceil(totalItems / limit)

    res.json({
      wishlist: wishlistResponse,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems,
        itemsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    })
  } catch (error) {
    console.error('Get wishlist error:', error)
    res.status(500).json({ error: 'Server error' })
  }
}

// Add product to wishlist
export const addToWishlist = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId
    const { productId, variantId, note } = req.body

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    if (!productId) {
      return res.status(400).json({ error: 'Product ID is required' })
    }

    // Get product to track price
    const product = await Product.findById(productId)
    if (!product) {
      return res.status(404).json({ error: 'Product not found' })
    }

    // If product has variants but variantId not provided, get default variant
    let finalVariantId = variantId
    if (product.hasVariants && !variantId) {
      const defaultVariant = await ProductVariant.findOne({
        product: productId,
        isDefault: true,
      })
        .select('_id')
        .lean()

      if (defaultVariant) {
        finalVariantId = defaultVariant._id.toString()
      } else {
        // If no default variant, get first variant
        const firstVariant = await ProductVariant.findOne({ product: productId })
          .select('_id')
          .sort({ createdAt: 1 })
          .lean()

        if (firstVariant) {
          finalVariantId = firstVariant._id.toString()
        }
      }
    }

    // Store variantId if provided or found, don't store priceAtAddition - we'll use effectivePrice from product/variant in response
    let wishlist = await Wishlist.findOne({ user: userId })

    if (!wishlist) {
      // Create new wishlist if it doesn't exist
      wishlist = await Wishlist.create({
        user: userId,
        items: [
          {
            product: productId,
            variantId: finalVariantId ? (finalVariantId as any) : undefined,
            // Don't store priceAtAddition - use effectivePrice from product/variant
            note: note || undefined,
            addedAt: new Date(),
          },
        ],
      })
    } else {
      // Check if product already exists (with same variant if variantId provided)
      const existingItem = wishlist.items.find((item) => {
        const productMatch = item.product.toString() === productId.toString()
        if (finalVariantId) {
          return productMatch && item.variantId?.toString() === finalVariantId.toString()
        }
        return productMatch
      })

      if (existingItem) {
        return res.status(400).json({ error: 'Product already in wishlist' })
      }

      // Add product to wishlist with variantId if provided or found
      wishlist.items.push({
        product: productId as any,
        variantId: finalVariantId ? (finalVariantId as any) : undefined,
        // Don't store priceAtAddition - use effectivePrice from product/variant
        note: note || undefined,
        addedAt: new Date(),
      })
      await wishlist.save()
    }

    const populatedWishlist = await Wishlist.findById(wishlist._id).populate({
      path: 'items.product',
      select:
        'name mainImage price effectivePrice comparePrice discountPercent rating reviewCount seller slug status stock',
      populate: {
        path: 'seller',
        select: 'businessName',
      },
    })

    res.json({
      message: 'Product added to wishlist',
      wishlist: populatedWishlist,
    })
  } catch (error) {
    console.error('Add to wishlist error:', error)
    res.status(500).json({ error: 'Server error' })
  }
}

// Remove product from wishlist
export const removeFromWishlist = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId
    const { productId } = req.params
    const { variantId } = req.query // Get variantId from query params

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    // Build pull query - match productId and variantId if provided
    const pullQuery: any = { product: productId }
    if (variantId) {
      pullQuery.variantId = variantId
    }

    // Use atomic update to avoid version conflicts
    const wishlist = await Wishlist.findOneAndUpdate(
      { user: userId },
      { $pull: { items: pullQuery } },
      { new: true },
    )

    if (!wishlist) {
      return res.status(404).json({ error: 'Wishlist not found' })
    }

    const populatedWishlist = await Wishlist.findById(wishlist._id).populate({
      path: 'items.product',
      select:
        'name mainImage price effectivePrice comparePrice discountPercent rating reviewCount seller slug status stock',
      populate: {
        path: 'seller',
        select: 'businessName',
      },
    })

    res.json({
      message: 'Product removed from wishlist',
      wishlist: populatedWishlist,
    })
  } catch (error) {
    console.error('Remove from wishlist error:', error)
    res.status(500).json({ error: 'Server error' })
  }
}

// Bulk remove products from wishlist
export const bulkRemoveFromWishlist = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId
    const { productIds } = req.body

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    if (!Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ error: 'Product IDs array is required' })
    }

    // Use atomic update to avoid version conflicts
    const wishlist = await Wishlist.findOneAndUpdate(
      { user: userId },
      { $pull: { items: { product: { $in: productIds } } } },
      { new: true },
    )

    if (!wishlist) {
      return res.status(404).json({ error: 'Wishlist not found' })
    }

    const populatedWishlist = await Wishlist.findById(wishlist._id).populate({
      path: 'items.product',
      select:
        'name mainImage price effectivePrice comparePrice discountPercent rating reviewCount seller slug status stock',
      populate: {
        path: 'seller',
        select: 'businessName',
      },
    })

    res.json({
      message: `${productIds.length} product(s) removed from wishlist`,
      wishlist: populatedWishlist,
    })
  } catch (error) {
    console.error('Bulk remove from wishlist error:', error)
    res.status(500).json({ error: 'Server error' })
  }
}

// Update wishlist item note
export const updateWishlistItemNote = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId
    const { productId } = req.params
    const { note } = req.body

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const wishlist = await Wishlist.findOne({ user: userId })

    if (!wishlist) {
      return res.status(404).json({ error: 'Wishlist not found' })
    }

    const item = wishlist.items.find((item) => item.product.toString() === productId)

    if (!item) {
      return res.status(404).json({ error: 'Product not found in wishlist' })
    }

    item.note = note || undefined
    await wishlist.save()

    const populatedWishlist = await Wishlist.findById(wishlist._id).populate({
      path: 'items.product',
      select:
        'name mainImage price effectivePrice comparePrice discountPercent rating reviewCount seller slug status stock',
      populate: {
        path: 'seller',
        select: 'businessName',
      },
    })

    res.json({ message: 'Note updated', wishlist: populatedWishlist })
  } catch (error) {
    console.error('Update wishlist item note error:', error)
    res.status(500).json({ error: 'Server error' })
  }
}

// Move all wishlist items to cart
export const moveAllToCart = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const wishlist = await Wishlist.findOne({ user: userId }).populate({
      path: 'items.product',
      select: 'price effectivePrice stock status',
    })

    if (!wishlist || wishlist.items.length === 0) {
      return res.status(400).json({ error: 'Wishlist is empty' })
    }

    const cart = await getOrCreateCart(userId)

    let addedCount = 0
    const errors: string[] = []

    for (const item of wishlist.items) {
      const product = item.product as any

      // Skip out of stock items
      if (product.status === 'out_of_stock' || product.stock === 0) {
        errors.push(`${product.name || 'Product'}: Out of stock`)
        continue
      }

      // Check if product already in cart (matching product and variant if applicable)
      // Note: Wishlist items don't store variant info, so we match by product only
      // Check if product already in cart
      // Since wishlist items don't have variants, we match by product only
      // and only match cart items that also don't have variants
      const existingItemIndex = cart.items.findIndex((cartItem) => {
        const productMatch = cartItem.product.toString() === item.product.toString()
        // Normalize: treat null and undefined as "no variant"
        const cartItemVariantId = cartItem.variant ? cartItem.variant.toString() : null
        const noVariantMatch = cartItemVariantId === null // Only match items without variants
        return productMatch && noVariantMatch
      })

      if (existingItemIndex === -1) {
        // Add to cart
        const currentPrice = product.effectivePrice ?? product.price ?? 0
        cart.items.push({
          product: item.product as any,
          quantity: 1,
          priceAtAddition: currentPrice, // Keep for backward compatibility
          effectivePrice: currentPrice, // Use effectivePrice for all calculations
          selected: true,
        })
        addedCount++
      } else {
        // Update quantity if already in cart (check stock first)
        const existingItem = cart.items[existingItemIndex]
        const newQuantity = existingItem.quantity + 1
        const availableStock = product.stock || 0

        if (availableStock < newQuantity) {
          errors.push(`${product.name || 'Product'}: Insufficient stock (max: ${availableStock})`)
          continue
        }

        existingItem.quantity = newQuantity
        addedCount++
      }
    }

    await cart.save()

    // Always remove items from wishlist after moving to cart
    wishlist.items = []
    await wishlist.save()

    const populatedCart = await Cart.findById(cart._id).populate({
      path: 'items.product',
      model: 'Product',
      select:
        'name slug price mainImage stock description status discountPercent shortDescription tags isFeatured',
      populate: { path: 'seller', select: 'businessName' },
    })

    res.json({
      message: `${addedCount} item(s) moved to cart`,
      addedCount,
      errors: errors.length > 0 ? errors : undefined,
      cart: populatedCart,
    })
  } catch (error) {
    console.error('Move all to cart error:', error)
    res.status(500).json({ error: 'Server error' })
  }
}

// Check if product is in wishlist
export const checkWishlistStatus = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId
    const { productId } = req.params

    if (!userId) {
      return res.json({ isInWishlist: false })
    }

    const wishlist = await Wishlist.findOne({ user: userId })

    if (!wishlist) {
      return res.json({ isInWishlist: false })
    }

    const isInWishlist = wishlist.items.some((item) => item.product.toString() === productId)

    res.json({ isInWishlist })
  } catch (error) {
    console.error('Check wishlist status error:', error)
    res.status(500).json({ error: 'Server error' })
  }
}

// Update wishlist visibility
export const updateWishlistVisibility = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId
    const { isPublic } = req.body as { isPublic?: boolean }

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    if (typeof isPublic !== 'boolean') {
      return res.status(400).json({ error: 'isPublic must be a boolean value' })
    }

    const wishlist = await Wishlist.findOne({ user: userId })

    if (!wishlist) {
      return res.status(404).json({ error: 'Wishlist not found' })
    }

    wishlist.isPublic = isPublic

    if (!isPublic) {
      // revoke share token when making wishlist private
      wishlist.shareToken = undefined
    }

    await wishlist.save()

    const populatedWishlist = await Wishlist.findById(wishlist._id).populate({
      path: 'items.product',
      select:
        'name mainImage price effectivePrice comparePrice discountPercent rating reviewCount seller slug status stock',
      populate: {
        path: 'seller',
        select: 'businessName',
      },
    })

    res.json({
      message: `Wishlist visibility set to ${isPublic ? 'public' : 'private'}`,
      wishlist: populatedWishlist,
    })
  } catch (error) {
    console.error('Update wishlist visibility error:', error)
    res.status(500).json({ error: 'Server error' })
  }
}

// Generate share token for wishlist
export const generateShareToken = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    let wishlist = await Wishlist.findOne({ user: userId })

    if (!wishlist) {
      return res.status(404).json({ error: 'Wishlist not found' })
    }

    if (!wishlist.isPublic) {
      return res.status(400).json({
        error: 'Make your wishlist public before generating a share link',
      })
    }

    // Generate unique token
    const token = crypto.randomBytes(32).toString('hex')
    wishlist.shareToken = token
    await wishlist.save()

    const baseUrl =
      process.env.FRONTEND_URL?.replace(/\/$/, '') ||
      process.env.APP_URL?.replace(/\/$/, '') ||
      process.env.CLIENT_URL?.replace(/\/$/, '') ||
      `${req.protocol}://${req.get('host')}`

    res.json({
      message: 'Share token generated',
      shareToken: token,
      shareUrl: `${baseUrl}/wishlist/shared/${token}`,
    })
  } catch (error) {
    console.error('Generate share token error:', error)
    res.status(500).json({ error: 'Server error' })
  }
}

// Get shared wishlist by token
export const getSharedWishlist = async (req: Request, res: Response) => {
  try {
    const { token } = req.params

    const wishlist = await Wishlist.findOne({
      shareToken: token,
      isPublic: true,
    }).populate({
      path: 'items.product',
      select:
        'name mainImage price effectivePrice comparePrice costPrice discountPercent rating reviewCount seller slug status stock hasVariants',
      populate: {
        path: 'seller',
        select: 'businessName',
      },
    })

    if (!wishlist) {
      return res.status(404).json({ error: 'Wishlist not found or not public' })
    }

    // Convert wishlist to plain object
    const wishlistResponse = wishlist.toObject ? wishlist.toObject() : (wishlist as any)

    // Fetch only the selected variant for each wishlist item (if variantId is stored)
    if (wishlistResponse.items && wishlistResponse.items.length > 0) {
      // Get all variantIds from wishlist items
      const variantIds = wishlistResponse.items
        .filter((item: any) => item.variantId)
        .map((item: any) => item.variantId.toString())

      // For products without variantId but with variants, we'll fetch default variant
      const productIdsNeedingDefaultVariant = wishlistResponse.items
        .filter((item: any) => item.product && item.product.hasVariants && !item.variantId)
        .map((item: any) => item.product._id.toString())

      // Fetch selected variants by variantId
      let selectedVariants: any[] = []
      if (variantIds.length > 0) {
        selectedVariants = await ProductVariant.find({
          _id: { $in: variantIds },
        })
          .select(
            'name price product _id effectivePrice comparePrice sku stock mainImage status discountPercent isDefault attributes',
          )
          .lean()
      }

      // Fetch default variants for products without stored variantId
      let defaultVariants: any[] = []
      if (productIdsNeedingDefaultVariant.length > 0) {
        defaultVariants = await ProductVariant.find({
          product: { $in: productIdsNeedingDefaultVariant },
          isDefault: true,
        })
          .select(
            'name price product _id effectivePrice comparePrice sku stock mainImage status discountPercent isDefault attributes',
          )
          .sort({ createdAt: 1 })
          .lean()

        // If no default variant found, get first variant
        const productsWithoutDefault = productIdsNeedingDefaultVariant.filter(
          (pid: string) => !defaultVariants.some((v) => v.product?.toString() === pid),
        )
        if (productsWithoutDefault.length > 0) {
          const firstVariants = await ProductVariant.find({
            product: { $in: productsWithoutDefault },
          })
            .select(
              'name price product _id effectivePrice comparePrice sku stock mainImage status discountPercent isDefault attributes',
            )
            .sort({ createdAt: 1 })
            .limit(productsWithoutDefault.length)
            .lean()

          // Group by product and take first variant for each
          const firstVariantByProduct = firstVariants.reduce((acc: any, variant: any) => {
            if (!variant.product) return acc
            const productId = variant.product.toString()
            if (!acc[productId]) {
              acc[productId] = variant
            }
            return acc
          }, {})

          defaultVariants.push(...Object.values(firstVariantByProduct))
        }
      }

      // Create a map of variantId -> variant
      const variantMap = new Map()
      selectedVariants.forEach((v) => {
        variantMap.set(v._id.toString(), v)
      })
      defaultVariants.forEach((v) => {
        if (v.product) {
          variantMap.set(v.product.toString(), v)
        }
      })

      // Fetch all variants for products that have variants (for variant selector)
      const allProductIdsWithVariants = wishlistResponse.items
        .filter((item: any) => item.product && item.product.hasVariants)
        .map((item: any) => item.product._id.toString())

      let allVariantsByProduct: Record<string, any[]> = {}
      if (allProductIdsWithVariants.length > 0) {
        const allVariants = await ProductVariant.find({
          product: { $in: allProductIdsWithVariants },
        })
          .select(
            'name price product _id effectivePrice comparePrice sku stock mainImage status discountPercent isDefault attributes',
          )
          .sort({ isDefault: -1, createdAt: 1 })
          .lean()

        allVariantsByProduct = allVariants.reduce((acc: any, variant: any) => {
          if (!variant.product) return acc
          const productId = variant.product.toString()
          if (!acc[productId]) {
            acc[productId] = []
          }
          acc[productId].push(variant)
          return acc
        }, {})
      }

      // Merge variant data into product and attach all variants for selector
      wishlistResponse.items.forEach((item: any) => {
        if (item.product && item.product.hasVariants) {
          let selectedVariant = null

          // If variantId is stored, use that variant
          if (item.variantId) {
            selectedVariant = variantMap.get(item.variantId.toString())
          } else {
            // Otherwise use default variant for this product
            const productId = item.product._id.toString()
            selectedVariant = variantMap.get(productId)
          }

          if (selectedVariant) {
            // Merge variant data into product (don't send variant as separate field)
            if (
              selectedVariant.effectivePrice !== undefined &&
              selectedVariant.effectivePrice !== null
            ) {
              item.product.effectivePrice = selectedVariant.effectivePrice
            } else if (selectedVariant.price !== undefined && selectedVariant.price !== null) {
              item.product.effectivePrice = selectedVariant.price
            }
            if (selectedVariant.price !== undefined && selectedVariant.price !== null) {
              item.product.price = selectedVariant.price
            }
            if (
              selectedVariant.comparePrice !== undefined &&
              selectedVariant.comparePrice !== null
            ) {
              item.product.comparePrice = selectedVariant.comparePrice
            }
            // Merge other variant fields into product if needed
            if (selectedVariant.stock !== undefined) {
              item.product.stock = selectedVariant.stock
            }
            if (selectedVariant.mainImage) {
              item.product.mainImage = selectedVariant.mainImage
            }
            if (selectedVariant.name) {
              item.product.name = selectedVariant.name
            }
          }

          // Attach all variants for this product (for variant selector)
          const productId = item.product._id.toString()
          item.product.variants = allVariantsByProduct[productId] || []
        }
      })
    }

    // For products without variants or if variants array is empty, use stored effectivePrice from product
    // The effectivePrice field should already be in the response from the select statement
    // Don't override - use what's stored in database

    res.json({ wishlist: wishlistResponse })
  } catch (error) {
    console.error('Get shared wishlist error:', error)
    res.status(500).json({ error: 'Server error' })
  }
}
